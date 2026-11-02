import React from 'react';
import { ShieldCheck, RefreshCw, LogOut } from 'lucide-react';
import { api } from '../services/api';

interface NavbarProps {
  onRefresh: () => void;
  isRefreshing: boolean;
  onLogout: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onRefresh, isRefreshing, onLogout }) => {
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
    <header className="h-16 bg-white border-b border-slate-200 px-8 flex items-center justify-between shrink-0 shadow-sm z-10">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 bg-blue-50 text-blue-700 px-3 py-1 rounded-md text-xs font-medium border border-blue-100">
          <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
          <span>Production Ready • RBAC Protected</span>
        </div>
        <span className="text-slate-300">|</span>
        <span className="text-xs text-slate-500 font-medium hidden md:inline">Merugu Global BPO Autonomous Suite</span>
      </div>

      <div className="flex items-center gap-3 sm:gap-4">
        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
          title="Refresh real-time pipeline status"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">Sync Pipeline</span>
        </button>

        <div className="flex items-center gap-3 pl-3 border-l border-slate-200">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-700 to-indigo-900 flex items-center justify-center text-white text-xs font-bold shadow-sm">
            {initials}
          </div>
          <div className="text-left hidden sm:block">
            <p className="text-xs font-semibold text-slate-800 leading-none">{user.first_name} {user.last_name}</p>
            <p className="text-[10px] text-slate-500 font-medium mt-0.5">{getRoleDisplayName(user.role)}</p>
          </div>

          {/* Logout Button */}
          <button
            onClick={onLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 ml-2 text-xs font-semibold text-rose-700 hover:text-white bg-rose-50 hover:bg-rose-600 border border-rose-200 hover:border-rose-600 rounded-lg transition-all cursor-pointer shadow-sm"
            title="Log out of this account and return to Landing Page"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </div>
    </header>
  );
};
