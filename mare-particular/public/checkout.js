export function createGuestCheckout({api,root,brand,escape,moneyExact,fmt,toast}){
  let current=null,refreshing=false;
  const storageKey='ap-house-select-booking';
  function remember(result){sessionStorage.setItem(storageKey,JSON.stringify({token:result.guestToken,code:result.code}));}
  function saved(){try{const value=JSON.parse(sessionStorage.getItem(storageKey)||'null');return value&&typeof value.token==='string'?value:null;}catch{return null;}}
  function view(data){
    const success=data.status==='confirmed'&&data.paymentStatus==='paid'&&!data.review;
    const closed=['cancelled','expired'].includes(data.status),heading=data.review?'Estamos conferindo seu pagamento.':success?'Sua estadia está confirmada.':closed?'Este pedido foi encerrado.':data.paymentStatus==='partial'?'Recebemos parte do pagamento.':'Sua próxima pausa está perto.';
    const message=data.review?'O pagamento foi identificado e precisa ser conferido pela proprietária antes da confirmação das datas.':success?'O pagamento foi confirmado. Guarde o código da reserva para acompanhar sua estadia.':closed?'Consulte a disponibilidade novamente antes de iniciar outro pagamento.':data.paymentsEnabled?'Escolha Pix ou cartão de crédito no ambiente seguro de pagamento. A reserva será confirmada depois que o pagamento for identificado.':'Seu pedido aguarda análise da proprietária. O pagamento online ainda não foi liberado.';
    return `<main class="checkout-page" id="main"><header>${brand()}<a href="/" class="text-btn">Voltar ao apartamento</a></header><section class="checkout-summary"><div class="eyebrow">AP House Select · Sua reserva</div>${data.mode==='sandbox'?'<p class="note">Ambiente de testes. Não use dados reais nem efetue transferências de dinheiro.</p>':''}<h1>${heading}</h1><p>${message}</p><div class="success-code">${escape(data.code)}</div><div class="detail-list"><div><span>Entrada</span><strong>${fmt(data.checkin,true)} ${data.checkin.slice(0,4)}</strong></div><div><span>Saída</span><strong>${fmt(data.checkout,true)} ${data.checkout.slice(0,4)}</strong></div><div><span>Total da reserva</span><strong>${moneyExact(data.total)}</strong></div><div><span>Pagamento confirmado</span><strong>${moneyExact(data.paid)}</strong></div>${!closed?`<div><span>Saldo a pagar</span><strong>${moneyExact(data.balance)}</strong></div>`:''}</div>${!success&&!closed&&!data.review&&data.paymentsEnabled&&data.balance>0?`<button id="checkout-start" class="btn full">Pagar com Pix ou cartão</button><p class="small muted">Pagamento único no valor de ${moneyExact(data.balance)}. O prazo do checkout é de 30 minutos.</p>`:''}<div class="checkout-actions"><button class="btn light" id="checkout-refresh">Atualizar situação</button><a class="text-btn" href="/">Ver apartamento</a></div><div id="checkout-error" role="alert"></div><p class="small muted">Esta página acompanha a confirmação do pagamento. O retorno do ambiente de pagamento, por si só, não confirma a reserva.</p></section></main>`;
  }
  async function refresh(){const booking=saved();if(!booking){root.innerHTML=`<main class="checkout-page" id="main"><header>${brand()}</header><section class="checkout-summary"><h1>Acompanhe sua reserva.</h1><p>Abra o acompanhamento no mesmo navegador em que iniciou a reserva. Se precisar de ajuda, informe à proprietária o código recebido.</p><a class="btn" href="/">Voltar ao apartamento</a></section></main>`;return;}
    current=await api('/api/booking','POST',{token:booking.token});root.innerHTML=view(current);
  }
  document.addEventListener('click',async e=>{const button=e.target.closest('#checkout-start,#checkout-refresh');if(!button)return;button.disabled=true;try{
    if(button.id==='checkout-refresh'){await refresh();return toast('Situação da reserva atualizada.');}
    const booking=saved(),result=await api('/api/checkout','POST',{token:booking?.token});
    if(result.paid)return refresh();
    const url=new URL(result.url);if(url.protocol!=='https:'||!['asaas.com','sandbox.asaas.com'].includes(url.hostname))throw new Error('O endereço de pagamento não pôde ser validado.');
    location.assign(url.href);
  }catch(error){const box=document.getElementById('checkout-error');if(box)box.innerHTML=`<p class="error-box">${escape(error.message)}</p>`;if(button.isConnected)button.disabled=false;}});
  setInterval(async()=>{if(location.pathname!=='/pagamento'||document.hidden||refreshing||!current||current.status==='cancelled'||current.review||current.paymentStatus==='paid')return;refreshing=true;try{await refresh();}catch{}finally{refreshing=false;}},15000);
  return {remember,refresh};
}
