import React, { useState, useEffect } from 'react';
import { 
  Building2, Globe, CheckCircle2, ShieldCheck, AlertCircle, 
  ExternalLink, Layers, Search, Cpu, Target, Flag, Bug, Loader2, Trash2,
  RefreshCw, Sparkles, ShieldAlert, Award, FileText, Check, HelpCircle,
  XCircle, ChevronRight, Sliders, ArrowUpRight, Clock, Users, DollarSign,
  Briefcase, Compass, FileCheck, ThumbsUp, ThumbsDown, Mail, Brain, Zap
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
  const [isAutoProcessing, setIsAutoProcessing] = useState(false);
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [isReviewing, setIsReviewing] = useState(false);

  // ICP Config Modal State
  const [isICPModalOpen, setIsICPModalOpen] = useState(false);
  const [icpConfig, setIcpConfig] = useState<ICPConfig | null>(null);

  // Load ICP Config
  useEffect(() => {
    api.getActiveICPConfig()
      .then(setIcpConfig)
      .catch(() => null);
  }, []);

  // Sync selected lead when list changes
  useEffect(() => {
    if ((!selectedLeadId || !leads.some(l => l.id === selectedLeadId)) && leads.length > 0) {
      setSelectedLeadId(leads[0].id);
    }
  }, [leads, selectedLeadId]);

  // Auto-process any verified leads into the outreach queue automatically
  useEffect(() => {
    const verifiedUnprocessed = leads.filter(
      l => l.is_company_verified && l.lead_status !== 'AWAITING_APPROVAL' && !l.is_email_generated
    );
    if (verifiedUnprocessed.length > 0 && !isAutoProcessing) {
      api.autoProcessVerifiedLeads()
        .then(() => {
          // background processing spawned
        })
        .catch(() => null);
    }
  }, [leads.length]);

  const activeLead = leads.find(l => l.id === selectedLeadId);
  const report: ResearchReport | undefined = activeLead?.research_report;

  // Count verified leads pending automated crawling & outreach drafting
  const verifiedPendingOutreach = leads.filter(
    l => l.is_company_verified && l.lead_status !== 'AWAITING_APPROVAL' && !l.is_email_generated
  ).length;

  // Filtered Leads Directory
  const filteredLeads = leads.filter((lead) => {
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

  // KPI Calculations
  const totalInvestigated = leads.filter(l => l.research_report).length;
  const completedResearch = leads.filter(l => l.research_report && l.research_report.qualification_status !== 'INSUFFICIENT_EVIDENCE').length;
  const highPriorityProspects = leads.filter(l => (l.research_report?.company_fit_score || 0) >= 75).length;
  const warmProspects = leads.filter(l => (l.research_report?.company_fit_score || 0) >= 50 && (l.research_report?.company_fit_score || 0) < 75).length;
  const insufficientEvidence = leads.filter(l => l.research_report?.qualification_status === 'INSUFFICIENT_EVIDENCE').length;

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

  const handleAutoProcessVerified = async () => {
    setIsAutoProcessing(true);
    try {
      const res = await api.autoProcessVerifiedLeads();
      if (showToast) {
        showToast(res?.message || 'Started automated processing for verified leads.');
      }
      if (onRefresh) await onRefresh();
    } catch (err: any) {
      alert('Error triggering auto-processing: ' + (err?.message || 'Failed'));
    } finally {
      setIsAutoProcessing(false);
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
      
      {/* SECTION 1: Summary Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[11px] text-slate-500 font-medium block">Total Investigated</span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-xl font-bold text-slate-800">{totalInvestigated}</span>
            <span className="text-[10px] text-slate-400">of {leads.length} leads</span>
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[11px] text-emerald-700 font-medium block">Completed Research</span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-xl font-bold text-emerald-700">{completedResearch}</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[11px] text-blue-700 font-medium block">High-Priority (Hot)</span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-xl font-bold text-blue-700">{highPriorityProspects}</span>
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700">&ge; 75 fit</span>
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[11px] text-amber-700 font-medium block">Moderate Fit (Warm)</span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-xl font-bold text-amber-700">{warmProspects}</span>
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-50 text-amber-700">50-74 fit</span>
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[11px] text-rose-700 font-medium block">Insufficient Evidence</span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-xl font-bold text-rose-700">{insufficientEvidence}</span>
            <AlertCircle className="w-4 h-4 text-rose-500" />
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[11px] text-slate-500 font-medium block">Active ICP Model</span>
          <div className="flex items-center justify-between mt-1">
            <span className="text-xs font-bold text-slate-700 truncate">{icpConfig?.name || 'Default ICP'}</span>
            <button
              onClick={() => setIsICPModalOpen(true)}
              className="text-blue-600 hover:text-blue-700 p-1 rounded hover:bg-blue-50"
              title="Configure ICP Weights"
            >
              <Sliders className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* SECTION 2: Search, Filter & Bulk Controls Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search companies, domains, industries..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-1.5 text-xs border border-slate-200 rounded-lg w-60 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white font-medium text-slate-700"
          >
            <option value="ALL">All Prospects ({leads.length})</option>
            <option value="RESEARCHED">Researched Only ({totalInvestigated})</option>
            <option value="PENDING">Pending Research ({leads.length - totalInvestigated})</option>
            <option value="HOT">Hot Fit (&ge; 75)</option>
            <option value="WARM">Warm Fit (50-74)</option>
            <option value="INSUFFICIENT">Insufficient Evidence</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          {leads.length > 0 && onDeleteAll && (
            <button
              onClick={onDeleteAll}
              className="px-3 py-1.5 text-xs font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5"
              title="Delete all leads and intelligence data"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete All Data</span>
            </button>
          )}

          <button
            onClick={() => setIsICPModalOpen(true)}
            className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <Sliders className="w-3.5 h-3.5 text-slate-500" />
            <span>ICP Weights & Criteria</span>
          </button>
        </div>
      </div>

      {/* Automated Pipeline Notification Banner */}
      {verifiedPendingOutreach > 0 && (
        <div className="mb-4 px-4 py-3 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs text-blue-900 shadow-2xs">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0">
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <span className="font-bold text-slate-800">Automated Pipeline Active:</span>{' '}
              <span>{verifiedPendingOutreach} verified lead(s) are being crawled and pushed to Email Outreach automatically.</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleAutoProcessVerified}
              disabled={isAutoProcessing}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-2xs flex items-center gap-1.5 transition-colors disabled:opacity-50"
            >
              {isAutoProcessing ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Processing Queue...</span>
                </>
              ) : (
                <>
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Sync Outreach Queue</span>
                </>
              )}
            </button>
            {onNavigate && (
              <button
                onClick={() => onNavigate('approvals')}
                className="px-3 py-1.5 bg-white hover:bg-slate-50 text-blue-700 border border-blue-300 font-semibold rounded-lg shadow-2xs flex items-center gap-1 transition-colors"
              >
                <span>View Email Outreach &rarr;</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* SECTION 3: Main Split Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        
        {/* Left Side: Companies Directory */}
        <div className="lg:col-span-4 bg-white rounded-xl border border-slate-200 p-3 shadow-xs space-y-2">
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
                    onClick={() => setSelectedLeadId(lead.id)}
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
              <div className="text-center py-10 text-slate-400 text-xs">
                No matching companies found.
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Deep Company Intelligence Dossier */}
        <div className="lg:col-span-8 space-y-4">
          {activeLead ? (
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
              
              {/* Header Profile Bar */}
              <div className="p-5 border-b border-slate-200 bg-slate-50/70">
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
                        className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg shadow-2xs flex items-center gap-1.5 transition-colors disabled:opacity-50"
                        title="Fast, deterministic website crawling & structured fact extraction ($0 AI cost)"
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
                        className="px-3 py-1.5 text-xs font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-lg shadow-2xs flex items-center gap-1.5 transition-colors disabled:opacity-50"
                        title="Explicit on-demand AI deep investigation using Gemini LLM for this specific lead"
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
                            className="p-1.5 text-slate-600 hover:text-slate-800 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                            title="Recalculate Score against current ICP"
                          >
                            <RefreshCw className={`w-3.5 h-3.5 ${isRecalculating ? 'animate-spin' : ''}`} />
                          </button>

                          <button
                            onClick={() => handleApproveReport(activeLead.id)}
                            disabled={isReviewing}
                            className="px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors flex items-center gap-1.5 shadow-2xs"
                            title="Approve report and generate personalized email outreach"
                          >
                            <ThumbsUp className="w-3.5 h-3.5" />
                            <span>{report.human_review_status === 'APPROVED' ? 'Re-Approve & Outreach' : 'Approve & Send to Outreach'}</span>
                          </button>

                          {(activeLead.is_email_generated || report.human_review_status === 'APPROVED') && onNavigate && (
                            <button
                              onClick={() => onNavigate('approvals')}
                              className="px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors flex items-center gap-1.5 shadow-2xs"
                              title="Open Email Outreach queue to inspect and send generated draft"
                            >
                              <Mail className="w-3.5 h-3.5 text-blue-600" />
                              <span>View in Email Outreach &rarr;</span>
                            </button>
                          )}

                          <button
                            onClick={() => handleRejectReport(activeLead.id)}
                            disabled={isReviewing}
                            className="p-1.5 text-rose-600 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors"
                            title="Disqualify prospect"
                          >
                            <ThumbsDown className="w-3.5 h-3.5" />
                          </button>
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
                  <div className="flex items-center gap-1 px-4 border-b border-slate-200 overflow-x-auto text-xs bg-slate-50/30">
                    <button
                      onClick={() => setActiveTab('overview')}
                      className={`py-2.5 px-3 font-semibold border-b-2 transition-colors whitespace-nowrap ${
                        activeTab === 'overview' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      1. Overview
                    </button>
                    <button
                      onClick={() => setActiveTab('website')}
                      className={`py-2.5 px-3 font-semibold border-b-2 transition-colors whitespace-nowrap ${
                        activeTab === 'website' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      2. Website ({report.pages?.length || 0})
                    </button>
                    <button
                      onClick={() => setActiveTab('products_services')}
                      className={`py-2.5 px-3 font-semibold border-b-2 transition-colors whitespace-nowrap ${
                        activeTab === 'products_services' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      3. Products & Services
                    </button>
                    <button
                      onClick={() => setActiveTab('market')}
                      className={`py-2.5 px-3 font-semibold border-b-2 transition-colors whitespace-nowrap ${
                        activeTab === 'market' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      4. Market & Clients
                    </button>
                    <button
                      onClick={() => setActiveTab('technology')}
                      className={`py-2.5 px-3 font-semibold border-b-2 transition-colors whitespace-nowrap ${
                        activeTab === 'technology' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      5. Technology
                    </button>
                    <button
                      onClick={() => setActiveTab('signals')}
                      className={`py-2.5 px-3 font-semibold border-b-2 transition-colors whitespace-nowrap ${
                        activeTab === 'signals' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      6. Signals & Hiring
                    </button>
                    <button
                      onClick={() => setActiveTab('evidence')}
                      className={`py-2.5 px-3 font-semibold border-b-2 transition-colors whitespace-nowrap ${
                        activeTab === 'evidence' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      7. Evidence & Sources ({report.findings?.length || 0})
                    </button>
                    <button
                      onClick={() => setActiveTab('opportunities')}
                      className={`py-2.5 px-3 font-semibold border-b-2 transition-colors whitespace-nowrap ${
                        activeTab === 'opportunities' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      8. BPO Opportunities
                    </button>
                    <button
                      onClick={() => setActiveTab('scoring')}
                      className={`py-2.5 px-3 font-semibold border-b-2 transition-colors whitespace-nowrap ${
                        activeTab === 'scoring' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      9. Scoring Breakdown
                    </button>
                    <button
                      onClick={() => setActiveTab('history_icp')}
                      className={`py-2.5 px-3 font-semibold border-b-2 transition-colors whitespace-nowrap ${
                        activeTab === 'history_icp' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'
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
                    className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-xl shadow-xs inline-flex items-center gap-1.5 transition-colors disabled:opacity-50"
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
              <button onClick={() => setIsICPModalOpen(false)} className="text-slate-400 hover:text-slate-600">
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
                className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg font-medium"
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
                className="px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-lg shadow-xs"
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
