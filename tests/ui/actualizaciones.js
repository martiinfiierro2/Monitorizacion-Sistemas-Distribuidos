async rootPage => {
  const results=[];
  const views=['grafo','mapa'];
  const make=()=>{
    const names=['CM','CS','BM','BS','P','Q'],types=['Controlador Main','Controlador Subs','Balanceador Main','Balanceador Subs','Procesador','Procesador'];
    const nodes=names.map((nombre,i)=>({id:100+i,nombre,tipo_nodo:types[i],url:'http://127.0.0.1',puerto:String(29100+i),latitud:30+i,longitud:10+i,visible:true,orden:i,tiempo:null}));
    const replies={};
    nodes.forEach((n,i)=>{replies[n.url+':'+n.puerto]={UID:'audit',Type:'REPLY',Operation:'RESULT',Data:{UID:0,internalConfig:{port:29100+i,urlMain:i===3?'http://127.0.0.1:29102':'',urlCoordinatorlMain:i===1?'http://127.0.0.1:29100':'',urlBalancerMain:'http://127.0.0.1:29102',urlBalancerSubs:'http://127.0.0.1:29103'},balancerList:[{name:'P',url:'http://127.0.0.1:29104',load:100}],processorsList:[],balancerSubsActive:false,coordinatorSubsActive:false}}});
    return {nodes,replies,offline:[],delay:0,interval:60000,apiError:false};
  };
  const scenarios=['cambio_nombre','cambio_visibilidad','alta_nodo','baja_ultimo_nodo','catalogo_vacio','cambio_lista_balanceo','caida_procesador','redimensionar','ocultar_mostrar_conexiones','api_error_recuperacion','nodo_sin_responder','refresco_automatico_coherente','navegar_con_peticion_pendiente'];
  for(const view of views)for(const scenario of scenarios){
    const s=make();if(scenario==='api_error_recuperacion')s.interval=200;if(scenario==='refresco_automatico_coherente')s.interval=1000;
    const page=await rootPage.context().newPage(),errors=[];let calls=0;
    page.on('console',m=>{if(m.type()==='error'&&/TypeError|Error:|undefined/.test(m.text()))errors.push(m.text().split('\n')[0])});
    const serveApi=async route=>{
      calls++;await new Promise(r=>setTimeout(r,100));
      if(s.apiError)return route.fulfill({status:500,json:{ok:false}});
      if(route.request().method()!=='GET')return route.abort();
      return route.fulfill({json:{ok:true,nodos:s.nodes}});
    };
    await page.route('**/api/**',serveApi);
    await page.route('**/assets/theme/config.json',async route=>{const r=await route.fetch();const json=await r.json();json.espera.valor=s.interval;json.debugProxy=false;return route.fulfill({json})});
    await page.route('**/sfmp',async route=>{
      const base=route.request().url().replace(/\/sfmp$/,'');
      if(s.delay && (!s.slow || s.slow===base))await new Promise(r=>setTimeout(r,s.delay));
      return s.offline.includes(base)?route.abort():route.fulfill({json:s.replies[base]});
    });
    await page.route('**/*.tile.openstreetmap.org/**',r=>r.abort());
    const inspect=()=>page.evaluate(view=>{
      const c=ng.getComponent(document.querySelector(view));
      if(view==='grafo'){
        const series=c.myChart?.getOption()?.series?.[0];return {initialized:!!series,names:series?.data?.map(n=>n.name)||[],links:series?.links?.map(l=>l.source+'>'+l.target)||[],chartWidth:c.myChart?.getWidth(),containerWidth:document.querySelector('#grafo').clientWidth};
      }
      return {initialized:!!c.datosDelSistema,names:c.iconos.map(m=>{const label=m.getTooltip().getContent();return typeof label==='string'?label:label.textContent.split(String.fromCharCode(32,183,32))[0]}),links:(c.lineas||[]).filter(l=>c.map.hasLayer(l)).map(l=>l.getLatLngs().map(pos=>pos.lat+','+pos.lng).join('>')),chartWidth:c.map.getSize().x,containerWidth:document.querySelector('#map').clientWidth};
    },view);
    const poll=()=>page.evaluate(view=>ng.getComponent(document.querySelector(view)).comprobar(),view);
    try{
      await page.goto('http://127.0.0.1:24500/'+view);
      await page.waitForFunction(view=>{
        const element=document.querySelector(view);if(!element)return false;
        const c=ng.getComponent(element);
        return !!c.snapshot?.refreshedAt&&(view==='grafo'?!!c.myChart?.getOption()?.series?.[0]:!!c.map);
      },view);
      const before=await inspect();let expected='',pass;
      if(scenario==='cambio_nombre'){s.nodes[4].nombre='RENAMED';expected='La etiqueta cambia';await poll();await page.waitForTimeout(350);pass=(await inspect()).names.includes('RENAMED')}
      if(scenario==='cambio_visibilidad'){s.nodes[4].visible=false;expected='P deja de dibujarse';await poll();await page.waitForTimeout(350);pass=!(await inspect()).names.includes('P')}
      if(scenario==='alta_nodo'){s.nodes.push({...s.nodes[5],id:106,nombre:'NEW'});expected='Aparece NEW sin excepciones';await poll();await page.waitForTimeout(350);pass=(await inspect()).names.includes('NEW')&&errors.length===0}
      if(scenario==='baja_ultimo_nodo'){s.nodes.pop();expected='Q desaparece';await poll();await page.waitForTimeout(350);pass=!(await inspect()).names.includes('Q')}
      if(scenario==='catalogo_vacio'){s.nodes=[];expected='Se vacía la representación';await poll();await page.waitForTimeout(350);pass=(await inspect()).names.length===0}
      if(scenario==='cambio_lista_balanceo'){for(const r of Object.values(s.replies))r.Data.balancerList=[{name:'Q',url:'http://127.0.0.1:29105',load:100}];expected='El enlace a P se sustituye por Q';await poll();await page.waitForTimeout(350);pass=JSON.stringify(before.links)!==JSON.stringify((await inspect()).links)}
      if(scenario==='caida_procesador'){s.offline.push('http://127.0.0.1:29104');expected='Se actualiza la disponibilidad y deja de mostrarse enlace operativo hacia P';await poll();await page.waitForTimeout(350);pass=JSON.stringify(before.links)!==JSON.stringify((await inspect()).links)}
      if(scenario==='redimensionar'){await page.setViewportSize({width:640,height:800});await page.waitForTimeout(250);expected='El lienzo se ajusta al contenedor';const a=await inspect();pass=Math.abs(a.chartWidth-a.containerWidth)<5}
      if(scenario==='ocultar_mostrar_conexiones'){await page.getByRole('checkbox').check();await page.waitForTimeout(150);const off=await inspect();await page.getByRole('checkbox').uncheck();await page.waitForTimeout(350);expected='Se ocultan y recuperan todas las líneas';pass=off.links.length===0&&(await inspect()).links.length===before.links.length}
      if(scenario==='api_error_recuperacion'){s.apiError=true;await page.waitForTimeout(500);const stop=calls;s.apiError=false;await page.waitForTimeout(650);expected='El sondeo se recupera tras un error de API';pass=calls>stop}
      if(scenario==='nodo_sin_responder'){s.delay=1800;s.slow='http://127.0.0.1:29104';for(const r of Object.values(s.replies))r.Data.balancerList=[];const started=Date.now();await poll();await page.waitForTimeout(700);expected='Se conserva la ronda anterior hasta recibir todas las respuestas y se publica la nueva de una vez';const early=await inspect();await page.waitForTimeout(1500);const after=await inspect();pass=before.links.length>0&&JSON.stringify(before.links)===JSON.stringify(early.links)&&JSON.stringify(before.names)===JSON.stringify(early.names)&&JSON.stringify(before.links)!==JSON.stringify(after.links)&&errors.length===0;results.push({view,scenario,pass,expected,before,early,after,elapsed:Date.now()-started,errors});continue}
      if(scenario==='refresco_automatico_coherente'){
        s.delay=650;s.slow='http://127.0.0.1:29104';for(const r of Object.values(s.replies))r.Data.balancerList=[];
        const samples=await page.evaluate(async view=>{
          const c=ng.getComponent(document.querySelector(view)),samples=[],start=Date.now();let previous;
          while(samples.length<4&&Date.now()-start<6000){
            const snapshot=c.snapshot;
            if(snapshot&&snapshot.refreshedAt!==previous){previous=snapshot.refreshedAt;samples.push({elapsed:Date.now()-start,refreshedAt:previous,online:snapshot.nodes.filter(n=>n.status).length,pending:snapshot.nodes.filter(n=>n.pending).length,links:snapshot.links.map(l=>l.source+'>'+l.target)});}
            await new Promise(resolve=>setTimeout(resolve,10));
          }
          return samples;
        },view);
        expected='Tres refrescos automáticos con un nodo lento conservan la disponibilidad y publican una ronda completa cada vez';
        const after=await inspect();pass=samples.length===4&&samples.every(sample=>sample.online===6&&sample.pending===0)&&JSON.stringify(before.links)!==JSON.stringify(after.links)&&errors.length===0;
        results.push({view,scenario,pass,expected,interval:s.interval,delay:s.delay,samples,before,after,errors});continue;
      }
      if(scenario==='navegar_con_peticion_pendiente'){s.delay=700;await poll();await page.waitForTimeout(180);await page.evaluate(view=>{window.auditOldComponent=ng.getComponent(document.querySelector(view));window.auditOldComponent.irALista()},view);await page.waitForTimeout(1000);expected='La vista destruida no conserva ni reactiva su sondeo';const timerClosed=await page.evaluate(()=>window.auditOldComponent.timerSubscription?.closed);pass=timerClosed===true;results.push({view,scenario,pass,expected,url:page.url(),timerClosed,calls,errors});continue}
      results.push({view,scenario,pass,expected,before,after:await inspect(),errors});
    }catch(e){results.push({view,scenario,pass:false,error:e.message,errors})}
    finally{await page.close()}
  }
  return results;
}
