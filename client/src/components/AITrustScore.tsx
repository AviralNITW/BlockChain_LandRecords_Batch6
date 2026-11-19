'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { computeTrustScore } from '@/lib/utils/trustScore';

interface AITrustScoreProps {
    application: any;
    isVisible: boolean;
}

export default function AITrustScore({ application, isVisible }: AITrustScoreProps) {
    const [showDetails, setShowDetails] = useState(false);

    // Dynamic, deterministic trust score (No fake randomness, no mock delay)
    const trustAnalysis = useMemo(() => {
        return computeTrustScore(application);
    }, [application]);

    const trustScore = trustAnalysis.score;
    const { breakdown } = trustAnalysis;

    if (!isVisible) return null;

    const getScoreColor = (score: number) => {
        if (score >= 90) return 'from-emerald-400 to-green-500';
        if (score >= 70) return 'from-blue-400 to-indigo-500';
        if (score >= 50) return 'from-yellow-400 to-orange-500';
        return 'from-red-400 to-pink-500';
    };

    const getStatusLabel = (score: number) => {
        if (score >= 90) return 'EXCEPTIONAL TRUST — Automated Verification Passed';
        if (score >= 70) return 'VERIFIED — Safe for Official Processing';
        if (score >= 50) return 'NEUTRAL — Additional Verification Recommended';
        return 'HIGH RISK — Integrity Alert';
    };

    return (
        <div className="relative overflow-hidden bg-slate-900/80 backdrop-blur-md rounded-2xl border border-white/10 p-6 shadow-2xl">
            {/* Background Glow */}
            <div className={`absolute -top-24 -right-24 w-48 h-48 bg-gradient-to-br ${getScoreColor(trustScore)} blur-3xl opacity-20`} />

            <div className="flex flex-col md:flex-row items-center gap-8 relative z-10">
                {/* Score Gauge */}
                <div className="relative flex-shrink-0">
                    <svg className="w-40 h-40 transform -rotate-90">
                        {/* Background Track */}
                        <circle
                            cx="80"
                            cy="80"
                            r="70"
                            stroke="currentColor"
                            strokeWidth="12"
                            fill="transparent"
                            className="text-white/5"
                        />
                        {/* Progress Bar */}
                        <circle
                            cx="80"
                            cy="80"
                            r="70"
                            stroke="url(#scoreGradient)"
                            strokeWidth="12"
                            fill="transparent"
                            strokeDasharray={440}
                            strokeDashoffset={440 - (440 * Math.min(100, Math.max(0, trustScore))) / 100}
                            strokeLinecap="round"
                            className="transition-all duration-700 ease-out"
                        />
                        <defs>
                            <linearGradient id="scoreGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                                <stop offset="0%" className="stop-emerald-400" />
                                <stop offset="100%" className="stop-green-500" />
                            </linearGradient>
                        </defs>
                    </svg>

                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className={`text-4xl font-black bg-clip-text text-transparent bg-gradient-to-br ${getScoreColor(trustScore)}`}>
                            {Math.round(trustScore)}
                        </span>
                        <span className="text-[10px] text-white/40 uppercase tracking-[0.2em] font-bold">Trust Index</span>
                    </div>
                </div>

                {/* Narrative Info */}
                <div className="flex-grow text-center md:text-left">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 mb-3">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-widest">M8 TRUST ENGINE ACTIVE</span>
                    </div>

                    <h2 className="text-2xl font-bold text-white mb-2">Blockchain Trust Analysis</h2>
                    <p className="text-slate-400 text-sm mb-4 leading-relaxed max-w-md">
                        Evaluated across cryptographic ledger fingerprints (M7), multi-signature endorsement history,
                        and OCR data symmetry (M9).
                    </p>

                    <div className={`inline-block px-4 py-2 rounded-lg font-bold text-sm bg-gradient-to-br ${getScoreColor(trustScore)} text-white shadow-lg`}>
                        {getStatusLabel(trustScore)}
                    </div>
                </div>

                {/* Action Button */}
                <div className="flex-shrink-0">
                    <button
                        onClick={() => setShowDetails(!showDetails)}
                        className="px-6 py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white font-medium transition-all hover:scale-105 active:scale-95"
                    >
                        {showDetails ? 'Hide Parameters' : 'View Audit Metrics'}
                    </button>
                </div>
            </div>

            {/* Expanded Metrics */}
            {showDetails && (
                <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 animate-in fade-in slide-in-from-top-4 duration-500">
                    <div className="p-4 rounded-xl bg-white/5 border border-white/5">
                        <p className="text-xs text-slate-500 uppercase tracking-widest mb-1">Integrity (M7)</p>
                        <div className="flex items-center justify-between">
                            <span className="text-white font-bold">{breakdown.ledgerHash} / 40</span>
                            <span className={`text-xs ${breakdown.ledgerHash > 0 ? 'text-emerald-400' : 'text-yellow-400'}`}>
                                {breakdown.ledgerHash > 0 ? 'Ledger Anchored' : 'Pending Hash'}
                            </span>
                        </div>
                        <div className="w-full h-1 bg-white/5 mt-2 rounded-full">
                            <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${(breakdown.ledgerHash / 40) * 100}%` }} />
                        </div>
                    </div>

                    <div className="p-4 rounded-xl bg-white/5 border border-white/5">
                        <p className="text-xs text-slate-500 uppercase tracking-widest mb-1">Source Veracity</p>
                        <div className="flex items-center justify-between">
                            <span className="text-white font-bold">{breakdown.documentSource} / 30</span>
                            <span className={`text-xs ${breakdown.documentSource > 0 ? 'text-blue-400' : 'text-slate-400'}`}>
                                {breakdown.documentSource > 0 ? 'Verified Source' : 'Pending Docs'}
                            </span>
                        </div>
                        <div className="w-full h-1 bg-white/5 mt-2 rounded-full">
                            <div className="h-full bg-blue-400 rounded-full" style={{ width: `${(breakdown.documentSource / 30) * 100}%` }} />
                        </div>
                    </div>

                    <div className="p-4 rounded-xl bg-white/5 border border-white/5">
                        <p className="text-xs text-slate-500 uppercase tracking-widest mb-1">Field Symmetry (M9)</p>
                        <div className="flex items-center justify-between">
                            <span className="text-white font-bold">{breakdown.fieldSymmetry} / 20</span>
                            <span className="text-indigo-400 text-xs">
                                {application.ocrMatch ? `${application.ocrMatch}% OCR Match` : 'Metadata Consistent'}
                            </span>
                        </div>
                        <div className="w-full h-1 bg-white/5 mt-2 rounded-full">
                            <div className="h-full bg-indigo-400 rounded-full" style={{ width: `${(breakdown.fieldSymmetry / 20) * 100}%` }} />
                        </div>
                    </div>

                    <div className="p-4 rounded-xl bg-white/5 border border-white/5">
                        <p className="text-xs text-slate-500 uppercase tracking-widest mb-1">Identity Trust</p>
                        <div className="flex items-center justify-between">
                            <span className="text-white font-bold">{breakdown.identityVerified} / 10</span>
                            <span className="text-purple-400 text-xs">
                                {application.did ? 'DID Linked' : (application.aadharNumber ? 'Aadhaar Linked' : 'Unlinked')}
                            </span>
                        </div>
                        <div className="w-full h-1 bg-white/5 mt-2 rounded-full">
                            <div className="h-full bg-purple-400 rounded-full" style={{ width: `${(breakdown.identityVerified / 10) * 100}%` }} />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
