'use strict';
const HOUR=3600000;
const OUTER='core,job_configured,last_job_started_at,last_job_status,schema_version';
const INNER='activated_on,checked_at,collection_enabled,last_retention_run,privacy_review_approved,schema_version';
function assess(value,now=Date.now()) {
  const fail=category=>({healthy:false,category});
  if(!value||Object.keys(value).sort().join(',')!==OUTER||value.schema_version!==1||typeof value.job_configured!=='boolean')return fail('invalid_status');
  const c=value.core;
  if(!c||Object.keys(c).sort().join(',')!==INNER||c.schema_version!==1||typeof c.collection_enabled!=='boolean'||typeof c.privacy_review_approved!=='boolean')return fail('invalid_status');
  // This deployment is explicitly OFF-only. Any later activation needs a reviewed monitor update.
  if(c.collection_enabled||c.privacy_review_approved||c.activated_on!==null)return fail('unexpected_activation');
  const checked=typeof c.checked_at==='string'?Date.parse(c.checked_at):NaN;
  const pruned=typeof c.last_retention_run==='string'?Date.parse(c.last_retention_run):NaN;
  if(!Number.isFinite(now)||!Number.isFinite(checked)||checked>now+60000||now-checked>300000)return fail('invalid_status');
  if(!Number.isFinite(pruned)||pruned>now)return fail('retention_unknown');
  if(!value.job_configured)return fail('schedule_missing');
  if(now-pruned>=26*HOUR)return fail('retention_lockout');
  if(now-pruned>=25*HOUR)return fail('retention_warning');
  if(value.last_job_status===null) {
    if(value.last_job_started_at!==null)return fail('invalid_status');
  } else {
    const start=typeof value.last_job_started_at==='string'?Date.parse(value.last_job_started_at):NaN;
    if(!Number.isFinite(start)||start>now+60000)return fail('invalid_status');
    if(value.last_job_status==='failed')return fail('retention_failed');
    if(!['succeeded','running','starting','connecting','sending'].includes(value.last_job_status))return fail('invalid_status');
    if(value.last_job_status!=='succeeded'&&now-start>120000)return fail('retention_stuck');
  }
  return {healthy:true,category:value.last_job_status===null?'bootstrap_schedule_pending':'healthy'};
}
function pingURL(raw,healthy) {
  const u=new URL(raw);
  if(u.protocol!=='https:'||u.hostname!=='hc-ping.com'||u.port||u.username||u.password||u.search||u.hash||!/^\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(u.pathname))throw Error('Invalid monitor destination');
  return u.href+(healthy?'':'/fail');
}
async function run({readHealth,ping,now=()=>Date.now()}) {
  let status;
  try {status=assess(await readHealth(),now());}catch{status={healthy:false,category:'database_unavailable'};}
  try {await ping(status.healthy);}catch{return {healthy:false,category:'heartbeat_unavailable'};}
  return status;
}
module.exports={assess,pingURL,run};
