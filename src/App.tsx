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
import PublicFeedbackPage from "@/pages/PublicFeedbackPage";
// Module 5 (Vendas online via Asaas) — pronto mas adiado para o final
// do projeto. Ative descomentando os imports e as 3 rotas abaixo, e
// seguindo as instrucoes em supabase/functions/create-asaas-checkout.
// import OnlineSalesPage from "@/pages/OnlineSalesPage";
import PainelPage from "@/pages/PainelPage";
import PartnersPage from "@/pages/PartnersPage";
import PDVPage from "@/pages/PDVPage";
import PlaceholderPage from "@/pages/PlaceholderPage";
import SettingsPage from "@/pages/SettingsPage";
// import StorefrontPage from "@/pages/StorefrontPage";          // Modulo 5 — adiado
// import StorefrontSuccessPage from "@/pages/StorefrontSuccessPage"; // Modulo 5 — adiado
import SubscriptionsPage from "@/pages/SubscriptionsPage";
import TeamPage from "@/pages/TeamPage";
import TelaoPage from "@/pages/TelaoPage";
import TermsPage from "@/pages/TermsPage";
import TermSignPage from "@/pages/TermSignPage";
import WaitlistPage from "@/pages/WaitlistPage";

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/telao" element={<TelaoPage />} />
          <Route path="/nps/:token" element={<NpsResponsePage />} />
          <Route path="/avaliacao" element={<PublicFeedbackPage />} />
          <Route path="/termo/sign/:token" element={<TermSignPage />} />
          {/* Vendas online (Asaas) — codigo pronto, ativacao adiada para
              o final do projeto. Quando ligar: aplicar a migration de
              ticket_offers/orders, configurar secrets ASAAS_API_KEY +
              ASAAS_WEBHOOK_TOKEN, deployar create-asaas-checkout +
              asaas-webhook, e descomentar as 3 rotas abaixo. */}
          {/* <Route path="/loja" element={<StorefrontPage />} /> */}
          {/* <Route path="/loja/sucesso" element={<StorefrontSuccessPage />} /> */}
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
                  description="Codigo pronto (Asaas Checkout). Ativacao adiada para o final do projeto."
                  scope={[
                    "Vitrine publica do parque (/loja)",
                    "Compra online de ingressos com Asaas (PIX, cartao, boleto)",
                    "Webhook recebe confirmacao e gera QR para entrada",
                    "Para ativar: aplicar migration ticket_offers/orders + secrets ASAAS_API_KEY + deploy edge functions create-asaas-checkout e asaas-webhook + descomentar imports/rotas em src/App.tsx",
                  ]}
                />
              }
            />
            <Route path="/assinaturas" element={<SubscriptionsPage />} />
            <Route path="/agendamento" element={<AppointmentsPage />} />
            <Route path="/midia" element={<MediaPage />} />
            <Route path="/qrcode" element={<CheckoutPage />} />
            <Route path="/termo" element={<TermsPage />} />
            <Route path="/pdv" element={<PDVPage />} />
            <Route path="/lista-espera" element={<WaitlistPage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/fidelidade" element={<LoyaltyPage />} />
            <Route path="/inventario" element={<InventoryPage />} />
            <Route path="/nps" element={<NpsDashboardPage />} />
            <Route path="/crm" element={<NpsDashboardPage />} />
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
