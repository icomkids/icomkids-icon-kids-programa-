import type {AdminDetails,AdminEntry} from './administrative.ts';
import type {VehicleSpec} from './vehicle-catalog.ts';
export const stockStates=['PREVISTO','AGUARDANDO_QUITACAO','EM_PREPARACAO','DISPONIVEL','VENDIDO'] as const;
export type StockState=(typeof stockStates)[number];
export const stockLabels:Record<StockState,string>={PREVISTO:'Entrada prevista',AGUARDANDO_QUITACAO:'Aguardando quitação / débitos',EM_PREPARACAO:'Em preparação',DISPONIVEL:'Disponível',VENDIDO:'Vendido'};
export type StockRow={id:string;origin_entry_id:string;sold_entry_id:string|null;plate:string;vehicle:VehicleSpec;source_details:AdminDetails;purchase_cents:number;debt_cents:number;entry_date:string;status:StockState;active:boolean;notes:string;updated_at:string;created_at:string};
export function stockCosts(row:StockRow,entries:AdminEntry[]){return entries.filter(e=>e.active&&e.kind==='CUSTO'&&e.status==='REALIZADO'&&e.details.stock_id===row.id).reduce((sum,e)=>sum+Number(e.amount_cents||0),0);}
export function stockInput(body:Record<string,unknown>){const {id,status,expected_updated_at}=body;const notes=typeof body.notes==='string'?body.notes.trim():'';if(typeof id!=='string'||!/^[0-9a-f-]{36}$/i.test(id)||!['AGUARDANDO_QUITACAO','EM_PREPARACAO','DISPONIVEL'].includes(String(status))||typeof expected_updated_at!=='string'||!Number.isFinite(Date.parse(expected_updated_at))||notes.length>2000)throw new Error('Reabra o veículo e confira a situação.');return {id,status,notes,expected_updated_at};}
