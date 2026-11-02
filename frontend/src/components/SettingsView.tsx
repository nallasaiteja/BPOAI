import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, Lock, Mail, Cpu, Server, CheckCircle2, 
  AlertTriangle, Users, Bot, Sliders, ExternalLink, RefreshCw, LogOut,
  Sparkles, Key, UserCheck, ArrowRightLeft, Shield, Trash2
} from 'lucide-react';
import { api } from '../services/api';

interface SettingsViewProps {
  onUserSwitched?: (user: any) => void;
  onDeleteAll?: () => Promise<void>;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ onUserSwitched, onDeleteAll }) => {
  const [googleStatus, setGoogleStatus] = useState<{ configured: boolean; connected: boolean; email?: string | null; sender_name?: string; client_id?: string }>({
    configured: false,
    connected: false,
    email: null
  });
  const [isLoadingGoogle, setIsLoadingGoogle] = useState(false);
  const [googleMessage, setGoogleMessage] = useState<string | null>(null);

  // Active Session & Switching
  const [switchingUser, setSwitchingUser] = useState<string | null>(null);
  const currentUser = api.getCurrentUser();

  // Google Gemini AI Engine State
  const [geminiStatus, setGeminiStatus] = useState<{ provider: string; configured: boolean; model: string; masked_key?: string }>({
    provider: 'Google Gemini',
    configured: false,
    model: 'gemini-2.0-flash',
  });
  const [geminiInputKey, setGeminiInputKey] = useState('');
  const [geminiModel, setGeminiModel] = useState('gemini-2.0-flash');
  const [isSavingGemini, setIsSavingGemini] = useState(false);
  const [geminiSuccessMsg, setGeminiSuccessMsg] = useState<string | null>(null);

  const fetchGoogleStatus = async () => {
    setIsLoadingGoogle(true);
    try {
      const res = await api.getGoogleAuthStatus();
      setGoogleStatus(res);
    } catch {
      // Ignored
    } finally {
      setIsLoadingGoogle(false);
    }
  };

  const fetchGeminiStatus = async () => {
    try {
      const res = await api.getGeminiStatus();
      setGeminiStatus(res);
      if (res.model) setGeminiModel(res.model);
    } catch {
      // Ignored
    }
  };

  useEffect(() => {
    fetchGoogleStatus();
    fetchGeminiStatus();

    // Check if redirected from Google OAuth
    const params = new URLSearchParams(window.location.search);
    if (params.get('google_auth') === 'success') {
      setGoogleMessage(`Successfully connected Gmail account: ${params.get('email') || ''}`);
      window.history.replaceState({}, document.title, window.location.pathname);
      fetchGoogleStatus();
    } else if (params.get('google_auth') === 'failed' || params.get('google_auth') === 'error') {
      setGoogleMessage(`Google connection failed: ${params.get('error') || params.get('reason') || 'Unknown error'}`);
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const handleConnectGoogle = async () => {
    try {
      const res = await api.getGoogleAuthUrl();
      if (res.auth_url) {
        window.location.href = res.auth_url;
      }
    } catch (e: any) {
      alert(e.message || 'GOOGLE_CLIENT_ID is not configured in backend/.env yet.');
    }
  };

  const handleDisconnectGoogle = async () => {
    if (!confirm('Are you sure you want to disconnect this Google account?')) return;
    try {
      await api.disconnectGoogleAuth();
      setGoogleMessage('Google account disconnected.');
      fetchGoogleStatus();
    } catch (e: any) {
      alert('Error disconnecting: ' + e.message);
    }
  };

  const handleSaveGemini = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingGemini(true);
    setGeminiSuccessMsg(null);
    try {
      await api.saveGeminiConfig(geminiInputKey, geminiModel);
      setGeminiSuccessMsg('Gemini AI configuration saved successfully!');
      setGeminiInputKey('');
      await fetchGeminiStatus();
    } catch (e: any) {
      alert('Error saving Gemini configuration: ' + (e.message || 'Unknown error'));
    } finally {
      setIsSavingGemini(false);
    }
  };

  const SEEDED_ACCOUNTS = [
    {
      name: 'Hemanth Merugu',
      username: 'admin',
      password: 'adminpassword123',
      role: 'Super Administrator',
      roleCode: 'SUPER_ADMIN',
      email: 'admin@meruguglobal.com',
      badgeColor: 'bg-purple-50 text-purple-700 border-purple-200',
      permissions: 'Full system master, AI configuration, pricing rules, final SOW approval',
    },
    {
      name: 'Anita Sharma',
      username: 'administrator',
      password: 'password123',
      role: 'Administrator',
      roleCode: 'ADMINISTRATOR',
      email: 'anita.s@meruguglobal.com',
      badgeColor: 'bg-indigo-50 text-indigo-700 border-indigo-200',
      permissions: 'User provisioning, campaign management, pricing catalogue rules',
    },
    {
      name: 'Rajesh Verma',
      username: 'manager',
      password: 'password123',
      role: 'Senior Manager',
      roleCode: 'SENIOR_MANAGER',
      email: 'rajesh.v@meruguglobal.com',
      badgeColor: 'bg-blue-50 text-blue-700 border-blue-200',
      permissions: 'Approval of proposals & outbound emails, consumer domain verification override',
    },
    {
      name: 'Priya Patel',
      username: 'teamlead',
      password: 'password123',
      role: 'BPO Team Leader',
      roleCode: 'BPO_TEAM_LEADER',
      email: 'priya.p@meruguglobal.com',
      badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      permissions: 'Lead assignment, pipeline monitoring, research validation, queue oversight',
    },
    {
      name: 'Vikram Rao',
      username: 'researcher',
      password: 'password123',
      role: 'Research Executive',
      roleCode: 'RESEARCH_EXECUTIVE',
      email: 'vikram.r@meruguglobal.com',
      badgeColor: 'bg-cyan-50 text-cyan-700 border-cyan-200',
      permissions: 'Lead CSV/Excel upload, website crawl initiation, technology stack auditing',
    },
    {
      name: 'Sneha Reddy',
      username: 'emailmarketer',
      password: 'password123',
      role: 'Email Marketing Executive',
      roleCode: 'EMAIL_MARKETING_EXECUTIVE',
      email: 'sneha.r@meruguglobal.com',
      badgeColor: 'bg-amber-50 text-amber-700 border-amber-200',
      permissions: 'Email draft reviewing, subject line editing, Day 0/3/7/14 cadence orchestration',
    },
    {
      name: 'Rohan Mehta',
      username: 'salesexec',
      password: 'password123',
      role: 'Sales Executive',
      roleCode: 'SALES_EXECUTIVE',
      email: 'rohan.m@meruguglobal.com',
      badgeColor: 'bg-orange-50 text-orange-700 border-orange-200',
      permissions: 'CRM reply monitoring, positive intent classification, consultation scheduling',
    },
    {
      name: 'Suresh Kumar',
      username: 'accountant',
      password: 'password123',
      role: 'Accounts Executive',
      roleCode: 'ACCOUNTS_EXECUTIVE',
      email: 'suresh.k@meruguglobal.com',
      badgeColor: 'bg-rose-50 text-rose-700 border-rose-200',
      permissions: 'Quotation review, commercial pricing sign-off, invoice reconciliation',
    },
    {
      name: 'Neha Joshi',
      username: 'auditor',
      password: 'password123',
      role: 'Read-only Auditor',
      roleCode: 'READ_ONLY',
      email: 'neha.j@meruguglobal.com',
      badgeColor: 'bg-slate-100 text-slate-700 border-slate-200',
      permissions: 'Compliance auditing, SLA metric observation, read-only system inspection',
    },
  ];

  const handleSwitchAccount = async (acc: typeof SEEDED_ACCOUNTS[0]) => {
    setSwitchingUser(acc.username);
    try {
      await api.login(acc.username, acc.password);
      setGoogleMessage(`Active session switched to ${acc.name} (${acc.role})!`);
      if (onUserSwitched) onUserSwitched(api.getCurrentUser());
    } catch (err: any) {
      alert('Error switching account: ' + (err.message || 'Login failed'));
    } finally {
      setSwitchingUser(null);
    }
  };

  const roles = [
    { role: 'Super Administrator', access: 'Full system control, pricing master, AI config, tenant settings' },
    { role: 'Administrator', access: 'User provisioning, campaign management, pricing rules' },
    { role: 'Senior Manager', access: 'Approval of proposals & outbound emails, executive reporting' },
    { role: 'BPO Team Leader', access: 'Lead assignment, pipeline monitoring, research validation' },
    { role: 'Research Executive', access: 'Lead data upload, company intelligence review, manual override' },
    { role: 'Email Marketing Executive', access: 'Email draft editing, campaign cadence management' },
    { role: 'Sales Executive', access: 'CRM response monitoring, meeting scheduling, lead conversion' },
    { role: 'Accounts Executive', access: 'Quotation review, invoice reconciliation, commercial sign-off' },
    { role: 'Read-only User', access: 'Auditing, metric observation, compliance verification' },
  ];

  const agents = [
    { name: 'Agent 1: Lead Validation Agent', duty: 'Validates syntax, identifies missing fields, flags anomalies', status: 'Online' },
    { name: 'Agent 2: Company Discovery Agent', duty: 'Matches email domain with corporate entity and official registry', status: 'Online' },
    { name: 'Agent 3: Website Research Agent', duty: 'Polite crawl, tech stack detection, responsive check', status: 'Online' },
    { name: 'Agent 4: Business Intelligence Agent', duty: 'Synthesizes business models, products, operating regions', status: 'Online' },
    { name: 'Agent 5: Requirement Analysis Agent', duty: 'Identifies gaps across 20 technical categories with evidence', status: 'Online' },
    { name: 'Agent 6: Lead Scoring Agent', duty: 'Computes explainable 100-pt lead score across 6 factors', status: 'Online' },
    { name: 'Agent 7: Service Matching Agent', duty: 'Matches needs strictly to Merugu Global catalogue', status: 'Online' },
    { name: 'Agent 8: Email Generation Agent', duty: 'Drafts tailored emails across 10 types with zero hallucinations', status: 'Online' },
    { name: 'Agent 9: Proposal Generation Agent', duty: 'Constructs SOWs and technical deliverables with timeline', status: 'Online' },
    { name: 'Agent 10: Email Response Analysis Agent', duty: 'Classifies reply intent (Interested, Meeting, Opt-Out)', status: 'Online' },
    { name: 'Agent 11: Follow-up Agent', duty: 'Orchestrates Day 3, 7, 14 polite follow-up cadences', status: 'Online' },
    { name: 'Agent 12: Reporting Agent', duty: 'Generates daily operational briefs and conversion analytics', status: 'Online' },
  ];

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <h2 className="text-xl font-bold text-slate-900">System Configuration & Security</h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Role-based access control (RBAC), AI agent orchestrator status, and compliance settings.
        </p>
      </div>

      {googleMessage && (
        <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 text-blue-800 text-xs flex items-center justify-between">
          <span>{googleMessage}</span>
          <button onClick={() => setGoogleMessage(null)} className="font-bold underline ml-4">Dismiss</button>
        </div>
      )}

      {/* Google Workspace / Gmail OAuth Card */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 border border-blue-100 shrink-0">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Google Workspace & Gmail OAuth 2.0 Integration</h3>
              <p className="text-xs text-slate-500">Official Gmail API connection with `gmail.send` scope. Sends real emails without passwords.</p>
            </div>
          </div>
          <div>
            {googleStatus.connected ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Connected
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                Not Connected
              </span>
            )}
          </div>
        </div>

        {googleStatus.connected ? (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div>
              <p className="text-xs font-semibold text-slate-800">Connected Account: <span className="font-bold text-blue-600">{googleStatus.email}</span></p>
              <p className="text-[11px] text-slate-500 mt-0.5">Approved outreach emails in the approval queue will be dispatched directly through this Gmail account.</p>
            </div>
            <button
              onClick={handleDisconnectGoogle}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors cursor-pointer shrink-0"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Disconnect</span>
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-xs text-slate-600 leading-relaxed">
              Connect your Google Workspace or Gmail account via OAuth 2.0 to autonomously send outreach emails directly through the official Google Gmail API upon human approval.
            </p>

            {googleStatus.client_id && (
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-600 font-mono text-[11px] truncate">
                <span className="font-semibold text-slate-800 font-sans">Active Client ID: </span>
                {googleStatus.client_id}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={handleConnectGoogle}
                className="flex items-center gap-2.5 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-all cursor-pointer"
              >
                <Mail className="w-4 h-4" />
                <span>Sign In with Google to Connect Gmail</span>
              </button>

              <button
                onClick={fetchGoogleStatus}
                disabled={isLoadingGoogle}
                className="p-2.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors cursor-pointer"
                title="Refresh Status"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingGoogle ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Google Gemini AI Engine Card */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 border border-indigo-100 shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Google Gemini AI Engine (Active)</h3>
              <p className="text-xs text-slate-500">Powering Agent 3–12 website analysis, intelligence extraction, scoring & email generation.</p>
            </div>
          </div>
          <div>
            {geminiStatus.configured ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Live Gemini API Active ({geminiStatus.model})
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                <Cpu className="w-3.5 h-3.5" />
                Rule-Based Fallback Engine Active (Free / Offline)
              </span>
            )}
          </div>
        </div>

        {geminiSuccessMsg && (
          <div className="mb-4 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center justify-between">
            <span>{geminiSuccessMsg}</span>
            <button onClick={() => setGeminiSuccessMsg(null)} className="font-bold underline ml-2">Dismiss</button>
          </div>
        )}

        <form onSubmit={handleSaveGemini} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2 space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700">
                Gemini API Key {geminiStatus.masked_key && <span className="text-slate-400 font-normal">({geminiStatus.masked_key})</span>}
              </label>
              <div className="relative">
                <input
                  type="password"
                  placeholder={geminiStatus.configured ? "Enter new API key to update" : "AIzaSy..."}
                  value={geminiInputKey}
                  onChange={(e) => setGeminiInputKey(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                />
              </div>
              <p className="text-[11px] text-slate-500">
                Get a free API key from <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-indigo-600 font-medium hover:underline inline-flex items-center gap-0.5">Google AI Studio <ExternalLink className="w-3 h-3 inline" /></a>.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700">Active Model</label>
              <select
                value={geminiModel}
                onChange={(e) => setGeminiModel(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
              >
                <option value="gemini-2.5-flash">Gemini 2.5 Flash (Recommended - Blazing Fast)</option>
                <option value="gemini-2.5-pro">Gemini 2.5 Pro (Deep Complex Reasoning)</option>
                <option value="gemini-flash-latest">Gemini Flash Latest</option>
                <option value="gemini-2.5-flash-lite">Gemini 2.5 Flash Lite</option>
              </select>
              <p className="text-[11px] text-slate-500">
                Default: Gemini 2.5 Flash.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <span className="text-[11px] text-slate-500">
              {geminiStatus.configured 
                ? "Live Gemini model will be invoked for all AI research, requirement analysis, and personalized emails."
                : "Without an API key, all agents run smoothly using the built-in deterministic rule engine for free."}
            </span>
            <button
              type="submit"
              disabled={isSavingGemini}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-all cursor-pointer disabled:opacity-50"
            >
              {isSavingGemini ? "Saving..." : "Save Gemini Settings"}
            </button>
          </div>
        </form>
      </div>

      {/* Enterprise RBAC User Directory & 1-Click Role Switcher */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 border border-indigo-100">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Enterprise User Accounts & Role Directory</h3>
              <p className="text-xs text-slate-500">
                All 9 enterprise roles seeded with credentials. Click "Switch User" to test permissions for any role in real time.
              </p>
            </div>
          </div>
          <div className="text-xs text-slate-600 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
            Active Session: <strong className="text-blue-600">{currentUser?.username || 'admin'}</strong> ({currentUser?.role || 'SUPER_ADMIN'})
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 bg-slate-50/70">
                <th className="py-2.5 px-3 font-semibold">User & Full Name</th>
                <th className="py-2.5 px-3 font-semibold">Role Title</th>
                <th className="py-2.5 px-3 font-semibold">Username & Email</th>
                <th className="py-2.5 px-3 font-semibold">Default Password</th>
                <th className="py-2.5 px-3 font-semibold">Primary Responsibilities</th>
                <th className="py-2.5 px-3 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {SEEDED_ACCOUNTS.map((acc) => {
                const isCurrent = currentUser?.username === acc.username;
                return (
                  <tr key={acc.username} className={`hover:bg-slate-50/60 transition-colors ${isCurrent ? 'bg-blue-50/40' : ''}`}>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-slate-800 text-white flex items-center justify-center text-[10px] font-bold">
                          {acc.name.split(' ').map(n => n[0]).join('')}
                        </div>
                        <div>
                          <span className="font-semibold text-slate-900 block leading-tight">{acc.name}</span>
                          <span className="text-[10px] text-slate-400">Merugu Global Staff</span>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${acc.badgeColor}`}>
                        {acc.role}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <span className="font-mono text-slate-800 font-semibold block">{acc.username}</span>
                      <span className="text-[11px] text-slate-500">{acc.email}</span>
                    </td>
                    <td className="py-3 px-3 font-mono text-[11px] text-slate-600">
                      <code>{acc.password}</code>
                    </td>
                    <td className="py-3 px-3 text-[11px] text-slate-600 max-w-xs">
                      {acc.permissions}
                    </td>
                    <td className="py-3 px-3 text-right">
                      {isCurrent ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Active
                        </span>
                      ) : (
                        <button
                          onClick={() => handleSwitchAccount(acc)}
                          disabled={switchingUser === acc.username}
                          className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-900 hover:bg-blue-600 text-white text-[11px] font-medium rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                        >
                          <ArrowRightLeft className="w-3 h-3" />
                          <span>{switchingUser === acc.username ? 'Switching...' : 'Switch'}</span>
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* RBAC Table */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-3 border-b border-slate-100 pb-3">
            <Users className="w-4 h-4 text-blue-600" />
            <h3 className="text-sm font-bold text-slate-800">Role-Based Access Control (RBAC)</h3>
          </div>
          <div className="divide-y divide-slate-100 text-xs">
            {roles.map((r, i) => (
              <div key={i} className="py-2.5 flex items-start justify-between gap-4">
                <span className="font-semibold text-slate-800 shrink-0">{r.role}</span>
                <span className="text-slate-500 text-right">{r.access}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 12 AI Agents Health */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-3 border-b border-slate-100 pb-3">
            <Bot className="w-4 h-4 text-indigo-600" />
            <h3 className="text-sm font-bold text-slate-800">12 Specialized AI Agents Health Matrix</h3>
          </div>
          <div className="space-y-2 max-h-[460px] overflow-y-auto">
            {agents.map((ag, i) => (
              <div key={i} className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 text-xs flex items-center justify-between">
                <div>
                  <span className="font-semibold text-slate-800 block">{ag.name}</span>
                  <span className="text-[11px] text-slate-500">{ag.duty}</span>
                </div>
                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span>{ag.status}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Compliance & Limits */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-3 border-b border-slate-100 pb-3">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <h3 className="text-sm font-bold text-slate-800">Anti-Spam, Privacy & Compliance Safeguards</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-slate-700">
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
            <span className="font-semibold text-slate-900 block mb-1">Email Sending Limits</span>
            <p className="text-slate-500 text-[11px] leading-relaxed">
              Max 150 emails/day per connected account to safeguard corporate IP and maintain high deliverability without spam flags.
            </p>
          </div>
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
            <span className="font-semibold text-slate-900 block mb-1">Polite Website Crawler</span>
            <p className="text-slate-500 text-[11px] leading-relaxed">
              Strictly adheres to robots.txt rules, 1-second request delays, public page limits, and zero CAPTCHA bypass.
            </p>
          </div>
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
            <span className="font-semibold text-slate-900 block mb-1">Human Approval Workflow</span>
            <p className="text-slate-500 text-[11px] leading-relaxed">
              All commercial proposals and initial emails pass through managerial review before dispatch unless explicitly authorized.
            </p>
          </div>
        </div>
      </div>

      {/* Danger Zone: Data Management */}
      {onDeleteAll && (
        <div className="bg-rose-50/60 rounded-xl border border-rose-200 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Trash2 className="w-4 h-4 text-rose-600" />
                <h3 className="text-sm font-bold text-rose-900">Data Management & Reset</h3>
              </div>
              <p className="text-xs text-rose-700">
                Permanently purge all leads, company research reports, detected requirements, email drafts, and proposals across the entire system.
              </p>
            </div>
            <button
              onClick={onDeleteAll}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete All Leads & Data</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
