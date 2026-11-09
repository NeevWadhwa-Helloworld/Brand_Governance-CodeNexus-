import React, { useState } from 'react';
import {
  Server, Shield, Terminal, Key, Check, Copy, Play, Loader2,
  FileText, BookOpen, AlertCircle, RefreshCw, Lock
} from 'lucide-react';
import { configuredApiOrigin } from '../api';

const MCP_PROTOCOL_VERSION = '2025-11-25';

function parseMcpResponseBody(body, contentType, requestId) {
  if (contentType.includes('text/event-stream')) {
    const messages = body
      .split(/\r?\n\r?\n/)
      .map(event => event.split(/\r?\n/)
        .filter(line => line.startsWith('data:'))
        .map(line => line.slice(5).trimStart())
        .join('\n'))
      .filter(Boolean)
      .map(data => {
        try {
          return JSON.parse(data);
        } catch {
          return null;
        }
      })
      .filter(Boolean);

    return messages.find(message => requestId === undefined || message.id === requestId) || null;
  }

  if (!body) return null;
  try {
    return JSON.parse(body);
  } catch {
    return null;
  }
}

async function sendMcpRequest(endpoint, token, payload, { sessionId, protocolVersion } = {}) {
  const headers = {
    Accept: 'application/json, text/event-stream',
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`
  };
  if (sessionId) headers['Mcp-Session-Id'] = sessionId;
  if (protocolVersion) headers['Mcp-Protocol-Version'] = protocolVersion;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload)
  });
  const body = await response.text();
  const data = parseMcpResponseBody(body, response.headers.get('content-type') || '', payload.id);

  if (!response.ok) {
    let detail = data?.detail || data?.error?.message;
    if (!detail && body && !data) detail = body.slice(0, 300);
    throw new Error(detail || `MCP request failed with HTTP ${response.status}`);
  }
  if (body && !data) {
    throw new Error('The MCP server returned an unreadable response.');
  }
  if (data?.error) {
    throw new Error(data.error.message || 'The MCP server rejected the request.');
  }
  if (data?.result?.isError) {
    const detail = data.result.content
      ?.filter(item => item.type === 'text')
      .map(item => item.text)
      .join('\n');
    throw new Error(detail || 'The MCP tool could not complete the request.');
  }

  return { response, data };
}

export default function MCPHub({ currentUser, showToast }) {
  const [selectedTool, setSelectedTool] = useState('get_brand_rules');
  const [queryInput, setQueryInput] = useState('tone voice forbidden terminology');
  const [draftIdInput, setDraftIdInput] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [limitInput, setLimitInput] = useState(5);
  const [executing, setExecuting] = useState(false);
  const [testResponse, setTestResponse] = useState(null);
  const [testError, setTestError] = useState(null);
  const [copiedConfig, setCopiedConfig] = useState(false);

  const mcpEndpoint = `${configuredApiOrigin}/mcp`;

  const tools = [
    {
      id: 'get_brand_rules',
      name: 'get_brand_rules',
      icon: BookOpen,
      category: 'Brand Policy',
      description: 'Retrieve active organization brand rules, approved terminology, and voice requirements matching a query.',
      parameters: [
        { name: 'query', type: 'string', required: true, description: 'Search keywords or topic (1-2000 chars)' },
        { name: 'limit', type: 'integer', required: false, description: 'Maximum rules to return (1-8, default: 8)' }
      ],
      output: 'BrandRulesResponse { rules: list[BrandRule] }'
    },
    {
      id: 'list_drafts',
      name: 'list_drafts',
      icon: FileText,
      category: 'Governance Pipeline',
      description: 'List metadata for recent content drafts within the authenticated user\'s organization.',
      parameters: [
        { name: 'status', type: 'string', required: false, description: 'Filter by draft status (Submitted, In Revision, Approved, etc.)' },
        { name: 'limit', type: 'integer', required: false, description: 'Result count limit (1-50, default: 20)' }
      ],
      output: 'DraftListResponse { drafts: list[DraftSummary] }'
    },
    {
      id: 'get_draft_findings',
      name: 'get_draft_findings',
      icon: AlertCircle,
      category: 'Compliance Review',
      description: 'Fetch detailed scan findings, rule citations, spans, frame numbers, and coverage status for a draft.',
      parameters: [
        { name: 'draft_id', type: 'string', required: true, description: 'Target draft identifier' }
      ],
      output: 'DraftFindingsResponse { draft_id, policy_coverage_status, findings: list[DraftFinding] }'
    }
  ];

  async function handleExecuteTool() {
    setExecuting(true);
    setTestError(null);
    setTestResponse(null);

    const token = localStorage.getItem('access_token');
    let sessionId;
    let protocolVersion;
    const requestId = Date.now();
    const draftId = draftIdInput.trim();
    const callPayload = {
      jsonrpc: '2.0',
      id: requestId + 2,
      method: 'tools/call',
      params: {
        name: selectedTool,
        arguments: selectedTool === 'get_brand_rules'
          ? { query: queryInput, limit: Number(limitInput) || 5 }
          : selectedTool === 'list_drafts'
          ? { status: statusFilter || undefined, limit: Number(limitInput) || 10 }
          : { draft_id: draftId }
      }
    };

    try {
      if (!token) {
        throw new Error('Your sign-in has expired. Sign in again before calling an MCP tool.');
      }
      if (selectedTool === 'get_draft_findings' && !draftId) {
        throw new Error('First run list_drafts and use a draft_id from its results. Draft IDs are limited to your organization.');
      }

      const { response: initializeResponse, data: initializeData } = await sendMcpRequest(
        mcpEndpoint,
        token,
        {
          jsonrpc: '2.0',
          id: requestId,
          method: 'initialize',
          params: {
            protocolVersion: MCP_PROTOCOL_VERSION,
            capabilities: {},
            clientInfo: { name: 'inkloom-web-test-bench', version: '1.0.0' }
          }
        }
      );
      sessionId = initializeResponse.headers.get('mcp-session-id');
      protocolVersion = initializeData?.result?.protocolVersion;
      if (!sessionId || !protocolVersion) {
        throw new Error(
          'The MCP server did not start a session. Check the backend URL and its MCP CORS configuration.'
        );
      }

      await sendMcpRequest(
        mcpEndpoint,
        token,
        { jsonrpc: '2.0', method: 'notifications/initialized' },
        { sessionId, protocolVersion }
      );

      const { data } = await sendMcpRequest(
        mcpEndpoint,
        token,
        callPayload,
        { sessionId, protocolVersion }
      );
      setTestResponse(data);
      if (showToast) showToast('MCP tool executed successfully', 'success');
    } catch (e) {
      console.error(e);
      setTestError(e.message || 'Failed to execute tool on MCP server');
      if (showToast) showToast(e.message, 'error');
    } finally {
      if (token && sessionId) {
        const headers = {
          Authorization: `Bearer ${token}`,
          'Mcp-Session-Id': sessionId,
          ...(protocolVersion ? { 'Mcp-Protocol-Version': protocolVersion } : {})
        };
        try {
          const closeResponse = await fetch(mcpEndpoint, { method: 'DELETE', headers });
          if (!closeResponse.ok && closeResponse.status !== 405) {
            console.warn(`MCP session cleanup failed with HTTP ${closeResponse.status}`);
          }
        } catch (error) {
          console.warn('MCP session cleanup failed.', error);
        }
      }
      setExecuting(false);
    }
  }

  const clientEndpoint = configuredApiOrigin
    ? `${configuredApiOrigin}/mcp`
    : 'http://localhost:8000/mcp';
  const clientConfig = {
    servers: {
      inkloom: {
        type: 'http',
        url: clientEndpoint,
        headers: {
          Authorization: 'Bearer ${input:inkloomToken}'
        }
      }
    },
    inputs: [
      {
        type: 'promptString',
        id: 'inkloomToken',
        description: 'Inkloom access token',
        password: true
      }
    ]
  };

  function copyConfig() {
    navigator.clipboard.writeText(JSON.stringify(clientConfig, null, 2));
    setCopiedConfig(true);
    setTimeout(() => setCopiedConfig(false), 2500);
    if (showToast) showToast('MCP client config copied to clipboard', 'info');
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#1F2A4A] pb-5">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-[#60A5FA]/15 text-[#60A5FA] rounded-xl border border-[#60A5FA]/30">
              <Server className="w-5 h-5" />
            </div>
            <h1 className="text-xl font-bold text-[#E8ECF8]">
              Model Context Protocol (MCP) Server
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#34D399]/15 text-[#34D399] border border-[#34D399]/30">
              Live • HTTP Streamable
            </span>
          </div>
          <p className="text-xs text-[#7C88AB] mt-1 ml-9.5">
            Phase 1 Highest Priority: Standardized, read-only AI agent interface with strict organizational scoping and token authorization.
          </p>
        </div>

        <button
          type="button"
          onClick={copyConfig}
          className="flex items-center space-x-2 rounded-xl bg-[#111830] hover:bg-[#172040] border border-[#1F2A4A] px-3.5 py-2 text-xs font-semibold text-[#E8ECF8] transition-all"
        >
          {copiedConfig ? <Check className="w-4 h-4 text-[#34D399]" /> : <Copy className="w-4 h-4 text-[#60A5FA]" />}
          <span>{copiedConfig ? 'Config Copied' : 'Copy VS Code MCP JSON'}</span>
        </button>
      </div>

      {/* Security Guarantees Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-[#1F2A4A] bg-[#111830] p-4 space-y-1.5">
          <div className="flex items-center space-x-2 text-[#60A5FA]">
            <Key className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-wider text-[#AAB4D0]">Bearer Auth</span>
          </div>
          <p className="text-sm font-semibold text-[#E8ECF8]">Token Enforced</p>
          <p className="text-[11px] text-[#7C88AB]">
            Reuses application JWT authorization. Unauthenticated calls are rejected with 401.
          </p>
        </div>

        <div className="rounded-2xl border border-[#1F2A4A] bg-[#111830] p-4 space-y-1.5">
          <div className="flex items-center space-x-2 text-[#34D399]">
            <Shield className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-wider text-[#AAB4D0]">Tenant Isolation</span>
          </div>
          <p className="text-sm font-semibold text-[#E8ECF8]">Multi-Tenant Scoped</p>
          <p className="text-[11px] text-[#7C88AB]">
            Strictly limited to the user's organization ({currentUser?.org_id || 'org_inkloom'}). Cross-tenant requests are denied and audited.
          </p>
        </div>

        <div className="rounded-2xl border border-[#1F2A4A] bg-[#111830] p-4 space-y-1.5">
          <div className="flex items-center space-x-2 text-[#FBBF24]">
            <Lock className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-wider text-[#AAB4D0]">Least Privilege</span>
          </div>
          <p className="text-sm font-semibold text-[#E8ECF8]">Read-Only Safety</p>
          <p className="text-[11px] text-[#7C88AB]">
            Tools cannot mutate drafts, approve content, or access files. Model suggestions stay separate from state changes.
          </p>
        </div>

        <div className="rounded-2xl border border-[#1F2A4A] bg-[#111830] p-4 space-y-1.5">
          <div className="flex items-center space-x-2 text-[#A78BFA]">
            <RefreshCw className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-wider text-[#AAB4D0]">Rate Limiting</span>
          </div>
          <p className="text-sm font-semibold text-[#E8ECF8]">60 Req / Minute</p>
          <p className="text-[11px] text-[#7C88AB]">
            Sliding-window rate limiter per user. Tool call events logged directly to hash-linked audit chain.
          </p>
        </div>
      </div>

      {/* Main Content: Tools Explorer & Interactive Test Bench */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Registered Tools List (5 cols) */}
        <div className="lg:col-span-5 space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-[#AAB4D0] px-1">
            Registered MCP Tools ({tools.length})
          </h2>

          <div className="space-y-3">
            {tools.map(tool => {
              const ToolIcon = tool.icon;
              const isSelected = selectedTool === tool.id;
              return (
                <button
                  key={tool.id}
                  type="button"
                  onClick={() => {
                    setSelectedTool(tool.id);
                    setTestResponse(null);
                    setTestError(null);
                  }}
                  className={`w-full text-left rounded-2xl border p-4 transition-all ${
                    isSelected
                      ? 'border-[#60A5FA] bg-[#60A5FA]/10 shadow-lg shadow-[#60A5FA]/5'
                      : 'border-[#1F2A4A] bg-[#111830] hover:border-[#2E3C66]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center space-x-2.5">
                      <div className={`p-2 rounded-xl ${isSelected ? 'bg-[#60A5FA] text-black font-bold' : 'bg-[#0E1428] text-[#60A5FA]'}`}>
                        <ToolIcon className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="font-mono text-xs font-bold text-[#E8ECF8]">{tool.name}</div>
                        <div className="text-[10px] text-[#7C88AB]">{tool.category}</div>
                      </div>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#0E1428] text-[#34D399] border border-[#1F2A4A]">
                      read-only
                    </span>
                  </div>

                  <p className="text-xs text-[#AAB4D0] mt-3 leading-relaxed">
                    {tool.description}
                  </p>

                  <div className="mt-3 pt-2.5 border-t border-[#1F2A4A]/60 flex flex-wrap gap-1.5">
                    {tool.parameters.map(p => (
                      <span key={p.name} className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#0A0F1E] text-[#AAB4D0]">
                        {p.name}: {p.type}{p.required ? ' *' : ''}
                      </span>
                    ))}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: Interactive Test Bench (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="rounded-2xl border border-[#1F2A4A] bg-[#111830] p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-[#1F2A4A] pb-3">
              <div className="flex items-center space-x-2">
                <Terminal className="w-4 h-4 text-[#34D399]" />
                <h3 className="text-sm font-bold text-[#E8ECF8]">Interactive MCP Test Bench</h3>
              </div>
              <span className="text-xs font-mono text-[#60A5FA]">
                Selected: {selectedTool}
              </span>
            </div>

            {/* Tool Arguments Form */}
            <div className="space-y-3">
              {selectedTool === 'get_brand_rules' && (
                <>
                  <div>
                    <label className="block text-xs font-medium text-[#AAB4D0] mb-1">
                      Query (Search Guidelines & Rules)
                    </label>
                    <input
                      type="text"
                      value={queryInput}
                      onChange={e => setQueryInput(e.target.value)}
                      placeholder="e.g. tone voice banned terms"
                      className="w-full rounded-xl border border-[#1F2A4A] bg-[#0E1428] px-3.5 py-2 text-xs text-[#E8ECF8] focus:border-[#60A5FA] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#AAB4D0] mb-1">
                      Limit (Max Rules 1–8)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="8"
                      value={limitInput}
                      onChange={e => setLimitInput(e.target.value)}
                      className="w-24 rounded-xl border border-[#1F2A4A] bg-[#0E1428] px-3.5 py-2 text-xs text-[#E8ECF8] focus:border-[#60A5FA] focus:outline-none"
                    />
                  </div>
                </>
              )}

              {selectedTool === 'list_drafts' && (
                <>
                  <div>
                    <label className="block text-xs font-medium text-[#AAB4D0] mb-1">
                      Status Filter (Optional)
                    </label>
                    <select
                      value={statusFilter}
                      onChange={e => setStatusFilter(e.target.value)}
                      className="w-full rounded-xl border border-[#1F2A4A] bg-[#0E1428] px-3.5 py-2 text-xs text-[#E8ECF8] focus:border-[#60A5FA] focus:outline-none"
                    >
                      <option value="">All Statuses</option>
                      <option value="Submitted">Submitted</option>
                      <option value="In Revision">In Revision</option>
                      <option value="Pending Approval">Pending Approval</option>
                      <option value="Approved">Approved</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#AAB4D0] mb-1">
                      Limit (1–50)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="50"
                      value={limitInput}
                      onChange={e => setLimitInput(e.target.value)}
                      className="w-24 rounded-xl border border-[#1F2A4A] bg-[#0E1428] px-3.5 py-2 text-xs text-[#E8ECF8] focus:border-[#60A5FA] focus:outline-none"
                    />
                  </div>
                </>
              )}

              {selectedTool === 'get_draft_findings' && (
                <div>
                  <label className="block text-xs font-medium text-[#AAB4D0] mb-1">
                    Draft ID
                  </label>
                  <input
                    type="text"
                    value={draftIdInput}
                    onChange={e => setDraftIdInput(e.target.value)}
                    placeholder="Paste a draft_id from list_drafts"
                    className="w-full rounded-xl border border-[#1F2A4A] bg-[#0E1428] px-3.5 py-2 text-xs text-[#E8ECF8] focus:border-[#60A5FA] focus:outline-none font-mono"
                  />
                  <p className="mt-1 text-[11px] text-[#7C88AB]">
                    Run <span className="font-mono">list_drafts</span> first, then paste a draft ID from its results. Only drafts in your organization are available.
                  </p>
                </div>
              )}

              <button
                type="button"
                onClick={handleExecuteTool}
                disabled={executing}
                className="flex items-center space-x-2 rounded-xl bg-[#60A5FA] hover:bg-[#3B82F6] text-black font-bold px-4 py-2.5 text-xs transition-all disabled:opacity-50"
              >
                {executing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-black" />
                    <span>Calling MCP Server...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Execute MCP Tool Call</span>
                  </>
                )}
              </button>
            </div>

            {/* Error Message */}
            {testError && (
              <div role="alert" className="rounded-xl border border-[#F87171]/30 bg-[#F87171]/10 p-3 text-xs text-[#F87171]">
                <div className="font-bold">MCP Tool Execution Error:</div>
                <div className="mt-0.5">{testError}</div>
              </div>
            )}

            {/* Live Response Viewer */}
            {testResponse && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs text-[#AAB4D0]">
                  <span className="font-bold">Live Streamable HTTP Response:</span>
                  <span className="font-mono text-[10px] text-[#34D399]">HTTP 200 OK</span>
                </div>
                <pre className="max-h-72 overflow-auto rounded-xl border border-[#1F2A4A] bg-[#0A0F1E] p-3 font-mono text-[11px] text-[#AAB4D0] leading-relaxed">
                  {JSON.stringify(testResponse, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
