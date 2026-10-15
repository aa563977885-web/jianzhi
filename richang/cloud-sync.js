(function(){
 'use strict';
 const S=CompassSync,CK='daily-compass-cloud-v1'+(QA?'-qa':''),space=QA?'qa':'main';
 const defaultProfile={sex:'male',age:28,height:170,weight:80,target:65,activity:1.375};
 const empty=()=>({version:1,journal:{records:{},reviews:{},explorations:{},goal:{title:'',detail:''}},fitness:{logs:{},body:{},water:{},exercises:{},checkins:{},workouts:{},profile:{...defaultProfile}}});
 let config={},broken=false,busy=false,timer,conflicts=[],choices={},status='尚未开启 · 记录保存在本机',lastObserved='',formDirty=new Set(),paused=false;
 try{config=JSON.parse(localStorage.getItem(CK)||'{}');if(!config||typeof config!=='object'||Array.isArray(config))throw Error();}catch(e){broken=true;status='同步配置读取失败，请保留本机记录并导出备份。';}
 const defaults=window.COMPASS_CLOUD_CONFIG||{};
 if(!config.url&&defaults.url){config.url=defaults.url;config.key=defaults.key;}
 function saveConfig(){if(broken)throw Error('同步配置读取失败，暂时不能修改。');localStorage.setItem(CK,JSON.stringify(config));}
 function current(){
  if(storageBroken)throw Error('本机日常记录读取异常，请先导出备份。');
  const j=validate(JSON.parse(localStorage.getItem(KEY)||JSON.stringify(blankState()))),raw=localStorage.getItem(FITNESS_KEY),f=raw?JSON.parse(raw):{};
  if(!f||typeof f!=='object'||Array.isArray(f))throw Error('本机健身记录读取异常，请先备份。');
  const health=validateFitnessBackup(f),body=Object.fromEntries(health.body.map(x=>[x.date,x]));
  const result={version:1,journal:{records:j.records,reviews:j.reviews,explorations:Object.fromEntries(j.explorations.map(x=>[x.id,x])),goal:j.goal},fitness:{...health,body}};
  // Fitness preferences are an explicit allowlist; credentials/photos never enter a sync payload.
  if(f.profile){const p={};for(const name of ['age','height','weight','target','activity'])if(hasNumber(f.profile[name]))p[name]=f.profile[name];if(['male','female'].includes(f.profile.sex))p.sex=f.profile.sex;result.fitness.profile=p;}
  const diet=f.settings?.dietSchedule;if(diet&&validDate(diet.start)&&[7,14].includes(diet.duration))result.fitness.dietSchedule={start:diet.start,duration:diet.duration,enabled:diet.enabled===true,applyTargets:diet.applyTargets===true,updatedAt:hasNumber(diet.updatedAt)?diet.updatedAt:0};
  return clean(result);
 }
 function clean(value){
  if(!value||value.version!==1||!value.journal||!value.fitness)throw Error('云端记录格式不兼容，已暂停同步。');
  const j=validate({version:1,...value.journal,explorations:Object.values(value.journal.explorations||{})}),f=validateFitnessBackup({...value.fitness,body:Object.values(value.fitness.body||{})}),out={version:1,journal:{records:j.records,reviews:j.reviews,explorations:Object.fromEntries(j.explorations.map(x=>[x.id,x])),goal:j.goal},fitness:{...f,body:Object.fromEntries(f.body.map(x=>[x.date,x]))}};
  const p=value.fitness.profile||{};out.fitness.profile={...defaultProfile};for(const [key,range] of Object.entries({age:[1,120],height:[50,250],weight:[1,500],target:[1,500],activity:[1,3]})){if(p[key]!==undefined){if(!hasNumber(p[key])||p[key]<range[0]||p[key]>range[1])throw Error('云端健身档案数值无效。');out.fitness.profile[key]=p[key];}}if(['male','female'].includes(p.sex))out.fitness.profile.sex=p.sex;
  const d=value.fitness.dietSchedule;if(d){if(!validDate(d.start)||![7,14].includes(d.duration)||!hasNumber(d.updatedAt)||d.updatedAt<0)throw Error('云端饮食计划无效。');out.fitness.dietSchedule={start:d.start,duration:d.duration,enabled:d.enabled===true,applyTargets:d.applyTargets===true,updatedAt:d.updatedAt};}
  if(new Blob([JSON.stringify(out)]).size>1900000)throw Error('同步记录超过容量，请先导出备份。');return out;
 }
 function apply(value,baseline){
  const data=clean(value),oldJ=localStorage.getItem(KEY),oldF=localStorage.getItem(FITNESS_KEY),oldConfig=structuredClone(config),existing=oldF?JSON.parse(oldF):{};
  const journal=validate({version:1,...data.journal,explorations:Object.values(data.journal.explorations),theme:db.theme});
  const fitness={...existing,...data.fitness,body:Object.values(data.fitness.body)};delete fitness.dietSchedule;
  // Keep local API keys, auth sessions, photos and training customizations intact.
  fitness.profile={...existing.profile,...data.fitness.profile};
  if(!Object.keys(fitness.profile).length)delete fitness.profile;
  fitness.settings={...existing.settings};if(data.fitness.dietSchedule)fitness.settings.dietSchedule=data.fitness.dietSchedule;
  else delete fitness.settings.dietSchedule;
  try{
   localStorage.setItem(FITNESS_KEY,JSON.stringify(fitness));localStorage.setItem(KEY,JSON.stringify(journal));
   config.base=baseline;config.lastSync=Date.now();saveConfig();db=journal;
  }catch(error){config=oldConfig;try{oldF===null?localStorage.removeItem(FITNESS_KEY):localStorage.setItem(FITNESS_KEY,oldF);oldJ===null?localStorage.removeItem(KEY):localStorage.setItem(KEY,oldJ);}catch(e){}throw Error('本机存储空间不足，已暂停同步；请导出备份并检查记录。');}
  renderToday();renderExplore();notifyFitnessStatus();
  // Remote records must never replace a form while the user is typing.
  if(!formDirty.size){if(!$('page-record').hidden)loadDaily($('record-date').value);if(!$('page-week').hidden)renderWeek();if(!$('page-backup').hidden)loadGoal();}
  lastObserved=S.stable(current());
 }
 function project(url,key){
  let u;try{u=new URL(url.trim());}catch(e){throw Error('请先展开首次连接，填写 Project URL 和公钥。');}if(u.protocol!=='https:'||!(/^[a-z0-9-]+\.supabase\.co$/).test(u.hostname)||u.port||u.username||u.password||u.search||u.hash||!['','/'].includes(u.pathname))throw Error('请输入 https://项目编号.supabase.co 形式的 Project URL。');
  key=key.trim();let allowed=/^sb_publishable_[A-Za-z0-9_-]+$/.test(key);
  if(!allowed&&key.split('.').length===3){try{const role=JSON.parse(atob(key.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))).role;allowed=role==='anon';}catch(e){}}
  if(!allowed)throw Error('这里只接受 Publishable key 或 anon 公钥，请勿填写 Secret / service_role 密钥。');if(config.owner&&u.origin!==config.owner.url)throw Error('这些本机记录已绑定现有项目，更换项目请使用独立浏览器。');return {url:u.origin,key};
 }
 function paint(message){
  if(message)status=message;$('cloud-status').textContent=status;$('cloud-mini').textContent=busy?'正在同步…':config.session?'设备同步 · '+status:'本机保存 · 开启设备同步';
  $('cloud-account').textContent=config.session?'已登录：'+config.session.email:config.owner?'已退出登录，本机记录保留。请继续使用 '+config.owner.email:'在手机与电脑登录同一个邮箱账号。';
  $('cloud-last').textContent=config.lastSync?'上次完成：'+new Date(config.lastSync).toLocaleString('zh-CN'):'尚未完成首次同步';
  $('cloud-login-form').hidden=!!config.session;$('cloud-actions').hidden=!config.session;
  $('cloud-sync-now').disabled=busy;$('cloud-logout').disabled=busy;$('cloud-project-save').disabled=!!config.session||busy;
  $('cloud-conflicts').hidden=!conflicts.length;$('cloud-reload').hidden=!formDirty.size;
 }
 function display(v){return v===undefined?'（已删除 / 无记录）':typeof v==='string'?v:JSON.stringify(v,null,2);}
 const labels={journal:'日常',fitness:'健身',records:'每日记录',reviews:'周复盘',explorations:'职业探索',goal:'阶段目标',logs:'饮食',body:'体测',water:'饮水',exercises:'运动',workouts:'力量训练',checkins:'打卡',profile:'个人档案',dietSchedule:'饮食计划',sleep:'睡眠',energy:'精力',movement:'运动时长',exercise:'运动感受',achievement:'完成的事',next:'下一步',title:'目标',detail:'目标说明',meals:'饮食简记',note:'备注'};
 function showConflicts(rows){conflicts=rows;choices={};$('cloud-conflict-list').replaceChildren();rows.forEach((c,i)=>{const item=document.createElement('div');item.className='cloud-conflict';const title=document.createElement('strong');title.textContent=c.path.map(k=>labels[k]||k).join(' / ');item.appendChild(title);const columns=document.createElement('div');columns.className='cloud-compare';for(const [name,label] of [['local','本机内容'],['remote','云端内容']]){const box=document.createElement('div'),heading=document.createElement('b'),pre=document.createElement('pre');heading.textContent=label;pre.textContent=display(c[name]);box.append(heading,pre);columns.appendChild(box);}item.appendChild(columns);const label=document.createElement('label');label.textContent='保留哪个版本 ';const select=document.createElement('select');select.setAttribute('aria-label','冲突 '+(i+1)+' 的保留版本');select.innerHTML='<option value="">请选择</option><option value="local">保留本机内容</option><option value="remote">保留云端内容</option>';select.addEventListener('change',()=>{choices[c.key]=select.value;});label.appendChild(select);item.appendChild(label);$('cloud-conflict-list').appendChild(item);});paint('有 '+rows.length+' 项内容需要你选择，其他记录仍在本机保存。');}
 async function request(path,body,token){
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),20000);try{
   const response=await fetch(config.url+path,{method:body===undefined?'GET':'POST',headers:{apikey:config.key,...(token?{Authorization:'Bearer '+token}:{}),'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal:controller.signal});
   const data=await response.json().catch(()=>({}));if(!response.ok){if(response.status===401||response.status===403)throw Error('登录已失效或账号无权访问，请重新登录并检查同步表权限。');if(['PGRST202','42P01','PGRST205'].includes(data.code))throw Error('同步表尚未初始化，请在 Supabase 执行下方初始化 SQL。');if(data.error_code==='invalid_credentials')throw Error('邮箱或密码不正确，请重新输入。');throw Error('云端请求失败（'+response.status+'），本机记录仍保留。');}return data;
  }catch(e){if(e.name==='AbortError'||e instanceof TypeError)throw Error('网络暂时不可用，记录仍在本机；恢复连接后会重试。');throw e;}finally{clearTimeout(timeout);}
 }
 function session(data){if(!data.user?.id||!data.access_token||!data.refresh_token)throw Error('请先完成邮箱验证，再登录。');const email=data.user.email||'';if(config.owner&&(config.owner.url!==config.url||config.owner.id!==data.user.id))throw Error('这些本机记录已绑定 '+config.owner.email+'。请使用原账号登录，其他账号请使用独立浏览器。');config.owner={url:config.url,id:data.user.id,email};config.session={id:data.user.id,email,access:data.access_token,refresh:data.refresh_token,expires:Date.now()+(data.expires_in||3600)*1000};saveConfig();}
 async function token(){
  if(!config.session)throw Error('请先登录。');if(config.session.expires>Date.now()+60000)return config.session.access;
  try{const data=await request('/auth/v1/token?grant_type=refresh_token',{refresh_token:config.session.refresh});session(data);return config.session.access;}catch(e){if(/失效|无权/.test(e.message)){config.session=null;saveConfig();}throw e;}
 }
 function initialBase(local,remote){
  const b=empty();for(const date of Object.keys(local.journal.records)){if(!remote.journal.records[date])continue;const r={date};for(const f of TEXT_FIELDS)r[f]='';for(const f of Object.keys(NUM_LIMITS))r[f]=null;b.journal.records[date]=r;}
  for(const date of Object.keys(local.journal.reviews)){if(remote.journal.reviews[date])b.journal.reviews[date]={win:'',adjust:'',action:''};}return b;
 }
 async function perform(){
  if(!config.session||broken||paused)return;
  // Serialize tabs and refresh-token rotation on browsers supporting Web Locks.
  const newest=JSON.parse(localStorage.getItem(CK)||'{}');if(newest.owner?.id===config.owner.id)config=newest;if(!config.session)return;
  const auth=await token();paint('正在同步…');const base=config.base?clean(config.base):initialBase;
  const result=await S.exchange({base,readLocal:current,readRemote:async()=>{const rows=await request('/rest/v1/daily_compass_sync?user_id=eq.'+encodeURIComponent(config.session.id)+'&space=eq.'+space+'&select=revision,payload',undefined,auth);if(!Array.isArray(rows))throw Error('云端返回格式异常。');const row=rows[0];if(config.base&&(!row||!Object.keys(row.payload||{}).length))throw Error('云端记录缺失，已暂停同步；本机记录保留，请先导出备份并检查项目。');return {revision:row?.revision||0,payload:row&&Object.keys(row.payload||{}).length?clean(row.payload):empty()};},writeRemote:(revision,payload)=>request('/rest/v1/rpc/compass_sync_write',{expected_revision:revision,next_payload:payload,target_space:space},auth),choices,onConflict:showConflicts});
  if(result.conflicts)return;
  // Edits made during the request stay pending instead of being replaced by its response.
  const late=S.merge(result.local,current(),result.payload);const keepLocal={};late.conflicts.forEach(c=>{keepLocal[c.key]='local';});const merged=late.conflicts.length?S.merge(result.local,current(),result.payload,keepLocal).value:late.value;
  apply(merged,result.payload);conflicts=[];choices={};paint(S.equal(merged,result.payload)?'已同步 ✓':'新修改已保存在本机，准备继续同步');if(!S.equal(merged,result.payload))queue();
 }
 async function sync(){if(busy||!config.session||paused)return;busy=true;paint();try{if(navigator.onLine===false)throw Error('当前离线，记录保存在本机，联网后继续同步。');if(navigator.locks)await navigator.locks.request('daily-compass-sync-'+space,perform);else await perform();}catch(e){paint(e.message||'同步未完成，本机记录仍保留。');}finally{busy=false;paint();}}
 function queue(){clearTimeout(timer);timer=setTimeout(sync,1800);if(config.session&&!busy)paint('本机已保存，等待同步…');}
 function observe(){try{const value=S.stable(current());if(value!==lastObserved){lastObserved=value;conflicts=[];choices={};queue();}}catch(e){paint(e.message);}}
 const previousPersist=persist;persist=function(next){const ok=previousPersist(next);if(ok)observe();return ok;};
 window.addEventListener('message',e=>{if(e.origin===location.origin&&e.source===$('fitness-frame').contentWindow&&e.data?.type==='fitness-records-changed')observe();});
 window.addEventListener('storage',e=>{if([KEY,FITNESS_KEY].includes(e.key))observe();if(e.key===CK){try{config=JSON.parse(e.newValue||'{}');paint();}catch(e){paint('同步配置读取失败。');}}});
 window.addEventListener('online',()=>{if(!conflicts.length)sync();});window.addEventListener('focus',()=>{if(!conflicts.length)sync();});
 document.addEventListener('visibilitychange',()=>{if(!document.hidden&&!conflicts.length)sync();});
 document.addEventListener('input',e=>{const form=e.target.closest('form');if(form&&['daily-form','review-form','goal-form','explore-form'].includes(form.id)){formDirty.add(form.id);paint();}});
 document.addEventListener('submit',e=>{if(formDirty.has(e.target.id)){formDirty.delete(e.target.id);paint();}});
 $('cloud-reload').addEventListener('click',()=>{if(!confirm('载入已保存的记录会替换表单中尚未保存的填写，确定载入？'))return;formDirty.clear();loadDaily($('record-date').value);renderWeek();loadGoal();paint();});
 $('cloud-project-save').addEventListener('click',()=>{try{const p=project($('cloud-url').value,$('cloud-key').value);if(config.owner&&p.url!==config.owner.url)throw Error('本机记录已绑定现有项目。更换项目请先使用独立浏览器。');Object.assign(config,p);saveConfig();paint('项目配置已保存，请登录同一个邮箱账号。');}catch(e){paint(e.message);}});
 $('cloud-login-form').addEventListener('submit',async e=>{e.preventDefault();if(busy)return;const button=$('cloud-login-button');button.disabled=true;busy=true;paint('正在登录…');try{Object.assign(config,project($('cloud-url').value,$('cloud-key').value));saveConfig();const result=await request('/auth/v1/token?grant_type=password',{email:$('cloud-email').value.trim(),password:$('cloud-password').value});session(result);$('cloud-password').value='';paint('登录成功，准备同步…');}catch(error){paint(error.message);}finally{busy=false;button.disabled=false;paint();}if(config.session)sync();});
 $('cloud-signup').addEventListener('click',async()=>{if(busy||!$('cloud-login-form').reportValidity())return;busy=true;paint('正在注册…');try{Object.assign(config,project($('cloud-url').value,$('cloud-key').value));saveConfig();const data=await request('/auth/v1/signup',{email:$('cloud-email').value.trim(),password:$('cloud-password').value});$('cloud-password').value='';if(data.access_token){session(data);paint('注册成功，准备同步。');}else paint('请到邮箱完成验证，再回到这里登录。');}catch(e){paint(e.message);}finally{busy=false;paint();}if(config.session)sync();});
 $('cloud-sync-now').addEventListener('click',()=>{if(conflicts.length){paint('请先处理下方的内容冲突。');return;}sync();});
 $('cloud-logout').addEventListener('click',async()=>{if(busy)return;busy=true;const old=config.session;config.session=null;saveConfig();paint('已退出登录，本机记录保留。');try{await request('/auth/v1/logout?scope=local',{},old.access);}catch(e){}finally{busy=false;paint();}});
 $('cloud-resolve').addEventListener('click',()=>{if(conflicts.some(c=>!['local','remote'].includes(choices[c.key]))){paint('请为每项冲突选择保留版本。');return;}sync();});
 $('cloud-conflict-backup').addEventListener('click',()=>{const data=current();download(JSON.stringify({version:1,...data.journal,explorations:Object.values(data.journal.explorations),fitness:{...data.fitness,body:Object.values(data.fitness.body)},exportedAt:new Date().toISOString()},null,2),'同步前本机备份-'+today()+'.json','application/json');});
 $('cloud-url').value=config.url||'';$('cloud-key').value=config.key||'';$('cloud-email').value=config.owner?.email||'';if(!config.url)$('cloud-project').open=true;
 try{lastObserved=S.stable(current());}catch(e){status=e.message;}paint();
 setInterval(()=>{observe();if(config.session&&!document.hidden&&!conflicts.length)sync();},45000);if(config.session)sync();
})();
