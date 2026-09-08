import { db } from "hatchable";

export const access = "admin";
export const methods = ["GET"];

function b64url(bytes) { let s=""; for(const b of bytes)s+=String.fromCharCode(b); return btoa(s).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,""); }
async function sha256(text) { const data=new TextEncoder().encode(text); const digest=await crypto.subtle.digest("SHA-256",data); return b64url(new Uint8Array(digest)); }
function redirectUri() { return "https://quickmart-kenya.hatchable.site/api/google/oauth-callback"; }
export default async function(req,res){
 const clientId=process.env.GOOGLE_GMAIL_CLIENT_ID; if(!clientId)return res.status(503).json({success:false,message:"Google Gmail credentials are not configured yet."});
 const bytes=crypto.getRandomValues(new Uint8Array(32)); const state=b64url(bytes); const stateHash=await sha256(state); const expires=new Date(Date.now()+10*60*1000).toISOString();
 await db.query("INSERT INTO google_gmail_oauth (owner_key, oauth_state_hash, oauth_state_expires_at, updated_at) VALUES ('quickmart-admin', $1, $2, now()) ON CONFLICT (owner_key) DO UPDATE SET oauth_state_hash = EXCLUDED.oauth_state_hash, oauth_state_expires_at = EXCLUDED.oauth_state_expires_at, updated_at = now()",[stateHash,expires]);
 const {rows:existing}=await db.query("SELECT email FROM google_gmail_oauth WHERE owner_key = 'quickmart-admin' LIMIT 1");
 const params=new URLSearchParams({client_id:clientId,redirect_uri:redirectUri(),response_type:"code",access_type:"offline",prompt:"consent",include_granted_scopes:"false",scope:"https://www.googleapis.com/auth/gmail.send",state}); if(existing[0]?.email)params.set("login_hint",existing[0].email);
 return res.redirect("https://accounts.google.com/o/oauth2/v2/auth?"+params.toString());
}