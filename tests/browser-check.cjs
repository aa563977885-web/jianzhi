const {chromium}=require('playwright-core');
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
(async()=>{
 const server=http.createServer((req,res)=>{
  const name=decodeURIComponent(req.url.split('?')[0]);
  const file=path.resolve(root,'.'+(name==='/'?'/index.html':name));
  if(!file.startsWith(root+path.sep)){res.writeHead(403);return res.end();}
  if(!fs.existsSync(file)||fs.statSync(file).isDirectory()){res.writeHead(404);return res.end();}
  const ext=path.extname(file);res.setHeader('Content-Type',ext==='.js'?'application/javascript':ext==='.html'?'text/html; charset=utf-8':ext==='.png'?'image/png':'application/octet-stream');res.end(fs.readFileSync(file));
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 let browser;
 try{
  browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
  const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
  const url='http://127.0.0.1:'+server.address().port;
  await page.goto(url);await page.locator('#workout-mode').click();
  await page.locator('#training').scrollIntoViewIfNeeded();
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);assert.equal(overflow,false);
  const out=path.resolve(root,'../../outputs');fs.mkdirSync(out,{recursive:true});
  await page.screenshot({path:path.join(out,'减脂助手-v5-训练预览.png'),fullPage:true});
  for(const el of await page.locator('[data-wfield]').all())await el.fill(await el.getAttribute('data-wfield')==='weight'?'0':'10');
  await page.locator('#workout-finish').click();await page.reload();
  assert.match(await page.locator('#training').innerText(),/今日已完成 A/);
  await page.locator('#btabs [data-tab="body"]').click();await page.locator('#b-weight-unit').selectOption('jin');await page.locator('#b-weight').fill('170');await page.locator('#b-add').click();
  await page.locator('#b-waist').fill('100');await page.locator('#b-add').click();assert.match(await page.locator('#b-summary').innerText(),/100cm/);
  assert.equal(await page.evaluate(()=>state.body[0].weight),85);
  await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:path.join(out,'减脂助手-v5-数据预览.png'),fullPage:true});
  await page.locator('#dark-toggle').click();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.setViewportSize({width:1440,height:1000});await page.locator('#tabs [data-tab="today"]').click();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  // New scripts and the page must still load with the service worker offline.
  await page.evaluate(()=>navigator.serviceWorker.ready);await page.reload();await context.setOffline(true);await page.reload();
  assert.match(await page.locator('#training').innerText(),/今日已完成 A/);
  assert.deepEqual(errors,[]);
  console.log('PASS: mobile input/reload, jin conversion, waist update, dark/desktop layout, offline reload, no page errors.');
 }finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
