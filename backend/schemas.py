from typing import Optional, List, Dict, Any, Literal
from pydantic import BaseModel, Field

# User & Org Schemas
class UserBase(BaseModel):
    id: str
    org_id: str
    email: str
    name: str
    role: Literal['creator', 'reviewer', 'admin']
    avatar: Optional[str] = None

class LoginRequest(BaseModel):
    email: str
    password: str

class UserCreate(BaseModel):
    email: str
    name: str
    password: str = Field(min_length=8)
    role: Literal['creator', 'reviewer']

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserBase

class OrganizationBase(BaseModel):
    id: str
    name: str
    slug: str

# Rule Schemas
class RuleItem(BaseModel):
    id: str
    version_id: str
    org_id: str
    rule_id: str
    category: Literal['tone', 'terminology', 'facts', 'claims', 'color', 'logo', 'accessibility']
    title: str
    text: str
    details: Optional[str] = None
    is_active: bool = True

class RuleCreate(BaseModel):
    rule_id: str
    category: Literal['tone', 'terminology', 'facts', 'claims', 'color', 'logo', 'accessibility']
    title: str
    text: str
    details: Optional[str] = None

# Terminology & Fact Schemas
class TerminologyItem(BaseModel):
    id: str
    banned_term: str
    preferred_term: str
    context: Optional[str] = None
    severity: str = "warning"

class ApprovedFactItem(BaseModel):
    id: str
    fact_key: str
    claim_text: str
    approved_metric: str
    citation: str
    last_updated: str

class ApprovedFactCreate(BaseModel):
    fact_key: str
    claim_text: str
    approved_metric: str
    citation: str

class ApprovedFactUpdate(BaseModel):
    fact_key: Optional[str] = None
    claim_text: Optional[str] = None
    approved_metric: Optional[str] = None
    citation: Optional[str] = None

class BrandColorItem(BaseModel):
    id: str
    name: str
    hex_code: str
    role: Literal['primary', 'secondary', 'accent', 'neutral', 'background']
    min_contrast: float = 4.5

class BrandColorCreate(BaseModel):
    name: str
    hex_code: str
    role: Literal['primary', 'secondary', 'accent', 'neutral', 'background']
    min_contrast: float = 4.5

class BrandLogoItem(BaseModel):
    id: str
    org_id: str
    version_id: str
    name: str
    file_path: str
    file_hash: str
    aspect_ratio: Optional[float] = 1.0
    min_clearance_pct: Optional[float] = 10.0

# Flag Schemas
class FlagItem(BaseModel):
    id: str
    revision_id: str
    rule_id: str
    category: str
    span: str
    start_idx: int = -1
    end_idx: int = -1
    start_time: Optional[float] = None
    end_time: Optional[float] = None
    frame_number: Optional[int] = None
    explanation: str
    fix: str
    confidence: float
    resolution: Literal['pending', 'accepted', 'edited', 'dismissed'] = 'pending'
    resolution_comment: Optional[str] = None
    resolved_by: Optional[str] = None
    resolved_at: Optional[str] = None
    layer: Literal['layer1_deterministic', 'layer2_semantic']

class FlagResolveRequest(BaseModel):
    resolution: Literal['accepted', 'edited', 'dismissed']
    edited_fix: Optional[str] = None
    comment: Optional[str] = None

# Draft & Revision Schemas
class RevisionItem(BaseModel):
    id: str
    draft_id: str
    version_num: int
    content_text: Optional[str] = None
    image_path: Optional[str] = None
    compliance_score: float = 0.0
    policy_coverage_status: Literal['covered', 'needs_review'] = 'covered'
    policy_coverage_reason: Optional[str] = None
    media_analysis: Optional[dict] = None
    created_at: str
    flags: List[FlagItem] = []

class DraftCreate(BaseModel):
    title: str
    content_type: Literal['text', 'image'] = 'text'
    content_text: Optional[str] = None

class DraftUpdate(BaseModel):
    title: Optional[str] = None
    content_text: Optional[str] = None

class DraftDetail(BaseModel):
    id: str
    org_id: str
    author_id: str
    author_name: Optional[str] = None
    title: str
    content_type: Literal['text', 'image', 'audio', 'video']
    current_version: int
    status: Literal['Submitted', 'Scanned', 'In Revision', 'Pending Approval', 'Approved', 'Changes Requested']
    content_ref: Optional[str] = None
    media_metadata: Optional[dict] = None
    created_at: str
    updated_at: str
    latest_revision: Optional[RevisionItem] = None
    history: List[RevisionItem] = []

# Approval & Comments
class CommentCreate(BaseModel):
    text: str
    decision: Optional[Literal['comment', 'approved', 'changes_requested', 'resubmitted']] = 'comment'

class ApprovalDecisionRequest(BaseModel):
    decision: Literal['Approved', 'Changes Requested']
    comment: str

# Scan Result Schemas
class ScanResponse(BaseModel):
    draft_id: str
    revision_id: str
    version_num: int
    compliance_score: float
    flags_count: int
    flags: List[FlagItem]
    scan_duration_ms: float
    status: str
    policy_coverage_status: Literal['covered', 'needs_review'] = 'covered'
    policy_coverage_reason: Optional[str] = None
    media_analysis: Optional[dict] = None

# Structured LLM Output Schema (Layer 2)
class SemanticFlagItem(BaseModel):
    rule_id: str = Field(description="Must match one of the retrieved valid rule IDs exactly (e.g. VOICE-01, CLAIM-01)")
    quoted_span: str = Field(description="Exact problematic substring in the draft")
    explanation: str = Field(description="Friendly explanation citing the brand rule")
    suggested_fix: str = Field(description="Non-destructive suggested replacement")
    confidence: float = Field(default=0.90, description="Confidence score between 0.0 and 1.0")

class SemanticScanOutput(BaseModel):
    flags: List[SemanticFlagItem] = []
    tone_summary: Optional[str] = None

# Benchmark & Evaluation Schemas
class EvaluationMetricTarget(BaseModel):
    metric: str
    target: str
    measured: str
    passed: bool
    details: str

class BenchmarkReport(BaseModel):
    run_timestamp: str
    total_test_samples: int
    flag_precision: float
    flag_precision_target: float
    review_turnaround_improvement: float
    review_turnaround_target: float
    first_pass_compliance_rate: float
    first_pass_compliance_target: float
    avg_first_feedback_seconds: float
    avg_first_feedback_target: float
    metrics_summary: List[EvaluationMetricTarget]
    sample_results: List[Dict[str, Any]]
