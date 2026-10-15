import './bank.css';
import './voice.css';
import './ia-theme.css';
import './preferences.css';
import './login-password.css';
import './platform.css';
import type {Metadata, Viewport} from 'next';
const iconBase = '/experiencia-icom/ia-bank-icons';
export const metadata: Metadata = {
  title: 'IA Bank · Empresa e vida pessoal',
  description: 'Controle da empresa, despesas pessoais, rendas e patrimônio.',
  applicationName: 'IA Bank Automotive',
  manifest: '/experiencia-icom/ia-bank.webmanifest',
  appleWebApp: { capable: true, title: 'IA Bank', statusBarStyle: 'default' },
  icons: {
    icon: [
      { url: iconBase + '/crest-32.png', sizes: '32x32', type: 'image/png' },
      { url: iconBase + '/crest-192.png', sizes: '192x192', type: 'image/png' },
    ],
    shortcut: iconBase + '/crest-192.png',
    apple: [{ url: iconBase + '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
};
export const viewport: Viewport = { themeColor: '#092039' };
export default function BankLayout({children}:{children:React.ReactNode}){return children;}
