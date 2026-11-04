import React, { useState, useEffect } from 'react';
import { api } from '../api';
import {
  Brain, Plus, Trash2, Upload, BookOpen, Check, FileText,
  Palette, Database, ShieldAlert, Sparkles, AlertCircle
} from 'lucide-react';

export default function SourceOfTruth({ currentUser }) {
  const [activeSubTab, setActiveSubTab] = useState('rules'); // rules, terminology, facts, colors, ingest
  const [rules, setRules] = useState([]);
  const [terminology, setTerminology] = useState([]);
  const [facts, setFacts] = useState([]);
  const [colors, setColors] = useState([]);
  const [loading, setLoading] = useState(false);

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

  // New Term Form
  const [showAddTerm, setShowAddTerm] = useState(false);
  const [newBanned, setNewBanned] = useState('');
  const [newPreferred, setNewPreferred] = useState('');
  const [newContext, setNewContext] = useState('');

  useEffect(() => {
    loadAllData();
  }, []);

  async function loadAllData() {
    setLoading(true);
    try {
      const [rData, tData, fData, cData] = await Promise.all([
        api.getRules(),
        api.getTerminology(),
        api.getFacts(),
        api.getColors()
      ]);
      setRules(rData);
      setTerminology(tData);
      setFacts(fData);
      setColors(cData);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

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

  async function handleAddTerm(e) {
    e.preventDefault();
    try {
      await api.createTerminology({
        banned_term: newBanned,
        preferred_term: newPreferred,
        context: newContext,
        severity: 'warning'
      });
      setShowAddTerm(false);
      setNewBanned('');
      setNewPreferred('');
      setNewContext('');
      await loadAllData();
    } catch (e) {
      console.error(e);
    }
  }

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
                  <span className="text-[10px] text-amber-400 uppercase font-mono">{t.severity}</span>
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
          <p className="text-xs text-slate-400">
            Approved Fact Sheet v3: Grounded factual benchmarks that prevent outdated metrics or misleading statistics.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {facts.map(f => (
              <div key={f.id} className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-blue-400 font-bold uppercase">{f.fact_key}</span>
                  <span className="text-[10px] text-slate-500 font-mono">Updated: {f.last_updated}</span>
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
          <p className="text-xs text-slate-400">
            Brand Color Specification & WCAG AA Contrast Ratios.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {colors.map(c => (
              <div key={c.id} className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden p-3 space-y-2 text-xs">
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
                <div className="font-mono text-xs text-blue-400 font-bold">{c.hex_code}</div>
                <div className="text-[11px] text-slate-500">Min Contrast: {c.min_contrast}:1</div>
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

