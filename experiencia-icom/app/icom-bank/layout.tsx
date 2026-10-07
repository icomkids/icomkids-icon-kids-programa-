import './bank.css';
import './voice.css';
import type {Metadata} from 'next';
export const metadata:Metadata={title:'ICOM Bank · Controle Financeiro',description:'Controle interno de vendas parceladas de veículos.'};
export default function BankLayout({children}:{children:React.ReactNode}){return children;}
