import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock3,
  Loader2,
  RefreshCcw,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import ReactFlow, {
  Background,
  Controls,
  Handle,
  MarkerType,
  type Edge,
  type Node,
  type NodeProps,
  Position,
} from "reactflow";
import "reactflow/dist/style.css";

import { Button } from "../../components/ui/button";
import {
  createExecutionPlan,
  getExecutionPlan,
  getApiErrorMessage,
  type ExecutionPlanRecord,
  type PlanStatus,
  type ReplayFrameType,
  type StepStatus,
  type WorkflowStep,
} from "../../services/executionEngine";

type ExecutionStepNodeData = {
  title: string;
  description: string;
  reasoning: string;
  expectedOutput: string;
  assignedAgent: string;
  status: StepStatus;
  order: number;
  isActive: boolean;
};

const PLAN_STATUS_STYLES: Record<PlanStatus, { label: string; className: string }> = {
  pending: { label: "Pending", className: "bg-slate-100 text-slate-600" },
  running: { label: "Running", className: "bg-blue-50 text-blue-700" },
  completed: { label: "Completed", className: "bg-emerald-50 text-emerald-700" },
  failed: { label: "Failed", className: "bg-rose-50 text-rose-700" },
};

const STEP_STATUS_STYLES: Record<StepStatus, { label: string; nodeClassName: string; borderClassName: string }> = {
  pending: {
    label: "Pending",
    nodeClassName: "bg-white text-slate-950",
    borderClassName: "border-slate-200",
  },
  running: {
    label: "Running",
    nodeClassName: "bg-blue-50 text-blue-950",
    borderClassName: "border-blue-300",
  },
  completed: {
    label: "Completed",
    nodeClassName: "bg-emerald-50 text-emerald-950",
    borderClassName: "border-emerald-300",
  },
  failed: {
    label: "Failed",
    nodeClassName: "bg-rose-50 text-rose-950",
    borderClassName: "border-rose-300",
  },
};

const REPLAY_FRAME_STYLES: Record<ReplayFrameType, { label: string; className: string }> = {
  plan_created: { label: "Plan created", className: "bg-slate-100 text-slate-700" },
  plan_running: { label: "Plan running", className: "bg-blue-50 text-blue-700" },
  step_running: { label: "Step running", className: "bg-blue-50 text-blue-700" },
  step_completed: { label: "Step completed", className: "bg-emerald-50 text-emerald-700" },
  step_failed: { label: "Step failed", className: "bg-rose-50 text-rose-700" },
  plan_completed: { label: "Plan completed", className: "bg-emerald-100 text-emerald-800" },
  plan_failed: { label: "Plan failed", className: "bg-rose-100 text-rose-800" },
};

function ExecutionStepNode({ data }: NodeProps<ExecutionStepNodeData>) {
  const statusStyle = STEP_STATUS_STYLES[data.status];

  return (
    <div className={`w-[320px] rounded-[28px] border bg-white p-4 shadow-[0_16px_50px_-38px_rgba(15,23,42,0.45)] ${statusStyle.borderClassName}`}>
      <Handle
        type="target"
        position={Position.Top}
        className="!h-3 !w-3 !border-2 !border-white !bg-slate-900"
      />
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
            Agent {data.order.toString().padStart(2, "0")}
          </div>
          <h4 className="mt-1 text-base font-semibold text-slate-950">{data.title}</h4>
        </div>
        <div className={`rounded-full px-3 py-1 text-[11px] font-semibold ${statusStyle.nodeClassName}`}>
          {statusStyle.label}
        </div>
      </div>

      <p className="mt-3 text-sm leading-6 text-slate-600">{data.description}</p>

      <div className="mt-4 grid gap-3 text-xs text-slate-500">
        <div className="rounded-2xl bg-slate-50 px-3 py-2">
          <div className="font-semibold uppercase tracking-[0.16em] text-slate-400">Reasoning</div>
          <div className="mt-1 leading-5 text-slate-600">{data.reasoning || "No reasoning returned by the model."}</div>
        </div>
        <div className="rounded-2xl bg-slate-50 px-3 py-2">
          <div className="font-semibold uppercase tracking-[0.16em] text-slate-400">Expected Output</div>
          <div className="mt-1 leading-5 text-slate-600">{data.expectedOutput || "No expected output returned by the model."}</div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-500">
        <span className="rounded-full bg-slate-100 px-3 py-1">Agent: {data.assignedAgent}</span>
        <span className="rounded-full bg-slate-100 px-3 py-1">Status: {statusStyle.label}</span>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="!h-3 !w-3 !border-2 !border-white !bg-slate-900"
      />
    </div>
  );
}

function buildFlowGraph(steps: WorkflowStep[]): { nodes: Array<Node<ExecutionStepNodeData>>; edges: Edge[] } {
  const nodes = steps.map((step, index) => ({
    id: step.id,
    type: "executionStep",
    position: { x: 0, y: index * 220 },
    data: {
      title: step.title,
      description: step.description,
      reasoning: step.reasoning,
      expectedOutput: step.expected_output,
      assignedAgent: step.assigned_agent,
      status: step.status,
      order: step.order,
      isActive: step.status === "running",
    },
    draggable: false,
    selectable: false,
    focusable: false,
  }));

  const edges = steps.slice(1).map((step, index) => {
    const previousStep = steps[index];
    const highlight = previousStep.status === "completed" || step.status === "running";

    return {
      id: `${previousStep.id}-${step.id}`,
      source: previousStep.id,
      target: step.id,
      type: "smoothstep",
      animated: step.status === "running",
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: highlight ? "#2563eb" : "#cbd5e1",
      },
      style: {
        stroke: highlight ? "#2563eb" : "#cbd5e1",
        strokeWidth: 2,
      },
    } satisfies Edge;
  });

  return { nodes, edges };
}

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

export default function ExecutionEngine() {
  const [enquiry, setEnquiry] = useState("");
  const [activePlan, setActivePlan] = useState<ExecutionPlanRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedSnapshotId, setSelectedSnapshotId] = useState<string | null>(null);

  const executionHistory = useMemo(
    () => activePlan?.execution_plan.execution_history ?? [],
    [activePlan],
  );
  const selectedSnapshot = useMemo(
    () => executionHistory.find((snapshot) => snapshot.id === selectedSnapshotId) ?? null,
    [executionHistory, selectedSnapshotId],
  );
  const activeSteps = selectedSnapshot?.workflow_state ?? activePlan?.execution_plan.workflow_steps ?? [];
  const visibleSnapshot = selectedSnapshot ?? executionHistory[executionHistory.length - 1] ?? null;
  const planStatus = activePlan?.status ?? "pending";
  const completedSteps = useMemo(
    () => activeSteps.filter((step) => step.status === "completed").length,
    [activeSteps],
  );
  const runningStep = useMemo(
    () => activeSteps.find((step) => step.status === "running") ?? null,
    [activeSteps],
  );
  const decomposedTaskCount = activePlan?.execution_plan.required_tasks.length ?? 0;
  const requiredAgentCount = activePlan?.execution_plan.required_agents.length ?? 0;
  const currentFrameLabel = visibleSnapshot ? REPLAY_FRAME_STYLES[visibleSnapshot.type] : null;

  const flowGraph = useMemo(() => buildFlowGraph(activeSteps), [activeSteps]);
  const nodeTypes = useMemo(() => ({ executionStep: ExecutionStepNode }), []);

  useEffect(() => {
    if (!executionHistory.length) {
      setSelectedSnapshotId(null);
      return;
    }

    setSelectedSnapshotId((currentSnapshotId) => {
      if (currentSnapshotId && executionHistory.some((snapshot) => snapshot.id === currentSnapshotId)) {
        return currentSnapshotId;
      }

      return executionHistory[executionHistory.length - 1].id;
    });
  }, [executionHistory]);

  useEffect(() => {
    if (!activePlan || (activePlan.status !== "running" && activePlan.status !== "pending")) {
      return undefined;
    }

    const intervalId = window.setInterval(async () => {
      try {
        setRefreshing(true);
        const updatedPlan = await getExecutionPlan(activePlan.id);
        setActivePlan(updatedPlan);
      } catch (requestError) {
        setError(getApiErrorMessage(requestError, "Unable to refresh the execution replay."));
      } finally {
        setRefreshing(false);
      }
    }, 2000);

    return () => window.clearInterval(intervalId);
  }, [activePlan]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedEnquiry = enquiry.trim();
    if (!trimmedEnquiry) {
      setError("Please describe the customer enquiry before generating a plan.");
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const response = await createExecutionPlan(trimmedEnquiry);
      setActivePlan(response.data);
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, "Unable to generate an execution plan right now."));
    } finally {
      setLoading(false);
    }
  }

  async function refreshNow() {
    if (!activePlan) {
      return;
    }

    try {
      setRefreshing(true);
      const updatedPlan = await getExecutionPlan(activePlan.id);
      setActivePlan(updatedPlan);
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, "Unable to refresh the execution replay."));
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#f5f7fb] text-slate-900">
      <div className="mx-auto max-w-7xl px-6 py-8 lg:px-10">
        <div className="overflow-hidden rounded-[36px] border border-slate-200/80 bg-white/90 shadow-[0_24px_80px_-44px_rgba(15,23,42,0.35)] backdrop-blur-xl">
          <div className="grid gap-6 border-b border-slate-100 bg-[radial-gradient(circle_at_top_right,rgba(56,189,248,0.18),transparent_28%),linear-gradient(135deg,#020617_0%,#0f172a_60%,#0b1120_100%)] px-6 py-8 text-white lg:grid-cols-[1.05fr_0.95fr] lg:px-8">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-blue-100">
                <Sparkles className="h-3.5 w-3.5" />
                AI Execution Engine
              </div>
              <h1 className="mt-5 text-4xl font-semibold tracking-tight lg:text-5xl">
                Turn customer enquiries into replayable execution plans.
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300 lg:text-base">
                Gemini analyzes the enquiry, decomposes the request into tasks, generates workflow steps,
                and writes every state transition into Supabase so the full run can be replayed in the UI.
              </p>

              <div className="mt-6 flex flex-wrap gap-3 text-sm text-slate-200">
                <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2">Intent analysis</div>
                <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2">React Flow replay graph</div>
                <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2">Supabase snapshots</div>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="rounded-[28px] border border-white/10 bg-white/8 p-5 backdrop-blur">
              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-100">Customer Enquiry</span>
                <textarea
                  required
                  value={enquiry}
                  onChange={(event) => setEnquiry(event.target.value)}
                  rows={8}
                  className="w-full rounded-3xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-400 focus:border-blue-400"
                  placeholder="Describe the customer request, business context, urgency, and outcome you want the engine to plan for."
                />
              </label>

              <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                <Button type="submit" className="rounded-2xl px-5" disabled={loading}>
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                  Generate Execution Plan
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-2xl border-white/20 bg-white/10 px-5 text-white hover:bg-white/20"
                  onClick={refreshNow}
                  disabled={!activePlan || refreshing}
                >
                  <RefreshCcw className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
                  Refresh Replay
                </Button>
              </div>

              {error ? (
                <div className="mt-4 rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
                  {error}
                </div>
              ) : null}
            </form>
          </div>

          <div className="grid gap-6 px-6 py-8 lg:grid-cols-[0.95fr_1.05fr] lg:px-8">
            <div className="space-y-6">
              <div className="rounded-[28px] border border-slate-200/80 bg-white/85 p-5 shadow-[0_18px_60px_-40px_rgba(15,23,42,0.35)] backdrop-blur-xl">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-600">Execution Status</p>
                    <h2 className="mt-1 text-2xl font-semibold text-slate-950">
                      {activePlan ? activePlan.execution_plan.intent : "Waiting for enquiry"}
                    </h2>
                  </div>
                  <div className={`rounded-full px-3 py-1 text-xs font-semibold ${PLAN_STATUS_STYLES[planStatus].className}`}>
                    {PLAN_STATUS_STYLES[planStatus].label}
                  </div>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-4">
                  <div className="rounded-2xl bg-white p-4 shadow-sm">
                    <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Required Tasks</div>
                    <div className="mt-2 text-lg font-semibold text-slate-950">{decomposedTaskCount}</div>
                  </div>
                  <div className="rounded-2xl bg-white p-4 shadow-sm">
                    <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Required Agents</div>
                    <div className="mt-2 text-lg font-semibold text-slate-950">{requiredAgentCount}</div>
                  </div>
                  <div className="rounded-2xl bg-white p-4 shadow-sm">
                    <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Completed Steps</div>
                    <div className="mt-2 text-lg font-semibold text-slate-950">{completedSteps}/{activeSteps.length}</div>
                  </div>
                  <div className="rounded-2xl bg-white p-4 shadow-sm">
                    <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Replay Frames</div>
                    <div className="mt-2 text-lg font-semibold text-slate-950">{executionHistory.length}</div>
                  </div>
                </div>

                {runningStep ? (
                  <div className="mt-5 rounded-3xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
                    Live step running: <span className="font-semibold">{runningStep.title}</span>
                  </div>
                ) : null}
              </div>

              <div className="rounded-[28px] border border-slate-200/80 bg-white/85 p-5 shadow-[0_18px_60px_-40px_rgba(15,23,42,0.35)] backdrop-blur-xl">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-blue-600" />
                  <h3 className="text-lg font-semibold text-slate-950">Approval Requirement</h3>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  {activePlan?.execution_plan.approval_requirement ?? "Generate a plan to see approval requirements."}
                </p>
              </div>

              <div className="rounded-[28px] border border-slate-200/80 bg-white/85 p-5 shadow-[0_18px_60px_-40px_rgba(15,23,42,0.35)] backdrop-blur-xl">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-amber-600" />
                  <h3 className="text-lg font-semibold text-slate-950">Risk Analysis</h3>
                </div>
                <div className="mt-4 space-y-3">
                  {activePlan?.execution_plan.risk_analysis?.length ? (
                    activePlan.execution_plan.risk_analysis.map((riskItem, index) => (
                      <div key={`${riskItem.risk}-${index}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <div className="font-medium text-slate-950">{riskItem.risk}</div>
                        <div className="mt-1 text-sm text-slate-600">Impact: {riskItem.impact}</div>
                        <div className="mt-1 text-sm text-slate-600">Mitigation: {riskItem.mitigation}</div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-slate-500">No risk analysis available yet.</p>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="rounded-[28px] border border-slate-200/80 bg-white/85 p-5 shadow-[0_18px_60px_-40px_rgba(15,23,42,0.35)] backdrop-blur-xl">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-600">Replay</p>
                    <h3 className="mt-1 text-2xl font-semibold text-slate-950">Execution frames</h3>
                  </div>
                  <div className="flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-500">
                    <Clock3 className="h-3.5 w-3.5" />
                    {visibleSnapshot ? formatTimestamp(visibleSnapshot.timestamp) : "No frames yet"}
                  </div>
                </div>

                <div className="mt-5 flex gap-3 overflow-x-auto pb-1">
                  {executionHistory.length ? (
                    executionHistory.map((snapshot, index) => {
                      const frameStyle = REPLAY_FRAME_STYLES[snapshot.type];
                      const isSelected = snapshot.id === visibleSnapshot?.id;

                      return (
                        <button
                          key={snapshot.id}
                          type="button"
                          onClick={() => setSelectedSnapshotId(snapshot.id)}
                          className={`min-w-[180px] rounded-3xl border px-4 py-3 text-left transition ${
                            isSelected
                              ? "border-blue-300 bg-blue-50 shadow-sm"
                              : "border-slate-200 bg-white hover:border-slate-300"
                          }`}
                        >
                          <div className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${frameStyle.className}`}>
                            {frameStyle.label}
                          </div>
                          <div className="mt-3 text-sm font-semibold text-slate-950">Frame {index + 1}</div>
                          <div className="mt-1 text-xs leading-5 text-slate-500">{snapshot.note}</div>
                        </button>
                      );
                    })
                  ) : (
                    <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50/80 px-5 py-6 text-sm text-slate-500">
                      Execute a plan to generate replay frames.
                    </div>
                  )}
                </div>

                {visibleSnapshot ? (
                  <div className="mt-5 rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                    <div className="flex flex-wrap items-center gap-3">
                      <div className={`rounded-full px-3 py-1 text-xs font-semibold ${REPLAY_FRAME_STYLES[visibleSnapshot.type].className}`}>
                        {REPLAY_FRAME_STYLES[visibleSnapshot.type].label}
                      </div>
                      <div className="text-sm font-medium text-slate-600">{visibleSnapshot.note}</div>
                      <div className="text-sm text-slate-400">{formatTimestamp(visibleSnapshot.timestamp)}</div>
                    </div>
                    {visibleSnapshot.active_step_title ? (
                      <div className="mt-3 text-sm text-slate-600">
                        Active step: <span className="font-semibold text-slate-950">{visibleSnapshot.active_step_title}</span>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>

              <div className="rounded-[28px] border border-slate-200/80 bg-white/85 p-5 shadow-[0_18px_60px_-40px_rgba(15,23,42,0.35)] backdrop-blur-xl">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-600">Workflow Graph</p>
                    <h3 className="mt-1 text-2xl font-semibold text-slate-950">React Flow execution map</h3>
                  </div>
                  <div className="flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-500">
                    <ArrowRight className="h-3.5 w-3.5" />
                    {activeSteps.length} nodes
                  </div>
                </div>

                <div className="mt-5 overflow-hidden rounded-[28px] border border-slate-200 bg-[linear-gradient(180deg,#f8fbff_0%,#eef4ff_100%)]">
                  <div className="h-[700px] w-full">
                    {activeSteps.length ? (
                      <ReactFlow
                        nodes={flowGraph.nodes}
                        edges={flowGraph.edges}
                        nodeTypes={nodeTypes}
                        fitView
                        nodesDraggable={false}
                        nodesConnectable={false}
                        elementsSelectable={false}
                        panOnDrag={false}
                        zoomOnScroll={false}
                        zoomOnDoubleClick={false}
                        className="bg-transparent"
                      >
                        <Background gap={28} color="#cbd5e1" />
                        <Controls showInteractive={false} position="bottom-right" />
                      </ReactFlow>
                    ) : (
                      <div className="flex h-full items-center justify-center px-6 text-center text-sm text-slate-500">
                        Submit a customer enquiry to generate the workflow graph.
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="rounded-[28px] border border-slate-200/80 bg-white/85 p-5 shadow-[0_18px_60px_-40px_rgba(15,23,42,0.35)] backdrop-blur-xl">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-600">Step Details</p>
                    <h3 className="mt-1 text-2xl font-semibold text-slate-950">Generated by Gemini</h3>
                  </div>
                  {currentFrameLabel ? (
                    <div className={`rounded-full px-3 py-1 text-xs font-semibold ${currentFrameLabel.className}`}>
                      {currentFrameLabel.label}
                    </div>
                  ) : null}
                </div>

                <div className="mt-5 space-y-4">
                  {activeSteps.length > 0 ? (
                    activeSteps.map((step, index) => {
                      const statusStyle = STEP_STATUS_STYLES[step.status];

                      return (
                        <div key={step.id} className={`rounded-[24px] border bg-slate-50 p-4 ${step.status === "running" ? "border-blue-200" : "border-slate-200"}`}>
                          <div className="flex items-start gap-4">
                            <div className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-white">
                              {step.status === "completed" ? (
                                <CheckCircle2 className="h-5 w-5" />
                              ) : step.status === "running" ? (
                                <Loader2 className="h-5 w-5 animate-spin" />
                              ) : (
                                <span className="text-sm font-semibold">{index + 1}</span>
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                  <h4 className="text-base font-semibold text-slate-950">{step.title}</h4>
                                  <p className="mt-1 text-sm leading-6 text-slate-600">{step.description}</p>
                                </div>
                                <div className={`rounded-full px-3 py-1 text-xs font-semibold ${statusStyle.nodeClassName}`}>
                                  {statusStyle.label}
                                </div>
                              </div>

                              <div className="mt-3 grid gap-3 text-sm text-slate-600 lg:grid-cols-3">
                                <div className="rounded-2xl bg-white px-3 py-3 shadow-sm">
                                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Reasoning</div>
                                  <div className="mt-1 leading-6">{step.reasoning || "No reasoning provided."}</div>
                                </div>
                                <div className="rounded-2xl bg-white px-3 py-3 shadow-sm">
                                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Expected Output</div>
                                  <div className="mt-1 leading-6">{step.expected_output || "No output description provided."}</div>
                                </div>
                                <div className="rounded-2xl bg-white px-3 py-3 shadow-sm">
                                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Assigned Agent</div>
                                  <div className="mt-1 leading-6">{step.assigned_agent}</div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50/80 px-5 py-10 text-center">
                      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-blue-600 shadow-sm">
                        <ArrowRight className="h-5 w-5" />
                      </div>
                      <p className="mt-4 text-base font-semibold text-slate-950">No workflow generated yet</p>
                      <p className="mt-2 text-sm leading-6 text-slate-500">
                        Submit a customer enquiry to generate the execution timeline dynamically.
                      </p>
                    </div>
                  )}
                </div>

                {activePlan?.execution_plan.required_tasks?.length ? (
                  <div className="mt-6 rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                    <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Required Tasks</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {activePlan.execution_plan.required_tasks.map((task) => (
                        <span key={task} className="rounded-full bg-white px-3 py-1 text-sm text-slate-700 shadow-sm">
                          {task}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}

                {activePlan?.execution_plan.required_agents?.length ? (
                  <div className="mt-4 rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                    <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Required Agents</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {activePlan.execution_plan.required_agents.map((agent) => (
                        <span key={agent} className="rounded-full bg-white px-3 py-1 text-sm text-slate-700 shadow-sm">
                          {agent}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
