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
 var oldSave=save;save=function(){var result=oldSave();renderCompact();return result;};
 var journalDark=null,oldDark=applyDark;
 applyDark=function(){oldDark();if(journalDark!==null)document.body.classList.toggle('dark',journalDark);};
 window.addEventListener('message',function(e){if(e.origin!==location.origin||e.source!==parent)return;if(e.data&&e.data.type==='journal-theme'){journalDark=e.data.dark===true;applyDark();}});
 window.addEventListener('storage',function(e){if(e.key!==LS_KEY||!e.newValue)return;try{state=normalizeState(JSON.parse(e.newValue));renderAll();safeRender('training',renderTraining);safeRender('exlog-list',renderExLog);renderCompact();applyDark();}catch(err){showToast('其他页面更新了数据，请刷新后查看。');}});
 document.addEventListener('click',function(e){var b=e.target.closest('.fitness-quick button,.fitness-tools button');if(b)switchTab(b.dataset.tab);});
 document.addEventListener('toggle',function(e){if(e.target.classList.contains('fitness-fold')&&e.target.open&&e.target.contains(q('heatmap')))safeRender('heatmap',renderHeatmap);},true);
 renderCompact();switchTab('today');
})();
