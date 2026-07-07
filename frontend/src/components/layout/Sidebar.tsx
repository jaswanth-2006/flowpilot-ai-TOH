import {
  LayoutDashboard,
  Inbox,
  Bot,
  Users,
  Package,
  Truck,
  FileText,
  CheckCircle,
  BarChart3,
  Settings,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

const menu = [
  { icon: LayoutDashboard, label: "Dashboard", to: "/dashboard" },
  { icon: Inbox, label: "Inbox" },
  { icon: Bot, label: "AI Operations Center", to: "/ai-operations-center" },
  { icon: Users, label: "Customers", to: "/customers" },
  { icon: Package, label: "Products", to: "/products" },
  { icon: Truck, label: "Suppliers", to: "/suppliers" },
  { icon: FileText, label: "Quotations", to: "/quotations" },
  { icon: CheckCircle, label: "Approvals", to: "/approvals" },
  { icon: BarChart3, label: "Analytics", to: "/analytics" },
  { icon: Settings, label: "Settings", to: "/settings" },
];

export default function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <aside className="sticky top-0 z-20 flex min-h-screen w-full max-w-[280px] flex-col border-r border-slate-800/70 bg-slate-950/95 p-5 text-white shadow-[20px_0_80px_-40px_rgba(15,23,42,0.9)] backdrop-blur-xl lg:w-[280px]">
      <div className="rounded-[28px] border border-white/10 bg-white/5 p-5 shadow-inner shadow-white/5 transition-all duration-200 ease-out hover:shadow-[0_10px_30px_-20px_rgba(255,255,255,0.25)]">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-400 text-sm font-semibold text-slate-950 shadow-lg shadow-cyan-500/20">
            FP
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-white">FlowPilot</h1>
            <p className="text-sm text-slate-400">AI Business Operating System</p>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-white/10 bg-slate-900/80 px-3 py-2 text-xs text-slate-300">
          Linear-inspired workspace with Supabase-backed operations.
        </div>
      </div>

      <div className="mt-6 flex-1 space-y-2 overflow-y-auto pr-1">
        {menu.map((item) => (
          <div
            key={item.label}
            onClick={item.to ? () => navigate(item.to) : undefined}
            className={`group flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition-all duration-200 ${item.to
                ? location.pathname === item.to
                  ? "cursor-pointer bg-white/12 text-white shadow-sm ring-1 ring-white/10"
                  : "cursor-pointer text-slate-300 hover:bg-white/8 hover:text-white"
                : "cursor-default text-slate-500"
              }`}
          >
            <item.icon size={18} className={location.pathname === item.to ? "text-cyan-300" : "text-slate-400 group-hover:text-cyan-300"} />

            <span className="truncate">{item.label}</span>
          </div>
        ))}
      </div>

      <div className="mt-6 rounded-[24px] border border-white/10 bg-gradient-to-br from-white/8 to-white/4 p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Status</p>
        <div className="mt-2 flex items-center gap-2 text-sm text-slate-200">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_0_4px_rgba(52,211,153,0.15)]" />
          System online
        </div>
      </div>
    </aside>
  );
}