(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.CompassSync=api;})(typeof globalThis==='object'?globalThis:this,function(){
 'use strict';
 const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
 const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
 function stable(x){if(x===undefined)return 'undefined';if(Array.isArray(x))return '['+x.map(stable).join(',')+']';if(plain(x))return '{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+stable(x[k])).join(',')+'}';return JSON.stringify(x);}
 const equal=(a,b)=>stable(a)===stable(b);
 function merge(base,local,remote,choices={}){
  const conflicts=[];
  function walk(b,l,r,path){
   if(equal(l,r))return l;
   if(equal(l,b))return r;
   if(equal(r,b))return l;
   if(plain(l)&&plain(r)&&(b===undefined||plain(b))){const out={};for(const k of new Set([...Object.keys(b||{}),...Object.keys(l),...Object.keys(r)])){if(['__proto__','constructor','prototype'].includes(k))throw Error('数据字段无效。');const v=walk(b?.[k],own(l,k)?l[k]:undefined,own(r,k)?r[k]:undefined,[...path,k]);if(v!==undefined)out[k]=v;}return out;}
   const key=JSON.stringify(path),choice=choices[key];if(choice==='local')return l;if(choice==='remote')return r;
   conflicts.push({key,path,local:l,remote:r});return l;
  }
  return {value:walk(base,local,remote,[]),conflicts};
 }
 async function exchange({base,readLocal,readRemote,writeRemote,choices={},onConflict=()=>{}}){
  for(let attempt=0;attempt<5;attempt++){
   const remote=await readRemote(),local=readLocal(),result=merge(typeof base==='function'?base(local,remote.payload):base,local,remote.payload,choices);
   if(result.conflicts.length){onConflict(result.conflicts);return {conflicts:result.conflicts};}
   if(equal(result.value,remote.payload))return {payload:result.value,revision:remote.revision,local};
   const saved=await writeRemote(remote.revision,result.value);
   if(saved.applied)return {payload:result.value,revision:saved.revision,local};
  }
  throw Error('另一台设备正在保存，请稍后再同步。');
 }
 return {stable,equal,merge,exchange};
});
