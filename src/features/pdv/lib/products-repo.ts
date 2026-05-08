import { supabase } from "@/lib/supabase";
import type { Product, ProductInput } from "../types";

export interface ProductsRepo {
  list(): Promise<Product[]>;
  listActive(): Promise<Product[]>;
  create(input: ProductInput): Promise<Product>;
  update(id: string, patch: Partial<ProductInput>): Promise<Product>;
  subscribe(onChange: () => void): () => void;
}

interface ProductRow {
  id: string;
  name: string;
  category: string | null;
  price_cents: number;
  stock_qty: number;
  low_stock_threshold: number;
  active: boolean;
  sku: string | null;
  notes: string | null;
}

const SELECT =
  "id, name, category, price_cents, stock_qty, low_stock_threshold, active, sku, notes";

function rowToProduct(row: ProductRow): Product {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    price_cents: row.price_cents,
    stock_qty: row.stock_qty,
    low_stock_threshold: row.low_stock_threshold,
    active: row.active,
    sku: row.sku,
    notes: row.notes,
  };
}

// ============================================================================
// Mock
// ============================================================================

let mockSeed = 0;
const nextId = () => `mock-prod-${++mockSeed}`;

export let mockProducts: Product[] = [
  {
    id: nextId(),
    name: "Agua mineral 500ml",
    category: "bebida",
    price_cents: 400,
    stock_qty: 24,
    low_stock_threshold: 6,
    active: true,
    sku: null,
    notes: null,
  },
  {
    id: nextId(),
    name: "Suco natural laranja",
    category: "bebida",
    price_cents: 800,
    stock_qty: 12,
    low_stock_threshold: 4,
    active: true,
    sku: null,
    notes: null,
  },
  {
    id: nextId(),
    name: "Pao de queijo (un)",
    category: "lanche",
    price_cents: 500,
    stock_qty: 30,
    low_stock_threshold: 10,
    active: true,
    sku: null,
    notes: null,
  },
  {
    id: nextId(),
    name: "Pipoca",
    category: "lanche",
    price_cents: 700,
    stock_qty: 4,
    low_stock_threshold: 5,
    active: true,
    sku: null,
    notes: null,
  },
  {
    id: nextId(),
    name: "Brinquedo surpresa",
    category: "brinquedo",
    price_cents: 1500,
    stock_qty: 8,
    low_stock_threshold: 3,
    active: true,
    sku: null,
    notes: null,
  },
];

const subs = new Set<() => void>();
const notify = () => subs.forEach((fn) => fn());

export const mockProductsRepo: ProductsRepo = {
  async list() {
    return [...mockProducts].sort((a, b) =>
      (a.category ?? "").localeCompare(b.category ?? "") ||
      a.name.localeCompare(b.name)
    );
  },
  async listActive() {
    return mockProducts
      .filter((p) => p.active)
      .sort(
        (a, b) =>
          (a.category ?? "").localeCompare(b.category ?? "") ||
          a.name.localeCompare(b.name)
      );
  },
  async create(input) {
    const product: Product = {
      id: nextId(),
      name: input.name,
      category: input.category ?? null,
      price_cents: input.price_cents,
      stock_qty: input.stock_qty ?? 0,
      low_stock_threshold: input.low_stock_threshold ?? 5,
      active: input.active ?? true,
      sku: input.sku ?? null,
      notes: input.notes ?? null,
    };
    mockProducts = [...mockProducts, product];
    notify();
    return product;
  },
  async update(id, patch) {
    let updated: Product | null = null;
    mockProducts = mockProducts.map((p) => {
      if (p.id !== id) return p;
      updated = {
        ...p,
        name: patch.name ?? p.name,
        category: patch.category ?? p.category,
        price_cents: patch.price_cents ?? p.price_cents,
        stock_qty: patch.stock_qty ?? p.stock_qty,
        low_stock_threshold: patch.low_stock_threshold ?? p.low_stock_threshold,
        active: patch.active ?? p.active,
        sku: patch.sku ?? p.sku,
        notes: patch.notes ?? p.notes,
      };
      return updated;
    });
    notify();
    if (!updated) throw new Error("Produto nao encontrado");
    return updated;
  },
  subscribe(onChange) {
    subs.add(onChange);
    return () => subs.delete(onChange);
  },
};

// ============================================================================
// Supabase
// ============================================================================

export const supabaseProductsRepo: ProductsRepo = {
  async list() {
    const { data, error } = await supabase
      .from("products")
      .select(SELECT)
      .order("category", { nullsFirst: false })
      .order("name");
    if (error) throw error;
    return (data as unknown as ProductRow[]).map(rowToProduct);
  },
  async listActive() {
    const { data, error } = await supabase
      .from("products")
      .select(SELECT)
      .eq("active", true)
      .order("category", { nullsFirst: false })
      .order("name");
    if (error) throw error;
    return (data as unknown as ProductRow[]).map(rowToProduct);
  },
  async create(input) {
    const { data, error } = await supabase
      .from("products")
      .insert({
        name: input.name,
        category: input.category ?? null,
        price_cents: input.price_cents,
        stock_qty: input.stock_qty ?? 0,
        low_stock_threshold: input.low_stock_threshold ?? 5,
        active: input.active ?? true,
        sku: input.sku ?? null,
        notes: input.notes ?? null,
      })
      .select(SELECT)
      .single();
    if (error) throw error;
    return rowToProduct(data as unknown as ProductRow);
  },
  async update(id, patch) {
    const { data, error } = await supabase
      .from("products")
      .update(patch)
      .eq("id", id)
      .select(SELECT)
      .single();
    if (error) throw error;
    return rowToProduct(data as unknown as ProductRow);
  },
  subscribe(onChange) {
    const channel = supabase
      .channel(`products-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "products" },
        onChange
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  },
};

const useMock = import.meta.env.VITE_USE_MOCK_DATA === "true";

export const productsRepo: ProductsRepo = useMock
  ? mockProductsRepo
  : supabaseProductsRepo;
