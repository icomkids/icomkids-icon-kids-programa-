import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Apple,
  Coffee,
  Gamepad2,
  Minus,
  Package,
  Plus,
  ShoppingCart,
  Trash2,
} from "lucide-react";
import { PageHeader } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { isUsingMockData } from "@/features/crm/lib/sessions-repo";
import { NewProductDialog } from "@/features/pdv/components/new-product-dialog";
import { useProducts } from "@/features/pdv/hooks/use-products";
import { salesRepo } from "@/features/pdv/lib/sales-repo";
import { formatBRL } from "@/lib/format";
import type { CartItem, Product } from "@/features/pdv/types";

const categoryIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  bebida: Coffee,
  lanche: Apple,
  brinquedo: Gamepad2,
  outro: Package,
};

const categoryColors: Record<string, string> = {
  bebida: "#3CB4E0",
  lanche: "#F39230",
  brinquedo: "#7B36BF",
  outro: "#94a3b8",
};

export default function PDVPage() {
  const { products, loading, create } = useProducts(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<"pix" | "dinheiro" | "cartao">("pix");
  const [submitting, setSubmitting] = useState(false);
  const [lastSaleTotal, setLastSaleTotal] = useState<number | null>(null);

  const grouped = useMemo(() => {
    const map = new Map<string, Product[]>();
    for (const p of products) {
      if (!p.active) continue;
      const cat = p.category ?? "outro";
      const arr = map.get(cat) ?? [];
      arr.push(p);
      map.set(cat, arr);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [products]);

  const cartTotal = cart.reduce(
    (acc, it) => acc + it.product.price_cents * it.quantity,
    0
  );

  const lowStockCount = products.filter(
    (p) => p.active && p.stock_qty <= p.low_stock_threshold
  ).length;

  const addToCart = (product: Product) => {
    if (product.stock_qty <= 0) return;
    setCart((prev) => {
      const existing = prev.find((it) => it.product.id === product.id);
      if (existing) {
        if (existing.quantity >= product.stock_qty) return prev;
        return prev.map((it) =>
          it.product.id === product.id
            ? { ...it, quantity: it.quantity + 1 }
            : it
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
    setLastSaleTotal(null);
  };

  const decFromCart = (productId: string) => {
    setCart((prev) =>
      prev
        .map((it) =>
          it.product.id === productId
            ? { ...it, quantity: it.quantity - 1 }
            : it
        )
        .filter((it) => it.quantity > 0)
    );
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((it) => it.product.id !== productId));
  };

  const clearCart = () => setCart([]);

  const finalize = async () => {
    if (cart.length === 0) return;
    setSubmitting(true);
    try {
      await salesRepo.create({
        items: cart.map((it) => ({
          product_id: it.product.id,
          product_name: it.product.name,
          unit_price_cents: it.product.price_cents,
          quantity: it.quantity,
        })),
        payment_method: paymentMethod,
      });
      setLastSaleTotal(cartTotal);
      clearCart();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="PDV — Lanchonete"
        description="Vendas de produtos com baixa automatica de estoque."
        actions={<NewProductDialog onSubmit={create} />}
      />

      <div className="space-y-4 p-6">
        {isUsingMockData ? (
          <div className="rounded-md border border-[#F4B73F] bg-[#F4B73F]/15 px-4 py-2 text-xs">
            <strong>Modo demo:</strong> 5 produtos mock cadastrados.
          </div>
        ) : null}
        {lowStockCount > 0 ? (
          <div className="flex items-center gap-2 rounded-md border border-[#EA4D8E] bg-[#EA4D8E]/10 px-4 py-2 text-xs">
            <AlertTriangle className="size-4 text-[#EA4D8E]" />
            <strong>{lowStockCount}</strong> produto
            {lowStockCount === 1 ? "" : "s"} com estoque baixo.
          </div>
        ) : null}
        {lastSaleTotal != null ? (
          <div className="rounded-md border border-[#A6CD3F] bg-[#A6CD3F]/15 px-4 py-2 text-sm font-semibold">
            Venda registrada: {formatBRL(lastSaleTotal)} ✓
          </div>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <div className="space-y-5">
            {loading ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-28 rounded-xl" />
                ))}
              </div>
            ) : grouped.length === 0 ? (
              <div className="flex flex-col items-center gap-2 rounded-xl border-2 border-dashed border-border bg-card px-6 py-16 text-center">
                <Package className="size-8 text-muted-foreground" />
                <p className="text-base font-semibold">Nenhum produto ativo</p>
                <p className="max-w-md text-sm text-muted-foreground">
                  Use o botao <strong>Novo produto</strong> no topo para
                  cadastrar.
                </p>
              </div>
            ) : (
              grouped.map(([cat, items]) => {
                const Icon = categoryIcons[cat] ?? Package;
                const color = categoryColors[cat] ?? "#94a3b8";
                return (
                  <section key={cat}>
                    <header className="mb-2 flex items-center gap-2">
                      <span
                        className="flex size-7 items-center justify-center rounded-md text-white"
                        style={{ background: color }}
                      >
                        <Icon className="size-4" />
                      </span>
                      <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
                        {cat}
                      </h2>
                      <span className="text-xs text-muted-foreground">
                        {items.length} {items.length === 1 ? "item" : "itens"}
                      </span>
                    </header>
                    <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                      {items.map((p) => {
                        const low = p.stock_qty <= p.low_stock_threshold;
                        const out = p.stock_qty <= 0;
                        return (
                          <button
                            key={p.id}
                            type="button"
                            disabled={out}
                            onClick={() => addToCart(p)}
                            className={`group flex flex-col items-start gap-1 rounded-xl border-2 bg-card p-3 text-left transition ${
                              out
                                ? "cursor-not-allowed opacity-50"
                                : "hover:border-[#1E78DC] hover:shadow-md"
                            }`}
                            style={{ borderColor: out ? undefined : "transparent" }}
                          >
                            <span className="text-sm font-bold">{p.name}</span>
                            <span className="text-base font-black tabular-nums text-[#1E78DC]">
                              {formatBRL(p.price_cents)}
                            </span>
                            <span
                              className={`text-[11px] font-semibold ${
                                out
                                  ? "text-[#EA4D8E]"
                                  : low
                                  ? "text-[#F39230]"
                                  : "text-muted-foreground"
                              }`}
                            >
                              {out
                                ? "Esgotado"
                                : `${p.stock_qty} em estoque`}
                              {low && !out ? " · baixo" : ""}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </section>
                );
              })
            )}
          </div>

          <aside className="rounded-xl border border-border bg-card p-4 lg:sticky lg:top-4 lg:h-fit">
            <header className="flex items-center gap-2 border-b border-border pb-3">
              <ShoppingCart className="size-4 text-[#1E78DC]" />
              <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
                Carrinho
              </h2>
              <span className="ml-auto text-xs text-muted-foreground">
                {cart.length} {cart.length === 1 ? "item" : "itens"}
              </span>
            </header>

            {cart.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                Toque em um produto para adicionar.
              </p>
            ) : (
              <ul className="space-y-2 py-3">
                {cart.map((it) => (
                  <li
                    key={it.product.id}
                    className="rounded-md border border-border p-2"
                  >
                    <div className="flex items-start justify-between gap-1">
                      <p className="text-sm font-semibold">{it.product.name}</p>
                      <button
                        type="button"
                        className="text-muted-foreground hover:text-[#EA4D8E]"
                        onClick={() => removeFromCart(it.product.id)}
                        aria-label="Remover"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                    <div className="mt-1 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          className="flex size-6 items-center justify-center rounded-md border border-border hover:bg-muted"
                          onClick={() => decFromCart(it.product.id)}
                        >
                          <Minus className="size-3" />
                        </button>
                        <span className="min-w-[1.5rem] text-center text-sm font-bold tabular-nums">
                          {it.quantity}
                        </span>
                        <button
                          type="button"
                          className="flex size-6 items-center justify-center rounded-md border border-border hover:bg-muted"
                          onClick={() => addToCart(it.product)}
                          disabled={it.quantity >= it.product.stock_qty}
                        >
                          <Plus className="size-3" />
                        </button>
                      </div>
                      <p className="text-sm font-bold tabular-nums text-[#1E78DC]">
                        {formatBRL(it.product.price_cents * it.quantity)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <div className="space-y-3 border-t border-border pt-3">
              <div className="flex items-baseline justify-between">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Total
                </p>
                <p className="text-2xl font-black tabular-nums">
                  {formatBRL(cartTotal)}
                </p>
              </div>
              <div className="flex gap-1">
                {(["pix", "dinheiro", "cartao"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setPaymentMethod(m)}
                    className={`flex-1 rounded-md border px-2 py-1.5 text-xs font-semibold uppercase transition ${
                      paymentMethod === m
                        ? "border-[#1E78DC] bg-[#1E78DC] text-white"
                        : "border-border bg-background hover:bg-muted"
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
              <Button
                type="button"
                disabled={cart.length === 0 || submitting}
                onClick={() => void finalize()}
                className="w-full bg-[#A6CD3F] text-slate-900 hover:bg-[#A6CD3F]/90"
              >
                {submitting ? "Registrando..." : "Finalizar venda"}
              </Button>
              {cart.length > 0 ? (
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full text-xs text-muted-foreground"
                  onClick={clearCart}
                >
                  Limpar carrinho
                </Button>
              ) : null}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
