const BILLION = 1e10;
const fnum = new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 1 });
const fpct = new Intl.NumberFormat('fa-IR', { style: 'percent', maximumFractionDigits: 1 });
let data, selected;
const field = (row, name) => row[name] ?? row[`[${name}]`] ?? row[Object.keys(row).find(k => k.endsWith(`[${name}]`))];
const n = value => Number(value || 0);
const bn = value => n(value) / BILLION;
const sumThrough = (rows, key, upto) => rows.filter(r => n(field(r, 'monthSort')) <= upto).reduce((a, r) => a + n(field(r, key)), 0);
const sumRows = (rows, key) => rows.reduce((a, r) => a + n(field(r, key)), 0);
const el = id => document.getElementById(id);
const money = value => `${fnum.format(value)} `;
const set = (id, value) => el(id).textContent = value;

function metrics(row) {
  const upto = n(field(row, 'monthSort'));
  const currentAssets = sumThrough(data.financialKpi, 'currentAssetsActivity', upto);
  const nonCurrentAssets = sumThrough(data.financialKpi, 'nonCurrentAssetsActivity', upto);
  const currentLiabilities = sumThrough(data.financialKpi, 'currentLiabilitiesActivity', upto);
  const nonCurrentLiabilities = sumThrough(data.financialKpi, 'nonCurrentLiabilitiesActivity', upto);
  const equity = sumThrough(data.financialKpi, 'equityActivity', upto) + sumThrough(data.financialKpi, 'unclosedProfitLossActivity', upto);
  const sales = sumThrough(data.financialKpi, 'netSales', upto);
  const cogs = sumThrough(data.financialKpi, 'costOfGoodsSold', upto);
  const expense = sumThrough(data.financialKpi, 'operatingExpense', upto);
  const finance = sumThrough(data.financialKpi, 'financeCost', upto);
  const other = sumThrough(data.financialKpi, 'otherIncome', upto);
  return { currentAssets, nonCurrentAssets, currentLiabilities, nonCurrentLiabilities, equity, assets: currentAssets + nonCurrentAssets, liabilities: currentLiabilities + nonCurrentLiabilities, sales, cogs, expense, finance, other, operatingProfit: sales - cogs - expense, profit: sales - cogs - expense - finance + other };
}
function lineChart(container, rows) {
  const values = rows.map(r => ({x: field(r,'month'), sales: bn(field(r,'netSales')), profit: bn(field(r,'netSales'))-bn(field(r,'costOfGoodsSold'))-bn(field(r,'operatingExpense'))}));
  const max = Math.max(1, ...values.flatMap(v=>[v.sales, v.profit])); const w=700,h=270,p={l:40,r:12,t:15,b:34};
  const x=i=>p.l+i*(w-p.l-p.r)/Math.max(1,values.length-1), y=v=>p.t+(h-p.t-p.b)*(1-v/max);
  const path=k=>values.map((v,i)=>`${i?'L':'M'}${x(i).toFixed(1)},${y(v[k]).toFixed(1)}`).join(' ');
  const labels=values.map((v,i)=>i%Math.ceil(values.length/7)===0?`<text class="axis-label" x="${x(i)}" y="${h-8}" text-anchor="middle">${v.x.slice(5)}</text>`:'').join('');
  container.innerHTML=`<svg viewBox="0 0 ${w} ${h}" role="img"><path d="${path('sales')}" fill="none" stroke="#4361ee" stroke-width="3"/><path d="${path('profit')}" fill="none" stroke="#18a699" stroke-width="3"/>${values.map((v,i)=>`<circle class="point" data-tip="${v.x}: فروش ${fnum.format(v.sales)} | سود ${fnum.format(v.profit)}" cx="${x(i)}" cy="${y(v.sales)}" r="3" fill="#4361ee"/><circle class="point" data-tip="${v.x}: سود ${fnum.format(v.profit)}" cx="${x(i)}" cy="${y(v.profit)}" r="3" fill="#18a699"/>`).join('')}${labels}</svg><div class="tooltip"></div>`;
  attachTooltips(container);
}
function barChart(container, items) {
  const max=Math.max(1,...items.flatMap(i=>[i.budget,i.actual])); const w=720,h=350,p={l:42,r:10,t:20,b:48}; const group=(w-p.l-p.r)/items.length, bw=Math.min(22,group*.28); const y=v=>p.t+(h-p.t-p.b)*(1-v/max);
  container.innerHTML=`<svg viewBox="0 0 ${w} ${h}">${[0,.5,1].map(t=>`<line class="grid-line" x1="${p.l}" x2="${w-p.r}" y1="${y(max*t)}" y2="${y(max*t)}"/>`).join('')}${items.map((it,i)=>{const cx=p.l+group*(i+.5);return `<rect class="point" data-tip="${it.period}: بودجه ${fnum.format(it.budget)} | عملکرد ${fnum.format(it.actual)}" x="${cx-bw-3}" y="${y(it.budget)}" width="${bw}" height="${h-p.b-y(it.budget)}" rx="3" fill="#b8c2d6"/><rect class="point" data-tip="${it.period}: بودجه ${fnum.format(it.budget)} | عملکرد ${fnum.format(it.actual)}" x="${cx+3}" y="${y(it.actual)}" width="${bw}" height="${h-p.b-y(it.actual)}" rx="3" fill="#4361ee"/><text class="bar-label" x="${cx}" y="${h-18}" text-anchor="middle">${it.period.slice(5)}</text>`}).join('')}</svg><div class="tooltip"></div>`; attachTooltips(container);
}
function attachTooltips(container){const tip=container.querySelector('.tooltip');container.querySelectorAll('.point').forEach(p=>p.addEventListener('mouseenter',e=>{tip.textContent=e.target.dataset.tip;tip.style.left=`${e.offsetX}px`;tip.style.top=`${e.offsetY}px`;tip.style.opacity=1}));container.addEventListener('mouseleave',()=>tip.style.opacity=0)}
function render() {
  const m=metrics(selected), upto=n(field(selected,'monthSort')), rows=data.financialKpi.filter(r=>n(field(r,'monthSort'))<=upto);
  set('company-name',field(selected,'company')); set('freshness',`آخرین سند: ${field(selected,'lastVoucherDate')||'نامشخص'}`);
  set('asset-total',money(bn(m.assets)));set('liability-total',money(bn(m.liabilities)));set('equity-total',money(bn(m.equity)));set('working-capital',money(bn(m.currentAssets-m.currentLiabilities)));set('current-ratio',fnum.format(m.currentAssets/m.currentLiabilities));set('debt-equity-ratio',fnum.format(m.liabilities/m.equity));set('voucher-count',fnum.format(field(selected,'voucherCount')));
  lineChart(el('trend-chart'),rows); const balances=[['دارایی کل',m.assets,'#4361ee'],['بدهی کل',m.liabilities,'#e9a23b'],['حقوق صاحبان سهام',m.equity,'#18a699']]; const max=Math.max(...balances.map(x=>x[1])); el('balance-chart').innerHTML=`<svg viewBox="0 0 320 190">${balances.map((b,i)=>{const r=54+44*i;return `<text class="axis-label" x="5" y="${r+15}">${b[0]}</text><rect x="115" y="${r}" width="180" height="20" rx="8" fill="#edf0f5"/><rect x="115" y="${r}" width="${180*b[1]/max}" height="20" rx="8" fill="${b[2]}"/>`}).join('')}</svg>`;el('balance-list').innerHTML=balances.map(b=>`<div class="balance-row"><span>${b[0]}</span><b>${money(bn(b[1]))}</b></div>`).join('');
  const pnl=data.pnl.map(r=>({group:field(r,'P&L Group'),title:field(r,'P&L Type Acc'),amount:n(field(r,'amount'))})).filter(r=>r.amount!==0); const revenue=sumRows(pnl.filter(x=>x.group==='Revenue'),'amount'), expenses=sumRows(pnl.filter(x=>x.group==='Expenses'),'amount');set('pnl-revenue',money(bn(revenue)));set('pnl-expenses',money(bn(expenses)));set('pnl-net',money(bn(revenue-expenses)));el('pnl-table').innerHTML=pnl.map(r=>`<tr><td>${r.group==='Revenue'?'درآمد':'هزینه'}</td><td>${r.title}</td><td class="amount">${fnum.format(bn(r.amount))}</td></tr>`).join('');
  const period=String(field(selected,'month')).slice(0,7), currentBudget=data.budget.filter(b=>String(field(b,'period'))<=period); const budgetRevenue=sumRows(currentBudget,'revenue'), budgetExpenses=sumRows(currentBudget,'expenses'), actualRevenue=m.sales+m.other, actualExpenses=m.cogs+m.expense+m.finance; set('revenue-achievement',budgetRevenue?fpct.format(actualRevenue/budgetRevenue):'—');set('expense-achievement',budgetExpenses?fpct.format(actualExpenses/budgetExpenses):'—');set('profit-variance',money(bn((actualRevenue-actualExpenses)-(budgetRevenue-budgetExpenses))));set('actual-margin',actualRevenue?fpct.format((actualRevenue-actualExpenses)/actualRevenue):'—');
  const budgetPoints=data.budget.map(b=>{const period=field(b,'period');const actual=data.financialKpi.filter(r=>String(field(r,'month')).startsWith(period));return {period,budget:bn(n(field(b,'revenue'))-n(field(b,'expenses'))),actual:bn(sumRows(actual,'netSales')+sumRows(actual,'otherIncome')-sumRows(actual,'costOfGoodsSold')-sumRows(actual,'operatingExpense')-sumRows(actual,'financeCost'))}}); barChart(el('budget-chart'),budgetPoints);
}
function setup() {
  const select = el('period-select');
  data.financialKpi.sort((a, b) => n(field(a, 'monthSort')) - n(field(b, 'monthSort')));
  data.financialKpi.forEach(row => select.add(new Option(field(row, 'month'), field(row, 'monthSort'))));
  selected = data.financialKpi.at(-1);
  select.value = field(selected, 'monthSort');
  select.addEventListener('change', () => {
    selected = data.financialKpi.find(row => String(field(row, 'monthSort')) === select.value);
    render();
  });
  document.querySelectorAll('.nav-item').forEach(button => button.addEventListener('click', () => {
    document.querySelectorAll('.nav-item, .view').forEach(node => node.classList.remove('active'));
    button.classList.add('active');
    el(button.dataset.view).classList.add('active');
    el('page-title').textContent = button.dataset.title;
  }));
  render();
}
fetch('data/dashboard-data.json').then(r=>r.json()).then(d=>{data=d;setup()}).catch(()=>document.body.innerHTML='<p style="padding:40px">داده‌ها بارگذاری نشدند. داشبورد را از طریق یک وب‌سرور اجرا کنید.</p>');
