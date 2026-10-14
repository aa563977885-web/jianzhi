const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {JSDOM}=require('jsdom');
const D=require('../meal-plan.js');
function page(seed,integrated=false){
 const root=path.join(__dirname,'..'),html=fs.readFileSync(path.join(root,integrated?'richang/fitness.html':'index.html'),'utf8');
 const d=new JSDOM(html,{url:integrated?'https://example.test/jianzhi/richang/fitness.html':'https://example.test/jianzhi/',runScripts:'outside-only',pretendToBeVisual:true});
 const w=d.window;w.alert=()=>{};w.confirm=()=>true;w.scrollTo=()=>{};w.fetch=()=>Promise.reject(new Error('External requests disabled'));
 if(seed)w.localStorage.setItem(html.match(/var LS_KEY='([^']+)'/)[1],JSON.stringify(seed));
 for(const s of w.document.querySelectorAll('script'))vm.runInContext(s.src?fs.readFileSync(path.join(root,s.getAttribute('src').split('?')[0]),'utf8'):s.textContent,d.getInternalVMContext());
 return d;
}
function change(w,id,value){const el=w.document.getElementById(id);if(el.type==='checkbox')el.checked=value;else el.value=value;el.dispatchEvent(new w.Event('change',{bubbles:true}));}
test('schedule validates dates and boundaries; fourteen days repeat menus with distinct dates',()=>{
 assert.equal(D.normalize({start:'2026-02-30',duration:14}),null);assert.equal(D.normalize({start:'2026-10-14',duration:8}),null);
 const s={start:'2026-12-28',duration:7,enabled:true};assert.equal(D.active(s,'2026-12-27'),false);assert.equal(D.active(s,'2027-01-03'),true);assert.equal(D.active(s,'2027-01-04'),false);
 const m=D.menu('2026-12-28',14);assert.equal(m.length,14);assert.equal(m[7].date,'2027-01-04');assert.equal(m[0].dinner,m[7].dinner);assert.equal(m[13].number,14);
 assert.equal(D.shopping(14).find(x=>x.name==='牛奶').amount,7000);assert.equal(D.shopping(7).find(x=>x.name==='蔬菜').amount,2100);
});
test('starting, previewing and recording navigation do not invent consumption; stop restores targets',()=>{
 const d=page(),w=d.window;try{
 const original=w.calc(w.state.profile).intake,logs=JSON.stringify(w.state.logs);
 assert.equal(w.document.getElementById('diet-duration').value,'14');w.document.getElementById('diet-apply').click();
 assert.equal(w.calc(w.state.profile).intake,2100);assert.equal(w.calc(w.state.profile).protein,140);assert.match(w.document.getElementById('target-card').textContent,/计划参考值/);
 assert.equal(w.document.getElementById('standard-meal-card').style.display,'none');assert.equal(JSON.stringify(w.state.logs),logs);
 change(w,'diet-day','13');assert.match(w.document.getElementById('weekly-diet').textContent,/第14天/);assert.equal(JSON.stringify(w.state.logs),logs);
 w.document.getElementById('diet-record').click();assert.equal(w.document.querySelector('main section.on').id,'tab-log');assert.equal(JSON.stringify(w.state.logs),logs);
 w.document.getElementById('diet-stop').click();assert.equal(w.calc(w.state.profile).intake,original);assert.equal(w.document.getElementById('standard-meal-card').style.display,'');
 }finally{w.close();}
});
test('settings reload, preserve custom meal plans and expire without overriding profile',()=>{
 let saved;const d=page(),w=d.window;try{
 const profile=JSON.stringify(w.state.profile);w.state.settings.customMealPlan={genAt:'test',days:[{name:'Existing',meals:w.PLAN_VARIANTS[0].meals}]};
 change(w,'diet-duration','7');change(w,'diet-targets',false);w.document.getElementById('diet-apply').click();
 assert.equal(w.state.settings.dietSchedule.duration,7);assert.equal(JSON.stringify(w.state.profile),profile);assert.notEqual(w.calc(w.state.profile).intake,2100);
 saved=JSON.parse(w.localStorage.getItem(w.LS_KEY));assert.equal(saved.settings.customMealPlan.days[0].name,'Existing');
 }finally{w.close();}
 const reload=page(saved);try{assert.equal(reload.window.document.getElementById('diet-duration').value,'7');assert.equal(reload.window.document.getElementById('diet-targets').checked,false);}finally{reload.window.close();}
 const expired=page(saved);try{const q=expired.window;q.state.settings.dietSchedule.start=q.FitnessProgress.shift(q.todayStr(),-7);q.state.settings.dietSchedule.applyTargets=true;q.renderToday();assert.match(q.document.getElementById('weekly-diet').textContent,/本轮已结束/);assert.notEqual(q.calc(q.state.profile).intake,2100);assert.equal(q.document.getElementById('standard-meal-card').style.display,'');}finally{expired.window.close();}
});
test('newer stop survives older remote settings; invalid input and failed save do not activate',()=>{
 const d=page(),w=d.window;try{
 const s={start:w.todayStr(),duration:14,enabled:false,applyTargets:true,updatedAt:20};w.state.settings.dietSchedule=s;
 const remote=w.defaultState();remote.settings.dietSchedule={...s,enabled:true,updatedAt:10};assert.equal(w.mergeState(w.state,remote,true).settings.dietSchedule.enabled,false);
 change(w,'diet-start','');w.document.getElementById('diet-apply').click();assert.equal(w.state.settings.dietSchedule.enabled,false);assert.match(w.document.getElementById('diet-message').textContent,/检查/);
 w.DietPlan.render();w.save=()=>false;w.document.getElementById('diet-apply').click();assert.equal(w.state.settings.dietSchedule.enabled,false);assert.match(w.document.getElementById('diet-message').textContent,/保存失败/);
 }finally{w.close();}
});
test('daily-journal integrated layout retains diet card and same shared behavior',()=>{
 const d=page(null,true),w=d.window;try{
 const box=w.document.getElementById('weekly-diet');assert.ok(box);assert.equal(box.closest('section').id,'tab-log');assert.equal(w.document.querySelector('.render-err'),null);
 w.document.getElementById('diet-apply').click();assert.equal(w.calc(w.state.profile).intake,2100);assert.ok(w.document.getElementById('weekly-diet'));assert.equal(w.document.querySelector('.render-err'),null);
 assert.match(fs.readFileSync(path.join(__dirname,'../sw.js'),'utf8'),/meal-plan\.js/);
 }finally{w.close();}
});
