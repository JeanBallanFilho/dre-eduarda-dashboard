const SHEETS = {
  actual2026: "2026",
  actual2025: "2025",
  budget2026: "Orçamento DRE 26"
};

const months = [
  { key: "jan", label: "Jan" },
  { key: "fev", label: "Fev" },
  { key: "mar", label: "Mar" },
  { key: "abr", label: "Abr" },
  { key: "mai", label: "Mai" },
  { key: "jun", label: "Jun" },
  { key: "jul", label: "Jul" },
  { key: "ago", label: "Ago" },
  { key: "set", label: "Set" },
  { key: "out", label: "Out" },
  { key: "nov", label: "Nov" },
  { key: "dez", label: "Dez" }
];

const statementDefs = [
  { key: "grossRevenue", label: "Receita operacional bruta", actual: ["RECEITA OPERACIONAL BRUTA"], budget: ["RECEITA OPERACIONAL BRUTA"] },
  { key: "deductions", label: "Deduções de receita operacional bruta", actual: ["DEDUCOES DA RECEITA OPERACIONAL BRUTA"], budget: ["DEDUCOES DA RECEITA OPERACIONAL BRUTA"] },
  { key: "netRevenue", label: "Receita operacional líquida", actual: ["RECEITA OPERACIONAL LIQUIDA"], budget: ["RECEITA OPERACIONAL LIQUIDA"] },
  { key: "grossResult", label: "Resultado operacional bruto", actual: ["RESULTADO OPERACIONAL BRUTO"], budget: ["RESULTADO OPERACIONAL BRUTO"] },
  { key: "expenses", label: "Despesas", actual: ["DESPESAS"], budget: ["DESPESAS"] },
  { key: "operatingResult", label: "Resultado operacional líquido", actual: ["RESULTADO OPERACIONAL LIQUIDO"], budget: ["RESULTADO OPERACIONAL LIQUIDO"] },
  { key: "beforeTax", label: "Resultado final antes do IR e CSLL", actual: ["RESULTADO FINAL ANTES DO IRPJ E CSLL", "RESULTADO FINAL ANTES DO IR E CSLL"], budget: [] },
  { key: "irpj", label: "IRPJ", actual: ["IRPJ"], budget: [] },
  { key: "csll", label: "CSLL", actual: ["CSLL"], budget: [] },
  { key: "beforeParticipation", label: "Resultado final antes das participações", actual: ["RESULTADO FINAL ANTES DAS PARTICIPACOES"], budget: [] },
  { key: "finalResult", label: "Resultado líquido final pós IRPJ/CSLL", actual: ["RESULTADO LIQUIDO FINAL"], budget: ["RESULTADO FINAL"] }
];

const columnMap = {
  actual2026: { label: 1, months: [3, 8, 11, 14, 17, 20, 23, 26, 29, 32, 35, 38], accumulated: 53 },
  actual2025: { label: 1, months: [3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36], accumulated: 51 },
  budget2026: { label: 0, months: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13], accumulated: 15 }
};

const palette = {
  revenue: "#2f7d57",
  expenses: "#b85661",
  beforeTax: "#7f6ab0",
  irpj: "#d07c36",
  csll: "#8f553a",
  result: "#356b9a",
  cmv: "#c7922f",
  grid: "#e4e1d9",
  ink: "#172126",
  muted: "#667276"
};

const els = {
  sourceLabel: document.querySelector("#sourceLabel"),
  updatedLabel: document.querySelector("#updatedLabel"),
  refreshButton: document.querySelector("#refreshButton"),
  grossRevenueKpi: document.querySelector("#grossRevenueKpi"),
  expensesKpi: document.querySelector("#expensesKpi"),
  finalResultKpi: document.querySelector("#finalResultKpi"),
  cmvKpi: document.querySelector("#cmvKpi"),
  netMarginKpi: document.querySelector("#netMarginKpi"),
  statementHead: document.querySelector("#statementHead"),
  statementBody: document.querySelector("#statementBody"),
  comparisonHead: document.querySelector("#comparisonHead"),
  comparisonBody: document.querySelector("#comparisonBody"),
  budgetHead: document.querySelector("#budgetHead"),
  budgetBody: document.querySelector("#budgetBody"),
  mainChart: document.querySelector("#mainChart"),
  cmvChart: document.querySelector("#cmvChart")
};

let dashboardData;

async function init() {
  await refreshData();
}

async function refreshData() {
  els.refreshButton.disabled = true;
  els.refreshButton.textContent = "Atualizando...";
  els.updatedLabel.textContent = "Buscando dados do Google Sheets...";

  try {
    dashboardData = await loadLiveData();
    render();
  } finally {
    els.refreshButton.disabled = false;
    els.refreshButton.textContent = "Atualizar dados";
  }
}

async function loadLiveData() {
  const [actual2026, actual2025, budget2026] = await Promise.all([
    fetchSheet("actual2026"),
    fetchSheet("actual2025"),
    fetchSheet("budget2026")
  ]);

  return buildDashboardData({ actual2026, actual2025, budget2026 });
}

async function fetchSheet(name) {
  const response = await fetch(`/api/sheet?name=${name}&t=${Date.now()}`, { cache: "no-store" });
  if (!response.ok) throw new Error(`Não foi possível carregar a aba ${SHEETS[name]}.`);
  return parseCsvRows(await response.text());
}

function buildDashboardData(sheets) {
  const rows2026 = indexRows(sheets.actual2026, columnMap.actual2026.label);
  const rows2025 = indexRows(sheets.actual2025, columnMap.actual2025.label);
  const budgetRows = indexRows(sheets.budget2026, columnMap.budget2026.label);

  const years = {
    2026: buildYear(rows2026, "actual2026"),
    2025: buildYear(rows2025, "actual2025")
  };

  const budgetComparison = buildBudgetComparison(rows2026, budgetRows);
  const comparison = buildYearComparison(years);
  const cmvComparison = buildCmvComparison(years);
  const netMargin = buildNetMargin(years["2026"]);

  return {
    title: "DRE Altar 2026",
    source: "Google Sheets | abas 2026, 2025 e Orçamento DRE 26",
    updatedAt: new Date().toISOString(),
    months,
    years,
    statement: years["2026"].statement,
    cmv: years["2026"].cmv,
    netMargin,
    budgetComparison,
    comparison,
    cmvComparison
  };
}

function buildYear(index, mapKey) {
  const map = columnMap[mapKey];
  const statement = statementDefs.map((def) => {
    const row = findRow(index, def.actual);
    return {
      key: def.key,
      label: def.label,
      sourceLabel: row.label,
      values: readMonthValues(row.values, map),
      accumulated: parseNumber(row.values[map.accumulated])
    };
  });

  const cmvRow = findRow(index, ["CMV"]);
  return {
    statement,
    cmv: {
      label: "CMV geral (%)",
      sourceLabel: cmvRow.label,
      values: readMonthValues(cmvRow.values, map).map((item) => ({ ...item, value: asPercent(item.value) })),
      accumulated: asPercent(parseNumber(cmvRow.values[map.accumulated]))
    }
  };
}

function buildBudgetComparison(actualIndex, budgetIndex) {
  const actualMap = columnMap.actual2026;
  const budgetMap = columnMap.budget2026;

  return statementDefs
    .filter((def) => def.budget.length)
    .map((def) => {
      const actualRow = findRow(actualIndex, def.actual);
      const budgetRow = findRow(budgetIndex, def.budget);
      const actualValues = readMonthValues(actualRow.values, actualMap);
      const budgetValues = readMonthValues(budgetRow.values, budgetMap);
      const values = actualValues.map((actual, index) => {
        const budget = budgetValues[index];
        const variance = actual.value - budget.value;
        return {
          month: actual.month,
          label: actual.label,
          actual: actual.value,
          budget: budget.value,
          variance,
          variancePct: budget.value === 0 ? null : (variance / Math.abs(budget.value)) * 100
        };
      });
      const actual = parseNumber(actualRow.values[actualMap.accumulated]);
      const budget = parseNumber(budgetRow.values[budgetMap.accumulated]);
      const variance = actual - budget;
      return {
        key: def.key,
        label: def.label,
        sourceLabel: budgetRow.label,
        values,
        actual,
        budget,
        variance,
        variancePct: budget === 0 ? null : (variance / Math.abs(budget)) * 100
      };
    });
}

function buildYearComparison(years) {
  return statementDefs.map((def) => {
    const value2026 = getLine(def.key, years["2026"].statement).accumulated;
    const value2025 = getLine(def.key, years["2025"].statement).accumulated;
    const delta = value2026 - value2025;
    return {
      key: def.key,
      label: def.label,
      value2025,
      value2026,
      delta,
      deltaPct: value2025 === 0 ? null : (delta / Math.abs(value2025)) * 100
    };
  });
}

function buildCmvComparison(years) {
  const value2026 = years["2026"].cmv.accumulated;
  const value2025 = years["2025"].cmv.accumulated;
  const delta = value2026 - value2025;
  return {
    label: "CMV geral (%)",
    value2025,
    value2026,
    delta,
    deltaPct: value2025 === 0 ? null : (delta / Math.abs(value2025)) * 100
  };
}

function buildNetMargin(year) {
  const revenue = getLine("grossRevenue", year.statement);
  const result = getLine("finalResult", year.statement);
  return {
    label: "Margem líquida (%)",
    value: revenue.accumulated === 0 ? 0 : (result.accumulated / revenue.accumulated) * 100,
    values: months.map((month, index) => {
      const rev = revenue.values[index].value;
      const res = result.values[index].value;
      return { ...month, value: rev === 0 ? 0 : (res / rev) * 100 };
    })
  };
}

function render() {
  els.sourceLabel.textContent = dashboardData.source;
  els.updatedLabel.textContent = `Atualizado em ${new Date(dashboardData.updatedAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}`;

  const grossRevenue = getLine("grossRevenue");
  const expenses = getLine("expenses");
  const finalResult = getLine("finalResult");

  els.grossRevenueKpi.textContent = formatCurrency(grossRevenue.accumulated);
  els.expensesKpi.textContent = formatCurrency(expenses.accumulated);
  els.finalResultKpi.textContent = formatCurrency(finalResult.accumulated);
  els.cmvKpi.textContent = formatPercent(dashboardData.cmv.accumulated);
  els.netMarginKpi.textContent = formatPercent(dashboardData.netMargin.value);

  renderStatement();
  renderComparison();
  renderBudgetComparison();
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

function renderComparison() {
  const rows = [...dashboardData.comparison, dashboardData.cmvComparison];
  els.comparisonHead.innerHTML = `
    <tr>
      <th>Linha da DRE</th>
      <th>2025</th>
      <th>2026</th>
      <th>Variação</th>
      <th>Variação %</th>
    </tr>
  `;

  els.comparisonBody.innerHTML = rows.map((line) => {
    const isCmv = line.label.includes("CMV");
    const valueFormatter = isCmv ? formatPercent : formatCurrency;
    return `
      <tr class="${line.key === "finalResult" ? "statement-row-total" : ""}">
        <td><strong>${escapeHtml(line.label)}</strong></td>
        <td>${valueFormatter(line.value2025)}</td>
        <td>${valueFormatter(line.value2026)}</td>
        <td class="${line.delta < 0 ? "negative" : "positive"}">${isCmv ? formatPercent(line.delta) : formatCurrency(line.delta)}</td>
        <td class="${line.deltaPct < 0 ? "negative" : "positive"}">${line.deltaPct === null ? "-" : formatPercent(line.deltaPct)}</td>
      </tr>
    `;
  }).join("");
}

function renderBudgetComparison() {
  const monthHeaders = dashboardData.months.map((month) => `<th>${month.label}<small>Real / Orç / Δ</small></th>`).join("");
  els.budgetHead.innerHTML = `
    <tr>
      <th>Linha da DRE</th>
      ${monthHeaders}
      <th>Acumulado</th>
    </tr>
  `;

  els.budgetBody.innerHTML = dashboardData.budgetComparison.map((line) => `
    <tr>
      <td><strong>${escapeHtml(line.label)}</strong></td>
      ${line.values.map((item) => `
        <td>
          <span>${formatCurrency(item.actual)}</span>
          <small>${formatCurrency(item.budget)}</small>
          <em class="${item.variance < 0 ? "negative" : "positive"}">${formatCurrency(item.variance)}</em>
        </td>
      `).join("")}
      <td>
        <span>${formatCurrency(line.actual)}</span>
        <small>${formatCurrency(line.budget)}</small>
        <em class="${line.variance < 0 ? "negative" : "positive"}">${formatCurrency(line.variance)}</em>
      </td>
    </tr>
  `).join("");
}

function renderMainChart() {
  const series = [
    { label: "Receita bruta", color: palette.revenue, values: getLine("grossRevenue").values.map((item) => item.value) },
    { label: "Despesas", color: palette.expenses, values: getLine("expenses").values.map((item) => item.value) },
    { label: "Antes IRPJ/CSLL", color: palette.beforeTax, values: getLine("beforeTax").values.map((item) => item.value) },
    { label: "Resultado líquido final", color: palette.result, values: getLine("finalResult").values.map((item) => item.value) }
  ];
  drawGroupedBars(els.mainChart, dashboardData.months.map((month) => month.label), series, {
    formatter: compactCurrency,
    valueFormatter: compactCurrency
  });
}

function renderCmvChart() {
  drawSingleBars(els.cmvChart, dashboardData.months.map((month) => month.label), dashboardData.cmv.values.map((item) => item.value), {
    color: palette.cmv,
    formatter: formatPercent
  });
}

function readMonthValues(row, map) {
  return map.months.map((column, index) => ({
    month: months[index].key,
    label: months[index].label,
    value: parseNumber(row[column])
  }));
}

function indexRows(rows, labelColumn) {
  const index = new Map();
  rows.forEach((row) => {
    const label = row[labelColumn];
    const key = normalizeText(label);
    if (key && !index.has(key)) index.set(key, { label: String(label || "").trim(), values: row });
  });
  return index;
}

function findRow(index, matches) {
  for (const match of matches) {
    const row = index.get(match);
    if (row) return row;
  }
  throw new Error(`Linha não encontrada: ${matches.join(" / ")}`);
}

function getLine(key, statement = dashboardData.statement) {
  return statement.find((line) => line.key === key);
}

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/^[()=+\-\s]+/, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function parseNumber(value) {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const raw = String(value).trim();
  if (!raw || raw === "-" || raw.startsWith("#")) return 0;
  const negative = /^\(.+\)$/.test(raw);
  const cleaned = raw
    .replace(/[R$\s%()]/g, "")
    .replace(/\.(?=\d{3}(\D|$))/g, "")
    .replace(",", ".")
    .replace(/[^\d.-]/g, "");
  if (!cleaned || cleaned === "-" || cleaned === ".") return 0;
  const parsed = Number(cleaned);
  if (!Number.isFinite(parsed)) return 0;
  return negative ? -Math.abs(parsed) : parsed;
}

function asPercent(value) {
  return Math.abs(value) <= 1 ? value * 100 : value;
}

function parseCsvRows(text) {
  const rows = [];
  let row = [];
  let value = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"' && quoted && next === '"') {
      value += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(value.trim());
      value = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(value.trim());
      if (row.some((cell) => cell !== "")) rows.push(row);
      row = [];
      value = "";
    } else {
      value += char;
    }
  }

  row.push(value.trim());
  if (row.some((cell) => cell !== "")) rows.push(row);
  return rows;
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
  const padding = { top: 30, right: 22, bottom: 94, left: 58 };
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
      if (rawValue !== 0) {
        ctx.fillStyle = palette.ink;
        ctx.font = "700 9px Inter, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(options.formatter(rawValue), x + barW / 2, y > padding.top + 14 ? y - 5 : y + 13);
      }
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

  drawGrid(ctx, padding, chartW, chartH, max, formatPercent);
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
    const chartWidth = ctx.canvas.width / (window.devicePixelRatio || 1);
    const itemWidth = 170;
    const perRow = Math.max(1, Math.floor((chartWidth - x - 18) / itemWidth));
    const row = Math.floor(index / perRow);
    const column = index % perRow;
    const itemX = x + column * itemWidth;
    const itemY = y + row * 18;
    ctx.fillStyle = item.color;
    ctx.fillRect(itemX, itemY - 10, 12, 12);
    ctx.fillStyle = "#495357";
    ctx.textAlign = "left";
    ctx.font = "700 12px Inter, sans-serif";
    ctx.fillText(item.label, itemX + 18, itemY);
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

function formatPercent(value) {
  return `${formatNumber(value)}%`;
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

els.refreshButton.addEventListener("click", refreshData);
window.addEventListener("resize", () => {
  if (dashboardData) render();
});

init().catch((error) => {
  document.body.innerHTML = `<main class="dre-app"><section class="panel"><h1>Não foi possível carregar o dashboard</h1><p>${escapeHtml(error.message)}</p></section></main>`;
});
