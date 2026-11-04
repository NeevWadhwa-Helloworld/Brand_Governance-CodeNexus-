import React from 'react';
import { ShieldCheck, Sparkles, UserCheck, FileText, CheckCircle, Brain, BarChart3, TestTube2, Lock } from 'lucide-react';

export default function Navbar({ activeTab, setActiveTab, currentUser, users, onSwitchUser, pendingCount }) {
  const tabs = [
    { id: 'studio', label: 'Draft Studio & Scanner', icon: FileText },
    { id: 'approvals', label: 'Approval Queue', icon: CheckCircle, badge: pendingCount },
    { id: 'brain', label: 'Source of Truth Brain', icon: Brain },
    { id: 'analytics', label: 'Governance Analytics', icon: BarChart3 },
    { id: 'evaluation', label: 'Benchmark Suite (Sec 9.1)', icon: TestTube2 },
    { id: 'audit', label: 'Audit & Security', icon: Lock },
  ];

  return (
    <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur sticky top-0 z-50">
      {/* Top Banner */}
      <div className="max-w-7xl mx-auto px-4 py-2 flex flex-wrap items-center justify-between border-b border-slate-800/60 text-xs">
        <div className="flex items-center space-x-3 text-slate-400">
          <span className="flex items-center gap-1 text-blue-400 font-medium">
            <ShieldCheck className="w-4 h-4 text-blue-500" />
            Inkloom AI Governance Engine
          </span>
          <span className="text-slate-600">|</span>
          <span className="bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded-full font-mono">
            Team: DoraAIemon
          </span>
          <span className="hidden sm:inline text-slate-500">
            Multimodal Two-Layer Grounded RAG
          </span>
        </div>

        {/* Persona Switcher */}
        <div className="flex items-center space-x-3">
          <span className="text-slate-400 font-medium">Acting as:</span>
          <div className="flex items-center space-x-1 bg-slate-800/90 p-1 rounded-lg border border-slate-700">
            {users.map(u => {
              const isSelected = currentUser?.id === u.id;
              const roleColors = {
                creator: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
                reviewer: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
                admin: 'bg-amber-500/20 text-amber-300 border-amber-500/30'
              };

              return (
                <button
                  key={u.id}
                  onClick={() => onSwitchUser(u)}
                  className={`flex items-center space-x-1.5 px-2.5 py-1 rounded text-xs transition-all ${
                    isSelected
                      ? 'bg-blue-600 text-white font-medium shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
                  }`}
                  title={`${u.name} (${u.role.toUpperCase()})`}
                >
                  <img src={u.avatar} alt={u.name} className="w-4 h-4 rounded-full" />
                  <span>{u.name.split(' ')[0]}</span>
                  <span className={`text-[10px] uppercase px-1 py-0.2 rounded border ${roleColors[u.role]}`}>
                    {u.role}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Tabs Navigation */}
      <div className="max-w-7xl mx-auto px-4 flex items-center justify-between">
        <nav className="flex space-x-1 overflow-x-auto py-2">
          {tabs.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                  isActive
                    ? 'bg-blue-600/15 text-blue-400 border border-blue-500/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-blue-400' : 'text-slate-500'}`} />
                <span>{tab.label}</span>
                {tab.badge > 0 && (
                  <span className="bg-amber-500 text-slate-950 font-bold text-[10px] px-1.5 py-0.5 rounded-full">
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

