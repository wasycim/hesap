type PdfOrientation = "portrait" | "landscape"
type PdfAction = "print" | "download"

interface PdfMetric {
  label: string
  value: string
}

interface PdfTable {
  title: string
  headers: string[]
  rows: Array<Array<string | number>>
  firstColumnWidth?: string
}

interface PdfChartDataPoint {
  label: string
  value: number
  color?: string
  percentage?: number
}

interface PdfChart {
  title: string
  type: "bar" | "timeline" | "doughnut"
  data: PdfChartDataPoint[]
}

interface PdfReportOptions {
  title: string
  subtitle?: string
  orientation?: PdfOrientation
  skipOrientationPicker?: boolean
  action?: PdfAction
  metrics?: PdfMetric[]
  tables: PdfTable[]
  charts?: PdfChart[]
  archive?: boolean
}

type DesktopBridge = {
  savePdfReport?: (payload: { title: string; orientation: PdfOrientation; html: string }) => Promise<{
    ok?: boolean
    canceled?: boolean
    error?: string
  }>
}

function escapeHtml(value: string | number) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function isMoneyLike(value: string | number) {
  const text = String(value)
  return text.includes("TL") || text.includes("\u20ba") || /^[-+]?[\d.,]+$/.test(text)
}

function choosePdfOrientation(
  defaultOrientation: PdfOrientation,
  onSelect: (orientation: PdfOrientation, action: PdfAction) => void,
) {
  const existing = document.getElementById("pdf-orientation-picker")
  if (existing) existing.remove()

  const overlay = document.createElement("div")
  overlay.id = "pdf-orientation-picker"
  overlay.innerHTML = `
    <div class="pdf-picker-backdrop">
      <div class="pdf-picker-panel" role="dialog" aria-modal="true" aria-labelledby="pdf-picker-title">
        <h2 id="pdf-picker-title">PDF islemi sec</h2>
        <p>Raporu A4 yatay veya dikey olarak yazdirabilir ya da direkt PDF dosyasi olarak indirebilirsin.</p>
        <div class="pdf-picker-grid">
          <button type="button" data-orientation="landscape" data-action="download" class="${defaultOrientation === "landscape" ? "primary" : ""}">
            <span>Yatay PDF indir</span>
            <small>A4 yatay dosya</small>
          </button>
          <button type="button" data-orientation="portrait" data-action="download" class="${defaultOrientation === "portrait" ? "primary" : ""}">
            <span>Dikey PDF indir</span>
            <small>A4 dikey dosya</small>
          </button>
          <button type="button" data-orientation="landscape" data-action="print">
            <span>Yatay yazdir</span>
            <small>Yazici / PDF olarak kaydet</small>
          </button>
          <button type="button" data-orientation="portrait" data-action="print">
            <span>Dikey yazdir</span>
            <small>Yazici / PDF olarak kaydet</small>
          </button>
          <button type="button" data-cancel="true" class="muted">Vazgec</button>
        </div>
      </div>
    </div>
  `

  const style = document.createElement("style")
  style.textContent = `
    #pdf-orientation-picker { position: fixed; inset: 0; z-index: 10000; font-family: Arial, Helvetica, sans-serif; }
    #pdf-orientation-picker .pdf-picker-backdrop { display: flex; min-height: 100%; align-items: center; justify-content: center; background: rgba(15, 23, 42, .52); padding: 24px; }
    #pdf-orientation-picker .pdf-picker-panel { width: min(560px, 100%); border: 1px solid rgba(148, 163, 184, .35); border-radius: 18px; background: #fff; box-shadow: 0 24px 80px rgba(15, 23, 42, .26); padding: 22px; color: #0f172a; }
    #pdf-orientation-picker h2 { margin: 0; font-size: 20px; line-height: 1.2; }
    #pdf-orientation-picker p { margin: 8px 0 0; color: #64748b; font-size: 14px; line-height: 1.45; }
    #pdf-orientation-picker .pdf-picker-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 18px; }
    #pdf-orientation-picker button { min-height: 58px; cursor: pointer; border: 1px solid #cbd5e1; border-radius: 12px; background: #f8fafc; color: #0f172a; font: inherit; text-align: left; padding: 10px 12px; }
    #pdf-orientation-picker button span { display: block; font-size: 14px; font-weight: 900; }
    #pdf-orientation-picker button small { display: block; margin-top: 4px; color: #64748b; font-size: 11px; font-weight: 700; }
    #pdf-orientation-picker button:hover { border-color: #0f766e; background: #ecfdf5; }
    #pdf-orientation-picker button.primary { border-color: #0f766e; background: #0f766e; color: #fff; }
    #pdf-orientation-picker button.primary small { color: rgba(255, 255, 255, .78); }
    #pdf-orientation-picker button.muted { grid-column: 1 / -1; min-height: 42px; background: #fff; color: #64748b; font-weight: 800; text-align: center; }
    @media (max-width: 520px) { #pdf-orientation-picker .pdf-picker-grid { grid-template-columns: 1fr; } }
  `

  overlay.appendChild(style)
  document.body.appendChild(overlay)

  overlay.addEventListener("click", (event) => {
    const target = event.target as HTMLElement
    const button = target.closest("button")
    if (!button) return

    overlay.remove()
    const selectedOrientation = button.dataset.orientation as PdfOrientation | undefined
    const selectedAction = button.dataset.action as PdfAction | undefined
    if (selectedOrientation && selectedAction) onSelect(selectedOrientation, selectedAction)
  })
}

function getPdfHeaderStyle(header: string): { bg: string; text: string } | null {
  if (!header || typeof header !== "string") return null
  const norm = header.toLocaleUpperCase("tr-TR").trim()
  
  // Gelir colors
  if (norm === "PAMUKKALE TURİZM") return { bg: "#FF0000", text: "#ffffff" }
  if (norm === "ANADOLU ULAŞIM") return { bg: "#C65911", text: "#ffffff" }
  if (norm === "İNEGÖL SEYAHAT") return { bg: "#00B050", text: "#ffffff" }
  if (norm === "ALAŞEHİR TURİZM") return { bg: "#F4B084", text: "#ffffff" }
  if (norm === "ÜNLÜ") return { bg: "#D0CECE", text: "#ffffff" }
  if (norm === "PAMUKKALE KARGO") return { bg: "#FFC000", text: "#ffffff" }
  if (norm === "DİĞER KOMİSYONLAR" || norm === "DİĞER KOMİSYON" || norm === "KASA-GELEN") return { bg: "#7030A0", text: "#ffffff" }
  if (norm === "TOPLAM" || norm === "GİDERLER" || norm === "KALAN") return { bg: "#FF0000", text: "#ffffff" }
  if (norm === "14 NO FİRMALAR") return { bg: "#838383", text: "#ffffff" }
  if (norm === "5A KESİLEN") return { bg: "#70AD47", text: "#ffffff" }

  // Gider colors
  if (norm === "ULUS ÖDEME") return { bg: "#548235", text: "#ffffff" }
  if (norm === "ZİRAAT BANKASI" || norm === "ZİRAAT BANKA") return { bg: "#548235", text: "#ffffff" }
  if (
    norm === "İNŞAAT YEMEK" ||
    norm === "OSMAN YEMEK" ||
    norm === "EROL KÖSE" ||
    norm === "İNEGÖL DÖNÜŞ"
  ) {
    return { bg: "#BF8F00", text: "#ffffff" }
  }
  if (
    norm === "ÇETİN OTO" ||
    norm === "YILMAZ BANK" ||
    norm === "ÖMÜR KURUKAHVE" ||
    norm === "İLKER OTOM" ||
    norm === "FATMANUR KARAHAT" ||
    norm === "YİĞİT BALABAN" ||
    norm === "EZGİ OTOM" ||
    norm.startsWith("PERSONEL MESA")
  ) {
    return { bg: "#9BC2E6", text: "#ffffff" }
  }
  if (norm === "YEMEK") return { bg: "#757171", text: "#ffffff" }
  if (norm === "YARIMCA BİLET") return { bg: "#8497B0", text: "#ffffff" }
  if (norm === "MAZOT") return { bg: "#5B9BD5", text: "#ffffff" }
  if (norm === "İŞ BANKASI") return { bg: "#92D050", text: "#ffffff" }
  if (norm === "BELEDİYE KİRA") return { bg: "#00B050", text: "#ffffff" }
  if (norm === "ÖMERİN YERİ") return { bg: "#C00000", text: "#ffffff" }
  if (norm === "BAĞ-KUR/SGK" || norm === "BAG-KUR/SGK" || norm === "BAGKUR/SGK") return { bg: "#ED7D31", text: "#ffffff" }
  if (
    norm === "HESABA GELEN" ||
    norm === "14 NO'YA GİDEN" ||
    norm === "14 NOYA GİDEN" ||
    norm === "ÇARŞI BİLET" ||
    norm === "BAŞKA OFİS" ||
    norm === "KANDİL (MAZOT)" ||
    norm === "BANKAYA YATAN"
  ) {
    return { bg: "#2F75B5", text: "#ffffff" }
  }
  
  return null
}

function buildPdfHtml({
  title,
  subtitle,
  orientation,
  metrics,
  tables,
  charts = [],
  autoPrint,
}: Required<Pick<PdfReportOptions, "title" | "orientation" | "metrics" | "tables">> & {
  subtitle?: string
  charts?: PdfChart[]
  autoPrint: boolean
}) {
  const maxColumnCount = Math.max(...tables.map(table => table.headers.length), 1)
  const tableFontSize = maxColumnCount > 24 ? 5.8 : maxColumnCount > 18 ? 6.4 : maxColumnCount > 14 ? 7.2 : maxColumnCount > 10 ? 8.2 : 9.4
  const cellPadding = maxColumnCount > 18 ? "3px 3px" : maxColumnCount > 14 ? "4px 4px" : maxColumnCount > 10 ? "5px 5px" : "6px 7px"

  const tableHtml = tables.map(table => `
    <section class="section">
      <div class="sectionTitle">${escapeHtml(table.title)}</div>
      <table>
        <colgroup>${table.headers.map((_, index) => (
          index === 0 && table.firstColumnWidth ? `<col style="width:${table.firstColumnWidth}" />` : "<col />"
        )).join("")}</colgroup>
        <thead>
          <tr>
            ${table.headers.map(header => {
              const customStyle = getPdfHeaderStyle(header)
              const styleAttr = customStyle ? ` style="background-color: ${customStyle.bg} !important; color: ${customStyle.text} !important;"` : ""
              return `<th class="${isMoneyLike(header) ? "money" : ""}"${styleAttr}>${escapeHtml(header)}</th>`
            }).join("")}
          </tr>
        </thead>
        <tbody>
          ${table.rows.length === 0
            ? `<tr><td colspan="${table.headers.length}" class="empty">Kayit bulunamadi.</td></tr>`
            : table.rows.map((row, rowIndex) => `
              <tr class="${rowIndex === table.rows.length - 1 && String(row[0]).toLocaleUpperCase("tr-TR").includes("TOPLAM") ? "totalRow" : ""}">
                ${row.map((cell, index) => `<td class="${index === 0 ? "labelCell" : ""} ${isMoneyLike(cell) ? "money" : ""}">${escapeHtml(cell)}</td>`).join("")}
              </tr>
            `).join("")
          }
        </tbody>
      </table>
    </section>
  `).join("")

  const formatMoney = (value: number) => {
    return value.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  const chartHtml = (charts || []).map(chart => {
    if (chart.type === "bar") {
      const maxValue = Math.max(...chart.data.map(d => d.value), 1)
      return `
        <div class="pdf-chart-container">
          <div class="pdf-chart-title">${escapeHtml(chart.title)}</div>
          <div class="pdf-chart-bars">
            ${chart.data.map(d => {
              const pct = d.percentage ?? ((d.value / maxValue) * 100)
              const barColor = d.color || "#0f766e"
              return `
                <div class="pdf-chart-row">
                  <span class="pdf-chart-label">${escapeHtml(d.label)}</span>
                  <div class="pdf-chart-track">
                    <div class="pdf-chart-fill" style="width: ${pct}%; background-color: ${barColor};"></div>
                  </div>
                  <span class="pdf-chart-value">${formatMoney(d.value)} TL ${d.percentage !== undefined ? `(%${d.percentage.toFixed(1)})` : ""}</span>
                </div>
              `
            }).join("")}
          </div>
        </div>
      `
    } else if (chart.type === "timeline") {
      const maxValue = Math.max(...chart.data.map(d => d.value), 1)
      return `
        <div class="pdf-timeline-container pdf-chart-timeline-card">
          <div class="pdf-chart-title">${escapeHtml(chart.title)}</div>
          <div class="pdf-timeline-bars">
            ${chart.data.map(d => {
              const heightPct = (d.value / maxValue) * 100
              const barColor = d.color || "#4f46e5"
              return `
                <div class="pdf-timeline-bar-wrapper">
                  <div class="pdf-timeline-bar-track">
                    <div class="pdf-timeline-bar-fill" style="height: ${heightPct}%; background-color: ${barColor};" title="${escapeHtml(d.label)}: ${formatMoney(d.value)} TL"></div>
                  </div>
                  <div class="pdf-timeline-bar-label">${escapeHtml(d.label)}</div>
                </div>
              `
            }).join("")}
          </div>
        </div>
      `
    } else if (chart.type === "doughnut") {
      const totalCiro = chart.data.reduce((acc, d) => acc + d.value, 0)
      let cumulativePercentage = 0
      const gradientParts: string[] = []
      
      chart.data.forEach((d) => {
        const pct = d.percentage ?? (totalCiro > 0 ? (d.value / totalCiro) * 100 : 0)
        const start = cumulativePercentage.toFixed(2)
        cumulativePercentage += pct
        const end = cumulativePercentage.toFixed(2)
        const barColor = d.color || "#0f766e"
        gradientParts.push(`${barColor} ${start}% ${end}%`)
      })
      
      const conicGradientString = gradientParts.length > 0 ? gradientParts.join(", ") : "#cbd5e1 0% 100%"
      
      return `
        <div class="pdf-chart-container pdf-chart-doughnut-card">
          <div class="pdf-chart-title">${escapeHtml(chart.title)}</div>
          <div class="pdf-doughnut-layout">
            <div class="pdf-doughnut" style="background: conic-gradient(${conicGradientString});">
              <div class="pdf-doughnut-hole">
                <div class="pdf-doughnut-total-label">TOPLAM</div>
                <div class="pdf-doughnut-total-val">${formatMoney(totalCiro).split(",")[0]} TL</div>
              </div>
            </div>
            <div class="pdf-doughnut-legend">
              ${chart.data.map((d) => {
                const pct = d.percentage ?? (totalCiro > 0 ? (d.value / totalCiro) * 100 : 0)
                return `
                  <div class="pdf-legend-item">
                    <span class="pdf-legend-color" style="background-color: ${d.color || "#0f766e"}"></span>
                    <span class="pdf-legend-label">${escapeHtml(d.label)}</span>
                    <span class="pdf-legend-value">${pct.toFixed(1)}%</span>
                  </div>
                `
              }).join("")}
            </div>
          </div>
        </div>
      `
    }
    return ""
  }).join("")

  return `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>${escapeHtml(title)}</title>
        <style>
          @page { size: A4 ${orientation}; margin: 8mm; }
          * { box-sizing: border-box; }
          html, body {
            margin: 0;
            background: #eef2f7;
            color: #111827;
            font-family: Arial, Helvetica, sans-serif;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .paper {
            width: ${orientation === "landscape" ? "281mm" : "194mm"};
            min-height: ${orientation === "landscape" ? "194mm" : "281mm"};
            background: #fff;
          }
          .fit { width: 100%; transform-origin: top left; }
          .sheet { width: 100%; }
          .header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 14px;
            border-bottom: 4px solid #0f766e;
            padding-bottom: 9px;
            margin-bottom: 10px;
          }
          .brand { display: flex; align-items: center; gap: 12px; min-width: 0; }
          .logoWrap {
            display: grid;
            place-items: center;
            width: 52px;
            height: 52px;
            border: 1px solid #d1fae5;
            border-radius: 14px;
            background: #ecfdf5;
            flex: 0 0 auto;
          }
          .logo { width: 38px; height: 38px; object-fit: contain; }
          h1 { margin: 0; color: #0f172a; font-size: 22px; line-height: 1.12; }
          .subtitle { margin-top: 4px; color: #64748b; font-size: 11px; }
          .badge {
            border-radius: 999px;
            background: #ccfbf1;
            color: #115e59;
            padding: 7px 12px;
            font-size: 11px;
            font-weight: 700;
            white-space: nowrap;
          }
          .metrics {
            display: grid;
            grid-template-columns: repeat(${Math.min(Math.max(metrics.length, 1), 4)}, minmax(0, 1fr));
            gap: 9px;
            margin-bottom: 9px;
          }
          .metric {
            min-height: 56px;
            border: 1px solid #dbe3ee;
            border-left: 5px solid #0f766e;
            border-radius: 10px;
            background: #f8fafc;
            padding: 9px 11px;
          }
          .metric .label {
            color: #64748b;
            font-size: 10px;
            font-weight: 800;
            letter-spacing: .04em;
            text-align: center;
            text-transform: uppercase;
          }
          .metric .value {
            display: block;
            margin-top: 7px;
            color: #0f172a;
            font-size: 19px;
            font-weight: 900;
            font-variant-numeric: tabular-nums;
            line-height: 1;
            text-align: center;
            white-space: nowrap;
          }
          .section { margin-top: 9px; }
          .sectionTitle { margin-bottom: 5px; color: #0f172a; font-size: 13px; font-weight: 800; }
          table {
            width: 100%;
            border: 1px solid #dbe3ee;
            border-radius: 8px;
            border-collapse: separate;
            border-spacing: 0;
            table-layout: fixed;
            overflow: hidden;
            font-size: ${tableFontSize}px;
          }
          th {
            background: #0f172a;
            color: white;
            text-align: center;
            padding: ${cellPadding};
            font-size: ${Math.max(tableFontSize - 1, 6.5)}px;
            font-weight: 800;
            line-height: 1.15;
            letter-spacing: .015em;
            text-transform: uppercase;
            overflow-wrap: anywhere;
          }
          td {
            border-top: 1px solid #e2e8f0;
            padding: ${cellPadding};
            color: #172033;
            line-height: 1.18;
            vertical-align: middle;
            text-align: center;
            overflow-wrap: anywhere;
          }
          tr:nth-child(even) td { background: #f8fafc; }
          tr { break-inside: avoid; page-break-inside: avoid; }
          .totalRow td { background: #e6fffb !important; color: #0f172a; font-weight: 900; }
          .money { text-align: center; white-space: nowrap; font-variant-numeric: tabular-nums; font-weight: 800; }
          th.money { text-align: center; }
          .labelCell { text-align: center; font-weight: 800; }
          .empty { color: #64748b; text-align: center; }
          @media screen {
            body { padding: 18px; }
            .paper { box-shadow: 0 18px 60px rgba(15, 23, 42, .18); margin: 0 auto; }
          }
          @media print {
            html, body { background: #fff; }
            body { padding: 0; }
            .paper { width: auto; min-height: 0; box-shadow: none; margin: 0; }
          }
          
          /* PDF Charts Styling */
          .pdf-charts-wrapper {
            display: grid;
            grid-template-columns: repeat(${orientation === "landscape" ? "2" : "1"}, minmax(0, 1fr));
            gap: 12px;
            margin-bottom: 12px;
          }
          .pdf-chart-container {
            border: 1px solid #dbe3ee;
            border-radius: 10px;
            background: #f8fafc;
            padding: 12px;
            break-inside: avoid;
          }
          .pdf-timeline-container {
            border: 1px solid #dbe3ee;
            border-radius: 10px;
            background: #f8fafc;
            padding: 12px;
            break-inside: avoid;
          }
          .pdf-chart-title {
            font-size: 11px;
            font-weight: 800;
            color: #0f172a;
            margin-bottom: 8px;
            text-transform: uppercase;
            letter-spacing: .02em;
          }
          .pdf-chart-bars {
            display: flex;
            flex-direction: column;
            gap: 6px;
          }
          .pdf-chart-row {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 9px;
          }
          .pdf-chart-label {
            width: 120px;
            font-weight: 800;
            color: #334155;
            overflow: hidden;
            white-space: nowrap;
            text-overflow: ellipsis;
          }
          .pdf-chart-track {
            flex-grow: 1;
            height: 10px;
            background: #e2e8f0;
            border-radius: 5px;
            overflow: hidden;
          }
          .pdf-chart-fill {
            height: 100%;
            border-radius: 5px;
          }
          .pdf-chart-value {
            width: 140px;
            text-align: right;
            font-weight: 800;
            font-variant-numeric: tabular-nums;
            color: #0f172a;
          }
          .pdf-timeline-bars {
            display: flex;
            align-items: flex-end;
            justify-content: space-between;
            height: 90px;
            gap: 3px;
            padding-top: 6px;
            border-bottom: 2px solid #cbd5e1;
          }
          .pdf-timeline-bar-wrapper {
            display: flex;
            flex-direction: column;
            align-items: center;
            flex-grow: 1;
            min-width: 0;
          }
          .pdf-timeline-bar-track {
            width: 100%;
            height: 76px;
            display: flex;
            align-items: flex-end;
            background: rgba(226, 232, 240, 0.4);
            border-radius: 2px 2px 0 0;
            overflow: hidden;
          }
          .pdf-timeline-bar-fill {
            width: 100%;
            border-radius: 2px 2px 0 0;
          }
          .pdf-timeline-bar-label {
            font-size: 7px;
            font-weight: 700;
            color: #64748b;
            margin-top: 3px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            text-align: center;
            width: 100%;
          }
          
          .pdf-chart-timeline-card {
            grid-column: 1 / -1;
          }
          .pdf-doughnut-layout {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 20px;
            margin-top: 15px;
            margin-bottom: 5px;
          }
          .pdf-doughnut {
            position: relative;
            width: 130px;
            height: 130px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
            box-shadow: 0 4px 10px rgba(0,0,0,0.06);
          }
          .pdf-doughnut-hole {
            width: 88px;
            height: 88px;
            border-radius: 50%;
            background: #fff;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            text-align: center;
          }
          .pdf-doughnut-total-label {
            font-size: 7px;
            font-weight: 800;
            color: #64748b;
            letter-spacing: .08em;
            text-transform: uppercase;
            line-height: 1;
          }
          .pdf-doughnut-total-val {
            font-size: 11px;
            font-weight: 950;
            color: #0f172a;
            margin-top: 3px;
            line-height: 1.1;
            white-space: nowrap;
          }
          .pdf-doughnut-legend {
            display: flex;
            flex-direction: column;
            gap: 5px;
            flex-grow: 1;
            min-width: 0;
          }
          .pdf-legend-item {
            display: flex;
            align-items: center;
            gap: 6px;
            font-size: 9px;
          }
          .pdf-legend-color {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            flex-shrink: 0;
          }
          .pdf-legend-label {
            font-weight: 800;
            color: #334155;
            flex-grow: 1;
            overflow: hidden;
            white-space: nowrap;
            text-overflow: ellipsis;
          }
          .pdf-legend-value {
            font-weight: 800;
            color: #0f172a;
            font-variant-numeric: tabular-nums;
            margin-left: auto;
          }
        </style>
      </head>
      <body>
        <div class="paper">
          <div class="fit">
            <main class="sheet">
              <header class="header">
                <div class="brand">
                  <div class="logoWrap"><img class="logo" src="${window.location.origin}/iconw.png" /></div>
                  <div>
                    <h1>${escapeHtml(title)}</h1>
                    ${subtitle ? `<div class="subtitle">${escapeHtml(subtitle)}</div>` : ""}
                  </div>
                </div>
                <div class="badge">A4 ${orientation === "landscape" ? "Yatay" : "Dikey"}</div>
              </header>
              ${metrics.length ? `
                <div class="metrics">
                  ${metrics.map(metric => `
                    <div class="metric">
                      <div class="label">${escapeHtml(metric.label)}</div>
                      <div class="value">${escapeHtml(metric.value)}</div>
                    </div>
                  `).join("")}
                </div>
              ` : ""}
              ${chartHtml ? `<div class="pdf-charts-wrapper">${chartHtml}</div>` : ""}
              ${tableHtml}
            </main>
          </div>
        </div>
        ${autoPrint ? `<script>window.addEventListener("load", () => setTimeout(() => window.print(), 300));</script>` : ""}
      </body>
    </html>
  `
}

function openPrintWindow(html: string) {
  const printWindow = window.open("", "_blank")
  if (!printWindow) return
  printWindow.document.open()
  printWindow.document.write(html)
  printWindow.document.close()
}

async function downloadPdfReport(title: string, orientation: PdfOrientation, html: string) {
  const desktopBridge = (window as typeof window & { hesapDesktop?: DesktopBridge }).hesapDesktop
  if (desktopBridge?.savePdfReport) {
    const result = await desktopBridge.savePdfReport({ title, orientation, html })
    if (result?.ok || result?.canceled) return
    if (result?.error) window.alert(result.error)
    return
  }

  openPrintWindow(html.replace("</body>", `<script>window.addEventListener("load", () => setTimeout(() => window.print(), 300));</script></body>`))
}

function archivePdfReport(title: string, subtitle: string | undefined, html: string) {
  fetch("/api/admin/operations?table=pdf_archives", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      report_type: title.toLocaleLowerCase("tr-TR").replace(/\s+/g, "_").slice(0, 80),
      title,
      period_label: subtitle || "",
      file_name: `${title}.pdf`,
      html_snapshot: html.slice(0, 200000),
    }),
  }).catch(() => undefined)
}

export function openPdfReport({
  title,
  subtitle,
  orientation = "landscape",
  skipOrientationPicker = false,
  action = "print",
  metrics = [],
  tables,
  charts = [],
  archive = true,
}: PdfReportOptions) {
  if (typeof window !== "undefined" && document.documentElement.classList.contains("native-app")) {
    if (archive) {
      const html = buildPdfHtml({ title, subtitle, orientation, metrics, tables, charts, autoPrint: false })
      archivePdfReport(title, subtitle, html)
    }
    void shareNativePdf({ title, subtitle, orientation, metrics, tables, charts }).catch((error) => {
      window.alert(error instanceof Error ? `PDF paylaşılamadı: ${error.message}` : "PDF paylaşılamadı.")
    })
    return
  }

  if (!skipOrientationPicker) {
    choosePdfOrientation(orientation, (selectedOrientation, selectedAction) => {
      openPdfReport({
        title,
        subtitle,
        orientation: selectedOrientation,
        action: selectedAction,
        skipOrientationPicker: true,
        metrics,
        tables,
        charts,
        archive,
      })
    })
    return
  }

  const html = buildPdfHtml({
    title,
    subtitle,
    orientation,
    metrics,
    tables,
    charts,
    autoPrint: action === "print",
  })

  if (archive) archivePdfReport(title, subtitle, html)

  if (action === "download") {
    void downloadPdfReport(title, orientation, html)
    return
  }

  openPrintWindow(html)
}

async function shareNativePdf({ title, subtitle, orientation, metrics, tables }: PdfReportOptions) {
  const [{ Filesystem, Directory }, { Share }, pdfMakeModule, fontModule] = await Promise.all([
    import("@capacitor/filesystem"),
    import("@capacitor/share"),
    import("pdfmake/build/pdfmake"),
    import("pdfmake/build/vfs_fonts"),
  ])
  const pdfMake = (pdfMakeModule.default || pdfMakeModule) as any
  const fontBundle = fontModule as unknown as { default?: Record<string, string>; vfs?: Record<string, string>; pdfMake?: { vfs?: Record<string, string> } }
  const virtualFonts = fontBundle.default || fontBundle.vfs || fontBundle.pdfMake?.vfs || {}
  if (typeof pdfMake.addVirtualFileSystem === "function") pdfMake.addVirtualFileSystem(virtualFonts)
  else pdfMake.vfs = virtualFonts

  const definition = {
    pageSize: "A4",
    pageOrientation: orientation,
    pageMargins: [28, 32, 28, 32],
    defaultStyle: { font: "Roboto", fontSize: 9, color: "#172033" },
    content: [
      { text: title, fontSize: 20, bold: true, color: "#0f172a", margin: [0, 0, 0, 4] },
      ...(subtitle ? [{ text: subtitle, color: "#64748b", margin: [0, 0, 0, 14] }] : []),
      ...(metrics?.length ? [{
        table: {
          widths: metrics.map(() => "*"),
          body: [metrics.map((metric) => ({ text: metric.label, alignment: "center", bold: true, color: "#64748b", fillColor: "#f1f5f9", margin: [4, 5] })), metrics.map((metric) => ({ text: metric.value, alignment: "center", bold: true, fontSize: 13, color: "#0f766e", fillColor: "#f8fafc", margin: [4, 7] }))],
        },
        layout: "lightHorizontalLines",
        margin: [0, 0, 0, 14],
      }] : []),
      ...tables.flatMap((table) => [
        { text: table.title, fontSize: 12, bold: true, color: "#0f172a", margin: [0, 7, 0, 6] },
        {
          table: {
            headerRows: 1,
            widths: table.headers.map((_, index) => index === 0 && table.firstColumnWidth ? table.firstColumnWidth : "*"),
            body: [
              table.headers.map((header) => {
                const customStyle = getPdfHeaderStyle(header)
                return {
                  text: header,
                  bold: true,
                  color: customStyle ? customStyle.text : "#ffffff",
                  fillColor: customStyle ? customStyle.bg : "#0f766e",
                  alignment: "center",
                  margin: [3, 4],
                }
              }),
              ...(table.rows.length
                ? table.rows.map((row) => row.map((cell) => ({ text: String(cell), alignment: "center", margin: [3, 4] })))
                : [[
                    { text: "Kayıt bulunamadı.", colSpan: table.headers.length, alignment: "center", color: "#64748b", margin: [3, 7] },
                    ...table.headers.slice(1).map(() => ({})),
                  ]]),
            ],
          },
          layout: "lightHorizontalLines",
          margin: [0, 0, 0, 8],
        },
      ]),
    ],
    footer: (currentPage: number, pageCount: number) => ({ text: `${currentPage} / ${pageCount}`, alignment: "center", color: "#94a3b8", fontSize: 8 }),
  }

  const base64 = await new Promise<string>((resolve, reject) => {
    try { pdfMake.createPdf(definition).getBase64(resolve) } catch (error) { reject(error) }
  })
  const fileName = `${safePdfFileName(title)}-${new Date().toISOString().slice(0, 10)}.pdf`
  const written = await Filesystem.writeFile({ path: fileName, data: base64, directory: Directory.Cache, recursive: true })
  try {
    await Share.share({ title, text: subtitle || title, files: [written.uri] })
  } finally {
    await Filesystem.deleteFile({ path: fileName, directory: Directory.Cache }).catch(() => undefined)
  }
}

function safePdfFileName(value: string) {
  return value.toLocaleLowerCase("tr-TR").replace(/[^a-z0-9çğıöşü_-]+/gi, "-").replace(/^-|-$/g, "").slice(0, 70) || "hesap-raporu"
}
