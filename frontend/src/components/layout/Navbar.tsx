import { Bell, ChevronRight, Search } from "lucide-react";
import { useLocation } from "react-router-dom";

const TITLES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/customers": "Customers",
  "/products": "Products",
  "/suppliers": "Suppliers",
  "/execution-engine": "AI Execution Engine",
};

export default function Navbar() {
  const location = useLocation();
  const title = TITLES[location.pathname] ?? "FlowPilot AI";

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/75 px-6 py-4 backdrop-blur-xl lg:px-8">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
            Workspace
            <ChevronRight className="h-3 w-3" />
            {title}
          </div>
          <h2 className="mt-1 truncate text-2xl font-semibold tracking-tight text-slate-950">
            {title}
          </h2>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            className="hidden h-10 items-center gap-2 rounded-full border border-slate-200 bg-white px-4 text-sm text-slate-500 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 md:flex"
          >
            <Search className="h-4 w-4" />
            Search
          </button>

          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
          >
            <Bell className="h-4 w-4" />
          </button>

          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-slate-950 to-blue-700 text-sm font-semibold text-white shadow-lg shadow-slate-900/20">
            A
          </div>
        </div>
      </div>
    </header>
  );
}