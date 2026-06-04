import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { startServerTimeSync } from '@/lib/server-time'

// Sincroniza o relogio com o servidor (corrige cronometros mesmo se o
// PC do operador estiver com a hora errada).
startServerTimeSync()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
