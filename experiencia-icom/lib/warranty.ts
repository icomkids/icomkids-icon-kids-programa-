export const WARRANTY_TEXT=`Garantia legal do veículo

O Código de Defesa do Consumidor prevê 90 dias para reclamar de vícios aparentes ou de fácil constatação em produtos duráveis, a partir da entrega efetiva. Para vícios ocultos, o prazo começa quando o problema se torna evidente (art. 26).

A garantia legal independe de documento específico e não pode ser afastada por contrato (art. 24). Em veículo vendido por fornecedor, ela não se limita apenas ao motor e ao câmbio. Desgaste natural, conservação e eventual uso inadequado precisam ser avaliados no caso concreto; não existe exclusão automática de toda uma peça ou sistema.

Em regra, não sendo sanado o vício em até 30 dias, o consumidor pode escolher as alternativas previstas no art. 18, observadas as hipóteses e exceções legais. Uma garantia contratual adicional deve constar de termo escrito e complementa a legal (art. 50).

Ao perceber um problema, comunique a Icom, descreva os sintomas e guarde os registros. Em situação que comprometa a segurança, interrompa o uso do veículo.

Sua confirmação registra o acesso às orientações. Ela não limita a garantia, não impede reclamações futuras e não representa renúncia aos direitos previstos no CDC.`;
export const WARRANTY_SOURCE='https://www.planalto.gov.br/ccivil_03/leis/l8078compilado.htm';
export const WARRANTY_PROCON='https://www.procon.sp.gov.br/consumidor/';
export type WarrantyConfig={id:number;version:string;legal_text:string;extra_text:string;video_url:string;video_seconds:number};
export type WarrantySession={id:string;version:string;video_url:string;video_seconds:number;legal_text:string;extra_text:string;watched_seconds:number;acknowledged_at:string|null;outcome:'understood'|'questions'|null};
export function warrantySettings(body:Record<string,unknown>){
 const video=String(body.video_url||'').trim(),seconds=Number(body.video_seconds||0),extra=String(body.extra_text||'').trim();
 if(extra.length>4000)throw new Error('As orientações adicionais devem ter até 4.000 caracteres.');
 if(video){let url;try{url=new URL(video)}catch{throw new Error('Informe um endereço HTTPS válido para o vídeo.')}if(url.protocol!=='https:'||url.username||url.password||!/\.mp4$/i.test(url.pathname)||!Number.isInteger(seconds)||seconds<10||seconds>1200)throw new Error('Use um link HTTPS direto para vídeo MP4 e duração de 10 a 1.200 segundos.');}
 return {p_video:video,p_seconds:video?seconds:0,p_extra:extra};
}
export const watchedEnough=(seconds:number,duration:number)=>duration<=0||seconds>=Math.max(0,duration-1);
