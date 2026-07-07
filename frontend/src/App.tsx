import type { ReactNode } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";

import Login from "./pages/Login/Login";
import Dashboard from "./pages/Dashboard/Dashboard";
import Customers from "./pages/Customers/Customers";
import Products from "./pages/Products/Products";
import Suppliers from "./pages/Suppliers";
import AIOperationsCenter from "./pages/AIOperationsCenter";
import Workflows from "./pages/Workflows";

function isAuthenticated() {
  return typeof window !== "undefined" && window.localStorage.getItem("flowpilot-auth") === "true";
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
      <Route path="/quotations" element={<Navigate to="/ai-operations-center" replace />} />
      <Route path="/approvals" element={<Navigate to="/ai-operations-center" replace />} />
      <Route path="/analytics" element={<Navigate to="/dashboard" replace />} />
      <Route path="/settings" element={<Navigate to="/dashboard" replace />} />
      <Route path="/execution-engine" element={<Navigate to="/ai-operations-center" replace />} />
    </Routes>
  );
}