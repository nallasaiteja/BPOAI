import React, { useState } from 'react';
import { 
  Upload, Plus, Search, Filter, Play, CheckCircle2, 
  AlertTriangle, Flame, Globe, ExternalLink, X, ShieldAlert,
  ChevronRight, Sparkles, Building2, UserCheck, Lock, Trash2,
  TrendingUp, ArrowRight, User
} from 'lucide-react';
import { Lead } from '../types';
import { api } from '../services/api';
import { IntelligentImportModal } from './IntelligentImportModal';

interface LeadsViewProps {
  leads: Lead[];
  onUpload: (file: File) => Promise<void>;
  onTriggerPipeline: (leadId: string) => Promise<void>;
  onVerifyManually: (leadId: string) => Promise<void>;
  onCreateLead: (data: Partial<Lead>) => Promise<void>;
  onDeleteLead?: (leadId: string) => Promise<void>;
  onDeleteAll?: () => Promise<void>;
  onRefresh?: () => Promise<void>;
  showToast?: (msg: string) => void;
}

export const LeadsView: React.FC<LeadsViewProps> = ({
  leads,
  onUpload,
  onTriggerPipeline,
  onVerifyManually,
  onCreateLead,
  onDeleteLead,
  onDeleteAll,
  onRefresh,
  showToast,
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
    } catch (err: any) {
      alert('Upload failed: ' + (err?.message || 'Could not parse file'));
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
      {/* Responsive Filter Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Search and Filters */}
          <div className="flex flex-wrap items-center gap-2.5 flex-1">
            <div className="relative flex-1 min-w-[220px] sm:max-w-xs">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search company, email, code..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-slate-800 shadow-3xs"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white font-medium text-slate-700 shadow-3xs cursor-pointer"
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
              className="text-xs border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white font-medium text-slate-700 shadow-3xs cursor-pointer"
            >
              <option value="">All Scores</option>
              <option value="HOT">Hot Leads (≥ 75)</option>
              <option value="WARM">Warm Leads (50-74)</option>
              <option value="COLD">Cold Leads (&lt; 50)</option>
              <option value="NEEDS_VERIFICATION">Needs Verification</option>
            </select>
          </div>

          {/* Action Buttons */}
          {canUpload ? (
            <div className="flex flex-wrap items-center gap-2">
              {leads.length > 0 && onDeleteAll && (
                <button
                  onClick={onDeleteAll}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl transition-colors cursor-pointer shadow-3xs"
                  title="Delete All Leads: Permanently clears all leads, company research, and generated drafts from the CRM database."
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Delete All</span>
                </button>
              )}

              <button
                onClick={() => setIsManualModalOpen(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200/80 border border-slate-200 rounded-xl transition-colors cursor-pointer shadow-3xs"
                title="Add Lead Manually: Enter a single company name, corporate email, and website to ingest into the CRM."
              >
                <Plus className="w-3.5 h-3.5 text-slate-600" />
                <span>Add Lead</span>
              </button>

              <button
                onClick={() => setIsUploadModalOpen(true)}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-xl shadow-md transition-colors cursor-pointer"
                title="Bulk Upload (.xlsx / .csv): Upload lead lists with automatic header detection, fuzzy column mapping, deduplication, and formula injection guards."
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Bulk Upload</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 border border-slate-200 text-slate-500 rounded-xl text-xs font-medium">
              <Lock className="w-3.5 h-3.5" />
              <span>Auditor Read-Only Mode</span>
            </div>
          )}
        </div>
      </div>

      {/* Responsive View: Desktop Table (hidden on small mobile) */}
      <div className="hidden md:block bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                <th className="py-3.5 px-4">Lead ID & Company</th>
                <th className="py-3.5 px-4">Contact Person</th>
                <th className="py-3.5 px-4">Corporate Email</th>
                <th className="py-3.5 px-4">Industry / Country</th>
                <th className="py-3.5 px-4">Verification</th>
                <th className="py-3.5 px-4">Score & Grade</th>
                <th className="py-3.5 px-4">Pipeline Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLeads.length > 0 ? (
                filteredLeads.map((lead) => (
                  <tr 
                    key={lead.id} 
                    className="hover:bg-blue-50/40 transition-colors cursor-pointer group"
                    onClick={() => setSelectedLead(lead)}
                  >
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-800 group-hover:text-blue-700 transition-colors">{lead.company_name}</div>
                      <div className="text-[10px] text-slate-400 font-mono mt-0.5">{lead.lead_code}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-medium text-slate-700">{lead.contact_person || '—'}</div>
                      <div className="text-[10px] text-slate-400">{lead.designation || 'Executive'}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="font-mono text-slate-600">{lead.business_email}</span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-600">
                      <div>{lead.industry || 'Enterprise'}</div>
                      <div className="text-[10px] text-slate-400">{lead.country}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      {lead.is_company_verified ? (
                        <span 
                          className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200"
                          title={lead.verification_reason || `Verified corporate domain (${lead.domain_confidence_score}%)`}
                        >
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span>Verified ({lead.domain_confidence_score}%)</span>
                        </span>
                      ) : (
                        <div className="relative group/tooltip inline-block">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200 cursor-help">
                            <AlertTriangle className="w-3 h-3 text-amber-600" />
                            <span>{lead.domain_confidence_score}% (&lt; 70%)</span>
                          </span>
                          <div className="hidden group-hover/tooltip:block absolute left-0 bottom-full mb-1.5 z-40 w-72 p-2.5 bg-slate-900 text-white text-[11px] rounded-xl shadow-2xl pointer-events-none">
                            <div className="font-bold text-amber-400 mb-1 flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" />
                              <span>Reason Below 70% Threshold:</span>
                            </div>
                            <p className="text-slate-200 leading-tight">
                              {lead.verification_reason || "Email domain could not be verified against company identity or used free public email host."}
                            </p>
                          </div>
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${
                          lead.lead_score_category === 'HOT' ? 'bg-rose-500' :
                          lead.lead_score_category === 'WARM' ? 'bg-orange-500' : 'bg-slate-400'
                        }`} />
                        <span className="font-bold text-slate-700">{lead.lead_score}/100</span>
                        <span className="text-[10px] text-slate-400 uppercase font-medium">({lead.lead_score_category})</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                        {lead.status_display || lead.lead_status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1.5">
                        {!lead.is_company_verified && canVerify && (
                          <button
                            onClick={() => onVerifyManually(lead.id)}
                            className="p-1.5 text-amber-600 hover:text-amber-700 hover:bg-amber-50 rounded-lg cursor-pointer"
                            title="Management Override: Manually verify this company's corporate identity and approve for Company Intelligence."
                          >
                            <UserCheck className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => onTriggerPipeline(lead.id)}
                          className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors cursor-pointer"
                          title="Run Intelligence Pipeline: Crawl this company's website, extract structured facts, and compute 100-point ICP fit score."
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
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
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
                  <td colSpan={8} className="py-12 text-center text-slate-400 text-xs">
                    No leads found matching your search and filter criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Responsive View: Mobile Card List (active on screens < 768px) */}
      <div className="md:hidden space-y-3">
        {filteredLeads.length > 0 ? (
          filteredLeads.map((lead) => (
            <div 
              key={lead.id}
              onClick={() => setSelectedLead(lead)}
              className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs space-y-3 cursor-pointer hover:border-blue-300 transition-colors"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h4 className="font-bold text-slate-800 text-sm leading-tight">{lead.company_name}</h4>
                  <span className="text-[10px] font-mono text-slate-400">{lead.lead_code}</span>
                </div>
                {lead.is_company_verified ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    <span>{lead.domain_confidence_score}%</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                    <AlertTriangle className="w-3 h-3 text-amber-600" />
                    <span>{lead.domain_confidence_score}%</span>
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                <div>
                  <span className="text-[10px] text-slate-400 block font-medium">Contact:</span>
                  <span className="font-semibold text-slate-700 truncate block">{lead.contact_person || '—'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block font-medium">Score:</span>
                  <span className="font-bold text-slate-800">{lead.lead_score}/100</span> ({lead.lead_score_category})
                </div>
                <div className="col-span-2">
                  <span className="text-[10px] text-slate-400 block font-medium">Email:</span>
                  <span className="font-mono text-[11px] text-slate-600 truncate block">{lead.business_email}</span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1 border-t border-slate-100" onClick={(e) => e.stopPropagation()}>
                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                  {lead.status_display || lead.lead_status}
                </span>

                <div className="flex items-center gap-1.5">
                  {!lead.is_company_verified && canVerify && (
                    <button
                      onClick={() => onVerifyManually(lead.id)}
                      className="p-1.5 text-amber-700 bg-amber-50 border border-amber-200 rounded-lg text-xs"
                      title="Verify Manually"
                    >
                      <UserCheck className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    onClick={() => onTriggerPipeline(lead.id)}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-lg shadow-2xs"
                  >
                    <Play className="w-3 h-3 fill-current" />
                    <span>Run AI</span>
                  </button>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center text-slate-400 text-xs">
            No leads found matching your filters.
          </div>
        )}
      </div>

      {/* Lead Detail Drawer */}
      {selectedLead && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex justify-end z-50 transition-opacity">
          <div className="w-full max-w-xl bg-white h-full shadow-2xl flex flex-col p-5 sm:p-6 overflow-y-auto animate-in slide-in-from-right duration-200">
            <div className="flex items-start justify-between pb-4 border-b border-slate-200 gap-3">
              <div>
                <span className="text-[10px] font-mono font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100">
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
                    className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl transition-colors cursor-pointer"
                    title="Delete Lead"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete</span>
                  </button>
                )}
                <button 
                  onClick={() => setSelectedLead(null)} 
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
                  title="Close"
                  aria-label="Close detail drawer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="py-4 space-y-5">
              {/* Domain Verification & Confidence Audit Card */}
              <div className={`p-4 rounded-2xl border ${
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
                      Domain Verification Audit
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
                    title="Required Verification Threshold (70%)"
                  />
                </div>

                <div className="text-xs space-y-1.5 bg-white/80 p-3 rounded-xl border border-slate-200/80">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Corporate Domain Match:</span>
                    <span className="font-semibold text-slate-800">{selectedLead.is_business_domain ? 'Valid Business Domain' : 'Public Email Provider'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Verification Status:</span>
                    <span className={`font-bold ${selectedLead.is_company_verified ? 'text-emerald-700' : 'text-amber-700'}`}>
                      {selectedLead.is_company_verified ? 'Verified for Automation' : 'Manual Review Required'}
                    </span>
                  </div>
                  <div className="pt-1.5 border-t border-slate-100">
                    <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider mb-0.5">Verification Diagnostic Reason:</span>
                    <p className="text-slate-700 leading-relaxed font-medium">
                      {selectedLead.verification_reason || 'Verified corporate domain against registered company identity.'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Lead Details Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-1">
                  <span className="text-[10px] text-slate-400 block uppercase font-bold tracking-wider">Contact Person</span>
                  <p className="font-bold text-slate-800">{selectedLead.contact_person || '—'}</p>
                  <p className="text-[11px] text-slate-500">{selectedLead.designation || 'Executive'}</p>
                </div>

                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-1">
                  <span className="text-[10px] text-slate-400 block uppercase font-bold tracking-wider">Website URL</span>
                  {selectedLead.website_url ? (
                    <a 
                      href={selectedLead.website_url} 
                      target="_blank" 
                      rel="noreferrer" 
                      className="font-medium text-blue-600 hover:text-blue-800 flex items-center gap-1 truncate"
                    >
                      <Globe className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{selectedLead.website_url}</span>
                    </a>
                  ) : (
                    <span className="text-slate-400">Not provided</span>
                  )}
                </div>

                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-1">
                  <span className="text-[10px] text-slate-400 block uppercase font-bold tracking-wider">Industry & Region</span>
                  <p className="font-semibold text-slate-800">{selectedLead.industry || 'General Sector'}</p>
                  <p className="text-[11px] text-slate-500">{selectedLead.country}</p>
                </div>

                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-1">
                  <span className="text-[10px] text-slate-400 block uppercase font-bold tracking-wider">Lead Fit Score</span>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold text-slate-800">{selectedLead.lead_score}/100</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      selectedLead.lead_score_category === 'HOT' ? 'bg-rose-100 text-rose-800' :
                      selectedLead.lead_score_category === 'WARM' ? 'bg-orange-100 text-orange-800' : 'bg-slate-200 text-slate-700'
                    }`}>
                      {selectedLead.lead_score_category}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons in Drawer */}
              <div className="pt-2 flex flex-wrap items-center gap-2.5">
                {!selectedLead.is_company_verified && canVerify && (
                  <button
                    onClick={() => {
                      onVerifyManually(selectedLead.id);
                      setSelectedLead(prev => prev ? { ...prev, is_company_verified: true, manual_verification_required: false } : null);
                    }}
                    className="flex-1 px-4 py-2 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-500 rounded-xl shadow-sm transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <UserCheck className="w-4 h-4" />
                    <span>Approve Verification Override</span>
                  </button>
                )}

                <button
                  onClick={() => {
                    onTriggerPipeline(selectedLead.id);
                    setSelectedLead(null);
                  }}
                  className="flex-1 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-xl shadow-sm transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Play className="w-4 h-4 fill-current" />
                  <span>Run Company Intelligence</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Manual Add Lead */}
      {isManualModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2 text-slate-800 font-bold text-base">
                <Building2 className="w-5 h-5 text-blue-600" />
                <span>Add Single Lead</span>
              </div>
              <button 
                onClick={() => setIsManualModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer"
                aria-label="Close dialog"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleManualSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="sm:col-span-2 space-y-1">
                  <label className="font-semibold text-slate-700 flex items-center gap-1">
                    <span>Company Name</span>
                    <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Acme Health Technologies"
                    value={formData.company_name}
                    onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div className="sm:col-span-2 space-y-1">
                  <label className="font-semibold text-slate-700 flex items-center gap-1">
                    <span>Corporate Business Email</span>
                    <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="contact@acmehealth.com"
                    value={formData.business_email}
                    onChange={(e) => setFormData({ ...formData, business_email: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                  <p className="text-[10px] text-slate-400">Must be a corporate domain for automatic verification (score ≥ 70%).</p>
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Contact Person</label>
                  <input
                    type="text"
                    placeholder="Dr. Sarah Johnson"
                    value={formData.contact_person}
                    onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Designation / Title</label>
                  <input
                    type="text"
                    placeholder="Chief Medical Officer"
                    value={formData.designation}
                    onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Website URL</label>
                  <input
                    type="url"
                    placeholder="https://acmehealth.com"
                    value={formData.website_url}
                    onChange={(e) => setFormData({ ...formData, website_url: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Industry</label>
                  <input
                    type="text"
                    placeholder="Healthcare & Life Sciences"
                    value={formData.industry}
                    onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsManualModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-xl shadow-sm transition-colors cursor-pointer"
                >
                  Create & Run Verification
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Intelligent Bulk Import Modal */}
      <IntelligentImportModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onSuccess={async () => {
          if (onRefresh) await onRefresh();
        }}
        showToast={showToast}
      />
    </div>
  );
};
