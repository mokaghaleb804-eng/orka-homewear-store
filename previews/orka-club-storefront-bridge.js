// ORKA CLUB storefront integration — preview only, no writes, no live checkout.
// Enabled only with ?orkaClubPreview=1 on the branch preview deployment.
(()=>{
 if(new URLSearchParams(location.search).get('orkaClubPreview')!=='1')return;
 const banner=document.createElement('aside');
 banner.id='orka-club-preview-bridge';
 banner.setAttribute('role','status');
 Object.assign(banner.style,{position:'fixed',bottom:'12px',left:'12px',right:'12px',zIndex:'99999',background:'#10294A',color:'#FFFAF1',padding:'14px',borderRadius:'12px',fontFamily:'Arial,sans-serif',boxShadow:'0 5px 20px #0004',maxWidth:'440px'});
 const title=document.createElement('strong');title.textContent='ORKA CLUB — معاينة الربط فقط';
 const details=document.createElement('p');details.style.margin='8px 0';details.textContent='الطلبات والرصيد الحقيقي غير مفعّلين. الأسعار المعروضة بالموقع ليست أسعارًا معتمدة للولاء.';
 const count=document.createElement('p');count.style.margin='8px 0';
 const refresh=document.createElement('button');refresh.type='button';refresh.textContent='مراجعة السلة';refresh.style.cssText='padding:8px;border-radius:6px;border:0;cursor:pointer';
 const close=document.createElement('button');close.type='button';close.textContent='إغلاق';close.style.cssText='padding:8px;margin-inline-start:8px;border-radius:6px;border:0;cursor:pointer';
 function update(){
  let items=[];
  try{const parsed=JSON.parse(localStorage.getItem('orka-cart')||'[]');if(Array.isArray(parsed))items=parsed}catch{}
  const qty=items.reduce((n,item)=>n+(Number.isSafeInteger(item?.qty)&&item.qty>0?item.qty:0),0);
  count.textContent='عدد القطع في السلة: '+qty+' — لا يتم إرسال أي بيانات.';
 }
 refresh.addEventListener('click',update);close.addEventListener('click',()=>banner.remove());
 banner.append(title,details,count,refresh,close);document.body.append(banner);update();
})();
