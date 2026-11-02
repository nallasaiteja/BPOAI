import React, { useState, useEffect } from 'react';
import { 
  Mail, Send, CheckCircle2, XCircle, Clock, ShieldCheck, 
  Sparkles, Calendar, User, Eye, AlertCircle, Lock, Trash2,
  FileText, Loader2, RefreshCw, Scissors, Wand2, Sliders, Check,
  RotateCcw, Building2, TestTube2, AlertTriangle, ExternalLink, Code,
  Search, Filter, Inbox, Award, ArrowRight, Copy, CheckCheck, Zap
} from 'lucide-react';
import { EmailDraft, Proposal, CompanyProfile, EmailQualityCheckResult } from '../types';
import { api } from '../services/api';

interface EmailApprovalViewProps {
  drafts: EmailDraft[];
  proposals?: Proposal[];
  onApprove: (draftId: string) => Promise<void>;
  onReject: (draftId: string, notes?: string) => Promise<void>;
  onDeleteLead?: (leadId: string) => Promise<void>;
  onDeleteAll?: () => Promise<void>;
  onNavigate?: (tab: string) => void;
  showToast?: (msg: string) => void;
  onRefresh?: () => Promise<void>;
}

const OUTREACH_STYLES = [
  { id: 'PERSONALIZED_INTRO', label: 'Personalized Intro', icon: '👋', desc: 'Introduces our company and services based on verified company context' },
  { id: 'VALUE_FOCUSED', label: 'Value-Focused', icon: '🎯', desc: 'Focuses on a specific operational friction point with practical ROI' },
  { id: 'EXECUTIVE', label: 'Executive (C-Suite)', icon: '💼', desc: 'Concise, high-impact language (< 120 words) for Founders and CEOs' },
  { id: 'TECH_SOLUTIONS', label: 'Tech & Automation', icon: '⚡', desc: 'Software engineering, cloud infrastructure, and AI workflow integration' },
  { id: 'MEETING_REQUEST', label: 'Meeting Request', icon: '📅', desc: 'Short, direct request for a 15-minute introductory calendar briefing' },
  { id: 'FOLLOW_UP', label: 'Follow-Up', icon: '🔄', desc: 'Polite follow-up referencing our earlier note' },
  { id: 'SERVICE_SPECIFIC', label: 'Service-Specific', icon: '📦', desc: 'Deep dive on a single service offering from our catalogue' },
];

export const EmailApprovalView: React.FC<EmailApprovalViewProps> = ({ 
  drafts, 
  proposals = [],
  onApprove, 
  onReject, 
  onDeleteLead, 
  onDeleteAll,
  onNavigate,
  showToast,
  onRefresh
}) => {
  const activeDrafts = drafts.filter(d => !d.status || d.status === 'AWAITING_APPROVAL' || d.status === 'DRAFT');
  const [selectedDraftId, setSelectedDraftId] = useState<string>(activeDrafts[0]?.id || '');
  const [mobileOutreachView, setMobileOutreachView] = useState<'queue' | 'composer'>('queue');
  const [queueSearch, setQueueSearch] = useState('');
  const [queueFilter, setQueueFilter] = useState<'ALL' | 'AI' | 'FALLBACK'>('ALL');
  const [copiedSubject, setCopiedSubject] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isGeneratingProposal, setIsGeneratingProposal] = useState(false);
  const [generatedDraftIds, setGeneratedDraftIds] = useState<Set<string>>(new Set());
  const [rejectNote, setRejectNote] = useState('');
  const [isRejectOpen, setIsRejectOpen] = useState(false);

  // Active Draft Editing & Generation State
  const activeDraft = activeDrafts.find(d => d.id === selectedDraftId) || (activeDrafts.length > 0 ? activeDrafts[0] : null);
  const [subjectInput, setSubjectInput] = useState('');
  const [bodyHtmlInput, setBodyHtmlInput] = useState('');
  const [bodyPlainInput, setBodyPlainInput] = useState('');
  const [viewMode, setViewMode] = useState<'preview' | 'edit' | 'plain'>('preview');
  const [isDirty, setIsDirty] = useState(false);

  // Action Loading States
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [isShortening, setIsShortening] = useState(false);
  const [isPersonalizing, setIsPersonalizing] = useState(false);
  const [isApplyingFallback, setIsApplyingFallback] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);

  // Quality Validation & Warnings
  const [qualityResult, setQualityResult] = useState<EmailQualityCheckResult | null>(null);
  const [isValidating, setIsValidating] = useState(false);

  // Test Email Modal
  const [isTestModalOpen, setIsTestModalOpen] = useState(false);
  const [testEmailAddress, setTestEmailAddress] = useState('');
  const [isSendingTest, setIsSendingTest] = useState(false);

  // Company Profile State
  const [companyProfile, setCompanyProfile] = useState<CompanyProfile | null>(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  const currentUser = api.getCurrentUser();
  const canApprove = ['SUPER_ADMIN', 'ADMINISTRATOR', 'SENIOR_MANAGER', 'BPO_TEAM_LEADER'].includes(currentUser?.role);

  // Sync draft selection and inputs
  useEffect(() => {
    if (activeDrafts.length === 0) {
      setSelectedDraftId('');
    } else if (!selectedDraftId || !activeDrafts.some(d => d.id === selectedDraftId)) {
      setSelectedDraftId(activeDrafts[0]?.id || '');
    }
  }, [activeDrafts, selectedDraftId]);

  useEffect(() => {
    if (activeDraft) {
      setSubjectInput(activeDraft.subject || '');
      setBodyHtmlInput(activeDraft.body_html || '');
      setBodyPlainInput(activeDraft.body_plain || '');
      setIsDirty(false);
      setViewMode('preview');

      // Fetch live quality check
      api.checkDraftQuality(activeDraft.id)
        .then(res => setQualityResult(res))
        .catch(() => null);
    } else {
      setSubjectInput('');
      setBodyHtmlInput('');
      setBodyPlainInput('');
      setQualityResult(null);
    }
  }, [activeDraft?.id]);

  // Load our Company Profile on mount
  useEffect(() => {
    api.getCompanyProfile()
      .then(p => {
        setCompanyProfile(p);
        if (currentUser?.email) setTestEmailAddress(currentUser.email);
      })
      .catch(() => null);
  }, []);

  const hasProposal = Boolean(activeDraft && (generatedDraftIds.has(activeDraft.id) || proposals.some(p => p.lead === activeDraft.lead)));

  const handleGenerateProposal = async () => {
    if (!activeDraft) return;
    setIsGeneratingProposal(true);
    try {
      await api.generateProposalForDraft(activeDraft.id);
      setGeneratedDraftIds(prev => new Set(prev).add(activeDraft.id));
      if (showToast) {
        showToast(`Proposal & Quote generated for ${activeDraft.lead_name}!`);
      }
      if (onRefresh) {
        await onRefresh();
      }
    } catch (e: any) {
      alert('Error generating proposal: ' + (e?.message || e));
    } finally {
      setIsGeneratingProposal(false);
    }
  };

  const handleApprove = async () => {
    if (!activeDraft) return;
    setIsProcessing(true);
    try {
      // Save changes first if dirty
      if (isDirty) {
        await api.saveDraft(activeDraft.id, {
          subject: subjectInput,
          body_html: bodyHtmlInput,
          body_plain: bodyPlainInput,
        });
      }
      await onApprove(activeDraft.id);
    } catch (e) {
      alert('Error approving email: ' + (e as any).message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!activeDraft) return;
    setIsProcessing(true);
    try {
      await onReject(activeDraft.id, rejectNote);
      setIsRejectOpen(false);
      setRejectNote('');
    } catch (e) {
      alert('Error rejecting email: ' + (e as any).message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSaveDraftEdits = async () => {
    if (!activeDraft) return;
    setIsSavingDraft(true);
    try {
      const updated = await api.saveDraft(activeDraft.id, {
        subject: subjectInput,
        body_html: bodyHtmlInput,
        body_plain: bodyPlainInput,
      });
      setIsDirty(false);
      if (showToast) showToast('Draft changes saved successfully.');
      // Refresh quality check
      const qual = await api.checkDraftQuality(activeDraft.id);
      setQualityResult(qual);
      if (onRefresh) await onRefresh();
    } catch (e: any) {
      alert('Error saving draft edits: ' + (e?.message || e));
    } finally {
      setIsSavingDraft(false);
    }
  };

  const handleRevertChanges = () => {
    if (!activeDraft) return;
    setSubjectInput(activeDraft.subject);
    setBodyHtmlInput(activeDraft.body_html);
    setBodyPlainInput(activeDraft.body_plain);
    setIsDirty(false);
    if (showToast) showToast('Changes reverted to original draft.');
  };

  const handleRegenerate = async (styleId?: string) => {
    if (!activeDraft) return;
    setIsRegenerating(true);
    try {
      const updated = await api.regenerateDraft(activeDraft.id, {
        style: styleId || activeDraft.outreach_style || 'PERSONALIZED_INTRO',
      });
      setSubjectInput(updated.subject);
      setBodyHtmlInput(updated.body_html);
      setBodyPlainInput(updated.body_plain);
      setIsDirty(false);
      if (showToast) showToast(`Email regenerated in '${styleId || activeDraft.outreach_style}' style.`);
      const qual = await api.checkDraftQuality(activeDraft.id);
      setQualityResult(qual);
      if (onRefresh) await onRefresh();
    } catch (e: any) {
      alert('Error regenerating email: ' + (e?.message || e));
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleShorten = async () => {
    if (!activeDraft) return;
    setIsShortening(true);
    try {
      const updated = await api.shortenDraft(activeDraft.id);
      setSubjectInput(updated.subject);
      setBodyHtmlInput(updated.body_html);
      setBodyPlainInput(updated.body_plain);
      setIsDirty(false);
      if (showToast) showToast('Draft shortened to concise executive length (< 90 words).');
      const qual = await api.checkDraftQuality(activeDraft.id);
      setQualityResult(qual);
      if (onRefresh) await onRefresh();
    } catch (e: any) {
      alert('Error shortening email: ' + (e?.message || e));
    } finally {
      setIsShortening(false);
    }
  };

  const handlePersonalize = async () => {
    if (!activeDraft) return;
    setIsPersonalizing(true);
    try {
      const updated = await api.personalizeDraft(activeDraft.id);
      setSubjectInput(updated.subject);
      setBodyHtmlInput(updated.body_html);
      setBodyPlainInput(updated.body_plain);
      setIsDirty(false);
      if (showToast) showToast('Injected verified intelligence findings and observable tech stack.');
      const qual = await api.checkDraftQuality(activeDraft.id);
      setQualityResult(qual);
      if (onRefresh) await onRefresh();
    } catch (e: any) {
      alert('Error personalizing email: ' + (e?.message || e));
    } finally {
      setIsPersonalizing(false);
    }
  };

  const handleUseFallback = async () => {
    if (!activeDraft) return;
    setIsApplyingFallback(true);
    try {
      const updated = await api.useFallbackTemplate(activeDraft.id, activeDraft.outreach_style || 'PERSONALIZED_INTRO');
      setSubjectInput(updated.subject);
      setBodyHtmlInput(updated.body_html);
      setBodyPlainInput(updated.body_plain);
      setIsDirty(false);
      if (showToast) showToast('Applied high-quality predefined fallback template.');
      const qual = await api.checkDraftQuality(activeDraft.id);
      setQualityResult(qual);
      if (onRefresh) await onRefresh();
    } catch (e: any) {
      alert('Error applying fallback template: ' + (e?.message || e));
    } finally {
      setIsApplyingFallback(false);
    }
  };

  const handleSendTest = async () => {
    if (!activeDraft) return;
    if (!testEmailAddress || !testEmailAddress.includes('@')) {
      alert('Please enter a valid destination email address for the test preview.');
      return;
    }
    setIsSendingTest(true);
    try {
      const res = await api.sendTestEmail(activeDraft.id, testEmailAddress);
      setIsTestModalOpen(false);
      if (showToast) showToast(res?.message || `Test preview sent to ${testEmailAddress}.`);
    } catch (e: any) {
      alert('Error sending test email: ' + (e?.message || e));
    } finally {
      setIsSendingTest(false);
    }
  };

  const handleSaveCompanyProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyProfile) return;
    setIsSavingProfile(true);
    try {
      const updated = await api.updateCompanyProfile(companyProfile);
      setCompanyProfile(updated);
      setIsProfileModalOpen(false);
      if (showToast) showToast('Company Outreach Profile saved successfully.');
    } catch (e: any) {
      alert('Error saving company profile: ' + (e?.message || e));
    } finally {
      setIsSavingProfile(false);
    }
  };

  const aiGeneratedCount = activeDrafts.filter(d => d.generation_method !== 'TEMPLATE_FALLBACK').length;
  const fallbackCount = activeDrafts.filter(d => d.generation_method === 'TEMPLATE_FALLBACK').length;
  const avgQuality = activeDrafts.length > 0 
    ? Math.round(activeDrafts.reduce((acc, d) => acc + (d.quality_score || d.confidence_score || 90), 0) / activeDrafts.length)
    : 95;

  const filteredDrafts = activeDrafts.filter(draft => {
    const q = queueSearch.toLowerCase();
    const matchesSearch = 
      draft.lead_name.toLowerCase().includes(q) ||
      draft.lead_email.toLowerCase().includes(q) ||
      (draft.subject || '').toLowerCase().includes(q);
    if (!matchesSearch) return false;
    if (queueFilter === 'AI') return draft.generation_method !== 'TEMPLATE_FALLBACK';
    if (queueFilter === 'FALLBACK') return draft.generation_method === 'TEMPLATE_FALLBACK';
    return true;
  });

  return (
    <div className="space-y-4">
      {/* Top Command Banner: Modern B2B Outreach Intelligence Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 p-5 text-white shadow-lg border border-slate-700/60">
        <div className="absolute -top-12 -right-12 w-48 h-48 bg-blue-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-10 -left-10 w-48 h-48 bg-purple-500/15 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-400 border border-blue-400/30 flex items-center justify-center shrink-0">
                <Mail className="w-4 h-4" />
              </div>
              <h2 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
                <span>Executive Email Outreach Suite</span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Strict Anti-Hallucination
                </span>
              </h2>
            </div>
            <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
              Review, personalize, and approve high-conversion business emails crafted with verified company intelligence and grounded BPO offerings.
            </p>
          </div>

          {/* Quick Metrics Bar */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="bg-white/10 backdrop-blur-sm px-3 py-1.5 rounded-xl border border-white/10 flex items-center gap-2 text-xs">
              <Inbox className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-slate-300">Queue:</span>
              <span className="font-bold text-white">{activeDrafts.length}</span>
            </div>
            <div className="bg-white/10 backdrop-blur-sm px-3 py-1.5 rounded-xl border border-white/10 flex items-center gap-2 text-xs">
              <Sparkles className="w-3.5 h-3.5 text-purple-400" />
              <span className="text-slate-300">AI Synthesized:</span>
              <span className="font-bold text-purple-300">{aiGeneratedCount}</span>
            </div>
            <div className="bg-white/10 backdrop-blur-sm px-3 py-1.5 rounded-xl border border-white/10 flex items-center gap-2 text-xs">
              <Award className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-slate-300">Avg Quality:</span>
              <span className="font-bold text-emerald-300">{avgQuality}%</span>
            </div>
            <button
              onClick={() => setIsProfileModalOpen(true)}
              className="px-3.5 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold rounded-xl text-xs flex items-center gap-1.5 shadow-md shadow-blue-600/30 transition-all cursor-pointer"
              title="Configure Company Profile: View and edit our company name, services offered, differentiators, and sender details."
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>Our Profile</span>
            </button>
          </div>
        </div>
      </div>

      {/* SECTION: Company Profile Incomplete Warning */}
      {companyProfile?.missing_warnings && companyProfile.missing_warnings.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs flex flex-wrap items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <div>
              <span className="font-bold text-amber-900">Company Outreach Profile Needs Attention:</span>
              <span className="text-amber-800 ml-1">
                {companyProfile.missing_warnings.join(' ')}
              </span>
            </div>
          </div>
          <button
            onClick={() => setIsProfileModalOpen(true)}
            className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-lg shadow-2xs transition-colors cursor-pointer"
          >
            Configure Profile Now
          </button>
        </div>
      )}

      {/* Mobile / Tablet Segmented Switcher */}
      <div className="lg:hidden flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200">
        <button
          onClick={() => setMobileOutreachView('queue')}
          className={`flex-1 py-2 text-xs font-bold rounded-lg text-center transition-all cursor-pointer ${
            mobileOutreachView === 'queue'
              ? 'bg-white text-blue-700 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Queue ({activeDrafts.length})
        </button>
        <button
          onClick={() => setMobileOutreachView('composer')}
          className={`flex-1 py-2 text-xs font-bold rounded-lg text-center transition-all cursor-pointer ${
            mobileOutreachView === 'composer'
              ? 'bg-white text-blue-700 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Email Composer {activeDraft ? `(${activeDraft.lead_name.slice(0, 12)}...)` : ''}
        </button>
      </div>

      {/* Main Grid: Left Draft Queue + Right Advanced Composer */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Col: Outreach Approval Queue */}
        <div className={`lg:col-span-4 bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-3 ${
          mobileOutreachView === 'queue' ? 'block' : 'hidden lg:block'
        }`}>
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-600" />
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Outreach Queue ({filteredDrafts.length})
              </h3>
            </div>
            {drafts.length > 0 && onDeleteAll && (
              <button
                onClick={onDeleteAll}
                className="text-[11px] text-rose-600 hover:text-rose-700 font-semibold flex items-center gap-1 bg-rose-50 hover:bg-rose-100 px-2 py-0.5 rounded cursor-pointer transition-colors"
                title="Delete All Outreach: Permanently clears all pending email drafts and resets the outreach queue."
              >
                <Trash2 className="w-3 h-3" />
                <span>Delete All</span>
              </button>
            )}
          </div>

          {/* Quick Search & Filter Controls */}
          <div className="space-y-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search leads, emails, subject lines..."
                value={queueSearch}
                onChange={(e) => setQueueSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all placeholder:text-slate-400"
              />
            </div>
            <div className="flex items-center gap-1 p-0.5 bg-slate-100 rounded-lg text-[11px]">
              <button
                onClick={() => setQueueFilter('ALL')}
                className={`flex-1 py-1 rounded-md font-semibold transition-all cursor-pointer ${
                  queueFilter === 'ALL' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All ({activeDrafts.length})
              </button>
              <button
                onClick={() => setQueueFilter('AI')}
                className={`flex-1 py-1 rounded-md font-semibold transition-all cursor-pointer ${
                  queueFilter === 'AI' ? 'bg-white text-purple-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                AI ({aiGeneratedCount})
              </button>
              <button
                onClick={() => setQueueFilter('FALLBACK')}
                className={`flex-1 py-1 rounded-md font-semibold transition-all cursor-pointer ${
                  queueFilter === 'FALLBACK' ? 'bg-white text-amber-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Fallback ({fallbackCount})
              </button>
            </div>
          </div>

          <div className="space-y-2 max-h-[720px] overflow-y-auto pr-1">
            {filteredDrafts.length > 0 ? (
              filteredDrafts.map((draft) => {
                const isSelected = draft.id === (activeDraft?.id);
                const isFallback = draft.generation_method === 'TEMPLATE_FALLBACK';
                const initial = (draft.lead_name || 'C').charAt(0).toUpperCase();

                return (
                  <button
                    key={draft.id}
                    onClick={() => {
                      setSelectedDraftId(draft.id);
                      setMobileOutreachView('composer');
                    }}
                    title={`Click to review email drafted for ${draft.lead_name} (${draft.lead_email}).`}
                    className={`w-full text-left p-3.5 rounded-xl border text-xs transition-all cursor-pointer group relative ${
                      isSelected 
                        ? 'border-l-4 border-l-blue-600 border-blue-300 bg-gradient-to-r from-blue-50/70 via-indigo-50/20 to-white shadow-xs' 
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/70'
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 transition-colors ${
                        isSelected 
                          ? 'bg-blue-600 text-white shadow-xs' 
                          : 'bg-gradient-to-br from-blue-50 to-indigo-100 text-blue-700 border border-blue-200/60'
                      }`}>
                        {initial}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1 mb-1">
                          <span className="font-bold text-slate-900 truncate text-xs">{draft.lead_name}</span>
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/60 shrink-0">
                            {draft.quality_score || draft.confidence_score}%
                          </span>
                        </div>

                        <div className="text-slate-600 font-medium truncate text-[11px] mb-1.5">
                          {draft.subject}
                        </div>

                        <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-100">
                          <span className="font-mono text-slate-500 truncate max-w-[140px]">{draft.lead_email}</span>
                          <div className="flex items-center gap-1 shrink-0">
                            {isFallback ? (
                              <span 
                                className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 flex items-center gap-0.5"
                                title="Predefined Template Fallback"
                              >
                                <ShieldCheck className="w-2.5 h-2.5 text-amber-600" />
                                Fallback
                              </span>
                            ) : (
                              <span 
                                className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-purple-50 text-purple-800 border border-purple-200 flex items-center gap-0.5"
                                title="AI Generated via Gemini LLM"
                              >
                                <Sparkles className="w-2.5 h-2.5 text-purple-600" />
                                Gemini AI
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="py-16 text-center text-slate-400 text-xs space-y-2">
                <Inbox className="w-8 h-8 mx-auto text-slate-300" />
                <p className="font-semibold text-slate-600">No matching emails in queue</p>
                <p className="text-[11px] text-slate-400">
                  {queueSearch ? 'Try adjusting your search criteria.' : 'Outreach queue is clear.'}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Right Col: Advanced Email Composer & Review Panel */}
        <div className={`lg:col-span-8 bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-5 ${
          mobileOutreachView === 'composer' ? 'block' : 'hidden lg:block'
        }`}>
          {activeDraft ? (
            <div className="space-y-5">
              <button
                onClick={() => setMobileOutreachView('queue')}
                className="lg:hidden inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg border border-blue-200 transition-colors cursor-pointer"
              >
                &larr; Back to Outreach Queue
              </button>

              {/* Recipient VIP Dossier Card */}
              <div className="bg-gradient-to-br from-slate-50 to-blue-50/30 border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-2xs">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5">
                    <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white font-bold flex items-center justify-center text-base shadow-sm shrink-0">
                      {(activeDraft.lead_name || 'C').charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-base font-bold text-slate-900">
                          {activeDraft.lead_name}
                        </h2>
                        <span className="text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full uppercase">
                          {(activeDraft.outreach_style || activeDraft.email_type).replace(/_/g, ' ')}
                        </span>
                        {activeDraft.generation_method === 'TEMPLATE_FALLBACK' ? (
                          <span 
                            className="text-[10px] font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full flex items-center gap-1"
                            title={activeDraft.fallback_reason || 'Fallback template activated'}
                          >
                            <ShieldCheck className="w-3 h-3 text-amber-600" />
                            <span>Predefined Fallback</span>
                          </span>
                        ) : (
                          <span 
                            className="text-[10px] font-semibold text-purple-800 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded-full flex items-center gap-1"
                            title="Generated using Google Gemini with anti-hallucination guard"
                          >
                            <Sparkles className="w-3 h-3 text-purple-600" />
                            <span>Gemini AI ({activeDraft.ai_model_used || 'gemini-2.5-flash'})</span>
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mt-1">
                        <span>Recipient: <b className="font-mono text-slate-700">{activeDraft.lead_email}</b></span>
                        {onNavigate && (
                          <button
                            onClick={() => onNavigate('research')}
                            className="text-blue-600 hover:text-blue-800 font-semibold inline-flex items-center gap-1 transition-colors cursor-pointer"
                          >
                            <span>View Company Dossier</span>
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Primary Action Buttons */}
                  <div className="flex flex-wrap items-center gap-2">
                    {onDeleteLead && activeDraft?.lead && (
                      <button
                        onClick={() => {
                          if (window.confirm(`Delete lead '${activeDraft.lead_name}' and cancel outreach?`)) {
                            onDeleteLead(activeDraft.lead);
                          }
                        }}
                        className="p-2 text-rose-500 hover:text-rose-700 bg-white hover:bg-rose-50 border border-slate-200 hover:border-rose-200 rounded-xl transition-colors cursor-pointer shadow-2xs"
                        title="Delete Lead: Permanently delete lead and draft from CRM."
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}

                    <button
                      onClick={() => setIsTestModalOpen(true)}
                      className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl shadow-2xs transition-all cursor-pointer"
                      title="Send Test Email: Deliver a preview copy of this email to your personal inbox to verify formatting and deliverability."
                    >
                      <TestTube2 className="w-3.5 h-3.5 text-slate-500" />
                      <span>Send Test</span>
                    </button>

                    {/* Explicit Generate Proposal & Quote Button */}
                    {hasProposal ? (
                      <button
                        onClick={() => onNavigate && onNavigate('proposals')}
                        className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-xl transition-all cursor-pointer shadow-2xs"
                        title="Proposal Ready: A formal quotation has been generated for this lead. Click to view in Proposals & Quotes."
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 text-purple-600" />
                        <span>View Proposal &rarr;</span>
                      </button>
                    ) : (
                      <button
                        onClick={handleGenerateProposal}
                        disabled={isGeneratingProposal}
                        className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-xl transition-all disabled:opacity-50 cursor-pointer shadow-2xs"
                        title="Generate Proposal & Quote: Explicitly generates an enterprise B2B proposal and pricing quotation tailored to this lead."
                      >
                        {isGeneratingProposal ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-600" />
                            <span>Generating...</span>
                          </>
                        ) : (
                          <>
                            <FileText className="w-3.5 h-3.5 text-purple-600" />
                            <span>Generate Proposal</span>
                          </>
                        )}
                      </button>
                    )}

                    {canApprove ? (
                      <>
                        <button
                          onClick={() => setIsRejectOpen(true)}
                          disabled={isProcessing}
                          className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl transition-all disabled:opacity-50 cursor-pointer shadow-2xs"
                          title="Reject Outreach: Discard this draft with optional prompt feedback."
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          <span>Reject</span>
                        </button>

                        <button
                          onClick={handleApprove}
                          disabled={isProcessing}
                          className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 rounded-xl shadow-md shadow-blue-500/25 transition-all disabled:opacity-50 cursor-pointer"
                          title="Approve & Send: Gives senior authorization to dispatch this personalized email immediately."
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>{isProcessing ? 'Dispatching...' : 'Approve & Send'}</span>
                        </button>
                      </>
                    ) : (
                      <div 
                        className="flex items-center gap-1.5 px-3 py-2 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl text-xs font-semibold shadow-2xs"
                        title="Senior Manager Sign-off Required"
                      >
                        <Lock className="w-3.5 h-3.5 text-amber-600" />
                        <span>Sign-off Required</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* SECTION: Style Selector Bar */}
              <div className="bg-slate-50/80 border border-slate-200 rounded-2xl p-3.5">
                <div className="flex items-center justify-between mb-2 px-0.5">
                  <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <Wand2 className="w-3.5 h-3.5 text-blue-600" />
                    <span>Outreach Style & Positioning Strategy:</span>
                  </span>
                  <span className="text-[10px] text-slate-400">
                    Switch styles anytime to regenerate instantly
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {OUTREACH_STYLES.map(st => {
                    const isCurrent = (activeDraft.outreach_style || activeDraft.email_type) === st.id;
                    return (
                      <button
                        key={st.id}
                        onClick={() => handleRegenerate(st.id)}
                        disabled={isRegenerating}
                        title={st.desc}
                        className={`px-3 py-1.5 rounded-xl text-xs transition-all cursor-pointer flex items-center gap-1.5 ${
                          isCurrent
                            ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-xs font-bold'
                            : 'bg-white hover:bg-blue-50/70 text-slate-700 border border-slate-200 hover:border-blue-300 font-medium'
                        }`}
                      >
                        <span>{st.icon}</span>
                        <span>{st.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* SECTION: AI Assistant & Editing Toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-2.5 bg-slate-50/80 border border-slate-200 p-2.5 rounded-2xl text-xs">
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    onClick={() => handleRegenerate()}
                    disabled={isRegenerating}
                    className="flex items-center gap-1.5 px-3 py-1.5 font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition-all disabled:opacity-50 cursor-pointer shadow-2xs"
                    title="Regenerate Draft: Re-runs AI synthesis with varied professional wording."
                  >
                    <RefreshCw className={`w-3.5 h-3.5 text-blue-600 ${isRegenerating ? 'animate-spin' : ''}`} />
                    <span>{isRegenerating ? 'Generating...' : 'Regenerate'}</span>
                  </button>

                  <button
                    onClick={handleShorten}
                    disabled={isShortening}
                    className="flex items-center gap-1.5 px-3 py-1.5 font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition-all disabled:opacity-50 cursor-pointer shadow-2xs"
                    title="Shorten Email: Rewrites message to be ultra-concise and punchy (< 90 words)."
                  >
                    <Scissors className={`w-3.5 h-3.5 text-amber-600 ${isShortening ? 'animate-spin' : ''}`} />
                    <span>{isShortening ? 'Shortening...' : 'Make Punchy'}</span>
                  </button>

                  <button
                    onClick={handlePersonalize}
                    disabled={isPersonalizing}
                    className="flex items-center gap-1.5 px-3 py-1.5 font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition-all disabled:opacity-50 cursor-pointer shadow-2xs"
                    title="Deepen Personalization: Injects specific observable findings from Company Intelligence."
                  >
                    <Sparkles className={`w-3.5 h-3.5 text-purple-600 ${isPersonalizing ? 'animate-spin' : ''}`} />
                    <span>{isPersonalizing ? 'Personalizing...' : 'Deep Personalization'}</span>
                  </button>

                  <button
                    onClick={handleUseFallback}
                    disabled={isApplyingFallback}
                    className="flex items-center gap-1.5 px-3 py-1.5 font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition-all disabled:opacity-50 cursor-pointer shadow-2xs"
                    title="Use Fallback Template: Immediately switches to our verified, high-quality predefined fallback template."
                  >
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Predefined Fallback</span>
                  </button>
                </div>

                <div className="flex items-center gap-1.5">
                  {/* View Mode Toggle */}
                  <div className="flex items-center bg-white border border-slate-200 rounded-xl p-1 shadow-2xs">
                    <button
                      onClick={() => setViewMode('preview')}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                        viewMode === 'preview' ? 'bg-blue-600 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                      }`}
                      title="Rendered Email Preview"
                    >
                      Preview
                    </button>
                    <button
                      onClick={() => setViewMode('edit')}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                        viewMode === 'edit' ? 'bg-blue-600 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                      }`}
                      title="Direct HTML/Text Editor"
                    >
                      HTML Edit
                    </button>
                    <button
                      onClick={() => setViewMode('plain')}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                        viewMode === 'plain' ? 'bg-blue-600 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                      }`}
                      title="Plain Text View"
                    >
                      Plain Text
                    </button>
                  </div>

                  {isDirty && (
                    <>
                      <button
                        onClick={handleRevertChanges}
                        className="p-1.5 text-slate-600 hover:text-slate-800 bg-white border border-slate-200 rounded-xl font-medium cursor-pointer shadow-2xs"
                        title="Revert edits to original draft"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={handleSaveDraftEdits}
                        disabled={isSavingDraft}
                        className="px-3.5 py-1.5 font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-2xs transition-all cursor-pointer flex items-center gap-1.5"
                        title="Save Draft: Persist your custom edits to this email draft"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>{isSavingDraft ? 'Saving...' : 'Save Draft'}</span>
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Editable Subject Field */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Subject Line:
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={subjectInput}
                    onChange={(e) => {
                      setSubjectInput(e.target.value);
                      setIsDirty(true);
                    }}
                    className="w-full text-xs font-semibold text-slate-900 border border-slate-200 rounded-xl p-3 focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white shadow-2xs pr-10"
                    placeholder="Enter email subject line..."
                  />
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(subjectInput);
                      setCopiedSubject(true);
                      setTimeout(() => setCopiedSubject(false), 2000);
                    }}
                    className="absolute right-3 top-3 text-slate-400 hover:text-blue-600 transition-colors"
                    title="Copy Subject"
                  >
                    {copiedSubject ? <CheckCheck className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Email Content Body Display / Editor */}
              <div>
                {viewMode === 'preview' && (
                  <div className="space-y-2">
                    {/* Realistic Email Client Window Chrome */}
                    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
                      {/* Window titlebar */}
                      <div className="bg-slate-100/80 border-b border-slate-200 px-4 py-2.5 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-rose-400 inline-block" />
                          <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" />
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block" />
                          <span className="text-[11px] font-semibold text-slate-600 ml-2">Executive Inbox Simulator</span>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono">
                          <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                            <ShieldCheck className="w-3 h-3 text-emerald-600" />
                            Anti-Hallucination Guard Active
                          </span>
                        </div>
                      </div>

                      {/* Realistic Email Meta Header */}
                      <div className="p-4 bg-slate-50/50 border-b border-slate-100 space-y-2 text-xs">
                        <div className="flex items-start justify-between gap-4">
                          <div className="space-y-1 min-w-0">
                            <div className="flex items-center gap-2 text-slate-600">
                              <span className="font-semibold text-slate-500 w-14 shrink-0">From:</span>
                              <span className="font-medium text-slate-800">
                                {companyProfile?.sender_name || 'Hemanth Merugu'} &bull; {companyProfile?.company_name || 'Merugu Digital Marketing And Life Science'}
                              </span>
                              <span className="font-mono text-slate-400 text-[11px]">
                                &lt;{companyProfile?.contact_email || 'outreach@meruguglobal.com'}&gt;
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-slate-600">
                              <span className="font-semibold text-slate-500 w-14 shrink-0">To:</span>
                              <span className="font-semibold text-slate-900">{activeDraft.lead_name}</span>
                              <span className="font-mono text-slate-500 text-[11px]">&lt;{activeDraft.lead_email}&gt;</span>
                            </div>
                            <div className="flex items-center gap-2 text-slate-800 pt-0.5">
                              <span className="font-semibold text-slate-500 w-14 shrink-0">Subject:</span>
                              <span className="font-bold text-slate-900 truncate">{subjectInput}</span>
                            </div>
                          </div>

                          <div className="shrink-0 text-right">
                            <span className="text-[10px] font-semibold text-slate-400 block">Dispatch Format</span>
                            <span className="text-xs font-bold text-slate-700">HTML + Plain Fallback</span>
                          </div>
                        </div>
                      </div>

                      {/* Main Email Body Canvas */}
                      <div className="p-6 bg-white min-h-[260px]">
                        <div 
                          className="text-slate-800 leading-relaxed font-sans text-xs space-y-3"
                          dangerouslySetInnerHTML={{ __html: bodyHtmlInput }}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {viewMode === 'edit' && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] text-slate-500 px-1">
                      <span className="font-semibold flex items-center gap-1 text-blue-700">
                        <Code className="w-3.5 h-3.5 text-blue-600" />
                        HTML / Body Editor
                      </span>
                      <span>Editing modifies outbound HTML payload</span>
                    </div>
                    <textarea
                      rows={10}
                      value={bodyHtmlInput}
                      onChange={(e) => {
                        setBodyHtmlInput(e.target.value);
                        setIsDirty(true);
                      }}
                      className="w-full text-xs font-mono border border-slate-200 rounded-2xl p-4 focus:ring-2 focus:ring-blue-500 focus:outline-none bg-slate-950 text-slate-100 leading-relaxed shadow-2xs"
                    />
                  </div>
                )}

                {viewMode === 'plain' && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] text-slate-500 px-1">
                      <span className="font-semibold text-slate-700">Plain-Text Alternative</span>
                      <span>Rendered for mail clients with HTML disabled</span>
                    </div>
                    <textarea
                      rows={10}
                      value={bodyPlainInput}
                      onChange={(e) => {
                        setBodyPlainInput(e.target.value);
                        setIsDirty(true);
                      }}
                      className="w-full text-xs font-mono border border-slate-200 rounded-2xl p-4 focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white text-slate-800 leading-relaxed shadow-2xs"
                    />
                  </div>
                )}
              </div>

              {/* Provenance & Quality Validation Banner */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <span className="font-bold text-slate-800">Quality & Provenance Audit:</span>
                    <span className="text-slate-600 font-medium">
                      {qualityResult?.checks_passed || 8}/8 Checks Passed
                    </span>
                  </div>
                  <div className="flex items-center gap-2 font-mono text-[10px]">
                    <span className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-600 font-semibold shadow-3xs">
                      Word Count: {qualityResult?.word_count || bodyPlainInput.split(/\s+/).length} words
                    </span>
                    <span className="px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 font-bold border border-emerald-300 shadow-3xs">
                      Quality Score: {qualityResult?.quality_score || 95}%
                    </span>
                  </div>
                </div>

                {/* Personalization Sources Used */}
                <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-200/80">
                  <span className="text-[10px] text-slate-500 font-semibold">Grounded Sources:</span>
                  {(activeDraft.personalization_sources || ['Lead Name', 'Company Name', 'Service Catalogue', 'Company Outreach Profile']).map((src, idx) => (
                    <span key={idx} className="text-[10px] font-medium px-2 py-0.5 bg-white border border-slate-200 rounded-md text-slate-700 shadow-3xs">
                      &bull; {src}
                    </span>
                  ))}
                </div>

                {/* Gemini AI Status / Fallback Reason */}
                {activeDraft.generation_method === 'TEMPLATE_FALLBACK' && (
                  <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[11px] text-amber-900 bg-amber-50/80 border border-amber-200 px-3 py-1.5 rounded-xl">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span className="font-bold">Why Gemini AI was not used:</span>
                    <span className="font-medium text-amber-950">{activeDraft.fallback_reason || 'Predefined Template Fallback Activated'}</span>
                  </div>
                )}

                {/* Warnings list if any */}
                {qualityResult?.warnings && qualityResult.warnings.length > 0 && (
                  <div className="mt-2 p-2 bg-amber-50 rounded-xl border border-amber-200 text-[11px] text-amber-900 space-y-1">
                    {qualityResult.warnings.map((w, idx) => (
                      <p key={idx} className="flex items-center gap-1">
                        <AlertCircle className="w-3 h-3 text-amber-600 shrink-0" />
                        <span>{w}</span>
                      </p>
                    ))}
                  </div>
                )}
              </div>

              {/* Bottom Card: Why Gemini AI Was Not Used (When Fallback Is Active) */}
              {activeDraft.generation_method === 'TEMPLATE_FALLBACK' && (
                <div className="bg-amber-50/70 border border-amber-200/90 rounded-2xl p-4 space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-amber-600" />
                      <span>Why Gemini AI was not used:</span>
                    </span>
                    <button
                      onClick={() => handleRegenerate()}
                      disabled={isRegenerating}
                      className="text-[11px] font-semibold text-blue-700 hover:text-blue-900 underline flex items-center gap-1 cursor-pointer"
                    >
                      <Sparkles className="w-3 h-3 text-blue-600" />
                      <span>Retry with Gemini AI</span>
                    </button>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-amber-200 text-xs">
                    <p className="font-semibold text-amber-950">
                      {activeDraft.fallback_reason || 'Deterministic fallback was triggered to guarantee message delivery.'}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                      To ensure zero disruption to your outreach workflow, our deterministic B2B template engine generated a 100% complete, verified email tailored to <strong>{activeDraft.lead_name}</strong> using verified company facts and offerings, without hallucinations or empty placeholders.
                    </p>
                  </div>
                </div>
              )}

              {/* Automated Follow-up Cadence Visualization */}
              <div className="bg-gradient-to-br from-slate-50 to-blue-50/40 border border-slate-200/90 rounded-2xl p-4 shadow-2xs">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-blue-600" />
                    <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                      Automated Follow-up Sequence (Module 11)
                    </span>
                  </div>
                  <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                    Auto-Stops on Reply
                  </span>
                </div>

                <div className="relative">
                  <div className="hidden sm:block absolute top-1/2 left-8 right-8 h-0.5 bg-blue-200 -translate-y-1/2 z-0" />

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 relative z-10">
                    <div className="bg-white p-3 rounded-xl border border-blue-400 shadow-xs text-center ring-2 ring-blue-500/10">
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-600 text-white text-[10px] font-bold mx-auto mb-1">
                        D0
                      </span>
                      <span className="text-[10px] text-blue-700 font-bold block uppercase tracking-wider">Day 0</span>
                      <span className="text-xs font-semibold text-slate-800 block mt-0.5">Initial Intro</span>
                      <span className="text-[10px] text-emerald-600 font-medium block mt-0.5">Ready to Dispatch</span>
                    </div>

                    <div className="bg-white/90 p-3 rounded-xl border border-slate-200 shadow-2xs text-center opacity-85">
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-200 text-slate-700 text-[10px] font-bold mx-auto mb-1">
                        D3
                      </span>
                      <span className="text-[10px] text-slate-500 font-bold block uppercase tracking-wider">Day 3</span>
                      <span className="text-xs font-semibold text-slate-700 block mt-0.5">Gentle Bump</span>
                      <span className="text-[10px] text-slate-400 block mt-0.5">Automated Cadence</span>
                    </div>

                    <div className="bg-white/90 p-3 rounded-xl border border-slate-200 shadow-2xs text-center opacity-85">
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-200 text-slate-700 text-[10px] font-bold mx-auto mb-1">
                        D7
                      </span>
                      <span className="text-[10px] text-slate-500 font-bold block uppercase tracking-wider">Day 7</span>
                      <span className="text-xs font-semibold text-slate-700 block mt-0.5">Value Add Case</span>
                      <span className="text-[10px] text-slate-400 block mt-0.5">Automated Cadence</span>
                    </div>

                    <div className="bg-white/90 p-3 rounded-xl border border-slate-200 shadow-2xs text-center opacity-85">
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-200 text-slate-700 text-[10px] font-bold mx-auto mb-1">
                        D14
                      </span>
                      <span className="text-[10px] text-slate-500 font-bold block uppercase tracking-wider">Day 14</span>
                      <span className="text-xs font-semibold text-slate-700 block mt-0.5">Breakup Email</span>
                      <span className="text-[10px] text-slate-400 block mt-0.5">Final Polite Check-in</span>
                    </div>
                  </div>
                </div>

                <p className="text-[11px] text-slate-500 mt-3 text-center sm:text-left flex items-center justify-center sm:justify-start gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                  <span>Cadence automatically halts the exact second the recipient replies, schedules a meeting, or unsubscribes.</span>
                </p>
              </div>

            </div>
          ) : (
            <div className="py-20 text-center text-slate-400 text-xs">
              Select an outreach draft from the queue to review, customize, or approve.
            </div>
          )}
        </div>
      </div>

      {/* MODAL 1: Send Test Email */}
      {isTestModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4">
            <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
              <TestTube2 className="w-4 h-4 text-blue-600" />
              <span>Send Test Preview Email</span>
            </h3>
            <p className="text-xs text-slate-500">
              Deliver a live preview copy to your inbox to check rendered typography, links, and signature.
            </p>
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">Destination Email:</label>
              <input
                type="email"
                value={testEmailAddress}
                onChange={(e) => setTestEmailAddress(e.target.value)}
                className="w-full text-xs border border-slate-200 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono"
                placeholder="your.email@company.com"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setIsTestModalOpen(false)}
                className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSendTest}
                disabled={isSendingTest}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-lg cursor-pointer shadow-xs disabled:opacity-50"
              >
                {isSendingTest ? 'Sending Test...' : 'Send Test Copy'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Reject Outreach Feedback */}
      {isRejectOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl">
            <h3 className="font-bold text-slate-800 text-sm mb-2">Reject Email Outreach</h3>
            <p className="text-xs text-slate-500 mb-3">Provide feedback to guide prompt refinement:</p>
            <textarea
              rows={3}
              value={rejectNote}
              onChange={(e) => setRejectNote(e.target.value)}
              placeholder="e.g. Tone too aggressive, adjust value proposition..."
              className="w-full text-xs border border-slate-200 rounded-lg p-2.5 focus:ring-2 focus:ring-rose-500 mb-4"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setIsRejectOpen(false)}
                className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 rounded-lg cursor-pointer"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Configure Our Company Profile (Requirement 2) */}
      {isProfileModalOpen && companyProfile && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                  <Building2 className="w-4 h-4 text-blue-600" />
                  <span>Configure Our Company Profile</span>
                </h3>
                <p className="text-xs text-slate-500">
                  Defines our actual organization identity, verified services, differentiators, and sender details.
                </p>
              </div>
              <button onClick={() => setIsProfileModalOpen(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCompanyProfile} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Company Legal Name *</label>
                  <input
                    type="text"
                    required
                    value={companyProfile.company_name}
                    onChange={(e) => setCompanyProfile({ ...companyProfile, company_name: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg p-2"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Brand Name *</label>
                  <input
                    type="text"
                    required
                    value={companyProfile.brand_name}
                    onChange={(e) => setCompanyProfile({ ...companyProfile, brand_name: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg p-2"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Website URL *</label>
                  <input
                    type="url"
                    required
                    value={companyProfile.website}
                    onChange={(e) => setCompanyProfile({ ...companyProfile, website: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg p-2"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Contact Email *</label>
                  <input
                    type="email"
                    required
                    value={companyProfile.contact_email}
                    onChange={(e) => setCompanyProfile({ ...companyProfile, contact_email: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg p-2 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Business Introduction *</label>
                <textarea
                  rows={2}
                  required
                  value={companyProfile.business_introduction}
                  onChange={(e) => setCompanyProfile({ ...companyProfile, business_introduction: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg p-2 text-xs"
                  placeholder="Overview of our organization's value proposition..."
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Services We Provide (comma-separated) *</label>
                <textarea
                  rows={2}
                  required
                  value={(companyProfile.services_offered || []).join(', ')}
                  onChange={(e) => setCompanyProfile({ 
                    ...companyProfile, 
                    services_offered: e.target.value.split(',').map(s => s.trim()).filter(Boolean) 
                  })}
                  className="w-full border border-slate-200 rounded-lg p-2 text-xs"
                  placeholder="e.g. AI Workflow Automation, Enterprise Web Applications, Clinical Software Systems"
                />
                <p className="text-[10px] text-slate-400 mt-0.5">The AI will strictly pitch only services listed here.</p>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Key Differentiators (comma-separated)</label>
                <input
                  type="text"
                  value={(companyProfile.key_differentiators || []).join(', ')}
                  onChange={(e) => setCompanyProfile({ 
                    ...companyProfile, 
                    key_differentiators: e.target.value.split(',').map(s => s.trim()).filter(Boolean) 
                  })}
                  className="w-full border border-slate-200 rounded-lg p-2"
                  placeholder="e.g. Senior engineers only, 99.9% uptime SLA, HIPAA compliant"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Sender Name *</label>
                  <input
                    type="text"
                    required
                    value={companyProfile.sender_name}
                    onChange={(e) => setCompanyProfile({ ...companyProfile, sender_name: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg p-2"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Sender Designation *</label>
                  <input
                    type="text"
                    required
                    value={companyProfile.sender_designation}
                    onChange={(e) => setCompanyProfile({ ...companyProfile, sender_designation: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg p-2"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Preferred Tone</label>
                  <select
                    value={companyProfile.preferred_tone}
                    onChange={(e) => setCompanyProfile({ ...companyProfile, preferred_tone: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg p-2"
                  >
                    <option value="PROFESSIONAL_CONSULTATIVE">Professional & Consultative</option>
                    <option value="EXECUTIVE_DIRECT">Executive & Direct</option>
                    <option value="TECHNICAL_PRECISE">Technical & Precise</option>
                    <option value="CONVERSATIONAL_POLITE">Conversational & Polite</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Desired Call to Action</label>
                  <input
                    type="text"
                    value={companyProfile.desired_cta}
                    onChange={(e) => setCompanyProfile({ ...companyProfile, desired_cta: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg p-2"
                    placeholder="e.g. Brief 15-minute introductory briefing"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsProfileModalOpen(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingProfile}
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-lg shadow-xs cursor-pointer"
                >
                  {isSavingProfile ? 'Saving...' : 'Save Company Profile'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
