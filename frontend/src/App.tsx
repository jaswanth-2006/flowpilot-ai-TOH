import type { ReactNode } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";

import Login from "./pages/Login/Login";
import Dashboard from "./pages/Dashboard/Dashboard";
import Customers from "./pages/Customers/Customers";
import Products from "./pages/Products/Products";
import Suppliers from "./pages/Suppliers";
import AIOperationsCenter from "./pages/AIOperationsCenter";
import Workflows from "./pages/Workflows";
import Sidebar from "./components/layout/Sidebar";
import Navbar from "./components/layout/Navbar";
import { isAuthenticated } from "./services/auth";

function PlaceholderPage({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex min-h-screen bg-[#f5f7fb] text-slate-900">
      <Sidebar />
      <div className="flex flex-1 flex-col">
        <Navbar />
        <main className="mx-auto w-full max-w-7xl flex-1 px-6 py-8 lg:px-10">
          <div className="rounded-[32px] border border-slate-200/80 bg-white/90 p-6 shadow-[0_24px_80px_-44px_rgba(15,23,42,0.35)]">
            <p className="text-sm font-medium uppercase tracking-[0.24em] text-blue-600">FlowPilot AI</p>
            <h1 className="mt-1 text-3xl font-semibold text-slate-950">{title}</h1>
            <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>
          </div>
        </main>
      </div>
    </div>
  );
}

function ProtectedRoute({ children }: { children: ReactNode }) {
  const location = useLocation();

  if (!isAuthenticated()) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to={isAuthenticated() ? "/dashboard" : "/login"} replace />} />
      <Route path="/login" element={<Login />} />
      <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/customers" element={<ProtectedRoute><Customers /></ProtectedRoute>} />
      <Route path="/products" element={<ProtectedRoute><Products /></ProtectedRoute>} />
      <Route path="/suppliers" element={<ProtectedRoute><Suppliers /></ProtectedRoute>} />
      <Route path="/workflows" element={<ProtectedRoute><Workflows /></ProtectedRoute>} />
      <Route path="/ai-operations-center" element={<ProtectedRoute><AIOperationsCenter /></ProtectedRoute>} />
      <Route path="/quotations" element={<ProtectedRoute><PlaceholderPage title="Quotations" description="Review generated quotations and exported customer proposals." /></ProtectedRoute>} />
      <Route path="/approvals" element={<ProtectedRoute><PlaceholderPage title="Approvals" description="Track human approval decisions for AI-generated operations plans." /></ProtectedRoute>} />
      <Route path="/analytics" element={<ProtectedRoute><PlaceholderPage title="Analytics" description="Monitor operational performance, revenue signals, and workflow throughput." /></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><PlaceholderPage title="Settings" description="Manage workspace preferences and demo configuration." /></ProtectedRoute>} />
      <Route path="/execution-engine" element={<Navigate to="/ai-operations-center" replace />} />
      <Route path="*" element={<Navigate to={isAuthenticated() ? "/dashboard" : "/login"} replace />} />
    </Routes>
  );
}
