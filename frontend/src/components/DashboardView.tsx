import React from 'react';
import { 
  Users, Building2, Globe, Flame, Mail, Clock, Send, 
  MessageSquare, CalendarCheck, FileCheck, DollarSign,
  TrendingUp, CheckCircle, AlertCircle, Sparkles, ArrowRight, Trash2,
  ChevronRight, ShieldCheck, Zap
} from 'lucide-react';
import { DashboardKPIs, ExecutiveInsights } from '../types';

interface DashboardViewProps {
  kpis: DashboardKPIs;
  insights: ExecutiveInsights;
  onNavigate: (tab: string) => void;
  onDeleteAll?: () => Promise<void>;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ kpis, insights, onNavigate, onDeleteAll }) => {
  // Categorized Metric Sections for Clean Enterprise Hierarchy
  const ingestionMetrics = [
    { label: 'Total Ingested Leads', value: kpis.total_leads, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100', tab: 'leads' },
    { label: 'Verified Companies', value: kpis.verified_companies, icon: Building2, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100', tab: 'research' },
    { label: 'Unverified / Flagged', value: kpis.unverified_companies, icon: AlertCircle, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-100', tab: 'leads' },
    { label: 'Websites Discovered', value: kpis.websites_discovered, icon: Globe, color: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-100', tab: 'research' },
  ];

  const intelligenceMetrics = [
    { label: 'Requirements Synthesized', value: kpis.requirements_identified, icon: Sparkles, color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-100', tab: 'research' },
    { label: 'Hot Qualified Leads', value: kpis.hot_leads, icon: Flame, color: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-100', tab: 'research' },
    { label: 'Warm Pipeline Leads', value: kpis.warm_leads, icon: TrendingUp, color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-100', tab: 'research' },
    { label: 'AI Emails Generated', value: kpis.emails_generated, icon: Mail, color: 'text-cyan-600', bg: 'bg-cyan-50', border: 'border-cyan-100', tab: 'approvals' },
  ];

  const outreachMetrics = [
    { label: 'Awaiting Approval', value: kpis.emails_awaiting_approval, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-100', highlight: true, tab: 'approvals' },
    { label: 'Emails Dispatched', value: kpis.emails_sent, icon: Send, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100', tab: 'approvals' },
    { label: 'Replies Received', value: kpis.replies_received, icon: MessageSquare, color: 'text-teal-600', bg: 'bg-teal-50', border: 'border-teal-100', tab: 'approvals' },
    { label: 'Positive Responses', value: kpis.positive_responses, icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100', tab: 'approvals' },
    { label: 'Meetings Requested', value: kpis.meetings_requested, icon: CalendarCheck, color: 'text-violet-600', bg: 'bg-violet-50', border: 'border-violet-100', tab: 'approvals' },
    { label: 'Quotations Created', value: kpis.quotations_generated, icon: FileCheck, color: 'text-slate-700', bg: 'bg-slate-100', border: 'border-slate-200', tab: 'proposals' },
    { label: 'Converted Customers', value: kpis.converted_customers, icon: DollarSign, color: 'text-emerald-700', bg: 'bg-emerald-100', border: 'border-emerald-200', tab: 'proposals' },
    { label: 'Pending Follow-ups', value: kpis.followups_pending, icon: Clock, color: 'text-sky-600', bg: 'bg-sky-50', border: 'border-sky-100', tab: 'approvals' },
  ];

  const renderMetricCard = (card: any, idx: number) => {
    const Icon = card.icon;
    return (
      <div 
        key={idx}
        onClick={() => onNavigate(card.tab)}
        className={`bg-white rounded-xl p-3.5 border ${card.border} shadow-2xs hover:shadow-md hover:border-blue-300 transition-all cursor-pointer group relative overflow-hidden`}
        title={`Click to view in ${card.tab.toUpperCase()}`}
      >
        <div className="flex items-center justify-between mb-2">
          <div className={`w-8 h-8 rounded-xl ${card.bg} ${card.color} flex items-center justify-center transition-transform group-hover:scale-105`}>
            <Icon className="w-4 h-4" />
          </div>
          {card.highlight && card.value > 0 && (
            <span className="flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-100/80 px-1.5 py-0.5 rounded-full border border-amber-300">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping"></span>
              <span>Action Req</span>
            </span>
          )}
        </div>
        <div className="text-xl sm:text-2xl font-bold text-slate-800 tracking-tight">{card.value}</div>
        <div className="text-[11px] font-medium text-slate-500 leading-tight mt-1 flex items-center justify-between">
          <span className="truncate">{card.label}</span>
          <ChevronRight className="w-3 h-3 text-slate-300 group-hover:text-blue-500 transition-colors shrink-0 ml-1" />
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Quick Actions */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-blue-950 rounded-2xl p-5 sm:p-6 text-white shadow-lg border border-slate-700/50 flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
        <div className="space-y-1.5 max-w-2xl">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-500/20 text-blue-300 border border-blue-400/30 flex items-center gap-1">
              <Zap className="w-3 h-3 text-blue-400" />
              <span>Agent 12 Active • Executive CRM Brief</span>
            </span>
            <span className="text-[11px] text-slate-400">• Production Ready</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight">Merugu AI BPO Mission Control</h2>
          <p className="text-slate-300 text-xs sm:text-sm leading-relaxed">
            {insights.executive_brief || "Autonomous lead qualification, website crawling, requirement synthesis, and email outreach for Merugu Global."}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 w-full sm:w-auto">
          <button
            onClick={() => onNavigate('leads')}
            className="flex-1 sm:flex-initial px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>Upload Leads</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onNavigate('approvals')}
            className="flex-1 sm:flex-initial px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>Approval Queue ({kpis.emails_awaiting_approval})</span>
          </button>
          {kpis.total_leads > 0 && onDeleteAll && (
            <button
              onClick={onDeleteAll}
              className="px-3.5 py-2 bg-rose-950/60 hover:bg-rose-900 text-rose-300 border border-rose-800/80 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              title="Permanently wipe all leads & pipeline data"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Delete All</span>
            </button>
          )}
        </div>
      </div>

      {/* SECTION 1: Lead Ingestion & Quality Funnel */}
      <div>
        <div className="flex items-center justify-between mb-3 px-1">
          <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-600"></span>
            <span>1. Lead Intake & Corporate Domain Verification</span>
          </h3>
          <span className="text-[11px] text-slate-400">Step 1 of 3</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {ingestionMetrics.map(renderMetricCard)}
        </div>
      </div>

      {/* SECTION 2: AI Intelligence & Fit Scoring */}
      <div>
        <div className="flex items-center justify-between mb-3 px-1">
          <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-purple-600"></span>
            <span>2. Public Intelligence, Technology Stack & ICP Fit</span>
          </h3>
          <span className="text-[11px] text-slate-400">Step 2 of 3</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {intelligenceMetrics.map(renderMetricCard)}
        </div>
      </div>

      {/* SECTION 3: Outreach & Commercial Conversion */}
      <div>
        <div className="flex items-center justify-between mb-3 px-1">
          <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
            <span>3. Email Outreach & Commercial Conversion</span>
          </h3>
          <span className="text-[11px] text-slate-400">Step 3 of 3</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-4 gap-3">
          {outreachMetrics.map(renderMetricCard)}
        </div>
      </div>

      {/* Strategic Insights & Recommendations (Agent 12) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-6">
        <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-2xs space-y-3">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-800">Analytical Insights</h4>
                <p className="text-[10px] text-slate-400">Agent 12 Automated Pipeline Evaluation</p>
              </div>
            </div>
            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
              {insights.response_rate_percent}% Response Rate
            </span>
          </div>

          <ul className="space-y-2.5">
            {insights.key_insights && insights.key_insights.length > 0 ? (
              insights.key_insights.map((insight, idx) => (
                <li key={idx} className="flex items-start gap-2.5 text-xs text-slate-600 leading-relaxed">
                  <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  <span>{insight}</span>
                </li>
              ))
            ) : (
              <li className="text-xs text-slate-500 py-3 text-center">
                All inbound indicators and response metrics are operating within normal operational baselines.
              </li>
            )}
          </ul>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-2xs space-y-3">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                <TrendingUp className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-800">Strategic Recommendations</h4>
                <p className="text-[10px] text-slate-400">Data-driven suggestions for BPO scaling</p>
              </div>
            </div>
            <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200">
              {insights.positive_conversion_percent}% Positive Conversion
            </span>
          </div>

          <ul className="space-y-2.5">
            {insights.strategic_recommendations && insights.strategic_recommendations.length > 0 ? (
              insights.strategic_recommendations.map((rec, idx) => (
                <li key={idx} className="flex items-start gap-2.5 text-xs text-slate-600 leading-relaxed">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-600 shrink-0 mt-1.5"></span>
                  <span>{rec}</span>
                </li>
              ))
            ) : (
              <li className="text-xs text-slate-500 py-3 text-center">
                Continue standard cadence processing. Ingest additional leads to unlock automated optimization recommendations.
              </li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
};
