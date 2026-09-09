const root=document.getElementById('portal-root');
const code=decodeURIComponent(location.pathname.split('/').filter(Boolean).pop()||'');
const API='/api';
const esc=v=>{const d=document.createElement('div');d.textContent=v??'';return d.innerHTML};
const money=v=>`KES ${Number(v||0).toLocaleString('en-KE')}`;
const fmt=v=>v?new Date(v).toLocaleString():'Not scheduled';
const QUESTIONS=[
 ['availability','Are you available to work the required shifts, including weekends where applicable?'],
 ['experience','Briefly describe your relevant work or customer-service experience.'],
 ['motivation','Why do you want to work with QuickMart?']
];
let state=null;
async function getLookup(){const r=await fetch(`${API}/lookup/${encodeURIComponent(code)}`);const x=await r.json();if(!r.ok)throw new Error(x.error||'Application not found');return x;}
async function load(){try{if(!code)throw new Error('Missing application code');state=await getLookup();render(state);}catch(e){root.innerHTML=`<div class="notice error"><strong>Unable to open this application.</strong><p>${esc(e.message)}</p></div>`;}}
function shell(title,subtitle,body){root.innerHTML=`<h1>${esc(title)}</h1><p class="muted">${esc(subtitle||'')}</p>${body}`;}
function render(x){
 const stage=x.stage||x.current_stage;
 if(stage==='Applied'||stage==='Screening') return renderScreening(x);
 if(stage==='Interview') return renderInterview(x);
 if(stage==='Offer'||stage==='Hired'||stage==='Onboarding') return renderOnboarding(x);
 if(stage==='Completed') return renderConfirmation(x);
 if(stage==='Rejected') return renderRejected(x);
 shell('Application status','Your application code is '+x.lookup_code,`<div class="notice">Current stage: <strong>${esc(stage)}</strong><br>${esc(x.next_action||x.next_step||'Please check again later.')}</div>`);
}
function renderScreening(x){
 shell('Screening','Application '+x.lookup_code,`<div class="notice">Position: <strong>${esc(x.job_title)}</strong><br>Candidate: <strong>${esc(x.full_name)}</strong></div><form id="screening-form">${QUESTIONS.map(([k,q])=>`<div class="question"><label>${esc(q)}</label><textarea name="${k}" rows="4" required></textarea></div>`).join('')}<div class="actions"><button class="btn primary">Submit screening</button></div><p id="msg"></p></form>`);
 document.getElementById('screening-form').onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target);const answers=Object.fromEntries(f.entries());document.getElementById('msg').textContent='Submitting...';const r=await fetch(`${API}/applications/${x.id}/screening`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({decision:'Pending',notes:JSON.stringify(answers)})});const d=await r.json();if(!r.ok){document.getElementById('msg').textContent=d.error||'Could not submit';return}location.reload();};
}
function renderInterview(x){
 shell('Interview stage','Keep this same link. It updates automatically.',`<div class="notice"><strong>Good news — you have reached the interview stage.</strong></div><p><strong>Position:</strong> ${esc(x.job_title)}</p><p><strong>Interview date/time:</strong> ${esc(fmt(x.interview_time||x.appointment_date))}</p><p><strong>Instructions:</strong> ${esc(x.appointment_instructions||'Please wait for HR instructions.')}</p><p><strong>Interview status:</strong> ${esc(x.interview_status||'Scheduled')}</p><div class="actions"><button class="btn secondary" onclick="location.reload()">Refresh status</button></div>`);
}
async function renderOnboarding(x){
 let costs=[];try{const r=await fetch(`${API}/onboarding/${x.id}/costs`);if(r.ok)costs=await r.json();}catch(e){}
 const paid=x.payment_status==='Paid';
 if(paid||x.current_stage==='Completed') return renderConfirmation(x);
 shell('Onboarding','Complete the required onboarding items using this same application link.',`<div class="notice">Candidate: <strong>${esc(x.full_name)}</strong><br>Position: <strong>${esc(x.job_title)}</strong></div><div id="cost-list">${costs.map(c=>`<label class="cost"><span><input type="checkbox" class="cost-choice" data-price="${Number(c.estimated_cost||0)}" ${c.is_required?'checked disabled':'checked'}> ${esc(c.item_name||c.cost_item)}${c.is_required?' (required)':''}</span><strong>${money(c.estimated_cost)}</strong></label>`).join('')}</div><div class="total">Total: <span id="total">KES 0</span></div><div class="actions"><button id="pay" class="btn primary">Pay with M-PESA</button><button class="btn secondary" onclick="location.reload()">Refresh</button></div><p id="msg"></p>`);
 const total=()=>[...document.querySelectorAll('.cost-choice:checked')].reduce((s,e)=>s+Number(e.dataset.price||0),0);const update=()=>document.getElementById('total').textContent=money(total());document.querySelectorAll('.cost-choice').forEach(e=>e.onchange=update);update();
 document.getElementById('pay').onclick=async()=>{const msg=document.getElementById('msg');msg.textContent='Starting M-PESA request...';const r=await fetch(`${API}/pay/mpesa`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({application_id:x.id,phone:x.phone,amount:total()})});const d=await r.json();if(!r.ok){msg.textContent=d.error||'Payment could not start';return}msg.textContent='Payment started. Waiting for confirmation...';const checkout=d.checkoutRequestID;let tries=0;const poll=async()=>{if(tries++>30){msg.textContent='Payment is still pending. Refresh later.';return}const p=await fetch(`${API}/mpesa/status?checkoutRequestID=${encodeURIComponent(checkout)}`);const pd=await p.json();if(pd.payment_status==='Paid'||pd.payment_status==='Completed'){location.reload();return}if(pd.payment_status==='Failed'){msg.textContent='Payment failed. Please try again.';return}setTimeout(poll,2000)};poll();};
}
function renderConfirmation(x){shell('Welcome to QuickMart','Your recruitment process is complete.',`<div class="notice success"><h2>Payment confirmed</h2><p>Receipt: <strong>${esc(x.mpesa_receipt_number||'Confirmed')}</strong></p><p>Paid amount: <strong>${money(x.paid_amount)}</strong></p><p>Your application is now complete. Keep this link for your records and do not share it publicly.</p></div>`);}
function renderRejected(x){shell('Application update','Application '+x.lookup_code,`<div class="notice error"><h2>Thank you for applying.</h2><p>We are sorry, but your application was not successful at this stage.</p><p>No further action is required.</p></div>`);}
load();
