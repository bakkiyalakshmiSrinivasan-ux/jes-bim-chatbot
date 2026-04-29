// api/report/helpers.js
// Shared layout builders and style tokens for the JES BIM Master Template Pack.
// All 16 templates compose themselves from these building blocks so the visual
// system stays consistent with JES_BIM_Master_Template_Pack.pdf v1.0.

// ---------- Brand tokens ----------
const BRAND = {
  lumpSum: {
    primary: '#1F4FCB',       // deep blue — Part A header bar & section titles
    primaryDark: '#173FA0',
    tableHead: '#1F4FCB',
    tableHeadText: '#FFFFFF',
    labelBg: '#E9EFFB',       // light blue for info-label column
    altRowBg: '#F5F7FC',
    footerLabel: 'Template v1.0',
  },
  resourcing: {
    primary: '#0B8F6A',       // teal/green — Part B header bar & section titles
    primaryDark: '#076A4F',
    tableHead: '#0B8F6A',
    tableHeadText: '#FFFFFF',
    labelBg: '#E2F4EC',
    altRowBg: '#F3FAF6',
    footerLabel: 'Resourcing Template v1.0',
  },
};

const TEXT = {
  ink: '#111827',
  muted: '#6B7280',
  border: '#CBD5E1',
  placeholder: '#94A3B8',
};

// ---------- Page defaults ----------
const PAGE = {
  size: 'A4',
  margins: [56, 92, 56, 64], // left, top, right, bottom — leaves room for header/footer
};

// ---------- Header band ----------
function headerBand(theme, rightLabel) {
  return function (currentPage, pageCount) {
    return {
      margin: [0, 0, 0, 0],
      stack: [
        {
          canvas: [
            {
              type: 'rect',
              x: 0,
              y: 0,
              w: 595.28,
              h: 52,
              color: theme.primary,
            },
          ],
        },
        {
          columns: [
            {
              width: '*',
              text: 'JES BIM OPERATIONS',
              color: '#FFFFFF',
              bold: true,
              fontSize: 11,
              margin: [56, -36, 0, 0],
            },
            {
              width: 'auto',
              text: rightLabel || '',
              color: '#FFFFFF',
              alignment: 'right',
              fontSize: 10,
              margin: [0, -36, 56, 0],
            },
          ],
        },
      ],
    };
  };
}

function headerBandResourcing(rightLabel) {
  return function (currentPage, pageCount) {
    return {
      stack: [
        {
          canvas: [
            {
              type: 'rect',
              x: 0,
              y: 0,
              w: 595.28,
              h: 52,
              color: BRAND.resourcing.primary,
            },
          ],
        },
        {
          columns: [
            {
              width: '*',
              text: 'JES BIM — RESOURCING',
              color: '#FFFFFF',
              bold: true,
              fontSize: 11,
              margin: [56, -36, 0, 0],
            },
            {
              width: 'auto',
              text: rightLabel || '',
              color: '#FFFFFF',
              alignment: 'right',
              fontSize: 10,
              margin: [0, -36, 56, 0],
            },
          ],
        },
      ],
    };
  };
}

// ---------- Footer band ----------
function footerBand(theme) {
  return function (currentPage, pageCount) {
    return {
      margin: [56, 20, 56, 0],
      columns: [
        { text: 'Confidential — JES BIM Operations', fontSize: 8, color: TEXT.muted, width: '*' },
        { text: theme.footerLabel, fontSize: 8, color: TEXT.muted, alignment: 'center', width: '*' },
        { text: 'Page ' + currentPage, fontSize: 8, color: TEXT.muted, alignment: 'right', width: '*' },
      ],
    };
  };
}

// ---------- Page title block ----------
function pageTitle(theme, title, subtitle) {
  return [
    { text: title, color: theme.primary, bold: true, fontSize: 22, margin: [0, 4, 0, 0] },
    subtitle ? { text: subtitle, color: TEXT.muted, fontSize: 10, margin: [0, 2, 0, 14] } : { text: '', margin: [0, 0, 0, 10] },
  ];
}

function sectionTitle(theme, text) {
  return { text, color: theme.primary, bold: true, fontSize: 13, margin: [0, 12, 0, 6] };
}

// ---------- Info table (2-column label/value) ----------
function infoTable(theme, rows) {
  return {
    margin: [0, 0, 0, 4],
    table: {
      widths: [140, '*'],
      body: rows.map(([label, value]) => [
        { text: label, bold: true, fillColor: theme.labelBg, color: TEXT.ink, margin: [6, 6, 6, 6], border: [true, true, true, true], fontSize: 9.5 },
        { text: fmt(value), color: TEXT.ink, margin: [6, 6, 6, 6], border: [true, true, true, true], fontSize: 9.5 },
      ]),
    },
    layout: gridLayout(TEXT.border),
  };
}

// ---------- Data table (header row + rows) ----------
function dataTable(theme, headers, rows, opts = {}) {
  const widths = opts.widths || Array(headers.length).fill('*');
  const headBody = headers.map(h => ({
    text: h,
    bold: true,
    color: theme.tableHeadText,
    fillColor: theme.tableHead,
    margin: [6, 6, 6, 6],
    fontSize: 9.5,
  }));
  const body = rows.map((row, rowIdx) =>
    row.map(cell => {
      const text = cell && typeof cell === 'object' && 'text' in cell ? cell.text : cell;
      const extra = cell && typeof cell === 'object' ? cell : {};
      return {
        text: fmt(text),
        margin: [6, 5, 6, 5],
        fontSize: 9.5,
        color: TEXT.ink,
        fillColor: rowIdx % 2 === 1 ? theme.altRowBg : undefined,
        alignment: extra.align,
        bold: extra.bold,
      };
    })
  );
  return {
    margin: [0, 0, 0, 4],
    table: { headerRows: 1, widths, body: [headBody, ...body] },
    layout: gridLayout(TEXT.border),
  };
}

// ---------- Signature block ----------
function signatureBlock(theme, preparedBy, approvedBy) {
  return {
    margin: [0, 14, 0, 0],
    table: {
      widths: ['*', '*'],
      body: [
        [
          { text: 'Prepared By', bold: true, fillColor: theme.tableHead, color: theme.tableHeadText, margin: [6, 6, 6, 6], fontSize: 9.5 },
          { text: 'Approved By', bold: true, fillColor: theme.tableHead, color: theme.tableHeadText, margin: [6, 6, 6, 6], fontSize: 9.5 },
        ],
        [
          { text: fmt(preparedBy && preparedBy.nameRole) || '< Name — Role >', margin: [6, 8, 6, 8], fontSize: 9.5 },
          { text: fmt(approvedBy && approvedBy.nameRole) || '< Name — Role >', margin: [6, 8, 6, 8], fontSize: 9.5 },
        ],
        [
          { text: 'Signature: _______________', margin: [6, 8, 6, 8], fontSize: 9.5 },
          { text: 'Signature: _______________', margin: [6, 8, 6, 8], fontSize: 9.5 },
        ],
        [
          { text: 'Date: ' + (fmt(preparedBy && preparedBy.date) || '< DD-MMM-YYYY >'), margin: [6, 8, 6, 8], fontSize: 9.5 },
          { text: 'Date: ' + (fmt(approvedBy && approvedBy.date) || '< DD-MMM-YYYY >'), margin: [6, 8, 6, 8], fontSize: 9.5 },
        ],
      ],
    },
    layout: gridLayout(TEXT.border),
  };
}

// ---------- Bullet list ----------
function bulletList(items) {
  return {
    ul: items.map(i => ({ text: i, fontSize: 9.5, color: TEXT.ink, margin: [0, 1, 0, 1] })),
    margin: [0, 2, 0, 4],
  };
}

// ---------- Formatted bullet list with bold label ----------
function kvBullets(pairs) {
  return {
    ul: pairs.map(([k, v]) => ({
      text: [{ text: k + ': ', bold: true }, { text: fmt(v) }],
      fontSize: 9.5,
      color: TEXT.ink,
      margin: [0, 1, 0, 1],
    })),
    margin: [0, 2, 0, 4],
  };
}

// ---------- Grid table layout ----------
function gridLayout(borderColor) {
  return {
    hLineWidth: () => 0.5,
    vLineWidth: () => 0.5,
    hLineColor: () => borderColor,
    vLineColor: () => borderColor,
    paddingTop: () => 0,
    paddingBottom: () => 0,
    paddingLeft: () => 0,
    paddingRight: () => 0,
  };
}

// ---------- Value formatting ----------
function fmt(v) {
  if (v === null || v === undefined || v === '') return '—';
  if (typeof v === 'number') return String(v);
  return String(v);
}

function money(v, currency = 'AED') {
  if (v === null || v === undefined || v === '') return '—';
  const n = typeof v === 'number' ? v : Number(v);
  if (!isFinite(n)) return '—';
  return n.toLocaleString('en-US', { maximumFractionDigits: 2, minimumFractionDigits: 2 }) + ' ' + currency;
}

function pct(v, decimals = 1) {
  if (v === null || v === undefined || v === '') return '—';
  const n = typeof v === 'number' ? v : Number(v);
  if (!isFinite(n)) return '—';
  return n.toFixed(decimals) + '%';
}

// ---------- Validation badge ----------
function validationBadge(status) {
  // status: 'verified' | 'issue' | 'failed'
  const map = {
    verified: { text: '✔ Verified', color: '#16A34A' },
    issue: { text: '■ Issue detected', color: '#D97706' },
    failed: { text: '✘ Failed', color: '#DC2626' },
  };
  const s = map[status] || map.issue;
  return { text: [{ text: 'Status: ', bold: true }, { text: s.text, color: s.color }], fontSize: 9.5, margin: [0, 4, 0, 0] };
}

module.exports = {
  BRAND,
  TEXT,
  PAGE,
  headerBand,
  headerBandResourcing,
  footerBand,
  pageTitle,
  sectionTitle,
  infoTable,
  dataTable,
  signatureBlock,
  bulletList,
  kvBullets,
  validationBadge,
  fmt,
  money,
  pct,
};
