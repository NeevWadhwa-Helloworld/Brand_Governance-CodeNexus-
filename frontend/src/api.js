const API_BASE = '/api';

export const api = {
  // Auth & Personas
  async getUsers() {
    const res = await fetch(`${API_BASE}/auth/users`);
    return res.json();
  },
  async getMe(userId) {
    const res = await fetch(`${API_BASE}/auth/me`, {
      headers: { 'x-user-id': userId }
    });
    return res.json();
  },

  // Drafts
  async getDrafts(status = null) {
    const url = status ? `${API_BASE}/drafts?status=${encodeURIComponent(status)}` : `${API_BASE}/drafts`;
    const res = await fetch(url);
    return res.json();
  },
  async getDraft(draftId) {
    const res = await fetch(`${API_BASE}/drafts/${draftId}`);
    return res.json();
  },
  async createDraft(payload, userId) {
    const res = await fetch(`${API_BASE}/drafts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': userId
      },
      body: JSON.stringify(payload)
    });
    return res.json();
  },
  async uploadImageDraft(formData, userId) {
    const res = await fetch(`${API_BASE}/drafts/upload-image`, {
      method: 'POST',
      headers: {
        'x-user-id': userId
      },
      body: formData
    });
    return res.json();
  },
  async updateDraft(draftId, payload, userId) {
    const res = await fetch(`${API_BASE}/drafts/${draftId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': userId
      },
      body: JSON.stringify(payload)
    });
    return res.json();
  },
  async scanDraft(draftId, userId) {
    const res = await fetch(`${API_BASE}/drafts/${draftId}/scan`, {
      method: 'POST',
      headers: { 'x-user-id': userId }
    });
    return res.json();
  },
  async submitForApproval(draftId, userId) {
    const res = await fetch(`${API_BASE}/drafts/${draftId}/submit`, {
      method: 'POST',
      headers: { 'x-user-id': userId }
    });
    return res.json();
  },
  async decideApproval(draftId, decision, comment, userId) {
    const res = await fetch(`${API_BASE}/drafts/${draftId}/decision`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': userId
      },
      body: JSON.stringify({ decision, comment })
    });
    return res.json();
  },
  async getComments(draftId) {
    const res = await fetch(`${API_BASE}/drafts/${draftId}/comments`);
    return res.json();
  },
  async postComment(draftId, text, userId) {
    const res = await fetch(`${API_BASE}/drafts/${draftId}/comments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': userId
      },
      body: JSON.stringify({ text })
    });
    return res.json();
  },

  // Flags
  async resolveFlag(flagId, resolution, editedFix = null, comment = null, userId) {
    const res = await fetch(`${API_BASE}/flags/${flagId}/resolve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': userId
      },
      body: JSON.stringify({ resolution, edited_fix: editedFix, comment })
    });
    return res.json();
  },

  // Guidelines & Brain
  async getRules() {
    const res = await fetch(`${API_BASE}/guidelines/rules`);
    return res.json();
  },
  async createRule(payload, userId) {
    const res = await fetch(`${API_BASE}/guidelines/rules`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': userId
      },
      body: JSON.stringify(payload)
    });
    return res.json();
  },
  async deleteRule(ruleId, userId) {
    const res = await fetch(`${API_BASE}/guidelines/rules/${ruleId}`, {
      method: 'DELETE',
      headers: { 'x-user-id': userId }
    });
    return res.json();
  },
  async ingestGuidelines(payload, userId) {
    const res = await fetch(`${API_BASE}/guidelines/ingest`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': userId
      },
      body: JSON.stringify(payload)
    });
    return res.json();
  },
  async getTerminology() {
    const res = await fetch(`${API_BASE}/guidelines/terminology`);
    return res.json();
  },
  async createTerminology(payload) {
    const res = await fetch(`${API_BASE}/guidelines/terminology`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return res.json();
  },
  async getFacts() {
    const res = await fetch(`${API_BASE}/guidelines/facts`);
    return res.json();
  },
  async getColors() {
    const res = await fetch(`${API_BASE}/guidelines/colors`);
    return res.json();
  },

  // Analytics & Evaluation
  async getAnalytics() {
    const res = await fetch(`${API_BASE}/analytics/dashboard`);
    return res.json();
  },
  async runEvaluation() {
    const res = await fetch(`${API_BASE}/evaluation/run`, { method: 'POST' });
    return res.json();
  },
  async getLatestEvaluation() {
    const res = await fetch(`${API_BASE}/evaluation/latest`);
    return res.json();
  },

  // Audit
  async getAuditLogs(limit = 50) {
    const res = await fetch(`${API_BASE}/audit/logs?limit=${limit}`);
    return res.json();
  },
  async getDraftAuditLogs(draftId) {
    const res = await fetch(`${API_BASE}/audit/draft/${draftId}`);
    return res.json();
  },
  async getSystemInfo() {
    const res = await fetch(`${API_BASE}/system-info`);
    return res.json();
  }
};
