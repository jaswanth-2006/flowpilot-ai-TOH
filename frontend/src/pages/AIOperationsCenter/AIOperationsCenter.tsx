import { useEffect, useMemo, useRef, useState, type ChangeEvent, type ClipboardEvent, type FormEvent } from "react";
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  CheckCircle2,
  Clock3,
  FileText,
  Loader2,
  RefreshCcw,
  ShieldCheck,
  Sparkles,
  TrendingUp,
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

import Sidebar from "../../components/layout/Sidebar";
import Navbar from "../../components/layout/Navbar";
import { Button } from "../../components/ui/button";
import {
  createExecutionPlan,
  getExecutionPlan,
  getApiErrorMessage,
  approveExecutionPlan,
  updateFinalRecommendation,
  type BusinessMemoryItem,
  type ExecutionPlanRecord,
  type FinalRecommendation,
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

type ExtractedDetails = {
  customerName?: string;
  products?: string[];
  quantities?: string;
  budget?: string;
  deadline?: string;
  source?: string;
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
    position: { x: index % 2 === 0 ? 24 : 520, y: index * 220 },
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
        color: active ? "#0f766e" : "#94a3b8",
      },
      style: {
        stroke: active ? "#0f766e" : "#94a3b8",
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
    <div className="rounded-3xl border border-white/60 bg-white p-4 shadow-[0_16px_40px_-34px_rgba(15,23,42,0.35)] transition-transform duration-200 hover:-translate-y-0.5">
      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{label}</div>
      <div className="mt-2 text-lg font-semibold text-slate-950">{value}</div>
      {sublabel ? <div className="mt-1 text-sm text-slate-500">{sublabel}</div> : null}
    </div>
  );
}

function parseQuoteAmount(value: string | undefined) {
  if (!value) {
    return null;
  }
  const numeric = value.replace(/[^0-9.]/g, "");
  const amount = Number(numeric);
  return Number.isFinite(amount) ? amount : null;
}

function parseLeadDays(value: string | undefined) {
  if (!value) {
    return null;
  }
  const raw = value.toLowerCase();
  const match = raw.match(/(\d+)/);
  if (!match) {
    return null;
  }
  const days = Number(match[1]);
  if (raw.includes("week")) {
    return days * 7;
  }
  if (raw.includes("day")) {
    return days;
  }
  if (raw.includes("month")) {
    return days * 30;
  }
  return days;
}

function getConfidenceProfile(finalRecommendation: FinalRecommendation | null, planStatus: PlanStatus, approvalStatus: string) {
  const quoteAmount = parseQuoteAmount(finalRecommendation?.estimated_quote);
  const marginValue = Number(finalRecommendation?.expected_margin?.match(/(\d+\.?\d*)/)?.[1] ?? 0);
  const deliveryDays = parseLeadDays(finalRecommendation?.delivery_timeline);
  const reasoningLength = finalRecommendation?.business_reasoning?.length ?? 0;
  const approvalClear = approvalStatus === "approved" || approvalStatus === "pending";

  let score = 64;
  if (quoteAmount && quoteAmount > 0) {
    score += 8;
  }
  if (marginValue >= 16) {
    score += 8;
  }
  if (deliveryDays && deliveryDays <= 10) {
    score += 8;
  }
  if (reasoningLength > 140) {
    score += 6;
  }
  if (planStatus === "completed") {
    score += 4;
  }
  if (approvalClear) {
    score += 2;
  }
  if (!finalRecommendation?.supplier || finalRecommendation.supplier.toLowerCase().includes("not found")) {
    score -= 18;
  }
  score = Math.max(45, Math.min(97, score));

  if (score >= 86) {
    return { score, label: "High", tone: "bg-emerald-50 text-emerald-700", detail: "This recommendation is strongly grounded in business context and delivery viability." };
  }
  if (score >= 72) {
    return { score, label: "Strong", tone: "bg-cyan-50 text-cyan-700", detail: "The proposal is credible and ready for human review with light validation." };
  }
  return { score, label: "Medium", tone: "bg-amber-50 text-amber-700", detail: "The plan is directionally sound but would benefit from a reviewer check before launch." };
}

export default function AIOperationsCenter() {
  const [enquiry, setEnquiry] = useState("");
  const [activePlan, setActivePlan] = useState<ExecutionPlanRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedSnapshotId, setSelectedSnapshotId] = useState<string | null>(null);
  const [thinkingCursor, setThinkingCursor] = useState(0);
  const [approvalNote, setApprovalNote] = useState<string>("");
  const [editingRecommendation, setEditingRecommendation] = useState(false);
  const [recommendationDraft, setRecommendationDraft] = useState({
    supplier: "",
    products: "",
    estimated_quote: "",
    expected_margin: "",
    delivery_timeline: "",
  });
  const [savingRecommendation, setSavingRecommendation] = useState(false);
  const [decisionInFlight, setDecisionInFlight] = useState(false);
  const [extractedFields, setExtractedFields] = useState<ExtractedDetails | null>(null);
  const [processingUpload, setProcessingUpload] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const thinkingPanel = activePlan?.execution_plan.thinking_panel ?? [];
  const decisionPanel = activePlan?.execution_plan.decision_panel ?? [];
  const businessMemory = activePlan?.execution_plan.business_memory ?? [];
  const executionHistory = activePlan?.execution_plan.execution_history ?? [];
  const finalRecommendation = activePlan?.execution_plan.final_recommendation as FinalRecommendation | null;
  const approvalStatus = activePlan?.execution_plan.approval_status ?? "pending";
  const planStatus = activePlan?.status ?? "pending";
  const confidenceProfile = useMemo(
    () => getConfidenceProfile(finalRecommendation, planStatus, approvalStatus),
    [approvalStatus, finalRecommendation, planStatus],
  );
  const recommendationConfidence = confidenceProfile.label;

  function parseAmount(value: string | undefined): number | null {
    if (!value) {
      return null;
    }
    const numeric = value.replace(/[^0-9.]/g, "");
    const amount = Number(numeric);
    return Number.isFinite(amount) ? amount : null;
  }

  async function readFileAsText(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ""));
      reader.onerror = () => reject(new Error("Unable to read file."));
      reader.readAsText(file);
    });
  }

  async function extractTextFromPdf(file: File): Promise<string> {
    const arrayBuffer = await file.arrayBuffer();
    const pdfjsLib: any = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const workerUrl = new URL("pdfjs-dist/legacy/build/pdf.worker.min.mjs", import.meta.url);
    pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl.toString();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let content = "";
    for (let pageIndex = 1; pageIndex <= pdf.numPages; pageIndex += 1) {
      const page = await pdf.getPage(pageIndex);
      const pageText = await page.getTextContent();
      content += pageText.items.map((item: any) => item.str).join(" ") + "\n\n";
    }
    return content;
  }

  async function extractTextFromImage(file: File): Promise<string> {
    const tesseract: any = await import("tesseract.js");
    const worker = await tesseract.createWorker("eng", undefined, { logger: () => null });
    const blobUrl = URL.createObjectURL(file);
    try {
      const { data } = await worker.recognize(blobUrl);
      return data.text;
    } finally {
      URL.revokeObjectURL(blobUrl);
      await worker.terminate();
    }
  }

  function parseStructuredDetails(text: string, source?: string): { enquiryText: string; details: ExtractedDetails } {
    const normalizedText = text.replace(/\r\n/g, "\n");
    const firstLines = normalizedText.split("\n").slice(0, 8).join(" ");

    const findMatch = (patterns: RegExp[]) => {
      for (const pattern of patterns) {
        const match = pattern.exec(normalizedText);
        if (match?.[1]) {
          return match[1].trim();
        }
      }
      return undefined;
    };

    const customerName = findMatch([
      /Customer\s*Name[:\-]\s*(.+)/i,
      /Customer[:\-]\s*(.+)/i,
      /Dear\s+([A-Za-z][A-Za-z\s]+?)(?:,|\n)/i,
      /Hi\s+([A-Za-z][A-Za-z\s]+?)(?:,|\n)/i,
      /Hello\s+([A-Za-z][A-Za-z\s]+?)(?:,|\n)/i,
    ]);

    const budget = findMatch([
      /budget[:\-]?\s*\$?([\d,]+(?:\.\d+)?)/i,
      /budgeted[:\-]?\s*\$?([\d,]+(?:\.\d+)?)/i,
      /\$([\d,]+(?:\.\d+)?)(?:\s*(?:budget|max|cap|limit))?/i,
      /(?:budget|cost|spend|quote|estimate|pricing)[^\n]*?\$?([\d,]+(?:\.\d+)?)/i,
    ]);

    const deadline = findMatch([
      /deadline[:\-]?\s*([A-Za-z0-9 ,/\-]+)/i,
      /due\s*(?:by)?\s*([A-Za-z0-9 ,/\-]+)/i,
      /deliver(?:y)?\s*(?:by|on)\s*([A-Za-z0-9 ,/\-]+)/i,
    ]);

    const rawLines = normalizedText.split("\n").map((line) => line.trim()).filter(Boolean);
    const products: string[] = [];
    const quantities: string[] = [];

    const productPattern = /(?:product[s]?|item[s]?|sku)[:\-]?\s*([A-Za-z0-9&\- ]+?)(?:\s*[:\-]\s*(\d+))?(?:\s*(?:units|pcs|pieces|qty|quantity))?/gi;
    let match: RegExpExecArray | null;
    while ((match = productPattern.exec(normalizedText))) {
      if (match[1]) {
        const itemName = match[1].trim();
        if (itemName && !products.includes(itemName)) {
          products.push(itemName);
        }
        if (match[2]) {
          quantities.push(`${match[2]} ${itemName}`);
        }
      }
    }

    for (const line of rawLines) {
      const lineMatch = line.match(/^[-*•]?\s*(\d+)?\s*([A-Za-z0-9&\- ]+?)(?:\s*[x×]\s*(\d+))?(?:\s*[:\-]\s*(\d+))?$/);
      if (lineMatch) {
        const itemName = lineMatch[2]?.trim();
        if (itemName && !products.includes(itemName)) {
          products.push(itemName);
        }
        if (lineMatch[1]) {
          quantities.push(`${lineMatch[1]} ${itemName}`);
        }
        if (lineMatch[3]) {
          quantities.push(`${lineMatch[3]} ${itemName}`);
        }
      }
    }

    const uniqueProducts = products.slice(0, 8);
    const uniqueQuantities = quantities.length ? [...new Set(quantities)].join(", ") : undefined;

    const details: ExtractedDetails = {
      customerName,
      products: uniqueProducts.length ? uniqueProducts : undefined,
      quantities: uniqueQuantities,
      budget,
      deadline,
      source,
    };

    const inquirySegments = [
      source ? `Source: ${source}.` : undefined,
      customerName ? `Customer: ${customerName}.` : undefined,
      uniqueProducts.length ? `Products: ${uniqueProducts.join(", ")}.` : undefined,
      uniqueQuantities ? `Quantities: ${uniqueQuantities}.` : undefined,
      budget ? `Budget: ${budget}.` : undefined,
      deadline ? `Deadline: ${deadline}.` : undefined,
      "Customer request text:",
      firstLines || "",
    ].filter(Boolean);

    return {
      enquiryText: inquirySegments.join(" "),
      details,
    };
  }

  async function handleExtractedText(text: string, source?: string) {
    const normalized = text.trim();
    if (!normalized) {
      return;
    }
    const parsed = parseStructuredDetails(normalized, source);
    setExtractedFields(parsed.details);
    setEnquiry(parsed.enquiryText);
    try {
      setLoading(true);
      setError(null);
      const response = await createExecutionPlan(parsed.enquiryText);
      setActivePlan(response.data);
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, "Unable to generate an execution plan from the uploaded content."));
    } finally {
      setLoading(false);
    }
  }

  async function handleFileUpload(file: File) {
    setUploadError(null);
    setProcessingUpload(true);
    try {
      let extractedText = "";
      if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
        extractedText = await extractTextFromPdf(file);
      } else if (file.type.startsWith("image/") || /\.(png|jpe?g|bmp|gif|webp|avif)$/i.test(file.name)) {
        extractedText = await extractTextFromImage(file);
      } else {
        extractedText = await readFileAsText(file);
      }
      await handleExtractedText(extractedText, file.name);
    } catch (uploadErr) {
      setUploadError(String(uploadErr instanceof Error ? uploadErr.message : "Failed to extract text from the uploaded file."));
    } finally {
      setProcessingUpload(false);
    }
  }

  function handlePaste(event: ClipboardEvent<HTMLTextAreaElement>) {
    const items = Array.from(event.clipboardData.items || []);
    const fileItem = items.find((item) => item.kind === "file");
    if (fileItem) {
      event.preventDefault();
      const file = fileItem.getAsFile();
      if (file) {
        void handleFileUpload(file);
      }
      return;
    }

    const clipboardText = event.clipboardData.getData("text/plain")?.trim();
    if (clipboardText) {
      const looksLikeEmail = /@|Dear|Hi\s|Hello\s|Regards|Sent:/i.test(clipboardText);
      if (looksLikeEmail && clipboardText.length > 40) {
        event.preventDefault();
        void handleExtractedText(clipboardText, "Pasted email");
      }
    }
  }

  async function handleFileInputChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    await handleFileUpload(file);
    event.target.value = "";
  }

  function triggerFilePicker() {
    fileInputRef.current?.click();
  }

  const isBusy = loading || processingUpload || refreshing || decisionInFlight || savingRecommendation;
  const selectedSnapshot = useMemo(
    () => executionHistory.find((snapshot) => snapshot.id === selectedSnapshotId) ?? null,
    [executionHistory, selectedSnapshotId],
  );
  const activeSteps = selectedSnapshot?.workflow_state ?? activePlan?.execution_plan.workflow_steps ?? [];
  const visibleSnapshot = selectedSnapshot ?? executionHistory[executionHistory.length - 1] ?? null;
  const workflowGraph = useMemo(() => buildWorkflowGraph(activeSteps), [activeSteps]);
  const nodeTypes = useMemo(() => ({ workflowStep: WorkflowNode }), []);
  const completedSteps = useMemo(() => activeSteps.filter((step) => step.status === "completed").length, [activeSteps]);
  const runningStep = useMemo(() => activeSteps.find((step) => step.status === "running") ?? null, [activeSteps]);
  const completedThinking = thinkingPanel.length ? Math.min(thinkingCursor + 1, thinkingPanel.length) : 0;
  const isStreaming = activePlan?.status === "running";
  const streamingText = isStreaming ? (refreshing ? "Live streaming updates" : "Awaiting next execution update") : undefined;

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
      } catch (requestError) {
        setError(getApiErrorMessage(requestError, "Unable to refresh the AI Operations Center replay."));
      } finally {
        setRefreshing(false);
      }
    }, 1800);

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
      setError(getApiErrorMessage(requestError, "Unable to generate an AI operations plan right now."));
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
      setError(getApiErrorMessage(requestError, "Unable to refresh the AI Operations Center replay."));
    } finally {
      setRefreshing(false);
    }
  }

  function generateQuotationPdf() {
    if (!finalRecommendation || !activePlan) {
      return;
    }

    const printWindow = window.open("", "_blank", "width=910,height=1200");
    if (!printWindow) {
      setError("Please allow popups so the quotation can be exported as a PDF.");
      return;
    }

    const quoteAmount = parseAmount(finalRecommendation.estimated_quote);
    const confidenceLabel = confidenceProfile.label;
    const quoteHtml = `<!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>FlowPilot Quotation</title>
          <style>
            body { font-family: Inter, Arial, sans-serif; margin: 0; padding: 24px; color: #0f172a; background: #f8fafc; }
            .card { background: white; border-radius: 24px; padding: 28px; box-shadow: 0 20px 60px rgba(15, 23, 42, 0.12); }
            .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; }
            .badge { display: inline-block; padding: 6px 10px; border-radius: 999px; background: #ecfeff; color: #0f766e; font-weight: 700; font-size: 12px; letter-spacing: 0.18em; text-transform: uppercase; }
            .meta { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin: 18px 0; }
            .box { border: 1px solid #e2e8f0; border-radius: 16px; padding: 12px 14px; }
            .label { font-size: 11px; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase; color: #64748b; margin-bottom: 6px; }
            .value { font-size: 15px; font-weight: 700; color: #0f172a; }
            .section { margin-top: 18px; }
            .items { display: flex; flex-wrap: wrap; gap: 8px; }
            .pill { border-radius: 999px; background: #f8fafc; border: 1px solid #e2e8f0; padding: 8px 10px; font-size: 13px; color: #334155; }
            .footer { margin-top: 22px; font-size: 13px; color: #475569; line-height: 1.6; }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="header">
              <div>
                <div class="badge">FlowPilot AI Quotation</div>
                <h1 style="margin: 10px 0 4px; font-size: 24px;">${finalRecommendation.supplier}</h1>
                <div style="font-size: 13px; color: #64748b;">Prepared for ${activePlan.enquiry}</div>
              </div>
              <div style="text-align: right;">
                <div class="badge">${confidenceLabel} confidence</div>
                <div style="margin-top: 8px; font-size: 14px; font-weight: 700; color: #0f172a;">${finalRecommendation.expected_margin}</div>
              </div>
            </div>
            <div class="meta">
              <div class="box"><div class="label">Estimated quote</div><div class="value">${finalRecommendation.estimated_quote || "TBD"}</div></div>
              <div class="box"><div class="label">Estimated cost</div><div class="value">${quoteAmount ? `$${quoteAmount.toFixed(2)}` : "TBD"}</div></div>
              <div class="box"><div class="label">Delivery</div><div class="value">${finalRecommendation.delivery_timeline}</div></div>
              <div class="box"><div class="label">Approval</div><div class="value">${finalRecommendation.approval_required}</div></div>
            </div>
            <div class="section">
              <div class="label">Recommended products</div>
              <div class="items">
                ${(finalRecommendation.products || []).map((product) => `<span class="pill">${product}</span>`).join("")}
              </div>
            </div>
            <div class="section">
              <div class="label">Business rationale</div>
              <div style="font-size: 14px; line-height: 1.7; color: #334155;">${finalRecommendation.business_reasoning}</div>
            </div>
            <div class="footer">
              This quotation was generated directly from the AI Operations Center recommendation workflow and is intended for executive review and approval.
            </div>
          </div>
        </body>
      </html>`;

    printWindow.document.write(quoteHtml);
    printWindow.document.close();
    setTimeout(() => {
      printWindow.focus();
      printWindow.print();
      printWindow.close();
    }, 300);
  }

  function buildRecommendationDraft(recommendation: FinalRecommendation | null) {
    return {
      supplier: recommendation?.supplier ?? "",
      products: recommendation?.products.join("\n") ?? "",
      estimated_quote: recommendation?.estimated_quote ?? "",
      expected_margin: recommendation?.expected_margin ?? "",
      delivery_timeline: recommendation?.delivery_timeline ?? "",
    };
  }

  async function handleApprove(decision: "approved" | "rejected" | "changes_requested") {
    if (!activePlan) {
      return;
    }

    try {
      setDecisionInFlight(true);
      setError(null);
      const result = await approveExecutionPlan(activePlan.id, decision, approvalNote || undefined);
      setActivePlan(result.data);
      setEditingRecommendation(false);
      setApprovalNote("");
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, "Unable to record the approval decision."));
    } finally {
      setDecisionInFlight(false);
    }
  }

  async function handleSaveRecommendation() {
    if (!activePlan) {
      return;
    }

    try {
      setSavingRecommendation(true);
      setError(null);
      const payload = {
        supplier: recommendationDraft.supplier,
        products: recommendationDraft.products
          .split(/\r?\n/)
          .map((product) => product.trim())
          .filter(Boolean),
        estimated_quote: recommendationDraft.estimated_quote,
        expected_margin: recommendationDraft.expected_margin,
        delivery_timeline: recommendationDraft.delivery_timeline,
      };

      const result = await updateFinalRecommendation(activePlan.id, payload);
      setActivePlan(result.data);
      setEditingRecommendation(false);
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, "Unable to save the recommendation changes."));
    } finally {
      setSavingRecommendation(false);
    }
  }

  useEffect(() => {
    if (editingRecommendation && finalRecommendation) {
      setRecommendationDraft(buildRecommendationDraft(finalRecommendation));
    }
  }, [editingRecommendation, finalRecommendation]);

  return (
    <div className="flex min-h-screen bg-[#f5f7fb] text-slate-900">
      <Sidebar />
      <div className="flex flex-1 flex-col">
        <Navbar />
        <main className="mx-auto w-full max-w-[1600px] flex-1 px-6 py-8 lg:px-10">
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

            <form onSubmit={handleSubmit} className="relative rounded-[28px] border border-white/10 bg-white/8 p-5 backdrop-blur transition-shadow duration-200 shadow-[0_20px_60px_-32px_rgba(15,23,42,0.18)]">
              {isBusy ? (
                <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-center justify-center rounded-[28px] border border-white/10 bg-slate-950/80 py-4 text-sm text-white backdrop-blur">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing AI plan updates...
                </div>
              ) : null}
              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-100">Customer Enquiry</span>
                <textarea
                  required
                  value={enquiry}
                  onChange={(event) => setEnquiry(event.target.value)}
                  onPaste={handlePaste}
                  rows={8}
                  className="w-full rounded-3xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm text-white outline-none transition-all duration-200 placeholder:text-slate-400 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20"
                  placeholder="Paste an email or upload a PDF / image / WhatsApp screenshot to auto-extract enquiry fields."
                />
              </label>

              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap gap-2 text-xs text-slate-300">
                  <button
                    type="button"
                    onClick={triggerFilePicker}
                    className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm text-white transition hover:border-cyan-400 hover:bg-white/15"
                  >
                    Upload PDF / image
                  </button>
                  <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-2">Paste email or screenshot text</span>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,image/*"
                  className="hidden"
                  onChange={handleFileInputChange}
                />
              </div>

              {processingUpload ? (
                <div className="mt-3 rounded-2xl border border-cyan-300 bg-cyan-50/20 px-4 py-3 text-sm text-cyan-900">
                  Extracting enquiry from uploaded content...
                </div>
              ) : null}
              {uploadError ? (
                <div className="mt-3 rounded-2xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {uploadError}
                </div>
              ) : null}
              {extractedFields ? (
                <div className="mt-3 grid gap-3 rounded-3xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 lg:grid-cols-2">
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400 lg:col-span-2">Extracted request details</div>
                  {extractedFields.customerName ? <div className="rounded-3xl bg-white px-4 py-3 shadow-sm"><span className="font-semibold text-slate-950">Customer:</span> {extractedFields.customerName}</div> : null}
                  {extractedFields.products?.length ? <div className="rounded-3xl bg-white px-4 py-3 shadow-sm"><span className="font-semibold text-slate-950">Products:</span> {extractedFields.products.join(", ")}</div> : null}
                  {extractedFields.quantities ? <div className="rounded-3xl bg-white px-4 py-3 shadow-sm"><span className="font-semibold text-slate-950">Quantities:</span> {extractedFields.quantities}</div> : null}
                  {extractedFields.budget ? <div className="rounded-3xl bg-white px-4 py-3 shadow-sm"><span className="font-semibold text-slate-950">Budget:</span> {extractedFields.budget}</div> : null}
                  {extractedFields.deadline ? <div className="rounded-3xl bg-white px-4 py-3 shadow-sm"><span className="font-semibold text-slate-950">Deadline:</span> {extractedFields.deadline}</div> : null}
                </div>
              ) : null}

              <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                <Button type="submit" className="rounded-2xl px-5" disabled={loading || processingUpload}>
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
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-600">Execution Summary</p>
                    <h2 className="mt-1 text-2xl font-semibold text-slate-950">
                      {activePlan ? activePlan.execution_plan.intent : "Waiting for enquiry"}
                    </h2>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className={`rounded-full px-3 py-1 text-xs font-semibold ${PLAN_STATUS_STYLES[planStatus].className}`}>
                      {PLAN_STATUS_STYLES[planStatus].label}
                    </div>
                    {streamingText ? (
                      <div className="rounded-full bg-cyan-100 px-3 py-1 text-xs font-semibold text-cyan-700">
                        {streamingText}
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
                  <motion.div
                    className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-blue-500"
                    initial={{ width: 0 }}
                    animate={{ width: `${activeSteps.length ? (completedSteps / activeSteps.length) * 100 : 0}%` }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                  />
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

                <div className="mt-5 h-2 overflow-hidden rounded-full bg-slate-100">
                  <motion.div
                    className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-blue-500"
                    initial={{ width: 0 }}
                    animate={{ width: `${thinkingPanel.length ? (completedThinking / thinkingPanel.length) * 100 : 0}%` }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                  />
                </div>

                <div className="mt-5 grid gap-3">
                  {thinkingPanel.length ? (
                    <>
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.25 }}
                        className="rounded-[24px] border border-cyan-200 bg-gradient-to-br from-cyan-50 via-white to-slate-50 p-4"
                      >
                        <div className="flex items-center gap-2 text-sm font-semibold text-cyan-700">
                          <WandSparkles className="h-4 w-4" />
                          Current business signal
                        </div>
                        <p className="mt-3 text-sm leading-7 text-slate-700">
                          {thinkingPanel[thinkingCursor]
                            ? `${thinkingPanel[thinkingCursor].label}: ${thinkingPanel[thinkingCursor].detail}`
                            : "The engine is preparing an explainable recommendation for the customer request."}
                        </p>
                        <p className="mt-3 text-sm leading-7 text-slate-600">
                          {finalRecommendation?.business_reasoning
                            ? `Why this matters: ${finalRecommendation.business_reasoning}`
                            : "The reasoning is being grounded in supplier availability, delivery timing, and commercial fit."}
                        </p>
                      </motion.div>
                      {thinkingPanel.map((step, index) => {
                        const isActive = index === thinkingCursor;
                        const isComplete = index < thinkingCursor;
                        const statusLabel = isActive ? "Running" : isComplete ? "Completed" : "Pending";
                        return (
                          <motion.div
                            key={step.id}
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.35, delay: index * 0.05 }}
                            whileHover={{ y: -2 }}
                            className={`rounded-[24px] border px-4 py-4 transition ${isActive
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
                              <motion.div
                                className={`h-full rounded-full ${isActive ? "bg-gradient-to-r from-cyan-500 to-blue-500" : isComplete ? "bg-emerald-500" : "bg-slate-300"}`}
                                animate={{ width: isActive ? "72%" : isComplete ? "100%" : "28%" }}
                                transition={{ duration: 0.6, ease: "easeOut" }}
                              />
                            </div>
                          </motion.div>
                        );
                      })}
                    </>
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
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-600">Final recommendation</p>
                    <h3 className="mt-1 text-2xl font-semibold text-slate-950">Decision summary card</h3>
                  </div>
                  <div className="flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-500">
                    <Sparkles className="h-3.5 w-3.5" />
                    Recommendation
                  </div>
                </div>

                {finalRecommendation ? (
                  <div className="mt-5 grid gap-4">
                    <div className="rounded-[32px] border border-slate-200 bg-gradient-to-br from-slate-950 via-slate-900 to-cyan-950 p-6 text-white shadow-[0_20px_70px_-40px_rgba(15,23,42,0.72)]">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                          <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-100">
                            <BadgeCheck className="h-3.5 w-3.5" />
                            Executive recommendation
                          </div>
                          <h4 className="mt-4 text-2xl font-semibold">{finalRecommendation.supplier}</h4>
                          <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-300">
                            {finalRecommendation.business_reasoning}
                          </p>
                        </div>
                        <div className={`rounded-full px-3 py-1 text-sm font-semibold ${confidenceProfile.tone}`}>
                          {confidenceProfile.score}% {recommendationConfidence} confidence
                        </div>
                      </div>

                      <div className="mt-6 grid gap-3 md:grid-cols-3">
                        <div className="rounded-[22px] border border-white/10 bg-white/10 p-4 backdrop-blur">
                          <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-300">Estimated quote</div>
                          <div className="mt-2 text-xl font-semibold">{finalRecommendation.estimated_quote}</div>
                        </div>
                        <div className="rounded-[22px] border border-white/10 bg-white/10 p-4 backdrop-blur">
                          <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-300">Estimated margin</div>
                          <div className="mt-2 text-xl font-semibold">{finalRecommendation.expected_margin}</div>
                        </div>
                        <div className="rounded-[22px] border border-white/10 bg-white/10 p-4 backdrop-blur">
                          <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-300">Delivery</div>
                          <div className="mt-2 text-xl font-semibold">{finalRecommendation.delivery_timeline}</div>
                        </div>
                      </div>

                      <div className="mt-5 flex flex-wrap items-center gap-3">
                        <Button type="button" className="rounded-2xl px-5" onClick={() => setEditingRecommendation(true)} disabled={decisionInFlight || savingRecommendation}>
                          <FileText className="mr-2 h-4 w-4" />
                          Modify
                        </Button>
                        <Button type="button" variant="secondary" className="rounded-2xl px-5 bg-white text-slate-950 hover:bg-slate-100" onClick={() => handleApprove("approved")} disabled={decisionInFlight || savingRecommendation}>
                          <CheckCircle2 className="mr-2 h-4 w-4" />
                          Approve
                        </Button>
                        <Button type="button" variant="destructive" className="rounded-2xl px-5" onClick={() => handleApprove("rejected")} disabled={decisionInFlight || savingRecommendation}>
                          <ShieldCheck className="mr-2 h-4 w-4" />
                          Reject
                        </Button>
                        <Button type="button" variant="outline" className="rounded-2xl border-white/20 bg-white/10 px-5 text-white hover:bg-white/20" onClick={generateQuotationPdf} disabled={decisionInFlight || savingRecommendation}>
                          <TrendingUp className="mr-2 h-4 w-4" />
                          Generate quote PDF
                        </Button>
                      </div>
                    </div>

                    <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
                      <div className="text-sm font-semibold text-slate-900">Approval note</div>
                      <p className="mt-2 text-sm text-slate-600">Add optional feedback for the recommendation before approving, rejecting, or requesting changes.</p>
                      <textarea
                        value={approvalNote}
                        onChange={(event) => setApprovalNote(event.target.value)}
                        rows={3}
                        className="mt-3 w-full rounded-3xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none"
                        placeholder="Example: Please confirm delivery window or adjust margin requirements."
                      />
                    </div>

                    {editingRecommendation ? (
                      <div className="mt-5 rounded-[24px] border border-cyan-200 bg-cyan-50/20 p-5">
                        <div className="mb-4 text-sm font-semibold text-cyan-900">Modify recommendation</div>
                        <div className="grid gap-4">
                          <label className="space-y-2 text-sm text-slate-700">
                            <span>Supplier</span>
                            <input
                              value={recommendationDraft.supplier}
                              onChange={(event) => setRecommendationDraft((current) => ({ ...current, supplier: event.target.value }))}
                              className="w-full rounded-3xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none"
                            />
                          </label>
                          <label className="space-y-2 text-sm text-slate-700">
                            <span>Products (one per line)</span>
                            <textarea
                              value={recommendationDraft.products}
                              onChange={(event) => setRecommendationDraft((current) => ({ ...current, products: event.target.value }))}
                              rows={4}
                              className="w-full rounded-3xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none"
                            />
                          </label>
                          <div className="grid gap-4 sm:grid-cols-2">
                            <label className="space-y-2 text-sm text-slate-700">
                              <span>Margin</span>
                              <input
                                value={recommendationDraft.expected_margin}
                                onChange={(event) => setRecommendationDraft((current) => ({ ...current, expected_margin: event.target.value }))}
                                className="w-full rounded-3xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none"
                              />
                            </label>
                            <label className="space-y-2 text-sm text-slate-700">
                              <span>Delivery timeline</span>
                              <input
                                value={recommendationDraft.delivery_timeline}
                                onChange={(event) => setRecommendationDraft((current) => ({ ...current, delivery_timeline: event.target.value }))}
                                className="w-full rounded-3xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none"
                              />
                            </label>
                          </div>
                          <label className="space-y-2 text-sm text-slate-700">
                            <span>Estimated quote</span>
                            <input
                              value={recommendationDraft.estimated_quote}
                              onChange={(event) => setRecommendationDraft((current) => ({ ...current, estimated_quote: event.target.value }))}
                              className="w-full rounded-3xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none"
                            />
                          </label>
                        </div>

                        <div className="mt-5 flex flex-wrap gap-3">
                          <Button type="button" className="rounded-2xl px-5" onClick={handleSaveRecommendation} disabled={savingRecommendation || decisionInFlight}>
                            {savingRecommendation ? "Saving..." : "Save changes"}
                          </Button>
                          <Button type="button" variant="outline" className="rounded-2xl px-5" onClick={() => setEditingRecommendation(false)} disabled={savingRecommendation || decisionInFlight}>
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : null}

                    <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
                      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Products</div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {finalRecommendation.products.length ? (
                          finalRecommendation.products.map((product) => (
                            <span key={product} className="rounded-full bg-white px-3 py-2 text-sm text-slate-700 shadow-sm">
                              {product}
                            </span>
                          ))
                        ) : (
                          <span className="text-sm text-slate-500">No products listed.</span>
                        )}
                      </div>
                    </div>

                    <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
                      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Business reasoning</div>
                      <p className="mt-3 text-sm leading-6 text-slate-600">{finalRecommendation.business_reasoning}</p>
                    </div>
                  </div>
                ) : (
                  <div className="mt-5 rounded-[24px] border border-dashed border-slate-300 bg-slate-50/80 px-5 py-10 text-center text-sm text-slate-500">
                    Final recommendation will appear here once the plan is generated.
                  </div>
                )}
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
                        <motion.div
                          key={step.id}
                          initial={{ opacity: 0, x: 12 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.35, delay: index * 0.04 }}
                          className={`rounded-[24px] border bg-slate-50 p-4 ${step.status === "running" ? "border-cyan-200" : "border-slate-200"}`}
                        >
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
                        </motion.div>
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
        </main>
      </div>
    </div>
  );
}
