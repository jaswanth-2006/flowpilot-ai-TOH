import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedEmail = email.trim();
    const trimmedPassword = password.trim();

    if (!trimmedEmail || !trimmedPassword) {
      setError("Please enter both your email and password.");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError("Please enter a valid email address.");
      return;
    }

    setError(null);
    navigate("/dashboard");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-8">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-[36px] border border-slate-200/80 bg-white/90 shadow-[0_30px_100px_-55px_rgba(15,23,42,0.45)] backdrop-blur-xl transition-all duration-300 ease-out lg:grid-cols-[0.95fr_1.05fr]">
        <div className="relative overflow-hidden bg-slate-950 px-8 py-10 text-white sm:px-10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(56,189,248,0.18),transparent_30%),radial-gradient(circle_at_bottom_left,rgba(99,102,241,0.16),transparent_34%)]" />
          <div className="relative">
            <div className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-blue-100">
              FlowPilot AI
            </div>
            <h1 className="mt-8 max-w-md text-4xl font-semibold tracking-tight sm:text-5xl">
              Calm, high-signal operations for modern teams.
            </h1>
            <p className="mt-4 max-w-md text-sm leading-6 text-slate-300">
              Coordinate customer operations, inventory, suppliers, and AI execution in one focused workspace.
            </p>

            <div className="mt-10 grid gap-3 sm:grid-cols-2">
              <div className="rounded-[24px] border border-white/10 bg-white/5 p-4">
                <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Design</div>
                <div className="mt-2 text-sm text-slate-100">Linear-inspired clarity</div>
              </div>
              <div className="rounded-[24px] border border-white/10 bg-white/5 p-4">
                <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Execution</div>
                <div className="mt-2 text-sm text-slate-100">Fast, structured workflows</div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-center px-6 py-10 sm:px-10">
          <div className="w-full max-w-md">
            <div className="mb-8">
              <h2 className="text-3xl font-semibold tracking-tight text-slate-950">Welcome back</h2>
              <p className="mt-2 text-sm text-slate-500">Sign in to continue to FlowPilot AI.</p>
            </div>

            <form className="space-y-4" onSubmit={handleSubmit}>
              <input
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  if (error) setError(null);
                }}
                className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-950 outline-none transition-all duration-200 ease-out placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                placeholder="Email"
                type="email"
              />

              <input
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  if (error) setError(null);
                }}
                type="password"
                className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-950 outline-none transition-all duration-200 ease-out placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                placeholder="Password"
              />

              {error ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                  {error}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={!email.trim() || !password.trim()}
                className="flex h-12 w-full items-center justify-center rounded-2xl bg-slate-950 px-4 text-sm font-semibold text-white shadow-[0_16px_40px_-18px_rgba(15,23,42,0.85)] transition-all duration-200 ease-out hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
              >
                Login
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}