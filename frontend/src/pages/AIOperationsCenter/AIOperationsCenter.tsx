import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock3,
  Loader2,
  RefreshCcw,
  Sparkles,
  WandSparkles,
} from "lucide-react";
import ReactFlow, {
  Background,
  Controls,
  Handle,
  MarkerType,
  Position,
  type Edge,
  type Node,
  type NodeProps,
} from "reactflow";
import { motion } from "framer-motion";
import "reactflow/dist/style.css";

import { Button } from "../../components/ui/button";
import {
  createExecutionPlan,
  getExecutionPlan,
  type BusinessMemoryItem,
  type ExecutionPlanRecord,
  type PlanStatus,
  type ReplayFrameType,
  type StepStatus,
  type WorkflowStep,
} from "../../services/executionEngine";

type WorkflowNodeData = {
  title: string;
  description: string;
  reasoning: string;
  inputSummary: string;
  outputSummary: string;
  executionTimeSeconds: number;
  assignedAgent: string;
  status: StepStatus;
  order: number;
};

const PLAN_STATUS_STYLES: Record<PlanStatus, { label: string; className: string }> = {
  pending: { label: "Pending", className: "bg-slate-100 text-slate-600" },
  running: { label: "Running", className: "bg-cyan-50 text-cyan-700" },
  completed: { label: "Completed", className: "bg-emerald-50 text-emerald-700" },
  failed: { label: "Failed", className: "bg-rose-50 text-rose-700" },
};

const STEP_STATUS_STYLES: Record<StepStatus, { label: string; chip: string; border: string }> = {
  pending: { label: "Pending", chip: "bg-slate-100 text-slate-600", border: "border-slate-200" },
  running: { label: "Running", chip: "bg-cyan-50 text-cyan-700", border: "border-cyan-300" },
  completed: { label: "Completed", chip: "bg-emerald-50 text-emerald-700", border: "border-emerald-300" },
  failed: { label: "Failed", chip: "bg-rose-50 text-rose-700", border: "border-rose-300" },
};

const REPLAY_STYLES: Record<ReplayFrameType, { label: string; className: string }> = {
  plan_created: { label: "Plan created", className: "bg-slate-100 text-slate-700" },
  plan_running: { label: "Plan running", className: "bg-cyan-50 text-cyan-700" },
  step_running: { label: "Step running", className: "bg-cyan-50 text-cyan-700" },
  step_completed: { label: "Step completed", className: "bg-emerald-50 text-emerald-700" },
  step_failed: { label: "Step failed", className: "bg-rose-50 text-rose-700" },
  plan_completed: { label: "Plan completed", className: "bg-emerald-100 text-emerald-800" },
  plan_failed: { label: "Plan failed", className: "bg-rose-100 text-rose-800" },
};

function WorkflowNode({ data }: NodeProps<WorkflowNodeData>) {
  const style = STEP_STATUS_STYLES[data.status];

  return (
    <div className={`w-[330px] rounded-[28px] border bg-white p-4 shadow-[0_16px_50px_-36px_rgba(15,23,42,0.45)] ${style.border}`}>
      <Handle type="target" position={Position.Top} className="!h-3 !w-3 !border-2 !border-white !bg-slate-900" />
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Step {data.order.toString().padStart(2, "0")}</div>
          <h4 className="mt-1 text-base font-semibold text-slate-950">{data.title}</h4>
        </div>
        <div className={`rounded-full px-3 py-1 text-[11px] font-semibold ${style.chip}`}>{style.label}</div>
      </div>

      <p className="mt-3 text-sm leading-6 text-slate-600">{data.description}</p>

      <div className="mt-4 space-y-3 text-xs text-slate-500">
        <div className="rounded-2xl bg-slate-50 px-3 py-2">
          <div className="font-semibold uppercase tracking-[0.18em] text-slate-400">Reason</div>
          <div className="mt-1 leading-5 text-slate-600">{data.reasoning || "No reasoning provided."}</div>
        </div>
        <div className="rounded-2xl bg-slate-50 px-3 py-2">
          <div className="font-semibold uppercase tracking-[0.18em] text-slate-400">Input</div>
          <div className="mt-1 leading-5 text-slate-600">{data.inputSummary || "No input summary provided."}</div>
        </div>
        <div className="rounded-2xl bg-slate-50 px-3 py-2">
          <div className="font-semibold uppercase tracking-[0.18em] text-slate-400">Output</div>
          <div className="mt-1 leading-5 text-slate-600">{data.outputSummary || "No output summary provided."}</div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-500">
        <span className="rounded-full bg-slate-100 px-3 py-1">Agent: {data.assignedAgent}</span>
        <span className="rounded-full bg-slate-100 px-3 py-1">{data.executionTimeSeconds.toFixed(1)}s</span>
      </div>

      <Handle type="source" position={Position.Bottom} className="!h-3 !w-3 !border-2 !border-white !bg-slate-900" />
    </div>
  );
}

function buildWorkflowGraph(steps: WorkflowStep[]): { nodes: Array<Node<WorkflowNodeData>>; edges: Edge[] } {
  const nodes = steps.map((step, index) => ({
    id: step.id,
    type: "workflowStep",
    position: { x: 0, y: index * 240 },
    data: {
      title: step.title,
      description: step.description,
      reasoning: step.reasoning,
      inputSummary: step.input_summary,
      outputSummary: step.output_summary,
      executionTimeSeconds: step.execution_time_seconds,
      assignedAgent: step.assigned_agent,
      status: step.status,
      order: step.order,
    },
    draggable: false,
    selectable: false,
    focusable: false,
  }));

  const edges = steps.slice(1).map((step, index) => {
    const previous = steps[index];
    const active = previous.status === "completed" || step.status === "running";
    return {
      id: `${previous.id}-${step.id}`,
      source: previous.id,
      target: step.id,
      type: "smoothstep",
      animated: step.status === "running",
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: active ? "#0891b2" : "#cbd5e1",
      },
      style: {
        stroke: active ? "#0891b2" : "#cbd5e1",
        strokeWidth: 2,
      },
    } satisfies Edge;
  });

  return { nodes, edges };
}

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(value));
}

function formatSeconds(value: number) {
  return `${value.toFixed(1)}s`;
}

function StatCard({ label, value, sublabel }: { label: string; value: string; sublabel?: string }) {
  return (
    <div className="rounded-3xl border border-white/60 bg-white p-4 shadow-[0_16px_40px_-34px_rgba(15,23,42,0.35)]">
      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{label}</div>
      <div className="mt-2 text-lg font-semibold text-slate-950">{value}</div>
      {sublabel ? <div className="mt-1 text-sm text-slate-500">{sublabel}</div> : null}
    </div>
  );
}

export default function AIOperationsCenter() {
  const [enquiry, setEnquiry] = useState("");
  const [activePlan, setActivePlan] = useState<ExecutionPlanRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedSnapshotId, setSelectedSnapshotId] = useState<string | null>(null);
  const [thinkingCursor, setThinkingCursor] = useState(0);

  const thinkingPanel = activePlan?.execution_plan.thinking_panel ?? [];
  const decisionPanel = activePlan?.execution_plan.decision_panel ?? [];
  const businessMemory = activePlan?.execution_plan.business_memory ?? [];
  const executionHistory = activePlan?.execution_plan.execution_history ?? [];
  const selectedSnapshot = useMemo(
    () => executionHistory.find((snapshot) => snapshot.id === selectedSnapshotId) ?? null,
    [executionHistory, selectedSnapshotId],
  );
  const activeSteps = selectedSnapshot?.workflow_state ?? activePlan?.execution_plan.workflow_steps ?? [];
  const visibleSnapshot = selectedSnapshot ?? executionHistory[executionHistory.length - 1] ?? null;
  const planStatus = activePlan?.status ?? "pending";
  const workflowGraph = useMemo(() => buildWorkflowGraph(activeSteps), [activeSteps]);
  const nodeTypes = useMemo(() => ({ workflowStep: WorkflowNode }), []);
  const completedSteps = useMemo(() => activeSteps.filter((step) => step.status === "completed").length, [activeSteps]);
  const runningStep = useMemo(() => activeSteps.find((step) => step.status === "running") ?? null, [activeSteps]);
  const completedThinking = thinkingPanel.length ? Math.min(thinkingCursor + 1, thinkingPanel.length) : 0;

  useEffect(() => {
    if (!executionHistory.length) {
      setSelectedSnapshotId(null);
      return;
    }

    setSelectedSnapshotId((currentId) => {
      if (currentId && executionHistory.some((snapshot) => snapshot.id === currentId)) {
        return currentId;
      }

      return executionHistory[executionHistory.length - 1].id;
    });
  }, [executionHistory]);

  useEffect(() => {
    if (!thinkingPanel.length) {
      setThinkingCursor(0);
      return;
    }

    const lastIndex = thinkingPanel.length - 1;
    if (planStatus === "completed" || planStatus === "failed") {
      setThinkingCursor(lastIndex);
      return;
    }

    const intervalId = window.setInterval(() => {
      setThinkingCursor((currentIndex) => (currentIndex >= lastIndex ? 0 : currentIndex + 1));
    }, 1100);

    return () => window.clearInterval(intervalId);
  }, [thinkingPanel.length, planStatus]);

  useEffect(() => {
    if (!activePlan || (activePlan.status !== "running" && activePlan.status !== "pending")) {
      return undefined;
    }

    const intervalId = window.setInterval(async () => {
      try {
        setRefreshing(true);
        const updatedPlan = await getExecutionPlan(activePlan.id);
        setActivePlan(updatedPlan);
      } catch {
        setError("Unable to refresh the AI Operations Center replay.");
      } finally {
        setRefreshing(false);
      }
    }, 1800);

    return () => window.clearInterval(intervalId);
  }, [activePlan]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      setLoading(true);
      setError(null);
      const response = await createExecutionPlan(enquiry);
      setActivePlan(response.data);
    } catch {
      setError("Unable to generate an AI operations plan right now.");
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
    } catch {
      setError("Unable to refresh the AI Operations Center replay.");
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.14),transparent_22%),linear-gradient(180deg,#f8fbff_0%,#eef4ff_100%)] text-slate-900">
      <div className="mx-auto max-w-[1600px] px-6 py-8 lg:px-10">
        <div className="overflow-hidden rounded-[36px] border border-slate-200/80 bg-white/90 shadow-[0_28px_90px_-50px_rgba(15,23,42,0.4)] backdrop-blur-xl">
          <div className="grid gap-6 border-b border-slate-100 bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.18),transparent_25%),linear-gradient(135deg,#081123_0%,#0f172a_45%,#11203a_100%)] px-6 py-8 text-white lg:grid-cols-[1.05fr_0.95fr] lg:px-8">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-cyan-100">
                <WandSparkles className="h-3.5 w-3.5" />
                AI Operations Center
              </div>
              <h1 className="mt-5 max-w-3xl text-4xl font-semibold tracking-tight lg:text-5xl">
                A replayable command center for AI reasoning, decisions, and workflow execution.
              </h1>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300 lg:text-base">
                The Operations Center turns a customer enquiry into an explainable operating plan. It streams the model's thought process,
                surfaces why each decision was made, shows a React Flow workflow graph, and keeps business memory visible so the demo feels
                like a true AI control room.
              </p>

              <div className="mt-6 flex flex-wrap gap-3 text-sm text-slate-200">
                <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2">Thinking panel</div>
                <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2">Decision explainability</div>
                <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2">Replay mode</div>
                <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2">Business memory</div>
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
                  className="w-full rounded-3xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-400 focus:border-cyan-400"
                  placeholder="Describe the customer request, urgency, product constraints, supplier considerations, and the business outcome you want the AI to orchestrate."
                />
              </label>

              <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                <Button type="submit" className="rounded-2xl px-5" disabled={loading}>
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                  Generate Operations Plan
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

          <div className="grid gap-6 px-6 py-8 xl:grid-cols-[1.02fr_0.98fr] xl:px-8">
            <div className="space-y-6">
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-[30px] border border-slate-200/80 bg-white/95 p-5 shadow-[0_18px_60px_-40px_rgba(15,23,42,0.3)]">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-600">Execution Summary</p>
                    <h2 className="mt-1 text-2xl font-semibold text-slate-950">
                      {activePlan ? activePlan.execution_plan.intent : "Waiting for enquiry"}
                    </h2>
                  </div>
                  <div className={`rounded-full px-3 py-1 text-xs font-semibold ${PLAN_STATUS_STYLES[planStatus].className}`}>
                    {PLAN_STATUS_STYLES[planStatus].label}
                  </div>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-4">
                  <StatCard label="Thinking steps" value={String(thinkingPanel.length)} sublabel="Animated reasoning phases" />
                  <StatCard label="Workflow steps" value={String(activeSteps.length)} sublabel="Operational sequence" />
                  <StatCard label="Completed steps" value={`${completedSteps}/${activeSteps.length || 0}`} sublabel="Current replay state" />
                  <StatCard label="Memory signals" value={String(businessMemory.length)} sublabel="Prior execution influence" />
                </div>

                {runningStep ? (
                  <div className="mt-5 rounded-[24px] border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm text-cyan-900">
                    Live step running: <span className="font-semibold">{runningStep.title}</span>
                  </div>
                ) : null}
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="rounded-[30px] border border-slate-200/80 bg-white/95 p-5 shadow-[0_18px_60px_-40px_rgba(15,23,42,0.3)]">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-600">AI Thinking Panel</p>
                    <h3 className="mt-1 text-2xl font-semibold text-slate-950">Live model reasoning</h3>
                  </div>
                  <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-500">
                    {completedThinking}/{thinkingPanel.length || 0} active
                  </div>
                </div>

                <div className="mt-5 grid gap-3">
                  {thinkingPanel.length ? (
                    thinkingPanel.map((step, index) => {
                      const isActive = index === thinkingCursor;
                      const isComplete = index < thinkingCursor;
                      const statusLabel = isActive ? "Running" : isComplete ? "Completed" : "Pending";
                      return (
                        <div
                          key={step.id}
                          className={`rounded-[24px] border px-4 py-4 transition ${
                            isActive
                              ? "border-cyan-300 bg-cyan-50/70 shadow-sm"
                              : isComplete
                                ? "border-emerald-200 bg-emerald-50/40"
                                : "border-slate-200 bg-white"
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <span className={`h-2.5 w-2.5 rounded-full ${isActive ? "animate-pulse bg-cyan-500" : isComplete ? "bg-emerald-500" : "bg-slate-300"}`} />
                            <div>
                              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Thinking</div>
                              <div className="text-base font-semibold text-slate-950">{step.label}</div>
                            </div>
                            <div className={`ml-auto rounded-full px-3 py-1 text-xs font-semibold ${isActive ? "bg-cyan-100 text-cyan-700" : isComplete ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                              {statusLabel}
                            </div>
                          </div>
                          <p className="mt-3 text-sm leading-6 text-slate-600">{step.detail}</p>
                          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100">
                            <div
                              className={`h-full rounded-full transition-all ${isActive ? "animate-pulse bg-gradient-to-r from-cyan-500 to-blue-500" : isComplete ? "w-full bg-emerald-500" : "w-1/3 bg-slate-300"}`}
                              style={{ width: isActive ? "72%" : isComplete ? "100%" : "34%" }}
                            />
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50/80 px-5 py-10 text-center text-sm text-slate-500">
                      Submit a customer enquiry to animate the AI thinking panel.
                    </div>
                  )}
                </div>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="rounded-[30px] border border-slate-200/80 bg-white/95 p-5 shadow-[0_18px_60px_-40px_rgba(15,23,42,0.3)]">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-600">AI Decision Panel</p>
                    <h3 className="mt-1 text-2xl font-semibold text-slate-950">Why the engine chose this path</h3>
                  </div>
                  <div className="flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-500">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Explainability
                  </div>
                </div>

                <div className="mt-5 grid gap-4">
                  {decisionPanel.length ? (
                    decisionPanel.map((decision, index) => (
                      <div key={`${decision.title}-${index}`} className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                        <div className="flex flex-wrap items-center gap-3">
                          <h4 className="text-base font-semibold text-slate-950">{decision.title}</h4>
                          <span className="rounded-full bg-cyan-100 px-3 py-1 text-xs font-semibold text-cyan-700">
                            {decision.confidence} confidence
                          </span>
                        </div>
                        <p className="mt-2 text-sm leading-6 text-slate-600">{decision.why}</p>
                        <div className="mt-3 rounded-2xl bg-white px-4 py-3 text-sm text-slate-700 shadow-sm">
                          <span className="font-semibold text-slate-950">Why this choice:</span> {decision.selected_option}
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {decision.evidence.map((item) => (
                            <span key={item} className="rounded-full bg-white px-3 py-1 text-xs text-slate-600 shadow-sm">
                              {item}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50/80 px-5 py-10 text-center text-sm text-slate-500">
                      Decisions will appear here once the plan is generated.
                    </div>
                  )}
                </div>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="rounded-[30px] border border-slate-200/80 bg-white/95 p-5 shadow-[0_18px_60px_-40px_rgba(15,23,42,0.3)]">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-600">Business Memory</p>
                    <h3 className="mt-1 text-2xl font-semibold text-slate-950">Similar previous executions</h3>
                  </div>
                  <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-500">
                    Memory influence
                  </div>
                </div>

                <div className="mt-5 grid gap-4">
                  {businessMemory.length ? (
                    businessMemory.map((item: BusinessMemoryItem, index) => (
                      <div key={`${item.execution_id ?? item.title}-${index}`} className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                        <div className="flex flex-wrap items-center gap-3">
                          <h4 className="text-base font-semibold text-slate-950">{item.title}</h4>
                          {item.execution_id ? (
                            <span className="rounded-full bg-white px-3 py-1 text-xs text-slate-500 shadow-sm">#{item.execution_id.slice(0, 8)}</span>
                          ) : null}
                        </div>
                        <p className="mt-2 text-sm leading-6 text-slate-600">{item.summary}</p>
                        <div className="mt-3 grid gap-2 sm:grid-cols-2">
                          <div className="rounded-2xl bg-white px-4 py-3 text-sm text-slate-600 shadow-sm">
                            <span className="font-semibold text-slate-950">Similar because:</span> {item.similarity_reason}
                          </div>
                          <div className="rounded-2xl bg-white px-4 py-3 text-sm text-slate-600 shadow-sm">
                            <span className="font-semibold text-slate-950">Influence:</span> {item.influence}
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50/80 px-5 py-10 text-center text-sm text-slate-500">
                      The engine will surface similar past executions here.
                    </div>
                  )}
                </div>
              </motion.div>
            </div>

            <div className="space-y-6">
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-[30px] border border-slate-200/80 bg-white/95 p-5 shadow-[0_18px_60px_-40px_rgba(15,23,42,0.3)]">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-600">Replay Mode</p>
                    <h3 className="mt-1 text-2xl font-semibold text-slate-950">Step-by-step execution history</h3>
                  </div>
                  <div className="flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-500">
                    <Clock3 className="h-3.5 w-3.5" />
                    {visibleSnapshot ? formatTimestamp(visibleSnapshot.timestamp) : "No frames yet"}
                  </div>
                </div>

                <div className="mt-5 flex gap-3 overflow-x-auto pb-1">
                  {executionHistory.length ? (
                    executionHistory.map((snapshot, index) => {
                      const style = REPLAY_STYLES[snapshot.type];
                      const selected = snapshot.id === visibleSnapshot?.id;
                      return (
                        <button
                          key={snapshot.id}
                          type="button"
                          onClick={() => setSelectedSnapshotId(snapshot.id)}
                          className={`min-w-[190px] rounded-3xl border px-4 py-3 text-left transition ${selected ? "border-cyan-300 bg-cyan-50 shadow-sm" : "border-slate-200 bg-white hover:border-slate-300"}`}
                        >
                          <div className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${style.className}`}>
                            {style.label}
                          </div>
                          <div className="mt-3 text-sm font-semibold text-slate-950">Frame {index + 1}</div>
                          <div className="mt-1 text-xs leading-5 text-slate-500">{snapshot.note}</div>
                        </button>
                      );
                    })
                  ) : (
                    <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50/80 px-5 py-6 text-sm text-slate-500">
                      Replay frames will appear after the first execution.
                    </div>
                  )}
                </div>

                {visibleSnapshot ? (
                  <div className="mt-5 rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                    <div className="flex flex-wrap items-center gap-3">
                      <div className={`rounded-full px-3 py-1 text-xs font-semibold ${REPLAY_STYLES[visibleSnapshot.type].className}`}>
                        {REPLAY_STYLES[visibleSnapshot.type].label}
                      </div>
                      <div className="text-sm font-medium text-slate-600">{visibleSnapshot.note}</div>
                    </div>
                    {visibleSnapshot.active_step_title ? (
                      <div className="mt-3 text-sm text-slate-600">
                        Active step: <span className="font-semibold text-slate-950">{visibleSnapshot.active_step_title}</span>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="rounded-[30px] border border-slate-200/80 bg-white/95 p-5 shadow-[0_18px_60px_-40px_rgba(15,23,42,0.3)]">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-600">React Flow Visualization</p>
                    <h3 className="mt-1 text-2xl font-semibold text-slate-950">Generated workflow graph</h3>
                  </div>
                  <div className="flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-500">
                    <ArrowRight className="h-3.5 w-3.5" />
                    {activeSteps.length} nodes
                  </div>
                </div>

                <div className="mt-5 overflow-hidden rounded-[28px] border border-slate-200 bg-[linear-gradient(180deg,#f8fbff_0%,#eef8ff_100%)]">
                  <div className="h-[720px] w-full">
                    {activeSteps.length ? (
                      <ReactFlow
                        nodes={workflowGraph.nodes}
                        edges={workflowGraph.edges}
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
                        Generate a plan to view the workflow graph.
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="rounded-[30px] border border-slate-200/80 bg-white/95 p-5 shadow-[0_18px_60px_-40px_rgba(15,23,42,0.3)]">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-600">AI Execution Timeline</p>
                    <h3 className="mt-1 text-2xl font-semibold text-slate-950">Steps, input, output, and duration</h3>
                  </div>
                  {runningStep ? (
                    <div className="flex items-center gap-2 rounded-full bg-cyan-50 px-3 py-1 text-xs font-medium text-cyan-700">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Running live
                    </div>
                  ) : null}
                </div>

                <div className="mt-5 space-y-4">
                  {activeSteps.length ? (
                    activeSteps.map((step, index) => {
                      const style = STEP_STATUS_STYLES[step.status];
                      return (
                        <div key={step.id} className={`rounded-[24px] border bg-slate-50 p-4 ${step.status === "running" ? "border-cyan-200" : "border-slate-200"}`}>
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
                                <div className={`rounded-full px-3 py-1 text-xs font-semibold ${style.chip}`}>{style.label}</div>
                              </div>

                              <div className="mt-3 grid gap-3 text-sm text-slate-600 lg:grid-cols-2">
                                <div className="rounded-2xl bg-white px-3 py-3 shadow-sm">
                                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Reason</div>
                                  <div className="mt-1 leading-6">{step.reasoning || "No reasoning provided."}</div>
                                </div>
                                <div className="rounded-2xl bg-white px-3 py-3 shadow-sm">
                                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Input</div>
                                  <div className="mt-1 leading-6">{step.input_summary || "No input summary provided."}</div>
                                </div>
                                <div className="rounded-2xl bg-white px-3 py-3 shadow-sm">
                                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Output</div>
                                  <div className="mt-1 leading-6">{step.output_summary || "No output summary provided."}</div>
                                </div>
                                <div className="rounded-2xl bg-white px-3 py-3 shadow-sm">
                                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Execution time</div>
                                  <div className="mt-1 leading-6">{formatSeconds(step.execution_time_seconds)}</div>
                                </div>
                              </div>

                              <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                                <span className="rounded-full bg-white px-3 py-1 shadow-sm">Agent: {step.assigned_agent}</span>
                                <span className="rounded-full bg-white px-3 py-1 shadow-sm">Step ID: {step.id}</span>
                                <span className="rounded-full bg-white px-3 py-1 shadow-sm">Order: {step.order}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50/80 px-5 py-10 text-center text-sm text-slate-500">
                      Submit a customer enquiry to generate the execution timeline.
                    </div>
                  )}
                </div>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="rounded-[30px] border border-slate-200/80 bg-white/95 p-5 shadow-[0_18px_60px_-40px_rgba(15,23,42,0.3)]">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-cyan-600" />
                  <h3 className="text-lg font-semibold text-slate-950">Approval and Risk</h3>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  {activePlan?.execution_plan.approval_requirement ?? "Generate a plan to see approval requirements."}
                </p>

                <div className="mt-5 space-y-3">
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
              </motion.div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
