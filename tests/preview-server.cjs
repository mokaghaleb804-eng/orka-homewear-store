// Local QA only: serves a synthetic store and proxies ONLY loopback demo emulators.
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const {spawn}=require('node:child_process');
const {build}=require('esbuild');
const root=path.resolve(__dirname,'..');
process.env.GCLOUD_PROJECT='demo-orka-checkout';
process.env.FIRESTORE_EMULATOR_HOST='127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST='127.0.0.1:9099';
async function main(){
  await build({entryPoints:[path.join(root,'tests/preview/main.js')],bundle:true,format:'esm',write:true,outfile:path.join(root,'.firebase/preview/main.js'),platform:'browser',plugins:[{name:'local-firebase-sdk',setup(b){b.onResolve({filter:/^https:\/\/www\.gstatic\.com\/firebasejs\/13\.0\.0\/firebase-(auth|functions)\.js$/},args=>b.resolve('firebase/'+args.path.match(/firebase-(auth|functions)\.js$/)[1],{resolveDir:root,kind:'import-statement'}));}}]});
  const child=spawn(process.execPath,[path.join(root,'node_modules/firebase-tools/lib/bin/firebase.js'),'emulators:start','--config','firebase.emulator.json','--project','demo-orka-checkout','--only','firestore,auth'],{cwd:root,env:{...process.env},stdio:['ignore','pipe','pipe']});
  const callable=spawn(process.execPath,[path.join(root,'tests/callable-harness.cjs')],{cwd:root,env:{...process.env},stdio:['ignore','pipe','pipe']});
  callable.stdout.on('data',b=>process.stdout.write(b));callable.stderr.on('data',b=>process.stderr.write(b));
  child.stdout.on('data',b=>process.stdout.write(b));child.stderr.on('data',b=>process.stderr.write(b));
  let ready=false;
  const server=http.createServer((req,res)=>{
    const route=new URL(req.url,'http://localhost').pathname;
    const proxy=route.startsWith('/__functions/')?{port:5001,path:req.url.replace('/__functions/','/demo-orka-checkout/me-central1/')}:
      route.startsWith('/__auth/')?{port:9099,path:req.url.replace('/__auth/','/')}:(route.startsWith('/identitytoolkit.googleapis.com/') || route.startsWith('/securetoken.googleapis.com/'))?{port:9099,path:req.url}:
      route.startsWith('/__firestore/')?{port:8080,path:req.url.replace('/__firestore/','/')}:null;
    if(proxy){
      if(!ready){res.writeHead(503);res.end('Emulators starting');return;}
      const upstream=http.request({hostname:'127.0.0.1',port:proxy.port,path:proxy.path,method:req.method,headers:{...req.headers,host:'127.0.0.1:'+proxy.port}},r=>{res.writeHead(r.statusCode,r.headers);r.pipe(res);});
      upstream.on('error',()=>{res.writeHead(502);res.end('Emulator unavailable');});req.pipe(upstream);return;
    }
    if(route==='/health'){res.writeHead(ready?200:503);res.end(ready?'ready':'starting');return;}
    if(route==='/' || route==='/index.html'){res.setHeader('Content-Type','text/html; charset=utf-8');res.end(fs.readFileSync(path.join(__dirname,'preview/index.html')));return;}
    if(route==='/main.js'){res.setHeader('Content-Type','text/javascript');res.end(fs.readFileSync(path.join(root,'.firebase/preview/main.js')));return;}
    res.writeHead(404);res.end('Not found');
  });
  const portIndex=process.argv.indexOf('--port');
  server.listen(Number(process.env.PORT||(portIndex>=0?process.argv[portIndex+1]:3000)),'0.0.0.0');
  for(let i=0;i<120;i++){
    try {
      const r=await fetch('http://127.0.0.1:5001/health');
      if(r.status!==404 && r.status!==503){
        const functionRequire=require('node:module').createRequire(path.join(root,'functions/package.json'));
        const {initializeApp}=functionRequire('firebase-admin/app');const {getFirestore}=functionRequire('firebase-admin/firestore');
        initializeApp({projectId:'demo-orka-checkout'});const db=getFirestore();
        const auth=await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=demo-key',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({requestUri:'http://localhost',returnSecureToken:true,postBody:new URLSearchParams({providerId:'google.com',id_token:JSON.stringify({sub:'preview-admin-google',email:'admin@example.invalid',name:'مدير تجريبي'})}).toString()})}).then(r=>r.json());
        if(!auth.localId)throw Error('Cannot seed demo admin');
        await db.doc('admins/'+auth.localId).set({role:'admin'});
        await db.doc('storeSettings/checkout').set({enabled:true,paymentMethod:'cod',catalogApproved:true,shippingApproved:true,abuseControlsApproved:true,shippingEGPByGovernorate:{'القاهرة':45,'الجيزة':50}});
        await db.doc('catalog/TEST-001').set({active:true,priceEGP:250,name:'طقم تجريبي — ليس للبيع',sizes:['6','8'],inventoryMode:'made-to-order',maxPerOrder:3});
        ready=true;console.log('Synthetic demo is ready. No production connections.');break;
      }
    }catch{}
    await new Promise(r=>setTimeout(r,1000));
  }
  if(!ready){child.kill();callable.kill();server.close();throw Error('Demo emulators did not start');}
  const stop=()=>{child.kill('SIGINT');callable.kill();server.close();setTimeout(()=>process.exit(0),1000).unref();};
  process.on('SIGTERM',stop);process.on('SIGINT',stop);
}
main().catch(e=>{console.error(e.message);process.exit(1)});
