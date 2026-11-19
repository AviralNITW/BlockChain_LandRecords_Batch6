'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import DOMPurify from 'dompurify';
import {
  FaRobot,
  FaFileAlt,
  FaShieldAlt,
  FaMicrochip,
  FaClock,
  FaPaperclip,
  FaExternalLinkAlt,
  FaArrowRight,
  FaCheckCircle,
  FaTimes,
  FaChevronUp,
  FaChevronDown,
} from 'react-icons/fa';

interface Message {
  id: string;
  role: 'user' | 'agent' | 'system';
  content: string;
  timestamp: Date;
  isLoading?: boolean;
}

interface OfficialAIAgentProps {
  application: any;
  officialDesignation: string;
  officialName: string;
  isVisible: boolean;
  onClose?: () => void;
}

const QUICK_ACTIONS = [
  { label: 'Full Summary', question: 'Give me a complete summary of this application', icon: FaFileAlt },
  { label: 'Trust Score', question: 'Analyze the trust score for this application', icon: FaShieldAlt },
  { label: 'OCR Analysis', question: 'Show me the OCR match/mismatch analysis', icon: FaMicrochip },
  { label: 'History Timeline', question: 'Show the verification history timeline', icon: FaClock },
  { label: 'Required Documents', question: 'Which documents are required?', icon: FaPaperclip },
  { label: 'DigiLocker Verification', question: 'How does the applicant link DigiLocker?', icon: FaExternalLinkAlt },
  { label: 'Workflow Guidance', question: 'Explain the process and next step', icon: FaArrowRight },
  { label: 'Role Checklist', question: 'What do you recommend I do with this application?', icon: FaCheckCircle },
];

function renderMarkdown(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\|(.+)\|\n\|[-| ]+\|\n((?:\|.+\|\n?)*)/g, (_, header, body) => {
      const headers = header.split('|').filter((h: string) => h.trim()).map((h: string) =>
        `<th class="px-3 py-1.5 text-left text-xs font-semibold text-blue-300 uppercase tracking-wider border-b border-white/10">${h.trim()}</th>`
      ).join('');
      const rows = body.trim().split('\n').map((row: string) => {
        const cells = row.split('|').filter((c: string) => c.trim()).map((c: string) =>
          `<td class="px-3 py-1.5 text-xs text-slate-300 border-b border-white/5">${c.trim()}</td>`
        ).join('');
        return `<tr class="hover:bg-white/5">${cells}</tr>`;
      }).join('');
      return `<div class="overflow-x-auto my-3"><table class="w-full"><thead><tr class="bg-white/5">${headers}</tr></thead><tbody>${rows}</tbody></table></div>`;
    })
    .replace(/^### (.+)$/gm, '<h4 class="text-sm font-bold text-amber-300 mt-4 mb-2 flex items-center gap-2">$1</h4>')
    .replace(/^## (.+)$/gm, '<h3 class="text-base font-bold text-white mt-3 mb-2">$1</h3>')
    .replace(/^> (.+)$/gm, '<div class="border-l-2 border-amber-500/50 pl-3 my-2 text-sm text-amber-200/80 italic">$1</div>')
    .replace(/\*\*(.+?)\*\*/g, '<strong class="text-white font-semibold">$1</strong>')
    .replace(/_"(.+?)"_/g, '<em class="text-slate-400">"$1"</em>')
    .replace(/`(.+?)`/g, '<code class="px-1 py-0.5 bg-white/10 rounded text-[11px] font-mono text-emerald-300">$1</code>')
    .replace(/^---$/gm, '<hr class="border-white/10 my-3" />')
    .replace(/^- (.+)$/gm, '<div class="flex gap-2 ml-1 my-0.5"><span class="text-amber-400 shrink-0 text-xs mt-0.5">•</span><span class="text-sm">$1</span></div>')
    .replace(/\n/g, '<br />');
}

export default function OfficialAIAgent({ application, officialDesignation, officialName, isVisible, onClose }: OfficialAIAgentProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isQuerying, setIsQuerying] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isMinimized) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isMinimized]);

  useEffect(() => {
    if (isVisible && messages.length === 0) {
      const applicantName = application?.fullName || application?.ownerName || 'Citizen Applicant';
      setMessages([{
        id: 'welcome',
        role: 'system',
        content: `**Application Intelligence Assistant** — Officer: ${officialName} (${officialDesignation})\n\nContext loaded for Record **${application?.receiptNumber || 'N/A'}** (${applicantName}).\n\nI can verify multi-signature endorsements, summarize trust index telemetry, explain field symmetry, and outline departmental workflow guidelines.\n\nSelect a quick action below or enter an inquiry.`,
        timestamp: new Date(),
      }]);
    }
  }, [isVisible, application, officialName, officialDesignation, messages.length]);

  const handleSendMessage = useCallback(async (question: string) => {
    if (!question.trim() || isQuerying) return;

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: question,
      timestamp: new Date(),
    };

    const loadingMsg: Message = {
      id: `loading-${Date.now()}`,
      role: 'agent',
      content: 'Analyzing record parameters...',
      timestamp: new Date(),
      isLoading: true,
    };

    setMessages(prev => [...prev, userMsg, loadingMsg]);
    setInput('');
    setIsQuerying(true);

    try {
      const response = await fetch('/api/ai-agent/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ receiptNumber: application?.receiptNumber, question }),
      });

      const data = await response.json();

      setMessages(prev => {
        const withoutLoading = prev.filter(m => !m.isLoading);
        const agentContent = response.ok && data.response
          ? data.response
          : `Error: ${data.error || 'Failed to generate explanation.'}`;

        return [...withoutLoading, {
          id: `agent-${Date.now()}`,
          role: 'agent',
          content: agentContent,
          timestamp: new Date(),
        }];
      });
    } catch {
      setMessages(prev => {
        const withoutLoading = prev.filter(m => !m.isLoading);
        return [...withoutLoading, {
          id: `agent-${Date.now()}`,
          role: 'agent',
          content: 'Connection Error: Unable to communicate with application explainability service.',
          timestamp: new Date(),
        }];
      });
    } finally {
      setIsQuerying(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isQuerying, application]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSendMessage(input);
  };

  if (!isVisible) return null;

  return (
    <div className={`relative bg-slate-900/95 backdrop-blur-xl rounded-2xl border border-amber-500/30 shadow-2xl flex flex-col transition-all duration-300 ${isMinimized ? 'h-14' : ''}`}
      style={{ maxHeight: isMinimized ? '56px' : '720px' }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-5 py-3 border-b border-white/10 bg-linear-to-r from-amber-600/15 to-orange-600/15 rounded-t-2xl cursor-pointer select-none"
        onClick={() => setIsMinimized(!isMinimized)}
      >
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-8 h-8 rounded-xl bg-linear-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/20 text-white">
              <FaRobot className="text-sm" />
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 bg-emerald-400 rounded-full border border-slate-900 animate-pulse" />
          </div>
          <div>
            <h3 className="text-white font-bold text-sm">Official Record Assistant</h3>
            <p className="text-amber-300/70 text-[11px] font-mono">{officialDesignation} • {application?.receiptNumber || 'N/A'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {messages.length > 1 && (
            <span className="text-[10px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full font-medium">
              {messages.length - 1} msg{messages.length > 2 ? 's' : ''}
            </span>
          )}
          <button
            className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/60 hover:text-white transition-all text-xs"
            onClick={(e) => { e.stopPropagation(); setIsMinimized(!isMinimized); }}
            title={isMinimized ? 'Expand' : 'Minimize'}
          >
            {isMinimized ? <FaChevronUp size={10} /> : <FaChevronDown size={10} />}
          </button>
          {onClose && (
            <button
              onClick={(e) => { e.stopPropagation(); onClose(); }}
              className="w-7 h-7 rounded-lg bg-white/5 hover:bg-rose-500/20 flex items-center justify-center text-white/60 hover:text-rose-300 transition-all text-xs"
              title="Close"
            >
              <FaTimes size={10} />
            </button>
          )}
        </div>
      </div>

      {/* Body */}
      {!isMinimized && (
        <>
          <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[180px] max-h-[420px]"
            style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.08) transparent' }}
          >
            {messages.map(message => (
              <div
                key={message.id}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in duration-200`}
              >
                <div
                  className={`max-w-[88%] rounded-2xl px-4 py-3 ${
                    message.role === 'user'
                      ? 'bg-amber-600/20 border border-amber-500/30 text-amber-100'
                      : message.role === 'system'
                      ? 'bg-slate-800/80 border border-slate-700/50 text-slate-200'
                      : 'bg-white/[0.04] border border-white/10 text-slate-200'
                  }`}
                >
                  <div className={`text-[10px] uppercase tracking-widest font-bold mb-1.5 ${
                    message.role === 'user' ? 'text-amber-400/80' : message.role === 'system' ? 'text-blue-400/80' : 'text-emerald-400/80'
                  }`}>
                    {message.role === 'user' ? officialDesignation : message.role === 'system' ? 'System Verification' : 'Intelligence Engine'}
                  </div>

                  {message.isLoading ? (
                    <div className="flex items-center gap-3 py-2">
                      <div className="flex gap-1">
                        <span className="w-2 h-2 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-2 h-2 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-2 h-2 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                      <span className="text-xs text-amber-300/70 italic">Analyzing application telemetry...</span>
                    </div>
                  ) : (
                    <div
                      className="text-[13px] leading-relaxed"
                      dangerouslySetInnerHTML={{
                        __html: typeof window !== 'undefined' ? DOMPurify.sanitize(renderMarkdown(message.content)) : renderMarkdown(message.content)
                      }}
                    />
                  )}

                  <div className="text-[10px] text-white/20 mt-2 font-mono">
                    {message.timestamp.toLocaleTimeString()}
                  </div>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          <div className="px-4 py-2 text-[11px] text-amber-200/80 bg-amber-500/5 border-t border-white/5 flex items-center gap-1.5">
            <FaShieldAlt className="text-amber-400/80 shrink-0 text-xs" />
            <span>Read-only compliance mode: this assistant provides record analysis and does not alter ledger state.</span>
          </div>

          {/* Quick Actions */}
          <div className="px-4 py-2 border-t border-white/5">
            <div className="flex gap-1.5 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
              {QUICK_ACTIONS.map((action, i) => {
                const IconComponent = action.icon;
                return (
                  <button
                    key={i}
                    onClick={() => handleSendMessage(action.question)}
                    disabled={isQuerying}
                    className="shrink-0 px-2.5 py-1.5 rounded-lg bg-white/[0.03] hover:bg-amber-500/15 border border-white/10 hover:border-amber-500/30 text-[11px] text-white/70 hover:text-amber-200 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
                  >
                    <IconComponent className="text-[10px]" />
                    <span>{action.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Input */}
          <form onSubmit={handleSubmit} className="px-4 py-3 border-t border-white/10 bg-white/[0.02] rounded-b-2xl">
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder="Inquire regarding records, endorsements, or checklists..."
                maxLength={500}
                disabled={isQuerying}
                className="flex-1 bg-white/5 border border-white/10 focus:border-amber-500/50 rounded-xl px-4 py-2 text-xs text-white placeholder-white/30 outline-none transition-all disabled:opacity-40"
              />
              <button
                type="submit"
                disabled={isQuerying || !input.trim()}
                className="px-4 py-2 rounded-xl bg-linear-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-medium text-xs shadow-lg shadow-amber-500/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isQuerying ? 'Processing...' : 'Send'}
              </button>
            </div>
          </form>
        </>
      )}
    </div>
  );
}
