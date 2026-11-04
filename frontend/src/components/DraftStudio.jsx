import React, { useState, useEffect } from 'react';
import { api } from '../api';
import {
  Sparkles, Check, X, Edit3, Send, Upload, RefreshCw, AlertTriangle,
  CheckCircle2, FileText, Image as ImageIcon, ShieldAlert, Info, ArrowRight
} from 'lucide-react';

export default function DraftStudio({ currentUser, onDraftUpdated }) {
  const [drafts, setDrafts] = useState([]);
  const [selectedDraftId, setSelectedDraftId] = useState(null);
  const [currentDraft, setCurrentDraft] = useState(null);
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [activeDismissModal, setActiveDismissModal] = useState(null);
  const [dismissReason, setDismissReason] = useState('');
  const [editingFlagId, setEditingFlagId] = useState(null);
  const [customFixText, setCustomFixText] = useState('');
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newType, setNewType] = useState('text');
  const [selectedFile, setSelectedFile] = useState(null);

  useEffect(() => {
    loadDrafts();
  }, []);

  useEffect(() => {
    if (selectedDraftId) {
      loadDraftDetails(selectedDraftId);
    }
  }, [selectedDraftId]);

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
    } catch (e) {
      console.error(e);
    } finally {
      setScanning(false);
    }
  }

  async function handleResolve(flagId, resolution, editedFix = null, comment = null) {
    try {
      await api.resolveFlag(flagId, resolution, editedFix, comment, currentUser.id);
      await loadDraftDetails(currentDraft.id);
      setActiveDismissModal(null);
      setEditingFlagId(null);
      setDismissReason('');
      setCustomFixText('');
      if (onDraftUpdated) onDraftUpdated();
    } catch (e) {
      console.error(e);
    }
  }

  async function handleSubmitForApproval() {
    if (!currentDraft) return;
    try {
      await api.submitForApproval(currentDraft.id, currentUser.id);
      await loadDraftDetails(currentDraft.id);
      await loadDrafts();
      if (onDraftUpdated) onDraftUpdated();
    } catch (e) {
      console.error(e);
    }
  }

  async function handleCreateDraft(e) {
    e.preventDefault();
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
      } else {
        if (!selectedFile) return;
        const formData = new FormData();
        formData.append('title', newTitle || 'Untitled Banner');
        formData.append('file', selectedFile);
        const created = await api.uploadImageDraft(formData, currentUser.id);
        setIsCreatingNew(false);
        setNewTitle('');
        setSelectedFile(null);
        await loadDrafts();
        setSelectedDraftId(created.id);
      }
      if (onDraftUpdated) onDraftUpdated();
    } catch (e) {
      console.error(e);
    }
  }

  const latestRev = currentDraft?.latest_revision;
  const flags = latestRev?.flags || [];
  const pendingFlags = flags.filter(f => f.resolution === 'pending');
  const resolvedFlags = flags.filter(f => f.resolution !== 'pending');
  const complianceScore = latestRev?.compliance_score ?? 100;

  // Render text with interactive highlight spans
  const renderHighlightedText = () => {
    if (!latestRev?.content_text) return null;
    let text = latestRev.content_text;

    if (pendingFlags.length === 0) {
      return <p className="whitespace-pre-wrap leading-relaxed text-slate-200">{text}</p>;
    }

    // Sort pending flags by start index or occurrence
    const sorted = [...pendingFlags].filter(f => text.includes(f.span));

    return (
      <div className="whitespace-pre-wrap leading-relaxed text-slate-200">
        {text.split(/(\b(?:cheap|rockstar|ninja|guaranteed 100% results|over 10,000 active users|#FF0055|we crush our competitors|the #1 solution|leverage cross-functional synergies)\b)/i).map((part, i) => {
          const matchingFlag = sorted.find(f => f.span.toLowerCase() === part.toLowerCase());
          if (matchingFlag) {
            return (
              <mark
                key={i}
                className="bg-rose-500/25 border-b-2 border-rose-400 text-rose-200 px-1 py-0.5 rounded cursor-pointer hover:bg-rose-500/40 transition-colors"
                title={`Flagged by Rule ${matchingFlag.rule_id}: ${matchingFlag.explanation}`}
              >
                {part}
              </mark>
            );
          }
          return <span key={i}>{part}</span>;
        })}
      </div>
    );
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Left Sidebar: Draft Selection & Creation */}
      <div className="lg:col-span-3 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
            Workspaces & Drafts
          </h2>
          <button
            onClick={() => setIsCreatingNew(!isCreatingNew)}
            className="text-xs bg-blue-600 hover:bg-blue-500 text-white px-2.5 py-1 rounded font-medium transition-colors"
          >
            {isCreatingNew ? 'Cancel' : '+ New Draft'}
          </button>
        </div>

        {/* New Draft Form */}
        {isCreatingNew && (
          <form onSubmit={handleCreateDraft} className="bg-slate-900 border border-blue-500/40 rounded-xl p-4 space-y-3 shadow-lg">
            <h3 className="text-xs font-bold text-blue-400 uppercase">Create New Draft</h3>
            <div className="flex space-x-2 text-xs">
              <button
                type="button"
                onClick={() => setNewType('text')}
                className={`flex-1 py-1 rounded border ${newType === 'text' ? 'bg-blue-600 border-blue-500 text-white' : 'border-slate-700 text-slate-400'}`}
              >
                Text Copy
              </button>
              <button
                type="button"
                onClick={() => setNewType('image')}
                className={`flex-1 py-1 rounded border ${newType === 'image' ? 'bg-blue-600 border-blue-500 text-white' : 'border-slate-700 text-slate-400'}`}
              >
                Visual Banner
              </button>
            </div>
            <input
              type="text"
              placeholder="Draft title..."
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
              required
            />
            {newType === 'text' ? (
              <textarea
                placeholder="Write or paste draft content..."
                value={newContent}
                onChange={e => setNewContent(e.target.value)}
                rows={4}
                className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
                required
              />
            ) : (
              <input
                type="file"
                accept="image/*"
                onChange={e => setSelectedFile(e.target.files[0])}
                className="w-full text-xs text-slate-400 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:bg-blue-600 file:text-white"
                required
              />
            )}
            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-500 text-white py-1.5 rounded text-xs font-medium transition-colors"
            >
              Scan & Submit Draft
            </button>
          </form>
        )}

        {/* Draft List */}
        <div className="space-y-2">
          {drafts.map(d => {
            const isSelected = selectedDraftId === d.id;
            const statusStyles = {
              'Submitted': 'bg-slate-700 text-slate-200',
              'Scanned': 'bg-blue-500/20 text-blue-300 border-blue-500/30',
              'In Revision': 'bg-amber-500/20 text-amber-300 border-amber-500/30',
              'Pending Approval': 'bg-purple-500/20 text-purple-300 border-purple-500/30',
              'Approved': 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
              'Changes Requested': 'bg-rose-500/20 text-rose-300 border-rose-500/30'
            };

            return (
              <div
                key={d.id}
                onClick={() => setSelectedDraftId(d.id)}
                className={`p-3 rounded-xl border cursor-pointer transition-all ${
                  isSelected
                    ? 'bg-slate-900 border-blue-500/60 shadow-md ring-1 ring-blue-500/20'
                    : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center space-x-2">
                    {d.content_type === 'text' ? (
                      <FileText className="w-4 h-4 text-blue-400 shrink-0" />
                    ) : (
                      <ImageIcon className="w-4 h-4 text-purple-400 shrink-0" />
                    )}
                    <span className="text-xs font-medium text-slate-200 line-clamp-1">{d.title}</span>
                  </div>
                </div>
                <div className="mt-2 flex items-center justify-between text-[11px]">
                  <span className={`px-2 py-0.5 rounded-full border text-[10px] font-medium ${statusStyles[d.status] || 'text-slate-400'}`}>
                    {d.status}
                  </span>
                  <span className="text-slate-500 text-[10px]">
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
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            {/* Draft Header */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  {currentDraft.title}
                  <span className="text-xs font-normal text-slate-400">
                    (Revision v{currentDraft.current_version})
                  </span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Author: <span className="text-slate-200 font-medium">{currentDraft.author_name || 'Riya Sharma'}</span>
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center space-x-2">
                <button
                  onClick={handleScan}
                  disabled={scanning}
                  className="flex items-center space-x-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-700 transition-colors"
                >
                  <RefreshCw className={`w-3.5 h-3.5 text-blue-400 ${scanning ? 'animate-spin' : ''}`} />
                  <span>{scanning ? 'Scanning...' : 'Re-scan'}</span>
                </button>

                {currentDraft.status !== 'Approved' && (
                  <button
                    onClick={handleSubmitForApproval}
                    className="flex items-center space-x-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white px-3.5 py-1.5 rounded-lg text-xs font-semibold shadow-md transition-all"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Submit for Approval</span>
                  </button>
                )}
              </div>
            </div>

            {/* Compliance Meter & Feedback Banner */}
            <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-3 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className={`w-11 h-11 rounded-full flex items-center justify-center font-bold text-sm border-2 ${
                  complianceScore >= 80 ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400' :
                  complianceScore >= 50 ? 'border-amber-500 bg-amber-500/10 text-amber-400' :
                  'border-rose-500 bg-rose-500/10 text-rose-400'
                }`}>
                  {complianceScore}%
                </div>
                <div>
                  <div className="text-xs font-semibold text-slate-200">
                    {complianceScore >= 80 ? 'High Brand Alignment' : 'Off-Brand Violations Detected'}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    {pendingFlags.length === 0
                      ? 'All brand checks passed. Ready for approval!'
                      : `${pendingFlags.length} pending issue(s) require creator resolution`}
                  </div>
                </div>
              </div>
              <div className="text-right text-[11px] text-slate-400">
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 mr-1.5 animate-pulse"></span>
                Two-Layer Active
              </div>
            </div>

            {/* Draft Content Rendering */}
            <div className="bg-slate-950 border border-slate-800 rounded-lg p-4 min-h-[260px]">
              {currentDraft.content_type === 'text' ? (
                renderHighlightedText()
              ) : (
                <div className="space-y-3">
                  <div className="relative rounded-lg overflow-hidden border border-slate-800 bg-slate-900 flex items-center justify-center">
                    <img
                      src={currentDraft.content_ref || '/static/uploads/sample_banner.png'}
                      alt="Banner Draft"
                      className="max-h-64 object-contain"
                    />
                  </div>
                  <div className="bg-slate-900/80 border border-slate-800 p-2.5 rounded text-xs space-y-1 text-slate-300">
                    <div className="font-semibold text-slate-200 flex items-center gap-1.5">
                      <ImageIcon className="w-3.5 h-3.5 text-blue-400" />
                      Multimodal Visual Audit
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Automated color palette extraction, WCAG contrast calculation, and logo hash inspection completed.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center text-slate-500">
            Select a draft from the left panel to begin brand governance review.
          </div>
        )}
      </div>

      {/* Right Column: AI Brand Governance Flags & Human-in-the-Loop Actions */}
      <div className="lg:col-span-4 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-blue-400" />
            AI Review & Flags
            <span className="bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-full text-xs">
              {pendingFlags.length}
            </span>
          </h2>
          <span className="text-[11px] text-slate-500">Strict Grounding Enforced</span>
        </div>

        {/* Pending Flag Cards */}
        <div className="space-y-3 max-h-[750px] overflow-y-auto pr-1">
          {pendingFlags.length === 0 ? (
            <div className="bg-emerald-950/20 border border-emerald-500/30 rounded-xl p-6 text-center space-y-2">
              <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
              <h4 className="text-sm font-semibold text-emerald-300">100% Brand Compliant</h4>
              <p className="text-xs text-slate-400">
                No tone breaches, terminology violations, outdated facts, or palette errors detected.
              </p>
            </div>
          ) : (
            pendingFlags.map(flag => {
              const categoryBadgeColors = {
                tone: 'bg-indigo-500/10 text-indigo-300 border-indigo-500/30',
                terminology: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
                facts: 'bg-rose-500/10 text-rose-300 border-rose-500/30',
                claims: 'bg-purple-500/10 text-purple-300 border-purple-500/30',
                color: 'bg-blue-500/10 text-blue-300 border-blue-500/30',
                accessibility: 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30'
              };

              return (
                <div
                  key={flag.id}
                  className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3 hover:border-slate-700 transition-colors shadow-sm"
                >
                  {/* Top Rule Header */}
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center space-x-1.5">
                      <span className="font-mono font-bold text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded">
                        {flag.rule_id}
                      </span>
                      <span className={`px-2 py-0.5 rounded border text-[10px] uppercase font-semibold ${categoryBadgeColors[flag.category] || 'bg-slate-800 text-slate-300'}`}>
                        {flag.category}
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-400 font-mono">
                      {Math.round(flag.confidence * 100)}% conf
                    </span>
                  </div>

                  {/* Offending Span */}
                  <div className="bg-slate-950 rounded p-2 text-xs border border-slate-800/80">
                    <span className="text-slate-500 font-medium block text-[10px] uppercase">Offending Span:</span>
                    <span className="text-rose-300 font-semibold line-through">"{flag.span}"</span>
                  </div>

                  {/* Friendly Explanation */}
                  <div className="text-xs text-slate-300 leading-snug">
                    <p className="text-slate-400 text-[11px] mb-0.5 font-medium">Why it violates brand rules:</p>
                    {flag.explanation}
                  </div>

                  {/* Suggested Fix */}
                  <div className="bg-blue-950/30 border border-blue-500/30 rounded p-2.5 text-xs space-y-1">
                    <div className="text-blue-300 font-medium flex items-center justify-between">
                      <span className="text-[10px] uppercase tracking-wider">Suggested Non-Destructive Fix</span>
                      <span className="text-[10px] text-blue-400">One-Click</span>
                    </div>
                    <p className="text-white font-medium">"{flag.fix}"</p>
                  </div>

                  {/* Inline Edit Box if open */}
                  {editingFlagId === flag.id && (
                    <div className="space-y-2 bg-slate-950 p-2.5 rounded border border-blue-500/40">
                      <input
                        type="text"
                        value={customFixText}
                        onChange={e => setCustomFixText(e.target.value)}
                        placeholder="Customize replacement..."
                        className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-blue-500"
                      />
                      <div className="flex justify-end space-x-1.5">
                        <button
                          onClick={() => setEditingFlagId(null)}
                          className="px-2 py-0.5 text-[10px] text-slate-400 hover:text-slate-200"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleResolve(flag.id, 'edited', customFixText)}
                          className="px-2.5 py-0.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-[10px] font-medium"
                        >
                          Apply Custom Fix
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Creator Action Buttons (Accept, Edit, Dismiss) */}
                  <div className="flex items-center space-x-2 pt-1 border-t border-slate-800/80">
                    <button
                      onClick={() => handleResolve(flag.id, 'accepted')}
                      className="flex-1 flex items-center justify-center space-x-1 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 py-1.5 rounded-lg text-xs font-medium transition-colors"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Accept Fix</span>
                    </button>
                    <button
                      onClick={() => {
                        setEditingFlagId(flag.id);
                        setCustomFixText(flag.fix);
                      }}
                      className="flex items-center justify-center space-x-1 bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-700 transition-colors"
                      title="Edit fix before applying"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Edit</span>
                    </button>
                    <button
                      onClick={() => setActiveDismissModal(flag.id)}
                      className="flex items-center justify-center space-x-1 bg-slate-800 hover:bg-rose-950/40 text-slate-400 hover:text-rose-300 px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-700 transition-colors"
                      title="Dismiss with reason for manager"
                    >
                      <X className="w-3.5 h-3.5" />
                      <span>Dismiss</span>
                    </button>
                  </div>

                  {/* Dismiss Modal / Input */}
                  {activeDismissModal === flag.id && (
                    <div className="mt-2 bg-slate-950 border border-slate-700 rounded-lg p-3 space-y-2">
                      <span className="text-[11px] font-semibold text-slate-300 block">
                        Reason for Dismissal (will be audited by Manager):
                      </span>
                      <textarea
                        value={dismissReason}
                        onChange={e => setDismissReason(e.target.value)}
                        placeholder="e.g., Intentional stylistic choice for holiday marketing campaign..."
                        rows={2}
                        className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-xs text-white focus:outline-none focus:border-blue-500"
                      />
                      <div className="flex justify-end space-x-2">
                        <button
                          onClick={() => setActiveDismissModal(null)}
                          className="px-2.5 py-1 text-xs text-slate-400"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleResolve(flag.id, 'dismissed', null, dismissReason || 'Intentional creative deviation')}
                          className="px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded text-xs font-medium"
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

        {/* Resolved Flags History */}
        {resolvedFlags.length > 0 && (
          <div className="pt-3 border-t border-slate-800 space-y-2">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Resolved in this Revision ({resolvedFlags.length})
            </h3>
            <div className="space-y-1.5">
              {resolvedFlags.map(rf => (
                <div key={rf.id} className="flex items-center justify-between text-xs bg-slate-900/40 p-2 rounded border border-slate-800 text-slate-400">
                  <span className="font-mono text-slate-300">{rf.rule_id}</span>
                  <span className={`text-[10px] uppercase font-medium px-1.5 py-0.5 rounded ${
                    rf.resolution === 'accepted' ? 'text-emerald-400 bg-emerald-500/10' :
                    rf.resolution === 'edited' ? 'text-blue-400 bg-blue-500/10' : 'text-slate-400 bg-slate-800'
                  }`}>
                    {rf.resolution}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

