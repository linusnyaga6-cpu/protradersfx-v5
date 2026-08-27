// Landing-page enhancement and compatibility entry point.
(() => { document.querySelectorAll('[data-event]').forEach(el => el.addEventListener('click', () => { try { fetch('/api/track',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({type:el.dataset.event,path:location.pathname}),keepalive:true}); } catch {} })); })();
