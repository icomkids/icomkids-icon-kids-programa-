import './bank.css';
import './voice.css';
import './ia-theme.css';
import './preferences.css';
import './login-password.css';
import type {Metadata} from 'next';
export const metadata:Metadata={title:'IA Bank · Empresa e vida pessoal',description:'Controle da empresa, despesas pessoais, rendas e patrimônio.'};
export default function BankLayout({children}:{children:React.ReactNode}){return children;}
