// Pure HTTP adapter for ORKA's trusted checkout service. NOT a deployed endpoint.
// The caller must supply verified server-side checkout; never expose test adapters publicly.
const MAX_BYTES=16*1024;
const response=(status,body)=>({status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'},body:JSON.stringify(body)});
const allowed=new Set(['AUTH_REQUIRED','AUTH_INVALID','INVALID_REQUEST_KEY','KEY_REUSED','INVALID_CHECKOUT','INVALID_ITEMS','INVALID_PHONE','INVALID_ADDRESS','INVALID_NAME','INVALID_SIZE','INVALID_QUANTITY','PRODUCT_UNAVAILABLE','UNAVAILABLE_PRODUCT','INVALID_PRODUCT','UNPRICED_PRODUCT','CATALOG_UNAVAILABLE','TOTAL_OVERFLOW','INVALID_IDENTITY','OUT_OF_STOCK']);
export function createCheckoutHttpHandler({submitOrder}){
 if(typeof submitOrder!=='function')throw Error('Trusted submitOrder required');
 return async function handle({method,headers={},body}={}){
  if(method!=='POST')return response(405,{error:'METHOD_NOT_ALLOWED'});
  const type=String(headers['content-type']??headers['Content-Type']??'').toLowerCase();
  if(!/^application\/json(?:\s*;|\s*$)/.test(type))return response(415,{error:'UNSUPPORTED_MEDIA_TYPE'});
  if(typeof body!=='string'||Buffer.byteLength(body,'utf8')>MAX_BYTES)return response(413,{error:'PAYLOAD_TOO_LARGE'});
  let data;
  try{data=JSON.parse(body);}catch{return response(400,{error:'INVALID_JSON'});}
  if(!data||typeof data!=='object'||Array.isArray(data))return response(400,{error:'INVALID_JSON'});
  const authorization=headers.authorization??headers.Authorization??'';
  const match=/^Bearer ([^\s]+)$/.exec(authorization);
  if(!match)return response(401,{error:'AUTH_REQUIRED'});
  if(typeof data.requestKey!=='string'||!/^[A-Za-z0-9_-]{16,128}$/.test(data.requestKey))return response(400,{error:'INVALID_REQUEST_KEY'});
  if(!data.checkout||typeof data.checkout!=='object'||Array.isArray(data.checkout))return response(400,{error:'INVALID_CHECKOUT'});
  try{
   const result=await submitOrder({idToken:match[1],requestKey:data.requestKey,checkout:data.checkout});
   return response(result.created?201:200,{orderId:result.orderId,created:result.created,status:result.order?.status??'pending'});
  }catch(err){
   const code=allowed.has(err?.code)?err.code:'INTERNAL_ERROR';
   const status=code==='AUTH_REQUIRED'||code==='AUTH_INVALID'?401:code==='KEY_REUSED'?409:code==='CATALOG_UNAVAILABLE'||code==='TOTAL_OVERFLOW'||code==='INTERNAL_ERROR'?500:400;
   return response(status,{error:code});
  }
 };
}
