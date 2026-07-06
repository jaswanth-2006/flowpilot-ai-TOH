import axios from "axios";

export type StepStatus = "pending" | "running" | "completed" | "failed";
export type PlanStatus = "pending" | "running" | "completed" | "failed";
export type ReplayFrameType =
  | "plan_created"
  | "plan_running"
  | "step_running"
  | "step_completed"
  | "step_failed"
  | "plan_completed"
  | "plan_failed";

export type ThinkingStatus = "pending" | "running" | "completed";

export type WorkflowStep = {
  id: string;
  title: string;
  description: string;
  reasoning: string;
  expected_output: string;
  input_summary: string;
  output_summary: string;
  execution_time_seconds: number;
  assigned_agent: string;
  order: number;
  status: StepStatus;
};

export type ThinkingPanelStep = {
  id: string;
  label: string;
  detail: string;
  status: ThinkingStatus;
};

export type DecisionItem = {
  title: string;
  why: string;
  evidence: string[];
  selected_option: string;
  confidence: string;
};

export type BusinessMemoryItem = {
  execution_id?: string | null;
  title: string;
  summary: string;
  similarity_reason: string;
  influence: string;
};

export type ExecutionSnapshot = {
  id: string;
  type: ReplayFrameType;
  timestamp: string;
  note: string;
  active_step_id?: string | null;
  active_step_title?: string | null;
  workflow_state: WorkflowStep[];
};

export type RiskAnalysisItem = {
  risk: string;
  impact: string;
  mitigation: string;
};

export type FinalRecommendation = {
  supplier: string;
  products: string[];
  estimated_quote: string;
  expected_margin: string;
  delivery_timeline: string;
  approval_required: string;
  business_reasoning: string;
  confidence_score?: string;
};

export type ExecutionPlanContent = {
  intent: string;
  required_tasks: string[];
  required_agents: string[];
  thinking_panel: ThinkingPanelStep[];
  decision_panel: DecisionItem[];
  workflow_steps: WorkflowStep[];
  risk_analysis: RiskAnalysisItem[];
  approval_requirement: string;
  approval_status: string;
  final_recommendation?: FinalRecommendation | null;
  business_memory: BusinessMemoryItem[];
  execution_history: ExecutionSnapshot[];
};

export type RecommendationUpdateRequest = {
  supplier?: string;
  products?: string[];
  expected_margin?: string;
  delivery_timeline?: string;
  estimated_quote?: string;
};

export type ExecutionPlanRecord = {
  id: string;
  enquiry: string;
  status: PlanStatus;
  execution_plan: ExecutionPlanContent;
  created_at?: string | null;
  updated_at?: string | null;
};

export type ExecutionPlanResponse = {
  message: string;
  data: ExecutionPlanRecord;
};

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "http://localhost:8000",
});

export async function createExecutionPlan(enquiry: string) {
  const response = await api.post<ExecutionPlanResponse>("/execution-engine/plans", {
    enquiry,
  });
  return response.data;
}

export async function getExecutionPlan(planId: string) {
  const response = await api.get<ExecutionPlanRecord>(`/execution-engine/plans/${planId}`);
  return response.data;
}

export async function getExecutionPlans() {
  const response = await api.get<ExecutionPlanRecord[]>("/execution-engine/plans");
  return response.data;
}

export async function approveExecutionPlan(planId: string, decision: "approved" | "rejected" | "changes_requested", note?: string) {
  const response = await api.post<ExecutionPlanResponse>(`/execution-engine/plans/${planId}/approval`, {
    decision,
    note,
  });
  return response.data;
}

export async function updateFinalRecommendation(planId: string, payload: RecommendationUpdateRequest) {
  const response = await api.patch<ExecutionPlanResponse>(`/execution-engine/plans/${planId}/recommendation`, payload);
  return response.data;
}
