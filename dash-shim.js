/* A small data layer so the dashboard runs as a plain static site.
   - dash.data(id)    -> {status, data}      (files in data/data.js, or a calculation)
   - dash.calc(id, {inputs, fn})             a value worked out from other sources
   - dash.onData(fn)  -> runs now, and again on resize or when the selection changes
   - dash.params / setParams / resetParams   the region and district selection, kept in the URL hash
*/
(function () {
  const FILES = window.MMDA_DATA || {};
  const calcs = {}, memo = {}, listeners = [];
  let params = {};
  const read = () => { const q = new URLSearchParams(location.hash.slice(1)); params = {}; q.forEach((v, k) => { if (v) params[k] = v; }); };
  const write = () => { const q = new URLSearchParams(); for (const [k, v] of Object.entries(params)) if (v) q.set(k, v); const h = q.toString(); history.pushState(null, '', h ? '#' + h : location.pathname + location.search); };
  const notify = () => listeners.forEach((fn) => fn());
  read();
  window.dash = {
    colors: ['#2f7ec9', '#e07b39', '#3a9d6b', '#8b6bd1', '#c94f7c', '#b8962e', '#4aa3b5', '#7a8794'],
    calc(id, spec) { calcs[id] = spec; },
    data(id) {
      if (FILES[id]) return { status: 'ok', data: FILES[id] };
      const c = calcs[id];
      if (!c) return { status: 'missing', data: [] };
      if (!(id in memo)) memo[id] = c.fn(...c.inputs.map((i) => dash.data(i).data));
      return { status: 'ok', data: memo[id] };
    },
    onData(fn) { listeners.push(fn); fn(); },
    params: () => Object.assign({}, params),
    setParams(p) { Object.assign(params, p); for (const k of Object.keys(params)) if (params[k] == null || params[k] === '') delete params[k]; write(); notify(); },
    resetParams() { params = {}; write(); notify(); },
    setLink() {}
  };
  window.addEventListener('popstate', () => { read(); notify(); });
  let raf = 0;
  new ResizeObserver(() => { cancelAnimationFrame(raf); raf = requestAnimationFrame(notify); }).observe(document.body);
})();
