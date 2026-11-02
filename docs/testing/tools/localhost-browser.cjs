const path = require('node:path');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { spawn } = require('node:child_process');
const root = path.resolve(__dirname, '../../..');
const out = path.resolve(process.env.EMS_TEST_OUTPUT || path.join(root, 'docs/testing/evidence'));
fs.mkdirSync(out, { recursive: true });
const dep = name => require(path.join(root,'backend/node_modules',name));
const mongoose = dep('mongoose'); const bcrypt = dep('bcryptjs'); const jwt = dep('jsonwebtoken');
const request = dep('supertest');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const dbName = 'ems_test_d3_browser_' + randomUUID().replaceAll('-','');
const results = { date: '2026-11-02', scope: 'localhost real Chrome, real API and isolated MongoDB', checks: [] };
let browser, vite, server;
function passed(name) { results.checks.push({ name, status: 'pass' }); }
async function main() {
  Object.assign(process.env,{NODE_ENV:'development',JWT_SECRET:randomUUID(),CLIENT_ORIGIN:'http://localhost:5188',NOTIFICATION_WORKER_ENABLED:'false'});
  const uri = process.env.MONGO_TEST_URI;
  if (!uri || !new URL(uri).pathname.startsWith('/ems_test_')) throw new Error('Dedicated ems_test_* replica set required');
  await mongoose.connect(uri,{dbName});
  const load = p => require(path.join(root,'backend/src',p));
  const User=load('models/User'), Category=load('models/Category'), Event=load('models/Event'), Reg=load('models/Registration'), Job=load('models/NotificationJob'), Audit=load('models/AuditLog');
  await Promise.all([User.init(),Category.init(),Event.init(),Reg.init(),Job.init(),Audit.init()]);
  const password='BrowserTest'+randomUUID();
  const hash=await bcrypt.hash(password,12);
  const [admin,org,attendee] = await User.create(['Admin','Organizer','Attendee'].map((role,i)=>({name:'D3 '+role,email:`d3-${i}@example.test`,passwordHash:hash,role})));
  const category=await Category.create({name:'D3 Workshop'});
  const data={description:'Literal <script>alert(1)</script>',categoryId:category._id,organizerId:org._id,venue:'D3 Hall',startAt:new Date(Date.now()+3*86400000),endAt:new Date(Date.now()+3*86400000+3600000),registrationDeadline:new Date(Date.now()+2*86400000),capacity:20,status:'Published',seatsTaken:0};
  const event=await Event.create({...data,title:'D3 Browser Workshop'});
  const reportEvent=await Event.create({...data,title:'D3 Attendance Fixture',seatsTaken:8});
  const extraUsers=await User.create(Array.from({length:13},(_,i)=>({name:'D3 Guest '+i,email:`d3-guest-${i}@example.test`,passwordHash:hash})));
  await Reg.create(extraUsers.map((u,i)=>({eventId:reportEvent._id,userId:u._id,regCode:'D3-REG-'+i,status:i<6?'Checked-in':i<8?'Confirmed':i<11?'Waitlisted':'Cancelled',waitlistPosition:i>=8&&i<11?i-7:null,checkedInAt:i<6?new Date():null})));
  const app=load('app'); server=app.listen(5023,'127.0.0.1'); await new Promise(resolve=>server.once('listening',resolve));
  vite=spawn(process.execPath,[path.join(root,'frontend/node_modules/vite/bin/vite.js'),'--host','127.0.0.1','--port','5188','--strictPort'],{cwd:path.join(root,'frontend'),env:{...process.env,VITE_API_BASE_URL:'http://localhost:5023/api'},windowsHide:true,stdio:'ignore'});
  for(let i=0;i<60;i++){try{if((await fetch('http://localhost:5188')).ok)break;}catch{} await new Promise(r=>setTimeout(r,250));if(i===59)throw new Error('Frontend did not start');}
  browser=await chromium.launch({channel:'chrome',headless:true});results.browserVersion=browser.version();
  async function login(user){const context=await browser.newContext({viewport:{width:1920,height:1080}});const page=await context.newPage();await page.goto('http://localhost:5188/login');await page.getByLabel('Email address',{exact:true}).fill(user.email);await page.getByLabel('Password',{exact:true}).fill(password);await page.getByRole('button',{name:'Sign in',exact:true}).click();await page.getByRole('button',{name:'Logout',exact:true}).waitFor();return {context,page};}
  const a=await login(attendee);
  await a.page.goto('http://localhost:5188/events/'+event._id);await a.page.getByRole('heading',{name:event.title,exact:true}).waitFor();
  let alertTriggered=false;a.page.on('dialog',async dialog=>{alertTriggered=true;await dialog.dismiss();});
  assert.equal(await a.page.locator('script').filter({hasText:'alert(1)'}).count(),0);assert.equal(alertTriggered,false);
  await a.page.getByRole('button',{name:'Register for Event'}).click();
  await a.page.getByText(/Registration successful/).waitFor();
  await a.page.goto('http://localhost:5188/registrations/me');await a.page.getByRole('heading',{name:event.title,exact:true}).waitFor();
  assert.ok(await a.page.locator('svg').count()>0);passed('Real attendee login, event detail, registration and saved registration QR');
  assert.equal(await Job.countDocuments({type:'REGISTRATION_CONFIRMATION',recipient:attendee.email}),1);passed('Registration confirmation queued in real database');
  a.page.removeAllListeners('dialog');
  const cancel=a.page.getByRole('button',{name:'Cancel registration for '+event.title});
  a.page.once('dialog',dialog=>dialog.dismiss());await cancel.click();assert.equal((await Reg.findOne({eventId:event._id,userId:attendee._id})).status,'Confirmed');
  a.page.once('dialog',dialog=>dialog.accept());await cancel.click();await a.page.getByText('Your registration for '+event.title+' was cancelled.').waitFor();
  assert.equal((await Reg.findOne({eventId:event._id,userId:attendee._id})).status,'Cancelled');passed('Registration cancellation requires confirmation and updates stored state');
  const cookie='ems_token='+jwt.sign({id:String(attendee._id),role:attendee.role},process.env.JWT_SECRET,{expiresIn:'60m'});
  const profile=await request(app).put('/api/users/me').set('Cookie',cookie).send({name:'D3 Updated Attendee',phone:'9876543210',role:'Admin'});
  assert.equal(profile.status,200);assert.equal(profile.body.user.role,'Attendee');assert.equal((await User.findById(attendee._id)).name,'D3 Updated Attendee');
  assert.equal((await request(app).put('/api/users/me').set('Cookie',cookie).send({phone:'123'})).status,422);passed('Real profile API saves validated fields and ignores attempted role escalation');
  const o=await login(org);await o.page.goto('http://localhost:5188/organizer/reports');
  await o.page.getByRole('option',{name:reportEvent.title}).waitFor({state:'attached'});await o.page.getByLabel('Select your event').selectOption(String(reportEvent._id));
  await o.page.getByText('75.00%',{exact:true}).waitFor();
  const refresh=o.page.waitForResponse(res=>res.url().endsWith('/'+reportEvent._id+'/report')&&res.status()===200);
  await o.page.getByRole('button',{name:'Refresh events'}).click();await refresh;await o.page.getByText('75.00%',{exact:true}).waitFor();
  const downloadPromise=o.page.waitForEvent('download');await o.page.getByRole('button',{name:'Download CSV'}).click();const download=await downloadPromise;
  const csv=fs.readFileSync(await download.path(),'utf8');assert.equal(csv.trim().split('\r\n').length,14);assert.ok(csv.includes('"summaryAttendanceRate"'));passed('Report 75% fixture, same-event refresh and downloaded CSV with 13 registration rows');
  const ad=await login(admin);await ad.page.goto('http://localhost:5188/admin/summary');await ad.page.getByRole('heading',{name:'Platform summary',exact:true}).waitFor();
  await ad.page.goto('http://localhost:5188/admin/users');await ad.page.getByRole('heading',{name:'Manage users',exact:true}).waitFor();passed('Admin summary and user-management routes retain authenticated access');
  await ad.page.goto('http://localhost:5188/admin/categories');await ad.page.getByLabel('New category name').fill('D3 Added Category');await ad.page.getByRole('button',{name:'Add category',exact:true}).click();
  await ad.page.getByRole('form',{name:'Edit D3 Added Category'}).waitFor();await ad.page.getByRole('form',{name:'Edit D3 Added Category'}).getByRole('button',{name:'Disable',exact:true}).click();
  await ad.page.getByRole('form',{name:'Edit D3 Added Category'}).getByRole('button',{name:'Enable',exact:true}).waitFor();
  const publicCategories=await request(app).get('/api/categories');assert.equal(publicCategories.body.items.some(c=>c.name==='D3 Added Category'),false);passed('Admin category create/disable and exclusion from public category options');
  results.responsive=[];
  for(const [page,url] of [[a.page,'/registrations/me'],[o.page,'/organizer/reports'],[ad.page,'/admin/categories']]){
    for(const width of [360,1920]){await page.setViewportSize({width,height:900});await page.goto('http://localhost:5188'+url);await page.locator('h1').waitFor();const noOverflow=await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth);results.responsive.push({path:url,width,noHorizontalOverflow:noOverflow});}
  }
  results.status='completed';
}
main().catch(error=>{results.status='incomplete';results.error=String(error.message).replace(/[a-f0-9]{64}/g,'[redacted]').slice(0,500);process.exitCode=1;}).finally(async()=>{
  if(browser)await browser.close();if(vite)vite.kill();if(server)await new Promise(r=>server.close(r));
  if(mongoose.connection.name===dbName)await mongoose.connection.dropDatabase();await mongoose.disconnect();
  fs.writeFileSync(path.join(out,'deliverable3-browser.json'),JSON.stringify(results,null,2));console.log(JSON.stringify(results));
});
