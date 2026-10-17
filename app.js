const BILLION_TOMAN = 1e10;
const nf = new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 1 });
const smallNf = new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 3 });
const pf = new Intl.NumberFormat('fa-IR', { style: 'percent', maximumFractionDigits: 1 });
const integer = new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 0 });
const COLORS = { blue: '#1776d2', teal: '#0b9b88', slate: '#b7c4d3', indigo: '#5266a8', amber: '#da9638', red: '#d35f63' };
const MONTHS = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];
let source;
let selected;

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

function periodRows() {
  const limit = num(field(selected, 'monthSort'));
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

function lineChart(targetId, rows, series) {
  const target = el(targetId);
  if (!rows.length) { target.innerHTML = '<div class="empty-state">داده‌ای برای نمایش وجود ندارد</div>'; return; }
  const values = rows.map(row => series.map(item => amount(item.value(row))));
  const all = values.flat();
  let min = Math.min(0, ...all), max = Math.max(0, ...all);
  if (min === max) max = min + 1;
  const pad = (max - min) * .1;
  max += pad; if (min < 0) min -= pad;
  const width = 760, height = 286, x0 = 50, x1 = 738, y0 = 15, y1 = 248;
  const x = index => x0 + index * (x1 - x0) / Math.max(1, rows.length - 1);
  const y = value => y1 - (value - min) / (max - min) * (y1 - y0);
  const grid = Array.from({ length: 5 }, (_, index) => {
    const tick = min + (max - min) * index / 4;
    const cy = y(tick);
    return `<line x1="${x0}" x2="${x1}" y1="${cy}" y2="${cy}" class="chart-grid"/><text x="${x0 - 8}" y="${cy + 4}" text-anchor="end" class="chart-axis-y">${fmt(tick)}</text>`;
  }).join('');
  const labelStep = Math.max(1, Math.ceil(rows.length / 7));
  const labels = rows.map((row, index) => index % labelStep === 0 || index === rows.length - 1
    ? `<text x="${x(index)}" y="${height - 12}" text-anchor="middle" class="chart-axis">${integer.format(Number(String(field(row, 'monthSort')).slice(4)))}</text>` : '').join('');
  const paths = series.map((item, seriesIndex) => {
    const path = values.map((rowValues, index) => `${index ? 'L' : 'M'}${x(index).toFixed(1)},${y(rowValues[seriesIndex]).toFixed(1)}`).join(' ');
    const points = values.map((rowValues, index) => `<circle cx="${x(index)}" cy="${y(rowValues[seriesIndex])}" r="3.8" fill="${item.color}" class="chart-point"><title>${monthName(rows[index])} · ${item.name}: ${fmt(rowValues[seriesIndex])} میلیارد تومان</title></circle>`).join('');
    return `<path d="${path}" stroke="${item.color}" class="chart-line"/>${points}`;
  }).join('');
  target.innerHTML = `<svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" role="img" aria-label="${escapeHtml(series.map(item => item.name).join(' و '))}">${grid}<line x1="${x0}" x2="${x1}" y1="${y(0)}" y2="${y(0)}" class="chart-zero"/>${paths}${labels}</svg>`;
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

function renderPnlTable() {
  const titles = { 'operation revenue': 'درآمد عملیاتی', Advertising: 'تبلیغات', 'Financial institution fee': 'کارمزد خدمات بانکی', Commissions: 'کارمزدها', Transfer: 'نقل و انتقال', Depreciation: 'استهلاک', 'Membership cost': 'حق عضویت', 'Office supplies': 'ملزومات اداری', Rent: 'اجاره', 'Salaries and wages': 'حقوق و دستمزد', Software: 'نرم‌افزار', Travel: 'سفر و مأموریت', 'Web hosting and domains': 'میزبانی وب و دامنه', Other: 'سایر' };
  const rows = source.pnl.map(row => ({ group: field(row, 'P&L Group', ''), title: field(row, 'P&L Type Acc', ''), value: num(field(row, 'amount')) })).filter(row => row.value !== 0);
  el('pnl-table').innerHTML = rows.map(row => `<tr><td><span class="group-pill ${row.group === 'Expenses' ? 'expense' : ''}">${row.group === 'Expenses' ? 'هزینه' : row.group === 'Revenue' ? 'درآمد' : 'سود'}</span></td><td title="${escapeHtml(row.title)}">${escapeHtml(titles[row.title] || row.title)}</td><td class="numeric">${fmtMoney(row.value)}</td></tr>`).join('');
}

function budgetMonthlyRows() {
  const limit = num(field(selected, 'monthSort'));
  const lookup = new Map(source.financialKpi.filter(row => num(field(row, 'monthSort')) <= limit).map(row => [monthKey(row), row]));
  return source.budget.map(row => {
    const period = String(field(row, 'period', ''));
    const actual = lookup.get(period);
    const monthly = actual ? monthMetrics(actual) : null;
    const revenueBudget = num(field(row, 'revenue'));
    const expenseBudget = num(field(row, 'expenses'));
    return { period, revenueBudget, expenseBudget, profitBudget: revenueBudget - expenseBudget,
      revenueActual: monthly?.revenue ?? null, expenseActual: monthly?.expenses ?? null, profitActual: monthly?.pretaxProfit ?? null };
  });
}

function budgetChart(targetId, rows, budgetKey, actualKey) {
  const target = el(targetId);
  if (!rows.length) { target.innerHTML = '<div class="empty-state">بودجه‌ای برای نمایش وجود ندارد</div>'; return; }
  const all = rows.flatMap(row => [amount(row[budgetKey]), row[actualKey] === null ? null : amount(row[actualKey])]).filter(value => value !== null);
  let min = Math.min(0, ...all), max = Math.max(0, ...all);
  if (min === max) max = min + 1;
  max += (max - min) * .08;
  if (min < 0) min -= (max - min) * .05;
  const width = 480, height = 280, x0 = 35, x1 = 467, y0 = 14, y1 = 245;
  const y = value => y1 - (value - min) / (max - min) * (y1 - y0);
  const groupWidth = (x1 - x0) / rows.length;
  const barWidth = Math.min(11, groupWidth * .27);
  const grid = Array.from({ length: 4 }, (_, index) => { const tick = min + (max - min) * index / 3; const cy = y(tick); return `<line x1="${x0}" x2="${x1}" y1="${cy}" y2="${cy}" class="chart-grid"/><text x="${x0 - 4}" y="${cy + 3}" text-anchor="end" class="chart-axis-y">${fmt(tick)}</text>`; }).join('');
  const bars = rows.map((row, index) => {
    const center = x0 + groupWidth * (index + .5);
    const budget = amount(row[budgetKey]);
    const actual = row[actualKey] === null ? null : amount(row[actualKey]);
    const rect = (value, x, color, type) => { const top = Math.min(y(0), y(value)); const barHeight = Math.max(1, Math.abs(y(value) - y(0))); return `<rect x="${x}" y="${top}" width="${barWidth}" height="${barHeight}" fill="${color}" class="chart-bar"><title>${row.period} · ${type}: ${fmt(value)} میلیارد تومان</title></rect>`; };
    return rect(budget, center - barWidth - 1, COLORS.slate, 'بودجه') + (actual === null ? '' : rect(actual, center + 1, COLORS.blue, 'عملکرد')) + `<text x="${center}" y="${height - 9}" text-anchor="middle" class="chart-axis">${integer.format(Number(row.period.slice(5)))}</text>`;
  }).join('');
  target.innerHTML = `<svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" role="img" aria-label="مقایسه بودجه و عملکرد ماهانه">${grid}<line x1="${x0}" x2="${x1}" y1="${y(0)}" y2="${y(0)}" class="chart-zero"/>${bars}</svg>`;
}

function renderBudget() {
  const monthly = budgetMonthlyRows();
  const period = monthKey(selected);
  const year = currentYear(selected);
  const budgetYear = monthly.length ? monthly[0].period.slice(0, 4) : '';
  const validYear = year === budgetYear;
  if (validYear) {
    budgetChart('revenue-chart', monthly, 'revenueBudget', 'revenueActual');
    budgetChart('expense-chart', monthly, 'expenseBudget', 'expenseActual');
    budgetChart('profit-chart', monthly, 'profitBudget', 'profitActual');
  } else {
    ['revenue-chart', 'expense-chart', 'profit-chart'].forEach(id => { el(id).innerHTML = '<div class="empty-state">بودجه برای سال انتخابی موجود نیست</div>'; });
  }
  const upto = validYear ? monthly.filter(row => row.period <= period) : [];
  const totalBudget = key => upto.reduce((total, row) => total + row[key], 0);
  const totalActual = key => upto.reduce((total, row) => total + (row[key] ?? 0), 0);
  const metrics = [
    ['درآمد', totalBudget('revenueBudget'), totalActual('revenueActual')],
    ['هزینه', totalBudget('expenseBudget'), totalActual('expenseActual')],
    ['سود', totalBudget('profitBudget'), totalActual('profitActual')]
  ];
  setText('budget-table-period', validYear ? `تجمعی تا ${monthName(selected)}` : `بودجه فقط برای سال ${integer.format(Number(budgetYear))} موجود است`);
  setText('revenue-achievement', validYear ? fmtPct(metrics[0][2], metrics[0][1]) : '—');
  setText('expense-achievement', validYear ? fmtPct(metrics[1][2], metrics[1][1]) : '—');
  setText('profit-achievement', validYear ? fmtPct(metrics[2][2], metrics[2][1]) : '—');
  setText('profit-variance', validYear ? fmtMoney(metrics[2][2] - metrics[2][1]) : '—');
  el('budget-table').innerHTML = validYear ? metrics.map(([name, budget, actual]) => `<tr><td>${name}</td><td class="numeric">${fmtMoney(budget)}</td><td class="numeric">${fmtMoney(actual)}</td><td class="numeric">${fmtPct(actual, budget)}</td><td class="numeric">${fmtMoney(actual - budget)}</td></tr>`).join('') : '<tr><td colspan="5">برای این سال بودجه‌ای در فایل موجود نیست.</td></tr>';
}

function render() {
  const rows = periodRows();
  const balance = balanceMetrics(rows);
  const monthly = monthMetrics(selected);
  setText('company-name', field(selected, 'company', '—'));
  setText('header-period', monthName(selected));
  setText('freshness', `آخرین تاریخ سند ثبت‌شده: ${field(selected, 'lastVoucherDate', 'نامشخص')}`);
  setText('asset-total', fmtMoney(balance.assets));
  setText('liability-total', fmtMoney(balance.liabilities));
  setText('equity-total', fmtMoney(balance.equity));
  setText('working-capital', fmtMoney(balance.workingCapital));
  setText('current-ratio', balance.currentLiabilities ? fmt(balance.currentAssets / balance.currentLiabilities) : '—');
  setText('debt-equity-ratio', balance.equity ? fmt(balance.liabilities / balance.equity) : '—');
  setText('voucher-count', integer.format(num(field(selected, 'voucherCount'))));
  const visible = rows.slice(-12);
  lineChart('trend-chart', visible, [{ name: 'فروش خالص', color: COLORS.blue, value: row => monthMetrics(row).sales }, { name: 'سود عملیاتی', color: COLORS.teal, value: row => monthMetrics(row).operatingProfit }]);
  renderBalance(balance);
  setText('pnl-sales', fmtMoney(monthly.sales));
  setText('pnl-operating', fmtMoney(monthly.operatingProfit));
  setText('pnl-profit', fmtMoney(monthly.pretaxProfit));
  renderBreakdown(monthly);
  lineChart('pnl-trend', visible, [{ name: 'فروش خالص', color: COLORS.blue, value: row => monthMetrics(row).sales }, { name: 'سود پیش از مالیات', color: COLORS.teal, value: row => monthMetrics(row).pretaxProfit }]);
  renderPnlTable();
  renderBudget();
}

function setup() {
  source.financialKpi.sort((a, b) => num(field(a, 'monthSort')) - num(field(b, 'monthSort')));
  const picker = el('period-select');
  source.financialKpi.forEach(row => picker.add(new Option(monthName(row), field(row, 'monthSort'))));
  selected = source.financialKpi.at(-1);
  picker.value = field(selected, 'monthSort');
  picker.addEventListener('change', () => { selected = source.financialKpi.find(row => String(field(row, 'monthSort')) === picker.value); render(); });
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
