'use client';
import {useBranding} from './Branding';
import {useState} from 'react';

export default function GoogleReview({url}:{url:string}) {
 const {text}=useBranding();
 const [reviewText,setText]=useState(''),[status,setStatus]=useState(''),[busy,setBusy]=useState(false),[fallback,setFallback]=useState(false);
 async function copyAndOpen() {
  const review=reviewText.trim();if(!review||busy)return;
  setBusy(true);setStatus('');setFallback(false);
  // Start copying while this page still has focus, then reserve the destination tab.
  let copyRequest:Promise<void>;
  try{copyRequest=navigator.clipboard.writeText(review)}catch{setStatus('Não foi possível copiar automaticamente. Selecione e copie seu relato no campo acima. Depois, use o link abaixo para abrir o Google.');setFallback(true);setBusy(false);return;}
  // Reserve the new tab during the click, before awaiting the clipboard permission.
  let reviewWindow:Window|null=null;
  try{reviewWindow=window.open('about:blank','_blank');if(reviewWindow){reviewWindow.opener=null;reviewWindow.document.title='Abrindo avaliação no Google…';const meta=reviewWindow.document.createElement('meta');meta.name='referrer';meta.content='no-referrer';reviewWindow.document.head.appendChild(meta)}}catch{}
  try{
   try{await copyRequest}catch{reviewWindow?.close();setStatus('Não foi possível copiar automaticamente. Selecione e copie seu relato no campo acima. Depois, use o link abaixo para abrir o Google.');setFallback(true);return;}
   if(reviewWindow&&!reviewWindow.closed){try{reviewWindow.location.replace(url);setStatus('Relato copiado! No Google, escolha suas estrelas, cole o texto e toque em Postar.');return}catch{reviewWindow.close()}}
   setStatus('Relato copiado! Use o link abaixo para abrir o Google, colar o texto e publicar sua avaliação.');setFallback(true);
  }finally{setBusy(false)}
 }
 return <section className="google-review" aria-labelledby="google-review-title">
  <p className="eyebrow">PRIMEIRO, SUA AVALIAÇÃO NO GOOGLE</p>
  <h2 id="google-review-title">Sua avaliação faz toda a diferença para nós.</h2>
  <p>Nos ajude a contar essa história! Sua avaliação no Google ajuda outras pessoas a escolher com confiança e valoriza o cuidado da nossa equipe em cada atendimento.</p>
  <p><strong>Conte como foi sua compra e mencione o nome do seu vendedor.</strong> Para quem acompanhou você nessa conquista, seu reconhecimento tem um valor especial.</p>
  <div className="google-review-compose">
   <label htmlFor="google-review-text">Escreva aqui sua avaliação para o Google</label>
   <p id="google-review-instructions" className="google-review-help">Conte com suas palavras como foi sua experiência. Ao clicar no botão, seu relato será copiado e o Google abrirá em outra aba.</p>
   <textarea id="google-review-text" aria-describedby="google-review-instructions" maxLength={4000} value={reviewText} disabled={busy} onChange={e=>{setText(e.target.value);setStatus('');setFallback(false)}} placeholder="Como foi sua compra? Quem foi seu vendedor? O que você gostaria de contar sobre o atendimento?"/>
   <button type="button" className="primary" disabled={!reviewText.trim()||busy} onClick={()=>void copyAndOpen()}>{busy?'COPIANDO SEU RELATO…':'COPIAR RELATO E ABRIR O GOOGLE'}</button>
   {status&&<p role="status" className="google-review-status">{status}</p>}
   {fallback&&<a className="google-review-fallback" href={url} target="_blank" rel="noopener noreferrer">Abrir o Google para colar meu relato</a>}
   <p className="google-review-help">No Google, escolha suas estrelas, <strong>cole seu relato</strong> e toque em <strong>Postar</strong>. Depois, volte a esta aba para continuar sua experiência.</p>
  </div>
  <p className="google-review-help">{text("A avaliação no Google é opcional. Obrigado por dedicar esse momento à Icom!")}</p>
  <details><summary>O que fica público e o que é confidencial?</summary><div className="google-public-notice"><strong>Seu relato é público. Sua pesquisa é confidencial.</strong><p>{text("Apenas o que você confirmar no Google será publicado, com as estrelas escolhidas e o nome do seu perfil. As respostas das próximas perguntas ficam somente com a Icom.")}</p></div></details>
 </section>
}
