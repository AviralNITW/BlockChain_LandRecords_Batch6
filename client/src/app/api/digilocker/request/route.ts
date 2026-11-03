import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/connect';
import DigiLockerRequest from '@/lib/models/DigiLockerRequest';
import DigiLockerVault from '@/lib/models/DigiLockerVault';
import LandRequest from '@/lib/models/LandRequest';
import Official from '@/lib/models/Official';
import User from '@/lib/models/User';
import { getCurrentUser } from '@/lib/utils/auth';

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Official creates an access request using the authenticated identity and the
// citizen/document already attached to the land application.
export async function POST(req: NextRequest) {
  try {
    await connectDB();
    const session = await getCurrentUser();
    if (!session || session.userType !== 'official' || !session.officialId) {
      return NextResponse.json({ message: 'Only authenticated officials can request DigiLocker access' }, { status: 401 });
    }

    const { receiptNumber, documentType = 'land_deed' } = await req.json();
    if (typeof receiptNumber !== 'string' || !receiptNumber.trim()) {
      return NextResponse.json({ message: 'Application receipt number is required' }, { status: 400 });
    }

    const [official, application] = await Promise.all([
      Official.findById(session.officialId).select('-password'),
      LandRequest.findOne({ receiptNumber: receiptNumber.trim() }),
    ]);
    if (!official) return NextResponse.json({ message: 'Official account not found' }, { status: 401 });
    if (!application) return NextResponse.json({ message: 'Application not found' }, { status: 404 });

    const vault = await DigiLockerVault.findOne({
      citizenAadhar: application.aadharNumber,
      documentType,
    });
    if (!vault) {
      return NextResponse.json({ message: 'No matching DigiLocker document is available for this applicant' }, { status: 404 });
    }

    const existing = await DigiLockerRequest.findOne({
      applicationId: application.receiptNumber,
      documentType,
      status: { $in: ['pending', 'approved'] },
    }).sort({ createdAt: -1 });
    if (existing) {
      return NextResponse.json({ message: existing.status === 'pending' ? 'A request is already waiting for citizen approval' : 'Access was already approved for this application', request: existing });
    }

    const request = await DigiLockerRequest.create({
      applicationId: application.receiptNumber,
      requestedBy: String(official._id),
      requestedByDesignation: official.designation,
      citizenUsername: application.createdBy,
      citizenEmail: application.email.trim().toLowerCase(),
      documentType,
      ipfsHash: vault.ipfsHash || '',
      status: 'pending',
    });

    return NextResponse.json({ message: 'Document request sent to citizen successfully', request }, { status: 201 });
  } catch (error) {
    console.error('DigiLocker request error:', error);
    return NextResponse.json({ message: 'Failed to create request' }, { status: 500 });
  }
}

// Citizen sees only requests addressed to their signed-in account. Officials
// may query requests for the application currently being reviewed.
export async function GET(req: NextRequest) {
  try {
    await connectDB();
    const session = await getCurrentUser();
    if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    let query: any;
    if (session.userType === 'user' && session.userId) {
      const user = await User.findById(session.userId).select('email');
      if (!user?.email) return NextResponse.json({ message: 'Citizen account not found' }, { status: 401 });
      const emailPattern = new RegExp(`^\\s*${escapeRegex(user.email.trim())}\\s*$`, 'i');
      const applications = await LandRequest.find({ createdBy: session.userId }).select('receiptNumber').lean();
      const applicationIds = applications.map((application) => application.receiptNumber).filter(Boolean);
      query = {
        $or: [
          { citizenUsername: session.userId },
          { citizenEmail: emailPattern },
          { citizenUsername: emailPattern },
          ...(applicationIds.length ? [{ applicationId: { $in: applicationIds } }] : []),
        ],
      };
    } else if (session.userType === 'official') {
      const receiptNumber = searchParams.get('receiptNumber');
      if (!receiptNumber) return NextResponse.json({ message: 'Application receipt number is required' }, { status: 400 });
      query = { applicationId: receiptNumber };
    } else {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const requests = await DigiLockerRequest.find(query).sort({ createdAt: -1 });
    return NextResponse.json({ requests });
  } catch (error) {
    console.error('DigiLocker request lookup error:', error);
    return NextResponse.json({ message: 'Failed to fetch requests' }, { status: 500 });
  }
}
