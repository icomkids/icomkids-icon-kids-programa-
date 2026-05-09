import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CheckCircle2, Clock3, ShoppingBag, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/common/logo";
import { useActiveOffers } from "@/features/sales/hooks/use-sales";
import { salesRepo } from "@/features/sales/lib/sales-repo";
import { formatBRL } from "@/lib/format";
import type { TicketOffer } from "@/features/sales/types";

export default function StorefrontPage() {
  const { offers, loading } = useActiveOffers();
  const [params] = useSearchParams();
  const canceled = params.get("canceled") === "1";

  const [selected, setSelected] = useState<TicketOffer | null>(null);

  useEffect(() => {
    if (!loading && offers.length > 0 && !selected) {
      setSelected(offers[0]);
    }
  }, [loading, offers, selected]);

  return (
    <div
      className="min-h-svh"
      style={{
        backgroundImage:
          "radial-gradient(circle at 20% 10%, rgba(30,120,220,0.18), transparent 55%), radial-gradient(circle at 80% 80%, rgba(234,77,142,0.18), transparent 55%), radial-gradient(circle at 50% 100%, rgba(244,183,63,0.15), transparent 50%)",
      }}
    >
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 pt-8">
        <Logo height={64} />
        <a
          href="https://wa.me/5500000000000"
          target="_blank"
          rel="noreferrer"
          className="rounded-full bg-white/80 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-[#1E78DC] hover:bg-white"
        >
          Falar com a gente
        </a>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10">
        <section className="text-center">
          <p className="text-xs font-bold uppercase tracking-[0.4em] text-[#1E78DC]">
            iCOM Kids
          </p>
          <h1 className="mt-3 text-4xl font-black sm:text-5xl">
            Diversao em movimento
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base text-slate-700">
            Compre seu ingresso online e chegue direto pra brincar. Você
            recebe um QR Code unico por email para apresentar na entrada.
          </p>
        </section>

        {canceled ? (
          <div className="mx-auto mt-6 max-w-xl rounded-md border border-[#F4B73F] bg-[#F4B73F]/15 px-4 py-3 text-center text-sm">
            Pagamento cancelado. Quando quiser tentar de novo, escolha um
            pacote abaixo.
          </div>
        ) : null}

        <section className="mt-10">
          <h2 className="text-xs font-bold uppercase tracking-[0.4em] text-slate-500">
            Escolha seu pacote
          </h2>
          {loading ? (
            <p className="mt-4 text-sm text-slate-500">Carregando ofertas...</p>
          ) : offers.length === 0 ? (
            <div className="mt-4 rounded-2xl border-2 border-dashed border-slate-300 bg-white/60 px-6 py-12 text-center text-sm text-slate-600">
              Loja online ainda nao tem pacotes ativos. Entre em contato pelo
              WhatsApp para comprar.
            </div>
          ) : (
            <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {offers.map((o) => {
                const active = selected?.id === o.id;
                return (
                  <li key={o.id}>
                    <button
                      type="button"
                      onClick={() => setSelected(o)}
                      className={`flex h-full w-full flex-col rounded-2xl border-2 bg-white p-5 text-left transition ${
                        active
                          ? "border-[#1E78DC] shadow-lg"
                          : "border-transparent hover:border-[#1E78DC]/40 hover:shadow-md"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <p className="text-base font-black">{o.name}</p>
                        {active ? (
                          <CheckCircle2 className="size-5 text-[#1E78DC]" />
                        ) : null}
                      </div>
                      {o.description ? (
                        <p className="mt-1 text-xs text-slate-600">
                          {o.description}
                        </p>
                      ) : null}
                      <p className="mt-3 text-3xl font-black tabular-nums text-[#1E78DC]">
                        {formatBRL(o.price_cents)}
                      </p>
                      {o.duration_minutes ? (
                        <p className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                          <Clock3 className="size-3" />
                          {o.duration_minutes} minutos
                        </p>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {selected ? (
          <CheckoutForm offer={selected} />
        ) : null}

        <footer className="mt-12 text-center text-xs text-slate-500">
          <p>iCOM Kids — Diversao em movimento</p>
        </footer>
      </main>
    </div>
  );
}

function CheckoutForm({ offer }: { offer: TicketOffer }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [document, setDocument] = useState("");
  const [phone, setPhone] = useState("");
  const [child, setChild] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !document.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await salesRepo.createCheckout({
        offer_id: offer.id,
        guardian_name: name.trim(),
        guardian_email: email.trim(),
        guardian_document: document.trim(),
        guardian_phone: phone.trim() || undefined,
        child_name: child.trim() || undefined,
      });
      if (result.ok && result.checkout_url) {
        window.location.href = result.checkout_url;
        return;
      }
      setError(result.error ?? "Falha ao iniciar pagamento.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro inesperado.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="mt-10">
      <div className="mx-auto max-w-xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <header className="flex items-center gap-2">
          <Sparkles className="size-4 text-[#1E78DC]" />
          <h3 className="text-sm font-bold uppercase tracking-widest text-slate-500">
            Finalizar compra
          </h3>
        </header>
        <p className="mt-1 text-sm text-slate-600">
          {offer.name} · {formatBRL(offer.price_cents)}
        </p>

        <form onSubmit={submit} className="mt-5 space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="cf-name">Seu nome</Label>
              <Input
                id="cf-name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cf-email">Email</Label>
              <Input
                id="cf-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="cf-doc">CPF/CNPJ</Label>
              <Input
                id="cf-doc"
                inputMode="numeric"
                required
                value={document}
                onChange={(e) => setDocument(e.target.value)}
                placeholder="Apenas numeros"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cf-phone">WhatsApp</Label>
              <Input
                id="cf-phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(11) 9..."
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cf-child">Crianca (opcional)</Label>
            <Input
              id="cf-child"
              value={child}
              onChange={(e) => setChild(e.target.value)}
            />
          </div>
          {error ? (
            <div className="rounded-md border border-[#EA4D8E] bg-[#EA4D8E]/10 px-3 py-2 text-xs text-[#EA4D8E]">
              {error}
            </div>
          ) : null}
          <Button
            type="submit"
            disabled={submitting}
            className="w-full bg-[#1E78DC] text-white hover:bg-[#1E78DC]/90"
          >
            <ShoppingBag className="size-4" />
            {submitting
              ? "Abrindo pagamento..."
              : `Pagar ${formatBRL(offer.price_cents)}`}
          </Button>
          <p className="text-center text-[11px] text-slate-500">
            Pagamento processado pela Asaas. Aceitamos PIX, cartao e boleto.
            Voce recebe o QR Code do ingresso por email apos a confirmacao.
          </p>
        </form>
      </div>
    </section>
  );
}
