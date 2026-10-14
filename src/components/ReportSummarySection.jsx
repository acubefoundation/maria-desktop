import React from 'react';
import {
  Table as TableIcon,
  ArrowDown,
  ArrowUp,
  Package,
  CheckCircle,
  WarningCircle,
  Trash,
  Scales,
} from '@phosphor-icons/react';

function formatAmount(kg, bags, includeBags = true) {
  if (kg === undefined || kg === null) return '—';
  const kgStr = `${Number(kg).toLocaleString()} KG`;
  if (!includeBags) return kgStr;
  const bagsStr = `${Number(bags || 0).toLocaleString()} Bags`;
  return `${kgStr} / ${bagsStr}`;
}

function getRowData(summary, loading) {
  return [
    {
      key: 'coffeeIn',
      category: 'Coffee In',
      amount: formatAmount(summary?.coffeeInKg, summary?.coffeeInBags, true),
      icon: <ArrowDown size={14} weight="bold" />,
      colorClass: 'summary-tag--in',
    },
    {
      key: 'dispatched',
      category: 'Dispatched',
      amount: formatAmount(summary?.dispatchedKg, summary?.dispatchedBags, true),
      icon: <ArrowUp size={14} weight="bold" />,
      colorClass: 'summary-tag--out',
    },
    {
      key: 'processed',
      category: 'Processed',
      amount: formatAmount(summary?.processedKg, 0, false),
      icon: <Package size={14} weight="bold" />,
      colorClass: 'summary-tag--processed',
    },
    {
      key: 'clean',
      category: 'Clean',
      amount: formatAmount(summary?.cleanKg, summary?.cleanBags, true),
      icon: <CheckCircle size={14} weight="bold" />,
      colorClass: 'summary-tag--clean',
    },
    ...(summary &&
    (summary.rejectSortexKg !== undefined ||
      summary.rejectGravityKg !== undefined ||
      summary.rejectSizeKg !== undefined)
      ? [
          {
            key: 'rejectSortex',
            category: 'Reject (Sortex)',
            amount: formatAmount(summary?.rejectSortexKg ?? 0, 0, false),
            icon: <WarningCircle size={14} weight="bold" />,
            colorClass: 'summary-tag--reject',
          },
          {
            key: 'rejectGravity',
            category: 'Reject (Gravity)',
            amount: formatAmount(summary?.rejectGravityKg ?? 0, 0, false),
            icon: <WarningCircle size={14} weight="bold" />,
            colorClass: 'summary-tag--reject',
          },
          {
            key: 'rejectSize',
            category: 'Reject (Size)',
            amount: formatAmount(summary?.rejectSizeKg ?? 0, 0, false),
            icon: <WarningCircle size={14} weight="bold" />,
            colorClass: 'summary-tag--reject',
          },
          {
            key: 'reject',
            category: 'Total Reject',
            amount: formatAmount(summary?.rejectKg ?? 0, 0, false),
            icon: <WarningCircle size={14} weight="bold" />,
            colorClass: 'summary-tag--reject',
          },
        ]
      : [
          {
            key: 'reject',
            category: 'Total Reject',
            amount: formatAmount(summary?.rejectKg, 0, false),
            icon: <WarningCircle size={14} weight="bold" />,
            colorClass: 'summary-tag--reject',
          },
        ]),
    {
      key: 'waste',
      category: 'Waste',
      amount: formatAmount(summary?.wasteKg, 0, false),
      icon: <Trash size={14} weight="bold" />,
      colorClass: 'summary-tag--waste',
    },
    {
      key: 'remainingStock',
      category: 'Remaining Stock',
      amount: formatAmount(summary?.remainingStockKg, summary?.remainingStockBags, true),
      icon: <Scales size={14} weight="bold" />,
      colorClass: 'summary-tag--stock',
      isHighlight: true,
    },
  ];
}

function getYieldRowData(summary, loading) {
  return [
    {
      key: 'totalInput',
      category: 'Total Input (KG)',
      amount: formatAmount(summary?.totalInputKg ?? summary?.coffeeInKg, 0, false),
      icon: <ArrowDown size={14} weight="bold" />,
      colorClass: 'summary-tag--in',
    },
    {
      key: 'clean',
      category: 'Clean (KG)',
      amount: formatAmount(summary?.cleanKg, summary?.cleanBags, true),
      icon: <CheckCircle size={14} weight="bold" />,
      colorClass: 'summary-tag--clean',
    },
    {
      key: 'yieldPct',
      category: 'Yield %',
      amount: summary?.cleanYieldPct !== undefined ? `${summary.cleanYieldPct}%` : '—',
      icon: <Scales size={14} weight="bold" />,
      colorClass: 'summary-tag--stock',
      isHighlight: true,
    },
    ...(summary &&
    (summary.rejectSortexKg !== undefined ||
      summary.rejectGravityKg !== undefined ||
      summary.rejectSizeKg !== undefined)
      ? [
          {
            key: 'rejectSortex',
            category: 'Reject (Sortex)',
            amount: formatAmount(summary?.rejectSortexKg ?? 0, 0, false),
            icon: <WarningCircle size={14} weight="bold" />,
            colorClass: 'summary-tag--reject',
          },
          {
            key: 'rejectGravity',
            category: 'Reject (Gravity)',
            amount: formatAmount(summary?.rejectGravityKg ?? 0, 0, false),
            icon: <WarningCircle size={14} weight="bold" />,
            colorClass: 'summary-tag--reject',
          },
          {
            key: 'rejectSize',
            category: 'Reject (Size)',
            amount: formatAmount(summary?.rejectSizeKg ?? 0, 0, false),
            icon: <WarningCircle size={14} weight="bold" />,
            colorClass: 'summary-tag--reject',
          },
          {
            key: 'reject',
            category: 'Total Reject',
            amount: formatAmount(summary?.rejectKg ?? 0, 0, false),
            icon: <WarningCircle size={14} weight="bold" />,
            colorClass: 'summary-tag--reject',
          },
        ]
      : [
          {
            key: 'reject',
            category: 'Total Reject',
            amount: formatAmount(summary?.rejectKg, 0, false),
            icon: <WarningCircle size={14} weight="bold" />,
            colorClass: 'summary-tag--reject',
          },
        ]),
    {
      key: 'waste',
      category: 'Waste (KG)',
      amount: formatAmount(summary?.wasteKg, 0, false),
      icon: <Trash size={14} weight="bold" />,
      colorClass: 'summary-tag--waste',
    },
  ];
}

function SummaryTable({ rows, title, loading }) {
  return (
    <div className="report-summary-card">
      <div className="report-summary-header">
        <div className="report-summary-title-group">
          <TableIcon size={18} weight="regular" className="report-summary-icon" />
          <h3 className="report-summary-title">{title}</h3>
        </div>
        <span className="report-summary-badge">
          {loading ? 'Calculating figures...' : ''}
        </span>
      </div>

      <div className="report-summary-table-wrap">
        <table className="report-summary-table">
          <thead>
            <tr>
              <th className="report-summary-th-cat">Category</th>
              <th className="report-summary-th-amt">Amount</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.key}
                className={`report-summary-row ${row.isHighlight ? 'report-summary-row--highlight' : ''}`}
              >
                <td className="report-summary-cell-cat">
                  <span className={`summary-icon-pill ${row.colorClass}`}>
                    {row.icon}
                  </span>
                  <span className="summary-cat-label">{row.category}</span>
                </td>
                <td className="report-summary-cell-amt">
                  {loading ? (
                    <span className="summary-skeleton-pulse">••••••</span>
                  ) : (
                    <span className="summary-amt-val">{row.amount}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function ReportSummarySection({
  summary,
  loading = false,
  title = 'Summary Overview',
  subtitle = 'Key figures for currently displayed data',
  groups,
  type = 'default',
}) {
  const rowData = type === 'yield' 
    ? getYieldRowData(summary, loading)
    : getRowData(summary, loading);

  if (groups && Array.isArray(groups) && groups.length === 2) {
    const [group1Keys, group2Keys] = groups;
    const group1Rows = rowData.filter(r => group1Keys.includes(r.key));
    const group2Rows = rowData.filter(r => group2Keys.includes(r.key));

    return (
      <div className="report-summary-split">
        <SummaryTable rows={group1Rows} title={group1Rows.length > 0 ? 'Input & Processing' : ''} loading={loading} />
        <SummaryTable rows={group2Rows} title={group2Rows.length > 0 ? 'Output & Stock' : ''} loading={loading} />
      </div>
    );
  }

  return (
    <div className="report-summary-card">
      <div className="report-summary-header">
        <div className="report-summary-title-group">
          <TableIcon size={18} weight="regular" className="report-summary-icon" />
          <h3 className="report-summary-title">{title}</h3>
        </div>
        <span className="report-summary-badge">
          {loading ? 'Calculating figures...' : subtitle}
        </span>
      </div>

      <div className="report-summary-table-wrap">
        <table className="report-summary-table">
          <thead>
            <tr>
              <th className="report-summary-th-cat">Category</th>
              <th className="report-summary-th-amt">Amount</th>
            </tr>
          </thead>
          <tbody>
            {rowData.map((row) => (
              <tr
                key={row.key}
                className={`report-summary-row ${row.isHighlight ? 'report-summary-row--highlight' : ''}`}
              >
                <td className="report-summary-cell-cat">
                  <span className={`summary-icon-pill ${row.colorClass}`}>
                    {row.icon}
                  </span>
                  <span className="summary-cat-label">{row.category}</span>
                </td>
                <td className="report-summary-cell-amt">
                  {loading ? (
                    <span className="summary-skeleton-pulse">••••••</span>
                  ) : (
                    <span className="summary-amt-val">{row.amount}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}