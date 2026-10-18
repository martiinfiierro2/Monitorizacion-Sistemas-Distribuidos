async root => {
  const results=[];
  const base='http://127.0.0.1:4200';
  const nodes=[
    {id:1,nombre:'CM audit',tipo_nodo:'Controlador Main',url:'http://127.0.0.1',puerto:'3000',latitud:38,longitud:0,visible:true,orden:1,tiempo:null},
    {id:2,nombre:'BM audit',tipo_nodo:'Balanceador Main',url:'http://127.0.0.1',puerto:'3100',latitud:39,longitud:1,visible:true,orden:2,tiempo:null},
    {id:3,nombre:'P audit',tipo_nodo:'Procesador',url:'http://127.0.0.1',puerto:'4001',latitud:40,longitud:2,visible:true,orden:3,tiempo:null}
  ];
  const debug=id=>({Type:'REPLY',Operation:'RESULT',Data:{
    internalConfig:id===1?{urlBalancerMain:'http://127.0.0.1:3100'}:id===2?{urlCoordinatorMain:'http://127.0.0.1:3000'}:{capacity:100,preference:1,urlCoordinatorMain:'http://127.0.0.1:3000'},
    processorsList:id===1?[{name:'P audit',url:'http://127.0.0.1:4001',capacity:100,preference:1}]:[],
    balancerList:id===2?[{name:'P audit',url:'http://127.0.0.1:4001',load:100}]:[],receivedMessages:7,receivedRate:0
  }});
  const scenario=async(name,run)=>{
    const page=await root.context().newPage();page.setDefaultTimeout(5000);
    const state={catalogRequests:0,debugRequests:0,writes:[],pageErrors:[],configInterval:1500,custom:null};
    page.on('pageerror',e=>state.pageErrors.push(e.message));
    await page.route('**/assets/theme/config.json',async route=>{
      const response=await route.fetch(),json=await response.json();
      json.debugProxy=true;json.espera.valor=state.configInterval;json.requestTimeout=3000;
      await route.fulfill({json});
    });
    await page.route('**/api/**',async route=>{
      const req=route.request(),url=new URL(req.url()),path=url.pathname,method=req.method();
      if(method!=='GET')state.writes.push({path,method,data:req.postDataJSON()});
      if(state.custom&&await state.custom(route,path,method))return;
      if(path.endsWith('/debug')){state.debugRequests++;return route.fulfill({json:debug(Number(path.split('/')[3]))});}
      if(method==='PATCH')return route.fulfill({json:{ok:true,tiempo:new Date().toISOString()}});
      if(method!=='GET')return route.fulfill({status:400,json:{errores:[{msg:'El nombre debe tener entre 1 y 50 caracteres'},{msg:'Puerto entre 1 y 65535'}]}});
      const id=path.match(/^\/api\/nodo\/(\d+)$/);
      if(id)return route.fulfill({json:{ok:true,nodo:nodes.find(n=>n.id===Number(id[1]))}});
      state.catalogRequests++;return route.fulfill({json:{ok:true,nodos:nodes}});
    });
    try{results.push({name,...await run(page,state),pageErrors:state.pageErrors});}
    catch(e){results.push({name,error:e.message,pageErrors:state.pageErrors,text:(await page.locator('body').innerText()).slice(0,2000)});}
    finally{await page.close();}
  };
  const snapshot=page=>page.evaluate(()=>{
    const c=ng.getComponent(document.querySelector('grafo, mapa'));
    return {error:c.snapshot?.error,stale:c.snapshot?.stale,nodes:c.snapshot?.nodes.map(s=>({name:s.nodo.nombre,status:s.status,pending:s.pending,lastSeen:s.lastSeen,group:s.group})),filters:c.filters,selected:c.selectedNodes.length,summary:document.querySelector('.monitor-summary')?.innerText};
  });
  await scenario('respuesta_malformada_aislamiento',async(page,state)=>{
    state.custom=async(route,path)=>{
      if(!path.endsWith('/debug'))return false;
      const id=Number(path.split('/')[3]),response=debug(id);
      if(id===1)response.Data.balancerList=[null];else await page.waitForTimeout(150);
      await route.fulfill({json:response});return true;
    };
    await page.goto(base+'/grafo');await page.locator('monitor-toolbar').waitFor();await page.waitForTimeout(700);
    await page.screenshot({path:'diagnostico/auditoria-playwright/respuesta-malformada.png'});
    return {snapshot:await snapshot(page),body:await page.locator('monitor-toolbar').innerText()};
  });
  await scenario('nodo_lento_sin_caida',async(page,state)=>{
    state.configInterval=2000;
    state.custom=async(route,path)=>{
      if(!path.endsWith('/debug'))return false;
      const id=Number(path.split('/')[3]);
      if(id===3&&state.catalogRequests>=2)await page.waitForTimeout(1200);
      await route.fulfill({json:debug(id)});return true;
    };
    await page.goto(base+'/grafo');await page.locator('monitor-toolbar').waitFor();
    await page.waitForFunction(()=>ng.getComponent(document.querySelector('grafo')).snapshot?.nodes.filter(s=>s.status).length===3);
    const stable=await snapshot(page),samples=[];
    for(let i=0;i<32;i++){await page.waitForTimeout(100);samples.push(await snapshot(page));}
    return {stable,requests:state.catalogRequests,falseOffline:samples.filter(s=>s.nodes.some(n=>n.pending&&!n.status&&stable.nodes.some(previous=>previous.name===n.name&&previous.status))),samples:samples.map(s=>({summary:s.summary,online:s.nodes.filter(n=>n.status).length}))};
  });
  await scenario('filtro_grupo_tras_caida',async(page,state)=>{
    let offline=false;
    state.custom=async(route,path)=>{if(offline&&path.endsWith('/debug')){await route.fulfill({status:502,json:{msg:'Proceso no disponible'}});return true;}return false;};
    await page.goto(base+'/grafo');await page.locator('monitor-toolbar').waitFor();await page.waitForTimeout(300);
    await page.getByRole('combobox',{name:'Grupo',exact:true}).selectOption('Grupo 1');
    const before=await snapshot(page);offline=true;await page.getByRole('button',{name:'Actualizar',exact:true}).click();await page.waitForTimeout(400);
    return {before,after:await snapshot(page),options:await page.getByRole('combobox',{name:'Grupo',exact:true}).locator('option').allTextContents(),value:await page.getByRole('combobox',{name:'Grupo',exact:true}).inputValue(),empty:await page.locator('.monitor-empty').allTextContents()};
  });
  await scenario('catalogo_recuperacion_sin_recargar',async(page,state)=>{
    let fail=true;
    state.custom=async(route,path,method)=>{if(fail&&method==='GET'&&path==='/api/nodos'){state.catalogRequests++;await route.fulfill({status:503,json:{msg:'Base de datos temporalmente no disponible'}});return true;}return false;};
    await page.goto(base+'/lista');await page.getByRole('alert').waitFor();fail=false;
    await page.waitForTimeout(1800);
    const unchanged={requests:state.catalogRequests,rows:await page.locator('tr.mat-mdc-row').count(),error:await page.getByRole('alert').innerText(),retryButtons:await page.getByRole('button',{name:/Actualizar|Reintentar|Recargar/}).count()};
    await page.locator('input[type=search]').fill('');await page.waitForTimeout(400);
    const emptySearchRetry=state.catalogRequests;
    await page.locator('input[type=search]').fill('CM');await page.waitForTimeout(400);
    return {unchanged,emptySearchRetry,recoveredBySearch:await page.locator('tr.mat-mdc-row').count()};
  });
  await scenario('acceso_protegido_entrada_directa_catalogo',async(page,state)=>{
    await page.addInitScript(()=>sessionStorage.removeItem('monitor-token'));
    state.custom=async(route)=>{await route.fulfill({status:401,json:{msg:'Acceso no autorizado'}});return true;};
    await page.goto(base+'/lista');await page.getByRole('alert').waitFor();
    return {body:await page.locator('body').innerText(),passwordInputs:await page.locator('input[type=password]').count(),connectButtons:await page.getByRole('button',{name:'Conectar',exact:true}).count()};
  });
  await scenario('formulario_validacion_y_teclado',async(page,state)=>{
    await page.goto(base+'/lista');await page.getByRole('button',{name:/Añadir Nodo/}).click();await page.waitForTimeout(300);
    const closeButton=await page.getByRole('dialog').getByRole('button').first().getAttribute('aria-label');
    await page.locator('.dialog .anadir').click();await page.getByRole('alert').waitFor();
    const validation=await page.getByRole('dialog').innerText();
    await page.getByLabel('Nombre',{exact:true}).fill('Prueba Enter');await page.getByLabel('Puerto',{exact:true}).fill('4999');await page.getByPlaceholder('Latitud').fill('41');await page.getByPlaceholder('Longitud').fill('3');
    const before=state.writes.length;await page.getByLabel('Nombre',{exact:true}).press('Enter');await page.waitForTimeout(250);
    return {validation,closeButton,requestsAfterInvalid:before,submittedWithEnter:state.writes.length>before,writes:state.writes};
  });
  await scenario('detalle_fecha_fallo_guardado',async(page,state)=>{
    state.custom=async(route,path,method)=>{if(method==='PATCH'){await route.fulfill({status:503,json:{msg:'No se pudo guardar la fecha'}});return true;}return false;};
    await page.goto(base+'/lista');await page.getByRole('button',{name:'Boton para visualizar',exact:true}).first().click();await page.getByRole('heading',{name:'Estado del proceso',exact:true}).waitFor();await page.waitForTimeout(300);
    return {body:await page.getByRole('dialog').innerText(),visibleErrors:await page.getByRole('alert').allTextContents(),patchRequests:state.writes.length};
  });
  await scenario('marcador_teclado_pierde_foco_al_refrescar',async(page,state)=>{
    state.configInterval=800;
    await page.goto(base+'/mapa');const marker=page.locator('.leaflet-marker-icon').first();await marker.waitFor();await marker.focus();
    const before=await page.evaluate(()=>({tag:document.activeElement.tagName,role:document.activeElement.getAttribute('role'),alt:document.activeElement.getAttribute('alt')}));
    await page.waitForTimeout(1100);
    const after=await page.evaluate(()=>({tag:document.activeElement.tagName,role:document.activeElement.getAttribute('role'),alt:document.activeElement.getAttribute('alt')}));
    return {before,after};
  });
  await scenario('ruta_inexistente_consola',async(page)=>{
    const consoleErrors=[];page.on('console',msg=>{if(msg.type()==='error')consoleErrors.push(msg.text());});
    const response=await page.goto(base+'/ruta-que-no-existe');await page.waitForTimeout(1500);
    await page.screenshot({path:'diagnostico/auditoria-playwright/ruta-inexistente.png'});
    return {httpStatus:response.status(),url:page.url(),body:await page.locator('body').innerText(),consoleErrors};
  });
  await scenario('cancelar_borrado_y_edicion',async(page,state)=>{
    await page.goto(base+'/lista');await page.getByRole('button',{name:'Eliminar nodo',exact:true}).first().click();
    await page.getByRole('button',{name:'Cancelar',exact:true}).click();
    await page.getByRole('button',{name:'Boton para editar',exact:true}).first().click();
    await page.getByLabel('Nombre',{exact:true}).fill('No guardar');await page.keyboard.press('Escape');
    return {writes:state.writes,rows:await page.locator('tr.mat-mdc-row').count()};
  });
  return {date:new Date().toISOString(),isolated:true,results};
}
