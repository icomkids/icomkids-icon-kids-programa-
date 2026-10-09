import {isWhatsAppEntry} from '@/lib/icom-bank/entry-origin';
export default function BankEntryOrigin({entry}:{entry:{details?:{notes?:string}}}){
 if(!isWhatsAppEntry(entry))return null;
 return <span className="bank-whatsapp-origin" title="Lançamento enviado pelo WhatsApp"><svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"><path d="M20.5 11.6a8.5 8.5 0 0 1-12.6 7.5L3 20.5l1.4-4.7A8.5 8.5 0 1 1 20.5 11.6Z"/><path d="m8.4 7.2-1 1.3c-.3.5.3 2.4 2.4 4.5s4 2.7 4.5 2.4l1.3-1-2.1-1.5-.9.8c-1.3-.6-2.4-1.7-3-3l.8-.9-1.5-2.6Z"/></svg>WhatsApp</span>;
}
