const expenseFold=(s:string)=>s.normalize('NFD').replace(/\p{M}/gu,'').toLocaleLowerCase('pt-BR');

export const expenseAudiences=['FAMILIA','INDIVIDUAL','NAO_INFORMADO'] as const;
export const expenseNatures=['ESSENCIAL','OPCIONAL','NAO_CLASSIFICADO'] as const;
export type ExpenseAudience=typeof expenseAudiences[number];
export type ExpenseNature=typeof expenseNatures[number];
export const audienceLabel=(value?:string)=>value==='FAMILIA'?'Família':value==='INDIVIDUAL'?'Individual':'Não informado';
export const natureLabel=(value?:string)=>value==='ESSENCIAL'?'Essencial':value==='OPCIONAL'?'Opcional':'Não classificado';
// Preserve explicit classifications; uncertain purchases remain unclassified.
export function expenseContext(text:string,category:string){
 const source=expenseFold(text);
 const audience:ExpenseAudience=/\b(familia|filha|filho|filhos|esposa|marido|gisela)\b/.test(source)?'FAMILIA':'NAO_INFORMADO';
 const nature:ExpenseNature=/\b(superfluo|superfluos|opcional|opcionais)\b/.test(source)||['Lazer','Viagem / hospedagem','Assinaturas'].includes(category)?'OPCIONAL':/\b(essencial|necessario|necessarios)\b/.test(source)||['Escola / educação','Plano de saúde','Saúde / medicamentos','Aluguel / moradia','Condomínio','Água','Energia elétrica','Gás','Supermercado'].includes(category)?'ESSENCIAL':'NAO_CLASSIFICADO';
 return {expense_audience:audience,expense_nature:nature};
}
export function expenseStatusQuestion(text:string){return /\b(?:voce\s+|ja\s+)?(?:lancou|registrou|salvou)\b|\b(?:foi|esta|ficou)\s+(?:lancad[oa]|registrad[oa]|salv[oa])\b/.test(expenseFold(text));}
