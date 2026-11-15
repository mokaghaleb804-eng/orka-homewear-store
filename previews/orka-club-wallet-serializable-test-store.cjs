'use strict';
// Test-only serializable adapter with an asynchronous transaction queue.
// This models atomicity in one process, NOT durable multi-instance Firestore transactions.
function createSerializableTestStore(){
 const credits=new Map(),operations=new Map();
 let queue=Promise.resolve();
 function transaction(fn){
  const execute=async()=>{
   const nextCredits=new Map([...credits].map(([k,v])=>[k,v.map(x=>({...x}))]));
   const nextOps=new Map([...operations].map(([k,v])=>[k,structuredClone(v)]));
   const tx={
    operation:key=>nextOps.get(key),
    putOperation:(key,val)=>nextOps.set(key,structuredClone(val)),
    putCredit:(uid,credit)=>nextCredits.set(uid,[...(nextCredits.get(uid)||[]),{...credit}]),
    credits:uid=>(nextCredits.get(uid)||[]).map(x=>({...x})),
    replaceCredits:(uid,list)=>nextCredits.set(uid,list.map(x=>({...x})))
   };
   const result=await fn(tx);
   credits.clear();for(const [k,v] of nextCredits)credits.set(k,v);
   operations.clear();for(const [k,v] of nextOps)operations.set(k,v);
   return result;
  };
  const running=queue.then(execute);
  queue=running.then(()=>undefined,()=>undefined);
  return running;
 }
 return {transaction,snapshot:uid=>(credits.get(uid)||[]).map(x=>({...x})),operation:key=>operations.get(key)};
}
module.exports={createSerializableTestStore};
