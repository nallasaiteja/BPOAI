import React from 'react';
import { 
  LayoutDashboard, Users, Search, MailCheck, 
  FileText, Briefcase, Settings, Bot, ChevronRight, LogOut, Shield
} from 'lucide-react';
import { api } from '../services/api';

interface SidebarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  approvalCount: number;
  onLogout?: () => void;
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

export const Sidebar: React.FC<SidebarProps> = ({ currentTab, setCurrentTab, approvalCount, onLogout }) => {
  const user = api.getCurrentUser();
  const allowedTabs = ROLE_ALLOWED_TABS[user?.role] || ROLE_ALLOWED_TABS['SUPER_ADMIN'];

  const allMenuItems = [
    { id: 'dashboard', label: 'Executive CRM', icon: LayoutDashboard },
    { id: 'leads', label: 'Lead Management', icon: Users },
    { id: 'research', label: 'Company Intelligence', icon: Search },
    { id: 'approvals', label: 'Email Outreach', icon: MailCheck, badge: approvalCount },
    { id: 'proposals', label: 'Proposals & Quotes', icon: FileText },
    { id: 'catalogue', label: 'Service Catalogue', icon: Briefcase },
    { id: 'settings', label: 'System & RBAC', icon: Settings },
  ];

  const visibleMenuItems = allMenuItems.filter(item => allowedTabs.includes(item.id));

  return (
    <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col shrink-0 border-r border-slate-800 select-none">
      {/* Brand Header */}
      <div className="h-16 flex items-center px-6 border-b border-slate-800 bg-slate-950/60 gap-3">
        <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
          <Bot className="w-5 h-5" />
        </div>
        <div>
          <h1 className="font-bold text-white text-base tracking-tight leading-none">MERUGU AI</h1>
          <p className="text-[11px] text-blue-400 font-medium tracking-wide mt-1">BPO AUTOMATION</p>
        </div>
      </div>

      {/* Nav Menu */}
      <div className="flex-1 py-6 px-3 space-y-1 overflow-y-auto">
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
              onClick={() => setCurrentTab(item.id)}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                isActive 
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/25' 
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </div>
              <div className="flex items-center gap-1.5">
                {item.badge !== undefined && item.badge > 0 && (
                  <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-amber-500 text-slate-950">
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
          <span className="text-white font-medium">12 AI Agents Operational</span>
        </div>
        <p className="text-[11px] leading-relaxed text-slate-400">Merugu Digital Marketing And Life Science Pvt. Ltd.</p>

        {onLogout && (
          <button
            onClick={onLogout}
            className="mt-3 w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-slate-400 hover:text-rose-300 hover:bg-rose-950/40 border border-slate-800 hover:border-rose-900/60 rounded-lg transition-all cursor-pointer"
            title="Log out of staff session and return to Landing Page"
          >
            <LogOut className="w-3.5 h-3.5 text-rose-400" />
            <span>Sign Out Session</span>
          </button>
        )}
      </div>
    </aside>
  );
};
