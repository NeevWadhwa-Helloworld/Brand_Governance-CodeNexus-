import React, { useState, useEffect } from 'react';
import { api } from '../api';
import {
  Brain, Plus, Trash2, Upload, BookOpen, Check, FileText,
  Palette, Database, ShieldAlert, Sparkles, AlertCircle, Edit3, X, Image as ImageIcon
} from 'lucide-react';

export default function SourceOfTruth({ currentUser }) {
  const [activeSubTab, setActiveSubTab] = useState('rules'); // rules, terminology, facts, colors, logos, ingest
  const [rules, setRules] = useState([]);
  const [terminology, setTerminology] = useState([]);
  const [facts, setFacts] = useState([]);
  const [colors, setColors] = useState([]);
  const [logos, setLogos] = useState([]);
  const [loading, setLoading] = useState(false);

  // Logos Form
  const [showAddLogo, setShowAddLogo] = useState(false);
  const [newLogoName, setNewLogoName] = useState('');
  const [newLogoFile, setNewLogoFile] = useState(null);
  const [newLogoClearance, setNewLogoClearance] = useState(15.0);

  // New Rule Form
  const [showAddRule, setShowAddRule] = useState(false);
  const [newRuleId, setNewRuleId] = useState('');
  const [newCategory, setNewCategory] = useState('tone');
  const [newTitle, setNewTitle] = useState('');
  const [newText, setNewText] = useState('');
  const [newDetails, setNewDetails] = useState('');

  // Ingest Guidelines Form
  const [ingestTitle, setIngestTitle] = useState('');
  const [ingestVersion, setIngestVersion] = useState('v3.3');
  const [ingestText, setIngestText] = useState('');
  const [ingestResult, setIngestResult] = useState(null);

  // Term Form
  const [showAddTerm, setShowAddTerm] = useState(false);
  const [newBanned, setNewBanned] = useState('');
  const [newPreferred, setNewPreferred] = useState('');
  const [newContext, setNewContext] = useState('');

  // Facts Form
  const [showAddFact, setShowAddFact] = useState(false);
  const [newFactKey, setNewFactKey] = useState('');
  const [newFactClaim, setNewFactClaim] = useState('');
  const [newFactMetric, setNewFactMetric] = useState('');
  const [newFactCitation, setNewFactCitation] = useState('');
  const [editingFactId, setEditingFactId] = useState(null);
  const [editFactMetric, setEditFactMetric] = useState('');
  const [editFactClaim, setEditFactClaim] = useState('');
  const [editFactCitation, setEditFactCitation] = useState('');

  // Colors Form
  const [showAddColor, setShowAddColor] = useState(false);
  const [newColorName, setNewColorName] = useState('');
  const [newColorHex, setNewColorHex] = useState('#2563EB');
  const [newColorRole, setNewColorRole] = useState('primary');
  const [newColorContrast, setNewColorContrast] = useState(4.5);

  useEffect(() => {
    loadAllData();
  }, []);

  async function loadAllData() {
    setLoading(true);
    try {
      const [rData, tData, fData, cData, lData] = await Promise.all([
        api.getRules(),
        api.getTerminology(),
        api.getFacts(),
        api.getColors(),
        api.getLogos()
      ]);
      setRules(rData);
      setTerminology(tData);
      setFacts(fData);
      setColors(cData);
      setLogos(lData || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  // --- Logo Handlers ---
  async function handleAddLogo(e) {
    e.preventDefault();
    if (!newLogoFile) return;
    try {
      const formData = new FormData();
      formData.append('name', newLogoName);
      formData.append('file', newLogoFile);
      formData.append('min_clearance_pct', parseFloat(newLogoClearance) || 10.0);
      await api.uploadLogo(formData, currentUser.id);
      setShowAddLogo(false);
      setNewLogoName('');
      setNewLogoFile(null);
      setNewLogoClearance(15.0);
      await loadAllData();
    } catch (e) {
      console.error(e);
    }
  }

  async function handleDeleteLogo(logoId) {
    if (!confirm("Are you sure you want to remove this official brand logo?")) return;
    try {
      await api.deleteLogo(logoId, currentUser.id);
      await loadAllData();
    } catch (e) {
      console.error(e);
    }
  }

  // --- Rule Handlers ---
  async function handleAddRule(e) {
    e.preventDefault();
    try {
      await api.createRule({
        rule_id: newRuleId,
        category: newCategory,
        title: newTitle,
        text: newText,
        details: newDetails
      }, currentUser.id);
      setShowAddRule(false);
      setNewRuleId('');
      setNewTitle('');
      setNewText('');
      setNewDetails('');
      await loadAllData();
    } catch (e) {
      console.error(e);
    }
  }

  async function handleDeleteRule(ruleId) {
    if (!confirm(`Are you sure you want to delete rule ${ruleId}?`)) return;
    try {
      await api.deleteRule(ruleId, currentUser.id);
      await loadAllData();
    } catch (e) {
      console.error(e);
    }
  }

  // --- Terminology Handlers ---
  async function handleAddTerm(e) {
    e.preventDefault();
    try {
      await api.createTerminology({
        banned_term: newBanned,
        preferred_term: newPreferred,
        context: newContext,
        severity: 'warning'
      }, currentUser.id);
      setShowAddTerm(false);
      setNewBanned('');
      setNewPreferred('');
      setNewContext('');
      await loadAllData();
    } catch (e) {
      console.error(e);
    }
  }

  async function handleDeleteTerm(termId) {
    if (!confirm("Are you sure you want to remove this banned term?")) return;
    try {
      await api.deleteTerminology(termId, currentUser.id);
      await loadAllData();
    } catch (e) {
      console.error(e);
    }
  }

  // --- Facts Handlers ---
  async function handleAddFact(e) {
    e.preventDefault();
    try {
      await api.createFact({
        fact_key: newFactKey,
        claim_text: newFactClaim,
        approved_metric: newFactMetric,
        citation: newFactCitation
      }, currentUser.id);
      setShowAddFact(false);
      setNewFactKey('');
      setNewFactClaim('');
      setNewFactMetric('');
      setNewFactCitation('');
      await loadAllData();
    } catch (e) {
      console.error(e);
    }
  }

  async function handleUpdateFact(e) {
    e.preventDefault();
    try {
      await api.updateFact(editingFactId, {
        claim_text: editFactClaim,
        approved_metric: editFactMetric,
        citation: editFactCitation
      }, currentUser.id);
      setEditingFactId(null);
      await loadAllData();
    } catch (e) {
      console.error(e);
    }
  }

  async function handleDeleteFact(factId) {
    if (!confirm("Are you sure you want to delete this approved fact?")) return;
    try {
      await api.deleteFact(factId, currentUser.id);
      await loadAllData();
    } catch (e) {
      console.error(e);
    }
  }

  // --- Color Handlers ---
  async function handleAddColor(e) {
    e.preventDefault();
    try {
      await api.createColor({
        name: newColorName,
        hex_code: newColorHex,
        role: newColorRole,
        min_contrast: parseFloat(newColorContrast) || 4.5
      }, currentUser.id);
      setShowAddColor(false);
      setNewColorName('');
      setNewColorHex('#2563EB');
      setNewColorRole('primary');
      setNewColorContrast(4.5);
      await loadAllData();
    } catch (e) {
      console.error(e);
    }
  }

  async function handleDeleteColor(colorId) {
    if (!confirm("Are you sure you want to delete this brand color?")) return;
    try {
      await api.deleteColor(colorId, currentUser.id);
      await loadAllData();
    } catch (e) {
      console.error(e);
    }
  }

  // --- Ingest Handlers ---
  async function handleIngest(e) {
    e.preventDefault();
    try {
      const res = await api.ingestGuidelines({
        title: ingestTitle || 'Brand Guidelines Revision',
        version: ingestVersion,
        content: ingestText
      }, currentUser.id);
      setIngestResult(res);
      await loadAllData();
    } catch (e) {
      console.error(e);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header & Sub-Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Brain className="w-5 h-5 text-blue-400" />
            Source of Truth Knowledge Base
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Versioned brand memory, rule numbering, terminology dictionaries, and approved facts.
          </p>
        </div>

        {/* Sub-Tabs */}
        <div className="flex space-x-1 bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs">
          {[
            { id: 'rules', label: `Numbered Rules (${rules.length})`, icon: FileText },
            { id: 'terminology', label: `Terminology (${terminology.length})`, icon: BookOpen },
            { id: 'facts', label: `Approved Facts (${facts.length})`, icon: Database },
            { id: 'colors', label: `Color Palette (${colors.length})`, icon: Palette },
            { id: 'logos', label: `Brand Logos (${logos.length})`, icon: ImageIcon },
            { id: 'ingest', label: 'Ingest Guideline Doc', icon: Upload }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id)}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors flex items-center space-x-1.5 ${
                activeSubTab === tab.id
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Tab 1: Numbered Rules Table */}
      {activeSubTab === 'rules' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">
              Every AI flag is strictly grounded and mapped to one of these numbered rules.
            </span>
            <button
              onClick={() => setShowAddRule(!showAddRule)}
              className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Custom Rule</span>
            </button>
          </div>

          {/* Add Rule Form */}
          {showAddRule && (
            <form onSubmit={handleAddRule} className="bg-slate-900 border border-blue-500/40 rounded-xl p-4 space-y-3 shadow-lg">
              <h4 className="text-xs font-bold text-blue-400 uppercase">Create Numbered Brand Rule</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                <div>
                  <label className="block text-slate-400 mb-1">Rule ID (e.g. VOICE-05, CLAIM-03)</label>
                  <input
                    type="text"
                    required
                    value={newRuleId}
                    onChange={e => setNewRuleId(e.target.value)}
                    placeholder="VOICE-05"
                    className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Category</label>
                  <select
                    value={newCategory}
                    onChange={e => setNewCategory(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white"
                  >
                    <option value="tone">Tone & Voice</option>
                    <option value="terminology">Terminology</option>
                    <option value="facts">Facts & Data</option>
                    <option value="claims">Claims & Compliance</option>
                    <option value="color">Colors</option>
                    <option value="logo">Logos</option>
                    <option value="accessibility">Accessibility</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Rule Title</label>
                  <input
                    type="text"
                    required
                    value={newTitle}
                    onChange={e => setNewTitle(e.target.value)}
                    placeholder="e.g. Inclusive Language"
                    className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white"
                  />
                </div>
              </div>
              <div className="text-xs space-y-2">
                <div>
                  <label className="block text-slate-400 mb-1">Rule Standard / Instruction</label>
                  <textarea
                    required
                    value={newText}
                    onChange={e => setNewText(e.target.value)}
                    placeholder="Describe what is required or forbidden..."
                    rows={2}
                    className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Specific Details & Non-Destructive Examples</label>
                  <input
                    type="text"
                    value={newDetails}
                    onChange={e => setNewDetails(e.target.value)}
                    placeholder="e.g. Prefer 'they' over gendered pronouns..."
                    className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white"
                  />
                </div>
              </div>
              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddRule(false)}
                  className="px-3 py-1 text-xs text-slate-400"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-1.5 rounded text-xs font-semibold"
                >
                  Save Brand Rule
                </button>
              </div>
            </form>
          )}

          {/* Rules Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="p-3">Rule ID</th>
                    <th className="p-3">Category</th>
                    <th className="p-3">Title & Directive</th>
                    <th className="p-3">Guideline Standard</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-slate-300">
                  {rules.map(r => (
                    <tr key={r.id} className="hover:bg-slate-850/50 transition-colors">
                      <td className="p-3 font-mono font-bold text-blue-400">
                        {r.rule_id}
                      </td>
                      <td className="p-3">
                        <span className="uppercase text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                          {r.category}
                        </span>
                      </td>
                      <td className="p-3 font-semibold text-slate-200">
                        {r.title}
                        {r.details && (
                          <div className="text-[11px] font-normal text-slate-400 mt-0.5">
                            {r.details}
                          </div>
                        )}
                      </td>
                      <td className="p-3 text-slate-300 max-w-md">
                        {r.text}
                      </td>
                      <td className="p-3 text-right">
                        <button
                          onClick={() => handleDeleteRule(r.rule_id)}
                          className="text-slate-500 hover:text-rose-400 transition-colors p-1"
                          title="Delete Rule"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Terminology Dictionary */}
      {activeSubTab === 'terminology' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">
              Layer 1 Deterministic Dictionary: Instant exact-match replacement suggestions with zero AI cost.
            </span>
            <button
              onClick={() => setShowAddTerm(!showAddTerm)}
              className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Banned Term</span>
            </button>
          </div>

          {showAddTerm && (
            <form onSubmit={handleAddTerm} className="bg-slate-900 border border-blue-500/40 rounded-xl p-4 space-y-3 text-xs">
              <h4 className="font-bold text-blue-400 uppercase">Add Terminology Mapping</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Banned Term / Phrase</label>
                  <input
                    type="text"
                    required
                    value={newBanned}
                    onChange={e => setNewBanned(e.target.value)}
                    placeholder="e.g. cheap"
                    className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Preferred Alternative</label>
                  <input
                    type="text"
                    required
                    value={newPreferred}
                    onChange={e => setNewPreferred(e.target.value)}
                    placeholder="e.g. cost-effective"
                    className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white"
                  />
                </div>
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Brand Context / Why</label>
                <input
                  type="text"
                  value={newContext}
                  onChange={e => setNewContext(e.target.value)}
                  placeholder="e.g. The word 'cheap' degrades enterprise perception."
                  className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white"
                />
              </div>
              <div className="flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowAddTerm(false)}
                  className="px-3 py-1 text-slate-400"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-1.5 rounded font-semibold"
                >
                  Add to Dictionary
                </button>
              </div>
            </form>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {terminology.map(t => (
              <div key={t.id} className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="bg-rose-500/10 text-rose-300 border border-rose-500/30 px-2 py-0.5 rounded font-semibold line-through">
                      "{t.banned_term}"
                    </span>
                    <span className="text-slate-500">➔</span>
                    <span className="bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded font-bold">
                      "{t.preferred_term}"
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-[10px] text-amber-400 uppercase font-mono">{t.severity}</span>
                    <button
                      onClick={() => handleDeleteTerm(t.id)}
                      className="text-slate-500 hover:text-rose-400 transition-colors"
                      title="Delete entry"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <p className="text-[11px] text-slate-400">{t.context}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 3: Approved Facts */}
      {activeSubTab === 'facts' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">
              Approved Fact Sheet v3: Grounded factual benchmarks that prevent outdated metrics or misleading statistics.
            </span>
            <button
              onClick={() => setShowAddFact(!showAddFact)}
              className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Approved Fact</span>
            </button>
          </div>

          {/* Add Fact Form */}
          {showAddFact && (
            <form onSubmit={handleAddFact} className="bg-slate-900 border border-blue-500/40 rounded-xl p-4 space-y-3 text-xs">
              <h4 className="font-bold text-blue-400 uppercase">Create Approved Fact Benchmark</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Fact Key (Unique ID, e.g. active_users, sla_uptime)</label>
                  <input
                    type="text"
                    required
                    value={newFactKey}
                    onChange={e => setNewFactKey(e.target.value)}
                    placeholder="active_users"
                    className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Approved Metric Value (e.g. 50,000+ active users)</label>
                  <input
                    type="text"
                    required
                    value={newFactMetric}
                    onChange={e => setNewFactMetric(e.target.value)}
                    placeholder="50,000+ active users"
                    className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white font-bold"
                  />
                </div>
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Claim Scope / Description</label>
                <input
                  type="text"
                  required
                  value={newFactClaim}
                  onChange={e => setNewFactClaim(e.target.value)}
                  placeholder="Over 50,000+ active users worldwide"
                  className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Official Source / Citation</label>
                <input
                  type="text"
                  required
                  value={newFactCitation}
                  onChange={e => setNewFactCitation(e.target.value)}
                  placeholder="Approved Fact Sheet v3 (Oct 2026)"
                  className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white"
                />
              </div>
              <div className="flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowAddFact(false)}
                  className="px-3 py-1 text-slate-400"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-1.5 rounded font-semibold"
                >
                  Save Fact
                </button>
              </div>
            </form>
          )}

          {/* Edit Fact Form Modal */}
          {editingFactId && (
            <form onSubmit={handleUpdateFact} className="bg-slate-900 border border-amber-500/40 rounded-xl p-4 space-y-3 text-xs shadow-xl">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-amber-400 uppercase">Update Approved Fact</h4>
                <button type="button" onClick={() => setEditingFactId(null)} className="text-slate-400 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Approved Metric</label>
                  <input
                    type="text"
                    required
                    value={editFactMetric}
                    onChange={e => setEditFactMetric(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white font-bold"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Citation Source</label>
                  <input
                    type="text"
                    required
                    value={editFactCitation}
                    onChange={e => setEditFactCitation(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white"
                  />
                </div>
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Claim Text</label>
                <input
                  type="text"
                  required
                  value={editFactClaim}
                  onChange={e => setEditFactClaim(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white"
                />
              </div>
              <div className="flex justify-end space-x-2">
                <button type="button" onClick={() => setEditingFactId(null)} className="px-3 py-1 text-slate-400">
                  Cancel
                </button>
                <button type="submit" className="bg-amber-600 hover:bg-amber-500 text-white px-4 py-1.5 rounded font-semibold">
                  Update Fact
                </button>
              </div>
            </form>
          )}

          {/* Fact Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {facts.map(f => (
              <div key={f.id} className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-blue-400 font-bold uppercase">{f.fact_key}</span>
                  <div className="flex items-center space-x-2">
                    <span className="text-[10px] text-slate-500 font-mono">Updated: {f.last_updated}</span>
                    <button
                      onClick={() => {
                        setEditingFactId(f.id);
                        setEditFactMetric(f.approved_metric);
                        setEditFactClaim(f.claim_text);
                        setEditFactCitation(f.citation);
                      }}
                      className="text-slate-400 hover:text-amber-400 p-0.5"
                      title="Edit fact"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteFact(f.id)}
                      className="text-slate-500 hover:text-rose-400 p-0.5"
                      title="Delete fact"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <div className="text-sm font-bold text-white">{f.approved_metric}</div>
                <p className="text-slate-300 text-[11px]">{f.claim_text}</p>
                <div className="text-[10px] text-emerald-400 font-medium">Source: {f.citation}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 4: Color Palette */}
      {activeSubTab === 'colors' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">
              Brand Color Specification & WCAG AA Contrast Ratios.
            </span>
            <button
              onClick={() => setShowAddColor(!showAddColor)}
              className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Brand Color</span>
            </button>
          </div>

          {/* Add Color Form */}
          {showAddColor && (
            <form onSubmit={handleAddColor} className="bg-slate-900 border border-blue-500/40 rounded-xl p-4 space-y-3 text-xs">
              <h4 className="font-bold text-blue-400 uppercase">Register Brand Color Swatch</h4>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Color Name</label>
                  <input
                    type="text"
                    required
                    value={newColorName}
                    onChange={e => setNewColorName(e.target.value)}
                    placeholder="Electric Blue"
                    className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Hex Code</label>
                  <div className="flex items-center space-x-1.5">
                    <input
                      type="color"
                      value={newColorHex}
                      onChange={e => setNewColorHex(e.target.value.toUpperCase())}
                      className="w-8 h-8 rounded border border-slate-700 bg-transparent cursor-pointer"
                    />
                    <input
                      type="text"
                      required
                      value={newColorHex}
                      onChange={e => setNewColorHex(e.target.value.toUpperCase())}
                      placeholder="#2563EB"
                      className="flex-1 bg-slate-950 border border-slate-700 rounded p-2 text-white font-mono"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Palette Role</label>
                  <select
                    value={newColorRole}
                    onChange={e => setNewColorRole(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white"
                  >
                    <option value="primary">Primary</option>
                    <option value="secondary">Secondary</option>
                    <option value="accent">Accent</option>
                    <option value="neutral">Neutral</option>
                    <option value="background">Background</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Min Contrast Ratio</label>
                  <input
                    type="number"
                    step="0.1"
                    min="1.0"
                    max="21.0"
                    required
                    value={newColorContrast}
                    onChange={e => setNewColorContrast(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white"
                  />
                </div>
              </div>
              <div className="flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowAddColor(false)}
                  className="px-3 py-1 text-slate-400"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-1.5 rounded font-semibold"
                >
                  Add Color
                </button>
              </div>
            </form>
          )}

          {/* Color Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {colors.map(c => (
              <div key={c.id} className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden p-3 space-y-2 text-xs relative group">
                <div
                  className="w-full h-16 rounded-lg border border-slate-700/50 shadow-inner"
                  style={{ backgroundColor: c.hex_code }}
                />
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-200">{c.name}</span>
                  <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                    {c.role}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="font-mono text-xs text-blue-400 font-bold">{c.hex_code}</div>
                  <button
                    onClick={() => handleDeleteColor(c.id)}
                    className="text-slate-500 hover:text-rose-400 p-0.5 opacity-60 group-hover:opacity-100 transition-opacity"
                    title="Delete color"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="text-[11px] text-slate-500">Min Contrast: {c.min_contrast}:1</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab: Brand Logos */}
      {activeSubTab === 'logos' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">
              Official Vector Marks & Assets: Verified against file hashes and safe clearance margins (LOGO-01).
            </span>
            <button
              onClick={() => setShowAddLogo(!showAddLogo)}
              className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Upload Official Logo</span>
            </button>
          </div>

          {/* Add Logo Form */}
          {showAddLogo && (
            <form onSubmit={handleAddLogo} className="bg-slate-900 border border-blue-500/40 rounded-xl p-4 space-y-3 text-xs">
              <h4 className="font-bold text-blue-400 uppercase">Register Official Brand Logo Asset</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Logo Name / Variant</label>
                  <input
                    type="text"
                    required
                    value={newLogoName}
                    onChange={e => setNewLogoName(e.target.value)}
                    placeholder="Inkloom Primary Dark SVG"
                    className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Logo File (SVG / PNG)</label>
                  <input
                    type="file"
                    accept=".svg,.png,.jpg,.jpeg,.webp"
                    required
                    onChange={e => setNewLogoFile(e.target.files[0])}
                    className="w-full text-xs text-slate-400 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:bg-blue-600 file:text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Min Clearance (%)</label>
                  <input
                    type="number"
                    step="1"
                    min="5"
                    max="50"
                    required
                    value={newLogoClearance}
                    onChange={e => setNewLogoClearance(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white"
                  />
                </div>
              </div>
              <div className="flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowAddLogo(false)}
                  className="px-3 py-1 text-slate-400"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-1.5 rounded font-semibold"
                >
                  Upload & Register Hash
                </button>
              </div>
            </form>
          )}

          {/* Logo Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {logos.map(l => (
              <div key={l.id} className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3 text-xs relative group">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-200">{l.name}</span>
                  <button
                    onClick={() => handleDeleteLogo(l.id)}
                    className="text-slate-500 hover:text-rose-400 p-0.5 opacity-60 group-hover:opacity-100 transition-opacity"
                    title="Delete logo"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="w-full h-24 bg-slate-950 rounded-lg border border-slate-800/80 flex items-center justify-center p-2 overflow-hidden">
                  <img
                    src={l.file_path}
                    alt={l.name}
                    className="max-h-full max-w-full object-contain"
                    onError={e => {
                      e.target.onerror = null;
                      e.target.src = '/favicon.svg';
                    }}
                  />
                </div>
                <div className="space-y-1 text-[11px] text-slate-400">
                  <div className="flex justify-between">
                    <span>Safe Clearance:</span>
                    <span className="font-medium text-slate-300">{l.min_clearance_pct}% buffer</span>
                  </div>
                  <div className="truncate font-mono text-[10px] text-slate-500" title={l.file_hash}>
                    SHA-256: {l.file_hash.substring(0, 20)}...
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 5: Ingest Guideline Doc */}
      {activeSubTab === 'ingest' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 max-w-3xl">
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Ingest & Split Brand Guidelines
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Upload raw brand markdown or policy documents. The platform's parser automatically numbers
              rules (VOICE-01, FACT-01, etc.) and updates the active Source of Truth.
            </p>
          </div>

          <form onSubmit={handleIngest} className="space-y-3 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-400 mb-1">Guideline Title</label>
                <input
                  type="text"
                  required
                  value={ingestTitle}
                  onChange={e => setIngestTitle(e.target.value)}
                  placeholder="e.g. Inkloom Q4 Global Voice & Visual Standard"
                  className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Version Identifier</label>
                <input
                  type="text"
                  required
                  value={ingestVersion}
                  onChange={e => setIngestVersion(e.target.value)}
                  placeholder="v3.3"
                  className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-400 mb-1">Guideline Text / Markdown</label>
              <textarea
                required
                rows={7}
                value={ingestText}
                onChange={e => setIngestText(e.target.value)}
                placeholder="# VOICE-05: Customer Centricity&#10;Always prioritize client outcomes over internal milestones.&#10;&#10;# CLAIM-03: Security Guarantees&#10;Reference SOC 2 Type II compliance when mentioning data privacy."
                className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white font-mono"
              />
            </div>

            <button
              type="submit"
              className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg font-bold transition-colors"
            >
              Parse, Number & Ingest Guideline Rules
            </button>
          </form>

          {ingestResult && (
            <div className="bg-emerald-950/20 border border-emerald-500/30 rounded-lg p-3 text-xs text-emerald-300 space-y-1">
              <div className="font-bold">Successfully Ingested {ingestResult.version}!</div>
              <p className="text-[11px] text-slate-400">
                Extracted and indexed {ingestResult.rules_count} numbered brand rule(s) into the RAG knowledge base.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
