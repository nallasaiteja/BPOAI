import React from 'react';
import { ShieldCheck, RefreshCw, LogOut, Menu } from 'lucide-react';
import { api } from '../services/api';

interface NavbarProps {
  onRefresh: () => void;
  isRefreshing: boolean;
  onLogout: () => void;
  onToggleMobileSidebar?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ 
  onRefresh, 
  isRefreshing, 
  onLogout,
  onToggleMobileSidebar 
}) => {
  const user = api.getCurrentUser();
  const initials = ((user.first_name?.[0] || '') + (user.last_name?.[0] || 'U')).toUpperCase();

  const getRoleDisplayName = (r: string) => {
    switch (r) {
      case 'SUPER_ADMIN': return 'Super Administrator';
      case 'ADMINISTRATOR': return 'Administrator';
      case 'SENIOR_MANAGER': return 'Senior Manager';
      case 'BPO_TEAM_LEADER': return 'BPO Team Leader';
      case 'RESEARCH_EXECUTIVE': return 'Research Executive';
      case 'EMAIL_MARKETING_EXECUTIVE': return 'Email Marketing Executive';
      case 'SALES_EXECUTIVE': return 'Sales Executive';
      case 'ACCOUNTS_EXECUTIVE': return 'Accounts Executive';
      case 'READ_ONLY': return 'Read-only Auditor';
      default: return r;
    }
  };

  return (
    <header className="h-16 bg-white border-b border-slate-200/90 px-4 sm:px-6 lg:px-8 flex items-center justify-between shrink-0 shadow-2xs z-30">
      {/* Left side: Mobile Toggle & Brand / Status Indicator */}
      <div className="flex items-center gap-2.5 sm:gap-3">
        {onToggleMobileSidebar && (
          <button
            onClick={onToggleMobileSidebar}
            className="lg:hidden p-2 -ml-1 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            aria-label="Toggle navigation drawer"
            title="Open navigation menu"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}

        <div className="flex items-center gap-1.5 sm:gap-2 bg-blue-50/80 text-blue-700 px-2.5 py-1 rounded-lg text-xs font-semibold border border-blue-100 shadow-3xs">
          <ShieldCheck className="w-3.5 h-3.5 text-blue-600 shrink-0" />
          <span className="hidden xs:inline">Production</span>
          <span className="hidden xs:inline text-blue-300">•</span>
          <span>RBAC Active</span>
        </div>

        <span className="text-slate-200 hidden md:inline">|</span>
        <span className="text-xs text-slate-500 font-medium hidden md:inline truncate max-w-xs xl:max-w-md">
          Merugu Global BPO Autonomous Suite
        </span>
      </div>

      {/* Right side: Sync Action & User Profile & Logout */}
      <div className="flex items-center gap-2 sm:gap-3">
        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200/80 border border-slate-200/60 rounded-xl transition-colors disabled:opacity-50 cursor-pointer shadow-3xs"
          title="Sync Pipeline: Fetch the latest real-time lead statuses, research progress, and outreach drafts from the server."
        >
          <RefreshCw className={`w-3.5 h-3.5 text-slate-600 ${isRefreshing ? 'animate-spin text-blue-600' : ''}`} />
          <span className="hidden sm:inline">Sync Pipeline</span>
        </button>

        <div className="flex items-center gap-2 sm:gap-3 pl-2 sm:pl-3 border-l border-slate-200">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-700 to-indigo-900 flex items-center justify-center text-white text-xs font-bold shadow-2xs shrink-0">
            {initials}
          </div>
          <div className="text-left hidden sm:block">
            <p className="text-xs font-semibold text-slate-800 leading-none">{user.first_name} {user.last_name}</p>
            <p className="text-[10px] text-slate-500 font-medium mt-0.5">{getRoleDisplayName(user.role)}</p>
          </div>

          {/* Logout Button */}
          <button
            onClick={onLogout}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-semibold text-rose-700 hover:text-white bg-rose-50 hover:bg-rose-600 border border-rose-200 hover:border-rose-600 rounded-xl transition-all cursor-pointer shadow-3xs"
            title="Logout: Securely sign out of your session and return to the main landing page."
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </div>
    </header>
  );
};
