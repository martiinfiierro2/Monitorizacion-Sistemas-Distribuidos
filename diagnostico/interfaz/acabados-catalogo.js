async root => {
  const page = await root.context().newPage(), results = [], errors = [], writes = [];
  page.setDefaultTimeout(8000);
  let failed = false, nextId = 19;
  let nodes = Array.from({ length: 18 }, (_, i) => ({ id: i + 1, nombre: i ? 'P' + i : 'CM1', tipo_nodo: i ? 'Procesador' : 'Controlador Main', url: 'http://127.0.0.1', puerto: String(3000 + i), latitud: 40, longitud: 3, visible: true, orden: i }));
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/api/**', route => {
    const request = route.request(), method = request.method(), path = new URL(request.url()).pathname;
    if (method === 'GET') return route.fulfill({ json: { ok: true, nodos: path.includes('/nodos/') ? [] : nodes } });
    writes.push(method);
    if (failed) return route.fulfill({ status: 500, json: { msg: 'No se pudo guardar la operación' } });
    const id = Number(path.split('/').at(-1));
    if (method === 'POST') nodes.push({ ...request.postDataJSON(), id: nextId++ });
    if (method === 'PUT') nodes = nodes.map(node => node.id === id ? { ...node, ...request.postDataJSON() } : node);
    if (method === 'DELETE') nodes = nodes.filter(node => node.id !== id);
    return route.fulfill({ json: { ok: true } });
  });
  const step = async (name, run) => { try { results.push({ name, ...await run() }); } catch (error) { results.push({ name, pass: false, error: error.message }); } };
  const notice = async text => { await page.locator('.catalog-feedback').getByText(text, { exact: true }).waitFor(); return true; };
  const row = () => page.locator('tr.mat-mdc-row').first();
  try {
    await page.setViewportSize({ width: 1280, height: 720 }); await page.goto('http://127.0.0.1:24500/lista'); await row().waitFor();
    await step('paginador_en_espanol', async () => ({ pass: (await page.locator('mat-paginator').innerText()).includes('Filas por página:') && (await page.locator('.mat-mdc-paginator-range-label').innerText()).includes('1–10 de 18') && await page.getByRole('button', { name: 'Página siguiente', exact: true }).count() === 1 }));
    await step('pagina_siguiente_y_anterior', async () => {
      await page.getByRole('button', { name: 'Página siguiente', exact: true }).click(); const text = await page.locator('.mat-mdc-paginator-range-label').innerText();
      await page.getByRole('button', { name: 'Página anterior', exact: true }).click(); return { pass: text.includes('11–18 de 18'), text };
    });
    await step('paginador_vacio', async () => {
      await page.getByRole('searchbox').fill('sin-resultados'); await page.waitForTimeout(400); const empty = await page.locator('.mat-mdc-paginator-range-label').innerText();
      await page.getByRole('searchbox').fill(''); await row().waitFor(); return { pass: empty.trim() === '0 de 0', text: empty };
    });
    await step('dialogo_borrado_y_cancelacion', async () => {
      await row().getByRole('button', { name: 'Eliminar nodo', exact: true }).click(); await page.getByRole('dialog').waitFor(); await page.waitForTimeout(250);
      const panel = await page.locator('.node-editor-panel').boundingBox(), text = await page.getByRole('dialog').innerText();
      await page.screenshot({ path: 'diagnostico/interfaz/confirmacion-borrado.png' });
      await page.getByRole('button', { name: 'Cancelar', exact: true }).click(); await page.getByRole('dialog').waitFor({ state: 'hidden' });
      return { pass: text.includes('CM1') && text.includes('ejecutable seguirá funcionando') && panel.y >= 24 && panel.y + panel.height <= 696 && writes.length === 0 && await page.locator('.catalog-feedback').count() === 0, panel };
    });
    await step('aviso_al_anadir', async () => {
      await page.getByRole('button', { name: 'Añadir Nodo', exact: true }).click(); await page.getByLabel('Nombre', { exact: true }).fill('Nuevo'); await page.getByLabel('Puerto', { exact: true }).fill('4999');
      await page.getByLabel('Latitud', { exact: true }).fill('41'); await page.getByLabel('Longitud', { exact: true }).fill('3');
      await page.getByRole('dialog').getByRole('button', { name: 'Añadir nodo', exact: true }).click();
      return { pass: await notice('Ficha añadida correctamente.') && nodes.length === 19 };
    });
    await step('aviso_al_editar', async () => {
      await row().getByRole('button', { name: 'Boton para editar', exact: true }).click(); await page.getByLabel('Nombre', { exact: true }).fill('CM1 editado');
      await page.getByRole('button', { name: 'Guardar cambios', exact: true }).click(); return { pass: await notice('Cambios guardados correctamente.') && nodes[0].nombre === 'CM1 editado' };
    });
    await step('aviso_al_ocultar', async () => {
      await row().getByRole('button', { name: 'Ocultar nodo', exact: true }).click(); return { pass: await notice('CM1 editado: oculto en grafo y mapa.') && nodes[0].visible === false };
    });
    await step('aviso_al_mostrar', async () => {
      await row().getByRole('button', { name: 'Mostrar nodo', exact: true }).click(); const pass = await notice('CM1 editado: visible en grafo y mapa.') && nodes[0].visible === true;
      await page.mouse.move(500, 50); await page.waitForTimeout(250); await page.screenshot({ path: 'diagnostico/interfaz/aviso-catalogo.png' }); return { pass };
    });
    await step('aviso_se_cierra_solo', async () => { await page.locator('.catalog-feedback').waitFor({ state: 'hidden', timeout: 5000 }); return { pass: true }; });
    await step('aviso_al_eliminar', async () => {
      await row().getByRole('button', { name: 'Eliminar nodo', exact: true }).click(); await page.getByRole('button', { name: 'Eliminar ficha', exact: true }).click();
      return { pass: await notice('Ficha eliminada del catálogo.') && nodes.length === 18 };
    });
    failed = true;
    await step('error_visibilidad_sin_aviso_de_exito', async () => {
      await row().getByRole('button', { name: 'Ocultar nodo', exact: true }).click(); await page.getByRole('alert').waitFor(); await page.waitForTimeout(300);
      return { pass: nodes[0].visible && await page.locator('.catalog-feedback').count() === 0 && (await page.getByRole('alert').innerText()).includes('No se pudo guardar') };
    });
    await step('error_borrado_sin_aviso_de_exito', async () => {
      await row().getByRole('button', { name: 'Eliminar nodo', exact: true }).click(); await page.getByRole('button', { name: 'Eliminar ficha', exact: true }).click(); await page.waitForTimeout(350);
      return { pass: nodes.length === 18 && await page.locator('.catalog-feedback').count() === 0 };
    });
    return { date: new Date().toISOString(), controlledResponses: true, results, errors };
  } finally { await page.close(); }
}
