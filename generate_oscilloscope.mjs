import fs from 'fs';

async function generate() {
  try {
    let contributions = [];
    const res = await fetch('https://github-contributions-api.jogruber.de/v4/White18899?y=last');
    if (res.ok) {
      const data = await res.json();
      contributions = data.contributions || [];
    }

    const width = 880;
    const height = 260;
    const padLeft = 45;
    const padRight = 35;
    const padTop = 65;
    const padBottom = 45;
    const plotWidth = width - padLeft - padRight;
    const plotHeight = height - padTop - padBottom;

    // Aggregate into 52 weekly intervals
    const weeks = [];
    let currentWeek = [];
    for (const item of contributions) {
      currentWeek.push(item.count);
      if (currentWeek.length === 7) {
        weeks.push(currentWeek.reduce((a, b) => a + b, 0));
        currentWeek = [];
      }
    }
    if (currentWeek.length > 0) {
      weeks.push(currentWeek.reduce((a, b) => a + b, 0));
    }

    const maxVal = Math.max(...weeks, 8);
    const totalCommits = weeks.reduce((a, b) => a + b, 0);

    // Coordinate mapping
    const points = weeks.map((val, i) => {
      const x = padLeft + (i / (weeks.length - 1)) * plotWidth;
      const y = padTop + plotHeight - (val / maxVal) * plotHeight;
      return { x: Number(x.toFixed(1)), y: Number(y.toFixed(1)), val };
    });

    // Smooth cubic bezier spline
    let pathD = `M ${points[0].x} ${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i === 0 ? 0 : i - 1];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[i + 2] || p2;

      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;

      pathD += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x} ${p2.y}`;
    }

    const areaD = `${pathD} L ${points[points.length - 1].x} ${padTop + plotHeight} L ${points[0].x} ${padTop + plotHeight} Z`;

    // Month labels
    const months = ['Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct'];
    const monthTexts = months.map((m, i) => {
      const x = padLeft + (i / (months.length - 1)) * plotWidth;
      return `<text x="${x.toFixed(1)}" y="${height - 18}" fill="#64748b" font-size="12" font-family="'Fira Code', monospace" text-anchor="middle">${m}</text>`;
    }).join('\n    ');

    // Peak dots
    const peakDots = points
      .filter(p => p.val > 5)
      .map(p => `
        <circle cx="${p.x}" cy="${p.y}" r="4" fill="#00FF66" filter="url(#glow)" />
        <circle cx="${p.x}" cy="${p.y}" r="2" fill="#ffffff" />
      `).join('\n');

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="100%" height="100%" fill="none">
  <defs>
    <!-- Neon Gradient for Oscilloscope Area -->
    <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#00FF66" stop-opacity="0.32" />
      <stop offset="60%" stop-color="#00FF66" stop-opacity="0.08" />
      <stop offset="100%" stop-color="#00FF66" stop-opacity="0.00" />
    </linearGradient>

    <!-- Line Stroke Gradient -->
    <linearGradient id="lineGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#00F2FE" />
      <stop offset="50%" stop-color="#00FF66" />
      <stop offset="100%" stop-color="#38BDF8" />
    </linearGradient>

    <!-- Glow Filter -->
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="3.5" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>

  <style>
    .title-text { font-family: 'Fira Code', monospace, sans-serif; font-size: 13px; font-weight: 700; fill: #00FF66; letter-spacing: 1px; }
    .stat-text { font-family: 'Fira Code', monospace, sans-serif; font-size: 12px; fill: #94a3b8; }
    .grid-line { stroke: #1e293b; stroke-dasharray: 4 6; stroke-width: 1; }
  </style>

  <!-- Background Panel -->
  <rect width="${width}" height="${height}" rx="12" fill="#0d1117" stroke="#1f2937" stroke-width="1.5" />

  <!-- Oscilloscope Grid Lines -->
  <line x1="${padLeft}" y1="${padTop}" x2="${width - padRight}" y2="${padTop}" class="grid-line" />
  <line x1="${padLeft}" y1="${padTop + plotHeight * 0.33}" x2="${width - padRight}" y2="${padTop + plotHeight * 0.33}" class="grid-line" />
  <line x1="${padLeft}" y1="${padTop + plotHeight * 0.66}" x2="${width - padRight}" y2="${padTop + plotHeight * 0.66}" class="grid-line" />
  <line x1="${padLeft}" y1="${padTop + plotHeight}" x2="${width - padRight}" y2="${padTop + plotHeight}" stroke="#334155" stroke-width="1.5" />

  <!-- Header HUD -->
  <g transform="translate(${padLeft}, 34)">
    <!-- Blinking Radar dot -->
    <circle cx="6" cy="-4" r="4" fill="#00FF66" filter="url(#glow)">
      <animate attributeName="opacity" values="1;0.3;1" dur="2s" repeatCount="indefinite" />
    </circle>
    <text x="20" y="0" class="title-text">ACTIVITY OSCILLOSCOPE // 365-DAY FREQUENCY</text>
    <text x="${plotWidth}" y="0" class="stat-text" text-anchor="end">TOTAL SIGNALS: <tspan fill="#00FF66" font-weight="bold">${totalCommits}</tspan> COMMITS</text>
  </g>

  <!-- Oscilloscope Area Wave -->
  <path d="${areaD}" fill="url(#areaGrad)" />

  <!-- Oscilloscope Line Wave -->
  <path d="${pathD}" fill="none" stroke="url(#lineGrad)" stroke-width="3" filter="url(#glow)" stroke-linecap="round" stroke-linejoin="round" />

  <!-- Peak Highlights -->
  ${peakDots}

  <!-- Time Axis Labels -->
  ${monthTexts}
</svg>`;

    fs.writeFileSync('A:/White18899/activity-graph.svg', svg, 'utf-8');
    // Also copy script to White18899 for the daily GitHub Action
    fs.writeFileSync('A:/White18899/generate_oscilloscope.mjs', fs.readFileSync('A:/portfolio/generate_oscilloscope.mjs', 'utf-8'), 'utf-8');
    console.log('Successfully generated activity-graph.svg with', totalCommits, 'commits!');
  } catch (err) {
    console.error('Generation error:', err);
  }
}

generate();
