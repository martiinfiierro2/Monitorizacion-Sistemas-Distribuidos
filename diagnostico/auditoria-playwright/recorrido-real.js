async root => {
  const page = await root.context().newPage();
  page.setDefaultTimeout(6000);
  const results = [], errors = [], blockedWrites = [], failures = [];
  const base = 'http://127.0.0.1:4200';
  const catalog = async () => (await (await page.request.get(base + '/api/nodos')).json()).nodos;
  const before = await catalog();
  page.on('pageerror', e => errors.push(e.message));
  page.on('response', r => { if (r.status() >= 400) failures.push({url:r.url(),status:r.status()}); });
  await page.route('**/api/**', route => {
    if (route.request().method() === 'GET') return route.continue();
    blockedWrites.push({method:route.request().method(),url:route.request().url()});
    return route.fulfill({status:409,json:{msg:'Escritura interceptada por la auditoria; catalogo conservado'}});
  });
  const step = async (name, fn) => { try { results.push({name, ...await fn()}); } catch(e) { results.push({name, error:e.message}); } };
  const graph = () => page.evaluate(() => {
    const c=ng.getComponent(document.querySelector('grafo'));
    const data=c.myChart.getOption().series[0];
    const model=c.myChart.getModel().getSeriesByIndex(0).getData();
    const boxes=[];
    for(let i=0;i<model.count();i++) {
      const el=model.getItemGraphicEl(i), r=el.getBoundingRect().clone();
      r.applyTransform(el.getComputedTransform());
      boxes.push({name:data.data[i].name,x:r.x,y:r.y,w:r.width,h:r.height});
    }
    const collisions=[];
    for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){
      const a=boxes[i],b=boxes[j];
      if(a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y)collisions.push([a.name,b.name]);
    }
    return {nodes:data.data.length,links:data.links.length,collisions,boxes,selected:c.selectedNodes.length,summary:document.querySelector('.monitor-summary').innerText};
  });
  await step('grafo_real_escritorio', async()=>{
    await page.setViewportSize({width:1366,height:768});
    await page.goto(base+'/grafo');await page.locator('monitor-toolbar').waitFor();
    await page.waitForTimeout(3500);
    await page.screenshot({path:'diagnostico/auditoria-playwright/grafo-escritorio.png',fullPage:true});
    return await graph();
  });
  await step('filtros_y_conexiones', async()=>{
    await page.getByRole('combobox',{name:'Tipo',exact:true}).selectOption('Procesador');
    const processors=await graph();
    await page.getByRole('combobox',{name:'Estado',exact:true}).selectOption('online');
    const responding=await graph();
    await page.getByRole('combobox',{name:'Tipo',exact:true}).selectOption('');
    await page.getByRole('combobox',{name:'Estado',exact:true}).selectOption('');
    await page.getByLabel('Desactivar conexiones',{exact:true}).check();
    const disabled=await graph();
    await page.getByLabel('Desactivar conexiones',{exact:true}).uncheck();
    await page.getByRole('button',{name:'Ajustar vista',exact:true}).click();
    return {processors:processors.nodes,responding:responding.nodes,disabledLinks:disabled.links,restoredLinks:(await graph()).links};
  });
  await step('grafo_movil', async()=>{
    await page.setViewportSize({width:390,height:844});await page.waitForTimeout(300);
    await page.getByRole('button',{name:'Ajustar vista',exact:true}).click();
    await page.screenshot({path:'diagnostico/auditoria-playwright/grafo-movil.png',fullPage:true});
    return {...await graph(),layout:await page.evaluate(()=>({width:innerWidth,documentWidth:document.documentElement.scrollWidth,mainWidth:document.querySelector('mat-sidenav-content').scrollWidth,mainClient:document.querySelector('mat-sidenav-content').clientWidth,canvas:document.querySelector('#grafo').getBoundingClientRect().toJSON(),keyboardGraphItems:document.querySelectorAll('#grafo [tabindex], #grafo button, #grafo a').length}))};
  });
  await step('catalogo_paginacion_busqueda', async()=>{
    await page.setViewportSize({width:1366,height:768});
    await page.getByRole('link',{name:'Catálogo',exact:true}).click();
    await page.locator('tr.mat-mdc-row').first().waitFor();
    const firstCount=await page.locator('tr.mat-mdc-row').count();
    const paginator=await page.locator('mat-paginator').innerText();
    const next=page.getByRole('button',{name:'Next page',exact:true});
    await next.click();const secondCount=await page.locator('tr.mat-mdc-row').count();
    await page.locator('input[type=search]').fill('___sin_resultados___');await page.waitForTimeout(500);
    const empty=await page.getByRole('status').allTextContents();
    await page.locator('input[type=search]').fill('');await page.waitForTimeout(500);
    return {firstCount,paginator,secondCount,empty,restored:await page.locator('tr.mat-mdc-row').count()};
  });
  await step('exportar_catalogo',async()=>{
    const downloadPromise=page.waitForEvent('download');
    await page.getByRole('button',{name:'Descargar',exact:true}).click();
    const download=await downloadPromise;
    await download.saveAs('diagnostico/auditoria-playwright/catalogo-exportado.json');
    return {file:download.suggestedFilename(),failure:await download.failure()};
  });
  await step('catalogo_movil_y_formulario',async()=>{
    await page.setViewportSize({width:390,height:844});await page.waitForTimeout(300);
    await page.screenshot({path:'diagnostico/auditoria-playwright/catalogo-movil.png',fullPage:true});
    const layout=await page.evaluate(()=>[...document.querySelectorAll('.cabecera2 button,.cabecera2 input')].map(e=>({text:e.innerText||e.placeholder,rect:e.getBoundingClientRect().toJSON()})));
    await page.getByRole('button',{name:/Añadir Nodo/}).click();
    await page.waitForTimeout(300);
    await page.screenshot({path:'diagnostico/auditoria-playwright/formulario-movil.png',fullPage:true});
    const form=await page.getByRole('dialog').evaluate(e=>({width:e.clientWidth,scrollWidth:e.scrollWidth,text:e.innerText,unlabelledButtons:[...e.querySelectorAll('button')].filter(b=>!b.getAttribute('aria-label')&&!b.textContent.trim().replace('close','')).length,inputs:[...e.querySelectorAll('input')].map(i=>({placeholder:i.placeholder,rect:i.getBoundingClientRect().toJSON()}))}));
    await page.keyboard.press('Escape');return {layout,form};
  });
  await step('mapa_real_movil_y_teclado',async()=>{
    await page.getByRole('link',{name:'Mapa',exact:true}).click();await page.locator('.leaflet-marker-icon').first().waitFor();
    await page.waitForTimeout(2000);
    await page.screenshot({path:'diagnostico/auditoria-playwright/mapa-movil.png',fullPage:true});
    return await page.evaluate(()=>({markers:document.querySelectorAll('.leaflet-marker-icon').length,keyboardNames:[...document.querySelectorAll('.leaflet-marker-icon')].map(e=>({alt:e.getAttribute('alt'),title:e.getAttribute('title'),label:e.getAttribute('aria-label'),tabindex:e.getAttribute('tabindex')})),imagesFailed:[...document.images].filter(i=>!i.complete||!i.naturalWidth).map(i=>i.src)}));
  });
  await step('navegacion_repetida',async()=>{
    await page.setViewportSize({width:1366,height:768});
    for(const name of ['Grafo','Mapa','Catálogo','Mapa','Grafo']){
      await page.getByRole('link',{name,exact:true}).click();await page.waitForTimeout(350);
    }
    await page.locator('monitor-toolbar').waitFor();
    return {url:page.url(),errors:errors.slice()};
  });
  await step('url_inexistente',async()=>{
    await page.goto(base+'/ruta-que-no-existe');await page.waitForTimeout(3000);
    return {url:page.url(),text:await page.locator('body').innerText()};
  });
  const after=await catalog();
  const output={date:new Date().toISOString(),base,catalogCount:before.length,catalogUnchanged:JSON.stringify(before)===JSON.stringify(after),results,errors,failures,blockedWrites};
  await page.close();return output;
}
