/* Dashboard logic. Reads data through the small `dash` layer in dash-shim.js. */
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const f0 = d3.format('.0f'), f1 = d3.format('.1f'), f2 = d3.format('.2f'), fInt = d3.format(',');
  const cmp = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 });
  const enc = (s) => String(s).replace(/%/g, '%25').replace(/&/g, '%26').replace(/=/g, '%3D').replace(/,/g, '%2C');
  const root = $('#nx-root'), tip = $('#nx-tip'), pageBox = $('#nx-page');
  const NAVY = '#33528c', MID = '#7b94c4', LITE = '#c9d4ea', AMB = '#e9b949', RED = '#d9534f', GRN = '#3aa66b', MUTED = '#7a8497';
  const BANDS = [[20, '#F8696B'], [40, '#F4A15B'], [60, '#FFD24D'], [80, '#A9D08E'], [101, '#63BE7B']];
  const bandColor = (p) => { p = Math.round(p * 10) / 10; for (const [hi, c] of BANDS) if (p < hi) return c; return BANDS[4][1]; };
  const AREAS = ['Agriculture', 'Electricity', 'Education', 'Roads', 'Crime', 'Road accidents', 'Improved sanitation', 'Births', 'Deaths', 'Local economic development (LED)', 'Health', 'Forestry', 'Water', 'Assembly revenue', 'SDGs Budget'];
  const YEARS = d3.range(2015, 2026);
  const FMT = { int: (v) => fInt(Number(v)), pct: (v) => f1(Number(v)) + '%', pct2: (v) => f2(Number(v)) + '%', num0: (v) => f0(Number(v)), text: (v) => (v ? String(v) : '—') };

  // ---------- small DOM helper
  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    if (attrs) for (const [k, v] of Object.entries(attrs)) { if (v == null || v === false) continue; if (k === 'class') el.className = v; else if (k.startsWith('on')) el.addEventListener(k.slice(2), v); else el.setAttribute(k, v); }
    for (const c of kids.flat()) { if (c == null || c === false) continue; el.append(c.nodeType ? c : document.createTextNode(String(c))); }
    return el;
  }
  const mark = (el, src, field, where) => { el.setAttribute('data-source', src); el.setAttribute('data-field', field); if (where) el.setAttribute('data-where', where); return el; };

  // ---------- calculations
  dash.calc('scope_totals', { inputs: ['districts'], title: 'Totals by scope', description: 'Totals, rates and average completion for the nation and each region.',
    fn: (districts) => { const keys = ['All regions'].concat(Array.from(new Set(districts.map((d) => d.region)))); const out = [];
      for (const k of keys) { const ds = k === 'All regions' ? districts : districts.filter((d) => d.region === k);
        const s = { region: k, districts: ds.length, records: 0, expected: 0, submissions: 0, workbooks: 0, repeats: 0, invalid: 0, invalid_small: 0, invalid_pct: 0, outliers: 0, conflicts: 0, c: 0, b80: 0, b50: 0, b0: 0, below50: 0, ge90: 0 };
        for (const d of ds) { s.records += Number(d.records); s.expected += Number(d.expected); s.submissions += Number(d.submissions); s.workbooks += Number(d.workbooks); s.repeats += Number(d.repeats); s.invalid += Number(d.invalid); s.invalid_small += Number(d.invalid_small); s.invalid_pct += Number(d.invalid_pct); s.outliers += Number(d.outliers); s.conflicts += Number(d.conflicts);
          const oc = Number(d.overall_completion); s.c += oc; if (oc >= 80) s.b80 += 1; else if (oc >= 50) s.b50 += 1; else s.b0 += 1; if (oc < 50) s.below50 += 1; if (oc >= 90) s.ge90 += 1; }
        s.pct_of_expected = s.records / s.expected * 100; s.avg_completion = s.c / s.districts; s.repeat_rate = s.repeats / s.records * 100; s.invalid_rate = s.invalid / s.records * 100; s.outlier_rate = s.outliers / s.records * 100; delete s.c; out.push(s); }
      return out; } });
  dash.calc('scope_years', { inputs: ['district_years'], title: 'Totals by year', description: 'Records, expected records, repeats, invalid values and outliers per year for the nation and each region.',
    fn: (district_years) => { const m = {}; const add = (reg, d) => { const k = reg + '|' + d.year; const g = m[k] || (m[k] = { region: reg, year: Number(d.year), records: 0, expected: 0, repeats: 0, invalid: 0, outliers: 0 });
      g.records += Number(d.records); g.expected += Number(d.expected); g.repeats += Number(d.repeats); g.invalid += Number(d.invalid); g.outliers += Number(d.outliers); };
      for (const d of district_years) { add('All regions', d); add(d.region, d); } return Object.values(m).sort((a, b) => a.year - b.year); } });
  dash.calc('scope_inds', { inputs: ['district_areas'], title: 'Totals by indicator', description: 'Records, quality counts and average completion for each indicator, for the nation and each region.',
    fn: (district_areas) => { const m = {}; const add = (reg, d) => { const k = reg + '|' + d.area; const g = m[k] || (m[k] = { region: reg, area: d.area, records: 0, repeats: 0, invalid: 0, invalid_small: 0, invalid_pct: 0, outliers: 0, conflicts: 0, c: 0, n: 0 });
      g.records += Number(d.records); g.repeats += Number(d.repeats); g.invalid += Number(d.invalid); g.invalid_small += Number(d.invalid_small); g.invalid_pct += Number(d.invalid_pct); g.outliers += Number(d.outliers); g.conflicts += Number(d.conflicts); g.c += Number(d.coverage_pct); g.n += 1; };
      for (const d of district_areas) { add('All regions', d); add(d.region, d); }
      return Object.values(m).map((g) => ({ region: g.region, area: g.area, records: g.records, repeats: g.repeats, invalid: g.invalid, invalid_small: g.invalid_small, invalid_pct: g.invalid_pct, outliers: g.outliers, conflicts: g.conflicts, avg_coverage: g.c / g.n })); } });
  dash.calc('ranks', { inputs: ['districts'], title: 'District ranking', description: 'Each district’s rank by overall completion, nationally and within its region.',
    fn: (districts) => { const ds = districts.map((d) => ({ district: d.district, region: d.region, overall_completion: Number(d.overall_completion) })).sort((a, b) => b.overall_completion - a.overall_completion || a.district.localeCompare(b.district));
      const rank = (arr, d) => 1 + arr.filter((x) => x.overall_completion > d.overall_completion).length; const byReg = {}; for (const d of ds) (byReg[d.region] = byReg[d.region] || []).push(d);
      return ds.map((d) => ({ district: d.district, region: d.region, overall_completion: d.overall_completion, national_rank: rank(ds, d), region_rank: rank(byReg[d.region], d), region_n: byReg[d.region].length, national_n: ds.length })); } });
  const SOURCES = ['districts', 'scope_totals', 'scope_years', 'scope_inds', 'ranks', 'district_years', 'district_areas', 'district_indicator_years', 'submissions'];
  const data = (id) => dash.data(id).data;

  // ---------- state
  const sel = () => { const p = dash.params(); return { page: p.page || 'overview', region: p.region || null, district: p.district || null }; };
  const go = (o) => { const n = Object.assign({}, sel(), o); dash.setParams({ page: n.page === 'overview' ? null : n.page, region: n.region || null, district: n.district || null }); dash.setLink('nx-' + n.page); root.scrollIntoView({ block: 'start' }); };
  const PAGES = { overview: 'Dashboard', completeness: 'Completeness', uniqueness: 'Uniqueness', validity: 'Validity', accuracy: 'Accuracy', method: 'Methodology' };
  let post = [], optKey = '', ovMetric = 'records'; const tstate = {};
  const later = (fn) => post.push(fn);

  // ---------- tooltip
  function showTip(ev, title, rows) {
    tip.replaceChildren(); tip.append(h('div', { class: 't' }, title)); for (const [a, b] of rows) tip.append(h('div', { class: 'r' }, h('span', null, a), h('span', null, b)));
    tip.hidden = false; const box = root.getBoundingClientRect(); let x = ev.clientX - box.left + 12, y = ev.clientY - box.top + 12; const tw = tip.offsetWidth, th = tip.offsetHeight;
    if (x + tw > box.width - 4) x = Math.max(4, ev.clientX - box.left - tw - 12); if (y + th > box.height - 4) y = Math.max(4, ev.clientY - box.top - th - 12); tip.style.left = x + 'px'; tip.style.top = y + 'px';
  }
  const hideTip = () => { tip.hidden = true; };
  const clear = (box) => { box.replaceChildren(); return d3.select(box); };

  // ---------- charts
  function textWidth(svg, strings, cls) { const t = svg.append('text').attr('class', cls || 'lab'); let m = 0; for (const s of strings) { t.text(s); m = Math.max(m, t.node().getComputedTextLength()); } t.remove(); return m; }
  function smooth(svg, rows, w, hgt, m, o) {
    const gid = 'g' + Math.random().toString(36).slice(2, 8); const lg = svg.append('defs').append('linearGradient').attr('id', gid).attr('x1', 0).attr('x2', 0).attr('y1', 0).attr('y2', 1);
    lg.append('stop').attr('offset', '0%').attr('stop-color', NAVY).attr('stop-opacity', o.op || 0.3); lg.append('stop').attr('offset', '100%').attr('stop-color', NAVY).attr('stop-opacity', 0.02);
    const x = d3.scalePoint(rows.map((r) => r.label), [m.l, w - m.r]).padding(o.pad == null ? 0.25 : o.pad), maxV = d3.max(rows, (r) => r.value) || 1;
    const y = d3.scaleLinear([0, maxV * (o.head || 1.12)], [hgt - m.b, m.t]); if (o.nice) y.nice(4);
    const pts = rows.map((r) => [x(r.label), y(r.value)]);
    svg.append('path').datum(rows).attr('d', d3.area().x((d, i) => pts[i][0]).y0(hgt - m.b).y1((d, i) => pts[i][1]).curve(d3.curveMonotoneX)).style('fill', 'url(#' + gid + ')');
    svg.append('path').datum(rows).attr('d', d3.line().x((d, i) => pts[i][0]).y((d, i) => pts[i][1]).curve(d3.curveMonotoneX)).style('fill', 'none').style('stroke', NAVY).style('stroke-width', o.lw || 2.2).style('stroke-linecap', 'round');
    return { x, y, pts };
  }
  function areaChart(box, rows, o) {
    o = o || {}; const w = Math.max(box.clientWidth, 300), hgt = o.h || 250, m = { t: 34, r: 18, b: 28, l: 48 };
    const svg = clear(box).append('svg').attr('width', '100%').attr('viewBox', `0 0 ${w} ${hgt}`);
    const maxV = d3.max(rows, (r) => r.value) || 1; const yy = d3.scaleLinear([0, maxV * 1.15], [hgt - m.b, m.t]).nice(4);
    const g = svg.append('g').attr('class', 'grid'); yy.ticks(4).forEach((v) => g.append('line').attr('x1', m.l).attr('x2', w - m.r).attr('y1', yy(v)).attr('y2', yy(v)));
    const ya = svg.append('g').attr('class', 'ax'); yy.ticks(4).forEach((v) => ya.append('text').attr('x', m.l - 8).attr('y', yy(v) + 4).attr('text-anchor', 'end').text((o.axis || ((q) => cmp.format(q)))(v)));
    const { x, y, pts } = smooth(svg, rows, w, hgt, m, { head: 1.15, nice: true, pad: 0.3 });
    const xa = svg.append('g').attr('class', 'ax'); rows.forEach((r, i) => { if (rows.length > 8 && w < 420 && i % 2) return; xa.append('text').attr('x', pts[i][0]).attr('y', hgt - 8).attr('text-anchor', 'middle').text(r.label); });
    const idx = []; rows.forEach((r, i) => { const p = rows[i - 1], n = rows[i + 1]; if (i === rows.length - 1 || (p && n && ((r.value > p.value && r.value >= n.value) || (r.value < p.value && r.value <= n.value)))) idx.push(i); });
    let lastX = -999; idx.forEach((i) => { if (pts[i][0] - lastX < 56) return; lastX = pts[i][0]; const txt = (o.fmt || ((q) => cmp.format(q)))(rows[i].value); const tw = textWidth(svg, [txt]) + 14;
      svg.append('circle').attr('cx', pts[i][0]).attr('cy', pts[i][1]).attr('r', 4).style('fill', '#fff').style('stroke', NAVY).style('stroke-width', 2);
      const gx = Math.min(Math.max(pts[i][0] - tw / 2, 2), w - tw - 2); const lg = svg.append('g'); lg.append('rect').attr('x', gx).attr('y', pts[i][1] - 30).attr('width', tw).attr('height', 20).attr('rx', 8).style('fill', '#fff').style('stroke', '#d6dded');
      lg.append('text').attr('class', 'lab').attr('x', gx + tw / 2).attr('y', pts[i][1] - 16).attr('text-anchor', 'middle').text(txt); });
    const vl = svg.append('line').attr('y1', m.t).attr('y2', hgt - m.b).style('stroke', NAVY).style('stroke-dasharray', '3 3').style('opacity', 0), hd = svg.append('circle').attr('r', 5).style('fill', NAVY).style('opacity', 0);
    svg.append('rect').attr('x', m.l).attr('y', m.t).attr('width', w - m.l - m.r).attr('height', hgt - m.t - m.b).style('fill', 'transparent')
      .on('pointermove', (ev) => { const bb = svg.node().getBoundingClientRect(); const px = (ev.clientX - bb.left) * (w / (bb.width || w)); let bi = 0, bd = 1e9; pts.forEach((p, i) => { const dd = Math.abs(p[0] - px); if (dd < bd) { bd = dd; bi = i; } });
        vl.attr('x1', pts[bi][0]).attr('x2', pts[bi][0]).style('opacity', 0.6); hd.attr('cx', pts[bi][0]).attr('cy', pts[bi][1]).style('opacity', 1); showTip(ev, rows[bi].label, rows[bi].tip || [[o.name || 'Value', (o.fmt || ((q) => cmp.format(q)))(rows[bi].value)]]); })
      .on('pointerleave', () => { vl.style('opacity', 0); hd.style('opacity', 0); hideTip(); });
  }
  function spark(box, rows) {
    const w = 120, hgt = 48, svg = clear(box).append('svg').attr('width', '100%').attr('viewBox', `0 0 ${w} ${hgt}`);
    if (rows.length < 2) return; const { pts } = smooth(svg, rows, w, hgt, { t: 6, r: 4, b: 3, l: 4 }, { pad: 0.02, lw: 1.8, op: 0.28, head: 1.05 });
    const l = pts[pts.length - 1]; svg.append('circle').attr('cx', l[0]).attr('cy', l[1]).attr('r', 2.6).style('fill', NAVY);
    svg.append('rect').attr('width', w).attr('height', hgt).style('fill', 'transparent').on('pointermove', (ev) => { const bb = svg.node().getBoundingClientRect(); const i = Math.max(0, Math.min(rows.length - 1, Math.round((ev.clientX - bb.left) / (bb.width || w) * (rows.length - 1)))); showTip(ev, rows[i].label, rows[i].tip || [['Value', cmp.format(rows[i].value)]]); }).on('pointerleave', hideTip);
  }
  function donut(box, parts, centerTop, centerSub) {
    const s = 160, svg = clear(box).append('svg').attr('width', '100%').attr('viewBox', `0 0 ${s} ${s}`).style('max-width', '11rem'); const g = svg.append('g').attr('transform', `translate(${s / 2},${s / 2})`);
    const arcs = d3.pie().sort(null).value((d) => d.value)(parts.filter((p) => p.value > 0)); const arc = d3.arc().innerRadius(50).outerRadius(72).cornerRadius(3).padAngle(0.02);
    g.selectAll('path').data(arcs).join('path').attr('d', arc).style('fill', (d) => d.data.color).on('pointermove', (ev, d) => showTip(ev, d.data.label, [['Value', d.data.text]])).on('pointerleave', hideTip);
    g.append('text').attr('text-anchor', 'middle').attr('dy', centerSub ? '-.1em' : '.35em').style('font-size', '20px').style('font-weight', 700).style('fill', '#1c2434').text(centerTop);
    if (centerSub) g.append('text').attr('text-anchor', 'middle').attr('dy', '1.3em').style('font-size', '9.5px').style('fill', MUTED).text(centerSub);
  }
  const legend = (parts) => h('ul', { class: 'nx-legend' }, parts.map((p) => h('li', null, h('i', { style: 'background:' + p.color }), p.label, ' ', h('em', null, p.text))));
  function barsH(box, rows, o) {
    o = o || {}; const w = Math.max(box.clientWidth, 260), rowH = 27, hgt = rows.length * rowH + 26; const svg = clear(box).append('svg').attr('width', '100%').attr('viewBox', `0 0 ${w} ${hgt}`);
    const L = Math.min(textWidth(svg, rows.map((r) => r.label)) + 10, w * 0.46), R = textWidth(svg, rows.map((r) => r.text)) + 10; const x = d3.scaleLinear([0, o.max || d3.max(rows, (r) => r.value) || 1], [L, w - R]);
    const g = svg.append('g').attr('class', 'grid'); x.ticks(4).forEach((v) => g.append('line').attr('x1', x(v)).attr('x2', x(v)).attr('y1', 0).attr('y2', hgt - 22));
    svg.append('g').attr('class', 'ax').attr('transform', `translate(0,${hgt - 22})`).call(d3.axisBottom(x).ticks(4).tickFormat(o.tick || ((v) => cmp.format(v)))).attr('font-size', null).attr('font-family', null);
    rows.forEach((r, i) => { const y = i * rowH + 3, grp = svg.append('g'); let lab = r.label; const lt = svg.append('text').attr('class', 'lab').attr('x', L - 8).attr('y', y + 12).attr('text-anchor', 'end').text(lab);
      while (lt.node().getComputedTextLength() > L - 10 && lab.length > 4) { lab = lab.slice(0, -2); lt.text(lab + '…'); }
      grp.append('rect').attr('x', L).attr('y', y).attr('width', Math.max(0, x(r.value) - L)).attr('height', rowH - 10).attr('rx', 6).style('fill', r.color || NAVY); grp.append('text').attr('class', 'lab').attr('x', x(r.value) + 6).attr('y', y + 12).text(r.text);
      grp.append('rect').attr('class', 'hit').attr('x', 0).attr('y', y - 3).attr('width', w).attr('height', rowH).style('fill', 'transparent').on('pointermove', (ev) => showTip(ev, r.label, r.tip || [['Value', r.text]])).on('pointerleave', hideTip).on('click', () => { if (r.click) { hideTip(); r.click(); } }); });
  }
  const TILES = [['Upper West', 0, 0], ['Upper East', 2, 0], ['Savannah', 0, 1], ['Northern', 1, 1], ['North East', 2, 1], ['Bono', 0, 2], ['Bono East', 1, 2], ['Oti', 2, 2], ['Ahafo', 0, 3], ['Ashanti', 1, 3], ['Volta', 2, 3], ['Western North', 0, 4], ['Eastern', 1, 4], ['Western', 0, 5], ['Central', 1, 5], ['Greater Accra', 2, 5]];
  function tiles(box, rows, field, selected, fmtv) {
    const by = Object.fromEntries(rows.map((r) => [r.region, r])), vals = rows.map((r) => Number(r[field])), ramp = d3.scaleLinear([d3.min(vals), d3.max(vals)], ['#e3e9f5', '#2f4b82']).clamp(true);
    const w = Math.max(box.clientWidth, 220), gap = 6, cols = 3, cell = Math.min(78, (w - gap * 2) / cols), hh = 6 * (cell + gap);
    const svg = clear(box).append('svg').attr('width', '100%').attr('viewBox', `0 0 ${cols * cell + 2 * gap} ${hh}`).style('max-width', '17rem').style('margin', '0 auto');
    TILES.forEach(([name, c, r]) => { const d = by[name]; if (!d) return; const v = Number(d[field]), x = c * (cell + gap), y = r * (cell + gap), on = selected === name, dim = selected && !on;
      const grp = svg.append('g').style('opacity', dim ? 0.5 : 1).style('cursor', 'pointer'); const dark = ramp(v) && d3.hsl(ramp(v)).l < 0.55;
      grp.append('rect').attr('x', x).attr('y', y).attr('width', cell).attr('height', cell).attr('rx', 11).style('fill', ramp(v)).style('stroke', on ? '#1c2434' : 'none').style('stroke-width', 2.5);
      const words = name.split(' '), lines = words.length > 1 && name.length > 9 ? [words.slice(0, Math.ceil(words.length / 2)).join(' '), words.slice(Math.ceil(words.length / 2)).join(' ')] : [name];
      lines.forEach((ln, i) => grp.append('text').attr('x', x + cell / 2).attr('y', y + cell / 2 + (i - (lines.length - 1) / 2) * 11 + 4).attr('text-anchor', 'middle').style('font-size', '8.5px').style('font-weight', 600).style('fill', dark ? '#fff' : '#1c2434').style('pointer-events', 'none').text(ln));
      grp.on('pointermove', (ev) => showTip(ev, name, [['Value', (fmtv || ((q) => f1(q) + '%'))(v)], ['Districts', fInt(d.districts)]])).on('pointerleave', hideTip).on('click', () => { hideTip(); go({ region: name, district: null }); }); });
  }
  function indicatorCard(host, area, cov, byYear) {
    const has = cov && Number(cov.records) > 0, cp = cov ? Number(cov.coverage_pct) : 0, chip = h('span', { class: 'chip ' + (!has ? 'grey' : cp >= 80 ? 'green' : cp >= 50 ? 'amber' : 'red') }, has ? f0(cp) + '%' : 'No data');
    const box = h('div', { class: 'nx-chart' }), card = h('div', { class: 'nx-card' + (has ? '' : ' empty') }, h('div', { class: 'hh' }, h('b', null, area), chip), box,
      h('div', { class: 'ft' }, has ? fInt(cov.records) + ' records · ' + byYear.size + (byYear.size === 1 ? ' year' : ' years') + ' with data' : 'No records reported for this indicator')); host.append(card);
    later(() => { const w = Math.max(box.clientWidth, 170), hgt = 104, m = { t: 6, b: 18, l: 2, r: 2 }, missing = new Set((cov && cov.missing_years ? String(cov.missing_years).split(',') : []).map(Number));
      const svg = d3.select(box).append('svg').attr('width', '100%').attr('viewBox', `0 0 ${w} ${hgt}`); const x = d3.scaleBand(YEARS, [m.l, w - m.r]).padding(0.22), y = d3.scaleLinear([0, d3.max(Array.from(byYear.values())) || 1], [hgt - m.b, m.t]);
      YEARS.forEach((yr) => { const v = byYear.get(yr) || 0, na = !v && !missing.has(yr);
        if (v) svg.append('rect').attr('x', x(yr)).attr('y', y(v)).attr('width', x.bandwidth()).attr('height', hgt - m.b - y(v)).attr('rx', 3).style('fill', NAVY); else if (!na) svg.append('rect').attr('x', x(yr)).attr('y', hgt - m.b - 4).attr('width', x.bandwidth()).attr('height', 4).attr('rx', 2).style('fill', AMB);
        svg.append('rect').attr('x', x(yr)).attr('y', m.t).attr('width', x.bandwidth()).attr('height', hgt - m.t - m.b).style('fill', 'transparent').on('pointermove', (ev) => showTip(ev, area + ', ' + yr, [['Records', v ? fInt(v) : na ? 'Not applicable' : 'No data']])).on('pointerleave', hideTip); });
      [2015, 2020, 2025].forEach((yr, i) => svg.append('text').attr('x', x(yr) + x.bandwidth() / 2).attr('y', hgt - 4).attr('text-anchor', i === 0 ? 'start' : i === 2 ? 'end' : 'middle').attr('dx', i === 0 ? -x.bandwidth() / 2 : i === 2 ? x.bandwidth() / 2 : 0).style('font-size', '10px').style('fill', MUTED).text(yr)); });
  }

  // ---------- widgets
  const chip = (t, c) => h('span', { class: 'chip ' + c }, t);
  const statusChip = (p) => (p >= 80 ? chip('Strong', 'green') : p >= 50 ? chip('Moderate', 'amber') : chip('Low', 'red'));
  const card = (title, note, body, extra) => h('div', { class: 'nx-card' }, h('div', { class: 'hd' }, h('h3', null, title), extra || null), note ? h('p', { class: 'nx-note' }, note) : null, body);
  const chartBox = (src, cls) => h('div', { class: 'nx-chart ' + (cls || ''), 'data-source': src });
  function kpi(c, o) {
    const fld = o.field === 'comp' ? c.compField : o.field, val = mark(h('div', { class: 'n' }, '—'), c.src, fld, c.where); val.textContent = FMT[o.fmt](c.row[fld]);
    const sp = o.spark ? h('div', { class: 'sp', 'data-source': o.sparkSrc || c.src }) : null; if (sp) later(() => spark(sp, o.spark));
    return h('div', { class: 'nx-card nx-kpi' }, h('div', { class: 'l' }, h('span', null, o.label), o.chip || null), h('div', null, val, o.sub ? h('div', { class: 's' }, o.sub) : null), sp);
  }
  function dchip(Y, fn, goodUp, unit) {
    const a = Y.find((r) => r.year === 2023), b = Y.find((r) => r.year === 2024); if (!a || !b) return null; const va = fn(a), vb = fn(b); let diff, txt;
    if (unit === 'pts') { diff = vb - va; txt = (diff >= 0 ? '▲ ' : '▼ ') + f1(Math.abs(diff)) + ' pts'; } else { if (!va) return null; diff = (vb - va) / va * 100; txt = (diff >= 0 ? '▲ ' : '▼ ') + f0(Math.abs(diff)) + '%'; }
    return chip(txt, (goodUp ? diff >= 0 : diff <= 0) ? 'green' : 'red');
  }
  const pctExp = (r) => (Number(r.expected) ? Number(r.records) / Number(r.expected) * 100 : 0);
  const rateOf = (k) => (r) => (Number(r.records) ? Number(r[k]) / Number(r.records) * 100 : 0);
  const yrows = (Y, fn, fmt, name) => Y.map((r) => ({ label: String(r.year), value: fn(r) || 0, tip: [[name, fmt(fn(r) || 0)], ['Records', fInt(r.records)]] }));
  function table(id, cols, rows, o) {
    o = o || {}; const st = tstate[id] || (tstate[id] = { k: o.sort || cols[0].k, dir: o.dir || -1 }); const col = cols.find((c) => c.k === st.k) || cols[0]; const val = col.v || ((r) => r[col.k]);
    const sorted = rows.slice().sort((a, b) => { const x = val(a), y = val(b); return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y))) * st.dir; }).slice(0, o.limit || 9999);
    const th = cols.map((c) => h('th', { class: (c.num ? 'num ' : '') + (c.hide ? 'hide-n' : ''), 'data-field': c.field || null }, c.sort === false ? c.label : h('button', { type: 'button', onclick: () => { if (st.k === c.k) st.dir = -st.dir; else { st.k = c.k; st.dir = c.num ? -1 : 1; } render(); } }, c.label + (st.k === c.k ? (st.dir > 0 ? ' ↑' : ' ↓') : ''))));
    const tr = sorted.map((r) => h('tr', { class: o.onRow ? 'pick' : null, 'data-key': o.key ? o.key(r) : null, onclick: o.onRow ? () => o.onRow(r) : null }, cols.map((c) => { const td = h('td', { class: (c.num ? 'num ' : '') + (c.hide ? 'hide-n ' : '') + (c.cls ? c.cls(r) : '') }); const v = c.r ? c.r(r) : r[c.k]; if (v != null) td.append(v.nodeType ? v : document.createTextNode(String(v))); if (c.bg) { const b = c.bg(r); if (b) td.style.background = b; } return td; })));
    return h('div', { class: 'nx-tablewrap' }, h('table', { class: 'nx-table', 'data-source': o.source || null, 'data-row-key': o.keyCols || null }, h('thead', null, h('tr', null, th)), h('tbody', null, tr)));
  }
  const pbar = (v, max, color) => h('div', { class: 'nx-pb' }, h('i', null, h('b', { style: `width:${Math.max(0, Math.min(100, v / max * 100))}%;${color ? 'background:' + color : ''}` })), h('span', null, f1(v) + '%'));
  const sentence = (I) => { const n80 = I.filter((a) => a.coverage >= 80).length, mid = I.filter((a) => a.coverage >= 50 && a.coverage < 80).length, low = I.filter((a) => a.coverage < 50).sort((a, b) => a.coverage - b.coverage);
    let s = `${n80} of 15 thematic areas are at least 80% complete`; if (mid) s += `; ${mid} ${mid === 1 ? 'is' : 'are'} 50-79%`; if (low.length) { s += `; ${low.length} ${low.length === 1 ? 'is' : 'are'} below 50%`; const nz = low.filter((a) => a.coverage === 0).length; if (nz) s += `, of which ${nz} ${nz === 1 ? 'has' : 'have'} no data`;
      s += '. Areas below 50%: ' + low.slice(0, 6).map((a) => `${a.area} (${a.coverage === 0 ? 'no data' : f0(a.coverage) + '%'})`).join(', ') + (low.length > 6 ? ' and others.' : '.'); } else { const w = I.slice().sort((a, b) => a.coverage - b.coverage)[0]; s += `. Weakest area: ${w.area} (${f0(w.coverage)}%).`; } return s; };

  // ---------- context
  function ctx() {
    const s = sel(), D = data('districts'), ST = data('scope_totals'); let level = 'national', row, src, where, compField;
    if (s.district) { level = 'district'; row = D.find((d) => d.district === s.district); src = 'districts'; where = 'district=' + enc(s.district); compField = 'overall_completion'; }
    else { level = s.region ? 'region' : 'national'; const key = s.region || 'All regions'; row = ST.find((r) => r.region === key); src = 'scope_totals'; where = 'region=' + enc(key); compField = 'avg_completion'; }
    const key = s.region || 'All regions';
    const Y = (level === 'district' ? data('district_years').filter((r) => r.district === s.district) : data('scope_years').filter((r) => r.region === key)).map((r) => Object.assign({}, r, { year: Number(r.year) }));
    const I0 = level === 'district' ? data('district_areas').filter((r) => r.district === s.district) : data('scope_inds').filter((r) => r.region === key);
    const I = AREAS.map((a) => I0.find((r) => r.area === a)).filter(Boolean).map((r) => Object.assign({}, r, { coverage: level === 'district' ? Number(r.coverage_pct) : Number(r.avg_coverage) }));
    const inScope = D.filter((d) => !s.region || d.region === s.region), name = level === 'district' ? s.district : level === 'region' ? s.region + ' region' : 'All regions';
    return { s, level, row, src, where, compField, Y, I, D, inScope, name, ST };
  }
  const scopeDistricts = (c) => c.inScope;
  const openDistrict = (r) => go({ region: r.region, district: r.district });

  // ---------- pages
  function pageOverview(c) {
    const out = [], ranksRow = data('ranks').find((r) => r.district === c.s.district);
    let subSpark, subLabel;
    if (c.level === 'district') { const subs = data('submissions').filter((r) => r.district === c.s.district); subSpark = subs.slice().reverse().map((r) => ({ label: r.submitted === 'No timestamp' ? 'No matched time' : r.submitted, value: Number(r.records), tip: [['Records', fInt(r.records)]] })); subLabel = 'Records in each'; }
    else if (c.level === 'region') { subSpark = c.inScope.map((d) => ({ label: d.district, value: Number(d.submissions), tip: [['Submissions', fInt(d.submissions)]] })); subLabel = 'By district'; }
    else { subSpark = c.ST.filter((r) => r.region !== 'All regions').map((r) => ({ label: r.region, value: Number(r.submissions), tip: [['Submissions', fInt(r.submissions)]] })); subLabel = 'By region'; }
    out.push(h('div', { class: 'nx-row k' },
      kpi(c, { label: 'Total records', field: 'records', fmt: 'int', sub: '2024 vs 2023', chip: dchip(c.Y, (r) => Number(r.records), true), spark: yrows(c.Y, (r) => Number(r.records), fInt, 'Records'), sparkSrc: c.level === 'district' ? 'district_years' : 'scope_years' }),
      kpi(c, { label: 'Submissions', field: 'submissions', fmt: 'int', sub: subLabel, spark: subSpark, sparkSrc: c.level === 'district' ? 'submissions' : c.src }),
      kpi(c, { label: '% of expected records', field: 'pct_of_expected', fmt: 'pct', sub: '2024 vs 2023', chip: dchip(c.Y, pctExp, true, 'pts'), spark: yrows(c.Y, pctExp, (v) => f1(v) + '%', '% of expected'), sparkSrc: c.level === 'district' ? 'district_years' : 'scope_years' }),
      kpi(c, { label: 'Overall completion', field: 'comp', fmt: 'pct', sub: 'Average over 15 indicators', chip: statusChip(Number(c.row[c.compField])), spark: c.I.map((a) => ({ label: a.area, value: a.coverage, tip: [['Completion', f0(a.coverage) + '%']] })), sparkSrc: c.level === 'district' ? 'district_areas' : 'scope_inds' })));
    // main chart + donut
    const seg = h('div', { class: 'nx-seg' }, ['records', 'pct'].map((m) => h('button', { type: 'button', class: ovMetric === m ? 'on' : '', onclick: () => { ovMetric = m; render(); } }, m === 'records' ? 'Records' : '% of expected')));
    const big = chartBox(c.level === 'district' ? 'district_years' : 'scope_years'); later(() => areaChart(big, ovMetric === 'records' ? yrows(c.Y, (r) => Number(r.records), fInt, 'Records') : yrows(c.Y, pctExp, (v) => f1(v) + '%', '% of expected'), { fmt: ovMetric === 'records' ? (v) => fInt(Math.round(v)) : (v) => f1(v) + '%', axis: ovMetric === 'records' ? undefined : (v) => f0(v) + '%', name: ovMetric === 'records' ? 'Records' : '% of expected' }));
    const dbox = h('div', { class: 'nx-donut', 'data-source': c.level === 'district' ? 'district_areas' : 'scope_totals' }); let parts, ctop, csub, dnote;
    if (c.level === 'district') { const a = c.I.filter((x) => x.coverage >= 80).length, b = c.I.filter((x) => x.coverage >= 50 && x.coverage < 80).length, d = c.I.length - a - b; parts = [{ label: 'At least 80%', value: a, color: NAVY, text: a + ' indicators' }, { label: '50-79%', value: b, color: MID, text: b + ' indicators' }, { label: 'Below 50%', value: d, color: LITE, text: d + ' indicators' }]; ctop = String(a); csub = 'of 15 at 80%+'; dnote = 'Indicators by completion band.'; }
    else { const r = c.row; parts = [{ label: 'At least 80%', value: Number(r.b80), color: NAVY, text: fInt(r.b80) + ' districts' }, { label: '50-79%', value: Number(r.b50), color: MID, text: fInt(r.b50) + ' districts' }, { label: 'Below 50%', value: Number(r.b0), color: LITE, text: fInt(r.b0) + ' districts' }]; ctop = String(r.b80); csub = 'districts at 80%+'; dnote = 'Districts by overall completion band.'; }
    later(() => donut(dbox, parts, ctop, csub));
    out.push(h('div', { class: 'nx-split' }, card(ovMetric === 'records' ? 'Records over time' : 'Share of expected records over time', 'Reporting years 2015–2025; the latest year may still be incomplete.', big, seg), card('Completion bands', dnote, h('div', null, dbox, legend(parts)))));
    if (c.level !== 'district') {
      const F = (label, key, text, page, chipEl) => { const n = mark(h('div', { class: 'n' }, '—'), c.src, key, c.where); n.textContent = FMT.pct(c.row[key]); return h('button', { type: 'button', class: 'nx-card nx-find', onclick: () => go({ page }) }, h('div', { class: 'l' }, h('span', null, label), chipEl), n, h('div', { class: 's' }, text)); };
      out.push(h('div', { class: 'nx-row k' }, F('Completeness', 'pct_of_expected', 'of the expected records were submitted', 'completeness', statusChip(Number(c.row.avg_completion))), F('Uniqueness', 'repeat_rate', 'of records repeat a cell already reported', 'uniqueness', chip('Not a major issue', 'green')),
        F('Validity', 'invalid_rate', 'of records fail a validity rule', 'validity', chip('Review', 'amber')), F('Accuracy', 'outlier_rate', 'of records are possible outliers to verify', 'accuracy', chip('Verify', 'purple'))));
      const cols = [{ k: 'district', label: 'District', field: 'district', r: (d) => h('b', null, d.district) }, { k: 'region', label: 'Region', field: 'region', hide: true }, { k: 'records', label: 'Records', field: 'records', num: true, r: (d) => fInt(d.records) }, { k: 'submissions', label: 'Submissions', field: 'submissions', num: true, r: (d) => fInt(d.submissions) },
        { k: 'overall_completion', label: 'Completion', field: 'overall_completion', r: (d) => pbar(Number(d.overall_completion), 100) }, { k: 'status', label: 'Status', sort: false, r: (d) => statusChip(Number(d.overall_completion)) }];
      out.push(card(c.level === 'region' ? 'Districts in ' + c.s.region : 'All districts', 'Records and submissions for each district. Click a district to open it.', table('ov-d', cols, c.inScope.map((d) => Object.assign({}, d, { overall_completion: Number(d.overall_completion), records: Number(d.records), submissions: Number(d.submissions) })), { sort: 'records', dir: -1, onRow: openDistrict, source: 'districts', keyCols: 'district', key: (d) => enc(d.district) })));
    } else {
      out.push(h('h2', { class: 'nx-sec' }, 'All indicators: data available'));
      const host = h('div', { class: 'nx-ind', 'data-source': 'district_indicator_years district_areas' }); const iy = data('district_indicator_years').filter((r) => r.district === c.s.district);
      AREAS.forEach((a) => indicatorCard(host, a, c.I.find((r) => r.area === a), new Map(iy.filter((r) => r.area === a).map((r) => [Number(r.year), Number(r.records)])))); out.push(host);
      const subs = data('submissions').filter((r) => r.district === c.s.district);
      out.push(card('Submissions', 'Each submission with its records. Records with no matched submission time are listed as “No matched time”.', table('subs', [{ k: 'submitted', label: 'Submitted', field: 'submitted', r: (r) => (r.submitted === 'No timestamp' ? 'No matched time' : r.submitted) }, { k: 'template', label: 'Template', field: 'template' }, { k: 'workbooks', label: 'Workbooks', field: 'workbooks', num: true, hide: true, r: (r) => fInt(r.workbooks) }, { k: 'records', label: 'Records', field: 'records', num: true, r: (r) => fInt(r.records) }], subs.map((r) => Object.assign({}, r, { records: Number(r.records), workbooks: Number(r.workbooks) })), { sort: 'submitted', dir: -1, source: 'submissions', keyCols: 'district,submitted', key: (r) => enc(r.district) + ',' + enc(r.submitted) })));
      if (ranksRow) out.push(h('div', { class: 'nx-callout' }, h('b', null, c.s.district), ' ranks ', h('b', { 'data-source': 'ranks', 'data-field': 'national_rank', 'data-where': 'district=' + enc(c.s.district) }, '#' + ranksRow.national_rank), ' of ' + ranksRow.national_n + ' districts nationally and ', h('b', null, '#' + ranksRow.region_rank), ' of ' + ranksRow.region_n + ' in ' + c.s.region + ' by overall completion.'));
    }
    return out;
  }
  function pageCompleteness(c) {
    const out = [], ranksRow = data('ranks').find((r) => r.district === c.s.district), nat = c.I;
    const k = [];
    if (c.level === 'district') {
      k.push(kpi(c, { label: '% of expected records', field: 'pct_of_expected', fmt: 'pct', sub: '2024 vs 2023', chip: dchip(c.Y, pctExp, true, 'pts'), spark: yrows(c.Y, pctExp, (v) => f1(v) + '%', '% of expected'), sparkSrc: 'district_years' }));
      k.push(kpi(c, { label: 'Overall completion', field: 'comp', fmt: 'pct', sub: 'Average over 15 indicators', chip: statusChip(Number(c.row[c.compField])) }));
      const rk = h('div', { class: 'n', 'data-source': 'ranks', 'data-field': 'national_rank', 'data-where': 'district=' + enc(c.s.district) }, ranksRow ? '#' + ranksRow.national_rank : '—'); k.push(h('div', { class: 'nx-card nx-kpi' }, h('div', { class: 'l' }, h('span', null, 'National rank')), h('div', null, rk, h('div', { class: 's' }, ranksRow ? `of ${ranksRow.national_n} · #${ranksRow.region_rank} of ${ranksRow.region_n} in ${c.s.region}` : ''))));
      const n80 = nat.filter((a) => a.coverage >= 80).length; k.push(h('div', { class: 'nx-card nx-kpi' }, h('div', { class: 'l' }, h('span', null, 'Indicators at least 80% complete')), h('div', null, h('div', { class: 'n' }, n80 + ' of 15'), h('div', { class: 's' }, 'Completion band, as in the district factsheet'))));
    } else {
      k.push(kpi(c, { label: 'Records submitted', field: 'records', fmt: 'int', sub: '2024 vs 2023', chip: dchip(c.Y, (r) => Number(r.records), true), spark: yrows(c.Y, (r) => Number(r.records), fInt, 'Records'), sparkSrc: 'scope_years' }));
      k.push(kpi(c, { label: 'Expected records', field: 'expected', fmt: 'int', sub: 'Under the reporting template' }));
      k.push(kpi(c, { label: '% of expected records', field: 'pct_of_expected', fmt: 'pct', sub: '2024 vs 2023', chip: dchip(c.Y, pctExp, true, 'pts'), spark: yrows(c.Y, pctExp, (v) => f1(v) + '%', '% of expected'), sparkSrc: 'scope_years' }));
      k.push(kpi(c, { label: 'Overall completion', field: 'comp', fmt: 'pct', sub: 'Average over 15 indicators', chip: statusChip(Number(c.row[c.compField])) }));
    }
    out.push(h('div', { class: 'nx-row k' }, k));
    const big = chartBox(c.level === 'district' ? 'district_years' : 'scope_years'); later(() => areaChart(big, yrows(c.Y, pctExp, (v) => f1(v) + '%', '% of expected'), { fmt: (v) => f1(v) + '%', axis: (v) => f0(v) + '%', name: '% of expected' }));
    let side;
    if (c.level === 'district') side = card('Factsheet summary', 'Generated as in the district report.', h('div', null, h('div', { class: 'nx-callout' }, sentence(nat)), h('p', { class: 'nx-note', style: 'margin-top:.8rem' }, 'Completion colour bands'), h('div', { class: 'nx-bands' }, [['0-20%', '#F8696B'], ['20-40%', '#F4A15B'], ['40-60%', '#FFD24D'], ['60-80%', '#A9D08E'], ['80-100%', '#63BE7B']].map(([t, col]) => h('span', { style: 'background:' + col }, t)))));
    else { const bx = chartBox('scope_totals', 'click'); later(() => tiles(bx, c.ST.filter((r) => r.region !== 'All regions'), 'avg_completion', c.s.region, (v) => f1(v) + '%')); side = card('Regions by completion', c.level === 'region' ? 'This region is outlined. Click another to switch.' : 'Average completion of each region’s districts. Click a region.', bx); }
    out.push(h('div', { class: 'nx-split' }, card('Completeness over time', 'Records as a share of the records expected, by reporting year. The latest year may still be incomplete.', big), side));
    if (c.level === 'district') {
      const cols = [{ k: 'area', label: 'Indicator', field: 'area', r: (r) => h('b', null, r.area) }, { k: 'coverage', label: '% complete', field: 'coverage_pct', num: true, cls: () => 'band', bg: (r) => bandColor(r.coverage), r: (r) => f1(r.coverage) + '%' }, { k: 'missing_years', label: 'Missing years', field: 'missing_years', sort: false, r: (r) => r.missing_years || '—' },
        { k: 'conflicts', label: 'Conflicting figures', field: 'conflicts', num: true, cls: (r) => (Number(r.conflicts) ? 'warn' : ''), r: (r) => (Number(r.conflicts) ? fInt(r.conflicts) : '—') }, { k: 'future_years', label: '2026-2030 data found', field: 'future_years', sort: false, hide: true, r: (r) => r.future_years || '—' }];
      out.push(card('Completion by indicator', 'Share of 2015–2025 with at least one reported value (SDGs Budget from 2019). “—” means no years missing, no conflicting figures, or none found.', table('fact', cols, c.I.map((r) => Object.assign({}, r, { conflicts: Number(r.conflicts) })), { sort: 'area', dir: 1, source: 'district_areas', keyCols: 'district,area', key: (r) => enc(r.district) + ',' + enc(r.area) })));
    } else {
      const rows = c.I.map((a) => ({ label: a.area, value: a.coverage, text: f0(a.coverage) + '%', color: bandColor(a.coverage), tip: [['Completion', f1(a.coverage) + '%'], ['Records', fInt(a.records)], ['Conflicting figures', fInt(a.conflicts)]] })); const bx = chartBox('scope_inds'); later(() => barsH(bx, rows, { max: 100, tick: (v) => v + '%' }));
      out.push(card('Completion by indicator', 'Average across districts of the share of years with a reported value, coloured by band.', bx));
      const ranks = data('ranks').filter((r) => !c.s.region || r.region === c.s.region);
      const mk = (title, note, list) => card(title, note, table('rk-' + title, [{ k: 'district', label: 'District', r: (d) => h('b', null, d.district) }, { k: 'region', label: 'Region', hide: true }, { k: 'overall_completion', label: 'Completion', r: (d) => pbar(d.overall_completion, 100, bandColor(d.overall_completion)) }, { k: 'national_rank', label: 'Rank', num: true, r: (d) => '#' + d.national_rank }], list, { sort: 'overall_completion', dir: title.startsWith('Where') ? 1 : -1, limit: c.level === 'region' ? 6 : 5, onRow: openDistrict }));
      out.push(h('div', { class: 'nx-row' }, mk('Where to follow up first', 'Lowest overall completion' + (c.s.region ? ' in ' + c.s.region : '') + '. Click to open.', ranks), mk('Best reporting', 'Highest overall completion' + (c.s.region ? ' in ' + c.s.region : '') + '. Click to open.', ranks)));
    }
    return out;
  }
  const QCFG = {
    uniqueness: { title: 'Uniqueness', key: 'repeats', rate: 'repeat_rate', count: 'Repeat submissions', rateLabel: 'Repeat rate', q: 'Were any records submitted more than once?', rule: 'A record is a repeat when the same district, indicator, variable, disaggregation and year was reported in more than one submission. Repeats are counted once in the completeness figures, and the most recent value is the one kept.' },
    validity: { title: 'Validity', key: 'invalid', rate: 'invalid_rate', count: 'Invalid records', rateLabel: 'Invalid rate', q: 'Did reported values meet the required rules and acceptable ranges?', rule: 'Two rules were applied: a percentage above 100, and a small value (1 or 2) in a count field where such a value was not expected. These records may reflect entry errors or the use of codes in place of values and need review.' },
    accuracy: { title: 'Accuracy', key: 'outliers', rate: 'outlier_rate', count: 'Possible outliers', rateLabel: 'Outlier rate', q: 'Were there unusual values that need further verification?', rule: 'A value is flagged when it lies far outside the usual range for the same indicator, variable and disaggregation. A flag is not a finding of error: large districts can legitimately report large values, so flagged values should be verified, not assumed wrong.' }
  };
  function pageQuality(c, kind) {
    const cfg = QCFG[kind], out = [], r = (x) => rateOf(cfg.key)(x), key = cfg.key;
    const k = [kpi(c, { label: 'Records submitted', field: 'records', fmt: 'int', sub: 'Records assessed' }), kpi(c, { label: cfg.count, field: key, fmt: 'int', sub: 'All years' })];
    k.push(kpi(c, { label: cfg.rateLabel, field: cfg.rate, fmt: 'pct2', sub: '2024 vs 2023', chip: dchip(c.Y, r, false, 'pts'), spark: yrows(c.Y, r, (v) => f2(v) + '%', cfg.rateLabel), sparkSrc: c.level === 'district' ? 'district_years' : 'scope_years' }));
    if (kind === 'uniqueness') k.push(kpi(c, { label: 'Conflicting figures', field: 'conflicts', fmt: 'int', sub: 'Cells reported with different values' }));
    else if (kind === 'validity') k.push(h('div', { class: 'nx-card nx-kpi' }, h('div', { class: 'l' }, h('span', null, 'Small values / percentages above 100')), h('div', null, h('div', { class: 'n' }, fInt(c.row.invalid_small) + ' / ' + fInt(c.row.invalid_pct)), h('div', { class: 's' }, 'By type of failed rule'))));
    else { const top = c.I.slice().sort((a, b) => r(b) - r(a))[0]; const y15 = c.Y.find((q) => q.year === 2015), y25 = c.Y.find((q) => q.year === 2025); k.push(h('div', { class: 'nx-card nx-kpi' }, h('div', { class: 'l' }, h('span', null, 'Highest-rate indicator'), top ? chip(f1(r(top)) + '%', 'purple') : null), h('div', null, h('div', { class: 'n', style: 'font-size:1.1rem' }, top ? top.area : '—'), h('div', { class: 's' }, y15 && y25 ? `Rate ${f1(r(y15))}% in 2015, ${f1(r(y25))}% in 2025` : '')))); }
    out.push(h('div', { class: 'nx-row k' }, k));
    const big = chartBox(c.level === 'district' ? 'district_years' : 'scope_years'); later(() => areaChart(big, yrows(c.Y, r, (v) => f2(v) + '%', cfg.rateLabel), { fmt: (v) => f2(v) + '%', axis: (v) => f1(v) + '%', name: cfg.rateLabel }));
    let parts, ctop, csub; const R = c.row;
    if (kind === 'uniqueness') { parts = [{ label: 'Unique records', value: Number(R.records) - Number(R.repeats), color: NAVY, text: fInt(Number(R.records) - Number(R.repeats)) }, { label: 'Repeat submissions', value: Number(R.repeats), color: AMB, text: fInt(R.repeats) }]; ctop = f1(100 - Number(R.repeat_rate)) + '%'; csub = 'unique'; }
    else if (kind === 'validity') { parts = [{ label: 'Valid records', value: Number(R.records) - Number(R.invalid), color: NAVY, text: fInt(Number(R.records) - Number(R.invalid)) }, { label: 'Small values (1 or 2)', value: Number(R.invalid_small), color: AMB, text: fInt(R.invalid_small) }, { label: 'Percentage above 100', value: Number(R.invalid_pct), color: RED, text: fInt(R.invalid_pct) }]; ctop = f1(100 - Number(R.invalid_rate)) + '%'; csub = 'valid'; }
    else { parts = [{ label: 'Not flagged', value: Number(R.records) - Number(R.outliers), color: NAVY, text: fInt(Number(R.records) - Number(R.outliers)) }, { label: 'Possible outliers', value: Number(R.outliers), color: '#8b6bd1', text: fInt(R.outliers) }]; ctop = f1(100 - Number(R.outlier_rate)) + '%'; csub = 'not flagged'; }
    const dbox = h('div', { class: 'nx-donut', 'data-source': c.src }); later(() => donut(dbox, parts, ctop, csub));
    out.push(h('div', { class: 'nx-split' }, card(cfg.rateLabel + ' over time', 'Share of records, by reporting year. The latest year may still be incomplete.', big), card('Records by outcome', cfg.q, h('div', null, dbox, legend(parts)))));
    // by indicator and by region/district
    const irows = c.I.map((a) => ({ label: a.area, value: r(a), text: f2(r(a)) + '%', tip: [[cfg.rateLabel, f2(r(a)) + '%'], [cfg.count, fInt(a[key])], ['Records', fInt(a.records)]] })).sort((a, b) => b.value - a.value);
    const ibx = chartBox(c.level === 'district' ? 'district_areas' : 'scope_inds'); later(() => barsH(ibx, irows, { max: Math.max(d3.max(irows, (q) => q.value) || 1, 0.1) * 1.05, tick: (v) => f1(v) + '%' }));
    let second;
    if (c.level === 'national') { const rg = c.ST.filter((x) => x.region !== 'All regions').map((x) => ({ label: x.region, value: Number(x[cfg.rate]), text: f2(x[cfg.rate]) + '%', click: () => go({ region: x.region, district: null }), tip: [[cfg.rateLabel, f2(x[cfg.rate]) + '%'], [cfg.count, fInt(x[key])], ['Districts', fInt(x.districts)]] })).sort((a, b) => b.value - a.value); const bx = chartBox('scope_totals', 'click'); later(() => barsH(bx, rg, { max: (d3.max(rg, (q) => q.value) || 1) * 1.05, tick: (v) => f1(v) + '%' })); second = card(cfg.rateLabel + ' by region', 'Click a region to open it.', bx); }
    else if (c.level === 'region') { const dr = c.inScope.map((x) => ({ label: x.district, value: Number(x[cfg.rate]), text: f2(x[cfg.rate]) + '%', click: () => openDistrict(x), tip: [[cfg.rateLabel, f2(x[cfg.rate]) + '%'], [cfg.count, fInt(x[key])], ['Records', fInt(x.records)]] })).sort((a, b) => b.value - a.value).slice(0, 12); const bx = chartBox('districts', 'click'); later(() => barsH(bx, dr, { max: (d3.max(dr, (q) => q.value) || 1) * 1.05, tick: (v) => f1(v) + '%' })); second = card(cfg.rateLabel + ' by district', 'Highest rates first. Click a district to open it.', bx); }
    else { second = card('Indicator detail', kind === 'uniqueness' ? 'Repeat submissions and conflicting figures for each indicator.' : 'Records and flagged records for each indicator.', table('qd-' + kind, [{ k: 'area', label: 'Indicator', r: (q) => h('b', null, q.area) }, { k: 'records', label: 'Records', num: true, r: (q) => fInt(q.records) }, { k: key, label: cfg.count, num: true, r: (q) => fInt(q[key]) }, kind === 'uniqueness' ? { k: 'conflicts', label: 'Conflicting', num: true, r: (q) => fInt(q.conflicts) } : { k: 'rate', label: 'Rate', num: true, v: (q) => r(q), r: (q) => f2(r(q)) + '%' }], c.I.map((q) => Object.assign({}, q, { records: Number(q.records), [key]: Number(q[key]), conflicts: Number(q.conflicts) })), { sort: key, dir: -1, source: 'district_areas', keyCols: 'district,area', key: (q) => enc(q.district) + ',' + enc(q.area) })); }
    out.push(h('div', { class: 'nx-row' }, card(cfg.rateLabel + ' by indicator', 'Highest rates first.', ibx), second));
    if (c.level !== 'district') out.push(card('Districts with the highest ' + cfg.rateLabel.toLowerCase(), 'Click a district to open it.', table('top-' + kind, [{ k: 'district', label: 'District', field: 'district', r: (d) => h('b', null, d.district) }, { k: 'region', label: 'Region', field: 'region', hide: true }, { k: 'records', label: 'Records', field: 'records', num: true, hide: true, r: (d) => fInt(d.records) }, { k: key, label: cfg.count, field: key, num: true, r: (d) => fInt(d[key]) }, { k: cfg.rate, label: cfg.rateLabel, field: cfg.rate, r: (d) => pbar(Number(d[cfg.rate]), Math.max(...c.inScope.map((x) => Number(x[cfg.rate]))) || 1, '#8b6bd1') }], c.inScope.map((d) => Object.assign({}, d, { records: Number(d.records), [key]: Number(d[key]), [cfg.rate]: Number(d[cfg.rate]) })), { sort: cfg.rate, dir: -1, limit: 10, onRow: openDistrict, source: 'districts', keyCols: 'district', key: (d) => enc(d.district) })));
    out.push(card('How this is assessed', cfg.q, h('p', { class: 'nx-note', style: 'font-size:.8125rem;margin:0;color:#3b4558;line-height:1.6' }, cfg.rule)));
    return out;
  }
  function pageMethod() {
    return [card('About this dashboard', null, h('div', { class: 'nx-text' }, h('p', null, 'This dashboard brings together two products: the MMDA administrative data quality assessment report and the district completion factsheets. It covers administrative data reported by all Metropolitan, Municipal and District Assemblies for 2015–2025, and every page responds to the region and district filters.'),
      h('h4', null, 'The four dimensions'), h('ul', null, h('li', null, h('b', null, 'Completeness: '), 'were all expected data points submitted?'), h('li', null, h('b', null, 'Uniqueness: '), 'were any records submitted more than once?'), h('li', null, h('b', null, 'Validity: '), 'did reported values meet the required rules and acceptable ranges?'), h('li', null, h('b', null, 'Accuracy: '), 'were there unusual values that need further verification?')),
      h('h4', null, 'How completion is scored'), h('p', null, 'Completion is scored for each of the 15 indicators (thematic areas) as the share of 2015–2025 with at least one reported value for the district, across all of its submissions. SDGs Budget is scored over 2019–2025 because its template starts in 2019. A district’s overall completion is the average of its 15 indicator scores.'),
      h('p', null, 'The percentage of expected records compares the records submitted with the records expected under the reporting template for the same years.'),
      h('h4', null, 'Completion bands'), h('div', { class: 'nx-bands' }, [['0-20%', '#F8696B'], ['20-40%', '#F4A15B'], ['40-60%', '#FFD24D'], ['60-80%', '#A9D08E'], ['80-100%', '#63BE7B']].map(([t, col]) => h('span', { style: 'background:' + col }, t))),
      h('p', null, 'Status labels follow the factsheet summary: Strong is at least 80%, Moderate is 50–79% and Low is below 50%.'),
      h('h4', null, 'Other terms'), h('ul', null, h('li', null, h('b', null, 'Submission: '), 'a distinct submission time attached to a district’s workbooks. Records with no matched submission time are not counted as a submission.'), h('li', null, h('b', null, 'Conflicting figures: '), 'data points where repeated submissions reported different values for the same indicator and year. This is informational and does not change completion.'), h('li', null, h('b', null, '2026–2030 data found: '), 'values already entered in future planning years. They are excluded from the completion score.'))))
      , card('What the findings mean', null, h('div', { class: 'nx-text' }, h('p', null, 'Missing data is the main challenge: well under half of the expected records were submitted, so many MMDAs may lack the information needed to understand local conditions, plan services and make informed decisions. Repeated records were not a significant problem. Some submitted values fail validity rules, and some values are unusual enough to need verification. Flagged values are not automatically errors.'))),
      card('Priorities for action', null, h('div', { class: 'nx-text' }, h('ul', null, h('li', null, h('b', null, 'Start where the data is generated. '), 'MMDAs and their decentralised departments should assign clear responsibility for administrative data and run regular reviews and quality checks before submission.'), h('li', null, h('b', null, 'Strengthen oversight. '), 'Regional and national institutions should reinforce accountability for reporting.'), h('li', null, h('b', null, 'Automate and standardise. '), 'Ghana Statistical Service should introduce automated validation, keep indicator definitions and reporting guidance consistent, and set up feedback and correction mechanisms.'), h('li', null, h('b', null, 'Target support. '), 'Direct technical support to the districts and indicators with the largest gaps, and keep assessing quality periodically.'), h('li', null, h('b', null, 'Modernise. '), 'Development partners can support progressive modernisation and integration of administrative data systems.')))),
      card('Limitations', null, h('div', { class: 'nx-text' }, h('p', null, 'Decentralised departments mainly collect data for day-to-day operations rather than statistics, so the checks here point to potential problems rather than prove errors. MMDAs may also use different methods to collect and report data. Comparability and coherence across districts and indicators were not assessed.')))];
  }

  // ---------- navigation and filters
  const selR = $('.nx-region'), selD = $('.nx-district');
  selR.addEventListener('change', () => go({ region: selR.value || null, district: null }));
  selD.addEventListener('change', () => { if (!selD.value) { go({ district: null }); return; } const d = data('districts').find((x) => x.district === selD.value); go({ region: d ? d.region : sel().region, district: selD.value }); });
  $('.nx-filters .reset').addEventListener('click', () => { go({ region: null, district: null }); });
  $$('#nx-nav button').forEach((b) => b.addEventListener('click', () => go({ page: b.dataset.page })));
  $('#nx-q').addEventListener('change', (e) => { const v = e.target.value.trim(), d = data('districts').find((x) => x.district.toLowerCase() === v.toLowerCase()); if (d) { e.target.value = ''; go({ region: d.region, district: d.district }); } });
  function buildSelects(D, s) {
    const key = s.region + '|' + s.district + '|' + D.length; if (key === optKey) return; optKey = key;
    const regions = Array.from(new Set(D.map((d) => d.region))).sort(); selR.replaceChildren(new Option('All regions', ''), ...regions.map((r) => new Option(r, r))); selR.value = s.region || '';
    const ds = D.filter((d) => !s.region || d.region === s.region).sort((a, b) => a.district.localeCompare(b.district)); selD.replaceChildren(new Option(s.region ? 'All districts in ' + s.region : 'All districts', ''), ...ds.map((d) => new Option(d.district, d.district))); selD.value = s.district || '';
    $('#nx-dlist').replaceChildren(...D.map((d) => new Option(d.district)));
  }
  function render() {
    const st = SOURCES.map((id) => dash.data(id).status);
    if (!st.every((x) => x === 'ok')) { const bad = st.find((x) => x !== 'ok'); pageBox.replaceChildren(h('div', { class: 'nx-card' }, h('div', { class: 'nx-fail' }, h('i'), bad === 'loading' ? 'Loading' : 'Failed to load'))); return; }
    const c = ctx(), s = c.s; buildSelects(c.D, s); post = [];
    const ft = $('.nx-foot-n'); if (ft) ft.textContent = FMT.int(c.ST.find((r) => r.region === 'All regions').records);
    $$('#nx-nav button').forEach((b) => b.classList.toggle('on', b.dataset.page === s.page));
    const crumb = $('#nx-crumb'); crumb.replaceChildren(); if (c.level !== 'national') { crumb.append(h('button', { type: 'button', onclick: () => go({ region: null, district: null }) }, 'National')); if (c.level === 'district') crumb.append(' / ', h('button', { type: 'button', onclick: () => go({ district: null }) }, s.region)); crumb.append(' / ' + (c.level === 'district' ? s.district : s.region)); } else crumb.append('National');
    $('#nx-title').textContent = (PAGES[s.page] || 'Dashboard') + (s.page === 'method' ? '' : c.level === 'national' ? '' : ': ' + (c.level === 'district' ? s.district : s.region + ' region'));
    let nodes; try { nodes = s.page === 'method' ? pageMethod() : s.page === 'completeness' ? pageCompleteness(c) : QCFG[s.page] ? pageQuality(c, s.page) : pageOverview(c); } catch (e) { nodes = [h('div', { class: 'nx-card' }, h('div', { class: 'nx-fail' }, h('i'), 'Failed to load'))]; throw e; }
    pageBox.replaceChildren(...nodes); post.forEach((fn) => fn());
  }
  dash.onData(render);
})();
