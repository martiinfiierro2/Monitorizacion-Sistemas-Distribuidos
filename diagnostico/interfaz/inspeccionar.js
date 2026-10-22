async root=>{
  const page=await root.context().newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/api/nodo/*/consulta',r=>r.request().method()==='PATCH'?r.abort('blockedbyclient'):r.continue());
  const base='http://127.0.0.1:4200';await page.setViewportSize({width:1366,height:768});
  const done=()=>page.waitForFunction(()=>{const c=ng.getComponent(document.querySelector('grafo, mapa'));return c?.snapshot?.nodes.length&&c.snapshot.nodes.every(n=>!n.pending);});
  try{
    await page.goto(base+'/grafo');await page.locator('monitor-toolbar').waitFor();await done();await page.waitForTimeout(250);
    await page.screenshot({path:'diagnostico/interfaz/grafo-inicial.png'});
    const graph=await page.evaluate(()=>({toolbar:document.querySelector('monitor-toolbar').getBoundingClientRect().toJSON(),canvas:document.querySelector('#grafo').getBoundingClientRect().toJSON(),main:{height:document.querySelector('mat-sidenav-content').clientHeight,scroll:document.querySelector('mat-sidenav-content').scrollHeight},text:document.querySelector('.monitor-toolbar').innerText}));
    await page.getByRole('link',{name:'Mapa',exact:true}).click();await page.locator('.leaflet-marker-icon').first().waitFor();await done();await page.waitForTimeout(500);
    await page.screenshot({path:'diagnostico/interfaz/mapa-inicial.png'});
    const map=await page.evaluate(()=>({canvas:document.querySelector('#map').getBoundingClientRect().toJSON(),icons:[...document.querySelectorAll('.leaflet-marker-icon')].map(e=>({width:e.clientWidth,height:e.clientHeight}))}));
    await page.getByRole('link',{name:'Catálogo',exact:true}).click();await page.locator('tr.mat-mdc-row').first().waitFor();await page.locator('input[type=search]').fill('CM1');
    const row=page.locator('tr.mat-mdc-row').filter({has:page.getByText('CM1',{exact:true})});await row.locator('button[mattooltip="Ver información"]').click();await page.getByRole('heading',{name:'Procesadores registrados (2)',exact:true}).waitFor();await page.waitForTimeout(300);
    await page.screenshot({path:'diagnostico/interfaz/detalle-inicial.png'});
    const detail=await page.evaluate(()=>({pane:document.querySelector('.node-detail-panel').getBoundingClientRect().toJSON(),surface:document.querySelector('.mat-mdc-dialog-surface').getBoundingClientRect().toJSON(),body:document.querySelector('.node-detail-content').getBoundingClientRect().toJSON(),scrollHeight:document.querySelector('.node-detail-content').scrollHeight,footer:document.querySelector('.node-detail-footer').getBoundingClientRect().toJSON(),text:document.querySelector('.node-detail').innerText}));
    return {graph,map,detail,errors};
  }finally{await page.close();}
}
