import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "@/components/layout/app-shell";
import { AuthProvider } from "@/features/auth/auth-context";
import { RequireAuth } from "@/features/auth/require-auth";
import CaixaPage from "@/pages/CaixaPage";
import CheckoutPage from "@/pages/CheckoutPage";
import DashboardPage from "@/pages/DashboardPage";
import LoginPage from "@/pages/LoginPage";
import PainelPage from "@/pages/PainelPage";
import PartnersPage from "@/pages/PartnersPage";
import PDVPage from "@/pages/PDVPage";
import PlaceholderPage from "@/pages/PlaceholderPage";
import SubscriptionsPage from "@/pages/SubscriptionsPage";
import TelaoPage from "@/pages/TelaoPage";
import WaitlistPage from "@/pages/WaitlistPage";

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/telao" element={<TelaoPage />} />
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
            <Route
              path="/agendamento"
              element={
                <PlaceholderPage
                  title="Agendamento e eventos"
                  module={7}
                  scope={[
                    "Agendamento de visitas",
                    "Reserva de espaco para festas",
                    "Gestao de disponibilidade e valores",
                  ]}
                />
              }
            />
            <Route
              path="/midia"
              element={
                <PlaceholderPage
                  title="Midia e anuncios"
                  module={8}
                  scope={[
                    "Upload de imagens e videos",
                    "Tempo de exibicao + frequencia diaria/semanal",
                    "Agendamento de campanhas",
                  ]}
                />
              }
            />
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
            <Route
              path="/fidelidade"
              element={
                <PlaceholderPage
                  title="Fidelidade"
                  module={14}
                  scope={[
                    "Pontos por visita / compra",
                    "Recompensas e niveis de fidelidade",
                  ]}
                />
              }
            />
            <Route
              path="/inventario"
              element={
                <PlaceholderPage
                  title="Inventario de ativos"
                  module={15}
                  scope={[
                    "Cadastro de brinquedos e equipamentos",
                    "Manutencao preventiva agendada",
                  ]}
                />
              }
            />
            <Route
              path="/nps"
              element={
                <PlaceholderPage
                  title="NPS automatico"
                  module={16}
                  scope={[
                    "Pesquisa pos check-out via WhatsApp",
                    "Coleta de feedback e depoimentos",
                  ]}
                />
              }
            />
            <Route
              path="/equipe"
              element={
                <PlaceholderPage
                  title="Equipe"
                  module={17}
                  scope={[
                    "Cadastro de funcionarios",
                    "Escala de trabalho",
                    "Calculo de comissao",
                  ]}
                />
              }
            />
          </Route>
          <Route path="*" element={<Navigate to="/painel" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
