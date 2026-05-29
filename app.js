const DATA_URL = "data/dre-altar-2026.json";

const palette = {
  revenue: "#2f7d57",
  expenses: "#b85661",
  result: "#356b9a",
  cmv: "#c7922f",
  grid: "#e4e1d9",
  ink: "#172126",
  muted: "#667276"
};

const els = {
  sourceLabel: document.querySelector("#sourceLabel"),
  updatedLabel: document.querySelector("#updatedLabel"),
  grossRevenueKpi: document.querySelector("#grossRevenueKpi"),
  expensesKpi: document.querySelector("#expensesKpi"),
  finalResultKpi: document.querySelector("#finalResultKpi"),
  cmvKpi: document.querySelector("#cmvKpi"),
  statementHead: document.querySelector("#statementHead"),
  statementBody: document.querySelector("#statementBody"),
  mainChart: document.querySelector("#mainChart"),
  cmvChart: document.querySelector("#cmvChart")
};

let dashboardData;

async function init() {
  const response = await fetch(`${DATA_URL}?t=${Date.now()}`, { cache: "no-store" });
  dashboardData = await response.json();
  render();
}

function render() {
  els.sourceLabel.textContent = dashboardData.source;
  els.updatedLabel.textContent = `Atualizado a partir do arquivo em ${formatDate(dashboardData.updatedFromFile)}`;

  const grossRevenue = getLine("grossRevenue");
  const expenses = getLine("expenses");
  const finalResult = getLine("finalResult");

  els.grossRevenueKpi.textContent = formatCurrency(grossRevenue.accumulated);
  els.expensesKpi.textContent = formatCurrency(expenses.accumulated);
  els.finalResultKpi.textContent = formatCurrency(finalResult.accumulated);
  els.cmvKpi.textContent = `${formatNumber(dashboardData.cmv.accumulated)}%`;

  renderStatement();
  renderMainChart();
  renderCmvChart();
}

function renderStatement() {
  els.statementHead.innerHTML = `
    <tr>
      <th>Linha da DRE</th>
      ${dashboardData.months.map((month) => `<th>${month.label}</th>`).join("")}
      <th>Acumulado</th>
    </tr>
  `;

  els.statementBody.innerHTML = dashboardData.statement.map((line) => `
    <tr class="${line.key === "finalResult" ? "statement-row-total" : ""}">
      <td>
        <strong>${escapeHtml(line.label)}</strong>
        <small>${escapeHtml(line.sourceLabel)}</small>
      </td>
      ${line.values.map((item) => `<td>${formatCurrency(item.value)}</td>`).join("")}
      <td>${formatCurrency(line.accumulated)}</td>
    </tr>
  `).join("");
}

function renderMainChart() {
  const series = [
    { label: "Receita bruta", color: palette.revenue, values: getLine("grossRevenue").values.map((item) => item.value) },
    { label: "Despesas", color: palette.expenses, values: getLine("expenses").values.map((item) => Math.abs(item.value)) },
    { label: "Resultado final", color: palette.result, values: getLine("finalResult").values.map((item) => item.value) }
  ];
  drawGroupedBars(els.mainChart, dashboardData.months.map((month) => month.label), series, {
    formatter: compactCurrency,
    valueFormatter: compactCurrency
  });
}

function renderCmvChart() {
  drawSingleBars(els.cmvChart, dashboardData.months.map((month) => month.label), dashboardData.cmv.values.map((item) => item.value), {
    color: palette.cmv,
    formatter: (value) => `${formatNumber(value)}%`
  });
}

function getLine(key) {
  return dashboardData.statement.find((line) => line.key === key);
}

function drawGroupedBars(canvas, labels, series, options) {
  const ctx = setupCanvas(canvas);
  const { width, height } = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const w = width;
  const h = height || 340;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.scale(dpr, dpr);

  const allValues = series.flatMap((item) => item.values.map(Math.abs));
  const max = Math.max(1, ...allValues);
  const padding = { top: 26, right: 22, bottom: 76, left: 58 };
  const chartW = w - padding.left - padding.right;
  const chartH = h - padding.top - padding.bottom;
  const groupGap = 13;
  const groupW = Math.max(30, (chartW - groupGap * (labels.length - 1)) / labels.length);
  const barGap = 4;
  const barW = Math.max(7, (groupW - barGap * (series.length - 1)) / series.length);

  drawGrid(ctx, padding, chartW, chartH, max, options.valueFormatter);

  labels.forEach((label, monthIndex) => {
    const groupX = padding.left + monthIndex * (groupW + groupGap);
    series.forEach((item, seriesIndex) => {
      const rawValue = item.values[monthIndex] || 0;
      const value = Math.abs(rawValue);
      const barH = (value / max) * chartH;
      const x = groupX + seriesIndex * (barW + barGap);
      const y = padding.top + chartH - barH;
      ctx.fillStyle = item.color;
      roundRect(ctx, x, y, barW, barH, 5);
      ctx.fill();
      ctx.fillStyle = palette.ink;
      ctx.font = "700 10px Inter, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(options.formatter(rawValue), x + barW / 2, y > padding.top + 14 ? y - 5 : y + 13);
    });
    drawMonthLabel(ctx, label, groupX + groupW / 2, padding.top + chartH + 18);
  });

  drawLegend(ctx, series, padding.left, h - 18);
  ctx.restore();
}

function drawSingleBars(canvas, labels, values, options) {
  const ctx = setupCanvas(canvas);
  const { width, height } = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const w = width;
  const h = height || 300;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.scale(dpr, dpr);

  const max = Math.max(1, ...values);
  const padding = { top: 24, right: 22, bottom: 66, left: 48 };
  const chartW = w - padding.left - padding.right;
  const chartH = h - padding.top - padding.bottom;
  const gap = 13;
  const barW = Math.max(18, (chartW - gap * (labels.length - 1)) / labels.length);

  drawGrid(ctx, padding, chartW, chartH, max, (value) => `${formatNumber(value)}%`);
  labels.forEach((label, index) => {
    const value = values[index] || 0;
    const barH = (value / max) * chartH;
    const x = padding.left + index * (barW + gap);
    const y = padding.top + chartH - barH;
    ctx.fillStyle = options.color;
    roundRect(ctx, x, y, barW, barH, 6);
    ctx.fill();
    ctx.fillStyle = palette.ink;
    ctx.font = "700 11px Inter, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(options.formatter(value), x + barW / 2, y > padding.top + 15 ? y - 7 : y + 14);
    drawMonthLabel(ctx, label, x + barW / 2, padding.top + chartH + 18);
  });
  ctx.restore();
}

function drawGrid(ctx, padding, chartW, chartH, max, formatter) {
  ctx.strokeStyle = palette.grid;
  ctx.fillStyle = palette.muted;
  ctx.font = "11px Inter, sans-serif";
  ctx.textAlign = "right";
  [0, 0.25, 0.5, 0.75, 1].forEach((step) => {
    const y = padding.top + chartH - chartH * step;
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(padding.left + chartW, y);
    ctx.stroke();
    ctx.fillText(formatter(max * step), padding.left - 8, y + 4);
  });
}

function drawMonthLabel(ctx, label, x, y) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-Math.PI / 5);
  ctx.fillStyle = palette.muted;
  ctx.font = "12px Inter, sans-serif";
  ctx.textAlign = "right";
  ctx.fillText(label, 0, 0);
  ctx.restore();
}

function drawLegend(ctx, series, x, y) {
  series.forEach((item, index) => {
    const offset = index * 154;
    ctx.fillStyle = item.color;
    ctx.fillRect(x + offset, y - 10, 12, 12);
    ctx.fillStyle = "#495357";
    ctx.textAlign = "left";
    ctx.font = "700 12px Inter, sans-serif";
    ctx.fillText(item.label, x + offset + 18, y);
  });
}

function setupCanvas(canvas) {
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const height = Number(canvas.getAttribute("height")) || rect.height || 320;
  canvas.style.height = `${height}px`;
  canvas.width = Math.max(1, Math.floor(rect.width * dpr));
  canvas.height = Math.floor(height * dpr);
  return canvas.getContext("2d");
}

function roundRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, Math.abs(width) / 2, Math.abs(height) / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
}

function formatCurrency(value) {
  const formatted = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0
  }).format(Math.abs(value || 0));
  return value < 0 ? `(${formatted})` : formatted;
}

function compactCurrency(value) {
  const abs = Math.abs(value || 0);
  const sign = value < 0 ? "-" : "";
  if (abs >= 1000000) return `${sign}R$ ${formatNumber(abs / 1000000)} mi`;
  if (abs >= 1000) return `${sign}R$ ${formatNumber(abs / 1000)} mil`;
  return `${sign}R$ ${formatNumber(abs)}`;
}

function formatNumber(value) {
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(value || 0);
}

function formatDate(value) {
  const date = new Date(`${value}T00:00:00`);
  return date.toLocaleDateString("pt-BR");
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

window.addEventListener("resize", () => {
  if (dashboardData) render();
});

init().catch((error) => {
  document.body.innerHTML = `<main class="dre-app"><section class="panel"><h1>Não foi possível carregar o dashboard</h1><p>${escapeHtml(error.message)}</p></section></main>`;
});
