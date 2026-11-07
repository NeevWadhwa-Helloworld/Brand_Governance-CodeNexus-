# Brand Governance Guidelines

This is a practical starter policy for the Source of Truth. It is not a statement
of verified company facts. An administrator should confirm the voice, palette,
accessibility requirements, approved marks, legal wording, and sources with the
company before activating it.

## Rules for ingestion

Paste the numbered rules below into **Admin → Source of Truth → Ingest Guidelines**.
Keep each rule ID at the start of its own line. The parser recognizes `VOICE`,
`TERM`, `FACT`, `CLAIM`, `COLOR`, `LOGO`, and `A11Y` prefixes. Put supporting
requirements on the following lines.

```text
VOICE-01: Clear, helpful, and respectful
Use plain language and a confident, helpful tone. Explain benefits without
condescending to, pressuring, or blaming the audience.

VOICE-02: Specific and concise
Prefer direct, active sentences and concrete outcomes. Remove unnecessary
buzzwords, unexplained acronyms, and unsupported superlatives.

TERM-01: Use approved terminology
Use the preferred terms in the approved terminology dictionary. Do not treat
unlisted words as prohibited; ask the brand owner before adding a restriction.

CLAIM-01: Substantiate objective claims
Claims about performance, comparisons, rankings, savings, security, or customer
outcomes require current evidence and legal/brand approval. Do not publish an
absolute guarantee unless the exact wording is approved for the relevant offer.

FACT-01: Use only verified company facts
Company names, dates, locations, customer counts, funding, product capabilities,
certifications, and service commitments must match an Approved Fact with a
current citation. If no approved fact exists, omit the number or qualify the
statement and send it for review.

COLOR-01: Apply the approved palette to brand elements
Use the approved palette for logos, interface components, and intentionally
branded graphic elements. Photography, illustrations, and other content imagery
may contain natural colors; their individual pixels are not required to match
the palette.

LOGO-01: Use approved brand marks
Use an asset listed in the approved logo library. Preserve its proportions and
clear space, and do not redraw, recolor, distort, or combine it with another
mark unless an approved variant permits that treatment.

A11Y-01: Verify contrast on actual text and controls
Measure foreground/background pairs for text and interactive controls. Use at
least 4.5:1 for normal text and 3:1 for large text and meaningful UI graphics,
unless the applicable accessibility standard or product requirement is stricter.
Do not infer a contrast failure from the two most common colors in a photograph.

A11Y-02: Make content accessible
Provide meaningful alternative text for informative images, captions or
transcripts for audio/video, keyboard-operable controls, and visible focus
indicators. Do not put essential information only in color or imagery.

VOICE-03: Escalate uncertain or incomplete checks
Automated findings are evidence for review, not a substitute for human judgment.
Route unclear claims, missing sources, uncertain OCR, and visual details the
scanner cannot verify to an authorized reviewer.
```

## Where policy and facts are stored

The starter/demo rules and facts are defined in
[`backend/seed_data.py`](./backend/seed_data.py). They are inserted only when a
new database is seeded; editing that file does not update an already-seeded
database.

At runtime, the original guideline text and version metadata are stored in the
`guideline_versions` table (`raw_content`, `version`, `title`, `is_active`).
Parsed, searchable rules are stored in `rules`; terminology in
`terminology_entries`; numerical and other approved facts with citations in
`approved_facts`; palette entries in `brand_colors`; and logo references in
`brand_logos`.

Locally, the default SQLite database is `brand_governance.db` at the repository
root (`backend/config.py` sets `DB_PATH`). If `DATABASE_URL` points to
PostgreSQL, the runtime data lives in that database instead. On the deployed
service, use the configured PostgreSQL database; the deployed database is not
stored in the GitHub project. Uploaded logo and media files are stored under
`backend/static/` locally or the configured `STATIC_ROOT` in deployment.

## How an administrator updates policies and facts

1. Sign in as an organization administrator and open **Source of Truth** (the
   **Brain** tab).
2. To replace the policy version, open **Ingest Guidelines**, enter a new title
   and version, paste the rules in the numbered format above, and ingest them.
   The new version becomes active; previous guideline versions remain in the
   database as inactive history. Review the parsed rules before relying on them.
3. To change a numerical value or other factual claim, use **Approved Facts**.
   Edit the existing fact when its meaning is unchanged; create a separately
   cited fact when the meaning differs. Include the source and effective/current
   date in the citation or claim context. Do not rely on replacing a number in
   prose alone: the scanner checks selected fact keys against this table.
4. Update terminology, brand colors, and logos in their corresponding
   **Terminology**, **Colors**, and **Logos** sections. Re-scan affected drafts
   after a change.
5. Keep the approved source document outside the app under normal company
   document controls. The database is the active operational copy; back it up
   and restrict write access to administrators.

The current seeded Inkloom sample contains demo metrics and palette entries.
Treat them as examples until a company owner confirms their accuracy and updates
the Approved Facts and brand assets.
