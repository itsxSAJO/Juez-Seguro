import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/funcionarios/ProtectedRoute";

// Public pages
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";

// Ciudadano pages
import ConsultaCiudadana from "./pages/ciudadano/ConsultaCiudadana";
import ProcesoDetalle from "./pages/ciudadano/ProcesoDetalle";
import Ayuda from "./pages/Ayuda";

// Funcionarios pages
import LoginFuncionarios from "./pages/funcionarios/LoginFuncionarios";
import DashboardFuncionarios from "./pages/funcionarios/DashboardFuncionarios";
import AccesoDenegado from "./pages/funcionarios/AccesoDenegado";
import GestionCuentas from "./pages/funcionarios/GestionCuentas";
import ListaCausas from "./pages/funcionarios/ListaCausas";
import NuevaCausa from "./pages/funcionarios/NuevaCausa";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            {/* Landing Page */}
            <Route path="/" element={<Index />} />

            {/* Portal Ciudadano */}
            <Route path="/ciudadano" element={<ConsultaCiudadana />} />
            <Route path="/ciudadano/proceso/:id" element={<ProcesoDetalle />} />
            <Route path="/ayuda" element={<Ayuda />} />

            {/* Legacy redirects */}
            <Route path="/proceso/:id" element={<Navigate to="/ciudadano/proceso/:id" replace />} />

            {/* Portal Funcionarios - Public */}
            <Route path="/funcionarios/login" element={<LoginFuncionarios />} />
            <Route path="/funcionarios/acceso-denegado" element={<AccesoDenegado />} />

            {/* Portal Funcionarios - Protected */}
            <Route
              path="/funcionarios"
              element={
                <ProtectedRoute>
                  <DashboardFuncionarios />
                </ProtectedRoute>
              }
            />
            <Route
              path="/funcionarios/cuentas"
              element={
                <ProtectedRoute allowedRoles={["admin"]}>
                  <GestionCuentas />
                </ProtectedRoute>
              }
            />
            <Route
              path="/funcionarios/causas"
              element={
                <ProtectedRoute allowedRoles={["juez", "secretario"]}>
                  <ListaCausas />
                </ProtectedRoute>
              }
            />
            <Route
              path="/funcionarios/causas/nueva"
              element={
                <ProtectedRoute allowedRoles={["secretario"]}>
                  <NuevaCausa />
                </ProtectedRoute>
              }
            />

            {/* Catch-all */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
