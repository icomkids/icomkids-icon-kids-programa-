import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "@/components/layout/app-shell";
import { AuthProvider } from "@/features/auth/auth-context";
import { RequireAuth } from "@/features/auth/require-auth";
import { RouteGate } from "@/features/auth/route-gate";
import AppointmentsPage from "@/pages/AppointmentsPage";
import CaixaPage from "@/pages/CaixaPage";
import CheckoutPage from "@/pages/CheckoutPage";
import DashboardPage from "@/pages/DashboardPage";
import HistoricoPage from "@/pages/HistoricoPage";
import InventoryPage from "@/pages/InventoryPage";
import LoginPage from "@/pages/LoginPage";
import LoyaltyPage from "@/pages/LoyaltyPage";
import MarketingPage from "@/pages/MarketingPage";
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
import TutorialPage from "@/pages/TutorialPage";
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
            <Route path="/painel" element={<RouteGate needAny={["painel.ver"]} resource="Painel"><PainelPage /></RouteGate>} />
            <Route path="/caixa" element={<RouteGate needAny={["caixa.ver_dia","caixa.ver_semana","caixa.ver_mes"]} resource="Caixa"><CaixaPage /></RouteGate>} />
            <Route path="/parceiros" element={<RouteGate needAny={["parceiros.ver"]} resource="Parceiros"><PartnersPage /></RouteGate>} />
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
            <Route path="/assinaturas" element={<RouteGate needAny={["assinaturas.ver"]} resource="Assinaturas"><SubscriptionsPage /></RouteGate>} />
            <Route path="/agendamento" element={<RouteGate needAny={["agendamento.ver"]} resource="Agendamento"><AppointmentsPage /></RouteGate>} />
            <Route path="/midia" element={<RouteGate needAny={["midia.ver"]} resource="Midia"><MediaPage /></RouteGate>} />
            <Route path="/qrcode" element={<RouteGate needAny={["qr_checkout.ver"]} resource="QR Check-out"><CheckoutPage /></RouteGate>} />
            <Route path="/termo" element={<RouteGate needAny={["termo.ver"]} resource="Termo digital"><TermsPage /></RouteGate>} />
            <Route path="/pdv" element={<RouteGate needAny={["pdv.ver"]} resource="PDV"><PDVPage /></RouteGate>} />
            <Route path="/lista-espera" element={<RouteGate needAny={["lista_espera.ver"]} resource="Lista de espera"><WaitlistPage /></RouteGate>} />
            <Route path="/dashboard" element={<RouteGate needAny={["dashboard.ver"]} resource="Dashboard"><DashboardPage /></RouteGate>} />
            <Route path="/fidelidade" element={<RouteGate needAny={["fidelidade.ver"]} resource="Fidelidade"><LoyaltyPage /></RouteGate>} />
            <Route path="/inventario" element={<RouteGate needAny={["inventario.ver"]} resource="Inventario"><InventoryPage /></RouteGate>} />
            <Route path="/nps" element={<RouteGate needAny={["crm_nps.ver"]} resource="NPS"><NpsDashboardPage /></RouteGate>} />
            <Route path="/crm" element={<RouteGate needAny={["crm_nps.ver"]} resource="Feedback"><NpsDashboardPage /></RouteGate>} />
            <Route path="/historico" element={<RouteGate needAny={["historico.ver"]} resource="Historico"><HistoricoPage /></RouteGate>} />
            <Route path="/marketing" element={<RouteGate needAny={["marketing.ver"]} resource="Marketing"><MarketingPage /></RouteGate>} />
            <Route path="/equipe" element={<RouteGate needAny={["equipe.ver"]} resource="Equipe"><TeamPage /></RouteGate>} />
            <Route path="/tutorial" element={<TutorialPage />} />
            <Route path="/configuracoes" element={<RouteGate needAny={["configuracoes.ver"]} resource="Configuracoes"><SettingsPage /></RouteGate>} />
          </Route>
          <Route path="*" element={<Navigate to="/painel" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
