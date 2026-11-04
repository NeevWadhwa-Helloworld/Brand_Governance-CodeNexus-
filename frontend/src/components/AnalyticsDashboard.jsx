import React, { useState, useEffect } from 'react';
import { api } from '../api';
import {
  BarChart3, TrendingUp, CheckCircle2, AlertTriangle, Lightbulb,
  Clock, ShieldAlert, Award, FileText, ArrowUpRight
} from 'lucide-react';

export default function AnalyticsDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadAnalytics();
  }, []);

  async function loadAnalytics() {
    setLoading(true);
    try {
      const res = await api.getAnalytics();
      setData(res);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  if (loading || !data) {
    return (
      <div className="p-8 text-center text-slate-500">
        Loading governance analytics...
      </div>
    );
  }

  const { summary, top_flagged_terms, category_breakdown, resolution_stats, governance_recommendations } = data;

  return (
    <div className="space-y-6">
      {/* Dashboard Title */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-blue-400" />
            Governance Analytics Dashboard
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Tracking organizational compliance trends, AI flag precision, and guideline clarity signals.
          </p>
        </div>
        <button
          onClick={loadAnalytics}
          className="text-xs bg-slate-900 hover:bg-slate-850 text-slate-300 border border-slate-700 px-3 py-1.5 rounded-lg"
        >
          Refresh Metrics
        </button>
      </div>

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Flag Precision */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>AI Flag Precision</span>
            <span className="text-emerald-400 font-mono text-[11px]">Target ≥ 85%</span>
          </div>
          <div className="text-2xl font-extrabold text-white flex items-baseline gap-2">
            {summary.flag_precision}%
            <span className="text-xs font-medium text-emerald-400 flex items-center">
              <TrendingUp className="w-3 h-3 mr-0.5" /> Exceeds
            </span>
          </div>
          <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
            <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${Math.min(100, summary.flag_precision)}%` }} />
          </div>
          <p className="text-[11px] text-slate-500">
            Share of flags accepted or agreed with by creators and reviewers.
          </p>
        </div>

        {/* Card 2: First-Pass Compliance */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>First-Pass Compliance</span>
            <span className="text-blue-400 font-mono text-[11px]">Target ≥ 80%</span>
          </div>
          <div className="text-2xl font-extrabold text-white flex items-baseline gap-2">
            {summary.first_pass_compliance_rate}%
            <span className="text-xs font-medium text-blue-400 flex items-center">
              <CheckCircle2 className="w-3 h-3 mr-0.5" /> On Target
            </span>
          </div>
          <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
            <div className="bg-blue-500 h-full rounded-full" style={{ width: `${Math.min(100, summary.first_pass_compliance_rate)}%` }} />
          </div>
          <p className="text-[11px] text-slate-500">
            Drafts reaching managers without foundational brand errors.
          </p>
        </div>

        {/* Card 3: Review Turnaround */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Review Cycle Speedup</span>
            <span className="text-indigo-400 font-mono text-[11px]">Target ≥ 50%</span>
          </div>
          <div className="text-2xl font-extrabold text-white flex items-baseline gap-2">
            +{summary.avg_turnaround_improvement}%
            <span className="text-xs font-medium text-indigo-400 flex items-center">
              <Award className="w-3 h-3 mr-0.5" /> Faster
            </span>
          </div>
          <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
            <div className="bg-indigo-500 h-full rounded-full" style={{ width: `${Math.min(100, summary.avg_turnaround_improvement)}%` }} />
          </div>
          <p className="text-[11px] text-slate-500">
            Time from draft submission to managerial sign-off vs manual baseline.
          </p>
        </div>

        {/* Card 4: First Feedback Latency */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Time to First Feedback</span>
            <span className="text-purple-400 font-mono text-[11px]">Target &lt; 30s</span>
          </div>
          <div className="text-2xl font-extrabold text-white flex items-baseline gap-2">
            {summary.avg_first_feedback_seconds}s
            <span className="text-xs font-medium text-purple-400 flex items-center">
              <Clock className="w-3 h-3 mr-0.5" /> Sub-second
            </span>
          </div>
          <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
            <div className="bg-purple-500 h-full rounded-full" style={{ width: '92%' }} />
          </div>
          <p className="text-[11px] text-slate-500">
            Concurrent execution of deterministic and semantic RAG layers.
          </p>
        </div>
      </div>

      {/* Main Charts & Analytics Rows */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Top Flagged Terms */}
        <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              Top Flagged Terms & Guidelines (Repeated Mistakes)
            </h3>
            <span className="text-[11px] text-slate-400">Dynamic Policy Feedback</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-400 text-[10px] uppercase border-b border-slate-800">
                <tr>
                  <th className="p-2.5">Flagged Term / Phrase</th>
                  <th className="p-2.5">Rule ID</th>
                  <th className="p-2.5">Category</th>
                  <th className="p-2.5">Occurrences</th>
                  <th className="p-2.5">Resolution Mix</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-300">
                {top_flagged_terms.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-4 text-center text-slate-500">No flags recorded yet.</td>
                  </tr>
                ) : (
                  top_flagged_terms.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-850/50">
                      <td className="p-2.5 font-semibold text-rose-300">
                        "{item.term}"
                      </td>
                      <td className="p-2.5 font-mono text-blue-400 font-bold">
                        {item.rule_id}
                      </td>
                      <td className="p-2.5 uppercase text-[10px] text-slate-400">
                        {item.category}
                      </td>
                      <td className="p-2.5 font-mono font-bold text-slate-200">
                        {item.occurrences}x
                      </td>
                      <td className="p-2.5">
                        <div className="flex items-center space-x-1.5 text-[11px]">
                          <span className="text-emerald-400 font-semibold">{item.accepted} accepted</span>
                          <span className="text-slate-600">/</span>
                          <span className="text-amber-400 font-semibold">{item.dismissed} dismissed</span>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Column: Violations by Category */}
        <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <FileText className="w-4 h-4 text-indigo-400" />
            Violations by Brand Category
          </h3>

          <div className="space-y-3">
            {category_breakdown.map((cat, idx) => {
              const maxCount = Math.max(...category_breakdown.map(c => c.count), 1);
              const pct = Math.round((cat.count / maxCount) * 100);
              return (
                <div key={idx} className="space-y-1 text-xs">
                  <div className="flex justify-between text-slate-300">
                    <span className="uppercase font-semibold tracking-wider text-[11px]">{cat.category}</span>
                    <span className="font-mono text-slate-400">{cat.count} violations</span>
                  </div>
                  <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800">
                    <div
                      className="bg-gradient-to-r from-blue-500 to-indigo-500 h-full rounded-full transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Resolution Stats Summary */}
          <div className="pt-3 border-t border-slate-800 grid grid-cols-3 gap-2 text-center text-xs">
            <div className="bg-slate-950 p-2 rounded border border-slate-800">
              <div className="text-base font-bold text-emerald-400">{resolution_stats.accepted}</div>
              <div className="text-[10px] text-slate-400 uppercase">Accepted</div>
            </div>
            <div className="bg-slate-950 p-2 rounded border border-slate-800">
              <div className="text-base font-bold text-blue-400">{resolution_stats.edited}</div>
              <div className="text-[10px] text-slate-400 uppercase">Edited</div>
            </div>
            <div className="bg-slate-950 p-2 rounded border border-slate-800">
              <div className="text-base font-bold text-amber-400">{resolution_stats.dismissed}</div>
              <div className="text-[10px] text-slate-400 uppercase">Dismissed</div>
            </div>
          </div>
        </div>
      </div>

      {/* Actionable Recommendations: Where Guidelines Are Unclear */}
      <div className="bg-slate-900 border border-indigo-500/30 rounded-xl p-5 space-y-3">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
          <Lightbulb className="w-4 h-4 text-amber-400" />
          Actionable Guideline Refinement Recommendations
        </h3>
        <p className="text-xs text-slate-400">
          Identified by analyzing repeated creator dismissals and high flag frequencies across teams:
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {governance_recommendations.map((rec, i) => (
            <div key={i} className="bg-slate-950 border border-slate-800 p-3.5 rounded-lg text-xs space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-mono text-blue-400 font-bold">{rec.rule_id}</span>
                <span className="bg-amber-500/10 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded text-[10px] uppercase font-semibold">
                  {rec.action}
                </span>
              </div>
              <p className="text-slate-300 leading-snug">{rec.reason}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
