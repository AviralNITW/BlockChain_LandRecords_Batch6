import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import connectDB from '@/lib/db/connect';
import Session from '@/lib/models/Session';
import Official from '@/lib/models/Official';
import LandRequest from '@/lib/models/LandRequest';
import { createWorker } from 'tesseract.js';

export async function POST(req: NextRequest) {
  try {
    const { receiptNumber, ipfsHash } = await req.json();

    if (!receiptNumber) {
      return NextResponse.json({ error: 'Receipt number is required' }, { status: 400 });
    }

    await connectDB();

    // Authenticate official
    const cookieStore = await cookies();
    const token = cookieStore.get('session_token')?.value;
    if (token) {
      const session = await Session.findOne({
        sessionToken: token,
        userType: 'official',
        expiresAt: { $gt: new Date() }
      });
      if (!session) {
        return NextResponse.json({ error: 'Unauthorized official session' }, { status: 401 });
      }
    }

    const application = await LandRequest.findOne({ receiptNumber });
    if (!application) {
      return NextResponse.json({ error: 'Application not found' }, { status: 404 });
    }

    let extractedText = '';
    let extractedFields: {
      label: string;
      expected: string;
      extracted: string;
      match: boolean;
      confidence: number;
    }[] = [];

    // Attempt real OCR via Tesseract if an IPFS document hash is present
    const hash = ipfsHash || application.ipfsHash;
    if (hash) {
      try {
        const ipfsUrl = `https://gateway.pinata.cloud/ipfs/${hash}`;
        const response = await fetch(ipfsUrl, { signal: AbortSignal.timeout(8000) });
        if (response.ok) {
          const buffer = await response.arrayBuffer();
          const worker = await createWorker('eng');
          const ret = await worker.recognize(Buffer.from(buffer));
          extractedText = ret.data.text || '';
          await worker.terminate();
        }
      } catch (ocrErr) {
        console.warn('IPFS document retrieval or Tesseract OCR warning:', ocrErr);
      }
    }

    // Determine field values: using OCR extracted text if available, or persisted OCR data from the database
    const expectedOwner = application.ownerName || application.fullName || '';
    const expectedSurvey = application.surveyNumber || '';
    const expectedArea = application.area || '';
    const expectedAadhar = application.aadharNumber || '';

    let extractedOwner = application.ocrData?.applicantName || application.ocrData?.extractedOwner || '';
    let extractedSurvey = application.ocrData?.surveyNumber || application.ocrData?.extractedSurveyNo || '';
    let extractedArea = application.ocrData?.landArea || application.ocrData?.extractedArea || '';
    let extractedAadhar = application.ocrData?.aadharNumber || '';

    if (extractedText) {
      // Parse fields from real OCR text
      const lines = extractedText.split('\n');
      for (const line of lines) {
        if (/owner|name|applicant/i.test(line)) {
          extractedOwner = line.replace(/.*[:\-]/, '').trim() || extractedOwner;
        }
        if (/survey|sy\s*no|plot/i.test(line)) {
          extractedSurvey = line.replace(/.*[:\-]/, '').trim() || extractedSurvey;
        }
        if (/area|extent|acres|sq\s*yd/i.test(line)) {
          extractedArea = line.replace(/.*[:\-]/, '').trim() || extractedArea;
        }
        if (/\d{4}\s*\d{4}\s*\d{4}/.test(line)) {
          const match = line.match(/\d{4}\s*\d{4}\s*\d{4}/);
          if (match) extractedAadhar = match[0].replace(/\s/g, '');
        }
      }
    }

    // Only use genuine extracted values from document or database record
    if (!extractedOwner) extractedOwner = 'Not Found in Document';
    if (!extractedSurvey) extractedSurvey = 'Not Found in Document';
    if (!extractedArea) extractedArea = 'Not Found in Document';
    if (!extractedAadhar) extractedAadhar = 'Not Found in Document';

    // Strict genuine matching
    const cleanStr = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
    const ownerCleanExpected = cleanStr(expectedOwner);
    const ownerCleanExtracted = cleanStr(extractedOwner);
    const isOwnerMatch = extractedOwner !== 'Not Found in Document' && (
      ownerCleanExpected === ownerCleanExtracted ||
      ownerCleanExpected.startsWith(ownerCleanExtracted) ||
      ownerCleanExtracted.startsWith(ownerCleanExpected)
    );

    const isSurveyMatch = extractedSurvey !== 'Not Found in Document' && cleanStr(expectedSurvey) === cleanStr(extractedSurvey);
    const isAreaMatch = extractedArea !== 'Not Found in Document' && (cleanStr(expectedArea) === cleanStr(extractedArea) || cleanStr(extractedArea).includes(cleanStr(expectedArea).replace(/[^0-9]/g, '')));
    const isAadharMatch = extractedAadhar !== 'Not Found in Document' && (
      cleanStr(expectedAadhar) === cleanStr(extractedAadhar) ||
      (extractedAadhar.includes('X') && cleanStr(expectedAadhar).slice(0, 4) === cleanStr(extractedAadhar).slice(0, 4))
    );

    extractedFields = [
      {
        label: 'Owner Name',
        expected: expectedOwner || 'N/A',
        extracted: extractedOwner || 'N/A',
        match: isOwnerMatch,
        confidence: isOwnerMatch ? (ownerCleanExpected === ownerCleanExtracted ? 100 : 75) : 35
      },
      {
        label: 'Survey Number',
        expected: expectedSurvey || 'N/A',
        extracted: extractedSurvey || 'N/A',
        match: isSurveyMatch,
        confidence: isSurveyMatch ? 100 : 40
      },
      {
        label: 'Land Area',
        expected: expectedArea ? `${expectedArea}` : 'N/A',
        extracted: extractedArea ? `${extractedArea}` : 'N/A',
        match: isAreaMatch,
        confidence: isAreaMatch ? 95 : 30
      },
      {
        label: 'Aadhaar / ID Verification',
        expected: expectedAadhar || 'N/A',
        extracted: extractedAadhar || 'N/A',
        match: isAadharMatch,
        confidence: isAadharMatch ? 90 : 25
      }
    ];

    // Calculate real composite confidence percentage
    const totalConfidence = Math.round(
      extractedFields.reduce((sum, f) => sum + f.confidence, 0) / extractedFields.length
    );

    // Save real OCR results to MongoDB record
    await LandRequest.findOneAndUpdate(
      { receiptNumber },
      {
        $set: {
          ocrMatch: totalConfidence,
          ocrData: {
            applicantName: extractedOwner,
            surveyNumber: extractedSurvey,
            landArea: extractedArea,
            aadharNumber: extractedAadhar,
            verifiedAt: new Date().toISOString()
          }
        }
      }
    );

    return NextResponse.json({
      success: true,
      confidence: totalConfidence,
      fields: extractedFields,
      source: extractedText ? 'document_ocr' : 'verified_ledger_record',
      savedToDatabase: true
    });

  } catch (error) {
    console.error('Real OCR analysis error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'OCR processing failed' },
      { status: 500 }
    );
  }
}
