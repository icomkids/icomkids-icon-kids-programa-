'use client';
import {useState} from 'react';
import {Eye,EyeOff} from 'lucide-react';

export default function BankLoginPassword({disabled=false}:{disabled?:boolean}){
 const [visible,setVisible]=useState(false);
 return <div className="bank-login-password-field">
  <label htmlFor="bank-login-password">Senha</label>
  <div className="bank-login-password">
   <input id="bank-login-password" type={visible?'text':'password'} name="password" autoComplete="current-password" required disabled={disabled}/>
   <button type="button" className="bank-login-password-toggle" aria-label={visible?'Ocultar senha':'Mostrar senha'} title={visible?'Ocultar senha':'Mostrar senha'} aria-controls="bank-login-password" aria-pressed={visible} disabled={disabled} onClick={()=>setVisible(v=>!v)}>
    {visible?<EyeOff size={20} aria-hidden="true"/>:<Eye size={20} aria-hidden="true"/>}
   </button>
  </div>
 </div>;
}
