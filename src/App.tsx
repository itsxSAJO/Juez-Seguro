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
import ExpedienteCausa from "./pages/funcionarios/ExpedienteCausa";
import GestionDocumentos from "./pages/funcionarios/GestionDocumentos";
import AgendaAudiencias from "./pages/funcionarios/AgendaAudiencias";
import EditorDecisiones from "./pages/funcionarios/EditorDecisiones";
import GestionNotificaciones from "./pages/funcionarios/GestionNotificaciones";
import CentroAuditoria from "./pages/funcionarios/CentroAuditoria";

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
            <Route
              path="/funcionarios/causas/:id"
              element={
                <ProtectedRoute allowedRoles={["juez", "secretario"]}>
                  <ExpedienteCausa />
                </ProtectedRoute>
              }
            />
            <Route
              path="/funcionarios/documentos"
              element={
                <ProtectedRoute allowedRoles={["juez", "secretario"]}>
                  <GestionDocumentos />
                </ProtectedRoute>
              }
            />
            <Route
              path="/funcionarios/audiencias"
              element={
                <ProtectedRoute>
                  <AgendaAudiencias />
                </ProtectedRoute>
              }
            />
            <Route
              path="/funcionarios/decisiones"
              element={
                <ProtectedRoute allowedRoles={["juez"]}>
                  <EditorDecisiones />
                </ProtectedRoute>
              }
            />
            <Route
              path="/funcionarios/notificaciones"
              element={
                <ProtectedRoute allowedRoles={["secretario"]}>
                  <GestionNotificaciones />
                </ProtectedRoute>
              }
            />
            <Route
              path="/funcionarios/auditoria"
              element={
                <ProtectedRoute allowedRoles={["admin"]}>
                  <CentroAuditoria />
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
