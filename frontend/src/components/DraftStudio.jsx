import React, { useState, useEffect, useRef } from 'react';
import { api, mediaUrl } from '../api';
import {
  Sparkles, Check, X, Edit3, Send, RefreshCw, AlertTriangle,
  CheckCircle2, FileText, Image as ImageIcon, History,
  TestTube2, ImageOff
} from 'lucide-react';

export default function DraftStudio({ currentUser, onDraftUpdated, showToast }) {
  const [drafts, setDrafts] = useState([]);
  const [selectedDraftId, setSelectedDraftId] = useState(null);
  const [currentDraft, setCurrentDraft] = useState(null);
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [submittingForApproval, setSubmittingForApproval] = useState(false);
  const [activeDismissModal, setActiveDismissModal] = useState(null);
  const [dismissReason, setDismissReason] = useState('');
  const [editingFlagId, setEditingFlagId] = useState(null);
  const [customFixText, setCustomFixText] = useState('');
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newType, setNewType] = useState('text');
  const [selectedFile, setSelectedFile] = useState(null);
  const [selectedFilePreviewUrl, setSelectedFilePreviewUrl] = useState(null);
  const selectedFilePreviewUrlRef = useRef(null);
  const [creatingDraft, setCreatingDraft] = useState(false);
  const [createDraftError, setCreateDraftError] = useState('');
  const [mediaTranscript, setMediaTranscript] = useState('');
  const [isEditingDraft, setIsEditingDraft] = useState(false);
  const [editDraftText, setEditDraftText] = useState('');
  const [activeFlagId, setActiveFlagId] = useState(null);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [failedImageDraftId, setFailedImageDraftId] = useState(null);
  const mediaElementRef = useRef(null);

  const imageLoadError = failedImageDraftId === (currentDraft?.id || 'default');

  useEffect(() => {
    loadDrafts();
  }, []);

  useEffect(() => {
    if (selectedDraftId) {
      loadDraftDetails(selectedDraftId);
    }
  }, [selectedDraftId]);

  useEffect(() => () => {
    if (selectedFilePreviewUrlRef.current) {
      URL.revokeObjectURL(selectedFilePreviewUrlRef.current);
    }
  }, []);

  function setSelectedFileWithPreview(file) {
    if (selectedFilePreviewUrlRef.current) {
      URL.revokeObjectURL(selectedFilePreviewUrlRef.current);
    }
    const previewUrl = file ? URL.createObjectURL(file) : null;
    selectedFilePreviewUrlRef.current = previewUrl;
    setSelectedFile(file);
    setSelectedFilePreviewUrl(previewUrl);
  }

  async function loadDrafts() {
    setLoading(true);
    try {
      const data = await api.getDrafts();
      setDrafts(data);
      if (data.length > 0 && !selectedDraftId) {
        setSelectedDraftId(data[0].id);
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
      if (data.latest_revision?.content_text) {
        setEditDraftText(data.latest_revision.content_text);
      }
    } catch (e) {
      console.error(e);
    }
  }

  async function handleScan() {
    if (!currentDraft) return;
    setScanning(true);
    try {
      await api.scanDraft(currentDraft.id, currentUser.id);
      await loadDraftDetails(currentDraft.id);
      if (onDraftUpdated) onDraftUpdated();
      if (showToast) showToast("Draft re-scanned successfully!", "info");
    } catch (e) {
      console.error(e);
      if (showToast) showToast(`Scan failed: ${e.message}`, "error");
    } finally {
      setScanning(false);
    }
  }

  async function handleSaveDraftText() {
    if (!currentDraft) return;
    setScanning(true);
    try {
      await api.updateDraft(currentDraft.id, { content_text: editDraftText }, currentUser.id);
      setIsEditingDraft(false);
      await loadDraftDetails(currentDraft.id);
      await loadDrafts();
      if (onDraftUpdated) onDraftUpdated();
      if (showToast) showToast("New revision saved and re-scanned!", "success");
    } catch (e) {
      console.error(e);
      if (showToast) showToast("Failed to save draft revision", "error");
    } finally {
      setScanning(false);
    }
  }

  async function handleResolve(flagId, resolution, editedFix = null, comment = null) {
    try {
      // Optimistic update of compliance score for instant feedback
      const remainingFlags = (currentDraft.latest_revision?.flags || []).filter(
        f => f.id !== flagId && f.resolution === 'pending'
      );
      const optimisticScore = Math.max(20.0, Math.round(100.0 - (remainingFlags.length * 14.0)));
      setCurrentDraft(prev => prev ? {
        ...prev,
        latest_revision: {
          ...prev.latest_revision,
          compliance_score: optimisticScore
        }
      } : prev);

      const res = await api.resolveFlag(flagId, resolution, editedFix, comment, currentUser.id);
      if (res && res.updated_text) {
        setEditDraftText(res.updated_text);
      }
      await loadDraftDetails(currentDraft.id);
      setActiveDismissModal(null);
      setEditingFlagId(null);
      setDismissReason('');
      setCustomFixText('');
      if (onDraftUpdated) onDraftUpdated();
      if (showToast) showToast(`Brand issue ${resolution}`, "info");
    } catch (e) {
      console.error(e);
      if (showToast) showToast("Could not resolve flag", "error");
    }
  }

  async function handleSubmitForApproval() {
    if (!currentDraft) return;
    setSubmittingForApproval(true);
    try {
      await api.submitForApproval(currentDraft.id, currentUser.id);
      await loadDraftDetails(currentDraft.id);
      await loadDrafts();
      if (onDraftUpdated) onDraftUpdated();
      if (showToast) showToast("Draft submitted for managerial approval!", "success");
    } catch (e) {
      console.error(e);
      if (showToast) showToast(`Failed to submit draft: ${e.message}`, "error");
    } finally {
      setSubmittingForApproval(false);
    }
  }

  async function handleCreateDraft(e) {
    e.preventDefault();
    setCreatingDraft(true);
    setCreateDraftError('');
    try {
      if (newType === 'text') {
        const created = await api.createDraft({
          title: newTitle || 'Untitled Draft',
          content_type: 'text',
          content_text: newContent
        }, currentUser.id);
        setIsCreatingNew(false);
        setNewTitle('');
        setNewContent('');
        await loadDrafts();
        setSelectedDraftId(created.id);
      } else if (newType === 'image') {
        if (!selectedFile) return;
        const formData = new FormData();
        formData.append('title', newTitle || 'Untitled Banner');
        formData.append('file', selectedFile);
        const created = await api.uploadImageDraft(formData, currentUser.id);
        setIsCreatingNew(false);
        setNewTitle('');
        setSelectedFileWithPreview(null);
        await loadDrafts();
        setSelectedDraftId(created.id);
      } else {
        if (!selectedFile) return;
        const formData = new FormData();
        formData.append('title', newTitle || `Untitled ${newType}`);
        formData.append('media_type', newType);
        formData.append('transcript', mediaTranscript);
        formData.append('file', selectedFile);
        const created = await api.uploadMediaDraft(formData);
        setIsCreatingNew(false);
        setNewTitle('');
        setMediaTranscript('');
        setSelectedFileWithPreview(null);
        await loadDrafts();
        setSelectedDraftId(created.id);
      }
      if (onDraftUpdated) onDraftUpdated();
    } catch (e) {
      console.error(e);
      const message = `Could not create and scan draft: ${e.message}`;
      setCreateDraftError(message);
      if (showToast) showToast(message, "error");
    } finally {
      setCreatingDraft(false);
    }
  }

  const latestRev = currentDraft?.latest_revision;
  const flags = latestRev?.flags || [];
  const pendingFlags = flags.filter(f => f.resolution === 'pending');
  const resolvedFlags = flags.filter(f => f.resolution !== 'pending');
  const complianceScore = latestRev?.compliance_score ?? 100;
  const needsPolicyReview = latestRev?.policy_coverage_status === 'needs_review';

  // Categories present in pending flags for dynamic filter pills
  const existingCategories = Array.from(new Set(pendingFlags.map(f => f.category).filter(Boolean)));
  const displayedPendingFlags = categoryFilter === 'all'
    ? pendingFlags
    : pendingFlags.filter(f => f.category === categoryFilter);

  const categoryBadgeColors = {
    tone: 'bg-[#6366F1]/15 text-[#818CF8] border-[#6366F1]/30',
    terminology: 'bg-[#FBBF24]/15 text-[#FBBF24] border-[#FBBF24]/30',
    facts: 'bg-[#F87171]/15 text-[#F87171] border-[#F87171]/30',
    claims: 'bg-[#A855F7]/15 text-[#C084FC] border-[#A855F7]/30',
    color: 'bg-[#3B82F6]/15 text-[#60A5FA] border-[#3B82F6]/30',
    accessibility: 'bg-[#2DD4BF]/15 text-[#2DD4BF] border-[#2DD4BF]/30'
  };

  const categoryBorderAccents = {
    tone: 'border-l-4 border-l-[#818CF8]',
    terminology: 'border-l-4 border-l-[#FBBF24]',
    facts: 'border-l-4 border-l-[#F87171]',
    claims: 'border-l-4 border-l-[#C084FC]',
    color: 'border-l-4 border-l-[#60A5FA]',
    accessibility: 'border-l-4 border-l-[#2DD4BF]'
  };

  // Render text with dynamic interactive highlight spans linked to review panel
  const renderHighlightedText = () => {
    if (!latestRev?.content_text) return null;
    const text = latestRev.content_text;

    if (pendingFlags.length === 0) {
      return <p className="whitespace-pre-wrap leading-relaxed text-[#E8ECF8] text-xs sm:text-sm">{text}</p>;
    }

    // Collect all intervals for pending flags
    const intervals = [];
    for (const flag of pendingFlags) {
      if (!flag.span) continue;

      if (
        flag.start_idx >= 0 && 
        flag.end_idx > flag.start_idx && 
        text.substring(flag.start_idx, flag.end_idx).toLowerCase() === flag.span.toLowerCase()
      ) {
        intervals.push({ start: flag.start_idx, end: flag.end_idx, flag });
      } else {
        // Fallback: search for occurrence of flag.span in text
        let searchIdx = 0;
        const target = flag.span.toLowerCase();
        const lowerText = text.toLowerCase();
        while (searchIdx < text.length) {
          const foundIdx = lowerText.indexOf(target, searchIdx);
          if (foundIdx === -1) break;
          intervals.push({ start: foundIdx, end: foundIdx + flag.span.length, flag });
          searchIdx = foundIdx + flag.span.length;
        }
      }
    }

    if (intervals.length === 0) {
      return <p className="whitespace-pre-wrap leading-relaxed text-[#E8ECF8] text-xs sm:text-sm">{text}</p>;
    }

    // Sort intervals by start index, take longest if overlapping
    intervals.sort((a, b) => a.start - b.start || (b.end - b.start) - (a.end - a.start));
    const nonOverlapping = [];
    let lastEnd = 0;
    for (const item of intervals) {
      if (item.start >= lastEnd) {
        nonOverlapping.push(item);
        lastEnd = item.end;
      }
    }

    // Slice text into segments [plain, highlighted, plain, ...]
    const segments = [];
    let cursor = 0;
    for (let i = 0; i < nonOverlapping.length; i++) {
      const { start, end, flag } = nonOverlapping[i];
      if (start > cursor) {
        segments.push({ text: text.substring(cursor, start), flagged: false });
      }
      segments.push({ text: text.substring(start, end), flagged: true, flag });
      cursor = end;
    }
    if (cursor < text.length) {
      segments.push({ text: text.substring(cursor), flagged: false });
    }

    return (
      <div className="whitespace-pre-wrap leading-relaxed text-[#E8ECF8] text-xs sm:text-sm">
        {segments.map((seg, i) => {
          if (seg.flagged) {
            const isHighlighted = activeFlagId === seg.flag.id;
            return (
              <mark
                key={i}
                onMouseEnter={() => setActiveFlagId(seg.flag.id)}
                onMouseLeave={() => setActiveFlagId(null)}
                onClick={() => {
                  setActiveFlagId(seg.flag.id);
                  const el = document.getElementById(`flag-${seg.flag.id}`);
                  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }}
                className={`px-1 py-0.5 rounded cursor-pointer transition-all font-medium border-b-2 ${
                  isHighlighted
                    ? 'bg-[#F87171]/40 border-[#F87171] text-white ring-2 ring-[#F87171]/50 shadow-md'
                    : 'bg-[#F87171]/20 border-[#F87171] text-[#FCA5A5] hover:bg-[#F87171]/35'
                }`}
                title={`Rule ${seg.flag.rule_id} (${seg.flag.category}): ${seg.flag.explanation}`}
              >
                {seg.text}
              </mark>
            );
          }
          return <span key={i}>{seg.text}</span>;
        })}
      </div>
    );
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Left Column: Workspaces & Drafts List */}
      <div className="lg:col-span-3 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#AAB4D0]">
              Workspaces & Drafts
            </h2>
            <span className="text-[10px] font-mono font-semibold px-1.5 py-0.2 rounded-full bg-[#111830] border border-[#1F2A4A] text-[#7C88AB]">
              {drafts.length}
            </span>
          </div>
          <button
            onClick={() => setIsCreatingNew(!isCreatingNew)}
            className="text-xs bg-[#4F6BED] hover:bg-[#6479F2] text-white px-2.5 py-1 rounded-lg font-medium transition-colors shadow-sm shadow-[#4F6BED]/20"
          >
            {isCreatingNew ? 'Cancel' : '+ New Draft'}
          </button>
        </div>

        {/* New Draft Form Modal/Card */}
        {isCreatingNew && (
          <form onSubmit={handleCreateDraft} className="bg-[#111830] border border-[#4F6BED]/50 rounded-2xl p-4 space-y-3.5 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-[#E8ECF8] uppercase flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#4F6BED]" /> Create New Draft
              </h3>
              <span className="text-[10px] text-[#2DD4BF] font-mono">Two-Layer Scanner</span>
            </div>

            {/* 4-way Content Type Segmented Selector */}
            <div className="grid grid-cols-2 gap-1.5 text-xs">
              <button
                type="button"
                onClick={() => {
                  setNewType('text');
                  setSelectedFileWithPreview(null);
                  setCreateDraftError('');
                }}
                className={`py-1.5 px-2 rounded-lg border text-center transition-all flex items-center justify-center gap-1.5 ${
                  newType === 'text'
                    ? 'bg-[#172040] border-[#4F6BED] text-[#E8ECF8] font-semibold shadow-sm'
                    : 'bg-[#0E1428] border-[#1F2A4A] text-[#7C88AB] hover:text-[#E8ECF8]'
                }`}
              >
                <FileText className="w-3.5 h-3.5 text-[#4F6BED]" />
                <span>Text Copy</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setNewType('image');
                  setSelectedFileWithPreview(null);
                  setCreateDraftError('');
                }}
                className={`py-1.5 px-2 rounded-lg border text-center transition-all flex items-center justify-center gap-1.5 ${
                  newType === 'image'
                    ? 'bg-[#172040] border-[#4F6BED] text-[#E8ECF8] font-semibold shadow-sm'
                    : 'bg-[#0E1428] border-[#1F2A4A] text-[#7C88AB] hover:text-[#E8ECF8]'
                }`}
              >
                <ImageIcon className="w-3.5 h-3.5 text-[#A78BFA]" />
                <span>Banner Image</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setNewType('audio');
                  setSelectedFileWithPreview(null);
                  setCreateDraftError('');
                }}
                className={`py-1.5 px-2 rounded-lg border text-center transition-all flex items-center justify-center gap-1.5 ${
                  newType === 'audio'
                    ? 'bg-[#172040] border-[#4F6BED] text-[#E8ECF8] font-semibold shadow-sm'
                    : 'bg-[#0E1428] border-[#1F2A4A] text-[#7C88AB] hover:text-[#E8ECF8]'
                }`}
              >
                <FileText className="w-3.5 h-3.5 text-[#FBBF24]" />
                <span>Audio Track</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setNewType('video');
                  setSelectedFileWithPreview(null);
                  setCreateDraftError('');
                }}
                className={`py-1.5 px-2 rounded-lg border text-center transition-all flex items-center justify-center gap-1.5 ${
                  newType === 'video'
                    ? 'bg-[#172040] border-[#4F6BED] text-[#E8ECF8] font-semibold shadow-sm'
                    : 'bg-[#0E1428] border-[#1F2A4A] text-[#7C88AB] hover:text-[#E8ECF8]'
                }`}
              >
                <FileText className="w-3.5 h-3.5 text-[#F87171]" />
                <span>Video Content</span>
              </button>
            </div>

            <input
              type="text"
              placeholder="Draft title..."
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              className="w-full bg-[#0E1428] border border-[#1F2A4A] rounded-xl px-3 py-2 text-xs text-[#E8ECF8] placeholder-[#7C88AB] focus:outline-none focus:border-[#4F6BED] transition-colors"
              required
            />

            {newType === 'text' ? (
              <textarea
                placeholder="Write or paste draft content..."
                value={newContent}
                onChange={e => setNewContent(e.target.value)}
                rows={4}
                className="w-full bg-[#0E1428] border border-[#1F2A4A] rounded-xl px-3 py-2 text-xs text-[#E8ECF8] placeholder-[#7C88AB] focus:outline-none focus:border-[#4F6BED] transition-colors"
                required
              />
            ) : newType === 'image' ? (
              <>
                <input
                  type="file"
                  accept="image/*"
                  onChange={e => {
                    setSelectedFileWithPreview(e.target.files?.[0] || null);
                    setCreateDraftError('');
                  }}
                  className="w-full text-xs text-[#AAB4D0] file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-xs file:bg-[#4F6BED] file:text-white file:font-medium hover:file:bg-[#6479F2] file:cursor-pointer"
                  required
                />
                {selectedFile && selectedFilePreviewUrl && (
                  <div className="rounded-xl border border-[#1F2A4A] bg-[#0E1428] p-2.5 space-y-2">
                    <img
                      src={selectedFilePreviewUrl}
                      alt={`Preview of ${selectedFile.name}`}
                      className="max-h-48 w-full rounded-lg object-contain"
                    />
                    <p className="truncate text-[11px] text-[#AAB4D0]" title={selectedFile.name}>
                      Preview: {selectedFile.name}
                    </p>
                  </div>
                )}
              </>
            ) : (
              <div className="space-y-2">
                <input
                  type="file"
                  accept={newType === 'audio' ? 'audio/*' : 'video/*'}
                  onChange={e => {
                    setSelectedFileWithPreview(e.target.files?.[0] || null);
                    setCreateDraftError('');
                  }}
                  className="w-full text-xs text-[#AAB4D0] file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-xs file:bg-[#4F6BED] file:text-white file:font-medium hover:file:bg-[#6479F2] file:cursor-pointer"
                  required
                />
                {selectedFile && selectedFilePreviewUrl && (
                  <div className="rounded-xl border border-[#1F2A4A] bg-[#0E1428] p-2.5 space-y-2">
                    {newType === 'audio' ? (
                      <audio controls src={selectedFilePreviewUrl} className="w-full" />
                    ) : (
                      <video controls src={selectedFilePreviewUrl} className="max-h-48 w-full rounded-lg" />
                    )}
                    <p className="truncate text-[11px] text-[#AAB4D0]" title={selectedFile.name}>
                      Preview: {selectedFile.name}
                    </p>
                  </div>
                )}
                <textarea
                  placeholder="Optional transcript or captions for policy scanning..."
                  value={mediaTranscript}
                  onChange={e => setMediaTranscript(e.target.value)}
                  rows={3}
                  className="w-full bg-[#0E1428] border border-[#1F2A4A] rounded-xl px-3 py-2 text-xs text-[#E8ECF8] placeholder-[#7C88AB] focus:outline-none focus:border-[#4F6BED] transition-colors"
                />
              </div>
            )}

            {createDraftError && (
              <p role="alert" className="rounded-lg border border-[#F87171]/40 bg-[#F87171]/10 p-2.5 text-xs text-[#FCA5A5]">
                {createDraftError}
              </p>
            )}

            <button
              type="submit"
              disabled={creatingDraft}
              className="w-full bg-[#4F6BED] hover:bg-[#6479F2] text-white py-2 rounded-xl text-xs font-semibold shadow-md shadow-[#4F6BED]/20 transition-all flex items-center justify-center gap-1.5 disabled:cursor-wait disabled:opacity-60"
            >
              {creatingDraft ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              <span>{creatingDraft ? 'Uploading & scanning...' : 'Create & Scan Draft'}</span>
            </button>
            <p className="text-center text-[10px] text-[#7C88AB]">
              This creates a scanned draft. Submit it for approval from the draft workspace.
            </p>
          </form>
        )}

        {/* Draft List */}
        <div className="space-y-2">
          {drafts.length === 0 && !loading && (
            <div className="p-4 rounded-xl border border-[#1F2A4A] bg-[#111830] text-center text-xs text-[#7C88AB]">
              No drafts created yet. Click "+ New Draft" to begin.
            </div>
          )}
          {drafts.map(d => {
            const isSelected = selectedDraftId === d.id;
            const statusStyles = {
              'Submitted': 'bg-[#7C88AB]/15 text-[#AAB4D0] border-[#7C88AB]/30',
              'Scanned': 'bg-[#60A5FA]/15 text-[#60A5FA] border-[#60A5FA]/30',
              'In Revision': 'bg-[#FBBF24]/15 text-[#FBBF24] border-[#FBBF24]/30',
              'Pending Approval': 'bg-[#A78BFA]/15 text-[#A78BFA] border-[#A78BFA]/30',
              'Approved': 'bg-[#34D399]/15 text-[#34D399] border-[#34D399]/30',
              'Changes Requested': 'bg-[#F87171]/15 text-[#F87171] border-[#F87171]/30'
            };

            return (
              <div
                key={d.id}
                onClick={() => {
                  setSelectedDraftId(d.id);
                  setActiveFlagId(null);
                  setCategoryFilter('all');
                }}
                className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                  isSelected
                    ? 'bg-[#172040] border-[#4F6BED]/60 shadow-md shadow-[#4F6BED]/10 ring-1 ring-[#4F6BED]/30'
                    : 'bg-[#111830] border-[#1F2A4A] hover:border-[#2D3A63] hover:bg-[#141C33]'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center space-x-2 min-w-0">
                    {d.content_type === 'text' ? (
                      <FileText className="w-4 h-4 text-[#4F6BED] shrink-0" />
                    ) : d.content_type === 'audio' ? (
                      <FileText className="w-4 h-4 text-[#FBBF24] shrink-0" />
                    ) : d.content_type === 'video' ? (
                      <FileText className="w-4 h-4 text-[#F87171] shrink-0" />
                    ) : (
                      <ImageIcon className="w-4 h-4 text-[#A78BFA] shrink-0" />
                    )}
                    <span className="text-xs font-semibold text-[#E8ECF8] truncate">{d.title}</span>
                  </div>
                </div>
                <div className="mt-2.5 flex items-center justify-between text-[11px]">
                  <span className={`px-2 py-0.5 rounded-full border text-[10px] font-semibold ${statusStyles[d.status] || 'text-[#7C88AB] border-[#1F2A4A]'}`}>
                    {d.status}
                  </span>
                  <span className="text-[#7C88AB] text-[10px] font-mono">
                    v{d.current_version} • {new Date(d.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Center: Interactive Draft Workspace & Scanner */}
      <div className="lg:col-span-5 space-y-4">
        {currentDraft ? (
          <>
            <div className="bg-[#111830] border border-[#1F2A4A] rounded-2xl p-5 space-y-4 shadow-xl">
              {/* Draft Header */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1F2A4A] pb-3.5">
                <div>
                  <h3 className="text-base font-bold text-[#E8ECF8] flex items-center gap-2">
                    {currentDraft.title}
                    <span className="text-xs font-normal text-[#7C88AB] font-mono">
                      (v{currentDraft.current_version})
                    </span>
                  </h3>
                  <p className="text-xs text-[#7C88AB] mt-0.5">
                    Author: <span className="text-[#AAB4D0] font-medium">{currentDraft.author_name || 'Unknown creator'}</span>
                  </p>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center space-x-2">
                  {currentDraft.content_type === 'text' && (
                    <button
                      onClick={() => {
                        if (!isEditingDraft && latestRev?.content_text) {
                          setEditDraftText(latestRev.content_text);
                        }
                        setIsEditingDraft(!isEditingDraft);
                      }}
                      className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                        isEditingDraft
                          ? 'bg-[#4F6BED] text-white border-[#4F6BED]'
                          : 'bg-[#0E1428] hover:bg-[#172040] text-[#AAB4D0] hover:text-[#E8ECF8] border-[#1F2A4A]'
                      }`}
                    >
                      <Edit3 className="w-3.5 h-3.5 text-[#4F6BED]" />
                      <span>{isEditingDraft ? 'Cancel Edit' : 'Edit Copy'}</span>
                    </button>
                  )}

                  <button
                    onClick={handleScan}
                    disabled={scanning}
                    className="flex items-center space-x-1.5 bg-[#0E1428] hover:bg-[#172040] text-[#AAB4D0] hover:text-[#E8ECF8] px-3 py-1.5 rounded-lg text-xs font-medium border border-[#1F2A4A] transition-colors"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 text-[#4F6BED] ${scanning ? 'animate-spin' : ''}`} />
                    <span>{scanning ? 'Scanning...' : 'Re-scan'}</span>
                  </button>

                  {currentDraft.status !== 'Approved' && (
                    <button
                      onClick={handleSubmitForApproval}
                      disabled={needsPolicyReview || submittingForApproval}
                      className="flex items-center space-x-1.5 bg-[#4F6BED] hover:bg-[#6479F2] text-white px-3.5 py-1.5 rounded-lg text-xs font-semibold shadow-md shadow-[#4F6BED]/20 transition-all disabled:cursor-not-allowed disabled:opacity-50"
                      title={needsPolicyReview ? latestRev.policy_coverage_reason : 'Submit for managerial approval'}
                    >
                      {submittingForApproval ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Send className="w-3.5 h-3.5" />
                      )}
                      <span>{submittingForApproval ? 'Submitting...' : 'Submit for Approval'}</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Compliance Meter & Feedback Banner */}
              <div className="bg-[#0E1428] border border-[#1F2A4A] rounded-xl p-3.5 flex items-center justify-between">
                <div className="flex items-center space-x-3.5">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-sm border-2 shrink-0 ${
                    complianceScore >= 80 ? 'border-[#34D399] bg-[#34D399]/10 text-[#34D399]' :
                    complianceScore >= 50 ? 'border-[#FBBF24] bg-[#FBBF24]/10 text-[#FBBF24]' :
                    'border-[#F87171] bg-[#F87171]/10 text-[#F87171]'
                  }`}>
                    {complianceScore}%
                  </div>
                  <div>
                    <div className="text-xs font-bold text-[#E8ECF8]">
                      {complianceScore >= 80 ? 'High Brand Alignment' : 'Off-Brand Violations Detected'}
                    </div>
                    <div className="text-[11px] text-[#AAB4D0] mt-0.5">
                      {pendingFlags.length === 0
                        ? 'All brand checks passed. Ready for approval!'
                        : `${pendingFlags.length} pending issue(s) require creator resolution`}
                    </div>
                  </div>
                </div>
                <div className="text-right text-[11px] text-[#7C88AB] font-mono shrink-0">
                  <span className="inline-block w-2 h-2 rounded-full bg-[#34D399] mr-1.5 animate-pulse"></span>
                  Two-Layer Active
                </div>
              </div>

              {needsPolicyReview && (
                <div className="flex items-start gap-2.5 rounded-xl border border-[#FBBF24]/40 bg-[#FBBF24]/10 p-3 text-xs text-[#FBBF24]">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#FBBF24]" />
                  <div>
                    <div className="font-semibold">Policy coverage unavailable</div>
                    <div className="mt-0.5 text-[#FBBF24]/80">
                      {latestRev.policy_coverage_reason || 'A reviewer must confirm this content because no applicable company policy was retrieved.'}
                    </div>
                  </div>
                </div>
              )}

              {/* Draft Content Rendering */}
              <div className="bg-[#0A0F1E] border border-[#1F2A4A] rounded-xl p-4 min-h-[260px]">
                {currentDraft.content_type === 'text' ? (
                  isEditingDraft ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-xs text-[#7C88AB]">
                        <span className="font-semibold text-[#4F6BED] flex items-center gap-1.5">
                          <Edit3 className="w-3.5 h-3.5" />
                          Direct Copy Editor
                        </span>
                        <span>Saving triggers automatic re-scan as v{currentDraft.current_version + 1}</span>
                      </div>
                      <textarea
                        value={editDraftText}
                        onChange={e => setEditDraftText(e.target.value)}
                        rows={8}
                        className="w-full bg-[#0E1428] border border-[#1F2A4A] rounded-xl p-3 text-xs text-[#E8ECF8] font-sans leading-relaxed focus:outline-none focus:border-[#4F6BED]"
                        placeholder="Write or edit draft content here..."
                      />
                      <div className="flex justify-end space-x-2 pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            setIsEditingDraft(false);
                            setEditDraftText(latestRev?.content_text || '');
                          }}
                          className="px-3 py-1.5 rounded-lg text-xs font-medium text-[#7C88AB] hover:text-[#E8ECF8] bg-[#111830] transition-colors"
                        >
                          Discard Changes
                        </button>
                        <button
                          type="button"
                          onClick={handleSaveDraftText}
                          disabled={scanning}
                          className="flex items-center space-x-1.5 bg-[#4F6BED] hover:bg-[#6479F2] text-white px-4 py-1.5 rounded-lg text-xs font-semibold shadow-md transition-all"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>{scanning ? 'Scanning...' : 'Save & Re-scan Revision'}</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    renderHighlightedText()
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
                      <div className="space-y-3">
                        <div className="relative rounded-xl overflow-hidden border border-border bg-surface-subtle p-3 sm:p-4 min-h-[200px] flex flex-col items-center justify-center">
                          {imageLoadError ? (
                            <div className="flex flex-col items-center justify-center py-6 px-4 text-center space-y-2">
                              <ImageOff className="w-8 h-8 text-text-muted" />
                              <div className="text-xs font-semibold text-text-primary">Visual Asset Preview Unavailable</div>
                              <p className="text-[11px] text-text-secondary max-w-xs">
                                Unable to load creative asset file. The multimodal compliance report remains active below.
                              </p>
                            </div>
                          ) : (
                            <div className="w-full flex flex-col items-center">
                              {/* Asset Status Badge & Meta Header */}
                              <div className="w-full flex items-center justify-between mb-2.5">
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
                              <div className="w-full flex items-center justify-center bg-canvas/40 rounded-lg p-2.5 border border-border/40">
                                <img
                                  src={mediaUrl(currentDraft.content_ref || '/static/uploads/sample_banner.png')}
                                  alt={currentDraft.title || 'Draft Banner'}
                                  onError={() => setFailedImageDraftId(currentDraft?.id || 'default')}
                                  className="max-h-56 sm:max-h-64 w-auto object-contain rounded-md shadow-sm"
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
                                  <span>Multimodal scan completed</span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Multimodal Visual Audit Details */}
                        <div className="bg-surface-subtle border border-border p-3 rounded-xl text-xs space-y-1 text-text-secondary">
                          <div className="font-semibold text-text-primary flex items-center gap-1.5">
                            <ImageIcon className="w-3.5 h-3.5 text-primary" />
                            Multimodal Visual Audit
                          </div>
                          <p className="text-[11px] text-text-muted">
                            Automated color palette extraction, WCAG contrast calculation, and logo hash inspection completed.
                          </p>
                        </div>
                        {currentDraft.media_metadata && (
                          <MediaMetadata metadata={currentDraft.media_metadata} />
                        )}
                        {latestRev?.media_analysis && (
                          <MediaAnalysis analysis={latestRev.media_analysis} />
                        )}
                      </div>
                    );
                  })()
                ) : (
                  <div className="space-y-3">
                    <div className="rounded-xl border border-[#1F2A4A] bg-[#0E1428] p-4">
                      {currentDraft.content_type === 'audio' ? (
                        <audio ref={mediaElementRef} controls src={mediaUrl(currentDraft.content_ref)} className="w-full" />
                      ) : (
                        <video ref={mediaElementRef} controls src={mediaUrl(currentDraft.content_ref)} className="max-h-64 w-full rounded-lg" />
                      )}
                    </div>
                    <div className="rounded-xl border border-[#FBBF24]/30 bg-[#FBBF24]/10 p-2.5 text-xs text-[#FBBF24]">
                      Automatic extraction is reported below. Any unavailable capability keeps this draft in human review.
                    </div>
                    {currentDraft.media_metadata && (
                      <MediaMetadata metadata={currentDraft.media_metadata} />
                    )}
                    {latestRev?.media_analysis && (
                      <MediaAnalysis
                        analysis={latestRev.media_analysis}
                        flags={flags}
                        onSeek={(time) => {
                          if (mediaElementRef.current && Number.isFinite(time)) {
                            mediaElementRef.current.currentTime = time;
                            mediaElementRef.current.play().catch(() => {});
                          }
                        }}
                      />
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Revision Lifecycle History Viewer */}
            {currentDraft.history && currentDraft.history.length > 0 && (
              <div className="bg-[#111830] border border-[#1F2A4A] rounded-2xl p-4 space-y-3 shadow-xl">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-[#E8ECF8] uppercase tracking-wider flex items-center gap-1.5">
                    <History className="w-3.5 h-3.5 text-[#4F6BED]" />
                    Revision Lifecycle History ({currentDraft.history.length})
                  </h4>
                  <span className="text-[10px] text-[#7C88AB] font-mono">Full Iteration Audit</span>
                </div>

                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {currentDraft.history.map(rev => (
                    <div key={rev.id} className="bg-[#0A0F1E] border border-[#1F2A4A] rounded-xl p-2.5 text-xs space-y-1.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <span className="font-mono font-bold text-[#4F6BED] bg-[#4F6BED]/10 border border-[#4F6BED]/20 px-1.5 py-0.5 rounded text-[11px]">
                            v{rev.version_num}
                          </span>
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${
                            rev.compliance_score >= 80 
                              ? 'bg-[#34D399]/10 text-[#34D399] border-[#34D399]/30' 
                              : 'bg-[#F87171]/10 text-[#F87171] border-[#F87171]/30'
                          }`}>
                            {rev.compliance_score}% alignment
                          </span>
                        </div>
                        <span className="text-[10px] text-[#7C88AB] font-mono">
                          {new Date(rev.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                      </div>

                      <p className="text-[#AAB4D0] text-[11px] line-clamp-2 bg-[#0E1428] p-1.5 rounded-lg border border-[#1F2A4A]">
                        {rev.content_text || rev.image_path || 'No content snapshot'}
                      </p>

                      <div className="flex items-center justify-between text-[10px] text-[#7C88AB] pt-0.5 font-mono">
                        <span>{rev.flags ? rev.flags.length : 0} flag(s) audited</span>
                        <div className="space-x-1 flex flex-wrap">
                          {(rev.flags || []).slice(0, 5).map(f => (
                            <span key={f.id} className="bg-[#172040] text-[#AAB4D0] px-1.5 py-0.2 rounded text-[9px] border border-[#1F2A4A]">
                              {f.rule_id}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="bg-[#111830] border border-[#1F2A4A] rounded-2xl p-8 text-center text-[#7C88AB]">
            Select a draft from the left panel to begin brand governance review.
          </div>
        )}
      </div>

      {/* Right Column: AI Brand Governance Flags & Human-in-the-Loop Actions */}
      <div className="lg:col-span-4 space-y-4">
        {/* Panel Header */}
        <div className="flex items-center justify-between border-b border-[#1F2A4A] pb-2.5">
          <div className="flex items-center gap-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#AAB4D0] flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-[#4F6BED]" />
              AI Review & Flags
            </h2>
            <span className="bg-[#4F6BED]/20 text-[#60A5FA] px-2 py-0.5 rounded-full text-xs font-mono font-semibold">
              {pendingFlags.length}
            </span>
          </div>
          <span className="text-[10px] text-[#2DD4BF] font-mono">Strict Grounding</span>
        </div>

        {/* Dynamic Category Filter Pills (rendered only when multiple distinct categories exist) */}
        {existingCategories.length > 1 && (
          <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
            <button
              type="button"
              onClick={() => setCategoryFilter('all')}
              className={`px-2.5 py-1 rounded-lg border text-[11px] font-semibold whitespace-nowrap transition-all ${
                categoryFilter === 'all'
                  ? 'bg-[#172040] border-[#4F6BED] text-[#E8ECF8] shadow-sm'
                  : 'bg-[#0E1428] border-[#1F2A4A] text-[#7C88AB] hover:text-[#E8ECF8]'
              }`}
            >
              All ({pendingFlags.length})
            </button>
            {existingCategories.map(cat => {
              const count = pendingFlags.filter(f => f.category === cat).length;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategoryFilter(cat)}
                  className={`px-2.5 py-1 rounded-lg border text-[11px] font-semibold capitalize whitespace-nowrap transition-all ${
                    categoryFilter === cat
                      ? 'bg-[#172040] border-[#4F6BED] text-[#E8ECF8] shadow-sm'
                      : 'bg-[#0E1428] border-[#1F2A4A] text-[#7C88AB] hover:text-[#E8ECF8]'
                  }`}
                >
                  {cat} ({count})
                </button>
              );
            })}
          </div>
        )}

        {/* Pending Flag Cards List */}
        <div className="space-y-3 max-h-[750px] overflow-y-auto pr-1">
          {pendingFlags.length === 0 ? (
            <div className="bg-[#34D399]/10 border border-[#34D399]/30 rounded-2xl p-6 text-center space-y-2.5">
              <div className="w-12 h-12 rounded-full bg-[#34D399]/20 border border-[#34D399]/40 flex items-center justify-center text-[#34D399] mx-auto shadow-md shadow-[#34D399]/10">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-[#34D399]">100% Brand Compliant</h4>
              <p className="text-xs text-[#AAB4D0] leading-relaxed max-w-xs mx-auto">
                All automated brand checks passed. No tone breaches, terminology violations, outdated facts, or palette errors detected.
              </p>
            </div>
          ) : displayedPendingFlags.length === 0 ? (
            <div className="bg-[#111830] border border-[#1F2A4A] rounded-2xl p-6 text-center text-xs text-[#7C88AB]">
              No pending findings matching category "{categoryFilter}".
            </div>
          ) : (
            displayedPendingFlags.map(flag => {
              const isCardActive = activeFlagId === flag.id;

              return (
                <div
                  id={`flag-${flag.id}`}
                  key={flag.id}
                  onMouseEnter={() => setActiveFlagId(flag.id)}
                  onMouseLeave={() => setActiveFlagId(null)}
                  className={`bg-[#111830] rounded-2xl p-4 space-y-3 transition-all shadow-sm border ${
                    categoryBorderAccents[flag.category] || 'border-l-4 border-l-[#4F6BED]'
                  } ${
                    isCardActive
                      ? 'border-[#4F6BED] ring-1 ring-[#4F6BED]/40 shadow-lg shadow-[#4F6BED]/10 bg-[#141C33]'
                      : 'border-[#1F2A4A] hover:border-[#2D3A63]'
                  }`}
                >
                  {/* Top Rule & Metadata Header */}
                  <div className="flex items-center justify-between gap-1.5 text-xs">
                    <div className="flex items-center space-x-1.5 min-w-0">
                      <span className="font-mono font-bold text-[#60A5FA] bg-[#4F6BED]/10 border border-[#4F6BED]/20 px-2 py-0.5 rounded-lg text-xs shrink-0">
                        {flag.rule_id}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full border text-[10px] uppercase font-semibold shrink-0 ${categoryBadgeColors[flag.category] || 'bg-[#172040] text-[#AAB4D0] border-[#1F2A4A]'}`}>
                        {flag.category}
                      </span>
                      {flag.layer && (
                        <span className="hidden sm:inline-block text-[9px] font-mono text-[#2DD4BF] bg-[#2DD4BF]/10 px-1.5 py-0.5 rounded border border-[#2DD4BF]/20 shrink-0">
                          {flag.layer === 'layer1_deterministic' ? 'L1 Deterministic' : 'L2 Semantic'}
                        </span>
                      )}
                      {flag.severity && (
                        <span className={`px-1.5 py-0.5 rounded text-[9px] uppercase font-semibold border shrink-0 ${
                          flag.severity === 'high' || flag.severity === 'critical' ? 'bg-[#F87171]/15 text-[#F87171] border-[#F87171]/30' :
                          flag.severity === 'medium' ? 'bg-[#FBBF24]/15 text-[#FBBF24] border-[#FBBF24]/30' :
                          'bg-[#60A5FA]/15 text-[#60A5FA] border-[#60A5FA]/30'
                        }`}>
                          {flag.severity}
                        </span>
                      )}
                    </div>
                    {typeof flag.confidence === 'number' && (
                      <span className="text-[11px] text-[#7C88AB] font-mono shrink-0 ml-auto" title={`${(flag.confidence * 100).toFixed(1)}% AI confidence`}>
                        {Math.round(flag.confidence * 100)}% conf
                      </span>
                    )}
                  </div>

                  {/* Offending Text Span Box */}
                  <div className="bg-[#0E1428] rounded-xl p-2.5 text-xs border border-[#1F2A4A] space-y-1">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-[#7C88AB] block">
                      Offending Text:
                    </span>
                    <span className="text-[#F87171] font-semibold line-through break-words block">
                      "{flag.span}"
                    </span>
                  </div>

                  {/* Friendly Rule Explanation */}
                  <div className="text-xs text-[#E8ECF8] leading-relaxed">
                    <span className="text-[#AAB4D0] text-[11px] font-medium block mb-0.5">
                      Why it violates brand rules:
                    </span>
                    <p className="break-words text-[#D0D7EC]">
                      {flag.explanation}
                    </p>
                  </div>

                  {/* Suggested Non-Destructive Fix */}
                  <div className="bg-[#4F6BED]/10 border border-[#4F6BED]/30 rounded-xl p-3 text-xs space-y-1.5">
                    <div className="flex items-center justify-between text-[#60A5FA]">
                      <span className="text-[10px] uppercase tracking-wider font-bold">
                        Suggested Non-Destructive Fix
                      </span>
                      <span className="text-[10px] text-[#4F6BED] font-mono font-semibold">
                        One-Click
                      </span>
                    </div>
                    <p className="text-[#E8ECF8] font-medium text-xs break-words">
                      "{flag.fix}"
                    </p>
                  </div>

                  {/* Inline Custom Fix Editor */}
                  {editingFlagId === flag.id && (
                    <div className="space-y-2 bg-[#0E1428] p-3 rounded-xl border border-[#4F6BED]/50 motion-safe:animate-fade-in">
                      <label htmlFor={`custom-fix-${flag.id}`} className="block text-[11px] font-medium text-[#AAB4D0]">
                        Customize Replacement Text:
                      </label>
                      <input
                        id={`custom-fix-${flag.id}`}
                        type="text"
                        value={customFixText}
                        onChange={e => setCustomFixText(e.target.value)}
                        placeholder="Enter custom replacement..."
                        autoFocus
                        className="w-full bg-[#111830] border border-[#1F2A4A] rounded-lg px-3 py-1.5 text-xs text-[#E8ECF8] placeholder-[#7C88AB] focus:outline-none focus:border-[#4F6BED] focus:ring-1 focus:ring-[#4F6BED]"
                      />
                      <div className="flex justify-end space-x-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setEditingFlagId(null)}
                          className="px-2.5 py-1 text-xs text-[#7C88AB] hover:text-[#E8ECF8] rounded-lg hover:bg-[#111830] transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => handleResolve(flag.id, 'edited', customFixText)}
                          className="px-3 py-1 bg-[#4F6BED] hover:bg-[#6479F2] text-white rounded-lg text-xs font-semibold shadow-sm transition-all"
                        >
                          Apply Custom Fix
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Creator Action Buttons (Accept, Edit, Dismiss) */}
                  <div className="flex items-center space-x-2 pt-1.5 border-t border-[#1F2A4A]">
                    <button
                      type="button"
                      onClick={() => handleResolve(flag.id, 'accepted')}
                      className="flex-1 flex items-center justify-center space-x-1.5 bg-[#34D399]/15 hover:bg-[#34D399]/25 text-[#34D399] border border-[#34D399]/30 py-2 rounded-xl text-xs font-semibold transition-all shadow-sm"
                      title="Accept the non-destructive fix and update draft"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Accept Fix</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingFlagId(flag.id);
                        setCustomFixText(flag.fix || '');
                      }}
                      className="flex items-center justify-center space-x-1 bg-[#0E1428] hover:bg-[#172040] text-[#AAB4D0] hover:text-[#E8ECF8] px-3.5 py-2 rounded-xl text-xs font-medium border border-[#1F2A4A] transition-colors"
                      title="Edit replacement text before applying"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Edit</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveDismissModal(flag.id)}
                      className="flex items-center justify-center space-x-1 bg-[#0E1428] hover:bg-[#F87171]/20 text-[#7C88AB] hover:text-[#F87171] px-3 py-2 rounded-xl text-xs font-medium border border-[#1F2A4A] transition-colors"
                      title="Dismiss violation with reason for audit review"
                    >
                      <X className="w-3.5 h-3.5" />
                      <span>Dismiss</span>
                    </button>
                  </div>

                  {/* Dismissal Reason Modal */}
                  {activeDismissModal === flag.id && (
                    <div className="mt-2.5 bg-[#0E1428] border border-[#1F2A4A] rounded-xl p-3.5 space-y-2.5 motion-safe:animate-fade-in">
                      <div>
                        <span className="text-xs font-semibold text-[#E8ECF8] block">
                          Dismiss Violation
                        </span>
                        <span className="text-[11px] text-[#7C88AB] block mt-0.5">
                          Explain why this brand violation is intentional. Your reasoning will be permanently logged for managerial review during approval.
                        </span>
                      </div>
                      <textarea
                        value={dismissReason}
                        onChange={e => setDismissReason(e.target.value)}
                        placeholder="e.g., Intentional creative hyperbole for seasonal campaign..."
                        rows={2}
                        autoFocus
                        className="w-full bg-[#111830] border border-[#1F2A4A] rounded-lg p-2.5 text-xs text-[#E8ECF8] placeholder-[#7C88AB] focus:outline-none focus:border-[#4F6BED] focus:ring-1 focus:ring-[#4F6BED]"
                      />
                      <div className="flex justify-end space-x-2">
                        <button
                          type="button"
                          onClick={() => {
                            setActiveDismissModal(null);
                            setDismissReason('');
                          }}
                          className="px-3 py-1.5 text-xs text-[#7C88AB] hover:text-[#E8ECF8] rounded-lg hover:bg-[#111830] transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => handleResolve(flag.id, 'dismissed', null, dismissReason || 'Intentional creative deviation')}
                          className="px-3.5 py-1.5 bg-[#F87171] hover:bg-[#EF4444] text-white rounded-lg text-xs font-semibold shadow-sm transition-all"
                        >
                          Confirm Dismissal
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Resolved Findings History Section */}
        {resolvedFlags.length > 0 && (
          <div className="pt-3 border-t border-[#1F2A4A] space-y-2.5">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-[#7C88AB] uppercase tracking-wider flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#34D399]" />
                Resolved in this Revision ({resolvedFlags.length})
              </h3>
              <span className="text-[10px] text-[#7C88AB] font-mono">Audit Trail</span>
            </div>
            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {resolvedFlags.map(rf => (
                <div key={rf.id} className="bg-[#0E1428] p-2.5 rounded-xl border border-[#1F2A4A] text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-semibold text-[#E8ECF8]">{rf.rule_id}</span>
                    <span className={`text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full border ${
                      rf.resolution === 'accepted' ? 'text-[#34D399] bg-[#34D399]/15 border-[#34D399]/30' :
                      rf.resolution === 'edited' ? 'text-[#60A5FA] bg-[#4F6BED]/15 border-[#4F6BED]/30' :
                      'text-[#FBBF24] bg-[#FBBF24]/15 border-[#FBBF24]/30'
                    }`}>
                      {rf.resolution === 'accepted' ? 'Accepted' : rf.resolution === 'edited' ? 'Custom Fix' : 'Dismissed'}
                    </span>
                  </div>
                  {rf.span && (
                    <div className="text-[11px] text-[#7C88AB] truncate">
                      Offending: <span className="text-[#AAB4D0] italic">"{rf.span}"</span>
                    </div>
                  )}
                  {rf.resolution_comment && (
                    <div className="text-[11px] text-[#FBBF24]/90 bg-[#FBBF24]/5 px-2 py-1 rounded border border-[#FBBF24]/20">
                      Note: {rf.resolution_comment}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function MediaMetadata({ metadata }) {
  const entries = Object.entries(metadata).filter(([, value]) => value !== null && value !== undefined);
  return (
    <div className="rounded-xl border border-[#1F2A4A] bg-[#0E1428] p-3 text-[11px] text-[#AAB4D0]">
      <div className="mb-1.5 font-bold text-[#E8ECF8]">Technical media evidence</div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1">
        {entries.map(([key, value]) => (
          <div key={key} className="truncate">
            <span className="text-[#7C88AB]">{key.replaceAll('_', ' ')}:</span>{' '}
            <span className="text-[#E8ECF8] font-mono">
              {typeof value === 'object' ? JSON.stringify(value) : String(value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MediaAnalysis({ analysis, flags = [], onSeek }) {
  const missing = analysis.missing_capabilities || [];
  const findings = analysis.findings || [];
  const timedFlags = flags.filter(
    flag => Number.isFinite(flag.start_time) || Number.isFinite(flag.end_time)
  );
  const frameFlags = flags.filter(flag => Number.isInteger(flag.frame_number));
  return (
    <div className="rounded-xl border border-[#1F2A4A] bg-[#0E1428] p-3 text-[11px] text-[#AAB4D0] space-y-2">
      <div className="font-bold text-[#E8ECF8]">Content extraction evidence</div>
      <div className={`font-medium ${missing.length ? 'text-[#FBBF24]' : 'text-[#34D399]'}`}>
        Status: {analysis.extraction_status || 'unknown'}
        {missing.length ? ` • Missing: ${missing.join(', ')}` : ''}
      </div>
      {analysis.transcript && (
        <div className="line-clamp-3">
          <span className="text-[#7C88AB]">Transcript:</span> {analysis.transcript}
        </div>
      )}
      {analysis.ocr_text && (
        <div className="line-clamp-3">
          <span className="text-[#7C88AB]">OCR:</span> {analysis.ocr_text}
        </div>
      )}
      {findings.length > 0 && (
        <div className="text-[#7C88AB]">
          {findings.length} sampled frame(s) analyzed; findings include frame/timestamp evidence.
        </div>
      )}
      {timedFlags.length > 0 && (
        <div className="space-y-1.5 pt-1">
          <div className="font-semibold text-[#E8ECF8]">Timeline findings</div>
          {timedFlags.map(flag => {
            const time = Number.isFinite(flag.start_time) ? flag.start_time : flag.end_time;
            return (
              <button
                key={flag.id}
                type="button"
                onClick={() => onSeek?.(time)}
                className="flex w-full items-center justify-between rounded-lg border border-[#1F2A4A] bg-[#111830] hover:bg-[#172040] hover:border-[#4F6BED] px-2.5 py-1.5 text-left text-xs transition-colors"
                title={`Jump to ${time.toFixed(3)} seconds`}
              >
                <span className="truncate pr-2 text-[#AAB4D0]">{flag.span || flag.rule_id}</span>
                <span className="shrink-0 font-mono text-[#60A5FA]">
                  {time.toFixed(2)}s
                </span>
              </button>
            );
          })}
        </div>
      )}
      {frameFlags.length > 0 && (
        <div className="space-y-1.5 pt-1">
          <div className="font-semibold text-[#E8ECF8]">Frame findings</div>
          {frameFlags.map(flag => (
            <div key={flag.id} className="flex justify-between rounded-lg border border-[#1F2A4A] bg-[#111830] px-2.5 py-1.5 text-xs">
              <span className="truncate pr-2 text-[#AAB4D0]">{flag.span || flag.rule_id}</span>
              <span className="shrink-0 font-mono text-[#60A5FA]">Frame {flag.frame_number}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
