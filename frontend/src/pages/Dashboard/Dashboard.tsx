import Sidebar from "../../components/layout/Sidebar";
import Navbar from "../../components/layout/Navbar";

export default function Dashboard() {
  return (
    <div className="flex min-h-screen">
      <Sidebar />

      <div className="flex-1 flex flex-col">
        <Navbar />

        <main className="flex-1 px-6 py-8 lg:px-8">
          <div className="mb-8 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-[32px] border border-slate-200/80 bg-white/85 p-6 shadow-[0_24px_80px_-44px_rgba(15,23,42,0.35)] backdrop-blur-xl">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-600">Overview</p>
              <h3 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
                Operations at a glance.
              </h3>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">
                Monitor leads, workflows, approvals, and revenue from a single calm workspace.
              </p>
            </div>

            <div className="rounded-[32px] border border-slate-200/80 bg-gradient-to-br from-slate-950 to-blue-950 p-6 text-white shadow-[0_24px_80px_-44px_rgba(15,23,42,0.5)]">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-200">System Health</p>
              <div className="mt-3 flex items-end justify-between gap-4">
                <div>
                  <div className="text-4xl font-semibold tracking-tight">99.9%</div>
                  <p className="mt-2 text-sm text-slate-300">Workflow uptime this week</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/8 px-4 py-3 text-right">
                  <div className="text-xs uppercase tracking-[0.2em] text-slate-300">Active Agents</div>
                  <div className="mt-1 text-2xl font-semibold">08</div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-[28px] border border-slate-200/80 bg-white/85 p-6 shadow-[0_18px_60px_-40px_rgba(15,23,42,0.35)] backdrop-blur-xl">
              <h2 className="text-sm font-medium text-slate-500">Today's Leads</h2>
              <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950">24</h1>
              <div className="mt-4 h-1.5 rounded-full bg-slate-100">
                <div className="h-1.5 w-[72%] rounded-full bg-gradient-to-r from-blue-500 to-cyan-400" />
              </div>
            </div>

            <div className="rounded-[28px] border border-slate-200/80 bg-white/85 p-6 shadow-[0_18px_60px_-40px_rgba(15,23,42,0.35)] backdrop-blur-xl">
              <h2 className="text-sm font-medium text-slate-500">Running Workflows</h2>
              <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950">12</h1>
              <div className="mt-4 h-1.5 rounded-full bg-slate-100">
                <div className="h-1.5 w-[48%] rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-400" />
              </div>
            </div>

            <div className="rounded-[28px] border border-slate-200/80 bg-white/85 p-6 shadow-[0_18px_60px_-40px_rgba(15,23,42,0.35)] backdrop-blur-xl">
              <h2 className="text-sm font-medium text-slate-500">Pending Approvals</h2>
              <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950">7</h1>
              <div className="mt-4 h-1.5 rounded-full bg-slate-100">
                <div className="h-1.5 w-[28%] rounded-full bg-gradient-to-r from-amber-500 to-orange-400" />
              </div>
            </div>

            <div className="rounded-[28px] border border-slate-200/80 bg-white/85 p-6 shadow-[0_18px_60px_-40px_rgba(15,23,42,0.35)] backdrop-blur-xl">
              <h2 className="text-sm font-medium text-slate-500">Revenue</h2>
              <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950">₹4.5L</h1>
              <div className="mt-4 h-1.5 rounded-full bg-slate-100">
                <div className="h-1.5 w-[84%] rounded-full bg-gradient-to-r from-emerald-500 to-teal-400" />
              </div>
            </div>
          </div>

        </main>
      </div>
    </div>
  );
}