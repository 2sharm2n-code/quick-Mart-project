import { db } from "hatchable";
export const access = "public";
export const methods = ["POST"];
export default async function(req,res){
 const b=req.body||{},ref=String(b.applicationRef||"").trim().toUpperCase();
 if(!/^QM-APP-[A-Z0-9]{10}$/.test(ref))return res.status(400).json({success:false,message:"Valid application reference required."});
 const {rows}=await db.query("SELECT application_ref,recruitment_stage FROM applicants WHERE application_ref=$1 LIMIT 1",[ref]);
 if(!rows.length)return res.status(404).json({success:false,message:"Application not found."});
 const stage=String(rows[0].recruitment_stage||"");const section=stage==="interview"?'interview':stage==="interview_submitted"?'interview_review':stage==="selected"||stage==="onboarding"?'apply':stage==="completed"?'completed':stage==="rejected"?'rejected':'screening';
 await db.query("INSERT INTO applicant_presence(application_ref,current_section,last_seen_at,session_token,user_agent) VALUES($1,$2,now(),$3,$4) ON CONFLICT(application_ref) DO UPDATE SET current_section=EXCLUDED.current_section,last_seen_at=now(),session_token=EXCLUDED.session_token,user_agent=EXCLUDED.user_agent",[ref,section,String(b.sessionToken||"").slice(0,120),String(req.headers?.['user-agent']||"").slice(0,500)]);
 return res.json({success:true,online:true,current_section:section});
}
