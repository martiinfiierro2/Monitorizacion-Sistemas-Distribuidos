const {spawn,spawnSync}=require('child_process'),fs=require('fs'),path=require('path');
const root=path.join(__dirname,'..'),session='monitor-regression';
const cli=process.platform==='win32'?'playwright-cli.cmd':'playwright-cli';
const run=args=>{
 let command=cli,commandArgs=args;
 if(process.platform==='win32'){
  const found=spawnSync('where.exe',['playwright-cli.cmd'],{encoding:'utf8'});
  const shim=(found.stdout||'').trim().split(/\r?\n/)[0];
  if(!shim)throw new Error('Instala @playwright/cli para ejecutar las pruebas de navegador');
  const packageFile=path.join(path.dirname(shim),'node_modules','@playwright','cli','package.json');
  const metadata=JSON.parse(fs.readFileSync(packageFile,'utf8'));
  const bin=typeof metadata.bin==='string'?metadata.bin:metadata.bin['playwright-cli'];
  command=process.execPath;commandArgs=[path.resolve(path.dirname(packageFile),bin),...args];
 }
 const result=spawnSync(command,commandArgs,{cwd:root,encoding:'utf8'});
 if(result.status!==0)throw new Error(result.stdout+'\n'+result.stderr);
 return result.stdout;
};
(async()=>{
 let server;
 try{
  const build=spawnSync(process.execPath,[path.join(root,'frontend/starter/node_modules/@angular/cli/bin/ng.js'),'build','--configuration','development'],{cwd:path.join(root,'frontend/starter'),stdio:'inherit'});
  if(build.status!==0)throw new Error('No se pudo compilar la vista de pruebas');
  server=spawn(process.execPath,['tests/serve.cjs'],{cwd:root,stdio:['ignore','pipe','inherit']});
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('No arrancó la vista de pruebas')),10000);server.once('exit',()=>{clearTimeout(timer);reject(Error('La vista de pruebas terminó antes de arrancar'));});server.stdout.on('data',chunk=>{if(String(chunk).includes('disponible')){clearTimeout(timer);resolve();}});});
  run(['-s='+session,'open','about:blank','--browser=msedge']);
  const results=[];
  for(const file of ['conexiones-grafo.js','conexiones-mapa.js','actualizaciones.js','catalogo-y-detalle.js']){
   console.log('Verificando '+file);const output=run(['-s='+session,'run-code','--filename=tests/ui/'+file]);
   const match=output.match(/### Result\s*([\s\S]*?)\s*### /);if(!match)throw Error(output);results.push(...JSON.parse(match[1]));
  }
  fs.mkdirSync(path.join(root,'diagnostico'),{recursive:true});fs.writeFileSync(path.join(root,'diagnostico','regresion-navegador.json'),JSON.stringify(results,null,2)+'\n');
  const failures=results.filter(result=>!result.pass);console.log(results.length+' comprobaciones; '+failures.length+' fallos');
  if(failures.length){console.log(failures.map(f=>f.view+': '+f.scenario));process.exitCode=1;}
 }catch(error){console.error(error.message);process.exitCode=1;}
 finally{try{run(['-s='+session,'close']);}catch{}server?.kill();}
})();
