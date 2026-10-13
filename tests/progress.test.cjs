const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const {JSDOM}=require('jsdom');
const P=require('../progress-core.js');
const today='2026-10-13';
function weights(n,fn){return Array.from({length:n},(_,i)=>({date:P.shift(today,-i),weight:fn(i)}));}
test('weekly means require distinct recent dates, exclude future/invalid values and do not invent a trend',()=>{
 assert.equal(P.trend([],today).delta,null);
 const rows=[{date:today,weight:85},{date:today,weight:84},{date:P.shift(today,1),weight:60},{date:'2026-02-30',weight:70},{date:P.shift(today,-1),weight:0}];
 assert.equal(P.trend(rows,today).weeks[0].count,1);
 assert.equal(P.trend(rows,today).delta,null);
 const t=P.trend(weights(14,i=>i<7?85:86),today);
 assert.equal(t.delta,-1);
 assert.equal(P.trend(weights(14,i=>i<7?86:85),today).delta,1);
 assert.equal(P.trend(weights(14,()=>85),'2027-01-01').delta,null);
});
test('plateau review requires three populated windows, no automatic calorie prescription',()=>{
 const t=P.trend(weights(21,()=>85),today);
 assert.equal(t.flat,true);assert.match(P.advice(t),/不自动改变/);
 assert.equal(P.trend(weights(14,()=>85),today).flat,false);
 const waist=weights(21,()=>85);waist[0].waist=98;waist[7].waist=100;
 assert.equal(P.trend(waist,today).waistDelta,-2);
 assert.match(P.advice(P.trend(waist,today)),/腰围记录在下降/);
});
test('rotation follows completed sessions across missed weeks, drafts do not advance it',()=>{
 const ws={'2026-09-01':{date:'2026-09-01',kind:'A',completed:true,sets:[]},[today]:{date:today,kind:'B',completed:false,sets:[]}};
 assert.equal(P.nextKind(ws,today),'B');assert.equal(P.weeklySessions(ws,today).length,0);
 ws[today].completed=true;assert.equal(P.nextKind(ws,today),'A');assert.equal(P.weeklySessions(ws,today).length,1);
 ws[today].deleted=true;assert.equal(P.nextKind(ws,today),'B');
});
test('workout merges preserve independent dates and newer clear operations',()=>{
 const old={date:today,updatedAt:1,kind:'A',completed:true,sets:[]},clear={date:today,updatedAt:2,deleted:true};
 assert.deepEqual(P.mergeWorkouts({[today]:clear},{[today]:old})[today],clear);
 assert.deepEqual(P.mergeWorkouts({[today]:old},{[today]:clear})[today],clear);
 assert.equal(Object.keys(P.mergeWorkouts({[today]:old},{'2026-10-12':{date:'2026-10-12',updatedAt:1}})).length,2);
});
function page(seed){
 const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
 const d=new JSDOM(html,{url:'https://example.test/jianzhi/',runScripts:'outside-only',pretendToBeVisual:true});
 const w=d.window;w.alert=()=>{};w.confirm=()=>true;w.scrollTo=()=>{};w.fetch=()=>Promise.reject(new Error('No external requests in test'));
 if(seed){const key=html.match(/var LS_KEY='([^']+)'/)[1];w.localStorage.setItem(key,JSON.stringify(seed));}
 for(const s of w.document.querySelectorAll('script'))vm.runInContext(s.src?fs.readFileSync(path.join(__dirname,'..',s.getAttribute('src')),'utf8'):s.textContent,d.getInternalVMContext());
 return d;
}
function input(w,sel,value){const el=w.document.querySelector(sel);el.value=value;el.dispatchEvent(new w.Event('change',{bubbles:true}));}
test('actual page loads new training without losing legacy meal and exercise features',()=>{
 const d=page(),w=d.window;try{
 assert.equal(w.document.querySelector('.render-err'),null);
 assert.match(w.document.getElementById('training').textContent,/第3次选做/);
 assert.ok(w.document.getElementById('meal-gen-toggle'));
 w.addEntry('测试食物',100,100,10,10,2,'午餐');assert.equal(w.consumed().k,100);
 w.switchTab('body');w.renderReport();assert.match(w.document.getElementById('report-box').textContent,/数据不足/);
 assert.doesNotMatch(w.document.getElementById('report-box').textContent,/腹肌只是时间问题/);
 }finally{w.close();}
});
test('busy session validates fields, saves drafts, completes, survives reload and supports correction',()=>{
 const d=page(),w=d.window;let saved;try{
 w.document.getElementById('workout-mode').click();
 assert.equal(w.document.querySelectorAll('[data-wfield="reps"]').length,8);
 w.document.getElementById('workout-finish').click();assert.match(w.document.getElementById('workout-message').textContent,/未填完整/);
 for(const el of w.document.querySelectorAll('[data-wfield]')){el.value=el.dataset.wfield==='weight'?'0':'10';el.dispatchEvent(new w.Event('change',{bubbles:true}));}
 w.document.getElementById('workout-finish').click();
 assert.equal(w.state.workouts[w.todayStr()].completed,true);
 saved=JSON.parse(w.localStorage.getItem(w.LS_KEY));
 assert.equal(w.FitnessProgress.nextKind(w.state.workouts,w.todayStr()),'B');
 w.document.getElementById('workout-finish').click();assert.equal(w.state.workouts[w.todayStr()].completed,false);
 w.document.getElementById('workout-reset').click();assert.equal(w.state.workouts[w.todayStr()].deleted,true);
 }finally{w.close();}
 const reload=page(saved);try{assert.match(reload.window.document.getElementById('training').textContent,/今日已完成 A/);assert.equal(reload.window.document.querySelector('.render-err'),null);}finally{reload.window.close();}
});
test('170 jin converts to 85kg; later waist-only update keeps weight and body-fat',()=>{
 const d=page(),w=d.window;try{
 input(w,'#b-weight-unit','jin');input(w,'#b-weight','170');input(w,'#b-bodyfat','25');w.document.getElementById('b-add').click();
 assert.equal(w.state.body[0].weight,85);
 input(w,'#b-waist','100');w.document.getElementById('b-add').click();
 assert.equal(w.state.body[0].weight,85);assert.equal(w.state.body[0].waist,100);assert.equal(w.state.body[0].bodyfat,25);
 input(w,'#b-weight','168');w.document.getElementById('b-add').click();assert.equal(w.state.body[0].waist,100);
 assert.equal(w.state.body[0].weight,84);
 w.document.getElementById('bf-est').click();assert.equal(w.document.getElementById('b-bodyfat').value,'');
 }finally{w.close();}
});
test('existing custom training, auth, dishes and exercise records survive normalization',()=>{
 const d=page(),w=d.window;try{
 const old=w.defaultState();delete old.workouts;delete old.settings.trainingMode;old.settings.customPlan=[{day:'周一',title:'我的训练',items:['深蹲']}];old.settings.mealPool=['米饭'];old.exercises={x:[{name:'快走',minutes:10}]};old.auth={userId:'test',accessToken:'local-secret'};
 const n=w.normalizeState(old);assert.equal(n.settings.trainingMode,'calendar');assert.equal(n.auth.accessToken,'local-secret');assert.equal(n.settings.mealPool[0],'米饭');assert.equal(n.exercises.x[0].minutes,10);
 w.state=n;w.renderTraining();assert.equal(w.document.querySelector('.render-err'),null);
 w.document.getElementById('pv-flex').click();assert.ok(w.state.settings.customPlan);assert.equal(w.state.settings.trainingMode,'flex');
 }finally{w.close();}
});
test('service worker includes every new runtime file and only clears this app caches',()=>{
 const sw=fs.readFileSync(path.join(__dirname,'../sw.js'),'utf8');for(const name of ['progress-core.js','progress-ui.js']){assert.ok(sw.includes(name));assert.ok(fs.existsSync(path.join(__dirname,'..',name)));}
 assert.match(sw,/k.indexOf\('fatloss-'\)/);
});
test('A/B previews and all ten tutorials work without changing a draft or rotation',()=>{
 const d=page(),w=d.window;try{
 input(w,'[data-wfield="weight"]','20');input(w,'[data-wfield="reps"]','9');
 const before=JSON.stringify(w.state.workouts),saved=w.localStorage.getItem(w.LS_KEY);
 const preview=w.document.getElementById('workout-preview');preview.open=true;
 assert.equal(preview.querySelectorAll('[data-wvideo]').length,10);
 assert.equal(w.document.querySelectorAll('#training iframe').length,0);
 for(const b of preview.querySelectorAll('[data-wvideo]')){
  b.closest('.workout-tutorial').open=true;b.click();
  const f=w.document.querySelector('#training iframe');assert.ok(f);assert.match(f.src,/player\.bilibili\.com\/player\.html\?bvid=BV/);assert.match(f.src,/autoplay=0/);
  assert.equal(f.title,b.dataset.wvideo+' 视频教程');assert.equal(w.document.querySelectorAll('#training iframe').length,1);
  assert.equal(b.getAttribute('aria-expanded'),'true');
 }
 assert.equal(JSON.stringify(w.state.workouts),before);assert.equal(w.localStorage.getItem(w.LS_KEY),saved);
 assert.equal(w.document.querySelector('[data-wfield="weight"]').value,'20');
 preview.open=false;preview.dispatchEvent(new w.Event('toggle'));
 assert.equal(w.document.querySelectorAll('#training iframe').length,0);
 for(const a of preview.querySelectorAll('a')){assert.match(a.href,/^https:\/\/www\.bilibili\.com\/video\/BV\w+\/$/);assert.match(a.rel,/noopener/);}
 }finally{w.close();}
});
test('B follows a previous-day completed A and keeps tutorials in busy and completed modes',()=>{
 const d=page(),w=d.window;try{
 const yesterday=w.FitnessProgress.shift(w.todayStr(),-1);
 w.state.workouts[yesterday]={date:yesterday,kind:'A',completed:true,sets:[]};w.renderTraining();
 assert.match(w.document.getElementById('training').textContent,/本次全身训练 B/);
 const current=()=>[...w.document.querySelectorAll('[data-wvideo]')].filter(b=>b.getAttribute('aria-controls').startsWith('current-'));
 assert.equal(current().length,5);w.document.getElementById('workout-mode').click();assert.equal(current().length,4);
 for(const el of w.document.querySelectorAll('[data-wfield]')){el.value=el.dataset.wfield==='weight'?'0':'10';el.dispatchEvent(new w.Event('change',{bubbles:true}));}
 w.document.getElementById('workout-finish').click();assert.equal(w.state.workouts[w.todayStr()].kind,'B');assert.equal(w.state.workouts[w.todayStr()].completed,true);
 current()[0].click();assert.ok(w.document.querySelector('#training iframe'));assert.equal(w.state.workouts[w.todayStr()].completed,true);
 assert.equal(w.FitnessProgress.nextKind(w.state.workouts,w.todayStr()),'A');
 }finally{w.close();}
});
