import React, { useEffect, useState } from 'react';
import { api } from '../api';
import {
  Users, UserPlus, Shield, CheckCircle2, Search, Mail, Lock,
  Sparkles, X, ChevronRight, Loader2, Building2,
  Award, Check, KeyRound
} from 'lucide-react';

const ROLE_DETAILS = {
  creator: {
    label: 'Creator',
    badgeClass: 'bg-[#34D399]/15 text-[#34D399] border-[#34D399]/30',
    icon: Sparkles,
    tagline: 'Create drafts and review findings',
    description: 'Creators write text drafts or upload media, review scan findings, apply suggested text replacements, and submit drafts for approval.',
    permissions: [
      'Create and edit text copy drafts',
      'Upload banner images, audio clips, and video files',
      'Run scans against the workspace guidelines',
      'Apply suggested replacements to text drafts',
      'Mark media findings reviewed or upload a revised asset',
      'Submit drafts for approval'
    ]
  },
  reviewer: {
    label: 'Reviewer',
    badgeClass: 'bg-[#60A5FA]/15 text-[#60A5FA] border-[#60A5FA]/30',
    icon: Award,
    tagline: 'Review submissions and record decisions',
    description: 'Reviewers inspect submitted content and scan evidence, leave comments, and approve drafts or request changes.',
    permissions: [
      'Inspect submissions in the Approval Queue',
      'Inspect findings, extracted text, and media evidence',
      'Post comments and request revisions in discussion threads',
      'Approve drafts or request changes with a reason',
      'Download a draft review summary'
    ]
  },
  admin: {
    label: 'Admin',
    badgeClass: 'bg-[#A78BFA]/15 text-[#A78BFA] border-[#A78BFA]/30',
    icon: Shield,
    tagline: 'Manage workspace guidelines and users',
    description: 'Administrators manage workspace rules, approved facts, terminology, and user accounts.',
    permissions: [
      'Ingest and version new Brand Guideline documents',
      'Create, edit, and delete numbered rules & dictionaries',
      'Review recent workspace audit activity',
      'Create user accounts and assign roles',
      'Access all workspace tools'
    ]
  }
};

export default function UserManagement({ currentUser }) {
  const [users, setUsers] = useState([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'creator' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [showRoleMatrix, setShowRoleMatrix] = useState(false);

  async function loadUsers() {
    try {
      const data = await api.getUsers();
      setUsers(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e.message || 'Failed to load organization team members');
    } finally {
      setInitialLoading(false);
    }
  }

  useEffect(() => {
    let ignore = false;
    api.getUsers()
      .then((data) => {
        if (!ignore) {
          setUsers(Array.isArray(data) ? data : []);
          setInitialLoading(false);
        }
      })
      .catch((e) => {
        if (!ignore) {
          setError(e.message || 'Failed to load organization team members');
          setInitialLoading(false);
        }
      });
    return () => {
      ignore = true;
    };
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setSuccessMessage(null);
    try {
      await api.createUser(form);
      const createdEmail = form.email;
      setForm({ name: '', email: '', password: '', role: 'creator' });
      setSuccessMessage(`Account successfully provisioned for ${createdEmail}.`);
      setShowAddForm(false);
      await loadUsers();
    } catch (e) {
      setError(e.message || 'Failed to create user account');
    } finally {
      setLoading(false);
    }
  }

  // Statistics derived purely from real API data
  const totalCount = users.length;
  const creatorCount = users.filter(u => u.role === 'creator').length;
  const reviewerCount = users.filter(u => u.role === 'reviewer').length;
  const adminCount = users.filter(u => u.role === 'admin').length;

  // Filtered members list
  const filteredUsers = users.filter(u => {
    const matchesRole = roleFilter === 'all' || u.role === roleFilter;
    const matchesSearch = !searchQuery.trim() ||
      (u.name && u.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (u.email && u.email.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (u.role && u.role.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesRole && matchesSearch;
  });

  return (
    <div className="space-y-6 motion-safe:animate-fade-in">
      {/* Header & Organization Context */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#1F2A4A] pb-4">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#36D6A0]/15 border border-[#36D6A0]/30 flex items-center justify-center text-[#36D6A0]">
              <Users className="w-4 h-4" />
            </div>
            <h2 className="text-base sm:text-lg font-bold text-[#E8ECF8]">
              Team Accounts & Governance Permissions
            </h2>
          </div>
          <p className="text-xs text-[#7C88AB] mt-1 ml-10.5">
            Admin-only account provisioning, access control matrix, and organization member directory.
          </p>
        </div>

        {/* Tenant Organization Badge & Action Buttons */}
        <div className="flex items-center space-x-2.5">
          <div className="bg-[#0E1428] border border-[#1F2A4A] rounded-xl px-3.5 py-1.5 text-xs flex items-center space-x-2">
            <Building2 className="w-3.5 h-3.5 text-[#7C88AB]" />
            <span className="text-[#7C88AB]">Tenant:</span>
            <span className="font-mono font-bold text-[#60A5FA]">
              {currentUser?.org_id || 'Global Org'}
            </span>
          </div>

          <button
            type="button"
            onClick={() => setShowRoleMatrix(!showRoleMatrix)}
            className="bg-[#0E1428] hover:bg-[#141C33] border border-[#1F2A4A] text-[#AAB4D0] hover:text-[#E8ECF8] px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition-colors"
          >
            <Shield className="w-3.5 h-3.5 text-[#A78BFA]" />
            <span>Role Matrix</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setShowAddForm(!showAddForm);
              setError(null);
              setSuccessMessage(null);
            }}
            className="bg-[#36D6A0] hover:bg-[#45E6AE] text-[#101613] px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center space-x-1.5 shadow-md shadow-[#36D6A0]/20 transition-all"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Provision Account</span>
          </button>
        </div>
      </div>

      {/* Success Notification Banner */}
      {successMessage && (
        <div className="bg-[#34D399]/10 border border-[#34D399]/30 rounded-2xl p-4 text-xs text-[#34D399] flex items-center justify-between shadow-lg motion-safe:animate-fade-in">
          <div className="flex items-center space-x-2.5">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span className="font-semibold">{successMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessMessage(null)}
            className="text-[#34D399] hover:text-[#E8ECF8] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Error Notification Banner */}
      {error && (
        <div className="bg-[#F87171]/10 border border-[#F87171]/30 rounded-2xl p-4 text-xs text-[#F87171] flex items-center justify-between shadow-lg motion-safe:animate-fade-in">
          <div className="flex items-center space-x-2.5">
            <X className="w-4 h-4 shrink-0" />
            <span className="font-semibold">{error}</span>
          </div>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-[#F87171] hover:text-[#E8ECF8] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* KPI Cards: Team Overview Statistics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="bg-[#111830] border border-[#1F2A4A] rounded-2xl p-4 space-y-1 shadow-lg">
          <div className="flex items-center justify-between text-xs text-[#7C88AB]">
            <span>Total Members</span>
            <Users className="w-4 h-4 text-[#4F6BED]" />
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-[#E8ECF8]">
            {initialLoading ? '...' : totalCount}
          </div>
          <div className="text-[11px] text-[#7C88AB]">
            Active platform accounts
          </div>
        </div>

        <div className="bg-[#111830] border border-[#1F2A4A] rounded-2xl p-4 space-y-1 shadow-lg">
          <div className="flex items-center justify-between text-xs text-[#7C88AB]">
            <span>Creators</span>
            <Sparkles className="w-4 h-4 text-[#34D399]" />
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-[#34D399]">
            {initialLoading ? '...' : creatorCount}
          </div>
          <div className="text-[11px] text-[#7C88AB]">
            Draft authoring & AI scans
          </div>
        </div>

        <div className="bg-[#111830] border border-[#1F2A4A] rounded-2xl p-4 space-y-1 shadow-lg">
          <div className="flex items-center justify-between text-xs text-[#7C88AB]">
            <span>Reviewers</span>
            <Award className="w-4 h-4 text-[#60A5FA]" />
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-[#60A5FA]">
            {initialLoading ? '...' : reviewerCount}
          </div>
          <div className="text-[11px] text-[#7C88AB]">
            Review approvals and decisions
          </div>
        </div>

        <div className="bg-[#111830] border border-[#1F2A4A] rounded-2xl p-4 space-y-1 shadow-lg">
          <div className="flex items-center justify-between text-xs text-[#7C88AB]">
            <span>Administrators</span>
            <Shield className="w-4 h-4 text-[#A78BFA]" />
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-[#A78BFA]">
            {initialLoading ? '...' : adminCount}
          </div>
          <div className="text-[11px] text-[#7C88AB]">
            Source of Truth & governance
          </div>
        </div>
      </div>

      {/* Role Matrix Reference Card (Collapsible) */}
      {showRoleMatrix && (
        <div className="bg-[#111830] border border-[#A78BFA]/40 rounded-2xl p-5 space-y-4 shadow-xl motion-safe:animate-fade-in">
          <div className="flex items-center justify-between border-b border-[#1F2A4A] pb-3">
            <div className="flex items-center space-x-2">
              <Shield className="w-4 h-4 text-[#A78BFA]" />
              <h3 className="text-xs font-bold text-[#E8ECF8] uppercase tracking-wider">
                Role Permissions & Access Control Matrix
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setShowRoleMatrix(false)}
              className="text-[#7C88AB] hover:text-[#E8ECF8]"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            {Object.entries(ROLE_DETAILS).map(([roleKey, role]) => {
              const RoleIcon = role.icon;
              return (
                <div
                  key={roleKey}
                  className="bg-[#0E1428] border border-[#1F2A4A] rounded-xl p-4 space-y-2.5 flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border uppercase flex items-center gap-1 ${role.badgeClass}`}>
                        <RoleIcon className="w-3 h-3" />
                        {role.label}
                      </span>
                    </div>
                    <div className="text-[11px] font-semibold text-[#E8ECF8]">
                      {role.tagline}
                    </div>
                    <p className="text-[11px] text-[#7C88AB] leading-relaxed">
                      {role.description}
                    </p>
                  </div>

                  <div className="pt-2 border-t border-[#1F2A4A]/60 space-y-1.5">
                    <div className="text-[10px] font-bold text-[#AAB4D0] uppercase tracking-wider">
                      Granted Capabilities:
                    </div>
                    {role.permissions.map((perm, idx) => (
                      <div key={idx} className="flex items-start space-x-1.5 text-[11px] text-[#AAB4D0]">
                        <Check className="w-3.5 h-3.5 text-[#34D399] shrink-0 mt-0.5" />
                        <span>{perm}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Account Provisioning Form (Collapsible / Modal) */}
      {showAddForm && (
        <form
          onSubmit={handleSubmit}
          className="bg-[#111830] border border-[#4F6BED]/50 rounded-2xl p-5 sm:p-6 space-y-4 shadow-xl motion-safe:animate-fade-in"
        >
          <div className="flex items-center justify-between border-b border-[#1F2A4A] pb-3">
            <h3 className="text-xs font-bold text-[#60A5FA] uppercase tracking-wider flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-[#4F6BED]" />
              Provision New Organization Account
            </h3>
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="text-[#7C88AB] hover:text-[#E8ECF8]"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block text-[#7C88AB] mb-1 font-medium">
                Full Name
              </label>
              <div className="relative">
                <Users className="w-3.5 h-3.5 text-[#7C88AB] absolute left-3 top-3" />
                <input
                  required
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Maya Lin"
                  className="w-full bg-[#0E1428] border border-[#1F2A4A] rounded-xl pl-9 pr-3 py-2 text-[#E8ECF8] focus:outline-none focus:border-[#4F6BED]"
                />
              </div>
            </div>

            <div>
              <label className="block text-[#7C88AB] mb-1 font-medium">
                Organization Email Address
              </label>
              <div className="relative">
                <Mail className="w-3.5 h-3.5 text-[#7C88AB] absolute left-3 top-3" />
                <input
                  required
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="e.g. maya@inkloom.internal"
                  className="w-full bg-[#0E1428] border border-[#1F2A4A] rounded-xl pl-9 pr-3 py-2 text-[#E8ECF8] focus:outline-none focus:border-[#4F6BED]"
                />
              </div>
            </div>

            <div>
              <label className="block text-[#7C88AB] mb-1 font-medium">
                Temporary Password (8+ characters)
              </label>
              <div className="relative">
                <Lock className="w-3.5 h-3.5 text-[#7C88AB] absolute left-3 top-3" />
                <input
                  required
                  minLength={8}
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="••••••••••••"
                  className="w-full bg-[#0E1428] border border-[#1F2A4A] rounded-xl pl-9 pr-3 py-2 text-[#E8ECF8] font-mono focus:outline-none focus:border-[#4F6BED]"
                />
              </div>
              <div className="text-[10px] text-[#7C88AB] mt-1 flex items-center gap-1">
                <KeyRound className="w-3 h-3 text-[#FBBF24]" />
                <span>User will be prompted to authenticate with this credential.</span>
              </div>
            </div>

            <div>
              <label className="block text-[#7C88AB] mb-1 font-medium">
                Assigned Platform Role
              </label>
              <select
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
                className="w-full bg-[#0E1428] border border-[#1F2A4A] rounded-xl p-2 text-[#E8ECF8] focus:outline-none focus:border-[#4F6BED]"
              >
                <option value="creator">Creator (Draft Studio & AI Scanner)</option>
                <option value="reviewer">Reviewer (Approvals)</option>
              </select>
              <div className="text-[10px] text-[#7C88AB] mt-1">
                {form.role === 'creator'
                  ? 'Permits authoring drafts, running AI scans, and submitting to queue.'
                  : 'Permits queue inspection, policy commenting, and issuing certificates.'}
              </div>
            </div>
          </div>

          <div className="flex justify-end space-x-2 pt-2 border-t border-[#1F2A4A]">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="px-4 py-2 text-xs text-[#7C88AB] hover:text-[#E8ECF8] rounded-xl hover:bg-[#141C33] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="bg-[#4F6BED] hover:bg-[#6479F2] text-white px-5 py-2 rounded-xl text-xs font-semibold shadow-md shadow-[#4F6BED]/20 transition-all flex items-center gap-1.5 disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />}
              <span>{loading ? 'Provisioning...' : 'Confirm & Provision Account'}</span>
            </button>
          </div>
        </form>
      )}

      {/* Member Directory: Search & Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#111830] border border-[#1F2A4A] p-3 rounded-2xl shadow-lg">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-3.5 h-3.5 text-[#7C88AB] absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search team members by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#0E1428] border border-[#1F2A4A] rounded-xl pl-8 pr-3 py-1.5 text-xs text-[#E8ECF8] placeholder-[#7C88AB] focus:outline-none focus:border-[#4F6BED]"
          />
        </div>

        <div className="flex items-center space-x-1 overflow-x-auto no-scrollbar text-xs">
          {[
            { id: 'all', label: `All Members (${totalCount})` },
            { id: 'creator', label: `Creators (${creatorCount})` },
            { id: 'reviewer', label: `Reviewers (${reviewerCount})` },
            { id: 'admin', label: `Admins (${adminCount})` }
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setRoleFilter(tab.id)}
              className={`px-3 py-1 rounded-xl border text-[11px] font-semibold transition-all shrink-0 ${
                roleFilter === tab.id
                  ? 'bg-[#172040] border-[#4F6BED] text-[#E8ECF8]'
                  : 'bg-[#0E1428] border-[#1F2A4A] text-[#7C88AB] hover:text-[#E8ECF8]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Member Directory List */}
      <div className="bg-[#111830] border border-[#1F2A4A] rounded-2xl overflow-hidden shadow-xl">
        <div className="border-b border-[#1F2A4A] px-5 py-3.5 flex items-center justify-between bg-[#0A0F1E]">
          <div className="text-xs font-bold text-[#E8ECF8] uppercase tracking-wider flex items-center gap-2">
            <Users className="w-3.5 h-3.5 text-[#4F6BED]" />
            <span>Organization Member Roster</span>
            <span className="text-[#7C88AB] font-mono text-[11px] font-normal">
              ({filteredUsers.length} {filteredUsers.length === 1 ? 'member' : 'members'})
            </span>
          </div>
          <div className="text-[11px] text-[#7C88AB] hidden sm:block">
            Click any member to inspect granted permissions
          </div>
        </div>

        {initialLoading ? (
          <div className="p-10 text-center space-y-3 animate-pulse">
            <Users className="w-8 h-8 text-[#4F6BED] mx-auto opacity-50 animate-bounce" />
            <p className="text-xs text-[#7C88AB]">Loading organization directory from database...</p>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-10 text-center space-y-2">
            <p className="text-xs text-[#7C88AB] italic">
              No team members match the search query "{searchQuery}" or selected role filter.
            </p>
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="text-xs text-[#60A5FA] hover:underline"
              >
                Clear search query
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-[#1F2A4A]/60">
            {filteredUsers.map((user) => {
              const roleMeta = ROLE_DETAILS[user.role] || ROLE_DETAILS.creator;
              const RoleIcon = roleMeta.icon;
              const isCurrentSessionUser = currentUser && (currentUser.id === user.id || currentUser.email === user.email);

              return (
                <div
                  key={user.id}
                  onClick={() => setSelectedUser(user)}
                  className="flex flex-wrap items-center justify-between px-5 py-4 hover:bg-[#141C33] transition-colors cursor-pointer group gap-3"
                >
                  {/* User Profile & Avatar */}
                  <div className="flex items-center space-x-3.5 min-w-[240px]">
                    <div className="relative">
                      {user.avatar ? (
                        <img
                          src={user.avatar}
                          alt={user.name}
                          className="w-10 h-10 rounded-full object-cover border border-[#1F2A4A]"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                            const fallback = e.currentTarget.nextElementSibling;
                            if (fallback) fallback.style.display = 'flex';
                          }}
                        />
                      ) : null}
                      <div
                        className="w-10 h-10 rounded-full bg-[#172040] border border-[#1F2A4A] items-center justify-center font-bold text-[#E8ECF8] text-sm shrink-0"
                        style={{ display: user.avatar ? 'none' : 'flex' }}
                      >
                        {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
                      </div>
                      <span className="w-2.5 h-2.5 rounded-full bg-[#34D399] border-2 border-[#111830] absolute bottom-0 right-0" title="Active Account" />
                    </div>

                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="text-xs sm:text-sm font-bold text-[#E8ECF8] group-hover:text-[#60A5FA] transition-colors">
                          {user.name}
                        </span>
                        {isCurrentSessionUser && (
                          <span className="text-[10px] bg-[#4F6BED]/20 border border-[#4F6BED]/40 text-[#60A5FA] px-1.5 py-0.2 rounded font-semibold">
                            You
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-[#7C88AB] font-mono mt-0.5">
                        {user.email}
                      </div>
                    </div>
                  </div>

                  {/* Tenant & Role Badges & Details Action */}
                  <div className="flex items-center space-x-3 sm:space-x-4">
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border uppercase flex items-center gap-1.5 ${roleMeta.badgeClass}`}>
                      <RoleIcon className="w-3 h-3" />
                      {roleMeta.label}
                    </span>

                    <span className="hidden md:inline-flex text-[11px] text-[#7C88AB] font-mono bg-[#0E1428] px-2.5 py-1 rounded-lg border border-[#1F2A4A]/60">
                      ID: {user.id ? String(user.id).substring(0, 12) : 'user'}
                    </span>

                    <div className="text-[#7C88AB] group-hover:text-[#E8ECF8] group-hover:translate-x-0.5 transition-all p-1">
                      <ChevronRight className="w-4 h-4" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Member Details Inspector Modal */}
      {selectedUser && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 bg-[#0A0F1E]/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 motion-safe:animate-fade-in"
        >
          <div className="bg-[#111830] border border-[#1F2A4A] rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-[#1F2A4A] pb-3">
              <div className="flex items-center space-x-2">
                <Users className="w-4 h-4 text-[#4F6BED]" />
                <h3 className="text-xs font-bold text-[#E8ECF8] uppercase tracking-wider">
                  Member Profile & Granted Permissions
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedUser(null)}
                className="text-[#7C88AB] hover:text-[#E8ECF8] p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Profile Summary */}
            <div className="flex items-center space-x-3.5 bg-[#0E1428] border border-[#1F2A4A] p-4 rounded-xl">
              <div className="w-12 h-12 rounded-full bg-[#172040] border border-[#1F2A4A] flex items-center justify-center font-bold text-[#E8ECF8] text-base shrink-0">
                {selectedUser.name ? selectedUser.name.charAt(0).toUpperCase() : 'U'}
              </div>
              <div className="space-y-0.5 flex-1 min-w-0">
                <div className="flex items-center space-x-2">
                  <h4 className="text-sm font-bold text-[#E8ECF8] truncate">
                    {selectedUser.name}
                  </h4>
                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border uppercase shrink-0 ${ROLE_DETAILS[selectedUser.role]?.badgeClass || 'bg-[#7C88AB]/15 text-[#AAB4D0] border-[#7C88AB]/30'}`}>
                    {selectedUser.role}
                  </span>
                </div>
                <div className="text-xs text-[#7C88AB] font-mono truncate">
                  {selectedUser.email}
                </div>
              </div>
            </div>

            {/* Account Details & Role Permissions */}
            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="bg-[#0E1428] border border-[#1F2A4A]/60 p-2.5 rounded-lg">
                  <div className="text-[#7C88AB]">Account Status</div>
                  <div className="font-semibold text-[#34D399] flex items-center gap-1 mt-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#34D399]" />
                    Active & Verified
                  </div>
                </div>
                <div className="bg-[#0E1428] border border-[#1F2A4A]/60 p-2.5 rounded-lg">
                  <div className="text-[#7C88AB]">Organization ID</div>
                  <div className="font-semibold text-[#E8ECF8] font-mono truncate mt-0.5">
                    {currentUser?.org_id || 'Global Tenant'}
                  </div>
                </div>
              </div>

              <div className="space-y-2 pt-2">
                <div className="text-[11px] font-bold text-[#E8ECF8] uppercase tracking-wider flex items-center justify-between">
                  <span>Authorized Capabilities:</span>
                  <span className="text-[#60A5FA] font-normal normal-case text-[10px]">
                    Role: {ROLE_DETAILS[selectedUser.role]?.label || selectedUser.role}
                  </span>
                </div>
                <div className="bg-[#0E1428] border border-[#1F2A4A]/60 rounded-xl p-3 space-y-2">
                  {(ROLE_DETAILS[selectedUser.role]?.permissions || []).map((perm, idx) => (
                    <div key={idx} className="flex items-start space-x-2 text-[11px] text-[#AAB4D0]">
                      <Check className="w-3.5 h-3.5 text-[#34D399] shrink-0 mt-0.5" />
                      <span>{perm}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-[#1F2A4A]">
              <button
                type="button"
                onClick={() => setSelectedUser(null)}
                className="bg-[#172040] hover:bg-[#1F2A4A] text-[#E8ECF8] px-4 py-2 rounded-xl text-xs font-semibold transition-colors"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
