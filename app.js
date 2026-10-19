const BILLION_TOMAN = 1e10;
const nf = new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 1 });
const smallNf = new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 3 });
const pf = new Intl.NumberFormat('fa-IR', { style: 'percent', maximumFractionDigits: 1 });
const integer = new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 0 });
const COLORS = { blue: '#1776d2', teal: '#0b9b88', slate: '#b7c4d3', indigo: '#5266a8', amber: '#da9638', red: '#d35f63' };
const MONTHS = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];
let source;
let selectedYear;
let selectedMonth = 'all';

const el = id => document.getElementById(id);
const field = (row, name, fallback = 0) => row?.[name] ?? row?.[`[${name}]`] ?? row?.[Object.keys(row || {}).find(key => key.endsWith(`[${name}]`))] ?? fallback;
const num = value => Number(value || 0);
const amount = value => num(value) / BILLION_TOMAN;
const fmt = value => nf.format(value);
const fmtMoney = value => { const converted = amount(value); return converted !== 0 && Math.abs(converted) < .05 ? smallNf.format(converted) : nf.format(converted); };
const fmtPct = (numerator, denominator) => denominator ? pf.format(numerator / denominator) : '—';
const setText = (id, text) => { el(id).textContent = text; };
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
const monthKey = row => { const key = String(field(row, 'monthSort')); return `${key.slice(0, 4)}/${key.slice(4, 6)}`; };
const monthName = row => { const key = String(field(row, 'monthSort')); return `${MONTHS[Number(key.slice(4, 6)) - 1] || key.slice(4, 6)} ${integer.format(Number(key.slice(0, 4)))}`; };
const sum = (rows, key) => rows.reduce((total, row) => total + num(field(row, key)), 0);
const currentYear = row => String(field(row, 'monthSort')).slice(0, 4);
const monthNumber = row => Number(String(field(row, 'monthSort')).slice(4, 6));
const yearRows = () => source.financialKpi.filter(row => currentYear(row) === selectedYear);
const visibleRows = () => selectedMonth === 'all' ? yearRows() : yearRows().filter(row => monthNumber(row) === Number(selectedMonth));
const referenceRow = () => selectedMonth === 'all' ? yearRows().at(-1) : visibleRows()[0];

function periodRows() {
  const limit = num(field(referenceRow(), 'monthSort'));
  return source.financialKpi.filter(row => num(field(row, 'monthSort')) <= limit);
}

function balanceMetrics(rows) {
  const currentAssets = sum(rows, 'currentAssetsActivity');
  const nonCurrentAssets = sum(rows, 'nonCurrentAssetsActivity');
  const currentLiabilities = sum(rows, 'currentLiabilitiesActivity');
  const nonCurrentLiabilities = sum(rows, 'nonCurrentLiabilitiesActivity');
  const equity = sum(rows, 'equityActivity') + sum(rows, 'unclosedProfitLossActivity');
  return { currentAssets, nonCurrentAssets, currentLiabilities, nonCurrentLiabilities, equity,
    assets: currentAssets + nonCurrentAssets, liabilities: currentLiabilities + nonCurrentLiabilities,
    workingCapital: currentAssets - currentLiabilities };
}

function monthMetrics(row) {
  const sales = num(field(row, 'netSales'));
  const cogs = num(field(row, 'costOfGoodsSold'));
  const operatingExpense = num(field(row, 'operatingExpense'));
  const financeCost = num(field(row, 'financeCost'));
  const otherIncome = num(field(row, 'otherIncome'));
  return { sales, cogs, operatingExpense, financeCost, otherIncome,
    operatingProfit: sales - cogs - operatingExpense,
    pretaxProfit: sales - cogs - operatingExpense - financeCost + otherIncome,
    revenue: sales + otherIncome, expenses: cogs + operatingExpense + financeCost };
}

function periodMetrics(rows) {
  const sales = sum(rows, 'netSales');
  const cogs = sum(rows, 'costOfGoodsSold');
  const operatingExpense = sum(rows, 'operatingExpense');
  const financeCost = sum(rows, 'financeCost');
  const otherIncome = sum(rows, 'otherIncome');
  return { sales, cogs, operatingExpense, financeCost, otherIncome,
    operatingProfit: sales - cogs - operatingExpense,
    pretaxProfit: sales - cogs - operatingExpense - financeCost + otherIncome,
    revenue: sales + otherIncome, expenses: cogs + operatingExpense + financeCost };
}

function groupedBarChart(targetId, rows, series) {
  const target = el(targetId);
  if (!rows.length) { target.innerHTML = '<div class="empty-state">داده‌ای برای نمایش وجود ندارد</div>'; return; }
  const byMonth = new Map(rows.map(row => [monthNumber(row), row]));
  const count = Math.max(...byMonth.keys());
  const slots = Array.from({ length: count }, (_, index) => ({ month: index + 1, row: byMonth.get(index + 1) || null }));
  const values = slots.flatMap(slot => slot.row ? series.map(item => amount(item.value(slot.row))) : []);
  const rawMin = Math.min(0, ...values), rawMax = Math.max(0, ...values);
  const roughStep = Math.max(.1, (rawMax - rawMin) / 4);
  const power = 10 ** Math.floor(Math.log10(roughStep));
  const step = [1, 2, 2.5, 5, 10].map(factor => factor * power).find(candidate => candidate >= roughStep) || 10 * power;
  const min = Math.floor(rawMin / step) * step;
  const max = Math.max(step, Math.ceil(rawMax / step) * step);
  const width = 760, height = 304, x0 = 56, x1 = 746, yTop = 30, yBottom = 260;
  const band = (x1 - x0) / slots.length;
  const x = index => x0 + band * (index + .5);
  const y = value => yBottom - (value - min) / (max - min) * (yBottom - yTop);
  const ticks = Math.round((max - min) / step);
  const grid = Array.from({ length: ticks + 1 }, (_, index) => {
    const value = min + step * index;
    const cy = y(value);
    return `<line x1="${x0}" x2="${x1}" y1="${cy}" y2="${cy}" class="${Math.abs(value) < step / 100 ? 'chart-zero' : 'chart-grid'}"/><text x="${x0 - 8}" y="${cy + 4}" text-anchor="end" class="chart-axis-y">${fmt(value)}</text>`;
  }).join('');
  const selection = selectedMonth === 'all' ? '' : `<rect x="${x(Number(selectedMonth) - 1) - band / 2 + 2}" y="${yTop}" width="${band - 4}" height="${yBottom - yTop}" fill="#eaf4ff"/>`;
  const barWidth = Math.min(23, band * .28);
  const gap = 4;
  const bars = slots.map((slot, index) => {
    if (!slot.row) return '';
    return series.map((item, seriesIndex) => {
      const value = amount(item.value(slot.row));
      const top = Math.min(y(value), y(0));
      const barHeight = Math.max(1, Math.abs(y(0) - y(value)));
      const left = x(index) + (seriesIndex === 0 ? -barWidth - gap / 2 : gap / 2);
      const opacity = selectedMonth !== 'all' && Number(selectedMonth) !== slot.month ? .4 : .9;
      const labelY = value >= 0 ? Math.max(yTop + 10, top - 7) : Math.min(height - 27, top + barHeight + 13);
      const label = slots.length <= 7 && Math.abs(value) >= .05 ? `<text x="${left + barWidth / 2}" y="${labelY}" text-anchor="middle" style="fill:${item.color}" class="chart-bar-label">${fmt(value)}</text>` : '';
      return `<rect x="${left}" y="${top}" width="${barWidth}" height="${barHeight}" rx="2" fill="${item.color}" opacity="${opacity}" class="chart-bar"><title>${monthName(slot.row)} · ${item.name}: ${fmt(value)} میلیارد تومان</title></rect>${label}`;
    }).join('');
  }).join('');
  const labels = slots.map((slot, index) => `<text x="${x(index)}" y="${height - 13}" text-anchor="middle" class="chart-axis ${Number(selectedMonth) === slot.month ? 'chart-axis-selected' : ''}">${MONTHS[index]}</text>`).join('');
  target.innerHTML = `<svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" role="img" aria-label="نمودار میله‌ای ${escapeHtml(series.map(item => item.name).join(' و '))} در سال ${selectedYear}"><text x="${x0}" y="14" class="chart-unit">میلیارد تومان</text>${selection}${grid}${bars}${labels}</svg>`;
}

function renderBalance(metrics) {
  const items = [
    ['دارایی جاری', metrics.currentAssets, COLORS.blue],
    ['دارایی غیرجاری', metrics.nonCurrentAssets, '#7cb6e9'],
    ['بدهی جاری', metrics.currentLiabilities, COLORS.indigo],
    ['بدهی غیرجاری', metrics.nonCurrentLiabilities, '#a0add0'],
    ['حقوق صاحبان سهام', metrics.equity, COLORS.teal]
  ];
  const scale = Math.max(1, ...items.map(item => Math.abs(item[1])));
  el('balance-chart').innerHTML = items.map(([name, value, color]) => `<div class="balance-item"><span class="balance-item-name">${name}</span><div class="balance-track"><div class="balance-fill" style="width:${Math.max(value ? 1 : 0, Math.abs(value) / scale * 100)}%;background:${color}"></div></div><strong class="balance-value">${fmtMoney(value)}</strong></div>`).join('') + '<div class="balance-foot">مقیاس همهٔ نوارها یکسان است. مقادیر از گردش حساب‌ها تا دوره انتخابی جمع شده‌اند.</div>';
}

function renderBreakdown(metrics) {
  const items = [
    ['فروش خالص', metrics.sales, COLORS.blue],
    ['بهای تمام‌شده', -metrics.cogs, COLORS.red],
    ['هزینه عملیاتی', -metrics.operatingExpense, COLORS.red],
    ['سایر درآمدها', metrics.otherIncome, COLORS.teal],
    ['هزینه مالی', -metrics.financeCost, COLORS.red]
  ];
  const scale = Math.max(1, ...items.map(item => Math.abs(item[1])));
  el('pnl-breakdown').innerHTML = items.map(([name, value, color]) => `<div class="breakdown-row"><span class="breakdown-name">${name}</span><div class="breakdown-track"><span class="breakdown-fill" style="width:${Math.max(value ? 1 : 0, Math.abs(value) / scale * 100)}%;background:${color}"></span></div><strong class="breakdown-value">${value > 0 ? '+' : ''}${fmtMoney(value)}</strong></div>`).join('') + `<div class="breakdown-foot"><span>سود پیش از مالیات</span><strong>${fmtMoney(metrics.pretaxProfit)}</strong></div>`;
}

function renderPnlTable(metrics) {
  const months = visibleRows();
  const monthly = months.map(monthMetrics);
  const showTotal = selectedMonth === 'all' && months.length > 1;
  const lines = [
    ['فروش خالص', item => item.sales, 'income'],
    ['بهای تمام‌شده', item => -item.cogs, 'expense'],
    ['سود ناخالص', item => item.sales - item.cogs, 'subtotal'],
    ['هزینه‌های عملیاتی', item => -item.operatingExpense, 'expense'],
    ['سود عملیاتی', item => item.operatingProfit, 'subtotal'],
    ['سایر درآمدها', item => item.otherIncome, 'income'],
    ['هزینه مالی', item => -item.financeCost, 'expense'],
    ['سود پیش از مالیات', item => item.pretaxProfit, 'grand']
  ];
  const table = el('pnl-table').closest('table');
  table.style.minWidth = `${210 + months.length * 112 + (showTotal ? 125 : 0)}px`;
  el('pnl-table-head').innerHTML = `<tr><th scope="col" class="matrix-label">شرح</th>${months.map(row => `<th scope="col" class="numeric ${selectedMonth !== 'all' ? 'matrix-selected' : ''}">${MONTHS[monthNumber(row) - 1]}</th>`).join('')}${showTotal ? '<th scope="col" class="numeric matrix-total-col">جمع دوره</th>' : ''}</tr>`;
  el('pnl-table').innerHTML = lines.map(([name, getValue, type]) => `<tr class="statement-${type}"><th scope="row" class="matrix-label">${name}</th>${monthly.map(item => `<td class="numeric ${selectedMonth !== 'all' ? 'matrix-selected' : ''}">${fmtMoney(getValue(item))}</td>`).join('')}${showTotal ? `<td class="numeric matrix-total-col">${fmtMoney(getValue(metrics))}</td>` : ''}</tr>`).join('');
}

function budgetMonthlyRows() {
  const lookup = new Map(source.financialKpi.map(row => [monthKey(row), row]));
  return source.budget.map(row => {
    const period = String(field(row, 'period', ''));
    const actual = lookup.get(period);
    const monthly = actual ? monthMetrics(actual) : null;
    const revenueValue = field(row, 'revenue', null);
    const expenseValue = field(row, 'expenses', null);
    const revenueBudget = revenueValue === null ? null : num(revenueValue);
    const expenseBudget = expenseValue === null ? null : num(expenseValue);
    return { period, revenueBudget, expenseBudget, profitBudget: revenueBudget === null || expenseBudget === null ? null : revenueBudget - expenseBudget,
      revenueActual: monthly?.revenue ?? null, expenseActual: monthly?.expenses ?? null, profitActual: monthly?.pretaxProfit ?? null };
  });
}

function budgetChart(targetId, rows, budgetKey, actualKey) {
  const target = el(targetId);
  if (!rows.length) { target.innerHTML = '<div class="empty-state">بودجه‌ای برای نمایش وجود ندارد</div>'; return; }
  const all = rows.flatMap(row => [row[budgetKey] === null ? null : amount(row[budgetKey]), row[actualKey] === null ? null : amount(row[actualKey])]).filter(value => value !== null);
  let min = Math.min(0, ...all), max = Math.max(0, ...all);
  if (min === max) max = min + 1;
  max += (max - min) * .08;
  if (min < 0) min -= (max - min) * .05;
  const width = 480, height = 280, x0 = 35, x1 = 467, y0 = 14, y1 = 245;
  const y = value => y1 - (value - min) / (max - min) * (y1 - y0);
  const groupWidth = (x1 - x0) / rows.length;
  const barWidth = Math.min(11, groupWidth * .27);
  const grid = Array.from({ length: 4 }, (_, index) => { const tick = min + (max - min) * index / 3; const cy = y(tick); return `<line x1="${x0}" x2="${x1}" y1="${cy}" y2="${cy}" class="chart-grid"/><text x="${x0 - 4}" y="${cy + 3}" text-anchor="end" class="chart-axis-y">${fmt(tick)}</text>`; }).join('');
  const highlight = selectedMonth === 'all' ? '' : `<rect x="${x0 + groupWidth * (Number(selectedMonth) - 1) + 2}" y="${y0}" width="${groupWidth - 4}" height="${y1 - y0}" fill="#eaf4ff"/>`;
  const bars = rows.map((row, index) => {
    const center = x0 + groupWidth * (index + .5);
    const budget = row[budgetKey] === null ? null : amount(row[budgetKey]);
    const actual = row[actualKey] === null ? null : amount(row[actualKey]);
    const opacity = selectedMonth !== 'all' && Number(selectedMonth) !== Number(row.period.slice(5)) ? .35 : 1;
    const rect = (value, x, color, type) => { const top = Math.min(y(0), y(value)); const barHeight = Math.max(1, Math.abs(y(value) - y(0))); return `<rect x="${x}" y="${top}" width="${barWidth}" height="${barHeight}" fill="${color}" opacity="${opacity}" class="chart-bar"><title>${row.period} · ${type}: ${fmt(value)} میلیارد تومان</title></rect>`; };
    return (budget === null ? '' : rect(budget, center - barWidth - 1, COLORS.slate, 'بودجه')) + (actual === null ? '' : rect(actual, center + 1, COLORS.blue, 'عملکرد')) + `<text x="${center}" y="${height - 9}" text-anchor="middle" class="chart-axis ${opacity === 1 && selectedMonth !== 'all' ? 'chart-axis-selected' : ''}">${integer.format(Number(row.period.slice(5)))}</text>`;
  }).join('');
  target.innerHTML = `<svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" role="img" aria-label="مقایسه بودجه و عملکرد ماهانه">${highlight}${grid}<line x1="${x0}" x2="${x1}" y1="${y(0)}" y2="${y(0)}" class="chart-zero"/>${bars}</svg>`;
}

function renderBudget() {
  const monthly = budgetMonthlyRows();
  const budgetYear = monthly.length ? monthly[0].period.slice(0, 4) : '';
  const validYear = selectedYear === budgetYear;
  if (validYear) {
    budgetChart('revenue-chart', monthly, 'revenueBudget', 'revenueActual');
    budgetChart('expense-chart', monthly, 'expenseBudget', 'expenseActual');
    budgetChart('profit-chart', monthly, 'profitBudget', 'profitActual');
  } else {
    ['revenue-chart', 'expense-chart', 'profit-chart'].forEach(id => { el(id).innerHTML = '<div class="empty-state">بودجه برای سال انتخابی موجود نیست</div>'; });
  }
  const lastActual = monthly.filter(row => row.revenueActual !== null).at(-1)?.period;
  const chosenPeriod = selectedMonth === 'all' ? lastActual : `${selectedYear}/${String(selectedMonth).padStart(2, '0')}`;
  const upto = validYear && chosenPeriod ? monthly.filter(row => selectedMonth === 'all' ? row.period <= chosenPeriod : row.period === chosenPeriod) : [];
  const totalBudget = key => upto.reduce((total, row) => total + (row[key] ?? 0), 0);
  const totalActual = key => upto.reduce((total, row) => total + (row[key] ?? 0), 0);
  const metrics = [
    ['درآمد', totalBudget('revenueBudget'), totalActual('revenueActual')],
    ['هزینه', totalBudget('expenseBudget'), totalActual('expenseActual')],
    ['سود', totalBudget('revenueBudget') - totalBudget('expenseBudget'), totalActual('profitActual')]
  ];
  setText('budget-period-label', selectedMonth === 'all' ? 'تجمعی تا آخرین ماه دارای عملکرد' : `ماه ${MONTHS[Number(selectedMonth) - 1]}`);
  setText('budget-table-period', validYear ? (selectedMonth === 'all' ? `ماه‌های سال ${integer.format(Number(selectedYear))}؛ جمع تا ${monthName(referenceRow())}` : `ماه ${monthName(referenceRow())}`) : `بودجه فقط برای سال ${integer.format(Number(budgetYear))} موجود است`);
  setText('revenue-achievement', validYear ? fmtPct(metrics[0][2], metrics[0][1]) : '—');
  setText('expense-achievement', validYear ? fmtPct(metrics[1][2], metrics[1][1]) : '—');
  setText('profit-achievement', validYear ? fmtPct(metrics[2][2], metrics[2][1]) : '—');
  setText('profit-variance', validYear ? fmtMoney(metrics[2][2] - metrics[2][1]) : '—');
  el('budget-table-head').innerHTML = '<tr><th rowspan="2" class="matrix-label">ماه</th><th colspan="3">درآمد</th><th colspan="3">هزینه</th><th colspan="4">سود</th></tr><tr><th class="numeric" title="بودجهٔ درآمد">بودجهٔ درآمد</th><th class="numeric" title="عملکرد واقعی درآمد">عملکرد درآمد</th><th class="numeric" title="درصد تحقق درآمد نسبت به بودجه">تحقق درآمد</th><th class="numeric" title="بودجهٔ هزینه">بودجهٔ هزینه</th><th class="numeric" title="عملکرد واقعی هزینه">عملکرد هزینه</th><th class="numeric" title="درصد تحقق هزینه نسبت به بودجه">تحقق هزینه</th><th class="numeric" title="بودجهٔ سود">بودجهٔ سود</th><th class="numeric" title="عملکرد واقعی سود">عملکرد سود</th><th class="numeric" title="درصد تحقق سود نسبت به بودجه">تحقق سود</th><th class="numeric" title="عملکرد سود منهای بودجهٔ سود">انحراف سود</th></tr>';
  const cell = value => value === null ? '—' : fmtMoney(value);
  const rowHtml = (label, revenueBudget, revenueActual, expenseBudget, expenseActual, profitBudget, profitActual, rowClass = '') => `<tr class="${rowClass}"><th scope="row" class="matrix-label">${label}</th><td class="numeric">${cell(revenueBudget)}</td><td class="numeric">${cell(revenueActual)}</td><td class="numeric">${revenueActual === null ? '—' : fmtPct(revenueActual, revenueBudget)}</td><td class="numeric">${cell(expenseBudget)}</td><td class="numeric">${cell(expenseActual)}</td><td class="numeric">${expenseActual === null ? '—' : fmtPct(expenseActual, expenseBudget)}</td><td class="numeric">${cell(profitBudget)}</td><td class="numeric">${cell(profitActual)}</td><td class="numeric">${profitActual === null ? '—' : fmtPct(profitActual, profitBudget)}</td><td class="numeric">${profitActual === null || profitBudget === null ? '—' : fmtMoney(profitActual - profitBudget)}</td></tr>`;
  const tableRows = validYear ? (selectedMonth === 'all' ? monthly : monthly.filter(row => row.period === chosenPeriod)) : [];
  const body = tableRows.map(row => rowHtml(MONTHS[Number(row.period.slice(5)) - 1], row.revenueBudget, row.revenueActual, row.expenseBudget, row.expenseActual, row.profitBudget, row.profitActual)).join('');
  const totalRow = validYear && selectedMonth === 'all' && upto.length ? rowHtml(`جمع تا ${MONTHS[Number(chosenPeriod.slice(5)) - 1]}`, metrics[0][1], metrics[0][2], metrics[1][1], metrics[1][2], metrics[2][1], metrics[2][2], 'budget-total-row') : '';
  el('budget-table').innerHTML = validYear ? body + totalRow : '<tr><td colspan="11">برای این سال بودجه‌ای در فایل موجود نیست.</td></tr>';
}

function render() {
  const rows = periodRows();
  const selectedRows = visibleRows();
  const anchor = referenceRow();
  const balance = balanceMetrics(rows);
  const pnl = periodMetrics(selectedRows);
  const periodLabel = selectedMonth === 'all' ? `سال ${integer.format(Number(selectedYear))}` : `ماه ${monthName(anchor)}`;
  const trendCaption = selectedMonth === 'all' ? `روند ماه‌های ثبت‌شدهٔ سال ${integer.format(Number(selectedYear))}` : `${MONTHS[Number(selectedMonth) - 1]} در روند سال ${integer.format(Number(selectedYear))} برجسته شده است`;
  setText('company-name', field(anchor, 'company', '—'));
  setText('header-period', periodLabel);
  const updated = new Intl.DateTimeFormat('fa-IR-u-ca-persian', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'Asia/Tehran' }).format(new Date(source.extractedAt));
  setText('freshness', `آخرین به‌روزرسانی داده‌ها: ${updated}`);
  setText('asset-total', fmtMoney(balance.assets));
  setText('liability-total', fmtMoney(balance.liabilities));
  setText('equity-total', fmtMoney(balance.equity));
  setText('working-capital', fmtMoney(balance.workingCapital));
  setText('current-ratio', balance.currentLiabilities ? fmt(balance.currentAssets / balance.currentLiabilities) : '—');
  setText('debt-equity-ratio', balance.equity ? fmt(balance.liabilities / balance.equity) : '—');
  setText('voucher-count', integer.format(sum(selectedRows, 'voucherCount')));
  setText('overview-trend-caption', trendCaption);
  groupedBarChart('trend-chart', yearRows(), [{ name: 'فروش خالص', color: COLORS.blue, value: row => monthMetrics(row).sales }, { name: 'سود عملیاتی', color: COLORS.teal, value: row => monthMetrics(row).operatingProfit }]);
  renderBalance(balance);
  setText('pnl-period-label', periodLabel);
  setText('pnl-sales-foot', selectedMonth === 'all' ? 'فروش ماه‌های ثبت‌شدهٔ سال' : 'فروش ماه انتخابی');
  setText('pnl-sales', fmtMoney(pnl.sales));
  setText('pnl-operating', fmtMoney(pnl.operatingProfit));
  setText('pnl-profit', fmtMoney(pnl.pretaxProfit));
  setText('pnl-breakdown-caption', `اثر درآمد و هزینه‌ها در ${periodLabel}`);
  setText('pnl-trend-caption', trendCaption);
  setText('pnl-table-period', periodLabel);
  renderBreakdown(pnl);
  groupedBarChart('pnl-trend', yearRows(), [{ name: 'فروش خالص', color: COLORS.blue, value: row => monthMetrics(row).sales }, { name: 'سود پیش از مالیات', color: COLORS.teal, value: row => monthMetrics(row).pretaxProfit }]);
  renderPnlTable(pnl);
  renderBudget();
}

function setup() {
  source.financialKpi.sort((a, b) => num(field(a, 'monthSort')) - num(field(b, 'monthSort')));
  const yearPicker = el('year-select');
  const monthPicker = el('month-select');
  const years = [...new Set(source.financialKpi.map(currentYear))].sort((a, b) => Number(b) - Number(a));
  years.forEach(year => yearPicker.add(new Option(integer.format(Number(year)), year)));
  selectedYear = years.includes('1405') ? '1405' : years[0];
  yearPicker.value = selectedYear;
  const updateMonths = () => {
    monthPicker.replaceChildren(new Option('همهٔ ماه‌ها', 'all'));
    [...new Set(yearRows().map(monthNumber))].sort((a, b) => a - b).forEach(month => monthPicker.add(new Option(MONTHS[month - 1], String(month))));
    selectedMonth = 'all'; monthPicker.value = selectedMonth;
  };
  updateMonths();
  yearPicker.addEventListener('change', () => { selectedYear = yearPicker.value; updateMonths(); render(); });
  monthPicker.addEventListener('change', () => { selectedMonth = monthPicker.value; render(); });
  const pages = { overview: ['نمای کلی', 'نمای کلی مالی', 'وضعیت مالی و روند عملکرد شرکت'], pnl: ['سود و زیان', 'صورت سود و زیان', 'اجزای سود و روند ماهانه'], budget: ['بودجه و عملکرد', 'بودجه در برابر عملکرد', 'مقایسهٔ درآمد، هزینه و سود'] };
  document.querySelectorAll('.nav-item').forEach(button => button.addEventListener('click', () => {
    document.querySelectorAll('.nav-item').forEach(item => { item.classList.remove('active'); item.removeAttribute('aria-current'); });
    document.querySelectorAll('.view').forEach(view => view.classList.remove('active'));
    button.classList.add('active'); button.setAttribute('aria-current', 'page');
    el(button.dataset.view).classList.add('active');
    const [path, title, subtitle] = pages[button.dataset.view];
    setText('section-path', path); setText('page-title', title); setText('page-subtitle', subtitle);
  }));
  render();
}

fetch('data/dashboard-data.json').then(response => { if (!response.ok) throw new Error('Could not load data'); return response.json(); }).then(data => { source = data; setup(); }).catch(() => { el('freshness').textContent = 'داده‌ها بارگذاری نشدند. داشبورد را با یک وب‌سرور اجرا کنید.'; });
