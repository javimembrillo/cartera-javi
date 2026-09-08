(function(){
  const MADRID_TZ='Europe/Madrid', NY_TZ='America/New_York';
  const XETRA_CLOSED_2026=['2026-01-01','2026-04-03','2026-04-06','2026-05-01','2026-12-24','2026-12-25','2026-12-31'];
  const NYSE_CLOSED_2026=['2026-01-01','2026-01-19','2026-02-16','2026-04-03','2026-05-25','2026-06-19','2026-07-03','2026-09-07','2026-11-26','2026-12-25'];
  const NYSE_EARLY_CLOSE_2026={'2026-11-27':'13:00','2026-12-24':'13:00'};
  const HOLIDAY_NAME={
    '2026-01-01':'Año Nuevo','2026-01-19':'Martin Luther King Jr.','2026-02-16':'Washington’s Birthday',
    '2026-04-03':'Viernes Santo','2026-04-06':'Lunes de Pascua','2026-05-01':'Día del Trabajo',
    '2026-05-25':'Memorial Day','2026-06-19':'Juneteenth','2026-07-03':'Día de la Independencia (observado)',
    '2026-09-07':'Labor Day','2026-11-26':'Acción de Gracias','2026-11-27':'Día después de Acción de Gracias',
    '2026-12-24':'Nochebuena','2026-12-25':'Navidad','2026-12-31':'Nochevieja'
  };

  function partsInTZ(tz){
    const now=new Date();
    const fmt=new Intl.DateTimeFormat('en-US',{timeZone:tz,weekday:'short',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false});
    const p={};
    fmt.formatToParts(now).forEach(function(part){p[part.type]=part.value;});
    const iso=p.year+'-'+p.month+'-'+p.day;
    const weekdayIdx={Sun:0,Mon:1,Tue:2,Wed:3,Thu:4,Fri:5,Sat:6}[p.weekday];
    let hour=+p.hour; if(hour===24)hour=0;
    return {iso:iso, weekday:weekdayIdx, minutes:hour*60+ +p.minute};
  }

  function xetraStatus(){
    const t=partsInTZ(MADRID_TZ);
    if(t.weekday===0||t.weekday===6) return {open:false,label:'cerrada · fin de semana'};
    if(XETRA_CLOSED_2026.indexOf(t.iso)>=0) return {open:false,label:'cerrada hoy · '+(HOLIDAY_NAME[t.iso]||'festivo')};
    const open=9*60, close=17*60+30;
    if(t.minutes<open) return {open:false,label:'cerrada · abre 09:00'};
    if(t.minutes>close) return {open:false,label:'cerrada · cerró 17:30'};
    return {open:true,label:'abierta'};
  }

  function nyseStatus(){
    const t=partsInTZ(NY_TZ);
    if(t.weekday===0||t.weekday===6) return {open:false,label:'cerrada · fin de semana'};
    if(NYSE_CLOSED_2026.indexOf(t.iso)>=0) return {open:false,label:'cerrada hoy · '+(HOLIDAY_NAME[t.iso]||'festivo')};
    const open=9*60+30;
    let close=16*60;
    if(NYSE_EARLY_CLOSE_2026[t.iso]){
      const hm=NYSE_EARLY_CLOSE_2026[t.iso].split(':');
      close=(+hm[0])*60+(+hm[1]);
    }
    if(t.minutes<open) return {open:false,label:'cerrada · abre 15:30 Madrid'};
    if(t.minutes>close) return {open:false,label:'cerrada · cerró'+(NYSE_EARLY_CLOSE_2026[t.iso]?' (cierre anticipado)':'')};
    return {open:true,label:NYSE_EARLY_CLOSE_2026[t.iso]?'abierta · cierre anticipado':'abierta'};
  }

  function badge(name, status){
    const dot=status.open?'#22c55e':'#ef4444';
    return '<span style="display:inline-flex;align-items:center;gap:6px;margin-right:14px">'
      +'<span style="width:8px;height:8px;border-radius:50%;background:'+dot+';display:inline-block"></span>'
      +'<b>'+name+'</b> '+status.label+'</span>';
  }

  function render(){
    const el=document.getElementById('marketStatus');
    if(!el)return;
    el.innerHTML=badge('Europa', xetraStatus())+badge('Wall Street', nyseStatus());
  }

  window.__marketStatusNow=function(name){
    if(name==='wallstreet')return nyseStatus();
    if(name==='europa')return xetraStatus();
    return {open:false,label:'desconocido'};
  };

  document.addEventListener('DOMContentLoaded',render);
  if(document.readyState==='complete'||document.readyState==='interactive')render();
  setInterval(render,60000);
  window.renderMarketStatus=render;
})();
