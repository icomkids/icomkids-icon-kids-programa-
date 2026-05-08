export interface Partner {
  id: string;
  name: string;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  commission_pct: number;
  active: boolean;
  profile_id: string | null;
  notes: string | null;
}

export interface PartnerInput {
  name: string;
  contact_name?: string;
  contact_phone?: string;
  contact_email?: string;
  commission_pct: number;
  active?: boolean;
  notes?: string;
}
