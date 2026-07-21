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
  { key: "deductions", label: "Deduções da receita", actual: ["DEDUCOES DA RECEITA OPERACIONAL BRUTA"], budget: ["DEDUCOES DA RECEITA OPERACIONAL BRUTA"] },
  { key: "netRevenue", label: "Receita operacional líquida", actual: ["RECEITA OPERACIONAL LIQUIDA"], budget: ["RECEITA OPERACIONAL LIQUIDA"] },
  { key: "grossResult", label: "Lucro bruto", actual: ["RESULTADO OPERACIONAL BRUTO"], budget: ["RESULTADO OPERACIONAL BRUTO"] },
  { key: "expenses", label: "Despesas", actual: ["DESPESAS"], budget: ["DESPESAS"] },
  { key: "operatingResult", label: "Resultado operacional líquido", actual: ["RESULTADO OPERACIONAL LIQUIDO"], budget: ["RESULTADO OPERACIONAL LIQUIDO"] },
  { key: "beforeTax", label: "Resultado antes IRPJ/CSLL", actual: ["RESULTADO FINAL ANTES DO IRPJ E CSLL", "RESULTADO FINAL ANTES DO IR E CSLL"], budget: [] },
  { key: "irpj", label: "IRPJ", actual: ["IRPJ"], budget: [] },
  { key: "csll", label: "CSLL", actual: ["CSLL"], budget: [] },
  { key: "beforeParticipation", label: "Resultado antes das participações", actual: ["RESULTADO FINAL ANTES DAS PARTICIPACOES"], budget: [] },
  { key: "finalResult", label: "Resultado líquido final", actual: ["RESULTADO LIQUIDO FINAL"], budget: ["RESULTADO FINAL"] }
];

const columnMap = {
  actual2026: { label: 1, months: [3, 8, 11, 14, 17, 20, 23, 26, 29, 32, 35, 38], accumulated: 53 },
  actual2025: { label: 1, months: [3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36], accumulated: 51 },
  budget2026: { label: 0, months: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13], accumulated: 15 }
};

const palette = {
  revenue: "#2f7d57",
  costs: "#c7922f",
  expenses: "#b85661",
  operatingResult: "#257c8a",
  beforeTax: "#7f6ab0",
  result: "#356b9a",
  cmvFoods: "#2f7d57",
  cmvDrinks: "#356b9a",
  cmvGeneral: "#c7922f",
  neutral: "#8b8172",
  grid: "#e4e1d9",
  ink: "#172126",
  muted: "#667276",
  paper: "#fffdfa"
};

const cmvSeriesDefs = [
  { key: "general", label: "CMV A&B", matches: ["% CMV A&B / RECEITA BRUTA"], color: palette.cmvGeneral },
  { key: "drinks", label: "CMV Bebidas", matches: ["% CMV BEBIDAS"], color: palette.cmvDrinks },
  { key: "foods", label: "CMV Alimentos", matches: ["% CMV ALIMENTOS"], color: palette.cmvFoods }
];

const els = {
  sourceLabel: document.querySelector("#sourceLabel"),
  updatedLabel: document.querySelector("#updatedLabel"),
  refreshButton: document.querySelector("#refreshButton"),
  grossRevenueKpi: document.querySelector("#grossRevenueKpi"),
  grossRevenueNote: document.querySelector("#grossRevenueNote"),
  expensesKpi: document.querySelector("#expensesKpi"),
  finalResultKpi: document.querySelector("#finalResultKpi"),
  cmvKpi: document.querySelector("#cmvKpi"),
  netMarginKpi: document.querySelector("#netMarginKpi"),
  realizedRangeLabel: document.querySelector("#realizedRangeLabel"),
  statementHead: document.querySelector("#statementHead"),
  statementBody: document.querySelector("#statementBody"),
  comparisonHead: document.querySelector("#comparisonHead"),
  comparisonBody: document.querySelector("#comparisonBody"),
  waterfallChart: document.querySelector("#waterfallChart"),
  trendChart: document.querySelector("#trendChart"),
  budgetChart: document.querySelector("#budgetChart"),
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
  const apiBase = window.location.protocol === "file:"
    ? "https://dre-eduarda-dashboard.vercel.app"
    : "";
  const response = await fetch(`${apiBase}/api/sheet?name=${name}&t=${Date.now()}`, { cache: "no-store" });
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

  const realizedMonths = getRealizedMonths(years["2026"].statement);
  const budgetComparison = buildBudgetComparison(rows2026, budgetRows);
  const comparison = buildYearComparison(years);
  const netMargin = buildNetMargin(years["2026"]);

  return {
    source: "Google Sheets | abas 2026, 2025 e Orçamento DRE 26",
    updatedAt: new Date().toISOString(),
    months,
    realizedMonths,
    years,
    statement: years["2026"].statement,
    cmv: years["2026"].cmv,
    cmvSeries: years["2026"].cmvSeries,
    netMargin,
    budgetComparison,
    comparison,
    cmvComparison: buildCmvComparison(years)
  };
}

function buildYear(index, mapKey) {
  const map = columnMap[mapKey];
  const statement = statementDefs.map((def) => {
    const row = findRow(index, def.actual);
    const values = readMonthValues(row.values, map);
    return {
      key: def.key,
      label: def.label,
      sourceLabel: row.label,
      values,
      accumulated: readAccumulatedValue(row.values, map, values)
    };
  });

  const cmvSeries = cmvSeriesDefs.map((def) => {
    const row = findOptionalRow(index, def.matches);
    const values = row
      ? readMonthValues(row.values, map).map((item) => ({ ...item, value: asPercent(item.value) }))
      : months.map((month) => ({ ...month, value: 0 }));
    return {
      key: def.key,
      label: def.label,
      sourceLabel: row ? row.label : def.label,
      color: def.color,
      values,
      accumulated: row ? readAccumulatedPercent(row.values, map, values) : 0
    };
  });

  return {
    statement,
    cmv: cmvSeries.find((item) => item.key === "general") || cmvSeries[0],
    cmvSeries
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
      const actual = parseNumber(actualRow.values[actualMap.accumulated]);
      const budget = parseNumber(budgetRow.values[budgetMap.accumulated]);
      const variance = actual - budget;
      return {
        key: def.key,
        label: def.label,
        values: actualValues.map((actualItem, index) => {
          const budgetItem = budgetValues[index];
          const itemVariance = actualItem.value - budgetItem.value;
          return {
            month: actualItem.month,
            label: actualItem.label,
            actual: actualItem.value,
            budget: budgetItem.value,
            variance: itemVariance,
            variancePct: budgetItem.value === 0 ? null : (itemVariance / Math.abs(budgetItem.value)) * 100
          };
        }),
        actual,
        budget,
        variance,
        variancePct: budget === 0 ? null : (variance / Math.abs(budget)) * 100
      };
    });
}

function buildYearComparison(years) {
  const keys = ["grossRevenue", "netRevenue", "grossResult", "expenses", "operatingResult", "finalResult"];
  return keys.map((key) => {
    const line2026 = lineByKey(years["2026"].statement, key);
    const line2025 = lineByKey(years["2025"].statement, key);
    const delta = line2026.accumulated - line2025.accumulated;
    return {
      key,
      label: line2026.label,
      value2025: line2025.accumulated,
      value2026: line2026.accumulated,
      delta,
      deltaPct: line2025.accumulated === 0 ? null : (delta / Math.abs(line2025.accumulated)) * 100
    };
  });
}

function buildCmvComparison(years) {
  const value2026 = years["2026"].cmv.accumulated;
  const value2025 = years["2025"].cmv.accumulated;
  const delta = value2026 - value2025;
  return {
    label: "CMV A&B",
    value2025,
    value2026,
    delta,
    deltaPct: value2025 === 0 ? null : (delta / Math.abs(value2025)) * 100
  };
}

function buildNetMargin(year) {
  const revenue = lineByKey(year.statement, "grossRevenue");
  const result = lineByKey(year.statement, "finalResult");
  return {
    value: revenue.accumulated === 0 ? 0 : (result.accumulated / revenue.accumulated) * 100,
    values: months.map((month, index) => {
      const rev = revenue.values[index].value;
      const res = result.values[index].value;
      return { ...month, value: rev === 0 ? 0 : (res / rev) * 100 };
    })
  };
}

function getRealizedMonths(statement) {
  const revenue = lineByKey(statement, "grossRevenue");
  const lastRevenueIndex = revenue.values.reduce((last, item, index) => Math.abs(item.value) > 0 ? index : last, -1);
  const lastIndex = Math.max(0, lastRevenueIndex);
  return months.slice(0, lastIndex + 1);
}

function render() {
  els.sourceLabel.textContent = dashboardData.source;
  els.updatedLabel.textContent = `Atualizado em ${new Date(dashboardData.updatedAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}`;

  const grossRevenue = getLine("grossRevenue");
  const expenses = getLine("expenses");
  const finalResult = getLine("finalResult");

  els.grossRevenueKpi.textContent = formatKpiMillions(grossRevenue.accumulated);
  els.expensesKpi.textContent = formatKpiMillions(expenses.accumulated);
  els.finalResultKpi.textContent = formatKpiMillions(finalResult.accumulated);
  els.cmvKpi.textContent = formatPercent(dashboardData.cmv.accumulated);
  els.netMarginKpi.textContent = formatPercent(dashboardData.netMargin.value);
  els.grossRevenueNote.textContent = `Acumulado oficial | mensal realizado até ${dashboardData.realizedMonths.at(-1).label}`;
  els.realizedRangeLabel.textContent = `Receita bruta, resultado bruto, despesas e resultado final até ${dashboardData.realizedMonths.at(-1).label}.`;

  renderStatement();
  renderComparison();
  renderWaterfallChart();
  renderTrendChart();
  renderBudgetChart();
  renderCmvChart();
}

function renderStatement() {
  const visibleMonths = dashboardData.realizedMonths;
  els.statementHead.innerHTML = `
    <tr>
      <th>Linha da DRE</th>
      ${visibleMonths.map((month) => `<th>${month.label}</th>`).join("")}
      <th>Acumulado</th>
    </tr>
  `;

  const rows = ["grossRevenue", "deductions", "netRevenue", "grossResult", "expenses", "operatingResult", "beforeTax", "finalResult"]
    .map((key) => getLine(key));

  els.statementBody.innerHTML = rows.map((line) => `
    <tr class="${line.key === "finalResult" ? "statement-row-total" : ""}">
      <td>
        <strong>${escapeHtml(line.label)}</strong>
        <small>${escapeHtml(line.sourceLabel)}</small>
      </td>
      ${visibleMonths.map((month) => `<td>${formatCurrency(line.values[monthIndex(month)].value)}</td>`).join("")}
      <td>${formatCurrency(line.accumulated)}</td>
    </tr>
  `).join("");
}

function renderComparison() {
  const rows = [...dashboardData.comparison, dashboardData.cmvComparison];
  els.comparisonHead.innerHTML = `
    <tr>
      <th>Linha</th>
      <th>2025</th>
      <th>2026</th>
      <th>Var.</th>
    </tr>
  `;

  els.comparisonBody.innerHTML = rows.map((line) => {
    const isCmv = line.label.includes("CMV");
    const formatter = isCmv ? formatPercent : formatCurrency;
    return `
      <tr class="${line.key === "finalResult" ? "statement-row-total" : ""}">
        <td><strong>${escapeHtml(line.label)}</strong></td>
        <td>${formatter(line.value2025)}</td>
        <td>${formatter(line.value2026)}</td>
        <td class="${line.delta < 0 ? "negative" : "positive"}">${isCmv ? formatPercent(line.delta) : formatCurrency(line.delta)}</td>
      </tr>
    `;
  }).join("");
}

function renderWaterfallChart() {
  const grossRevenue = getLine("grossRevenue").accumulated;
  const netRevenue = getLine("netRevenue").accumulated;
  const grossResult = getLine("grossResult").accumulated;
  const operatingResult = getLine("operatingResult").accumulated;
  const finalResult = getLine("finalResult").accumulated;

  const data = [
    { label: "Receita bruta", value: grossRevenue, total: true, color: palette.revenue },
    { label: "Deduções", value: netRevenue - grossRevenue, color: palette.expenses },
    { label: "CMV", value: grossResult - netRevenue, color: palette.costs },
    { label: "Despesas", value: operatingResult - grossResult, color: palette.expenses },
    { label: "Não operacional / impostos", value: finalResult - operatingResult, color: palette.beforeTax },
    { label: "Resultado final", value: finalResult, total: true, color: palette.result }
  ];

  drawWaterfall(els.waterfallChart, data);
}

function renderTrendChart() {
  const labels = dashboardData.realizedMonths.map((month) => month.label);
  const indexes = dashboardData.realizedMonths.map(monthIndex);
  const series = [
    { label: "Receita bruta", color: palette.revenue, values: indexes.map((index) => getLine("grossRevenue").values[index].value) },
    { label: "Resultado bruto", color: palette.costs, values: indexes.map((index) => getLine("grossResult").values[index].value) },
    { label: "Despesas", color: palette.expenses, values: indexes.map((index) => getLine("expenses").values[index].value) },
    { label: "Resultado final", color: palette.result, values: indexes.map((index) => getLine("finalResult").values[index].value) }
  ];
  drawGroupedColumns(els.trendChart, labels, series, compactCurrency, {
    emphasizeZero: true,
    highlightNegatives: true,
    labelNegativeValues: true,
    labelSeriesKeys: new Set(["Resultado final"])
  });
}

function renderBudgetChart() {
  const keys = ["grossRevenue", "expenses", "finalResult"];
  const rows = keys.map((key) => dashboardData.budgetComparison.find((line) => line.key === key)).filter(Boolean);
  drawHorizontalVariance(els.budgetChart, rows);
}

function renderCmvChart() {
  const labels = dashboardData.realizedMonths.map((month) => month.label);
  const indexes = dashboardData.realizedMonths.map(monthIndex);
  const series = dashboardData.cmvSeries.map((item) => ({
    label: item.label,
    color: item.color,
    values: indexes.map((index) => item.values[index].value)
  }));
  drawGroupedColumns(els.cmvChart, labels, series, formatPercent, { percent: true, showValues: true });
}

function drawWaterfall(canvas, data) {
  const ctx = setupCanvas(canvas);
  const { width, height } = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const w = width;
  const h = height || 390;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.scale(dpr, dpr);

  const padding = { top: 42, right: 28, bottom: 82, left: 72 };
  const chartW = w - padding.left - padding.right;
  const chartH = h - padding.top - padding.bottom;
  let running = 0;
  const extents = [0];
  data.forEach((item) => {
    if (item.total) {
      extents.push(item.value);
      running = item.value;
    } else {
      extents.push(running, running + item.value);
      running += item.value;
    }
  });
  const min = Math.min(0, ...extents);
  const max = Math.max(1, ...extents);
  const scale = (value) => padding.top + (max - value) / (max - min) * chartH;
  const zeroY = scale(0);
  const gap = 22;
  const barW = Math.max(54, (chartW - gap * (data.length - 1)) / data.length);

  drawYAxis(ctx, padding, chartW, chartH, min, max, compactCurrency);

  running = 0;
  data.forEach((item, index) => {
    const x = padding.left + index * (barW + gap);
    const start = item.total ? 0 : running;
    const end = item.total ? item.value : running + item.value;
    const y = scale(Math.max(start, end));
    const barH = Math.max(2, Math.abs(scale(start) - scale(end)));
    ctx.fillStyle = item.color;
    roundRect(ctx, x, y, barW, barH, 6);
    ctx.fill();

    if (!item.total && index > 0) {
      const prevX = padding.left + (index - 1) * (barW + gap) + barW;
      const connectorY = scale(start);
      ctx.strokeStyle = "#beb7aa";
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(prevX, connectorY);
      ctx.lineTo(x, connectorY);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.fillStyle = item.value < 0 ? palette.expenses : palette.ink;
    ctx.font = "800 12px Inter, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(compactCurrency(item.value), x + barW / 2, y - 8 < 14 ? y + 17 : y - 8);
    drawWrappedLabel(ctx, item.label, x + barW / 2, Math.max(zeroY, padding.top + chartH) + 24, barW + 18);

    running = end;
  });

  ctx.restore();
}

function drawGroupedColumns(canvas, labels, series, formatter, options = {}) {
  const ctx = setupCanvas(canvas);
  const { width, height } = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const w = width;
  const h = height || 320;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.scale(dpr, dpr);

  const allValues = series.flatMap((item) => item.values);
  const min = options.percent ? 0 : Math.min(0, ...allValues);
  const hasValueLabels = options.showValues || options.labelNegativeValues || options.labelSeriesKeys;
  const max = Math.max(1, ...allValues) * (hasValueLabels ? 1.16 : 1);
  const padding = {
    top: hasValueLabels ? 66 : 52,
    right: 24,
    bottom: options.emphasizeZero ? 92 : 76,
    left: options.emphasizeZero ? 78 : 62
  };
  const chartW = w - padding.left - padding.right;
  const chartH = h - padding.top - padding.bottom;
  const scale = (value) => padding.top + (max - value) / (max - min) * chartH;
  const zeroY = scale(0);
  const groupGap = 18;
  const groupW = Math.max(46, (chartW - groupGap * (labels.length - 1)) / labels.length);
  const barGap = 5;
  const barW = Math.max(9, (groupW - barGap * (series.length - 1)) / series.length);

  drawYAxis(ctx, padding, chartW, chartH, min, max, formatter);

  labels.forEach((label, monthIndex) => {
    const groupX = padding.left + monthIndex * (groupW + groupGap);
    series.forEach((item, seriesIndex) => {
      const rawValue = item.values[monthIndex] || 0;
      const y = rawValue >= 0 ? scale(rawValue) : zeroY;
      const barH = Math.max(2, Math.abs(scale(rawValue) - zeroY));
      const x = groupX + seriesIndex * (barW + barGap);
      const fill = options.highlightNegatives && rawValue < 0 ? palette.expenses : item.color;
      ctx.fillStyle = fill;
      roundRect(ctx, x, y, barW, barH, 5);
      ctx.fill();

      const shouldLabel = rawValue !== 0 && (
        options.showValues ||
        (options.labelNegativeValues && rawValue < 0 && item.label !== "Despesas") ||
        options.labelSeriesKeys?.has(item.label)
      );

      if (shouldLabel) {
        ctx.fillStyle = fill;
        ctx.font = "800 10px Inter, sans-serif";
        ctx.textAlign = "center";
        const labelY = rawValue >= 0 ? Math.max(14, y - 8) : Math.min(h - 12, y + barH + 14);
        ctx.fillText(formatter(rawValue), x + barW / 2, labelY);
      }
    });
    drawMonthLabel(ctx, label, groupX + groupW / 2, padding.top + chartH + 22);
  });

  if (options.emphasizeZero) {
    ctx.strokeStyle = "#a9a397";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(padding.left, zeroY);
    ctx.lineTo(padding.left + chartW, zeroY);
    ctx.stroke();
    ctx.lineWidth = 1;
  }

  drawLegend(ctx, series, padding.left, 22);
  ctx.restore();
}

function drawHorizontalVariance(canvas, rows) {
  const ctx = setupCanvas(canvas);
  const { width, height } = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const w = width;
  const h = height || 320;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.scale(dpr, dpr);

  const padding = { top: 30, right: 110, bottom: 36, left: Math.min(285, Math.max(220, w * 0.4)) };
  const chartW = w - padding.left - padding.right;
  const rowH = 70;
  const maxAbs = Math.max(1, ...rows.map((item) => Math.abs(item.variance))) * 1.15;
  const zeroX = padding.left + chartW / 2;
  const scale = (value) => zeroX + (value / maxAbs) * (chartW / 2);

  ctx.strokeStyle = palette.grid;
  ctx.beginPath();
  ctx.moveTo(zeroX, padding.top - 10);
  ctx.lineTo(zeroX, padding.top + rowH * rows.length);
  ctx.stroke();

  rows.forEach((row, index) => {
    const y = padding.top + index * rowH;
    const valueX = scale(row.variance);
    const x = Math.min(zeroX, valueX);
    const barW = Math.max(2, Math.abs(valueX - zeroX));
    ctx.fillStyle = row.variance >= 0 ? palette.revenue : palette.expenses;
    roundRect(ctx, x, y + 24, barW, 18, 8);
    ctx.fill();

    ctx.fillStyle = palette.ink;
    ctx.font = "800 13px Inter, sans-serif";
    ctx.textAlign = "right";
    drawRightAlignedLabel(ctx, row.label, padding.left - 18, y + 32, padding.left - 54);

    ctx.textAlign = row.variance >= 0 ? "left" : "center";
    ctx.fillStyle = row.variance >= 0 ? palette.revenue : palette.expenses;
    ctx.fillText(
      compactCurrency(row.variance),
      row.variance >= 0 ? Math.min(valueX + 10, w - 20) : x + barW / 2,
      row.variance >= 0 ? y + 38 : y + 20
    );

    ctx.fillStyle = palette.muted;
    ctx.font = "700 11px Inter, sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(`Real ${compactCurrency(row.actual)} | Orç ${compactCurrency(row.budget)}`, padding.left - 14, y + 45);
  });

  ctx.restore();
}

function drawRightAlignedLabel(ctx, label, x, y, maxWidth) {
  const words = label.split(" ");
  const lines = [];
  let line = "";

  words.forEach((word) => {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  });

  lines.push(line);
  lines.slice(0, 2).forEach((text, index) => ctx.fillText(text, x, y + index * 15));
}

function drawYAxis(ctx, padding, chartW, chartH, min, max, formatter) {
  ctx.strokeStyle = palette.grid;
  ctx.fillStyle = palette.muted;
  ctx.font = "11px Inter, sans-serif";
  ctx.textAlign = "right";
  [0, 0.25, 0.5, 0.75, 1].forEach((step) => {
    const value = min + (max - min) * step;
    const y = padding.top + chartH - chartH * step;
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(padding.left + chartW, y);
    ctx.stroke();
    ctx.fillText(formatter(value), padding.left - 8, y + 4);
  });
}

function drawLegend(ctx, series, x, y) {
  ctx.font = "800 12px Inter, sans-serif";
  let cursor = x;
  series.forEach((item) => {
    ctx.fillStyle = item.color;
    ctx.fillRect(cursor, y, 12, 12);
    ctx.fillStyle = "#495357";
    ctx.textAlign = "left";
    ctx.fillText(item.label, cursor + 18, y + 10);
    cursor += 24 + ctx.measureText(item.label).width + 18;
  });
}

function drawMonthLabel(ctx, label, x, y) {
  ctx.fillStyle = palette.muted;
  ctx.font = "800 12px Inter, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(label, x, y);
}

function drawWrappedLabel(ctx, label, x, y, maxWidth) {
  const words = label.split(" ");
  const lines = [];
  let line = "";
  words.forEach((word) => {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  });
  lines.push(line);
  ctx.fillStyle = palette.muted;
  ctx.font = "800 12px Inter, sans-serif";
  ctx.textAlign = "center";
  lines.slice(0, 2).forEach((text, index) => ctx.fillText(text, x, y + index * 15));
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

function readMonthValues(row, map) {
  return map.months.map((column, index) => ({
    month: months[index].key,
    label: months[index].label,
    value: parseNumber(row[column])
  }));
}

function readAccumulatedValue(row, map, values) {
  const direct = parseNumberOrNull(row[map.accumulated]);
  if (direct !== null) return direct;
  return values.reduce((sum, item) => sum + item.value, 0);
}

function readAccumulatedPercent(row, map, values) {
  const direct = parseNumberOrNull(row[map.accumulated]);
  const validValues = values.map((item) => item.value).filter((value) => value !== 0);
  if (direct !== null && (direct !== 0 || validValues.length === 0)) return asPercent(direct);
  if (!validValues.length) return 0;
  return validValues.reduce((sum, value) => sum + value, 0) / validValues.length;
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

function findOptionalRow(index, matches) {
  for (const match of matches) {
    const row = index.get(match);
    if (row) return row;
  }
  return null;
}

function getLine(key) {
  return lineByKey(dashboardData.statement, key);
}

function lineByKey(statement, key) {
  return statement.find((line) => line.key === key);
}

function monthIndex(month) {
  return months.findIndex((item) => item.key === month.key);
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
  return parseNumberOrNull(value) ?? 0;
}

function parseNumberOrNull(value) {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const raw = String(value).trim();
  if (!raw || raw === "-") return 0;
  if (raw.startsWith("#")) return null;
  const negative = /^\(.+\)$/.test(raw);
  const cleaned = raw
    .replace(/[R$\s%()]/g, "")
    .replace(/\.(?=\d{3}(\D|$))/g, "")
    .replace(",", ".")
    .replace(/[^\d.-]/g, "");
  if (!cleaned || cleaned === "-" || cleaned === ".") return 0;
  const parsed = Number(cleaned);
  if (!Number.isFinite(parsed)) return null;
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

function formatKpiMillions(value) {
  return compactCurrency(value);
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
