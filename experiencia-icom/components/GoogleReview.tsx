'use client';
import {useState} from 'react';

export default function GoogleReview({url}:{url:string}) {
 const [text,setText]=useState(''),[status,setStatus]=useState('');
 async function copy() {
  try { await navigator.clipboard.writeText(text.trim()); setStatus('Texto copiado. No Google, escolha as estrelas, cole seu texto e toque em Postar.'); }
  catch { setStatus('Não foi possível copiar automaticamente. Selecione e copie o texto abaixo, depois cole no Google.'); }
 }
 return <section className="google-review" aria-labelledby="google-review-title">
  <p className="eyebrow">PRIMEIRO, SUA AVALIAÇÃO NO GOOGLE</p>
  <h2 id="google-review-title">Sua avaliação faz toda a diferença para nós.</h2>
  <p>Nos ajude a contar essa história! Sua avaliação no Google ajuda outras pessoas a escolher com confiança e valoriza o cuidado da nossa equipe em cada atendimento.</p>
  <p><strong>Conte como foi sua compra e mencione o nome do seu vendedor.</strong> Para quem acompanhou você nessa conquista, seu reconhecimento tem um valor especial.</p>
  <a className="primary" href={url} target="_blank" rel="noopener noreferrer" onClick={()=>{if(text.trim())void copy()}}>{text.trim()?'COPIAR MEU TEXTO E AVALIAR NO GOOGLE':'AVALIAR A ICOM NO GOOGLE'}</a>
  <p className="google-review-help">No Google, escolha suas estrelas, escreva ou cole seu relato e toque em <strong>Postar</strong>. Depois, volte a esta aba para continuar sua experiência.</p>
  <details style={{margin:'20px 0'}}>
   <summary>Quer preparar seu comentário antes de abrir o Google?</summary>
   <label htmlFor="google-review-text">Seu relato, com suas palavras<textarea id="google-review-text" maxLength={4000} value={text} onChange={e=>{setText(e.target.value);setStatus('')}} placeholder="Como foi sua compra? Quem foi seu vendedor? O que você gostaria de contar sobre o atendimento?"/></label>
   <p className="google-review-help">Revise antes de publicar. Evite incluir telefone, placa ou outros dados pessoais.</p>
  </details>
  <p className="google-review-help">A avaliação no Google é opcional. Obrigado por dedicar esse momento à Icom!</p>
  <details><summary>O que fica público e o que é confidencial?</summary><div className="google-public-notice"><strong>Seu relato é público. Sua pesquisa é confidencial.</strong><p>Apenas o que você confirmar no Google será publicado, com as estrelas escolhidas e o nome do seu perfil. As respostas das próximas perguntas ficam somente com a Icom.</p></div></details>
  {status&&<p role="status" className="notice">{status}</p>}
 </section>
}
