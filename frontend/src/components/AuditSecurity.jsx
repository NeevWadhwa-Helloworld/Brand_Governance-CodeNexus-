import React, { useState, useEffect } from 'react';
import { api } from '../api';
import {
  Clock, Download, RefreshCw, Search, X, ChevronRight, Hash,
  Shield, AlertTriangle, ArrowUpDown
} from 'lucide-react';

export default function AuditSecurity({ currentUser }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState(null);

  // Search, Filter, Sort state
  const [searchQuery, setSearchQuery] = useState('');
  const [actionCategory, setActionCategory] = useState('all'); // all, scans, decisions, flags, governance
  const [sortOrder, setSortOrder] = useState('desc'); // desc (newest), asc (oldest)

  // Detail Modal state
  const [selectedLog, setSelectedLog] = useState(null);

  async function loadAuditData() {
    setLoading(true);
    setError(null);
    try {
      const lData = await api.getAuditLogs(100, currentUser?.id);
      setLogs(lData || []);
    } catch (e) {
      console.error(e);
      setError(e.message || 'Failed to load audit logs.');
    } finally {
      setLoading(false);
    }
  }

  async function handleRefresh() {
    setRefreshing(true);
    setError(null);
    try {
      const lData = await api.getAuditLogs(100, currentUser?.id);
      setLogs(lData || []);
    } catch (e) {
      console.error(e);
      setError(e.message || 'Failed to refresh audit trail.');
    } finally {
      setRefreshing(false);
    }
  }

  async function handleExport() {
    try {
      setExporting(true);
      setError(null);
      await api.exportAuditLogs(currentUser?.id);
    } catch (e) {
      setError(e.message || 'Failed to export audit logs.');
    } finally {
      setExporting(false);
    }
  }

  useEffect(() => {
    loadAuditData();
  }, []);

  const actionBadgeColors = {
    scan_completed: 'bg-[#60A5FA]/15 text-[#60A5FA] border-[#60A5FA]/30',
    flag_accepted: 'bg-[#34D399]/15 text-[#34D399] border-[#34D399]/30',
    flag_edited: 'bg-[#38BDF8]/15 text-[#38BDF8] border-[#38BDF8]/30',
    flag_dismissed: 'bg-[#FBBF24]/15 text-[#FBBF24] border-[#FBBF24]/30',
    draft_approved: 'bg-[#34D399]/20 text-[#34D399] border-[#34D399]/40',
    draft_changes_requested: 'bg-[#F87171]/15 text-[#F87171] border-[#F87171]/30',
    submitted_for_approval: 'bg-[#A78BFA]/15 text-[#A78BFA] border-[#A78BFA]/30',
    draft_created: 'bg-[#818CF8]/15 text-[#818CF8] border-[#818CF8]/30',
    draft_updated: 'bg-[#60A5FA]/15 text-[#60A5FA] border-[#60A5FA]/30',
    rule_created: 'bg-[#C084FC]/15 text-[#C084FC] border-[#C084FC]/30',
    rule_deleted: 'bg-[#F87171]/15 text-[#F87171] border-[#F87171]/30',
    guideline_version_ingested: 'bg-[#818CF8]/20 text-[#A5B4FC] border-[#818CF8]/40'
  };

  const roleBadgeColors = {
    creator: 'bg-[#60A5FA]/15 text-[#60A5FA] border-[#60A5FA]/30',
    reviewer: 'bg-[#A78BFA]/15 text-[#A78BFA] border-[#A78BFA]/30',
    admin: 'bg-[#34D399]/15 text-[#34D399] border-[#34D399]/30'
  };

  // Filter logs by action category & search
  const filteredLogs = logs
    .filter(log => {
      // Category Filter
      let matchesCat = true;
      if (actionCategory === 'scans') {
        matchesCat = log.action === 'scan_completed';
      } else if (actionCategory === 'decisions') {
        matchesCat = ['draft_approved', 'draft_changes_requested', 'submitted_for_approval'].includes(log.action);
      } else if (actionCategory === 'flags') {
        matchesCat = ['flag_accepted', 'flag_edited', 'flag_dismissed'].includes(log.action);
      } else if (actionCategory === 'governance') {
        matchesCat = ['rule_created', 'rule_deleted', 'guideline_version_ingested', 'draft_created', 'draft_updated'].includes(log.action);
      }

      // Search Filter
      const detailsStr = typeof log.details === 'object' ? JSON.stringify(log.details) : String(log.details || '');
      const matchesSearch =
        !searchQuery.trim() ||
        (log.user_name && log.user_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (log.user_role && log.user_role.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (log.action && log.action.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (log.draft_title && log.draft_title.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (log.draft_id && log.draft_id.toLowerCase().includes(searchQuery.toLowerCase())) ||
        detailsStr.toLowerCase().includes(searchQuery.toLowerCase());

      return matchesCat && matchesSearch;
    })
    .sort((a, b) => {
      const timeA = new Date(a.timestamp).getTime() || 0;
      const timeB = new Date(b.timestamp).getTime() || 0;
      return sortOrder === 'desc' ? timeB - timeA : timeA - timeB;
    });

  return (
    <div className="space-y-6 motion-safe:animate-fade-in">
      {error && (
        <div className="rounded-xl border border-[#F87171]/40 bg-[#F87171]/10 px-4 py-3 text-xs text-[#F87171] flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-[#E8ECF8] hover:underline font-medium ml-3 shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#1F2A4A] pb-4">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#36D6A0]/15 border border-[#36D6A0]/30 flex items-center justify-center text-[#36D6A0]">
              <Clock className="w-4 h-4" />
            </div>
            <h2 className="text-base sm:text-lg font-bold text-[#E8ECF8]">
              Audit log
            </h2>
          </div>
          <p className="text-xs text-[#7C88AB] mt-1 ml-10.5">
            Review and export recent activity for this workspace.
          </p>
        </div>

        <div className="flex items-center space-x-2.5">
          <button
            type="button"
            onClick={handleExport}
            disabled={exporting}
            className="text-xs bg-[#0E1428] hover:bg-[#172040] text-[#AAB4D0] hover:text-[#E8ECF8] border border-[#1F2A4A] px-3.5 py-1.5 rounded-xl flex items-center space-x-1.5 transition-all shadow-sm disabled:opacity-60"
            title="Download up to the 500 most recent audit events as CSV"
          >
            <Download className="w-3.5 h-3.5 text-[#36D6A0]" />
            <span>{exporting ? 'Exporting CSV...' : 'Export CSV'}</span>
          </button>

          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            className="text-xs bg-[#172040] hover:bg-[#1F2A4A] text-[#E8ECF8] border border-[#1F2A4A] px-3.5 py-1.5 rounded-xl flex items-center space-x-1.5 transition-all shadow-sm font-semibold"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#36D6A0] ${refreshing ? 'animate-spin' : ''}`} />
            <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {/* Audit log */}
      <div className="bg-[#111830] border border-[#1F2A4A] rounded-2xl p-5 sm:p-6 space-y-4 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1F2A4A] pb-3.5">
          <div className="flex items-center space-x-2.5">
            <Clock className="w-4 h-4 text-[#4F6BED]" />
            <h3 className="text-sm font-bold text-[#E8ECF8] uppercase tracking-wider">
              Recent events
            </h3>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-[#172040] text-[#AAB4D0] border border-[#1F2A4A]">
              {filteredLogs.length} matching · {logs.length} recent events loaded (up to 100)
            </span>
          </div>
          <span className="text-[11px] font-mono text-[#7C88AB] flex items-center gap-1.5">
            <Hash className="w-3.5 h-3.5 text-[#34D399]" />
            SHA-256 event hashes recorded
          </span>
        </div>

        {/* Filter and Search Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Action Category Tabs */}
          <div className="flex items-center space-x-1.5 overflow-x-auto no-scrollbar text-xs">
            {[
              { id: 'all', label: 'All Events' },
              { id: 'decisions', label: 'Approvals & Decisions' },
              { id: 'scans', label: 'AI Scans' },
              { id: 'flags', label: 'Flag Resolutions' },
              { id: 'governance', label: 'Governance & Rules' }
            ].map(cat => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActionCategory(cat.id)}
                className={`px-3 py-1.5 rounded-xl border text-xs font-semibold whitespace-nowrap transition-all ${
                  actionCategory === cat.id
                    ? 'bg-[#172040] border-[#4F6BED] text-[#E8ECF8]'
                    : 'bg-[#0E1428] border-[#1F2A4A] text-[#7C88AB] hover:text-[#E8ECF8]'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Search & Sort Controls */}
          <div className="flex items-center space-x-2">
            <div className="relative min-w-[200px]">
              <Search className="w-3.5 h-3.5 text-[#7C88AB] absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search actor, action, draft..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-[#0E1428] border border-[#1F2A4A] rounded-xl pl-8 pr-3 py-1.5 text-xs text-[#E8ECF8] placeholder-[#7C88AB] focus:outline-none focus:border-[#4F6BED]"
              />
            </div>

            <button
              type="button"
              onClick={() => setSortOrder(prev => (prev === 'desc' ? 'asc' : 'desc'))}
              className="bg-[#0E1428] hover:bg-[#172040] border border-[#1F2A4A] text-[#AAB4D0] hover:text-[#E8ECF8] p-1.5 rounded-xl transition-colors shrink-0"
              title={`Sort ${sortOrder === 'desc' ? 'Oldest first' : 'Newest first'}`}
            >
              <ArrowUpDown className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Audit Log Table */}
        <div className="overflow-x-auto rounded-xl border border-[#1F2A4A] bg-[#0E1428]">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#0A0F1E] text-[#7C88AB] uppercase text-[10px] tracking-wider border-b border-[#1F2A4A] font-mono">
              <tr>
                <th className="p-3.5">Timestamp (UTC)</th>
                <th className="p-3.5">User & Persona</th>
                <th className="p-3.5">Governance Action</th>
                <th className="p-3.5">Draft / Resource</th>
                <th className="p-3.5">Audit Snapshot / Details</th>
                <th className="p-3.5 text-right">Inspect</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1F2A4A]/60 text-[#AAB4D0]">
              {loading && logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-xs text-[#7C88AB] animate-pulse">
                    Loading audit events...
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-xs text-[#7C88AB] italic">
                    No governance audit entries match your search or filter.
                  </td>
                </tr>
              ) : (
                filteredLogs.map(log => {
                  const detailsStr = typeof log.details === 'object' ? JSON.stringify(log.details) : String(log.details || '');
                  const dateObj = new Date(log.timestamp);
                  return (
                    <tr
                      key={log.id}
                      onClick={() => setSelectedLog(log)}
                      className="hover:bg-[#141C33] cursor-pointer transition-colors group"
                    >
                      <td className="p-3.5 font-mono text-[#7C88AB] whitespace-nowrap text-[11px]">
                        <div>{dateObj.toLocaleDateString()}</div>
                        <div className="text-[10px] text-[#7C88AB]/70">{dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</div>
                      </td>

                      <td className="p-3.5">
                        <div className="font-semibold text-[#E8ECF8]">{log.user_name || 'System User'}</div>
                        <span className={`inline-block mt-0.5 text-[9px] uppercase font-mono font-bold px-1.5 py-0.2 rounded border ${
                          roleBadgeColors[log.user_role] || 'bg-[#7C88AB]/15 text-[#AAB4D0] border-[#7C88AB]/30'
                        }`}>
                          {log.user_role || 'user'}
                        </span>
                      </td>

                      <td className="p-3.5">
                        <span className={`px-2 py-0.5 rounded-full border text-[10px] font-mono uppercase font-bold whitespace-nowrap ${
                          actionBadgeColors[log.action] || 'bg-[#7C88AB]/15 text-[#AAB4D0] border-[#7C88AB]/30'
                        }`}>
                          {log.action}
                        </span>
                      </td>

                      <td className="p-3.5 font-medium text-[#E8ECF8] max-w-[180px] truncate">
                        {log.draft_title ? (
                          <span title={log.draft_title} className="truncate block">{log.draft_title}</span>
                        ) : log.draft_id ? (
                          <span className="font-mono text-[#60A5FA] text-[11px] truncate block">{log.draft_id}</span>
                        ) : (
                          <span className="text-[#7C88AB] italic">Global Policy</span>
                        )}
                      </td>

                      <td className="p-3.5 font-mono text-[11px] text-[#AAB4D0] max-w-[280px]">
                        <div className="bg-[#0A0F1E] px-2.5 py-1 rounded-lg border border-[#1F2A4A]/60 overflow-hidden text-ellipsis whitespace-nowrap">
                          {detailsStr}
                        </div>
                      </td>

                      <td className="p-3.5 text-right">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedLog(log);
                          }}
                          className="text-[#7C88AB] group-hover:text-[#60A5FA] p-1 rounded transition-colors"
                          title="Inspect event details and recorded hashes"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detailed Event Inspection Modal */}
      {selectedLog && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 bg-[#0A0F1E]/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 motion-safe:animate-fade-in"
        >
          <div className="bg-[#111830] border border-[#4F6BED]/50 rounded-2xl max-w-xl w-full p-6 space-y-4 shadow-2xl relative">
            <div className="flex items-start justify-between border-b border-[#1F2A4A] pb-3.5">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-[#4F6BED]/15 border border-[#4F6BED]/30 flex items-center justify-center text-[#4F6BED] shrink-0">
                  <Shield className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#E8ECF8] uppercase tracking-wide">
                    Audit Event Payload Inspector
                  </h3>
                  <p className="text-[11px] text-[#60A5FA] font-mono">
                    Event ID: {selectedLog.id}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className="text-[#7C88AB] hover:text-[#E8ECF8] p-1.5 rounded-lg hover:bg-[#172040] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              {/* Event Attributes Grid */}
              <div className="grid grid-cols-2 gap-3 bg-[#0E1428] border border-[#1F2A4A] rounded-xl p-3.5">
                <div>
                  <span className="text-[#7C88AB] block text-[10px] uppercase font-semibold">Governance Action</span>
                  <span className={`inline-block mt-0.5 px-2 py-0.5 rounded-full border text-[10px] font-mono font-bold uppercase ${
                    actionBadgeColors[selectedLog.action] || 'bg-[#7C88AB]/15 text-[#AAB4D0] border-[#7C88AB]/30'
                  }`}>
                    {selectedLog.action}
                  </span>
                </div>

                <div>
                  <span className="text-[#7C88AB] block text-[10px] uppercase font-semibold">Timestamp (UTC)</span>
                  <span className="text-[#E8ECF8] font-mono text-[11px]">
                    {new Date(selectedLog.timestamp).toISOString()}
                  </span>
                </div>

                <div>
                  <span className="text-[#7C88AB] block text-[10px] uppercase font-semibold">User & Actor</span>
                  <span className="text-[#E8ECF8] font-medium">
                    {selectedLog.user_name || 'System User'}{' '}
                    <span className="text-[10px] text-[#7C88AB]">({selectedLog.user_role || 'user'})</span>
                  </span>
                </div>

                <div>
                  <span className="text-[#7C88AB] block text-[10px] uppercase font-semibold">Target Resource</span>
                  <span className="text-[#E8ECF8] font-medium truncate block">
                    {selectedLog.draft_title || selectedLog.draft_id || 'System Global'}
                  </span>
                </div>
              </div>

              {/* Stored hash values */}
              <div className="bg-[#0E1428] border border-[#1F2A4A] rounded-xl p-3.5 space-y-2">
                <span className="text-[#7C88AB] block text-[10px] uppercase font-semibold flex items-center gap-1.5">
                  <Hash className="w-3.5 h-3.5 text-[#34D399]" />
                  Recorded event hashes
                </span>
                <p className="text-[10px] leading-relaxed text-[#7C88AB]">
                  Hash values are shown for reference; this view does not independently verify the full chain.
                </p>
                <div className="space-y-1 font-mono text-[11px]">
                  <div className="flex justify-between">
                    <span className="text-[#7C88AB]">Entry Hash:</span>
                    <span className="text-[#34D399] truncate max-w-[280px]" title={selectedLog.entry_hash}>
                      {selectedLog.entry_hash || 'Hash not available'}
                    </span>
                  </div>
                  {selectedLog.previous_hash && (
                    <div className="flex justify-between">
                      <span className="text-[#7C88AB]">Previous Hash:</span>
                      <span className="text-[#7C88AB] truncate max-w-[280px]" title={selectedLog.previous_hash}>
                        {selectedLog.previous_hash}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Raw Details JSON */}
              <div className="space-y-1.5">
                <span className="text-[#7C88AB] block text-[10px] uppercase font-semibold">
                  Event Details Snapshot
                </span>
                <pre className="bg-[#0A0F1E] border border-[#1F2A4A] rounded-xl p-3 text-[11px] font-mono text-[#E8ECF8] max-h-48 overflow-y-auto leading-relaxed">
                  {JSON.stringify(selectedLog.details, null, 2)}
                </pre>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-[#1F2A4A]">
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className="px-4 py-1.5 text-xs font-semibold text-[#E8ECF8] bg-[#172040] hover:bg-[#1F2A4A] border border-[#1F2A4A] rounded-xl transition-colors"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
