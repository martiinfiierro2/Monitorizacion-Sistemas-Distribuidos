async root => {
  const page = await root.context().newPage(), base = 'http://127.0.0.1:4200', results = [], errors = [];
  page.setDefaultTimeout(15000);
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/api/nodo/*/consulta', route => route.request().method() === 'PATCH' ? route.abort() : route.continue());
  const catalog = async () => (await (await page.request.get(base + '/api/nodos')).json()).nodos;
  const beforeCatalog = await catalog();
  const step = async (name, run) => { try { results.push({ name, ...await run() }); } catch (error) { results.push({ name, pass: false, error: error.message }); } };
  const geometry = () => page.evaluate(() => {
    const c = document.querySelector('lista'), t = document.querySelector('.catalog-toolbar'), f = document.querySelector('.catalog-footer'), s = document.querySelector('.catalog-table-scroll');
    const main = document.querySelector('mat-sidenav-content');
    return { frame: c.getBoundingClientRect().toJSON(), toolbar: t.getBoundingClientRect().toJSON(), footer: f.getBoundingClientRect().toJSON(), scroll: { width: s.clientWidth, contentWidth: s.scrollWidth, height: s.clientHeight, contentHeight: s.scrollHeight }, main: { height: main.clientHeight, contentHeight: main.scrollHeight }, tableRows: document.querySelectorAll('tr.mat-mdc-row').length };
  });
  try {
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto(base + '/lista'); await page.locator('.catalog-toolbar').waitFor(); await page.locator('tr.mat-mdc-row').first().waitFor();
    for (const size of [{ width: 1366, height: 768 }, { width: 1280, height: 720 }, { width: 1920, height: 900 }]) {
      await step('catalogo_' + size.width + 'x' + size.height, async () => {
        await page.setViewportSize(size); await page.waitForTimeout(200); const value = await geometry();
        await page.screenshot({ path: 'diagnostico/interfaz/catalogo-' + size.width + 'x' + size.height + '.png' });
        return { ...value, pass: value.toolbar.height <= 90 && value.footer.bottom <= size.height && value.scroll.width === value.scroll.contentWidth && value.main.height === value.main.contentHeight && value.tableRows === Math.min(10, beforeCatalog.length) };
      });
    }
    await step('buscar_y_restaurar', async () => {
      await page.getByRole('searchbox').fill('sin-coincidencia-de-auditoria-xyz'); await page.waitForTimeout(450);
      const empty = await page.locator('tr.mat-mdc-row').count() === 0;
      await page.getByRole('searchbox').fill(''); await page.locator('tr.mat-mdc-row').first().waitFor();
      return { pass: empty && await page.locator('tr.mat-mdc-row').count() === Math.min(10, beforeCatalog.length) };
    });
    await step('paginar', async () => {
      await page.getByRole('button', { name: 'Página siguiente', exact: true }).click(); const next = await page.locator('tr.mat-mdc-row').count();
      await page.getByRole('button', { name: 'Página anterior', exact: true }).click();
      return { pass: next === Math.min(10, beforeCatalog.length - 10), next };
    });
    await step('abrir_y_cancelar_alta', async () => {
      await page.getByRole('button', { name: 'Añadir Nodo', exact: true }).click(); await page.getByLabel('Nombre', { exact: true }).waitFor();
      await page.locator('.header-dialog button').click(); return { pass: true };
    });
    for (const view of ['grafo', 'mapa']) {
      await page.goto(base + '/' + view);
      await page.waitForFunction(view => { const e = document.querySelector(view); return e && ng.getComponent(e).snapshot?.refreshedAt; }, view);
      const canvas = page.locator(view === 'grafo' ? '#grafo' : '#map'), box = await canvas.boundingBox();
      await canvas.evaluate(element => {
        window.auditWheel = [];
        element.addEventListener('wheel', event => window.auditWheel.push({ ctrl: event.ctrlKey, prevented: event.defaultPrevented }), { capture: true });
      });
      const state = () => page.evaluate(view => {
        const c = ng.getComponent(document.querySelector(view)), header = document.querySelector('monitor-toolbar').getBoundingClientRect();
        return { zoom: view === 'grafo' ? c.myChart.getOption().series[0].zoom : c.map.getZoom(), dpr: window.devicePixelRatio, viewport: { width: innerWidth, height: innerHeight, scale: visualViewport.scale }, header: { width: header.width, height: header.height }, scroll: document.querySelector('mat-sidenav-content').scrollTop };
      }, view);
      for (const ctrl of [false, true]) {
        await step(view + (ctrl ? '_pinza_touchpad' : '_rueda'), async () => {
          const before = await state(); await page.mouse.move(box.x + box.width * .7, box.y + box.height * .6);
          if (ctrl) await page.keyboard.down('Control');
          try { await page.mouse.wheel(0, -120); } finally { if (ctrl) await page.keyboard.up('Control'); }
          await page.waitForTimeout(350); const after = await state();
          const event = await page.evaluate(() => window.auditWheel.at(-1));
          return { before, after, event, pass: after.zoom > before.zoom && before.dpr === after.dpr && JSON.stringify(before.viewport) === JSON.stringify(after.viewport) && JSON.stringify(before.header) === JSON.stringify(after.header) && before.scroll === after.scroll && event?.prevented && event.ctrl === ctrl };
        });
      }
      await step(view + '_limite_zoom_no_amplia_pagina', async () => {
        await page.evaluate(view => { const c = ng.getComponent(document.querySelector(view)); if (view === 'grafo') c.myChart.dispatchAction({ type: 'graphRoam', seriesIndex: 0, zoom: 100 }); else c.map.setZoom(c.map.getMaxZoom(), { animate: false }); }, view);
        const before = await state(); await page.keyboard.down('Control');
        try { await page.mouse.wheel(0, -120); } finally { await page.keyboard.up('Control'); }
        await page.waitForTimeout(300); const after = await state();
        return { before, after, pass: before.dpr === after.dpr && JSON.stringify(before.viewport) === JSON.stringify(after.viewport) && JSON.stringify(before.header) === JSON.stringify(after.header) };
      });
    }
    return { date: new Date().toISOString(), realApi: true, results, errors, catalogUnchanged: JSON.stringify(beforeCatalog) === JSON.stringify(await catalog()) };
  } finally { await page.close(); }
}
