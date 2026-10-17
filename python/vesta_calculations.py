"""Equivalent Python calculations for the Vesta PBIX semantic model.

Amounts are stored in Iranian rial. UI code can divide values by BILLION_TOMAN
to reproduce the PBIX display unit (billion toman).
"""
from __future__ import annotations

from collections import defaultdict
from typing import Any, Iterable, Mapping

BILLION_TOMAN = 10_000_000_000
VALID_VOUCHER_TYPES = {"عادی/دستی", "سیستمی"}


def value(row: Mapping[str, Any], name: str, default: Any = 0) -> Any:
    """Read either normalized API keys or Power BI Execute Queries keys."""
    if name in row:
        return row[name]
    if f"[{name}]" in row:
        return row[f"[{name}]"]
    suffix = f"[{name}]"
    return next((item for key, item in row.items() if key.endswith(suffix)), default)


def number(raw: Any) -> float:
    return float(raw or 0)


def rows_to_period(financial_kpi: Iterable[Mapping[str, Any]], month_sort: int) -> list[Mapping[str, Any]]:
    """Matches FILTER(ALL(MonthSort), MonthSort <= selected month) in DAX."""
    return [row for row in financial_kpi if number(value(row, "monthSort")) <= month_sort]


def total(rows: Iterable[Mapping[str, Any]], field: str) -> float:
    return sum(number(value(row, field)) for row in rows)


def balance_sheet(financial_kpi: Iterable[Mapping[str, Any]], month_sort: int) -> dict[str, float]:
    """Recreates the cumulative balance-sheet measures in `Live Financial KPI`."""
    rows = rows_to_period(financial_kpi, month_sort)
    current_assets = total(rows, "currentAssetsActivity")
    noncurrent_assets = total(rows, "nonCurrentAssetsActivity")
    current_liabilities = total(rows, "currentLiabilitiesActivity")
    noncurrent_liabilities = total(rows, "nonCurrentLiabilitiesActivity")
    equity = total(rows, "equityActivity")
    unclosed_profit_loss = total(rows, "unclosedProfitLossActivity")
    assets = current_assets + noncurrent_assets
    liabilities = current_liabilities + noncurrent_liabilities
    adjusted_equity = equity + unclosed_profit_loss
    cash = total(rows, "cashActivity")
    loans = total(rows, "loansActivity")
    prepayment = total(rows, "prepaymentActivity")
    return {
        "current_assets": current_assets,
        "noncurrent_assets": noncurrent_assets,
        "assets": assets,
        "current_liabilities": current_liabilities,
        "noncurrent_liabilities": noncurrent_liabilities,
        "liabilities": liabilities,
        "equity": equity,
        "unclosed_profit_loss": unclosed_profit_loss,
        "adjusted_equity": adjusted_equity,
        "working_capital": current_assets - current_liabilities,
        "cash": cash,
        "net_interest_bearing_debt": loans - max(cash, 0),
        "current_ratio": safe_divide(current_assets, current_liabilities),
        "quick_ratio": safe_divide(current_assets - prepayment, current_liabilities),
        "debt_to_equity": safe_divide(liabilities, adjusted_equity),
        "asset_to_equity": safe_divide(assets, adjusted_equity),
        "balance_check": assets - liabilities - adjusted_equity,
    }


def profit_and_loss(financial_kpi: Iterable[Mapping[str, Any]], selected_rows: Iterable[Mapping[str, Any]]) -> dict[str, float]:
    """Recreates PBIX profit measures in the supplied report-filter context."""
    visible = list(selected_rows)
    sales = total(visible, "netSales")
    cogs = total(visible, "costOfGoodsSold")
    operating_expense = total(visible, "operatingExpense")
    finance_cost = total(visible, "financeCost")
    other_income = total(visible, "otherIncome")
    operating_profit = sales - cogs - operating_expense
    pretax_profit = operating_profit + other_income - finance_cost
    return {
        "net_sales": sales,
        "cost_of_goods_sold": cogs,
        "operating_expense": operating_expense,
        "finance_cost": finance_cost,
        "other_income": other_income,
        "operating_profit": operating_profit,
        "pretax_profit": pretax_profit,
        "operating_margin": safe_divide(operating_profit, sales),
        "pretax_margin": safe_divide(pretax_profit, sales),
        "interest_coverage": safe_divide(operating_profit, finance_cost),
    }


def budget_vs_actual(financial_kpi: Iterable[Mapping[str, Any]], budget: Iterable[Mapping[str, Any]], period: str) -> dict[str, float | None]:
    """Compare actuals with budget through a month within the same fiscal year."""
    year = period[:4]
    def period_key(row: Mapping[str, Any]) -> str:
        month_sort = str(value(row, "monthSort", ""))
        return f"{month_sort[:4]}/{month_sort[4:6]}"

    actual_rows = [row for row in financial_kpi if period_key(row).startswith(year + "/") and period_key(row) <= period]
    budget_rows = [row for row in budget if str(value(row, "period", "")).startswith(year + "/") and str(value(row, "period", "")) <= period]
    revenue_actual = total(actual_rows, "netSales") + total(actual_rows, "otherIncome")
    expenses_actual = total(actual_rows, "costOfGoodsSold") + total(actual_rows, "operatingExpense") + total(actual_rows, "financeCost")
    revenue_budget = total(budget_rows, "revenue")
    expenses_budget = total(budget_rows, "expenses")
    actual_profit = revenue_actual - expenses_actual
    budget_profit = revenue_budget - expenses_budget
    return {
        "revenue_actual": revenue_actual,
        "expenses_actual": expenses_actual,
        "revenue_budget": revenue_budget,
        "expenses_budget": expenses_budget,
        "actual_profit": actual_profit,
        "budget_profit": budget_profit,
        "profit_variance": actual_profit - budget_profit,
        "revenue_achievement": safe_divide(revenue_actual, revenue_budget),
        "expense_achievement": safe_divide(expenses_actual, expenses_budget),
        "profit_achievement": safe_divide(actual_profit, budget_profit),
        "profit_variance_percent": safe_divide(actual_profit - budget_profit, abs(budget_profit)),
        "actual_profit_margin": safe_divide(actual_profit, revenue_actual),
    }


def pnl_by_layout(voucher_detail: Iterable[Mapping[str, Any]], layout: Iterable[Mapping[str, Any]]) -> list[dict[str, Any]]:
    """Recreates measure `P&L (ریال)` without emitting voucher-level data.

    `layout` needs `rowType`, `mappedTitle`, `title`, and optional `lineOrder`.
    The returned rows are aggregated P&L headings only.
    """
    vouchers = [row for row in voucher_detail if value(row, "نوع سند", "") in VALID_VOUCHER_TYPES]
    revenue = sum(number(value(row, "بستانکار (ریال)")) - number(value(row, "بدهکار (ریال)")) for row in vouchers if value(row, "P&L Group") == "Revenue")
    expenses = sum(number(value(row, "بدهکار (ریال)")) - number(value(row, "بستانکار (ریال)")) for row in vouchers if value(row, "P&L Group") == "Expenses")
    result = []
    for line in layout:
        row_type = value(line, "rowType", value(line, "Row Type", ""))
        mapped_title = value(line, "mappedTitle", value(line, "Mapped Title", ""))
        if row_type == "Net":
            amount = revenue - expenses
        elif row_type in {"Revenue", "Expenses"}:
            matches = [row for row in vouchers if value(row, "P&L Report Title") == mapped_title]
            debit = total(matches, "بدهکار (ریال)")
            credit = total(matches, "بستانکار (ریال)")
            amount = credit - debit if row_type == "Revenue" else debit - credit
        else:
            continue
        result.append({"title": value(line, "title", value(line, "P&L Type Acc", mapped_title)), "group": row_type, "amount": amount, "line_order": value(line, "lineOrder", value(line, "Line Order", 0))})
    return sorted(result, key=lambda row: number(row["line_order"]))


def freshness_status(row: Mapping[str, Any]) -> str:
    sales = value(row, "lastSalesInvoiceDate", "")
    voucher = value(row, "lastVoucherDate", "")
    if not sales:
        return "هشدار: فاکتور فروش موجود نیست"
    return f"هشدار: فروش تا {sales} | اسناد تا {voucher}" if sales < voucher else "اطلاعات فروش به‌روز است"


def safe_divide(numerator: float, denominator: float) -> float | None:
    return None if denominator == 0 else numerator / denominator
