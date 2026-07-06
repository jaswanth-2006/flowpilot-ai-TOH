from typing import Literal

from pydantic import BaseModel, Field


StepStatus = Literal["pending", "running", "completed", "failed"]
ThinkingStatus = Literal["pending", "running", "completed"]
PlanStatus = Literal["pending", "running", "completed", "failed"]
ReplayFrameType = Literal[
    "plan_created",
    "plan_running",
    "step_running",
    "step_completed",
    "step_failed",
    "plan_completed",
    "plan_failed",
]


class ExecutionEnquiryCreate(BaseModel):
    enquiry: str = Field(min_length=10)


class RiskAnalysisItem(BaseModel):
    risk: str
    impact: str
    mitigation: str


class ThinkingPanelStep(BaseModel):
    id: str
    label: str
    detail: str
    status: ThinkingStatus = "pending"


class DecisionItem(BaseModel):
    title: str
    why: str
    evidence: list[str] = Field(default_factory=list)
    selected_option: str
    confidence: str


class BusinessMemoryItem(BaseModel):
    execution_id: str | None = None
    title: str
    summary: str
    similarity_reason: str
    influence: str


class WorkflowStep(BaseModel):
    id: str
    title: str
    description: str
    reasoning: str
    expected_output: str
    input_summary: str = ""
    output_summary: str = ""
    execution_time_seconds: float = 0.0
    assigned_agent: str
    order: int
    status: StepStatus = "pending"


class ExecutionSnapshot(BaseModel):
    id: str
    type: ReplayFrameType
    timestamp: str
    note: str
    active_step_id: str | None = None
    active_step_title: str | None = None
    workflow_state: list[WorkflowStep] = Field(default_factory=list)


class ExecutionPlanContent(BaseModel):
    intent: str
    required_tasks: list[str] = Field(default_factory=list)
    required_agents: list[str] = Field(default_factory=list)
    thinking_panel: list[ThinkingPanelStep] = Field(default_factory=list)
    decision_panel: list[DecisionItem] = Field(default_factory=list)
    workflow_steps: list[WorkflowStep] = Field(default_factory=list)
    risk_analysis: list[RiskAnalysisItem] = Field(default_factory=list)
    approval_requirement: str
    business_memory: list[BusinessMemoryItem] = Field(default_factory=list)
    execution_history: list[ExecutionSnapshot] = Field(default_factory=list)


class ExecutionPlanRecord(BaseModel):
    id: str
    enquiry: str
    status: PlanStatus
    execution_plan: ExecutionPlanContent
    created_at: str | None = None
    updated_at: str | None = None
