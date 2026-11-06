import React, { useState, useEffect } from 'react';
import {
  ShieldCheck, Mail, Lock, AlertCircle, AlertTriangle,
  CheckCircle2, Info, X, Loader2, Sun, Moon
} from 'lucide-react';
import { api } from './api';
import Navbar from './components/Navbar';
import DraftStudio from './components/DraftStudio';
import ApprovalPipeline from './components/ApprovalPipeline';
import SourceOfTruth from './components/SourceOfTruth';
import AnalyticsDashboard from './components/AnalyticsDashboard';
import BenchmarkSuite from './components/BenchmarkSuite';
import AuditSecurity from './components/AuditSecurity';
import UserManagement from './components/UserManagement';

const TOAST_CONFIGS = {
  success: {
    border: 'border-[#34D399]/40',
    badge: 'bg-[#34D399]/15 text-[#34D399]',
    glow: 'shadow-[#34D399]/10',
    icon: CheckCircle2,
    label: 'Success'
  },
  error: {
    border: 'border-[#F87171]/40',
    badge: 'bg-[#F87171]/15 text-[#F87171]',
    glow: 'shadow-[#F87171]/10',
    icon: AlertCircle,
    label: 'Error'
  },
  warning: {
    border: 'border-[#FBBF24]/40',
    badge: 'bg-[#FBBF24]/15 text-[#FBBF24]',
    glow: 'shadow-[#FBBF24]/10',
    icon: AlertTriangle,
    label: 'Warning'
  },
  info: {
    border: 'border-[#36D6A0]/40',
    badge: 'bg-[#36D6A0]/15 text-[#36D6A0]',
    glow: 'shadow-[#36D6A0]/10',
    icon: Info,
    label: 'System'
  }
};

const ROLE_TABS = {
  creator: ['studio', 'analytics'],
  reviewer: ['approvals', 'analytics', 'audit'],
  admin: ['brain', 'studio', 'approvals', 'analytics', 'evaluation', 'audit', 'users']
};

export default function App() {
  const [activeTab, setActiveTab] = useState('studio');
  const [currentUser, setCurrentUser] = useState(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [toast, setToast] = useState(null);
  const [authError, setAuthError] = useState(null);
  const [authLoading, setAuthLoading] = useState(false);

  // Persistent Theme State
  const [theme, setTheme] = useState(() => {
    try {
      const saved = localStorage.getItem('inkloom_theme');
      return saved === 'light' ? 'light' : 'dark';
    } catch {
      return 'dark';
    }
  });

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    try {
      localStorage.setItem('inkloom_theme', next);
      document.documentElement.setAttribute('data-theme', next);
      if (next === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const showToast = (message, type = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  async function refreshPendingCount() {
    try {
      const drafts = await api.getDrafts('Pending Approval');
      setPendingCount(Array.isArray(drafts) ? drafts.length : 0);
    } catch (e) {
      console.error(e);
    }
  }

  async function initApp() {
    try {
      const token = localStorage.getItem('access_token');
      if (token) {
        const authenticatedUser = await api.getMe();
        setCurrentUser(authenticatedUser);
        const allowed = ROLE_TABS[authenticatedUser.role] || ROLE_TABS.creator;
        setActiveTab(allowed[0]);
        refreshPendingCount();
      }
    } catch (e) {
      console.error("Failed to initialize app:", e);
      localStorage.removeItem('access_token');
      setAuthError(e.message);
    }
  }

  useEffect(() => {
    initApp();
  }, []);

  async function handleLogin(event) {
    event.preventDefault();
    setAuthLoading(true);
    setAuthError(null);
    const form = new FormData(event.currentTarget);
    try {
      const user = await api.login(form.get('email'), form.get('password'));
      setCurrentUser(user);
      const allowed = ROLE_TABS[user.role] || ROLE_TABS.creator;
      setActiveTab(allowed[0]);
      refreshPendingCount();
    } catch (e) {
      setAuthError(e.message);
    } finally {
      setAuthLoading(false);
    }
  }

  function handleLogout() {
    localStorage.removeItem('access_token');
    setCurrentUser(null);
    setActiveTab('studio');
  }

  return (
    <div className="min-h-screen bg-[#0A0F1E] text-[#E8ECF8] flex flex-col font-sans transition-colors">
      {!currentUser ? (
        <main className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6 lg:p-8 relative overflow-hidden">
          {/* Top-Right Theme Toggle on Login Screen */}
          <div className="absolute top-6 right-6 z-20">
            <button
              type="button"
              onClick={toggleTheme}
              className="flex items-center space-x-2 rounded-xl border border-[#1F2A4A] bg-[#111830] hover:bg-[#172040] px-3.5 py-2 text-xs text-[#AAB4D0] hover:text-[#E8ECF8] shadow-lg transition-all"
              aria-label={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
            >
              {theme === 'light' ? (
                <>
                  <Moon className="w-4 h-4 text-[#087F5B]" />
                  <span className="font-semibold text-xs">Obsidian Dark</span>
                </>
              ) : (
                <>
                  <Sun className="w-4 h-4 text-[#FBBF24]" />
                  <span className="font-semibold text-xs">Emerald Light</span>
                </>
              )}
            </button>
          </div>

          {/* Ambient Radial Background Glow */}
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[380px] sm:w-[500px] h-[380px] sm:h-[500px] bg-[#36D6A0]/10 rounded-full blur-3xl pointer-events-none -z-10"
            aria-hidden="true"
          />

          {/* Login Card */}
          <div className="w-full max-w-md rounded-2xl border border-[#1F2A4A] bg-[#111830] p-6 sm:p-8 space-y-6 shadow-2xl shadow-black/60 relative motion-safe:animate-fade-in">
            {/* Brand Header */}
            <div>
              <div className="flex items-center gap-2.5 mb-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#36D6A0]/15 border border-[#36D6A0]/30 flex items-center justify-center text-[#36D6A0] shrink-0 shadow-md shadow-[#36D6A0]/20">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h1 className="text-xl font-bold tracking-tight text-[#E8ECF8]">Inkloom AI</h1>
                  <span className="text-[10px] text-[#36D6A0] font-mono block">Grounded Brand Governance Platform</span>
                </div>
              </div>
              <p className="text-xs text-[#AAB4D0] leading-relaxed">
                Enter your authorized credentials to access brand governance pipelines, scans, and approval workflows.
              </p>
            </div>

            {/* Error Message */}
            {authError && (
              <div
                role="alert"
                className="flex items-start gap-2.5 rounded-xl border border-[#F87171]/40 bg-[#F87171]/10 p-3 text-xs text-[#F87171] motion-safe:animate-fade-in"
              >
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-[#F87171]" />
                <div className="flex-1">
                  <span className="font-semibold block">Authentication Failed</span>
                  <span className="text-[#F87171]/90">{authError}</span>
                </div>
              </div>
            )}

            {/* Login Form */}
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-3.5">
                <div>
                  <label
                    htmlFor="login-email"
                    className="block text-xs font-medium text-[#AAB4D0] mb-1.5"
                  >
                    Email Address
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#7C88AB]">
                      <Mail className="w-4 h-4" />
                    </div>
                    <input
                      id="login-email"
                      name="email"
                      type="email"
                      required
                      autoComplete="email"
                      placeholder="Enter registered email"
                      className="w-full rounded-xl border border-[#1F2A4A] bg-[#0E1428] pl-9 pr-3.5 py-2.5 text-xs text-[#E8ECF8] placeholder-[#7C88AB] focus:border-[#36D6A0] focus:ring-1 focus:ring-[#36D6A0] focus:outline-none transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="login-password"
                    className="block text-xs font-medium text-[#AAB4D0] mb-1.5"
                  >
                    Password
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#7C88AB]">
                      <Lock className="w-4 h-4" />
                    </div>
                    <input
                      id="login-password"
                      name="password"
                      type="password"
                      required
                      autoComplete="current-password"
                      placeholder="Enter password"
                      className="w-full rounded-xl border border-[#1F2A4A] bg-[#0E1428] pl-9 pr-3.5 py-2.5 text-xs text-[#E8ECF8] placeholder-[#7C88AB] focus:border-[#36D6A0] focus:ring-1 focus:ring-[#36D6A0] focus:outline-none transition-all font-mono"
                    />
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={authLoading}
                className="w-full flex items-center justify-center space-x-2 rounded-xl bg-[#36D6A0] hover:bg-[#45E6AE] text-[#101613] font-bold focus-visible:ring-2 focus-visible:ring-[#36D6A0] focus-visible:ring-offset-2 focus-visible:ring-offset-[#111830] focus:outline-none py-2.5 px-4 text-xs shadow-lg shadow-[#36D6A0]/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {authLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-[#101613]" />
                    <span>Signing in...</span>
                  </>
                ) : (
                  <span>Sign In to Platform</span>
                )}
              </button>
            </form>
          </div>
        </main>
      ) : (
        <>
          {/* Top Horizontal Navigation */}
          <Navbar
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            currentUser={currentUser}
            pendingCount={pendingCount}
            onLogout={handleLogout}
            theme={theme}
            toggleTheme={toggleTheme}
          />

          {/* Main Content Area */}
          <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
            {activeTab === 'studio' && (
              <DraftStudio
                currentUser={currentUser}
                onDraftUpdated={refreshPendingCount}
                showToast={showToast}
              />
            )}

            {activeTab === 'approvals' && (
              <ApprovalPipeline
                currentUser={currentUser}
                onDraftUpdated={refreshPendingCount}
                showToast={showToast}
              />
            )}

            {activeTab === 'brain' && (
              <SourceOfTruth
                currentUser={currentUser}
              />
            )}

            {activeTab === 'analytics' && (
              <AnalyticsDashboard />
            )}

            {activeTab === 'evaluation' && (
              <BenchmarkSuite />
            )}

            {activeTab === 'audit' && (
              <AuditSecurity
                currentUser={currentUser}
              />
            )}

            {activeTab === 'users' && currentUser.role === 'admin' && (
              <UserManagement currentUser={currentUser} />
            )}
          </main>

          {/* Footer */}
          <footer className="border-t border-[#1F2A4A] bg-[#0A0F1E] py-3.5 text-center text-xs text-[#7C88AB] transition-colors">
            <div className="max-w-7xl mx-auto px-4 flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="font-semibold text-[#AAB4D0]">Intelligent Brand-Governance Platform</span> • Team DoraAIemon (Chhavi Rani, Neev Wadhwa, Prateek Singh, Paridhi Agarwal)
              </div>
              <div className="font-mono text-[11px] text-[#7C88AB]">
                Inkloom AI • Production Brand Governance
              </div>
            </div>
          </footer>

          {/* Toast Notification System */}
          {toast && (() => {
            const config = TOAST_CONFIGS[toast.type] || TOAST_CONFIGS.info;
            const ToastIcon = config.icon;
            return (
              <div
                role="status"
                aria-live="polite"
                className="fixed bottom-6 right-6 z-50 max-w-sm sm:max-w-md pointer-events-auto motion-safe:animate-slide-up"
              >
                <div
                  className={`p-3.5 rounded-2xl shadow-2xl border bg-[#111830]/95 backdrop-blur-md flex items-start space-x-3 ${config.border} ${config.glow}`}
                >
                  <div className={`p-1.5 rounded-lg shrink-0 mt-0.5 ${config.badge}`}>
                    <ToastIcon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0 pr-1">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-[#7C88AB]">
                      {config.label}
                    </div>
                    <p className="text-xs font-medium text-[#E8ECF8] mt-0.5 leading-snug break-words">
                      {toast.message}
                    </p>
                  </div>
                  <button
                    onClick={() => setToast(null)}
                    aria-label="Dismiss notification"
                    className="text-[#7C88AB] hover:text-[#E8ECF8] hover:bg-[#172040] p-1 rounded-lg transition-colors shrink-0"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })()}
        </>
      )}
    </div>
  );
}
