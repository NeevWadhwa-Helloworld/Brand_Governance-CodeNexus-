import React, { useState, useEffect } from 'react';
import { api } from '../api';
import {
  CheckCircle2, AlertOctagon, MessageSquare, History, FileCheck,
  ShieldCheck, ArrowRight, UserCheck, Download, Clock
} from 'lucide-react';

export default function ApprovalPipeline({ currentUser, onDraftUpdated }) {
  const [drafts, setDrafts] = useState([]);
  const [selectedDraftId, setSelectedDraftId] = useState(null);
  const [currentDraft, setCurrentDraft] = useState(null);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [decisionModal, setDecisionModal] = useState(null);
  const [decisionComment, setDecisionComment] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadApprovalQueue();
  }, []);

  useEffect(() => {
    if (selectedDraftId) {
      loadDraftDetails(selectedDraftId);
      loadComments(selectedDraftId);
    }
  }, [selectedDraftId]);

  async function loadApprovalQueue() {
    setLoading(true);
    try {
      const data = await api.getDrafts();
      setDrafts(data);
      // Select first draft that is 'Pending Approval' or first draft
      const pending = data.find(d => d.status === 'Pending Approval') || data[0];
      if (pending) {
        setSelectedDraftId(pending.id);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function loadDraftDetails(id) {
    try {
      const data = await api.getDraft(id);
      setCurrentDraft(data);
    } catch (e) {
      console.error(e);
    }
  }

  async function loadComments(id) {
    try {
      const data = await api.getComments(id);
      setComments(data);
    } catch (e) {
      console.error(e);
    }
  }

  async function handleDecision(decision) {
    if (!currentDraft) return;
    try {
      await api.decideApproval(currentDraft.id, decision, decisionComment || `Managerial decision: ${decision}`, currentUser.id);
      setDecisionModal(null);
      setDecisionComment('');
      await loadDraftDetails(currentDraft.id);
      await loadApprovalQueue();
      if (onDraftUpdated) onDraftUpdated();
    } catch (e) {
      console.error(e);
    }
  }

  async function handleAddComment(e) {
    e.preventDefault();
    if (!newComment.trim() || !currentDraft) return;
    try {
      await api.postComment(currentDraft.id, newComment, currentUser.id);
      setNewComment('');
      await loadComments(currentDraft.id);
    } catch (e) {
      console.error(e);
    }
  }

  const exportCertificate = () => {
    if (!currentDraft) return;
    const cert = {
      title: "Brand Governance Compliance Certificate",
      platform: "Inkloom AI Intelligent Governance Platform",
      draft_id: currentDraft.id,
      draft_title: currentDraft.title,
      author: currentDraft.author_name || "Creator",
      current_status: currentDraft.status,
      compliance_score: `${currentDraft.latest_revision?.compliance_score ?? 100}%`,
      guideline_version_used: "Inkloom Master Guidelines v3.2 (Active)",
      signed_off_by: currentUser.name,
      reviewer_role: currentUser.role,
      timestamp: new Date().toISOString(),
      flags_audited: currentDraft.latest_revision?.flags?.length || 0
    };
    const blob = new Blob([JSON.stringify(cert, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `brand-compliance-${currentDraft.id}.json`;
    a.click();
  };

  const latestRev = currentDraft?.latest_revision;
  const flags = latestRev?.flags || [];
  const acceptedFlags = flags.filter(f => f.resolution === 'accepted' || f.resolution === 'edited');
  const dismissedFlags = flags.filter(f => f.resolution === 'dismissed');

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Left: Queue of drafts needing review */}
      <div className="lg:col-span-4 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
            Managerial Approval Queue
          </h2>
          <span className="text-xs bg-slate-800 text-slate-300 px-2 py-0.5 rounded font-mono">
            {drafts.filter(d => d.status === 'Pending Approval').length} Pending
          </span>
        </div>

        <div className="space-y-2">
          {drafts.map(d => {
            const isSelected = selectedDraftId === d.id;
            const isPending = d.status === 'Pending Approval';
            const isApproved = d.status === 'Approved';

            return (
              <div
                key={d.id}
                onClick={() => setSelectedDraftId(d.id)}
                className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                  isSelected
                    ? 'bg-slate-900 border-indigo-500 shadow-lg ring-1 ring-indigo-500/30'
                    : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-start justify-between">
                  <h4 className="text-xs font-semibold text-slate-200 line-clamp-1">{d.title}</h4>
                  <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${
                    isApproved ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                    isPending ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30 animate-pulse' :
                    'bg-slate-800 text-slate-400'
                  }`}>
                    {d.status}
                  </span>
                </div>
                <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
                  <span>Author: {d.author_name || 'Riya'}</span>
                  <span>v{d.current_version}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Right: Pre-Audited Draft Review & Decision Panel */}
      <div className="lg:col-span-8 space-y-4">
        {currentDraft ? (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-5">
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
              <div>
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-mono bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded">
                    Guideline v3.2
                  </span>
                  <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold ${
                    currentDraft.status === 'Approved' ? 'bg-emerald-500/20 text-emerald-300' :
                    currentDraft.status === 'Pending Approval' ? 'bg-purple-500/20 text-purple-300' :
                    'bg-amber-500/20 text-amber-300'
                  }`}>
                    {currentDraft.status}
                  </span>
                </div>
                <h2 className="text-lg font-bold text-white mt-1.5">{currentDraft.title}</h2>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center space-x-2">
                <button
                  onClick={exportCertificate}
                  className="flex items-center space-x-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-700 transition-colors"
                  title="Download verifiable compliance certificate"
                >
                  <Download className="w-3.5 h-3.5 text-blue-400" />
                  <span>Audit Certificate</span>
                </button>

                <button
                  onClick={() => setDecisionModal('Changes Requested')}
                  className="flex items-center space-x-1.5 bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/40 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                >
                  <AlertOctagon className="w-3.5 h-3.5" />
                  <span>Request Changes</span>
                </button>

                <button
                  onClick={() => setDecisionModal('Approved')}
                  className="flex items-center space-x-1.5 bg-emerald-600 hover:bg-emerald-500 text-white px-3.5 py-1.5 rounded-lg text-xs font-bold shadow-md transition-colors"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Approve & Sign-Off</span>
                </button>
              </div>
            </div>

            {/* Decision Confirmation Modal */}
            {decisionModal && (
              <div className="bg-slate-950 border border-blue-500/40 rounded-xl p-4 space-y-3">
                <h4 className="text-xs font-bold text-white uppercase flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-blue-400" />
                  Confirm Managerial Action: {decisionModal}
                </h4>
                <p className="text-xs text-slate-400">
                  Provide mandatory sign-off notes or directives for the creator:
                </p>
                <textarea
                  value={decisionComment}
                  onChange={e => setDecisionComment(e.target.value)}
                  placeholder="e.g., Content looks sharp and verified against Fact Sheet v3. Approved for publication."
                  rows={2}
                  className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-xs text-white focus:outline-none focus:border-blue-500"
                />
                <div className="flex justify-end space-x-2">
                  <button
                    onClick={() => setDecisionModal(null)}
                    className="px-3 py-1 text-xs text-slate-400"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleDecision(decisionModal)}
                    className={`px-4 py-1.5 rounded text-xs font-bold text-white ${
                      decisionModal === 'Approved' ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-rose-600 hover:bg-rose-500'
                    }`}
                  >
                    Submit Decision
                  </button>
                </div>
              </div>
            )}

            {/* Content Inspection Box */}
            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Pre-Audited Content Snapshot (v{currentDraft.current_version})
              </h3>
              <div className="bg-slate-950 border border-slate-800 rounded-lg p-4 font-mono text-xs leading-relaxed text-slate-200">
                {currentDraft.content_type === 'text' ? (
                  currentDraft.latest_revision?.content_text || 'No text content available.'
                ) : (
                  <div className="flex justify-center">
                    <img
                      src={currentDraft.content_ref || '/static/uploads/sample_banner.png'}
                      alt="Banner"
                      className="max-h-60 rounded border border-slate-800"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* AI Audit Trail (Flags accepted, edited, dismissed) */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                <span>AI Findings & Creator Resolution Audit Trail</span>
                <span className="text-[11px] font-normal text-slate-500">
                  {acceptedFlags.length} Accepted • {dismissedFlags.length} Creator Overrides
                </span>
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Accepted Fixes */}
                <div className="bg-slate-950/70 border border-emerald-500/20 rounded-lg p-3 space-y-2">
                  <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Accepted Brand Corrections ({acceptedFlags.length})
                  </span>
                  {acceptedFlags.length === 0 ? (
                    <p className="text-[11px] text-slate-500 italic">No automated corrections applied.</p>
                  ) : (
                    acceptedFlags.map(af => (
                      <div key={af.id} className="text-xs border-b border-slate-800/60 pb-1.5 last:border-0">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-mono text-blue-400 font-bold">{af.rule_id}</span>
                          <span className="text-slate-500 uppercase">{af.category}</span>
                        </div>
                        <p className="text-slate-300 text-[11px] mt-0.5">
                          Replaced <span className="text-rose-400 line-through">"{af.span}"</span> with{' '}
                          <span className="text-emerald-300 font-semibold">"{af.fix}"</span>
                        </p>
                      </div>
                    ))
                  )}
                </div>

                {/* Dismissed / Creator Overrides */}
                <div className="bg-slate-950/70 border border-amber-500/20 rounded-lg p-3 space-y-2">
                  <span className="text-xs font-semibold text-amber-400 flex items-center gap-1.5">
                    <History className="w-3.5 h-3.5" />
                    Creator Overrides / Dismissals ({dismissedFlags.length})
                  </span>
                  {dismissedFlags.length === 0 ? (
                    <p className="text-[11px] text-slate-500 italic">No flags dismissed by creator.</p>
                  ) : (
                    dismissedFlags.map(df => (
                      <div key={df.id} className="text-xs border-b border-slate-800/60 pb-1.5 last:border-0">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-mono text-amber-400 font-bold">{df.rule_id}</span>
                          <span className="text-slate-500">{df.span}</span>
                        </div>
                        <p className="text-slate-300 text-[11px] italic mt-0.5">
                          Reason: "{df.resolution_comment || 'Artistic discretion'}"
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Comment Thread */}
            <div className="space-y-3 pt-2 border-t border-slate-800">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-blue-400" />
                Collaborative Decision & Audit Thread
              </h3>

              <div className="space-y-2 max-h-48 overflow-y-auto">
                {comments.map(c => (
                  <div key={c.id} className="bg-slate-950 rounded p-2.5 text-xs border border-slate-800 flex items-start space-x-2">
                    <img src={c.user_avatar || 'https://api.dicebear.com/7.x/avataaars/svg?seed=user'} alt="" className="w-5 h-5 rounded-full mt-0.5" />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-200">{c.user_name} ({c.user_role})</span>
                        <span className="text-[10px] text-slate-500">{new Date(c.timestamp).toLocaleTimeString()}</span>
                      </div>
                      <p className="text-slate-300 mt-1">{c.text}</p>
                    </div>
                  </div>
                ))}
              </div>

              <form onSubmit={handleAddComment} className="flex space-x-2">
                <input
                  type="text"
                  placeholder="Leave comment or guidance for author..."
                  value={newComment}
                  onChange={e => setNewComment(e.target.value)}
                  className="flex-1 bg-slate-950 border border-slate-700 rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
                />
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded text-xs font-medium"
                >
                  Post
                </button>
              </form>
            </div>
          </div>
        ) : (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center text-slate-500">
            Select a draft from the queue to review pre-audited materials.
          </div>
        )}
      </div>
    </div>
  );
}
