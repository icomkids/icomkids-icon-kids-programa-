export function scheduledDate(raw:unknown,now=Date.now()):string|null {
 if(raw===undefined||raw===null||raw==='')return null;
 if(typeof raw!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(raw))throw new Error('Informe uma data e hora válidas para o envio.');
 const value=Date.parse(raw);if(!Number.isFinite(value)||value<=now||value>now+30*86400000)throw new Error('Agende para uma data futura, nos próximos 30 dias.');return new Date(value).toISOString();
}
