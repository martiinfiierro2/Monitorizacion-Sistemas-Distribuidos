async root=>{
  const page=await root.context().newPage();
  await page.route('**/api/nodo/*/consulta',route=>route.request().method()==='PATCH'?route.abort('blockedbyclient'):route.continue());
  try{
    await page.goto('http://127.0.0.1:4200/grafo');await page.locator('monitor-toolbar').waitFor();
    await page.waitForFunction(()=>{const c=ng.getComponent(document.querySelector('grafo'));return c?.snapshot?.nodes.length&&c.snapshot.nodes.every(n=>!n.pending);});
    return await page.evaluate(()=>{
      const c=ng.getComponent(document.querySelector('grafo')),s=c.snapshot;
      return {date:new Date().toISOString(),debugResponses:'real',processes:s.nodes.filter(n=>n.status).map(n=>{
        const d=n.datos.Data,config=d.internalConfig;
        return {catalogName:n.nodo.nombre,type:n.nodo.tipo_nodo,endpoint:n.endpoint,runtimeName:config.name,coordinatorSubsActive:d.coordinatorSubsActive,balancerSubsActive:d.balancerSubsActive,configuredReferences:Object.fromEntries(Object.entries(config).filter(([key])=>key.startsWith('url'))),selectedDestinations:(d.balancerList||[]).map(p=>({name:p.name,url:p.url,load:p.load}))};
      }),displayedLinks:s.links.map(l=>({from:s.nodes.find(n=>n.nodo.id===l.source).nodo.nombre,to:s.nodes.find(n=>n.nodo.id===l.target).nodo.nombre,kind:l.kind})),groups:s.nodes.map(n=>({name:n.nodo.nombre,group:n.group,status:n.status})),warnings:s.warnings};
    });
  }finally{await page.close();}
}
