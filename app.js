const SHEET_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vQe1qVYU1Phvbnjs3-X1lSNYCvmZFz78TqSj4VowqilN6p_FdvqLxYoUboU8JhXh8IlBBsaOkH2cF61/pub?gid=814918860&single=true&output=csv";

const palette = ["#2f7d57", "#356b9a", "#b85661", "#c7922f", "#168184", "#7b5ea8", "#d06f3c", "#5b6770"];
const els = {
  searchInput: document.querySelector("#searchInput"),
  monthFilter: document.querySelector("#monthFilter"),
  categoryFilter: document.querySelector("#categoryFilter"),
  metricSelect: document.querySelector("#metricSelect"),
  statusBanner: document.querySelector("#statusBanner"),
  refreshButton: document.querySelector("#refreshButton"),
  downloadButton: document.querySelector("#downloadButton"),
  lastUpdated: document.querySelector("#lastUpdated"),
  kpiRows: document.querySelector("#kpiRows"),
  kpiRowsNote: document.querySelector("#kpiRowsNote"),
  kpiSum: document.querySelector("#kpiSum"),
  kpiSumNote: document.querySelector("#kpiSumNote"),
  kpiAvg: document.querySelector("#kpiAvg"),
  kpiCoverage: document.querySelector("#kpiCoverage"),
  kpiCoverageNote: document.querySelector("#kpiCoverageNote"),
  timelineSubtitle: document.querySelector("#timelineSubtitle"),
  categorySubtitle: document.querySelector("#categorySubtitle"),
  compositionSubtitle: document.querySelector("#compositionSubtitle"),
  tableSubtitle: document.querySelector("#tableSubtitle"),
  tableHead: document.querySelector("#tableHead"),
  tableBody: document.querySelector("#tableBody"),
  donutLegend: document.querySelector("#donutLegend")
};

let state = {
  rows: [],
  columns: [],
  profile: {},
  filteredRows: []
};

const sampleCsv = `Data,Unidade,Etapa,Status,Quantidade,Valor
2026-01-10,Escola Norte,Formacao,Concluido,42,12500
2026-02-15,Escola Sul,Acompanhamento,Em andamento,31,9800
2026-03-18,Escola Leste,Formacao,Concluido,58,17100
2026-04-09,Escola Oeste,Busca ativa,Pendente,19,4400
2026-05-23,Escola Norte,Acompanhamento,Concluido,36,11200`;

function parseCsv(text) {
  const rows = parseCsvRows(text);
  const headers = dedupeHeaders(rows.shift() || []);
  return rows.map((cells) => Object.fromEntries(headers.map((header, index) => [header, (cells[index] || "").trim()])));
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
      row.push(value);
      value = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(value);
      if (row.some((cell) => cell.trim() !== "")) rows.push(row);
      row = [];
      value = "";
    } else {
      value += char;
    }
  }

  row.push(value);
  if (row.some((cell) => cell.trim() !== "")) rows.push(row);
  return rows;
}

function transformCsv(text) {
  const matrix = parseCsvRows(text);
  if (looksLikeFinancialDre(matrix)) {
    return normalizeFinancialDre(matrix);
  }
  return parseCsv(text);
}

function looksLikeFinancialDre(matrix) {
  const header = (matrix[1] || []).join(" ").toLowerCase();
  const body = matrix.slice(0, 12).flat().join(" ").toLowerCase();
  return header.includes("2025 x 2026") && body.includes("receita operacional");
}

function normalizeFinancialDre(matrix) {
  const header = matrix[1] || [];
  const monthColumns = [];
  const monthNames = {
    jan: "Janeiro",
    fev: "Fevereiro",
    mar: "Marco",
    abr: "Abril",
    mai: "Maio",
    jun: "Junho",
    jul: "Julho",
    ago: "Agosto",
    set: "Setembro",
    out: "Outubro",
    nov: "Novembro",
    dez: "Dezembro"
  };

  header.forEach((cell, index) => {
    const lower = String(cell || "").toLowerCase();
    const match = lower.match(/(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)[a-z.]*-?26/);
    if (match) {
      monthColumns.push({ index, key: match[1], label: monthNames[match[1]] });
    }
  });

  const rows = [];
  let currentGroup = "DRE";

  matrix.slice(3).forEach((line) => {
    const account = String(line[1] || "").trim();
    if (!account) return;
    if (/^\s*[\(\+=-]/.test(account)) {
      currentGroup = cleanAccount(account);
    }

    monthColumns.forEach(({ index, label }, monthIndex) => {
      const realized2026 = line[index] || "";
      const realized2025 = line[index + 1] || "";
      const variation = line[index + 2] || "";
      const budget = monthIndex === 0 ? line[index + 3] || "" : "";
      const budgetVariation = monthIndex === 0 ? line[index + 4] || "" : "";

      if (!realized2026 && !realized2025 && !variation && !budget) return;

      rows.push({
        Data: `2026-${String(monthIndex + 1).padStart(2, "0")}-01`,
        Mes: label,
        Conta: cleanAccount(account),
        Grupo: currentGroup,
        Nivel: accountDepth(account),
        Tipo: accountType(account, currentGroup),
        "Realizado 2026": realized2026,
        "Realizado 2025": realized2025,
        "Variacao 25/26": variation,
        Orcado: budget,
        "Orcado x Realizado": budgetVariation,
        "Media 2025": line[2] || "",
        Acumulado: line[52] || "",
        Media: line[55] || "",
        "Variacao Media 25/26": line[56] || ""
      });
    });
  });

  return rows;
}

function cleanAccount(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function accountDepth(account) {
  const code = String(account || "").match(/^(\d+(?:\.\d+)*)/);
  return code ? code[1].split(".").length : 0;
}

function accountType(account, group) {
  const text = `${account} ${group}`.toLowerCase();
  if (text.includes("receita")) return "Receita";
  if (text.includes("custo")) return "Custo";
  if (text.includes("despesa")) return "Despesa";
  if (text.includes("lucro") || text.includes("resultado")) return "Resultado";
  if (text.includes("devolu")) return "Devolucao";
  return "Outros";
}

function dedupeHeaders(headers) {
  const seen = new Map();
  return headers.map((header, index) => {
    const base = (header || `Coluna ${index + 1}`).trim();
    const count = seen.get(base) || 0;
    seen.set(base, count + 1);
    return count ? `${base} ${count + 1}` : base;
  });
}

function parseNumber(value) {
  if (value === null || value === undefined) return NaN;
  const raw = String(value).trim();
  if (!raw) return NaN;
  if (/^[-–—]+$/.test(raw) || raw.startsWith("#")) return NaN;
  const negative = /^\(.+\)$/.test(raw);
  const cleaned = raw
    .replace(/[R$\s%()]/g, "")
    .replace(/\.(?=\d{3}(\D|$))/g, "")
    .replace(",", ".")
    .replace(/[^\d.-]/g, "");
  if (!cleaned || cleaned === "-" || cleaned === ".") return NaN;
  const parsed = Number(cleaned);
  return negative ? -Math.abs(parsed) : parsed;
}

function parseDate(value) {
  const text = String(value || "").trim();
  if (!text) return null;
  const br = text.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})/);
  if (br) {
    const year = br[3].length === 2 ? Number(`20${br[3]}`) : Number(br[3]);
    const date = new Date(year, Number(br[2]) - 1, Number(br[1]));
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const iso = new Date(text);
  return Number.isNaN(iso.getTime()) ? null : iso;
}

function profileData(rows) {
  const columns = Object.keys(rows[0] || {});
  const dateColumns = [];
  const numericColumns = [];
  const categoryColumns = [];

  columns.forEach((column) => {
    const values = rows.map((row) => row[column]).filter(Boolean);
    const sample = values.slice(0, 80);
    const numericHits = sample.filter((value) => Number.isFinite(parseNumber(value))).length;
    const dateHits = sample.filter((value) => parseDate(value)).length;
    const uniqueCount = new Set(values).size;
    const lower = column.toLowerCase();

    if (dateHits >= Math.max(2, sample.length * 0.45) || /data|mes|mês|periodo|período/.test(lower)) {
      dateColumns.push(column);
    }
    if (numericHits >= Math.max(2, sample.length * 0.55)) {
      numericColumns.push(column);
    }
    if (uniqueCount > 1 && uniqueCount <= Math.max(30, rows.length * 0.55) && numericHits < sample.length * 0.5) {
      categoryColumns.push(column);
    }
  });

  const preferredCategory =
    categoryColumns.find((column) => /unidade|escola|dre|setor|categoria|etapa|status|tipo|grupo/i.test(column)) ||
    categoryColumns[0] ||
    columns.find((column) => !numericColumns.includes(column) && !dateColumns.includes(column));

  const preferredMetric =
    numericColumns.find((column) => /valor|total|quant|qtd|matricula|matrícula|frequencia|frequência|meta|realizado/i.test(column)) ||
    numericColumns[0];

  return { columns, dateColumn: dateColumns[0], numericColumns, categoryColumns, preferredCategory, preferredMetric };
}

async function loadData() {
  showStatus("Carregando dados da planilha...");
  try {
    const response = await fetch("/api/data");
    if (!response.ok) throw new Error("A rota local de dados ainda nao esta ativa.");
    const text = await response.text();
      setRows(transformCsv(text));
    hideStatus();
  } catch (firstError) {
    try {
      const direct = await fetch(SHEET_CSV_URL);
      if (!direct.ok) throw new Error("Leitura direta bloqueada.");
      setRows(transformCsv(await direct.text()));
      hideStatus();
    } catch (secondError) {
      setRows(parseCsv(sampleCsv));
      showStatus("Nao consegui acessar a planilha neste ambiente local. Estou exibindo dados de exemplo; na Vercel, a rota /api/data busca a planilha publicada automaticamente.");
    }
  }
}

function setRows(rows) {
  state.rows = rows;
  state.columns = Object.keys(rows[0] || {});
  state.profile = profileData(rows);
  state.filteredRows = rows;
  setupFilters();
  render();
  els.lastUpdated.textContent = `Atualizado em ${new Date().toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}`;
}

function setupFilters() {
  const { numericColumns, categoryColumns, preferredMetric, preferredCategory, dateColumn } = state.profile;
  fillSelect(els.metricSelect, numericColumns.map((column) => [column, column]), preferredMetric);
  fillSelect(els.categoryFilter, [["__all", "Todos os grupos"]], "__all");

  const category = preferredCategory;
  els.categoryFilter.dataset.column = category || "";
  if (category) {
    const options = [...new Set(state.rows.map((row) => row[category]).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, "pt-BR"))
      .slice(0, 300)
      .map((value) => [value, value]);
    fillSelect(els.categoryFilter, [["__all", `Todos em ${category}`], ...options], "__all");
  }

  const monthOptions = [["__all", "Todos os periodos"]];
  if (dateColumn) {
    const months = [...new Set(state.rows.map((row) => monthKey(parseDate(row[dateColumn]))).filter(Boolean))].sort();
    monthOptions.push(...months.map((key) => [key, formatMonthKey(key)]));
  }
  fillSelect(els.monthFilter, monthOptions, "__all");

  if (!numericColumns.length) {
    fillSelect(els.metricSelect, [["__count", "Contagem de registros"]], "__count");
  }
  if (!categoryColumns.length && !preferredCategory) {
    fillSelect(els.categoryFilter, [["__all", "Todos os registros"]], "__all");
  }
}

function fillSelect(select, options, selected) {
  select.innerHTML = options.map(([value, label]) => `<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`).join("");
  select.value = selected || options[0]?.[0] || "";
}

function applyFilters() {
  const query = els.searchInput.value.trim().toLowerCase();
  const categoryColumn = els.categoryFilter.dataset.column;
  const categoryValue = els.categoryFilter.value;
  const monthValue = els.monthFilter.value;
  const dateColumn = state.profile.dateColumn;

  state.filteredRows = state.rows.filter((row) => {
    const matchesQuery = !query || state.columns.some((column) => String(row[column] || "").toLowerCase().includes(query));
    const matchesCategory = !categoryColumn || categoryValue === "__all" || row[categoryColumn] === categoryValue;
    const matchesMonth = monthValue === "__all" || monthKey(parseDate(row[dateColumn])) === monthValue;
    return matchesQuery && matchesCategory && matchesMonth;
  });
}

function render() {
  applyFilters();
  renderKpis();
  renderTimeline();
  renderCategoryChart();
  renderDonut();
  renderTable();
}

function renderKpis() {
  const metric = els.metricSelect.value;
  const values = metric === "__count" ? [] : state.filteredRows.map((row) => parseNumber(row[metric])).filter(Number.isFinite);
  const sum = values.reduce((total, value) => total + value, 0);
  const avg = values.length ? sum / values.length : state.filteredRows.length;
  const coverage = metric === "__count" ? 100 : Math.round((values.length / Math.max(1, state.filteredRows.length)) * 100);

  els.kpiRows.textContent = formatNumber(state.filteredRows.length);
  els.kpiRowsNote.textContent = `${formatNumber(state.rows.length)} no total da planilha`;
  els.kpiSum.textContent = metric === "__count" ? formatNumber(state.filteredRows.length) : formatNumber(sum);
  els.kpiSumNote.textContent = metric === "__count" ? "Contagem de linhas filtradas" : metric;
  els.kpiAvg.textContent = formatNumber(avg);
  els.kpiCoverage.textContent = `${coverage}%`;
  els.kpiCoverageNote.textContent = metric === "__count" ? "Base de registros" : "Registros com valor numerico";
}

function renderTimeline() {
  const dateColumn = state.profile.dateColumn;
  const metric = els.metricSelect.value;
  const groups = new Map();

  state.filteredRows.forEach((row) => {
    const key = dateColumn ? monthKey(parseDate(row[dateColumn])) : "2026";
    const label = key || "Sem periodo";
    groups.set(label, (groups.get(label) || 0) + metricValue(row, metric));
  });

  const data = [...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => ({
    label: key === "2026" ? "2026" : formatMonthKey(key),
    value
  }));

  els.timelineSubtitle.textContent = dateColumn ? `Agrupado por ${dateColumn}` : "Sem coluna de data identificada; exibindo consolidado";
  drawBarChart(document.querySelector("#timelineChart"), data, { horizontal: false, color: "#356b9a" });
}

function renderCategoryChart() {
  const categoryColumn = state.profile.preferredCategory;
  const metric = els.metricSelect.value;
  const data = aggregateBy(categoryColumn, metric).slice(0, 8);
  els.categorySubtitle.textContent = categoryColumn ? `Campo: ${categoryColumn}` : "Sem grupo identificado";
  drawBarChart(document.querySelector("#categoryChart"), data, { horizontal: true, color: "#2f7d57" });
}

function renderDonut() {
  const categoryColumn = state.profile.preferredCategory;
  const metric = els.metricSelect.value;
  const data = aggregateBy(categoryColumn, metric).slice(0, 6);
  els.compositionSubtitle.textContent = categoryColumn ? `Participacao por ${categoryColumn}` : "Distribuicao dos registros";
  drawDonutChart(document.querySelector("#donutChart"), data);
  els.donutLegend.innerHTML = data.map((item, index) => `
    <div class="legend-row">
      <span class="legend-dot" style="background:${palette[index % palette.length]}"></span>
      <span>${escapeHtml(item.label)}</span>
      <strong>${formatNumber(item.value)}</strong>
    </div>
  `).join("");
}

function aggregateBy(column, metric) {
  const groups = new Map();
  state.filteredRows.forEach((row) => {
    const label = column ? row[column] || "Sem informacao" : "Registros";
    groups.set(label, (groups.get(label) || 0) + metricValue(row, metric));
  });
  return [...groups.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);
}

function metricValue(row, metric) {
  if (!metric || metric === "__count") return 1;
  const value = parseNumber(row[metric]);
  return Number.isFinite(value) ? value : 0;
}

function renderTable() {
  const preferred = [
    state.profile.dateColumn,
    state.profile.preferredCategory,
    ...state.profile.categoryColumns,
    ...state.profile.numericColumns
  ].filter(Boolean);
  const columns = [...new Set(preferred)].slice(0, 8);
  const tableColumns = columns.length ? columns : state.columns.slice(0, 8);
  const rows = state.filteredRows.slice(0, 60);

  els.tableSubtitle.textContent = `${formatNumber(state.filteredRows.length)} registros filtrados; exibindo ate 60 linhas`;
  els.tableHead.innerHTML = `<tr>${tableColumns.map((column) => `<th>${escapeHtml(column)}</th>`).join("")}</tr>`;
  els.tableBody.innerHTML = rows.map((row) => `
    <tr>${tableColumns.map((column) => `<td>${escapeHtml(row[column] || "")}</td>`).join("")}</tr>
  `).join("");
}

function drawBarChart(canvas, data, options = {}) {
  const ctx = setupCanvas(canvas);
  const { width, height } = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const w = width;
  const h = height || 320;
  ctx.clearRect(0, 0, w * dpr, h * dpr);
  ctx.save();
  ctx.scale(dpr, dpr);

  const max = Math.max(1, ...data.map((item) => item.value));
  const padding = options.horizontal ? { top: 10, right: 74, bottom: 18, left: 118 } : { top: 20, right: 18, bottom: 58, left: 52 };
  const chartW = w - padding.left - padding.right;
  const chartH = h - padding.top - padding.bottom;

  ctx.font = "12px Inter, sans-serif";
  ctx.fillStyle = "#667276";
  ctx.strokeStyle = "#e2e5df";
  ctx.lineWidth = 1;

  if (!data.length) {
    ctx.fillText("Sem dados para os filtros atuais", padding.left, padding.top + 24);
    ctx.restore();
    return;
  }

  if (options.horizontal) {
    const gap = 10;
    const barH = Math.max(18, (chartH - gap * (data.length - 1)) / data.length);
    data.forEach((item, index) => {
      const y = padding.top + index * (barH + gap);
      const barW = (item.value / max) * chartW;
      ctx.fillStyle = "#59666a";
      ctx.fillText(truncate(item.label, 16), 0, y + barH * 0.65);
      ctx.fillStyle = options.color || palette[index % palette.length];
      roundRect(ctx, padding.left, y, barW, barH, 6);
      ctx.fill();
      ctx.fillStyle = "#1d2528";
      ctx.fillText(formatNumber(item.value), padding.left + barW + 8, y + barH * 0.65);
    });
  } else {
    const gap = 12;
    const barW = Math.max(18, (chartW - gap * (data.length - 1)) / Math.max(1, data.length));
    [0, 0.25, 0.5, 0.75, 1].forEach((step) => {
      const y = padding.top + chartH - chartH * step;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(padding.left + chartW, y);
      ctx.stroke();
    });
    data.forEach((item, index) => {
      const x = padding.left + index * (barW + gap);
      const barH = (item.value / max) * chartH;
      const y = padding.top + chartH - barH;
      ctx.fillStyle = options.color || palette[index % palette.length];
      roundRect(ctx, x, y, barW, barH, 6);
      ctx.fill();
      ctx.save();
      ctx.translate(x + barW / 2, padding.top + chartH + 18);
      ctx.rotate(-Math.PI / 5);
      ctx.fillStyle = "#667276";
      ctx.textAlign = "right";
      ctx.fillText(truncate(item.label, 12), 0, 0);
      ctx.restore();
    });
  }
  ctx.restore();
}

function drawDonutChart(canvas, data) {
  const ctx = setupCanvas(canvas);
  const { width, height } = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const w = width;
  const h = height || 260;
  ctx.clearRect(0, 0, w * dpr, h * dpr);
  ctx.save();
  ctx.scale(dpr, dpr);

  const total = data.reduce((sum, item) => sum + item.value, 0);
  const cx = w / 2;
  const cy = h / 2;
  const radius = Math.min(w, h) / 2 - 14;
  let angle = -Math.PI / 2;

  if (!total) {
    ctx.fillStyle = "#667276";
    ctx.textAlign = "center";
    ctx.fillText("Sem dados", cx, cy);
    ctx.restore();
    return;
  }

  data.forEach((item, index) => {
    const slice = (item.value / total) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, radius, angle, angle + slice);
    ctx.closePath();
    ctx.fillStyle = palette[index % palette.length];
    ctx.fill();
    angle += slice;
  });

  ctx.beginPath();
  ctx.arc(cx, cy, radius * 0.58, 0, Math.PI * 2);
  ctx.fillStyle = "#fffdf8";
  ctx.fill();
  ctx.fillStyle = "#1d2528";
  ctx.font = "700 22px Inter, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(formatNumber(total), cx, cy + 7);
  ctx.restore();
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

function monthKey(date) {
  if (!date) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function formatMonthKey(key) {
  const [year, month] = key.split("-").map(Number);
  if (!year || !month) return key;
  return new Date(year, month - 1, 1).toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
}

function formatNumber(value) {
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: value > 100 ? 0 : 1 }).format(value || 0);
}

function truncate(text, max) {
  const clean = String(text || "");
  return clean.length > max ? `${clean.slice(0, max - 1)}...` : clean;
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

function showStatus(message) {
  els.statusBanner.hidden = false;
  els.statusBanner.textContent = message;
}

function hideStatus() {
  els.statusBanner.hidden = true;
  els.statusBanner.textContent = "";
}

function downloadFilteredCsv() {
  const rows = state.filteredRows;
  const csv = [
    state.columns.map(csvCell).join(","),
    ...rows.map((row) => state.columns.map((column) => csvCell(row[column])).join(","))
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "dashboard-filtrado-2026.csv";
  link.click();
  URL.revokeObjectURL(url);
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

[els.searchInput, els.monthFilter, els.categoryFilter, els.metricSelect].forEach((element) => {
  element.addEventListener("input", render);
  element.addEventListener("change", render);
});

els.refreshButton.addEventListener("click", loadData);
els.downloadButton.addEventListener("click", downloadFilteredCsv);
window.addEventListener("resize", () => render());

loadData();
