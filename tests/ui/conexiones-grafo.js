async rootPage => {
  const view = 'grafo';
  const results = [];
  const make = () => {
    const nodes = [], replies = {};
    for (let g=1;g<=2;g++) {
      const types=['Controlador Main','Controlador Subs','Balanceador Main','Balanceador Subs','Procesador','Procesador'];
      const names=['CM','CS','BM','BS','P','Q'];
      const ports=types.map((_,i)=>25000+g*100+i);
      const url=i=>'http://127.0.0.1:'+ports[i];
      const processors=[4,5].map(i=>({name:names[i]+g,url:url(i),capacity:100,load:50,preference:1,AYACOUNT:3,AYAUID:''}));
      types.forEach((type,i)=>{
        const node={id:g*100+i,nombre:names[i]+g,tipo_nodo:type,url:'http://127.0.0.1',puerto:String(ports[i]),latitud:g*10+i,longitud:g*20+i,visible:true,tiempo:null,orden:i};
        nodes.push(node);
        replies[url(i)]={UID:'audit',Type:'REPLY',Operation:'RESULT',Data:{UID:0,internalConfig:{port:ports[i],type:i===1||i===3?'subs':'main',urlMain:i===3?url(2):'',urlBalancerMain:url(2),urlBalancerSubs:url(3),urlCoordinatorlMain:i===1?url(0):'',urlCoordinatorMain:url(0),urlCoordinatorSubs:url(1),capacity:100,preference:1,name:names[i]+g},processorsList:processors,balancerList:processors,balancerSubsActive:false,coordinatorSubsActive:false,receivedMessages:1}};
      });
    }
    return {nodes,replies,offline:[],delay:0};
  };
  const endpoint=n=>n.url+':'+n.puerto;
  const node=(s,name)=>s.nodes.find(n=>n.nombre===name);
  const reply=(s,name)=>s.replies[endpoint(node(s,name))].Data;
  const cases = [
    ['dos_grupos_normales',s=>{},['BM1>P1','BM1>Q1','BS1>BM1','CM1>BM1','CS1>CM1','BM2>P2','BM2>Q2','BS2>BM2','CM2>BM2','CS2>CM2']],
    ['balanceador_main_caido',s=>{s.offline.push('BM1');reply(s,'BS1').balancerSubsActive=true},['BS1>P1','BS1>Q1','CM1>BS1','CS1>CM1','BM2>P2','BM2>Q2','BS2>BM2','CM2>BM2','CS2>CM2']],
    ['controlador_main_caido',s=>{s.offline.push('CM1');reply(s,'CS1').coordinatorSubsActive=true},['BM1>P1','BM1>Q1','BS1>BM1','CS1>BM1','BM2>P2','BM2>Q2','BS2>BM2','CM2>BM2','CS2>CM2']],
    ['dos_main_caidos',s=>{s.offline.push('CM1','BM1');reply(s,'CS1').coordinatorSubsActive=true;reply(s,'BS1').balancerSubsActive=true},['BS1>P1','BS1>Q1','CS1>BS1','BM2>P2','BM2>Q2','BS2>BM2','CM2>BM2','CS2>CM2']],
    ['todos_caidos',s=>s.offline.push(...s.nodes.map(n=>n.nombre)),[]],
    ['procesador_caido',s=>s.offline.push('P1'),['BM1>Q1','BS1>BM1','CM1>BM1','CS1>CM1','BM2>P2','BM2>Q2','BS2>BM2','CM2>BM2','CS2>CM2']],
    ['procesador_oculto_con_main',s=>{node(s,'P1').visible=false},['BM1>Q1','BS1>BM1','CM1>BM1','CS1>CM1','BM2>P2','BM2>Q2','BS2>BM2','CM2>BM2','CS2>CM2']],
    ['procesador_oculto_con_subs',s=>{s.offline.push('BM1');reply(s,'BS1').balancerSubsActive=true;node(s,'P1').visible=false},['BS1>Q1','CM1>BS1','CS1>CM1','BM2>P2','BM2>Q2','BS2>BM2','CM2>BM2','CS2>CM2']],
    ['subs_balanceador_aun_no_activo',s=>s.offline.push('BM1'),['CS1>CM1','BM2>P2','BM2>Q2','BS2>BM2','CM2>BM2','CS2>CM2']],
    ['subs_controlador_aun_no_activo',s=>s.offline.push('CM1'),['BM1>P1','BM1>Q1','BS1>BM1','BM2>P2','BM2>Q2','BS2>BM2','CM2>BM2','CS2>CM2']],
    ['main_balanceador_fuera_catalogo',s=>{reply(s,'BS1').balancerSubsActive=true;s.nodes=s.nodes.filter(n=>n.nombre!=='BM1')},['BS1>P1','BS1>Q1','CM1>BS1','CS1>CM1','BM2>P2','BM2>Q2','BS2>BM2','CM2>BM2','CS2>CM2']],
    ['main_controlador_fuera_catalogo',s=>{reply(s,'CS1').coordinatorSubsActive=true;s.nodes=s.nodes.filter(n=>n.nombre!=='CM1')},['BM1>P1','BM1>Q1','BS1>BM1','CS1>BM1','BM2>P2','BM2>Q2','BS2>BM2','CM2>BM2','CS2>CM2']],
    ['equivalencia_localhost',s=>{const n=node(s,'P1');const old=endpoint(n);n.url='http://localhost';s.replies[endpoint(n)]=s.replies[old]},['BM1>P1','BM1>Q1','BS1>BM1','CM1>BM1','CS1>CM1','BM2>P2','BM2>Q2','BS2>BM2','CM2>BM2','CS2>CM2']],
    ['debug_formato_invalido',s=>{s.replies[endpoint(node(s,'BM1'))]={unexpected:true}},null],
    ['coordenadas_invalidas',s=>{node(s,'P1').latitud='invalid'},null],
    ['tipo_desconocido',s=>{node(s,'P1').tipo_nodo='Otro'},null]
  ];
  for (const [name,mutate,expected] of cases) {
    const s=make();mutate(s);
    const page=await rootPage.context().newPage();
    const errors=[];
    page.on('console',m=>{if(m.type()==='error' && /TypeError|Error:|NaN|undefined/.test(m.text()))errors.push(m.text().split('\n').slice(0,2).join(' '))});
    await page.route('**/api/**',async route=>{
      await new Promise(r=>setTimeout(r,100));
      if(route.request().method()!=='GET')return route.abort();
      return route.fulfill({json:{ok:true,nodos:s.nodes}});
    });
    await page.route('**/assets/theme/config.json',async route=>{
      const response=await route.fetch();const json=await response.json();json.espera.valor=60000;json.debugProxy=false;await route.fulfill({json});
    });
    await page.route('**/sfmp',route=>{
      const base=route.request().url().replace(/\/sfmp$/,'');
      const n=s.nodes.find(n=>endpoint(n).replace('localhost','127.0.0.1')===base.replace('localhost','127.0.0.1'));
      return n && !s.offline.includes(n.nombre)?route.fulfill({json:s.replies[base]}):route.abort();
    });
    await page.route('**/*.tile.openstreetmap.org/**',r=>r.abort());
    try {
      await page.goto('http://127.0.0.1:24500/'+view);
      await page.waitForFunction(view=>{
        const element=document.querySelector(view);if(!element)return false;
        const c=ng.getComponent(element);
        return !!c.snapshot?.refreshedAt&&(view==='grafo'?!!c.myChart?.getOption()?.series?.[0]:!!c.map);
      },view);
      const actual=await page.evaluate(({view,nodes})=>{
        const c=ng.getComponent(document.querySelector(view));
        if(view==='grafo') {
          const series=c.myChart?.getOption()?.series?.[0];
          if(!series)return {initialized:false,links:[],nodes:[]};
          const names=Object.fromEntries(nodes.map(n=>[String(n.id),n.nombre])); const rendered=[];c.myChart.getModel().getSeriesByIndex(0).getGraph().eachEdge(e=>rendered.push(names[e.node1.id]+'>'+names[e.node2.id]));
          return {initialized:true,links:rendered.sort(),configuredLinks:series.links.map(l=>names[l.source]+'>'+names[l.target]).sort(),nodes:series.data.map(n=>n.name),size:[c.myChart.getWidth(),c.myChart.getHeight()]};
        }
        return {initialized:!!c.datosDelSistema,links:(c.lineas||[]).filter(l=>c.map.hasLayer(l)).map(l=>l.getLatLngs().map(pos=>nodes.find(n=>Number(n.latitud)===pos.lat&&Number(n.longitud)===pos.lng)?.nombre||'?').join('>')).sort(),nodes:c.iconos.map(m=>{const c=m.getTooltip().getContent();return typeof c==='string'?c:c.textContent.split(' ? ')[0]}),size:c.map.getSize()};
      },{view,nodes:s.nodes});
      const exp=expected?.slice().sort();
      results.push({view,scenario:name,pass:expected?actual.initialized&&JSON.stringify(exp)===JSON.stringify(actual.links):actual.initialized&&errors.length===0,expected:exp,actual,errors});
    }catch(e){results.push({view,scenario:name,pass:false,error:e.message,errors})}
    finally{await page.close()}
  }
  return results;
}
