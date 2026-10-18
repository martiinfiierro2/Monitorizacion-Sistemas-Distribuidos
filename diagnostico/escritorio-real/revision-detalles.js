async root=>{
  const page=await root.context().newPage();page.setDefaultTimeout(7000);
  const base='http://127.0.0.1:4200',results=[],errors=[],writes=[],blockedQueryDates=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('request',r=>{if(r.url().includes('/api/')&&r.method()!=='GET')writes.push({url:r.url(),method:r.method()});});
  await page.route('**/api/nodo/*/consulta',route=>{
    if(route.request().method()!=='PATCH')return route.continue();
    blockedQueryDates.push(route.request().url());
    return route.abort('blockedbyclient');
  });
  const catalog=async()=>(await(await page.request.get(base+'/api/nodos')).json()).nodos;
  const before=await catalog(),shots=new Set();
  await page.setViewportSize({width:1366,height:768});
  try{
    await page.goto(base+'/lista');await page.locator('tr.mat-mdc-row').first().waitFor();
    for(const node of before){
      try{
        await page.locator('input[type=search]').fill(node.nombre);
        const row=page.locator('tr.mat-mdc-row').filter({has:page.getByRole('cell',{name:node.nombre,exact:true})});
        await row.locator('button[mattooltip="Ver información"]').click();
        await page.waitForFunction(()=>{const el=document.querySelector('dialogDatos');return el&&ng.getComponent(el).loading===false;});
        await page.waitForTimeout(200);
        const detail=await page.evaluate(()=>{
          const c=ng.getComponent(document.querySelector('dialogDatos')),d=c.estado_interno?.Data;
          return {name:c.nodo?.nombre,type:c.tipo,error:c.error,role:c.currentRole,configName:d?.internalConfig?.name,receivedMessages:d?.receivedMessages,receivedRate:d?.receivedRate,delivery:d?.delivery,registered:c.registered.map(p=>({name:p.name,url:p.url,capacity:p.capacity,preference:p.preference,AYACOUNT:p.AYACOUNT})),selected:c.selected.map(p=>({name:p.name,url:p.url,load:p.load})),internalCapacity:d?.internalConfig?.capacity,internalPreference:d?.internalConfig?.preference,body:document.querySelector('dialogDatos').innerText,tableHeads:[...document.querySelectorAll('dialogDatos th')].map(e=>e.innerText),horizontalOverflow:[...document.querySelectorAll('dialogDatos table')].map(e=>({width:e.scrollWidth,parent:e.parentElement.clientWidth})),dialog:document.querySelector('.cdk-overlay-pane').getBoundingClientRect().toJSON()};
        });
        results.push(detail);
        const key=detail.error?'sin-respuesta':node.tipo_nodo;
        if(!shots.has(key)){
          shots.add(key);await page.screenshot({path:'diagnostico/escritorio-real/detalle-'+key.replaceAll(' ','-')+'.png'});
        }
        await page.getByRole('button',{name:'Cerrar detalle',exact:true}).click();
        await page.getByRole('dialog').waitFor({state:'hidden'});
      }catch(e){results.push({name:node.nombre,errorInTest:e.message});if(await page.getByRole('button',{name:'Cerrar detalle',exact:true}).count())await page.getByRole('button',{name:'Cerrar detalle',exact:true}).click();}
    }
    await page.locator('input[type=search]').fill('');await page.waitForTimeout(400);
    const after=await catalog();
    const structural=data=>data.map(({tiempo,...n})=>n);
    return {date:new Date().toISOString(),mode:'desktop-real-debug-only-query-date-writes-blocked',results,errors,writes,blockedQueryDates,catalogCount:after.length,catalogStructureUnchanged:JSON.stringify(structural(before))===JSON.stringify(structural(after)),queryDatesUpdated:before.filter(n=>n.tiempo!==after.find(a=>a.id===n.id)?.tiempo).map(n=>n.nombre)};
  }finally{await page.close();}
}
