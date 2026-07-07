import axios from "axios";

type FastApiValidationError = {
  loc?: Array<string | number>;
  msg?: string;
};

function formatDetail(detail: unknown): string | null {
  if (!detail) {
    return null;
  }

  if (typeof detail === "string") {
    return detail;
  }

  if (Array.isArray(detail)) {
    const messages = detail
      .map((item: FastApiValidationError) => {
        const location = item.loc?.slice(1).join(".");
        return item.msg ? `${location ? `${location}: ` : ""}${item.msg}` : null;
      })
      .filter(Boolean);
    return messages.length ? messages.join(" ") : null;
  }

  if (typeof detail === "object" && "message" in detail) {
    return String((detail as { message?: unknown }).message ?? "");
  }

  return null;
}

export function getApiErrorMessage(error: unknown, fallback: string) {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    const detail = formatDetail(error.response?.data?.detail) || formatDetail(error.response?.data);
    if (detail) {
      return status ? `${detail} (HTTP ${status})` : detail;
    }

    if (error.code === "ERR_NETWORK") {
      return "Cannot reach the FlowPilot backend. Start FastAPI on the configured API URL and try again.";
    }
  }

  return error instanceof Error ? error.message : fallback;
}
