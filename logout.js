module.exports=(req,res)=>{res.clearCookie('linus_session',{httpOnly:true,sameSite:'lax',secure:String(process.env.BASE_URL||'').startsWith('https://'),path:'/'});res.redirect('/');};
