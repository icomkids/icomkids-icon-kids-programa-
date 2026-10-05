'use client';
import {useState} from 'react';
export default function BankPixCopy({value}:{value:string}){const [message,setMessage]=useState('');return <><button onClick={async()=>{try{await navigator.clipboard.writeText(value);setMessage('Chave Pix copiada.');}catch{setMessage('Selecione a chave e copie manualmente.');}}}>Copiar chave Pix</button>{message&&<p role="status">{message}</p>}</>;}
