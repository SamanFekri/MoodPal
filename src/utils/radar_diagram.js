const { ChartJSNodeCanvas } = require('chartjs-node-canvas');
require('chart.js/auto');
const fs = require('fs');

const DEFAULT_WIDTH = 600;
const DEFAULT_HEIGHT = 600;
const DARK_BG = 'rgba(46,46,46,1)';

const AGGREGATED_CATEGORY_MOODS = {
  positive:  { label: 'Positive',  moods: ['happy', 'relaxed', 'excited'] },
  motivated: { label: 'Motivated', moods: ['motivated', 'naughty', 'confused'] },
  anxious:   { label: 'Anxious',   moods: ['anxious', 'overthinking', 'nervous'] },
  negative:  { label: 'Negative',  moods: ['disappointed', 'sad', 'overwhelmed'] },
  drained:   { label: 'Drained',   moods: ['tired', 'sick', 'angry'] },
  calm:      { label: 'Calm',      moods: ['neutral', 'uncertain', 'bored'] }
};

function aggregateMoodsFrequency(moodData) {
  const aggregated = {};
  for (const key of Object.keys(AGGREGATED_CATEGORY_MOODS)) aggregated[key] = 0;
  for (const [mood, count] of Object.entries(moodData || {})) {
    const catKey = Object.keys(AGGREGATED_CATEGORY_MOODS)
      .find(k => AGGREGATED_CATEGORY_MOODS[k].moods.includes(mood));
    if (catKey) aggregated[catKey] += Number.isFinite(count) ? count : 0;
  }
  return aggregated;
}

/* Draw raw numbers near points ONLY when debugNumbers=true */
const drawValuesPlugin = {
  id: 'drawValuesPlugin',
  afterDatasetsDraw(chart) {
    const debugNumbers = !!chart.config?.options?.plugins?.__debugNumbers;
    if (!debugNumbers) return;
    const ctx = chart.ctx;
    const rawValues = chart.config?.options?.plugins?.__rawValues || [];
    const meta = chart.getDatasetMeta(0);
    if (!meta?.data) return;
    const area = chart.chartArea;
    const cx = area.left + (area.right - area.left) / 2;
    const cy = area.top + (area.bottom - area.top) / 2;
    const padding = 12;
    ctx.save();
    ctx.font = '12px sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    meta.data.forEach((pt, i) => {
      const x = pt.x, y = pt.y;
      const dx = x - cx, dy = y - cy;
      const len = Math.sqrt(dx*dx + dy*dy) || 1;
      const tx = x + (dx / len) * padding;
      const ty = y + (dy / len) * padding;
      ctx.fillText(String(rawValues[i] ?? ''), tx, ty);
    });
    ctx.restore();
  }
};

/* Small white date text bottom-left */
const cornerDatePlugin = {
  id: 'cornerDatePlugin',
  afterDraw(chart) {
    const text = chart.config?.options?.plugins?.__cornerText;
    if (!text) return;
    const pad = chart.config?.options?.plugins?.__cornerPad ?? 10;
    const fontSize = chart.config?.options?.plugins?.__cornerFontSize ?? 14;
    const { ctx, width, height } = chart;
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.font = `${fontSize}px sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillText(text, pad, height - pad);
    ctx.restore();
  }
};

async function renderAggregatedRadar(aggregated, outputPath, options = {}) {
  const width = options.width || DEFAULT_WIDTH;
  const height = options.height || DEFAULT_HEIGHT;

  const categories = Object.keys(AGGREGATED_CATEGORY_MOODS);
  // +1 to each category value (per your earlier requirement)
  const rawValues = categories.map(k => (aggregated[k] || 0) + 1);

  // No numbers in labels
  const labels = categories.map(k => AGGREGATED_CATEGORY_MOODS[k].label);

  // Controller passes max on aggregated categories; add +1 here too
  const providedMax = (Number.isFinite(options.maxValue) && options.maxValue > 0)
    ? options.maxValue
    : Math.max(1, ...rawValues);
  const hardMax = providedMax + 1;

  const chartJSNodeCanvas = new ChartJSNodeCanvas({
    width,
    height,
    backgroundColour: DARK_BG
  });

  const cfg = {
    type: 'radar',
    data: {
      labels,
      datasets: [{
        data: rawValues,
        backgroundColor: 'rgba(54,162,235,0.2)',
        borderColor: 'rgba(54,162,235,1)',
        pointBackgroundColor: 'rgba(54,162,235,1)',
        borderWidth: 2,
        pointRadius: 3,
        fill: true
      }]
    },
    options: {
      responsive: false,
      animation: false,
      plugins: {
        legend: { display: false },
        __rawValues: rawValues,                 // used only when debugNumbers=true
        __debugNumbers: !!options.debugNumbers, // toggle numbers rendering
        __cornerText: options.cornerText || '', // bottom-left date text
        __cornerFontSize: options.cornerFontSize || 14,
        __cornerPad: options.cornerPad ?? 10
      },
      scales: {
        r: {
          beginAtZero: true,
          min: 0,
          max: hardMax,
          angleLines: { color: 'rgba(255,255,255,0.1)' },
          grid: { color: 'rgba(255,255,255,0.1)' },
          pointLabels: { font: { size: 16 }, color: 'rgba(255,255,255,0.9)' },
          ticks: { display: false }
        }
      }
    },
    plugins: [drawValuesPlugin, cornerDatePlugin]
  };

  const imageBuffer = await chartJSNodeCanvas.renderToBuffer(cfg, 'image/png');
  await fs.promises.mkdir(require('path').dirname(outputPath), { recursive: true });
  await fs.promises.writeFile(outputPath, imageBuffer);
}

async function generateMoodRadarChart(moodData, outputPath, options = {}) {
  const aggregated = aggregateMoodsFrequency(moodData);
  return renderAggregatedRadar(aggregated, outputPath, options);
}

module.exports = {
  generateMoodRadarChart,
  renderAggregatedRadar,
  _aggregateMoodsFrequency: aggregateMoodsFrequency
};
