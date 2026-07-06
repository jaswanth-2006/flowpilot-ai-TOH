import { Navigate, Route, Routes } from "react-router-dom";

import Login from "./pages/Login/Login";
import Dashboard from "./pages/Dashboard/Dashboard";
import Customers from "./pages/Customers/Customers";
import Products from "./pages/Products/Products";
import Suppliers from "./pages/Suppliers";
import AIOperationsCenter from "./pages/AIOperationsCenter";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" />} />
      <Route path="/login" element={<Login />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/customers" element={<Customers />} />
      <Route path="/products" element={<Products />} />
      <Route path="/suppliers" element={<Suppliers />} />
      <Route path="/ai-operations-center" element={<AIOperationsCenter />} />
      <Route path="/execution-engine" element={<Navigate to="/ai-operations-center" replace />} />
    </Routes>
  );
}