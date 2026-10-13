(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory();
  else root.FitnessProgress=factory();
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  var DAY=86400000;
  function day(s){
    if(typeof s!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(s))return NaN;
    var n=Date.parse(s+'T00:00:00Z');
    return Number.isFinite(n)&&new Date(n).toISOString().slice(0,10)===s?n/DAY:NaN;
  }
  function shift(s,n){return new Date((day(s)+n)*DAY).toISOString().slice(0,10);}
  function valid(n){return typeof n==='number'&&Number.isFinite(n)&&n>0;}
  function bodyRows(rows,today){
    var byDate={};
    (rows||[]).forEach(function(r){if(r&&Number.isFinite(day(r.date))&&day(r.date)<=day(today)&&valid(r.weight)&&r.weight<300)byDate[r.date]=r;});
    return Object.values(byDate).sort(function(a,b){return a.date.localeCompare(b.date);});
  }
  function week(rows,today,offset){
    var end=day(today)-offset*7;
    var sample=rows.filter(function(r){var d=day(r.date);return d<=end&&d>end-7;});
    return {count:sample.length,mean:sample.length>=3?sample.reduce(function(n,r){return n+r.weight;},0)/sample.length:null};
  }
  function trend(rows,today){
    var b=bodyRows(rows,today),weeks=[0,1,2].map(function(i){return week(b,today,i);});
    var delta=weeks[0].mean!==null&&weeks[1].mean!==null?weeks[0].mean-weeks[1].mean:null;
    var waists=b.filter(function(r){return valid(r.waist)&&r.waist>=30&&r.waist<=250;});
    var latest=waists.at(-1)||null,prior=null;
    if(latest)prior=waists.filter(function(r){var gap=day(latest.date)-day(r.date);return gap>=7&&gap<=28;}).at(-1)||null;
    var waistDelta=latest&&prior&&day(today)-day(latest.date)<=14?latest.waist-prior.waist:null;
    return {rows:b,weeks:weeks,delta:delta,latest:b.at(-1)||null,waist:latest,waistDelta:waistDelta,
      flat:weeks.every(function(w){return w.mean!==null;})&&Math.abs(weeks[0].mean-weeks[1].mean)<0.2&&Math.abs(weeks[1].mean-weeks[2].mean)<0.2};
  }
  function advice(t){
    if(t.delta===null)return '趋势数据不足：近7天和前7天各记录至少3天晨起体重，再比较均值。先保持可执行的饮食和训练安排，不因单日涨跌调整热量。';
    if(t.waistDelta!==null&&t.waistDelta<=-0.5)return '腰围记录在下降。继续观察体重周均值和力量表现，暂不因为秤重变化小就继续少吃；腰围请始终按同一方法测量。';
    if(t.delta<0&&-t.delta/t.weeks[1].mean>0.01)return '近期体重均值下降较快，也可能含水分变化。先核对测量条件和恢复状态；若持续疲劳、饥饿或力量下降，不要继续扩大热量缺口。';
    if(t.flat)return '连续三个7天窗口的体重均值接近，值得复核外卖油酱、周末漏记、日常活动和恢复情况。这不等于已确认平台期，不自动改变热量或活动系数。';
    if(t.delta< -0.1)return '体重均值在下降。结合腰围和训练记录继续观察；体重下降本身不能证明减少的都是脂肪。';
    return '体重均值暂未明显下降。先核对记录完整性、盐分和训练后的水分变化，继续观察腰围；暂不自动减少饮食。';
  }
  function sessions(workouts,today){return Object.values(workouts||{}).filter(function(w){return w&&!w.deleted&&w.completed&&['A','B'].includes(w.kind)&&Number.isFinite(day(w.date))&&w.date<=today;}).sort(function(a,b){return a.date.localeCompare(b.date);});}
  function nextKind(workouts,today){var last=sessions(workouts,today).at(-1);return last&&last.kind==='A'?'B':'A';}
  function weeklySessions(workouts,today){var start=day(today)-(new Date(day(today)*DAY).getUTCDay()+6)%7;return sessions(workouts,today).filter(function(w){return day(w.date)>=start;});}
  function validSet(s){return s&&typeof s.exercise==='string'&&s.exercise.length<=80&&typeof s.weight==='number'&&Number.isFinite(s.weight)&&s.weight>=0&&s.weight<=500&&Number.isInteger(s.reps)&&s.reps>=1&&s.reps<=100;}
  function mergeWorkouts(local,remote){
    var out=JSON.parse(JSON.stringify(local||{}));
    Object.keys(remote||{}).forEach(function(k){
      var r=remote[k],l=out[k];
      if(!r||r.date!==k||!Number.isFinite(day(k)))return;
      if(!l||(Number(r.updatedAt)||0)>(Number(l.updatedAt)||0)||((Number(r.updatedAt)||0)===(Number(l.updatedAt)||0)&&JSON.stringify(r)>JSON.stringify(l)))out[k]=JSON.parse(JSON.stringify(r));
    });
    return out;
  }
  return {day:day,shift:shift,trend:trend,advice:advice,sessions:sessions,nextKind:nextKind,weeklySessions:weeklySessions,validSet:validSet,mergeWorkouts:mergeWorkouts};
});
