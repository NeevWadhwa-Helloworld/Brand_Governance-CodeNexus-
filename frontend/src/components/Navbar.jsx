import React from 'react';
import {
  ShieldCheck, FileText, CheckCircle, Brain, BarChart3,
  TestTube2, Lock, Users, Sparkles, LogOut, Sun, Moon
} from 'lucide-react';

const ROLE_TABS = {
  creator: ['studio', 'analytics'],
  reviewer: ['approvals', 'analytics', 'audit'],
  admin: ['brain', 'studio', 'approvals', 'analytics', 'evaluation', 'audit', 'users']
};

export default function Navbar({
  activeTab,
  setActiveTab,
  currentUser,
  pendingCount,
  onLogout,
  theme,
  toggleTheme
}) {
  const allTabs = [
    { id: 'studio', label: 'Draft Studio & Scanner', icon: FileText },
    { id: 'approvals', label: 'Approval Queue', icon: CheckCircle, badge: pendingCount },
    { id: 'brain', label: 'Source of Truth Brain', icon: Brain },
    { id: 'analytics', label: 'Governance Analytics', icon: BarChart3 },
    { id: 'evaluation', label: 'Benchmark Suite (Sec 9.1)', icon: TestTube2 },
    { id: 'audit', label: 'Audit & Security', icon: Lock },
    { id: 'users', label: 'Team Accounts', icon: Users },
  ];

  const allowedTabs = currentUser
    ? (ROLE_TABS[currentUser.role] || ROLE_TABS.creator)
    : ROLE_TABS.creator;

  const visibleTabs = allTabs.filter(tab => allowedTabs.includes(tab.id));

  const roleStyles = {
    creator: {
      pill: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
      label: 'Creator'
    },
    reviewer: {
      pill: 'bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/30',
      label: 'Reviewer'
    },
    admin: {
      pill: 'bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30',
      label: 'Admin'
    }
  };

  const currentRoleConfig = currentUser?.role
    ? (roleStyles[currentUser.role] || roleStyles.creator)
    : roleStyles.creator;

  return (
    <header className="border-b border-border bg-canvas/95 backdrop-blur-md sticky top-0 z-40 transition-colors">
      {/* Top Banner / Identity & Persona Bar */}
      <div className="w-full max-w-7xl xl:max-w-[1400px] mx-auto px-3 sm:px-6 py-2.5 flex items-center justify-between border-b border-border/60 text-xs">
        {/* Brand & Engine Identity */}
        <div className="flex items-center space-x-2.5 sm:space-x-3 text-text-secondary">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary/15 border border-primary/30 flex items-center justify-center text-primary shrink-0 shadow-sm shadow-primary/20">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <span className="font-bold text-xs tracking-tight text-text-primary">Inkloom AI</span>
              <span className="text-[10px] text-text-muted font-mono ml-1.5 hidden sm:inline">Governance Engine</span>
            </div>
          </div>
          <span className="text-border-strong hidden md:inline">|</span>
          <span className="hidden md:inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono bg-surface border border-border text-primary font-medium">
            <Sparkles className="w-2.5 h-2.5" /> Grounded RAG
          </span>
          <span className="hidden lg:inline text-[11px] text-text-muted">
            Team DoraAIemon
          </span>
        </div>

        {/* Persona & Actions: Theme Toggle, User Indicator & Sign Out */}
        <div className="flex items-center space-x-2 sm:space-x-2.5">
          {/* Dark / Light Mode Toggle */}
          <button
            type="button"
            onClick={toggleTheme}
            className="flex items-center space-x-1.5 rounded-xl border border-border bg-surface-subtle hover:bg-surface-raised hover:border-border-strong px-2 sm:px-2.5 py-1 text-xs text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
            title={theme === 'light' ? 'Switch to Dark Mode (Obsidian)' : 'Switch to Light Mode (Emerald Light)'}
            aria-label={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
          >
            {theme === 'light' ? (
              <>
                <Moon className="w-3.5 h-3.5 text-primary" />
                <span className="font-medium text-[11px] hidden sm:inline">Dark</span>
              </>
            ) : (
              <>
                <Sun className="w-3.5 h-3.5 text-warning" />
                <span className="font-medium text-[11px] hidden sm:inline">Light</span>
              </>
            )}
          </button>

          <span className="text-xs text-text-muted font-medium hidden md:inline">Acting as:</span>
          <div className="flex items-center space-x-1.5 sm:space-x-2 bg-surface border border-border px-2 sm:px-2.5 py-1 rounded-xl">
            <img
              src={currentUser?.avatar || 'https://api.dicebear.com/7.x/avataaars/svg?seed=user'}
              alt={currentUser?.name || 'User'}
              className="w-4 h-4 rounded-full ring-1 ring-primary/40 shrink-0"
            />
            <span className="text-xs font-medium text-text-primary max-w-[85px] sm:max-w-none truncate">
              {currentUser?.name || 'User'}
            </span>
            <span className={`text-[10px] uppercase font-semibold px-1.5 py-0.2 rounded-full border ${currentRoleConfig.pill}`}>
              {currentRoleConfig.label}
            </span>
          </div>

          <button
            onClick={onLogout}
            className="flex items-center space-x-1.5 rounded-xl border border-border bg-surface-subtle hover:bg-surface-raised hover:border-border-strong px-2 sm:px-2.5 py-1 text-xs text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
            title="Sign out"
          >
            <LogOut className="w-3.5 h-3.5 text-text-muted" />
            <span className="hidden sm:inline font-medium">Sign out</span>
          </button>
        </div>
      </div>

      {/* Main Tabs Navigation (Fits completely within desktop viewport without scrolling) */}
      <div className="w-full max-w-7xl xl:max-w-[1400px] mx-auto px-2 sm:px-4 lg:px-6">
        <nav
          className="flex items-center justify-between lg:justify-start gap-1 lg:gap-1.5 overflow-x-auto lg:overflow-x-visible py-1.5 sm:py-2 no-scrollbar"
          aria-label="Main Navigation"
        >
          {visibleTabs.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center justify-center space-x-1 sm:space-x-1.5 px-2 py-1.5 sm:px-2.5 sm:py-1.5 xl:px-3 text-[11px] lg:text-[11.5px] xl:text-xs font-semibold rounded-xl transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                  isActive
                    ? 'bg-surface-raised text-text-primary border border-primary/60 shadow-sm shadow-primary/15'
                    : 'text-text-secondary hover:text-text-primary hover:bg-surface border border-transparent'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 shrink-0 transition-colors ${isActive ? 'text-primary' : 'text-text-muted'}`} />
                <span className="tracking-tight">{tab.label}</span>
                {tab.badge > 0 && (
                  <span className="bg-primary text-primary-fg font-bold text-[9px] px-1.5 py-0.2 rounded-full shrink-0 shadow-sm ml-0.5">
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
