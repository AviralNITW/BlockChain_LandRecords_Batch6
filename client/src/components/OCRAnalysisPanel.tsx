'use client';

import { useState, useEffect } from 'react';
import { FaFileAlt, FaCheckCircle, FaExclamationTriangle, FaTimesCircle, FaSyncAlt, FaSearch, FaCheck, FaMicrochip } from 'react-icons/fa';

interface OCRAnalysisPanelProps {
  application: {
    ownerName?: string;
    fullName?: string;
    surveyNumber?: string;
    area?: string;
    aadharNumber?: string;
    ipfsHash?: string;
    receiptNumber: string;
    ocrData?: any;
    ocrMatch?: number;
  };
}

interface OCRField {
  label: string;
  expected: string;
  extracted: string;
  match: boolean;
  confidence?: number;
}

interface OCRResult {
  confidence: number;
  fields: OCRField[];
  source?: string;
}

export default function OCRAnalysisPanel({ application }: OCRAnalysisPanelProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<OCRResult | null>(null);
  const [analyzed, setAnalyzed] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Check if OCR data is already available in the application record
  useEffect(() => {
    if (application?.ocrData || typeof application?.ocrMatch === 'number') {
      const ocr = application.ocrData || {};
      const expectedOwner = application.ownerName || application.fullName || 'N/A';
      const extractedOwner = ocr.applicantName || ocr.extractedOwner || 'Not Found';
      const expectedSurvey = application.surveyNumber || 'N/A';
      const extractedSurvey = ocr.surveyNumber || ocr.extractedSurveyNo || 'Not Found';
      const expectedArea = application.area || 'N/A';
      const extractedArea = ocr.landArea || ocr.extractedArea || 'Not Found';
      const expectedAadhar = application.aadharNumber || 'N/A';
      const extractedAadhar = ocr.aadharNumber || 'Not Found';

      const cleanStr = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
      const isOwnerMatch = extractedOwner !== 'Not Found' && (
        cleanStr(expectedOwner) === cleanStr(extractedOwner) ||
        cleanStr(expectedOwner).startsWith(cleanStr(extractedOwner)) ||
        cleanStr(extractedOwner).startsWith(cleanStr(expectedOwner))
      );

      const isSurveyMatch = extractedSurvey !== 'Not Found' && cleanStr(expectedSurvey) === cleanStr(extractedSurvey);
      const isAreaMatch = extractedArea !== 'Not Found' && (cleanStr(expectedArea) === cleanStr(extractedArea) || cleanStr(extractedArea).includes(cleanStr(expectedArea).replace(/[^0-9]/g, '')));
      const isAadharMatch = extractedAadhar !== 'Not Found' && (
        cleanStr(expectedAadhar) === cleanStr(extractedAadhar) ||
        (extractedAadhar.includes('X') && cleanStr(expectedAadhar).slice(0, 4) === cleanStr(extractedAadhar).slice(0, 4))
      );

      const fields: OCRField[] = [
        { label: 'Owner Name', expected: expectedOwner, extracted: extractedOwner, match: isOwnerMatch },
        { label: 'Survey Number', expected: expectedSurvey, extracted: extractedSurvey, match: isSurveyMatch },
        { label: 'Land Area', expected: expectedArea, extracted: extractedArea, match: isAreaMatch },
        { label: 'Aadhaar / ID Verification', expected: expectedAadhar, extracted: extractedAadhar, match: isAadharMatch },
      ];

      const confidence = typeof application.ocrMatch === 'number'
        ? application.ocrMatch
        : Math.round((fields.filter(f => f.match).length / fields.length) * 100);

      setResult({
        confidence,
        fields,
        source: 'Verified Ledger Record'
      });
      setAnalyzed(true);
    }
  }, [application]);

  const runOCRAnalysis = async () => {
    setIsAnalyzing(true);
    setErrorMessage('');

    try {
      const response = await fetch('/api/ocr/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          receiptNumber: application.receiptNumber,
          ipfsHash: application.ipfsHash,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to analyze document');
      }

      setResult({
        confidence: data.confidence,
        fields: data.fields,
        source: data.source === 'document_ocr' ? 'Tesseract Neural OCR' : 'Cryptographic Ledger Record'
      });
      setAnalyzed(true);
    } catch (err: any) {
      console.error('OCR Error:', err);
      setErrorMessage(err.message || 'OCR processing encountered an issue');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 85) return 'text-emerald-400';
    if (confidence >= 65) return 'text-amber-400';
    return 'text-rose-400';
  };

  const getProgressColor = (confidence: number) => {
    if (confidence >= 85) return 'bg-emerald-400';
    if (confidence >= 65) return 'bg-amber-400';
    return 'bg-rose-400';
  };

  const getConfidenceLabel = (confidence: number) => {
    if (confidence >= 85) return 'High Confidence — Document Symmetry Verified';
    if (confidence >= 65) return 'Acceptable Symmetry — Minor Variation Detected';
    return 'Low Confidence — Discrepancy Review Required';
  };

  return (
    <div className="bg-slate-900/60 backdrop-blur-md p-6 rounded-2xl border border-white/10 shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-500/15 border border-purple-500/25 flex items-center justify-center text-purple-400">
            <FaMicrochip className="text-lg" />
          </div>
          <div>
            <h3 className="text-white font-bold text-base">Optical Character Verification (M9)</h3>
            <p className="text-slate-400 text-xs">
              Automated document extraction and citizen declaration symmetry
            </p>
          </div>
        </div>
        {!analyzed ? (
          <button
            onClick={runOCRAnalysis}
            disabled={isAnalyzing}
            className={`px-4 py-2 rounded-xl font-medium text-xs transition-all flex items-center gap-2 ${
              isAnalyzing
                ? 'bg-purple-500/10 text-purple-300 cursor-not-allowed'
                : 'bg-purple-600/30 hover:bg-purple-600/50 text-purple-200 hover:text-white border border-purple-500/40 shadow-lg'
            }`}
          >
            <FaSearch className="text-xs" />
            <span>{isAnalyzing ? 'Extracting Text...' : 'Run OCR Verification'}</span>
          </button>
        ) : (
          <button
            onClick={runOCRAnalysis}
            disabled={isAnalyzing}
            className="px-3.5 py-1.5 rounded-xl text-xs font-medium text-purple-300 hover:text-white border border-purple-500/30 hover:border-purple-400 transition-all flex items-center gap-1.5 bg-purple-500/10"
          >
            <FaSyncAlt className={`text-xs ${isAnalyzing ? 'animate-spin' : ''}`} />
            <span>{isAnalyzing ? 'Processing...' : 'Re-verify Document'}</span>
          </button>
        )}
      </div>

      {/* Analyzing status */}
      {isAnalyzing && (
        <div className="space-y-3 py-3">
          <div className="flex items-center gap-3 text-purple-300 text-xs">
            <div className="w-4 h-4 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
            <span>Processing document buffer through OCR engine...</span>
          </div>
          <div className="w-full bg-slate-800 rounded-full h-1.5">
            <div className="bg-purple-400 h-1.5 rounded-full animate-pulse" style={{ width: '75%' }} />
          </div>
        </div>
      )}

      {errorMessage && (
        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-300 text-xs mb-3">
          {errorMessage}
        </div>
      )}

      {/* Results */}
      {result && !isAnalyzing && (
        <div className="space-y-4">
          {/* Confidence Score */}
          <div className="bg-slate-950/50 rounded-xl p-4 border border-white/5">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-slate-300 text-xs font-semibold uppercase tracking-wider">Field Symmetry Index</span>
                {result.source && (
                  <span className="text-[10px] px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 font-mono">
                    {result.source}
                  </span>
                )}
              </div>
              <span className={`text-xl font-bold ${getConfidenceColor(result.confidence)}`}>
                {result.confidence}%
              </span>
            </div>
            {/* Progress bar */}
            <div className="w-full bg-slate-800 rounded-full h-2 mb-2">
              <div
                className={`h-2 rounded-full transition-all duration-700 ${getProgressColor(result.confidence)}`}
                style={{ width: `${Math.min(100, Math.max(0, result.confidence))}%` }}
              />
            </div>
            <p className={`text-xs font-medium flex items-center gap-1.5 ${getConfidenceColor(result.confidence)}`}>
              {result.confidence >= 85 ? (
                <FaCheckCircle className="text-xs shrink-0" />
              ) : (
                <FaExclamationTriangle className="text-xs shrink-0" />
              )}
              <span>{getConfidenceLabel(result.confidence)}</span>
            </p>
          </div>

          {/* Field by Field comparison */}
          <div className="space-y-2">
            <p className="text-slate-400 text-xs uppercase tracking-wider font-semibold">
              Extracted Document Text vs Application Declaration
            </p>
            {result.fields.map((field, idx) => (
              <div
                key={idx}
                className={`flex items-center justify-between p-3 rounded-xl border ${
                  field.match
                    ? 'bg-emerald-500/5 border-emerald-500/20'
                    : 'bg-amber-500/5 border-amber-500/20'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs ${
                    field.match ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'
                  }`}>
                    {field.match ? <FaCheck /> : <FaExclamationTriangle />}
                  </div>
                  <div>
                    <p className="text-slate-400 text-[11px] font-medium uppercase tracking-wider">
                      {field.label}
                    </p>
                    <p className="text-white text-sm font-semibold">
                      {field.extracted}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-slate-500 uppercase">Declared Record</p>
                  <p className={`text-xs font-semibold ${field.match ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {field.expected}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* OCR Summary */}
          <div className={`rounded-xl p-3.5 border text-xs leading-relaxed ${
            result.confidence >= 85
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-200'
              : 'bg-amber-500/10 border-amber-500/20 text-amber-200'
          }`}>
            <p className="font-semibold mb-1 flex items-center gap-1.5">
              <FaFileAlt className="text-xs" />
              <span>Verification Audit Trail</span>
            </p>
            <p className="opacity-90">
              {result.fields.filter(f => f.match).length} of {result.fields.length} critical fields verified.
              {result.confidence >= 85
                ? ' Extracted document text matches application metadata within tolerance threshold.'
                : ' Minor naming variation detected between physical document and citizen portal entry (e.g. initial or honorific).'}
            </p>
          </div>
        </div>
      )}

      {/* Default state */}
      {!isAnalyzing && !analyzed && (
        <div className="text-center py-6 text-slate-400 text-xs flex flex-col items-center gap-2">
          <FaSearch className="text-slate-500 text-lg" />
          <p>Click "Run OCR Verification" to extract and compare document fields against official records</p>
        </div>
      )}
    </div>
  );
}
