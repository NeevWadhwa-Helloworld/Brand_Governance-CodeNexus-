import React, { useState, useEffect } from 'react';
import { api, mediaUrl } from '../api';
import {
  Brain, Plus, Trash2, Upload, BookOpen, FileText,
  Palette, Database, Edit3, X, Image as ImageIcon, Search,
  ShieldCheck, CheckCircle2, ArrowRight, LayoutGrid, List,
  Loader2
} from 'lucide-react';

export default function SourceOfTruth({ currentUser }) {
  const [activeSubTab, setActiveSubTab] = useState('rules'); // rules, terminology, facts, colors, logos, ingest
  const [rules, setRules] = useState([]);
  const [terminology, setTerminology] = useState([]);
  const [facts, setFacts] = useState([]);
  const [colors, setColors] = useState([]);
  const [logos, setLogos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [rulesViewMode, setRulesViewMode] = useState('table'); // table or cards

  // Search & Filter state
  const [ruleSearch, setRuleSearch] = useState('');
  const [ruleCategoryFilter, setRuleCategoryFilter] = useState('all');
  const [termSearch, setTermSearch] = useState('');
  const [factSearch, setFactSearch] = useState('');

  // Delete Confirmation Modal State (Replaces native browser confirm)
  const [deleteConfirm, setDeleteConfirm] = useState(null); // { type, id, name }

  // Logos Form
  const [showAddLogo, setShowAddLogo] = useState(false);
  const [newLogoName, setNewLogoName] = useState('');
  const [newLogoFile, setNewLogoFile] = useState(null);
  const [newLogoClearance, setNewLogoClearance] = useState(15.0);
  const [logoSubmitting, setLogoSubmitting] = useState(false);

  // New Rule Form
  const [showAddRule, setShowAddRule] = useState(false);
  const [newRuleId, setNewRuleId] = useState('');
  const [newCategory, setNewCategory] = useState('tone');
  const [newTitle, setNewTitle] = useState('');
  const [newText, setNewText] = useState('');
  const [newDetails, setNewDetails] = useState('');
  const [ruleSubmitting, setRuleSubmitting] = useState(false);

  // Ingest Guidelines Form
  const [ingestTitle, setIngestTitle] = useState('');
  const [ingestVersion, setIngestVersion] = useState('');
  const [ingestText, setIngestText] = useState('');
  const [ingestResult, setIngestResult] = useState(null);
  const [ingestLoading, setIngestLoading] = useState(false);
  const [ingestPdf, setIngestPdf] = useState(null);
  const [ingestError, setIngestError] = useState('');
  const [ingestConfirmed, setIngestConfirmed] = useState(false);

  // Term Form
  const [showAddTerm, setShowAddTerm] = useState(false);
  const [newBanned, setNewBanned] = useState('');
  const [newPreferred, setNewPreferred] = useState('');
  const [newContext, setNewContext] = useState('');
  const [termSubmitting, setTermSubmitting] = useState(false);

  // Facts Form
  const [showAddFact, setShowAddFact] = useState(false);
  const [newFactKey, setNewFactKey] = useState('');
  const [newFactClaim, setNewFactClaim] = useState('');
  const [newFactMetric, setNewFactMetric] = useState('');
  const [newFactCitation, setNewFactCitation] = useState('');
  const [factSubmitting, setFactSubmitting] = useState(false);
  const [editingFactId, setEditingFactId] = useState(null);
  const [editFactMetric, setEditFactMetric] = useState('');
  const [editFactClaim, setEditFactClaim] = useState('');
  const [editFactCitation, setEditFactCitation] = useState('');
  const [editFactSubmitting, setEditFactSubmitting] = useState(false);

  // Colors Form
  const [showAddColor, setShowAddColor] = useState(false);
  const [newColorName, setNewColorName] = useState('');
  const [newColorHex, setNewColorHex] = useState('#2563EB');
  const [newColorRole, setNewColorRole] = useState('primary');
  const [newColorContrast, setNewColorContrast] = useState(4.5);
  const [colorSubmitting, setColorSubmitting] = useState(false);

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
      setRules(rData || []);
      setTerminology(tData || []);
      setFacts(fData || []);
      setColors(cData || []);
      setLogos(lData || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAllData();
  }, []);

  // --- Deletion Confirmation Executer ---
  async function executeDelete() {
    if (!deleteConfirm) return;
    const { type, id } = deleteConfirm;
    try {
      if (type === 'rule') {
        await api.deleteRule(id, currentUser?.id);
      } else if (type === 'term') {
        await api.deleteTerminology(id, currentUser?.id);
      } else if (type === 'fact') {
        await api.deleteFact(id, currentUser?.id);
      } else if (type === 'color') {
        await api.deleteColor(id, currentUser?.id);
      } else if (type === 'logo') {
        await api.deleteLogo(id, currentUser?.id);
      }
      setDeleteConfirm(null);
      await loadAllData();
    } catch (e) {
      console.error(e);
    }
  }

  // --- Logo Handlers ---
  async function handleAddLogo(e) {
    e.preventDefault();
    if (!newLogoFile) return;
    setLogoSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('name', newLogoName.trim());
      formData.append('file', newLogoFile);
      formData.append('min_clearance_pct', Number(newLogoClearance));
      await api.uploadLogo(formData, currentUser?.id);
      setShowAddLogo(false);
      setNewLogoName('');
      setNewLogoFile(null);
      setNewLogoClearance(15.0);
      await loadAllData();
    } catch (e) {
      console.error(e);
    } finally {
      setLogoSubmitting(false);
    }
  }

  // --- Rule Handlers ---
  async function handleAddRule(e) {
    e.preventDefault();
    setRuleSubmitting(true);
    try {
      await api.createRule({
        rule_id: newRuleId.trim().toUpperCase(),
        category: newCategory,
        title: newTitle.trim(),
        text: newText.trim(),
        details: newDetails.trim()
      }, currentUser?.id);
      setShowAddRule(false);
      setNewRuleId('');
      setNewTitle('');
      setNewText('');
      setNewDetails('');
      await loadAllData();
    } catch (e) {
      console.error(e);
    } finally {
      setRuleSubmitting(false);
    }
  }

  // --- Terminology Handlers ---
  async function handleAddTerm(e) {
    e.preventDefault();
    setTermSubmitting(true);
    try {
      await api.createTerminology({
        banned_term: newBanned.trim().toLowerCase(),
        preferred_term: newPreferred.trim(),
        context: newContext.trim(),
        severity: 'warning'
      }, currentUser?.id);
      setShowAddTerm(false);
      setNewBanned('');
      setNewPreferred('');
      setNewContext('');
      await loadAllData();
    } catch (e) {
      console.error(e);
    } finally {
      setTermSubmitting(false);
    }
  }

  // --- Facts Handlers ---
  async function handleAddFact(e) {
    e.preventDefault();
    setFactSubmitting(true);
    try {
      await api.createFact({
        fact_key: newFactKey.trim().toLowerCase(),
        claim_text: newFactClaim.trim(),
        approved_metric: newFactMetric.trim(),
        citation: newFactCitation.trim()
      }, currentUser?.id);
      setShowAddFact(false);
      setNewFactKey('');
      setNewFactClaim('');
      setNewFactMetric('');
      setNewFactCitation('');
      await loadAllData();
    } catch (e) {
      console.error(e);
    } finally {
      setFactSubmitting(false);
    }
  }

  async function handleUpdateFact(e) {
    e.preventDefault();
    setEditFactSubmitting(true);
    try {
      await api.updateFact(editingFactId, {
        claim_text: editFactClaim.trim(),
        approved_metric: editFactMetric.trim(),
        citation: editFactCitation.trim()
      }, currentUser?.id);
      setEditingFactId(null);
      await loadAllData();
    } catch (e) {
      console.error(e);
    } finally {
      setEditFactSubmitting(false);
    }
  }

  // --- Color Handlers ---
  async function handleAddColor(e) {
    e.preventDefault();
    setColorSubmitting(true);
    try {
      await api.createColor({
        name: newColorName.trim(),
        hex_code: newColorHex.toUpperCase(),
        role: newColorRole,
        min_contrast: Number(newColorContrast)
      }, currentUser?.id);
      setShowAddColor(false);
      setNewColorName('');
      setNewColorHex('#2563EB');
      setNewColorRole('primary');
      setNewColorContrast(4.5);
      await loadAllData();
    } catch (e) {
      console.error(e);
    } finally {
      setColorSubmitting(false);
    }
  }

  // --- Ingest Handlers ---
  async function handleIngest(e) {
    e.preventDefault();
    if (!ingestVersion.trim()) return;
    setIngestLoading(true);
    setIngestResult(null);
    setIngestError('');
    setIngestConfirmed(false);
    try {
      let res;
      if (ingestPdf) {
        const formData = new FormData();
        formData.append('title', ingestTitle.trim() || 'Brand Guidelines Revision');
        formData.append('version', ingestVersion.trim());
        formData.append('file', ingestPdf);
        res = await api.ingestGuidelinePdf(formData, currentUser?.id);
      } else {
        res = await api.ingestGuidelines({
          title: ingestTitle.trim() || 'Brand Guidelines Revision',
          version: ingestVersion.trim(),
          content: ingestText
        }, currentUser?.id);
      }
      setIngestResult(res);
    } catch (e) {
      setIngestError(e.message || 'Unable to parse the guideline document.');
    } finally {
      setIngestLoading(false);
    }
  }

  async function handleActivateIngest() {
    if (!ingestResult?.version_id || !ingestConfirmed) return;
    setIngestLoading(true);
    setIngestError('');
    try {
      const activated = await api.activateGuidelineVersion(ingestResult.version_id, currentUser?.id);
      setIngestResult({ ...ingestResult, ...activated, rules: ingestResult.rules });
      setIngestConfirmed(false);
      await loadAllData();
    } catch (e) {
      setIngestError(e.message || 'Unable to activate the guideline version.');
    } finally {
      setIngestLoading(false);
    }
  }

  // Active Guideline Version resolution from available rules
  const activeVersionDisplay = rules.find(rule => rule.guideline_version)?.guideline_version || 'Not available';

  // Category badge colors for rules
  const categoryStyles = {
    tone: 'bg-[#60A5FA]/15 text-[#60A5FA] border-[#60A5FA]/30',
    terminology: 'bg-[#A78BFA]/15 text-[#A78BFA] border-[#A78BFA]/30',
    facts: 'bg-[#34D399]/15 text-[#34D399] border-[#34D399]/30',
    claims: 'bg-[#FBBF24]/15 text-[#FBBF24] border-[#FBBF24]/30',
    color: 'bg-[#F43F5E]/15 text-[#F43F5E] border-[#F43F5E]/30',
    logo: 'bg-[#38BDF8]/15 text-[#38BDF8] border-[#38BDF8]/30',
    accessibility: 'bg-[#2DD4BF]/15 text-[#2DD4BF] border-[#2DD4BF]/30'
  };

  // Filtered Rules
  const filteredRules = rules.filter(r => {
    const matchesCat = ruleCategoryFilter === 'all' || r.category === ruleCategoryFilter;
    const matchesSearch = !ruleSearch.trim() ||
      r.rule_id.toLowerCase().includes(ruleSearch.toLowerCase()) ||
      r.title.toLowerCase().includes(ruleSearch.toLowerCase()) ||
      r.text.toLowerCase().includes(ruleSearch.toLowerCase()) ||
      (r.details && r.details.toLowerCase().includes(ruleSearch.toLowerCase()));
    return matchesCat && matchesSearch;
  });

  // Filtered Terminology
  const filteredTerms = terminology.filter(t => {
    return !termSearch.trim() ||
      t.banned_term.toLowerCase().includes(termSearch.toLowerCase()) ||
      t.preferred_term.toLowerCase().includes(termSearch.toLowerCase()) ||
      (t.context && t.context.toLowerCase().includes(termSearch.toLowerCase()));
  });

  // Filtered Facts
  const filteredFacts = facts.filter(f => {
    return !factSearch.trim() ||
      f.fact_key.toLowerCase().includes(factSearch.toLowerCase()) ||
      f.claim_text.toLowerCase().includes(factSearch.toLowerCase()) ||
      f.approved_metric.toLowerCase().includes(factSearch.toLowerCase()) ||
      (f.citation && f.citation.toLowerCase().includes(factSearch.toLowerCase()));
  });

  return (
    <div className="space-y-6 motion-safe:animate-fade-in">
      {/* Header & Active Version Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#1F2A4A] pb-4">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#36D6A0]/15 border border-[#36D6A0]/30 flex items-center justify-center text-[#36D6A0]">
              <Brain className="w-4 h-4" />
            </div>
            <h2 className="text-base sm:text-lg font-bold text-[#E8ECF8]">
              Source of Truth Knowledge Base
            </h2>
          </div>
          <p className="text-xs text-[#7C88AB] mt-1 ml-10.5">
            Versioned brand guidelines, numbered rule standards, approved facts, and deterministic dictionaries.
          </p>
        </div>

        {/* Active Version & Governance Health Badge */}
        <div className="flex items-center space-x-2.5">
          <div className="bg-[#0E1428] border border-[#1F2A4A] rounded-xl px-3.5 py-1.5 text-xs flex items-center space-x-2">
            <span className="text-[#7C88AB]">Active Guideline:</span>
            <span className="font-mono font-bold text-[#60A5FA]">
              {activeVersionDisplay}
            </span>
            <span className="text-[#1F2A4A]">|</span>
            <span className="text-[#34D399] font-semibold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#34D399]" />
              Enforced
            </span>
          </div>
        </div>
      </div>

      {/* Sub-Tabs Navigation Strip */}
      <div className="flex space-x-1.5 overflow-x-auto no-scrollbar bg-[#0E1428] p-1.5 rounded-2xl border border-[#1F2A4A] text-xs">
        {[
          { id: 'rules', label: `Numbered Rules (${rules.length})`, icon: FileText },
          { id: 'terminology', label: `Terminology (${terminology.length})`, icon: BookOpen },
          { id: 'facts', label: `Approved Facts (${facts.length})`, icon: Database },
          { id: 'colors', label: `Color Palette (${colors.length})`, icon: Palette },
          { id: 'logos', label: `Brand Logos (${logos.length})`, icon: ImageIcon },
          { id: 'ingest', label: 'Ingest Guideline Doc', icon: Upload }
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeSubTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveSubTab(tab.id)}
              className={`px-3 py-1.5 rounded-xl font-semibold transition-all flex items-center space-x-1.5 shrink-0 ${
                isActive
                  ? 'bg-[#172040] border border-[#4F6BED] text-[#E8ECF8] shadow-sm'
                  : 'bg-[#0E1428] border border-transparent text-[#7C88AB] hover:text-[#E8ECF8] hover:bg-[#141C33]'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-[#4F6BED]' : 'text-[#7C88AB]'}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Loading Skeleton */}
      {loading && rules.length === 0 && (
        <div className="p-10 text-center bg-[#111830] border border-[#1F2A4A] rounded-2xl space-y-3 animate-pulse">
          <Brain className="w-8 h-8 text-[#4F6BED] mx-auto opacity-50 animate-bounce" />
          <p className="text-xs text-[#7C88AB]">Synchronizing active Source of Truth from database...</p>
        </div>
      )}

      {/* Tab 1: Numbered Rules Table & Card Explorer */}
      {activeSubTab === 'rules' && (
        <div className="space-y-4">
          {/* Top Bar with Context and Actions */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs text-[#7C88AB]">
              Every scan flag is strictly mapped and grounded to one of these numbered rules.
            </span>
            <div className="flex items-center space-x-2">
              <div className="flex items-center space-x-1 bg-[#0E1428] border border-[#1F2A4A] p-0.5 rounded-xl">
                <button
                  type="button"
                  onClick={() => setRulesViewMode('table')}
                  className={`p-1.5 rounded-lg text-xs transition-colors ${
                    rulesViewMode === 'table' ? 'bg-[#172040] text-[#E8ECF8]' : 'text-[#7C88AB] hover:text-[#E8ECF8]'
                  }`}
                  title="Table view"
                >
                  <List className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setRulesViewMode('cards')}
                  className={`p-1.5 rounded-lg text-xs transition-colors ${
                    rulesViewMode === 'cards' ? 'bg-[#172040] text-[#E8ECF8]' : 'text-[#7C88AB] hover:text-[#E8ECF8]'
                  }`}
                  title="Card grid view"
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                </button>
              </div>

              <button
                type="button"
                onClick={() => setShowAddRule(!showAddRule)}
                className="bg-[#4F6BED] hover:bg-[#6479F2] text-white px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center space-x-1.5 shadow-md shadow-[#4F6BED]/20 transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Custom Rule</span>
              </button>
            </div>
          </div>

          {/* Add Rule Form */}
          {showAddRule && (
            <form onSubmit={handleAddRule} className="bg-[#111830] border border-[#4F6BED]/50 rounded-2xl p-5 space-y-4 shadow-xl motion-safe:animate-fade-in">
              <div className="flex items-center justify-between border-b border-[#1F2A4A] pb-2.5">
                <h4 className="text-xs font-bold text-[#60A5FA] uppercase tracking-wider flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-[#4F6BED]" />
                  Create Numbered Brand Rule
                </h4>
                <button type="button" onClick={() => setShowAddRule(false)} className="text-[#7C88AB] hover:text-[#E8ECF8]">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                <div>
                  <label className="block text-[#7C88AB] mb-1 font-medium">Rule ID (e.g. VOICE-05, CLAIM-03)</label>
                  <input
                    type="text"
                    required
                    value={newRuleId}
                    onChange={e => setNewRuleId(e.target.value)}
                    placeholder="VOICE-05"
                    className="w-full bg-[#0E1428] border border-[#1F2A4A] rounded-xl p-2.5 text-[#E8ECF8] font-mono focus:outline-none focus:border-[#4F6BED]"
                  />
                </div>
                <div>
                  <label className="block text-[#7C88AB] mb-1 font-medium">Category</label>
                  <select
                    value={newCategory}
                    onChange={e => setNewCategory(e.target.value)}
                    className="w-full bg-[#0E1428] border border-[#1F2A4A] rounded-xl p-2.5 text-[#E8ECF8] focus:outline-none focus:border-[#4F6BED]"
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
                  <label className="block text-[#7C88AB] mb-1 font-medium">Rule Title</label>
                  <input
                    type="text"
                    required
                    value={newTitle}
                    onChange={e => setNewTitle(e.target.value)}
                    placeholder="e.g. Inclusive Language"
                    className="w-full bg-[#0E1428] border border-[#1F2A4A] rounded-xl p-2.5 text-[#E8ECF8] focus:outline-none focus:border-[#4F6BED]"
                  />
                </div>
              </div>

              <div className="text-xs space-y-2">
                <div>
                  <label className="block text-[#7C88AB] mb-1 font-medium">Rule Standard / Instruction</label>
                  <textarea
                    required
                    value={newText}
                    onChange={e => setNewText(e.target.value)}
                    placeholder="Describe what is required or forbidden by brand standards..."
                    rows={2}
                    className="w-full bg-[#0E1428] border border-[#1F2A4A] rounded-xl p-2.5 text-[#E8ECF8] focus:outline-none focus:border-[#4F6BED]"
                  />
                </div>
                <div>
                  <label className="block text-[#7C88AB] mb-1 font-medium">Specific Details & Non-Destructive Examples</label>
                  <input
                    type="text"
                    value={newDetails}
                    onChange={e => setNewDetails(e.target.value)}
                    placeholder="e.g. Prefer 'they' over gendered pronouns..."
                    className="w-full bg-[#0E1428] border border-[#1F2A4A] rounded-xl p-2.5 text-[#E8ECF8] focus:outline-none focus:border-[#4F6BED]"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-1 border-t border-[#1F2A4A]">
                <button
                  type="button"
                  onClick={() => setShowAddRule(false)}
                  className="px-3.5 py-1.5 text-xs text-[#7C88AB] hover:text-[#E8ECF8] rounded-xl hover:bg-[#141C33] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={ruleSubmitting}
                  className="bg-[#4F6BED] hover:bg-[#6479F2] text-white px-4 py-1.5 rounded-xl text-xs font-semibold shadow-md shadow-[#4F6BED]/20 transition-all flex items-center gap-1.5"
                >
                  {ruleSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                  <span>{ruleSubmitting ? 'Saving...' : 'Save Brand Rule'}</span>
                </button>
              </div>
            </form>
          )}

          {/* Search & Category Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-[#111830] border border-[#1F2A4A] p-3 rounded-2xl shadow-lg">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-3.5 h-3.5 text-[#7C88AB] absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search rule ID, title, or instruction..."
                value={ruleSearch}
                onChange={e => setRuleSearch(e.target.value)}
                className="w-full bg-[#0E1428] border border-[#1F2A4A] rounded-xl pl-8 pr-3 py-1.5 text-xs text-[#E8ECF8] placeholder-[#7C88AB] focus:outline-none focus:border-[#4F6BED]"
              />
            </div>

            <div className="flex items-center space-x-1 overflow-x-auto no-scrollbar text-xs">
              {['all', 'tone', 'terminology', 'facts', 'claims', 'color', 'logo', 'accessibility'].map(cat => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setRuleCategoryFilter(cat)}
                  className={`px-2.5 py-1 rounded-lg border text-[11px] font-semibold capitalize transition-all ${
                    ruleCategoryFilter === cat
                      ? 'bg-[#172040] border-[#4F6BED] text-[#E8ECF8]'
                      : 'bg-[#0E1428] border-[#1F2A4A] text-[#7C88AB] hover:text-[#E8ECF8]'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Rules Display: Table Mode vs Card Grid Mode */}
          {rulesViewMode === 'table' ? (
            <div className="bg-[#111830] border border-[#1F2A4A] rounded-2xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#0A0F1E] text-[#7C88AB] uppercase text-[10px] tracking-wider border-b border-[#1F2A4A] font-mono">
                    <tr>
                      <th className="p-3.5">Rule ID</th>
                      <th className="p-3.5">Category</th>
                      <th className="p-3.5">Title & Directive</th>
                      <th className="p-3.5">Guideline Standard</th>
                      <th className="p-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1F2A4A]/60 text-[#AAB4D0]">
                    {filteredRules.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-xs text-[#7C88AB] italic">
                          No brand rules match your search or filter.
                        </td>
                      </tr>
                    ) : (
                      filteredRules.map(r => (
                        <tr key={r.id} className="hover:bg-[#141C33] transition-colors">
                          <td className="p-3.5 font-mono font-bold text-[#60A5FA]">
                            {r.rule_id}
                          </td>
                          <td className="p-3.5">
                            <span className={`uppercase text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                              categoryStyles[r.category] || 'bg-[#7C88AB]/15 text-[#AAB4D0] border-[#7C88AB]/30'
                            }`}>
                              {r.category}
                            </span>
                          </td>
                          <td className="p-3.5 font-semibold text-[#E8ECF8]">
                            {r.title}
                            {r.details && (
                              <div className="text-[11px] font-normal text-[#7C88AB] mt-0.5">
                                {r.details}
                              </div>
                            )}
                          </td>
                          <td className="p-3.5 text-[#AAB4D0] max-w-md leading-relaxed">
                            {r.text}
                          </td>
                          <td className="p-3.5 text-right">
                            <button
                              type="button"
                              onClick={() => setDeleteConfirm({ type: 'rule', id: r.rule_id, name: `Rule ${r.rule_id}` })}
                              className="text-[#7C88AB] hover:text-[#F87171] hover:bg-[#F87171]/10 p-1.5 rounded-lg transition-colors"
                              title="Delete Rule"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredRules.length === 0 ? (
                <div className="col-span-2 p-8 text-center bg-[#111830] border border-[#1F2A4A] rounded-2xl text-xs text-[#7C88AB] italic">
                  No brand rules match your search or filter.
                </div>
              ) : (
                filteredRules.map(r => (
                  <div
                    key={r.id}
                    className="bg-[#111830] border border-[#1F2A4A] rounded-2xl p-4 sm:p-5 space-y-3 shadow-xl hover:border-[#2D3A63] transition-colors relative"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className="font-mono text-[#60A5FA] font-bold bg-[#4F6BED]/10 px-2.5 py-0.5 rounded-lg border border-[#4F6BED]/20">
                          {r.rule_id}
                        </span>
                        <span className={`uppercase text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          categoryStyles[r.category] || 'bg-[#7C88AB]/15 text-[#AAB4D0] border-[#7C88AB]/30'
                        }`}>
                          {r.category}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setDeleteConfirm({ type: 'rule', id: r.rule_id, name: `Rule ${r.rule_id}` })}
                        className="text-[#7C88AB] hover:text-[#F87171] hover:bg-[#F87171]/10 p-1.5 rounded-lg transition-colors"
                        title="Delete Rule"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <h4 className="text-xs font-bold text-[#E8ECF8]">{r.title}</h4>
                    <p className="text-xs text-[#AAB4D0] leading-relaxed bg-[#0E1428] border border-[#1F2A4A]/60 p-3 rounded-xl">
                      {r.text}
                    </p>
                    {r.details && (
                      <div className="text-[11px] text-[#7C88AB] italic pt-1">
                        Examples / Context: {r.details}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Terminology Dictionary */}
      {activeSubTab === 'terminology' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs text-[#7C88AB]">
              Layer 1 Deterministic Dictionary: Instant exact-match replacement suggestions with zero AI inference cost.
            </span>
            <button
              type="button"
              onClick={() => setShowAddTerm(!showAddTerm)}
              className="bg-[#4F6BED] hover:bg-[#6479F2] text-white px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center space-x-1.5 shadow-md shadow-[#4F6BED]/20 transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Banned Term</span>
            </button>
          </div>

          {/* Add Term Form */}
          {showAddTerm && (
            <form onSubmit={handleAddTerm} className="bg-[#111830] border border-[#4F6BED]/50 rounded-2xl p-5 space-y-4 text-xs shadow-xl motion-safe:animate-fade-in">
              <div className="flex items-center justify-between border-b border-[#1F2A4A] pb-2.5">
                <h4 className="font-bold text-[#60A5FA] uppercase tracking-wider flex items-center gap-1.5">
                  <BookOpen className="w-4 h-4 text-[#4F6BED]" />
                  Add Terminology Mapping
                </h4>
                <button type="button" onClick={() => setShowAddTerm(false)} className="text-[#7C88AB] hover:text-[#E8ECF8]">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#7C88AB] mb-1 font-medium">Banned Term / Phrase</label>
                  <input
                    type="text"
                    required
                    value={newBanned}
                    onChange={e => setNewBanned(e.target.value)}
                    placeholder="e.g. cheap"
                    className="w-full bg-[#0E1428] border border-[#1F2A4A] rounded-xl p-2.5 text-[#E8ECF8] focus:outline-none focus:border-[#4F6BED]"
                  />
                </div>
                <div>
                  <label className="block text-[#7C88AB] mb-1 font-medium">Preferred Alternative</label>
                  <input
                    type="text"
                    required
                    value={newPreferred}
                    onChange={e => setNewPreferred(e.target.value)}
                    placeholder="e.g. cost-effective"
                    className="w-full bg-[#0E1428] border border-[#1F2A4A] rounded-xl p-2.5 text-[#E8ECF8] focus:outline-none focus:border-[#4F6BED]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[#7C88AB] mb-1 font-medium">Brand Context / Why</label>
                <input
                  type="text"
                  value={newContext}
                  onChange={e => setNewContext(e.target.value)}
                  placeholder="e.g. The word 'cheap' degrades enterprise perception."
                  className="w-full bg-[#0E1428] border border-[#1F2A4A] rounded-xl p-2.5 text-[#E8ECF8] focus:outline-none focus:border-[#4F6BED]"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-1 border-t border-[#1F2A4A]">
                <button
                  type="button"
                  onClick={() => setShowAddTerm(false)}
                  className="px-3.5 py-1.5 text-xs text-[#7C88AB] hover:text-[#E8ECF8] rounded-xl hover:bg-[#141C33] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={termSubmitting}
                  className="bg-[#4F6BED] hover:bg-[#6479F2] text-white px-4 py-1.5 rounded-xl font-semibold shadow-md shadow-[#4F6BED]/20 transition-all flex items-center gap-1.5"
                >
                  {termSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                  <span>{termSubmitting ? 'Adding...' : 'Add to Dictionary'}</span>
                </button>
              </div>
            </form>
          )}

          {/* Search Terminology */}
          <div className="relative max-w-sm">
            <Search className="w-3.5 h-3.5 text-[#7C88AB] absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search banned or preferred terms..."
              value={termSearch}
              onChange={e => setTermSearch(e.target.value)}
              className="w-full bg-[#0E1428] border border-[#1F2A4A] rounded-xl pl-8 pr-3 py-1.5 text-xs text-[#E8ECF8] placeholder-[#7C88AB] focus:outline-none focus:border-[#4F6BED]"
            />
          </div>

          {/* Term Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {filteredTerms.length === 0 ? (
              <div className="p-8 text-center bg-[#111830] border border-[#1F2A4A] rounded-2xl text-xs text-[#7C88AB] col-span-2 italic">
                No terminology entries found.
              </div>
            ) : (
              filteredTerms.map(t => (
                <div key={t.id} className="bg-[#111830] border border-[#1F2A4A] rounded-2xl p-4 space-y-2.5 text-xs shadow-lg hover:border-[#2D3A63] transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                      <span className="bg-[#F87171]/15 text-[#F87171] border border-[#F87171]/30 px-2.5 py-0.5 rounded-lg font-semibold line-through">
                        "{t.banned_term}"
                      </span>
                      <ArrowRight className="w-3.5 h-3.5 text-[#7C88AB]" />
                      <span className="bg-[#34D399]/15 text-[#34D399] border border-[#34D399]/30 px-2.5 py-0.5 rounded-lg font-bold">
                        "{t.preferred_term}"
                      </span>
                    </div>

                    <div className="flex items-center space-x-2">
                      <span className="text-[10px] text-[#FBBF24] uppercase font-mono bg-[#FBBF24]/10 border border-[#FBBF24]/20 px-2 py-0.5 rounded-full font-bold">
                        {t.severity || 'warning'}
                      </span>
                      <button
                        type="button"
                        onClick={() => setDeleteConfirm({ type: 'term', id: t.id, name: `Banned Term "${t.banned_term}"` })}
                        className="text-[#7C88AB] hover:text-[#F87171] hover:bg-[#F87171]/10 p-1 rounded-lg transition-colors"
                        title="Delete entry"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <p className="text-[11px] text-[#AAB4D0] leading-relaxed bg-[#0E1428] border border-[#1F2A4A]/60 p-2.5 rounded-xl">
                    {t.context || 'Prohibited by brand guidelines.'}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Tab 3: Approved Facts */}
      {activeSubTab === 'facts' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs text-[#7C88AB]">
              Approved Fact Sheet v3: Grounded factual benchmarks that prevent outdated metrics or misleading statistics.
            </span>
            <button
              type="button"
              onClick={() => setShowAddFact(!showAddFact)}
              className="bg-[#4F6BED] hover:bg-[#6479F2] text-white px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center space-x-1.5 shadow-md shadow-[#4F6BED]/20 transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Approved Fact</span>
            </button>
          </div>

          {/* Add Fact Form */}
          {showAddFact && (
            <form onSubmit={handleAddFact} className="bg-[#111830] border border-[#4F6BED]/50 rounded-2xl p-5 space-y-4 text-xs shadow-xl motion-safe:animate-fade-in">
              <div className="flex items-center justify-between border-b border-[#1F2A4A] pb-2.5">
                <h4 className="font-bold text-[#60A5FA] uppercase tracking-wider flex items-center gap-1.5">
                  <Database className="w-4 h-4 text-[#4F6BED]" />
                  Create Approved Fact Benchmark
                </h4>
                <button type="button" onClick={() => setShowAddFact(false)} className="text-[#7C88AB] hover:text-[#E8ECF8]">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#7C88AB] mb-1 font-medium">Fact Key (Unique ID, e.g. active_users, sla_uptime)</label>
                  <input
                    type="text"
                    required
                    value={newFactKey}
                    onChange={e => setNewFactKey(e.target.value)}
                    placeholder="active_users"
                    className="w-full bg-[#0E1428] border border-[#1F2A4A] rounded-xl p-2.5 text-[#E8ECF8] font-mono focus:outline-none focus:border-[#4F6BED]"
                  />
                </div>
                <div>
                  <label className="block text-[#7C88AB] mb-1 font-medium">Approved Metric Value</label>
                  <input
                    type="text"
                    required
                    value={newFactMetric}
                    onChange={e => setNewFactMetric(e.target.value)}
                    placeholder="Enter the verified metric value"
                    className="w-full bg-[#0E1428] border border-[#1F2A4A] rounded-xl p-2.5 text-[#E8ECF8] font-bold focus:outline-none focus:border-[#4F6BED]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[#7C88AB] mb-1 font-medium">Claim Scope / Description</label>
                <input
                  type="text"
                  required
                  value={newFactClaim}
                  onChange={e => setNewFactClaim(e.target.value)}
                  placeholder="State the approved claim"
                  className="w-full bg-[#0E1428] border border-[#1F2A4A] rounded-xl p-2.5 text-[#E8ECF8] focus:outline-none focus:border-[#4F6BED]"
                />
              </div>

              <div>
                <label className="block text-[#7C88AB] mb-1 font-medium">Official Source / Citation</label>
                <input
                  type="text"
                  required
                  value={newFactCitation}
                  onChange={e => setNewFactCitation(e.target.value)}
                  placeholder="Approved Fact Sheet v3 (Oct 2026)"
                  className="w-full bg-[#0E1428] border border-[#1F2A4A] rounded-xl p-2.5 text-[#E8ECF8] focus:outline-none focus:border-[#4F6BED]"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-1 border-t border-[#1F2A4A]">
                <button
                  type="button"
                  onClick={() => setShowAddFact(false)}
                  className="px-3.5 py-1.5 text-xs text-[#7C88AB] hover:text-[#E8ECF8] rounded-xl hover:bg-[#141C33] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={factSubmitting}
                  className="bg-[#4F6BED] hover:bg-[#6479F2] text-white px-4 py-1.5 rounded-xl font-semibold shadow-md shadow-[#4F6BED]/20 transition-all flex items-center gap-1.5"
                >
                  {factSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                  <span>{factSubmitting ? 'Saving...' : 'Save Fact'}</span>
                </button>
              </div>
            </form>
          )}

          {/* Edit Fact Form Modal */}
          {editingFactId && (
            <form onSubmit={handleUpdateFact} className="bg-[#111830] border border-[#FBBF24]/50 rounded-2xl p-5 space-y-4 text-xs shadow-xl motion-safe:animate-fade-in">
              <div className="flex items-center justify-between border-b border-[#1F2A4A] pb-2.5">
                <h4 className="font-bold text-[#FBBF24] uppercase tracking-wider flex items-center gap-1.5">
                  <Edit3 className="w-4 h-4" />
                  Update Approved Fact Benchmark
                </h4>
                <button type="button" onClick={() => setEditingFactId(null)} className="text-[#7C88AB] hover:text-[#E8ECF8]">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#7C88AB] mb-1 font-medium">Approved Metric</label>
                  <input
                    type="text"
                    required
                    value={editFactMetric}
                    onChange={e => setEditFactMetric(e.target.value)}
                    className="w-full bg-[#0E1428] border border-[#1F2A4A] rounded-xl p-2.5 text-[#E8ECF8] font-bold focus:outline-none focus:border-[#4F6BED]"
                  />
                </div>
                <div>
                  <label className="block text-[#7C88AB] mb-1 font-medium">Citation Source</label>
                  <input
                    type="text"
                    required
                    value={editFactCitation}
                    onChange={e => setEditFactCitation(e.target.value)}
                    className="w-full bg-[#0E1428] border border-[#1F2A4A] rounded-xl p-2.5 text-[#E8ECF8] focus:outline-none focus:border-[#4F6BED]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[#7C88AB] mb-1 font-medium">Claim Text</label>
                <input
                  type="text"
                  required
                  value={editFactClaim}
                  onChange={e => setEditFactClaim(e.target.value)}
                  className="w-full bg-[#0E1428] border border-[#1F2A4A] rounded-xl p-2.5 text-[#E8ECF8] focus:outline-none focus:border-[#4F6BED]"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-1 border-t border-[#1F2A4A]">
                <button
                  type="button"
                  onClick={() => setEditingFactId(null)}
                  className="px-3.5 py-1.5 text-xs text-[#7C88AB] hover:text-[#E8ECF8] rounded-xl hover:bg-[#141C33] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editFactSubmitting}
                  className="bg-[#FBBF24] hover:bg-[#F59E0B] text-[#0A0F1E] px-4 py-1.5 rounded-xl font-bold shadow-md transition-all flex items-center gap-1.5"
                >
                  {editFactSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                  <span>{editFactSubmitting ? 'Updating...' : 'Update Fact'}</span>
                </button>
              </div>
            </form>
          )}

          {/* Search Facts */}
          <div className="relative max-w-sm">
            <Search className="w-3.5 h-3.5 text-[#7C88AB] absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search facts by key or metric..."
              value={factSearch}
              onChange={e => setFactSearch(e.target.value)}
              className="w-full bg-[#0E1428] border border-[#1F2A4A] rounded-xl pl-8 pr-3 py-1.5 text-xs text-[#E8ECF8] placeholder-[#7C88AB] focus:outline-none focus:border-[#4F6BED]"
            />
          </div>

          {/* Fact Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {filteredFacts.length === 0 ? (
              <div className="p-8 text-center bg-[#111830] border border-[#1F2A4A] rounded-2xl text-xs text-[#7C88AB] col-span-2 italic">
                No approved facts found.
              </div>
            ) : (
              filteredFacts.map(f => (
                <div key={f.id} className="bg-[#111830] border border-[#1F2A4A] rounded-2xl p-4 sm:p-5 space-y-3 text-xs shadow-xl hover:border-[#2D3A63] transition-colors">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[#60A5FA] font-bold uppercase bg-[#4F6BED]/10 px-2.5 py-0.5 rounded-lg border border-[#4F6BED]/20">
                      {f.fact_key}
                    </span>
                    <div className="flex items-center space-x-2">
                      <span className="text-[10px] text-[#7C88AB] font-mono">
                        Updated: {f.last_updated}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingFactId(f.id);
                          setEditFactMetric(f.approved_metric);
                          setEditFactClaim(f.claim_text);
                          setEditFactCitation(f.citation);
                        }}
                        className="text-[#7C88AB] hover:text-[#FBBF24] hover:bg-[#FBBF24]/10 p-1 rounded-lg transition-colors"
                        title="Edit fact"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteConfirm({ type: 'fact', id: f.id, name: `Fact "${f.fact_key}"` })}
                        className="text-[#7C88AB] hover:text-[#F87171] hover:bg-[#F87171]/10 p-1 rounded-lg transition-colors"
                        title="Delete fact"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="text-base sm:text-lg font-extrabold text-[#E8ECF8] font-mono">
                    {f.approved_metric}
                  </div>
                  <p className="text-[#AAB4D0] text-[11px] leading-relaxed">
                    {f.claim_text}
                  </p>
                  <div className="text-[10px] text-[#34D399] font-mono font-medium flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Source: {f.citation}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Tab 4: Color Palette */}
      {activeSubTab === 'colors' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs text-[#7C88AB]">
              Brand Color Specification & WCAG AA Contrast Ratios.
            </span>
            <button
              type="button"
              onClick={() => setShowAddColor(!showAddColor)}
              className="bg-[#4F6BED] hover:bg-[#6479F2] text-white px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center space-x-1.5 shadow-md shadow-[#4F6BED]/20 transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Brand Color</span>
            </button>
          </div>

          {/* Add Color Form */}
          {showAddColor && (
            <form onSubmit={handleAddColor} className="bg-[#111830] border border-[#4F6BED]/50 rounded-2xl p-5 space-y-4 text-xs shadow-xl motion-safe:animate-fade-in">
              <div className="flex items-center justify-between border-b border-[#1F2A4A] pb-2.5">
                <h4 className="font-bold text-[#60A5FA] uppercase tracking-wider flex items-center gap-1.5">
                  <Palette className="w-4 h-4 text-[#4F6BED]" />
                  Register Brand Color Swatch
                </h4>
                <button type="button" onClick={() => setShowAddColor(false)} className="text-[#7C88AB] hover:text-[#E8ECF8]">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <label className="block text-[#7C88AB] mb-1 font-medium">Color Name</label>
                  <input
                    type="text"
                    required
                    value={newColorName}
                    onChange={e => setNewColorName(e.target.value)}
                    placeholder="Electric Blue"
                    className="w-full bg-[#0E1428] border border-[#1F2A4A] rounded-xl p-2.5 text-[#E8ECF8] focus:outline-none focus:border-[#4F6BED]"
                  />
                </div>
                <div>
                  <label className="block text-[#7C88AB] mb-1 font-medium">Hex Code</label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="color"
                      value={newColorHex}
                      onChange={e => setNewColorHex(e.target.value.toUpperCase())}
                      className="w-9 h-9 rounded-xl border border-[#1F2A4A] bg-transparent cursor-pointer shrink-0"
                    />
                    <input
                      type="text"
                      required
                      value={newColorHex}
                      onChange={e => setNewColorHex(e.target.value.toUpperCase())}
                      placeholder="#2563EB"
                      className="flex-1 bg-[#0E1428] border border-[#1F2A4A] rounded-xl p-2.5 text-[#E8ECF8] font-mono focus:outline-none focus:border-[#4F6BED]"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[#7C88AB] mb-1 font-medium">Palette Role</label>
                  <select
                    value={newColorRole}
                    onChange={e => setNewColorRole(e.target.value)}
                    className="w-full bg-[#0E1428] border border-[#1F2A4A] rounded-xl p-2.5 text-[#E8ECF8] focus:outline-none focus:border-[#4F6BED]"
                  >
                    <option value="primary">Primary</option>
                    <option value="secondary">Secondary</option>
                    <option value="accent">Accent</option>
                    <option value="neutral">Neutral</option>
                    <option value="background">Background</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[#7C88AB] mb-1 font-medium">Min Contrast Ratio</label>
                  <input
                    type="number"
                    step="0.1"
                    min="1.0"
                    max="21.0"
                    required
                    value={newColorContrast}
                    onChange={e => setNewColorContrast(e.target.value)}
                    className="w-full bg-[#0E1428] border border-[#1F2A4A] rounded-xl p-2.5 text-[#E8ECF8] font-mono focus:outline-none focus:border-[#4F6BED]"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-1 border-t border-[#1F2A4A]">
                <button
                  type="button"
                  onClick={() => setShowAddColor(false)}
                  className="px-3.5 py-1.5 text-xs text-[#7C88AB] hover:text-[#E8ECF8] rounded-xl hover:bg-[#141C33] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={colorSubmitting}
                  className="bg-[#4F6BED] hover:bg-[#6479F2] text-white px-4 py-1.5 rounded-xl font-semibold shadow-md shadow-[#4F6BED]/20 transition-all flex items-center gap-1.5"
                >
                  {colorSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                  <span>{colorSubmitting ? 'Adding...' : 'Add Color'}</span>
                </button>
              </div>
            </form>
          )}

          {/* Color Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5">
            {colors.length === 0 ? (
              <div className="p-8 text-center bg-[#111830] border border-[#1F2A4A] rounded-2xl text-xs text-[#7C88AB] col-span-full italic">
                No brand colors registered.
              </div>
            ) : (
              colors.map(c => (
                <div key={c.id} className="bg-[#111830] border border-[#1F2A4A] rounded-2xl overflow-hidden p-3.5 space-y-2.5 text-xs relative group shadow-lg hover:border-[#2D3A63] transition-colors">
                  <div
                    className="w-full h-18 rounded-xl border border-[#1F2A4A] shadow-inner"
                    style={{ backgroundColor: c.hex_code }}
                  />
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[#E8ECF8] truncate">{c.name}</span>
                    <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full bg-[#0E1428] text-[#AAB4D0] border border-[#1F2A4A]">
                      {c.role}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="font-mono text-xs text-[#60A5FA] font-bold">{c.hex_code}</div>
                    <button
                      type="button"
                      onClick={() => setDeleteConfirm({ type: 'color', id: c.id, name: `Color "${c.name}" (${c.hex_code})` })}
                      className="text-[#7C88AB] hover:text-[#F87171] hover:bg-[#F87171]/10 p-1 rounded-lg transition-colors"
                      title="Delete color"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="text-[11px] text-[#7C88AB] font-mono">Min Contrast: {c.min_contrast}:1</div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Tab 5: Brand Logos */}
      {activeSubTab === 'logos' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs text-[#7C88AB]">
              Official Vector Marks & Assets: Verified against file hashes and safe clearance margins (LOGO-01).
            </span>
            <button
              type="button"
              onClick={() => setShowAddLogo(!showAddLogo)}
              className="bg-[#4F6BED] hover:bg-[#6479F2] text-white px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center space-x-1.5 shadow-md shadow-[#4F6BED]/20 transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Upload Official Logo</span>
            </button>
          </div>

          {/* Add Logo Form */}
          {showAddLogo && (
            <form onSubmit={handleAddLogo} className="bg-[#111830] border border-[#4F6BED]/50 rounded-2xl p-5 space-y-4 text-xs shadow-xl motion-safe:animate-fade-in">
              <div className="flex items-center justify-between border-b border-[#1F2A4A] pb-2.5">
                <h4 className="font-bold text-[#60A5FA] uppercase tracking-wider flex items-center gap-1.5">
                  <ImageIcon className="w-4 h-4 text-[#4F6BED]" />
                  Register Official Brand Logo Asset
                </h4>
                <button type="button" onClick={() => setShowAddLogo(false)} className="text-[#7C88AB] hover:text-[#E8ECF8]">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[#7C88AB] mb-1 font-medium">Logo Name / Variant</label>
                  <input
                    type="text"
                    required
                    value={newLogoName}
                    onChange={e => setNewLogoName(e.target.value)}
                    placeholder="Inkloom Primary Dark SVG"
                    className="w-full bg-[#0E1428] border border-[#1F2A4A] rounded-xl p-2.5 text-[#E8ECF8] focus:outline-none focus:border-[#4F6BED]"
                  />
                </div>
                <div>
                  <label className="block text-[#7C88AB] mb-1 font-medium">Logo File (SVG / PNG)</label>
                  <input
                    type="file"
                    accept=".svg,.png,.jpg,.jpeg,.webp"
                    required
                    onChange={e => setNewLogoFile(e.target.files[0])}
                    className="w-full text-xs text-[#7C88AB] file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-[#4F6BED] file:text-white"
                  />
                </div>
                <div>
                  <label className="block text-[#7C88AB] mb-1 font-medium">Min Clearance (%)</label>
                  <input
                    type="number"
                    step="1"
                    min="5"
                    max="50"
                    required
                    value={newLogoClearance}
                    onChange={e => setNewLogoClearance(e.target.value)}
                    className="w-full bg-[#0E1428] border border-[#1F2A4A] rounded-xl p-2.5 text-[#E8ECF8] font-mono focus:outline-none focus:border-[#4F6BED]"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-1 border-t border-[#1F2A4A]">
                <button
                  type="button"
                  onClick={() => setShowAddLogo(false)}
                  className="px-3.5 py-1.5 text-xs text-[#7C88AB] hover:text-[#E8ECF8] rounded-xl hover:bg-[#141C33] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={logoSubmitting}
                  className="bg-[#4F6BED] hover:bg-[#6479F2] text-white px-4 py-1.5 rounded-xl font-semibold shadow-md shadow-[#4F6BED]/20 transition-all flex items-center gap-1.5"
                >
                  {logoSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                  <span>{logoSubmitting ? 'Uploading...' : 'Upload & Register Hash'}</span>
                </button>
              </div>
            </form>
          )}

          {/* Logo Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {logos.length === 0 ? (
              <div className="p-8 text-center bg-[#111830] border border-[#1F2A4A] rounded-2xl text-xs text-[#7C88AB] col-span-full italic">
                No brand logo assets registered.
              </div>
            ) : (
              logos.map(l => (
                <div key={l.id} className="bg-[#111830] border border-[#1F2A4A] rounded-2xl p-4 space-y-3 text-xs relative group shadow-xl hover:border-[#2D3A63] transition-colors">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[#E8ECF8] truncate">{l.name}</span>
                    <button
                      type="button"
                      onClick={() => setDeleteConfirm({ type: 'logo', id: l.id, name: `Logo "${l.name}"` })}
                      className="text-[#7C88AB] hover:text-[#F87171] hover:bg-[#F87171]/10 p-1 rounded-lg transition-colors"
                      title="Delete logo"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="w-full h-28 bg-[#0A0F1E] rounded-xl border border-[#1F2A4A] flex items-center justify-center p-3 overflow-hidden">
                    <img
                      src={mediaUrl(l.file_path)}
                      alt={l.name}
                      className="max-h-full max-w-full object-contain"
                      onError={e => {
                        e.target.onerror = null;
                        e.target.src = '/favicon.svg';
                      }}
                    />
                  </div>

                  <div className="space-y-1.5 text-[11px] text-[#7C88AB]">
                    <div className="flex justify-between items-center">
                      <span>Safe Clearance:</span>
                      <span className="font-semibold text-[#34D399] font-mono">{l.min_clearance_pct}% buffer</span>
                    </div>
                    <div className="truncate font-mono text-[10px] text-[#7C88AB] bg-[#0E1428] p-1.5 rounded-lg border border-[#1F2A4A]/60" title={l.file_hash}>
                      SHA-256: {l.file_hash.substring(0, 24)}...
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Tab 6: Ingest Guideline Doc */}
      {activeSubTab === 'ingest' && (
        <div className="bg-[#111830] border border-[#1F2A4A] rounded-2xl p-5 sm:p-6 space-y-5 max-w-3xl shadow-xl">
          <div>
            <div className="flex items-center space-x-2.5">
              <div className="w-7 h-7 rounded-lg bg-[#4F6BED]/15 border border-[#4F6BED]/30 flex items-center justify-center text-[#4F6BED]">
                <Upload className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold text-[#E8ECF8] uppercase tracking-wider">
                Ingest & Split Brand Guidelines
              </h3>
            </div>
            <p className="text-xs text-[#7C88AB] mt-1 ml-9.5">
              Upload a PDF or paste brand guideline text/Markdown. Review extracted rules and source pages;
              the active Source of Truth changes only after you explicitly confirm activation.
            </p>
          </div>

          <form onSubmit={handleIngest} className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[#7C88AB] mb-1 font-medium">Guideline Title</label>
                <input
                  type="text"
                  required
                  value={ingestTitle}
                  onChange={e => {
                    setIngestTitle(e.target.value);
                    setIngestResult(null);
                    setIngestConfirmed(false);
                  }}
                  placeholder="e.g. Inkloom Q4 Global Voice & Visual Standard"
                  className="w-full bg-[#0E1428] border border-[#1F2A4A] rounded-xl p-2.5 text-[#E8ECF8] focus:outline-none focus:border-[#4F6BED]"
                />
              </div>
              <div>
                <label className="block text-[#7C88AB] mb-1 font-medium">Version Identifier</label>
                <input
                  type="text"
                  required
                  value={ingestVersion}
                  onChange={e => {
                    setIngestVersion(e.target.value);
                    setIngestResult(null);
                    setIngestConfirmed(false);
                  }}
                  placeholder="Enter the guideline version"
                  className="w-full bg-[#0E1428] border border-[#1F2A4A] rounded-xl p-2.5 text-[#E8ECF8] font-mono focus:outline-none focus:border-[#4F6BED]"
                />
              </div>
            </div>

            <div>
              <label className="block text-[#7C88AB] mb-1 font-medium">PDF guideline (optional)</label>
              <input
                type="file"
                accept="application/pdf,.pdf"
                key={ingestPdf ? 'pdf-selected' : 'pdf-empty'}
                onChange={e => {
                  setIngestPdf(e.target.files?.[0] || null);
                  setIngestResult(null);
                  setIngestConfirmed(false);
                }}
                className="w-full bg-[#0E1428] border border-[#1F2A4A] rounded-xl p-2.5 text-[#E8ECF8]"
              />
              <p className="text-[11px] text-[#7C88AB] mt-1">Maximum 15 MB. Encrypted and scanned/image-only PDFs are not supported.</p>
              {ingestPdf && (
                <button type="button" onClick={() => {
                  setIngestPdf(null);
                  setIngestResult(null);
                  setIngestConfirmed(false);
                }} className="text-[#60A5FA] mt-1">
                  Remove {ingestPdf.name} and use text/Markdown instead
                </button>
              )}
            </div>

            {!ingestPdf && <div>
              <label className="block text-[#7C88AB] mb-1 font-medium">Guideline Text / Markdown</label>
              <textarea
                rows={7}
                value={ingestText}
                onChange={e => {
                  setIngestText(e.target.value);
                  setIngestResult(null);
                  setIngestConfirmed(false);
                }}
                placeholder="# VOICE-05: Customer Centricity&#10;Always prioritize client outcomes over internal milestones.&#10;&#10;# CLAIM-03: Security Guarantees&#10;Reference SOC 2 Type II compliance when mentioning data privacy."
                className="w-full bg-[#0E1428] border border-[#1F2A4A] rounded-xl p-3 text-[#E8ECF8] font-mono leading-relaxed focus:outline-none focus:border-[#4F6BED]"
              />
            </div>}

            <button
              type="submit"
              disabled={ingestLoading}
              className="bg-[#4F6BED] hover:bg-[#6479F2] text-white px-5 py-2.5 rounded-xl font-bold shadow-md shadow-[#4F6BED]/20 transition-all flex items-center gap-2"
            >
              {ingestLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
              <span>{ingestLoading ? 'Parsing guideline...' : 'Parse and Preview Rules'}</span>
            </button>
          </form>

          {ingestError && (
            <div role="alert" className="bg-[#F87171]/10 border border-[#F87171]/30 rounded-xl p-3 text-xs text-[#FCA5A5]">
              {ingestError}
            </div>
          )}

          {ingestResult && (
            <div className="bg-[#34D399]/10 border border-[#34D399]/30 rounded-xl p-4 text-xs text-[#E8ECF8] space-y-3 motion-safe:animate-fade-in shadow-md">
              <div className="font-bold flex items-center gap-1.5 text-[#34D399]">
                <CheckCircle2 className="w-4 h-4" />
                {ingestResult.status === 'active' ? `Activated ${ingestResult.version}.` : `Preview: ${ingestResult.version}`}
              </div>
              <p className="text-[11px] text-[#AAB4D0] leading-relaxed">
                Parsed {ingestResult.rules_count} rule(s). This version {ingestResult.status === 'active' ? 'is active.' : 'is still pending and has not changed the active guidelines.'}
              </p>
              <div className="max-h-64 overflow-y-auto space-y-2">
                {ingestResult.rules?.map(rule => (
                  <div key={`${rule.rule_id}-${rule.source_page || ''}`} className="rounded-lg border border-[#1F2A4A] bg-[#0E1428] p-3">
                    <div className="font-semibold text-[#E8ECF8]">{rule.rule_id}: {rule.title}</div>
                    <div className="text-[#AAB4D0] mt-1">{rule.text}</div>
                    {rule.source_page && (
                      <div className="text-[#60A5FA] mt-1">Source: PDF page {rule.source_page}</div>
                    )}
                  </div>
                ))}
              </div>
              {ingestResult.status !== 'active' && (
                <div className="space-y-3 border-t border-[#1F2A4A] pt-3">
                  <label className="flex items-start gap-2 text-[#AAB4D0]">
                    <input
                      type="checkbox"
                      checked={ingestConfirmed}
                      onChange={e => setIngestConfirmed(e.target.checked)}
                      className="mt-0.5 accent-[#4F6BED]"
                    />
                    I reviewed this parsed version and explicitly confirm activating it for my organization.
                  </label>
                  <button
                    type="button"
                    onClick={handleActivateIngest}
                    disabled={ingestLoading || !ingestConfirmed}
                    className="bg-[#34D399] hover:bg-[#6EE7B7] disabled:opacity-50 disabled:cursor-not-allowed text-[#0A0F1E] px-4 py-2 rounded-xl font-bold"
                  >
                    {ingestLoading ? 'Activating...' : 'Confirm and Activate Version'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Accessible Delete Confirmation Modal */}
      {deleteConfirm && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 bg-[#0A0F1E]/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 motion-safe:animate-fade-in"
        >
          <div className="bg-[#111830] border border-[#F87171]/40 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl relative">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-[#F87171]/15 border border-[#F87171]/30 flex items-center justify-center text-[#F87171] shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#E8ECF8]">
                  Confirm Item Deletion
                </h3>
                <p className="text-xs text-[#7C88AB]">
                  Source of Truth Action
                </p>
              </div>
            </div>

            <p className="text-xs text-[#AAB4D0] leading-relaxed">
              Are you sure you want to permanently delete <strong className="text-[#E8ECF8]">{deleteConfirm.name}</strong>? This action will immediately remove it from the active Source of Truth and update real-time grounding checks.
            </p>

            <div className="flex justify-end space-x-2 pt-2 border-t border-[#1F2A4A]">
              <button
                type="button"
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 text-xs font-semibold text-[#7C88AB] hover:text-[#E8ECF8] rounded-xl hover:bg-[#172040] transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={executeDelete}
                className="bg-[#F87171] hover:bg-[#EF4444] text-white px-4 py-2 rounded-xl text-xs font-bold shadow-md shadow-[#F87171]/20 transition-all"
              >
                Permanently Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
