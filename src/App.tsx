import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "@/components/layout/app-shell";
import { AuthProvider } from "@/features/auth/auth-context";
import { RequireAuth } from "@/features/auth/require-auth";
import AppointmentsPage from "@/pages/AppointmentsPage";
import CaixaPage from "@/pages/CaixaPage";
import CheckoutPage from "@/pages/CheckoutPage";
import DashboardPage from "@/pages/DashboardPage";
import InventoryPage from "@/pages/InventoryPage";
import LoginPage from "@/pages/LoginPage";
import LoyaltyPage from "@/pages/LoyaltyPage";
import MediaPage from "@/pages/MediaPage";
import NpsDashboardPage from "@/pages/NpsDashboardPage";
import NpsResponsePage from "@/pages/NpsResponsePage";
import PainelPage from "@/pages/PainelPage";
import PartnersPage from "@/pages/PartnersPage";
import PDVPage from "@/pages/PDVPage";
import PlaceholderPage from "@/pages/PlaceholderPage";
import SettingsPage from "@/pages/SettingsPage";
import SubscriptionsPage from "@/pages/SubscriptionsPage";
import TeamPage from "@/pages/TeamPage";
import TelaoPage from "@/pages/TelaoPage";
import WaitlistPage from "@/pages/WaitlistPage";

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/telao" element={<TelaoPage />} />
          <Route path="/nps/:token" element={<NpsResponsePage />} />
          <Route
            element={
              <RequireAuth>
                <AppShell />
              </RequireAuth>
            }
          >
            <Route index element={<Navigate to="/painel" replace />} />
            <Route path="/painel" element={<PainelPage />} />
            <Route path="/caixa" element={<CaixaPage />} />
            <Route path="/parceiros" element={<PartnersPage />} />
            <Route
              path="/vendas"
              element={
                <PlaceholderPage
                  title="Vendas online"
                  module={5}
                  scope={[
                    "Vitrine publica do parque",
                    "Compra online de ingressos com gateway",
                    "Integracao automatica com CRM",
                  ]}
                />
              }
            />
            <Route path="/assinaturas" element={<SubscriptionsPage />} />
            <Route path="/agendamento" element={<AppointmentsPage />} />
            <Route path="/midia" element={<MediaPage />} />
            <Route path="/qrcode" element={<CheckoutPage />} />
            <Route
              path="/termo"
              element={
                <PlaceholderPage
                  title="Termo de responsabilidade digital"
                  module={10}
                  scope={[
                    "Assinatura via tablet/smartphone",
                    "Armazenamento seguro no Supabase Storage",
                  ]}
                />
              }
            />
            <Route path="/pdv" element={<PDVPage />} />
            <Route path="/lista-espera" element={<WaitlistPage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/fidelidade" element={<LoyaltyPage />} />
            <Route path="/inventario" element={<InventoryPage />} />
            <Route path="/nps" element={<NpsDashboardPage />} />
            <Route path="/equipe" element={<TeamPage />} />
            <Route path="/configuracoes" element={<SettingsPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/painel" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
