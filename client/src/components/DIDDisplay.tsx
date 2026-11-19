'use client';
import { useState } from 'react';
import { FaKey, FaCheck, FaCopy, FaShieldAlt } from 'react-icons/fa';

interface DIDDisplayProps {
  did?: string;
  compact?: boolean;
}

export default function DIDDisplay({ did, compact = false }: DIDDisplayProps) {
  const [copied, setCopied] = useState(false);

  if (!did) return null;

  const copyDID = () => {
    navigator.clipboard.writeText(did);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (compact) {
    return (
      <div className="flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/20 rounded-lg px-3 py-1.5">
        <FaKey className="text-indigo-400 text-xs shrink-0" />
        <span className="text-indigo-300 text-xs font-mono truncate max-w-[200px]">{did}</span>
        <button onClick={copyDID} className="text-indigo-400 hover:text-white text-xs ml-1" title="Copy DID">
          {copied ? <FaCheck className="text-emerald-400" /> : <FaCopy />}
        </button>
      </div>
    );
  }

  return (
    <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-4">
      <div className="flex items-center gap-2.5 mb-2.5">
        <div className="w-8 h-8 rounded-lg bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-300">
          <FaKey className="text-sm" />
        </div>
        <div>
          <p className="text-indigo-200 font-semibold text-sm">
            Decentralized Identifier (DID)
          </p>
          <p className="text-indigo-300/60 text-xs">
            Cryptographically anchored on Hyperledger Fabric ledger
          </p>
        </div>
      </div>
      <div className="bg-slate-900/60 rounded-lg p-3 flex items-center justify-between gap-3 border border-white/5">
        <p className="text-indigo-200 font-mono text-xs break-all">{did}</p>
        <button
          onClick={copyDID}
          className="shrink-0 px-3 py-1.5 bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 hover:text-white rounded-lg text-xs font-medium border border-indigo-500/30 transition-all flex items-center gap-1.5"
        >
          {copied ? (
            <>
              <FaCheck className="text-emerald-400 text-xs" />
              <span>Copied</span>
            </>
          ) : (
            <>
              <FaCopy className="text-xs" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <p className="text-indigo-300/50 text-[11px] mt-2 flex items-center gap-1.5">
        <FaShieldAlt className="text-[10px] text-indigo-400 shrink-0" />
        <span>Cryptographically verified on-chain • Immutable identity anchor</span>
      </p>
    </div>
  );
}
