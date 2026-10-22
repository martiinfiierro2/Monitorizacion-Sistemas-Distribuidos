async root => {
  const page = await root.context().newPage(), results = [], errors = [];
  // Controlled catalog with the geographic positions from the saved export.
  const locations = [
    ['BM1', 40, 80], ['BS1', 36, 20], ['CM1', 62, 130], ['CS1', -32, 130],
    ['P1', -32, 154], ['P2', 10, 85], ['P3', 63, 20], ['BM2', -3, -43],
    ['CM2', 30, -100], ['P4', 50, -80], ['P5', -40, -40], ['P6', 60, -150],
    ['P7', 39, -4], ['P8', 21, -88], ['CS2', 0, 0], ['BS2', -40, -70],
    ['P9', 22, 22], ['P13', 43, 5]
  ];
  const nodes = locations.map(([nombre, latitud, longitud], i) => ({
    id: i + 1, nombre, latitud, longitud, visible: true, orden: i,
    tipo_nodo: nombre.startsWith('CM') ? 'Controlador Main' : nombre.startsWith('CS') ? 'Controlador Subs' : nombre.startsWith('BM') ? 'Balanceador Main' : nombre.startsWith('BS') ? 'Balanceador Subs' : 'Procesador',
    url: 'http://127.0.0.1', puerto: String(29000 + i)
  }));
  page.on('pageerror', e => errors.push(e.message));
  // Never reach or write the actual database during this browser review.
  await page.route('**/api/**', route => route.request().method() !== 'GET' ? route.abort() : route.fulfill({ json: route.request().url().endsWith('/debug')
    ? { Data: { internalConfig: {}, balancerList: [], processorsList: [], receivedMessages: 0 } }
    : { ok: true, nodos: nodes } }));
  const inspect = () => page.evaluate(() => {
    const c = ng.getComponent(document.querySelector('mapa')), map = c.map, b = map.getBounds(), size = map.getSize();
    const tiles = []; map.eachLayer(layer => { if (layer.getTileUrl) tiles.push({ noWrap: layer.options.noWrap, bounds: !!layer.options.bounds }); });
    const positions = c.iconos.map(marker => map.latLngToContainerPoint(marker.getLatLng())), origin = map.latLngToContainerPoint([0, 0]);
    const topLeft = map.latLngToContainerPoint([80, -180]), bottomRight = map.latLngToContainerPoint([-60, 180]);
    return {
      center: map.getCenter(), zoom: map.getZoom(), minZoom: map.getMinZoom(), width: size.x, height: size.y,
      worldCenterOffset: { x: origin.x - size.x / 2, y: origin.y - size.y / 2 },
      overviewFrame: { left: topLeft.x, top: topLeft.y, right: bottomRight.x, bottom: bottomRight.y },
      worldWidth: 256 * 2 ** map.getZoom(), bounds: { west: b.getWest(), east: b.getEast(), south: b.getSouth(), north: b.getNorth() },
      tiles, markers: c.iconos.length,
      clipped: positions.filter(p => p.x < 24 || p.x > size.x - 24 || p.y < 24 || p.y > size.y - 24).length
    };
  });
  // Leaflet rounds the projected drag limits to the nearest screen pixel.
  const limited = v => {
    const pixel = 360 / v.worldWidth + 0.000001;
    const horizontal = v.worldWidth < v.width ? Math.abs(v.center.lng) <= pixel : v.bounds.west >= -180 - pixel && v.bounds.east <= 180 + pixel;
    return horizontal && v.bounds.south >= -85.051129 - pixel && v.bounds.north <= 85.051129 + pixel;
  };
  const overviewFits = v => {
    const f = v.overviewFrame;
    return f.left >= 31 && f.top >= 31 && f.right <= v.width - 31 && f.bottom <= v.height - 31 && Math.abs((f.left + f.right) / 2 - v.width / 2) <= 1 && Math.abs((f.top + f.bottom) / 2 - v.height / 2) <= 1 && v.clipped === 0;
  };
  try {
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto('http://127.0.0.1:24500/mapa');
    await page.waitForFunction(() => { const e = document.querySelector('mapa'); return e && ng.getComponent(e).iconos.length === 18; });
    const initial = await inspect();
    results.push({ name: 'inicio_centrado_sin_pulsar_ajustar', pass: limited(initial) && overviewFits(initial) && Math.abs(initial.zoom - initial.minZoom) < 0.001, ...initial });
    await page.waitForFunction(() => [...document.querySelectorAll('.leaflet-tile')].some(t => t.complete && t.naturalWidth), null, { timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(400);
    await page.screenshot({ path: 'diagnostico/interfaz/mapa-inicio-centrado.png' });
    for (const size of [{ width: 1366, height: 768 }, { width: 1280, height: 720 }, { width: 1920, height: 1080 }, { width: 1920, height: 900 }, { width: 1816, height: 840 }, { width: 1100, height: 650 }]) {
      await page.setViewportSize(size); await page.waitForTimeout(250);
      const value = await inspect();
      results.push({ name: 'encuadre_sin_ajustar_' + size.width + 'x' + size.height, pass: limited(value) && overviewFits(value) && value.tiles.every(t => t.noWrap && t.bounds), ...value });
      if(size.width===1816){await page.waitForTimeout(400);await page.screenshot({path:'diagnostico/interfaz/mapa-ventana-baja.png'});}
    }
    await page.setViewportSize({ width: 1920, height: 1080 }); await page.waitForTimeout(200);
    await page.locator('mapa').evaluate(element => Object.assign(element.style, { width: '1100px', height: '470px', flex: 'none', alignSelf: 'center' })); await page.waitForTimeout(250);
    const embedded = await inspect(); results.push({ name: 'panel_menor_que_ventana_1920x1080', pass: embedded.width < 1200 && embedded.height < 470 && overviewFits(embedded) && limited(embedded), ...embedded });
    await page.screenshot({ path: 'diagnostico/interfaz/mapa-panel-reducido.png' });
    await page.locator('mapa').evaluate(element => ['width', 'height', 'flex', 'align-self'].forEach(property => element.style.removeProperty(property)));
    await page.setViewportSize({ width: 1366, height: 768 }); await page.waitForTimeout(150);
    await page.getByRole('button', { name: 'Ajustar vista', exact: true }).click(); await page.waitForTimeout(400);
    const fitted = await inspect(); results.push({ name: 'ajustar_nodos', pass: fitted.clipped === 0 && limited(fitted), ...fitted });
    const canvas = await page.locator('#map').boundingBox();
    for (const delta of [-5000, 5000]) {
      await page.mouse.move(canvas.x + canvas.width / 2, canvas.y + canvas.height / 2);
      await page.mouse.down(); await page.mouse.move(canvas.x + canvas.width / 2 + delta, canvas.y + canvas.height / 2, { steps: 25 }); await page.mouse.up(); await page.waitForTimeout(400);
      const value = await inspect(); results.push({ name: 'arrastre_horizontal_' + delta, pass: limited(value), ...value });
    }
    await page.locator('.leaflet-control-zoom-in').click(); await page.waitForTimeout(300);
    const zoomed = await inspect(); results.push({ name: 'acercar', pass: zoomed.zoom > zoomed.minZoom, ...zoomed });
    await page.mouse.move(canvas.x + canvas.width / 2, canvas.y + canvas.height / 2);
    await page.mouse.down(); await page.mouse.move(canvas.x + canvas.width / 2 - 5000, canvas.y + canvas.height / 2 - 5000, { steps: 25 }); await page.mouse.up(); await page.waitForTimeout(400);
    const dragged = await inspect(); results.push({ name: 'arrastre_acercado', pass: limited(dragged), ...dragged });
    await page.mouse.move(canvas.x + canvas.width / 2, canvas.y + canvas.height / 2); await page.mouse.wheel(0, 8000); await page.waitForTimeout(500);
    const minimum = await inspect(); results.push({ name: 'limite_alejar', pass: limited(minimum) && Math.abs(minimum.zoom - minimum.minZoom) < 0.001, ...minimum });
    await page.getByRole('button', { name: 'Ajustar vista', exact: true }).click(); await page.waitForTimeout(500);
    await page.waitForFunction(() => [...document.querySelectorAll('.leaflet-tile')].some(t => t.complete && t.naturalWidth), null, { timeout: 8000 }).catch(() => {});
    await page.screenshot({ path: 'diagnostico/interfaz/mapa-unico.png' });
    const before = await inspect(); await page.getByRole('button', { name: 'Actualizar', exact: true }).click(); await page.waitForTimeout(500);
    const after = await inspect(); results.push({ name: 'refresco_conserva_encuadre', pass: Math.abs(before.zoom - after.zoom) < 0.001 && Math.abs(before.center.lng - after.center.lng) < 0.001 && Math.abs(before.center.lat - after.center.lat) < 0.001 });
    return { date: new Date().toISOString(), controlledResponses: true, results, errors };
  } finally { await page.close(); }
}
