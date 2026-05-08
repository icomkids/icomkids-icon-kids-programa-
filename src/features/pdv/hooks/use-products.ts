import { useCallback, useEffect, useState } from "react";
import { productsRepo } from "../lib/products-repo";
import type { Product, ProductInput } from "../types";

export function useProducts(activeOnly = false) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const data = activeOnly
        ? await productsRepo.listActive()
        : await productsRepo.list();
      setProducts(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar produtos");
    } finally {
      setLoading(false);
    }
  }, [activeOnly]);

  useEffect(() => {
    refresh();
    return productsRepo.subscribe(refresh);
  }, [refresh]);

  const create = useCallback(
    async (input: ProductInput) => {
      const created = await productsRepo.create(input);
      await refresh();
      return created;
    },
    [refresh]
  );

  const update = useCallback(
    async (id: string, patch: Partial<ProductInput>) => {
      const updated = await productsRepo.update(id, patch);
      await refresh();
      return updated;
    },
    [refresh]
  );

  return { products, loading, error, create, update, refresh };
}
