import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/connect';
import DigiLockerRequest from '@/lib/models/DigiLockerRequest';
import DigiLockerVault from '@/lib/models/DigiLockerVault';
import LandRequest from '@/lib/models/LandRequest';
import User from '@/lib/models/User';
import crypto from 'crypto';
import { getCurrentUser } from '@/lib/utils/auth';

async function uploadToIPFS(fileData: string, fileName: string): Promise<{ ipfsHash: string; contentHash: string }> {
  const pinataApiKey = process.env.PINATA_API_KEY;
  const pinataSecretKey = process.env.PINATA_SECRET_KEY;
  if (!pinataApiKey || !pinataSecretKey) {
    throw new Error('Pinata is not configured. Set PINATA_API_KEY and PINATA_SECRET_KEY on the server.');
  }
  const base64Data = fileData.includes(',') ? fileData.split(',')[1] : fileData;
  const buffer = Buffer.from(base64Data, 'base64');

  // Calculate SHA-256 Hash for M7 integrity check
  const contentHash = crypto.createHash('sha256').update(buffer).digest('hex');

  const formData = new FormData();
  formData.append('file', new Blob([buffer], { type: 'application/pdf' }), fileName || 'document.pdf');
  formData.append('pinataMetadata', JSON.stringify({ name: fileName || 'document.pdf' }));

  const response = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
    method: 'POST',
    headers: {
      'pinata_api_key': pinataApiKey,
      'pinata_secret_api_key': pinataSecretKey,
    },
    body: formData
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.IpfsHash) {
    throw new Error(`Pinata upload failed (${response.status}): ${data.error || data.message || 'Check Pinata credentials and pinFileToIPFS permission.'}`);
  }
  return { ipfsHash: data.IpfsHash, contentHash };
}

async function recordOnBlockchain(ipfsHash: string, contentHash: string, requestId: string, aadharNumber: string, officialId: string): Promise<string> {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_FABRIC_API_URL}/api/land/digilocker/record`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ipfsHash, contentHash, requestId, aadharNumber, officialId })
    });
    if (response.ok) {
      const data = await response.json();
      return data.txId || 'recorded';
    }
  } catch (err) {
    console.log('Blockchain record failed, continuing:', err);
  }
  return 'local-only';
}

export async function POST(req: NextRequest) {
  try {
    await connectDB();
    const session = await getCurrentUser();
    if (!session || session.userType !== 'user' || !session.userId) {
      return NextResponse.json({ error: 'Sign in as the citizen who received this request' }, { status: 401 });
    }
    const { requestId, action } = await req.json();

    if (!requestId || !action || !['approved', 'rejected'].includes(action)) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    const request = await DigiLockerRequest.findById(requestId);
    if (!request) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }

    const user = await User.findById(session.userId).select('email');
    if (!user?.email || user.email.toLowerCase() !== request.citizenEmail.toLowerCase()) {
      return NextResponse.json({ error: 'This document request belongs to a different citizen account' }, { status: 403 });
    }
    if (request.status !== 'pending') {
      return NextResponse.json({ error: `This request has already been ${request.status}` }, { status: 409 });
    }

    if (action === 'rejected') {
      await DigiLockerRequest.findByIdAndUpdate(requestId, {
        status: 'rejected',
        respondedAt: new Date(),
        citizenResponse: 'Access denied'
      });
      return NextResponse.json({ success: true, message: 'Request rejected' });
    }

    // action === 'approved'
    // Step 1: Get document from vault
    const landRequest = await LandRequest.findOne({
      receiptNumber: request.applicationId
    });
    const aadhar = landRequest?.aadharNumber || '';
    const vaultDoc = await DigiLockerVault.findOne({
      citizenAadhar: aadhar,
      documentType: request.documentType
    });

    if (!vaultDoc || !vaultDoc.fileData) {
      return NextResponse.json({ error: 'Document not found in vault' }, { status: 404 });
    }

    // Step 2: Upload once and reuse the CID if a previous approval attempt
    // completed the Pinata upload but failed later in the workflow.
    let ipfsHash = vaultDoc.ipfsHash || '';
    let contentHash = vaultDoc.docHash || '';
    if (!ipfsHash || !contentHash) {
      try {
        const result = await uploadToIPFS(vaultDoc.fileData, vaultDoc.fileName);
        ipfsHash = result.ipfsHash;
        contentHash = result.contentHash;
        vaultDoc.ipfsHash = ipfsHash;
        vaultDoc.docHash = contentHash;
        await vaultDoc.save();
      } catch (err) {
        console.error('IPFS upload/hash failed:', err);
        return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to secure document to IPFS' }, { status: 500 });
      }
    }

    // Step 3: Record on blockchain (including the new contentHash)
    const txId = await recordOnBlockchain(
      ipfsHash,
      contentHash,
      requestId,
      vaultDoc.citizenAadhar,
      request.requestedBy
    );

    // Step 4: Update request with ipfsHash, docHash and txId
    const updated = await DigiLockerRequest.findByIdAndUpdate(
      requestId,
      {
        status: 'approved',
        respondedAt: new Date(),
        citizenResponse: 'Access granted',
        ipfsHash: ipfsHash,
        docHash: contentHash
      },
      { new: true }
    );

    if (landRequest) {
      landRequest.ipfsHash = ipfsHash;
      landRequest.docHash = contentHash;
      await landRequest.save();
    }

    console.log('\n==========================================');
    console.log('M7 SECURITY GATEWAY: HASH GENERATED');
    console.log('SHA-256:', contentHash);
    console.log('IPFS Address:', ipfsHash);
    console.log('==========================================\n');

    return NextResponse.json({
      success: true,
      message: 'Document approved and uploaded to IPFS',
      ipfsHash,
      txId,
      data: updated
    });

  } catch (error) {
    console.error('Respond error:', error);
    return NextResponse.json({ error: 'Failed to respond' }, { status: 500 });
  }
}
