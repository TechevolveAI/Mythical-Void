import pg from 'pg';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import core from '../monitor-core.cjs';

const EXPECTED_PROJECT='mkcmdbzcihjgidjuypqe';
export const config={schedule:'*/15 * * * *'};
export function connectionOptions(raw,ca) {
  const u=new URL(raw);
  const user=decodeURIComponent(u.username);
  const destination=(u.hostname===`db.${EXPECTED_PROJECT}.supabase.co`&&user==='onboarding_monitor')||
    (u.hostname.endsWith('.pooler.supabase.com')&&user===`onboarding_monitor.${EXPECTED_PROJECT}`);
  if(!['postgres:','postgresql:'].includes(u.protocol)||!destination||u.pathname!=='/postgres'||!u.password||u.search||u.hash)throw Error('Invalid monitor connection');
  return {host:u.hostname,port:Number(u.port||5432),user,password:decodeURIComponent(u.password),database:'postgres',
    ssl:{ca,rejectUnauthorized:true},connectionTimeoutMillis:5000,query_timeout:6000,
    statement_timeout:5000,application_name:'mythical-onboarding-health',
    options:'-c default_transaction_read_only=on -c statement_timeout=5000'};
}
export default async function () {
  // These keys are created only in the production Functions scope, never a client build.
  if(process.env.ONBOARDING_MONITOR_ENABLED!=='true') {
    console.log(JSON.stringify({service:'onboarding-maintenance',category:'disabled'}));return;
  }
  let url;
  try{url=core.pingURL(process.env.ONBOARDING_HEALTHCHECK_URL,true);}catch{
    console.log(JSON.stringify({service:'onboarding-maintenance',category:'configuration_missing'}));return;
  }
  const result=await core.run({
    readHealth:async()=>{
      const ca=readFileSync(fileURLToPath(new URL('../supabase-ca.pem',import.meta.url)),'utf8');
      const client=new pg.Client(connectionOptions(process.env.ONBOARDING_MONITOR_DATABASE_URL,ca));
      client.on('error',()=>{});
      try {
        await client.connect();
        await client.query('begin read only');
        const {rows}=await client.query('select onboarding_ops.read_health() as health');
        await client.query('rollback');
        if(rows.length!==1)throw Error('Missing health status');
        return rows[0].health;
      }finally{await client.end().catch(()=>{});}
    },
    ping:async healthy=>{
      const response=await fetch(core.pingURL(url,healthy),{method:'GET',redirect:'error',signal:AbortSignal.timeout(4000),headers:{'User-Agent':'MythicalVoid-Onboarding-Health/1'}});
      if(!response.ok)throw Error('Heartbeat not accepted');
      await response.body?.cancel();
    }
  });
  // Never log exceptions, connection strings, snapshots, counters or ping URLs.
  console.log(JSON.stringify({service:'onboarding-maintenance',...result}));
}
