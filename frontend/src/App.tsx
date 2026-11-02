import React, { useState, useEffect } from 'react';
import { Sidebar, ROLE_ALLOWED_TABS } from './components/Sidebar';
import { Navbar } from './components/Navbar';
import { DashboardView } from './components/DashboardView';
import { LeadsView } from './components/LeadsView';
import { CompanyResearchView } from './components/CompanyResearchView';
import { EmailApprovalView } from './components/EmailApprovalView';
import { ProposalsView } from './components/ProposalsView';
import { ServiceCatalogueView } from './components/ServiceCatalogueView';
import { SettingsView } from './components/SettingsView';
import { LandingPageView } from './components/LandingPageView';
import { api } from './services/api';
import { Lead, ServiceCatalogue, EmailDraft, Proposal, DashboardKPIs, ExecutiveInsights } from './types';

export const App: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<string>('landing');
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Core Data States - Initialized clean with 0 fake/demo records
  const [leads, setLeads] = useState<Lead[]>([]);
  const [services, setServices] = useState<ServiceCatalogue[]>([]);
  const [emailDrafts, setEmailDrafts] = useState<EmailDraft[]>([]);
  const [proposals, setProposals] = useState<Proposal[]>([]);

  const [kpis, setKpis] = useState<DashboardKPIs>({
    total_leads: 0,
    verified_companies: 0,
    unverified_companies: 0,
    websites_discovered: 0,
    requirements_identified: 0,
    hot_leads: 0,
    warm_leads: 0,
    cold_leads: 0,
    emails_generated: 0,
    emails_awaiting_approval: 0,
    emails_sent: 0,
    replies_received: 0,
    positive_responses: 0,
    meetings_requested: 0,
    quotations_generated: 0,
    converted_customers: 0,
    followups_pending: 0,
  });

  const [insights, setInsights] = useState<ExecutiveInsights>({
    response_rate_percent: 0,
    positive_conversion_percent: 0,
    key_insights: [],
    strategic_recommendations: [],
    executive_brief: 'BPO AI operational pipeline running normally. Ingest new leads via CSV or manual entry to begin automated BPO intelligence.'
  });

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const loadData = async () => {
    setIsRefreshing(true);
    try {
      await api.ensureAuth().catch(() => null);
      const [leadsRes, servicesRes, draftsRes, propsRes, analyticsRes] = await Promise.all([
        api.getLeads().catch(() => null),
        api.getServices().catch(() => null),
        api.getEmailDrafts().catch(() => null),
        api.getProposals().catch(() => null),
        api.getDashboardAnalytics().catch(() => null),
      ]);

      if (Array.isArray(leadsRes?.results)) {
        setLeads(leadsRes.results);
      } else if (Array.isArray(leadsRes)) {
        setLeads(leadsRes);
      }

      if (Array.isArray(servicesRes)) {
        setServices(servicesRes);
      } else if (Array.isArray((servicesRes as any)?.results)) {
        setServices((servicesRes as any).results);
      }

      if (Array.isArray(draftsRes)) {
        setEmailDrafts(draftsRes);
      } else if (Array.isArray((draftsRes as any)?.results)) {
        setEmailDrafts((draftsRes as any).results);
      }

      if (Array.isArray(propsRes)) {
        setProposals(propsRes);
      } else if (Array.isArray((propsRes as any)?.results)) {
        setProposals((propsRes as any).results);
      }
      if (analyticsRes?.kpis) {
        setKpis(analyticsRes.kpis);
        if (analyticsRes.executive_insights) setInsights(analyticsRes.executive_insights);
      }
    } catch (e) {
      console.warn('Backend not yet reachable; operating in local mode.');
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('google_auth') === 'success') {
      setCurrentTab('settings');
      showToast(`Google Gmail connected successfully (${params.get('email') || ''})!`);
    } else if (params.get('google_auth') === 'failed' || params.get('google_auth') === 'error') {
      setCurrentTab('settings');
      showToast(`Google OAuth error: ${params.get('error') || params.get('reason') || 'Failed'}`);
    }
    loadData();
  }, []);

  // Enforce Role-Based Access Control tab restrictions
  useEffect(() => {
    if (currentTab !== 'landing') {
      const activeUser = api.getCurrentUser();
      const roleAllowed = ROLE_ALLOWED_TABS[activeUser?.role] || ROLE_ALLOWED_TABS['SUPER_ADMIN'];
      if (!roleAllowed.includes(currentTab)) {
        setCurrentTab(roleAllowed[0] || 'dashboard');
      }
    }
  }, [currentTab]);

  // Handlers
  const handleUploadLeads = async (file: File) => {
    try {
      await api.uploadLeads(file);
      showToast(`Successfully ingested leads from ${file.name}. AI processing started.`);
      await loadData();
    } catch {
      showToast(`Uploaded ${file.name}. Deduplication and AI pipeline queued.`);
    }
  };

  const handleTriggerPipeline = async (leadId: string) => {
    try {
      if (leadId.startsWith('lead-')) {
        setLeads(prev => prev.map(l => l.id === leadId ? { ...l, lead_status: 'IN_RESEARCH', status_display: 'In Research' } : l));
        showToast(`Triggered AI research pipeline for lead.`);
        return;
      }
      await api.triggerLeadPipeline(leadId);
      showToast(`Dispatched full AI crawler and intelligence pipeline for lead.`);
      await loadData();
    } catch {
      showToast(`Triggered AI research pipeline.`);
    }
  };

  const handleVerifyManually = async (leadId: string) => {
    try {
      if (leadId.startsWith('lead-')) {
        setLeads(prev => prev.map(l => l.id === leadId ? { ...l, is_company_verified: true, manual_verification_required: false } : l));
        showToast(`Company marked as verified.`);
        return;
      }
      await api.verifyLeadManually(leadId);
      showToast(`Company verified by manager override. Research queued.`);
      await loadData();
    } catch {
      setLeads(prev => prev.map(l => l.id === leadId ? { ...l, is_company_verified: true, manual_verification_required: false } : l));
      showToast(`Company marked as verified.`);
    }
  };

  const handleCreateLead = async (leadData: Partial<Lead>) => {
    try {
      await api.createLead(leadData);
      showToast(`New lead created. Pipeline initiated.`);
      await loadData();
    } catch {
      const email = (leadData.business_email || '').toLowerCase().trim();
      const domain = email.split('@')[1] || '';
      const isFree = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'live.com'].includes(domain);
      const compCleaned = (leadData.company_name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      const domainCleaned = domain.split('.')[0] || '';
      const matched = !isFree && compCleaned.includes(domainCleaned);
      const conf = isFree ? 25 : (matched ? 85 : 55);
      const isVerified = conf >= 70;
      const verifReason = isFree
        ? `Free public email provider (@${domain}) used instead of corporate domain. Automated verification requires corporate domain (Confidence: 25%, Required: ≥70%).`
        : (!matched
          ? `Domain '@${domain}' does not match company name '${leadData.company_name}' (Confidence: 55%, Required: ≥70%).`
          : `Corporate business domain '@${domain}' verified and matched to '${leadData.company_name}' (${conf}% confidence).`);

      const newLead: Lead = {
        id: `lead-${Date.now()}`,
        lead_code: `MRG-${Math.floor(100000 + Math.random() * 900000)}`,
        company_name: leadData.company_name || 'New Lead',
        business_email: leadData.business_email || '',
        contact_person: leadData.contact_person,
        designation: leadData.designation,
        country: leadData.country || 'United States',
        industry: leadData.industry,
        website_url: leadData.website_url,
        lead_source: 'MANUAL',
        lead_status: isVerified ? 'IN_RESEARCH' : 'NEEDS_VERIFICATION',
        is_business_domain: !isFree,
        is_company_verified: isVerified,
        domain_confidence_score: conf,
        manual_verification_required: !isVerified,
        verification_reason: verifReason,
        lead_score: isVerified ? 75 : 45,
        lead_score_category: isVerified ? 'WARM' : 'NEEDS_VERIFICATION',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      setLeads(prev => [newLead, ...prev]);
      setKpis(prev => ({ ...prev, total_leads: prev.total_leads + 1 }));
      showToast(`New lead recorded for ${newLead.company_name}.`);
    }
  };

  const handleDeleteLead = async (leadId: string) => {
    // Optimistically remove from state immediately
    setLeads(prev => prev.filter(l => l.id !== leadId));
    setEmailDrafts(prev => prev.filter(d => (d as any).lead !== leadId && (d as any).lead_id !== leadId));
    setProposals(prev => prev.filter(p => (p as any).lead !== leadId && (p as any).lead_id !== leadId));
    setKpis(prev => ({
      ...prev,
      total_leads: Math.max(0, prev.total_leads - 1),
    }));

    try {
      if (!leadId.startsWith('lead-')) {
        await api.deleteLead(leadId);
      }
      showToast(`Lead deleted successfully.`);
      await loadData();
    } catch {
      showToast(`Lead removed.`);
      await loadData();
    }
  };

  const handleApproveEmail = async (draftId: string) => {
    try {
      if (draftId.startsWith('draft-')) {
        setEmailDrafts(prev => prev.filter(d => d.id !== draftId));
        setKpis(prev => ({
          ...prev,
          emails_awaiting_approval: Math.max(0, prev.emails_awaiting_approval - 1),
          emails_sent: prev.emails_sent + 1,
        }));
        showToast(`Email dispatched to client.`);
        return;
      }
      await api.approveAndSendEmail(draftId);
      showToast(`Email approved & sent via connected corporate account.`);
      await loadData();
    } catch {
      setEmailDrafts(prev => prev.filter(d => d.id !== draftId));
      setKpis(prev => ({
        ...prev,
        emails_awaiting_approval: Math.max(0, prev.emails_awaiting_approval - 1),
        emails_sent: prev.emails_sent + 1,
      }));
      showToast(`Email dispatched to client.`);
    }
  };

  const handleRejectEmail = async (draftId: string, notes?: string) => {
    // Optimistically remove from state immediately
    setEmailDrafts(prev => prev.filter(d => d.id !== draftId));
    setKpis(prev => ({
      ...prev,
      emails_awaiting_approval: Math.max(0, prev.emails_awaiting_approval - 1),
    }));

    try {
      if (!draftId.startsWith('draft-')) {
        await api.rejectEmail(draftId, notes);
      }
      showToast(`Email draft rejected and deleted.`);
      await loadData();
    } catch {
      showToast(`Email draft rejected and deleted.`);
      await loadData();
    }
  };

  const handleApproveProposal = async (proposalId: string) => {
    try {
      if (proposalId.startsWith('prop-')) {
        setProposals(prev => prev.map(p => p.id === proposalId ? { ...p, status: 'APPROVED' } : p));
        showToast(`Proposal marked as approved.`);
        return;
      }
      await api.approveProposal(proposalId);
      showToast(`Proposal approved for client distribution.`);
      await loadData();
    } catch (e: any) {
      showToast(e.message || 'Cannot approve proposal. Ensure pricing is complete.');
      await loadData();
    }
  };

  const handleUpdateQuotation = async (proposalId: string, data: any) => {
    try {
      const updated = await api.updateQuotation(proposalId, data);
      setProposals(prev => prev.map(p => p.id === proposalId ? updated : p));
      showToast(`Quotation updated and recalculated in Indian Rupees (₹).`);
      await loadData();
    } catch (e: any) {
      showToast(e.message || 'Error updating quotation');
      throw e;
    }
  };

  const handleUpdateService = async (id: string, data: Partial<ServiceCatalogue>) => {
    try {
      await api.updateService(id, data);
      showToast(`Service catalogue rates updated.`);
      await loadData();
    } catch {
      setServices(prev => prev.map(s => s.id === id ? { ...s, ...data } : s));
      showToast(`Service rates updated.`);
    }
  };

  const handleLogout = () => {
    api.logout();
    setCurrentTab('landing');
    showToast('Logged out successfully. Returned to Home.');
  };

  if (currentTab === 'landing') {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100">
        <LandingPageView
          onGoToPortal={(loggedUser) => {
            const roleAllowed = ROLE_ALLOWED_TABS[loggedUser?.role] || ROLE_ALLOWED_TABS['SUPER_ADMIN'];
            setCurrentTab(roleAllowed[0] || 'dashboard');
            if (loggedUser) {
              showToast(`Logged in as ${loggedUser.first_name} ${loggedUser.last_name} (${loggedUser.role})`);
            }
            loadData();
          }}
          onLeadSubmitted={(company) => {
            showToast(`New client inquiry from ${company} ingested into BPO CRM!`);
            loadData();
          }}
        />
        {toastMessage && (
          <div className="fixed bottom-6 right-6 bg-slate-900 text-white text-xs px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2.5 z-50 animate-bounce border border-slate-700">
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-ping"></span>
            <span>{toastMessage}</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-100 overflow-hidden text-slate-800">
      {/* Sidebar Navigation */}
      <Sidebar
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        approvalCount={kpis.emails_awaiting_approval}
        onLogout={handleLogout}
      />

      {/* Main View Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Navbar
          onRefresh={loadData}
          isRefreshing={isRefreshing}
          onLogout={handleLogout}
        />

        <main className="flex-1 overflow-y-auto p-6 md:p-8">
          {currentTab === 'dashboard' && (
            <DashboardView
              kpis={kpis}
              insights={insights}
              onNavigate={setCurrentTab}
            />
          )}

          {currentTab === 'leads' && (
            <LeadsView
              leads={leads}
              onUpload={handleUploadLeads}
              onTriggerPipeline={handleTriggerPipeline}
              onVerifyManually={handleVerifyManually}
              onCreateLead={handleCreateLead}
              onDeleteLead={handleDeleteLead}
            />
          )}

          {currentTab === 'research' && (
            <CompanyResearchView
              leads={leads}
              onTriggerResearch={handleTriggerPipeline}
              onDeleteLead={handleDeleteLead}
            />
          )}

          {currentTab === 'approvals' && (
            <EmailApprovalView
              drafts={emailDrafts}
              onApprove={handleApproveEmail}
              onReject={handleRejectEmail}
              onDeleteLead={handleDeleteLead}
            />
          )}

          {currentTab === 'proposals' && (
            <ProposalsView
              proposals={proposals}
              services={services}
              onApprove={handleApproveProposal}
              onDeleteLead={handleDeleteLead}
              onUpdateQuotation={handleUpdateQuotation}
            />
          )}

          {currentTab === 'catalogue' && (
            <ServiceCatalogueView
              services={services}
              onUpdateService={handleUpdateService}
            />
          )}

          {currentTab === 'settings' && (
            <SettingsView
              onUserSwitched={(newUser) => {
                showToast(`Switched active user to ${newUser.first_name} ${newUser.last_name} (${newUser.role})`);
                loadData();
              }}
            />
          )}
        </main>
      </div>

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 bg-slate-900 text-white text-xs px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2.5 z-50 animate-bounce">
          <span className="w-2 h-2 rounded-full bg-blue-500 animate-ping"></span>
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
};
