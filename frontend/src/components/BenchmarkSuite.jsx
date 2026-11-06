import React, { useState, useEffect } from 'react';
import { api } from '../api';
import {
  TestTube2, CheckCircle2, XCircle, Play, ShieldCheck, Zap,
  Search, Loader2
} from 'lucide-react';

export default function BenchmarkSuite() {
  const [report, setReport] = useState(null);
  const [running, setRunning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sampleFilter, setSampleFilter] = useState('all'); // all, passed, failed
  const [searchQuery, setSearchQuery] = useState('');

  async function loadBenchmark() {
    setLoading(true);
    try {
      const res = await api.getLatestEvaluation();
      setReport(res);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadBenchmark();
  }, []);

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

  const sampleResults = report?.sample_results || [];
  const passedSamplesCount = sampleResults.filter(s => s.passed).length;
  const failedSamplesCount = sampleResults.length - passedSamplesCount;
  const passRate = sampleResults.length > 0
    ? Math.round((passedSamplesCount / sampleResults.length) * 100)
    : 0;

  const filteredSamples = sampleResults.filter(sample => {
    const matchesFilter =
      sampleFilter === 'all'
        ? true
        : sampleFilter === 'passed'
        ? sample.passed
        : !sample.passed;

    const matchesSearch =
      !searchQuery.trim() ||
      sample.sample_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sample.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sample.expected_rules.some(r => r.toLowerCase().includes(searchQuery.toLowerCase())) ||
      sample.detected_rules.some(r => r.toLowerCase().includes(searchQuery.toLowerCase()));

    return matchesFilter && matchesSearch;
  });

  return (
    <div className="space-y-6 motion-safe:animate-fade-in">
      {/* Header Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#1F2A4A] pb-4">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#4F6BED]/15 border border-[#4F6BED]/30 flex items-center justify-center text-[#4F6BED]">
              <TestTube2 className="w-4 h-4" />
            </div>
            <h2 className="text-base sm:text-lg font-bold text-[#E8ECF8]">
              Round 3 Success Metrics Benchmark Suite
            </h2>
            <span className="text-[11px] bg-[#4F6BED]/10 text-[#60A5FA] border border-[#4F6BED]/20 px-2.5 py-0.5 rounded-full font-mono font-medium">
              Section 9.1 Verification
            </span>
          </div>
          <p className="text-xs text-[#7C88AB] mt-1 ml-10.5">
            Validating the intelligent brand-governance platform on labelled test drafts against all target success criteria.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          {report?.run_timestamp && (
            <span className="hidden md:inline-block text-[11px] font-mono text-[#7C88AB]">
              Executed: {new Date(report.run_timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          )}

          <button
            type="button"
            onClick={handleRun}
            disabled={running}
            className="flex items-center space-x-2 bg-gradient-to-r from-[#36D6A0] to-[#059669] hover:from-[#45E6AE] hover:to-[#10B981] text-[#101613] px-4 py-2 rounded-xl text-xs font-bold shadow-lg shadow-[#36D6A0]/20 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {running ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Play className="w-3.5 h-3.5 fill-current" />
            )}
            <span>{running ? 'Executing Labelled Benchmark...' : 'Execute Labelled Benchmark'}</span>
          </button>
        </div>
      </div>

      {loading && !report ? (
        <div className="space-y-4 py-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(n => (
              <div key={n} className="bg-[#111830] border border-[#1F2A4A] rounded-2xl p-5 space-y-3 animate-pulse">
                <div className="h-4 w-28 bg-[#172040] rounded" />
                <div className="h-8 w-20 bg-[#172040] rounded" />
                <div className="h-3 w-40 bg-[#172040] rounded" />
              </div>
            ))}
          </div>
        </div>
      ) : report ? (
        <div className="space-y-6">
          {/* Target Success Metrics Cards (from Section 9.1 Table) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {report.metrics_summary.map((m, idx) => {
              const metricTitle = m.metric.split('(')[0].trim();
              const isPassed = m.passed;
              return (
                <div
                  key={idx}
                  className={`bg-[#111830] border rounded-2xl p-4 sm:p-5 space-y-3 transition-all shadow-xl relative overflow-hidden group ${
                    isPassed
                      ? 'border-[#34D399]/40 hover:border-[#34D399] shadow-[#34D399]/5'
                      : 'border-[#F87171]/40 hover:border-[#F87171] shadow-[#F87171]/5'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-xs font-semibold text-[#E8ECF8] line-clamp-1" title={m.metric}>
                      {metricTitle}
                    </span>
                    {isPassed ? (
                      <span className="bg-[#34D399]/15 text-[#34D399] border border-[#34D399]/30 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shrink-0">
                        <CheckCircle2 className="w-3 h-3" /> PASSED
                      </span>
                    ) : (
                      <span className="bg-[#F87171]/15 text-[#F87171] border border-[#F87171]/30 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shrink-0">
                        <XCircle className="w-3 h-3" /> FAILED
                      </span>
                    )}
                  </div>

                  <div className="flex items-baseline space-x-2">
                    <span className="text-2xl sm:text-3xl font-extrabold text-[#E8ECF8] font-mono">
                      {m.measured}
                    </span>
                    <span className="text-xs text-[#7C88AB] font-mono">
                      Target: <span className="text-[#AAB4D0] font-semibold">{m.target}</span>
                    </span>
                  </div>

                  <div className="w-full bg-[#0A0F1E] h-1.5 rounded-full overflow-hidden border border-[#1F2A4A]/60">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${
                        isPassed ? 'bg-[#34D399]' : 'bg-[#F87171]'
                      }`}
                      style={{ width: isPassed ? '100%' : '50%' }}
                    />
                  </div>

                  <p className="text-[11px] text-[#7C88AB] leading-relaxed">
                    {m.details}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Test Samples Execution Log */}
          <div className="bg-[#111830] border border-[#1F2A4A] rounded-2xl p-5 sm:p-6 space-y-4 shadow-xl">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1F2A4A] pb-3.5">
              <div className="flex items-center space-x-2">
                <ShieldCheck className="w-4 h-4 text-[#34D399]" />
                <h3 className="text-sm font-bold text-[#E8ECF8] uppercase tracking-wider">
                  Labelled Test Cases Execution Results
                </h3>
              </div>

              <div className="flex items-center space-x-2 text-xs font-mono">
                <span className="bg-[#0E1428] border border-[#1F2A4A] px-2.5 py-1 rounded-lg text-[#34D399] font-bold">
                  {passedSamplesCount}/{sampleResults.length} Passed ({passRate}%)
                </span>
              </div>
            </div>

            {/* Filter and Search Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center space-x-1.5 text-xs">
                <button
                  type="button"
                  onClick={() => setSampleFilter('all')}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all ${
                    sampleFilter === 'all'
                      ? 'bg-[#172040] border-[#4F6BED] text-[#E8ECF8]'
                      : 'bg-[#0E1428] border-[#1F2A4A] text-[#7C88AB] hover:text-[#E8ECF8]'
                  }`}
                >
                  All Samples ({sampleResults.length})
                </button>
                <button
                  type="button"
                  onClick={() => setSampleFilter('passed')}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all ${
                    sampleFilter === 'passed'
                      ? 'bg-[#172040] border-[#4F6BED] text-[#E8ECF8]'
                      : 'bg-[#0E1428] border-[#1F2A4A] text-[#7C88AB] hover:text-[#E8ECF8]'
                  }`}
                >
                  Passed ({passedSamplesCount})
                </button>
                <button
                  type="button"
                  onClick={() => setSampleFilter('failed')}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all ${
                    sampleFilter === 'failed'
                      ? 'bg-[#172040] border-[#4F6BED] text-[#E8ECF8]'
                      : 'bg-[#0E1428] border-[#1F2A4A] text-[#7C88AB] hover:text-[#E8ECF8]'
                  }`}
                >
                  Mismatches ({failedSamplesCount})
                </button>
              </div>

              <div className="relative min-w-[200px]">
                <Search className="w-3.5 h-3.5 text-[#7C88AB] absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search test samples or rule..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full bg-[#0E1428] border border-[#1F2A4A] rounded-xl pl-8 pr-3 py-1.5 text-xs text-[#E8ECF8] placeholder-[#7C88AB] focus:outline-none focus:border-[#4F6BED]"
                />
              </div>
            </div>

            {/* Test Sample Cards */}
            <div className="space-y-3">
              {filteredSamples.length === 0 ? (
                <div className="p-8 text-center bg-[#0E1428] border border-[#1F2A4A] rounded-xl text-xs text-[#7C88AB] italic">
                  No labelled samples match your filter criteria.
                </div>
              ) : (
                filteredSamples.map(sample => (
                  <div
                    key={sample.sample_id}
                    className={`bg-[#0E1428] border rounded-xl p-4 space-y-2.5 text-xs transition-colors ${
                      sample.passed
                        ? 'border-[#1F2A4A] hover:border-[#34D399]/40'
                        : 'border-[#F87171]/40 hover:border-[#F87171]'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center space-x-2">
                        <span className="font-mono text-[#60A5FA] font-bold bg-[#4F6BED]/10 border border-[#4F6BED]/20 px-2 py-0.5 rounded-lg">
                          {sample.sample_id}
                        </span>
                        <span className="font-semibold text-[#E8ECF8]">{sample.title}</span>
                      </div>

                      <div className="flex items-center space-x-2.5 text-[11px]">
                        <span className="text-[#7C88AB] font-mono flex items-center gap-1 bg-[#111830] border border-[#1F2A4A] px-2 py-0.5 rounded-lg">
                          <Zap className="w-3 h-3 text-[#FBBF24]" />
                          {(sample.latency_seconds * 1000).toFixed(0)} ms
                        </span>
                        <span className={`px-2.5 py-0.5 rounded-full font-bold uppercase text-[10px] tracking-wide border ${
                          sample.passed
                            ? 'bg-[#34D399]/15 text-[#34D399] border-[#34D399]/30'
                            : 'bg-[#F87171]/15 text-[#F87171] border-[#F87171]/30'
                        }`}>
                          {sample.passed ? 'Exact Match' : 'Mismatch'}
                        </span>
                      </div>
                    </div>

                    <p className="text-[#AAB4D0] italic bg-[#0A0F1E] border border-[#1F2A4A]/60 p-2.5 rounded-lg font-mono text-[11px] leading-relaxed">
                      "{sample.content_preview}"
                    </p>

                    <div className="flex flex-wrap items-center gap-4 pt-1 text-[11px]">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[#7C88AB] font-medium">Expected Ground Truth:</span>
                        {sample.expected_rules.length === 0 ? (
                          <span className="text-[#34D399] font-semibold bg-[#34D399]/10 border border-[#34D399]/20 px-2 py-0.5 rounded">
                            None (Compliant)
                          </span>
                        ) : (
                          sample.expected_rules.map(r => (
                            <span
                              key={r}
                              className="bg-[#172040] text-[#AAB4D0] border border-[#1F2A4A] px-1.5 py-0.5 rounded font-mono font-bold"
                            >
                              {r}
                            </span>
                          ))
                        )}
                      </div>

                      <div className="text-[#1F2A4A] hidden sm:inline">|</div>

                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[#7C88AB] font-medium">Detected AI Flags:</span>
                        {sample.detected_rules.length === 0 ? (
                          <span className="text-[#34D399] font-semibold bg-[#34D399]/10 border border-[#34D399]/20 px-2 py-0.5 rounded">
                            None (Clean)
                          </span>
                        ) : (
                          sample.detected_rules.map(r => {
                            const isExpected = sample.expected_rules.includes(r);
                            return (
                              <span
                                key={r}
                                className={`px-1.5 py-0.5 rounded font-mono font-bold border ${
                                  isExpected
                                    ? 'bg-[#4F6BED]/15 text-[#60A5FA] border-[#4F6BED]/30'
                                    : 'bg-[#F87171]/15 text-[#F87171] border-[#F87171]/30'
                                }`}
                              >
                                {r}
                              </span>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-[#111830] border border-[#1F2A4A] rounded-2xl p-10 text-center space-y-4">
          <TestTube2 className="w-10 h-10 text-[#4F6BED] mx-auto opacity-60" />
          <h3 className="text-sm font-bold text-[#E8ECF8]">No Benchmark Run Yet</h3>
          <p className="text-xs text-[#7C88AB] max-w-md mx-auto">
            Execute the labelled dataset benchmark to measure flag precision, turnaround improvements, first-pass compliance, and scan latencies.
          </p>
          <button
            type="button"
            onClick={handleRun}
            disabled={running}
            className="bg-[#4F6BED] hover:bg-[#6479F2] text-white px-5 py-2.5 rounded-xl text-xs font-bold shadow-lg shadow-[#4F6BED]/25 transition-all"
          >
            Run Initial Benchmark
          </button>
        </div>
      )}
    </div>
  );
}
