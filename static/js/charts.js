/* #_4root CTI — Apache ECharts: tema oficial dark/neon + builders interativos.
   v7: instâncias persistentes (getOrMake) — gráficos NUNCA são destruídos ao
   aplicar filtros; updates via setOption + resize. */
(function () {
  'use strict';

  const SEV_COLORS = {
    CRITICAL: '#ff0040',
    HIGH: '#f0b232',
    MEDIUM: '#fde047',
    LOW: '#00e5ff',
    NONE: '#8a8a8a',
  };
  const NEON = '#00ff41';
  const RED = '#ff2b4e';
  const MUTED = '#9aa39a';
  const LINE = '#1c1f1c';
  const FONT_MONO = "'JetBrains Mono', monospace";
  const FONT_SORA = "'Sora', sans-serif";

  const instances = [];
  const registry = {};   // id -> chart
  let resizeTimer = 0;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => instances.forEach(c => c && c.resize()), 160);
  });

  const baseAxis = {
    axisLine: { lineStyle: { color: LINE } },
    axisTick: { show: false },
    axisLabel: { color: MUTED, fontSize: 10, fontFamily: FONT_MONO },
    splitLine: { lineStyle: { color: 'rgba(31,31,31,.55)' } },
  };

  const baseTooltip = {
    backgroundColor: 'rgba(10,12,10,.96)',
    borderColor: 'rgba(0,255,65,.3)',
    borderWidth: 1,
    textStyle: { color: '#ededed', fontSize: 11, fontFamily: FONT_MONO },
    extraCssText: 'box-shadow:0 10px 30px rgba(0,0,0,.6);border-radius:3px;',
  };

  /* instância persistente: cria 1x, reutiliza sempre (bug "chart some" morto) */
  function getOrMake(id) {
    const el = document.getElementById(id);
    if (!el) return null;
    if (registry[id] && !registry[id].isDisposed()) {
      if (el.clientWidth && el.clientWidth !== registry[id].getWidth()) {
        registry[id].resize({ width: el.clientWidth });
      }
      return registry[id];
    }
    const sk = el.querySelector('.sk-block');
    if (sk) sk.remove();
    const c = echarts.init(el, null, { renderer: 'canvas' });
    instances.push(c);
    registry[id] = c;
    return c;
  }

  function fmtDate(t, gran) {
    if (!t) return '';
    if (gran === '%Y-%m') {
      const [y, m] = t.split('-');
      const meses = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
      return `${meses[(+m) - 1]}/${y.slice(2)}`;
    }
    if (gran === '%Y-%W') {
      const [y, w] = t.split('-');
      return `sem ${w} · ${y.slice(2)}`;
    }
    const [y, m, d] = t.split('-');
    return `${d}/${m}`;
  }

  const CH = {};

  /* timeline empilhada por severidade (dashboard) */
  CH.timeline = (id, timeline, gran) => {
    const c = getOrMake(id);
    if (!c) return;
    const x = timeline.map(r => fmtDate(r.t, gran));
    const series = [
      { name: 'críticas', key: 'crit', color: SEV_COLORS.CRITICAL },
      { name: 'altas', key: 'high', color: SEV_COLORS.HIGH },
      { name: 'médias', key: 'med', color: SEV_COLORS.MEDIUM },
      { name: 'baixas', key: 'low', color: SEV_COLORS.LOW },
    ];
    c.setOption({
      animationDuration: 600,
      tooltip: Object.assign({}, baseTooltip, { trigger: 'axis', axisPointer: { type: 'line', lineStyle: { color: 'rgba(0,255,65,.35)' } } }),
      legend: {
        top: 0, right: 0, icon: 'rect', itemWidth: 9, itemHeight: 9,
        textStyle: { color: MUTED, fontSize: 10, fontFamily: FONT_MONO },
        inactiveColor: '#3a3f3a',
      },
      grid: { left: 44, right: 14, top: 28, bottom: 42 },
      xAxis: Object.assign({}, baseAxis, { type: 'category', data: x, boundaryGap: false, splitLine: { show: false } }),
      yAxis: Object.assign({}, baseAxis, { type: 'value' }),
      dataZoom: [
        { type: 'inside' },
        { type: 'slider', height: 16, bottom: 6, borderColor: LINE, backgroundColor: 'rgba(10,10,10,.5)',
          fillerColor: 'rgba(0,255,65,.12)', handleStyle: { color: NEON }, textStyle: { color: MUTED, fontSize: 9 } },
      ],
      series: series.map(s => ({
        name: s.name, type: 'line', stack: 'total', smooth: false, symbol: 'none',
        color: s.color,
        lineStyle: { width: 1, color: s.color },
        areaStyle: { color: s.color, opacity: 0.18 },
        emphasis: { focus: 'series' },
        data: timeline.map(r => r[s.key] || 0),
      })),
    });
  };

  /* donut severidade */
  CH.sevDonut = (id, bySev, onClick) => {
    const c = getOrMake(id);
    if (!c) return;
    const order = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'NONE'];
    const labels = { CRITICAL: 'críticas', HIGH: 'altas', MEDIUM: 'médias', LOW: 'baixas', NONE: 'sem score' };
    const data = order.filter(s => bySev[s] > 0)
      .map(s => ({ name: labels[s], value: bySev[s], sev: s,
        itemStyle: { color: SEV_COLORS[s] } }));
    c.setOption({
      animationDuration: 600,
      tooltip: Object.assign({}, baseTooltip, {
        trigger: 'item',
        formatter: p => `${p.marker} ${p.name}<br/><b style="color:${NEON}">${p.value}</b> CVEs (${p.percent}%)`,
      }),
      legend: { show: false },
      series: [{
        type: 'pie', radius: ['52%', '78%'], center: ['50%', '52%'],
        label: { show: false }, labelLine: { show: false },
        itemStyle: { borderColor: '#0a0c0a', borderWidth: 2 },
        emphasis: { scale: true, scaleSize: 6,
          label: { show: true, formatter: '{b}\n{c}', color: '#ededed', fontSize: 11, fontFamily: FONT_MONO } },
        data,
      }],
    }, { notMerge: true });
    if (onClick) c.off('click'); c.on('click', p => p.data.sev && onClick(p.data.sev));
  };

  /* barras horizontais com rolagem (dataZoom slider) — TODOS os produtos/fabricantes */
  CH.hbarsScroll = (id, pairs, opts = {}) => {
    const c = getOrMake(id);
    if (!c) return;
    const data = pairs.slice().reverse();
    const names = data.map(d => {
      const n = d[0];
      return opts.shorten && n.includes('/') ? n.split('/')[1].slice(0, 24) : n.slice(0, 26);
    });
    const visible = opts.visible || 8;
    c.setOption({
      animationDuration: 600,
      tooltip: Object.assign({}, baseTooltip, {
        trigger: 'item',
        formatter: p => {
          const d = data[p.dataIndex] || [];
          let extra = '';
          if (d[2] !== undefined && d[2] !== null) extra = `<br/>dias até exploração (média): <b style="color:${RED}">${d[2]}</b>`;
          return `${p.marker} ${opts.fullName ? opts.fullName(p.dataIndex) : names[p.dataIndex]}<br/><b style="color:${opts.color || NEON}">${p.value}</b> CVEs${extra}`;
        },
      }),
      grid: { left: 8, right: 44, top: 6, bottom: 34, containLabel: true },
      xAxis: Object.assign({}, baseAxis, { type: 'value', splitLine: { show: false }, axisLabel: { show: false } }),
      yAxis: Object.assign({}, baseAxis, { type: 'category', data: names, splitLine: { show: false },
        axisLabel: { color: MUTED, fontSize: 10, fontFamily: FONT_MONO, width: 130, overflow: 'truncate' } }),
      dataZoom: [{
        type: 'slider', yAxisIndex: 0, right: 2, width: 14, top: 8,
        startValue: Math.max(0, data.length - visible), endValue: data.length - 1,
        zoomLock: false, brushSelect: false,
        borderColor: LINE, backgroundColor: 'rgba(20,22,20,.6)',
        fillerColor: 'rgba(0,255,65,.14)', handleStyle: { color: NEON },
        dataBackground: { lineStyle: { color: 'rgba(0,255,65,.25)' }, areaStyle: { color: 'rgba(0,255,65,.08)' } },
        textStyle: { color: MUTED, fontSize: 9 }, showDetail: false,
      }, { type: 'inside', yAxisIndex: 0 }],
      series: [{
        type: 'bar', barWidth: 10,
        data: data.map(d => d[1]),
        itemStyle: { color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
          { offset: 0, color: opts.color ? opts.color + '40' : 'rgba(0,255,65,.25)' },
          { offset: 1, color: opts.color || NEON }]),
          borderRadius: [0, 2, 2, 0] },
        emphasis: { itemStyle: { shadowBlur: 12, shadowColor: opts.color || 'rgba(0,255,65,.5)' } },
        label: { show: true, position: 'right', color: MUTED, fontSize: 9, fontFamily: FONT_MONO },
      }],
    }, { notMerge: true });
    if (opts.onClick) { c.off('click'); c.on('click', p => opts.onClick(opts.fullName ? opts.fullName(p.dataIndex) : data[p.dataIndex][0], p.value)); }
  };

  /* barras horizontais simples (compat) */
  CH.hbars = (id, pairs, opts = {}) => CH.hbarsScroll(id, pairs, Object.assign({ visible: (pairs || []).length || 8 }, opts));

  /* histograma genérico (cvss / dias até exploração) */
  CH.histogram = (id, labels, values, color, onClick, opts = {}) => {
    const c = getOrMake(id);
    if (!c) return;
    const series = [{
      type: 'bar', data: values, barCategoryGap: '18%',
      itemStyle: { color, borderRadius: [2, 2, 0, 0] },
      emphasis: { itemStyle: { shadowBlur: 14, shadowColor: color } },
      label: { show: true, position: 'top', color: MUTED, fontSize: 9, fontFamily: FONT_MONO },
    }];
    c.setOption({
      animationDuration: 600,
      tooltip: Object.assign({}, baseTooltip, { trigger: 'axis',
        formatter: ps => `${ps[0].marker} ${ps[0].axisValue}<br/><b style="color:${color}">${ps[0].value}</b> CVEs` }),
      grid: { left: 44, right: 14, top: 22, bottom: 26 },
      xAxis: Object.assign({}, baseAxis, { type: 'category', data: labels, splitLine: { show: false },
        axisLabel: { color: MUTED, fontSize: 9, fontFamily: FONT_MONO, interval: 0 } }),
      yAxis: Object.assign({}, baseAxis, { type: 'value' }),
      series,
    }, { notMerge: true });
    if (onClick) { c.off('click'); c.on('click', p => onClick(p.dataIndex)); }
  };

  /* donut genérico clicável (vetor de ataque, privilégios, ransomware) */
  CH.donut = (id, pairs, opts = {}) => {
    const c = getOrMake(id);
    if (!c) return;
    const palette = opts.palette ||
      [NEON, '#00e5ff', '#fde047', '#f0b232', RED, '#8a8a8a'];
    const data = (pairs || []).filter(d => d[1] > 0).map((d, i) => ({
      name: d[0], value: d[1], key: d[2] || d[0],
      itemStyle: { color: palette[i % palette.length] },
    }));
    c.setOption({
      animationDuration: 600,
      tooltip: Object.assign({}, baseTooltip, {
        trigger: 'item',
        formatter: p => `${p.marker} ${p.name}<br/><b style="color:${opts.color || NEON}">${p.value}</b> CVEs (${p.percent}%)`,
      }),
      legend: {
        orient: 'vertical', right: 4, top: 'middle', icon: 'rect', itemWidth: 8, itemHeight: 8,
        textStyle: { color: MUTED, fontSize: 10, fontFamily: FONT_MONO },
      },
      series: [{
        type: 'pie', radius: ['46%', '74%'], center: ['38%', '52%'],
        label: { show: false }, labelLine: { show: false },
        itemStyle: { borderColor: '#0a0c0a', borderWidth: 2 },
        emphasis: { scale: true, scaleSize: 5,
          label: { show: true, position: 'center', formatter: '{c}', color: '#ededed', fontSize: 14, fontFamily: FONT_MONO, fontWeight: 700 } },
        data,
      }],
    }, { notMerge: true });
    if (opts.onClick) { c.off('click'); c.on('click', p => opts.onClick(p.data.key, p.value)); }
  };

  /* barras verticais KEV por período */
  CH.kevBars = (id, pairs, gran) => {
    const c = getOrMake(id);
    if (!c) return;
    c.setOption({
      animationDuration: 600,
      tooltip: Object.assign({}, baseTooltip, { trigger: 'axis',
        formatter: ps => `${ps[0].marker} ${ps[0].axisValue}<br/><b style="color:${RED}">${ps[0].value}</b> exploradas ativamente` }),
      grid: { left: 40, right: 14, top: 14, bottom: 24 },
      xAxis: Object.assign({}, baseAxis, { type: 'category',
        data: pairs.map(p => fmtDate(p[0], gran)), splitLine: { show: false },
        axisLabel: { color: MUTED, fontSize: 9, fontFamily: FONT_MONO, interval: Math.max(0, Math.floor(pairs.length / 10)) } }),
      yAxis: Object.assign({}, baseAxis, { type: 'value' }),
      series: [{
        type: 'bar', data: pairs.map(p => p[1]), barCategoryGap: '22%',
        itemStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: RED }, { offset: 1, color: 'rgba(255,0,64,.25)' }]),
          borderRadius: [2, 2, 0, 0] },
      }],
    }, { notMerge: true });
  };

  /* correlação temporal: publicações × entradas no KEV (duas linhas) */
  CH.dualLine = (id, temporal) => {
    const c = getOrMake(id);
    if (!c) return;
    const gran = temporal.granularity;
    const x = (temporal.t || []).map(t => fmtDate(t, gran));
    c.setOption({
      animationDuration: 600,
      tooltip: Object.assign({}, baseTooltip, { trigger: 'axis',
        axisPointer: { type: 'line', lineStyle: { color: 'rgba(255,43,78,.35)' } } }),
      legend: {
        top: 0, right: 0, icon: 'rect', itemWidth: 9, itemHeight: 9,
        textStyle: { color: MUTED, fontSize: 10, fontFamily: FONT_MONO },
      },
      grid: { left: 44, right: 16, top: 30, bottom: 26 },
      xAxis: Object.assign({}, baseAxis, { type: 'category', data: x, boundaryGap: false, splitLine: { show: false },
        axisLabel: { color: MUTED, fontSize: 9, fontFamily: FONT_MONO, interval: Math.max(0, Math.floor(x.length / 8)) } }),
      yAxis: [
        Object.assign({}, baseAxis, { type: 'value', name: 'cves', nameTextStyle: { color: NEON, fontFamily: FONT_MONO, fontSize: 9 } }),
      ],
      series: [
        { name: 'cves publicadas', type: 'line', smooth: true, symbol: 'none',
          data: temporal.published, color: NEON,
          lineStyle: { width: 1.4, color: NEON },
          areaStyle: { color: NEON, opacity: .10 } },
        { name: 'entradas no kev', type: 'line', smooth: true, symbol: 'none',
          data: temporal.kevAdded, color: RED,
          lineStyle: { width: 1.4, color: RED },
          areaStyle: { color: RED, opacity: .10 } },
      ],
    }, { notMerge: true });
  };

  /* perfil de severidade: exploradas × não exploradas (barras empilhadas) */
  CH.sevStack = (id, sevEx, sevNo) => {
    const c = getOrMake(id);
    if (!c) return;
    const order = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'NONE'];
    const labels = { CRITICAL: 'críticas', HIGH: 'altas', MEDIUM: 'médias', LOW: 'baixas', NONE: 'sem score' };
    c.setOption({
      animationDuration: 600,
      tooltip: Object.assign({}, baseTooltip, { trigger: 'axis',
        formatter: ps => ps.map((p, i) =>
          `${i === 0 ? p.axisValue + '<br/>' : ''}${p.marker} ${p.seriesName}: <b style="color:${p.color}">${p.value}</b>`).join('<br/>') }),
      legend: {
        top: 0, right: 0, icon: 'rect', itemWidth: 9, itemHeight: 9,
        textStyle: { color: MUTED, fontSize: 10, fontFamily: FONT_MONO },
      },
      grid: { left: 44, right: 14, top: 30, bottom: 26 },
      xAxis: Object.assign({}, baseAxis, { type: 'category',
        data: order.map(s => labels[s]), splitLine: { show: false } }),
      yAxis: Object.assign({}, baseAxis, { type: 'value' }),
      series: [
        { name: 'exploradas (kev)', type: 'bar', stack: 's',
          data: order.map(s => sevEx[s] || 0),
          itemStyle: { color: RED, borderRadius: [0, 0, 0, 0] } },
        { name: 'não exploradas', type: 'bar', stack: 's',
          data: order.map(s => sevNo[s] || 0),
          itemStyle: { color: 'rgba(0,255,65,.45)', borderRadius: [2, 2, 0, 0] } },
      ],
    }, { notMerge: true });
  };

  window.ctiCharts = {
    CH, SEV_COLORS, NEON, MUTED, FONT_MONO, FONT_SORA,
    fmtDate,
    get: id => registry[id],
    resizeAll: () => instances.forEach(c => { if (c && !c.isDisposed()) c.resize(); }),
  };
})();
