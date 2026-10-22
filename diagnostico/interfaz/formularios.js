async root => {
  const page = await root.context().newPage(), results = [], errors = [];
  page.setDefaultTimeout(8000);
  page.on('pageerror', error => errors.push(error.message));
  const nodes = [{ id: 1, nombre: 'CM1', tipo_nodo: 'Controlador Main', url: 'http://127.0.0.1', puerto: '3000', latitud: 62, longitud: 130, visible: true, orden: 1 }];
  let writes = 0;
  await page.route('**/api/**', route => {
    if (route.request().method() === 'GET') return route.fulfill({ json: { ok: true, nodos: nodes } });
    writes++;
    return route.fulfill({ status: 409, json: { msg: 'Ya existe un nodo con esa dirección y puerto' } });
  });
  const geometry = () => page.evaluate(() => {
    const rect = selector => document.querySelector(selector).getBoundingClientRect().toJSON();
    const body = document.querySelector('.node-editor-content'), panel = document.querySelector('.node-editor-panel');
    return { panel: panel.getBoundingClientRect().toJSON(), header: rect('.node-editor-header'), footer: rect('.node-editor-footer'), body: body.getBoundingClientRect().toJSON(), contentWidth: body.scrollWidth, availableWidth: body.clientWidth, contentHeight: body.scrollHeight, availableHeight: body.clientHeight, fields: [...body.querySelectorAll('mat-form-field')].map(e => e.getBoundingClientRect().toJSON()) };
  });
  const fits = (value, height) => value.panel.top >= 23 && value.panel.bottom <= height - 23 && value.header.top >= value.panel.top && value.footer.bottom <= value.panel.bottom + 1 && value.contentWidth <= value.availableWidth && value.fields.length === 8 && value.fields.every(f => f.left >= value.body.left && f.right <= value.body.right);
  const close = async () => { await page.getByRole('button', { name: 'Cancelar', exact: true }).click(); await page.getByRole('dialog').waitFor({ state: 'hidden' }); };
  try {
    await page.goto('http://127.0.0.1:24500/lista'); await page.locator('tr.mat-mdc-row').first().waitFor();
    for (const size of [{ width: 1366, height: 768 }, { width: 1280, height: 720 }, { width: 1100, height: 600 }]) {
      await page.setViewportSize(size);
      for (const mode of ['anadir', 'editar']) {
        await page.getByRole('button', { name: mode === 'anadir' ? 'Añadir Nodo' : 'Boton para editar', exact: true }).first().click(); await page.locator('.node-editor-title').waitFor(); await page.waitForTimeout(200);
        const value = await geometry(), name = await page.getByLabel('Nombre', { exact: true }).inputValue();
        results.push({ name: mode + '_' + size.width + 'x' + size.height, pass: fits(value, size.height) && (mode !== 'editar' || name === 'CM1'), ...value });
        if (size.width === 1366 || (size.width === 1280 && mode === 'editar')) await page.screenshot({ path: 'diagnostico/interfaz/formulario-' + mode + '-' + size.width + 'x' + size.height + '.png' });
        if (size.height === 600) {
          const before = await geometry(), box = before.body; await page.mouse.move(box.x + box.width - 20, box.y + box.height / 2); await page.mouse.wheel(0, 900); await page.waitForTimeout(150);
          const after = await geometry(); results.push({ name: mode + '_cabecera_y_botones_fijos', pass: Math.abs(before.header.y - after.header.y) < 1 && Math.abs(before.footer.y - after.footer.y) < 1 && fits(after, size.height) });
        }
        await close();
      }
    }
    results.push({ name: 'cancelar_no_guarda', pass: writes === 0 });
    await page.setViewportSize({ width: 1280, height: 720 }); await page.getByRole('button', { name: 'Añadir Nodo', exact: true }).click();
    await page.getByLabel('Tipo de nodo', { exact: true }).click();
    const options = await page.getByRole('option').count(), icons = await page.locator('.node-editor-option img').count();
    results.push({ name: 'tipos_y_iconos_originales', pass: options === 5 && icons === 5, options, icons });
    await page.getByRole('option', { name: 'Procesador', exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Añadir nodo', exact: true }).click(); await page.getByRole('alert').waitFor();
    const message = await page.getByRole('alert').innerText(), value = await geometry();
    results.push({ name: 'error_de_guardado_visible', pass: message.includes('Ya existe un nodo') && fits(value, 720) && writes === 1, message, ...value });
    await page.screenshot({ path: 'diagnostico/interfaz/formulario-error.png' }); await close();
    return { date: new Date().toISOString(), controlledResponses: true, results, errors };
  } finally { await page.close(); }
}
