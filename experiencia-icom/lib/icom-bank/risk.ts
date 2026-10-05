export const riskProfiles=['A','B','C','D'] as const;
export type RiskProfile=typeof riskProfiles[number];
export function parseRiskProfile(value:unknown):RiskProfile|null{
 if(value===null||value===undefined||value==='')return null;
 if(typeof value!=='string'||!riskProfiles.includes(value as RiskProfile))throw new Error('Escolha um perfil A, B, C ou D, ou deixe sem classificação.');
 return value as RiskProfile;
}
export const riskLabel=(value:RiskProfile|null|undefined)=>value?'Perfil '+value:'Sem classificação';
export function customerProfileInput(body:Record<string,unknown>){
 const id=String(body.id||''),expected=String(body.expected_updated_at||'');
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)||!/^\d{4}-\d{2}-\d{2}T/.test(expected)||!Number.isFinite(Date.parse(expected))||!Object.hasOwn(body,'risk_profile'))throw new Error('Reabra a ficha do cliente antes de salvar.');
 return {p_customer:id,p_profile:parseRiskProfile(body.risk_profile),p_expected:expected};
}
