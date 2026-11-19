'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  FaArrowLeft,
  FaUser,
  FaMapMarkedAlt,
  FaHome,
  FaClock,
  FaFileAlt,
  FaCheckCircle,
  FaTimesCircle,
  FaExclamationTriangle,
  FaShieldAlt,
  FaRobot,
  FaBrain,
  FaCopy,
  FaCheck,
  FaExternalLinkAlt,
  FaEye,
  FaTimes,
  FaSpinner,
  FaPaperclip,
} from 'react-icons/fa';
import SuperintendentFields, { type SuperintendentFieldsHandle } from '@/components/roleFields/SuperintendentFields';
import ProjectOfficerFields, { type ProjectOfficerFieldsHandle } from '@/components/roleFields/ProjectOfficerFields';
import RevenueInspectorFields, { type RevenueInspectorFieldsHandle } from '@/components/roleFields/RevenueInspectorFields';
import VROFields, { type VROFieldsHandle } from '@/components/roleFields/VROFields';
import RevenueDeptOfficerFields, { type RevenueDeptOfficerFieldsHandle } from '@/components/roleFields/RevenueDeptOfficerFields';
import JointCollectorFields, { type JointCollectorFieldsHandle } from '@/components/roleFields/JointCollectorFields';
import DistrictCollectorFields, { type DistrictCollectorFieldsHandle } from '@/components/roleFields/DistrictCollectorFields';
import MinistryWelfareFields, { type MinistryWelfareFieldsHandle } from '@/components/roleFields/MinistryWelfareFields';
import SurveyorFields, { type SurveyorFieldsHandle } from '@/components/roleFields/SurveyorFields';
import MROFields, { type MROFieldsHandle } from '@/components/roleFields/MROFields';
import ClerkFields, { type ClerkFieldsHandle } from '@/components/roleFields/ClerkFields';
import ApplicationHistory from '@/components/ApplicationHistory';
import DigiLockerRequestPanel from '@/components/DigiLockerRequestPanel';
import OCRAnalysisPanel from '@/components/OCRAnalysisPanel';
import AITrustScore from '@/components/AITrustScore';
import TrustScoreAgent from '@/components/TrustScoreAgent';
import OfficialAIAgent from '@/components/OfficialAIAgent';
import DIDDisplay from '@/components/DIDDisplay';

interface Official {
  _id?: string;
  firstName: string;
  lastName: string;
  email: string;
  designation: string;
  officeId: string;
}

interface Application {
  _id: string;
  receiptNumber: string;
  status: string;
  createdAt: string;
  ownerName: string;
  surveyNumber: string;
  area: string;
  fullName?: string;
  email?: string;
  phoneNumber?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  nature?: string;
  ipfsHash?: string;
  docHash?: string;
  aadharNumber?: string;
  currentlyWith?: string;
  currentStage?: string;
  actionHistory?: Array<{
    officialId: string;
    officialName: string;
    designation: string;
    action: 'approved' | 'rejected' | 'data_added' | 'forwarded';
    remarks?: string;
    timestamp: string;
    blockNumber?: number;
    data?: any;
  }>;
}

const WORKFLOW_STAGES = [
  { id: 'submitted', label: 'Citizen Submission' },
  { id: 'clerk', label: 'Clerk Review' },
  { id: 'revenue', label: 'Revenue Verification' },
  { id: 'mro', label: 'MRO Endorsement' },
  { id: 'collector', label: 'Collector Order' },
  { id: 'completed', label: 'Digital Patta Issued' },
];

function getStageIndex(status: string): number {
  const s = (status || '').toLowerCase();
  if (s === 'completed') return 5;
  if (s.includes('collector') || s === 'approved') return 4;
  if (s.includes('mro')) return 3;
  if (s.includes('revenue') || s.includes('surveyor') || s.includes('vro') || s.includes('superintendent') || s.includes('project')) return 2;
  if (s.includes('clerk')) return 1;
  return 0;
}

function CopyPill({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-all font-mono"
      title={`Copy ${label || text}`}
    >
      {copied ? <FaCheck className="text-emerald-400 text-[10px]" /> : <FaCopy className="text-slate-400 text-[10px]" />}
      <span>{copied ? 'Copied' : text}</span>
    </button>
  );
}

export default function ApplicationDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const receiptNumber = params.receiptNumber as string;

  const [official, setOfficial] = useState<Official | null>(null);
  const [application, setApplication] = useState<Application | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAssigned, setIsAssigned] = useState(false);
  const [showDataWarning, setShowDataWarning] = useState(false);
  const [pendingAction, setPendingAction] = useState<{ action: 'approve' | 'reject' | 'forward', remarks: string } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showTrustAgent, setShowTrustAgent] = useState(false);
  const [showAIAgent, setShowAIAgent] = useState(false);
  const [previewDocUrl, setPreviewDocUrl] = useState<string | null>(null);
  const [pattaLoading, setPattaLoading] = useState(false);

  // Modern Toast notification state
  const [toast, setToast] = useState<{ show: boolean; message: string; type: 'success' | 'error' | 'info' }>({
    show: false,
    message: '',
    type: 'info',
  });

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast(prev => ({ ...prev, show: false })), 4000);
  };

  // Refs for role fields that need to save data on approval
  const surveyorFieldsRef = useRef<SurveyorFieldsHandle>(null);
  const clerkFieldsRef = useRef<ClerkFieldsHandle>(null);
  const superintendentFieldsRef = useRef<SuperintendentFieldsHandle>(null);
  const projectOfficerFieldsRef = useRef<ProjectOfficerFieldsHandle>(null);
  const revenueInspectorFieldsRef = useRef<RevenueInspectorFieldsHandle>(null);
  const vroFieldsRef = useRef<VROFieldsHandle>(null);
  const revenueDeptOfficerFieldsRef = useRef<RevenueDeptOfficerFieldsHandle>(null);
  const jointCollectorFieldsRef = useRef<JointCollectorFieldsHandle>(null);
  const districtCollectorFieldsRef = useRef<DistrictCollectorFieldsHandle>(null);
  const ministryWelfareFieldsRef = useRef<MinistryWelfareFieldsHandle>(null);
  const mroFieldsRef = useRef<MROFieldsHandle>(null);

  useEffect(() => {
    fetchOfficialData();
    fetchApplicationData();
  }, [receiptNumber]);

  const fetchOfficialData = async () => {
    try {
      const response = await fetch('/api/officials/me');
      if (response.ok) {
        const data = await response.json();
        setOfficial(data.official);
      }
    } catch (error) {
      console.error('Error fetching official data:', error);
    }
  };

  const fetchApplicationData = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/land-requests/by-receipt?receipt=${receiptNumber}`);
      if (response.ok) {
        const data = await response.json();
        setApplication(data);
      }
    } catch (error) {
      console.error('Error fetching application:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (official && application) {
      const statusToRoleMap: Record<string, string[]> = {
        'submitted': ['clerk'],
        'with_clerk': ['clerk'],
        'with_superintendent': ['superintendent'],
        'with_project_officer': ['project_officer', 'projectofficer'],
        'with_mro': ['mro'],
        'revenue_verification': ['revenue_dept_officer', 'mro', 'revenue_inspector', 'surveyor', 'vro'],
        'with_surveyor': ['surveyor'],
        'with_revenue_inspector': ['revenue_inspector', 'revenueinspector'],
        'with_vro': ['vro'],
        'with_revenue_dept': ['revenue_dept_officer', 'revenuedeptofficer', 'revenue_department_officer'],
        'with_joint_collector': ['joint_collector', 'jointcollector'],
        'with_collector': ['district_collector', 'districtcollector', 'collector'],
        'with_ministry_welfare': ['ministry_welfare', 'ministrywelfare', 'ministry_of_welfare']
      };

      const currentStatus = application.status?.toLowerCase() || '';
      const allowedRoles = statusToRoleMap[currentStatus] || [];
      const assigned = allowedRoles.some(role => {
        const normalizedRole = role.replace(/\s+/g, '').replace(/_/g, '');
        const normalizedOfficialRole = (official.designation || '').toLowerCase().replace(/\s+/g, '').replace(/_/g, '');
        return normalizedOfficialRole.includes(normalizedRole) || normalizedRole.includes(normalizedOfficialRole);
      });

      setIsAssigned(assigned);
    }
  }, [official, application]);

  const handleAction = async (action: 'approve' | 'reject' | 'forward', remarks: string) => {
    try {
      if (surveyorFieldsRef.current) await surveyorFieldsRef.current.save();
      if (clerkFieldsRef.current) await clerkFieldsRef.current.save();
      if (superintendentFieldsRef.current) await superintendentFieldsRef.current.save();
      if (projectOfficerFieldsRef.current) await projectOfficerFieldsRef.current.save();
      if (revenueInspectorFieldsRef.current) await revenueInspectorFieldsRef.current.save();
      if (vroFieldsRef.current) await vroFieldsRef.current.save();
      if (revenueDeptOfficerFieldsRef.current) await revenueDeptOfficerFieldsRef.current.save();
      if (jointCollectorFieldsRef.current) await jointCollectorFieldsRef.current.save();
      if (districtCollectorFieldsRef.current) await districtCollectorFieldsRef.current.save();
      if (ministryWelfareFieldsRef.current) await ministryWelfareFieldsRef.current.save();
      if (mroFieldsRef.current) await mroFieldsRef.current.save();

      await new Promise(resolve => setTimeout(resolve, 300));
      proceedWithAction(action, remarks);
    } catch (error) {
      console.error('Error before action:', error);
      proceedWithAction(action, remarks);
    }
  };

  const proceedWithAction = async (action: 'approve' | 'reject' | 'forward', remarks: string) => {
    setIsProcessing(true);
    try {
      const formData = new FormData();
      formData.append('applicationId', application?._id || '');
      formData.append('action', action);
      formData.append('remarks', remarks);

      const designation = official?.designation.toLowerCase().replace(/\s+/g, '').replace(/_/g, '') || '';

      if (designation === 'surveyor' && surveyorFieldsRef.current?.getFormData) {
        const roleFormData = surveyorFieldsRef.current.getFormData(application?._id || '');
        for (const [key, value] of roleFormData) formData.append(key, value);
      } else if (designation === 'clerk' && clerkFieldsRef.current?.getFormData) {
        const roleFormData = clerkFieldsRef.current.getFormData(application?._id || '');
        for (const [key, value] of roleFormData) formData.append(key, value);
      } else if (designation === 'superintendent' && superintendentFieldsRef.current?.getFormData) {
        const roleFormData = superintendentFieldsRef.current.getFormData(application?._id || '');
        for (const [key, value] of roleFormData) formData.append(key, value);
      } else if (designation === 'mro' && mroFieldsRef.current?.getFormData) {
        const roleFormData = mroFieldsRef.current.getFormData(application?._id || '');
        for (const [key, value] of roleFormData) formData.append(key, value);
      }

      const response = await fetch('/api/dashboard/action', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        showToast(`Application successfully ${action}ed!`, 'success');
        await fetchApplicationData();
      } else {
        const error = await response.json();
        showToast(error.error || 'Action failed to execute', 'error');
      }
    } catch (error) {
      console.error('Error performing action:', error);
      showToast('Encountered an issue executing official workflow action', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleGeneratePatta = async () => {
    if (!application?._id) return;
    setPattaLoading(true);
    try {
      const res = await fetch('/api/patta/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ applicationId: application._id }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast('Official Patta passbook generated and anchored to IPFS', 'success');
        if (data.ipfsHash) {
          window.open(`https://gateway.pinata.cloud/ipfs/${data.ipfsHash}`, '_blank');
        } else {
          window.open(`/api/land-requests/generate-pdf?receipt=${receiptNumber}`, '_blank');
        }
      } else {
        showToast(data.error || 'Could not generate Patta certificate', 'error');
      }
    } catch (e: any) {
      showToast(e.message || 'Patta generation failed', 'error');
    } finally {
      setPattaLoading(false);
    }
  };

  const getRoleComponent = () => {
    if (!official || !application) return null;
    const designation = official.designation.toLowerCase().replace(/\s+/g, '').replace(/_/g, '');

    switch (designation) {
      case 'clerk':
        return <ClerkFields ref={clerkFieldsRef} application={application} onUpdate={fetchApplicationData} />;
      case 'superintendent':
        return <SuperintendentFields ref={superintendentFieldsRef} application={application} onUpdate={fetchApplicationData} />;
      case 'projectofficer':
        return <ProjectOfficerFields ref={projectOfficerFieldsRef} application={application} onUpdate={fetchApplicationData} />;
      case 'mro':
        return <MROFields ref={mroFieldsRef} application={application} onUpdate={fetchApplicationData} />;
      case 'surveyor':
        return <SurveyorFields ref={surveyorFieldsRef} application={application} onUpdate={fetchApplicationData} />;
      case 'revenueinspector':
        return <RevenueInspectorFields ref={revenueInspectorFieldsRef} application={application} onUpdate={fetchApplicationData} />;
      case 'vro':
        return <VROFields ref={vroFieldsRef} application={application} onUpdate={fetchApplicationData} />;
      case 'revenuedeptofficer':
      case 'revenuedepartmentofficer':
        return <RevenueDeptOfficerFields ref={revenueDeptOfficerFieldsRef} application={application} onUpdate={fetchApplicationData} />;
      case 'jointcollector':
        return <JointCollectorFields ref={jointCollectorFieldsRef} application={application} onUpdate={fetchApplicationData} />;
      case 'districtcollector':
        return <DistrictCollectorFields ref={districtCollectorFieldsRef} application={application} onUpdate={fetchApplicationData} />;
      case 'ministrywelfare':
      case 'ministryofwelfare':
        return <MinistryWelfareFields ref={ministryWelfareFieldsRef} application={application} onUpdate={fetchApplicationData} />;
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-linear-to-br from-slate-950 via-slate-900 to-slate-950 flex flex-col items-center justify-center gap-3">
        <FaSpinner className="text-indigo-400 text-3xl animate-spin" />
        <div className="text-slate-300 text-sm font-medium">Loading Application Context...</div>
      </div>
    );
  }

  if (!application) {
    return (
      <div className="min-h-screen bg-linear-to-br from-slate-950 via-slate-900 to-slate-950 flex flex-col items-center justify-center gap-3">
        <FaExclamationTriangle className="text-amber-400 text-3xl" />
        <div className="text-white text-lg font-semibold">Application Record Not Found</div>
        <button
          onClick={() => router.push('/official-dashboard')}
          className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs"
        >
          Return to Dashboard
        </button>
      </div>
    );
  }

  const currentStageIndex = getStageIndex(application.status);

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-950 via-slate-900 to-slate-950 pb-24 text-slate-100">
      {/* Floating In-App Toast */}
      {toast.show && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-4 duration-300">
          <div className={`px-4 py-3 rounded-xl backdrop-blur-xl border shadow-2xl flex items-center gap-3 text-xs font-semibold ${
            toast.type === 'success'
              ? 'bg-emerald-950/90 border-emerald-500/40 text-emerald-200'
              : toast.type === 'error'
              ? 'bg-rose-950/90 border-rose-500/40 text-rose-200'
              : 'bg-slate-900/90 border-white/20 text-slate-200'
          }`}>
            {toast.type === 'success' ? (
              <FaCheckCircle className="text-emerald-400 text-sm shrink-0" />
            ) : toast.type === 'error' ? (
              <FaTimesCircle className="text-rose-400 text-sm shrink-0" />
            ) : (
              <FaShieldAlt className="text-indigo-400 text-sm shrink-0" />
            )}
            <span>{toast.message}</span>
          </div>
        </div>
      )}

      {/* Sticky App Bar */}
      <div className="bg-slate-900/70 backdrop-blur-xl border-b border-white/10 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/official-dashboard')}
              className="flex items-center gap-2 px-3.5 py-1.5 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white rounded-lg text-xs font-medium border border-white/10 transition-all"
            >
              <FaArrowLeft className="text-[10px]" />
              <span>Dashboard</span>
            </button>
            <div className="h-4 w-px bg-white/10 hidden sm:block" />
            <div className="hidden sm:flex items-center gap-2">
              <span className="text-xs text-slate-400">Record:</span>
              <span className="text-xs font-mono font-bold text-white">{receiptNumber}</span>
            </div>
          </div>

          <div className="flex items-center gap-4 text-right">
            <div>
              <p className="text-white text-xs font-bold">{official?.firstName} {official?.lastName}</p>
              <p className="text-[11px] text-indigo-300/80 font-medium">{official?.designation}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Application Header Card & Workflow Stepper */}
        <div className="bg-slate-900/60 backdrop-blur-md rounded-2xl border border-white/10 p-6 mb-6 shadow-xl">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-white/10">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-xs text-indigo-300 font-semibold uppercase tracking-wider">Land Registration Docket</span>
                <span className="text-white/20">•</span>
                <span className="text-xs text-slate-400">
                  Registered: {new Date(application.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-white tracking-tight">{application.fullName || application.ownerName}</h1>
                <CopyPill text={receiptNumber} label="Receipt Number" />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider border ${
                application.status === 'completed'
                  ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                  : application.status === 'rejected'
                  ? 'bg-rose-500/15 border-rose-500/30 text-rose-300'
                  : 'bg-amber-500/15 border-amber-500/30 text-amber-300'
              }`}>
                {application.status.replace(/_/g, ' ')}
              </span>
            </div>
          </div>

          {/* Workflow Stage Pipeline Stepper */}
          <div className="pt-6">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-4">
              Statutory Lifecycle Stage
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
              {WORKFLOW_STAGES.map((stage, idx) => {
                const isPassed = idx < currentStageIndex;
                const isCurrent = idx === currentStageIndex;
                return (
                  <div
                    key={stage.id}
                    className={`p-3 rounded-xl border transition-all ${
                      isCurrent
                        ? 'bg-indigo-600/20 border-indigo-500/50 shadow-lg shadow-indigo-500/10'
                        : isPassed
                        ? 'bg-emerald-500/10 border-emerald-500/20'
                        : 'bg-white/[0.02] border-white/5 opacity-50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-mono text-slate-400">0{idx + 1}</span>
                      {isPassed ? (
                        <FaCheckCircle className="text-emerald-400 text-xs" />
                      ) : isCurrent ? (
                        <div className="w-2 h-2 rounded-full bg-indigo-400 animate-ping" />
                      ) : (
                        <div className="w-1.5 h-1.5 rounded-full bg-white/20" />
                      )}
                    </div>
                    <p className={`text-xs font-semibold truncate ${
                      isCurrent ? 'text-indigo-200' : isPassed ? 'text-emerald-200' : 'text-slate-400'
                    }`}>
                      {stage.label}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* AI Record Assistant — Chatbot 1 */}
        {!showAIAgent ? (
          <button
            onClick={() => setShowAIAgent(true)}
            className="w-full mb-6 py-3.5 px-6 rounded-2xl bg-linear-to-r from-amber-600/15 via-orange-600/15 to-amber-600/15 hover:from-amber-600/25 hover:to-orange-600/25 border border-amber-500/30 text-amber-200 font-medium text-xs transition-all flex items-center justify-between group shadow-lg"
          >
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-300">
                <FaRobot className="text-xs group-hover:scale-110 transition-transform" />
              </div>
              <span className="font-semibold text-sm text-white">Record Intelligence Assistant</span>
              <span className="text-[11px] text-amber-300/70 hidden sm:inline">— On-demand dossier analysis & statutory checklists</span>
            </div>
            <span className="px-2.5 py-1 rounded-md bg-amber-500/20 text-amber-300 text-[10px] font-semibold uppercase tracking-wider">
              Open Console
            </span>
          </button>
        ) : (
          <div className="mb-6">
            <OfficialAIAgent
              application={application}
              officialDesignation={official?.designation || 'Official'}
              officialName={`${official?.firstName || ''} ${official?.lastName || ''}`}
              isVisible={showAIAgent}
              onClose={() => setShowAIAgent(false)}
            />
          </div>
        )}

        {/* Applicant Information Card */}
        <div className="bg-slate-900/60 backdrop-blur-md rounded-2xl border border-white/10 p-6 mb-6 shadow-xl">
          <h2 className="text-base font-bold text-white mb-4 flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-blue-500/15 border border-blue-500/25 flex items-center justify-center text-blue-400">
              <FaUser className="text-xs" />
            </div>
            <span>Applicant & Identity Profile</span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-slate-950/40 p-4 rounded-xl border border-white/5">
              <label className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Full Legal Name</label>
              <p className="text-white font-semibold mt-1 text-base">{application.fullName || application.ownerName}</p>
            </div>
            <div className="bg-slate-950/40 p-4 rounded-xl border border-white/5">
              <label className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Contact Email</label>
              <p className="text-slate-200 font-medium mt-1 text-sm font-mono">{application.email || 'N/A'}</p>
            </div>
            <div className="bg-slate-950/40 p-4 rounded-xl border border-white/5">
              <label className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Mobile Number</label>
              <p className="text-slate-200 font-medium mt-1 text-sm font-mono">{application.phoneNumber || 'N/A'}</p>
            </div>
            <div className="bg-slate-950/40 p-4 rounded-xl border border-white/5">
              <label className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Receipt Identifier</label>
              <p className="text-indigo-300 font-semibold mt-1 text-sm font-mono">{application.receiptNumber}</p>
            </div>
            <div className="md:col-span-2">
              <DIDDisplay did={(application as any).did} compact={false} />
            </div>
          </div>
        </div>

        {/* Land Particulars Card */}
        <div className="bg-slate-900/60 backdrop-blur-md rounded-2xl border border-white/10 p-6 mb-6 shadow-xl">
          <h2 className="text-base font-bold text-white mb-4 flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center text-emerald-400">
              <FaMapMarkedAlt className="text-xs" />
            </div>
            <span>Parcel & Cadastral Attributes</span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-slate-950/40 p-4 rounded-xl border border-white/5">
              <label className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Recorded Owner</label>
              <p className="text-white font-semibold mt-1 text-sm">{application.ownerName}</p>
            </div>
            <div className="bg-slate-950/40 p-4 rounded-xl border border-white/5">
              <label className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Cadastral Survey Number</label>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-emerald-300 font-semibold text-sm font-mono">{application.surveyNumber}</span>
                <CopyPill text={application.surveyNumber} label="Survey Number" />
              </div>
            </div>
            <div className="bg-slate-950/40 p-4 rounded-xl border border-white/5">
              <label className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Parcel Extent</label>
              <p className="text-white font-semibold mt-1 text-sm">{application.area}</p>
            </div>
            <div className="bg-slate-950/40 p-4 rounded-xl border border-white/5">
              <label className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Land Nature</label>
              <p className="text-white font-semibold mt-1 text-sm capitalize">{application.nature || 'Not Specified'}</p>
            </div>
          </div>
        </div>

        {/* Address Card */}
        <div className="bg-slate-900/60 backdrop-blur-md rounded-2xl border border-white/10 p-6 mb-6 shadow-xl">
          <h2 className="text-base font-bold text-white mb-4 flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-indigo-500/15 border border-indigo-500/25 flex items-center justify-center text-indigo-400">
              <FaHome className="text-xs" />
            </div>
            <span>Jurisdiction & Revenue Location</span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-3 bg-slate-950/40 p-4 rounded-xl border border-white/5">
              <label className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Postal Address</label>
              <p className="text-slate-200 font-medium mt-1 text-sm">{application.address || 'N/A'}</p>
            </div>
            <div className="bg-slate-950/40 p-4 rounded-xl border border-white/5">
              <label className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Mandal / City</label>
              <p className="text-slate-200 font-medium mt-1 text-sm">{application.city || 'N/A'}</p>
            </div>
            <div className="bg-slate-950/40 p-4 rounded-xl border border-white/5">
              <label className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">District / State</label>
              <p className="text-slate-200 font-medium mt-1 text-sm">{application.state || 'Telangana'}</p>
            </div>
            <div className="bg-slate-950/40 p-4 rounded-xl border border-white/5">
              <label className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">PIN Code</label>
              <p className="text-slate-200 font-medium mt-1 text-sm font-mono">{application.pincode || 'N/A'}</p>
            </div>
          </div>
        </div>

        {/* Documents & Security Card */}
        <div className="bg-slate-900/60 backdrop-blur-md rounded-2xl border border-white/10 p-6 mb-6 shadow-xl">
          <h2 className="text-base font-bold text-white mb-4 flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-indigo-500/15 border border-indigo-500/25 flex items-center justify-center text-indigo-400">
              <FaFileAlt className="text-xs" />
            </div>
            <span>Evidence, Ledger Cryptography & Verification</span>
          </h2>

          <div className="space-y-4">
            {/* Form Card */}
            <div className="bg-slate-950/40 p-4 rounded-xl border border-white/5">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <span className="text-white font-semibold text-sm">Citizen Declaration Dossier</span>
                  <p className="text-[11px] text-slate-400">Official statutory registration declaration form</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPreviewDocUrl(previewDocUrl === `/api/land-requests/generate-form?receipt=${receiptNumber}` ? null : `/api/land-requests/generate-form?receipt=${receiptNumber}`)}
                    className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white rounded-lg text-xs font-medium border border-white/10 transition-all flex items-center gap-1.5"
                  >
                    {previewDocUrl === `/api/land-requests/generate-form?receipt=${receiptNumber}` ? (
                      <>
                        <FaTimes className="text-[10px]" />
                        <span>Close Preview</span>
                      </>
                    ) : (
                      <>
                        <FaEye className="text-[10px]" />
                        <span>Inline Preview</span>
                      </>
                    )}
                  </button>
                  <a
                    href={`/api/land-requests/generate-form?receipt=${receiptNumber}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-200 hover:text-white rounded-lg text-xs font-medium border border-indigo-500/30 transition-all flex items-center gap-1.5"
                  >
                    <FaExternalLinkAlt className="text-[10px]" />
                    <span>Open Tab</span>
                  </a>
                </div>
              </div>

              {previewDocUrl === `/api/land-requests/generate-form?receipt=${receiptNumber}` && (
                <div className="mt-4 pt-4 border-t border-white/10 animate-in fade-in duration-300">
                  <iframe
                    src={`/api/land-requests/generate-form?receipt=${receiptNumber}`}
                    className="w-full h-[550px] rounded-xl bg-white border border-white/10"
                    title="Form Preview"
                  />
                </div>
              )}
            </div>

            {/* Uploaded Deed Card */}
            {application.ipfsHash && (
              <div className="bg-slate-950/40 p-4 rounded-xl border border-white/5">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <span className="text-white font-semibold text-sm">Citizen Uploaded Deed / Evidence</span>
                    <p className="text-[11px] text-slate-400 font-mono">IPFS Hash: {application.ipfsHash.substring(0, 20)}...</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setPreviewDocUrl(previewDocUrl === `/api/documents/view?hash=${application.ipfsHash}` ? null : `/api/documents/view?hash=${application.ipfsHash}`)}
                      className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white rounded-lg text-xs font-medium border border-white/10 transition-all flex items-center gap-1.5"
                    >
                      {previewDocUrl === `/api/documents/view?hash=${application.ipfsHash}` ? (
                        <>
                          <FaTimes className="text-[10px]" />
                          <span>Close Preview</span>
                        </>
                      ) : (
                        <>
                          <FaEye className="text-[10px]" />
                          <span>Inline Preview</span>
                        </>
                      )}
                    </button>
                    <a
                      href={`/api/documents/view?hash=${application.ipfsHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 bg-blue-600/30 hover:bg-blue-600/50 text-blue-200 hover:text-white rounded-lg text-xs font-medium border border-blue-500/30 transition-all flex items-center gap-1.5"
                    >
                      <FaExternalLinkAlt className="text-[10px]" />
                      <span>Open Tab</span>
                    </a>
                  </div>
                </div>

                {previewDocUrl === `/api/documents/view?hash=${application.ipfsHash}` && (
                  <div className="mt-4 pt-4 border-t border-white/10 animate-in fade-in duration-300">
                    <iframe
                      src={`/api/documents/view?hash=${application.ipfsHash}`}
                      className="w-full h-[550px] rounded-xl bg-white border border-white/10"
                      title="Document Preview"
                    />
                  </div>
                )}
              </div>
            )}

            {/* M8 AI Trust Score Gauge */}
            <AITrustScore
              application={application}
              isVisible={['clerk', 'mro', 'collector', 'jointcollector', 'districtcollector', 'district_collector', 'revenue'].some(r => official?.designation?.toLowerCase().includes(r))}
            />

            {/* M8 AI Trust Score Explainer — Chatbot 2 */}
            {['clerk', 'mro', 'collector', 'jointcollector', 'districtcollector', 'district_collector', 'revenue'].some(r => official?.designation?.toLowerCase().includes(r)) && (
              <div>
                {!showTrustAgent ? (
                  <button
                    onClick={() => setShowTrustAgent(true)}
                    className="w-full py-3.5 px-6 rounded-2xl bg-linear-to-r from-cyan-600/15 via-blue-600/15 to-cyan-600/15 hover:from-cyan-600/25 hover:to-blue-600/25 border border-cyan-500/30 text-cyan-200 font-medium text-xs transition-all flex items-center justify-between group shadow-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-lg bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-300">
                        <FaBrain className="text-xs group-hover:scale-110 transition-transform" />
                      </div>
                      <span className="font-semibold text-sm text-white">M8 Trust Indexer Telemetry</span>
                      <span className="text-[11px] text-cyan-300/70 hidden sm:inline">— Blockchain cryptographic audits & score decomposition</span>
                    </div>
                    <span className="px-2.5 py-1 rounded-md bg-cyan-500/20 text-cyan-300 text-[10px] font-semibold uppercase tracking-wider">
                      Query Node
                    </span>
                  </button>
                ) : (
                  <TrustScoreAgent
                    applicationId={application.receiptNumber}
                    isVisible={showTrustAgent}
                    onClose={() => setShowTrustAgent(false)}
                  />
                )}
              </div>
            )}

            {/* M7 Blockchain Integrity Anchor */}
            {application.docHash && (
              <div className="bg-slate-950/40 p-4 rounded-xl border border-white/5">
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2 text-emerald-400">
                    <FaShieldAlt className="text-base" />
                    <span className="font-bold text-xs uppercase tracking-wider">Blockchain Ledger Anchor (M7)</span>
                  </div>
                  <div className="bg-black/50 p-3 rounded-lg border border-emerald-500/20">
                    <p className="text-[10px] text-slate-400 uppercase tracking-widest mb-1">SHA-256 State Hash</p>
                    <p className="text-xs text-emerald-300 font-mono break-all">{application.docHash}</p>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Anchored to Hyperledger Fabric channel. Verified against cryptographic state root.
                  </p>
                </div>
              </div>
            )}

            {/* M9 AI/OCR Analysis */}
            <OCRAnalysisPanel application={application} />

            {/* DigiLocker Request */}
            {official?._id && (
              <DigiLockerRequestPanel
                aadharNumber={application.aadharNumber || ''}
                receiptNumber={application.receiptNumber}
                officialId={official._id || ''}
                officialName={`${official.firstName} ${official.lastName}`}
                designation={official.designation || ''}
              />
            )}
          </div>
        </div>

        {/* Application History Timeline */}
        <ApplicationHistory history={application.actionHistory} />

        {/* Role-Specific Fields */}
        {getRoleComponent()}

        {/* Workflow Actions Section */}
        {isAssigned ? (
          <div className="bg-slate-900/60 backdrop-blur-md rounded-2xl border border-white/10 p-6 shadow-xl mb-6">
            <h2 className="text-base font-bold text-white mb-2">Statutory Decision Authority</h2>
            <p className="text-xs text-slate-400 mb-5">
              Review all extracted evidence, boundary coordinates, and ledger checks before affixing digital endorsement.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <button
                onClick={() => handleAction('forward', `Endorsed by ${official?.designation}`)}
                disabled={isProcessing}
                className={`flex-1 px-6 py-3.5 rounded-xl font-bold text-sm transition-all border flex items-center justify-center gap-2 ${
                  isProcessing
                    ? 'bg-slate-800 text-slate-400 border-white/5 cursor-not-allowed opacity-50'
                    : 'bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-200 hover:text-white border-emerald-500/40 shadow-lg'
                }`}
              >
                {isProcessing ? (
                  <>
                    <FaSpinner className="animate-spin text-sm" />
                    <span>Processing Endorsement...</span>
                  </>
                ) : (
                  <>
                    <FaCheckCircle className="text-emerald-400 text-sm" />
                    <span>{official?.designation?.toLowerCase() === 'clerk' ? 'Forward to Supervisory Node' : 'Approve & Advance Dossier'}</span>
                  </>
                )}
              </button>
              <button
                onClick={() => handleAction('reject', `Rejected by ${official?.designation}`)}
                disabled={isProcessing}
                className={`flex-1 px-6 py-3.5 rounded-xl font-bold text-sm transition-all border flex items-center justify-center gap-2 ${
                  isProcessing
                    ? 'bg-slate-800 text-slate-400 border-white/5 cursor-not-allowed opacity-50'
                    : 'bg-rose-600/25 hover:bg-rose-600/40 text-rose-200 hover:text-white border-rose-500/40 shadow-lg'
                }`}
              >
                <FaTimesCircle className="text-rose-400 text-sm" />
                <span>Return with Objections / Reject</span>
              </button>
            </div>
          </div>
        ) : (
          <div className={`backdrop-blur-md rounded-2xl border p-6 shadow-xl mb-6 ${
            application?.status === 'completed'
              ? 'bg-emerald-950/30 border-emerald-500/30'
              : application?.status === 'rejected'
              ? 'bg-rose-950/30 border-rose-500/30'
              : 'bg-slate-900/60 border-white/10'
          }`}>
            <div className="flex items-start gap-4">
              {application?.status === 'completed' ? (
                <>
                  <FaCheckCircle className="text-emerald-400 text-2xl shrink-0 mt-0.5" />
                  <div>
                    <h3 className="text-base font-bold text-emerald-300">Statutory Application Completed</h3>
                    <p className="text-xs text-emerald-200/80 mt-1 leading-relaxed">
                      All departmental endorsements and cadastral validations are completed and anchored on the blockchain ledger.
                    </p>
                    <div className="mt-3">
                      <button
                        onClick={handleGeneratePatta}
                        disabled={pattaLoading}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs rounded-xl shadow-lg transition-all flex items-center gap-2"
                      >
                        {pattaLoading ? <FaSpinner className="animate-spin text-xs" /> : <FaFileAlt className="text-xs" />}
                        <span>{pattaLoading ? 'Generating Patta...' : 'View / Download Official Patta Passbook'}</span>
                      </button>
                    </div>
                  </div>
                </>
              ) : application.status === 'rejected' ? (
                <>
                  <FaTimesCircle className="text-rose-400 text-2xl shrink-0 mt-0.5" />
                  <div>
                    <h3 className="text-base font-bold text-rose-300">Application File Rejected</h3>
                    <p className="text-xs text-rose-200/80 mt-1 leading-relaxed">
                      This docket was rejected during official review. Check the timeline history above for official objections.
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <FaClock className="text-amber-400 text-2xl shrink-0 mt-0.5" />
                  <div>
                    <h3 className="text-base font-bold text-amber-300">File In Active Departmental Review</h3>
                    <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                      This docket is currently progressing through the {application.status.replace(/_/g, ' ')} stage. Read-only review mode active.
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Unsaved Data Warning Modal */}
        {showDataWarning && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
            <div className="bg-slate-900 rounded-2xl border border-amber-500/30 p-6 max-w-md w-full shadow-2xl">
              <div className="flex items-start gap-3 mb-4">
                <FaExclamationTriangle className="text-amber-400 text-xl shrink-0 mt-1" />
                <div>
                  <h3 className="text-base font-bold text-amber-300">Unsaved Form Input Detected</h3>
                  <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                    Auto-save is persisting data. Wait 2 seconds or click Proceed to complete state anchoring.
                  </p>
                </div>
              </div>
              <div className="flex gap-3 mt-5">
                <button
                  onClick={() => { setShowDataWarning(false); setPendingAction(null); }}
                  className="flex-1 px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-xl text-xs font-semibold border border-white/10 transition-all"
                >
                  Review Form
                </button>
                <button
                  onClick={() => {
                    setShowDataWarning(false);
                    if (pendingAction) {
                      setTimeout(() => proceedWithAction(pendingAction.action, pendingAction.remarks), 1500);
                    }
                  }}
                  className="flex-1 px-4 py-2 bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-200 border border-emerald-500/40 rounded-xl text-xs font-semibold transition-all"
                >
                  Proceed
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Sticky Bottom Action Dock (when application is assigned to the active official) */}
      {isAssigned && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 w-[92%] max-w-4xl animate-in slide-in-from-bottom-4 duration-300">
          <div className="bg-slate-900/90 backdrop-blur-xl border border-white/15 px-5 py-3 rounded-2xl shadow-2xl flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <div>
                <span className="text-white text-xs font-bold">{receiptNumber}</span>
                <span className="text-slate-400 text-xs ml-2 hidden sm:inline">• Assigned for Official Action</span>
              </div>
            </div>
            <div className="flex items-center gap-2.5">
              <button
                onClick={() => handleAction('forward', `Endorsed by ${official?.designation}`)}
                disabled={isProcessing}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs rounded-xl shadow-lg transition-all flex items-center gap-1.5 disabled:opacity-50"
              >
                {isProcessing ? <FaSpinner className="animate-spin text-xs" /> : <FaCheckCircle className="text-xs" />}
                <span>{official?.designation?.toLowerCase() === 'clerk' ? 'Forward' : 'Approve & Forward'}</span>
              </button>
              <button
                onClick={() => handleAction('reject', `Rejected by ${official?.designation}`)}
                disabled={isProcessing}
                className="px-4 py-2 bg-rose-600/30 hover:bg-rose-600/50 text-rose-200 hover:text-white font-semibold text-xs rounded-xl border border-rose-500/40 transition-all flex items-center gap-1.5 disabled:opacity-50"
              >
                <FaTimesCircle className="text-xs" />
                <span>Reject</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
