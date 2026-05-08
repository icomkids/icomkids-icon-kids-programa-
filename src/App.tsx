import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "@/components/layout/app-shell";
import { AuthProvider } from "@/features/auth/auth-context";
import { RequireAuth } from "@/features/auth/require-auth";
import CaixaPage from "@/pages/CaixaPage";
import DashboardPage from "@/pages/DashboardPage";
import LoginPage from "@/pages/LoginPage";
import PainelPage from "@/pages/PainelPage";
import PlaceholderPage from "@/pages/PlaceholderPage";
import TelaoPage from "@/pages/TelaoPage";

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
            <Route
              path="/parceiros"
              element={
                <PlaceholderPage
                  title="Portal de Parceiros"
                  module={4}
                  scope={[
                    "Acompanhamento de criancas trazidas pela parceria",
                    "Relatorios financeiros + comissao",
                  ]}
                />
              }
            />
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
            <Route
              path="/assinaturas"
              element={
                <PlaceholderPage
                  title="Assinaturas"
                  module={6}
                  scope={[
                    "Planos com beneficios (descontos, horas extras)",
                    "Gestao de assinantes e renovacoes",
                  ]}
                />
              }
            />
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
            <Route
              path="/qrcode"
              element={
                <PlaceholderPage
                  title="QR check-out"
                  module={9}
                  scope={[
                    "QR Code unico no momento do check-in",
                    "Validacao na saida",
                  ]}
                />
              }
            />
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
            <Route
              path="/pdv"
              element={
                <PlaceholderPage
                  title="PDV / Lanchonete"
                  module={11}
                  scope={[
                    "Vendas de produtos integradas ao caixa",
                    "Controle de estoque com alertas",
                  ]}
                />
              }
            />
            <Route
              path="/lista-espera"
              element={
                <PlaceholderPage
                  title="Lista de espera"
                  module={12}
                  scope={[
                    "Cadastro quando o parque esta lotado",
                    "Notificacao automatica via WhatsApp",
                  ]}
                />
              }
            />
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
