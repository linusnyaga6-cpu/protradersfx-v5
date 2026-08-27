module.exports = async (req,res)=>res.json({service:'protraders-fx-market',provider:'Deriv',mode:'client-websocket',configured:Boolean(process.env.DERIV_PUBLIC_APP_ID)});
