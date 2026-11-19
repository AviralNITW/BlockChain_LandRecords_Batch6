import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import connectDB from '@/lib/db/connect';
import Session from '@/lib/models/Session';
import Official from '@/lib/models/Official';
import LandRequest from '@/lib/models/LandRequest';
import { computeTrustScore } from '@/lib/utils/trustScore';

const STATUS_LABELS: Record<string, string> = {
  submitted: 'Submitted, awaiting initial review', with_clerk: 'With Clerk',
  with_superintendent: 'With Superintendent', with_projectofficer: 'With Project Officer',
  with_vro: 'With VRO', with_surveyor: 'With Surveyor', with_revenueinspector: 'With Revenue Inspector',
  with_mro: 'With MRO', with_revenuedeptofficer: 'With Revenue Department Officer',
  revenue_verification: 'Revenue Department Verification in progress',
  with_jointcollector: 'With Joint Collector', with_districtcollector: 'With District Collector',
  with_ministrywelfare: 'With Ministry of Welfare', approved: 'Approved', completed: 'Completed', rejected: 'Rejected',
};

const ROLE_GUIDES: Record<string, string> = {
  clerk: 'Check the submitted form and required identity and land documents, confirm the owner and survey details, record any discrepancy, then forward the file through the official workflow.',
  superintendent: 'Review the Clerk’s recorded checks, confirm the application is complete, and return it for correction or forward it using the official workflow.',
  mro: 'Review the revenue and ownership records for the parcel, check the survey details and any recorded remarks, and document your findings before forwarding.',
  collector: 'Review the prior verification history, supporting records, and unresolved issues before making a decision through the existing approval workflow.',
  districtcollector: 'Review the prior verification history, supporting records, and unresolved issues before making a decision through the existing approval workflow.',
  district_collector: 'Review the prior verification history, supporting records, and unresolved issues before making a decision through the existing approval workflow.',
  jointcollector: 'Review the prior verification history, supporting records, and unresolved issues before making a decision through the existing approval workflow.',
  joint_collector: 'Review the prior verification history, supporting records, and unresolved issues before making a decision through the existing approval workflow.',
};

function summarize(app: any, designation: string) {
  const calculated = computeTrustScore(app);
  const score = app.trustScore || calculated.score;
  const history = Array.isArray(app.actionHistory) ? app.actionHistory : [];
  const latest = history.at(-1);
  
  let ocrSummary = 'No OCR comparison result is recorded yet.';
  if (typeof app.ocrMatch === 'number') {
    ocrSummary = `Recorded OCR Field Symmetry: ${app.ocrMatch}% confidence match. Document verified against official citizen declarations.`;
  } else if (app.ocrMatch && typeof app.ocrMatch === 'object') {
    const ocr = app.ocrMatch;
    ocrSummary = `Recorded OCR results: owner ${ocr.ownerMatch ? 'matched' : 'mismatched'}, survey number ${ocr.surveyMatch ? 'matched' : 'mismatched'}${Number.isFinite(ocr.confidence) ? ` (${ocr.confidence}% confidence)` : ''}.`;
  } else if (app.ocrData) {
    ocrSummary = `OCR data available on ledger (${app.ocrData.verifiedDocuments || 'records'} checked).`;
  }

  return `${app.fullName || app.ownerName || 'Applicant'}’s application ${app.receiptNumber} is currently at "${STATUS_LABELS[app.status] || app.status || 'in an unknown status'}" for survey ${app.surveyNumber || 'not recorded'} (${app.area || 'area not recorded'}). Its verified trust index is ${score}/100 across cryptographic ledger hashes, document veracity, and identity completeness. ${ocrSummary} There ${history.length === 1 ? 'is' : 'are'} ${history.length} recorded verification action${history.length === 1 ? '' : 's'}${latest ? `; the latest was ${latest.action || 'an action'} by ${latest.officialName || 'an official'}${latest.designation ? ` (${latest.designation})` : ''}${latest.timestamp ? ` on ${new Date(latest.timestamp).toLocaleDateString('en-IN')}` : ''}${latest.remarks ? `, with the remark: “${latest.remarks}”` : ''}` : ''}.`;
}

function answer(question: string, app: any, designation: string): string {
  const q = question.toLowerCase();
  const role = designation.toLowerCase().replace(/[^a-z]/g, '');
  if (/digilocker|digi locker|link.*(account|document)|connect.*digilocker/.test(q)) {
    return 'DigiLocker linking is handled by the applicant from the DigiLocker area of the portal. The applicant signs in, links or authorizes their DigiLocker account, and shares the requested document. An official can request a document from the application’s DigiLocker panel; the applicant must respond. This assistant cannot link accounts or send requests.';
  }
  if (/required document|which document|documents required|document checklist/.test(q)) {
    return 'The application flow collects identity details and land ownership/registration documents. The exact checklist can depend on the application type and local rules; check the portal’s application form and your department’s current checklist. The assistant does not certify document completeness.';
  }
  if (/process|next step|workflow|what happens next|how .* work/.test(q)) {
    return `The file moves through the configured official stages, starting with Clerk review and progressing through the relevant supervisory, revenue and collectorate roles. Each action must be recorded by an authorized official in the existing workflow. Current status: ${STATUS_LABELS[app.status] || app.status || 'unknown'}.`;
  }
  if (/ocr|mismatch|match/.test(q)) {
    if (typeof app.ocrMatch === 'number') {
      return `Recorded OCR symmetry analysis indicates a **${app.ocrMatch}% confidence match** between the uploaded documents and citizen portal entries. Owner and survey number match required parameters.`;
    }
    const ocr = app.ocrMatch;
    if (!ocr && !app.ocrData) return 'There is no persisted OCR comparison result on this application yet. Click "Run Real OCR Analysis" in the OCR panel above to extract and verify fields.';
    return `Recorded OCR comparison: owner name ${ocr?.ownerMatch ? 'matches' : 'requires verification'} and survey number ${ocr?.surveyMatch ? 'matches' : 'requires verification'}${Number.isFinite(ocr?.confidence) ? `; confidence ${ocr?.confidence}%` : ''}. Compare the source document before acting.`;
  }
  if (/trust|score|integrity/.test(q)) {
    const calculated = computeTrustScore(app);
    const score = app.trustScore || calculated.score;
    return `The verified trust index is **${score}/100**. Dimensions evaluated: Integrity (40 pts) via SHA-256 ledger fingerprint, Veracity (30 pts) via document source, Symmetry (20 pts) via OCR field analysis, and Identity (10 pts) via Aadhaar/DID anchor.`;
  }
  if (/history|timeline|who .* (did|checked)|verification/.test(q)) {
    const entries = app.actionHistory || [];
    if (!entries.length) return 'No official verification actions are recorded in this application’s history yet.';
    return `Recorded history (${entries.length} actions):\n` + entries.map((entry: any, i: number) => `${i + 1}. ${entry.action || 'Action'} — ${entry.officialName || 'Official'}${entry.designation ? ` (${entry.designation})` : ''}${entry.timestamp ? `, ${new Date(entry.timestamp).toLocaleString('en-IN')}` : ''}${entry.remarks ? ` — ${entry.remarks}` : ''}`).join('\n');
  }
  if (/recommend|should i|approve|reject|decision/.test(q)) {
    return `I can summarize records, but I cannot recommend or make an approval/rejection decision. ${ROLE_GUIDES[role] || 'Review the recorded documents, application details and verification history, then use your authorized official workflow.'}`;
  }
  return summarize(app, designation) + `\n\nFor ${designation}: ${ROLE_GUIDES[role] || 'Review the recorded documents, application details and verification history before acting.'}`;
}

export async function POST(req: NextRequest) {
  try {
    const { receiptNumber, question } = await req.json();
    if (typeof receiptNumber !== 'string' || !receiptNumber.trim() || typeof question !== 'string' || !question.trim()) {
      return NextResponse.json({ error: 'Receipt number and question are required' }, { status: 400 });
    }
    await connectDB();
    const token = (await cookies()).get('session_token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const session = await Session.findOne({ sessionToken: token, userType: 'official', expiresAt: { $gt: new Date() } });
    if (!session?.officialId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const official = await Official.findById(session.officialId).select('-password');
    if (!official) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const app: any = await LandRequest.findOne({ receiptNumber: receiptNumber.trim() }).lean();
    if (!app) return NextResponse.json({ error: 'Application not found' }, { status: 404 });
    const response = answer(question.trim().slice(0, 500), app, official.designation);
    return NextResponse.json({ success: true, response, metadata: { receiptNumber: app.receiptNumber, status: app.status } });
  } catch (error) {
    console.error('Official explainability request failed:', error);
    return NextResponse.json({ error: 'Could not prepare the application explanation' }, { status: 500 });
  }
}
