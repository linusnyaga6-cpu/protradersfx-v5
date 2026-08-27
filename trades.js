// Server-side trading entry point. Intentionally refuses to execute until the
// authenticated Deriv trading adapter is configured; this prevents fake trades.
module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({error:'Method not allowed'});
  return res.status(501).json({error:'Trading adapter not configured',message:'The UI is connected, but live order execution is disabled until the Deriv trading adapter and controlled live-test are configured.'});
};
