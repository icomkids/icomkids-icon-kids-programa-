export function report(data,period='all',today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())) {
  const rows=data.reservations.filter(r=>period==='all'||r.checkin.startsWith(period));
  const confirmed=rows.filter(r=>r.status==='confirmed');
  const entries=data.payments.filter(e=>period==='all'||e.occurred_on.startsWith(period));
  const received=entries.filter(e=>e.type==='payment').reduce((s,e)=>s+e.amount,0),refunded=entries.filter(e=>e.type==='refund').reduce((s,e)=>s+e.amount,0);
  const month=period==='all'?today.slice(0,7):period,monthDays=new Date(Date.UTC(Number(month.slice(0,4)),Number(month.slice(5,7)),0)).getUTCDate();
  let occupied=0;
  for(let i=1;i<=monthDays;i++){const day=`${month}-${String(i).padStart(2,'0')}`;if(data.reservations.some(r=>r.status==='confirmed'&&r.checkin<=day&&r.checkout>day))occupied++;}
  return {rows,confirmed:confirmed.length,pending:rows.filter(r=>r.status==='pending').length,cancelled:rows.filter(r=>r.status==='cancelled').length,expired:rows.filter(r=>r.status==='expired').length,guests:confirmed.reduce((s,r)=>s+r.guests,0),nights:confirmed.reduce((s,r)=>s+r.nights,0),forecast:confirmed.reduce((s,r)=>s+r.total,0),balance:confirmed.reduce((s,r)=>s+r.payment.balance,0),paid:confirmed.filter(r=>r.payment.status==='paid').length,partial:confirmed.filter(r=>r.payment.status==='partial').length,unpaid:confirmed.filter(r=>r.payment.status==='unpaid').length,refundDue:rows.reduce((s,r)=>s+r.payment.refundDue,0),received,refunded,net:received-refunded,occupied,occupancy:Math.round(occupied/monthDays*100),occupancyMonth:month};
}
