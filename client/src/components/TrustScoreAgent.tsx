'use client';

import React, { useState, useRef, useEffect } from 'react';
import DOMPurify from 'dompurify';
import { FaBrain, FaShieldAlt, FaChartLine, FaSearch, FaTimes, FaLock, FaCheckCircle } from 'react-icons/fa';

interface Message {
  id: string;
  role: 'user' | 'agent' | 'system';
  content: string;
  timestamp: Date;
  trustScore?: number;
  isLoading?: boolean;
}

interface TrustScoreAgentProps {
  applicationId: string;
  isVisible: boolean;
  onClose?: () => void;
}

const QUICK_ACTIONS = [
  { label: 'Explain Trust Score', question: 'Why is my trust score what it is? Explain the breakdown.', icon: FaChartLine },
  { label: 'Score Improvement', question: 'How can I improve my trust score?', icon: FaCheckCircle },
  { label: 'Fraud Detection Status', question: 'Are there any fraud flags on this application?', icon: FaShieldAlt },
  { label: 'Integrity Dimensions', question: 'What does the integrity dimension measure and why is it important?', icon: FaLock },
];

function renderMarkdown(text: string): string {
  return text
    .replace(/^### (.+)$/gm, '<h4 class="text-sm font-bold text-cyan-300 mt-4 mb-2">$1</h4>')
    .replace(/^## (.+)$/gm, '<h3 class="text-base font-bold text-white mt-3 mb-2">$1</h3>')
    .replace(/\*\*(.+?)\*\*/g, '<strong class="text-white font-semibold">$1</strong>')
    .replace(/`(.+?)`/g, '<code class="px-1.5 py-0.5 bg-white/10 rounded text-xs font-mono text-emerald-300">$1</code>')
    .replace(/^---$/gm, '<hr class="border-white/10 my-3" />')
    .replace(/^- (.+)$/gm, '<div class="flex gap-2 ml-2 my-1"><span class="text-cyan-400 shrink-0">•</span><span>$1</span></div>')
    .replace(/^\d+\. (.+)$/gm, '<div class="flex gap-2 ml-2 my-1"><span class="text-cyan-400 shrink-0 font-mono text-xs">$&</span></div>')
    .replace(/\n/g, '<br />');
}

export default function TrustScoreAgent({ applicationId, isVisible, onClose }: TrustScoreAgentProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isQuerying, setIsQuerying] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (isVisible && messages.length === 0) {
      setMessages([{
        id: 'welcome',
        role: 'system',
        content: `**M8 Trust Indexer Telemetry Active**\n\nConnected to Hyperledger Fabric Org2 (Revenue Department) for record **${applicationId}**.\n\nEvaluating three cryptographic dimensions:\n- **Integrity**: Ledger SHA-256 fingerprint matching\n- **Veracity**: Multi-signature departmental endorsement consensus\n- **Symmetry**: M9 OCR extraction consistency\n\nInquire below regarding index calculations or integrity audits.`,
        timestamp: new Date(),
      }]);
    }
  }, [isVisible, applicationId, messages.length]);

  const handleSendMessage = async (question: string) => {
    if (!question.trim() || isQuerying) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: question,
      timestamp: new Date(),
    };

    const loadingMessage: Message = {
      id: `loading-${Date.now()}`,
      role: 'agent',
      content: 'Querying M8 Trust Indexer on Org2 blockchain...',
      timestamp: new Date(),
      isLoading: true,
    };

    setMessages(prev => [...prev, userMessage, loadingMessage]);
    setInput('');
    setIsQuerying(true);

    try {
      const response = await fetch('/api/trust-score/explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ applicationId, question }),
      });

      const data = await response.json();

      setMessages(prev => {
        const withoutLoading = prev.filter(m => !m.isLoading);
        const agentContent = response.ok && data.explanation
          ? data.explanation
          : `Error: ${data.error || 'Failed to analyze trust score.'}`;

        return [...withoutLoading, {
          id: `agent-${Date.now()}`,
          role: 'agent',
          content: agentContent,
          timestamp: new Date(),
          trustScore: data.trustScore,
        }];
      });

    } catch {
      setMessages(prev => {
        const withoutLoading = prev.filter(m => !m.isLoading);
        return [...withoutLoading, {
          id: `agent-${Date.now()}`,
          role: 'agent',
          content: 'Connection Error: Could not communicate with Trust Indexer endpoint.',
          timestamp: new Date(),
        }];
      });
    } finally {
      setIsQuerying(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSendMessage(input);
  };

  if (!isVisible) return null;

  return (
    <div className="relative overflow-hidden bg-slate-900/95 backdrop-blur-xl rounded-2xl border border-cyan-500/30 shadow-2xl flex flex-col" style={{ maxHeight: '700px' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-linear-to-r from-cyan-600/15 to-blue-600/15">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-9 h-9 rounded-xl bg-linear-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20 text-white">
              <FaBrain className="text-base" />
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 bg-emerald-400 rounded-full border border-slate-900 animate-pulse" />
          </div>
          <div>
            <h3 className="text-white font-bold text-sm">M8 Trust Indexer Agent</h3>
            <p className="text-cyan-300/70 text-xs font-mono">Org2 Node • Blockchain Explainability</p>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg bg-white/5 hover:bg-rose-500/20 flex items-center justify-center text-white/60 hover:text-rose-300 transition-all text-xs"
            title="Close"
          >
            <FaTimes size={10} />
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-[200px] max-h-[450px]" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.1) transparent' }}>
        {messages.map(message => (
          <div
            key={message.id}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in duration-200`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                message.role === 'user'
                  ? 'bg-cyan-600/20 border border-cyan-500/30 text-cyan-100'
                  : message.role === 'system'
                  ? 'bg-slate-800/80 border border-slate-700/50 text-slate-200'
                  : 'bg-white/[0.04] border border-white/10 text-slate-200'
              }`}
            >
              <div className={`text-[10px] uppercase tracking-widest font-bold mb-1.5 ${
                message.role === 'user' ? 'text-cyan-400/80' : message.role === 'system' ? 'text-blue-400/80' : 'text-emerald-400/80'
              }`}>
                {message.role === 'user' ? 'Official Inquirer' : message.role === 'system' ? 'M8 System' : 'M8 Trust Indexer'}
              </div>

              {message.isLoading ? (
                <div className="flex items-center gap-3">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                  <span className="text-xs text-cyan-300/70 italic">{message.content}</span>
                </div>
              ) : (
                <div
                  className="text-xs leading-relaxed prose-invert"
                  dangerouslySetInnerHTML={{
                    __html: typeof window !== 'undefined' ? DOMPurify.sanitize(renderMarkdown(message.content)) : renderMarkdown(message.content)
                  }}
                />
              )}

              {message.trustScore !== undefined && !message.isLoading && (
                <div className="mt-2.5 pt-2 border-t border-white/10 flex items-center gap-2">
                  <span className="text-[11px] text-white/50">Verified Composite Score:</span>
                  <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                    message.trustScore >= 85 ? 'bg-emerald-500/20 text-emerald-300' :
                    message.trustScore >= 65 ? 'bg-blue-500/20 text-blue-300' :
                    message.trustScore >= 45 ? 'bg-amber-500/20 text-amber-300' :
                    'bg-rose-500/20 text-rose-300'
                  }`}>
                    {Math.round(message.trustScore)} / 100
                  </span>
                </div>
              )}

              <div className="text-[10px] text-white/20 mt-1.5 font-mono">
                {message.timestamp.toLocaleTimeString()}
              </div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Actions */}
      <div className="px-4 py-2 border-t border-white/5 flex gap-2 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
        {QUICK_ACTIONS.map((action, i) => {
          const IconComp = action.icon;
          return (
            <button
              key={i}
              onClick={() => handleSendMessage(action.question)}
              disabled={isQuerying}
              className="shrink-0 px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-cyan-500/20 border border-white/10 hover:border-cyan-500/30 text-xs text-white/70 hover:text-cyan-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
            >
              <IconComp className="text-[10px]" />
              <span>{action.label}</span>
            </button>
          );
        })}
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="px-4 py-3 border-t border-white/10 bg-white/5">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Ask regarding ledger telemetry or cryptographic scores..."
            maxLength={500}
            disabled={isQuerying}
            className="flex-1 bg-white/5 border border-white/10 focus:border-cyan-500/50 rounded-xl px-4 py-2 text-xs text-white placeholder-white/30 outline-none transition-all disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={isQuerying || !input.trim()}
            className="px-4 py-2 rounded-xl bg-linear-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-medium text-xs shadow-lg shadow-cyan-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isQuerying ? 'Analyzing...' : 'Ask'}
          </button>
        </div>
      </form>
    </div>
  );
}
