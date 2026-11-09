export const configuredApiOrigin = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '');
const API_BASE = `${configuredApiOrigin}/api`;

export function mediaUrl(path) {
  if (!path) return path;
  if (/^https?:\/\//i.test(path)) return path;
  return `${configuredApiOrigin}${path.startsWith('/') ? path : `/${path}`}`;
}

function authHeaders(_userId) {
  const token = localStorage.getItem('access_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function parseResponse(res) {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const error = new Error(
      typeof body.detail === 'string' ? body.detail : `Request failed (${res.status})`
    );
    if (typeof body.draft_id === 'string') {
      error.draftId = body.draft_id;
    }
    throw error;
  }
  return res.json();
}

export const api = {
  // Auth & Personas
  async login(email, password) {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await parseResponse(res);
    localStorage.setItem('access_token', data.access_token);
    return data.user;
  },
  async getUsers() {
    const res = await fetch(`${API_BASE}/auth/users`, { headers: authHeaders() });
    return parseResponse(res);
  },
  async createUser(payload) {
    const res = await fetch(`${API_BASE}/auth/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders()
      },
      body: JSON.stringify(payload)
    });
    return parseResponse(res);
  },
  async getMe(userId) {
    const res = await fetch(`${API_BASE}/auth/me`, {
      headers: authHeaders(userId)
    });
    return parseResponse(res);
  },

  // Drafts
  async getDrafts(status = null) {
    const url = status ? `${API_BASE}/drafts?status=${encodeURIComponent(status)}` : `${API_BASE}/drafts`;
    const res = await fetch(url, { headers: authHeaders() });
    return parseResponse(res);
  },
  async getDraft(draftId) {
    const res = await fetch(`${API_BASE}/drafts/${draftId}`, { headers: authHeaders() });
    return parseResponse(res);
  },
  async createDraft(payload, userId) {
    const res = await fetch(`${API_BASE}/drafts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(userId)
      },
      body: JSON.stringify(payload)
    });
    return parseResponse(res);
  },
  async uploadImageDraft(formData, userId) {
    const res = await fetch(`${API_BASE}/drafts/upload-image`, {
      method: 'POST',
      headers: {
        ...authHeaders(userId)
      },
      body: formData
    });
    return parseResponse(res);
  },
  async uploadMediaDraft(formData) {
    const res = await fetch(`${API_BASE}/drafts/upload-media`, {
      method: 'POST',
      headers: authHeaders(),
      body: formData
    });
    return parseResponse(res);
  },
  async replaceDraftMedia(draftId, formData) {
    const res = await fetch(`${API_BASE}/drafts/${draftId}/replace-media`, {
      method: 'POST',
      headers: authHeaders(),
      body: formData
    });
    return parseResponse(res);
  },
  async updateDraft(draftId, payload, userId) {
    const res = await fetch(`${API_BASE}/drafts/${draftId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(userId)
      },
      body: JSON.stringify(payload)
    });
    return parseResponse(res);
  },
  async updateMediaTranscript(draftId, payload) {
    const res = await fetch(`${API_BASE}/drafts/${draftId}/transcript`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders()
      },
      body: JSON.stringify(payload)
    });
    return parseResponse(res);
  },
  async scanDraft(draftId, userId) {
    const res = await fetch(`${API_BASE}/drafts/${draftId}/scan`, {
      method: 'POST',
      headers: authHeaders(userId)
    });
    return parseResponse(res);
  },
  async submitForApproval(draftId, userId) {
    const res = await fetch(`${API_BASE}/drafts/${draftId}/submit`, {
      method: 'POST',
      headers: authHeaders(userId)
    });
    return parseResponse(res);
  },
  async decideApproval(draftId, decision, comment, userId) {
    const res = await fetch(`${API_BASE}/drafts/${draftId}/decision`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(userId)
      },
      body: JSON.stringify({ decision, comment })
    });
    return parseResponse(res);
  },
  async getComments(draftId) {
    const res = await fetch(`${API_BASE}/drafts/${draftId}/comments`, { headers: authHeaders() });
    return parseResponse(res);
  },
  async postComment(draftId, text, userId) {
    const res = await fetch(`${API_BASE}/drafts/${draftId}/comments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(userId)
      },
      body: JSON.stringify({ text })
    });
    return parseResponse(res);
  },

  // Flags
  async resolveFlag(flagId, resolution, editedFix = null, comment = null, userId) {
    const res = await fetch(`${API_BASE}/flags/${flagId}/resolve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(userId)
      },
      body: JSON.stringify({ resolution, edited_fix: editedFix, comment })
    });
    return parseResponse(res);
  },

  // Guidelines & Brain
  async getRules() {
    const res = await fetch(`${API_BASE}/guidelines/rules`, { headers: authHeaders() });
    return parseResponse(res);
  },
  async createRule(payload, userId) {
    const res = await fetch(`${API_BASE}/guidelines/rules`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(userId)
      },
      body: JSON.stringify(payload)
    });
    return parseResponse(res);
  },
  async deleteRule(ruleId, userId) {
    const res = await fetch(`${API_BASE}/guidelines/rules/${ruleId}`, {
      method: 'DELETE',
      headers: authHeaders(userId)
    });
    return parseResponse(res);
  },
  async ingestGuidelines(payload, userId) {
    const res = await fetch(`${API_BASE}/guidelines/ingest`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(userId)
      },
      body: JSON.stringify(payload)
    });
    return parseResponse(res);
  },
  async getTerminology() {
    const res = await fetch(`${API_BASE}/guidelines/terminology`, { headers: authHeaders() });
    return parseResponse(res);
  },
  async createTerminology(payload, userId) {
    const res = await fetch(`${API_BASE}/guidelines/terminology`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        ...authHeaders(userId)
      },
      body: JSON.stringify(payload)
    });
    return parseResponse(res);
  },
  async deleteTerminology(termId, userId) {
    const res = await fetch(`${API_BASE}/guidelines/terminology/${termId}`, {
      method: 'DELETE',
      headers: authHeaders(userId)
    });
    return parseResponse(res);
  },
  async getFacts() {
    const res = await fetch(`${API_BASE}/guidelines/facts`, { headers: authHeaders() });
    return parseResponse(res);
  },
  async createFact(payload, userId) {
    const res = await fetch(`${API_BASE}/guidelines/facts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(userId)
      },
      body: JSON.stringify(payload)
    });
    return parseResponse(res);
  },
  async updateFact(factId, payload, userId) {
    const res = await fetch(`${API_BASE}/guidelines/facts/${factId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(userId)
      },
      body: JSON.stringify(payload)
    });
    return parseResponse(res);
  },
  async deleteFact(factId, userId) {
    const res = await fetch(`${API_BASE}/guidelines/facts/${factId}`, {
      method: 'DELETE',
      headers: authHeaders(userId)
    });
    return parseResponse(res);
  },
  async getColors() {
    const res = await fetch(`${API_BASE}/guidelines/colors`, { headers: authHeaders() });
    return parseResponse(res);
  },
  async createColor(payload, userId) {
    const res = await fetch(`${API_BASE}/guidelines/colors`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(userId)
      },
      body: JSON.stringify(payload)
    });
    return parseResponse(res);
  },
  async deleteColor(colorId, userId) {
    const res = await fetch(`${API_BASE}/guidelines/colors/${colorId}`, {
      method: 'DELETE',
      headers: authHeaders(userId)
    });
    return parseResponse(res);
  },
  async getLogos() {
    const res = await fetch(`${API_BASE}/guidelines/logos`, { headers: authHeaders() });
    return parseResponse(res);
  },
  async uploadLogo(formData, userId) {
    const res = await fetch(`${API_BASE}/guidelines/logos/upload`, {
      method: 'POST',
      headers: authHeaders(userId),
      body: formData
    });
    return parseResponse(res);
  },
  async deleteLogo(logoId, userId) {
    const res = await fetch(`${API_BASE}/guidelines/logos/${logoId}`, {
      method: 'DELETE',
      headers: authHeaders(userId)
    });
    return parseResponse(res);
  },

  // Analytics & Evaluation
  async getAnalytics() {
    const res = await fetch(`${API_BASE}/analytics/dashboard`, { headers: authHeaders() });
    return parseResponse(res);
  },
  async getAnalyticsTrends() {
    const res = await fetch(`${API_BASE}/analytics/trends`, { headers: authHeaders() });
    return parseResponse(res);
  },
  async runEvaluation() {
    const res = await fetch(`${API_BASE}/evaluation/run`, { method: 'POST', headers: authHeaders() });
    return parseResponse(res);
  },
  async getLatestEvaluation() {
    const res = await fetch(`${API_BASE}/evaluation/latest`, { headers: authHeaders() });
    return parseResponse(res);
  },
  async getEvaluationSamples() {
    const res = await fetch(`${API_BASE}/evaluation/samples`, { headers: authHeaders() });
    return parseResponse(res);
  },
  async createEvaluationSample(formData) {
    const res = await fetch(`${API_BASE}/evaluation/samples`, {
      method: 'POST',
      headers: authHeaders(),
      body: formData
    });
    return parseResponse(res);
  },

  // Audit
  async getAuditLogs(limit = 50, userId) {
    const res = await fetch(`${API_BASE}/audit/logs?limit=${limit}`, {
      headers: authHeaders(userId)
    });
    return parseResponse(res);
  },
  async exportAuditLogs(userId) {
    const res = await fetch(`${API_BASE}/audit/export`, {
      headers: authHeaders(userId)
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.detail || `Request failed (${res.status})`);
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `brand_governance_audit_logs.csv`;
    a.click();
  },
  async getDraftAuditLogs(draftId) {
    const res = await fetch(`${API_BASE}/audit/draft/${draftId}`, { headers: authHeaders() });
    return parseResponse(res);
  },
  async getSystemInfo() {
    const res = await fetch(`${API_BASE}/system-info`, { headers: authHeaders() });
    return parseResponse(res);
  },
  async importIntegrationText(payload) {
    const res = await fetch(`${API_BASE}/integrations/text/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(payload)
    });
    return parseResponse(res);
  },
  async inspectIntegrationMedia(formData) {
    const res = await fetch(`${API_BASE}/integrations/media/inspect`, {
      method: 'POST',
      headers: authHeaders(),
      body: formData
    });
    return parseResponse(res);
  }
};
