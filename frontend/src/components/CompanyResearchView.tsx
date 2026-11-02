import React, { useState, useEffect } from 'react';
import { 
  Building2, Globe, CheckCircle2, ShieldCheck, AlertCircle, 
  ExternalLink, Layers, Search, Cpu, Target, Flag, Bug, Loader2, Trash2,
  RefreshCw, Sparkles, ShieldAlert, Award, FileText, Check, HelpCircle,
  XCircle, ChevronRight, Sliders, ArrowUpRight, Clock, Users, DollarSign,
  Briefcase, Compass, FileCheck, ThumbsUp, ThumbsDown, Mail, Brain, Zap,
  Play, Square, ArrowRight, Inbox, Filter
} from 'lucide-react';
import { Lead, ResearchReport, ICPConfig, ResearchJob } from '../types';
import { api } from '../services/api';

interface CompanyResearchViewProps {
  leads: Lead[];
  onTriggerResearch: (leadId: string) => Promise<void>;
  onDeleteLead?: (leadId: string) => Promise<void>;
  onDeleteAll?: () => Promise<void>;
  onRefresh?: () => Promise<void>;
  showToast?: (msg: string) => void;
  onNavigate?: (tab: string) => void;
}

type DetailTab = 
  | 'overview' 
  | 'website' 
  | 'products_services' 
  | 'market' 
  | 'technology' 
  | 'signals' 
  | 'evidence' 
  | 'opportunities' 
  | 'scoring' 
  | 'history_icp';

export const CompanyResearchView: React.FC<CompanyResearchViewProps> = ({
  leads,
  onTriggerResearch,
  onDeleteLead,
  onDeleteAll,
  onRefresh,
  showToast,
  onNavigate,
}) => {
  const [selectedLeadId, setSelectedLeadId] = useState<string>(leads[0]?.id || '');
  const [activeTab, setActiveTab] = useState<DetailTab>('overview');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [isInvestigating, setIsInvestigating] = useState(false);
  const [isAiInvestigating, setIsAiInvestigating] = useState(false);
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [isReviewing, setIsReviewing] = useState(false);
  const [mobileView, setMobileView] = useState<'list' | 'detail'>('list');

  // User-controlled Automated Pipeline status (Stopped by default)
  const [isPipelineRunning, setIsPipelineRunning] = useState<boolean>(false);
  const [isTogglingPipeline, setIsTogglingPipeline] = useState<boolean>(false);

  // ICP Config Modal State
  const [isICPModalOpen, setIsICPModalOpen] = useState(false);
  const [icpConfig, setIcpConfig] = useState<ICPConfig | null>(null);

  // Load ICP Config & Pipeline Status
  useEffect(() => {
    api.getActiveICPConfig()
      .then(setIcpConfig)
      .catch(() => null);

    api.getPipelineStatus()
      .then(res => setIsPipelineRunning(res.is_running))
      .catch(() => null);
  }, []);

  // Strictly filter to only leads whose verification is confirmed (green badge)
  const verifiedLeads = leads.filter(l => l.is_company_verified);

  // Sync selected lead when list changes
  useEffect(() => {
    if ((!selectedLeadId || !verifiedLeads.some(l => l.id === selectedLeadId)) && verifiedLeads.length > 0) {
      setSelectedLeadId(verifiedLeads[0].id);
    }
  }, [verifiedLeads, selectedLeadId]);

  // Count verified leads pending automated crawling & outreach drafting
  const verifiedPendingOutreach = verifiedLeads.filter(
    l => l.lead_status !== 'AWAITING_APPROVAL' && !l.is_email_generated
  ).length;

  const handleTogglePipeline = async () => {
    setIsTogglingPipeline(true);
    try {
      if (isPipelineRunning) {
        const res = await api.stopPipeline();
        setIsPipelineRunning(false);
        if (showToast) showToast(res?.message || 'Automated pipeline stopped.');
      } else {
        const res = await api.startPipeline();
        setIsPipelineRunning(true);
        if (showToast) showToast(res?.message || 'Automated pipeline started.');
      }
      if (onRefresh) await onRefresh();
    } catch (e: any) {
      alert('Pipeline control error: ' + (e?.message || 'Failed to toggle pipeline'));
    } finally {
      setIsTogglingPipeline(false);
    }
  };

  // Periodically refresh data ONLY while the automated pipeline is explicitly running and has pending items
  useEffect(() => {
    if (!isPipelineRunning || verifiedPendingOutreach === 0 || !onRefresh) return;
    const interval = setInterval(() => {
      onRefresh();
    }, 4000);
    return () => clearInterval(interval);
  }, [isPipelineRunning, verifiedPendingOutreach, onRefresh]);

  const activeLead = verifiedLeads.find(l => l.id === selectedLeadId);
  const report: ResearchReport | undefined = activeLead?.research_report;

  // Filtered Leads Directory (strictly across verified leads only)
  const filteredLeads = verifiedLeads.filter((lead) => {
    const q = searchTerm.toLowerCase();
    const matchesSearch = 
      lead.company_name.toLowerCase().includes(q) ||
      (lead.website_url || '').toLowerCase().includes(q) ||
      (lead.industry || '').toLowerCase().includes(q) ||
      (lead.extracted_domain || '').toLowerCase().includes(q);

    if (!matchesSearch) return false;

    if (statusFilter === 'ALL') return true;
    if (statusFilter === 'RESEARCHED') return !!lead.research_report;
    if (statusFilter === 'PENDING') return !lead.research_report;
    if (statusFilter === 'HOT') return (lead.research_report?.company_fit_score || 0) >= 75;
    if (statusFilter === 'WARM') return (lead.research_report?.company_fit_score || 0) >= 50 && (lead.research_report?.company_fit_score || 0) < 75;
    if (statusFilter === 'INSUFFICIENT') return lead.research_report?.qualification_status === 'INSUFFICIENT_EVIDENCE';
    return true;
  });

  // KPI Calculations across verified companies
  const totalInvestigated = verifiedLeads.filter(l => l.research_report).length;
  const completedResearch = verifiedLeads.filter(l => l.research_report && l.research_report.qualification_status !== 'INSUFFICIENT_EVIDENCE').length;
  const highPriorityProspects = verifiedLeads.filter(l => (l.research_report?.company_fit_score || 0) >= 75).length;
  const warmProspects = verifiedLeads.filter(l => (l.research_report?.company_fit_score || 0) >= 50 && (l.research_report?.company_fit_score || 0) < 75).length;
  const insufficientEvidence = verifiedLeads.filter(l => l.research_report?.qualification_status === 'INSUFFICIENT_EVIDENCE').length;

  // Action Handlers
  const handleInvestigate = async (leadId: string, forceRefresh = false) => {
    setIsInvestigating(true);
    try {
      const res = await api.investigateCompany(leadId, forceRefresh);
      if (showToast) {
        showToast(res?.message || 'Investigation completed successfully.');
      }
      if (onRefresh) await onRefresh();
    } catch (err: any) {
      alert('Investigation error: ' + (err?.message || 'Failed to crawl website'));
    } finally {
      setIsInvestigating(false);
    }
  };

  const handleAiInvestigate = async (leadId: string) => {
    setIsAiInvestigating(true);
    try {
      const res = await api.aiInvestigateCompany(leadId);
      if (showToast) {
        showToast(res?.message || 'AI Deep Strategic Investigation completed.');
      }
      if (onRefresh) await onRefresh();
    } catch (err: any) {
      alert('AI Investigation error: ' + (err?.message || 'Failed to complete AI analysis'));
    } finally {
      setIsAiInvestigating(false);
    }
  };

  const handleRecalculateScore = async (leadId: string) => {
    setIsRecalculating(true);
    try {
      const res = await api.recalculateLeadScore(leadId);
      if (showToast) {
        showToast(`Score recalculated: ${res?.fit_score}/100 Fit, ${res?.confidence_score}% Confidence (${res?.qualification_status}).`);
      }
      if (onRefresh) await onRefresh();
    } catch (err: any) {
      alert('Recalculation error: ' + (err?.message || 'Failed to recalculate score'));
    } finally {
      setIsRecalculating(false);
    }
  };

  const handleApproveReport = async (leadId: string) => {
    setIsReviewing(true);
    try {
      const res = await api.approveResearchReport(leadId);
      if (showToast) {
        showToast(res?.message || 'Company report approved! Personalized email draft generated and sent to Email Outreach queue.');
      }
      if (onRefresh) await onRefresh();
    } catch (err: any) {
      alert('Error approving report: ' + (err?.message || 'Could not approve report'));
    } finally {
      setIsReviewing(false);
    }
  };

  const handleRejectReport = async (leadId: string) => {
    if (!window.confirm('Are you sure you want to disqualify this lead based on research findings?')) return;
    setIsReviewing(true);
    try {
      await api.rejectResearchReport(leadId);
      if (showToast) showToast('Lead marked as Disqualified.');
      if (onRefresh) await onRefresh();
    } finally {
      setIsReviewing(false);
    }
  };

  const getScoreBadge = (score: number) => {
    if (score >= 75) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
          <Award className="w-3.5 h-3.5 text-emerald-600" />
          {score}/100 Hot Fit
        </span>
      );
    }
    if (score >= 50) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
          {score}/100 Warm Fit
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
        {score}/100 Low Fit
      </span>
    );
  };

  const getConfidenceBadge = (conf: number) => {
    if (conf >= 75) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
          <ShieldCheck className="w-3 h-3 text-blue-600" />
          {conf}% Conf
        </span>
      );
    }
    if (conf >= 45) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
          <HelpCircle className="w-3 h-3 text-amber-600" />
          {conf}% Conf
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
        <XCircle className="w-3 h-3 text-rose-600" />
        {conf}% Low Conf
      </span>
    );
  };

  return (
    <div className="space-y-5">
      
      {/* Top Command Banner: Modern B2B Corporate Intelligence Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 p-5 text-white shadow-lg border border-slate-700/60">
        <div className="absolute -top-12 -right-12 w-48 h-48 bg-blue-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-10 -left-10 w-48 h-48 bg-cyan-500/15 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-cyan-500/20 text-cyan-400 border border-cyan-400/30 flex items-center justify-center shrink-0">
                <Compass className="w-4 h-4" />
              </div>
              <h2 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
                <span>Company Intelligence & ICP Qualification Engine</span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Verified Corporate Domains Only
                </span>
              </h2>
            </div>
            <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
              Autonomous website crawling, multi-source firmographics synthesis, and explainable 100-point Ideal Customer Profile (ICP) scoring.
            </p>
          </div>

          {/* Quick Metrics & Pipeline Control */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="bg-white/10 backdrop-blur-sm px-3 py-1.5 rounded-xl border border-white/10 flex items-center gap-2 text-xs">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-slate-300">Verified:</span>
              <span className="font-bold text-white">{verifiedLeads.length}</span>
            </div>
            <div className="bg-white/10 backdrop-blur-sm px-3 py-1.5 rounded-xl border border-white/10 flex items-center gap-2 text-xs">
              <Sparkles className="w-3.5 h-3.5 text-blue-400" />
              <span className="text-slate-300">Researched:</span>
              <span className="font-bold text-blue-300">{completedResearch}</span>
            </div>
            <div className="bg-white/10 backdrop-blur-sm px-3 py-1.5 rounded-xl border border-white/10 flex items-center gap-2 text-xs">
              <Award className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-slate-300">Hot Fit:</span>
              <span className="font-bold text-amber-300">{highPriorityProspects}</span>
            </div>

            <button
              onClick={() => setIsICPModalOpen(true)}
              className="px-3.5 py-1.5 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-xl text-xs flex items-center gap-1.5 border border-white/15 transition-all cursor-pointer backdrop-blur-sm"
              title="Configure ICP Weights & Criteria: Customize our company's target customer profile, offered services, and lead scoring weights."
            >
              <Sliders className="w-3.5 h-3.5 text-slate-300" />
              <span>ICP Model</span>
            </button>

            {leads.length > 0 && onDeleteAll && (
              <button
                onClick={onDeleteAll}
                className="px-3 py-1.5 text-xs font-semibold text-rose-300 bg-rose-950/60 hover:bg-rose-900/80 border border-rose-800/60 rounded-xl transition-colors cursor-pointer flex items-center gap-1"
                title="Delete All Leads: Permanently clears all imported prospects, crawled intelligence, and generated reports from the CRM."
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete All</span>
              </button>
            )}
          </div>
        </div>
      </div>
      
      {/* SECTION 1: Summary Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 border-t-2 border-t-slate-400 shadow-xs">
          <span className="text-[11px] text-slate-500 font-medium block">Total Investigated</span>
          <div className="flex items-baseline justify-between mt-1.5">
            <span className="text-xl font-bold text-slate-800">{totalInvestigated}</span>
            <span className="text-[10px] text-slate-400">of {verifiedLeads.length} verified</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 border-t-2 border-t-emerald-500 shadow-xs">
          <span className="text-[11px] text-emerald-700 font-medium block">Completed Research</span>
          <div className="flex items-baseline justify-between mt-1.5">
            <span className="text-xl font-bold text-emerald-700">{completedResearch}</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 border-t-2 border-t-blue-600 shadow-xs">
          <span className="text-[11px] text-blue-700 font-medium block">High-Priority (Hot)</span>
          <div className="flex items-baseline justify-between mt-1.5">
            <span className="text-xl font-bold text-blue-700">{highPriorityProspects}</span>
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700">&ge; 75 fit</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 border-t-2 border-t-amber-500 shadow-xs">
          <span className="text-[11px] text-amber-700 font-medium block">Moderate Fit (Warm)</span>
          <div className="flex items-baseline justify-between mt-1.5">
            <span className="text-xl font-bold text-amber-700">{warmProspects}</span>
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-50 text-amber-700">50-74 fit</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 border-t-2 border-t-rose-500 shadow-xs">
          <span className="text-[11px] text-rose-700 font-medium block">Insufficient Evidence</span>
          <div className="flex items-baseline justify-between mt-1.5">
            <span className="text-xl font-bold text-rose-700">{insufficientEvidence}</span>
            <AlertCircle className="w-4 h-4 text-rose-500" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 border-t-2 border-t-indigo-500 shadow-xs">
          <span className="text-[11px] text-slate-500 font-medium block">Active ICP Model</span>
          <div className="flex items-center justify-between mt-1.5">
            <span className="text-xs font-bold text-slate-700 truncate">{icpConfig?.name || 'Default ICP'}</span>
            <button
              onClick={() => setIsICPModalOpen(true)}
              className="text-blue-600 hover:text-blue-700 p-1 rounded-lg hover:bg-blue-50 transition-colors cursor-pointer"
              title="Configure ICP: View and adjust target industries, company sizes, services, and 100-point scoring weights."
            >
              <Sliders className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* SECTION: User-Managed Automated Pipeline Control */}
      <div className={`px-4 py-3.5 rounded-2xl border flex flex-wrap items-center justify-between gap-3 text-xs shadow-2xs transition-all ${
        isPipelineRunning 
          ? 'bg-gradient-to-r from-emerald-50 via-teal-50 to-blue-50 border-emerald-300 text-emerald-950' 
          : 'bg-slate-50 border-slate-200 text-slate-700'
      }`}>
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-xs ${
            isPipelineRunning ? 'bg-emerald-600 text-white animate-pulse' : 'bg-slate-200 text-slate-600'
          }`}>
            {isPipelineRunning ? <Zap className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </div>
          <div>
            <div className="flex items-center gap-2 font-bold text-slate-800">
              <span>Automated Research & Outreach Pipeline:</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase ${
                isPipelineRunning 
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' 
                  : 'bg-slate-200 text-slate-700 border border-slate-300'
              }`}>
                {isPipelineRunning ? 'Actively Running' : 'Manual Standby'}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {isPipelineRunning 
                ? `Actively crawling websites and preparing outreach drafts (${verifiedPendingOutreach} pending in queue).` 
                : verifiedPendingOutreach > 0
                  ? `${verifiedPendingOutreach} verified lead(s) waiting. Click "Start Pipeline" to process automatically, or inspect manually.`
                  : 'All verified leads are up to date. Start pipeline anytime to auto-process newly imported verified leads.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleTogglePipeline}
            disabled={isTogglingPipeline}
            title={
              isPipelineRunning
                ? "Stop Pipeline: Immediately pause/halt automated website crawling and email drafting for pending verified leads."
                : "Start Pipeline: Start background website crawler and outreach drafter for all verified companies."
            }
            className={`px-4 py-2 font-bold rounded-xl shadow-xs flex items-center gap-2 transition-all disabled:opacity-50 cursor-pointer ${
              isPipelineRunning
                ? 'bg-rose-600 hover:bg-rose-700 text-white'
                : 'bg-emerald-600 hover:bg-emerald-700 text-white'
            }`}
          >
            {isTogglingPipeline ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Updating...</span>
              </>
            ) : isPipelineRunning ? (
              <>
                <Square className="w-3.5 h-3.5 fill-current" />
                <span>Stop Pipeline</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Start Pipeline</span>
              </>
            )}
          </button>

          {onNavigate && (
            <button
              onClick={() => onNavigate('approvals')}
              className="px-3.5 py-2 bg-white hover:bg-slate-50 text-blue-700 border border-slate-300 font-semibold rounded-xl shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
              title="View Outreach Queue: Jump to the Email Outreach tab to review, edit, or approve personalized emails waiting for human dispatch."
            >
              <span>View Outreach Queue &rarr;</span>
            </button>
          )}
        </div>
      </div>

      {/* Mobile / Tablet Segmented View Switcher */}
      <div className="lg:hidden flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200">
        <button
          onClick={() => setMobileView('list')}
          className={`flex-1 py-2 text-xs font-bold rounded-lg text-center transition-all cursor-pointer ${
            mobileView === 'list'
              ? 'bg-white text-blue-700 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Prospects ({filteredLeads.length})
        </button>
        <button
          onClick={() => setMobileView('detail')}
          className={`flex-1 py-2 text-xs font-bold rounded-lg text-center transition-all cursor-pointer ${
            mobileView === 'detail'
              ? 'bg-white text-blue-700 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Company Dossier {activeLead ? `(${activeLead.company_name.slice(0, 12)}...)` : ''}
        </button>
      </div>

      {/* SECTION 3: Main Split Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        
        {/* Left Side: Companies Directory */}
        <div className={`lg:col-span-4 bg-white rounded-xl border border-slate-200 p-3 shadow-xs space-y-2 ${
          mobileView === 'list' ? 'block' : 'hidden lg:block'
        }`}>
          <div className="flex items-center justify-between border-b border-slate-100 pb-2 px-1">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Prospects ({filteredLeads.length})
            </span>
            <span className="text-[10px] text-slate-400">Click to inspect</span>
          </div>

          <div className="space-y-1.5 max-h-[720px] overflow-y-auto pr-1">
            {filteredLeads.length > 0 ? (
              filteredLeads.map((lead) => {
                const isSelected = lead.id === selectedLeadId;
                const r = lead.research_report;
                const fitScore = r?.company_fit_score || 0;
                const confScore = r?.research_confidence_score || 0;

                return (
                  <div
                    key={lead.id}
                    onClick={() => {
                      setSelectedLeadId(lead.id);
                      setMobileView('detail');
                    }}
                    className={`p-3 rounded-xl border text-xs transition-all cursor-pointer group ${
                      isSelected 
                        ? 'border-blue-600 bg-blue-50/60 shadow-xs' 
                        : 'border-slate-100 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <div className="min-w-0">
                        <div className="font-bold text-slate-800 truncate text-xs">
                          {lead.company_name}
                        </div>
                        <div className="text-[11px] text-slate-400 truncate flex items-center gap-1 mt-0.5">
                          <Globe className="w-3 h-3 shrink-0" />
                          <span>{lead.website_url || lead.extracted_domain || 'No website'}</span>
                        </div>
                      </div>

                      {/* Score or Pending badge */}
                      {r ? (
                        <div className="text-right shrink-0">
                          <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded ${
                            fitScore >= 75 ? 'bg-emerald-100 text-emerald-800' :
                            fitScore >= 50 ? 'bg-amber-100 text-amber-800' :
                            'bg-slate-100 text-slate-700'
                          }`}>
                            {fitScore}/100
                          </span>
                        </div>
                      ) : (
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 shrink-0">
                          Pending
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-slate-100/80 text-[10px] text-slate-500">
                      <span className="truncate max-w-[120px]">{lead.industry || 'General Industry'}</span>
                      {r ? (
                        <span className="text-blue-600 font-medium">{confScore}% Conf</span>
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedLeadId(lead.id);
                            handleInvestigate(lead.id);
                          }}
                          className="text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1"
                        >
                          <Sparkles className="w-3 h-3" />
                          <span>Investigate</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-10 px-4 text-slate-400 text-xs space-y-1">
                <ShieldCheck className="w-6 h-6 text-slate-300 mx-auto mb-2" />
                <p className="font-semibold text-slate-600">No verified companies found</p>
                <p className="text-[11px] text-slate-400">
                  Only leads with confirmed corporate domain verification (green badge) appear in Company Intelligence.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Deep Company Intelligence Dossier */}
        <div className={`lg:col-span-8 space-y-4 ${
          mobileView === 'detail' ? 'block' : 'hidden lg:block'
        }`}>
          {activeLead ? (
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
              
              {/* Header Profile Bar */}
              <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50/70">
                <button
                  onClick={() => setMobileView('list')}
                  className="lg:hidden inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 hover:text-blue-900 mb-3 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg border border-blue-200 transition-colors cursor-pointer"
                >
                  &larr; Back to Prospects List
                </button>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2.5">
                      <h2 className="text-base font-bold text-slate-800">
                        {report?.official_company_name || activeLead.company_name}
                      </h2>
                      {activeLead.website_url && (
                        <a
                          href={activeLead.website_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-slate-400 hover:text-blue-600 transition-colors"
                          title="Open official site"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mt-1">
                      <span>Domain: <b className="font-mono text-slate-700">{report?.canonical_domain || activeLead.extracted_domain || '—'}</b></span>
                      <span>&bull;</span>
                      <span>Industry: <b className="text-slate-700">{report?.industry || activeLead.industry || '—'}</b></span>
                      <span>&bull;</span>
                      <span>HQ: <b className="text-slate-700">{report?.headquarters || '—'}</b></span>
                    </div>
                  </div>

                  {/* Top Scores & Action Group */}
                  <div className="flex flex-wrap items-center gap-2.5">
                    {report && (
                      <div className="flex items-center gap-2">
                        {getScoreBadge(report.company_fit_score)}
                        {getConfidenceBadge(report.research_confidence_score)}
                      </div>
                    )}

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleInvestigate(activeLead.id, !!report)}
                        disabled={isInvestigating}
                        className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg shadow-2xs flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer"
                        title="Crawl Website (Free, $0 Cost): Run deterministic rule-based crawler across robots.txt, sitemaps, and core company pages to extract verified business facts."
                      >
                        {isInvestigating ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
                            <span>Crawling Site...</span>
                          </>
                        ) : (
                          <>
                            <Globe className="w-3.5 h-3.5 text-slate-500" />
                            <span>{report ? 'Re-crawl Site' : 'Crawl Site (Free)'}</span>
                          </>
                        )}
                      </button>

                      <button
                        onClick={() => handleAiInvestigate(activeLead.id)}
                        disabled={isAiInvestigating}
                        className="px-3 py-1.5 text-xs font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-lg shadow-2xs flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer"
                        title="AI Deep Investigation: Launch Gemini AI to analyze crawled content, synthesize deep capabilities, and find tailored BPO/software opportunities."
                      >
                        {isAiInvestigating ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-600" />
                            <span>AI Analyzing...</span>
                          </>
                        ) : (
                          <>
                            <Brain className="w-3.5 h-3.5 text-purple-600" />
                            <span>AI Investigate</span>
                          </>
                        )}
                      </button>

                      {report && (
                        <>
                          <button
                            onClick={() => handleRecalculateScore(activeLead.id)}
                            disabled={isRecalculating}
                            className="p-1.5 text-slate-600 hover:text-slate-800 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
                            title="Recalculate Fit Score: Re-evaluates all findings against active Ideal Customer Profile (ICP) weights and updates the 100-point score."
                          >
                            <RefreshCw className={`w-3.5 h-3.5 ${isRecalculating ? 'animate-spin' : ''}`} />
                          </button>

                          <button
                            onClick={() => handleApproveReport(activeLead.id)}
                            disabled={isReviewing}
                            className="px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer"
                            title="Approve & Send to Outreach: Gives senior sign-off to this intelligence report and generates a personalized cold intro email draft in the Outreach Approval Queue."
                          >
                            <ThumbsUp className="w-3.5 h-3.5" />
                            <span>{report.human_review_status === 'APPROVED' ? 'Re-Approve & Outreach' : 'Approve & Send to Outreach'}</span>
                          </button>

                          {(activeLead.is_email_generated || report.human_review_status === 'APPROVED') && onNavigate && (
                            <button
                              onClick={() => onNavigate('approvals')}
                              className="px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer"
                              title="View in Email Outreach: Navigate to Email Outreach tab to review, edit, or dispatch the personalized email draft."
                            >
                              <Mail className="w-3.5 h-3.5 text-blue-600" />
                              <span>View in Email Outreach &rarr;</span>
                            </button>
                          )}

                          <button
                            onClick={() => handleRejectReport(activeLead.id)}
                            disabled={isReviewing}
                            className="p-1.5 text-rose-600 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors cursor-pointer"
                            title="Disqualify Company: Flags this lead as unqualified or lacking sufficient public evidence for outbound sales."
                          >
                            <ThumbsDown className="w-3.5 h-3.5" />
                          </button>

                          {onDeleteLead && (
                            <button
                              onClick={() => {
                                if (window.confirm(`Delete lead '${activeLead.company_name}' and all associated intelligence?`)) {
                                  onDeleteLead(activeLead.id);
                                }
                              }}
                              className="p-1.5 text-rose-500 hover:text-rose-700 bg-white hover:bg-rose-50 border border-slate-200 hover:border-rose-200 rounded-lg transition-colors cursor-pointer"
                              title="Delete Lead: Permanently delete this company and its research from the CRM."
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Qualification Alert / Status Banner */}
                {report && (
                  <div className="mt-3 pt-3 border-t border-slate-200/80 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-700">ICP Status:</span>
                      <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                        report.qualification_status === 'QUALIFIED_HOT' ? 'bg-emerald-100 text-emerald-800' :
                        report.qualification_status === 'QUALIFIED_WARM' ? 'bg-amber-100 text-amber-800' :
                        report.qualification_status === 'INSUFFICIENT_EVIDENCE' ? 'bg-rose-100 text-rose-800' :
                        'bg-slate-100 text-slate-700'
                      }`}>
                        {report.qualification_display || report.qualification_status}
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-400">
                      Scoring Model: <b>v{report.scoring_version || '1.0'}</b> &bull; Investigated: {report.research_date ? new Date(report.research_date).toLocaleDateString() : 'Recent'}
                    </div>
                  </div>
                )}
              </div>

              {/* 10 Navigation Tabs */}
              {report ? (
                <div>
                  <div className="flex items-center gap-1.5 px-3 sm:px-4 py-2 border-b border-slate-200 overflow-x-auto no-scrollbar text-xs bg-slate-50/50">
                    <button
                      onClick={() => setActiveTab('overview')}
                      title="1. Overview: Executive summary, company description, business model, and high-level fit scorecard."
                      className={`py-1.5 px-3 font-semibold rounded-lg transition-all whitespace-nowrap cursor-pointer shrink-0 ${
                        activeTab === 'overview' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-200/70 hover:text-slate-900'
                      }`}
                    >
                      1. Overview
                    </button>
                    <button
                      onClick={() => setActiveTab('website')}
                      title="2. Website: Discovered pages, crawl depth, HTTP status, robots.txt compliance, and sitemap detection."
                      className={`py-1.5 px-3 font-semibold rounded-lg transition-all whitespace-nowrap cursor-pointer shrink-0 ${
                        activeTab === 'website' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-200/70 hover:text-slate-900'
                      }`}
                    >
                      2. Website ({report.pages?.length || 0})
                    </button>
                    <button
                      onClick={() => setActiveTab('products_services')}
                      title="3. Products & Services: Identified product catalog, core business services, solutions offered, and publicly stated pricing."
                      className={`py-1.5 px-3 font-semibold rounded-lg transition-all whitespace-nowrap cursor-pointer shrink-0 ${
                        activeTab === 'products_services' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-200/70 hover:text-slate-900'
                      }`}
                    >
                      3. Products & Services
                    </button>
                    <button
                      onClick={() => setActiveTab('market')}
                      title="4. Market & Clients: Operating countries, target customer segments, B2B/B2C classification, and documented clients/partners."
                      className={`py-1.5 px-3 font-semibold rounded-lg transition-all whitespace-nowrap cursor-pointer shrink-0 ${
                        activeTab === 'market' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-200/70 hover:text-slate-900'
                      }`}
                    >
                      4. Market & Clients
                    </button>
                    <button
                      onClick={() => setActiveTab('technology')}
                      title="5. Technology: Detected web technologies, programming frameworks, cloud infrastructure, and technical maturity."
                      className={`py-1.5 px-3 font-semibold rounded-lg transition-all whitespace-nowrap cursor-pointer shrink-0 ${
                        activeTab === 'technology' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-200/70 hover:text-slate-900'
                      }`}
                    >
                      5. Technology
                    </button>
                    <button
                      onClick={() => setActiveTab('signals')}
                      title="6. Signals & Hiring: Growth signals, open job positions, expansion announcements, and transformation initiatives."
                      className={`py-1.5 px-3 font-semibold rounded-lg transition-all whitespace-nowrap cursor-pointer shrink-0 ${
                        activeTab === 'signals' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-200/70 hover:text-slate-900'
                      }`}
                    >
                      6. Signals & Hiring
                    </button>
                    <button
                      onClick={() => setActiveTab('evidence')}
                      title="7. Evidence & Sources: Transparent audit log of exact text snippets, source page URLs, confidence levels, and timestamps."
                      className={`py-1.5 px-3 font-semibold rounded-lg transition-all whitespace-nowrap cursor-pointer shrink-0 ${
                        activeTab === 'evidence' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-200/70 hover:text-slate-900'
                      }`}
                    >
                      7. Evidence & Sources ({report.findings?.length || 0})
                    </button>
                    <button
                      onClick={() => setActiveTab('opportunities')}
                      title="8. BPO Opportunities: Identified operational pain points mapped directly to our BPO and software automation services."
                      className={`py-1.5 px-3 font-semibold rounded-lg transition-all whitespace-nowrap cursor-pointer shrink-0 ${
                        activeTab === 'opportunities' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-200/70 hover:text-slate-900'
                      }`}
                    >
                      8. BPO Opportunities
                    </button>
                    <button
                      onClick={() => setActiveTab('scoring')}
                      title="9. Scoring Breakdown: Complete explainable 100-point company fit score with category weights and mathematical formula."
                      className={`py-1.5 px-3 font-semibold rounded-lg transition-all whitespace-nowrap cursor-pointer shrink-0 ${
                        activeTab === 'scoring' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-200/70 hover:text-slate-900'
                      }`}
                    >
                      9. Scoring Breakdown
                    </button>
                    <button
                      onClick={() => setActiveTab('history_icp')}
                      title="10. Audit & ICP: Historical crawling job execution logs and side-by-side comparison against active ICP configuration."
                      className={`py-1.5 px-3 font-semibold rounded-lg transition-all whitespace-nowrap cursor-pointer shrink-0 ${
                        activeTab === 'history_icp' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-200/70 hover:text-slate-900'
                      }`}
                    >
                      10. Audit & ICP
                    </button>
                  </div>

                  {/* Tab Panes */}
                  <div className="p-6 text-slate-700">
                    
                    {/* TAB 1: OVERVIEW */}
                    {activeTab === 'overview' && (
                      <div className="space-y-5 text-xs">
                        {/* Executive Summary */}
                        <div className="bg-blue-50/60 p-4 rounded-xl border border-blue-200/80">
                          <h4 className="text-xs font-bold text-blue-900 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                            <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                            Executive Intelligence Brief
                          </h4>
                          <p className="text-slate-700 text-xs leading-relaxed">
                            {report.executive_summary || report.company_overview || 'Comprehensive analysis completed.'}
                          </p>
                        </div>

                        {/* Identity & Firmographics Grid */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                            <span className="text-[10px] text-slate-400 block font-medium">Business Model</span>
                            <span className="text-xs font-bold text-slate-800 mt-0.5 block">{report.business_model || 'B2B Commercial'}</span>
                          </div>
                          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                            <span className="text-[10px] text-slate-400 block font-medium">Headquarters</span>
                            <span className="text-xs font-bold text-slate-800 mt-0.5 block">{report.headquarters || 'Undisclosed'}</span>
                          </div>
                          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                            <span className="text-[10px] text-slate-400 block font-medium">Founded</span>
                            <span className="text-xs font-bold text-slate-800 mt-0.5 block">{report.founding_year || 'Unstated'}</span>
                          </div>
                          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                            <span className="text-[10px] text-slate-400 block font-medium">Employee Count</span>
                            <span className="text-xs font-bold text-slate-800 mt-0.5 block">{report.employee_count_verified || 'Not Disclosed'}</span>
                          </div>
                        </div>

                        {/* Research Coverage Summary Card */}
                        <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                          <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                            Research Coverage & Audit Statistics
                          </h4>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-slate-600 text-[11px]">
                            <div>Pages Discovered: <b>{report.research_coverage?.pages_discovered || report.pages?.length || 1}</b></div>
                            <div>Pages Investigated: <b>{report.research_coverage?.pages_investigated || report.pages?.length || 1}</b></div>
                            <div>Pages Skipped: <b>{report.research_coverage?.pages_skipped || 0}</b></div>
                            <div>Inaccessible / Blocked: <b>{report.research_coverage?.pages_inaccessible || 0}</b></div>
                          </div>
                        </div>

                        {/* Research Gaps Alert */}
                        {report.research_gaps && report.research_gaps.length > 0 && (
                          <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl text-xs text-amber-900">
                            <span className="font-bold flex items-center gap-1 mb-1">
                              <HelpCircle className="w-3.5 h-3.5 text-amber-600" />
                              Reported Research Limitations / Gaps:
                            </span>
                            <ul className="list-disc pl-4 text-[11px] space-y-0.5 text-amber-800">
                              {report.research_gaps.map((g, i) => (
                                <li key={i}>{g}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}

                    {/* TAB 2: WEBSITE INVESTIGATION */}
                    {activeTab === 'website' && (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between text-xs text-slate-500">
                          <span>Official Website Pages Crawled & Verified</span>
                          <span>Total: <b>{report.pages?.length || 0} pages</b></span>
                        </div>

                        <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                          <table className="w-full text-left text-xs border-collapse">
                            <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200">
                              <tr>
                                <th className="py-2.5 px-3">Page Category</th>
                                <th className="py-2.5 px-3">URL</th>
                                <th className="py-2.5 px-3">Status</th>
                                <th className="py-2.5 px-3">Words</th>
                                <th className="py-2.5 px-3">Discovery Method</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {report.pages && report.pages.length > 0 ? (
                                report.pages.map((p) => (
                                  <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="py-2.5 px-3 font-semibold text-slate-800">
                                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                                        {p.page_type_display || p.page_type}
                                      </span>
                                    </td>
                                    <td className="py-2.5 px-3 max-w-[240px] truncate font-mono text-[11px] text-slate-600">
                                      <a href={p.url} target="_blank" rel="noreferrer" className="hover:text-blue-600 hover:underline">
                                        {p.url}
                                      </a>
                                    </td>
                                    <td className="py-2.5 px-3">
                                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${p.status_code === 200 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                                        HTTP {p.status_code}
                                      </span>
                                    </td>
                                    <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500">{p.word_count || '—'}</td>
                                    <td className="py-2.5 px-3 text-[11px] text-slate-500">{p.discovery_method || 'HOMEPAGE_LINK'}</td>
                                  </tr>
                                ))
                              ) : (
                                <tr>
                                  <td colSpan={5} className="py-6 text-center text-slate-400">
                                    No pages crawled yet.
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* TAB 3: PRODUCTS & SERVICES */}
                    {activeTab === 'products_services' && (
                      <div className="space-y-4 text-xs">
                        <div>
                          <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">Identified Service Portfolio</h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {report.main_services && report.main_services.length > 0 ? (
                              report.main_services.map((s, idx) => (
                                <div key={idx} className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-start gap-2">
                                  <span className="w-1.5 h-1.5 rounded-full bg-blue-600 shrink-0 mt-1.5"></span>
                                  <span className="text-slate-700 text-xs">{typeof s === 'string' ? s : JSON.stringify(s)}</span>
                                </div>
                              ))
                            ) : (
                              <p className="text-slate-400 italic">No specific services catalog listed.</p>
                            )}
                          </div>
                        </div>

                        <div className="pt-2">
                          <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">Public Products & Solutions</h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {report.main_products && report.main_products.length > 0 ? (
                              report.main_products.map((p, idx) => (
                                <div key={idx} className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-start gap-2">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 shrink-0 mt-1.5"></span>
                                  <span className="text-slate-700 text-xs">{typeof p === 'string' ? p : JSON.stringify(p)}</span>
                                </div>
                              ))
                            ) : (
                              <p className="text-slate-400 italic">Custom B2B solutions (No standalone software SKUs listed).</p>
                            )}
                          </div>
                        </div>

                        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-[11px] text-slate-600">
                          <b>Public Pricing Model:</b> {report.public_pricing_model || 'Contact Sales / Custom Quote'}
                        </div>
                      </div>
                    )}

                    {/* TAB 4: MARKET & CLIENTS */}
                    {activeTab === 'market' && (
                      <div className="space-y-4 text-xs">
                        <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">Target Customer Segments</span>
                          <p className="text-slate-800 text-xs">{report.target_customers || 'Enterprise clients, corporate organizations, and SMBs'}</p>
                        </div>

                        <div>
                          <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">Publicly Documented Clients & Case Studies</h4>
                          {report.documented_clients && report.documented_clients.length > 0 ? (
                            <div className="space-y-2">
                              {report.documented_clients.map((c, i) => (
                                <div key={i} className="p-3 bg-white border border-slate-200 rounded-xl text-slate-700 text-xs shadow-2xs">
                                  {c}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-slate-400 italic">Private customer accounts / No explicit client logos parsed.</p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* TAB 5: TECHNOLOGY */}
                    {activeTab === 'technology' && (
                      <div className="space-y-4 text-xs">
                        <div>
                          <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">Detected Technology Stack Signatures</h4>
                          <div className="flex flex-wrap gap-2">
                            {report.tech_stack_detected && report.tech_stack_detected.length > 0 ? (
                              report.tech_stack_detected.map((t, i) => (
                                <span key={i} className="px-3 py-1 bg-slate-100 text-slate-800 rounded-lg text-xs font-semibold border border-slate-200">
                                  {t}
                                </span>
                              ))
                            ) : (
                              <p className="text-slate-400 italic">No specific tech stack signatures detected.</p>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                            <span className="font-bold text-slate-800 block mb-1">Conversational Support Tooling:</span>
                            <span className="text-slate-600 text-[11px]">
                              {report.has_chat_widget ? 'Active live chat widget detected' : 'No active chat or conversational bot found on public portal.'}
                            </span>
                          </div>
                          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                            <span className="font-bold text-slate-800 block mb-1">Cloud Infrastructure:</span>
                            <span className="text-slate-600 text-[11px]">
                              {report.cloud_providers && report.cloud_providers.length > 0 ? report.cloud_providers.join(', ') : 'Standard Cloud Hosting'}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* TAB 6: SIGNALS & HIRING */}
                    {activeTab === 'signals' && (
                      <div className="space-y-4 text-xs">
                        <div>
                          <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">Relevant Job Openings & Hiring Activity</h4>
                          {report.job_openings && report.job_openings.length > 0 ? (
                            <div className="space-y-1.5">
                              {report.job_openings.map((job, idx) => (
                                <div key={idx} className="p-2.5 bg-blue-50/50 border border-blue-200/80 rounded-lg text-blue-900 text-xs">
                                  &bull; {job}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-slate-400 italic">No active job listings discovered on crawled pages.</p>
                          )}
                        </div>

                        <div>
                          <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">Expansion & Transformation Signals</h4>
                          {report.expansion_signals && report.expansion_signals.length > 0 ? (
                            <div className="space-y-1.5">
                              {report.expansion_signals.map((sig, idx) => (
                                <div key={idx} className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 text-xs">
                                  &bull; {sig}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-slate-400 italic">No press expansion announcements detected.</p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* TAB 7: EVIDENCE & SOURCES */}
                    {activeTab === 'evidence' && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between text-xs text-slate-500">
                          <span>Factual Finding Claims Verified Against Source Quotations</span>
                          <span>Total Citations: <b>{report.findings?.length || 0}</b></span>
                        </div>

                        <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                          <table className="w-full text-left text-xs border-collapse">
                            <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200">
                              <tr>
                                <th className="py-2.5 px-3">Category</th>
                                <th className="py-2.5 px-3">Fact / Finding</th>
                                <th className="py-2.5 px-3">Supporting Quote</th>
                                <th className="py-2.5 px-3">Source Citation</th>
                                <th className="py-2.5 px-3">Status</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {report.findings && report.findings.length > 0 ? (
                                report.findings.map((f) => (
                                  <tr key={f.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="py-2.5 px-3 font-semibold text-slate-800">
                                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                                        {f.category_display || f.category}
                                      </span>
                                    </td>
                                    <td className="py-2.5 px-3 font-medium text-slate-800 max-w-[160px] truncate" title={f.claim_value}>
                                      {f.claim_value}
                                    </td>
                                    <td className="py-2.5 px-3 max-w-[260px] text-[11px] text-slate-600 italic">
                                      "{f.supporting_quote || 'Direct inspection fact'}"
                                    </td>
                                    <td className="py-2.5 px-3 text-[11px]">
                                      {f.source_url ? (
                                        <a href={f.source_url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline flex items-center gap-1">
                                          <span>{f.source_page_title || 'Source Page'}</span>
                                          <ExternalLink className="w-3 h-3 shrink-0" />
                                        </a>
                                      ) : (
                                        <span className="text-slate-400">Metadata Analysis</span>
                                      )}
                                    </td>
                                    <td className="py-2.5 px-3">
                                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                        f.verification_status === 'VERIFIED' ? 'bg-emerald-50 text-emerald-700' :
                                        f.verification_status === 'INFERRED' ? 'bg-blue-50 text-blue-700' :
                                        'bg-amber-50 text-amber-700'
                                      }`}>
                                        {f.verification_display || f.verification_status}
                                      </span>
                                    </td>
                                  </tr>
                                ))
                              ) : (
                                <tr>
                                  <td colSpan={5} className="py-6 text-center text-slate-400 text-xs">
                                    No evidence quotes recorded.
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* TAB 8: BPO OPPORTUNITIES */}
                    {activeTab === 'opportunities' && (
                      <div className="space-y-3">
                        <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
                          Tailored BPO & AI Opportunities Identified for this Company
                        </h4>

                        {report.business_opportunities && report.business_opportunities.length > 0 ? (
                          <div className="grid grid-cols-1 gap-3">
                            {report.business_opportunities.map((opp, i) => (
                              <div key={i} className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                                    <Award className="w-3.5 h-3.5 text-blue-600" />
                                    {opp.title}
                                  </span>
                                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800">
                                    {opp.estimated_fit} FIT
                                  </span>
                                </div>
                                <p className="text-xs text-slate-600 leading-relaxed">{opp.description}</p>
                                <div className="text-[11px] text-slate-400">
                                  <b>Evidence Rationale:</b> {opp.rationale}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-slate-400 text-xs italic">No specific opportunities mapped.</p>
                        )}
                      </div>
                    )}

                    {/* TAB 9: SCORING BREAKDOWN */}
                    {activeTab === 'scoring' && (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between p-3.5 bg-blue-50/70 border border-blue-200 rounded-xl">
                          <div>
                            <span className="text-xs font-bold text-blue-900 block">100-Point Company Fit Score</span>
                            <span className="text-[11px] text-blue-700">{report.scoring_breakdown?.summary}</span>
                          </div>
                          <span className="text-2xl font-bold text-blue-700">{report.company_fit_score}/100</span>
                        </div>

                        {/* Criteria List */}
                        <div className="space-y-2.5">
                          {report.scoring_breakdown?.criteria && report.scoring_breakdown.criteria.length > 0 ? (
                            report.scoring_breakdown.criteria.map((c) => (
                              <div key={c.key} className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1.5">
                                <div className="flex items-center justify-between">
                                  <span className="font-bold text-slate-800">{c.name}</span>
                                  <span className="font-mono font-bold text-blue-600">
                                    {c.score} / {c.max_score} pts
                                  </span>
                                </div>
                                <p className="text-slate-600 text-[11px] leading-relaxed">{c.explanation}</p>
                                
                                {c.missing_info_flags && c.missing_info_flags.length > 0 && (
                                  <div className="text-[10px] text-amber-700 bg-amber-50 p-1.5 rounded flex items-center gap-1">
                                    <HelpCircle className="w-3 h-3 shrink-0" />
                                    <span>Unverified / Missing: {c.missing_info_flags.join(', ')}</span>
                                  </div>
                                )}
                              </div>
                            ))
                          ) : (
                            <p className="text-slate-400 text-xs italic">No breakdown available.</p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* TAB 10: AUDIT & ICP CONFIG */}
                    {activeTab === 'history_icp' && (
                      <div className="space-y-4 text-xs">
                        <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                          <h4 className="font-bold text-slate-800 uppercase tracking-wider text-xs">Human Review & Audit Status</h4>
                          <div className="grid grid-cols-2 gap-3 text-slate-600 text-[11px]">
                            <div>Status: <b>{report.human_review_status || 'PENDING'}</b></div>
                            <div>Reviewer: <b>{report.reviewed_by || 'Unassigned'}</b></div>
                            <div>Review Date: <b>{report.reviewed_at ? new Date(report.reviewed_at).toLocaleDateString() : 'Pending'}</b></div>
                            <div>Notes: <b>{report.review_notes || 'None'}</b></div>
                          </div>
                        </div>

                        <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-800 text-xs">Active ICP Configuration</span>
                            <button
                              onClick={() => setIsICPModalOpen(true)}
                              className="px-2.5 py-1 text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg"
                            >
                              Edit Profile Weights
                            </button>
                          </div>
                          <p className="text-slate-500 text-[11px]">{icpConfig?.description}</p>
                          
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                            <div className="p-2 bg-slate-50 rounded border border-slate-100">Industry: <b>{icpConfig?.weight_industry} pts</b></div>
                            <div className="p-2 bg-slate-50 rounded border border-slate-100">Service Fit: <b>{icpConfig?.weight_service_fit} pts</b></div>
                            <div className="p-2 bg-slate-50 rounded border border-slate-100">Needs Evidence: <b>{icpConfig?.weight_business_needs} pts</b></div>
                            <div className="p-2 bg-slate-50 rounded border border-slate-100">Size: <b>{icpConfig?.weight_company_size} pts</b></div>
                            <div className="p-2 bg-slate-50 rounded border border-slate-100">Tech Maturity: <b>{icpConfig?.weight_tech_maturity} pts</b></div>
                            <div className="p-2 bg-slate-50 rounded border border-slate-100">Growth Signals: <b>{icpConfig?.weight_growth_signals} pts</b></div>
                            <div className="p-2 bg-slate-50 rounded border border-slate-100">Geography: <b>{icpConfig?.weight_geography} pts</b></div>
                            <div className="p-2 bg-slate-50 rounded border border-slate-100">Contact: <b>{icpConfig?.weight_contact_accessibility} pts</b></div>
                          </div>
                        </div>
                      </div>
                    )}

                  </div>
                </div>
              ) : (
                <div className="py-20 text-center space-y-3">
                  <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto">
                    <Sparkles className="w-7 h-7" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-800">
                    No Intelligence Investigation Conducted Yet
                  </h3>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    Click <b>Investigate Site</b> above to start controlled website discovery, structured extraction, source citations, and 100-point ICP scoring.
                  </p>
                  <button
                    onClick={() => handleInvestigate(activeLead.id)}
                    disabled={isInvestigating}
                    className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-xl shadow-xs inline-flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer"
                    title="Start Company Investigation: Crawl website pages, extract core business facts, and compute the initial 100-point ICP fit score."
                  >
                    {isInvestigating ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Investigating Website...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Start Company Investigation</span>
                      </>
                    )}
                  </button>
                </div>
              )}

            </div>
          ) : (
            <div className="bg-white p-12 text-center rounded-xl border border-slate-200 text-slate-400 text-xs">
              Select a company from the left directory to inspect its intelligence profile.
            </div>
          )}
        </div>

      </div>

      {/* ICP Configuration Modal */}
      {isICPModalOpen && icpConfig && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                  <Sliders className="w-4 h-4 text-blue-600" />
                  Configure Ideal Customer Profile (ICP)
                </h3>
                <p className="text-xs text-slate-500">Edit scoring weights and qualification thresholds.</p>
              </div>
              <button 
                onClick={() => setIsICPModalOpen(false)} 
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
                title="Close: Dismiss the ICP configuration modal."
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-blue-50 text-blue-900 rounded-xl text-[11px] leading-relaxed">
                Weights must sum to <b>100 points</b>. Modifying weights will take effect on future and recalculated company scorings.
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Industry Fit Weight (pts)</label>
                  <input
                    type="number"
                    value={icpConfig.weight_industry}
                    onChange={(e) => setIcpConfig({ ...icpConfig, weight_industry: parseInt(e.target.value) || 0 })}
                    className="w-full border border-slate-200 rounded-lg p-2 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Service Fit Weight (pts)</label>
                  <input
                    type="number"
                    value={icpConfig.weight_service_fit}
                    onChange={(e) => setIcpConfig({ ...icpConfig, weight_service_fit: parseInt(e.target.value) || 0 })}
                    className="w-full border border-slate-200 rounded-lg p-2 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Business Needs Weight (pts)</label>
                  <input
                    type="number"
                    value={icpConfig.weight_business_needs}
                    onChange={(e) => setIcpConfig({ ...icpConfig, weight_business_needs: parseInt(e.target.value) || 0 })}
                    className="w-full border border-slate-200 rounded-lg p-2 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Company Size Weight (pts)</label>
                  <input
                    type="number"
                    value={icpConfig.weight_company_size}
                    onChange={(e) => setIcpConfig({ ...icpConfig, weight_company_size: parseInt(e.target.value) || 0 })}
                    className="w-full border border-slate-200 rounded-lg p-2 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Tech Maturity Weight (pts)</label>
                  <input
                    type="number"
                    value={icpConfig.weight_tech_maturity}
                    onChange={(e) => setIcpConfig({ ...icpConfig, weight_tech_maturity: parseInt(e.target.value) || 0 })}
                    className="w-full border border-slate-200 rounded-lg p-2 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Growth Signals Weight (pts)</label>
                  <input
                    type="number"
                    value={icpConfig.weight_growth_signals}
                    onChange={(e) => setIcpConfig({ ...icpConfig, weight_growth_signals: parseInt(e.target.value) || 0 })}
                    className="w-full border border-slate-200 rounded-lg p-2 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Geography Weight (pts)</label>
                  <input
                    type="number"
                    value={icpConfig.weight_geography}
                    onChange={(e) => setIcpConfig({ ...icpConfig, weight_geography: parseInt(e.target.value) || 0 })}
                    className="w-full border border-slate-200 rounded-lg p-2 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Contact Accessibility (pts)</label>
                  <input
                    type="number"
                    value={icpConfig.weight_contact_accessibility}
                    onChange={(e) => setIcpConfig({ ...icpConfig, weight_contact_accessibility: parseInt(e.target.value) || 0 })}
                    className="w-full border border-slate-200 rounded-lg p-2 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Hot Prospect Threshold (&ge; pts)</label>
                  <input
                    type="number"
                    value={icpConfig.threshold_hot}
                    onChange={(e) => setIcpConfig({ ...icpConfig, threshold_hot: parseInt(e.target.value) || 0 })}
                    className="w-full border border-slate-200 rounded-lg p-2 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Warm Prospect Threshold (&ge; pts)</label>
                  <input
                    type="number"
                    value={icpConfig.threshold_warm}
                    onChange={(e) => setIcpConfig({ ...icpConfig, threshold_warm: parseInt(e.target.value) || 0 })}
                    className="w-full border border-slate-200 rounded-lg p-2 text-xs"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setIsICPModalOpen(false)}
                className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg font-medium cursor-pointer"
                title="Cancel: Exit without saving changes to ICP configuration."
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await api.updateICPConfig(icpConfig.id, icpConfig);
                    if (showToast) showToast('ICP Configuration updated successfully.');
                    setIsICPModalOpen(false);
                    if (onRefresh) await onRefresh();
                  } catch (e: any) {
                    alert('Error saving ICP config: ' + e.message);
                  }
                }}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-lg shadow-xs cursor-pointer"
                title="Save ICP Configuration: Updates Ideal Customer Profile weights and qualification thresholds across the platform."
              >
                Save ICP Configuration
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
