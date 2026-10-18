async root => {
  const page=await root.context().newPage();
  page.setDefaultTimeout(8000);
  const base='http://127.0.0.1:4200',results=[],errors=[],httpErrors=[],writes=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('response',r=>{if(r.status()>=400)httpErrors.push({url:r.url(),status:r.status()});});
  page.on('request',r=>{if(r.url().includes('/api/')&&r.method()!=='GET')writes.push({url:r.url(),method:r.method()});});
  const step=async(name,fn)=>{try{results.push({name,...await fn()});}catch(e){results.push({name,error:e.message});}};
  const state=()=>page.evaluate(()=>{
    const c=ng.getComponent(document.querySelector('grafo, mapa'));
    return {summary:document.querySelector('.monitor-summary').innerText,nodes:c.snapshot.nodes.map(s=>({id:s.nodo.id,name:s.nodo.nombre,type:s.nodo.tipo_nodo,group:s.group,status:s.status,pending:!!s.pending,error:s.error,endpoint:s.endpoint})),links:c.snapshot.links.map(l=>({from:c.snapshot.nodes.find(n=>n.nodo.id===l.source)?.nodo.nombre,to:c.snapshot.nodes.find(n=>n.nodo.id===l.target)?.nodo.nombre,kind:l.kind})),warnings:c.snapshot.warnings,selected:c.selectedNodes.map(s=>s.nodo.nombre)};
  });
  const boxes=()=>page.evaluate(()=>{
    const c=ng.getComponent(document.querySelector('grafo')),series=c.myChart.getModel().getSeriesByIndex(0),data=series.getData(),option=c.myChart.getOption().series[0];
    const items=[];
    for(let i=0;i<data.count();i++){
      const el=data.getItemGraphicEl(i),r=el.getBoundingRect().clone();r.applyTransform(el.getComputedTransform());
      const label=el.getTextContent(),lr=label?.getBoundingRect().clone();if(lr)lr.applyTransform(label.getComputedTransform());
      items.push({name:option.data[i].name,icon:{x:r.x,y:r.y,w:r.width,h:r.height},label:lr?{x:lr.x,y:lr.y,w:lr.width,h:lr.height}:null});
    }
    const intersects=(a,b)=>a&&b&&a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
    const iconCollisions=[],labelIconCollisions=[];
    for(let i=0;i<items.length;i++)for(let j=0;j<items.length;j++)if(i!==j){
      if(i<j&&intersects(items[i].icon,items[j].icon))iconCollisions.push([items[i].name,items[j].name]);
      if(intersects(items[i].label,items[j].icon))labelIconCollisions.push([items[i].name,items[j].name]);
    }
    return {size:{width:innerWidth,height:innerHeight,canvasWidth:c.container.nativeElement.clientWidth,canvasHeight:c.container.nativeElement.clientHeight},iconCollisions,labelIconCollisions,items};
  });
  const waitRound=()=>page.waitForFunction(()=>{const c=ng.getComponent(document.querySelector('grafo, mapa'));return c?.snapshot?.nodes.length&&c.snapshot.nodes.every(n=>!n.pending);});
  try{
    await page.setViewportSize({width:1366,height:768});
    await page.goto(base+'/grafo');await page.locator('monitor-toolbar').waitFor();await waitRound();
    await step('estado_inicial_real',async()=>await state());
    await step('refresco_real_sin_interceptar',async()=>{
      await page.evaluate(()=>{
        window.desktopAuditSamples=[];window.desktopAuditSignature='';
        window.desktopAuditTimer=setInterval(()=>{
          const c=ng.getComponent(document.querySelector('grafo'));if(!c?.snapshot)return;
          const s=c.snapshot;
          const value={nodes:s.nodes.map(n=>({name:n.nodo.nombre,status:n.status,pending:!!n.pending,group:n.group})),links:s.links.map(l=>({source:l.source,target:l.target,kind:l.kind}))};
          const signature=JSON.stringify(value);
          if(signature!==window.desktopAuditSignature){window.desktopAuditSignature=signature;window.desktopAuditSamples.push({time:new Date().toISOString(),summary:document.querySelector('.monitor-summary').innerText,...value});}
        },25);
      });
      await page.waitForTimeout(21000);
      return await page.evaluate(()=>{clearInterval(window.desktopAuditTimer);return {samples:window.desktopAuditSamples};});
    });
    for(const size of [{width:1366,height:768},{width:1920,height:1080},{width:1280,height:720}]){
      await step('distribucion_'+size.width+'x'+size.height,async()=>{
        await page.setViewportSize(size);await page.waitForTimeout(350);await waitRound();
        await page.getByRole('button',{name:'Ajustar vista',exact:true}).click();await page.waitForTimeout(100);
        await page.screenshot({path:'diagnostico/escritorio-real/grafo-'+size.width+'x'+size.height+'.png'});
        return await boxes();
      });
    }
    await page.setViewportSize({width:1366,height:768});
    await step('filtros_reales',async()=>{
      await waitRound();const records=[];
      const groups=await page.getByRole('combobox',{name:'Grupo',exact:true}).locator('option').evaluateAll(options=>options.map(o=>o.value));
      for(const group of groups){await page.getByRole('combobox',{name:'Grupo',exact:true}).selectOption(group);records.push({group,...await state()});}
      await page.getByRole('combobox',{name:'Grupo',exact:true}).selectOption('');
      for(const status of ['online','offline','']){await page.getByRole('combobox',{name:'Estado',exact:true}).selectOption(status);records.push({status,...await state()});}
      await page.getByRole('combobox',{name:'Tipo',exact:true}).selectOption('Procesador');records.push({type:'Procesador',...await state()});
      await page.getByRole('combobox',{name:'Tipo',exact:true}).selectOption('');
      return {records};
    });
    await step('conexiones_y_avisos',async()=>{
      await page.getByLabel('Desactivar conexiones',{exact:true}).check();
      const off=await page.evaluate(()=>ng.getComponent(document.querySelector('grafo')).myChart.getOption().series[0].links.length);
      await page.getByLabel('Desactivar conexiones',{exact:true}).uncheck();
      const on=await page.evaluate(()=>ng.getComponent(document.querySelector('grafo')).myChart.getOption().series[0].links.length);
      await page.locator('details').first().locator('summary').click();await page.waitForTimeout(100);
      await page.screenshot({path:'diagnostico/escritorio-real/avisos-reales.png'});
      const warnings=await page.locator('details').first().innerText();await page.locator('details').first().locator('summary').click();
      return {off,on,warnings};
    });
    await step('mapa_y_conexiones_reales',async()=>{
      await page.getByRole('link',{name:'Mapa',exact:true}).click();await page.locator('.leaflet-marker-icon').first().waitFor();await waitRound();await page.waitForTimeout(500);
      await page.getByRole('button',{name:'Ajustar vista',exact:true}).click();await page.waitForTimeout(400);
      await page.screenshot({path:'diagnostico/escritorio-real/mapa-real.png'});
      return {...await state(),map:await page.evaluate(()=>{
        const c=ng.getComponent(document.querySelector('mapa'));
        const markers=c.iconos.map((m,i)=>({name:c.selectedNodes.filter(s=>Number.isFinite(Number(s.nodo.latitud))&&Number.isFinite(Number(s.nodo.longitud)))[i]?.nodo.nombre,point:c.map.latLngToContainerPoint(m.getLatLng()),latlng:m.getLatLng()}));
        const collisions=[];for(let i=0;i<markers.length;i++)for(let j=i+1;j<markers.length;j++)if(Math.abs(markers[i].point.x-markers[j].point.x)<32&&Math.abs(markers[i].point.y-markers[j].point.y)<32)collisions.push([markers[i].name,markers[j].name]);
        return {markers,lineCount:c.lineas.length,markerCollisions:collisions,zoom:c.map.getZoom(),names:[...document.querySelectorAll('.leaflet-marker-icon')].map(e=>({alt:e.getAttribute('alt'),label:e.getAttribute('aria-label')}))};
      })};
    });
    await step('mapa_foco_con_refresco_real',async()=>{
      const marker=page.locator('.leaflet-marker-icon').first();await marker.focus();
      const before=await page.evaluate(()=>({tag:document.activeElement.tagName,role:document.activeElement.getAttribute('role')}));
      await page.waitForTimeout(5400);
      return {before,after:await page.evaluate(()=>({tag:document.activeElement.tagName,role:document.activeElement.getAttribute('role')}))};
    });
    return {date:new Date().toISOString(),mode:'desktop-real-no-network-interception',results,errors,httpErrors,writes};
  }finally{await page.close();}
}
