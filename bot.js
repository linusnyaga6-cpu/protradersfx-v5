module.exports = async (req,res)=>{
  if(req.method!=='POST') return res.status(405).json({error:'Method not allowed'});
  const action=String(req.body?.action||'').toLowerCase();
  if(!['start','stop'].includes(action)) return res.status(400).json({error:'Invalid bot action'});
  return res.status(501).json({error:'Free bot execution adapter not configured',message:`Free bot ${action} acknowledged by the interface. Connect the controlled Deriv bot adapter before real execution.`});
};
