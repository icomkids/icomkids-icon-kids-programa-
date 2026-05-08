import { supabase } from "@/lib/supabase";
import type { Partner, PartnerInput } from "../types";

export interface PartnersRepo {
  list(): Promise<Partner[]>;
  listActive(): Promise<Partner[]>;
  create(input: PartnerInput): Promise<Partner>;
  setActive(id: string, active: boolean): Promise<void>;
  subscribe(onChange: () => void): () => void;
}

interface PartnerRow {
  id: string;
  name: string;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  commission_pct: number | string;
  active: boolean;
  profile_id: string | null;
  notes: string | null;
}

function rowToPartner(row: PartnerRow): Partner {
  return {
    id: row.id,
    name: row.name,
    contact_name: row.contact_name,
    contact_phone: row.contact_phone,
    contact_email: row.contact_email,
    commission_pct: typeof row.commission_pct === "string"
      ? parseFloat(row.commission_pct)
      : row.commission_pct,
    active: row.active,
    profile_id: row.profile_id,
    notes: row.notes,
  };
}

const SELECT =
  "id, name, contact_name, contact_phone, contact_email, commission_pct, active, profile_id, notes";

// ============================================================================
// Mock implementation
// ============================================================================

let mockSeed = 0;
const nextId = () => `mock-partner-${++mockSeed}-${Date.now().toString(36)}`;

export let mockPartners: Partner[] = [
  {
    id: nextId(),
    name: "Escola Crescer",
    contact_name: "Diretora Mariana",
    contact_phone: "(11) 4002-8922",
    contact_email: "contato@escolacrescer.edu.br",
    commission_pct: 15,
    active: true,
    profile_id: null,
    notes: null,
  },
  {
    id: nextId(),
    name: "Colegio Pequenos Genios",
    contact_name: "Coordenador Lucas",
    contact_phone: "(11) 5555-1234",
    contact_email: null,
    commission_pct: 10,
    active: true,
    profile_id: null,
    notes: null,
  },
];

const mockSubscribers = new Set<() => void>();
const notify = () => mockSubscribers.forEach((fn) => fn());

export const mockPartnersRepo: PartnersRepo = {
  async list() {
    return [...mockPartners].sort((a, b) => a.name.localeCompare(b.name));
  },
  async listActive() {
    return mockPartners
      .filter((p) => p.active)
      .sort((a, b) => a.name.localeCompare(b.name));
  },
  async create(input) {
    const partner: Partner = {
      id: nextId(),
      name: input.name,
      contact_name: input.contact_name ?? null,
      contact_phone: input.contact_phone ?? null,
      contact_email: input.contact_email ?? null,
      commission_pct: input.commission_pct,
      active: input.active ?? true,
      profile_id: null,
      notes: input.notes ?? null,
    };
    mockPartners = [...mockPartners, partner];
    notify();
    return partner;
  },
  async setActive(id, active) {
    mockPartners = mockPartners.map((p) => (p.id === id ? { ...p, active } : p));
    notify();
  },
  subscribe(onChange) {
    mockSubscribers.add(onChange);
    return () => mockSubscribers.delete(onChange);
  },
};

// ============================================================================
// Supabase implementation
// ============================================================================

export const supabasePartnersRepo: PartnersRepo = {
  async list() {
    const { data, error } = await supabase
      .from("partners")
      .select(SELECT)
      .order("name");
    if (error) throw error;
    return (data as unknown as PartnerRow[]).map(rowToPartner);
  },
  async listActive() {
    const { data, error } = await supabase
      .from("partners")
      .select(SELECT)
      .eq("active", true)
      .order("name");
    if (error) throw error;
    return (data as unknown as PartnerRow[]).map(rowToPartner);
  },
  async create(input) {
    const { data, error } = await supabase
      .from("partners")
      .insert({
        name: input.name,
        contact_name: input.contact_name ?? null,
        contact_phone: input.contact_phone ?? null,
        contact_email: input.contact_email ?? null,
        commission_pct: input.commission_pct,
        active: input.active ?? true,
        notes: input.notes ?? null,
      })
      .select(SELECT)
      .single();
    if (error) throw error;
    return rowToPartner(data as unknown as PartnerRow);
  },
  async setActive(id, active) {
    const { error } = await supabase
      .from("partners")
      .update({ active })
      .eq("id", id);
    if (error) throw error;
  },
  subscribe(onChange) {
    const channel = supabase
      .channel(`partners-changes-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "partners" }, onChange)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  },
};

const useMock = import.meta.env.VITE_USE_MOCK_DATA === "true";

export const partnersRepo: PartnersRepo = useMock
  ? mockPartnersRepo
  : supabasePartnersRepo;
