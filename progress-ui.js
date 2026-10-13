/* UI uses the existing page's state, save and navigation functions. */
var FitnessProgressUI=(function(){
 'use strict';
 var P=FitnessProgress;
 var plans={
  A:[['腿举','8–12次','使用熟悉的器械，膝盖沿脚尖方向移动'],['器械推胸','8–12次','肩背稳定，控制下放'],['坐姿划船','8–12次','不靠后仰甩动重量'],['腿弯举','10–15次','用可控制的重量完成'],['绳索卷腹','10–15次','腹部收缩，避免只用手臂拉绳']],
  B:[['臀桥','8–12次','髋部伸展，避免腰部过度后仰'],['高位下拉','8–12次','拉向胸前，不做颈后下拉'],['上斜哑铃卧推','8–12次','哑铃按单只重量记录'],['分腿蹲','每侧8–12次','左右各完成，次数按单侧记录；负重按总重量'],['反向卷腹','10–15次','缓慢卷起骨盆，避免甩腿']]
 };
 function signed(n){return (n>0?'+':'')+n.toFixed(1);}
 function field(id){return document.getElementById(id);}
 function stamp(w){w.updatedAt=Math.max(Date.now(),(Number(w.updatedAt)||0)+1);}
 function draft(){var w=(state.workouts||{})[todayStr()];return w&&!w.deleted?w:null;}
 function current(){var w=draft();return w&&['A','B'].includes(w.kind)&&Array.isArray(w.sets)?w:{date:todayStr(),kind:P.nextKind(state.workouts,todayStr()),mode:'full',sets:[],completed:false};}
 function rows(w){var out=[];plans[w.kind||'A'].forEach(function(ex,i){if(w.mode==='busy'&&i===3)return;var count=w.mode==='busy'||i===4?2:3;for(var j=0;j<count;j++)out.push({id:i*3+j,exercise:ex[0],group:i,set:j+1,range:ex[1],tip:ex[2]});});return out;}
 function previous(name){return P.sessions(state.workouts,todayStr()).filter(function(w){return w.date<todayStr()&&w.sets.some(function(s){return s&&s.exercise===name&&P.validSet(s);});}).at(-1);}
 function training(){
  var w=current(),done=P.weeklySessions(state.workouts,todayStr()).length;
  ['pv-home','pv-gym'].forEach(function(id){field(id).className='btn small ghost';});
  field('pv-flex').className='btn small on';
  var h='<div class="focus-banner"><b>每周2次为基础 · 第3次选做</b><p>本周已完成 '+done+' 次'+(done>=2?' · 基础目标已完成':' · 距基础目标还差 '+(2-done)+' 次')+'。按 A / B 接着练，错过一天不跳过训练。</p></div>';
  h+='<div class="row"><b>'+ (w.completed?'今日已完成 ':'本次全身训练 ')+esc(w.kind)+'</b><button class="btn small ghost" id="workout-mode"'+(w.completed?' disabled':'')+'>'+(w.mode==='busy'?'切换完整训练':'忙碌模式：减少组数')+'</button></div>';
  h+='<p class="note">'+(w.mode==='busy'?'精简版：4个动作，每个2组。':'完整版本：前4个动作各3组，腹部动作2组。')+' 热身组不计入；初次恢复训练可选精简版。每组结束时保留约2–3次余力，组间休息到能稳定完成下一组。相邻全身训练日之间安排恢复日。</p>';
  h+='<p class="note">填写实际完成的数据；自重填0，器械记录标示重量。这里只比较同一动作、同一器械和相同记录方式。</p>';
  var all=rows(w),group=-1;
  all.forEach(function(r){
   if(group!==r.group){
    if(group!==-1)h+='</div>';
    group=r.group;var last=previous(r.exercise);
    h+='<div class="workout-ex"><h4>'+esc(r.exercise)+' <span class="dim">'+esc(r.range)+'</span></h4><p class="note">'+esc(r.tip)+'</p>';
    h+='<p class="workout-last">'+(last?'上次 '+esc(last.date)+'：'+last.sets.filter(function(s){return s&&s.exercise===r.exercise&&P.validSet(s);}).map(function(s){return s.weight+'kg × '+s.reps;}).join(' / '):'还没有这个动作的历史记录，从能控制的重量开始。')+'</p>';
    h+='<div class="workout-set workout-label"><span>组</span><span>负重 kg</span><span>次数</span></div>';
   }
   var s=w.sets[r.id]||{};
   h+='<div class="workout-set"><span>'+r.set+'</span><input aria-label="'+esc(r.exercise)+' 第'+r.set+'组负重" type="number" min="0" max="500" step="0.5" placeholder="自重填0" data-ws="'+r.id+'" data-wfield="weight" value="'+(s.weight==null?'':Number(s.weight))+'"'+(w.completed?' disabled':'')+'><input aria-label="'+esc(r.exercise)+' 第'+r.set+'组次数" type="number" min="1" max="100" step="1" placeholder="实际次数" data-ws="'+r.id+'" data-wfield="reps" value="'+(s.reps==null?'':Number(s.reps))+'"'+(w.completed?' disabled':'')+'></div>';
  });
  h+='</div><p class="note">所有计划组都能稳定完成次数上限、仍有余力时，再考虑最小幅度加重。漏练不需要加倍补练；第三次训练不影响本周达标。</p><p id="workout-message" role="status" class="note"></p>';
  h+='<div class="row"><button class="btn" id="workout-finish">'+(w.completed?'修改今日训练':'保存并完成本次训练')+'</button><button class="btn small ghost" id="workout-reset">清除今日训练</button></div>';
  var history=P.sessions(state.workouts,todayStr()).slice(-6).reverse();
  h+='<details style="margin-top:14px"><summary>最近训练记录（'+history.length+'次）</summary>'+history.map(function(x){return '<p>'+esc(x.date)+' · '+esc(x.kind)+' · '+(x.mode==='busy'?'精简版':'完整版')+' · '+rows(x).filter(function(r){return P.validSet(x.sets[r.id]);}).length+'组</p>';}).join('')+'</details>';
  field('training').innerHTML=h;
 }
 function overview(){
  var t=P.trend(state.body,todayStr()),w=t.weeks[0],last=P.sessions(state.workouts,todayStr()).at(-1);
  var html='<h3>📈 减脂与训练进度</h3><div class="chips">'+chip(w.mean===null?'待记录':w.mean.toFixed(1)+'kg','近7天均重 · '+w.count+'天')+chip(t.delta===null?'数据不足':signed(t.delta)+'kg','与前7天均值比较')+chip(t.waist?t.waist.waist+'cm':'待补录','最近腰围')+chip(P.weeklySessions(state.workouts,todayStr()).length+'/2','本周全身训练 · 第3次选做')+'</div>';
  html+='<p class="note">'+esc(P.advice(t))+'</p><p class="note">'+(t.waist?'腰围测量日期：'+esc(t.waist.date)+(t.waistDelta!==null?'；较此前测量 '+signed(t.waistDelta)+'cm。':'；暂缺近期可比记录。'):'腰围可以稍后补录，不影响记录体重和训练。')+'</p>';
  html+='<p class="note">'+(last?'最近训练：'+esc(last.date)+' · '+esc(last.kind)+'。在训练卡片查看同动作的上次重量与次数。':'力量表现尚无记录；完成训练后可逐次对照重量和次数。')+'</p>';
  if(field('progress-overview'))field('progress-overview').innerHTML=html;
  return {html:html,trend:t};
 }
 function body(){
  var o=overview(),t=o.trend;
  field('b-summary').innerHTML=o.html+'<p class="note">每个7天窗口至少3个不同日期的体重才显示均值比较。这是记录完整性规则，不是医学诊断。单日变化不代表脂肪变化；目标体重也不等于腹肌出现。</p>';
 }
 function report(){
  var t=P.trend(state.body,todayStr()),ds=lastNDays(7),logDays=0,kcal=0,mins=0;
  ds.forEach(function(d){var arr=state.logs[d]||[];if(arr.length){logDays++;arr.forEach(function(x){kcal+=Number(x.k)||0;});}(state.exercises[d]||[]).forEach(function(x){mins+=Number(x.minutes)||0;});});
  var trained=P.sessions(state.workouts,todayStr()).filter(function(w){return ds.includes(w.date);}).length;
  field('report-box').innerHTML='<div class="stat-grid"><div class="stat"><b>'+trained+'</b><span>近7天全身训练次数</span></div><div class="stat"><b>'+logDays+'/7</b><span>有饮食记录的天数</span></div><div class="stat"><b>'+(logDays?Math.round(kcal/logDays):'—')+'</b><span>有记录日的热量均值</span></div><div class="stat"><b>'+Math.round(mins)+'</b><span>运动记录分钟（含估算）</span></div><div class="stat"><b>'+(t.weeks[0].mean===null?'—':t.weeks[0].mean.toFixed(1)+'kg')+'</b><span>近7天体重均值</span></div><div class="stat"><b>'+(t.delta===null?'—':signed(t.delta)+'kg')+'</b><span>较前7天均值</span></div></div><p class="note">'+esc(P.advice(t))+'</p><p class="note">热量均值只统计有记录的日子，可能包含漏记，不能当作真实日均摄入。生活打卡、运动分钟和完成力量训练分别统计，不以连续打卡预测腹肌。</p>';
 }
 function changed(){if(save()===false)return false;overview();safeRender('report-box',renderReport);return true;}
 function init(){
  field('pv-flex').addEventListener('click',function(){state.settings.trainingMode='flex';save();field('plan-editor').style.display='none';renderTraining();renderTarget();});
  field('training').addEventListener('change',function(e){
   var el=e.target;if(!el.hasAttribute('data-ws'))return;
   var w=current();if(w.completed)return;
   var r=rows(w).find(function(x){return x.id===Number(el.dataset.ws);});if(!r)return;
   var n=el.value===''?null:Number(el.value),key=el.dataset.wfield;
   if(n!==null&&(!Number.isFinite(n)||n<0||(key==='reps'&&(!Number.isInteger(n)||n<1||n>100))||(key==='weight'&&n>500))){field('workout-message').textContent='请检查负重和次数；负重可填0，次数须为1–100的整数。';el.value='';n=null;}
   w.sets[r.id]=w.sets[r.id]||{exercise:r.exercise,weight:null,reps:null};w.sets[r.id][key]=n;
   stamp(w);state.workouts[w.date]=w;if(!changed())field('workout-message').textContent='本次输入未能保存，请先导出备份并检查浏览器存储。';
  });
  field('training').addEventListener('click',function(e){
   var b=e.target.closest('button');if(!b)return;
   if(!['workout-mode','workout-finish','workout-reset'].includes(b.id))return;
   var w=current();
   if(b.id==='workout-reset'){
    if(!confirm('清除今日训练记录？其他日期和饮食记录不会改变。'))return;
    w={date:todayStr(),deleted:true,updatedAt:w.updatedAt};
   }else if(b.id==='workout-mode'){w.mode=w.mode==='busy'?'full':'busy';}
   else if(w.completed){w.completed=false;}
   else{
    if(!rows(w).every(function(r){return P.validSet(w.sets[r.id]);})){field('workout-message').textContent='还有计划组未填完整。请填写实际负重和次数；时间不够可先切换忙碌模式。';return;}
    w.completed=true;
   }
   stamp(w);state.workouts[w.date]=w;var saved=changed();renderTraining();renderTarget();
   if(!saved){field('workout-message').textContent='本次修改未能保存，请先导出备份并检查浏览器存储。';return;}
   showToast(w.deleted?'今日训练已清除':w.completed?'本次已完成，下次接着练另一套':'训练草稿已保存');
  });
  field('b-weight-unit').addEventListener('change',function(){field('b-weight').placeholder=this.value==='jin'?'体重 斤（170斤=85kg）':'体重 kg';});
  renderTraining();overview();renderBody();
 }
 return {training:training,overview:overview,body:body,report:report,init:init};
})();
