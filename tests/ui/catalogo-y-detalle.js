async rootPage=>{
 const page=await rootPage.context().newPage();
 let nodes=[{id:1,nombre:'CM',tipo_nodo:'Controlador Main',url:'http://127.0.0.1',puerto:'3000',latitud:38,longitud:0,visible:true,orden:1,tiempo:null},{id:2,nombre:'BM',tipo_nodo:'Balanceador Main',url:'http://127.0.0.1',puerto:'3100',latitud:39,longitud:1,visible:true,orden:2,tiempo:null},{id:3,nombre:'P',tipo_nodo:'Procesador',url:'http://127.0.0.1',puerto:'4001',latitud:40,longitud:2,visible:true,orden:3,tiempo:null}];
 let patches=0,received=5,debugError=false,protectedApi=false;const requests=[];
 await page.route('**/assets/theme/config.json',async route=>{const response=await route.fetch();const json=await response.json();json.debugProxy=true;json.espera.valor=200;return route.fulfill({json});});
 await page.route('**/api/**',async route=>{
  const req=route.request(),pathname=new URL(req.url()).pathname,method=req.method();requests.push({pathname,method});
  if(protectedApi&&req.headers().authorization!=='Bearer fixture-key')return route.fulfill({status:401,json:{msg:'Acceso no autorizado'}});
  const match=pathname.match(/\/nodo\/(\d+)/),id=match?Number(match[1]):undefined;
  if(pathname.endsWith('/debug')){
   if(debugError)return route.fulfill({status:502,json:{msg:'Proceso no disponible'}});
   return route.fulfill({json:{UID:'test',Type:'REPLY',Operation:'RESULT',Data:{internalConfig:{urlBalancerMain:'http://127.0.0.1:3100',urlBalancerSubs:'',capacity:100,preference:1},balancerList:[{name:'P',url:'http://127.0.0.1:4001',load:100}],processorsList:[{name:'P',url:'http://127.0.0.1:4001',capacity:100},{name:'Unselected',url:'http://127.0.0.1:4002',capacity:50}],receivedMessages:received}}});
  }
  if(method==='PATCH'){patches++;return route.fulfill({json:{ok:true,tiempo:new Date().toISOString()}});}
  if(method==='POST'){const data=req.postDataJSON();nodes.push({...data,id:4,tiempo:null});return route.fulfill({status:201,json:{ok:true,nodo:nodes.at(-1)}});}
  if(method==='PUT'){const data=req.postDataJSON();nodes=nodes.map(n=>n.id===id?{...n,...data}:n);return route.fulfill({json:{ok:true,nodo:nodes.find(n=>n.id===id)}});}
  if(method==='DELETE'){nodes=nodes.filter(n=>n.id!==id);return route.fulfill({json:{ok:true}});}
  if(id)return route.fulfill({json:{ok:true,nodo:nodes.find(n=>n.id===id)}});
  return route.fulfill({json:{ok:true,nodos:pathname.includes('/nodos/')?[]:nodes}});
 });
 const results=[],errors=[];page.setDefaultTimeout(5000);page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
 try{
  await page.goto('http://127.0.0.1:24500/lista');await page.waitForTimeout(600);
  await page.getByRole('button',{name:/Añadir Nodo/}).click();
  await page.getByLabel('Nombre',{exact:true}).fill('Added');await page.getByLabel('Puerto',{exact:true}).fill('4999');await page.getByPlaceholder('Latitud').fill('41');await page.getByPlaceholder('Longitud').fill('3');
  await page.locator('.dialog .anadir').click();await page.waitForTimeout(400);results.push({scenario:'alta_por_formulario',pass:await page.locator('tr.mat-mdc-row').count()===4});
  await page.getByRole('button',{name:'Boton para editar'}).first().click();await page.getByLabel('Nombre',{exact:true}).fill('Renamed');await page.locator('.dialog .anadir').click();await page.waitForTimeout(350);results.push({scenario:'editar_por_formulario',pass:nodes[0].nombre==='Renamed'});
  await page.evaluate(()=>{const c=ng.getComponent(document.querySelector('lista'));return c.noVisible(c.listaNodos[1]);});results.push({scenario:'ocultar_desde_lista',pass:nodes[1].visible===false});await page.waitForTimeout(400);
  await page.locator('tr.mat-mdc-row').last().getByRole('button',{name:'Eliminar nodo',exact:true}).click();await page.evaluate(()=>{const c=ng.getComponent(document.querySelector('lista'));c.dialog.openDialogs.at(-1).afterClosed().subscribe(value=>window.deleteResult=value)});const deleted=page.waitForRequest(request=>request.method()==='DELETE');await page.getByRole('button',{name:'Eliminar ficha',exact:true}).click();await deleted;await page.waitForTimeout(200);results.push({scenario:'eliminar_con_confirmacion',pass:nodes.length===3,count:nodes.length,debug:await page.evaluate(()=>({result:window.deleteResult,error:ng.getComponent(document.querySelector('lista')).error})),requests:requests.filter(r=>r.method==='DELETE')});
  await page.locator('input[type=search]').fill('none');await page.waitForTimeout(350);results.push({scenario:'busqueda_vacia',pass:await page.locator('tr.mat-mdc-row').count()===0});await page.locator('input[type=search]').fill('');await page.waitForTimeout(350);
  await page.getByRole('button',{name:'Boton para visualizar'}).first().click();await page.getByRole('heading',{name:'Procesadores registrados (2)',exact:true}).waitFor();await page.getByRole('heading',{name:'Destinos seleccionados (1)',exact:true}).waitFor();results.push({scenario:'detalle_registrados_y_seleccionados',pass:true});
  received=17;await page.waitForTimeout(350);results.push({scenario:'detalle_se_refresca',pass:(await page.locator('.dialog').innerText()).includes('17')});
  await page.getByRole('button',{name:'Cerrar detalle'}).click();await page.waitForTimeout(250);const previous=patches;debugError=true;
  await page.getByRole('button',{name:'Boton para visualizar'}).first().click();await page.waitForTimeout(350);await page.getByRole('button',{name:'Cerrar detalle'}).click();await page.waitForTimeout(250);results.push({scenario:'debug_fallido_no_guarda_fecha',pass:patches===previous});
  debugError=false;protectedApi=true;await page.goto('http://127.0.0.1:24500/grafo');await page.waitForTimeout(450);await page.getByText('Acceso protegido',{exact:true}).click();await page.locator('input[type=password]').fill('fixture-key');await page.getByRole('button',{name:'Conectar',exact:true}).click();await page.waitForTimeout(500);results.push({scenario:'acceso_con_clave',pass:await page.evaluate(count=>{const s=ng.getComponent(document.querySelector('grafo')).snapshot;return s.nodes.length===count&&!s.error},nodes.length)});
  return results;
 }catch(error){results.push({scenario:'ui_error',pass:false,error:error.message,errors,body:await page.locator('body').innerText(),handler:await page.evaluate(()=>ng.getComponent(document.querySelector('lista'))?.eliminarNodo.toString()),buttons:await page.getByRole('button',{name:'Eliminar nodo',exact:true}).evaluateAll(elements=>elements.map(e=>e.outerHTML))});return results;}finally{await page.close();}
}
