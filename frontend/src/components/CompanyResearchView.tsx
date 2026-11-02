import React, { useState, useEffect } from 'react';
import { 
  Building2, Globe, CheckCircle, ShieldCheck, AlertCircle, 
  ExternalLink, Layers, Search, Cpu, Target, Flag, Bug, Loader2, Trash2
} from 'lucide-react';
import { Lead } from '../types';

interface CompanyResearchViewProps {
  leads: Lead[];
  onTriggerResearch: (leadId: string) => Promise<void>;
  onDeleteLead?: (leadId: string) => Promise<void>;
  onDeleteAll?: () => Promise<void>;
}

export const CompanyResearchView: React.FC<CompanyResearchViewProps> = ({ leads, onTriggerResearch, onDeleteLead, onDeleteAll }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const researchedLeads = leads.filter(l => l.research_report);
  const [selectedLeadId, setSelectedLeadId] = useState<string>(
    researchedLeads[0]?.id || leads[0]?.id || ''
  );

  useEffect(() => {
    if ((!selectedLeadId || !leads.some(l => l.id === selectedLeadId)) && leads.length > 0) {
      setSelectedLeadId(researchedLeads[0]?.id || leads[0]?.id);
    }
  }, [leads, selectedLeadId]);

  const activeLead = leads.find(l => l.id === selectedLeadId);
  const report = activeLead?.research_report;

  const handleTrigger = async (leadId: string) => {
    setIsProcessing(true);
    try {
      await onTriggerResearch(leadId);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Companies List Left Sidebar */}
      <div className="lg:col-span-4 bg-white rounded-xl border border-slate-200 p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            Researched Entities ({researchedLeads.length})
          </h3>
          <div className="flex items-center gap-2">
            {leads.length > 0 && onDeleteAll && (
              <button
                onClick={onDeleteAll}
                className="text-[11px] text-rose-600 hover:text-rose-700 font-semibold flex items-center gap-1 bg-rose-50 hover:bg-rose-100 px-2 py-0.5 rounded cursor-pointer transition-colors"
                title="Delete all leads and research data"
              >
                <Trash2 className="w-3 h-3" />
                <span>Delete All</span>
              </button>
            )}
            <span className="text-[11px] text-blue-600 font-semibold bg-blue-50 px-2 py-0.5 rounded">
              Agent 3 & 4
            </span>
          </div>
        </div>

        <div className="space-y-1.5 max-h-[750px] overflow-y-auto">
          {leads.length > 0 ? (
            leads.map((lead) => {
              const isSelected = lead.id === selectedLeadId;
              const hasReport = !!lead.research_report;
              return (
                <div
                  key={lead.id}
                  onClick={() => setSelectedLeadId(lead.id)}
                  className={`w-full text-left p-3 rounded-lg border text-xs transition-all cursor-pointer group ${
                    isSelected 
                      ? 'border-blue-600 bg-blue-50/50 shadow-xs' 
                      : 'border-slate-100 hover:border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-slate-800 truncate">{lead.company_name}</span>
                    <div className="flex items-center gap-1.5">
                      {onDeleteLead && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (window.confirm(`Delete lead '${lead.company_name}'?`)) {
                              onDeleteLead(lead.id);
                            }
                          }}
                          className="p-1 text-slate-300 hover:text-rose-600 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Delete lead"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                      {hasReport ? (
                        <span className="w-2 h-2 rounded-full bg-emerald-500" title="Researched"></span>
                      ) : (
                        <span className="w-2 h-2 rounded-full bg-amber-400" title="Pending Research"></span>
                      )}
                    </div>
                  </div>
                  <div className="text-[11px] text-slate-500 flex items-center justify-between">
                    <span>{lead.industry || 'Enterprise'}</span>
                    <span className="font-mono text-[10px] text-slate-400">{lead.domain_confidence_score}% match</span>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="py-8 text-center text-xs text-slate-400">
              No companies currently in research queue.
            </div>
          )}
        </div>
      </div>

      {/* Main Intelligence Dossier */}
      <div className="lg:col-span-8 bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        {activeLead ? (
          report ? (
            <div className="space-y-6">
              {/* Header profile */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-100">
                      Confidence Score: {report.confidence_score}%
                    </span>
                    <span className="text-xs text-slate-400">|</span>
                    <span className="text-xs text-slate-500 font-medium">{report.business_model || 'B2B Enterprise'}</span>
                  </div>
                  <h2 className="text-xl font-bold text-slate-900">{activeLead.company_name}</h2>
                  {activeLead.website_url && (
                    <a
                      href={activeLead.website_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-blue-600 hover:underline flex items-center gap-1 mt-1 font-mono"
                    >
                      <Globe className="w-3.5 h-3.5" />
                      <span>{activeLead.website_url}</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onTriggerResearch(activeLead.id)}
                    className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                  >
                    Re-crawl Website
                  </button>
                  {onDeleteLead && (
                    <button
                      onClick={() => {
                        if (window.confirm(`Delete lead '${activeLead.company_name}' and its research dossier?`)) {
                          onDeleteLead(activeLead.id);
                        }
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors cursor-pointer"
                      title="Delete lead"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete Lead</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Company Overview */}
              <div>
                <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-blue-600" />
                  <span>Company Overview & Value Proposition</span>
                </h4>
                <div className="bg-slate-50 p-4 rounded-xl text-xs text-slate-700 leading-relaxed border border-slate-200">
                  {report.company_overview}
                </div>
              </div>

              {/* Operating Countries & Target Customers */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="border border-slate-200 rounded-xl p-4">
                  <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5 mb-2">
                    <Target className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Target Customer Segments</span>
                  </span>
                  <p className="text-xs text-slate-600 leading-relaxed">{report.target_customers}</p>
                </div>
                <div className="border border-slate-200 rounded-xl p-4">
                  <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5 mb-2">
                    <Flag className="w-3.5 h-3.5 text-rose-600" />
                    <span>Geographic Footprint</span>
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {report.operating_countries?.map((c, i) => (
                      <span key={i} className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                        {c}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Detected Tech Stack & Digital Gaps */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="border border-slate-200 rounded-xl p-4">
                  <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5 mb-2">
                    <Cpu className="w-3.5 h-3.5 text-blue-600" />
                    <span>Detected Tech Stack ({report.tech_stack_detected?.length || 0})</span>
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {report.tech_stack_detected?.length ? (
                      report.tech_stack_detected.map((tech, i) => (
                        <span key={i} className="px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-100">
                          {tech}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-slate-400">No public framework signatures detected.</span>
                    )}
                  </div>
                </div>

                <div className="border border-slate-200 rounded-xl p-4">
                  <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5 mb-2">
                    <Bug className="w-3.5 h-3.5 text-amber-600" />
                    <span>Observable Website / Marketing Gaps</span>
                  </span>
                  <ul className="space-y-1.5 text-xs text-slate-600">
                    {[...(report.website_issues || []), ...(report.digital_marketing_gaps || [])].map((issue, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                        <span>{issue}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Crawled Public Pages */}
              {report.pages && report.pages.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-slate-600" />
                    <span>Public Crawled Pages ({report.pages.length})</span>
                  </h4>
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 font-semibold">
                        <tr>
                          <th className="py-2.5 px-3">Page Type</th>
                          <th className="py-2.5 px-3">Title</th>
                          <th className="py-2.5 px-3">URL</th>
                          <th className="py-2.5 px-3">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {report.pages.map((p) => (
                          <tr key={p.id} className="hover:bg-slate-50">
                            <td className="py-2 px-3 font-semibold text-blue-600">{p.page_type}</td>
                            <td className="py-2 px-3 text-slate-700">{p.page_title || 'Untitled'}</td>
                            <td className="py-2 px-3 text-slate-400 font-mono text-[10px] truncate max-w-xs">{p.url}</td>
                            <td className="py-2 px-3">
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700">
                                {p.status_code}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="py-12 text-center text-slate-500 space-y-3">
              <Building2 className="w-12 h-12 text-slate-300 mx-auto" />
              <h3 className="font-semibold text-slate-800 text-sm">Research Pending for {activeLead.company_name}</h3>
              <p className="text-xs max-w-md mx-auto text-slate-400">
                Trigger the website crawler and company intelligence analyzer to generate a factual dossier.
              </p>
              <button
                onClick={() => handleTrigger(activeLead.id)}
                disabled={isProcessing}
                className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-lg shadow-sm flex items-center gap-2 mx-auto disabled:opacity-60 cursor-pointer"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Executing Agent 3 & 4 Crawler...</span>
                  </>
                ) : (
                  <span>Execute Website Research (Agent 3 & 4)</span>
                )}
              </button>
            </div>
          )
        ) : (
          <div className="py-12 text-center text-slate-400">Select a company from the list to view intelligence.</div>
        )}
      </div>
    </div>
  );
};
