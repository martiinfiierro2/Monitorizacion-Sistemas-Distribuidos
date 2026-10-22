async root=>{
  const page=await root.context().newPage();page.setDefaultTimeout(9000);
  const base='http://127.0.0.1:4200',results=[],errors=[],blockedWrites=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/api/nodo/*/consulta',route=>{
    if(route.request().method()!=='PATCH')return route.continue();
    blockedWrites.push(route.request().url());return route.abort('blockedbyclient');
  });
  const catalog=async()=>(await(await page.request.get(base+'/api/nodos')).json()).nodos;
  const before=await catalog();
  const step=async(name,fn)=>{try{results.push({name,...await fn()});}catch(e){results.push({name,pass:false,error:e.message});}};
  const done=()=>page.waitForFunction(()=>{const c=ng.getComponent(document.querySelector('grafo, mapa'));return c?.snapshot?.nodes.length&&c.snapshot.nodes.every(n=>!n.pending);});
  const fresh=async()=>{
    await done();const stamp=await page.evaluate(()=>Date.now());
    const request=page.waitForResponse(r=>r.url().endsWith('/api/nodosOrden'));
    await page.getByRole('button',{name:'Actualizar',exact:true}).click();await request;
    await page.waitForFunction(stamp=>{const c=ng.getComponent(document.querySelector('grafo, mapa'));return c.snapshot.refreshedAt>=stamp&&c.snapshot.nodes.every(n=>!n.pending);},stamp);
  };
  const graphGeometry=()=>page.evaluate(()=>{
    const c=ng.getComponent(document.querySelector('grafo')),data=c.myChart.getModel().getSeriesByIndex(0).getData(),option=c.myChart.getOption().series[0];
    const rect=el=>{if(!el)return null;const r=el.getBoundingRect().clone();r.applyTransform(el.getComputedTransform());return {x:r.x,y:r.y,w:r.width,h:r.height};};
    const nodes=[];for(let i=0;i<data.count();i++){const p=data.getItemGraphicEl(i).getSymbolPath();nodes.push({name:option.data[i].name,icon:rect(p),label:rect(p.getTextContent())});}
    const overlaps=(a,b)=>a&&b&&a.x<b.x+b.w-.5&&a.x+a.w>b.x+.5&&a.y<b.y+b.h-.5&&a.y+a.h>b.y+.5;
    const collisions=[];for(let i=0;i<nodes.length;i++)for(let j=i+1;j<nodes.length;j++)if(overlaps(nodes[i].icon,nodes[j].icon)||overlaps(nodes[i].label,nodes[j].icon)||overlaps(nodes[i].icon,nodes[j].label)||overlaps(nodes[i].label,nodes[j].label))collisions.push([nodes[i].name,nodes[j].name]);
    const canvas=c.container.nativeElement.getBoundingClientRect(),width=canvas.width,height=canvas.height;
    const clipped=nodes.filter(n=>[n.icon,n.label].some(r=>r&&(r.x<-.5||r.y<-.5||r.x+r.w>width+.5||r.y+r.h>height+.5))).map(n=>n.name);
    return {nodes,collisions,clipped,canvas:canvas.toJSON(),toolbarHeight:document.querySelector('monitor-toolbar').getBoundingClientRect().height,mainHeight:document.querySelector('mat-sidenav-content').clientHeight,mainScroll:document.querySelector('mat-sidenav-content').scrollHeight,zoom:option.zoom,center:option.center};
  });
  const openCatalogDetail=async name=>{
    if(!page.url().endsWith('/lista')){await page.getByRole('link',{name:'Catálogo',exact:true}).click();await page.locator('tr.mat-mdc-row').first().waitFor();}
    await page.locator('input[type=search]').fill(name);
    await page.locator('tr.mat-mdc-row').filter({has:page.getByText(name,{exact:true})}).locator('button[mattooltip="Ver información"]').click();
    await page.waitForFunction(()=>{const el=document.querySelector('dialogDatos');return el&&ng.getComponent(el).loading===false;});await page.waitForTimeout(250);
  };
  const closeDetail=async()=>{await page.getByRole('button',{name:'Cerrar detalle',exact:true}).click();await page.getByRole('dialog').waitFor({state:'hidden'});};
  const detailGeometry=()=>page.evaluate(()=>{
    const panel=document.querySelector('.node-detail-panel'),header=document.querySelector('.node-detail-header'),body=document.querySelector('.node-detail-content'),footer=document.querySelector('.node-detail-footer'),title=document.querySelector('.node-detail-title');
    return {panel:panel.getBoundingClientRect().toJSON(),header:header.getBoundingClientRect().toJSON(),body:body.getBoundingClientRect().toJSON(),footer:footer.getBoundingClientRect().toJSON(),bodyHeight:body.clientHeight,bodyScroll:body.scrollHeight,bodyScrollTop:body.scrollTop,titleFont:getComputedStyle(title).fontSize,tableOverflow:[...body.querySelectorAll('.node-table-scroll')].map(e=>({client:e.clientWidth,scroll:e.scrollWidth})),text:document.querySelector('.node-detail').innerText};
  });
  try{
    await page.setViewportSize({width:1366,height:768});await page.goto(base+'/grafo');await page.locator('monitor-toolbar').waitFor();await done();
    for(const size of [{width:1366,height:768},{width:1280,height:720},{width:1920,height:1080}]){
      await step('grafo_completo_'+size.width+'x'+size.height,async()=>{
        await page.setViewportSize(size);await page.waitForTimeout(250);await fresh();await page.getByRole('button',{name:'Ajustar vista',exact:true}).click();
        const value=await graphGeometry();await page.screenshot({path:'diagnostico/interfaz/grafo-'+size.width+'x'+size.height+'.png'});
        return {...value,pass:value.nodes.length===before.filter(n=>n.visible).length&&value.clipped.length===0&&value.collisions.length===0&&value.toolbarHeight<110&&value.mainHeight===value.mainScroll&&value.canvas.bottom<=size.height};
      });
    }
    await page.setViewportSize({width:1366,height:768});await fresh();await page.getByRole('button',{name:'Ajustar vista',exact:true}).click();
    await step('botones_zoom',async()=>{
      await page.getByRole('button',{name:'Acercar grafo',exact:true}).click();const zoomIn=(await graphGeometry()).zoom;
      await page.getByRole('button',{name:'Alejar grafo',exact:true}).click();const zoomOut=(await graphGeometry()).zoom;
      return {zoomIn,zoomOut,pass:zoomIn>1&&Math.abs(zoomOut-1)<.001};
    });
    await step('rueda_zoom',async()=>{
      const box=await page.locator('#grafo').boundingBox();await page.mouse.move(box.x+box.width*.45,box.y+box.height*.45);await page.mouse.wheel(0,-200);await page.waitForTimeout(150);
      const zoom=(await graphGeometry()).zoom;return {zoom,pass:zoom>1};
    });
    await step('arrastre_y_conservacion_de_vista',async()=>{
      await fresh();const before=await graphGeometry(),box=before.canvas;
      await page.mouse.move(box.x+box.width*.4,box.y+box.height*.45);await page.mouse.down();await page.mouse.move(box.x+box.width*.4+90,box.y+box.height*.45+35,{steps:12});await page.mouse.up();
      const dragged=await graphGeometry();await page.waitForTimeout(5300);await done();const after=await graphGeometry();
      return {beforeCenter:before.center,draggedCenter:dragged.center,afterCenter:after.center,delta:dragged.nodes[0].icon.x-before.nodes[0].icon.x,pass:Math.abs(dragged.nodes[0].icon.x-before.nodes[0].icon.x)>50&&JSON.stringify(dragged.center)===JSON.stringify(after.center)&&Math.abs(dragged.zoom-after.zoom)<.001};
    });
    await step('centrar_restaura_todos',async()=>{
      await page.getByRole('button',{name:'Centrar grafo',exact:true}).click();await fresh();const v=await graphGeometry();return {clipped:v.clipped,collisions:v.collisions,zoom:v.zoom,pass:v.zoom===1&&!v.clipped.length&&!v.collisions.length};
    });
    await step('clic_ultimo_nodo_sin_desplazar_pagina',async()=>{
      const target=await page.evaluate(()=>{
        const c=ng.getComponent(document.querySelector('grafo')),d=c.myChart.getModel().getSeriesByIndex(0).getData(),option=c.myChart.getOption().series[0],i=option.data.findIndex(n=>n.name==='P13'),el=d.getItemGraphicEl(i),r=el.getBoundingRect().clone();r.applyTransform(el.getComputedTransform());const canvas=document.querySelector('#grafo').getBoundingClientRect();return {x:canvas.x+r.x+r.width/2,y:canvas.y+r.y+r.height/2};
      });
      await page.mouse.click(target.x,target.y);await page.getByRole('dialog').waitFor();await page.getByRole('heading',{name:'P13',exact:true}).waitFor();await closeDetail();return {target,pass:true};
    });
    await step('filtros',async()=>{
      await page.getByRole('combobox',{name:'Tipo',exact:true}).selectOption('Procesador');const filtered=(await graphGeometry()).nodes.length;
      await page.getByRole('combobox',{name:'Tipo',exact:true}).selectOption('');const all=(await graphGeometry()).nodes.length;return {filtered,all,pass:filtered===10&&all===18};
    });
    await step('menus_no_reducen_lienzo',async()=>{
      const before=(await graphGeometry()).canvas.height;const menus=page.locator('.monitor-menu');await menus.first().locator('summary').click();await page.locator('.monitor-popover:visible').waitFor();const warnings=(await graphGeometry()).canvas.height;await menus.first().locator('summary').click();
      await menus.last().locator('summary').click();const password=await page.locator('input[type=password]').isVisible();const access=(await graphGeometry()).canvas.height;await menus.last().locator('summary').click();return {before,warnings,access,password,pass:before===warnings&&before===access&&password};
    });
    await step('mapa_iconos_y_etiqueta',async()=>{
      await page.getByRole('link',{name:'Mapa',exact:true}).click();await page.locator('.leaflet-marker-icon').first().waitFor();await fresh();
      const sizes=await page.locator('.leaflet-marker-icon').evaluateAll(es=>es.map(e=>({w:e.getBoundingClientRect().width,h:e.getBoundingClientRect().height})));
      await page.locator('.leaflet-marker-icon').first().hover();await page.locator('.monitor-node-tooltip:visible').waitFor();const tooltip=await page.locator('.monitor-node-tooltip:visible').evaluate(e=>({text:e.textContent,whiteSpace:getComputedStyle(e).whiteSpace}));
      await page.screenshot({path:'diagnostico/interfaz/mapa-etiqueta.png'});return {sizes,tooltip,pass:sizes.length===18&&sizes.every(s=>s.w===48&&s.h===48)&&tooltip.whiteSpace==='nowrap'};
    });
    await step('mapa_zoom_y_ajuste',async()=>{
      await page.mouse.move(100,70);const before=await page.evaluate(()=>ng.getComponent(document.querySelector('mapa')).map.getZoom());await page.locator('.leaflet-control-zoom-in').click();await page.waitForTimeout(400);const zoom=await page.evaluate(()=>ng.getComponent(document.querySelector('mapa')).map.getZoom());await page.getByRole('button',{name:'Ajustar vista',exact:true}).click();await page.waitForTimeout(400);await page.screenshot({path:'diagnostico/interfaz/mapa.png'});return {before,zoom,pass:zoom>before};
    });
    for(const size of [{width:1366,height:768},{width:1280,height:720}]){
      await step('modal_controlador_'+size.width+'x'+size.height,async()=>{
        await page.setViewportSize(size);await openCatalogDetail('CM1');const g=await detailGeometry();await page.screenshot({path:'diagnostico/interfaz/modal-'+size.width+'x'+size.height+'.png'});
        const pass=g.panel.top>=23&&g.panel.bottom<=size.height-23&&g.footer.bottom<=size.height-23&&g.header.top>=23&&g.titleFont==='25px'&&g.tableOverflow.every(t=>t.scroll<=t.client+1)&&g.text.includes('Destinos seleccionados');await closeDetail();return {...g,pass};
      });
    }
    await step('modal_configuracion_con_rueda',async()=>{
      await openCatalogDetail('CM1');await page.locator('.node-detail-config summary').click();const box=await page.locator('.node-detail-content').boundingBox();await page.mouse.move(box.x+box.width-15,box.y+box.height*.65);await page.mouse.wheel(0,1600);await page.waitForTimeout(250);const g=await detailGeometry();const pre=await page.locator('.node-detail-config pre').boundingBox();
      await page.screenshot({path:'diagnostico/interfaz/modal-configuracion.png'});await closeDetail();return {scrollTop:g.bodyScrollTop,body:g.body,footer:g.footer,pre,pass:g.bodyScrollTop>0&&pre.y<g.body.bottom&&g.footer.bottom<=720-23};
    });
    await step('modal_procesador',async()=>{await openCatalogDetail('P3');const count=await page.locator('.node-detail-stats > div').count();await page.screenshot({path:'diagnostico/interfaz/modal-procesador.png'});await closeDetail();return {count,pass:count===4};});
    await step('modal_sin_respuesta',async()=>{await openCatalogDetail('P13');const alert=await page.getByRole('alert').innerText();await page.screenshot({path:'diagnostico/interfaz/modal-sin-respuesta.png'});await closeDetail();return {alert,pass:!!alert};});
    await step('catalogo_pagina_y_busqueda',async()=>{
      await page.locator('input[type=search]').fill('');await page.waitForTimeout(400);const first=await page.locator('tr.mat-mdc-row').count();await page.getByRole('button',{name:'Página siguiente',exact:true}).click();const next=await page.locator('tr.mat-mdc-row').count();return {first,next,pass:first===10&&next===8};
    });
    const after=await catalog();return {date:new Date().toISOString(),results,errors,catalogUnchanged:JSON.stringify(before)===JSON.stringify(after),blockedWrites:blockedWrites.length,realDebugResponses:true};
  }finally{await page.close();}
}
