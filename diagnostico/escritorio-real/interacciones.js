async root=>{
  const page=await root.context().newPage();page.setDefaultTimeout(7000);
  const base='http://127.0.0.1:4200',results=[],blockedWrites=[];
  await page.route('**/api/nodo/*/consulta',route=>{
    if(route.request().method()!=='PATCH')return route.continue();
    blockedWrites.push(route.request().url());return route.abort('blockedbyclient');
  });
  const done=()=>page.waitForFunction(()=>{const c=ng.getComponent(document.querySelector('grafo, mapa'));return c?.snapshot?.nodes.length&&c.snapshot.nodes.every(n=>!n.pending);});
  const step=async(name,fn)=>{try{results.push({name,...await fn()});}catch(e){results.push({name,error:e.message});}};
  try{
    await page.setViewportSize({width:1366,height:768});await page.goto(base+'/grafo');await page.locator('monitor-toolbar').waitFor();await done();
    await step('capturas_refresco_real',async()=>{
      await page.screenshot({path:'diagnostico/escritorio-real/refresco-estable.png'});
      const stable=await page.locator('.monitor-summary').innerText();
      await page.waitForFunction(()=>ng.getComponent(document.querySelector('grafo')).snapshot.nodes.some(n=>n.pending),{},{polling:5});
      const pending=await page.evaluate(()=>({summary:document.querySelector('.monitor-summary').innerText,nodes:ng.getComponent(document.querySelector('grafo')).snapshot.nodes.filter(n=>n.pending).map(n=>n.nodo.nombre)}));
      await page.screenshot({path:'diagnostico/escritorio-real/refresco-en-curso.png'});
      await done();return {stable,pending,after:await page.locator('.monitor-summary').innerText()};
    });
    await step('zoom_grafo_se_conserva',async()=>{
      const box=await page.locator('#grafo').boundingBox();await page.mouse.move(box.x+box.width*.5,box.y+box.height*.5);await page.mouse.wheel(0,-300);await page.waitForTimeout(150);
      const zoom=await page.evaluate(()=>ng.getComponent(document.querySelector('grafo')).myChart.getOption().series[0].zoom);
      await page.waitForTimeout(5200);const after=await page.evaluate(()=>ng.getComponent(document.querySelector('grafo')).myChart.getOption().series[0].zoom);
      await page.getByRole('button',{name:'Ajustar vista',exact:true}).click();return {zoom,after};
    });
    await step('clics_reales_en_grafo',async()=>{
      const names=['CM1','BM1','P3','P1','P7','P13'],clicks=[];
      for(const name of names){
        await done();
        const target=await page.evaluate(name=>{
          const c=ng.getComponent(document.querySelector('grafo')),data=c.myChart.getModel().getSeriesByIndex(0).getData(),option=c.myChart.getOption().series[0],i=option.data.findIndex(n=>n.name===name);
          const el=data.getItemGraphicEl(i),r=el.getBoundingRect().clone();r.applyTransform(el.getComputedTransform());
          const canvas=document.querySelector('#grafo').getBoundingClientRect();return {x:canvas.x+r.x+r.width/2,y:canvas.y+r.y+r.height/2};
        },name);
        await page.mouse.click(target.x,target.y);await page.getByRole('dialog').waitFor();
        await page.waitForFunction(()=>ng.getComponent(document.querySelector('dialogDatos')).loading===false);
        const actual=await page.evaluate(()=>ng.getComponent(document.querySelector('dialogDatos')).nodo?.nombre);
        clicks.push({expected:name,actual,target});
        await page.getByRole('button',{name:'Cerrar detalle',exact:true}).click();await page.getByRole('dialog').waitFor({state:'hidden'});
      }
      return {clicks};
    });
    await step('etiquetas_del_mapa',async()=>{
      await page.getByRole('link',{name:'Mapa',exact:true}).click();await page.locator('.leaflet-marker-icon').first().waitFor();await done();
      const labels=await page.locator('.leaflet-tooltip').evaluateAll(elements=>elements.map(e=>({text:e.innerText,width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height,whiteSpace:getComputedStyle(e).whiteSpace})));
      await page.getByRole('combobox',{name:'Tipo',exact:true}).selectOption('Controlador Main');await page.getByRole('button',{name:'Ajustar vista',exact:true}).click();await page.waitForTimeout(400);
      await page.screenshot({path:'diagnostico/escritorio-real/mapa-etiquetas-controladores.png'});
      const filteredLabels=await page.locator('.leaflet-tooltip').evaluateAll(elements=>elements.map(e=>({text:e.innerText,width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height})));
      await page.getByRole('combobox',{name:'Tipo',exact:true}).selectOption('');
      return {labels,filteredLabels};
    });
    return {date:new Date().toISOString(),results,blockedWrites,debugResponses:'real'};
  }finally{await page.close();}
}
