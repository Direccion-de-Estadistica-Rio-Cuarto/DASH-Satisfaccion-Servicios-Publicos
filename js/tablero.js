/* ==========================================================================
   tablero.js — Lógica del Monitor de Satisfacción de Servicios Públicos.
   Gobierno de Río Cuarto · Dir. de Estadística, Control de Calidad y Procesos.
   ========================================================================== */

(function () {
  'use strict';

  // --- Constantes y Helpers de Formato -------------------------------------
  const MESES = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  const ZONAS = [
    { id: '1', area: 'Área 1 — Bo. San Martín — Sector 1', month: 1 },
    { id: '2', area: 'Área 2 — Bo. San Martín — Sector 2', month: 1 },
    { id: '3', area: 'Área 3 — Fray Quirico Porreca (Banda Norte / La Agustina)', month: 1 },
    { id: '4', area: 'Área 4 — Bo. Castelli 1', month: 2 },
    { id: '5', area: 'Área 5 — Bo. San Martín — Sector 3', month: 2 },
    { id: '6', area: 'Área 6 — Nueva Argentina', month: 4 },
    { id: '7', area: 'Área 7 — Jardín (Oeste)', month: 5 },
    { id: '8', area: 'Área 8 — Pueblo Alberdi (Mi Lugar, Mi Sueño 2 y 3)', month: 6 },
    { id: '9', area: 'Área 9 — Goretti', month: 6 },
    { id: '10', area: 'Área 10 — San Pantaleón', month: 7 },
    { id: '11', area: 'Área 11 — Quintitas Golf', month: 7 },
    { id: '12', area: 'Área 12 — Bo. Alem', month: 8 },
    { id: '13', area: 'Área 13 — Bo. Jardín Norte', month: 9 },
    { id: '14', area: 'Área 14 — Bo. Industrial', month: 10 }
  ];

  const SERVICE_ITEMS = [
    { value: 'alumbrado', re: /alumbrado/i, label: 'Alumbrado público', icon: 'table_lamp', iconCls: 'icon-alumbrado' },
    { value: 'residuos', re: /recolección de residuos/i, label: 'Recolección de residuos', icon: 'delete_sweep', iconCls: 'icon-residuos' },
    { value: 'desmalezado', re: /desmalezado|limpieza de baldíos/i, label: 'Limpieza de baldíos / yuyos (desmalezado)', icon: 'grass', iconCls: 'icon-yuyos' },
    { value: 'calles', re: /estado de (la )?calles?/i, label: 'Estado de calles (bacheo)', icon: 'unpaved_road', iconCls: 'icon-calles' },
    { value: 'riego', re: /riego/i, label: 'Riego y desagües', icon: 'water', iconCls: 'icon-riego' }
  ];

  const STACK_CATS = [
    { label: 'Muy bien', color: 'var(--ok)' },
    { label: 'Bien', color: 'var(--serie-1)' },
    { label: 'Regular', color: 'var(--borde)' },
    { label: 'Mal', color: 'var(--serie-2)' },
    { label: 'Muy mal', color: 'var(--serie-4)' }
  ];

  const CHART_PALETTE = ['var(--serie-1)', 'var(--serie-3)', 'var(--serie-6)', 'var(--serie-4)', 'var(--serie-2)'];

  const prefersReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const fmtN = n => Number(n).toLocaleString('es-AR');
  const fmtPct = p => (isFinite(p) ? Number(p).toFixed(1) : '0.0') + '%';
  const escapeHtml = s => (s + '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

  const parseArNumText = t => {
    const c = (t || '').replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, '');
    const n = parseFloat(c);
    return isFinite(n) ? n : 0;
  };
  const parsePctText = t => parseFloat(t) || 0;

  function animateNumberText(el, toNum, formatter, parser, duration) {
    if (!el) return;
    if (prefersReducedMotion) {
      el.textContent = formatter(toNum);
      return;
    }
    const fromNum = parser(el.textContent);
    if (!isFinite(fromNum) || Math.abs(toNum - fromNum) < 0.05) {
      el.textContent = formatter(toNum);
      return;
    }
    duration = duration || 500;
    const start = performance.now();
    function tick(now) {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      el.textContent = formatter(fromNum + (toNum - fromNum) * eased);
      if (t < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  const animateCountText = (el, toNum) => animateNumberText(el, toNum, v => fmtN(Math.round(v)), parseArNumText);
  const animatePctText = (el, toNum) => animateNumberText(el, toNum, fmtPct, parsePctText);

  // --- Semáforo de Gestión ISP (Top-2 Box) ---------------------------------
  function getIspSemaforo(isp) {
    if (isp >= 75) {
      return { status: 'optimo', chip: 'Óptimo', icon: 'check_circle', badgeClass: 'isp-optimo', color: 'var(--ok)', strategy: 'Mantenimiento y consolidación' };
    } else if (isp >= 50) {
      return { status: 'intermedio', chip: 'Intermedio', icon: 'warning', badgeClass: 'isp-intermedio', color: 'var(--alerta)', strategy: 'Optimización y planes de mejora puntual' };
    } else {
      return { status: 'critico', chip: 'Crítico', icon: 'error', badgeClass: 'isp-critico', color: 'var(--grave)', strategy: 'Reestructuración prioritaria' };
    }
  }

  const tileLabelText = tile => {
    const label = tile.querySelector('.tile-label');
    if (!label) return '';
    return [...label.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join('').trim();
  };

  function parseTileBreakdown(tile) {
    const note = tile.querySelector('.raw-note');
    if (!note) return null;
    const out = note.textContent.split('·').map(s => s.trim()).filter(Boolean).map(seg => {
      const m = seg.match(/^(.*?)\s+([\d.,]+)(%?)$/);
      if (!m) return null;
      const isPct = m[3] === '%';
      const value = isPct ? parseFloat(m[2]) : parseArNumText(m[2]);
      return isFinite(value) ? { label: m[1].trim(), value, isPct } : null;
    }).filter(Boolean);
    return out.length ? out : null;
  }

  function zonaTileCategoryShares(tile) {
    const data = parseTileBreakdown(tile);
    if (!data) return null;
    const relevant = data.filter(d => d.label !== 'Ns/Nc');
    const total = relevant.reduce((s, d) => s + d.value, 0) || 1;
    const shares = {};
    relevant.forEach(d => { shares[d.label] = 100 * d.value / total; });
    return shares;
  }

  // --- Renderizado de Servicios Globales (Top-2 Box ISP) -------------------
  function renderServicios() {
    const CATS = ['Muy bien', 'Bien', 'Regular', 'Mal', 'Muy mal'];
    const zonaTiles = [...document.querySelectorAll('#consulta-vecinal .tile')];
    const grid = document.getElementById('serviciosGrid');
    if (!grid) return;
    grid.innerHTML = '';
    const serviceStats = [];

    SERVICE_ITEMS.forEach(({ re, label, icon, iconCls }) => {
      const tiles = zonaTiles.filter(t => re.test(tileLabelText(t)));
      const catSums = {};
      const catCounts = {};

      tiles.forEach(t => {
        const shares = zonaTileCategoryShares(t);
        if (!shares) return;
        CATS.forEach(c => {
          if (shares[c] != null) {
            catSums[c] = (catSums[c] || 0) + shares[c];
            catCounts[c] = (catCounts[c] || 0) + 1;
          }
        });
      });

      const muyBien = catCounts['Muy bien'] ? catSums['Muy bien'] / catCounts['Muy bien'] : 0;
      const bien = catCounts['Bien'] ? catSums['Bien'] / catCounts['Bien'] : 0;
      const regular = catCounts['Regular'] ? catSums['Regular'] / catCounts['Regular'] : 0;
      const mal = catCounts['Mal'] ? catSums['Mal'] / catCounts['Mal'] : 0;
      const muyMal = catCounts['Muy mal'] ? catSums['Muy mal'] / catCounts['Muy mal'] : 0;
      const isp = muyBien + bien;
      const disconformidad = mal + muyMal;
      const sem = getIspSemaforo(isp);

      serviceStats.push({ label, isp, sem, muyBien, bien, regular, disconformidad, count: tiles.length });

      const rawNote = CATS.map(c => catCounts[c] ? c + ' ' + fmtPct(catSums[c] / catCounts[c]) : null).filter(Boolean).join(' · ');

      const div = document.createElement('div');
      div.className = 'tile';
      div.innerHTML =
        '<div class="tile-top">' +
          '<div class="tile-num">' + fmtPct(isp) + '</div>' +
          '<span class="isp-badge ' + sem.badgeClass + '"><span class="icono" aria-hidden="true">' + sem.icon + '</span> ' + sem.chip + '</span>' +
        '</div>' +
        '<div class="tile-count">Aprobación ISP en ' + fmtN(tiles.length) + (tiles.length === 1 ? ' zona' : ' zonas') + '</div>' +
        '<div class="tile-label">' +
          '<span class="icono ' + iconCls + '" aria-hidden="true">' + icon + '</span>' + label +
          '<button type="button" class="info-tip align-right" aria-label="Detalles de ' + escapeHtml(label) + '" style="margin-left:auto">' +
            '<span class="icono" aria-hidden="true">info</span>' +
            '<span class="info-tip-content">' +
              '<strong>' + escapeHtml(label) + '</strong><br>' +
              '<strong>ISP:</strong> ' + fmtPct(isp) + ' (Muy bien + Bien)<br>' +
              '<strong>Semáforo:</strong> ' + sem.chip + '<br>' +
              '<strong>Estrategia:</strong> ' + sem.strategy +
            '</span>' +
          '</button>' +
        '</div>' +
        '<div class="bar-track"><div class="bar-fill" style="width:' + Math.min(100, isp) + '%;background:' + sem.color + '"></div></div>' +
        '<div class="isp-strategy"><strong>Estrategia:</strong> ' + sem.strategy + '</div>' +
        '<div class="isp-breakdown">' +
          '<div class="isp-breakdown-item"><span class="isp-breakdown-label">Excelencia (Muy bien):<button type="button" class="info-tip" aria-label="Info excelencia"><span class="icono" style="font-size:14px" aria-hidden="true">info</span><span class="info-tip-content"><strong>Excelencia:</strong> Calificación máxima Muy bien.</span></button></span><span class="isp-breakdown-val">' + fmtPct(muyBien) + '</span></div>' +
          '<div class="isp-breakdown-item"><span class="isp-breakdown-label">Aprobación (Bien):<button type="button" class="info-tip" aria-label="Info aprobación"><span class="icono" style="font-size:14px" aria-hidden="true">info</span><span class="info-tip-content"><strong>Aprobación estándar:</strong> Calificación favorable Bien.</span></button></span><span class="isp-breakdown-val">' + fmtPct(bien) + '</span></div>' +
          '<div class="isp-breakdown-item"><span class="isp-breakdown-label">Oportunidad (Regular):<button type="button" class="info-tip" aria-label="Info oportunidad"><span class="icono" style="font-size:14px" aria-hidden="true">info</span><span class="info-tip-content"><strong>Zona de oportunidad:</strong> Opinión neutra Regular; margen de mejora.</span></button></span><span class="isp-breakdown-val">' + fmtPct(regular) + '</span></div>' +
          '<div class="isp-breakdown-item"><span class="isp-breakdown-label">Disconformidad:<button type="button" class="info-tip" aria-label="Info disconformidad"><span class="icono" style="font-size:14px" aria-hidden="true">info</span><span class="info-tip-content"><strong>Disconformidad:</strong> Respuestas Mal y Muy mal.</span></button></span><span class="isp-breakdown-val" style="color:var(--grave)">' + fmtPct(disconformidad) + '</span></div>' +
        '</div>' +
        (rawNote ? '<div class="raw-note" style="margin:8px 0 0;font-size:11px;display:none">' + rawNote + '</div>' : '');

      grid.appendChild(div);
    });

    const ispPromedio = serviceStats.length ? serviceStats.reduce((s, x) => s + x.isp, 0) / serviceStats.length : 0;
    const statElem = document.getElementById('statISP');
    if (statElem) animatePctText(statElem, ispPromedio);

    const mejor = serviceStats.reduce((best, x) => (!best || x.isp > best.isp) ? x : best, null);
    const mejorElem = document.getElementById('statMejorServicio');
    if (mejor && mejorElem) mejorElem.textContent = mejor.label + ' (' + fmtPct(mejor.isp) + ')';

    document.querySelectorAll('#serviciosGrid .tile').forEach(addTileCharts);
  }

  // --- Filtros de Zonas ---------------------------------------------------
  function buildZonaOptions() {
    const sel = document.getElementById('zonaFilter');
    if (!sel) return;
    ZONAS.forEach(z => {
      const opt = document.createElement('option');
      opt.value = z.id;
      opt.textContent = z.area;
      sel.appendChild(opt);
    });
  }

  function buildZonaMonthOptions(zonaId) {
    const sel = document.getElementById('monthFilter');
    if (!sel) return;
    const prev = sel.value;
    sel.innerHTML = '<option value="">Todos los meses</option>';
    const list = zonaId ? ZONAS.filter(z => z.id === zonaId) : ZONAS;
    const months = new Set(list.map(z => z.month).filter(Boolean));
    const sorted = [...months].sort((a, b) => a - b);
    sorted.forEach(m => {
      const opt = document.createElement('option');
      opt.value = m;
      opt.textContent = MESES[m - 1];
      sel.appendChild(opt);
    });
    sel.value = sorted.map(String).includes(prev) ? prev : '';
  }

  function buildServicioOptions() {
    const sel = document.getElementById('servicioFilter');
    if (!sel) return;
    SERVICE_ITEMS.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s.value;
      opt.textContent = s.label;
      sel.appendChild(opt);
    });
  }

  function getVecinalFilters() {
    return {
      zona: document.getElementById('zonaFilter') ? document.getElementById('zonaFilter').value : '',
      year: document.getElementById('yearFilter') ? document.getElementById('yearFilter').value : '',
      month: document.getElementById('monthFilter') ? document.getElementById('monthFilter').value : '',
      servicio: document.getElementById('servicioFilter') ? document.getElementById('servicioFilter').value : ''
    };
  }

  function renderVecinal() {
    const { zona, year, month, servicio } = getVecinalFilters();
    const areas = [...document.querySelectorAll('.cv-area')];
    let visibleCount = 0;
    const matching = [];

    areas.forEach(el => {
      let show = true;
      if (zona && el.dataset.zona !== zona) show = false;
      if (month && el.dataset.month !== month) show = false;
      if (year && el.dataset.month && el.dataset.year !== year) show = false;
      if (show) {
        visibleCount++;
        matching.push(el);
      }
      el.style.display = (show && !servicio) ? '' : 'none';
      if (!servicio && zona) el.open = (el.dataset.zona === zona);
    });

    const desc = [];
    if (servicio) {
      const s = SERVICE_ITEMS.find(x => x.value === servicio);
      if (s) desc.push('servicio "' + s.label + '"');
    }
    if (zona) {
      const z = ZONAS.find(x => x.id === zona);
      if (z) desc.push('zona "' + z.area + '"');
    }
    if (year) desc.push('año ' + year);
    if (month) desc.push(MESES[month - 1]);

    const countElem = document.getElementById('filterCount');
    if (countElem) {
      countElem.textContent = fmtN(visibleCount) + (visibleCount === 1 ? ' zona' : ' zonas') +
        (desc.length ? ' — ' + desc.join(', ') : ' de ' + ZONAS.length + ' en total');
    }

    renderServiceComparison(matching, servicio);
  }

  function stackedLegendHtml() {
    return '<div class="chart-legend" style="flex-direction:row;flex-wrap:wrap;gap:16px;margin-top:0;margin-bottom:18px">' +
      STACK_CATS.map(c => '<div class="chart-legend-item"><span class="chart-legend-swatch" style="background:' + c.color + '"></span><span class="chart-legend-label" style="flex:none">' + c.label + '</span></div>').join('') +
      '</div>';
  }

  function stackedRowsHtml(rows) {
    return '<div class="stack-rows">' + rows.map((row, i) => {
      const segs = STACK_CATS.map((cat, si) => {
        const v = row.shares[cat.label] || 0;
        if (v <= 0) return '';
        return '<div class="stack-seg" data-w="' + v + '" style="width:0%;background:' + cat.color + ';transition-delay:' + (i * 25 + si * 25) + 'ms" title="' + escapeHtml(cat.label) + ' ' + fmtPct(v) + '"></div>';
      }).join('');
      return '<div class="stack-row">' +
        '<div class="stack-row-label" title="' + escapeHtml(row.label) + '">' + escapeHtml(row.label) + '</div>' +
        '<div class="stack-row-bar">' + segs + '</div>' +
        '<div class="stack-row-value"><span class="isp-badge ' + (row.sem ? row.sem.badgeClass : '') + '" style="padding:2px 7px;font-size:10.5px">' + fmtPct(row.isp) + ' ISP</span></div>' +
      '</div>';
    }).join('') + '</div>';
  }

  function renderServiceComparison(matchingAreas, servicioKey) {
    const box = document.getElementById('serviceChartBox');
    if (!box) return;
    const svc = servicioKey ? SERVICE_ITEMS.find(s => s.value === servicioKey) : null;
    if (!svc) {
      box.style.display = 'none';
      return;
    }

    const rows = matchingAreas.map(el => {
      const tile = [...el.querySelectorAll('.tile')].find(t => svc.re.test(tileLabelText(t)));
      if (!tile) return null;
      const shares = zonaTileCategoryShares(tile);
      if (!shares) return null;
      const muyBien = shares['Muy bien'] || 0;
      const bien = shares['Bien'] || 0;
      const isp = muyBien + bien;
      const sem = getIspSemaforo(isp);
      return { label: el.querySelector('h3').textContent, shares, isp, sem };
    }).filter(Boolean).sort((a, b) => b.isp - a.isp);

    document.getElementById('serviceChartTitle').innerHTML = '<span class="icono ' + svc.iconCls + '" aria-hidden="true">' + svc.icon + '</span> Comparativa por zona — ' + escapeHtml(svc.label);
    document.getElementById('serviceChartMeta').textContent = (rows.length ? fmtN(rows.length) : 'Sin') + (rows.length === 1 ? ' zona con datos' : ' zonas con datos') + ', ordenadas de mayor a menor aprobación (ISP Top-2 Box)';
    document.getElementById('serviceChartBody').innerHTML = rows.length ? (stackedLegendHtml() + stackedRowsHtml(rows)) : '';
    box.style.display = '';

    const segs = box.querySelectorAll('.stack-seg');
    setTimeout(() => segs.forEach(s => { s.style.width = s.dataset.w + '%'; }), 20);
  }

  // --- Diálogos de Gráficos SVG --------------------------------------------
  function svgPie(data, size) {
    const total = data.reduce((s, d) => s + d.value, 0) || 1;
    const r = size / 2, cx = r, cy = r;
    let angle = -Math.PI / 2;
    const slices = data.map((d, i) => {
      const frac = d.value / total;
      const a0 = angle, a1 = angle + frac * Math.PI * 2;
      angle = a1;
      const color = CHART_PALETTE[i % CHART_PALETTE.length];
      const delayStyle = 'transform-origin:' + cx + 'px ' + cy + 'px;animation-delay:' + (i * 70) + 'ms';
      if (frac >= 0.9999) return '<circle class="chart-pie-slice" style="' + delayStyle + '" cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="' + color + '"/>';
      const x0 = cx + r * Math.cos(a0), y0 = cy + r * Math.sin(a0);
      const x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1);
      const large = (a1 - a0) > Math.PI ? 1 : 0;
      return '<path class="chart-pie-slice" style="' + delayStyle + '" d="M' + cx + ',' + cy + ' L' + x0 + ',' + y0 + ' A' + r + ',' + r + ' 0 ' + large + ' 1 ' + x1 + ',' + y1 + ' Z" fill="' + color + '"/>';
    }).join('');
    return '<svg viewBox="0 0 ' + size + ' ' + size + '" width="' + size + '" height="' + size + '" role="img">' + slices + '</svg>';
  }

  function svgBar(data, width, barH) {
    const gap = 10, labelW = 128, valueW = 56;
    const max = Math.max.apply(null, data.map(d => d.value)) || 1;
    const chartW = width - labelW - valueW;
    const h = data.length * (barH + gap) + gap;
    const rows = data.map((d, i) => {
      const y = gap + i * (barH + gap);
      const w = Math.max(2, (d.value / max) * chartW);
      const color = CHART_PALETTE[i % CHART_PALETTE.length];
      return '<text x="0" y="' + (y + barH * 0.7) + '" font-size="12" style="fill:var(--texto-suave)">' + escapeHtml(d.label) + '</text>' +
        '<rect class="chart-bar-rect" data-w="' + w + '" x="' + labelW + '" y="' + y + '" width="0" height="' + barH + '" rx="4" fill="' + color + '" style="transition-delay:' + (i * 70) + 'ms"/>' +
        '<text x="' + (labelW + w + 8) + '" y="' + (y + barH * 0.7) + '" font-size="12" style="fill:var(--texto)">' + (d.isPct ? fmtPct(d.value) : fmtN(d.value)) + '</text>';
    }).join('');
    return '<svg viewBox="0 0 ' + width + ' ' + h + '" width="100%" height="' + h + '" role="img">' + rows + '</svg>';
  }

  function renderPieChart(data) {
    const total = data.reduce((s, d) => s + d.value, 0) || 1;
    const legend = '<div class="chart-legend">' + data.map((d, i) => {
      const valueLabel = d.isPct ? fmtPct(d.value) : (fmtN(d.value) + ' (' + (100 * d.value / total).toFixed(1) + '%)');
      return '<div class="chart-legend-item"><span class="chart-legend-swatch" style="background:' + CHART_PALETTE[i % CHART_PALETTE.length] + '"></span><span class="chart-legend-label">' + escapeHtml(d.label) + '</span><span class="chart-legend-value">' + valueLabel + '</span></div>';
    }).join('') + '</div>';
    return svgPie(data, 200) + legend;
  }

  function renderBarChart(data) {
    return svgBar(data, 420, 26);
  }

  function openChartDialog(tile, type) {
    const data = parseTileBreakdown(tile);
    if (!data) return;
    const chartDialog = document.getElementById('chartDialog');
    if (!chartDialog) return;
    document.getElementById('chartDialogIcon').textContent = type === 'pie' ? 'pie_chart' : 'bar_chart';
    document.getElementById('chartDialogTitle').innerHTML = '<span class="icono" id="chartDialogIcon" aria-hidden="true">' + (type === 'pie' ? 'pie_chart' : 'bar_chart') + '</span> ' + (type === 'pie' ? 'Gráfico de torta' : 'Gráfico de barras');
    document.getElementById('chartDialogSubtitle').textContent = tileLabelText(tile);
    document.getElementById('chartDialogChart').innerHTML = type === 'pie' ? renderPieChart(data) : renderBarChart(data);
    chartDialog.showModal();
    const bars = document.querySelectorAll('#chartDialogChart .chart-bar-rect');
    setTimeout(() => bars.forEach(r => r.setAttribute('width', r.dataset.w)), 20);
  }

  function addTileCharts(tile) {
    if (tile.querySelector('.tile-charts') || !parseTileBreakdown(tile)) return;
    const div = document.createElement('div');
    div.className = 'tile-charts';
    div.innerHTML =
      '<button type="button" class="tile-chart-btn" data-chart="pie" aria-label="Ver como gráfico de torta"><span class="icono" aria-hidden="true">pie_chart</span></button>' +
      '<button type="button" class="tile-chart-btn" data-chart="bar" aria-label="Ver como gráfico de barras"><span class="icono" aria-hidden="true">bar_chart</span></button>';
    tile.appendChild(div);
    div.querySelectorAll('button').forEach(btn => btn.addEventListener('click', () => openChartDialog(tile, btn.dataset.chart)));
  }

  // --- Pestañas de Navegación ----------------------------------------------
  function initPestanas() {
    const tablist = document.querySelector('.pestanas[role="tablist"]');
    if (!tablist) return;
    const tabs = tablist.querySelectorAll('[role="tab"]');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => {
          t.setAttribute('aria-selected', 'false');
          t.setAttribute('tabindex', '-1');
          const panel = document.getElementById(t.getAttribute('aria-controls'));
          if (panel) panel.hidden = true;
        });
        tab.setAttribute('aria-selected', 'true');
        tab.removeAttribute('tabindex');
        const activePanel = document.getElementById(tab.getAttribute('aria-controls'));
        if (activePanel) {
          activePanel.hidden = false;
          if (tab.id === 'tab-mapa' && window._tableroLeafletMap) {
            setTimeout(() => window._tableroLeafletMap.invalidateSize(), 50);
          }
        }
      });
    });
  }

  // --- Mapa Interactivo Integrado ------------------------------------------
  let geojsonData = null;
  let leafletGeoLayer = null;

  function initTableroMapa() {
    const mapEl = document.getElementById('tableroMapa');
    if (!mapEl || typeof L === 'undefined') return;

    const map = L.map('tableroMapa', {
      zoomControl: true,
      minZoom: 10,
      maxZoom: 17
    }).setView([-33.125, -64.35], 13);

    window._tableroLeafletMap = map;

    // Mosaicos locales de Argenmap (IGN)
    L.tileLayer('assets/mapa/{z}/{x}/{y}.png', {
      minZoom: 10,
      maxZoom: 17,
      attribution: 'Mapa base: © Instituto Geográfico Nacional (Argenmap)'
    }).addTo(map);

    fetch('datos/sectores-14-zonas.geojson')
      .then(res => res.json())
      .then(data => {
        geojsonData = data;
        actualizarCapaMapa();
      })
      .catch(() => {});

    const svcSel = document.getElementById('mapaServicioSelect');
    if (svcSel) {
      svcSel.addEventListener('change', actualizarCapaMapa);
    }
  }

  function getMetricValue(feature, metricKey) {
    const stats = feature.properties && feature.properties.stats;
    if (!stats || !stats.servicios) return null;
    const s = stats.servicios[metricKey];
    return s ? s.pct : null;
  }

  function getMetricColor(pct) {
    if (pct == null) return 'rgba(128, 128, 128, 0.3)';
    if (pct >= 75) return 'rgba(0, 131, 0, 0.75)';
    if (pct >= 50) return 'rgba(237, 161, 0, 0.75)';
    return 'rgba(209, 67, 66, 0.75)';
  }

  function actualizarCapaMapa() {
    if (!window._tableroLeafletMap || !geojsonData) return;
    const map = window._tableroLeafletMap;
    const metricKey = document.getElementById('mapaServicioSelect') ? document.getElementById('mapaServicioSelect').value : 'alumbrado';

    if (leafletGeoLayer) {
      map.removeLayer(leafletGeoLayer);
    }

    leafletGeoLayer = L.geoJSON(geojsonData, {
      style: function (feat) {
        const val = getMetricValue(feat, metricKey);
        return {
          fillColor: getMetricColor(val),
          weight: 2,
          opacity: 1,
          color: 'var(--texto)',
          fillOpacity: 0.65
        };
      },
      onEachFeature: function (feat, layer) {
        const p = feat.properties || {};
        const barrio = p.barrio || 'Sector barrial';
        const val = getMetricValue(feat, metricKey);
        const sem = val != null ? getIspSemaforo(val) : null;

        layer.bindTooltip('<strong>' + escapeHtml(barrio) + '</strong><br>' +
          (val != null ? 'ISP: ' + fmtPct(val) + ' (' + sem.chip + ')' : 'Sin datos'), { sticky: true });

        layer.on('click', function () {
          mostrarDetalleMapa(feat);
        });
      }
    }).addTo(map);

    try {
      map.fitBounds(leafletGeoLayer.getBounds(), { padding: [20, 20] });
    } catch (e) {}
  }

  function mostrarDetalleMapa(feat) {
    const p = feat.properties || {};
    const barrio = p.barrio || 'Sector';
    const meta = p.meta || '';
    const stats = p.stats || {};
    const servicios = stats.servicios || {};

    const titEl = document.getElementById('mapaPanelTitulo');
    const subEl = document.getElementById('mapaPanelSub');
    const contEl = document.getElementById('mapaPanelContenido');
    if (!titEl || !contEl) return;

    titEl.textContent = barrio;
    subEl.textContent = meta || (stats.muestras ? stats.muestras + ' muestras relevadas' : '');

    let html = '<div class="stack-rows" style="margin-top:14px">';
    SERVICE_ITEMS.forEach(svc => {
      const s = servicios[svc.value] || servicios[svc.value.replace('desmalezado', 'yuyos').replace('calles', 'calle')];
      if (s) {
        const sem = getIspSemaforo(s.pct);
        html += '<div style="margin-bottom:10px">' +
          '<div style="display:flex;justify-content:space-between;font-size:0.85rem;font-weight:600;margin-bottom:2px">' +
            '<span><span class="icono ' + svc.iconCls + '" aria-hidden="true" style="font-size:16px">' + svc.icon + '</span> ' + svc.label + '</span>' +
            '<span class="isp-badge ' + sem.badgeClass + '" style="font-size:10px">' + fmtPct(s.pct) + '</span>' +
          '</div>' +
          '<div class="bar-track"><div class="bar-fill" style="width:' + s.pct + '%;background:' + sem.color + '"></div></div>' +
          (s.rawNote ? '<div class="texto-suave" style="font-size:10.5px;margin-top:2px">' + s.rawNote + '</div>' : '') +
        '</div>';
      }
    });
    html += '</div>';
    contEl.innerHTML = html;
  }

  // --- Inicialización ------------------------------------------------------
  document.addEventListener('DOMContentLoaded', function () {
    buildZonaOptions();
    buildZonaMonthOptions('');
    buildServicioOptions();
    renderVecinal();

    const totalMuestras = [...document.querySelectorAll('.cv-area-meta')].reduce((acc, el) => {
      const m = el.textContent.match(/(\d+)\s+muestras/);
      return acc + (m ? parseInt(m[1], 10) : 0);
    }, 46);
    animateCountText(document.getElementById('statEncuestas'), totalMuestras);

    renderServicios();
    document.querySelectorAll('.cv-area .tile').forEach(addTileCharts);

    const zFilter = document.getElementById('zonaFilter');
    if (zFilter) {
      zFilter.addEventListener('change', () => {
        buildZonaMonthOptions(zFilter.value);
        renderVecinal();
      });
    }
    const yFilter = document.getElementById('yearFilter');
    if (yFilter) yFilter.addEventListener('change', renderVecinal);
    const mFilter = document.getElementById('monthFilter');
    if (mFilter) mFilter.addEventListener('change', renderVecinal);
    const sFilter = document.getElementById('servicioFilter');
    if (sFilter) sFilter.addEventListener('change', renderVecinal);

    initPestanas();
    initTableroMapa();
  });
})();
