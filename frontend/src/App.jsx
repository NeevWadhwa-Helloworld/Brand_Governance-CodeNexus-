import React, { useState, useEffect } from 'react';
import { api } from './api';
import Navbar from './components/Navbar';
import DraftStudio from './components/DraftStudio';
import ApprovalPipeline from './components/ApprovalPipeline';
import SourceOfTruth from './components/SourceOfTruth';
import AnalyticsDashboard from './components/AnalyticsDashboard';
import BenchmarkSuite from './components/BenchmarkSuite';
import AuditSecurity from './components/AuditSecurity';

export default function App() {
  const [activeTab, setActiveTab] = useState('studio');
  const [users, setUsers] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    initApp();
  }, []);

  async function initApp() {
    try {
      const uList = await api.getUsers();
      setUsers(uList);
      if (uList.length > 0) {
        // Default to Riya Sharma (Creator)
        const defaultUser = uList.find(u => u.role === 'creator') || uList[0];
        setCurrentUser(defaultUser);
      }
      refreshPendingCount();
    } catch (e) {
      console.error("Failed to initialize app:", e);
    }
  }

  async function refreshPendingCount() {
    try {
      const drafts = await api.getDrafts('Pending Approval');
      setPendingCount(drafts.length);
    } catch (e) {
      console.error(e);
    }
  }

  const handleSwitchUser = (user) => {
    setCurrentUser(user);
    // If switching to reviewer, hint or auto-navigate to Approval Pipeline
    if (user.role === 'reviewer' && activeTab === 'studio') {
      setActiveTab('approvals');
    }
    // If switching to admin, hint or auto-navigate to Source of Truth Brain
    else if (user.role === 'admin' && activeTab === 'studio') {
      setActiveTab('brain');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Navigation Bar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        currentUser={currentUser}
        users={users}
        onSwitchUser={handleSwitchUser}
        pendingCount={pendingCount}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {currentUser && (
          <>
            {activeTab === 'studio' && (
              <DraftStudio
                currentUser={currentUser}
                onDraftUpdated={refreshPendingCount}
              />
            )}

            {activeTab === 'approvals' && (
              <ApprovalPipeline
                currentUser={currentUser}
                onDraftUpdated={refreshPendingCount}
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
    </div>
  );
}
