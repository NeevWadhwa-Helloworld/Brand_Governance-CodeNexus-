import React, { useState, useEffect, useRef } from 'react';
import { api, mediaUrl } from '../api';
import {
  CheckCircle2, AlertOctagon, MessageSquare, History, FileCheck,
  ShieldCheck, Download, Search, X, Send, FileText,
  TestTube2, Image as ImageIcon, ImageOff
} from 'lucide-react';

export default function ApprovalPipeline({ currentUser, onDraftUpdated, showToast }) {
  const [drafts, setDrafts] = useState([]);
  const [selectedDraftId, setSelectedDraftId] = useState(null);
  const [currentDraft, setCurrentDraft] = useState(null);
  const [comments, setComments] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [activeGuidelineVersion, setActiveGuidelineVersion] = useState(null);
  const [newComment, setNewComment] = useState('');
  const [decisionModal, setDecisionModal] = useState(null);
  const [decisionComment, setDecisionComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showCertModal, setShowCertModal] = useState(false);
  const [failedMediaDraftId, setFailedMediaDraftId] = useState(null);
  const mediaElementRef = useRef(null);

  const mediaLoadError = failedMediaDraftId === currentDraft?.id;

  async function loadActiveGuideline() {
    try {
      const rules = await api.getRules();
      setActiveGuidelineVersion(rules?.find(rule => rule.guideline_version)?.guideline_version || null);
    } catch (e) {
      console.error(e);
    }
  }

  async function loadDraftAuditLogs(id) {
    try {
      const data = await api.getDraftAuditLogs(id);
      setAuditLogs(data || []);
    } catch (e) {
      console.error(e);
    }
  }

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

  useEffect(() => {
    loadApprovalQueue();
    loadActiveGuideline();
  }, []);

  useEffect(() => {
    if (selectedDraftId) {
      loadDraftDetails(selectedDraftId);
      loadComments(selectedDraftId);
      loadDraftAuditLogs(selectedDraftId);
    }
  }, [selectedDraftId]);

  async function handleDecision(decision) {
    if (!currentDraft) return;
    if (decision === 'Changes Requested' && !decisionComment.trim()) {
      if (showToast) showToast('Add specific feedback before requesting changes.', 'warning');
      return;
    }
    try {
      await api.decideApproval(
        currentDraft.id,
        decision,
        decisionComment.trim() || `Managerial decision: ${decision}`,
        currentUser.id
      );
      setDecisionModal(null);
      setDecisionComment('');
      await loadDraftDetails(currentDraft.id);
      await loadComments(currentDraft.id);
      await loadDraftAuditLogs(currentDraft.id);
      await loadApprovalQueue();
      if (onDraftUpdated) onDraftUpdated();
      if (showToast) {
        showToast(
          decision === 'Approved' 
            ? `Draft "${currentDraft.title}" officially approved!` 
            : `Changes requested on "${currentDraft.title}"`,
          decision === 'Approved' ? 'success' : 'error'
        );
      }
    } catch (e) {
      console.error(e);
      if (showToast) showToast("Failed to submit decision", "error");
    }
  }

  async function handleAddComment(e) {
    e.preventDefault();
    if (!newComment.trim() || !currentDraft) return;
    try {
      await api.postComment(currentDraft.id, newComment, currentUser.id);
      setNewComment('');
      await loadComments(currentDraft.id);
      if (showToast) showToast("Comment posted to audit thread", "info");
    } catch (e) {
      console.error(e);
    }
  }

  const latestRev = currentDraft?.latest_revision;
  const flags = latestRev?.flags || [];
  const reviewText = latestRev?.content_text || (
    currentDraft?.content_type === 'text' ? currentDraft.content_ref : ''
  );
  const mediaAnalysis = latestRev?.media_analysis || {};
  const acceptedFlags = flags.filter(f => f.resolution === 'accepted' || f.resolution === 'edited');
  const dismissedFlags = flags.filter(f => f.resolution === 'dismissed');
  const issueCount = flags.length;

  const signOffRecord = currentDraft?.status === 'Approved'
    ? (() => {
        const commentSignOff = comments.slice().reverse().find(c => c.decision === 'approved');
        if (commentSignOff) {
          return {
            user_name: commentSignOff.user_name,
            user_role: commentSignOff.user_role,
            timestamp: commentSignOff.timestamp,
            comment: commentSignOff.text
          };
        }
        const auditSignOff = auditLogs.find(l => l.action === 'draft_approved');
        if (auditSignOff) {
          return {
            user_name: auditSignOff.user_name,
            user_role: auditSignOff.user_role,
            timestamp: auditSignOff.timestamp,
            comment: auditSignOff.details?.comment || null
          };
        }
        return null;
      })()
    : null;

  const certTimestamp = signOffRecord?.timestamp || currentDraft?.updated_at || currentDraft?.created_at || null;

  const exportCertificate = () => {
    if (!currentDraft) return;
    const cert = {
      title: "Brand Governance Compliance Certificate",
      platform: "Inkloom AI Intelligent Governance Platform",
      draft_id: currentDraft.id,
      draft_title: currentDraft.title,
      author: currentDraft.author_name || "Creator",
      current_status: currentDraft.status,
      compliance_score: latestRev ? `${latestRev.compliance_score}%` : 'Not scanned',
      guideline_version_used: activeGuidelineVersion
        ? `Inkloom Master Guidelines ${activeGuidelineVersion} (Active)`
        : 'Active guideline version unavailable',
      sign_off_status: signOffRecord
        ? "Signed"
        : (currentDraft.status === 'In Revision' ? 'Unsigned (In Revision)' : `Unsigned (${currentDraft.status})`),
      signed_off_by: signOffRecord ? signOffRecord.user_name : null,
      reviewer_role: signOffRecord ? signOffRecord.user_role : null,
      sign_off_notes: signOffRecord?.comment || null,
      timestamp: certTimestamp,
      flags_audited: issueCount
    };
    const blob = new Blob([JSON.stringify(cert, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `brand-compliance-${currentDraft.id}.json`;
    a.click();
  };

  const pendingCount = drafts.filter(d => d.status === 'Pending Approval').length;

  const filteredDrafts = drafts.filter(d => {
    const matchesStatus =
      statusFilter === 'all'
        ? true
        : statusFilter === 'pending'
        ? d.status === 'Pending Approval'
        : statusFilter === 'approved'
        ? d.status === 'Approved'
        : statusFilter === 'changes'
        ? d.status === 'Changes Requested'
        : true;

    const matchesSearch =
      !searchQuery.trim() ||
      (d.title && d.title.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (d.author_name && d.author_name.toLowerCase().includes(searchQuery.toLowerCase()));

    return matchesStatus && matchesSearch;
  });
  const selectedDraftIsVisible = filteredDrafts.some(d => d.id === selectedDraftId);

  const statusStyles = {
    'Approved': 'bg-[#34D399]/15 text-[#34D399] border-[#34D399]/30',
    'Pending Approval': 'bg-[#A78BFA]/15 text-[#A78BFA] border-[#A78BFA]/30',
    'Changes Requested': 'bg-[#F87171]/15 text-[#F87171] border-[#F87171]/30',
    'In Revision': 'bg-[#FBBF24]/15 text-[#FBBF24] border-[#FBBF24]/30',
    'Scanned': 'bg-[#60A5FA]/15 text-[#60A5FA] border-[#60A5FA]/30',
    'Submitted': 'bg-[#7C88AB]/15 text-[#AAB4D0] border-[#7C88AB]/30'
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Left: Queue of drafts needing review */}
      <div className="lg:col-span-4 space-y-4">
        {/* Header with Pending Badge */}
        <div className="flex items-center justify-between border-b border-[#1F2A4A] pb-2.5">
          <div className="flex items-center gap-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#AAB4D0]">
              Managerial Approval Queue
            </h2>
            <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-[#A78BFA]/20 border border-[#A78BFA]/30 text-[#A78BFA]">
              {pendingCount} Pending
            </span>
          </div>
        </div>

        {/* Search & Filter Controls */}
        <div className="space-y-2">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#7C88AB]">
              <Search className="w-3.5 h-3.5" />
            </div>
            <input
              type="text"
              placeholder="Search by title or author..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-[#0E1428] border border-[#1F2A4A] rounded-xl pl-9 pr-3 py-2 text-xs text-[#E8ECF8] placeholder-[#7C88AB] focus:outline-none focus:border-[#4F6BED] transition-colors"
            />
          </div>

          <div className="flex items-center space-x-1 overflow-x-auto no-scrollbar text-xs">
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`px-2.5 py-1 rounded-lg border text-[11px] font-semibold transition-all ${
                statusFilter === 'all'
                  ? 'bg-[#172040] border-[#4F6BED] text-[#E8ECF8]'
                  : 'bg-[#0E1428] border-[#1F2A4A] text-[#7C88AB] hover:text-[#E8ECF8]'
              }`}
            >
              All ({drafts.length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('pending')}
              className={`px-2.5 py-1 rounded-lg border text-[11px] font-semibold transition-all ${
                statusFilter === 'pending'
                  ? 'bg-[#172040] border-[#4F6BED] text-[#E8ECF8]'
                  : 'bg-[#0E1428] border-[#1F2A4A] text-[#7C88AB] hover:text-[#E8ECF8]'
              }`}
            >
              Pending ({pendingCount})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('approved')}
              className={`px-2.5 py-1 rounded-lg border text-[11px] font-semibold transition-all ${
                statusFilter === 'approved'
                  ? 'bg-[#172040] border-[#4F6BED] text-[#E8ECF8]'
                  : 'bg-[#0E1428] border-[#1F2A4A] text-[#7C88AB] hover:text-[#E8ECF8]'
              }`}
            >
              Approved
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('changes')}
              className={`px-2.5 py-1 rounded-lg border text-[11px] font-semibold transition-all ${
                statusFilter === 'changes'
                  ? 'bg-[#172040] border-[#4F6BED] text-[#E8ECF8]'
                  : 'bg-[#0E1428] border-[#1F2A4A] text-[#7C88AB] hover:text-[#E8ECF8]'
              }`}
            >
              Changes
            </button>
          </div>
        </div>

        {/* Queue Draft Cards */}
        <div className="space-y-2">
          {filteredDrafts.length === 0 && !loading && (
            <div className="p-6 rounded-2xl border border-[#1F2A4A] bg-[#111830] text-center text-xs text-[#7C88AB]">
              No submissions match your search or filter.
            </div>
          )}

          {filteredDrafts.map(d => {
            const isSelected = selectedDraftId === d.id;
            const isPending = d.status === 'Pending Approval';

            return (
              <div
                key={d.id}
                onClick={() => setSelectedDraftId(d.id)}
                className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                  isSelected
                    ? 'bg-[#172040] border-[#4F6BED]/60 shadow-md shadow-[#4F6BED]/10 ring-1 ring-[#4F6BED]/30'
                    : 'bg-[#111830] border-[#1F2A4A] hover:border-[#2D3A63] hover:bg-[#141C33]'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center space-x-2 min-w-0">
                    <FileText className="w-4 h-4 text-[#4F6BED] shrink-0" />
                    <h4 className="text-xs font-semibold text-[#E8ECF8] truncate">{d.title}</h4>
                  </div>
                  <span className={`text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full border shrink-0 ${
                    statusStyles[d.status] || 'bg-[#7C88AB]/15 text-[#AAB4D0] border-[#7C88AB]/30'
                  } ${isPending ? 'animate-pulse' : ''}`}>
                    {d.status}
                  </span>
                </div>
                <div className="mt-2.5 flex items-center justify-between text-[11px] text-[#7C88AB]">
                  <span>Author: <span className="text-[#AAB4D0] font-medium">{d.author_name || 'Creator'}</span></span>
                  <span className="font-mono text-[10px]">v{d.current_version}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Right: Pre-Audited Draft Review & Decision Panel */}
      <div className="lg:col-span-8 space-y-4">
        {currentDraft && selectedDraftIsVisible ? (
          <div className="bg-[#111830] border border-[#1F2A4A] rounded-2xl p-5 sm:p-6 space-y-5 shadow-xl">
            {/* Header & Meta Actions */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1F2A4A] pb-4">
              <div>
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-mono bg-[#4F6BED]/10 text-[#60A5FA] border border-[#4F6BED]/20 px-2 py-0.5 rounded-lg">
                    Guideline {activeGuidelineVersion || 'version unavailable'}
                  </span>
                  <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold border ${
                    statusStyles[currentDraft.status] || 'bg-[#7C88AB]/15 text-[#AAB4D0] border-[#7C88AB]/30'
                  }`}>
                    {currentDraft.status}
                  </span>
                  <span className="text-xs font-mono text-[#2DD4BF] bg-[#2DD4BF]/10 px-2 py-0.5 rounded-lg border border-[#2DD4BF]/20">
                    {currentDraft.latest_revision
                      ? `${currentDraft.latest_revision.compliance_score}% alignment`
                      : 'Not scanned'}
                  </span>
                </div>
                <h2 className="text-base sm:text-lg font-bold text-[#E8ECF8] mt-2">
                  {currentDraft.title}
                </h2>
                <p className="text-xs text-[#7C88AB] mt-0.5">
                  Author: <span className="text-[#AAB4D0] font-medium">{currentDraft.author_name || 'Creator'}</span> • Version: <span className="font-mono text-[#AAB4D0]">v{currentDraft.current_version}</span> • Content Type: <span className="capitalize text-[#AAB4D0] font-medium">{currentDraft.content_type}</span>
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => setShowCertModal(true)}
                  className="flex items-center space-x-1.5 bg-[#0E1428] hover:bg-[#172040] text-[#AAB4D0] hover:text-[#E8ECF8] px-3 py-1.5 rounded-lg text-xs font-medium border border-[#1F2A4A] transition-colors shadow-sm"
                  title="View and download verifiable compliance certificate"
                >
                  <FileCheck className="w-3.5 h-3.5 text-[#4F6BED]" />
                  <span>Audit Certificate</span>
                </button>

                {currentDraft.status === 'Pending Approval' && (
                  <>
                    <button
                      type="button"
                      onClick={() => setDecisionModal('Changes Requested')}
                      className="flex items-center space-x-1.5 bg-[#F87171]/15 hover:bg-[#F87171]/25 text-[#F87171] border border-[#F87171]/30 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors shadow-sm"
                    >
                      <AlertOctagon className="w-3.5 h-3.5" />
                      <span>Request Changes</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setDecisionModal('Approved')}
                      className="flex items-center space-x-1.5 bg-[#34D399] hover:bg-[#10B981] text-[#0A0F1E] px-3.5 py-1.5 rounded-lg text-xs font-bold shadow-md shadow-[#34D399]/20 transition-all"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Approve & Sign-Off</span>
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Decision Confirmation Form (when decision triggered) */}
            {decisionModal && (
              <div className="bg-[#0E1428] border border-[#4F6BED]/50 rounded-xl p-4 space-y-3 motion-safe:animate-fade-in shadow-lg">
                <h4 className="text-xs font-bold text-[#E8ECF8] uppercase flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-[#4F6BED]" />
                  Confirm Managerial Action: <span className={decisionModal === 'Approved' ? 'text-[#34D399]' : 'text-[#F87171]'}>{decisionModal}</span>
                </h4>
                <p className="text-xs text-[#AAB4D0]">
                  Provide mandatory sign-off directives or feedback for the creator:
                </p>
                <textarea
                  value={decisionComment}
                  onChange={e => setDecisionComment(e.target.value)}
                  placeholder={decisionModal === 'Changes Requested'
                    ? 'List the specific edits needed, ideally referencing the text, frame, or timestamp.'
                    : 'Optional sign-off note, e.g. verified against Fact Sheet v3.'}
                  rows={2}
                  autoFocus
                  className="w-full bg-[#111830] border border-[#1F2A4A] rounded-lg p-2.5 text-xs text-[#E8ECF8] placeholder-[#7C88AB] focus:outline-none focus:border-[#4F6BED] focus:ring-1 focus:ring-[#4F6BED]"
                />
                {decisionModal === 'Changes Requested' && (
                  <p className="text-[11px] text-[#FBBF24]">
                    Specific reviewer feedback is required so the creator knows what to change.
                  </p>
                )}
                <div className="flex justify-end space-x-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setDecisionModal(null);
                      setDecisionComment('');
                    }}
                    className="px-3 py-1 text-xs text-[#7C88AB] hover:text-[#E8ECF8] rounded-lg hover:bg-[#111830] transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDecision(decisionModal)}
                    disabled={decisionModal === 'Changes Requested' && !decisionComment.trim()}
                    className={`px-4 py-1.5 rounded-lg text-xs font-bold text-white shadow-sm transition-all ${
                      decisionModal === 'Approved'
                        ? 'bg-[#34D399] hover:bg-[#10B981] text-[#0A0F1E]'
                        : 'bg-[#F87171] hover:bg-[#EF4444]'
                    } disabled:cursor-not-allowed disabled:opacity-50`}
                  >
                    Confirm {decisionModal}
                  </button>
                </div>
              </div>
            )}

            {/* Pre-Audited Content Snapshot */}
            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-text-muted">
                Pre-Audited Content Snapshot (v{currentDraft.current_version})
              </h3>
              <div className="bg-surface-subtle border border-border rounded-xl p-4 text-text-primary max-h-[34rem] overflow-y-auto">
                {currentDraft.content_type === 'text' ? (
                  reviewText ? (
                    <div className="space-y-3">
                      {!latestRev && (
                        <div className="rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-[11px] text-warning">
                          This draft has not completed a scan yet. Review the submitted text below before deciding.
                        </div>
                      )}
                      <div className="rounded-lg border border-border/70 bg-canvas/40 p-4">
                        <div className="mb-2 flex items-center justify-between gap-2 text-[10px] font-semibold uppercase tracking-wide text-text-muted">
                          <span>Submitted text</span>
                          <span>Version {currentDraft.current_version}</span>
                        </div>
                        <p className="whitespace-pre-wrap break-words font-sans text-sm leading-7 text-text-primary">
                          {reviewText}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-lg border border-warning/30 bg-warning/10 p-4 text-sm text-warning">
                      No text snapshot is available for this draft. Ask the creator to resubmit the content before approval.
                    </div>
                  )
                ) : currentDraft.content_type === 'image' ? (
                  (() => {
                    const isSampleAsset = Boolean(
                      !currentDraft?.content_ref ||
                      currentDraft.content_ref.includes('sample_banner') ||
                      currentDraft.content_ref.includes('placeholder') ||
                      currentDraft.id === 'draft_banner_creative'
                    );
                    return (
                      <div className="font-sans space-y-3">
                        {mediaLoadError ? (
                          <div className="flex flex-col items-center justify-center py-6 px-4 text-center space-y-2">
                            <ImageOff className="w-8 h-8 text-text-muted" />
                            <div className="text-xs font-semibold text-text-primary">Visual Asset Preview Unavailable</div>
                            <p className="text-[11px] text-text-secondary max-w-xs">
                              The server no longer has this uploaded file. Ask the creator to replace it from Draft Studio; this preview cannot restore the original.
                            </p>
                          </div>
                        ) : (
                          <div className="w-full flex flex-col items-center">
                            {/* Asset Status Badge & Meta Header */}
                            <div className="w-full flex items-center justify-between mb-2">
                              {isSampleAsset ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-400">
                                  <TestTube2 className="w-3 h-3" />
                                  Automated Evaluation Benchmark Sample
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-primary/15 border border-primary/30 text-primary">
                                  <ImageIcon className="w-3 h-3" />
                                  Production Creative Asset
                                </span>
                              )}
                              <span className="text-[10px] font-mono text-text-muted">
                                {isSampleAsset ? 'Synthetic Test Canvas' : 'Original Ratio (object-contain)'}
                              </span>
                            </div>

                            {/* Asset Preview Container */}
                            <div className="w-full min-h-56 flex items-center justify-center bg-canvas/40 rounded-lg p-3 border border-border/40">
                              <img
                                src={mediaUrl(currentDraft.content_ref || '/static/uploads/sample_banner.png')}
                                alt={currentDraft.title || 'Draft Banner'}
                                onError={() => setFailedMediaDraftId(currentDraft.id)}
                                className="max-h-[32rem] max-w-full w-auto object-contain rounded-md shadow-sm"
                              />
                            </div>

                            {/* Explanatory Caption for Synthetic Evaluation Sample */}
                            {isSampleAsset ? (
                              <div className="w-full mt-2.5 p-2.5 rounded-lg bg-surface border border-border/80 text-[11px] text-text-secondary leading-relaxed">
                                <span className="font-semibold text-text-primary">Evaluation Sample Note: </span>
                                This synthetic test canvas was generated for automated brand governance testing (bounding-box layout boundary, WCAG contrast verification, and an intentional <code className="font-mono text-[10px] text-error font-semibold bg-error/10 px-1 py-0.5 rounded">#FF0055</code> accent color violation). It is an automated test fixture, not finished brand creative.
                              </div>
                            ) : (
                              <div className="w-full mt-2 text-[11px] text-text-muted flex items-center justify-between">
                                <span>Asset reference: <code className="font-mono text-[10px] text-text-secondary">{currentDraft.content_ref?.split('/').pop()}</code></span>
                                <span>Multimodal review asset</span>
                              </div>
                            )}
                          </div>
                        )}
                        {currentDraft.media_metadata && (
                          <ReviewMediaMetadata metadata={currentDraft.media_metadata} />
                        )}
                        {mediaAnalysis.ocr_text && (
                          <div className="rounded-lg border border-border bg-canvas/40 p-3">
                            <div className="mb-1 text-[11px] font-semibold text-text-primary">Text detected in image (OCR)</div>
                            <p className="whitespace-pre-wrap break-words text-xs leading-relaxed text-text-secondary">
                              {mediaAnalysis.ocr_text}
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })()
                ) : (
                  <div className="space-y-3 p-1 font-sans">
                    {mediaLoadError ? (
                      <div className="flex flex-col items-center justify-center py-6 px-4 text-center space-y-2">
                        <ImageOff className="w-8 h-8 text-text-muted" />
                        <div className="text-xs font-semibold text-text-primary">Uploaded asset is unavailable</div>
                        <p className="text-[11px] text-text-secondary max-w-xs">
                          Ask the creator to upload a replacement from Draft Studio. The original file is not available on the server.
                        </p>
                      </div>
                    ) : currentDraft.content_type === 'audio' ? (
                      <audio
                        ref={mediaElementRef}
                        controls
                        src={mediaUrl(currentDraft.content_ref)}
                        onError={() => setFailedMediaDraftId(currentDraft.id)}
                        className="w-full"
                      />
                    ) : (
                      <video
                        ref={mediaElementRef}
                        controls
                        src={mediaUrl(currentDraft.content_ref)}
                        onError={() => setFailedMediaDraftId(currentDraft.id)}
                        className="max-h-60 w-full rounded-lg"
                      />
                    )}
                    {currentDraft.media_metadata && (
                      <ReviewMediaMetadata metadata={currentDraft.media_metadata} />
                    )}
                    <ReviewMediaAnalysis
                      analysis={mediaAnalysis}
                      flags={flags}
                      onSeek={time => {
                        if (!mediaElementRef.current || !Number.isFinite(time)) return;
                        mediaElementRef.current.currentTime = time;
                        mediaElementRef.current.play().catch(() => {});
                      }}
                    />
                  </div>
                )}
              </div>
            </div>

            <section className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-text-muted">
                  Scan findings for reviewer
                </h3>
                <span className="text-[10px] font-mono text-text-muted">{flags.length} finding(s)</span>
              </div>
              {!latestRev ? (
                <p className="rounded-xl border border-warning/30 bg-warning/10 p-3 text-xs text-warning">
                  No scan findings are available yet. Review the submitted asset manually; do not treat the absence of findings as proof of compliance.
                </p>
              ) : flags.length === 0 ? (
                <p className="rounded-xl border border-border bg-surface-subtle p-3 text-xs text-text-secondary">
                  No automated findings were recorded for this revision. Please complete the human review before sign-off.
                </p>
              ) : (
                <div className="space-y-2">
                  {flags.map(flag => (
                    <article key={flag.id} className="rounded-xl border border-border bg-surface-subtle p-3 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded bg-primary/10 px-2 py-0.5 font-mono text-[10px] font-bold text-primary">
                          {flag.rule_id}
                        </span>
                        <span className="text-[10px] uppercase text-text-muted">{flag.category}</span>
                        <span className="ml-auto text-[10px] capitalize text-text-muted">{flag.resolution}</span>
                      </div>
                      {flag.span && (
                        <p className="break-words rounded bg-canvas/50 px-2 py-1 font-mono text-xs text-text-primary">
                          {flag.span}
                        </p>
                      )}
                      <p className="text-xs leading-relaxed text-text-secondary">{flag.explanation}</p>
                      {flag.fix && (
                        <p className="text-xs text-text-secondary">
                          Suggested change: <span className="font-medium text-text-primary">{flag.fix}</span>
                        </p>
                      )}
                      {(Number.isFinite(flag.start_time) || Number.isInteger(flag.frame_number)) && (
                        <p className="text-[10px] text-primary">
                          {Number.isInteger(flag.frame_number) ? `Frame ${flag.frame_number}` : ''}
                          {Number.isInteger(flag.frame_number) && Number.isFinite(flag.start_time) ? ' · ' : ''}
                          {Number.isFinite(flag.start_time) ? `${flag.start_time.toFixed(2)}s` : ''}
                        </p>
                      )}
                    </article>
                  ))}
                </div>
              )}
            </section>

            {/* AI Audit Trail (Flags accepted, edited, dismissed) */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#7C88AB] flex items-center justify-between">
                <span>AI Findings & Creator Resolution Audit Trail</span>
                <span className="text-[11px] font-mono text-[#AAB4D0]">
                  {acceptedFlags.length} Accepted • {dismissedFlags.length} Creator Overrides
                </span>
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Accepted Fixes */}
                <div className="bg-[#0E1428] border border-[#34D399]/20 rounded-xl p-3.5 space-y-2.5">
                  <span className="text-xs font-semibold text-[#34D399] flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Accepted Brand Corrections ({acceptedFlags.length})
                  </span>
                  {acceptedFlags.length === 0 ? (
                    <p className="text-[11px] text-[#7C88AB] italic">No automated corrections applied.</p>
                  ) : (
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                      {acceptedFlags.map(af => (
                        <div key={af.id} className="text-xs border-b border-[#1F2A4A]/60 pb-2 last:border-0 space-y-0.5">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="font-mono text-[#60A5FA] font-bold">{af.rule_id}</span>
                            <span className="text-[#7C88AB] uppercase text-[10px]">{af.category}</span>
                          </div>
                          <p className="text-[#AAB4D0] text-[11px] leading-snug">
                            Replaced <span className="text-[#F87171] line-through">"{af.span}"</span> with{' '}
                            <span className="text-[#34D399] font-semibold">"{af.fix}"</span>
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Dismissed / Creator Overrides */}
                <div className="bg-[#0E1428] border border-[#FBBF24]/20 rounded-xl p-3.5 space-y-2.5">
                  <span className="text-xs font-semibold text-[#FBBF24] flex items-center gap-1.5">
                    <History className="w-3.5 h-3.5" />
                    Creator Overrides / Dismissals ({dismissedFlags.length})
                  </span>
                  {dismissedFlags.length === 0 ? (
                    <p className="text-[11px] text-[#7C88AB] italic">No flags dismissed by creator.</p>
                  ) : (
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                      {dismissedFlags.map(df => (
                        <div key={df.id} className="text-xs border-b border-[#1F2A4A]/60 pb-2 last:border-0 space-y-0.5">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="font-mono text-[#FBBF24] font-bold">{df.rule_id}</span>
                            <span className="text-[#7C88AB] text-[10px] truncate max-w-[120px]">"{df.span}"</span>
                          </div>
                          <p className="text-[#E8ECF8] text-[11px] italic bg-[#111830] p-1.5 rounded-lg border border-[#1F2A4A]">
                            Reason: "{df.resolution_comment || 'Artistic discretion'}"
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Collaborative Decision & Audit Thread */}
            <div className="space-y-3 pt-3 border-t border-[#1F2A4A]">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#7C88AB] flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-[#4F6BED]" />
                Collaborative Decision & Audit Thread ({comments.length})
              </h3>

              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {comments.length === 0 ? (
                  <p className="text-xs text-[#7C88AB] italic bg-[#0E1428] p-3 rounded-xl border border-[#1F2A4A] text-center">
                    No comments in this thread yet. Post guidance below.
                  </p>
                ) : (
                  comments.map(c => (
                    <div key={c.id} className="bg-[#0A0F1E] rounded-xl p-3 text-xs border border-[#1F2A4A] flex items-start space-x-2.5">
                      <img
                        src={c.user_avatar || 'https://api.dicebear.com/7.x/avataaars/svg?seed=user'}
                        alt=""
                        className="w-5 h-5 rounded-full ring-1 ring-[#4F6BED]/30 mt-0.5 shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-[#E8ECF8]">
                            {c.user_name}{' '}
                            <span className="text-[10px] text-[#7C88AB] font-normal uppercase">
                              ({c.user_role})
                            </span>
                          </span>
                          <span className="text-[10px] font-mono text-[#7C88AB]">
                            {new Date(c.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p className="text-[#AAB4D0] mt-1 break-words">{c.text}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <form onSubmit={handleAddComment} className="flex space-x-2">
                <input
                  type="text"
                  placeholder="Leave comment or guidance for author..."
                  value={newComment}
                  onChange={e => setNewComment(e.target.value)}
                  className="flex-1 bg-[#0E1428] border border-[#1F2A4A] rounded-xl px-3.5 py-2 text-xs text-[#E8ECF8] placeholder-[#7C88AB] focus:outline-none focus:border-[#4F6BED] focus:ring-1 focus:ring-[#4F6BED] transition-colors"
                />
                <button
                  type="submit"
                  className="bg-[#4F6BED] hover:bg-[#6479F2] text-white px-4 py-2 rounded-xl text-xs font-semibold shadow-md shadow-[#4F6BED]/20 transition-all flex items-center gap-1.5 shrink-0"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Post</span>
                </button>
              </form>
            </div>
          </div>
        ) : (
          <div className="bg-[#111830] border border-[#1F2A4A] rounded-2xl p-8 text-center text-xs text-[#7C88AB]">
            Select a draft from the queue to review pre-audited materials.
          </div>
        )}
      </div>

      {/* Verifiable Compliance Certificate Preview Modal */}
      {showCertModal && currentDraft && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 bg-[#0A0F1E]/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 motion-safe:animate-fade-in"
        >
          <div className="bg-[#111830] border border-[#4F6BED]/50 rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl shadow-black/80 relative">
            {/* Certificate Header */}
            <div className="flex items-start justify-between border-b border-[#1F2A4A] pb-3.5">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-[#4F6BED]/20 border border-[#4F6BED]/40 flex items-center justify-center text-[#4F6BED] shrink-0 shadow-md shadow-[#4F6BED]/20">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#E8ECF8] uppercase tracking-wide">
                    Brand Governance Certificate
                  </h3>
                  <p className="text-[11px] text-[#2DD4BF] font-mono">
                    Inkloom AI Intelligent Governance Platform
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCertModal(false)}
                className="text-[#7C88AB] hover:text-[#E8ECF8] hover:bg-[#172040] p-1.5 rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Official Certificate Sheet Preview */}
            <div className="bg-[#0E1428] border border-[#1F2A4A] rounded-xl p-4 space-y-3.5 font-sans text-xs">
              <div className="flex items-center justify-between border-b border-[#1F2A4A]/60 pb-2">
                <span className="text-[11px] text-[#7C88AB] font-mono">
                  Verification ID: <span className="text-[#60A5FA] font-bold">CERT-{currentDraft.id.slice(0, 8).toUpperCase()}</span>
                </span>
                <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border ${
                  statusStyles[currentDraft.status] || 'bg-[#7C88AB]/15 text-[#AAB4D0] border-[#7C88AB]/30'
                }`}>
                  {currentDraft.status}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-[#7C88AB] block text-[10px] uppercase font-semibold">Draft Title</span>
                  <span className="text-[#E8ECF8] font-medium truncate block">{currentDraft.title}</span>
                </div>
                <div>
                  <span className="text-[#7C88AB] block text-[10px] uppercase font-semibold">Author</span>
                  <span className="text-[#E8ECF8] font-medium">{currentDraft.author_name || 'Creator'}</span>
                </div>
                <div>
                  <span className="text-[#7C88AB] block text-[10px] uppercase font-semibold">Compliance Alignment</span>
                  <span className="text-[#34D399] font-bold font-mono">
                    {currentDraft.latest_revision
                      ? `${currentDraft.latest_revision.compliance_score}% Alignment`
                      : 'Not scanned'}
                  </span>
                </div>
                <div>
                  <span className="text-[#7C88AB] block text-[10px] uppercase font-semibold">
                    {signOffRecord ? 'Signed-Off By' : 'Sign-Off Status'}
                  </span>
                  {signOffRecord ? (
                    <span className="text-[#E8ECF8] font-medium">
                      {signOffRecord.user_name}{' '}
                      <span className="text-[10px] text-[#7C88AB]">({signOffRecord.user_role})</span>
                    </span>
                  ) : currentDraft.status === 'In Revision' ? (
                    <span className="text-[#FBBF24] font-medium flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#FBBF24]"></span>
                      Unsigned — In Revision
                    </span>
                  ) : currentDraft.status === 'Pending Approval' ? (
                    <span className="text-[#A78BFA] font-medium flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#A78BFA] animate-pulse"></span>
                      Pending Approval (Unsigned)
                    </span>
                  ) : currentDraft.status === 'Changes Requested' ? (
                    <span className="text-[#F87171] font-medium flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#F87171]"></span>
                      Changes Requested (Unsigned)
                    </span>
                  ) : (
                    <span className="text-[#7C88AB] font-medium flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#7C88AB]"></span>
                      Unsigned ({currentDraft.status})
                    </span>
                  )}
                </div>
                <div className="col-span-2">
                  <span className="text-[#7C88AB] block text-[10px] uppercase font-semibold">Active Guideline Version</span>
                  <span className="text-[#AAB4D0] font-mono text-[11px]">
                    {activeGuidelineVersion
                      ? `Inkloom Master Guidelines ${activeGuidelineVersion} (Active)`
                      : 'Active guideline version unavailable'}
                  </span>
                </div>
                <div className="col-span-2 flex items-center justify-between text-[11px] text-[#7C88AB] pt-1 border-t border-[#1F2A4A]/60 font-mono">
                  <span>Audited Issues: {issueCount}</span>
                  <span>{signOffRecord ? 'Issued' : 'Updated'}: {certTimestamp ? new Date(certTimestamp).toLocaleDateString() : 'Pending'}</span>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end space-x-2 pt-1 border-t border-[#1F2A4A]">
              <button
                type="button"
                onClick={() => setShowCertModal(false)}
                className="px-3.5 py-2 text-xs font-medium text-[#7C88AB] hover:text-[#E8ECF8] rounded-xl hover:bg-[#172040] transition-colors"
              >
                Close Preview
              </button>
              <button
                type="button"
                onClick={exportCertificate}
                className="flex items-center space-x-1.5 bg-[#4F6BED] hover:bg-[#6479F2] text-white px-4 py-2 rounded-xl text-xs font-semibold shadow-md shadow-[#4F6BED]/20 transition-all"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download JSON Certificate</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
  }

  function ReviewMediaMetadata({ metadata }) {
    const entries = Object.entries(metadata).filter(([, value]) => value !== null && value !== undefined);
    if (!entries.length) return null;

    return (
      <div className="rounded-lg border border-border bg-canvas/40 p-3">
        <h4 className="mb-2 text-[11px] font-semibold text-text-primary">Asset details</h4>
        <dl className="grid grid-cols-1 gap-x-4 gap-y-1.5 sm:grid-cols-2">
          {entries.map(([key, value]) => (
            <div key={key} className="min-w-0 text-[11px]">
              <dt className="inline capitalize text-text-muted">{key.replaceAll('_', ' ')}: </dt>
              <dd className="inline break-words font-mono text-text-secondary">
                {typeof value === 'object' ? JSON.stringify(value) : String(value)}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    );
  }

  function ReviewMediaAnalysis({ analysis, flags, onSeek }) {
    const missing = analysis.missing_capabilities || [];
    const transcript = analysis.transcript || '';
    const ocrText = analysis.ocr_text || '';
    const frames = analysis.findings || [];
    const timedFlags = flags.filter(flag => Number.isFinite(flag.start_time));

    if (!analysis.extraction_status && !transcript && !ocrText && !frames.length) {
      return (
        <p className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-xs text-warning">
          No transcript or extraction report is available. Review the full media manually and add any required changes in your decision comment.
        </p>
      );
    }

    return (
      <div className="space-y-3 rounded-lg border border-border bg-canvas/40 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-[11px] font-semibold text-text-primary">Transcript and extraction evidence</h4>
          <span className={`text-[10px] font-semibold ${missing.length ? 'text-warning' : 'text-success'}`}>
            {analysis.extraction_status || 'status unavailable'}
            {missing.length ? ` · Missing: ${missing.join(', ')}` : ''}
          </span>
        </div>
        {transcript ? (
          <div>
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-text-muted">
              {analysis.transcript_segments?.length ? 'Transcript / captions' : 'Transcript'}
            </div>
            <p className="max-h-48 overflow-y-auto whitespace-pre-wrap break-words rounded-lg border border-border/70 bg-surface-subtle p-3 text-xs leading-relaxed text-text-primary">
              {transcript}
            </p>
          </div>
        ) : (
          <p className="text-xs text-text-secondary">No transcript or captions were extracted.</p>
        )}
        {ocrText && (
          <div>
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-text-muted">
              Text detected in video frames
            </div>
            <p className="max-h-32 overflow-y-auto whitespace-pre-wrap break-words rounded-lg border border-border/70 bg-surface-subtle p-3 text-xs leading-relaxed text-text-primary">
              {ocrText}
            </p>
          </div>
        )}
        {frames.length > 0 && (
          <div className="space-y-1">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">
              Sampled video frames ({frames.length})
            </div>
            {frames.map((frame, index) => (
              <button
                key={`${frame.frame_number ?? index}-${frame.timestamp_seconds ?? index}`}
                type="button"
                onClick={() => Number.isFinite(frame.timestamp_seconds) && onSeek(frame.timestamp_seconds)}
                disabled={!Number.isFinite(frame.timestamp_seconds)}
                className="block w-full rounded-lg border border-border/70 bg-surface-subtle px-2.5 py-2 text-left text-[11px] enabled:hover:border-primary disabled:cursor-default"
                title={Number.isFinite(frame.timestamp_seconds) ? 'Seek video to this frame' : undefined}
              >
                <span className="font-semibold text-text-primary">Frame {frame.frame_number ?? index + 1}</span>
                {Number.isFinite(frame.timestamp_seconds) && (
                  <span className="ml-2 font-mono text-primary">{frame.timestamp_seconds.toFixed(2)}s</span>
                )}
                {frame.text && (
                  <p className="mt-1 whitespace-pre-wrap break-words text-text-secondary">{frame.text}</p>
                )}
              </button>
            ))}
          </div>
        )}
        {timedFlags.length > 0 && (
          <div className="space-y-1">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">Jump to flagged moments</div>
            {timedFlags.map(flag => (
              <button
                key={flag.id}
                type="button"
                onClick={() => onSeek(flag.start_time)}
                className="flex w-full items-center justify-between gap-2 rounded-lg border border-border bg-surface-subtle px-2.5 py-2 text-left text-xs hover:border-primary"
                title="Seek the media player to this point"
              >
                <span className="min-w-0 truncate text-text-secondary">
                  {flag.rule_id}: {flag.span || flag.explanation}
                </span>
                <span className="shrink-0 font-mono text-primary">{flag.start_time.toFixed(2)}s</span>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }
