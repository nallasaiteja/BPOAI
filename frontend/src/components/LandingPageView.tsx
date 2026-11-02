import React, { useState } from 'react';
import {
  Bot, ShieldCheck, ArrowRight, CheckCircle2, Star, Sparkles,
  Send, Globe, Cpu, Layers, Activity, Clock, Phone, Mail, Building2,
  ChevronRight, ExternalLink, Check, Users, X, Lock, ArrowRightLeft,
  Key, Shield, UserCheck, Briefcase
} from 'lucide-react';
import { api } from '../services/api';

interface LandingPageViewProps {
  onGoToPortal: (user?: any) => void;
  onLeadSubmitted?: (companyName: string) => void;
}

export const DEMO_ACCOUNTS = [
  {
    name: 'Hemanth Merugu',
    username: 'admin',
    password: 'adminpassword123',
    role: 'Super Administrator',
    roleCode: 'SUPER_ADMIN',
    category: 'Executive Management',
    email: 'admin@meruguglobal.com',
    badgeColor: 'bg-purple-900/40 text-purple-300 border-purple-700/60',
    description: 'Full system master with complete administrative control, pricing rules, AI configuration, and commercial sign-offs.',
    permissions: ['Global Tenant Settings', 'Pricing & Master Catalogue', 'Gemini AI Configuration', 'Final Approval Authority'],
  },
  {
    name: 'Anita Sharma',
    username: 'administrator',
    password: 'password123',
    role: 'Administrator',
    roleCode: 'ADMINISTRATOR',
    category: 'Executive Management',
    email: 'anita.s@meruguglobal.com',
    badgeColor: 'bg-indigo-900/40 text-indigo-300 border-indigo-700/60',
    description: 'System administrator handling user provisioning, tenant security, service catalogue rules, and diagnostics.',
    permissions: ['User Management', 'Campaign Oversight', 'Diagnostic Monitoring', 'System Audit Access'],
  },
  {
    name: 'Rajesh Verma',
    username: 'manager',
    password: 'password123',
    role: 'Senior Manager',
    roleCode: 'SENIOR_MANAGER',
    category: 'Operations Leadership',
    email: 'rajesh.v@meruguglobal.com',
    badgeColor: 'bg-blue-900/40 text-blue-300 border-blue-700/60',
    description: 'Senior management executive responsible for approving outbound communications, proposal terms, and domain overrides.',
    permissions: ['Email Dispatch Approval', 'Proposal Commercial Sign-off', 'Manual Domain Verification', 'Executive Analytics'],
  },
  {
    name: 'Priya Patel',
    username: 'teamlead',
    password: 'password123',
    role: 'BPO Team Leader',
    roleCode: 'BPO_TEAM_LEADER',
    category: 'Operations Leadership',
    email: 'priya.p@meruguglobal.com',
    badgeColor: 'bg-emerald-900/40 text-emerald-300 border-emerald-700/60',
    description: 'Leads the operational queue, assigns inbound accounts, monitors research throughput, and verifies agent outputs.',
    permissions: ['Lead Queue Assignment', 'Pipeline Health Monitoring', 'Crawler Review', 'Agent Performance Oversight'],
  },
  {
    name: 'Vikram Rao',
    username: 'researcher',
    password: 'password123',
    role: 'Research Executive',
    roleCode: 'RESEARCH_EXECUTIVE',
    category: 'Data & Pipeline Operations',
    email: 'vikram.r@meruguglobal.com',
    badgeColor: 'bg-cyan-900/40 text-cyan-300 border-cyan-700/60',
    description: 'Uploads lead CSVs, triggers website crawls, reviews detected technology stacks, and audits company profiles.',
    permissions: ['CSV / Excel Lead Ingestion', 'Website Crawl Triggering', 'Tech Stack Inspection', 'Anomaly Identification'],
  },
  {
    name: 'Sneha Reddy',
    username: 'emailmarketer',
    password: 'password123',
    role: 'Email Marketing Executive',
    roleCode: 'EMAIL_MARKETING_EXECUTIVE',
    category: 'Communications & Outbound',
    email: 'sneha.r@meruguglobal.com',
    badgeColor: 'bg-amber-900/40 text-amber-300 border-amber-700/60',
    description: 'Reviews AI-drafted outreach emails, refines subject lines, and orchestrates the Day 0–3–7–14 cadence.',
    permissions: ['Draft Review & Editing', 'Cadence Scheduling', 'A/B Subject Optimization', 'Submission to Manager Queue'],
  },
  {
    name: 'Rohan Mehta',
    username: 'salesexec',
    password: 'password123',
    role: 'Sales Executive',
    roleCode: 'SALES_EXECUTIVE',
    category: 'Client Growth & CRM',
    email: 'rohan.m@meruguglobal.com',
    badgeColor: 'bg-orange-900/40 text-orange-300 border-orange-700/60',
    description: 'Monitors inbound client responses, triages meeting requests, and drives proposal negotiations with prospective clients.',
    permissions: ['Reply Intent Classification', 'Meeting Scheduling', 'Client Relationship Triage', 'Deal Conversion Pipeline'],
  },
  {
    name: 'Suresh Kumar',
    username: 'accountant',
    password: 'password123',
    role: 'Accounts Executive',
    roleCode: 'ACCOUNTS_EXECUTIVE',
    category: 'Commercial & Finance',
    email: 'suresh.k@meruguglobal.com',
    badgeColor: 'bg-rose-900/40 text-rose-300 border-rose-700/60',
    description: 'Reviews quotation calculations, verifies tax rates, applies approved commercial discounts, and reconciles invoicing.',
    permissions: ['Commercial Quotation Review', 'Tax & Currency Verification', 'Discount Sign-off', 'Financial Invoicing Sync'],
  },
  {
    name: 'Neha Joshi',
    username: 'auditor',
    password: 'password123',
    role: 'Read-only Auditor',
    roleCode: 'READ_ONLY',
    category: 'Compliance & Audit',
    email: 'neha.j@meruguglobal.com',
    badgeColor: 'bg-slate-800 text-slate-300 border-slate-700',
    description: 'Internal auditor ensuring compliance with anti-spam laws, privacy regulations (HIPAA/GDPR), and SLA tracking.',
    permissions: ['Read-only System Auditing', 'Compliance Log Inspection', 'SLA Metric Observation', 'Zero Write Privileges'],
  },
];

export const LandingPageView: React.FC<LandingPageViewProps> = ({ onGoToPortal, onLeadSubmitted }) => {
  const [formData, setFormData] = useState({
    companyName: '',
    contactPerson: '',
    businessEmail: '',
    websiteUrl: '',
    industry: 'Healthcare & Life Sciences',
    needs: 'AI Chatbots & Intelligent Workflow Automation',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  // Demo Accounts Modal State
  const [showDemoModal, setShowDemoModal] = useState(false);
  const [loggingInUser, setLoggingInUser] = useState<string | null>(null);

  const handleLoginAsDemoUser = async (acc: typeof DEMO_ACCOUNTS[0]) => {
    setLoggingInUser(acc.username);
    try {
      await api.login(acc.username, acc.password);
      setShowDemoModal(false);
      onGoToPortal(api.getCurrentUser());
    } catch (err: any) {
      alert('Login error: ' + (err.message || 'Unable to authenticate.'));
    } finally {
      setLoggingInUser(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.companyName || !formData.businessEmail) {
      alert('Please provide at least your Company Name and Business Email.');
      return;
    }
    setIsSubmitting(true);
    try {
      await api.createLead({
        company_name: formData.companyName,
        contact_person: formData.contactPerson || 'Prospective Client',
        business_email: formData.businessEmail,
        website_url: formData.websiteUrl,
        industry: formData.industry,
      });
      setSubmitSuccess(true);
      if (onLeadSubmitted) onLeadSubmitted(formData.companyName);
    } catch (err: any) {
      alert('Error submitting inquiry: ' + (err.message || 'Please check backend connection.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-blue-600 selection:text-white relative">
      {/* Top Banner Navigation */}
      <header className="sticky top-0 z-40 bg-slate-950/85 backdrop-blur-md border-b border-slate-800/80 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white shadow-lg shadow-blue-500/25">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <span className="font-bold text-white text-base tracking-tight block">MERUGU GLOBAL</span>
            <span className="text-[10px] text-blue-400 font-semibold tracking-wider uppercase block">Digital Marketing & Life Science</span>
          </div>
        </div>

        <nav className="hidden md:flex items-center gap-8 text-xs font-medium text-slate-300">
          <a href="#services" className="hover:text-blue-400 transition-colors">Services</a>
          <a href="#solutions" className="hover:text-blue-400 transition-colors">AI Capabilities</a>
          <a href="#pricing" className="hover:text-blue-400 transition-colors">Commercials</a>
          <a href="#contact" className="hover:text-blue-400 transition-colors">Contact</a>
        </nav>

        <div className="flex items-center gap-3">
          {/* Open Staff Portal */}
          <button
            onClick={() => onGoToPortal()}
            className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 rounded-lg shadow-md shadow-blue-600/30 transition-all cursor-pointer"
          >
            <ShieldCheck className="w-4 h-4 text-blue-200" />
            <span>Staff Portal</span>
          </button>

          <a
            href="#contact"
            className="hidden lg:flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-lg transition-all"
          >
            <span>Request Demo</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </a>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-20 pb-24 px-6 max-w-7xl mx-auto text-center flex flex-col items-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-950/80 border border-blue-800/60 text-blue-300 text-xs font-semibold mb-6 shadow-sm">
          <Sparkles className="w-3.5 h-3.5 text-blue-400" />
          <span>Autonomous AI BPO Platform Powered by Google Gemini</span>
        </div>

        <h1 className="text-4xl sm:text-6xl font-extrabold text-white tracking-tight leading-[1.15] max-w-4xl">
          Scale Enterprise BPO With <span className="bg-gradient-to-r from-blue-400 via-indigo-300 to-purple-400 bg-clip-text text-transparent">Autonomous AI Workflows</span>
        </h1>

        <p className="mt-6 text-base sm:text-lg text-slate-400 max-w-2xl leading-relaxed">
          Merugu Digital Marketing And Life Science Pvt. Ltd. delivers intelligent customer support automation, enterprise software engineering, and digital growth infrastructure for mid-market and healthcare leaders.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <button
            onClick={() => onGoToPortal()}
            className="px-6 py-3.5 text-sm font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 rounded-xl shadow-lg shadow-blue-600/30 transition-all flex items-center gap-2.5 cursor-pointer transform hover:-translate-y-0.5"
          >
            <ShieldCheck className="w-4 h-4 text-blue-200" />
            <span>Enter Staff Operations Portal</span>
            <ArrowRight className="w-4 h-4 text-white" />
          </button>

          <a
            href="#contact"
            className="px-6 py-3.5 text-sm font-semibold text-slate-300 hover:text-white bg-slate-900/80 hover:bg-slate-800 border border-slate-800 rounded-xl transition-all flex items-center gap-2"
          >
            <span>Request Proposal Blueprint</span>
          </a>
        </div>

        {/* Metric Badges */}
        <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-6 w-full max-w-4xl border-t border-slate-800/80 pt-10 text-left">
          <div className="p-4 bg-slate-900/40 rounded-xl border border-slate-800/60">
            <span className="text-2xl sm:text-3xl font-extrabold text-white block">80%</span>
            <span className="text-xs text-slate-400 mt-1 block">Faster Support Turnaround</span>
          </div>
          <div className="p-4 bg-slate-900/40 rounded-xl border border-slate-800/60">
            <span className="text-2xl sm:text-3xl font-extrabold text-white block">24/7/365</span>
            <span className="text-xs text-slate-400 mt-1 block">Autonomous Coverage</span>
          </div>
          <div className="p-4 bg-slate-900/40 rounded-xl border border-slate-800/60">
            <span className="text-2xl sm:text-3xl font-extrabold text-white block">100%</span>
            <span className="text-xs text-slate-400 mt-1 block">HIPAA & SOC-2 Compliance</span>
          </div>
          <div className="p-4 bg-slate-900/40 rounded-xl border border-slate-800/60">
            <span className="text-2xl sm:text-3xl font-extrabold text-white block">12</span>
            <span className="text-xs text-slate-400 mt-1 block">Autonomous Specialist Agents</span>
          </div>
        </div>
      </section>

      {/* Services Grid Section */}
      <section id="services" className="py-20 px-6 max-w-7xl mx-auto w-full">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <span className="text-blue-400 text-xs font-bold uppercase tracking-wider block mb-2">Our Core Offerings</span>
          <h2 className="text-3xl font-bold text-white tracking-tight">Enterprise Services Tailored for Growth</h2>
          <p className="text-slate-400 text-sm mt-3">
            Engineered by Merugu Global with verified deliverables, transparent milestone schedules, and strict SLA guarantees.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="p-6 bg-slate-900/60 rounded-2xl border border-slate-800 hover:border-blue-500/50 transition-all flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded-xl bg-blue-600/10 text-blue-400 flex items-center justify-center mb-4 border border-blue-500/20">
                <Bot className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-white mb-2">AI Chatbots & Automation</h3>
              <p className="text-xs text-slate-400 leading-relaxed mb-4">
                Autonomous conversational agents, WhatsApp/Web integration, CRM routing, and human escalation fallbacks.
              </p>
              <ul className="text-xs text-slate-300 space-y-2 mb-6">
                <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-blue-400 shrink-0" /> Custom Knowledge Base (RAG)</li>
                <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-blue-400 shrink-0" /> Multi-channel Triage</li>
                <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-blue-400 shrink-0" /> Real-time Ticket Routing</li>
              </ul>
            </div>
            <div className="pt-4 border-t border-slate-800 flex items-center justify-between text-xs">
              <span className="text-slate-400">From <strong className="text-white">₹1,50,000</strong></span>
              <span className="text-blue-400 font-semibold">2–4 Weeks</span>
            </div>
          </div>

          <div className="p-6 bg-slate-900/60 rounded-2xl border border-slate-800 hover:border-indigo-500/50 transition-all flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded-xl bg-indigo-600/10 text-indigo-400 flex items-center justify-center mb-4 border border-indigo-500/20">
                <Cpu className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-white mb-2">Full-Stack Web Modernization</h3>
              <p className="text-xs text-slate-400 leading-relaxed mb-4">
                Enterprise web portals engineered with React, Node.js, and cloud microservices for sub-second page performance.
              </p>
              <ul className="text-xs text-slate-300 space-y-2 mb-6">
                <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-indigo-400 shrink-0" /> React 18 & TypeScript</li>
                <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-indigo-400 shrink-0" /> Microservice REST/GraphQL</li>
                <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-indigo-400 shrink-0" /> Zero Downtime Deployment</li>
              </ul>
            </div>
            <div className="pt-4 border-t border-slate-800 flex items-center justify-between text-xs">
              <span className="text-slate-400">From <strong className="text-white">₹2,50,000</strong></span>
              <span className="text-indigo-400 font-semibold">4–6 Weeks</span>
            </div>
          </div>

          <div className="p-6 bg-slate-900/60 rounded-2xl border border-slate-800 hover:border-emerald-500/50 transition-all flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded-xl bg-emerald-600/10 text-emerald-400 flex items-center justify-center mb-4 border border-emerald-500/20">
                <Activity className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-white mb-2">HMIS Healthcare Solutions</h3>
              <p className="text-xs text-slate-400 leading-relaxed mb-4">
                HIPAA-compliant hospital management, patient portals, EHR integration, and clinical appointment scheduling.
              </p>
              <ul className="text-xs text-slate-300 space-y-2 mb-6">
                <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" /> HL7 / FHIR Data Pipelines</li>
                <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" /> Role-Based Clinical Access</li>
                <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" /> Automated Telehealth Sync</li>
              </ul>
            </div>
            <div className="pt-4 border-t border-slate-800 flex items-center justify-between text-xs">
              <span className="text-slate-400">From <strong className="text-white">₹3,20,000</strong></span>
              <span className="text-emerald-400 font-semibold">6–8 Weeks</span>
            </div>
          </div>

          <div className="p-6 bg-slate-900/60 rounded-2xl border border-slate-800 hover:border-purple-500/50 transition-all flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded-xl bg-purple-600/10 text-purple-400 flex items-center justify-center mb-4 border border-purple-500/20">
                <Globe className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-white mb-2">SEO & Generative Engine Opt</h3>
              <p className="text-xs text-slate-400 leading-relaxed mb-4">
                Advanced organic ranking and discovery in AI engines (Google AI Overviews, Perplexity, and Bing Copilot).
              </p>
              <ul className="text-xs text-slate-300 space-y-2 mb-6">
                <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-purple-400 shrink-0" /> Generative Search Citation</li>
                <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-purple-400 shrink-0" /> Schema & Entity Optimization</li>
                <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-purple-400 shrink-0" /> B2B Inbound Lead Funnels</li>
              </ul>
            </div>
            <div className="pt-4 border-t border-slate-800 flex items-center justify-between text-xs">
              <span className="text-slate-400">From <strong className="text-white">₹95,000</strong></span>
              <span className="text-purple-400 font-semibold">3–5 Weeks</span>
            </div>
          </div>
        </div>
      </section>

      {/* Client Intake Form Section */}
      <section id="contact" className="py-20 px-6 max-w-4xl mx-auto w-full">
        <div className="bg-gradient-to-b from-slate-900 to-slate-900/60 p-8 sm:p-12 rounded-3xl border border-slate-800 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-80 h-80 bg-blue-600/10 rounded-full blur-3xl pointer-events-none"></div>

          <div className="text-center max-w-xl mx-auto mb-10">
            <span className="text-blue-400 text-xs font-bold uppercase tracking-wider block mb-2">Request Proposal</span>
            <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Schedule Your 15-Minute Technical Briefing</h2>
            <p className="text-slate-400 text-xs sm:text-sm mt-2">
              Submit your company details. Our AI pipeline will crawl your public site, analyze optimization potential, and generate a tailored SOW.
            </p>
          </div>

          {submitSuccess ? (
            <div className="p-8 bg-emerald-950/40 border border-emerald-600/40 rounded-2xl text-center">
              <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white">Inquiry Received Successfully!</h3>
              <p className="text-xs text-slate-300 mt-2 max-w-md mx-auto">
                Thank you! Your company inquiry has been ingested directly into our BPO CRM. Our Autonomous AI Agents are currently initiating preliminary research.
              </p>
              <div className="mt-6 flex items-center justify-center gap-4">
                <button
                  onClick={() => setSubmitSuccess(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white cursor-pointer"
                >
                  Submit Another
                </button>
                <button
                  onClick={() => onGoToPortal()}
                  className="px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-lg shadow-md cursor-pointer"
                >
                  View in Staff Pipeline
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-300">Company Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Apex Health Systems"
                    value={formData.companyName}
                    onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-300">Contact Person</label>
                  <input
                    type="text"
                    placeholder="e.g. Dr. Sarah Jenkins"
                    value={formData.contactPerson}
                    onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-300">Corporate Business Email *</label>
                  <input
                    type="email"
                    required
                    placeholder="name@company.com"
                    value={formData.businessEmail}
                    onChange={(e) => setFormData({ ...formData, businessEmail: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-300">Company Website URL</label>
                  <input
                    type="url"
                    placeholder="https://company.com"
                    value={formData.websiteUrl}
                    onChange={(e) => setFormData({ ...formData, websiteUrl: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-300">Industry</label>
                  <select
                    value={formData.industry}
                    onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="Healthcare & Life Sciences">Healthcare & Life Sciences</option>
                    <option value="Supply Chain & Logistics">Supply Chain & Logistics</option>
                    <option value="Financial Services & FinTech">Financial Services & FinTech</option>
                    <option value="Enterprise SaaS & Cloud">Enterprise SaaS & Cloud</option>
                    <option value="Retail & E-Commerce">Retail & E-Commerce</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-300">Primary Objective</label>
                  <select
                    value={formData.needs}
                    onChange={(e) => setFormData({ ...formData, needs: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="AI Chatbots & Intelligent Workflow Automation">AI Chatbots & Support Automation</option>
                    <option value="Full-Stack Web Development & Modernization">Full-Stack Web Modernization</option>
                    <option value="HMIS & Healthcare Software Systems">HMIS & Healthcare Software</option>
                    <option value="Search Engine Optimization & Digital Marketing">SEO & Growth Marketing</option>
                  </select>
                </div>
              </div>

              <div className="pt-4">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl shadow-lg shadow-blue-600/30 transition-all flex items-center justify-center gap-2 text-sm disabled:opacity-50 cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                  <span>{isSubmitting ? 'Submitting to AI Ingestion...' : 'Submit Inquiry & Request Proposal'}</span>
                </button>
                <p className="text-[11px] text-slate-500 text-center mt-3">
                  We respect corporate privacy. All preliminary crawls adhere strictly to your robots.txt.
                </p>
              </div>
            </form>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto border-t border-slate-800/80 py-10 px-6 text-xs text-slate-500 max-w-7xl mx-auto w-full flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <strong className="text-slate-300 font-semibold">Merugu Digital Marketing And Life Science Pvt. Ltd.</strong>
          <span className="block mt-0.5">Corporate Headquarters • Global BPO Operations Desk • meruguglobal.com</span>
        </div>
        <div className="flex items-center gap-6">
          <button onClick={() => onGoToPortal()} className="text-blue-400 hover:underline cursor-pointer">Staff Operations Portal</button>
          <span>Privacy Policy</span>
          <span>Terms of Service</span>
        </div>
      </footer>

      {/* ======================================================== */}
      {/* DEMO ACCOUNTS MODAL                                      */}
      {/* ======================================================== */}
      {showDemoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
          <div
            className="bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl max-w-5xl w-full max-h-[90vh] flex flex-col overflow-hidden relative"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <span>Enterprise Demo Accounts & Roles</span>
                    <span className="px-2 py-0.5 bg-amber-500/20 text-amber-300 text-[11px] font-semibold rounded-full border border-amber-500/30">9 Active Roles</span>
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Click any account below to immediately authenticate and launch the operations portal with that role's exact permissions.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowDemoModal(false)}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body: Cards Grid */}
            <div className="p-6 overflow-y-auto space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {DEMO_ACCOUNTS.map((acc) => (
                  <div
                    key={acc.username}
                    className="p-4 bg-slate-950/60 rounded-2xl border border-slate-800 hover:border-slate-700 transition-all flex flex-col justify-between group"
                  >
                    <div>
                      {/* Role Header */}
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${acc.badgeColor}`}>
                          {acc.role}
                        </span>
                        <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
                          {acc.category}
                        </span>
                      </div>

                      {/* Name & Email */}
                      <h3 className="text-sm font-bold text-white group-hover:text-blue-400 transition-colors">
                        {acc.name}
                      </h3>
                      <p className="text-[11px] text-slate-400 font-mono mt-0.5 truncate">
                        {acc.email}
                      </p>

                      {/* Credentials Badge */}
                      <div className="mt-3 p-2 bg-slate-900/80 rounded-lg border border-slate-800 text-[11px] font-mono space-y-1">
                        <div className="flex items-center justify-between text-slate-300">
                          <span className="text-slate-500">User:</span>
                          <span className="font-semibold text-white">{acc.username}</span>
                        </div>
                        <div className="flex items-center justify-between text-slate-300">
                          <span className="text-slate-500">Pass:</span>
                          <span className="text-amber-300">{acc.password}</span>
                        </div>
                      </div>

                      {/* Description & Key Permissions */}
                      <p className="text-[11px] text-slate-400 leading-relaxed mt-3 mb-3">
                        {acc.description}
                      </p>

                      <div className="space-y-1 mb-4 border-t border-slate-800/60 pt-2.5">
                        {acc.permissions.map((p, idx) => (
                          <div key={idx} className="flex items-center gap-1.5 text-[10px] text-slate-400">
                            <Check className="w-3 h-3 text-blue-400 shrink-0" />
                            <span className="truncate">{p}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Launch Button */}
                    <button
                      onClick={() => handleLoginAsDemoUser(acc)}
                      disabled={loggingInUser === acc.username}
                      className="w-full py-2 px-3 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl shadow-md shadow-blue-600/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      {loggingInUser === acc.username ? (
                        <span>Authenticating...</span>
                      ) : (
                        <>
                          <ArrowRightLeft className="w-3.5 h-3.5" />
                          <span>Login as {acc.name.split(' ')[0]}</span>
                        </>
                      )}
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between text-xs text-slate-400 shrink-0">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>All accounts have pre-seeded test data and individual RBAC authority levels.</span>
              </span>
              <button
                onClick={() => setShowDemoModal(false)}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
