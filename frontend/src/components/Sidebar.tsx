import React from 'react';
import { 
  LayoutDashboard, Users, Search, MailCheck, 
  FileText, Briefcase, Settings, Bot, ChevronRight, LogOut, X
} from 'lucide-react';
import { api } from '../services/api';

interface SidebarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  approvalCount: number;
  onLogout?: () => void;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
}

export const ROLE_ALLOWED_TABS: Record<string, string[]> = {
  SUPER_ADMIN: ['dashboard', 'leads', 'research', 'approvals', 'proposals', 'catalogue', 'settings'],
  ADMINISTRATOR: ['dashboard', 'leads', 'research', 'approvals', 'proposals', 'catalogue', 'settings'],
  SENIOR_MANAGER: ['dashboard', 'leads', 'research', 'approvals', 'proposals', 'catalogue', 'settings'],
  BPO_TEAM_LEADER: ['dashboard', 'leads', 'research', 'approvals', 'proposals'],
  RESEARCH_EXECUTIVE: ['leads', 'research', 'dashboard'],
  EMAIL_MARKETING_EXECUTIVE: ['approvals', 'leads', 'research', 'dashboard'],
  SALES_EXECUTIVE: ['dashboard', 'leads', 'proposals'],
  ACCOUNTS_EXECUTIVE: ['proposals', 'catalogue', 'dashboard'],
  READ_ONLY: ['dashboard', 'leads', 'research', 'approvals', 'proposals'],
};

export const Sidebar: React.FC<SidebarProps> = ({ 
  currentTab, 
  setCurrentTab, 
  approvalCount, 
  onLogout,
  isOpenMobile = false,
  onCloseMobile
}) => {
  const user = api.getCurrentUser();
  const allowedTabs = ROLE_ALLOWED_TABS[user?.role] || ROLE_ALLOWED_TABS['SUPER_ADMIN'];

  const allMenuItems = [
    { id: 'dashboard', label: 'Executive CRM', icon: LayoutDashboard, description: 'Executive CRM: Overview of KPIs, lead funnel conversion rates, and revenue pipeline.' },
    { id: 'leads', label: 'Lead Management', icon: Users, description: 'Lead Management: Ingest, inspect, validate, deduplicate, and manage company contact lists.' },
    { id: 'research', label: 'Company Intelligence', icon: Search, description: 'Company Intelligence: Public website discovery, deep structured fact extraction, and 100-point ICP fit scoring.' },
    { id: 'approvals', label: 'Email Outreach', icon: MailCheck, badge: approvalCount, description: 'Email Outreach: Review, customize, and approve AI-generated personalized outreach emails.' },
    { id: 'proposals', label: 'Proposals & Quotes', icon: FileText, description: 'Proposals & Quotes: Commercial proposals, service deliverables, and editable price quotations in INR (₹).' },
    { id: 'catalogue', label: 'Service Catalogue', icon: Briefcase, description: 'Service Catalogue: Standard service offerings, hourly rates, fixed packages, and deliverable descriptions.' },
    { id: 'settings', label: 'System & RBAC', icon: Settings, description: 'System & RBAC: Configure user accounts, access permissions, email providers, and system preferences.' },
  ];

  const visibleMenuItems = allMenuItems.filter(item => allowedTabs.includes(item.id));

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isOpenMobile && (
        <div 
          className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-40 lg:hidden transition-opacity"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}

      {/* Main Sidebar Drawer */}
      <aside 
        className={`fixed inset-y-0 left-0 z-50 w-72 bg-slate-900 text-slate-300 flex flex-col shrink-0 border-r border-slate-800 select-none shadow-2xl transition-transform duration-300 ease-in-out lg:static lg:translate-x-0 lg:w-64 lg:shadow-none ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="h-16 flex items-center justify-between px-5 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white shadow-lg shadow-blue-500/25">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-bold text-white text-base tracking-tight leading-none">MERUGU AI</h1>
              <p className="text-[10px] text-blue-400 font-semibold tracking-wider mt-1">BPO PLATFORM</p>
            </div>
          </div>

          {/* Close button on mobile */}
          {onCloseMobile && (
            <button
              onClick={onCloseMobile}
              className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              title="Close menu"
              aria-label="Close navigation menu"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Nav Menu */}
        <div className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
          <div className="px-3 pb-2 flex items-center justify-between text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
            <span>Enterprise Modules</span>
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 text-blue-400 font-mono lowercase">
              {user?.role?.replace('_', ' ') || 'rbac'}
            </span>
          </div>
          {visibleMenuItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setCurrentTab(item.id);
                  if (onCloseMobile) onCloseMobile();
                }}
                title={item.description}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-all cursor-pointer ${
                  isActive 
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/25 font-semibold' 
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                  <span className="truncate">{item.label}</span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {item.badge !== undefined && item.badge > 0 && (
                    <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-500 text-slate-950 shadow-2xs">
                      {item.badge}
                    </span>
                  )}
                  {isActive && <ChevronRight className="w-3.5 h-3.5 opacity-70" />}
                </div>
              </button>
            );
          })}
        </div>

        {/* Footer Info & Logout */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/40 text-xs text-slate-300">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-white font-medium">12 AI Agents Active</span>
          </div>
          <p className="text-[10px] leading-relaxed text-slate-400 truncate">Merugu Digital Marketing & Life Science</p>

          {onLogout && (
            <button
              onClick={onLogout}
              className="mt-3 w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold text-slate-400 hover:text-rose-300 hover:bg-rose-950/40 border border-slate-800 hover:border-rose-900/60 rounded-xl transition-all cursor-pointer"
              title="Log out of staff session and return to Landing Page"
            >
              <LogOut className="w-3.5 h-3.5 text-rose-400" />
              <span>Sign Out Session</span>
            </button>
          )}
        </div>
      </aside>
    </>
  );
};
