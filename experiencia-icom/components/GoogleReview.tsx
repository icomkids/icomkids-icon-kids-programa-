'use client';
import {useState} from 'react';

export default function GoogleReview({url}:{url:string}) {
 const [text,setText]=useState(''),[status,setStatus]=useState('');
 async function copy() {
  try { await navigator.clipboard.writeText(text.trim()); setStatus('Texto copiado. No Google, escolha as estrelas, cole seu texto e toque em Postar.'); }
  catch { setStatus('Não foi possível copiar automaticamente. Selecione e copie o texto abaixo, depois cole no Google.'); }
 }
 return <section className="google-review" aria-labelledby="google-review-title">
  <p className="eyebrow">AVALIAÇÃO PÚBLICA · OPCIONAL</p>
  <h2 id="google-review-title">Sua experiência pode ajudar outras pessoas.</h2>
  <p>Se desejar, conte com suas próprias palavras como foi sua experiência na ICOM Motors. Um relato sincero e claro ajuda quem está escolhendo onde comprar.</p>
  <div className="google-public-notice"><strong>O que vai aparecer no Google?</strong><p>Somente o texto que você decidir publicar no Google, junto às estrelas escolhidas e ao nome do seu perfil. Sua pesquisa interna continua confidencial e não é publicada automaticamente.</p></div>
  <label htmlFor="google-review-text">Prepare seu texto para o Google<textarea id="google-review-text" maxLength={4000} value={text} onChange={e=>{setText(e.target.value);setStatus('')}} placeholder="Escreva aqui seu relato sincero…"/></label>
  <p className="google-review-help">Revise antes de publicar. Evite incluir telefone, placa ou outros dados pessoais. A publicação só acontece quando você confirmar no Google, usando sua conta.</p>
  <a className="primary" href={url} target="_blank" rel="noopener noreferrer" onClick={()=>{if(text.trim())void copy()}}>{text.trim()?'COPIAR MEU TEXTO E ABRIR O GOOGLE':'ABRIR A AVALIAÇÃO NO GOOGLE'}</a>
  <p className="google-review-help">No Google: escolha suas estrelas, cole ou escreva seu relato e toque em <strong>Postar</strong>.</p>
  {status&&<p role="status" className="notice">{status}</p>}
 </section>
}
