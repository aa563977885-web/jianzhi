(function(){
 'use strict';
 var q=function(id){return document.getElementById(id);};
 function el(tag,cls,html){var n=document.createElement(tag);n.className=cls||'';if(html)n.innerHTML=html;return n;}
 function card(id){return q(id).closest('.card');}
 function group(label,nodes){var d=el('details','fitness-fold');d.appendChild(el('summary','',label+'<span aria-hidden="true">＋</span>'));nodes.forEach(function(n){d.appendChild(n);});return d;}
 function heading(kicker,title,sub){return el('div','fitness-heading','<span>'+kicker+'</span><h2>'+title+'</h2><p>'+sub+'</p>');}
 var today=q('tab-today'),main=today.parentElement;
 var water=card('water-row'),checkin=card('checkin-box'),tip=card('tip'),target=card('target-body'),progress=card('progress-overview'),meals=card('plan-list'),training=card('training'),courses=card('fl-list'),movement=card('exlog-list');
 var trainingPage=el('section');trainingPage.id='tab-training';main.appendChild(trainingPage);
 var more=el('section');more.id='tab-more';main.appendChild(more);
 trainingPage.appendChild(heading('MOVE & TRAIN','按自己的节奏，动起来','先记实际运动，训练计划需要时再展开。'));
 movement.querySelector('h3').childNodes[0].textContent='运动简记 ';
 trainingPage.appendChild(movement);trainingPage.appendChild(group('训练计划与力量记录',[training]));trainingPage.appendChild(group('跟练课程与动作参考',[courses]));
 more.appendChild(heading('TOOLS & SETTINGS','需要时，再多看一步','计划、教练和个人设置集中在这里。'));
 more.appendChild(el('div','fitness-tools','<button data-tab="coach"><span>↗</span><b>AI 教练</b><small>提问与训练、饮食反馈</small></button><button data-tab="profile"><span>⚙</span><b>个人与设置</b><small>档案、AI 配置、同步与备份</small></button><button data-tab="out"><span>◷</span><b>外食参考</b><small>外卖、便利店和聚餐</small></button><button data-tab="report"><span>▥</span><b>健身周报与徽章</b><small>查看原助手的统计与成就</small></button>'));
 more.appendChild(group('三餐建议与自选计划',[meals]));more.appendChild(group('热量目标与计算方式',[target]));more.appendChild(group('更多进度参考',[progress]));
 // Move the existing nodes so their inputs, handlers and saved data keep working.
 today.replaceChildren();today.appendChild(heading('ONE DAY AT A TIME','先记下今天','饮食、运动、体重，记一项也算开始。'));
 var quick=el('div','fitness-quick','<button data-tab="log"><span>＋</span><b>记饮食</b><small>吃了什么</small></button><button data-tab="training"><span>↗</span><b>记运动</b><small>练了多久</small></button><button data-tab="body"><span>◷</span><b>记体重</b><small>今天的测量</small></button>');today.appendChild(quick);
 var statusCard=el('article','card fitness-status-card','<h3>记录当天状态</h3><form id="fitness-status-form"><div class="fitness-status-date"><label>记录日期<input id="fitness-status-date" name="date" type="date" required></label><span id="fitness-status-saved" role="status" aria-live="polite">正在加载…</span></div><div class="fitness-status-fields"><label>运动时长 · 分钟<input name="movement" type="number" min="0" max="1440" step="0.1" placeholder="例如 30，休息填 0"></label><label>睡眠时长 · 小时<input name="sleep" type="number" min="0" max="24" step="0.1" placeholder="例如 7.5"></label><label class="fitness-status-wide">当天精力<select name="energy"><option value="">暂不记录</option><option value="1">1 · 很疲惫</option><option value="2">2 · 有些疲惫</option><option value="3">3 · 一般</option><option value="4">4 · 状态不错</option><option value="5">5 · 精力充沛</option></select></label></div><p id="fitness-status-linked" class="note"></p><label class="fitness-status-wide">运动内容与身体感受<textarea name="exercise" rows="2" maxlength="3000" placeholder="例如：快走 30 分钟，练后精神不错；也可以记录今天休息"></textarea></label><button id="fitness-status-submit" class="btn" type="submit" disabled>保存当天状态</button><p class="note fitness-status-help">保存后会更新每日记录、今日概览和周报。饮食、饮水与运动明细按各自入口即时保存。</p></form>');today.appendChild(statusCard);
 var compact=el('div','fitness-stats');compact.id='fitness-compact';today.appendChild(compact);today.appendChild(water);today.appendChild(group('生活打卡与今日提示',[checkin,tip]));
 var log=q('tab-log'),foodCard=card('food-search'),photo=log.querySelector('[data-tab="photo"]'),outside=log.querySelector('[data-tab="out"]'),nutrition=card('log-summary'),history=card('log-list');
 outside.remove();log.replaceChildren();log.appendChild(heading('FOOD LOG','记下今天吃了什么','搜索食物、填写份量，再添加到对应的一餐。'));
 foodCard.querySelector('h3').textContent='添加食物';photo.querySelector('b').textContent='拍照识别';photo.querySelector('.etxt span').textContent='使用已配置的 AI 估算食物';log.appendChild(photo);log.appendChild(foodCard);log.appendChild(history);log.appendChild(group('查看今日营养进度',[nutrition]));
 var body=q('tab-body'),measure=card('b-date'),summary=card('b-summary'),chart=card('chart'),photos=card('shape-input'),bodyHistory=card('b-list'),heatmap=card('heatmap'),poster=card('poster-gen');
 body.replaceChildren();body.appendChild(heading('BODY & TRENDS','用记录，看见变化','先保存测量，再看连续记录中的趋势。'));body.appendChild(measure);body.appendChild(chart);body.appendChild(summary);body.appendChild(group('对比照片与测量历史',[photos,bodyHistory]));body.appendChild(group('坚持日历与分享图',[heatmap,poster]));
 q('tabs').innerHTML='<button data-tab="today" class="on">今日</button><button data-tab="log">饮食</button><button data-tab="training">训练</button><button data-tab="body">趋势</button><button data-tab="more">更多</button>';
 q('tabs').setAttribute('aria-label','健身导航');
 var oldSwitch=switchTab;
 switchTab=function(name){oldSwitch(name);if(name==='training'){safeRender('training',renderTraining);safeRender('exlog-list',renderExLog);}var parentName=['coach','profile','out','photo','report'].includes(name)?(name==='photo'?'log':'more'):name;q('tabs').querySelectorAll('button').forEach(function(b){b.classList.toggle('on',b.dataset.tab===parentName);b.setAttribute('aria-current',b.dataset.tab===parentName?'page':'false');});renderCompact();};
 ['coach','profile','out','photo','report'].forEach(function(name){var n=q('tab-'+name);n.insertBefore(el('button','fitness-back','<span>←</span> '+(name==='photo'?'返回饮食':'返回更多')),n.firstChild);n.firstChild.setAttribute('data-switch',name==='photo'?'log':'more');});
 function stat(label,value,unit,note){return '<div><span>'+label+'</span><strong>'+value+'<small>'+unit+'</small></strong><p>'+note+'</p></div>';}
 function numeric(v){return typeof v==='number'&&Number.isFinite(v);}
 function renderCompact(){var date=todayStr(),foods=state.logs[date]||[],total=consumed(),weight=(state.body||[]).filter(function(x){return x.date===date&&numeric(x.weight);}).at(-1),water=state.water[date];q('fitness-compact').innerHTML=stat('饮食热量',foods.length?Math.round(total.k):'—','kcal','已登记食物的估算')+stat('蛋白质',foods.length?Math.round(total.p):'—','g','来自今日饮食')+stat('今日体重',weight?weight.weight:'—','kg',weight?'当天实测':'还没有测量记录')+stat('今日饮水',numeric(water)?water*250:'—','ml','每杯 250 ml');}
 var oldSave=save;save=function(){var result=oldSave();renderCompact();renderStatusLinks();if(result!==false)sendJournal({type:'fitness-records-changed'});return result;};
 var journalDark=null,oldDark=applyDark;
 applyDark=function(){oldDark();if(journalDark!==null)document.body.classList.toggle('dark',journalDark);};
 window.addEventListener('message',function(e){if(e.origin!==location.origin||e.source!==parent)return;if(e.data&&e.data.type==='journal-theme'){journalDark=e.data.dark===true;applyDark();}});
 window.addEventListener('storage',function(e){if(e.key!==LS_KEY||!e.newValue)return;try{state=normalizeState(JSON.parse(e.newValue));renderAll();safeRender('training',renderTraining);safeRender('exlog-list',renderExLog);renderCompact();renderStatusLinks();applyDark();}catch(err){showToast('其他页面更新了数据，请刷新后查看。');}});
 document.addEventListener('click',function(e){var b=e.target.closest('.fitness-quick button,.fitness-tools button');if(b)switchTab(b.dataset.tab);});
 document.addEventListener('toggle',function(e){if(e.target.classList.contains('fitness-fold')&&e.target.open&&e.target.contains(q('heatmap')))safeRender('heatmap',renderHeatmap);},true);
 var statusForm=q('fitness-status-form'),statusDate=q('fitness-status-date'),statusFields=['sleep','energy','movement','exercise'],statusSnapshot=null,statusRequest=0,statusPending=null,statusTimer;
 function sendJournal(message){if(parent!==window)parent.postMessage(message,location.origin);}
 function statusValues(){var values={};statusFields.forEach(function(f){var v=statusForm.elements[f].value;values[f]=f==='exercise'?v.trim():v===''?null:Number(v);});return values;}
 function statusDirty(){if(!statusSnapshot)return false;var values=statusValues();return statusFields.some(function(f){return !(f==='movement'&&statusForm.elements[f].readOnly)&&values[f]!==statusSnapshot.values[f];});}
 function statusMessage(text){q('fitness-status-saved').textContent=text;}
 function statusBusy(busy){Array.from(statusForm.elements).forEach(function(n){n.disabled=busy;});}
 function localMovement(date){var rows=(state.exercises||{})[date]||[];if(!rows.length)return null;var vals=rows.map(function(x){return x.minutes;});return vals.every(numeric)?Math.round(vals.reduce(function(a,b){return a+b;},0)*10)/10:null;}
 function renderStatusLinks(){if(!statusSnapshot)return;var date=statusSnapshot.date,rows=(state.exercises||{})[date]||[],minutes=localMovement(date),workout=(state.workouts||{})[date],linked=minutes!==null,input=statusForm.elements.movement;input.readOnly=linked;if(linked)input.value=minutes;else if(statusSnapshot.linkedMovement){input.value=statusSnapshot.manualMovement??'';statusSnapshot.values.movement=statusSnapshot.manualMovement;}q('fitness-status-linked').textContent=linked?'已关联运动明细：'+rows.map(function(x){return x.name+' '+(x.reps?x.reps+'次':x.minutes+'分钟');}).join('；')+'。时长自动汇总，无需重复填写。':workout&&!workout.deleted&&workout.completed?'已保存力量训练；运动时长可按实际填写，感受在下面补充。':'运动明细可在「训练」中登记，也可以在这里简记。休息日时长填 0，没记录就留空。';statusSnapshot.linkedMovement=linked;}
 function applyStatusSnapshot(snapshot){statusSnapshot=snapshot;statusDate.value=snapshot.date;statusFields.forEach(function(f){statusForm.elements[f].value=snapshot.values[f]??'';});renderStatusLinks();statusMessage(snapshot.saved?'已保存 · 修改后请再保存':'尚未保存当天状态');}
 function requestStatus(date){statusPending=++statusRequest;statusBusy(true);statusMessage('正在加载…');sendJournal({type:'fitness-status-load',date:date,requestId:statusPending});armStatusTimeout();}
 function armStatusTimeout(){clearTimeout(statusTimer);statusTimer=setTimeout(function(){if(statusPending!==null){statusPending=null;statusBusy(false);statusMessage('未收到响应，填写仍保留。请刷新后重试。');}},7000);}
 statusDate.value=todayStr();statusDate.max=todayStr();
 statusDate.addEventListener('change',function(){if(statusDirty()){statusDate.value=statusSnapshot.date;statusMessage('有未保存的修改，请先保存再切换日期。');return;}requestStatus(statusDate.value);});
 statusForm.addEventListener('input',function(e){if(e.target===statusDate)return;statusMessage(statusDirty()?'有修改，尚未保存':statusSnapshot&&statusSnapshot.saved?'已保存 · 修改后请再保存':'尚未保存当天状态');});
 statusForm.addEventListener('change',function(e){if(e.target!==statusDate)statusMessage(statusDirty()?'有修改，尚未保存':statusSnapshot&&statusSnapshot.saved?'已保存 · 修改后请再保存':'尚未保存当天状态');});
 statusForm.addEventListener('submit',function(e){e.preventDefault();if(!statusSnapshot||statusPending!==null){statusMessage('记录尚未加载，请刷新后再保存。');return;}statusPending=++statusRequest;sendJournal({type:'fitness-status-save',date:statusSnapshot.date,values:statusValues(),base:statusSnapshot.values,requestId:statusPending});statusBusy(true);statusMessage('正在保存…');armStatusTimeout();});
 window.addEventListener('message',function(e){if(e.origin===location.origin&&e.source===parent&&e.data&&e.data.type==='journal-records-changed'&&statusSnapshot&&statusPending===null&&!statusDirty())requestStatus(statusSnapshot.date);});
 window.addEventListener('storage',function(e){if(e.key==='daily-compass-v1'+(FITNESS_QA?'-qa':'')&&statusSnapshot&&statusPending===null&&!statusDirty())requestStatus(statusSnapshot.date);});
 window.addEventListener('message',function(e){var m=e.data;if(e.origin!==location.origin||e.source!==parent||!m||!['journal-status-loaded','journal-status-saved'].includes(m.type)||m.requestId!==statusPending)return;clearTimeout(statusTimer);statusPending=null;statusBusy(false);if(m.ok){applyStatusSnapshot(m.snapshot);if(m.type==='journal-status-saved'){statusMessage('已保存 ✓ · '+m.snapshot.date);showToast('当天状态已保存，概览与周报已更新 ✓');}}else{statusMessage(m.error||'保存失败，填写仍保留。');if(statusSnapshot)statusDate.value=statusSnapshot.date;}});
 renderCompact();switchTab('today');requestStatus(todayStr());
})();
