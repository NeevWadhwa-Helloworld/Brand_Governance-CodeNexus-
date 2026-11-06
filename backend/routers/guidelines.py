import uuid
import shutil
import hashlib
import json
from pathlib import Path
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Header, Depends
from pydantic import BaseModel
from backend.database import get_db
from backend.config import settings
from backend.schemas import (
    RuleItem, RuleCreate, TerminologyItem,
    ApprovedFactItem, ApprovedFactCreate, ApprovedFactUpdate,
    BrandColorItem, BrandColorCreate, BrandLogoItem
)
from backend.services.rag_service import RAGService
from backend.services.embedding_service import EmbeddingService
from backend.services.audit_service import AuditService
from backend.dependencies import require_role, get_current_user

router = APIRouter(
    prefix="/api/guidelines",
    tags=["guidelines"],
    dependencies=[Depends(get_current_user)]
)

class IngestRequest(BaseModel):
    title: str
    version: str
    content: str

# --- Numbered Rules ---

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
def create_rule(
    rule_in: RuleCreate, 
    org_id: str = "org_inkloom", 
    current_user: dict = Depends(require_role("admin"))
):
    user_id = current_user['id']
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM guideline_versions WHERE org_id = ? AND is_active = 1 LIMIT 1", (org_id,))
        v_row = cursor.fetchone()
        if not v_row:
            raise HTTPException(status_code=400, detail="No active guideline version found")

        version_id = v_row['id']
        rule_pk = str(uuid.uuid4())
        now = datetime.utcnow().isoformat() + "Z"

        embedding = EmbeddingService.embed(
            f"{rule_in.rule_id} {rule_in.category} {rule_in.title} {rule_in.text} {rule_in.details or ''}"
        )
        if settings.is_postgres:
            cursor.execute("""
                INSERT INTO rules
                (id, version_id, org_id, rule_id, category, title, text, details, embedding_json, embedding, is_active, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?::vector, 1, ?)
            """, (rule_pk, version_id, org_id, rule_in.rule_id.upper(), rule_in.category,
                  rule_in.title, rule_in.text, rule_in.details,
                  json.dumps(embedding) if embedding else None,
                  EmbeddingService.to_vector_literal(embedding) if embedding else None, now))
        else:
            cursor.execute("""
                INSERT INTO rules
                (id, version_id, org_id, rule_id, category, title, text, details, embedding_json, is_active, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
            """, (rule_pk, version_id, org_id, rule_in.rule_id.upper(), rule_in.category,
                  rule_in.title, rule_in.text, rule_in.details,
                  json.dumps(embedding) if embedding else None, now))

    AuditService.log(org_id, user_id, "rule_created", {"rule_id": rule_in.rule_id, "category": rule_in.category})

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
def delete_rule(
    rule_id: str, 
    org_id: str = "org_inkloom", 
    current_user: dict = Depends(require_role("admin"))
):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM rules WHERE rule_id = ? AND org_id = ?", (rule_id, org_id))
    AuditService.log(org_id, current_user['id'], "rule_deleted", {"rule_id": rule_id})
    return {"status": "success", "deleted_rule_id": rule_id}

@router.post("/ingest")
def ingest_guidelines(
    req: IngestRequest, 
    org_id: str = "org_inkloom", 
    current_user: dict = Depends(require_role("admin"))
):
    user_id = current_user['id']
    extracted_rules = RAGService.split_and_extract_rules(req.content)
    if not extracted_rules:
        extracted_rules = [
            {"rule_id": f"GEN-{idx+1:02d}", "category": "tone", "title": line[:40], "text": line, "details": ""}
            for idx, line in enumerate(req.content.splitlines()) if len(line.strip()) > 10
        ]

    version_pk = str(uuid.uuid4())
    now = datetime.utcnow().isoformat() + "Z"

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("UPDATE guideline_versions SET is_active = 0 WHERE org_id = ?", (org_id,))
        cursor.execute("""
            INSERT INTO guideline_versions (id, org_id, version, title, raw_content, is_active, uploaded_at)
            VALUES (?, ?, ?, ?, ?, 1, ?)
        """, (version_pk, org_id, req.version, req.title, req.content, now))

        for r in extracted_rules:
            r_pk = str(uuid.uuid4())
            embedding = EmbeddingService.embed(
                f"{r['rule_id']} {r['category']} {r['title']} {r['text']} {r.get('details') or ''}"
            )
            if settings.is_postgres:
                cursor.execute("""
                    INSERT INTO rules
                    (id, version_id, org_id, rule_id, category, title, text, details, embedding_json, embedding, is_active, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?::vector, 1, ?)
                """, (r_pk, version_pk, org_id, r['rule_id'], r['category'], r['title'],
                      r['text'], r.get('details'), json.dumps(embedding) if embedding else None,
                      EmbeddingService.to_vector_literal(embedding) if embedding else None, now))
            else:
                cursor.execute("""
                    INSERT INTO rules
                    (id, version_id, org_id, rule_id, category, title, text, details, embedding_json, is_active, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
                """, (r_pk, version_pk, org_id, r['rule_id'], r['category'], r['title'],
                      r['text'], r.get('details'), json.dumps(embedding) if embedding else None, now))

    AuditService.log(org_id, user_id, "guideline_version_ingested", {
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

# --- Terminology Dictionary ---

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
def create_terminology(
    item: TerminologyCreate, 
    org_id: str = "org_inkloom",
    current_user: dict = Depends(require_role("admin"))
):
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

    AuditService.log(org_id, current_user['id'], "terminology_created", {"banned": item.banned_term, "preferred": item.preferred_term})
    return {"id": pk, "banned_term": item.banned_term, "preferred_term": item.preferred_term, "context": item.context, "severity": item.severity}

@router.delete("/terminology/{term_id}")
def delete_terminology(
    term_id: str, 
    org_id: str = "org_inkloom",
    current_user: dict = Depends(require_role("admin"))
):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM terminology_entries WHERE id = ? AND org_id = ?", (term_id, org_id))
    AuditService.log(org_id, current_user['id'], "terminology_deleted", {"term_id": term_id})
    return {"status": "success", "deleted_term_id": term_id}

# --- Approved Facts ---

@router.get("/facts", response_model=List[ApprovedFactItem])
def get_approved_facts(org_id: str = "org_inkloom"):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM approved_facts WHERE org_id = ? ORDER BY last_updated DESC", (org_id,))
        return cursor.fetchall()

@router.post("/facts", response_model=ApprovedFactItem)
def create_approved_fact(
    item: ApprovedFactCreate,
    org_id: str = "org_inkloom",
    current_user: dict = Depends(require_role("admin"))
):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM guideline_versions WHERE org_id = ? AND is_active = 1 LIMIT 1", (org_id,))
        v_row = cursor.fetchone()
        version_id = v_row['id'] if v_row else "gv_v3_2"
        pk = str(uuid.uuid4())
        now_date = datetime.utcnow().strftime("%Y-%m-%d")
        cursor.execute("""
            INSERT INTO approved_facts (id, org_id, version_id, fact_key, claim_text, approved_metric, citation, last_updated)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (pk, org_id, version_id, item.fact_key, item.claim_text, item.approved_metric, item.citation, now_date))

    AuditService.log(org_id, current_user['id'], "fact_created", {"fact_key": item.fact_key, "approved_metric": item.approved_metric})
    return {
        "id": pk,
        "fact_key": item.fact_key,
        "claim_text": item.claim_text,
        "approved_metric": item.approved_metric,
        "citation": item.citation,
        "last_updated": now_date
    }

@router.put("/facts/{fact_id}", response_model=ApprovedFactItem)
def update_approved_fact(
    fact_id: str,
    item: ApprovedFactUpdate,
    org_id: str = "org_inkloom",
    current_user: dict = Depends(require_role("admin"))
):
    now_date = datetime.utcnow().strftime("%Y-%m-%d")
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM approved_facts WHERE id = ? AND org_id = ?", (fact_id, org_id))
        fact = cursor.fetchone()
        if not fact:
            raise HTTPException(status_code=404, detail="Approved fact not found")

        fact_key = item.fact_key if item.fact_key is not None else fact['fact_key']
        claim_text = item.claim_text if item.claim_text is not None else fact['claim_text']
        approved_metric = item.approved_metric if item.approved_metric is not None else fact['approved_metric']
        citation = item.citation if item.citation is not None else fact['citation']

        cursor.execute("""
            UPDATE approved_facts
            SET fact_key = ?, claim_text = ?, approved_metric = ?, citation = ?, last_updated = ?
            WHERE id = ? AND org_id = ?
        """, (fact_key, claim_text, approved_metric, citation, now_date, fact_id, org_id))

    AuditService.log(org_id, current_user['id'], "fact_updated", {"fact_id": fact_id, "approved_metric": approved_metric})
    return {
        "id": fact_id,
        "fact_key": fact_key,
        "claim_text": claim_text,
        "approved_metric": approved_metric,
        "citation": citation,
        "last_updated": now_date
    }

@router.delete("/facts/{fact_id}")
def delete_approved_fact(
    fact_id: str,
    org_id: str = "org_inkloom",
    current_user: dict = Depends(require_role("admin"))
):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM approved_facts WHERE id = ? AND org_id = ?", (fact_id, org_id))
    AuditService.log(org_id, current_user['id'], "fact_deleted", {"fact_id": fact_id})
    return {"status": "success", "deleted_fact_id": fact_id}

# --- Brand Colors ---

@router.get("/colors", response_model=List[BrandColorItem])
def get_brand_colors(org_id: str = "org_inkloom"):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM brand_colors WHERE org_id = ?", (org_id,))
        return cursor.fetchall()

@router.post("/colors", response_model=BrandColorItem)
def create_brand_color(
    item: BrandColorCreate,
    org_id: str = "org_inkloom",
    current_user: dict = Depends(require_role("admin"))
):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM guideline_versions WHERE org_id = ? AND is_active = 1 LIMIT 1", (org_id,))
        v_row = cursor.fetchone()
        version_id = v_row['id'] if v_row else "gv_v3_2"
        pk = str(uuid.uuid4())
        cursor.execute("""
            INSERT INTO brand_colors (id, org_id, version_id, name, hex_code, role, min_contrast)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (pk, org_id, version_id, item.name, item.hex_code.upper(), item.role, item.min_contrast))

    AuditService.log(org_id, current_user['id'], "color_created", {"name": item.name, "hex": item.hex_code})
    return {
        "id": pk,
        "name": item.name,
        "hex_code": item.hex_code.upper(),
        "role": item.role,
        "min_contrast": item.min_contrast
    }

@router.delete("/colors/{color_id}")
def delete_brand_color(
    color_id: str,
    org_id: str = "org_inkloom",
    current_user: dict = Depends(require_role("admin"))
):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM brand_colors WHERE id = ? AND org_id = ?", (color_id, org_id))
    AuditService.log(org_id, current_user['id'], "color_deleted", {"color_id": color_id})
    return {"status": "success", "deleted_color_id": color_id}

# --- Brand Logos ---

@router.get("/logos", response_model=List[BrandLogoItem])
def get_brand_logos(org_id: str = "org_inkloom"):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM brand_logos WHERE org_id = ?", (org_id,))
        return cursor.fetchall()

@router.post("/logos/upload", response_model=BrandLogoItem)
async def upload_brand_logo(
    name: str = Form(...),
    file: UploadFile = File(...),
    aspect_ratio: float = Form(1.0),
    min_clearance_pct: float = Form(10.0),
    org_id: str = Form("org_inkloom"),
    current_user: dict = Depends(require_role("admin"))
):
    logo_id = str(uuid.uuid4())
    file_ext = Path(file.filename).suffix or ".png"
    saved_filename = f"logo_{logo_id}{file_ext}"
    dest_path = settings.STATIC_LOGO_DIR / saved_filename

    contents = await file.read()
    with open(dest_path, "wb") as f:
        f.write(contents)

    file_hash = hashlib.sha256(contents).hexdigest()
    relative_url = f"/static/logos/{saved_filename}"

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM guideline_versions WHERE org_id = ? AND is_active = 1 LIMIT 1", (org_id,))
        v_row = cursor.fetchone()
        version_id = v_row['id'] if v_row else "gv_v3_2"

        cursor.execute("""
            INSERT INTO brand_logos (id, org_id, version_id, name, file_path, file_hash, aspect_ratio, min_clearance_pct)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (logo_id, org_id, version_id, name, relative_url, file_hash, aspect_ratio, min_clearance_pct))

    AuditService.log(org_id, current_user['id'], "logo_uploaded", {"name": name, "hash": file_hash[:16]})

    return {
        "id": logo_id,
        "org_id": org_id,
        "version_id": version_id,
        "name": name,
        "file_path": relative_url,
        "file_hash": file_hash,
        "aspect_ratio": aspect_ratio,
        "min_clearance_pct": min_clearance_pct
    }

@router.delete("/logos/{logo_id}")
def delete_brand_logo(
    logo_id: str,
    org_id: str = "org_inkloom",
    current_user: dict = Depends(require_role("admin"))
):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM brand_logos WHERE id = ? AND org_id = ?", (logo_id, org_id))
    AuditService.log(org_id, current_user['id'], "logo_deleted", {"logo_id": logo_id})
    return {"status": "success", "deleted_logo_id": logo_id}
