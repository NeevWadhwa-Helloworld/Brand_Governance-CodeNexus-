import uuid
import asyncio
import hashlib
from datetime import datetime
from backend.database import get_db, init_db
from backend.services.scanner import Scanner

def _hash_password(password: str) -> str:
    from backend.config import settings
    return hashlib.pbkdf2_hmac("sha256", password.encode(), settings.SECRET_KEY.encode(), 120_000).hex()

async def seed_database():
    init_db()

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM organizations WHERE slug = 'inkloom'")
        existing_org = cursor.fetchone()
        if existing_org:
            now = datetime.utcnow().isoformat() + "Z"
            password_hash = _hash_password("inkloom-demo")
            migrations = [
                ("user_riya", "paridhi@inkloom.ai", "Paridhi Agarwal", "creator", "https://api.dicebear.com/7.x/avataaars/svg?seed=Paridhi"),
                ("user_alex", "neev@inkloom.ai", "Neev Wadhwa", "reviewer", "https://api.dicebear.com/7.x/avataaars/svg?seed=Neev"),
                ("user_chhavi", "chhavi@inkloom.ai", "Chhavi Rani", "admin", "https://api.dicebear.com/7.x/avataaars/svg?seed=Chhavi"),
            ]
            for user_id, email, name, role, avatar in migrations:
                cursor.execute("""
                    UPDATE users SET email = ?, name = ?, role = ?, avatar = ?, password_hash = ?
                    WHERE id = ?
                """, (email, name, role, avatar, password_hash, user_id))
            cursor.execute("SELECT 1 FROM users WHERE id = 'user_prateek'")
            if not cursor.fetchone():
                cursor.execute("""
                    INSERT INTO users (id, org_id, email, name, role, avatar, created_at, password_hash)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    "user_prateek", existing_org["id"], "prateek@inkloom.ai", "Prateek Singh",
                    "creator", "https://api.dicebear.com/7.x/avataaars/svg?seed=Prateek",
                    now, password_hash
                ))
            print("[Seed] Existing database identity migration completed.")
            return

    with get_db() as conn:
        cursor = conn.cursor()

        # Check if already seeded
        cursor.execute("SELECT COUNT(*) as cnt FROM organizations WHERE slug = 'inkloom'")
        if cursor.fetchone()['cnt'] > 0:
            print("[Seed] Database already seeded.")
            return

        print("[Seed] Populating Inkloom AI Brand Knowledge Base & Seed Data...")

        now = datetime.utcnow().isoformat() + "Z"
        org_id = "org_inkloom"
        cursor.execute("""
            INSERT INTO organizations (id, name, slug, created_at)
            VALUES (?, ?, ?, ?)
        """, (org_id, "Inkloom AI", "inkloom", now))

        # Users
        users = [
            ("user_riya", org_id, "paridhi@inkloom.ai", "Paridhi Agarwal", "creator", "https://api.dicebear.com/7.x/avataaars/svg?seed=Paridhi"),
            ("user_alex", org_id, "neev@inkloom.ai", "Neev Wadhwa", "reviewer", "https://api.dicebear.com/7.x/avataaars/svg?seed=Neev"),
            ("user_chhavi", org_id, "chhavi@inkloom.ai", "Chhavi Rani", "admin", "https://api.dicebear.com/7.x/avataaars/svg?seed=Chhavi"),
            ("user_prateek", org_id, "prateek@inkloom.ai", "Prateek Singh", "creator", "https://api.dicebear.com/7.x/avataaars/svg?seed=Prateek")
        ]
        for uid, oid, email, name, role, avatar in users:
            cursor.execute("""
                INSERT INTO users (id, org_id, email, name, role, avatar, created_at, password_hash)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (uid, oid, email, name, role, avatar, now, _hash_password("inkloom-demo")))

        # Guideline Version
        version_id = "gv_v3_2"
        cursor.execute("""
            INSERT INTO guideline_versions (id, org_id, version, title, raw_content, is_active, uploaded_at)
            VALUES (?, ?, ?, ?, ?, 1, ?)
        """, (version_id, org_id, "v3.2", "Inkloom AI Global Brand Guidelines & Tone Standard", "Official Inkloom Brand Guidelines (October 2026 Edition)", now))

        # Brand Rules
        rules_data = [
            ("VOICE-01", "tone", "Empowering & Confident Tone", "Maintain a confident, empowering, and helpful tone. Never sound arrogant, condescending, or boastful.", "Avoid phrases like 'crush competitors' or 'obviously you need'."),
            ("VOICE-02", "tone", "Conversational Professionalism", "Speak clearly and concisely. Strictly eliminate corporate buzzwords and bureaucratic jargon.", "Avoid 'synergies', 'paradigm shift', 'boil the ocean'."),
            ("VOICE-03", "tone", "Active Voice & Clarity", "Write in direct, active voice. Prioritize concrete creator benefits over abstract descriptions.", "Lead with user outcomes."),
            ("VOICE-04", "tone", "Empathetic Partnership", "Inkloom positions itself as a creative co-pilot and collaborative ally.", "Never treat brand rules as punitive barriers."),
            ("TERM-01", "terminology", "Value-Driven Pricing Terms", "Prohibit the word 'cheap'. Always use 'cost-effective', 'accessible', or 'high-value'.", "The word 'cheap' degrades premium brand perception."),
            ("TERM-02", "terminology", "Professional Role Terminology", "Prohibit slang titles like 'rockstar' or 'ninja'. Use 'expert', 'specialist', or 'engineer'.", "Upholds professional standards across marketing materials."),
            ("TERM-03", "terminology", "Responsible Methodology Phrasing", "Prohibit absolute guarantees like 'guaranteed results'. Use 'proven methodology'.", "Mitigates legal and promotional risk."),
            ("FACT-01", "facts", "Global Active Users Count", "Inkloom AI serves over 50,000+ active users worldwide as confirmed in Fact Sheet v3 (Oct 2026).", "Do not cite outdated counts like 10,000 active users."),
            ("FACT-02", "facts", "Series A Financing Disclosure", "Inkloom closed a $12M Series A round in August 2025 led by Horizon Ventures.", "Do not refer to earlier seed round figures."),
            ("FACT-03", "facts", "Enterprise SLA Uptime", "Official Enterprise SLA commitment is 99.9% uptime with 24/7 monitoring.", "Never promise 100% or untested 99.99% without contractual amendment."),
            ("FACT-04", "facts", "Company Headquarters & Origin", "Founded in Bengaluru, India in 2024 by AI researchers and designers.", "Reference Bengaluru HQ."),
            ("CLAIM-01", "claims", "Substantiation of Superlatives", "Never claim to be the '#1 solution', 'the best in the world', or 'undisputed leader' without citing verified third-party analyst data.", "Must cite G2, Gartner, or verified public benchmarks."),
            ("CLAIM-02", "claims", "Assistive Co-Pilot Positioning", "Never advertise 'instantaneous zero-effort automated perfection'. Emphasize human-in-the-loop oversight.", "Uphold responsible AI design principles."),
            ("COLOR-01", "color", "Inkloom Electric Blue (Primary)", "Primary signature hex code is #2563EB. All primary buttons, logos, and badges must use #2563EB.", "Deprecated blues like #1D4ED8 or generic #0000FF are prohibited."),
            ("COLOR-02", "color", "Inkloom Deep Navy (Dark)", "Dark contrast background and primary typography hex is #0F172A.", "Provides foundation for premium dark aesthetic."),
            ("COLOR-03", "color", "Coral Accent (Highlight)", "Accent calls to action and critical highlights use Coral #F43F5E.", "Use sparingly for maximum visual punch."),
            ("LOGO-01", "logo", "Official Inkloom Mark v3", "Only the official Inkloom v3 geometric mark with 32px safe margin is authorized.", "Deprecated 2024 beta logo is strictly retired."),
            ("A11Y-01", "accessibility", "WCAG AA Contrast Standards", "All digital text content must maintain a minimum contrast ratio of 4.5:1 against its background.", "3.0:1 allowed only for large display text (>24px).")
        ]

        for rid, cat, title, text, details in rules_data:
            cursor.execute("""
                INSERT INTO rules (id, version_id, org_id, rule_id, category, title, text, details, is_active, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
            """, (str(uuid.uuid4()), version_id, org_id, rid, cat, title, text, details, now))

        # Terminology Dictionary entries
        terminology_data = [
            ("cheap", "cost-effective", "The word 'cheap' diminishes brand value.", "warning"),
            ("rockstar", "expert", "Informal slang degrades enterprise credibility.", "warning"),
            ("ninja", "specialist", "Use professional titles.", "warning"),
            ("guaranteed results", "proven methodology", "Absolute legal guarantees require legal pre-approval.", "critical")
        ]
        for banned, pref, ctx, sev in terminology_data:
            cursor.execute("""
                INSERT INTO terminology_entries (id, org_id, version_id, banned_term, preferred_term, context, severity)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (str(uuid.uuid4()), org_id, version_id, banned, pref, ctx, sev))

        # Approved Facts
        facts_data = [
            ("active_users", "Over 50,000+ active users worldwide", "50,000+ active users", "Approved Fact Sheet v3 (Oct 2026)", "2026-10-15"),
            ("funding_round", "Series A $12M closed in August 2025", "$12M Series A", "Horizon Ventures Press Release", "2025-08-20"),
            ("sla_uptime", "Enterprise uptime commitment 99.9%", "99.9% uptime SLA", "Service Level Agreement v3", "2026-01-01"),
            ("headquarters", "Bengaluru, India", "Bengaluru, India", "Corporate Registry", "2024-03-01")
        ]
        for fkey, claim, metric, cite, lupdated in facts_data:
            cursor.execute("""
                INSERT INTO approved_facts (id, org_id, version_id, fact_key, claim_text, approved_metric, citation, last_updated)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (str(uuid.uuid4()), org_id, version_id, fkey, claim, metric, cite, lupdated))

        # Brand Colors
        colors_data = [
            ("Electric Blue", "#2563EB", "primary", 4.6),
            ("Deep Navy", "#0F172A", "background", 15.8),
            ("Coral Highlight", "#F43F5E", "accent", 4.5),
            ("Slate Neutral", "#64748B", "neutral", 4.8),
            ("Pure White", "#FFFFFF", "primary", 16.0)
        ]
        for name, hex_code, role, min_c in colors_data:
            cursor.execute("""
                INSERT INTO brand_colors (id, org_id, version_id, name, hex_code, role, min_contrast)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (str(uuid.uuid4()), org_id, version_id, name, hex_code, role, min_c))

        # Brand Logos
        cursor.execute("""
            INSERT INTO brand_logos (id, org_id, version_id, name, file_path, file_hash, aspect_ratio, min_clearance_pct)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (str(uuid.uuid4()), org_id, version_id, "Inkloom Official Mark v3", "/static/logos/inkloom_logo_v3.svg", "sha256_official_v3_mark", 1.0, 15.0))

        # Sample Draft 1: Off-brand marketing draft with outdated user count, banned words, and arrogant tone
        draft1_id = "draft_sample_launch"
        draft1_text = (
            "We're proud to serve over 10,000 active users. Our cheap pricing and rockstar team crush our competitors "
            "every single day. Inkloom 2.0 is the #1 solution with guaranteed 100% results, styled in vibrant accent #FF0055."
        )
        cursor.execute("""
            INSERT INTO drafts (id, org_id, author_id, title, content_type, current_version, status, content_ref, created_at, updated_at)
            VALUES (?, ?, ?, ?, 'text', 1, 'Submitted', ?, ?, ?)
        """, (draft1_id, org_id, "user_riya", "Product Launch Blog Post - Inkloom 2.0", draft1_text, now, now))

        # Sample Draft 2: Fully Compliant Enterprise Press Release
        draft2_id = "draft_compliant_enterprise"
        draft2_text = (
            "Inkloom AI is proud to support over 50,000+ active users worldwide with enterprise brand consistency. "
            "Backed by our proven methodology and a 99.9% uptime SLA, creative teams collaborate seamlessly "
            "to deliver cost-effective and compliant marketing experiences."
        )
        cursor.execute("""
            INSERT INTO drafts (id, org_id, author_id, title, content_type, current_version, status, content_ref, created_at, updated_at)
            VALUES (?, ?, ?, ?, 'text', 1, 'Approved', ?, ?, ?)
        """, (draft2_id, org_id, "user_riya", "Enterprise Q4 Customer Milestone Announcement", draft2_text, now, now))

        # Sample Draft 3: Banner Ad Image Creative (with unapproved color #FF0055 and logo)
        draft3_id = "draft_banner_creative"
        banner_rel_path = "/static/uploads/sample_banner.png"
        cursor.execute("""
            INSERT INTO drafts (id, org_id, author_id, title, content_type, current_version, status, content_ref, created_at, updated_at)
            VALUES (?, ?, ?, ?, 'image', 1, 'Submitted', ?, ?, ?)
        """, (draft3_id, org_id, "user_riya", "Q4 Social Banner Creative (Visual Asset)", banner_rel_path, now, now))

    # Perform initial automated scans to populate live flags & audit logs
    print("[Seed] Running initial two-layer scan on sample drafts...")
    await Scanner.scan_draft(draft1_id, "user_riya", content_text=draft1_text)
    await Scanner.scan_draft(draft2_id, "user_riya", content_text=draft2_text)
    await Scanner.scan_draft(draft3_id, "user_riya", image_path="backend/static/uploads/sample_banner.png")

    print("[Seed] Seeding completed successfully.")

if __name__ == "__main__":
    asyncio.run(seed_database())
