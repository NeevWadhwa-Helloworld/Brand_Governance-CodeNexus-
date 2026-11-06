import React, { useState, useEffect } from 'react';
import { api } from '../api';
import {
  Lock, ShieldCheck, EyeOff, Server, Clock, User, AlertCircle, FileText, Download
} from 'lucide-react';

export default function AuditSecurity({ currentUser }) {
  const [logs, setLogs] = useState([]);
  const [systemInfo, setSystemInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadAuditData();
  }, []);

  async function loadAuditData() {
    setLoading(true);
    try {
      const [lData, sData] = await Promise.all([
        api.getAuditLogs(60, currentUser?.id),
        api.getSystemInfo()
      ]);
      setLogs(lData);
      setSystemInfo(sData);
    } catch (e) {
      console.error(e);
      setError(e.message);
    } finally {
      setLoading(false);
    }

  }

  async function handleExport() {
    try {
      setError(null);
      await api.exportAuditLogs(currentUser?.id);
    } catch (e) {
      setError(e.message);
    }
  }

  const actionBadgeColors = {
    scan_completed: 'bg-blue-500/10 text-blue-300 border-blue-500/30',
    flag_accepted: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
    flag_dismissed: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
    draft_approved: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    draft_changes_requested: 'bg-rose-500/10 text-rose-300 border-rose-500/30',
    rule_created: 'bg-purple-500/10 text-purple-300 border-purple-500/30',
    guideline_version_ingested: 'bg-indigo-500/10 text-indigo-300 border-indigo-500/30'
  };

  return (
    <div className="space-y-6">
      {error && <div className="rounded-lg border border-rose-500/40 bg-rose-950/30 px-4 py-3 text-xs text-rose-200">{error}</div>}
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Lock className="w-5 h-5 text-blue-400" />
            Security & Immutable Audit Trail
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Section 6.2 Security and Privacy: Data isolation, PII sanitization, and tamper-proof governance audit logs.
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={handleExport}
            className="text-xs bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 px-3 py-1.5 rounded-lg flex items-center space-x-1.5 transition-colors"
            title="Download complete immutable audit logs in CSV format"
          >
            <Download className="w-3.5 h-3.5 text-blue-400" />
            <span>Export CSV</span>
          </button>
          <button
            onClick={loadAuditData}
            className="text-xs bg-slate-900 hover:bg-slate-850 text-slate-300 border border-slate-700 px-3 py-1.5 rounded-lg transition-colors"
          >
            Refresh Logs
          </button>
        </div>
      </div>

      {/* Security Architecture Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2">
          <div className="flex items-center space-x-2 text-xs font-bold text-emerald-400 uppercase">
            <ShieldCheck className="w-4 h-4" />
            <span>Strict Per-Org Data Isolation</span>
          </div>
          <p className="text-xs text-slate-300">
            Tenant boundaries enforced across all SQLite/Turso tables, RAG vectors, and API endpoints.
          </p>
          <div className="text-[10px] text-slate-500 font-mono">
            Active Tenant: org_inkloom
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2">
          <div className="flex items-center space-x-2 text-xs font-bold text-blue-400 uppercase">
            <EyeOff className="w-4 h-4" />
            <span>PII Redaction Engine</span>
          </div>
          <p className="text-xs text-slate-300">
            Automated redaction of emails, phone numbers, and identifying tokens prior to external model evaluations.
          </p>
          <div className="text-[10px] text-emerald-400 font-mono">
            Status: ACTIVE (Enabled in .env)
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2">
          <div className="flex items-center space-x-2 text-xs font-bold text-purple-400 uppercase">
            <Server className="w-4 h-4" />
            <span>Grounded RAG Policy Guard</span>
          </div>
          <p className="text-xs text-slate-300">
            The current policy guard restricts model context to retrieved numbered rules and discards ungrounded flags.
          </p>
          <div className="text-[10px] text-purple-400 font-mono">
            Provider: {systemInfo?.ai_engine?.provider || 'Gemini Multimodal Adapter'}
          </div>
        </div>
      </div>

      {/* Immutable Audit Log Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden space-y-3 p-5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Clock className="w-4 h-4 text-slate-400" />
            Immutable Governance Audit Events ({logs.length})
          </h3>
          <span className="text-[11px] text-slate-500">Append-Only Cryptographic Log</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
              <tr>
                <th className="p-3">Timestamp (UTC)</th>
                <th className="p-3">User & Persona</th>
                <th className="p-3">Governance Action</th>
                <th className="p-3">Draft / Entity</th>
                <th className="p-3">Audit Details & Snapshot</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-slate-300">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-4 text-center text-slate-500">No audit entries logged yet.</td>
                </tr>
              ) : (
                logs.map(log => (
                  <tr key={log.id} className="hover:bg-slate-850/50">
                    <td className="p-3 font-mono text-slate-400 whitespace-nowrap text-[11px]">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="p-3">
                      <div className="font-semibold text-slate-200">{log.user_name || 'System User'}</div>
                      <div className="text-[10px] uppercase text-slate-500">{log.user_role || 'Creator'}</div>
                    </td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded border text-[10px] font-mono uppercase ${
                        actionBadgeColors[log.action] || 'bg-slate-800 text-slate-300'
                      }`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="p-3 font-medium text-slate-300 max-w-xs truncate">
                      {log.draft_title || log.draft_id || 'System Global'}
                    </td>
                    <td className="p-3 font-mono text-[11px] text-slate-400 max-w-md">
                      {typeof log.details === 'object' ? (
                        <div className="bg-slate-950 p-1.5 rounded border border-slate-850 overflow-hidden text-ellipsis whitespace-nowrap">
                          {JSON.stringify(log.details)}
                        </div>
                      ) : (
                        log.details
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
