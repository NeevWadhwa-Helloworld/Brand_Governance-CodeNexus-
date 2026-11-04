import uuid
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Header
from pydantic import BaseModel
from backend.database import get_db
from backend.schemas import RuleItem, RuleCreate, TerminologyItem, ApprovedFactItem, BrandColorItem
from backend.services.rag_service import RAGService
from backend.services.audit_service import AuditService

router = APIRouter(prefix="/api/guidelines", tags=["guidelines"])

class IngestRequest(BaseModel):
    title: str
    version: str
    content: str

@router.get("/rules", response_model=List[RuleItem])
def get_rules(org_id: str = "org_inkloom"):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT r.* FROM rules r
            JOIN guideline_versions gv ON r.version_id = gv.id
            WHERE r.org_id = ? AND gv.is_active = 1
            ORDER BY r.rule_id ASC
        """, (org_id,))
        return cursor.fetchall()

@router.post("/rules", response_model=RuleItem)
def create_rule(rule_in: RuleCreate, org_id: str = "org_inkloom", x_user_id: str = Header("user_chhavi")):
    with get_db() as conn:
        cursor = conn.cursor()
        # Get active version
        cursor.execute("SELECT id FROM guideline_versions WHERE org_id = ? AND is_active = 1 LIMIT 1", (org_id,))
        v_row = cursor.fetchone()
        if not v_row:
            raise HTTPException(status_code=400, detail="No active guideline version found")

        version_id = v_row['id']
        rule_pk = str(uuid.uuid4())
        now = datetime.utcnow().isoformat() + "Z"

        cursor.execute("""
            INSERT INTO rules (id, version_id, org_id, rule_id, category, title, text, details, is_active, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
        """, (rule_pk, version_id, org_id, rule_in.rule_id.upper(), rule_in.category, rule_in.title, rule_in.text, rule_in.details, now))

    AuditService.log(org_id, x_user_id, "rule_created", {"rule_id": rule_in.rule_id, "category": rule_in.category})

    return {
        "id": rule_pk,
        "version_id": version_id,
        "org_id": org_id,
        "rule_id": rule_in.rule_id.upper(),
        "category": rule_in.category,
        "title": rule_in.title,
        "text": rule_in.text,
        "details": rule_in.details,
        "is_active": True
    }

@router.delete("/rules/{rule_id}")
def delete_rule(rule_id: str, org_id: str = "org_inkloom", x_user_id: str = Header("user_chhavi")):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM rules WHERE rule_id = ? AND org_id = ?", (rule_id, org_id))
    AuditService.log(org_id, x_user_id, "rule_deleted", {"rule_id": rule_id})
    return {"status": "success", "deleted_rule_id": rule_id}

@router.post("/ingest")
def ingest_guidelines(req: IngestRequest, org_id: str = "org_inkloom", x_user_id: str = Header("user_chhavi")):
    """
    Ingests raw guidelines, splits into numbered rules (e.g. VOICE-04, COLOR-02),
    and creates a new versioned Source of Truth.
    """
    extracted_rules = RAGService.split_and_extract_rules(req.content)
    if not extracted_rules:
        # Fallback split
        extracted_rules = [
            {"rule_id": f"GEN-{idx+1:02d}", "category": "tone", "title": line[:40], "text": line, "details": ""}
            for idx, line in enumerate(req.content.splitlines()) if len(line.strip()) > 10
        ]

    version_pk = str(uuid.uuid4())
    now = datetime.utcnow().isoformat() + "Z"

    with get_db() as conn:
        cursor = conn.cursor()
        # Mark previous versions as inactive
        cursor.execute("UPDATE guideline_versions SET is_active = 0 WHERE org_id = ?", (org_id,))
        # Insert new version
        cursor.execute("""
            INSERT INTO guideline_versions (id, org_id, version, title, raw_content, is_active, uploaded_at)
            VALUES (?, ?, ?, ?, ?, 1, ?)
        """, (version_pk, org_id, req.version, req.title, req.content, now))

        # Insert rules
        for r in extracted_rules:
            r_pk = str(uuid.uuid4())
            cursor.execute("""
                INSERT INTO rules (id, version_id, org_id, rule_id, category, title, text, details, is_active, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
            """, (r_pk, version_pk, org_id, r['rule_id'], r['category'], r['title'], r['text'], r.get('details'), now))

    AuditService.log(org_id, x_user_id, "guideline_version_ingested", {
        "version": req.version,
        "title": req.title,
        "rules_extracted": len(extracted_rules)
    })

    return {
        "status": "success",
        "version_id": version_pk,
        "version": req.version,
        "rules_count": len(extracted_rules),
        "rules": extracted_rules
    }

@router.get("/terminology", response_model=List[TerminologyItem])
def get_terminology(org_id: str = "org_inkloom"):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM terminology_entries WHERE org_id = ? ORDER BY banned_term ASC", (org_id,))
        return cursor.fetchall()

class TerminologyCreate(BaseModel):
    banned_term: str
    preferred_term: str
    context: Optional[str] = None
    severity: str = "warning"

@router.post("/terminology", response_model=TerminologyItem)
def create_terminology(item: TerminologyCreate, org_id: str = "org_inkloom"):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM guideline_versions WHERE org_id = ? AND is_active = 1 LIMIT 1", (org_id,))
        v_row = cursor.fetchone()
        version_id = v_row['id'] if v_row else "gv_v3_2"
        pk = str(uuid.uuid4())
        cursor.execute("""
            INSERT INTO terminology_entries (id, org_id, version_id, banned_term, preferred_term, context, severity)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (pk, org_id, version_id, item.banned_term, item.preferred_term, item.context, item.severity))
    return {"id": pk, "banned_term": item.banned_term, "preferred_term": item.preferred_term, "context": item.context, "severity": item.severity}

@router.get("/facts", response_model=List[ApprovedFactItem])
def get_approved_facts(org_id: str = "org_inkloom"):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM approved_facts WHERE org_id = ? ORDER BY last_updated DESC", (org_id,))
        return cursor.fetchall()

@router.get("/colors", response_model=List[BrandColorItem])
def get_brand_colors(org_id: str = "org_inkloom"):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM brand_colors WHERE org_id = ?", (org_id,))
        return cursor.fetchall()

