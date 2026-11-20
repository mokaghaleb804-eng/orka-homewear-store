import {initializeApp} from 'firebase/app';
import {getAuth,connectAuthEmulator,signInAnonymously,signInWithCredential,GoogleAuthProvider,signOut,onAuthStateChanged,setPersistence,browserSessionPersistence} from 'firebase/auth';
import {initializeAppCheck,CustomProvider} from 'firebase/app-check';
import {quoteOrkaCheckoutOrder,createOrkaCheckoutOrder} from '../../checkout/secure-checkout-client.js';
import {updateOrkaOrderStatus,allowedOrkaOrderActions} from '../../checkout/admin-status-client.js';
const app=initializeApp({projectId:'demo-orka-checkout',apiKey:'demo-key',appId:'demo-orka-app',authDomain:'localhost'},'orka-emulator-preview');
const auth=getAuth(app);connectAuthEmulator(auth,location.origin,{disableWarnings:true});await setPersistence(auth,browserSessionPersistence);
// Unsigned token is recognized ONLY by the official Functions emulator. Never valid live.
const encoded=v=>btoa(JSON.stringify(v)).replaceAll('=','').replaceAll('+','-').replaceAll('/','_');
initializeAppCheck(app,{provider:new CustomProvider({getToken:async()=>({token:encoded({alg:'none',typ:'JWT'})+'.'+encoded({sub:'demo-orka-app',iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+3600})+'.',expireTimeMillis:Date.now()+3600000})})});
const $=id=>document.getElementById(id);let currentQuote=null,mode='registered',busy=false;
const status=t=>{$('status').textContent=t;};
const customer=()=>({name:$('customer').value,phone:$('phone').value,gov:$('gov').value,address:$('address').value});
const cart=()=>[{productId:'TEST-001',size:$('size').value,qty:Number($('qty').value)}];
function invalidate(){currentQuote=null;$('confirm').disabled=true;$('quote').classList.add('hidden');$('receipt').textContent='';}
async function run(fn){if(busy)return;busy=true;try{await fn();}catch(e){status(e.message||'تعذر إكمال الاختبار');}finally{busy=false;}}
async function google(admin=false){await signOut(auth);await signInWithCredential(auth,GoogleAuthProvider.credential(JSON.stringify({sub:admin?'preview-admin-google':'preview-google',email:admin?'admin@example.invalid':'customer@example.invalid',name:admin?'مدير تجريبي':'عميل Google تجريبي'})));mode='registered';}
$('google').onclick=()=>run(()=>google());$('admin').onclick=()=>run(async()=>{await google(true);$('adminPanel').classList.remove('hidden');await loadOrders();});
$('guest').onclick=()=>run(async()=>{await signOut(auth);await signInAnonymously(auth);mode='guest';});$('logout').onclick=()=>run(()=>signOut(auth));
onAuthStateChanged(auth,user=>{invalidate();$('adminPanel').classList.add('hidden');$('orders').textContent='';mode=user?.isAnonymous?'guest':'registered';$('identity').textContent=user?(user.isAnonymous?'ضيف تجريبي':'حساب تجريبي مسجل'):'لم تبدأ جلسة';status(user?'الجلسة جاهزة للاختبار':'اختار حسابًا تجريبيًا أو ضيفًا');});
$('form').addEventListener('input',invalidate);
$('form').onsubmit=e=>{e.preventDefault();run(async()=>{
 if(!auth.currentUser)throw Error('اختار جلسة الاختبار أولًا');
 const quote=await quoteOrkaCheckoutOrder(app,mode,customer(),cart());
 if(quote.receipt){$('receipt').textContent='الطلب محفوظ بالفعل: '+quote.receipt.orderId;status('نفس المحاولة أعادت نفس الطلب');return;}
 currentQuote=quote;$('quote').textContent='المنتجات: '+quote.subtotalEGP+' ج · الشحن: '+quote.shippingEGP+' ج · الإجمالي: '+quote.totalEGP+' ج. التجهيز 3–5 أيام قبل وقت شركة الشحن. كل القيم تجريبية.';
 $('quote').classList.remove('hidden');$('confirm').disabled=false;status('راجع الإجمالي قبل التأكيد');
});};
$('confirm').onclick=()=>run(async()=>{if(!currentQuote)throw Error('راجع الإجمالي أولًا');const r=await createOrkaCheckoutOrder(app,mode,customer(),cart(),currentQuote.quoteId);$('receipt').textContent='تم تسجيل طلب تجريبي #'+r.orderId+' — '+r.totalEGP+' ج';$('confirm').disabled=true;status('نجح التسجيل في المحاكي فقط، دون نقاط ولاء');});
const decode=v=>v.stringValue??(v.integerValue!==undefined?Number(v.integerValue):v.booleanValue??(v.mapValue?Object.fromEntries(Object.entries(v.mapValue.fields||{}).map(([k,v])=>[k,decode(v)])):v.arrayValue?(v.arrayValue.values||[]).map(decode):null));
async function loadOrders(){
 const token=await auth.currentUser.getIdToken();
 const r=await fetch('/__firestore/v1/projects/demo-orka-checkout/databases/(default)/documents/orders',{headers:{Authorization:'Bearer '+token}});const body=await r.json();if(!r.ok)throw Error('لا توجد صلاحية قراءة الطلبات');
 $('orders').textContent='';
 for(const d of body.documents||[]){const o=Object.fromEntries(Object.entries(d.fields||{}).map(([k,v])=>[k,decode(v)]));o.id=d.name.split('/').at(-1);const row=document.createElement('article'),heading=document.createElement('p');heading.textContent=o.customer+' · '+o.totalEGP+' ج · الحالة: '+o.status;row.append(heading);
 for(const next of allowedOrkaOrderActions(o.status)){const b=document.createElement('button');b.textContent={preparing:'قيد التجهيز',shipped:'تم الشحن',delivered:'تم التسليم',cancelled:'إلغاء الطلب'}[next];b.onclick=()=>run(async()=>{const reason=next==='cancelled'?prompt('سبب إلغاء تجريبي من 5 إلى 200 حرف'):'';if(reason===null)return;await updateOrkaOrderStatus(app,o,next,reason);await loadOrders();status('تم تحديث الحالة في المحاكي فقط؛ لا نقاط ولاء');});row.append(b,document.createTextNode(' '));}
 $('orders').append(row);}
 if(!$('orders').children.length)$('orders').textContent='لا توجد طلبات تجريبية بعد';
}
$('refresh').onclick=()=>run(loadOrders);
