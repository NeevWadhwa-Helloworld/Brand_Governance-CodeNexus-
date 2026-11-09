import React, { useState, useEffect } from 'react';
import { api } from '../api';
import {
  TestTube2, CheckCircle2, XCircle, Play, ShieldCheck, Zap,
  Search, Loader2
} from 'lucide-react';

export default function BenchmarkSuite({ currentUser }) {
  const [report, setReport] = useState(null);
  const [dataset, setDataset] = useState({ samples: [], active_rule_ids: [] });
  const [running, setRunning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [savingSample, setSavingSample] = useState(false);
  const [sampleFormOpen, setSampleFormOpen] = useState(false);
  const [sampleFormError, setSampleFormError] = useState('');
  const [sampleTitle, setSampleTitle] = useState('');
  const [sampleType, setSampleType] = useState('text');
  const [sampleContent, setSampleContent] = useState('');
  const [expectedRules, setExpectedRules] = useState('');
  const [applicableRules, setApplicableRules] = useState('');
  const [labelNotes, setLabelNotes] = useState('');
  const [sampleFile, setSampleFile] = useState(null);
  const [sampleFilter, setSampleFilter] = useState('all'); // all, passed, failed
  const [searchQuery, setSearchQuery] = useState('');

  async function loadBenchmark() {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getLatestEvaluation();
      setReport(res);
      setDataset(await api.getEvaluationSamples());
    } catch (e) {
      console.error(e);
      setError(e.message || 'Failed to load the latest benchmark.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadBenchmark();
  }, []);

  async function handleRun() {
    setRunning(true);
    setError(null);
    try {
      const res = await api.runEvaluation();
      setReport(res);
      setDataset(await api.getEvaluationSamples());
    } catch (e) {
      console.error(e);
      setError(e.message || 'Benchmark execution failed.');
    } finally {
      setRunning(false);
    }
  }

  async function handleSaveSample(event) {
    event.preventDefault();
    setSavingSample(true);
    setSampleFormError('');
    try {
      const formData = new FormData();
      formData.append('title', sampleTitle);
      formData.append('content_type', sampleType);
      formData.append('content_text', sampleContent);
      formData.append('expected_rules', JSON.stringify(parseRuleIds(expectedRules)));
      formData.append('applicable_rules', JSON.stringify(parseRuleIds(applicableRules)));
      formData.append('label_notes', labelNotes);
      if (sampleFile) formData.append('media_file', sampleFile);
      await api.createEvaluationSample(formData);
      setSampleTitle('');
      setSampleType('text');
      setSampleContent('');
      setExpectedRules('');
      setApplicableRules('');
      setLabelNotes('');
      setSampleFile(null);
      setSampleFormOpen(false);
      await loadBenchmark();
    } catch (e) {
      console.error(e);
      setSampleFormError(e.message || 'Could not save reviewed example.');
    } finally {
      setSavingSample(false);
    }
  }

  function parseRuleIds(value) {
    return [...new Set(value.split(',').map(rule => rule.trim()).filter(Boolean))];
  }

  function addApplicableRule(ruleId) {
    const ids = parseRuleIds(applicableRules);
    if (!ids.includes(ruleId)) setApplicableRules([...ids, ruleId].join(', '));
  }

  const sampleResults = report?.sample_results || [];
  const isSamplePassed = (s) => Boolean(s.passed ?? s.exact_rule_match);
  const passedSamplesCount = sampleResults.filter(isSamplePassed).length;
  const failedSamplesCount = sampleResults.length - passedSamplesCount;
  const passRate = sampleResults.length > 0
    ? Math.round((passedSamplesCount / sampleResults.length) * 100)
    : null;

  const filteredSamples = sampleResults.filter(sample => {
    const passed = isSamplePassed(sample);
    const matchesFilter =
      sampleFilter === 'all'
        ? true
        : sampleFilter === 'passed'
        ? passed
        : !passed;

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
              Evaluation benchmarks
            </h2>
          </div>
          <p className="text-xs text-[#7C88AB] mt-1 ml-10.5">
            Evaluate scans against reviewer-labeled examples. Synthetic fixtures are not counted as quality evidence.
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
            disabled={running || loading}
            className="flex items-center space-x-2 bg-gradient-to-r from-[#36D6A0] to-[#059669] hover:from-[#45E6AE] hover:to-[#10B981] text-[#101613] px-4 py-2 rounded-xl text-xs font-bold shadow-lg shadow-[#36D6A0]/20 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {running ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Play className="w-3.5 h-3.5 fill-current" />
            )}
            <span>{running ? 'Running benchmark...' : 'Run benchmark'}</span>
          </button>
        </div>
      </div>

      {error && (
        <div role="alert" className="rounded-xl border border-[#F87171]/40 bg-[#F87171]/10 px-4 py-3 text-xs text-[#F87171] flex flex-wrap items-center justify-between gap-3">
          <span>{error}</span>
          <button
            type="button"
            onClick={loadBenchmark}
            disabled={loading || running}
            className="rounded-lg border border-[#F87171]/40 px-3 py-1.5 font-semibold hover:bg-[#F87171]/10 disabled:opacity-60"
          >
            {loading ? 'Retrying...' : 'Retry'}
          </button>
        </div>
      )}

      {report && (
        <div className="space-y-4 rounded-2xl border border-[#FBBF24]/30 bg-[#FBBF24]/5 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-[#E8ECF8]">Human-reviewed evaluation dataset</h3>
              <p className="mt-1 text-xs text-[#AAB4D0]">
                {report.dataset_provenance} · {report.total_test_samples} sample(s) · {report.dataset_version}
              </p>
            </div>
            {['reviewer', 'admin'].includes(currentUser?.role) && (
              <button
                type="button"
                onClick={() => setSampleFormOpen(value => !value)}
                className="rounded-lg border border-[#4F6BED]/40 bg-[#4F6BED]/15 px-3 py-1.5 text-xs font-semibold text-[#AAB4D0] hover:text-white"
              >
                {sampleFormOpen ? 'Cancel' : 'Add human-reviewed sample'}
              </button>
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {Object.entries(report.metrics_by_content_type || {}).map(([type, metrics]) => (
              <div key={type} className="rounded-xl border border-[#1F2A4A] bg-[#0E1428] p-3 text-xs">
                <div className="font-bold capitalize text-[#E8ECF8]">{type} · {metrics.sample_count} samples</div>
                <div className="mt-1 text-[#AAB4D0]">
                  Precision {metrics.precision ?? '—'}% · Recall {metrics.recall ?? '—'}% · FP {metrics.fp}
                </div>
                <div className="mt-1 text-[#7C88AB]">
                  Retrieval {metrics.rule_retrieval_coverage ?? '—'}% · Mean {metrics.mean_latency_seconds ?? '—'}s · p95 {metrics.p95_latency_seconds ?? '—'}s
                </div>
                {metrics.media_sample_count > 0 && (
                  <div className="mt-1 text-[#7C88AB]">
                    Extraction complete {metrics.media_extraction_complete}/{metrics.media_sample_count}
                  </div>
                )}
              </div>
            ))}
          </div>
          <ul className="list-disc space-y-1 pl-5 text-[11px] text-[#AAB4D0]">
            {(report.dataset_limitations || []).map((limitation, index) => <li key={index}>{limitation}</li>)}
          </ul>

          {dataset.samples.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-[#E8ECF8]">Dataset examples</h4>
              <div className="grid gap-2 sm:grid-cols-2">
                {dataset.samples.map(sample => (
                  <div key={sample.id} className="rounded-lg border border-[#1F2A4A] bg-[#0E1428] p-3 text-[11px]">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-semibold text-[#E8ECF8]">{sample.title}</span>
                      <span className="capitalize text-[#7C88AB]">{sample.content_type} · {sample.reviewer_name}</span>
                    </div>
                    <span className={`mt-1 inline-flex rounded border px-1.5 py-0.5 text-[10px] font-semibold ${
                      sample.is_demo
                        ? 'border-[#FBBF24]/30 bg-[#FBBF24]/10 text-[#FBBF24]'
                        : 'border-[#34D399]/30 bg-[#34D399]/10 text-[#34D399]'
                    }`}>
                      {sample.is_demo ? 'Seeded demo · excluded from metrics' : 'Reviewer-labeled'}
                    </span>
                    <p className="mt-1 text-[#AAB4D0]">
                      Violations: {sample.expected_rules.length ? sample.expected_rules.join(', ') : 'None (benign)'}
                    </p>
                    {sample.label_notes && <p className="mt-1 text-[#7C88AB]">{sample.label_notes}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {sampleFormOpen && (
            <form onSubmit={handleSaveSample} className="space-y-3 rounded-xl border border-[#1F2A4A] bg-[#0E1428] p-4">
              <p className="text-xs text-[#AAB4D0]">
                Only a reviewer/admin can label cases. For media, upload the original file and enter the human-verified transcript/caption evidence. Add every applicable active rule, and identify which rules are actual violations. Benign near-misses should have no expected violation rules.
              </p>
              <input
                required
                maxLength={200}
                value={sampleTitle}
                onChange={event => setSampleTitle(event.target.value)}
                placeholder="Example title (e.g. benign near-miss: informal greeting)"
                className="w-full rounded-lg border border-[#1F2A4A] bg-[#111830] px-3 py-2 text-xs text-[#E8ECF8]"
              />
              <select
                value={sampleType}
                onChange={event => {
                  setSampleType(event.target.value);
                  setSampleFile(null);
                }}
                className="rounded-lg border border-[#1F2A4A] bg-[#111830] px-3 py-2 text-xs text-[#E8ECF8]"
              >
                <option value="text">Text</option>
                <option value="audio">Audio</option>
                <option value="video">Video</option>
              </select>
              {sampleType !== 'text' && (
                <input
                  type="file"
                  required
                  accept={sampleType === 'audio' ? 'audio/*' : 'video/*'}
                  onChange={event => setSampleFile(event.target.files?.[0] || null)}
                  className="block w-full text-xs text-[#AAB4D0]"
                />
              )}
              <textarea
                required
                maxLength={50000}
                rows={4}
                value={sampleContent}
                onChange={event => setSampleContent(event.target.value)}
                placeholder={sampleType === 'text' ? 'Reviewed example content' : 'Human-verified transcript, captions, and relevant on-screen text'}
                className="w-full rounded-lg border border-[#1F2A4A] bg-[#111830] px-3 py-2 text-xs text-[#E8ECF8]"
              />
              <div className="grid gap-3 md:grid-cols-2">
                <input
                  value={expectedRules}
                  onChange={event => setExpectedRules(event.target.value)}
                  placeholder="Expected violation rule IDs (comma-separated; empty for benign)"
                  className="w-full rounded-lg border border-[#1F2A4A] bg-[#111830] px-3 py-2 text-xs text-[#E8ECF8]"
                />
                <input
                  required
                  value={applicableRules}
                  onChange={event => setApplicableRules(event.target.value)}
                  placeholder="Applicable rule IDs (comma-separated)"
                  className="w-full rounded-lg border border-[#1F2A4A] bg-[#111830] px-3 py-2 text-xs text-[#E8ECF8]"
                />
              </div>
              <div className="flex flex-wrap gap-1">
                {(dataset.active_rule_ids || []).map(ruleId => (
                  <button
                    key={ruleId}
                    type="button"
                    onClick={() => addApplicableRule(ruleId)}
                    className="rounded border border-[#1F2A4A] px-1.5 py-0.5 font-mono text-[10px] text-[#60A5FA] hover:border-[#4F6BED]"
                    title="Add this active rule to applicable rules"
                  >
                    {ruleId}
                  </button>
                ))}
              </div>
              <textarea
                rows={2}
                maxLength={2000}
                value={labelNotes}
                onChange={event => setLabelNotes(event.target.value)}
                placeholder="Reviewer rationale / labeling notes"
                className="w-full rounded-lg border border-[#1F2A4A] bg-[#111830] px-3 py-2 text-xs text-[#E8ECF8]"
              />
              {sampleFormError && <p role="alert" className="text-xs text-[#F87171]">{sampleFormError}</p>}
              <button
                type="submit"
                disabled={savingSample}
                className="rounded-lg bg-[#4F6BED] px-4 py-2 text-xs font-semibold text-white disabled:opacity-60"
              >
                {savingSample ? 'Saving reviewed sample...' : 'Save human-reviewed sample'}
              </button>
            </form>
          )}
        </div>
      )}

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
          {/* Measured benchmark metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {report.metrics_summary.map((m, idx) => {
              const metricTitle = m.metric.split('(')[0].trim();
              const isMeasured = m.measured !== 'Not measured';
              const isPassed = m.passed === true;
              return (
                <div
                  key={idx}
                  className={`bg-[#111830] border rounded-2xl p-4 sm:p-5 space-y-3 transition-all shadow-xl relative overflow-hidden group ${
                    !isMeasured
                      ? 'border-[#1F2A4A]'
                      : isPassed
                      ? 'border-[#34D399]/40 hover:border-[#34D399] shadow-[#34D399]/5'
                      : 'border-[#F87171]/40 hover:border-[#F87171] shadow-[#F87171]/5'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-xs font-semibold text-[#E8ECF8] line-clamp-1" title={m.metric}>
                      {metricTitle}
                    </span>
                    {!isMeasured ? (
                      <span className="bg-[#7C88AB]/15 text-[#AAB4D0] border border-[#7C88AB]/30 text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0">
                        NOT MEASURED
                      </span>
                    ) : isPassed ? (
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
                  {sampleResults.length === 0
                    ? 'No labelled samples returned'
                    : `${passedSamplesCount}/${sampleResults.length} Passed (${passRate}%)`}
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
                      isSamplePassed(sample)
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
                          isSamplePassed(sample)
                            ? 'bg-[#34D399]/15 text-[#34D399] border-[#34D399]/30'
                            : 'bg-[#F87171]/15 text-[#F87171] border-[#F87171]/30'
                        }`}>
                          {isSamplePassed(sample) ? 'Exact Match' : 'Mismatch'}
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
            Execute the labelled dataset benchmark to measure rule-detection results, labelled-sample pass rate, and scan duration. Approval turnaround is reported only when real approval cycles exist.
          </p>
          <button
            type="button"
            onClick={handleRun}
            disabled={running || loading}
            className="bg-[#4F6BED] hover:bg-[#6479F2] text-white px-5 py-2.5 rounded-xl text-xs font-bold shadow-lg shadow-[#4F6BED]/25 transition-all"
          >
            Run Initial Benchmark
          </button>
        </div>
      )}
    </div>
  );
}
