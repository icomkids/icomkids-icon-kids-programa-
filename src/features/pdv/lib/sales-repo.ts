import { supabase } from "@/lib/supabase";
import { mockProducts } from "./products-repo";
import type { ProductSale, SaleInput } from "../types";

export interface SalesRepo {
  /** Returns sales since local midnight today, with items. */
  listToday(): Promise<ProductSale[]>;
  create(input: SaleInput): Promise<ProductSale>;
  subscribe(onChange: () => void): () => void;
}

interface SaleRow {
  id: string;
  total_cents: number;
  payment_method: string | null;
  notes: string | null;
  session_id: string | null;
  created_at: string;
  product_sale_items: Array<{
    id: string;
    product_id: string | null;
    product_name: string;
    unit_price_cents: number;
    quantity: number;
    subtotal_cents: number;
  }>;
}

const SALE_SELECT =
  "id, total_cents, payment_method, notes, session_id, created_at, product_sale_items:product_sale_items(id, product_id, product_name, unit_price_cents, quantity, subtotal_cents)";

function startOfTodayISO(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function rowToSale(row: SaleRow): ProductSale {
  return {
    id: row.id,
    total_cents: row.total_cents,
    payment_method: row.payment_method,
    notes: row.notes,
    session_id: row.session_id,
    created_at: row.created_at,
    items: row.product_sale_items.map((it) => ({
      id: it.id,
      product_id: it.product_id,
      product_name: it.product_name,
      unit_price_cents: it.unit_price_cents,
      quantity: it.quantity,
      subtotal_cents: it.subtotal_cents,
    })),
  };
}

// ============================================================================
// Mock
// ============================================================================

let saleSeed = 0;
let mockSales: ProductSale[] = [];
const subs = new Set<() => void>();
const notify = () => subs.forEach((fn) => fn());

function totalFromItems(items: SaleInput["items"]): number {
  return items.reduce((acc, it) => acc + it.unit_price_cents * it.quantity, 0);
}

export const mockSalesRepo: SalesRepo = {
  async listToday() {
    const since = new Date();
    since.setHours(0, 0, 0, 0);
    return mockSales
      .filter((s) => new Date(s.created_at).getTime() >= since.getTime())
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
  },
  async create(input) {
    const total = totalFromItems(input.items);
    const sale: ProductSale = {
      id: `mock-sale-${++saleSeed}`,
      total_cents: total,
      payment_method: input.payment_method ?? null,
      notes: input.notes ?? null,
      session_id: input.session_id ?? null,
      created_at: new Date().toISOString(),
      items: input.items.map((it, idx) => ({
        id: `mock-saleitem-${saleSeed}-${idx}`,
        product_id: it.product_id,
        product_name: it.product_name,
        unit_price_cents: it.unit_price_cents,
        quantity: it.quantity,
        subtotal_cents: it.unit_price_cents * it.quantity,
      })),
    };
    mockSales = [sale, ...mockSales];

    // Decrement stock locally to mirror the supabase trigger behavior.
    for (const it of input.items) {
      const idx = mockProducts.findIndex((p) => p.id === it.product_id);
      if (idx !== -1) {
        mockProducts[idx] = {
          ...mockProducts[idx],
          stock_qty: Math.max(0, mockProducts[idx].stock_qty - it.quantity),
        };
      }
    }
    notify();
    return sale;
  },
  subscribe(onChange) {
    subs.add(onChange);
    return () => subs.delete(onChange);
  },
};

// ============================================================================
// Supabase
// ============================================================================

export const supabaseSalesRepo: SalesRepo = {
  async listToday() {
    const { data, error } = await supabase
      .from("product_sales")
      .select(SALE_SELECT)
      .gte("created_at", startOfTodayISO())
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data as unknown as SaleRow[]).map(rowToSale);
  },
  async create(input) {
    const total = totalFromItems(input.items);
    const { data: sale, error: sErr } = await supabase
      .from("product_sales")
      .insert({
        total_cents: total,
        payment_method: input.payment_method ?? null,
        session_id: input.session_id ?? null,
        notes: input.notes ?? null,
      })
      .select("id, total_cents, payment_method, notes, session_id, created_at")
      .single();
    if (sErr) throw sErr;

    const itemsInsert = input.items.map((it) => ({
      sale_id: sale.id,
      product_id: it.product_id,
      product_name: it.product_name,
      unit_price_cents: it.unit_price_cents,
      quantity: it.quantity,
    }));
    const { data: items, error: iErr } = await supabase
      .from("product_sale_items")
      .insert(itemsInsert)
      .select(
        "id, product_id, product_name, unit_price_cents, quantity, subtotal_cents"
      );
    if (iErr) throw iErr;

    return {
      id: sale.id,
      total_cents: sale.total_cents,
      payment_method: sale.payment_method,
      notes: sale.notes,
      session_id: sale.session_id,
      created_at: sale.created_at,
      items: (items ?? []).map((it) => ({
        id: it.id,
        product_id: it.product_id,
        product_name: it.product_name,
        unit_price_cents: it.unit_price_cents,
        quantity: it.quantity,
        subtotal_cents: it.subtotal_cents ?? it.unit_price_cents * it.quantity,
      })),
    };
  },
  subscribe(onChange) {
    const channel = supabase
      .channel(`product-sales-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "product_sales" },
        onChange
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  },
};

const useMock = import.meta.env.VITE_USE_MOCK_DATA === "true";

export const salesRepo: SalesRepo = useMock ? mockSalesRepo : supabaseSalesRepo;
