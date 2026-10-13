'use strict';
const QA=/(?:^|[?&])qa=1(?:&|$)/.test(location.search||'');
const KEY='daily-compass-v1'+(QA?'-qa':''), $=id=>document.getElementById(id);
const TEXT_FIELDS=['exercise','meals','achievement','blocker','next','note'];
const NUM_LIMITS={sleep:[0,24],weight:[1,500],movement:[0,1440],water:[0,20000],energy:[1,5],calories:[0,20000],protein:[0,1000],focus:[0,1440]};
const STATUS={planned:'准备尝试',doing:'正在进行',feedback:'收集反馈',done:'已完成',paused:'暂时搁置'};
const localDate=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const today=()=>localDate(new Date());
const parseDate=s=>new Date(`${s}T12:00:00`);
const validDate=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&!isNaN(parseDate(s))&&localDate(parseDate(s))===s;
const offset=(s,n)=>{const d=parseDate(s);d.setDate(d.getDate()+n);return localDate(d)};
const monday=s=>offset(s,-((parseDate(s).getDay()+6)%7));
const days=s=>Array.from({length:7},(_,i)=>offset(s,i));
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const short=s=>s.slice(5).replace('-','/');
const range=s=>`${short(s)} — ${short(offset(s,6))}`;
const hasNumber=v=>typeof v==='number'&&Number.isFinite(v);
const fmt=n=>Number.isInteger(n)?String(n):n.toFixed(1);
const blankState=()=>({version:1,records:{},reviews:{},explorations:[],goal:{title:'',detail:''},theme:'light'});
let db=blankState(),weekStart=monday(today()),editId=null,pendingImport=null,toastTimer;
function validate(source){
 if(!source||source.version!==1||typeof source.records!=='object'||source.records===null||Array.isArray(source.records)||!Array.isArray(source.explorations)||source.explorations.length>1000||Object.keys(source.records).length>20000)throw Error('备份格式不正确，需导入日常有数的 JSON 备份。');
 const out=blankState();
 const text=(s,max=6000)=>{if(s==null)return '';if(typeof s!=='string'||s.length>max)throw Error('备份中的文字字段格式不正确。');return s};
 for(const [date,r] of Object.entries(source.records)){
  if(!validDate(date)||!r||typeof r!=='object')throw Error('备份含有无效日期或记录。');
  const clean={date};for(const f of TEXT_FIELDS)clean[f]=text(r[f]);
  for(const [f,[min,max]] of Object.entries(NUM_LIMITS)){const v=r[f];if(v==null||v===''){clean[f]=null;continue}if(!hasNumber(v)||v<min||v>max)throw Error('备份含有超出范围的数据。');clean[f]=v}
  out.records[date]=clean;
 }
 for(const [date,r] of Object.entries(source.reviews||{})){if(!validDate(date)||monday(date)!==date||!r)throw Error('周复盘日期格式不正确。');out.reviews[date]={win:text(r.win),adjust:text(r.adjust),action:text(r.action)}}
 const seen=new Set();for(const r of source.explorations){if(!r||typeof r.id!=='string'||!/^[a-zA-Z0-9-]{1,100}$/.test(r.id)||seen.has(r.id)||!STATUS[r.status]||!validDate(r.created))throw Error('职业探索数据格式不正确。');seen.add(r.id);out.explorations.push({id:r.id,name:text(r.name,100),hypothesis:text(r.hypothesis),task:text(r.task),feedback:text(r.feedback),next:text(r.next),status:r.status,created:r.created})}
 out.goal={title:text(source.goal?.title,150),detail:text(source.goal?.detail,3000)};out.theme=source.theme==='dark'?'dark':'light';return out;
}
let storageBroken=false;
try{const raw=localStorage.getItem(KEY);if(raw)db=validate(JSON.parse(raw))}catch(e){storageBroken=true;setTimeout(()=>toast('读取已有数据失败。为保护原数据，暂时停止保存，请先导出或恢复备份。'),400)}
function persist(next= db){if(storageBroken){toast('已有数据读取异常，请先备份，保存已暂停。');return false}try{localStorage.setItem(KEY,JSON.stringify(next));db=next;return true}catch(e){toast('保存失败：浏览器存储可能不可用或空间不足，请先导出备份。');return false}}
function toast(message){$('toast').textContent=message;$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),3500)}
function metric(label,value,unit,note,icon){return `<article class="metric"><div class="metric-label">${label}<span class="metric-icon">${icon}</span></div><div class="metric-value">${value}<small>${unit}</small></div><div class="metric-note">${note}</div></article>`}
function setPage(page){if(!['today','record','week','explore','backup'].includes(page))page='today';document.querySelectorAll('.page').forEach(el=>el.hidden=el.id!==`page-${page}`);document.querySelectorAll('nav button').forEach(el=>el.classList.toggle('active',el.dataset.page===page));$('breadcrumb').textContent=`我的日常 / ${{today:'今日概览',record:'每日记录',week:'每周复盘',explore:'职业探索',backup:'目标与备份'}[page]}`;if(page==='record')loadDaily($('record-date').value||today());if(page==='week')renderWeek();if(page==='explore')renderExplore();if(page==='backup')loadGoal();window.scrollTo({top:0});}
function route(page){if(location.hash===`#${page}`)setPage(page);else location.hash=page}
document.addEventListener('click',e=>{const b=e.target.closest('[data-page]');if(b)route(b.dataset.page)});
window.addEventListener('hashchange',()=>setPage(location.hash.slice(1)));
function renderToday(){
 const date=today(),r=db.records[date]||{},start=monday(date),wd=['一','二','三','四','五','六','日'];
 $('today-date').textContent=`${date.replaceAll('-',' / ')} · 星期${wd[(parseDate(date).getDay()+6)%7]}`;
 $('goal-title').textContent=db.goal.title||'从了解自己的日常开始';$('goal-detail').textContent=db.goal.detail||'先记录一周，再决定最值得调整的一件事。';
 $('today-metrics').innerHTML=metric('昨晚睡眠',hasNumber(r.sleep)?fmt(r.sleep):'—','小时',hasNumber(r.sleep)?'来自今日记录':'今天还没有记录','◷')+metric('今日运动',hasNumber(r.movement)?fmt(r.movement):'—','分钟',hasNumber(r.movement)?'每一点活动都算数':'今天还没有记录','↗')+metric('今日精力',hasNumber(r.energy)?r.energy:'—','/ 5',hasNumber(r.energy)?['','很疲惫','有些疲惫','一般','状态不错','精力充沛'][r.energy]:'按自己的感受填写','✦')+metric('工作 / 学习',hasNumber(r.focus)?fmt(r.focus):'—','分钟',r.achievement?'已有一项成果记录':'把推进的事记下来','▤');
 $('week-range').textContent=range(start);$('week-strip').innerHTML=days(start).map((d,i)=>`<button class="day ${db.records[d]?'logged':''} ${d===date?'is-today':''}" data-log-date="${d}" aria-label="记录 ${d}"><span>周${wd[i]}</span><strong>${Number(d.slice(-2))}</strong><span class="dot">${db.records[d]?'●':'·'}</span></button>`).join('');
 $('week-count').textContent=`本周已记录 ${days(start).filter(d=>db.records[d]).length} / 7 天`;
 const latestNext=Object.keys(db.records).filter(d=>d<=date&&db.records[d].next).sort().reverse()[0];
 $('next-title').textContent=latestNext?db.records[latestNext].next:'给明天留一个清晰的起点';$('next-detail').textContent=latestNext?`写于 ${latestNext} · 完成后记下结果，或调整下一步。`:'在每日记录里写下一个具体、能完成的行动。';
 const recentDates=Object.keys(db.records).filter(d=>d<=date).sort().reverse().slice(0,3);
 $('recent').innerHTML=recentDates.length?recentDates.map(d=>`<div class="recent-item"><span class="recent-date">${short(d)}</span><p>${esc((db.records[d].achievement||db.records[d].note||db.records[d].exercise||db.records[d].meals||'已记录当天状态').slice(0,95))}</p></div>`).join(''):'<div class="empty"><div class="empty-symbol">✎</div>第一条记录，就是你的起点。</div>';
 renderChart(date);$('backup-info').textContent=`当前有 ${Object.keys(db.records).length} 天记录、${Object.keys(db.reviews).length} 份周复盘、${db.explorations.length} 个探索。`;
}
document.addEventListener('click',e=>{const b=e.target.closest('[data-log-date]');if(b){$('record-date').value=b.dataset.logDate;route('record')}});
function renderChart(date){
 const start=offset(date,-13),points=Object.keys(db.records).filter(d=>d>=start&&d<=date&&hasNumber(db.records[d].weight)).sort().map(d=>({d,v:db.records[d].weight}));
 if(!points.length){$('weight-chart').textContent='记录体重后，这里会显示真实变化。';return}
 const values=points.map(p=>p.v),lo=Math.min(...values)-.5,hi=Math.max(...values)+.5,W=520,H=158,L=40,R=15,T=14,B=28;
 const x=d=>L+((parseDate(d)-parseDate(start))/86400000/13)*(W-L-R),y=v=>T+(hi-v)/(hi-lo)*(H-T-B);
 const lines=[lo,(lo+hi)/2,hi].map(v=>`<line x1="${L}" y1="${y(v)}" x2="${W-R}" y2="${y(v)}" stroke="var(--line)" stroke-dasharray="3 4"/><text x="1" y="${y(v)+4}" fill="var(--muted)" font-size="10">${v.toFixed(1)}</text>`).join('');
 $('weight-chart').innerHTML=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="近14天体重，${points.map(p=>`${p.d} ${p.v}公斤`).join('；')}">${lines}<polyline points="${points.map(p=>`${x(p.d)},${y(p.v)}`).join(' ')}" fill="none" stroke="var(--green)" stroke-width="2.5"/>${points.map(p=>`<circle cx="${x(p.d)}" cy="${y(p.v)}" r="4" fill="var(--green)"><title>${p.d} · ${p.v} kg</title></circle>`).join('')}<text x="${L}" y="${H-5}" fill="var(--muted)" font-size="10">${short(start)}</text><text x="${W-R}" y="${H-5}" text-anchor="end" fill="var(--muted)" font-size="10">${short(date)}</text></svg>`;
}
function loadDaily(date){if(!validDate(date))return;const r=db.records[date]||{},form=$('daily-form');for(const f of [...TEXT_FIELDS,...Object.keys(NUM_LIMITS)])form.elements[f].value=r[f]??'';$('record-status').textContent=db.records[date]?'已保存 · 可以继续修改':'这一天还没有记录';}
$('record-date').value=today();$('record-date').addEventListener('change',()=>{if($('record-date').value>today()){$('record-date').value=today();toast('每日记录用于记录已经发生的事。')}loadDaily($('record-date').value)});$('record-date').max=today();
$('daily-form').addEventListener('submit',e=>{e.preventDefault();const form=e.currentTarget,date=form.elements.date.value;if(!validDate(date)||date>today())return toast('请选择有效日期，且不晚于今天。');const r={date};for(const f of TEXT_FIELDS)r[f]=form.elements[f].value.trim();for(const f of Object.keys(NUM_LIMITS)){const raw=form.elements[f].value;r[f]=raw===''?null:Number(raw)}if(!TEXT_FIELDS.some(f=>r[f])&&!Object.keys(NUM_LIMITS).some(f=>hasNumber(r[f])))return toast('先填写至少一项，再保存这一天。');const next=structuredClone(db);next.records[date]=r;if(persist(next)){renderToday();loadDaily(date);toast('这一天已保存 ✓')}});
function weekRecords(){return days(weekStart).filter(d=>db.records[d]).map(d=>db.records[d])}
function renderWeek(){
 const records=weekRecords(),sleep=records.filter(r=>hasNumber(r.sleep)),energy=records.filter(r=>hasNumber(r.energy)),moves=records.filter(r=>hasNumber(r.movement));
 $('review-range').textContent=`${weekStart.slice(0,4)} / ${range(weekStart)}`;$('next-week').disabled=weekStart>=monday(today());
 $('week-metrics').innerHTML=metric('记录天数',records.length,'/ 7','以保存过的日期计数','✎')+metric('平均睡眠',sleep.length?fmt(sleep.reduce((s,r)=>s+r.sleep,0)/sleep.length):'—','小时',`基于 ${sleep.length} 天睡眠记录`,'◷')+metric('累计运动',moves.length?fmt(moves.reduce((s,r)=>s+r.movement,0)):'—','分钟',`基于 ${moves.length} 天运动记录`,'↗')+metric('平均精力',energy.length?fmt(energy.reduce((s,r)=>s+r.energy,0)/energy.length):'—','/ 5',`基于 ${energy.length} 天精力记录`,'✦');
 $('week-table').innerHTML=days(weekStart).map(d=>{const r=db.records[d];return `<tr><td><button class="text-button" data-log-date="${d}">${short(d)}</button></td><td>${r&&hasNumber(r.sleep)?fmt(r.sleep)+' 小时':'—'}</td><td>${r&&hasNumber(r.movement)?fmt(r.movement)+' 分钟':'—'}</td><td>${r&&hasNumber(r.energy)?r.energy+'/5':'—'}</td><td>${r?esc(r.achievement||'未填写成果'):'未记录'}</td></tr>`}).join('');
 const review=db.reviews[weekStart]||{};for(const f of ['win','adjust','action'])$('review-form').elements[f].value=review[f]||'';
}
$('prev-week').addEventListener('click',()=>{weekStart=offset(weekStart,-7);renderWeek()});$('next-week').addEventListener('click',()=>{if(weekStart<monday(today())){weekStart=offset(weekStart,7);renderWeek()}});$('this-week').addEventListener('click',()=>{weekStart=monday(today());renderWeek()});
$('review-form').addEventListener('submit',e=>{e.preventDefault();const r={};for(const f of ['win','adjust','action'])r[f]=e.currentTarget.elements[f].value.trim();if(!Object.values(r).some(Boolean))return toast('先写下一项复盘内容。');const next=structuredClone(db);next.reviews[weekStart]=r;if(persist(next)){renderToday();toast('周复盘已保存 ✓')}});
function recordMd(r){const labels={sleep:'睡眠（小时）',weight:'体重（kg）',movement:'运动（分钟）',water:'饮水（ml）',energy:'精力（1–5）',calories:'热量（kcal，手动记录）',protein:'蛋白质（g，手动记录）',focus:'工作/学习（分钟）',meals:'饮食',exercise:'运动内容',achievement:'完成的事',blocker:'阻碍',next:'明天的一件事',note:'其他记录'};return `### ${r.date}\n`+Object.entries(labels).map(([f,l])=>`- ${l}：${r[f]===null||r[f]===undefined||r[f]===''?'未记录':String(r[f]).replaceAll('\n','\n  ')}`).join('\n')+'\n'}
function reportMd(start){const end=offset(start,6),ds=days(start),r=db.reviews[start];return `# 每周复盘材料 · ${start} 至 ${end}\n\n请只根据下列记录分析，不编造缺失数据。找出最多三个值得关注的模式，引用具体日期作为依据，区分事实、推测和建议。结合我的阶段目标，只推荐下周最值得调整的一件事，写明可执行步骤和检验方式。健康数据不能作为诊断依据，不把单日波动视为长期趋势。\n\n## 阶段目标\n${db.goal.title||'尚未设定'}\n${db.goal.detail||''}\n\n## 记录完整度\n已记录 ${ds.filter(d=>db.records[d]).length}/7 天。未记录日期：${ds.filter(d=>!db.records[d]).join('、')||'无'}。数值 0 表示明确填写为零，未记录表示缺失。\n\n## 每日记录\n\n${ds.filter(d=>db.records[d]).map(d=>recordMd(db.records[d])).join('\n')||'本周暂无记录。\n'}\n## 我的周复盘\n满意的事：${r?.win||'未填写'}\n想调整的问题：${r?.adjust||'未填写'}\n下周行动：${r?.action||'未填写'}\n\n## 职业探索\n${db.explorations.map(x=>`- ${x.name}（${STATUS[x.status]}）：尝试 ${x.task||'未填写'}；反馈 ${x.feedback||'未填写'}；下一步 ${x.next||'未填写'}`).join('\n')||'未记录'}\n\n注：职业探索为当前状态快照，不代表全部发生在本周。\n`}
$('ai-report').addEventListener('click',()=>{$('report-text').value=reportMd(weekStart);$('report-dialog').showModal()});$('close-report').addEventListener('click',()=>$('report-dialog').close());
$('copy-report').addEventListener('click',async()=>{try{await navigator.clipboard.writeText($('report-text').value);toast('已复制，粘贴到你使用的 AI 即可。')}catch(e){$('report-text').focus();$('report-text').select();toast('请手动复制已选中的复盘材料。')}});
function download(text,name,type='text/plain'){const blob=new Blob([text],{type}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
$('download-report').addEventListener('click',()=>download($('report-text').value,`周复盘-${weekStart}.md`,'text/markdown;charset=utf-8'));
function renderExplore(){const ordered=[...db.explorations].reverse();$('explore-list').innerHTML=ordered.length?ordered.map(x=>`<article class="card explore-card"><div class="card-title"><h2>${esc(x.name)}</h2><span class="status">${STATUS[x.status]}</span></div>${[['我想验证',x.hypothesis],['这次尝试',x.task],['收到的反馈',x.feedback],['下一步',x.next]].map(([l,t])=>`<h3>${l}</h3><p>${esc(t||'待补充')}</p>`).join('')}<div class="explore-actions"><select aria-label="${esc(x.name)}的探索状态" data-status-id="${x.id}">${Object.entries(STATUS).map(([v,l])=>`<option value="${v}" ${x.status===v?'selected':''}>${l}</option>`).join('')}</select><button class="text-button" data-edit-id="${x.id}">编辑 →</button></div></article>`).join(''):'<article class="card empty"><div class="empty-symbol">↗</div>你的第一个探索，从一个小任务开始。<p>先选一个方向，完成一个作品，再收集一次真实反馈。</p></article>'}
$('explore-form').addEventListener('submit',e=>{e.preventDefault();const form=e.currentTarget,x={id:editId||crypto.randomUUID(),created:editId?db.explorations.find(r=>r.id===editId).created:today()};for(const f of ['name','hypothesis','task','feedback','next','status'])x[f]=form.elements[f].value.trim();if(!x.name)return toast('请填写一个方向名称。');const next=structuredClone(db),i=next.explorations.findIndex(r=>r.id===x.id);if(i>=0)next.explorations[i]=x;else next.explorations.push(x);if(persist(next)){resetExplore();renderExplore();renderToday();toast('探索已保存 ✓')}});
function resetExplore(){editId=null;$('explore-form').reset();$('explore-form-title').textContent='新建一个探索';$('cancel-edit').hidden=true}
$('cancel-edit').addEventListener('click',resetExplore);
document.addEventListener('click',e=>{const b=e.target.closest('[data-edit-id]');if(!b)return;const x=db.explorations.find(r=>r.id===b.dataset.editId);if(!x)return;editId=x.id;for(const f of ['name','hypothesis','task','feedback','next','status'])$('explore-form').elements[f].value=x[f];$('explore-form-title').textContent='编辑这个探索';$('cancel-edit').hidden=false;$('explore-form').scrollIntoView({behavior:'smooth',block:'start'})});
document.addEventListener('change',e=>{const id=e.target.dataset.statusId;if(!id)return;const next=structuredClone(db),x=next.explorations.find(r=>r.id===id);if(x&&STATUS[e.target.value]){x.status=e.target.value;if(persist(next)){renderExplore();toast('状态已更新')}}});
function loadGoal(){for(const f of ['title','detail'])$('goal-form').elements[f].value=db.goal[f]||'';renderToday()}
$('goal-form').addEventListener('submit',e=>{e.preventDefault();const next=structuredClone(db);next.goal={title:e.currentTarget.elements.title.value.trim(),detail:e.currentTarget.elements.detail.value.trim()};if(persist(next)){renderToday();toast('阶段目标已保存')}});
$('theme').addEventListener('click',()=>{const next=structuredClone(db);next.theme=db.theme==='dark'?'light':'dark';if(persist(next))document.body.classList.toggle('dark',db.theme==='dark')});
$('export-json').addEventListener('click',()=>{if(storageBroken){download(localStorage.getItem(KEY)||'{}',`原始数据-${today()}.json`,'application/json');return}download(JSON.stringify({...db,exportedAt:new Date().toISOString()},null,2),`日常有数备份-${today()}.json`,'application/json');toast('备份文件已生成，请妥善保管。')});
$('export-md').addEventListener('click',()=>{const text=`# 日常有数 · 全部记录\n\n导出日期：${today()}\n\n## 阶段目标\n${db.goal.title||'未设定'}\n${db.goal.detail||''}\n\n## 每日记录\n${Object.keys(db.records).sort().map(d=>recordMd(db.records[d])).join('\n')||'暂无记录'}\n\n## 周复盘\n${Object.keys(db.reviews).sort().map(d=>`### ${d}\n满意：${db.reviews[d].win}\n调整：${db.reviews[d].adjust}\n行动：${db.reviews[d].action}`).join('\n\n')||'暂无复盘'}\n\n## 职业探索\n${db.explorations.map(x=>`### ${x.name}\n状态：${STATUS[x.status]}\n假设：${x.hypothesis}\n任务：${x.task}\n反馈：${x.feedback}\n下一步：${x.next}`).join('\n\n')||'暂无探索'}\n`;download(text,`日常有数全部记录-${today()}.md`,'text/markdown;charset=utf-8')});
$('import-json').addEventListener('click',()=>$('import-file').click());
$('import-file').addEventListener('change',async e=>{const file=e.target.files[0];if(!file)return;try{if(file.size>15*1024*1024)throw Error('备份文件过大，请选择 15 MB 以内的文件。');pendingImport=validate(JSON.parse(await file.text()));$('import-summary').textContent=`将导入 ${Object.keys(pendingImport.records).length} 天记录、${Object.keys(pendingImport.reviews).length} 份周复盘、${pendingImport.explorations.length} 个探索，以及阶段目标。`;$('import-dialog').showModal()}catch(err){toast(err.message||'导入失败，请检查文件。')}finally{e.target.value=''}});
$('cancel-import').addEventListener('click',()=>{pendingImport=null;$('import-dialog').close()});
$('confirm-import').addEventListener('click',()=>{if(!pendingImport)return;const next=structuredClone(db);Object.assign(next.records,pendingImport.records);Object.assign(next.reviews,pendingImport.reviews);const merged=new Map(next.explorations.map(x=>[x.id,x]));pendingImport.explorations.forEach(x=>merged.set(x.id,x));next.explorations=[...merged.values()];next.goal=pendingImport.goal;try{validate(next)}catch(e){return toast('合并后的数据超过限制，导入已取消。')}if(persist(next)){pendingImport=null;$('import-dialog').close();renderToday();renderWeek();renderExplore();loadGoal();toast('备份已合并导入 ✓')}});
document.body.classList.toggle('dark',db.theme==='dark');renderToday();renderExplore();setPage(location.hash.slice(1)||'today');
if(QA)document.querySelector('.top-right').firstChild.textContent='测试空间 ';
if('serviceWorker' in navigator&&location.protocol==='https:')navigator.serviceWorker.getRegistration(new URL('../',location.href).href).then(reg=>{if(reg)return reg.update()}).catch(()=>{});
