import React, { useEffect, useState } from 'react';
import { api } from '../api';

export default function UserManagement({ currentUser }) {
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'creator' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function loadUsers() {
    setUsers(await api.getUsers());
  }

  useEffect(() => {
    loadUsers().catch((e) => setError(e.message));
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await api.createUser(form);
      setForm({ name: '', email: '', password: '', role: 'creator' });
      await loadUsers();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">Team Accounts</h2>
        <p className="mt-1 text-sm text-slate-400">
          Admin-only account provisioning for {currentUser.org_id}.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-800 bg-slate-900 p-5 space-y-4">
        <h3 className="font-semibold text-white">Add creator or reviewer</h3>
        {error && <p className="rounded-lg border border-rose-500/40 bg-rose-950/30 px-3 py-2 text-sm text-rose-200">{error}</p>}
        <div className="grid gap-3 md:grid-cols-2">
          <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Full name" className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" />
          <input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="Email" className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" />
          <input required minLength={8} type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Temporary password (8+ characters)" className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" />
          <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white">
            <option value="creator">Creator</option>
            <option value="reviewer">Reviewer</option>
          </select>
        </div>
        <button disabled={loading} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
          {loading ? 'Creating...' : 'Create account'}
        </button>
      </form>

      <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
        <div className="border-b border-slate-800 px-5 py-4 font-semibold text-white">Organization accounts</div>
        <div className="divide-y divide-slate-800">
          {users.map((user) => (
            <div key={user.id} className="flex items-center justify-between px-5 py-4">
              <div className="flex items-center gap-3">
                <img src={user.avatar} alt="" className="h-8 w-8 rounded-full" />
                <div>
                  <div className="text-sm font-medium text-white">{user.name}</div>
                  <div className="text-xs text-slate-400">{user.email}</div>
                </div>
              </div>
              <span className="rounded border border-slate-700 px-2 py-1 text-[10px] uppercase text-slate-300">{user.role}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
