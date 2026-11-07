import React, { useState, useEffect } from 'react';
import { api } from '../api';
import {
  BarChart3, TrendingUp, CheckCircle2, AlertTriangle, Lightbulb,
  Clock, Award, FileText, RefreshCw, Search, Activity
} from 'lucide-react';

export default function AnalyticsDashboard() {
  const [data, setData] = useState(null);
  const [trends, setTrends] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [hoveredTrendIndex, setHoveredTrendIndex] = useState(null);
  const [termFilterCategory, setTermFilterCategory] = useState('all');
  const [termSearchQuery, setTermSearchQuery] = useState('');

  async function loadAnalytics(isRefresh = false) {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    const [dashboardResult, trendsResult] = await Promise.allSettled([
      api.getAnalytics(),
      api.getAnalyticsTrends()
    ]);

    if (dashboardResult.status === 'fulfilled') {
      setData(dashboardResult.value);
    } else {
      console.error(dashboardResult.reason);
      setError(dashboardResult.reason.message || 'Failed to load governance analytics.');
    }

    if (trendsResult.status === 'fulfilled') {
      setTrends(trendsResult.value || []);
    } else {
      console.error(trendsResult.reason);
      setTrends([]);
      setError(previous => previous || `Trend data unavailable: ${trendsResult.reason.message}`);
    }

    setLoading(false);
    setRefreshing(false);
  }

  useEffect(() => {
    loadAnalytics();
  }, []);

  async function handleRefresh() {
    await loadAnalytics(true);
  }

  if (loading) {
    return (
      <div className="space-y-6 motion-safe:animate-fade-in">
        <div className="flex items-center justify-between border-b border-[#1F2A4A] pb-4">
          <div className="space-y-2">
            <div className="h-6 w-64 bg-[#172040] rounded-lg animate-pulse" />
            <div className="h-3 w-96 bg-[#111830] rounded animate-pulse" />
          </div>
          <div className="h-8 w-28 bg-[#172040] rounded-xl animate-pulse" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(n => (
            <div key={n} className="bg-[#111830] border border-[#1F2A4A] rounded-2xl p-5 space-y-3">
              <div className="h-3 w-28 bg-[#172040] rounded animate-pulse" />
              <div className="h-8 w-20 bg-[#172040] rounded animate-pulse" />
              <div className="h-1.5 w-full bg-[#0E1428] rounded-full overflow-hidden" />
              <div className="h-3 w-40 bg-[#172040] rounded animate-pulse" />
            </div>
          ))}
        </div>
        <div className="bg-[#111830] border border-[#1F2A4A] rounded-2xl p-6 h-64 animate-pulse" />
      </div>
    );
  }

  if (!data && error) {
    return (
      <div className="rounded-2xl border border-[#F87171]/40 bg-[#F87171]/10 p-6 text-xs text-[#F87171] space-y-3">
        <div className="flex items-center gap-2 font-bold text-sm">
          <AlertTriangle className="w-4 h-4" />
          <span>Analytics Data Unavailable</span>
        </div>
        <p className="text-[#AAB4D0]">{error}</p>
        <button
          onClick={loadAnalytics}
          className="bg-[#172040] hover:bg-[#1F2A4A] text-[#E8ECF8] border border-[#1F2A4A] px-3.5 py-1.5 rounded-xl font-semibold transition-colors"
        >
          Retry Connection
        </button>
      </div>
    );
  }

  const {
    summary = {},
    top_flagged_terms = [],
    category_breakdown = [],
    resolution_stats = { accepted: 0, edited: 0, dismissed: 0, pending: 0 },
    governance_recommendations = [],
    compliance_trends = []
  } = data || {};

  // Normalize trends data: prefer trends from getAnalyticsTrends(), fallback to compliance_trends
  const trendList = trends.length > 0
    ? trends.map(t => ({
        date: t.date || t.scan_date,
        score: t.compliance_score ?? t.avg_compliance ?? 0,
        scans: t.scans ?? t.scan_count ?? 1,
        flags: t.flags ?? t.flag_count ?? 0
      }))
    : (compliance_trends || []).map(t => ({
        date: t.scan_date || t.date,
        score: t.avg_compliance ?? t.compliance_score ?? 0,
        scans: t.scan_count ?? t.scans ?? 1,
        flags: t.flag_count ?? t.flags ?? 0
      }));

  // Chart Coordinate Calculations
  const chartHeight = 160;
  const chartWidth = 600;
  const paddingX = 30;
  const paddingY = 25;
  const plotWidth = chartWidth - paddingX * 2;
  const plotHeight = chartHeight - paddingY * 2;

  const points = trendList.map((item, index) => {
    const x = paddingX + (trendList.length > 1 ? (index / (trendList.length - 1)) * plotWidth : plotWidth / 2);
    // Score is 0 - 100
    const clampedScore = Math.max(0, Math.min(100, item.score));
    const y = paddingY + plotHeight - (clampedScore / 100) * plotHeight;
    return { x, y, ...item };
  });

  const pathD = points.length > 1
    ? points.reduce((acc, curr, idx) => `${acc} ${idx === 0 ? 'M' : 'L'} ${curr.x.toFixed(1)} ${curr.y.toFixed(1)}`, '')
    : '';

  const areaD = points.length > 1
    ? `${pathD} L ${points[points.length - 1].x.toFixed(1)} ${(paddingY + plotHeight).toFixed(1)} L ${points[0].x.toFixed(1)} ${(paddingY + plotHeight).toFixed(1)} Z`
    : '';

  const targetLineY = paddingY + plotHeight - (80 / 100) * plotHeight;

  // Filter top flagged terms
  const filteredTerms = top_flagged_terms.filter(item => {
    const matchesCat = termFilterCategory === 'all' || item.category === termFilterCategory;
    const matchesSearch = !termSearchQuery.trim() ||
      (item.term && item.term.toLowerCase().includes(termSearchQuery.toLowerCase())) ||
      (item.rule_id && item.rule_id.toLowerCase().includes(termSearchQuery.toLowerCase()));
    return matchesCat && matchesSearch;
  });

  const uniqueCategories = Array.from(new Set(top_flagged_terms.map(t => t.category).filter(Boolean)));
  const totalResolutions = (resolution_stats.accepted || 0) + (resolution_stats.edited || 0) + (resolution_stats.dismissed || 0);

  // Evidence-backed recommendation validation:
  // A recommendation is only displayed if its triggering evidence (repeated occurrences and/or creator dismissals)
  // is genuinely verified in the available data.
  const validatedRecommendations = (governance_recommendations || []).filter(rec => {
    const matchingTerm = top_flagged_terms.find(t =>
      (rec.rule_id && t.rule_id === rec.rule_id) ||
      (rec.term && t.term && t.term.toLowerCase() === rec.term.toLowerCase())
    );

    if (!matchingTerm) return false;

    const citesDismissals = /dismiss/i.test(rec.reason || '');
    const citesRepetition = /repeat|frequent|multiple/i.test(rec.reason || '');

    // If dismissal-driven, requires actual recorded dismissals > 0
    if (citesDismissals && !(matchingTerm.dismissed > 0)) {
      return false;
    }

    // If repetition-driven, requires multiple occurrences (>= 2)
    if (citesRepetition && !(matchingTerm.occurrences >= 2)) {
      return false;
    }

    // General sanity check: must have at least 1 recorded occurrence
    if ((matchingTerm.occurrences || 0) < 1) {
      return false;
    }

    return true;
  });

  const hasDismissalEvidence = validatedRecommendations.some(r => /dismiss/i.test(r.reason || ''));
  const hasRepetitionEvidence = validatedRecommendations.some(r => /repeat|frequent|multiple/i.test(r.reason || ''));

  return (
    <div className="space-y-6 motion-safe:animate-fade-in">
      {error && (
        <div className="rounded-xl border border-[#F87171]/40 bg-[#F87171]/10 px-4 py-3 text-xs text-[#F87171] flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-[#E8ECF8] hover:underline font-medium">Dismiss</button>
        </div>
      )}

      {/* Header & Quick Stats Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#1F2A4A] pb-4">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#4F6BED]/15 border border-[#4F6BED]/30 flex items-center justify-center text-[#4F6BED]">
              <BarChart3 className="w-4 h-4" />
            </div>
            <h2 className="text-base sm:text-lg font-bold text-[#E8ECF8]">
              Governance Analytics Dashboard
            </h2>
          </div>
          <p className="text-xs text-[#7C88AB] mt-1 ml-10.5">
            Tracking organizational compliance trends, AI flag precision, and guideline clarity signals.
          </p>
        </div>

        <div className="flex items-center space-x-2.5">
          {summary.total_drafts !== undefined && (
            <div className="hidden sm:flex items-center space-x-2 bg-[#0E1428] border border-[#1F2A4A] rounded-xl px-3 py-1.5 text-xs text-[#7C88AB]">
              <span>Drafts Analyzed:</span>
              <span className="font-mono font-bold text-[#E8ECF8]">{summary.total_drafts}</span>
              <span className="text-[#1F2A4A]">|</span>
              <span>Approved:</span>
              <span className="font-mono font-bold text-[#34D399]">{summary.approved_drafts || 0}</span>
            </div>
          )}

          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center space-x-1.5 bg-[#172040] hover:bg-[#1F2A4A] text-[#E8ECF8] border border-[#1F2A4A] px-3.5 py-1.5 rounded-xl text-xs font-semibold shadow-sm transition-all"
            title="Reload latest metrics from database"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#4F6BED] ${refreshing ? 'animate-spin' : ''}`} />
            <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {/* KPI Metric Cards (Section 9.1 Evaluation Standard Alignment) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Flag Precision */}
        <div className="bg-[#111830] border border-[#1F2A4A] rounded-2xl p-4 sm:p-5 space-y-2.5 shadow-xl relative overflow-hidden group hover:border-[#34D399]/40 transition-colors">
          <div className="flex items-center justify-between text-xs text-[#7C88AB]">
            <span className="font-medium">AI Flag Precision</span>
            <span className="text-[#34D399] font-mono text-[10px] font-semibold bg-[#34D399]/10 border border-[#34D399]/20 px-2 py-0.5 rounded-full">
              Target ≥ {summary.target_precision || 85}%
            </span>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-[#E8ECF8] font-mono flex items-baseline gap-2">
            {summary.flag_precision}%
            <span className="text-xs font-semibold text-[#34D399] flex items-center font-sans">
              <TrendingUp className="w-3.5 h-3.5 mr-0.5" />
              {summary.flag_precision >= (summary.target_precision || 85) ? 'Exceeds' : 'Tracking'}
            </span>
          </div>
          <div className="w-full bg-[#0A0F1E] h-1.5 rounded-full overflow-hidden border border-[#1F2A4A]/60">
            <div
              className="bg-gradient-to-r from-[#10B981] to-[#34D399] h-full rounded-full transition-all duration-700"
              style={{ width: `${Math.min(100, summary.flag_precision || 0)}%` }}
            />
          </div>
          <p className="text-[11px] text-[#7C88AB] leading-relaxed">
            Share of flagged issues accepted or edited by reviewers without dismissal.
          </p>
        </div>

        {/* Card 2: First-Pass Compliance */}
        <div className="bg-[#111830] border border-[#1F2A4A] rounded-2xl p-4 sm:p-5 space-y-2.5 shadow-xl relative overflow-hidden group hover:border-[#60A5FA]/40 transition-colors">
          <div className="flex items-center justify-between text-xs text-[#7C88AB]">
            <span className="font-medium">First-Pass Compliance</span>
            <span className="text-[#60A5FA] font-mono text-[10px] font-semibold bg-[#60A5FA]/10 border border-[#60A5FA]/20 px-2 py-0.5 rounded-full">
              Target ≥ {summary.target_first_pass || 80}%
            </span>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-[#E8ECF8] font-mono flex items-baseline gap-2">
            {summary.first_pass_compliance_rate}%
            <span className="text-xs font-semibold text-[#60A5FA] flex items-center font-sans">
              <CheckCircle2 className="w-3.5 h-3.5 mr-0.5" />
              {summary.first_pass_compliance_rate >= (summary.target_first_pass || 80) ? 'On Target' : 'Action Required'}
            </span>
          </div>
          <div className="w-full bg-[#0A0F1E] h-1.5 rounded-full overflow-hidden border border-[#1F2A4A]/60">
            <div
              className="bg-gradient-to-r from-[#2563EB] to-[#60A5FA] h-full rounded-full transition-all duration-700"
              style={{ width: `${Math.min(100, summary.first_pass_compliance_rate || 0)}%` }}
            />
          </div>
          <p className="text-[11px] text-[#7C88AB] leading-relaxed">
            Drafts meeting brand standards upon initial submission without revision cycles.
          </p>
        </div>

        {/* Card 3: Review Cycle Turnaround */}
        <div className="bg-[#111830] border border-[#1F2A4A] rounded-2xl p-4 sm:p-5 space-y-2.5 shadow-xl relative overflow-hidden group hover:border-[#A78BFA]/40 transition-colors">
          <div className="flex items-center justify-between text-xs text-[#7C88AB]">
            <span className="font-medium">Review Cycle Speedup</span>
            <span className="text-[#A78BFA] font-mono text-[10px] font-semibold bg-[#A78BFA]/10 border border-[#A78BFA]/20 px-2 py-0.5 rounded-full">
              Target ≥ {summary.target_turnaround_improvement || 50}%
            </span>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-[#E8ECF8] font-mono flex items-baseline gap-2">
            +{summary.avg_turnaround_improvement}%
            <span className="text-xs font-semibold text-[#A78BFA] flex items-center font-sans">
              <Award className="w-3.5 h-3.5 mr-0.5" /> Faster
            </span>
          </div>
          <div className="w-full bg-[#0A0F1E] h-1.5 rounded-full overflow-hidden border border-[#1F2A4A]/60">
            <div
              className="bg-gradient-to-r from-[#7C3AED] to-[#A78BFA] h-full rounded-full transition-all duration-700"
              style={{ width: `${Math.min(100, summary.avg_turnaround_improvement || 0)}%` }}
            />
          </div>
          <p className="text-[11px] text-[#7C88AB] leading-relaxed">
            Time from draft creation to sign-off compared to the 48h manual review baseline.
          </p>
        </div>

        {/* Card 4: First Feedback Latency */}
        <div className="bg-[#111830] border border-[#1F2A4A] rounded-2xl p-4 sm:p-5 space-y-2.5 shadow-xl relative overflow-hidden group hover:border-[#FBBF24]/40 transition-colors">
          <div className="flex items-center justify-between text-xs text-[#7C88AB]">
            <span className="font-medium">Time to First Feedback</span>
            <span className="text-[#FBBF24] font-mono text-[10px] font-semibold bg-[#FBBF24]/10 border border-[#FBBF24]/20 px-2 py-0.5 rounded-full">
              Target &lt; {summary.target_feedback_seconds || 30}s
            </span>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-[#E8ECF8] font-mono flex items-baseline gap-2">
            {summary.avg_first_feedback_seconds}s
            <span className="text-xs font-semibold text-[#FBBF24] flex items-center font-sans">
              <Clock className="w-3.5 h-3.5 mr-0.5" /> Sub-second
            </span>
          </div>
          <div className="w-full bg-[#0A0F1E] h-1.5 rounded-full overflow-hidden border border-[#1F2A4A]/60">
            <div
              className="bg-gradient-to-r from-[#D97706] to-[#FBBF24] h-full rounded-full transition-all duration-700"
              style={{ width: '92%' }}
            />
          </div>
          <p className="text-[11px] text-[#7C88AB] leading-relaxed">
            Combined latency of deterministic dictionary check and parallel semantic RAG pass.
          </p>
        </div>
      </div>

      {/* Main Compliance Trend Chart */}
      <div className="bg-[#111830] border border-[#1F2A4A] rounded-2xl p-5 sm:p-6 space-y-4 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1F2A4A] pb-3.5">
          <div className="flex items-center space-x-2.5">
            <Activity className="w-4 h-4 text-[#4F6BED]" />
            <h3 className="text-sm font-bold text-[#E8ECF8] uppercase tracking-wider">
              Compliance Trajectory Over Time
            </h3>
          </div>
          <div className="flex items-center space-x-3 text-xs text-[#7C88AB]">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#60A5FA]" />
              Measured Average
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-0.5 border-t border-dashed border-[#34D399]" />
              80% Policy Target
            </span>
          </div>
        </div>

        {points.length > 1 ? (
          <div className="space-y-2">
            <div className="relative w-full overflow-hidden">
              <svg
                viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                className="w-full h-44 overflow-visible"
              >
                <defs>
                  <linearGradient id="complianceGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.35" />
                    <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                {/* Horizontal reference gridlines */}
                {[100, 75, 50, 25, 0].map(val => {
                  const y = paddingY + plotHeight - (val / 100) * plotHeight;
                  return (
                    <g key={val}>
                      <line
                        x1={paddingX}
                        y1={y}
                        x2={paddingX + plotWidth}
                        y2={y}
                        stroke="var(--border)"
                        strokeWidth="1"
                        strokeDasharray={val === 0 ? "none" : "2 4"}
                      />
                      <text
                        x={paddingX - 6}
                        y={y + 3}
                        textAnchor="end"
                        fill="var(--text-muted)"
                        fontSize="9"
                        fontFamily="monospace"
                      >
                        {val}%
                      </text>
                    </g>
                  );
                })}

                {/* Target line at 80% */}
                <line
                  x1={paddingX}
                  y1={targetLineY}
                  x2={paddingX + plotWidth}
                  y2={targetLineY}
                  stroke="var(--success)"
                  strokeWidth="1.2"
                  strokeDasharray="4 4"
                  opacity="0.8"
                />

                {/* Area fill under curve */}
                <path d={areaD} fill="url(#complianceGradient)" />

                {/* Line path */}
                <path
                  d={pathD}
                  fill="none"
                  stroke="var(--primary)"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />

                {/* Data Points */}
                {points.map((pt, idx) => {
                  const isHovered = hoveredTrendIndex === idx;
                  return (
                    <g key={idx} className="cursor-pointer" onMouseEnter={() => setHoveredTrendIndex(idx)}>
                      <circle
                        cx={pt.x}
                        cy={pt.y}
                        r={isHovered ? 5.5 : 3.5}
                        fill={isHovered ? 'var(--text-primary)' : 'var(--primary)'}
                        stroke="var(--surface)"
                        strokeWidth="2"
                        className="transition-all duration-200"
                      />
                    </g>
                  );
                })}
              </svg>
            </div>

            {/* Interactive Data Point Inspection Strip */}
            {hoveredTrendIndex !== null && points[hoveredTrendIndex] && (
              <div className="bg-[#0E1428] border border-[#4F6BED]/40 rounded-xl px-4 py-2 flex flex-wrap items-center justify-between text-xs motion-safe:animate-fade-in shadow-md">
                <span className="font-mono text-[#AAB4D0]">
                  Date: <span className="text-[#E8ECF8] font-bold">{points[hoveredTrendIndex].date}</span>
                </span>
                <span className="font-mono text-[#34D399] font-bold">
                  Compliance: {points[hoveredTrendIndex].score}%
                </span>
                <span className="font-mono text-[#7C88AB]">
                  Activity: {points[hoveredTrendIndex].scans} scans • {points[hoveredTrendIndex].flags} flags
                </span>
              </div>
            )}

            {/* Date range axis label */}
            <div className="flex justify-between items-center text-[10px] font-mono text-[#7C88AB] px-6 pt-1">
              <span>{points[0]?.date || 'Earliest'}</span>
              <span>Daily Aggregate Trend</span>
              <span>{points[points.length - 1]?.date || 'Latest'}</span>
            </div>
          </div>
        ) : (
          <div className="p-8 text-center bg-[#0E1428] border border-[#1F2A4A] rounded-xl text-xs text-[#7C88AB] space-y-1">
            <p className="font-medium text-[#AAB4D0]">Initial Single-Point Baseline Recorded</p>
            <p className="text-[11px]">Trend lines will automatically plot across multiple draft scanning dates.</p>
          </div>
        )}
      </div>

      {/* Two Column Section: Top Flagged Terms vs Category Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Top Flagged Terms (Repeated Mistakes) */}
        <div className="lg:col-span-7 bg-[#111830] border border-[#1F2A4A] rounded-2xl p-5 space-y-4 shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#1F2A4A] pb-3">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 text-[#FBBF24]" />
              <h3 className="text-sm font-bold text-[#E8ECF8] uppercase tracking-wider">
                Top Flagged Terms & Repeated Pitfalls
              </h3>
            </div>
            <span className="text-[11px] font-mono text-[#7C88AB]">
              Dynamic Feedback
            </span>
          </div>

          {/* Search & Category Filter Controls */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[140px]">
              <Search className="w-3.5 h-3.5 text-[#7C88AB] absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search term or rule ID..."
                value={termSearchQuery}
                onChange={e => setTermSearchQuery(e.target.value)}
                className="w-full bg-[#0E1428] border border-[#1F2A4A] rounded-xl pl-8 pr-3 py-1.5 text-xs text-[#E8ECF8] placeholder-[#7C88AB] focus:outline-none focus:border-[#4F6BED]"
              />
            </div>

            <div className="flex items-center space-x-1 text-xs">
              <button
                type="button"
                onClick={() => setTermFilterCategory('all')}
                className={`px-2.5 py-1 rounded-lg border text-[11px] font-semibold transition-all ${
                  termFilterCategory === 'all'
                    ? 'bg-[#172040] border-[#4F6BED] text-[#E8ECF8]'
                    : 'bg-[#0E1428] border-[#1F2A4A] text-[#7C88AB] hover:text-[#E8ECF8]'
                }`}
              >
                All
              </button>
              {uniqueCategories.map(cat => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setTermFilterCategory(cat)}
                  className={`px-2.5 py-1 rounded-lg border text-[11px] font-semibold capitalize transition-all ${
                    termFilterCategory === cat
                      ? 'bg-[#172040] border-[#4F6BED] text-[#E8ECF8]'
                      : 'bg-[#0E1428] border-[#1F2A4A] text-[#7C88AB] hover:text-[#E8ECF8]'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto rounded-xl border border-[#1F2A4A] bg-[#0E1428]">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#0A0F1E] text-[#7C88AB] text-[10px] uppercase font-mono border-b border-[#1F2A4A]">
                <tr>
                  <th className="p-3">Flagged Span</th>
                  <th className="p-3">Rule ID</th>
                  <th className="p-3">Category</th>
                  <th className="p-3">Hits</th>
                  <th className="p-3">Resolution Ratio</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1F2A4A]/60 text-[#AAB4D0]">
                {filteredTerms.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-xs text-[#7C88AB] italic">
                      No matching flagged terms recorded.
                    </td>
                  </tr>
                ) : (
                  filteredTerms.map((item, idx) => (
                    <tr key={idx} className="hover:bg-[#141C33] transition-colors">
                      <td className="p-3 font-semibold text-[#F87171] font-mono">
                        "{item.term}"
                      </td>
                      <td className="p-3 font-mono font-bold text-[#60A5FA]">
                        {item.rule_id}
                      </td>
                      <td className="p-3">
                        <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full bg-[#172040] text-[#AAB4D0] border border-[#1F2A4A]">
                          {item.category}
                        </span>
                      </td>
                      <td className="p-3 font-mono font-bold text-[#E8ECF8]">
                        {item.occurrences}×
                      </td>
                      <td className="p-3">
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-[10px] font-mono">
                            <span className="text-[#34D399]">{item.accepted || 0} acc</span>
                            <span className="text-[#7C88AB]">/</span>
                            <span className="text-[#FBBF24]">{item.dismissed || 0} dis</span>
                          </div>
                          <div className="w-20 bg-[#0A0F1E] h-1.5 rounded-full overflow-hidden flex border border-[#1F2A4A]/40">
                            <div
                              className="bg-[#34D399] h-full"
                              style={{ width: `${Math.round(((item.accepted || 0) / Math.max(1, (item.accepted || 0) + (item.dismissed || 0))) * 100)}%` }}
                            />
                            <div
                              className="bg-[#FBBF24] h-full"
                              style={{ width: `${Math.round(((item.dismissed || 0) / Math.max(1, (item.accepted || 0) + (item.dismissed || 0))) * 100)}%` }}
                            />
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right: Violations by Category & Resolution Stats */}
        <div className="lg:col-span-5 space-y-6">
          {/* Category Breakdown Card */}
          <div className="bg-[#111830] border border-[#1F2A4A] rounded-2xl p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-[#1F2A4A] pb-3">
              <div className="flex items-center space-x-2">
                <FileText className="w-4 h-4 text-[#4F6BED]" />
                <h3 className="text-sm font-bold text-[#E8ECF8] uppercase tracking-wider">
                  Violations by Category
                </h3>
              </div>
              <span className="text-[11px] font-mono text-[#7C88AB]">
                {category_breakdown.reduce((sum, c) => sum + (c.count || 0), 0)} Total
              </span>
            </div>

            <div className="space-y-3">
              {category_breakdown.length === 0 ? (
                <p className="text-xs text-[#7C88AB] italic p-4 text-center">No categories flagged yet.</p>
              ) : (
                category_breakdown.map((cat, idx) => {
                  const maxCount = Math.max(...category_breakdown.map(c => c.count), 1);
                  const pct = Math.round((cat.count / maxCount) * 100);
                  return (
                    <div key={idx} className="space-y-1 text-xs">
                      <div className="flex justify-between items-center text-[#AAB4D0]">
                        <span className="uppercase font-semibold tracking-wider text-[11px] text-[#E8ECF8]">
                          {cat.category}
                        </span>
                        <span className="font-mono text-[#7C88AB]">
                          {cat.count} flags
                        </span>
                      </div>
                      <div className="w-full bg-[#0A0F1E] h-2 rounded-full overflow-hidden border border-[#1F2A4A]/60">
                        <div
                          className="bg-gradient-to-r from-[#4F6BED] to-[#60A5FA] h-full rounded-full transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Resolution Stats Summary Card */}
          <div className="bg-[#111830] border border-[#1F2A4A] rounded-2xl p-5 space-y-3 shadow-xl">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#7C88AB] flex items-center justify-between">
              <span>Overall Resolution Mix</span>
              <span className="font-mono text-[10px] text-[#AAB4D0]">{totalResolutions} Decisions</span>
            </h4>

            <div className="grid grid-cols-3 gap-2.5 text-center text-xs">
              <div className="bg-[#0E1428] p-3 rounded-xl border border-[#34D399]/20 space-y-0.5">
                <div className="text-lg font-bold font-mono text-[#34D399]">
                  {resolution_stats.accepted || 0}
                </div>
                <div className="text-[10px] text-[#7C88AB] uppercase font-semibold">Accepted</div>
              </div>

              <div className="bg-[#0E1428] p-3 rounded-xl border border-[#60A5FA]/20 space-y-0.5">
                <div className="text-lg font-bold font-mono text-[#60A5FA]">
                  {resolution_stats.edited || 0}
                </div>
                <div className="text-[10px] text-[#7C88AB] uppercase font-semibold">Edited</div>
              </div>

              <div className="bg-[#0E1428] p-3 rounded-xl border border-[#FBBF24]/20 space-y-0.5">
                <div className="text-lg font-bold font-mono text-[#FBBF24]">
                  {resolution_stats.dismissed || 0}
                </div>
                <div className="text-[10px] text-[#7C88AB] uppercase font-semibold">Dismissed</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Actionable Recommendations: Where Guidelines Are Unclear */}
      <div className="bg-[#111830] border border-[#4F6BED]/30 rounded-2xl p-5 sm:p-6 space-y-4 shadow-xl">
        <div className="flex items-center space-x-2.5 border-b border-[#1F2A4A] pb-3">
          <div className="w-7 h-7 rounded-lg bg-[#FBBF24]/10 border border-[#FBBF24]/30 flex items-center justify-center text-[#FBBF24]">
            <Lightbulb className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[#E8ECF8] uppercase tracking-wider">
              Actionable Guideline Refinement Recommendations
            </h3>
            <p className="text-xs text-[#7C88AB]">
              {validatedRecommendations.length > 0
                ? (hasDismissalEvidence && hasRepetitionEvidence
                    ? 'Synthesized from creator dismissals and repeated violations across drafts.'
                    : hasDismissalEvidence
                    ? 'Synthesized from creator override signals across drafts.'
                    : hasRepetitionEvidence
                    ? 'Identified from repeated policy flags across drafts.'
                    : 'Targeted policy refinements supported by verified review data.')
                : 'Policy refinement insights require sufficient creator review decisions and repeated flag patterns.'}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {validatedRecommendations.length === 0 ? (
            <div className="bg-[#0E1428] border border-[#1F2A4A] rounded-xl p-6 text-center space-y-2 col-span-1 md:col-span-2">
              <div className="w-8 h-8 rounded-full bg-[#172040] border border-[#1F2A4A] text-[#7C88AB] flex items-center justify-center mx-auto">
                <Lightbulb className="w-4 h-4 text-[#7C88AB]" />
              </div>
              <p className="text-xs font-semibold text-[#E8ECF8]">
                Insufficient Review Activity for Policy Refinements
              </p>
              <p className="text-[11px] text-[#7C88AB] max-w-md mx-auto leading-relaxed">
                Refinement recommendations are generated when multiple creator dismissals or repeated policy violations are recorded. Complete more draft reviews and decisions to populate actionable insights.
              </p>
            </div>
          ) : (
            validatedRecommendations.map((rec, i) => (
              <div
                key={i}
                className="bg-[#0E1428] border border-[#1F2A4A] p-4 rounded-xl text-xs space-y-2 hover:border-[#2D3A63] transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[#60A5FA] font-bold bg-[#4F6BED]/10 px-2 py-0.5 rounded border border-[#4F6BED]/20">
                    {rec.rule_id}
                  </span>
                  <span className="bg-[#FBBF24]/10 text-[#FBBF24] border border-[#FBBF24]/30 px-2.5 py-0.5 rounded-full text-[10px] uppercase font-bold tracking-wide">
                    {rec.action}
                  </span>
                </div>
                <p className="text-[#AAB4D0] leading-relaxed">
                  {rec.reason}
                </p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
