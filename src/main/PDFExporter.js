/**
 * PDFExporter.js — Flowjob Journal PDF Report Generator
 * v1.1.0 — Premium Branded Layout
 * CommonJS / Electron main process compatible
 */

const { jsPDF } = require('jspdf');
require('jspdf-autotable');

// ── Brand palette ────────────────────────────────────────────────────────────
const C = {
  bg:       [10,  14,  20],    // #0a0e14
  card:     [16,  20,  28],    // #10141c
  cardAlt:  [22,  26,  36],    // #16181a
  accent:   [134, 112, 255],   // #8670ff  purple
  loss:     [255,   0, 149],   // #ff0095  pink
  profit:   [0,   210, 120],   // #00d278  green
  warn:     [255, 170,   0],   // #ffaa00
  text:     [232, 237, 243],   // #e8edf3
  subtext:  [140, 155, 175],   // #8c9baf
  muted:    [65,  78,  95],    // #414e5f
  border:   [28,  34,  46],    // #1c222e
  white:    [255, 255, 255],
};

class PDFExporter {
  constructor(db) {
    this.db = db;
  }

  // ─── Public API ────────────────────────────────────────────────────────────

  generateDailyReport(date, filePath) {
    const trades = this.db.getTrades({ startDate: date, endDate: date });
    this._buildReport({
      trades, filePath,
      title:    `Daily Performance Report`,
      subtitle: this._fmtDateLong(date),
      period: 'daily', startDate: date, endDate: date,
    });
  }

  generateWeeklyReport(startDate, endDate, filePath) {
    const trades = this.db.getTrades({ startDate, endDate });
    this._buildReport({
      trades, filePath,
      title:    'Weekly Performance Report',
      subtitle: `${this._fmtDateLong(startDate)} — ${this._fmtDateLong(endDate)}`,
      period: 'weekly', startDate, endDate,
    });
  }

  generateMonthlyReport(year, month, filePath) {
    const start = `${year}-${String(month).padStart(2, '0')}-01`;
    const end   = new Date(year, month, 0).toISOString().split('T')[0];
    const trades = this.db.getTrades({ startDate: start, endDate: end });
    const monthName = new Date(year, month - 1, 1)
      .toLocaleString('en-US', { month: 'long', year: 'numeric' });
    this._buildReport({
      trades, filePath,
      title:    'Monthly Performance Report',
      subtitle: monthName,
      period: 'monthly', startDate: start, endDate: end,
    });
  }

  generateCustomReport(startDate, endDate, filePath) {
    const trades = this.db.getTrades({ startDate, endDate });
    this._buildReport({
      trades, filePath,
      title:    'Custom Performance Report',
      subtitle: `${this._fmtDateLong(startDate)} — ${this._fmtDateLong(endDate)}`,
      period: 'custom', startDate, endDate,
    });
  }

  // ─── Core Builder ──────────────────────────────────────────────────────────

  _buildReport({ trades, title, subtitle, filePath, period, startDate, endDate }) {
    const doc   = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const W     = doc.internal.pageSize.getWidth();   // 210
    const H     = doc.internal.pageSize.getHeight();  // 297
    const stats = this._calcStats(trades);

    // Full page background
    this._rect(doc, 0, 0, W, H, C.bg);

    let y = 0;

    y = this._drawCoverHeader(doc, title, subtitle, W, y);
    y = this._drawKPIRow(doc, stats, W, y);
    y = this._drawDivider(doc, W, y, 'PERFORMANCE BREAKDOWN');
    y = this._drawPerformanceGrid(doc, stats, W, y);
    y = this._drawDivider(doc, W, y, 'RISK METRICS');
    y = this._drawRiskGrid(doc, stats, W, y);
    y = this._drawDivider(doc, W, y, 'TRADE LOG');
    y = this._drawTradeTable(doc, trades, W, y, H);

    this._drawFooterAllPages(doc, period, startDate, endDate);

    doc.save(filePath);
  }

  // ─── Cover Header ─────────────────────────────────────────────────────────

  _drawCoverHeader(doc, title, subtitle, W, y) {
    const bannerH = 44;

    // Dark banner
    this._rect(doc, 0, 0, W, bannerH, [8, 10, 16]);

    // Accent top bar
    this._rect(doc, 0, 0, W, 2, C.accent);

    // Left glow
    doc.setFillColor(134, 112, 255);
    doc.setGState && doc.setGState(doc.GState({ opacity: 0.06 }));
    this._rect(doc, 0, 0, 60, bannerH, [134, 112, 255]);
    doc.setGState && doc.setGState(doc.GState({ opacity: 1 }));

    // Brand name
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...C.accent);
    doc.text('FLOWJOB JOURNAL', 14, 12);

    // Tagline
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...C.muted);
    doc.text('Build Your System. Trade With Discipline.', 14, 18);

    // Generated time (top right)
    const now = new Date().toLocaleString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
    doc.setFontSize(7);
    doc.setTextColor(...C.muted);
    doc.text(`Generated: ${now}`, W - 14, 12, { align: 'right' });

    // Report title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(17);
    doc.setTextColor(...C.text);
    doc.text(title, 14, 32);

    // Subtitle
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...C.subtext);
    doc.text(subtitle, 14, 40);

    // Bottom accent line
    this._rect(doc, 0, bannerH, W, 1, C.border);

    return bannerH + 8;
  }

  // ─── KPI Row (4 big cards) ─────────────────────────────────────────────────

  _drawKPIRow(doc, stats, W, y) {
    if (!stats) return this._drawNoTrades(doc, W, y);

    const margin  = 14;
    const gap     = 4;
    const cols    = 4;
    const cardW   = (W - margin * 2 - gap * (cols - 1)) / cols;
    const cardH   = 26;

    const kpis = [
      {
        label: 'NET P/L',
        value: `${stats.totalPL >= 0 ? '+' : ''}$${Math.abs(stats.totalPL).toFixed(2)}`,
        color: stats.totalPL >= 0 ? C.profit : C.loss,
        sub:   `${stats.totalTrades} trades`,
      },
      {
        label: 'WIN RATE',
        value: `${stats.winRate.toFixed(1)}%`,
        color: stats.winRate >= 50 ? C.profit : C.loss,
        sub:   `${stats.wins}W · ${stats.losses}L`,
      },
      {
        label: 'PROFIT FACTOR',
        value: stats.profitFactor >= 999 ? '∞' : stats.profitFactor.toFixed(2),
        color: stats.profitFactor >= 1.5 ? C.profit : stats.profitFactor >= 1 ? C.warn : C.loss,
        sub:   'Gross W / Gross L',
      },
      {
        label: 'EXPECTANCY',
        value: `${stats.expectancy >= 0 ? '+' : ''}$${stats.expectancy.toFixed(2)}`,
        color: stats.expectancy >= 0 ? C.profit : C.loss,
        sub:   'Per trade avg',
      },
    ];

    kpis.forEach((kpi, i) => {
      const x = margin + i * (cardW + gap);

      // Card bg
      this._rect(doc, x, y, cardW, cardH, C.card);

      // Left accent bar
      this._rect(doc, x, y, 2.5, cardH, kpi.color);

      // Top accent line
      this._rect(doc, x, y, cardW, 0.6, kpi.color);

      // Label
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.5);
      doc.setTextColor(...C.muted);
      doc.text(kpi.label, x + 7, y + 8);

      // Value
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.setTextColor(...kpi.color);
      doc.text(kpi.value, x + 7, y + 18);

      // Sub
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(...C.muted);
      doc.text(kpi.sub, x + 7, y + 24);
    });

    return y + cardH + 8;
  }

  // ─── Section Divider ──────────────────────────────────────────────────────

  _drawDivider(doc, W, y, label) {
    const margin = 14;

    this._rect(doc, margin, y + 2, W - margin * 2, 0.5, C.border);
    this._rect(doc, margin, y, 3, 8, C.accent);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(...C.accent);
    doc.text(label, margin + 7, y + 5.8);

    const labelW = doc.getTextWidth(label);
    this._rect(doc, margin + 7 + labelW + 4, y + 3.5, W - margin * 2 - 7 - labelW - 4, 0.5, C.border);

    return y + 14;
  }

  // ─── Performance Grid ─────────────────────────────────────────────────────

  _drawPerformanceGrid(doc, stats, W, y) {
    if (!stats) return y + 8;

    const items = [
      { label: 'Total Trades',   value: String(stats.totalTrades),                              sub: `${stats.wins}W · ${stats.losses}L · ${stats.be} BE` },
      { label: 'Net P/L',        value: `${stats.totalPL >= 0 ? '+' : ''}$${stats.totalPL.toFixed(2)}`, col: stats.totalPL >= 0 ? C.profit : C.loss },
      { label: 'Win Rate',       value: `${stats.winRate.toFixed(1)}%`,                         col: stats.winRate >= 50 ? C.profit : C.loss },
      { label: 'Profit Factor',  value: stats.profitFactor >= 999 ? '∞' : stats.profitFactor.toFixed(2), col: stats.profitFactor >= 1.5 ? C.profit : stats.profitFactor >= 1 ? C.warn : C.loss },
      { label: 'Expectancy',     value: `${stats.expectancy >= 0 ? '+' : ''}$${stats.expectancy.toFixed(2)}`, col: stats.expectancy >= 0 ? C.profit : C.loss },
      { label: 'Avg Win',        value: `+$${stats.avgWin.toFixed(2)}`,                         col: C.profit },
      { label: 'Avg Loss',       value: `-$${stats.avgLoss.toFixed(2)}`,                        col: C.loss },
      { label: 'Best Trade',     value: `+$${stats.best.toFixed(2)}`,                           col: C.profit },
      { label: 'Worst Trade',    value: `-$${Math.abs(stats.worst).toFixed(2)}`,                col: C.loss },
      { label: 'Avg R-Multiple', value: stats.avgR != null ? `${stats.avgR >= 0 ? '+' : ''}${stats.avgR.toFixed(2)}R` : '—', col: stats.avgR >= 0 ? C.profit : C.loss },
    ];

    return this._drawStatGrid(doc, items, W, y, 5);
  }

  // ─── Risk Grid ────────────────────────────────────────────────────────────

  _drawRiskGrid(doc, stats, W, y) {
    if (!stats) return y + 8;

    const items = [
      { label: 'Max Drawdown',  value: `-$${stats.maxDD.toFixed(2)}`,            col: C.loss },
      { label: 'Sharpe Ratio',  value: stats.sharpe.toFixed(2),                  col: stats.sharpe >= 1 ? C.profit : stats.sharpe >= 0 ? C.warn : C.loss,  sub: '(AvgRet/StdDev)×√252' },
      { label: 'Sortino Ratio', value: stats.sortino.toFixed(2),                 col: stats.sortino >= 1 ? C.profit : stats.sortino >= 0 ? C.warn : C.loss, sub: 'Downside-adj Sharpe' },
      { label: 'Calmar Ratio',  value: stats.calmar >= 999 ? '∞' : stats.calmar.toFixed(2), col: stats.calmar >= 0.5 ? C.profit : C.loss, sub: 'P&L / Max DD' },
      { label: 'Std Deviation', value: `$${stats.std.toFixed(2)}`,               col: C.subtext, sub: 'Return volatility' },
    ];

    return this._drawStatGrid(doc, items, W, y, 5);
  }

  // ─── Generic Stat Grid ────────────────────────────────────────────────────

  _drawStatGrid(doc, items, W, y, cols) {
    const margin = 14;
    const gap    = 3;
    const cardW  = (W - margin * 2 - gap * (cols - 1)) / cols;
    const cardH  = 20;

    items.forEach((item, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x   = margin + col * (cardW + gap);
      const cy  = y + row * (cardH + gap);

      // Card
      this._rect(doc, x, cy, cardW, cardH, C.cardAlt);

      // Border
      doc.setDrawColor(...C.border);
      doc.setLineWidth(0.3);
      doc.rect(x, cy, cardW, cardH, 'S');

      // Label
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6);
      doc.setTextColor(...C.muted);
      doc.text(item.label.toUpperCase(), x + 5, cy + 6);

      // Value
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(...(item.col || C.text));
      doc.text(item.value, x + 5, cy + 15);

      // Sub
      if (item.sub) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6);
        doc.setTextColor(...C.muted);
        doc.text(item.sub, x + 5, cy + 19);
      }
    });

    const rows = Math.ceil(items.length / cols);
    return y + rows * (cardH + gap) + 6;
  }

  // ─── Trade Table ──────────────────────────────────────────────────────────

  _drawTradeTable(doc, trades, W, y, pageH) {
    if (!trades || trades.length === 0) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(9);
      doc.setTextColor(...C.muted);
      doc.text('No trades in this period.', 14, y + 8);
      return y + 16;
    }

    // Check remaining space — add new page if needed
    if (y > pageH - 60) {
      doc.addPage();
      this._rect(doc, 0, 0, W, pageH, C.bg);
      y = 16;
    }

    const rows = trades.map(t => [
      t.date              || '—',
      t.entry_time        ? t.entry_time.substring(0, 5) : '—',
      t.account_name      || '—',
      t.model_name        || '—',
      t.pair              || '—',
      t.direction         || '—',
      t.entry_price != null ? `$${parseFloat(t.entry_price).toFixed(2)}` : '—',
      t.sl_points   != null ? String(t.sl_points)   : '—',
      t.tp_points   != null ? String(t.tp_points)   : '—',
      t.position_size != null ? String(t.position_size) : '1',
      t.r_multiple  != null ? `${parseFloat(t.r_multiple).toFixed(2)}R` : '—',
      t.net_pl      != null ? `${t.net_pl >= 0 ? '+' : ''}$${parseFloat(t.net_pl).toFixed(2)}` : '—',
      t.trade_grade || '—',
    ]);

    doc.autoTable({
      startY:  y,
      margin:  { left: 14, right: 14 },
      head:    [['Date', 'Time', 'Account', 'Model', 'Pair', 'Dir', 'Entry', 'SL', 'TP', 'Sz', 'R', 'P/L', 'Grade']],
      body:    rows,
      theme:   'plain',
      styles: {
        fontSize:    7,
        cellPadding: { top: 3, bottom: 3, left: 3, right: 3 },
        font:        'helvetica',
        textColor:   C.subtext,
        fillColor:   C.bg,
        lineWidth:   0,
        minCellHeight: 8,
      },
      headStyles: {
        fillColor:  [16, 20, 28],
        textColor:  C.muted,
        fontStyle:  'bold',
        fontSize:   6.5,
        lineWidth:  0,
      },
      alternateRowStyles: {
        fillColor: [14, 18, 26],
      },
      columnStyles: {
        0:  { cellWidth: 17 },
        1:  { cellWidth: 12 },
        2:  { cellWidth: 20 },
        3:  { cellWidth: 22 },
        4:  { cellWidth: 14, fontStyle: 'bold', textColor: C.text },
        5:  { cellWidth: 11 },
        6:  { cellWidth: 16 },
        7:  { cellWidth: 10 },
        8:  { cellWidth: 10 },
        9:  { cellWidth:  8 },
        10: { cellWidth: 14 },
        11: { cellWidth: 20 },
        12: { cellWidth: 13 },
      },
      didParseCell: (data) => {
        if (data.section === 'head') return;

        // P/L column — color by value
        if (data.column.index === 11) {
          const raw = data.cell.text[0] || '';
          const val = parseFloat(raw.replace(/[^0-9.\-]/g, ''));
          if (!isNaN(val)) {
            data.cell.styles.textColor = val >= 0 ? C.profit : C.loss;
            data.cell.styles.fontStyle = 'bold';
          }
        }

        // Direction column — Long = accent, Short = loss
        if (data.column.index === 5) {
          const dir = (data.cell.text[0] || '').toLowerCase();
          if (dir === 'long')  data.cell.styles.textColor = C.accent;
          if (dir === 'short') data.cell.styles.textColor = C.loss;
          data.cell.styles.fontStyle = 'bold';
        }

        // Grade column
        if (data.column.index === 12) {
          const grade = (data.cell.text[0] || '').toUpperCase();
          if (grade === 'A+' || grade === 'A') data.cell.styles.textColor = C.profit;
          else if (grade === 'B') data.cell.styles.textColor = C.warn;
          else if (grade === 'C' || grade === 'F') data.cell.styles.textColor = C.loss;
          data.cell.styles.fontStyle = 'bold';
        }
      },

      // Page background on new pages
      didDrawPage: (data) => {
        const pageH = doc.internal.pageSize.getHeight();
        const pageW = doc.internal.pageSize.getWidth();
        doc.setFillColor(...C.bg);
        // Can't fill behind — handled by backgroundColor
      },
    });

    return doc.lastAutoTable.finalY + 8;
  }

  // ─── Footer ───────────────────────────────────────────────────────────────

  _drawFooterAllPages(doc, period, startDate, endDate) {
    const count = doc.internal.getNumberOfPages();
    const W     = doc.internal.pageSize.getWidth();
    const H     = doc.internal.pageSize.getHeight();

    for (let i = 1; i <= count; i++) {
      doc.setPage(i);

      // Footer bar
      this._rect(doc, 0, H - 9, W, 9, [8, 10, 16]);
      this._rect(doc, 0, H - 9, W, 0.5, C.border);

      // Left — branding
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.5);
      doc.setTextColor(...C.accent);
      doc.text('FLOWJOB JOURNAL', 14, H - 3.5);

      // Center — confidential
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6);
      doc.setTextColor(...C.muted);
      doc.text('Confidential — For Personal Use Only', W / 2, H - 3.5, { align: 'center' });

      // Right — page number
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(...C.muted);
      doc.text(`Page ${i} / ${count}`, W - 14, H - 3.5, { align: 'right' });
    }
  }

  // ─── No Trades ────────────────────────────────────────────────────────────

  _drawNoTrades(doc, W, y) {
    this._rect(doc, 14, y, W - 28, 20, C.card);
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    doc.setTextColor(...C.muted);
    doc.text('No trades found for this period.', W / 2, y + 12, { align: 'center' });
    return y + 28;
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  _rect(doc, x, y, w, h, color) {
    doc.setFillColor(...color);
    doc.rect(x, y, w, h, 'F');
  }

  _fmtDateLong(dateStr) {
    if (!dateStr) return '—';
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
    });
  }

  _calcStats(trades) {
    if (!trades || trades.length === 0) return null;

    const wins   = trades.filter(t => t.net_pl > 0);
    const losses = trades.filter(t => t.net_pl < 0);
    const be     = trades.filter(t => t.net_pl === 0);

    const grossW = wins.reduce((s, t) => s + t.net_pl, 0);
    const grossL = Math.abs(losses.reduce((s, t) => s + t.net_pl, 0));
    const totalPL = trades.reduce((s, t) => s + t.net_pl, 0);

    const winRate = (wins.length / trades.length) * 100;
    const avgWin  = wins.length   ? grossW / wins.length   : 0;
    const avgLoss = losses.length ? grossL / losses.length : 0;

    const pf = grossL > 0 ? grossW / grossL : grossW > 0 ? 9999 : 0;
    const expectancy = (winRate / 100) * avgWin - ((100 - winRate) / 100) * avgLoss;

    // R-multiple
    const rVals = trades.filter(t => t.r_multiple != null).map(t => parseFloat(t.r_multiple));
    const avgR  = rVals.length ? rVals.reduce((s, r) => s + r, 0) / rVals.length : null;

    // Best / worst
    const best  = Math.max(...trades.map(t => t.net_pl));
    const worst = Math.min(...trades.map(t => t.net_pl));

    // Sharpe / Sortino
    const returns = trades.map(t => t.net_pl);
    const avgRet  = returns.reduce((s, r) => s + r, 0) / returns.length;
    const variance = returns.reduce((s, r) => s + Math.pow(r - avgRet, 2), 0) / returns.length;
    const std     = Math.sqrt(variance);
    const sharpe  = std > 0 ? (avgRet / std) * Math.sqrt(252) : 0;

    const negReturns = returns.filter(r => r < 0);
    const downVar    = negReturns.length
      ? negReturns.reduce((s, r) => s + Math.pow(r, 2), 0) / negReturns.length
      : 0;
    const downDev = Math.sqrt(downVar);
    const sortino = downDev > 0 ? (avgRet / downDev) * Math.sqrt(252) : 0;

    // Max drawdown
    let peak = 0, equity = 0, maxDD = 0;
    [...trades]
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .forEach(t => {
        equity += t.net_pl;
        if (equity > peak) peak = equity;
        const dd = peak - equity;
        if (dd > maxDD) maxDD = dd;
      });

    const calmar = maxDD > 0 ? totalPL / maxDD : totalPL > 0 ? 9999 : 0;

    return {
      totalTrades: trades.length,
      wins:  wins.length,
      losses: losses.length,
      be: be.length,
      totalPL, grossW, grossL,
      winRate, avgWin, avgLoss,
      profitFactor: pf,
      expectancy,
      avgR, best, worst,
      sharpe, sortino, calmar,
      std, maxDD,
    };
  }
}

module.exports = PDFExporter;