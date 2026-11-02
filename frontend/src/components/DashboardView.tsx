import React from 'react';
import { 
  Users, Building2, Globe, Flame, Mail, Clock, Send, 
  MessageSquare, CalendarCheck, FileCheck, DollarSign,
  TrendingUp, CheckCircle, AlertCircle, Sparkles, ArrowRight, Trash2
} from 'lucide-react';
import { DashboardKPIs, ExecutiveInsights } from '../types';

interface DashboardViewProps {
  kpis: DashboardKPIs;
  insights: ExecutiveInsights;
  onNavigate: (tab: string) => void;
  onDeleteAll?: () => Promise<void>;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ kpis, insights, onNavigate, onDeleteAll }) => {
  const metricCards = [
    { label: 'Total Ingested Leads', value: kpis.total_leads, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100' },
    { label: 'Verified Companies', value: kpis.verified_companies, icon: Building2, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' },
    { label: 'Unverified / Flagged', value: kpis.unverified_companies, icon: AlertCircle, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-100' },
    { label: 'Websites Discovered', value: kpis.websites_discovered, icon: Globe, color: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-100' },
    { label: 'Requirements Identified', value: kpis.requirements_identified, icon: Sparkles, color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-100' },
    { label: 'Hot Qualified Leads', value: kpis.hot_leads, icon: Flame, color: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-100' },
    { label: 'Warm Pipeline Leads', value: kpis.warm_leads, icon: TrendingUp, color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-100' },
    { label: 'AI Emails Generated', value: kpis.emails_generated, icon: Mail, color: 'text-cyan-600', bg: 'bg-cyan-50', border: 'border-cyan-100' },
    { label: 'Awaiting Approval', value: kpis.emails_awaiting_approval, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-100', highlight: true },
    { label: 'Emails Sent', value: kpis.emails_sent, icon: Send, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100' },
    { label: 'Replies Received', value: kpis.replies_received, icon: MessageSquare, color: 'text-teal-600', bg: 'bg-teal-50', border: 'border-teal-100' },
    { label: 'Positive Responses', value: kpis.positive_responses, icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' },
    { label: 'Meetings Requested', value: kpis.meetings_requested, icon: CalendarCheck, color: 'text-violet-600', bg: 'bg-violet-50', border: 'border-violet-100' },
    { label: 'Quotations Created', value: kpis.quotations_generated, icon: FileCheck, color: 'text-slate-700', bg: 'bg-slate-100', border: 'border-slate-200' },
    { label: 'Converted Customers', value: kpis.converted_customers, icon: DollarSign, color: 'text-emerald-700', bg: 'bg-emerald-100', border: 'border-emerald-200' },
    { label: 'Pending Follow-ups', value: kpis.followups_pending, icon: Clock, color: 'text-sky-600', bg: 'bg-sky-50', border: 'border-sky-100' },
  ];

  return (
    <div className="space-y-6">
      {/* Top Banner & Quick Actions */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-blue-950 rounded-2xl p-6 text-white shadow-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-500/20 text-blue-300 border border-blue-400/30">
              Agent 12 Active • Executive Brief
            </span>
          </div>
          <h2 className="text-xl md:text-2xl font-bold tracking-tight">Merugu AI BPO Mission Control</h2>
          <p className="text-slate-300 text-xs md:text-sm mt-1 max-w-2xl">
            {insights.executive_brief || "Autonomous lead qualification, website crawling, requirement synthesis, and email outreach for Merugu Global."}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => onNavigate('leads')}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold shadow-md transition-all flex items-center gap-2"
          >
            <span>Upload Leads</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onNavigate('approvals')}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold transition-all flex items-center gap-2"
          >
            <span>Approval Queue ({kpis.emails_awaiting_approval})</span>
          </button>
          {kpis.total_leads > 0 && onDeleteAll && (
            <button
              onClick={onDeleteAll}
              className="px-3.5 py-2 bg-rose-950/60 hover:bg-rose-900 text-rose-300 border border-rose-800/80 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer"
              title="Permanently wipe all leads & pipeline data"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete All Data</span>
            </button>
          )}
        </div>
      </div>

      {/* 16 KPI Cards Grid */}
      <div>
        <h3 className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-3">
          Module 12 Real-Time Key Performance Indicators
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          {metricCards.map((card, idx) => {
            const Icon = card.icon;
            return (
              <div 
                key={idx}
                className={`bg-white rounded-xl p-3 border ${card.border} shadow-sm hover:shadow-md transition-shadow relative overflow-hidden`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className={`w-7 h-7 rounded-lg ${card.bg} ${card.color} flex items-center justify-center`}>
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  {card.highlight && card.value > 0 && (
                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping"></span>
                  )}
                </div>
                <div className="text-lg font-bold text-slate-800">{card.value}</div>
                <div className="text-[11px] font-medium text-slate-600 leading-tight mt-0.5">{card.label}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Agent 12 Strategic Insights & Recommendations */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-600" />
              <h4 className="text-sm font-semibold text-slate-800">Agent 12: Analytical Insights</h4>
            </div>
            <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">
              Response Rate: {insights.response_rate_percent}%
            </span>
          </div>
          <ul className="space-y-2.5">
            {insights.key_insights && insights.key_insights.length > 0 ? (
              insights.key_insights.map((insight, idx) => (
                <li key={idx} className="flex items-start gap-2.5 text-xs text-slate-600">
                  <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  <span>{insight}</span>
                </li>
              ))
            ) : (
              <li className="text-xs text-slate-600">All inbound indicators are performing normally.</li>
            )}
          </ul>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-blue-600" />
              <h4 className="text-sm font-semibold text-slate-800">Operational Recommendations</h4>
            </div>
            <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100">
              Positive Conv: {insights.positive_conversion_percent}%
            </span>
          </div>
          <ul className="space-y-2.5">
            {insights.strategic_recommendations && insights.strategic_recommendations.length > 0 ? (
              insights.strategic_recommendations.map((rec, idx) => (
                <li key={idx} className="flex items-start gap-2.5 text-xs text-slate-600">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-600 shrink-0 mt-1.5"></span>
                  <span>{rec}</span>
                </li>
              ))
            ) : (
              <li className="text-xs text-slate-600">Continue standard cadence processing.</li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
};
