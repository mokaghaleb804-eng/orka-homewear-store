// Loopback-only HTTP runner for the SAME onCall exports. Demo emulators required.
// Used where the official Functions emulator's Unix socket cannot be created.
if(process.env.GCLOUD_PROJECT!=='demo-orka-checkout' || process.env.FIRESTORE_EMULATOR_HOST!=='127.0.0.1:8080' || process.env.FIREBASE_AUTH_EMULATOR_HOST!=='127.0.0.1:9099') throw Error('Demo emulators required');
if(process.env.ORKA_STRICT_APP_CHECK!=='true') {
  process.env.FIREBASE_DEBUG_MODE='true';
  process.env.FIREBASE_DEBUG_FEATURES=JSON.stringify({skipTokenVerification:true,enableCors:true});
}
const express=require('express');
const functions=require('../functions');
const app=express();app.use(express.json());
app.get('/health',(_req,res)=>res.send('demo-harness'));
for(const name of ['quoteOrkaOrder','createOrkaOrder','updateOrkaOrderStatus']) app.post('/demo-orka-checkout/me-central1/'+name,functions[name]);
const server=app.listen(process.env.ORKA_STRICT_APP_CHECK==='true'?5002:5001,'127.0.0.1',()=>console.log('Loopback demo callable harness ready'));
const stop=()=>server.close(()=>process.exit(0));process.on('SIGTERM',stop);process.on('SIGINT',stop);
