async root=>{
  const page=await root.context().newPage();page.setDefaultTimeout(8000);
  const results=[],errors=[],base='http://127.0.0.1:4200';
  page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/api/nodo/*/consulta',route=>route.request().method()==='PATCH'?route.abort('blockedbyclient'):route.continue());
  const done=()=>page.waitForFunction(()=>{const c=ng.getComponent(document.querySelector('grafo, mapa'));return c?.snapshot?.nodes.length&&c.snapshot.nodes.every(n=>!n.pending);});
  const step=async(name,fn)=>{try{results.push({name,...await fn()});}catch(e){results.push({name,pass:false,error:e.message});}};
  try{
    await page.goto(base+'/grafo');await page.locator('monitor-toolbar').waitFor();await done();
    for(const size of [{width:1366,height:768},{width:1280,height:720},{width:1920,height:1080}]){
      await step('grafo_'+size.width+'x'+size.height,async()=>{
        await page.setViewportSize(size);await page.waitForTimeout(250);await done();
        await page.getByRole('button',{name:'Ajustar vista',exact:true}).click();await page.waitForTimeout(150);
        const geometry=await page.evaluate(()=>{
          const c=ng.getComponent(document.querySelector('grafo')),data=c.myChart.getModel().getSeriesByIndex(0).getData(),option=c.myChart.getOption().series[0],items=[];
          const rect=el=>{if(!el)return null;const r=el.getBoundingRect().clone();r.applyTransform(el.getComputedTransform());return {x:r.x,y:r.y,w:r.width,h:r.height};};
          for(let i=0;i<data.count();i++){
            const el=data.getItemGraphicEl(i),symbol=el.getSymbolPath();
            items.push({name:option.data[i].name,icon:rect(symbol),label:rect(symbol.getTextContent())});
          }
          const overlaps=(a,b)=>a&&b&&a.x<b.x+b.w-.5&&a.x+a.w>b.x+.5&&a.y<b.y+b.h-.5&&a.y+a.h>b.y+.5;
          const collisions=[];
          for(let i=0;i<items.length;i++)for(let j=i+1;j<items.length;j++){
            if(overlaps(items[i].icon,items[j].icon)||overlaps(items[i].label,items[j].icon)||overlaps(items[i].icon,items[j].label)||overlaps(items[i].label,items[j].label))collisions.push([items[i].name,items[j].name]);
          }
          const width=c.container.nativeElement.clientWidth,height=c.container.nativeElement.clientHeight;
          const clipped=items.filter(i=>[i.icon,i.label].some(r=>r&&(r.x<-.5||r.y<-.5||r.x+r.w>width+.5||r.y+r.h>height+.5))).map(i=>i.name);
          return {items,collisions,clipped,width,height,layoutHeight:c.layoutHeight,seriesHeight:option.height,scrollHeight:document.querySelector('mat-sidenav-content').scrollHeight};
        });
        await page.screenshot({path:'diagnostico/escritorio-real/corregido-grafo-'+size.width+'x'+size.height+'.png'});
        await page.locator('#grafo').screenshot({path:'diagnostico/escritorio-real/corregido-grafo-completo-'+size.width+'x'+size.height+'.png'});
        return {...geometry,pass:geometry.collisions.length===0&&geometry.clipped.length===0};
      });
    }
    await page.setViewportSize({width:1366,height:768});
    await step('filtro_y_vuelta_a_todos',async()=>{
      await page.getByRole('combobox',{name:'Tipo',exact:true}).selectOption('Procesador');
      await page.getByRole('button',{name:'Ajustar vista',exact:true}).click();
      const filtered=await page.evaluate(()=>({count:ng.getComponent(document.querySelector('grafo')).myChart.getOption().series[0].data.length,height:ng.getComponent(document.querySelector('grafo')).layoutHeight}));
      await page.getByRole('combobox',{name:'Tipo',exact:true}).selectOption('');await done();
      const all=await page.evaluate(()=>ng.getComponent(document.querySelector('grafo')).myChart.getOption().series[0].data.length);
      return {filtered,all,pass:filtered.count>0&&all>filtered.count};
    });
    await step('desplazamiento_y_clic_inferior',async()=>{
      await page.getByRole('button',{name:'Ajustar vista',exact:true}).click();
      await page.mouse.move(1358,650);await page.mouse.wheel(0,1200);await page.waitForTimeout(200);await done();
      const target=await page.evaluate(()=>{
        const c=ng.getComponent(document.querySelector('grafo')),data=c.myChart.getModel().getSeriesByIndex(0).getData(),option=c.myChart.getOption().series[0],i=option.data.length-1;
        const el=data.getItemGraphicEl(i),r=el.getBoundingRect().clone();r.applyTransform(el.getComputedTransform());
        const canvas=document.querySelector('#grafo').getBoundingClientRect();
        return {name:option.data[i].name,x:canvas.x+r.x+r.width/2,y:canvas.y+r.y+r.height/2,scrollTop:document.querySelector('mat-sidenav-content').scrollTop};
      });
      await page.screenshot({path:'diagnostico/escritorio-real/corregido-grafo-parte-inferior.png'});
      await page.mouse.click(target.x,target.y);await page.getByRole('dialog').waitFor();
      await page.waitForFunction(()=>!!ng.getComponent(document.querySelector('dialogDatos')).nodo);
      const actual=await page.evaluate(()=>ng.getComponent(document.querySelector('dialogDatos')).nodo.nombre);
      await page.getByRole('button',{name:'Cerrar detalle',exact:true}).click();await page.getByRole('dialog').waitFor({state:'hidden'});
      await page.mouse.move(1358,650);await page.mouse.wheel(0,-2000);await page.waitForTimeout(200);
      return {target,actual,pass:target.scrollTop>0&&actual===target.name};
    });
    await step('mapa_etiqueta_raton',async()=>{
      await page.getByRole('link',{name:'Mapa',exact:true}).click();await page.locator('.leaflet-marker-icon').first().waitFor();await done();
      await page.waitForFunction(()=>Date.now()-ng.getComponent(document.querySelector('mapa')).snapshot.refreshedAt<700);await page.waitForTimeout(220);
      const permanent=await page.locator('.leaflet-tooltip:visible').count();
      const marker=page.locator('.leaflet-marker-icon').first();await marker.hover();
      await page.locator('.monitor-node-tooltip:visible').waitFor();
      const tooltip=await page.locator('.monitor-node-tooltip:visible').evaluate(el=>({text:el.textContent,width:el.getBoundingClientRect().width,height:el.getBoundingClientRect().height,whiteSpace:getComputedStyle(el).whiteSpace}));
      await page.screenshot({path:'diagnostico/escritorio-real/corregido-mapa-etiqueta.png'});
      await page.mouse.move(110,100);await page.waitForTimeout(250);
      const after=await page.locator('.leaflet-tooltip:visible').count();
      await page.screenshot({path:'diagnostico/escritorio-real/corregido-mapa.png'});
      return {permanent,tooltip,after,pass:permanent===0&&tooltip.whiteSpace==='nowrap'&&tooltip.width>tooltip.height&&after===0};
    });
    return {date:new Date().toISOString(),realDebugResponses:true,results,errors};
  }finally{await page.close();}
}
