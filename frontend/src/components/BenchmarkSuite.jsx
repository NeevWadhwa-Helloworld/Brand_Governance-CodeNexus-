import React, { useState, useEffect } from 'react';
import { api } from '../api';
import {
  TestTube2, CheckCircle2, XCircle, Play, RefreshCw, Clock,
  Target, ShieldCheck, Zap, AlertCircle
} from 'lucide-react';

export default function BenchmarkSuite() {
  const [report, setReport] = useState(null);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    loadBenchmark();
  }, []);

  async function loadBenchmark() {
    try {
      const res = await api.getLatestEvaluation();
      setReport(res);
    } catch (e) {
      console.error(e);
    }
  }

  async function handleRun() {
    setRunning(true);
    try {
      const res = await api.runEvaluation();
      setReport(res);
    } catch (e) {
      console.error(e);
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <TestTube2 className="w-5 h-5 text-blue-400" />
              Round 3 Success Metrics Benchmark Suite
            </h2>
            <span className="text-xs bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded font-mono">
              Section 9.1 Verification
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Validating the intelligent brand-governance platform on labelled test drafts against all targets.
          </p>
        </div>

        <button
          onClick={handleRun}
          disabled={running}
          className="flex items-center space-x-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white px-4 py-2 rounded-lg text-xs font-bold shadow-lg transition-all"
        >
          <Play className={`w-3.5 h-3.5 ${running ? 'animate-spin' : ''}`} />
          <span>{running ? 'Running Labelled Benchmark...' : 'Execute Labelled Benchmark'}</span>
        </button>
      </div>

      {report && (
        <div className="space-y-6">
          {/* Target Success Metrics Cards (from Section 9.1 Table) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {report.metrics_summary.map((m, idx) => (
              <div
                key={idx}
                className={`bg-slate-900 border rounded-xl p-4 space-y-2 transition-all ${
                  m.passed
                    ? 'border-emerald-500/40 shadow-sm shadow-emerald-500/5'
                    : 'border-rose-500/40'
                }`}
              >
                <div className="flex items-start justify-between">
                  <span className="text-xs font-semibold text-slate-300 line-clamp-1">{m.metric.split('(')[0]}</span>
                  {m.passed ? (
                    <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> PASSED
                    </span>
                  ) : (
                    <span className="bg-rose-500/20 text-rose-400 border border-rose-500/30 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                      <XCircle className="w-3 h-3" /> FAILED
                    </span>
                  )}
                </div>

                <div className="flex items-baseline space-x-2">
                  <span className="text-2xl font-black text-white">{m.measured}</span>
                  <span className="text-xs text-slate-500 font-mono">Target: {m.target}</span>
                </div>

                <p className="text-[11px] text-slate-400 leading-snug">{m.details}</p>
              </div>
            ))}
          </div>

          {/* Test Samples Execution Log */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                Labelled Test Cases Execution Results
              </h3>
              <span className="text-xs font-mono text-slate-400">
                {report.sample_results.filter(s => s.passed).length}/{report.sample_results.length} Test Samples Passed
              </span>
            </div>

            <div className="space-y-3">
              {report.sample_results.map(sample => (
                <div
                  key={sample.sample_id}
                  className="bg-slate-950 border border-slate-800 rounded-lg p-3.5 space-y-2 text-xs"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center space-x-2">
                      <span className="font-mono text-blue-400 font-bold bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded">
                        {sample.sample_id}
                      </span>
                      <span className="font-semibold text-slate-200">{sample.title}</span>
                    </div>

                    <div className="flex items-center space-x-3 text-[11px]">
                      <span className="text-slate-400 font-mono flex items-center gap-1">
                        <Zap className="w-3 h-3 text-amber-400" />
                        {sample.latency_seconds * 1000} ms
                      </span>
                      <span className={`px-2 py-0.5 rounded font-bold uppercase ${
                        sample.passed
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                      }`}>
                        {sample.passed ? 'Exact Match' : 'Mismatch'}
                      </span>
                    </div>
                  </div>

                  <p className="text-slate-400 italic">"{sample.content_preview}"</p>

                  <div className="flex flex-wrap items-center gap-3 pt-1 border-t border-slate-900 text-[11px]">
                    <div>
                      <span className="text-slate-500 mr-1.5 font-medium">Expected Rules:</span>
                      {sample.expected_rules.length === 0 ? (
                        <span className="text-emerald-400 font-semibold">None (Compliant)</span>
                      ) : (
                        sample.expected_rules.map(r => (
                          <span key={r} className="bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded font-mono mr-1">
                            {r}
                          </span>
                        ))
                      )}
                    </div>

                    <div className="text-slate-600">|</div>

                    <div>
                      <span className="text-slate-500 mr-1.5 font-medium">Detected Flags:</span>
                      {sample.detected_rules.length === 0 ? (
                        <span className="text-emerald-400 font-semibold">None (Clean)</span>
                      ) : (
                        sample.detected_rules.map(r => (
                          <span key={r} className="bg-blue-950 text-blue-300 border border-blue-500/30 px-1.5 py-0.5 rounded font-mono mr-1">
                            {r}
                          </span>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

