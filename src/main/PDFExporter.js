/**
 * PDFExporter.js — Flowjob Journal PDF Report Generator
 * CommonJS / Electron main process compatible
 * Uses jsPDF + jspdf-autotable (already in dependencies)
 */

const { jsPDF } = require('jspdf');
require('jspdf-autotable');
const path = require('path');

// ── Brand colors (RGB) ──────────────────────────────────────────────────────
const C = {
  bg:       [13,  13,  13],   // #0d0d0d
  accent:   [134, 112, 255],  // #8670ff  purple
  loss:     [255,  0, 149],   // #ff0095  pink
  profit:   [134, 112, 255],  // same as accent for wins
  text:     [232, 237, 243],  // #e8edf3
  muted:    [85,  95, 110],   // #555f6e
  border:   [30,  30,  30],   // #1e1e1e
  white:    [255, 255, 255],
  darkCard: [21,  21,  21],   // #151515
  green:    [0,  200, 100],
};

class PDFExporter {
  constructor(db) {
    this.db = db;
  }

  // ─── Public API ────────────────────────────────────────────────────────────

  generateDailyReport(date, filePath) {
    const trades = this.db.getTrades({ startDate: date, endDate: date });
    const title  = `Daily Report — ${this._fmtDate(date)}`;
    this._buildReport({ trades, title, filePath, period: 'daily', startDate: date, endDate: date });
  }

  generateWeeklyReport(startDate, endDate, filePath) {
    const trades = this.db.getTrades({ startDate, endDate });
    const title  = `Weekly Report — ${this._fmtDate(startDate)} to ${this._fmtDate(endDate)}`;
    this._buildReport({ trades, title, filePath, period: 'weekly', startDate, endDate });
  }

  generateMonthlyReport(year, month, filePath) {
    const start  = `${year}-${String(month).padStart(2, '0')}-01`;
    const end    = new Date(year, month, 0).toISOString().split('T')[0];
    const trades = this.db.getTrades({ startDate: start, endDate: end });
    const monthName = new Date(year, month - 1, 1)
      .toLocaleString('en-US', { month: 'long', year: 'numeric' });
    const title  = `Monthly Report — ${monthName}`;
    this._buildReport({ trades, title, filePath, period: 'monthly', startDate: start, endDate: end });
  }

  generateCustomReport(startDate, endDate, filePath) {
    const trades = this.db.getTrades({ startDate, endDate });
    const title  = `Custom Report — ${this._fmtDate(startDate)} to ${this._fmtDate(endDate)}`;
    this._buildReport({ trades, title, filePath, period: 'custom', startDate, endDate });
  }

  // ─── Core builder ──────────────────────────────────────────────────────────

  _buildReport({ trades, title, filePath, period, startDate, endDate }) {
    const doc    = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const stats  = this._calcStats(trades);
    const W      = doc.internal.pageSize.getWidth();
    const H      = doc.internal.pageSize.getHeight();

    // ── Page background ──
    this._fillRect(doc, 0, 0, W, H, C.bg);

    let y = 0;

    // ── Header banner ──
    y = this._drawHeader(doc, title, W, y);

    // ── Stats summary cards ──
    y = this._drawStatCards(doc, stats, W, y);

    // ── Performance breakdown ──
    y = this._drawPerformanceSection(doc, stats, trades, W, y);

    // ── Trade table ──
    y = this._drawTradeTable(doc, trades, W, y, H);

    // ── Footer on all pages ──
    this._drawFooterAllPages(doc, period, startDate, endDate);

    doc.save(filePath);
  }

  // ─── Header ───────────────────────────────────────────────────────────────

  _drawHeader(doc, title, W, y) {
    const H_banner = 36;

    // Banner background gradient effect (two rects)
    this._fillRect(doc, 0, 0, W, H_banner, [10, 10, 10]);
    this._fillRect(doc, 0, H_banner - 2, W, 2, C.accent);

    // Logo text
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...C.accent);
    doc.text('FLOWJOB JOURNAL', 14, 13);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...C.muted);
    doc.text('Build Your System. Trade With Discipline.', 14, 19);

    // Generated timestamp
    const now = new Date().toLocaleString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
    doc.setFontSize(7.5);
    doc.setTextColor(...C.muted);
    doc.text(`Generated: ${now}`, W - 14, 13, { align: 'right' });

    // Report title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(...C.text);
    doc.text(title, 14, 30);

    return H_banner + 6;
  }

  // ─── Stat Cards ───────────────────────────────────────────────────────────

  _drawStatCards(doc, stats, W, y) {
    if (!stats) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(10);
      doc.setTextColor(...C.muted);
      doc.text('No trades in this period.', 14, y + 10);
      return y + 20;
    }

    const cards = [
      { label: 'Total Trades',  value: String(stats.totalTrades),           neutral: true },
      { label: 'Win Rate',      value: `${stats.winRate.toFixed(1)}%`,       pos: stats.winRate >= 50 },
      { label: 'Total P/L',     value: `$${stats.totalPL.toFixed(2)}`,       pos: stats.totalPL >= 0 },
      { label: 'Profit Factor', value: stats.profitFactor.toFixed(2),        pos: stats.profitFactor >= 1.5 },
      { label: 'Avg R',         value: `${stats.avgRMultiple.toFixed(2)}R`,  pos: stats.avgRMultiple >= 0 },
      { label: 'Max Drawdown',  value: `-$${stats.maxDrawdown.toFixed(2)}`,  pos: false },
      { label: 'Expectancy',    value: `$${stats.expectancy.toFixed(2)}`,    pos: stats.expectancy >= 0 },
      { label: 'Sharpe Ratio',  value: stats.sharpeRatio.toFixed(2),         neutral: true },
    ];

    const cols   = 4;
    const cW     = (W - 28) / cols;
    const cH     = 22;
    const gap    = 3;

    cards.forEach((card, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x   = 14 + col * (cW + gap);
      const cy  = y + row * (cH + gap);

      // Card background
      this._fillRect(doc, x, cy, cW, cH, C.darkCard);
      // Top accent line
      const lineColor = card.neutral ? C.muted : card.pos ? C.accent : C.loss;
      this._fillRect(doc, x, cy, cW, 1.5, lineColor);

      // Label
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.5);
      doc.setTextColor(...C.muted);
      doc.text(card.label.toUpperCase(), x + 5, cy + 7);

      // Value
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      const valColor = card.neutral ? C.text : card.pos ? C.accent : C.loss;
      doc.setTextColor(...valColor);
      doc.text(card.value, x + 5, cy + 17);
    });

    const rows = Math.ceil(cards.length / cols);
    return y + rows * (cH + gap) + 6;
  }

  // ─── Performance Section ──────────────────────────────────────────────────

  _drawPerformanceSection(doc, stats, trades, W, y) {
    if (!stats) return y;

    // Section title
    y = this._sectionTitle(doc, 'Performance Breakdown', W, y);

    // Two-column layout
    const colW = (W - 32) / 2;
    const startY = y;

    // Left col — Win/Loss breakdown
    const leftX = 14;
    let ly = startY;

    const leftRows = [
      ['Winning Trades', `${stats.wins}  (${stats.winRate.toFixed(1)}%)`, true],
      ['Losing Trades',  `${stats.losses}  (${(100 - stats.winRate).toFixed(1)}%)`, false],
      ['Avg Win',        `$${stats.avgWin.toFixed(2)}`, true],
      ['Avg Loss',       `-$${stats.avgLoss.toFixed(2)}`, false],
      ['Best Trade',     `$${stats.bestTrade.toFixed(2)}`, true],
      ['Worst Trade',    `-$${Math.abs(stats.worstTrade).toFixed(2)}`, false],
      ['Std Deviation',  `$${stats.stdDev.toFixed(2)}`, null],
      ['Sortino Ratio',  stats.sortinoRatio.toFixed(2), null],
    ];

    leftRows.forEach(([label, value, pos], i) => {
      const rowY = ly + i * 8;
      if (i % 2 === 0) this._fillRect(doc, leftX, rowY - 1, colW, 8, [18, 18, 18]);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(...C.muted);
      doc.text(label, leftX + 4, rowY + 5);
      doc.setFont('helvetica', 'bold');
      const vc = pos === null ? C.text : pos ? C.accent : C.loss;
      doc.setTextColor(...vc);
      doc.text(value, leftX + colW - 4, rowY + 5, { align: 'right' });
    });

    // Right col — Day / direction stats
    const rightX = 14 + colW + 4;
    let ry = startY;

    // By direction
    const longs  = trades.filter(t => t.direction === 'Long');
    const shorts = trades.filter(t => t.direction === 'Short');
    const longPL  = longs.reduce((s, t)  => s + t.net_pl, 0);
    const shortPL = shorts.reduce((s, t) => s + t.net_pl, 0);
    const longWR  = longs.length  ? longs.filter(t  => t.net_pl > 0).length / longs.length  * 100 : 0;
    const shortWR = shorts.length ? shorts.filter(t => t.net_pl > 0).length / shorts.length * 100 : 0;

    // Best/worst day
    const dayMap = {};
    trades.forEach(t => { dayMap[t.date] = (dayMap[t.date] || 0) + t.net_pl; });
    const dayVals  = Object.values(dayMap);
    const bestDay  = dayVals.length ? Math.max(...dayVals) : 0;
    const worstDay = dayVals.length ? Math.min(...dayVals) : 0;
    const greenDays = dayVals.filter(v => v > 0).length;

    const rightRows = [
      ['Long Trades',   `${longs.length}`, null],
      ['Long P/L',      `$${longPL.toFixed(2)}`, longPL >= 0],
      ['Long Win Rate', `${longWR.toFixed(1)}%`, longWR >= 50],
      ['Short Trades',  `${shorts.length}`, null],
      ['Short P/L',     `$${shortPL.toFixed(2)}`, shortPL >= 0],
      ['Short Win Rate',`${shortWR.toFixed(1)}%`, shortWR >= 50],
      ['Best Day',      `$${bestDay.toFixed(2)}`, true],
      ['Worst Day',     `-$${Math.abs(worstDay).toFixed(2)}`, false],
    ];

    rightRows.forEach(([label, value, pos], i) => {
      const rowY = ry + i * 8;
      if (i % 2 === 0) this._fillRect(doc, rightX, rowY - 1, colW, 8, [18, 18, 18]);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(...C.muted);
      doc.text(label, rightX + 4, rowY + 5);
      doc.setFont('helvetica', 'bold');
      const vc = pos === null ? C.text : pos ? C.accent : C.loss;
      doc.setTextColor(...vc);
      doc.text(value, rightX + colW - 4, rowY + 5, { align: 'right' });
    });

    const maxRows = Math.max(leftRows.length, rightRows.length);
    return startY + maxRows * 8 + 8;
  }

  // ─── Trade Table ──────────────────────────────────────────────────────────

  _drawTradeTable(doc, trades, W, y, pageH) {
    if (!trades || trades.length === 0) return y;

    y = this._sectionTitle(doc, 'Trade Log', W, y);

    const rows = trades.map(t => [
      this._fmtDate(t.date),
      t.pair,
      t.direction,
      t.model_name  || '—',
      t.entry_price != null ? String(t.entry_price) : '—',
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
      head:    [['Date', 'Pair', 'Dir', 'Model', 'Entry', 'SL', 'TP', 'Sz', 'R', 'P/L', 'Grade']],
      body:    rows,
      theme:   'plain',
      styles: {
        fontSize:  7.5,
        cellPadding: 2.5,
        font:      'helvetica',
        textColor: C.muted,
        fillColor: C.bg,
        lineWidth: 0,
      },
      headStyles: {
        fillColor:  [21, 21, 21],
        textColor:  C.muted,
        fontStyle:  'bold',
        fontSize:   6.5,
      },
      alternateRowStyles: {
        fillColor: [18, 18, 18],
      },
      columnStyles: {
        0:  { cellWidth: 18 },
        1:  { cellWidth: 14, fontStyle: 'bold', textColor: C.text },
        2:  { cellWidth: 12 },
        3:  { cellWidth: 28 },
        4:  { cellWidth: 16 },
        5:  { cellWidth: 12 },
        6:  { cellWidth: 12 },
        7:  { cellWidth: 8  },
        8:  { cellWidth: 16 },
        9:  { cellWidth: 22 },
        10: { cellWidth: 14 },
      },
      didParseCell: (data) => {
        // Colour the P/L column
        if (data.column.index === 9 && data.section === 'body') {
          const val = parseFloat(data.cell.text[0].replace(/[^0-9.\-]/g, ''));
          data.cell.styles.textColor = val >= 0 ? C.accent : C.loss;
          data.cell.styles.fontStyle = 'bold';
        }
        // Direction colour
        if (data.column.index === 2 && data.section === 'body') {
          data.cell.styles.textColor = data.cell.text[0] === 'Long' ? C.accent : C.loss;
          data.cell.styles.fontStyle = 'bold';
        }
      },
    });

    return doc.lastAutoTable.finalY + 8;
  }

  // ─── Footer ───────────────────────────────────────────────────────────────

  _drawFooterAllPages(doc, period, startDate, endDate) {
    const pageCount = doc.internal.getNumberOfPages();
    const W = doc.internal.pageSize.getWidth();
    const H = doc.internal.pageSize.getHeight();

    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      this._fillRect(doc, 0, H - 10, W, 10, [10, 10, 10]);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(...C.muted);
      doc.text('Flowjob Journal — Confidential', 14, H - 3.5);
      doc.text(`Page ${i} of ${pageCount}`, W - 14, H - 3.5, { align: 'right' });
    }
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  _sectionTitle(doc, text, W, y) {
    this._fillRect(doc, 14, y, W - 28, 8, [21, 21, 21]);
    this._fillRect(doc, 14, y, 2, 8, C.accent);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...C.accent);
    doc.text(text.toUpperCase(), 20, y + 5.5);
    return y + 12;
  }

  _fillRect(doc, x, y, w, h, color) {
    doc.setFillColor(...color);
    doc.rect(x, y, w, h, 'F');
  }

  _fmtDate(dateStr) {
    if (!dateStr) return '—';
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
    });
  }

  _calcStats(trades) {
    if (!trades || trades.length === 0) return null;

    const wins   = trades.filter(t => t.net_pl > 0);
    const losses = trades.filter(t => t.net_pl < 0);

    const totalWins   = wins.reduce((s, t)   => s + t.net_pl, 0);
    const totalLosses = Math.abs(losses.reduce((s, t) => s + t.net_pl, 0));

    const winRate      = (wins.length / trades.length) * 100;
    const avgWin       = wins.length   ? totalWins / wins.length     : 0;
    const avgLoss      = losses.length ? totalLosses / losses.length : 0;
    const profitFactor = totalLosses > 0 ? totalWins / totalLosses : totalWins;
    const expectancy   = (winRate / 100) * avgWin - ((100 - winRate) / 100) * avgLoss;

    const returns  = trades.map(t => t.net_pl);
    const avgRet   = returns.reduce((s, r) => s + r, 0) / returns.length;
    const stdDev   = Math.sqrt(
      returns.reduce((s, r) => s + Math.pow(r - avgRet, 2), 0) / returns.length
    );
    const sharpeRatio = stdDev > 0 ? (avgRet / stdDev) * Math.sqrt(252) : 0;

    const negReturns = returns.filter(r => r < 0);
    const downDev    = negReturns.length
      ? Math.sqrt(negReturns.reduce((s, r) => s + Math.pow(r, 2), 0) / negReturns.length)
      : stdDev;
    const sortinoRatio = downDev > 0 ? (avgRet / downDev) * Math.sqrt(252) : 0;

    let cum = 0, peak = 0, maxDrawdown = 0;
    [...trades].sort((a, b) => new Date(a.date) - new Date(b.date)).forEach(t => {
      cum += t.net_pl;
      if (cum > peak) peak = cum;
      const dd = peak - cum;
      if (dd > maxDrawdown) maxDrawdown = dd;
    });

    const rTrades = trades.filter(t => t.r_multiple != null);
    const avgRMultiple = rTrades.length
      ? rTrades.reduce((s, t) => s + t.r_multiple, 0) / rTrades.length
      : 0;

    return {
      totalTrades:  trades.length,
      wins:         wins.length,
      losses:       losses.length,
      winRate,
      avgWin,
      avgLoss,
      profitFactor,
      expectancy,
      sharpeRatio,
      sortinoRatio,
      stdDev,
      maxDrawdown,
      avgRMultiple,
      totalPL:   trades.reduce((s, t) => s + t.net_pl, 0),
      bestTrade: Math.max(...trades.map(t => t.net_pl)),
      worstTrade:Math.min(...trades.map(t => t.net_pl)),
    };
  }
}

module.exports = PDFExporter;