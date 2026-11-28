// Mount only in an authenticated admin preview; server enforces authorization.
export function mountShippingPanel(root,saveShipping) {
  const regions=["القاهرة","الجيزة","الإسكندرية","القليوبية","الشرقية","الغربية","المنوفية","الدقهلية","البحيرة","كفر الشيخ","دمياط","بورسعيد","الإسماعيلية","السويس","الفيوم","بني سويف","المنيا","أسيوط","سوهاج","قنا","الأقصر","أسوان","البحر الأحمر","الوادي الجديد","مطروح","شمال سيناء","جنوب سيناء"];
  const form=document.createElement('form');
  form.dir='rtl';
  form.innerHTML='<h2>إعدادات الشحن</h2><label>المحافظة <select name="gov" required></select></label><label>تكلفة الشحن <input name="carrier" type="number" min="0" max="10000" step="1" required></label><label>دعم ORKA <input name="subsidy" type="number" min="0" max="10000" step="1" value="0" required></label><p>على العميل: <output></output></p><button type="submit">حفظ مسودة الشحن</button><p role="status" aria-live="polite"></p>';
  const {gov,carrier,subsidy}=form.elements;
  for(const region of regions) gov.add(new Option(region,region));
  const output=form.querySelector('output'),status=form.querySelector('[role=status]'),button=form.querySelector('button');
  const amounts=()=>({carrierEGP:carrier.valueAsNumber,subsidyEGP:subsidy.valueAsNumber});
  function refresh(){const {carrierEGP,subsidyEGP}=amounts();const valid=Number.isSafeInteger(carrierEGP)&&Number.isSafeInteger(subsidyEGP)&&carrierEGP>=subsidyEGP&&subsidyEGP>=0&&carrierEGP<=10000;output.textContent=valid?(carrierEGP-subsidyEGP)+' جنيه':'راجع المبالغ';return valid;}
  form.addEventListener('input',refresh);
  form.addEventListener('submit',async e=>{e.preventDefault();if(button.disabled||!refresh()||!form.reportValidity())return;button.disabled=true;status.textContent='جاري الحفظ';try{await saveShipping({gov:gov.value,...amounts()});status.textContent='تم حفظ المسودة؛ يلزم اعتماد الشحن قبل الإطلاق.';}catch{status.textContent='تعذر الحفظ. راجع الصلاحيات وحالة الطلبات.';}finally{button.disabled=false;}});
  root.replaceChildren(form);refresh();
  return ()=>form.remove();
}
