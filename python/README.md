# منطق محاسبات پایتون

`vesta_calculations.py` تبدیل مستقیم معیارهای DAX مدل Vesta است و به Power BI یا pandas وابسته نیست.

- `balance_sheet` — دارایی‌ها، بدهی‌ها، حقوق، سرمایه در گردش و نسبت‌ها؛ با تجمع فعالیت‌ها تا ماه انتخابی.
- `profit_and_loss` — فروش، هزینه‌ها، سود عملیاتی و سود پیش از مالیات در context انتخاب‌شده.
- `budget_vs_actual` — تحقق درآمد و هزینه، سود، انحراف و حاشیه سود.
- `pnl_by_layout` — تبدیل منطق DAX صورت سود و زیان به ردیف‌های تجمیعی؛ ورودی جزئیات سند را فقط در حافظه می‌خواند و خروجی ریز اسناد تولید نمی‌کند.

برای ساخت خروجی قابل‌مصرف در HTML:

```powershell
python build_dashboard_data.py input.json ..\data\dashboard-data.json
```

`input.json` باید شامل کلیدهای `financialKpi`، `budget` و در صورت نیاز `pnl` باشد؛ همان شکل دادهٔ استخراج‌شده از PBIX.
