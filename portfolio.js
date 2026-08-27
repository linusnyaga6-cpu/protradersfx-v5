module.exports = async (req,res)=>res.status(501).json({error:'Portfolio adapter not configured',message:'Open positions and history require the authenticated Deriv trading adapter.'});
