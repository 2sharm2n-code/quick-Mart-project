import { db } from "hatchable";
export const access="admin";
export const methods=["DELETE"];
export default async function(req,res){const confirm=String(req.body?.confirm||"");if(confirm!=="QUICKMART-CLEAR-ALL")return res.status(400).json({success:false,message:"Type QUICKMART-CLEAR-ALL to confirm clearing applicant history."});await db.query("DELETE FROM recruitment_messages");await db.query("DELETE FROM applicant_presence");const {rows}=await db.query("DELETE FROM applicants RETURNING id");return res.json({success:true,deleted_applicants:rows.length,message:`Cleared ${rows.length} applicant record(s) and recruitment history.`});}
