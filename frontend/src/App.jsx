import React, { useState, useEffect } from 'react';
import { api } from './api';
import Navbar from './components/Navbar';
import DraftStudio from './components/DraftStudio';
import ApprovalPipeline from './components/ApprovalPipeline';
import SourceOfTruth from './components/SourceOfTruth';
import AnalyticsDashboard from './components/AnalyticsDashboard';
import BenchmarkSuite from './components/BenchmarkSuite';
import AuditSecurity from './components/AuditSecurity';
import UserManagement from './components/UserManagement';

export default function App() {
  const [activeTab, setActiveTab] = useState('studio');
  const [users, setUsers] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [toast, setToast] = useState(null);
  const [authError, setAuthError] = useState(null);
  const [authLoading, setAuthLoading] = useState(false);

  const showToast = (message, type = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    initApp();
  }, []);

  async function initApp() {
    try {
      const uList = await api.getUsers();
      setUsers(uList);
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

  async function refreshPendingCount() {
    try {
      const drafts = await api.getDrafts('Pending Approval');
      setPendingCount(drafts.length);
    } catch (e) {
      console.error(e);
    }
  }

  const ROLE_TABS = {
    creator: ['studio', 'analytics'],
    reviewer: ['approvals', 'analytics', 'audit'],
    admin: ['brain', 'studio', 'approvals', 'analytics', 'evaluation', 'audit']
  };

  const handleSwitchUser = (user) => {
    setCurrentUser(user);
    const allowed = ROLE_TABS[user.role] || ROLE_TABS.creator;
    if (!allowed.includes(activeTab)) {
      setActiveTab(allowed[0]);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {!currentUser ? (
        <main className="flex-1 flex items-center justify-center p-6">
          <form onSubmit={handleLogin} className="w-full max-w-sm rounded-2xl border border-slate-800 bg-slate-900 p-6 space-y-4">
            <div>
              <h1 className="text-xl font-bold text-white">Inkloom Governance</h1>
              <p className="mt-1 text-xs text-slate-400">Sign in to continue</p>
            </div>
            {authError && <div className="rounded-lg border border-rose-500/40 bg-rose-950/30 px-3 py-2 text-xs text-rose-200">{authError}</div>}
            <input name="email" type="email" required placeholder="Email" className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" />
            <input name="password" type="password" required placeholder="Password" className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" />
            <button disabled={authLoading} className="w-full rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">
              {authLoading ? 'Signing in...' : 'Sign in'}
            </button>
            <p className="text-[11px] text-slate-500">Demo password: inkloom-demo</p>
          </form>
        </main>
      ) : <>
      {/* Navigation Bar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        currentUser={currentUser}
        onLogout={handleLogout}
        users={users}
        onSwitchUser={handleSwitchUser}
        pendingCount={pendingCount}
      />

      {/* Toast Notification Container */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 animate-slide-up">
          <div className={`px-4 py-3 rounded-xl shadow-2xl border text-xs font-semibold flex items-center space-x-3 backdrop-blur-md ${
            toast.type === 'success' ? 'bg-emerald-950/90 border-emerald-500/50 text-emerald-200 shadow-emerald-500/10' :
            toast.type === 'error' ? 'bg-rose-950/90 border-rose-500/50 text-rose-200 shadow-rose-500/10' :
            'bg-slate-900/90 border-blue-500/50 text-blue-200 shadow-blue-500/10'
          }`}>
            <span>{toast.message}</span>
            <button
              onClick={() => setToast(null)}
              className="text-slate-400 hover:text-white p-0.5 rounded transition-colors"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {currentUser && (
          <>
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
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950/80 py-4 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <span className="font-semibold text-slate-400">Intelligent Brand-Governance Platform</span> • Team DoraAIemon (Chhavi Rani, Neev Wadhwa, Prateek Singh, Paridhi Agarwal)
          </div>
          <div className="font-mono text-[11px] text-slate-600">
            Problem Statement by Inkloom AI • Round 1 & Round 2 & Round 3 Full Implementation
          </div>
        </div>
      </footer>
      </>}
    </div>
  );
}
