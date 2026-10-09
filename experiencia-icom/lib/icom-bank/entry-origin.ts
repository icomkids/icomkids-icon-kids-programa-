export function isWhatsAppEntry(entry:{details?:{notes?:string}}){
 // Existing records preserve channel provenance at the start of their notes.
 return /^Origem:\s*WhatsApp\b/i.test(entry.details?.notes?.trim()||'');
}
