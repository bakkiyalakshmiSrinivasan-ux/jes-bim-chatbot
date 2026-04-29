import { NextResponse } from 'next/server';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

// ============================================================
// JES BIM Master Template Pack v1.0 — visual spec
// Lump-Sum reports use the deep-indigo theme (#1e3a8a);
// Resourcing reports use the emerald theme (#047857).
// ============================================================
type TemplateKind = 'lump-sum' | 'resourcing';

const THEMES: Record<TemplateKind, {
  primary: [number, number, number];
  primaryDark: [number, number, number];
  primarySoft: [number, number, number];
  bannerLeft: string;
}> = {
  'lump-sum': {
    primary:     [30, 58, 138],
    primaryDark: [23, 37, 84],
    primarySoft: [224, 231, 255],
    bannerLeft:  'JES BIM OPERATIONS',
  },
  'resourcing': {
    primary:     [4, 120, 87],
    primaryDark: [6, 78, 59],
    primarySoft: [209, 250, 229],
    bannerLeft:  'JES BIM — RESOURCING',
  },
};

const TYPE_PRESETS: Record<string, { kind: TemplateKind; label: string; title: string; subtitle: string }> = {
  'status':    { kind: 'lump-sum', label: 'Progress Report',   title: 'Monthly Progress Report',    subtitle: 'Project status, milestones, deliverables & risks' },
  'progress':  { kind: 'lump-sum', label: 'Progress Report',   title: 'Monthly Progress Report',    subtitle: 'Project status, milestones, deliverables & risks' },
  'kpi':       { kind: 'lump-sum', label: 'KPI Dashboard',     title: 'KPI Dashboard Report',       subtitle: 'Operational KPIs with trends and insights' },
  'manmonth':  { kind: 'lump-sum', label: 'Manmonth Report',   title: 'Manmonth Efficiency Report', subtitle: 'Planned vs Actual hours, utilization and productivity' },
  'portfolio': { kind: 'lump-sum', label: 'Portfolio Summary', title: 'Portfolio Billing Summary',  subtitle: 'Multi-project billing roll-up for leadership review' },
  'bench':     { kind: 'lump-sum', label: 'Bench Report',      title: 'Bench Resource Report',      subtitle: 'Unassigned employees, idle days and redeployment plan' },
};

function drawBanner(doc: jsPDF, kind: TemplateKind, rightLabel: string) {
  const theme = THEMES[kind];
  const w = doc.internal.pageSize.getWidth();
  doc.setFillColor(...theme.primary);
  doc.rect(0, 0, w, 22, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(theme.bannerLeft, 14, 14);
  doc.setFont('helvetica', 'normal');
  doc.text(rightLabel, w - 14, 14, { align: 'right' });
}

function drawFooter(doc: jsPDF, kind: TemplateKind) {
  const theme = THEMES[kind];
  const pageCount = (doc as unknown as { internal: { getNumberOfPages: () => number } }).internal.getNumberOfPages();
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setDrawColor(...theme.primary);
    doc.setLineWidth(0.3);
    doc.line(14, h - 16, w - 14, h - 16);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    doc.text('Confidential — JES BIM Operations', 14, h - 10);
    doc.text('Template v1.0', w / 2, h - 10, { align: 'center' });
    doc.text(`Page ${i} / ${pageCount}`, w - 14, h - 10, { align: 'right' });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const rawType  = String(body?.type || 'status').toLowerCase();
    const preset   = TYPE_PRESETS[rawType] || TYPE_PRESETS['status'];
    const kind     = (body?.kind === 'resourcing' || body?.kind === 'lump-sum' ? body.kind : preset.kind) as TemplateKind;
    const title    = body?.title    || preset.title;
    const subtitle = body?.subtitle || preset.subtitle;
    const label    = body?.reportLabel || preset.label;
    const theme    = THEMES[kind];

    const doc = new jsPDF();
    drawBanner(doc, kind, label);

    // Title block
    doc.setTextColor(...theme.primary);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(22);
    doc.text(title, 14, 38);
    doc.setTextColor(51, 65, 85);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(subtitle, 14, 46);

    // Section heading
    doc.setTextColor(...theme.primary);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text('Project Overview', 14, 60);

    // Sample project table — real data comes from /api/reports/generate.
    const reportData = body?.rows || [
      ['JES BIM Tower', 'In Progress', '45%',  '24',  'AED 1,200,000'],
      ['Alpha Mall',    'Delayed',     '12%',  '18',  'AED 800,000'],
      ['Omega Center',  'Completed',   '100%', '36',  'AED 3,500,000'],
    ];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (doc as any).autoTable({
      startY: 65,
      head: [['Project Name', 'Status', 'Progress', 'Man-Months', 'Claim Value']],
      body: reportData,
      theme: 'grid',
      headStyles: {
        fillColor: theme.primary,
        textColor: 255,
        fontStyle: 'bold',
      },
      styles:             { fontSize: 9.5, cellPadding: 3, lineColor: [203, 213, 225], lineWidth: 0.2 },
      alternateRowStyles: { fillColor: theme.primarySoft },
    });

    drawFooter(doc, kind);

    const pdfBase64 = doc.output('datauristring');
    return NextResponse.json({ url: pdfBase64, kind, reportLabel: label });
  } catch (error) {
    console.error('PDF Gen Error:', error);
    return NextResponse.json({ error: 'Could not generate PDF' }, { status: 500 });
  }
}
