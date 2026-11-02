import React, { useState } from 'react';
import { 
  Upload, Plus, Search, Filter, Play, CheckCircle2, 
  AlertTriangle, Flame, Globe, ExternalLink, X, ShieldAlert,
  ChevronRight, Sparkles, Building2, UserCheck, Lock, Trash2
} from 'lucide-react';
import { Lead } from '../types';
import { api } from '../services/api';

interface LeadsViewProps {
  leads: Lead[];
  onUpload: (file: File) => Promise<void>;
  onTriggerPipeline: (leadId: string) => Promise<void>;
  onVerifyManually: (leadId: string) => Promise<void>;
  onCreateLead: (data: Partial<Lead>) => Promise<void>;
  onDeleteLead?: (leadId: string) => Promise<void>;
}

export const LeadsView: React.FC<LeadsViewProps> = ({
  leads,
  onUpload,
  onTriggerPipeline,
  onVerifyManually,
  onCreateLead,
  onDeleteLead,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const currentUser = api.getCurrentUser();
  const canUpload = ['SUPER_ADMIN', 'ADMINISTRATOR', 'SENIOR_MANAGER', 'BPO_TEAM_LEADER', 'RESEARCH_EXECUTIVE'].includes(currentUser?.role);
  const canVerify = ['SUPER_ADMIN', 'ADMINISTRATOR', 'SENIOR_MANAGER', 'BPO_TEAM_LEADER'].includes(currentUser?.role);

  // Manual lead form state
  const [formData, setFormData] = useState<Partial<Lead>>({
    company_name: '',
    contact_person: '',
    designation: '',
    business_email: '',
    contact_number: '',
    country: 'United States',
    industry: 'Healthcare & Life Sciences',
    website_url: '',
  });

  const filteredLeads = leads.filter((lead) => {
    const matchesSearch = 
      lead.company_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.business_email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (lead.contact_person || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.lead_code.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = !statusFilter || lead.lead_status === statusFilter;
    const matchesCategory = !categoryFilter || lead.lead_score_category === categoryFilter;

    return matchesSearch && matchesStatus && matchesCategory;
  });

  const handleFileUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile) return;
    setIsUploading(true);
    try {
      await onUpload(uploadFile);
      setIsUploadModalOpen(false);
      setUploadFile(null);
    } catch (err) {
      alert('Upload failed: ' + (err as any).message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.company_name || !formData.business_email) {
      alert('Company Name and Business Email are required.');
      return;
    }
    await onCreateLead(formData);
    setIsManualModalOpen(false);
    setFormData({
      company_name: '',
      contact_person: '',
      designation: '',
      business_email: '',
      contact_number: '',
      country: 'United States',
      industry: 'Information Technology',
      website_url: '',
    });
  };

  return (
    <div className="space-y-4">
      {/* Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search by company, email, lead ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-1.5 text-xs border border-slate-200 rounded-lg w-64 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="">All Pipeline Stages</option>
            <option value="NEW">New</option>
            <option value="IN_RESEARCH">In Research</option>
            <option value="SCORED">Scored</option>
            <option value="AWAITING_APPROVAL">Awaiting Approval</option>
            <option value="EMAIL_SENT">Email Sent</option>
            <option value="ENGAGED">Engaged</option>
            <option value="NEEDS_VERIFICATION">Needs Verification</option>
          </select>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="text-xs border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="">All Scores</option>
            <option value="HOT">Hot Leads</option>
            <option value="WARM">Warm Leads</option>
            <option value="COLD">Cold Leads</option>
            <option value="NEEDS_VERIFICATION">Needs Verification</option>
          </select>
        </div>

        {canUpload ? (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsManualModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Manual Lead</span>
            </button>

            <button
              onClick={() => setIsUploadModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-lg shadow-sm transition-colors cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Bulk Upload (.xlsx / .csv)</span>
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 border border-slate-200 text-slate-500 rounded-lg text-xs font-medium">
            <Lock className="w-3.5 h-3.5" />
            <span>Auditor Read-Only Mode</span>
          </div>
        )}
      </div>

      {/* Leads Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                <th className="py-3 px-4">Lead ID & Company</th>
                <th className="py-3 px-4">Contact Person</th>
                <th className="py-3 px-4">Corporate Email</th>
                <th className="py-3 px-4">Industry / Country</th>
                <th className="py-3 px-4">Verification</th>
                <th className="py-3 px-4">Score & Grade</th>
                <th className="py-3 px-4">Pipeline Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLeads.length > 0 ? (
                filteredLeads.map((lead) => (
                  <tr 
                    key={lead.id} 
                    className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                    onClick={() => setSelectedLead(lead)}
                  >
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-800">{lead.company_name}</div>
                      <div className="text-[10px] text-slate-400 font-mono mt-0.5">{lead.lead_code}</div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-700">{lead.contact_person || '—'}</div>
                      <div className="text-[10px] text-slate-400">{lead.designation || 'Executive'}</div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-mono text-slate-600">{lead.business_email}</span>
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      <div>{lead.industry || 'Enterprise'}</div>
                      <div className="text-[10px] text-slate-400">{lead.country}</div>
                    </td>
                    <td className="py-3 px-4">
                      {lead.is_company_verified ? (
                        <span 
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100"
                          title={lead.verification_reason || `Verified corporate domain (${lead.domain_confidence_score}%)`}
                        >
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Verified ({lead.domain_confidence_score}%)</span>
                        </span>
                      ) : (
                        <div className="relative group inline-block">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200 cursor-help">
                            <AlertTriangle className="w-3 h-3 text-amber-600" />
                            <span>{lead.domain_confidence_score}% (&lt; 70% req.)</span>
                          </span>
                          <div className="hidden group-hover:block absolute left-0 bottom-full mb-1.5 z-40 w-72 p-2.5 bg-slate-900 text-white text-[11px] rounded-lg shadow-2xl pointer-events-none">
                            <div className="font-bold text-amber-400 mb-1 flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" />
                              <span>Reason Below 70% Threshold:</span>
                            </div>
                            <p className="text-slate-200 leading-tight">
                              {lead.verification_reason || "Email domain could not be verified against company identity or used free public email host."}
                            </p>
                            <div className="mt-1.5 pt-1.5 border-t border-slate-700 text-[10px] text-slate-400">
                              Click row to see full audit breakdown & reasons
                            </div>
                          </div>
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${
                          lead.lead_score_category === 'HOT' ? 'bg-rose-500' :
                          lead.lead_score_category === 'WARM' ? 'bg-orange-500' : 'bg-slate-400'
                        }`} />
                        <span className="font-bold text-slate-700">{lead.lead_score}/100</span>
                        <span className="text-[10px] text-slate-400 uppercase font-medium">({lead.lead_score_category})</span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                        {lead.status_display || lead.lead_status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1.5">
                        {!lead.is_company_verified && canVerify && (
                          <button
                            onClick={() => onVerifyManually(lead.id)}
                            className="p-1.5 text-amber-600 hover:text-amber-700 hover:bg-amber-50 rounded cursor-pointer"
                            title="Verify Company Identity (Management Override)"
                          >
                            <UserCheck className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => onTriggerPipeline(lead.id)}
                          className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors cursor-pointer"
                          title="Run autonomous AI pipeline"
                        >
                          <Play className="w-3 h-3 fill-current" />
                          <span>Run AI</span>
                        </button>
                        {onDeleteLead && (
                          <button
                            onClick={() => {
                              if (window.confirm(`Delete lead '${lead.company_name}'? This removes associated reports and drafts.`)) {
                                onDeleteLead(lead.id);
                              }
                            }}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                            title="Delete Lead"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    No leads found matching your search and filter criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Lead Detail Drawer */}
      {selectedLead && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex justify-end z-50 transition-opacity">
          <div className="w-full max-w-xl bg-white h-full shadow-2xl flex flex-col p-6 overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200">
              <div>
                <span className="text-[10px] font-mono font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                  {selectedLead.lead_code}
                </span>
                <h3 className="text-lg font-bold text-slate-900 mt-1">{selectedLead.company_name}</h3>
                <p className="text-xs text-slate-500">{selectedLead.business_email} • {selectedLead.industry}</p>
              </div>
              <div className="flex items-center gap-2">
                {onDeleteLead && (
                  <button
                    onClick={() => {
                      if (window.confirm(`Delete lead '${selectedLead.company_name}'?`)) {
                        onDeleteLead(selectedLead.id);
                        setSelectedLead(null);
                      }
                    }}
                    className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors cursor-pointer"
                    title="Delete this lead"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete</span>
                  </button>
                )}
                <button onClick={() => setSelectedLead(null)} className="p-1 text-slate-400 hover:text-slate-600 rounded cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="py-4 space-y-6">
              {/* Domain Verification & Confidence Audit Card */}
              <div className={`p-4 rounded-xl border ${
                selectedLead.is_company_verified 
                  ? 'bg-emerald-50/50 border-emerald-200' 
                  : 'bg-amber-50/70 border-amber-200'
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {selectedLead.is_company_verified ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-amber-600" />
                    )}
                    <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                      Domain Verification & Confidence Audit
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className={`text-sm font-extrabold ${
                      selectedLead.is_company_verified ? 'text-emerald-700' : 'text-amber-800'
                    }`}>
                      {selectedLead.domain_confidence_score}%
                    </span>
                    <span className="text-[10px] text-slate-500 font-medium">
                      (Min. Required: 70%)
                    </span>
                  </div>
                </div>

                {/* Visual Progress Bar with 70% requirement marker */}
                <div className="w-full bg-slate-200 rounded-full h-2 mb-3 relative overflow-hidden">
                  <div
                    className={`h-2 rounded-full transition-all ${
                      selectedLead.is_company_verified 
                        ? 'bg-emerald-500' 
                        : selectedLead.domain_confidence_score >= 50 ? 'bg-amber-500' : 'bg-rose-500'
                    }`}
                    style={{ width: `${Math.min(100, Math.max(5, selectedLead.domain_confidence_score))}%` }}
                  />
                  <div 
                    className="absolute top-0 bottom-0 w-0.5 bg-slate-700 z-10" 
                    style={{ left: '70%' }} 
                    title="Mandatory 70% Threshold"
                  />
                </div>

                {/* Reason Explanation */}
                <div className="space-y-2 text-xs">
                  <div className="flex items-start gap-2 bg-white/90 p-2.5 rounded-lg border border-slate-200/80">
                    <span className="font-semibold text-slate-700 shrink-0">Analysis:</span>
                    <span className="text-slate-700 leading-snug">
                      {selectedLead.verification_reason || 
                        (selectedLead.is_company_verified 
                          ? `Domain '@${selectedLead.extracted_domain || selectedLead.business_email.split('@')[1]}' is verified and associated with '${selectedLead.company_name}'.`
                          : `Domain confidence score is ${selectedLead.domain_confidence_score}%, below the mandatory 70% threshold required for automated outreach.`)}
                    </span>
                  </div>

                  {/* Itemized Reasons if less than required percentage */}
                  {selectedLead.domain_confidence_score < 70 && (
                    <div className="bg-amber-100/70 p-3 rounded-lg border border-amber-200 text-[11px] text-amber-950 space-y-1.5">
                      <div className="font-bold flex items-center gap-1.5 text-amber-900">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-700" />
                        <span>Why is the verification percentage below the 70% requirement?</span>
                      </div>
                      <ul className="list-disc list-inside space-y-1 pl-1 text-amber-900/90 leading-relaxed">
                        {selectedLead.verification_details?.identified_reasons ? (
                          selectedLead.verification_details.identified_reasons.map((r, i) => (
                            <li key={i}>{r}</li>
                          ))
                        ) : (
                          <>
                            {(!selectedLead.is_business_domain || ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'live.com'].some(d => (selectedLead.business_email || '').toLowerCase().includes(d))) && (
                              <li><strong>Free/Public Email Host:</strong> Email uses a generic provider (@{(selectedLead.business_email || '').split('@')[1] || 'generic'}) rather than an authenticated corporate domain (-45% deduction).</li>
                            )}
                            {!selectedLead.domain_company_matched && (
                              <li><strong>Company Name Mismatch:</strong> The email domain name does not clearly match the registered organization '{selectedLead.company_name}' (-30% deduction).</li>
                            )}
                            {!selectedLead.website_url && (
                              <li><strong>Missing Website URL:</strong> No company website URL was provided to corroborate and cross-verify domain ownership (-15% deduction).</li>
                            )}
                          </>
                        )}
                      </ul>
                      
                      {canVerify && (
                        <div className="pt-2 mt-2 border-t border-amber-200/80 flex items-center justify-between">
                          <span className="text-[10px] text-amber-800 font-medium">Management manual sign-off:</span>
                          <button
                            onClick={() => {
                              onVerifyManually(selectedLead.id);
                              setSelectedLead({ 
                                ...selectedLead, 
                                is_company_verified: true, 
                                domain_confidence_score: 90, 
                                manual_verification_required: false,
                                verification_reason: `Manually verified and approved by management override.`
                              });
                            }}
                            className="px-2.5 py-1 text-[11px] font-bold text-amber-900 bg-amber-200 hover:bg-amber-300 rounded shadow-xs transition-colors cursor-pointer"
                          >
                            Verify Identity Now
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Scoring breakdown */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-slate-700">Lead Qualification Score</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-base font-bold text-blue-600">{selectedLead.lead_score} / 100</span>
                    <span className="text-[10px] font-semibold text-slate-400 uppercase">({selectedLead.lead_score_category})</span>
                  </div>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed mb-3">
                  {selectedLead.score_explanation || "Computed multi-factor score based on company verification, active website presence, and requirement detection."}
                </p>
                {selectedLead.score_breakdown && (
                  <div className="grid grid-cols-3 gap-2 text-[11px] pt-2 border-t border-slate-200 text-slate-500">
                    {Object.entries(selectedLead.score_breakdown).map(([k, v]) => (
                      <div key={k}>
                        <span className="capitalize text-slate-400 block">{k.replace('_', ' ')}</span>
                        <span className="font-semibold text-slate-700">{String(v)}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Qualification Score Deductions if score is below 70 */}
                {selectedLead.lead_score < 70 && (
                  <div className="mt-3 pt-2.5 border-t border-slate-200 text-[11px] text-slate-600">
                    <span className="font-semibold text-slate-700 block mb-1">
                      Key Factors Reducing Qualification Score (&lt; 70 pts):
                    </span>
                    <ul className="list-disc list-inside space-y-0.5 text-slate-500 text-[10px]">
                      {selectedLead.domain_confidence_score < 70 && (
                        <li>Company domain verification incomplete or below 70% threshold (lost up to 12 pts).</li>
                      )}
                      {(!selectedLead.requirements || selectedLead.requirements.length === 0) && (
                        <li>No concrete technical service requirements discovered yet (lost up to 15 pts).</li>
                      )}
                      {!selectedLead.website_url && (
                        <li>No active business website available for autonomous crawling (lost up to 15 pts).</li>
                      )}
                    </ul>
                  </div>
                )}
              </div>

              {/* Research Report Summary */}
              {selectedLead.research_report ? (
                <div>
                  <h4 className="text-xs font-semibold text-slate-800 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                    <span>Company Intelligence Summary</span>
                  </h4>
                  <p className="text-xs text-slate-600 leading-relaxed bg-blue-50/50 p-3 rounded-lg border border-blue-100">
                    {selectedLead.research_report.company_overview || "No overview available."}
                  </p>

                  <div className="mt-3">
                    <span className="text-[11px] font-medium text-slate-500 block mb-1.5">Detected Tech Stack:</span>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedLead.research_report.tech_stack_detected?.map((t, i) => (
                        <span key={i} className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-6 bg-slate-50 rounded-xl border border-dashed border-slate-300">
                  <p className="text-xs text-slate-500 mb-2">Website research not yet executed.</p>
                  <button
                    onClick={() => onTriggerPipeline(selectedLead.id)}
                    className="px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-500"
                  >
                    Run Crawler & Research Now
                  </button>
                </div>
              )}

              {/* Requirements identified */}
              {selectedLead.requirements && selectedLead.requirements.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-slate-800 uppercase tracking-wider mb-2">
                    Identified Business Requirements ({selectedLead.requirements.length})
                  </h4>
                  <div className="space-y-2">
                    {selectedLead.requirements.map((req) => (
                      <div key={req.id} className="p-3 bg-white rounded-lg border border-slate-200 text-xs">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-semibold text-slate-800">{req.title}</span>
                          <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-blue-50 text-blue-700">
                            {req.priority}
                          </span>
                        </div>
                        <p className="text-slate-600 text-[11px] mb-1.5">{req.potential_business_problem}</p>
                        <div className="text-[10px] text-slate-400">
                          <strong>Evidence:</strong> {req.evidence_found}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Bulk Upload Modal */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
              <h3 className="font-bold text-slate-800 text-sm">Bulk Lead Ingestion</h3>
              <button onClick={() => setIsUploadModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleFileUpload} className="space-y-4">
              <div className="border-2 border-dashed border-slate-300 rounded-xl p-6 text-center hover:border-blue-500 transition-colors">
                <Upload className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                <p className="text-xs font-medium text-slate-700 mb-1">Select Excel (.xlsx) or CSV file</p>
                <p className="text-[11px] text-slate-400 mb-2">Supported columns: <b>Company Name</b>, <b>Business Email</b>, Contact Person, Phone, Website, Industry.</p>
                <p className="text-[10px] text-blue-600 bg-blue-50 py-1 px-2 rounded mb-3">Auto-deduplication & cleaning applied automatically.</p>
                <input
                  type="file"
                  accept=".csv, .xlsx, .xls"
                  onChange={(e) => setUploadFile(e.target.files ? e.target.files[0] : null)}
                  className="text-xs text-slate-500 file:mr-4 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsUploadModalOpen(false)}
                  className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!uploadFile || isUploading}
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-lg disabled:opacity-50"
                >
                  {isUploading ? 'Ingesting...' : 'Ingest Leads'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Manual Entry Modal */}
      {isManualModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
              <h3 className="font-bold text-slate-800 text-sm">Add New Lead Manually</h3>
              <button onClick={() => setIsManualModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleManualSubmit} className="space-y-3">
              <div className="bg-blue-50/70 border border-blue-200 rounded-lg p-2.5 text-[11px] text-blue-900 leading-snug">
                <span className="font-bold flex items-center gap-1 text-blue-950 mb-0.5">
                  <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                  <span>Domain Verification Policy (70% Minimum Threshold):</span>
                </span>
                <p className="text-blue-800">
                  Using a corporate domain that matches the company name scores <strong>85–100%</strong> (auto-verified). Free emails (e.g. Gmail, Yahoo) score <strong>25%</strong> and domain mismatches score <strong>55%</strong>, which require management manual verification override.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Company Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.company_name}
                    onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg p-2 focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g. Apex Health Systems"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Business Email *</label>
                  <input
                    type="email"
                    required
                    value={formData.business_email}
                    onChange={(e) => setFormData({ ...formData, business_email: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg p-2 focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g. contact@apexhealth.com"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Contact Person</label>
                  <input
                    type="text"
                    value={formData.contact_person}
                    onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg p-2 focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g. Dr. Sarah Jenkins"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Designation</label>
                  <input
                    type="text"
                    value={formData.designation}
                    onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg p-2 focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g. Chief Information Officer"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Website URL</label>
                  <input
                    type="url"
                    value={formData.website_url}
                    onChange={(e) => setFormData({ ...formData, website_url: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg p-2 focus:ring-2 focus:ring-blue-500"
                    placeholder="https://company.com"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Industry</label>
                  <input
                    type="text"
                    value={formData.industry}
                    onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg p-2 focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsManualModalOpen(false)}
                  className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-lg"
                >
                  Save & Trigger AI
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
