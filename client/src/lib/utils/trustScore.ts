/**
 * Centralized Trust Score Computation
 * Deterministic, transparent, and aligned across UI gauge, API, and Blockchain
 */

export interface TrustScoreDetails {
  score: number;
  integrity: number;
  veracity: number;
  symmetry: number;
  breakdown: {
    ledgerHash: number;       // Max 40% (SHA-256 fingerprint anchored to ledger)
    documentSource: number;   // Max 30% (IPFS / DigiLocker storage)
    fieldSymmetry: number;    // Max 20% (Owner & Survey & Area consistency)
    identityVerified: number; // Max 10% (Aadhaar / DID verification)
  };
}

export function computeTrustScore(application: any): TrustScoreDetails {
  if (!application) {
    return {
      score: 0,
      integrity: 0,
      veracity: 0,
      symmetry: 0,
      breakdown: { ledgerHash: 0, documentSource: 0, fieldSymmetry: 0, identityVerified: 0 },
    };
  }

  // If application already has a trusted blockchain/DB score recorded, align with it
  const existingScore = typeof application.trustScore === 'number' && !isNaN(application.trustScore)
    ? application.trustScore
    : null;

  // 1. Ledger Hash / Blockchain Anchor (40 pts)
  let ledgerHash = 0;
  if (application.docHash || application.trustDetails?.integrityMatch) {
    ledgerHash = 40;
  }

  // 2. Document Source: IPFS or DigiLocker (30 pts)
  let documentSource = 0;
  if (application.ipfsHash || (application.submittedDocuments && application.submittedDocuments > 0)) {
    documentSource = 30;
  }

  // 3. Field Symmetry: Application data completeness and OCR symmetry (20 pts)
  let fieldSymmetry = 0;
  if (application.ownerName && application.surveyNumber) {
    fieldSymmetry += 10;
  }
  if (application.area) {
    fieldSymmetry += 5;
  }
  if (typeof application.ocrMatch === 'number') {
    fieldSymmetry += Math.round((application.ocrMatch / 100) * 5);
  } else if (application.ocrData) {
    fieldSymmetry += 5;
  }

  // 4. Identity Verified: Aadhaar or DID (10 pts)
  let identityVerified = 0;
  if (application.aadharNumber || application.did) {
    identityVerified = 10;
  }

  const computedScore = Math.min(100, ledgerHash + documentSource + fieldSymmetry + identityVerified);
  const finalScore = existingScore !== null ? existingScore : computedScore;

  // Normalized 0-100 dimensions for M8 Indexer
  const integrity = ledgerHash > 0 ? 100 : (application.docHash ? 80 : 40);
  const veracity = application.actionHistory && application.actionHistory.length > 0
    ? Math.min(100, 50 + application.actionHistory.length * 15)
    : (application.trustDetails?.pendingEndorsements ? 75 : 50);
  const symmetry = typeof application.ocrMatch === 'number'
    ? application.ocrMatch
    : (fieldSymmetry >= 18 ? 95 : 70);

  return {
    score: finalScore,
    integrity,
    veracity,
    symmetry,
    breakdown: {
      ledgerHash,
      documentSource,
      fieldSymmetry,
      identityVerified,
    },
  };
}
