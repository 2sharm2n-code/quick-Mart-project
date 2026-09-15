import { db } from "hatchable";
export const access = "admin";
export const methods = ["GET","PUT"];
export default async function(req,res){
 if(req.method==="GET"){const {rows}=await db.query("SELECT id,title,monthly_pay_kes,slots_available,active FROM position_catalog ORDER BY title");return res.json({success:true,positions:rows});}
 const body=req.body||{},id=String(body.id||"").trim();if(!id)return res.status(400).json({success:false,message:"Position id is required."});const pay=body.monthly_pay_kes===''||body.monthly_pay_kes===null||body.monthly_pay_kes===undefined?null:Number(body.monthly_pay_kes);const slots=Number(body.slots_available);if(pay!==null&&(!Number.isInteger(pay)||pay<0))return res.status(400).json({success:false,message:"Monthly pay must be a whole number or blank."});if(!Number.isInteger(slots)||slots<0||slots>10000)return res.status(400).json({success:false,message:"Available slots must be a whole number from 0 to 10,000."});const active=body.active===undefined?true:Boolean(body.active);const {rows}=await db.query("UPDATE position_catalog SET monthly_pay_kes=$2,slots_available=$3,active=$4 WHERE id=$1 RETURNING id,title,monthly_pay_kes,slots_available,active",[id,pay,slots,active]);if(!rows.length)return res.status(404).json({success:false,message:"Position not found."});return res.json({success:true,position:rows[0]});
}
