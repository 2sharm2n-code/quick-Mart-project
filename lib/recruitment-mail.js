import { db } from "hatchable";

const PORTAL_ORIGIN = "https://quickmart-kenya-ebl3.hatchable.site";
const LOGO_URL = `${PORTAL_ORIGIN}/assets/quickmart-email-logo.svg`;
const PORTAL_IMAGE_URL = `${PORTAL_ORIGIN}/assets/quickmart-hero-storefront.jpg`;

const templates = {
  received: {
    subject: "QuickMart — Application Received",
    label: "APPLICATION RECEIVED",
    body: "Dear {{name}},\n\nThank you for submitting your application for the {{position}} opportunity. Your application has been received successfully and is now waiting for recruitment review.\n\nApplication reference: {{ref}}\n\nPlease keep checking the Gmail address you entered and keep this same application link safe. No action is required from you right now.\n\nThe next stage will only open after the recruitment review is completed.\n\nRegards,\nQuickMart Kenya Recruitment Portal — Career Day Project"
  },
  interview_received: {
    subject: "QuickMart — Interview Submitted",
    label: "INTERVIEW SUBMITTED",
    body: "Dear {{name}},\n\nYour interview for the {{position}} position has been submitted successfully.\n\nApplication reference: {{ref}}\n\nHR will now review your interview responses and CV. Please keep checking the Gmail address you entered for the next instruction and continue using the same application link.\n\nThere is nothing else you need to submit until the next stage is opened.\n\nRegards,\nQuickMart Kenya Recruitment Portal — Career Day Project"
  },
  onboarding: {
    subject: "QuickMart — Final Onboarding Step Open",
    label: "FINAL ONBOARDING STEP",
    body: "Dear {{name}},\n\nCongratulations. HR has approved your interview for the {{position}} position and your final onboarding stage is now open.\n\nApplication reference: {{ref}}\n\nOpen the same application link and review the onboarding requirements shown there. If the project configuration presents a payment step, review the displayed items and total carefully before continuing.\n\nRegards,\nQuickMart Kenya Recruitment Portal — Career Day Project"
  },
  completed: {
    subject: "QuickMart — Recruitment Completed",
    label: "RECRUITMENT COMPLETED",
    body: "Dear {{name}},\n\nCongratulations. Your recruitment and onboarding journey for the {{position}} position has been completed successfully.\n\nApplication reference: {{ref}}\n\nReporting branch: {{branch}}\nReporting date: {{report_date}}\nReporting time: {{report_time}}\n\nPlease keep your application link and payment confirmation safely and bring the documents listed on the completed portal page when you report.\n\nRegards,\nQuickMart Kenya Recruitment Portal — Career Day Project"
  }
};

function render(text, a) {
  return String(text || "").replace(/{{(name|position|ref|branch|report_date|report_time)}}/g, (_, key) => String({
    name: a.full_name || "Applicant",
    position: a.applied_position || "the selected position",
    ref: a.application_ref || "—",
    branch: a.preferred_branch_county || "Assigned branch",
    report_date: a.report_date || "To be confirmed",
    report_time: a.report_time || "10:30 AM"
  }[key] || "—"));
}

function b64urlBytes(bytes) { let s=""; for(const b of bytes)s+=String.fromCharCode(b); return btoa(s).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,""); }
function b64urlText(text) { return b64urlBytes(new TextEncoder().encode(text)); }
function escapeHtml(v) { return String(v ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\"/g,"&quot;"); }
function mimeSubject(text) { const clean=String(text||"").replace(/[\r\n]+/g," "); return /[^\x00-\x7F]/.test(clean) ? `=?UTF-8?B?${btoa(unescape(encodeURIComponent(clean)))}?=` : clean; }

function htmlMessage(text, label) {
  const safe=escapeHtml(text).replace(/\n/g,"<br>");
  return `<div style="margin:0;padding:0;background:#f0f2f4;font-family:Arial,Helvetica,sans-serif;color:#171717"><div style="max-width:680px;margin:0 auto;background:#fff;border:1px solid #dfe3e7"><div style="background:#0b0b0b;padding:18px 22px;border-top:8px solid #d71920;text-align:center"><img src="${LOGO_URL}" alt="QuickMart Kenya" width="420" style="display:block;width:420px;max-width:100%;height:auto;margin:0 auto 14px"><div style="font-size:13px;letter-spacing:2px;color:#ffb0b4;font-weight:800">CAREER DAY PROJECT PORTAL</div></div><img src="${PORTAL_IMAGE_URL}" alt="QuickMart storefront" style="display:block;width:100%;height:230px;object-fit:cover"><div style="padding:24px 28px"><div style="display:inline-block;background:#d71920;color:#fff;padding:9px 13px;border-radius:4px;font-size:12px;font-weight:900;letter-spacing:1px">${escapeHtml(label)}</div><div style="font-size:25px;line-height:1.2;font-weight:900;margin:17px 0 16px;border-left:6px solid #d71920;padding:8px 0 8px 13px">QUICKMART RECRUITMENT PORTAL</div><div style="font-size:15px;line-height:1.75;color:#242424">${safe}</div></div><div style="margin:0 28px 24px;padding:13px 15px;background:#fff7f7;border:1px solid #efb7ba;border-radius:6px;font-size:12px;line-height:1.5;color:#4a4a4a"><b style="color:#a81218">School Career Day project:</b> This portal is an educational demonstration and is not an official QuickMart recruitment channel.</div><div style="padding:17px 28px;background:#fafafa;border-top:1px solid #eee;font-size:12px;color:#666">Keep your application reference safe. Never share a password, PIN, or one-time verification code.</div></div></div>`;
}

async function deriveKey() {
  const raw=new TextEncoder().encode(process.env.GOOGLE_GMAIL_ENCRYPTION_KEY||"");
  if(raw.length<32)throw new Error("Gmail encryption key is not configured correctly.");
  const base=await crypto.subtle.importKey("raw",raw,"PBKDF2",false,["deriveBits"]);
  const bits=await crypto.subtle.deriveBits({name:"PBKDF2",salt:new TextEncoder().encode("quickmart-gmail-token-v1"),iterations:120000,hash:"SHA-256"},base,256);
  return crypto.subtle.importKey("raw",bits,{name:"HMAC",hash:"SHA-256"},false,["sign"]);
}
function decode(s){const padded=String(s).replace(/-/g,"+").replace(/_/g,"/")+"===".slice((String(s).length+3)%4);const bin=atob(padded);return Uint8Array.from(bin,c=>c.charCodeAt(0));}
async function decryptToken(ciphertext){const parts=String(ciphertext||"").split(".");if(parts.length!==3)throw new Error("Stored Gmail token is invalid.");const nonce=decode(parts[0]),cipher=decode(parts[1]),tag=decode(parts[2]);const key=await deriveKey();const expected=new Uint8Array(await crypto.subtle.sign("HMAC",key,new Uint8Array([...nonce,...cipher])));if(expected.length!==tag.length||expected.some((v,i)=>v!==tag[i]))throw new Error("Stored Gmail token failed integrity verification.");const out=new Uint8Array(cipher.length);let offset=0,counter=0;while(offset<cipher.length){const block=new Uint8Array(await crypto.subtle.sign("HMAC",key,new TextEncoder().encode("stream:"+b64urlBytes(nonce)+":"+counter)));for(let i=0;i<block.length&&offset+i<cipher.length;i++)out[offset+i]=cipher[offset+i]^block[i];offset+=block.length;counter++;}return new TextDecoder().decode(out);}

async function encryptToken(value){const nonce=crypto.getRandomValues(new Uint8Array(16)),key=await deriveKey(),plain=new TextEncoder().encode(value),out=new Uint8Array(plain.length);let offset=0,counter=0;while(offset<plain.length){const block=new Uint8Array(await crypto.subtle.sign("HMAC",key,new TextEncoder().encode("stream:"+b64urlBytes(nonce)+":"+counter)));for(let i=0;i<block.length&&offset+i<plain.length;i++)out[offset+i]=plain[offset+i]^block[i];offset+=block.length;counter++;}const tag=new Uint8Array(await crypto.subtle.sign("HMAC",key,new Uint8Array([...nonce,...out])));return `${b64urlBytes(nonce)}.${b64urlBytes(out)}.${b64urlBytes(tag)}`;}

export async function sendRecruitmentEmail({applicant,type,subject,body,extra={}}) {
  const template=templates[type];if(!template)throw new Error(`Unknown recruitment message type: ${type}`);
  const merged={...applicant,...extra};
  const finalSubject=render(subject||template.subject,merged),text=render(body||template.body,merged);
  const {rows}=await db.query("SELECT refresh_token_ciphertext,access_token_ciphertext,access_token_expires_at,email FROM google_gmail_oauth WHERE owner_key='quickmart-admin' LIMIT 1");
  const row=rows[0];if(!row?.refresh_token_ciphertext)throw new Error("QuickMart Gmail is not connected.");
  let accessToken=null;
  if(row.access_token_ciphertext&&row.access_token_expires_at&&new Date(row.access_token_expires_at).getTime()>Date.now()+60000) accessToken=await decryptToken(row.access_token_ciphertext);
  else {
    const refreshToken=await decryptToken(row.refresh_token_ciphertext);
    const tokenResponse=await fetch("https://oauth2.googleapis.com/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({client_id:process.env.GOOGLE_GMAIL_CLIENT_ID,client_secret:process.env.GOOGLE_GMAIL_CLIENT_SECRET,refresh_token:refreshToken,grant_type:"refresh_token"}).toString()});
    const token=await tokenResponse.json();if(!tokenResponse.ok||!token.access_token)throw new Error("Google could not refresh the QuickMart Gmail access token.");
    accessToken=token.access_token;
    const accessCipher=await encryptToken(accessToken);await db.query("UPDATE google_gmail_oauth SET access_token_ciphertext=$1,access_token_expires_at=$2,updated_at=now() WHERE owner_key='quickmart-admin'",[accessCipher,new Date(Date.now()+Number(token.expires_in||3600)*1000).toISOString()]);
  }
  const sender=String(row.email||"").trim(),recipient=String(applicant.email||"").trim();if(!sender||!/^\S+@\S+\.\S+$/.test(recipient))throw new Error("A valid Gmail sender and applicant email are required.");
  const boundary="quickmart_boundary_"+Date.now();
  const mime=[`From: ${sender}`,`To: ${recipient}`,`Subject: ${mimeSubject(finalSubject)}`,"MIME-Version: 1.0",`Content-Type: multipart/alternative; boundary="${boundary}"`,"",`--${boundary}`,"Content-Type: text/plain; charset=UTF-8","Content-Transfer-Encoding: 8bit","",text,`--${boundary}`,"Content-Type: text/html; charset=UTF-8","Content-Transfer-Encoding: 8bit","",htmlMessage(text,template.label),`--${boundary}--`,""].join("\r\n");
  const response=await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send",{method:"POST",headers:{Authorization:"Bearer "+accessToken,"Content-Type":"application/json"},body:JSON.stringify({raw:b64urlText(mime)})});if(!response.ok){const detail=await response.text();throw new Error(`Gmail API rejected the message (${response.status}). ${detail.slice(0,300)}`);}return await response.json();
}

export function recruitmentTemplate(type){return templates[type]||null;}