import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Banknote,
  BookOpen,
  CalendarRange,
  ChevronDown,
  ChevronRight,
  Coffee,
  Cog,
  FileSignature,
  Gauge,
  GraduationCap,
  Hourglass,
  Image as ImageIcon,
  LayoutDashboard,
  Lightbulb,
  Megaphone,
  PartyPopper,
  QrCode,
  Search,
  Smile,
  Sparkles,
  Star,
  Tv2,
  Users,
  Wrench,
} from "lucide-react";
import { PageHeader } from "@/components/layout/header";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

/**
 * Tutorial interno da plataforma. Pagina autoexplicativa pra qualquer
 * pessoa (mesmo leiga) saber usar cada modulo. Estrutura: secoes
 * colapsaveis com passo a passo + dicas + atalhos pra rota real.
 *
 * Manutencao: ao criar novo modulo, adicione uma entrada em SECTIONS
 * com id, titulo, icone, descricao e blocos (steps/tips/warnings).
 */

type Block =
  | { kind: "para"; text: string }
  | { kind: "steps"; title?: string; items: string[] }
  | { kind: "tips"; items: string[] }
  | { kind: "warnings"; items: string[] }
  | { kind: "scenario"; title: string; body: string };

interface Section {
  id: string;
  title: string;
  /** Pra busca: palavras-chave alternativas (sinonimos, gírias). */
  keywords: string[];
  icon: React.ComponentType<{ className?: string }>;
  /** Cor de destaque do header (paleta da marca). */
  color: string;
  /** Rota real do modulo dentro do app. */
  route?: string;
  /** Resumo de uma linha. */
  summary: string;
  blocks: Block[];
}

const SECTIONS: Section[] = [
  {
    id: "primeiros-passos",
    title: "Primeiros passos",
    keywords: ["comecar", "inicio", "login", "senha", "conta"],
    icon: Sparkles,
    color: "#7B36BF",
    summary: "Entenda como o sistema funciona em 2 minutos antes de mergulhar.",
    blocks: [
      {
        kind: "para",
        text: "O iCOM Kids é o sistema de gestão do parque. Ele cuida de tudo: criança chegando, pagamento, tempo correndo, lanchonete, marketing, relatórios. Antes de qualquer coisa do dia a dia, o operador precisa entender 3 conceitos basicos:",
      },
      {
        kind: "steps",
        title: "Os 3 conceitos chave",
        items: [
          "Caixa: é o cofre digital do dia. Tem que ser aberto pela manhã antes de aceitar qualquer pagamento, e fechado à noite com a conferência.",
          "Sessão: é cada criança que está usando o parque. Tem hora de entrada, tempo contratado, e termina quando a criança sai.",
          "Painel: é a tela operacional principal — mostra todas as sessões ativas com cronômetro rodando em tempo real.",
        ],
      },
      {
        kind: "steps",
        title: "Rotina típica de um dia",
        items: [
          "Manhã: abre o /caixa com o valor inicial de troco (geralmente R$ 100).",
          "Cliente chega: vai em /painel → 'Novo cadastro' → preenche dados da criança e responsável → seleciona o tempo (20/30/60min) e a forma de pagamento.",
          "Sessão roda: o card da criança aparece com cronômetro. O operador pode pausar (se a criança sair temporariamente) ou encerrar antecipadamente.",
          "Final do dia: fecha o /caixa conferindo o valor em dinheiro físico contra o valor esperado calculado pelo sistema.",
        ],
      },
      {
        kind: "tips",
        items: [
          "Marque a tela /painel como favorita do navegador — é onde o operador passa 80% do tempo.",
          "O /telao abre em uma nova aba — é a tela pra deixar em uma TV no salão, mostrando o tempo de cada criança pra os pais acompanharem.",
        ],
      },
    ],
  },
  {
    id: "caixa",
    title: "Caixa",
    keywords: ["dinheiro", "abertura", "fechamento", "sangria", "suprimento", "venda"],
    icon: Banknote,
    color: "#A6CD3F",
    route: "/caixa",
    summary: "Controle do dinheiro do dia — abre, recebe, sangra, fecha e concilia.",
    blocks: [
      {
        kind: "para",
        text: "O Caixa é o coração financeiro do dia. Sem caixa aberto, ninguém consegue receber pagamento de criança ou da lanchonete. O sistema bloqueia mesmo. Isso é proposital — evita venda sem controle.",
      },
      {
        kind: "steps",
        title: "Abrir o caixa (manhã)",
        items: [
          "Acessa /caixa pelo menu lateral.",
          "Clica no botão verde 'Abrir caixa'.",
          "Coloca o valor inicial em dinheiro (troco) — ex: 100,00.",
          "Confirma. Pronto, o caixa abre e libera vendas.",
        ],
      },
      {
        kind: "steps",
        title: "Durante o dia",
        items: [
          "Cada venda (sessão de criança ou item da lanchonete) gera um movimento automático com número sequencial (001, 002, 003...).",
          "Aparecem 4 indicadores no topo: Faturamento total, Dinheiro esperado em caixa, Sangrias, Suprimentos.",
          "A tabela mostra cada movimento com tipo (Venda / Sangria / Suprimento), forma de pagamento, valor e descrição.",
        ],
      },
      {
        kind: "scenario",
        title: "Cenário: precisei tirar dinheiro do caixa pra pagar fornecedor",
        body: "Clica em 'Sangria' (botão rosa) → digita o valor → escreve a descrição (ex: 'Pagamento do gás'). O movimento entra no histórico e o sistema deduz do valor esperado em caixa.",
      },
      {
        kind: "scenario",
        title: "Cenário: precisei colocar mais troco no caixa",
        body: "Clica em 'Suprimento' (botão azul) → digita o valor → descrição (ex: 'Reforço de troco em moedas'). O valor esperado aumenta.",
      },
      {
        kind: "scenario",
        title: "Cenário: errei o valor de uma venda",
        body: "Apenas o usuário com perfil de owner (dono) pode cancelar. Clica no botão de lixeira ao lado do movimento → escreve o motivo (obrigatório, mínimo 3 caracteres). O movimento fica marcado como cancelado mas não some — fica registrado pra auditoria.",
      },
      {
        kind: "steps",
        title: "Fechar o caixa (noite)",
        items: [
          "Conta o dinheiro físico no caixa.",
          "Clica em 'Fechar caixa' (botão roxo).",
          "Digita o valor contado.",
          "O sistema mostra a diferença em tempo real (positiva, negativa ou zero).",
          "Se a diferença for diferente de zero, o sistema obriga você a escrever uma observação justificando.",
          "Confirma. O caixa vai pro histórico e ninguém consegue mais lançar movimentos nele.",
        ],
      },
      {
        kind: "warnings",
        items: [
          "Só pode haver UM caixa aberto por vez. Se você tentou cadastrar uma criança e apareceu o aviso amarelo 'Caixa fechado — cadastros bloqueados', volta em /caixa e abre.",
          "Nunca feche um caixa com diferença sem entender o motivo. Diferença grande pode ser sintoma de roubo, troco errado, ou venda esquecida.",
        ],
      },
    ],
  },
  {
    id: "painel",
    title: "Painel de crianças",
    keywords: ["sessao", "cronometro", "ativas", "cadastrar", "pausar"],
    icon: LayoutDashboard,
    color: "#1E78DC",
    route: "/painel",
    summary: "Tela operacional principal — sessões ativas com cronômetro em tempo real.",
    blocks: [
      {
        kind: "para",
        text: "É aqui que o operador passa o dia. Cada criança que está dentro do parque aparece como um card colorido com nome, foto, tempo contratado e cronômetro descendo em tempo real.",
      },
      {
        kind: "steps",
        title: "Cadastrar uma criança nova",
        items: [
          "Caixa precisa estar aberto (se não estiver, vai em /caixa primeiro).",
          "Clica no botão verde 'Novo cadastro' no topo direito.",
          "Preenche nome da criança, idade, e dados do responsável (nome, telefone, e-mail se quiser).",
          "Se o telefone já estiver cadastrado, o sistema avisa que é cliente recorrente (não bloqueia, só informa).",
          "Tira a foto da criança pela webcam (opcional mas recomendado pra checkout seguro).",
          "Marca o checkbox 'Li e aceito o termo de responsabilidade'.",
          "Seleciona o tempo: 20min (R$ 35), 30min (R$ 40) ou 60min (R$ 60).",
          "Seleciona a forma de pagamento: Dinheiro, PIX, Cartão débito/crédito.",
          "Clica em 'Cadastrar e iniciar'.",
        ],
      },
      {
        kind: "steps",
        title: "Cores e estados do card",
        items: [
          "Verde claro = sessão ativa, dentro do tempo contratado.",
          "Amarelo = acabando (últimos 5 minutos antes de zerar).",
          "Rosa/vermelho = tempo esgotado, criança está no tempo de tolerância (2 min) ou já no excedente cobrado.",
          "Azul = pausada (criança saiu temporariamente, o tempo está congelado).",
        ],
      },
      {
        kind: "scenario",
        title: "Cenário: criança vai ao banheiro e os pais querem pausar",
        body: "No card da criança, clica no botão 'Pausar'. O tempo congela. Quando voltar, clica em 'Retomar' e o cronômetro volta de onde parou.",
      },
      {
        kind: "scenario",
        title: "Cenário: criança vai sair, hora de encerrar",
        body: "Clica em 'Encerrar' no card. Se ela ficou dentro do tempo, encerra direto. Se passou do tempo + tolerância, o sistema pergunta se quer cobrar o excedente (proporcional ao valor pago por minuto). Você decide na hora.",
      },
      {
        kind: "tips",
        items: [
          "Ao encerrar uma sessão, o sistema automaticamente: 1) credita pontos de fidelidade pro responsável, 2) manda WhatsApp/Email pedindo avaliação NPS, 3) registra o movimento no caixa.",
          "Quando você cadastra uma criança nova, o sistema manda WhatsApp + email pro responsável com link do termo de responsabilidade pra ele assinar pelo celular dele.",
        ],
      },
    ],
  },
  {
    id: "telao",
    title: "Telão (TV do salão)",
    keywords: ["tv", "salao", "monitor", "tempo", "publico"],
    icon: Tv2,
    color: "#3CB4E0",
    route: "/telao",
    summary: "Tela pública pra TV mostrando o tempo restante de cada criança pros pais.",
    blocks: [
      {
        kind: "para",
        text: "O Telão é uma página separada feita pra rodar em uma TV no salão de espera. Mostra todas as crianças ativas em cards grandes, com cronômetro grande visível à distância. Quando o tempo acaba ou está acabando, o card pisca em amarelo/rosa.",
      },
      {
        kind: "steps",
        title: "Como abrir o Telão",
        items: [
          "No menu lateral, clica em 'Telao' — abre automaticamente em uma aba nova.",
          "Arrasta essa aba pra TV/segundo monitor.",
          "Aperta F11 no teclado pra tela cheia.",
          "Pronto, deixa rodando o dia inteiro.",
        ],
      },
      {
        kind: "tips",
        items: [
          "Quando o tempo da criança acaba, toca um alerta sonoro suave — bom pra chamar atenção dos pais.",
          "Os pais geralmente acompanham olhando os cards. Reduz pergunta do tipo 'falta quanto tempo pra meu filho?'",
        ],
      },
    ],
  },
  {
    id: "crm",
    title: "CRM & Leads",
    keywords: ["clientes", "leads", "captura", "moto", "icom"],
    icon: Smile,
    color: "#EA4D8E",
    route: "/crm",
    summary: "Base de clientes capturados — telefones, e-mails, histórico de visitas.",
    blocks: [
      {
        kind: "para",
        text: "Toda criança cadastrada gera 2 registros: a criança em si, e o responsável (que vira um 'lead'). O CRM agrupa todos esses responsáveis num banco de dados que você pode filtrar, exportar e usar pra marketing.",
      },
      {
        kind: "steps",
        title: "O que tem aqui",
        items: [
          "Lista de todos os responsáveis cadastrados.",
          "Filtro de período (Hoje, 7 dias, 30 dias, Mês, Tudo).",
          "Busca por nome ou telefone.",
          "Histórico de visitas: quantas vezes cada cliente trouxe a criança.",
          "Tags (quente, frio, recorrente) — atribuídas manualmente ou pelo comportamento.",
        ],
      },
      {
        kind: "scenario",
        title: "Cenário: quero ligar pra clientes que não vêm há 30 dias",
        body: "Filtra por 'última visita > 30 dias' → exporta a lista em CSV → distribui entre a equipe pra ligar. Ou usa o módulo Marketing pra mandar WhatsApp em massa com uma oferta de retorno.",
      },
      {
        kind: "tips",
        items: [
          "O telefone é a chave única — se o mesmo responsável trouxer um irmão da primeira criança, ele aparece como mesmo lead, não duplica.",
          "Integração futura: a captura de leads do iCOM Motos (concessionária) também alimenta esse CRM. Por enquanto é só dos cadastros do parque.",
        ],
      },
    ],
  },
  {
    id: "marketing",
    title: "Marketing",
    keywords: ["whatsapp", "email", "campanha", "disparo", "aniversario", "promocao"],
    icon: Megaphone,
    color: "#F39230",
    route: "/marketing",
    summary: "Disparo de campanhas em massa, automações e mensagens agendadas.",
    blocks: [
      {
        kind: "para",
        text: "Módulo de marketing dividido em 3 abas: Campanhas (disparo único pra uma audiência), Automações (regras que disparam sozinhas, ex: aniversário), e Agendadas (mensagens que vão sair em uma data futura).",
      },
      {
        kind: "steps",
        title: "Disparar uma campanha em massa",
        items: [
          "Aba 'Campanhas' → 'Nova campanha'.",
          "Escolhe o canal: WhatsApp ou Email (ou ambos).",
          "Escolhe a audiência: todos com telefone / todos com email / leads quentes / opt-in WhatsApp / opt-in email.",
          "Escreve a mensagem (ou usa um template salvo).",
          "Veja o preview e o total de pessoas que vão receber.",
          "Clica em 'Disparar agora' ou 'Agendar pra depois'.",
        ],
      },
      {
        kind: "steps",
        title: "Configurar automação de aniversário",
        items: [
          "Aba 'Automações' → 'Nova automação'.",
          "Tipo: 'Aniversário da criança' (o sistema usa a data de nascimento cadastrada).",
          "Mensagem: ex 'Olá {nome}! A {crianca} faz aniversário hoje! Ganhe 50% off em uma sessão. Válido até amanhã.'",
          "Canais: WhatsApp + Email.",
          "Ativa a automação. A partir daí, todo dia de manhã o sistema busca aniversariantes e dispara sozinho.",
        ],
      },
      {
        kind: "warnings",
        items: [
          "WhatsApp tem limite anti-spam — não dispare pra mais de 200 contatos de uma vez no mesmo número. Use a função de quebra em lotes que o sistema já faz automaticamente.",
          "Sempre respeite o opt-out (cliente que pediu pra não receber). O sistema filtra automaticamente, mas confira antes de campanhas grandes.",
        ],
      },
    ],
  },
  {
    id: "agendamento",
    title: "Agendamento",
    keywords: ["reserva", "festa", "evento", "aniversario", "calendario"],
    icon: CalendarRange,
    color: "#7B36BF",
    route: "/agendamento",
    summary: "Reservas antecipadas — festas, eventos privados, horários específicos.",
    blocks: [
      {
        kind: "para",
        text: "Pra famílias que querem reservar o parque pra uma festa de aniversário, ou um horário específico fora do fluxo normal. Diferente do Painel (que é pra walk-in), aqui são reservas marcadas com antecedência.",
      },
      {
        kind: "steps",
        title: "Criar uma reserva",
        items: [
          "Clica em 'Nova reserva'.",
          "Preenche: data, hora de início, duração, nome do responsável, telefone, quantidade de crianças.",
          "Tipo: Festa de aniversário, Sessão privada, Evento corporativo.",
          "Valor total combinado e sinal pago.",
          "Confirma. O sistema gera um lembrete automático 1 dia antes via WhatsApp.",
        ],
      },
      {
        kind: "tips",
        items: [
          "Use cores diferentes pra cada tipo de reserva — facilita visualizar a agenda.",
          "Reservas geram leads no CRM automaticamente.",
        ],
      },
    ],
  },
  {
    id: "pdv",
    title: "PDV / Lanchonete",
    keywords: ["lanche", "venda", "produto", "snack", "bebida", "pdv"],
    icon: Coffee,
    color: "#F4B73F",
    route: "/pdv",
    summary: "Ponto de venda da lanchonete — produtos, vendas, estoque baixando.",
    blocks: [
      {
        kind: "para",
        text: "O PDV é onde a equipe da lanchonete registra cada venda de salgado, suco, refrigerante, etc. Cada venda gera movimento no caixa automaticamente e baixa o estoque do produto.",
      },
      {
        kind: "steps",
        title: "Realizar uma venda",
        items: [
          "Caixa precisa estar aberto.",
          "Acessa /pdv pelo menu.",
          "Toca nos produtos pra ir adicionando no carrinho.",
          "Pode vincular a venda a uma criança ativa (consumo na conta) ou cobrar avulso.",
          "Seleciona forma de pagamento.",
          "Finaliza. Imprime ou só fecha.",
        ],
      },
      {
        kind: "tips",
        items: [
          "Produtos com estoque baixo aparecem com badge amarelo — sinal pra repor.",
          "Cadastre produtos antes em /inventario.",
        ],
      },
    ],
  },
  {
    id: "assinaturas",
    title: "Assinaturas",
    keywords: ["mensalidade", "pacote", "plano", "recorrente"],
    icon: Star,
    color: "#F39230",
    route: "/assinaturas",
    summary: "Pacotes mensais — cliente paga uma vez e vem várias vezes no mês.",
    blocks: [
      {
        kind: "para",
        text: "Pra famílias que vão muito ao parque. Em vez de pagar avulso a cada visita, assinam um plano (ex: 4 sessões/mês por R$ 120) e a cada visita o sistema desconta uma sessão do saldo.",
      },
      {
        kind: "steps",
        title: "Criar uma assinatura",
        items: [
          "Acessa /assinaturas → 'Nova assinatura'.",
          "Escolhe o responsável (busca no CRM).",
          "Escolhe o plano: 4 sessões / 8 sessões / ilimitado.",
          "Forma de pagamento (recorrente PIX ou boleto).",
          "Confirma. O cliente passa a ter saldo.",
        ],
      },
      {
        kind: "steps",
        title: "Cliente assinante chegando",
        items: [
          "No /painel, ao cadastrar a sessão, o sistema detecta que o telefone é de um assinante ativo.",
          "Mostra o saldo (ex: '3 sessões restantes no plano').",
          "Você confirma e o sistema desconta 1 sessão, sem cobrar nada no caixa.",
        ],
      },
    ],
  },
  {
    id: "parceiros",
    title: "Parceiros (escolas, ONGs)",
    keywords: ["escola", "ong", "convenio", "desconto", "parceria"],
    icon: GraduationCap,
    color: "#3CB4E0",
    route: "/parceiros",
    summary: "Convênios com escolas e ONGs locais com descontos especiais.",
    blocks: [
      {
        kind: "para",
        text: "Escolas, ONGs e empresas locais podem firmar convênio. Alunos/funcionários ganham desconto fixo ou pacote diferenciado. Cada parceiro tem um código que o cliente menciona na hora do cadastro.",
      },
      {
        kind: "steps",
        title: "Cadastrar parceiro",
        items: [
          "Acessa /parceiros → 'Novo parceiro'.",
          "Nome da instituição, CNPJ (se tiver), contato.",
          "Tipo de benefício: desconto fixo (ex: 20% off) ou tabela própria.",
          "Código único que o cliente vai mencionar (ex: 'ESCOLA001').",
          "Validade do convênio.",
        ],
      },
    ],
  },
  {
    id: "fidelidade",
    title: "Fidelidade",
    keywords: ["pontos", "recompensa", "loyalty", "carimbo"],
    icon: PartyPopper,
    color: "#A6CD3F",
    route: "/fidelidade",
    summary: "Programa de pontos — 1 ponto por R$ 1 gasto, trocados por brindes/sessões.",
    blocks: [
      {
        kind: "para",
        text: "A cada sessão encerrada, o sistema credita pontos automaticamente pro responsável: 1 ponto = R$ 1 gasto. Os pontos podem ser trocados por recompensas que você cadastra (sessão grátis, pula-pula privado, brinde, etc).",
      },
      {
        kind: "steps",
        title: "Cadastrar uma recompensa",
        items: [
          "Acessa /fidelidade → aba 'Recompensas' → 'Nova'.",
          "Nome (ex: 'Sessão de 30min grátis').",
          "Custo em pontos (ex: 100).",
          "Estoque limitado (ou ilimitado).",
          "Imagem (opcional, mas ajuda na visualização).",
        ],
      },
      {
        kind: "steps",
        title: "Cliente resgatando",
        items: [
          "Cliente fala 'quero usar meus pontos'.",
          "Você busca o telefone dele em /fidelidade → aba 'Saldos'.",
          "Vê o saldo e clica em 'Resgatar' na recompensa escolhida.",
          "Os pontos são debitados na hora.",
        ],
      },
    ],
  },
  {
    id: "lista-espera",
    title: "Lista de espera",
    keywords: ["fila", "lotado", "aguardando"],
    icon: Hourglass,
    color: "#EA4D8E",
    route: "/lista-espera",
    summary: "Pra quando o parque está lotado — anota o cliente e avisa quando vagar.",
    blocks: [
      {
        kind: "para",
        text: "Em dias de pico (sábado à tarde, feriado) o parque pode estar lotado. Em vez de mandar o cliente embora, você adiciona ele na lista de espera. Quando uma criança encerrar, o sistema notifica via WhatsApp automaticamente que tem vaga.",
      },
      {
        kind: "steps",
        title: "Adicionar à lista",
        items: [
          "Clica em 'Adicionar à fila'.",
          "Nome do responsável, telefone, número de crianças.",
          "Tempo desejado.",
          "Posição na fila aparece automaticamente.",
        ],
      },
    ],
  },
  {
    id: "midia",
    title: "Mídia",
    keywords: ["foto", "video", "galeria", "redes"],
    icon: ImageIcon,
    color: "#7B36BF",
    route: "/midia",
    summary: "Biblioteca de fotos/vídeos do parque pra usar em redes sociais e marketing.",
    blocks: [
      {
        kind: "para",
        text: "Galeria interna pro time guardar fotos e vídeos do parque — eventos, promocionais, depoimentos. As fotos podem ser usadas no marketing (campanhas), no site, ou compartilhadas com clientes.",
      },
      {
        kind: "tips",
        items: [
          "Sempre tenha autorização do responsável antes de fotografar a criança e usar em divulgação. O termo de responsabilidade já contempla isso, mas confirme.",
          "Categorize as fotos por tipo (eventos / instalações / equipe) pra achar rápido depois.",
        ],
      },
    ],
  },
  {
    id: "qrcode",
    title: "QR Check-out",
    keywords: ["qr", "saida", "checkout", "seguranca"],
    icon: QrCode,
    color: "#1E78DC",
    route: "/qrcode",
    summary: "Saída segura — só quem tem QR ou foto autorizada leva a criança.",
    blocks: [
      {
        kind: "para",
        text: "No cadastro da sessão, o responsável recebe um QR code único via WhatsApp. Na hora de buscar a criança, ele mostra o QR no balcão. O sistema confirma a identidade contra a foto cadastrada e libera a saída. Aumenta a segurança e evita que alguém leve uma criança que não é dele.",
      },
      {
        kind: "steps",
        title: "Como funciona",
        items: [
          "Cliente chega pra buscar criança.",
          "Você abre /qrcode na tela do balcão.",
          "Cliente mostra o QR (pelo celular dele) na webcam.",
          "Sistema lê o QR, identifica a sessão, mostra: foto da criança, foto do responsável cadastrado, nome.",
          "Você confere visualmente se bate.",
          "Se sim, clica em 'Liberar saída' — a sessão encerra automaticamente.",
        ],
      },
    ],
  },
  {
    id: "termo",
    title: "Termo digital",
    keywords: ["responsabilidade", "assinatura", "aceite", "juridico"],
    icon: FileSignature,
    color: "#F4B73F",
    route: "/termo",
    summary: "Gestão dos termos de responsabilidade assinados pelos pais.",
    blocks: [
      {
        kind: "para",
        text: "Todo cadastro novo gera uma solicitação de termo. O responsável recebe link via WhatsApp/Email e marca 'Li e aceito' pelo celular dele. Aqui você acompanha quem assinou, quem ainda não assinou, e pode reenviar.",
      },
      {
        kind: "steps",
        title: "Acompanhar termos",
        items: [
          "Lista de todos os termos: assinados, pendentes, expirados.",
          "Filtro por data e status.",
          "Pode reenviar o link se o cliente perdeu.",
          "Cada termo tem timestamp e IP de aceite, pra prova jurídica.",
        ],
      },
    ],
  },
  {
    id: "inventario",
    title: "Inventário",
    keywords: ["estoque", "produto", "lanchonete", "manutencao"],
    icon: Wrench,
    color: "#A6CD3F",
    route: "/inventario",
    summary: "Cadastro de produtos da lanchonete + controle de estoque.",
    blocks: [
      {
        kind: "para",
        text: "Onde você cadastra cada produto que vende no /pdv (salgados, bebidas, doces, brindes). Cada produto tem preço, estoque atual, estoque mínimo (alerta) e custo (pra calcular margem).",
      },
      {
        kind: "steps",
        title: "Cadastrar um produto novo",
        items: [
          "Clica em 'Novo produto'.",
          "Nome (ex: 'Coxinha 80g'), categoria (Salgado/Bebida/Doce/Brinde).",
          "Preço de venda e custo unitário (opcional).",
          "Estoque inicial.",
          "Estoque mínimo (quando atingir, alerta amarelo aparece).",
          "Foto (opcional).",
          "Salva. Produto fica disponível no /pdv.",
        ],
      },
      {
        kind: "tips",
        items: [
          "Faça inventário semanal — conta o que tem físico e ajusta no sistema se houver divergência.",
          "Produtos com margem ruim aparecem no relatório do /dashboard.",
        ],
      },
    ],
  },
  {
    id: "equipe",
    title: "Equipe",
    keywords: ["funcionario", "operador", "permissao", "role"],
    icon: Users,
    color: "#3CB4E0",
    route: "/equipe",
    summary: "Cadastro de funcionários com permissões diferentes (operador, gerente, dono).",
    blocks: [
      {
        kind: "para",
        text: "Cada funcionário tem um login próprio com permissões específicas. Operador comum pode cadastrar criança e vender no PDV, mas não pode cancelar movimento ou ver relatórios financeiros. Gerente e dono têm acesso amplo.",
      },
      {
        kind: "steps",
        title: "Adicionar funcionário",
        items: [
          "Acessa /equipe → 'Novo membro'.",
          "Email do funcionário.",
          "Senha inicial (ele pode trocar depois).",
          "Perfil: Operador / Gerente / Dono.",
          "Salva. Ele consegue logar e usar o sistema com as permissões do perfil.",
        ],
      },
      {
        kind: "warnings",
        items: [
          "Cancelamento de movimentos só funciona pra perfil 'Dono'. Se um operador tentar, o botão nem aparece.",
          "Nunca compartilhe um mesmo login entre 2 funcionários — perde a auditoria de quem fez o quê.",
        ],
      },
    ],
  },
  {
    id: "dashboard",
    title: "Dashboard",
    keywords: ["relatorio", "graficos", "indicadores", "kpi"],
    icon: Gauge,
    color: "#1E78DC",
    route: "/dashboard",
    summary: "Visão geral do negócio — faturamento, fluxo, ticket médio, comparativos.",
    blocks: [
      {
        kind: "para",
        text: "Painel executivo com os números que importam. Filtro por período (7/14/30/90 dias) e gráficos comparando com período anterior. Bom pra rotina semanal do dono pra ver se o parque está crescendo ou caindo.",
      },
      {
        kind: "steps",
        title: "Principais indicadores",
        items: [
          "Faturamento total do período (sessões + lanchonete).",
          "Número de sessões / crianças únicas.",
          "Ticket médio (faturamento ÷ sessões).",
          "Taxa de retorno (% de clientes que voltaram).",
          "Distribuição por forma de pagamento.",
          "Horários de pico (gráfico por hora do dia).",
          "Produtos mais vendidos na lanchonete.",
        ],
      },
      {
        kind: "tips",
        items: [
          "Confira o Dashboard toda segunda-feira de manhã pra planejar a semana.",
          "Se notar queda repentina (mais de 20%), abra o CRM e veja quais clientes habituais não vieram.",
        ],
      },
    ],
  },
  {
    id: "configuracoes",
    title: "Configurações",
    keywords: ["ajuste", "preco", "tolerancia", "templates"],
    icon: Cog,
    color: "#7B36BF",
    route: "/configuracoes",
    summary: "Ajustes globais — preços, tolerância, templates de mensagem, integrações.",
    blocks: [
      {
        kind: "para",
        text: "Painel administrativo pra ajustar parâmetros do sistema sem mexer no código. Só perfil 'Dono' tem acesso.",
      },
      {
        kind: "steps",
        title: "O que você pode mudar",
        items: [
          "Tabela de preços: valores e durações (20min/30min/60min).",
          "Tolerância de excedente: quantos minutos a criança pode passar sem cobrança extra (padrão: 2 minutos).",
          "Texto do banner do telão e do painel.",
          "Templates de WhatsApp e Email (boas-vindas, NPS, aniversário, etc).",
          "Dados da empresa (nome, CNPJ, endereço) usados nos termos.",
          "Chaves de API (Resend, uazapi) — só mexa se souber o que está fazendo.",
        ],
      },
      {
        kind: "warnings",
        items: [
          "Não mude preços no meio do dia — o sistema pode calcular excedente diferente pras sessões já ativas.",
          "Antes de mexer em template de mensagem, copie o original em um bloco de notas como backup.",
        ],
      },
    ],
  },
];

const TABLE_OF_CONTENTS_GROUPS: Array<{ title: string; ids: string[] }> = [
  {
    title: "Comece aqui",
    ids: ["primeiros-passos"],
  },
  {
    title: "Operação do dia a dia",
    ids: ["caixa", "painel", "telao", "pdv", "qrcode"],
  },
  {
    title: "Clientes e vendas",
    ids: ["crm", "marketing", "agendamento", "assinaturas", "parceiros", "fidelidade", "lista-espera"],
  },
  {
    title: "Gestão e configuração",
    ids: ["midia", "termo", "inventario", "equipe", "dashboard", "configuracoes"],
  },
];

export default function TutorialPage() {
  const [query, setQuery] = useState("");
  const [openIds, setOpenIds] = useState<Set<string>>(new Set(["primeiros-passos"]));

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return SECTIONS;
    return SECTIONS.filter((s) => {
      if (s.title.toLowerCase().includes(q)) return true;
      if (s.summary.toLowerCase().includes(q)) return true;
      if (s.keywords.some((k) => k.includes(q))) return true;
      // Procura tambem dentro do conteudo dos blocos
      for (const b of s.blocks) {
        if (b.kind === "para" && b.text.toLowerCase().includes(q)) return true;
        if (b.kind === "scenario" && (b.title.toLowerCase().includes(q) || b.body.toLowerCase().includes(q))) return true;
        if ((b.kind === "steps" || b.kind === "tips" || b.kind === "warnings") && b.items.some((it) => it.toLowerCase().includes(q))) return true;
      }
      return false;
    });
  }, [query]);

  function toggle(id: string) {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function expandAll() {
    setOpenIds(new Set(SECTIONS.map((s) => s.id)));
  }

  function collapseAll() {
    setOpenIds(new Set());
  }

  return (
    <div>
      <PageHeader
        title="Tutorial da plataforma"
        description="Aprenda a usar cada modulo do iCOM Kids passo a passo, mesmo sem experiencia em sistemas."
        actions={
          <div className="hidden gap-2 sm:flex">
            <Button variant="outline" size="sm" onClick={expandAll}>
              Expandir tudo
            </Button>
            <Button variant="outline" size="sm" onClick={collapseAll}>
              Recolher tudo
            </Button>
          </div>
        }
      />

      <div className="space-y-6 p-6">
        {/* Banner de boas-vindas */}
        <div className="rounded-xl border-2 border-[#1E78DC] bg-gradient-to-br from-[#1E78DC]/10 via-[#7B36BF]/5 to-[#EA4D8E]/10 p-6">
          <div className="flex items-start gap-4">
            <div className="rounded-full bg-[#1E78DC] p-3 text-white shadow-lg">
              <BookOpen className="size-6" />
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-bold text-slate-900">Bem-vindo ao guia do iCOM Kids</h2>
              <p className="mt-1 text-sm text-slate-700">
                Este tutorial cobre <strong>todos os modulos</strong> da plataforma com explicacao em portugues
                simples, passo a passo, cenarios reais e dicas. Voce pode ler na ordem ou pular direto pro topico
                que precisa pela busca.
              </p>
              <p className="mt-3 text-xs text-slate-600">
                Dica: se voce e novo, comece pela secao{" "}
                <button
                  className="font-semibold text-[#1E78DC] underline hover:no-underline"
                  onClick={() => {
                    setOpenIds(new Set(["primeiros-passos"]));
                    document.getElementById("primeiros-passos")?.scrollIntoView({ behavior: "smooth" });
                  }}
                >
                  Primeiros passos
                </button>
                . Ela explica os conceitos basicos em 2 minutos.
              </p>
            </div>
          </div>
        </div>

        {/* Busca */}
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar (ex: aniversario, sangria, pontos, fechamento, qr code...)"
            className="pl-9"
          />
        </div>

        {/* Indice (so quando nao tem busca) */}
        {!query ? (
          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-muted-foreground">
              Indice rapido
            </h3>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {TABLE_OF_CONTENTS_GROUPS.map((g) => (
                <div key={g.title}>
                  <p className="mb-1.5 text-xs font-bold text-slate-900">{g.title}</p>
                  <ul className="space-y-0.5">
                    {g.ids.map((id) => {
                      const s = SECTIONS.find((x) => x.id === id);
                      if (!s) return null;
                      return (
                        <li key={id}>
                          <button
                            className="text-xs text-slate-700 underline-offset-2 hover:text-[#1E78DC] hover:underline"
                            onClick={() => {
                              setOpenIds((prev) => {
                                const next = new Set(prev);
                                next.add(id);
                                return next;
                              });
                              setTimeout(
                                () => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" }),
                                50
                              );
                            }}
                          >
                            {s.title}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {/* Secoes */}
        {filtered.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-border bg-card px-6 py-12 text-center">
            <p className="text-sm text-muted-foreground">
              Nenhum topico encontrado pra "<strong>{query}</strong>". Tente outra palavra-chave.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((s) => {
              const isOpen = openIds.has(s.id);
              return (
                <section
                  key={s.id}
                  id={s.id}
                  className="overflow-hidden rounded-xl border border-border bg-card"
                >
                  <button
                    onClick={() => toggle(s.id)}
                    className="flex w-full items-center gap-3 px-5 py-4 text-left transition hover:bg-muted/50"
                  >
                    <div
                      className="flex size-10 shrink-0 items-center justify-center rounded-lg text-white shadow-sm"
                      style={{ background: s.color }}
                    >
                      <s.icon className="size-5" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-base font-bold text-slate-900">{s.title}</h3>
                      <p className="mt-0.5 text-xs text-slate-600">{s.summary}</p>
                    </div>
                    {s.route ? (
                      <Link
                        to={s.route}
                        onClick={(e) => e.stopPropagation()}
                        className="hidden text-xs font-semibold text-[#1E78DC] underline-offset-2 hover:underline sm:inline"
                      >
                        Abrir {s.title}
                      </Link>
                    ) : null}
                    {isOpen ? (
                      <ChevronDown className="size-5 shrink-0 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
                    )}
                  </button>

                  {isOpen ? (
                    <div className="border-t border-border px-5 py-5">
                      <div className="space-y-4">
                        {s.blocks.map((b, i) => (
                          <BlockRenderer key={i} block={b} color={s.color} />
                        ))}
                      </div>
                      {s.route ? (
                        <div className="mt-5 border-t border-border pt-4">
                          <Link to={s.route}>
                            <Button size="sm" style={{ background: s.color, color: "#fff" }} className="hover:opacity-90">
                              Ir para {s.title} agora
                            </Button>
                          </Link>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </section>
              );
            })}
          </div>
        )}

        {/* Rodape */}
        <div className="rounded-xl border border-border bg-muted/40 px-5 py-4 text-center">
          <p className="text-xs text-muted-foreground">
            Ainda com duvida? Entre em contato com o suporte ou consulte o admin do parque.
          </p>
        </div>
      </div>
    </div>
  );
}

function BlockRenderer({ block, color }: { block: Block; color: string }) {
  if (block.kind === "para") {
    return <p className="text-sm leading-relaxed text-slate-700">{block.text}</p>;
  }
  if (block.kind === "steps") {
    return (
      <div>
        {block.title ? (
          <p className="mb-2 text-sm font-bold text-slate-900">{block.title}</p>
        ) : null}
        <ol className="space-y-1.5">
          {block.items.map((it, i) => (
            <li key={i} className="flex gap-2.5 text-sm text-slate-700">
              <span
                className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                style={{ background: color }}
              >
                {i + 1}
              </span>
              <span className="leading-relaxed">{it}</span>
            </li>
          ))}
        </ol>
      </div>
    );
  }
  if (block.kind === "tips") {
    return (
      <div className="rounded-lg border-l-4 border-[#A6CD3F] bg-[#A6CD3F]/10 p-3">
        <div className="mb-1.5 flex items-center gap-2">
          <Lightbulb className="size-4 text-[#7a9a26]" />
          <p className="text-xs font-bold uppercase tracking-wider text-[#7a9a26]">Dicas</p>
        </div>
        <ul className="space-y-1 pl-1">
          {block.items.map((it, i) => (
            <li key={i} className="text-sm leading-relaxed text-slate-700">
              • {it}
            </li>
          ))}
        </ul>
      </div>
    );
  }
  if (block.kind === "warnings") {
    return (
      <div className="rounded-lg border-l-4 border-[#EA4D8E] bg-[#EA4D8E]/10 p-3">
        <p className="mb-1.5 text-xs font-bold uppercase tracking-wider text-[#EA4D8E]">Atencao</p>
        <ul className="space-y-1 pl-1">
          {block.items.map((it, i) => (
            <li key={i} className="text-sm leading-relaxed text-slate-700">
              ! {it}
            </li>
          ))}
        </ul>
      </div>
    );
  }
  // scenario
  return (
    <div className="rounded-lg border border-dashed border-border bg-muted/30 p-3">
      <p className="mb-1 text-xs font-bold uppercase tracking-wider text-slate-600">
        Cenario
      </p>
      <p className="mb-1.5 text-sm font-semibold text-slate-900">{block.title}</p>
      <p className="text-sm leading-relaxed text-slate-700">{block.body}</p>
    </div>
  );
}
