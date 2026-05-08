export interface Product {
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

export interface ProductInput {
  name: string;
  category?: string;
  price_cents: number;
  stock_qty?: number;
  low_stock_threshold?: number;
  active?: boolean;
  sku?: string;
  notes?: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export interface ProductSale {
  id: string;
  total_cents: number;
  payment_method: string | null;
  notes: string | null;
  session_id: string | null;
  created_at: string;
  items: ProductSaleItem[];
}

export interface ProductSaleItem {
  id: string;
  product_id: string | null;
  product_name: string;
  unit_price_cents: number;
  quantity: number;
  subtotal_cents: number;
}

export interface SaleInput {
  items: Array<{
    product_id: string;
    product_name: string;
    unit_price_cents: number;
    quantity: number;
  }>;
  payment_method?: "pix" | "dinheiro" | "cartao";
  session_id?: string | null;
  notes?: string;
}
