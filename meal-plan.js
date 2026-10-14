(function(root,factory){
 'use strict';
 var api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.DietPlan=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 var DAY=86400000;
 function day(s){if(typeof s!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(s))return NaN;var n=Date.parse(s+'T00:00:00Z');return Number.isFinite(n)&&new Date(n).toISOString().slice(0,10)===s?n/DAY:NaN;}
 function shift(s,n){return new Date((day(s)+n)*DAY).toISOString().slice(0,10);}
 function normalize(s){
  if(!s||!Number.isFinite(day(s.start))||![7,14].includes(s.duration))return null;
  return {start:s.start,duration:s.duration,enabled:s.enabled===true,applyTargets:s.applyTargets===true,updatedAt:Number.isFinite(s.updatedAt)&&s.updatedAt>=0?s.updatedAt:0};
 }
 function active(s,today){s=normalize(s);var n=day(today);return !!s&&s.enabled&&Number.isFinite(n)&&n>=day(s.start)&&n<day(s.start)+s.duration;}
 function merge(a,b){a=normalize(a);b=normalize(b);if(!a)return b;if(!b)return a;return a.updatedAt>b.updatedAt?a:b.updatedAt>a.updatedAt?b:JSON.stringify(a)>JSON.stringify(b)?a:b;}
 var breakfasts=[
  '燕麦50g（干重）＋牛奶250ml＋鸡蛋2个',
  '全麦面包80g＋牛奶250ml＋鸡蛋2个',
  '蒸红薯250g（熟重）＋牛奶250ml＋鸡蛋2个'
 ];
 var days=[
  {b:0,l:'米饭200–250g＋去皮鸡肉约150g＋两份蔬菜',d:'香菇炒鸡胸肉200g＋米饭250g＋青菜300g',shop:[['鸡胸肉',200,'g'],['蔬菜',300,'g']]},
  {b:1,l:'清蒸鱼肉约150g（去骨）＋米饭200–250g＋两份蔬菜',d:'清蒸鱼肉250g＋米饭250g＋西兰花、胡萝卜共300g',shop:[['去骨鱼肉',250,'g'],['蔬菜',300,'g']]},
  {b:2,l:'去皮鸡肉约150g＋米饭200–250g＋两份蔬菜；酱汁另放',d:'番茄炖瘦牛肉200g＋米饭250g＋绿叶菜300g',shop:[['瘦牛肉',200,'g'],['蔬菜',300,'g']]},
  {b:0,l:'虾或鸡肉约150g＋米饭200–250g＋两份蔬菜；肉少可加豆腐',d:'虾仁150g＋北豆腐200g＋米饭200g＋青菜300g',shop:[['去壳虾仁',150,'g'],['北豆腐',200,'g'],['蔬菜',300,'g']]},
  {b:1,l:'清炒瘦肉、白切鸡或蒸鱼约150g＋米饭200–250g＋两份蔬菜',d:'青椒炒猪里脊200g＋米饭250g＋菌菇、青菜共300g',shop:[['猪里脊',200,'g'],['蔬菜',300,'g']]},
  {b:2,l:'鸡肉或鱼肉约150g＋米饭200–250g＋两份蔬菜',d:'清蒸鱼肉250g＋米饭250g＋时蔬300g',shop:[['去骨鱼肉',250,'g'],['蔬菜',300,'g']]},
  {b:0,l:'食堂按前述份量搭配；有聚餐就作为这一餐，记录实际所吃',d:'去皮鸡腿肉200g＋米饭250g＋西葫芦、青菜共300g',shop:[['去皮去骨鸡腿肉',200,'g'],['蔬菜',300,'g']]}
 ];
 function menu(start,duration){if(!Number.isFinite(day(start))||![7,14].includes(duration))return [];return Array.from({length:duration},function(_,i){var d=days[i%7];return {date:shift(start,i),number:i+1,breakfast:breakfasts[d.b],lunch:d.l,dinner:d.d,snack:'牛奶250ml＋新鲜水果200–300g＋原味坚果10g'};});}
 function shopping(duration){if(![7,14].includes(duration))return [];var times=duration/7,tot={};function add(n,g,u){if(!tot[n])tot[n]={name:n,amount:0,unit:u};tot[n].amount+=g*times;}
  days.forEach(function(d){d.shop.forEach(function(x){add(x[0],x[1],x[2]);});});
  [['牛奶',3500,'ml'],['鸡蛋',14,'个'],['燕麦（干）',150,'g'],['全麦面包',160,'g'],['红薯（熟重参考）',500,'g'],['水果（至少）',1400,'g'],['原味坚果',70,'g']].forEach(function(x){add(x[0],x[1],x[2]);});
  return Object.values(tot);
 }
 var view=null,form=null;
 function render(){
  var box=document.getElementById('weekly-diet');if(!box)return;
  var today=todayStr(),s=normalize(state.settings.dietSchedule),cfg=form||s||{start:today,duration:14,applyTargets:true};
  var arr=menu(cfg.start,cfg.duration);if(!arr.length){form=null;cfg={start:today,duration:14,applyTargets:true};arr=menu(cfg.start,cfg.duration);}
  var running=active(s,today),planned=s&&s.enabled;
  document.getElementById('standard-meal-card').style.display=running?'none':'';
  var index=view==null?Math.max(0,Math.min(arr.length-1,day(today)-day(cfg.start))):Math.max(0,Math.min(arr.length-1,view));
  var selected=arr[index],status=planned?(day(today)<day(s.start)?'尚未开始':running?'正在执行':'本轮已结束'):'预览菜单';
  var html='<h3>🗓️ 一周 / 两周饮食计划</h3><p class="note">食堂或外卖午餐＋家常晚餐。'+status+'；第二周重复第一周，方便采购和比较效果。</p>';
  html+='<details id="diet-settings"'+(!planned||form?' open':'')+'><summary>设置开始日期、长度和每日目标</summary><div class="row" style="flex-wrap:wrap"><label>开始日期 <input id="diet-start" aria-label="饮食计划开始日期" type="date" value="'+esc(cfg.start)+'"></label><label>计划长度 <select id="diet-duration" aria-label="饮食计划长度"><option value="7"'+(cfg.duration===7?' selected':'')+'>一周（7天）</option><option value="14"'+(cfg.duration===14?' selected':'')+'>两周（14天）</option></select></label></div>';
  html+='<p class="note"><label><input id="diet-targets" type="checkbox" style="width:auto;margin-right:6px"'+(cfg.applyTargets?' checked':'')+'> 开始后采用参考目标：2100千卡、蛋白140g、脂肪65g、碳水239g</label></p><p class="note">每天2000–2200千卡、蛋白约140g为试行目标，菜单不保证精确达标；份量、食堂油和品牌会影响实际摄入。取消勾选则保留原来的公式目标。计划结束或停止后恢复公式目标。</p>';
  html+='<div class="row"><button class="btn small" id="diet-apply">'+(planned?'保存计划设置':'开始这份计划')+'</button>'+(planned?'<button class="btn small ghost" id="diet-stop">停止计划</button>':'')+'</div></details><p class="note" id="diet-message" role="status"></p>';
  html+='<p class="note"><b>称重口径：</b>米饭按熟重；午餐肉按熟重、去骨净肉；晚餐肉鱼虾按生重、去骨去壳；蔬菜按生重。燕麦按干重。晚餐用油约10g，包含这餐全部菜；食堂油量需另行估算。</p>';
  html+='<label>查看哪一天 <select id="diet-day" aria-label="查看饮食计划日期">'+arr.map(function(x,i){return '<option value="'+i+'"'+(i===index?' selected':'')+'>第'+x.number+'天 · '+x.date+(x.date===today?' · 今天':'')+'</option>';}).join('')+'</select></label><div class="row" style="margin-top:8px"><button class="btn small ghost" id="diet-prev"'+(index===0?' disabled':'')+'>前一天</button><button class="btn small ghost" id="diet-today">回到今天</button><button class="btn small ghost" id="diet-next"'+(index===arr.length-1?' disabled':'')+'>后一天</button></div>';
  html+='<p><b>第'+selected.number+'天 · '+selected.date+'</b>'+(selected.date===today?' · 今日菜单':' · 预览')+'</p>';
  [['早餐',selected.breakfast],['午餐',selected.lunch],['晚餐',selected.dinner],['加餐',selected.snack]].forEach(function(x){html+='<div class="workout-ex"><b>'+x[0]+'</b><p>'+esc(x[1])+'</p></div>';});
  html+='<button class="btn small ghost" id="diet-record">去记录今天实际吃的食物</button><p class="note">菜单不会自动计入“今日已吃”。记录时选择实际食物、份量和生熟口径；预览其他日期也不会向过去或未来添加记录。</p>';
  html+='<details><summary>查看整份'+cfg.duration+'天菜单</summary>'+arr.map(function(x){return '<details style="margin:8px 0"><summary>第'+x.number+'天 · '+x.date+'</summary><p>早餐：'+esc(x.breakfast)+'</p><p>午餐：'+esc(x.lunch)+'</p><p>晚餐：'+esc(x.dinner)+'</p><p>加餐：'+esc(x.snack)+'</p></details>';}).join('')+'</details>';
  html+='<details style="margin-top:12px"><summary>采购清单（早餐、晚餐和加餐）</summary><ul>'+shopping(cfg.duration).map(function(x){return '<li>'+esc(x.name)+'：'+x.amount+x.unit+'</li>';}).join('')+'</ul><p class="note">不包括公司午餐。水果可多买一些，每天200–300g；米饭按家中库存准备，蔬菜按菜谱选不同颜色。肉鱼可分装冷冻，奶、蔬果按保质期分批购买；这份清单用于采购，不代表营养分析。</p></details>';
  html+='<details style="margin-top:12px"><summary>执行与两周复盘</summary><p class="note">训练日先按同一目标吃，可把牛奶和水果移到训练前，不额外重复吃。食堂肉少时补豆腐、鸡蛋或奶，并记录实际摄入。晨起体重看连续均值，腰围每周按同一方法量一次，同时关注饥饿感和训练状态；不因单日涨跌减饭，不保证两周减多少。</p><p class="note">依据：<a href="https://ods.od.nih.gov/factsheets/ExerciseAndAthleticPerformance-HealthProfessional/" target="_blank" rel="noopener noreferrer">NIH运动营养</a> · <a href="https://dg.cnsoc.org/article/04/70JvPbFmTlyZbjoO67LeRg.html" target="_blank" rel="noopener noreferrer">中国居民膳食指南</a> · <a href="https://www.niddk.nih.gov/health-information/weight-management/adult-overweight-obesity/eating-physical-activity" target="_blank" rel="noopener noreferrer">体重管理</a>。2100千卡为参考起点，不是测得的个人消耗。</p></details>';
  box.innerHTML=html;
 }
 function init(){var box=document.getElementById('weekly-diet');if(!box)return;
  box.addEventListener('change',function(e){
   if(e.target.id==='diet-day'){view=Number(e.target.value);render();return;}
   if(['diet-start','diet-duration','diet-targets'].includes(e.target.id)){
    var start=document.getElementById('diet-start').value;if(!Number.isFinite(day(start))){document.getElementById('diet-message').textContent='请填写有效的开始日期。';return;}
    form={start:start,duration:Number(document.getElementById('diet-duration').value),applyTargets:document.getElementById('diet-targets').checked};view=null;render();
   }
  });
  box.addEventListener('click',function(e){var b=e.target.closest('button');if(!b)return;
   if(b.id==='diet-record'){switchTab('log');return;}
   if(['diet-prev','diet-next','diet-today'].includes(b.id)){var count=Number(document.getElementById('diet-duration').value),start=document.getElementById('diet-start').value;view=b.id==='diet-today'?Math.max(0,Math.min(count-1,day(todayStr())-day(start))):Number(document.getElementById('diet-day').value)+(b.id==='diet-next'?1:-1);render();return;}
   if(!['diet-apply','diet-stop'].includes(b.id))return;
   var old=state.settings.dietSchedule,s=normalize({start:document.getElementById('diet-start').value,duration:Number(document.getElementById('diet-duration').value),applyTargets:document.getElementById('diet-targets').checked,enabled:b.id==='diet-apply',updatedAt:Math.max(Date.now(),((old&&old.updatedAt)||0)+1)});
   if(!s){document.getElementById('diet-message').textContent='请检查开始日期和计划长度。';return;}
   state.settings.dietSchedule=s;if(save()===false){state.settings.dietSchedule=old;document.getElementById('diet-message').textContent='保存失败，请检查浏览器存储并先导出备份。';return;}
   form=null;view=null;renderToday();showToast(s.enabled?'饮食计划已保存；菜单不等于已吃':'计划已停止，恢复原三餐建议');
  });render();
 }
 return {normalize:normalize,active:active,merge:merge,menu:menu,shopping:shopping,render:render,init:init};
});
