import { format, getDay } from "date-fns"
import { tr } from "date-fns/locale"

export type ShiftOption = {
  id: string
  label: string
  short: string
  time: string
  className?: string
}

export interface VardiyaPdfOptions {
  subeAd: string
  rangeTitle: string
  rangeLabel: string
  days: Date[]
  personeller: Array<{ id: string; ad: string }>
  shiftOptions: ShiftOption[]
  getAssignment: (day: Date, personelId: string) => string | undefined
  shiftById: Map<string, ShiftOption>
}

function escapeHtml(val: any): string {
  return String(val ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function getShiftTheme(shift?: ShiftOption | null) {
  if (!shift) {
    return {
      bg: "#ffffff",
      border: "#e2e8f0",
      text: "#94a3b8",
      subtext: "#cbd5e1",
      badgeClass: "empty",
      isLeave: false,
    }
  }

  const label = (shift.label || "").toLocaleUpperCase("tr-TR")
  const short = (shift.short || "").toLocaleUpperCase("tr-TR")

  if (label.includes("İZİN") || label.includes("IZIN") || short === "I" || short === "İZİN") {
    return {
      bg: "#f1f5f9",
      border: "#cbd5e1",
      text: "#475569",
      subtext: "#64748b",
      badgeClass: "izin",
      isLeave: true,
    }
  }

  if (label.includes("SABAH") || short === "S" || short === "SBH") {
    return {
      bg: "#fffbeb",
      border: "#fde68a",
      text: "#92400e",
      subtext: "#b45309",
      badgeClass: "sabah",
      isLeave: false,
    }
  }

  if (label.includes("AKŞAM") || label.includes("AKSAM") || short === "A" || short === "AKŞM") {
    return {
      bg: "#eef2ff",
      border: "#c7d2fe",
      text: "#3730a3",
      subtext: "#4338ca",
      badgeClass: "aksam",
      isLeave: false,
    }
  }

  if (label.includes("ARA") || short === "R") {
    if (shift.time.includes("10:00") || shift.time.includes("10.00")) {
      return {
        bg: "#f0f9ff",
        border: "#bae6fd",
        text: "#0369a1",
        subtext: "#0284c7",
        badgeClass: "ara-10",
        isLeave: false,
      }
    }
    return {
      bg: "#ecfdf5",
      border: "#a7f3d0",
      text: "#065f46",
      subtext: "#047857",
      badgeClass: "ara-11",
      isLeave: false,
    }
  }

  return {
    bg: "#f8fafc",
    border: "#cbd5e1",
    text: "#1e293b",
    subtext: "#475569",
    badgeClass: "custom",
    isLeave: false,
  }
}

export function buildVardiyaHtml(options: VardiyaPdfOptions, orientation: "landscape" | "portrait" = "landscape"): string {
  const { subeAd, rangeTitle, rangeLabel, days, personeller, shiftOptions, getAssignment, shiftById } = options
  const isWeeklyOrLess = days.length <= 7
  const isMediumRange = days.length > 7 && days.length <= 14
  const printDateStr = format(new Date(), "dd.MM.yyyy HH:mm")

  // Calculate daily shift counts for footer
  const dailyStats: Array<{
    day: Date
    shiftsCount: Record<string, number>
    totalWorking: number
    totalLeave: number
  }> = days.map((day) => {
    const shiftsCount: Record<string, number> = {}
    let totalWorking = 0
    let totalLeave = 0

    for (const p of personeller) {
      const shiftId = getAssignment(day, p.id)
      const shift = shiftId ? shiftById.get(shiftId) : null
      if (shift) {
        shiftsCount[shift.id] = (shiftsCount[shift.id] || 0) + 1
        const theme = getShiftTheme(shift)
        if (theme.isLeave) {
          totalLeave++
        } else {
          totalWorking++
        }
      }
    }

    return { day, shiftsCount, totalWorking, totalLeave }
  })

  // Calculate person summary stats
  const personStats: Record<string, { worked: number; leave: number }> = {}
  for (const p of personeller) {
    let worked = 0
    let leave = 0
    for (const day of days) {
      const shiftId = getAssignment(day, p.id)
      const shift = shiftId ? shiftById.get(shiftId) : null
      if (shift) {
        const theme = getShiftTheme(shift)
        if (theme.isLeave) leave++
        else worked++
      }
    }
    personStats[p.id] = { worked, leave }
  }

  // Active shift types to show in legend & footer
  const uniqueShiftOptions = shiftOptions.filter((opt, idx, arr) => arr.findIndex((x) => x.id === opt.id) === idx)

  return `<!doctype html>
<html lang="tr">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(subeAd)} - Vardiya Planı (${escapeHtml(rangeLabel)})</title>
  <style>
    @page {
      size: A4 ${orientation};
      margin: 6mm 8mm;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      color: #0f172a;
      background: #f1f5f9;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      font-size: 11px;
    }
    @media screen {
      body {
        padding: 24px;
        background: #94a3b8;
      }
      .paper {
        width: ${orientation === "landscape" ? "283mm" : "198mm"};
        min-height: ${orientation === "landscape" ? "198mm" : "283mm"};
        margin: 0 auto;
        background: #ffffff;
        padding: 16px 20px;
        border-radius: 12px;
        box-shadow: 0 16px 40px rgba(0, 0, 0, 0.22);
      }
      .floating-bar {
        position: fixed;
        bottom: 24px;
        right: 24px;
        z-index: 1000;
        display: flex;
        gap: 10px;
        background: rgba(15, 23, 42, 0.9);
        backdrop-filter: blur(8px);
        padding: 10px 16px;
        border-radius: 999px;
        box-shadow: 0 10px 30px rgba(0,0,0,0.3);
      }
      .floating-btn {
        background: #0f766e;
        color: #ffffff;
        border: none;
        padding: 8px 16px;
        border-radius: 999px;
        font-weight: 700;
        font-size: 13px;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 6px;
        transition: background 0.15s;
      }
      .floating-btn:hover {
        background: #0d9488;
      }
      .floating-btn.secondary {
        background: #334155;
      }
      .floating-btn.secondary:hover {
        background: #475569;
      }
    }
    @media print {
      body {
        background: #ffffff !important;
        padding: 0 !important;
      }
      .paper {
        width: 100% !important;
        padding: 0 !important;
        margin: 0 !important;
        box-shadow: none !important;
        border-radius: 0 !important;
      }
      .no-print {
        display: none !important;
      }
      tr {
        break-inside: avoid;
        page-break-inside: avoid;
      }
    }

    /* HEADER */
    .report-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 3px solid #0f766e;
      padding-bottom: 8px;
      margin-bottom: 8px;
    }
    .brand-area {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .logo-badge {
      width: 44px;
      height: 44px;
      border-radius: 10px;
      background: #0f766e;
      color: #ffffff;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 900;
      font-size: 18px;
      box-shadow: 0 2px 6px rgba(15, 118, 110, 0.3);
    }
    .header-title h1 {
      font-size: 18px;
      font-weight: 900;
      color: #0f172a;
      letter-spacing: -0.01em;
      line-height: 1.15;
    }
    .header-title .subtitle {
      font-size: 11px;
      color: #475569;
      font-weight: 600;
      margin-top: 2px;
    }
    .header-meta {
      text-align: right;
    }
    .header-badge {
      display: inline-block;
      background: #ccfbf1;
      color: #0f766e;
      border: 1px solid #99f6e4;
      border-radius: 999px;
      padding: 3px 10px;
      font-weight: 800;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .header-meta .date-text {
      font-size: 9.5px;
      color: #64748b;
      margin-top: 3px;
      font-weight: 500;
    }

    /* LEGEND STRIP */
    .legend-strip {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 6px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 6px 10px;
      margin-bottom: 9px;
    }
    .legend-title {
      font-weight: 800;
      font-size: 10px;
      color: #475569;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      margin-right: 4px;
    }
    .legend-badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      border-radius: 5px;
      padding: 2px 7px;
      font-size: 9.5px;
      font-weight: 700;
      border-width: 1px;
      border-style: solid;
      line-height: 1.3;
    }
    .legend-badge .short-tag {
      font-weight: 900;
    }
    .legend-badge .hours-tag {
      font-weight: 600;
      opacity: 0.9;
    }

    /* MAIN TABLE */
    .table-wrapper {
      width: 100%;
      overflow: hidden;
      border: 1.5px solid #cbd5e1;
      border-radius: 8px;
      margin-bottom: 10px;
    }
    table.schedule-table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
      font-size: 10px;
    }
    table.schedule-table th,
    table.schedule-table td {
      border: 1px solid #cbd5e1;
      padding: 4px 4px;
      text-align: center;
      vertical-align: middle;
    }

    /* Table Header */
    table.schedule-table thead tr {
      background: #0f172a;
      color: #ffffff;
    }
    table.schedule-table th.col-num {
      width: 26px;
      font-size: 10px;
      font-weight: 800;
      background: #0f172a;
      color: #94a3b8;
    }
    table.schedule-table th.col-person {
      width: 140px;
      text-align: left;
      padding-left: 8px;
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.02em;
    }
    table.schedule-table th.col-summary {
      width: 76px;
      font-size: 10px;
      font-weight: 800;
      background: #1e293b;
    }
    table.schedule-table th.col-day {
      padding: 4px 2px;
      line-height: 1.15;
    }
    table.schedule-table th.col-day .day-num {
      font-size: 13px;
      font-weight: 900;
      display: block;
    }
    table.schedule-table th.col-day .day-name {
      font-size: 9px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      opacity: 0.85;
      display: block;
      margin-top: 1px;
    }
    table.schedule-table th.col-day.weekend {
      background: #881337 !important;
      color: #ffe4e6 !important;
    }

    /* Table Rows */
    table.schedule-table tbody tr:nth-child(even) {
      background: #f8fafc;
    }
    table.schedule-table tbody tr:hover {
      background: #f1f5f9;
    }
    table.schedule-table td.cell-num {
      font-weight: 800;
      color: #64748b;
      font-size: 9.5px;
    }
    table.schedule-table td.cell-person {
      text-align: left;
      padding-left: 8px;
      font-weight: 800;
      font-size: 11px;
      color: #0f172a;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    table.schedule-table td.cell-summary {
      font-size: 9px;
      font-weight: 800;
      line-height: 1.25;
    }
    .summary-work {
      color: #047857;
      display: block;
    }
    .summary-leave {
      color: #64748b;
      display: block;
      font-size: 8.5px;
    }

    /* Cell Shift Badges */
    .shift-card {
      border-radius: 5px;
      padding: 3px 2px;
      border-width: 1px;
      border-style: solid;
      line-height: 1.15;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 28px;
    }
    .shift-card .title {
      font-weight: 800;
      font-size: 10px;
    }
    .shift-card .hours {
      font-size: 8px;
      font-weight: 600;
      margin-top: 1px;
      white-space: nowrap;
    }
    .shift-card.compact {
      min-height: 24px;
      padding: 2px 1px;
    }
    .shift-card.compact .title {
      font-size: 9px;
      font-weight: 800;
    }
    .shift-card.compact .hours {
      font-size: 7.5px;
      font-weight: 600;
    }
    .shift-card.mini {
      min-height: 18px;
      padding: 1px;
      font-size: 8px;
      font-weight: 800;
    }
    .shift-empty {
      color: #cbd5e1;
      font-weight: 700;
      font-size: 11px;
    }

    /* Table Footer Summary Rows */
    table.schedule-table tfoot tr.stat-row {
      background: #f8fafc;
      font-size: 9px;
    }
    table.schedule-table tfoot tr.stat-row td {
      border-top: 1px solid #cbd5e1;
      padding: 3px 2px;
    }
    table.schedule-table tfoot tr.stat-row .stat-label {
      text-align: right;
      padding-right: 8px;
      font-weight: 700;
      color: #475569;
    }
    table.schedule-table tfoot tr.stat-total {
      background: #e2e8f0;
      font-size: 9.5px;
      font-weight: 900;
      color: #0f172a;
    }
    table.schedule-table tfoot tr.stat-total td {
      border-top: 2px solid #64748b;
      padding: 4px 2px;
    }
    table.schedule-table tfoot tr.stat-total .stat-label {
      text-align: right;
      padding-right: 8px;
      font-weight: 900;
      color: #0f172a;
      letter-spacing: 0.02em;
    }

    /* SIGNATURES & FOOTER */
    .signatures-section {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 16px;
      margin-top: 10px;
      padding-top: 8px;
      border-top: 1px dashed #cbd5e1;
    }
    .sig-box {
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      background: #ffffff;
      padding: 8px 10px;
      font-size: 9.5px;
    }
    .sig-title {
      font-weight: 800;
      color: #334155;
      text-transform: uppercase;
      letter-spacing: 0.03em;
      margin-bottom: 16px;
    }
    .sig-line {
      color: #94a3b8;
      font-weight: 500;
      font-size: 9px;
    }
    .footer-note {
      margin-top: 6px;
      font-size: 8px;
      color: #94a3b8;
      text-align: center;
      line-height: 1.3;
    }
  </style>
</head>
<body>
  <div class="no-print floating-bar">
    <button type="button" class="floating-btn" onclick="window.print()">
      🖨️ Yazdır / PDF Kaydet
    </button>
    <button type="button" class="floating-btn secondary" onclick="window.close()">
      ✕ Kapat
    </button>
  </div>

  <div class="paper">
    <!-- HEADER -->
    <header class="report-header">
      <div class="brand-area">
        <div class="logo-badge">V</div>
        <div class="header-title">
          <h1>${escapeHtml(subeAd)} &bull; VARDİYA PLANI</h1>
          <div class="subtitle">${escapeHtml(rangeTitle)} &bull; ${escapeHtml(rangeLabel)}</div>
        </div>
      </div>
      <div class="header-meta">
        <span class="header-badge">${escapeHtml(subeAd)} &bull; ${personeller.length} PERSONEL</span>
        <div class="date-text">Düzenleme: ${escapeHtml(printDateStr)}</div>
      </div>
    </header>

    <!-- LEGEND -->
    <div class="legend-strip">
      <span class="legend-title">Vardiya Saatleri Rehberi:</span>
      ${uniqueShiftOptions.map((shift) => {
        const theme = getShiftTheme(shift)
        return `
          <div class="legend-badge" style="background: ${theme.bg}; border-color: ${theme.border}; color: ${theme.text};">
            <span class="short-tag">${escapeHtml(shift.short)}:</span>
            <span>${escapeHtml(shift.label)}</span>
            ${shift.time !== "-" ? `<span class="hours-tag">(${escapeHtml(shift.time)})</span>` : ""}
          </div>
        `
      }).join("")}
    </div>

    <!-- MAIN TABLE -->
    <div class="table-wrapper">
      <table class="schedule-table">
        <thead>
          <tr>
            <th class="col-num">#</th>
            <th class="col-person">Personel Adı</th>
            ${days.map((day) => {
              const isWeekend = getDay(day) === 0 || getDay(day) === 6
              const dayNum = format(day, "d")
              const dayName = format(day, "EEE", { locale: tr })
              return `
                <th class="col-day ${isWeekend ? "weekend" : ""}">
                  <span class="day-num">${dayNum}</span>
                  <span class="day-name">${dayName}</span>
                </th>
              `
            }).join("")}
            <th class="col-summary">İcmal</th>
          </tr>
        </thead>
        <tbody>
          ${personeller.map((p, idx) => {
            const stats = personStats[p.id] || { worked: 0, leave: 0 }
            return `
              <tr>
                <td class="cell-num">${idx + 1}</td>
                <td class="cell-person" title="${escapeHtml(p.ad)}">${escapeHtml(p.ad)}</td>
                ${days.map((day) => {
                  const shiftId = getAssignment(day, p.id)
                  const shift = shiftId ? shiftById.get(shiftId) : null
                  const theme = getShiftTheme(shift)

                  if (!shift) {
                    return `<td><span class="shift-empty">-</span></td>`
                  }

                  if (isWeeklyOrLess) {
                    return `
                      <td>
                        <div class="shift-card" style="background: ${theme.bg}; border-color: ${theme.border}; color: ${theme.text};">
                          <span class="title">${escapeHtml(shift.label)}</span>
                          <span class="hours" style="color: ${theme.subtext};">${shift.time !== "-" ? escapeHtml(shift.time) : "İzin"}</span>
                        </div>
                      </td>
                    `
                  } else if (isMediumRange) {
                    return `
                      <td>
                        <div class="shift-card compact" style="background: ${theme.bg}; border-color: ${theme.border}; color: ${theme.text};">
                          <span class="title">${escapeHtml(shift.short)}</span>
                          <span class="hours" style="color: ${theme.subtext};">${shift.time !== "-" ? escapeHtml(shift.time.replace(/\s+/g, "")) : "İzin"}</span>
                        </div>
                      </td>
                    `
                  } else {
                    return `
                      <td>
                        <div class="shift-card mini" style="background: ${theme.bg}; border-color: ${theme.border}; color: ${theme.text};" title="${escapeHtml(shift.label)} (${escapeHtml(shift.time)})">
                          <span>${escapeHtml(shift.short)}</span>
                        </div>
                      </td>
                    `
                  }
                }).join("")}
                <td class="cell-summary">
                  <span class="summary-work">${stats.worked} Gün</span>
                  <span class="summary-leave">${stats.leave} İzin</span>
                </td>
              </tr>
            `
          }).join("")}
        </tbody>

        <!-- DAILY COVERAGE FOOTER -->
        <tfoot>
          ${uniqueShiftOptions.map((opt) => {
            const theme = getShiftTheme(opt)
            return `
              <tr class="stat-row">
                <td colspan="2" class="stat-label">
                  <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:${theme.border}; margin-right:4px;"></span>
                  ${escapeHtml(opt.label)} (${escapeHtml(opt.time !== "-" ? opt.time : "İzin")})
                </td>
                ${dailyStats.map((st) => {
                  const count = st.shiftsCount[opt.id] || 0
                  return `<td style="font-weight:${count > 0 ? "800" : "500"}; color:${count > 0 ? theme.text : "#94a3b8"};">${count > 0 ? count : "-"}</td>`
                }).join("")}
                <td style="color:#64748b;">-</td>
              </tr>
            `
          }).join("")}
          <tr class="stat-total">
            <td colspan="2" class="stat-label">GÜNLÜK TOPLAM ÇALIŞAN PERSONEL:</td>
            ${dailyStats.map((st) => `<td>${st.totalWorking}</td>`).join("")}
            <td>-</td>
          </tr>
        </tfoot>
      </table>
    </div>

    <!-- SIGNATURES -->
    <div class="signatures-section">
      <div class="sig-box">
        <div class="sig-title">Hazırlayan (Şube Sorumlusu)</div>
        <div class="sig-line">İmza: .....................................................</div>
      </div>
      <div class="sig-box">
        <div class="sig-title">Onaylayan (İşletme Müdürü)</div>
        <div class="sig-line">İmza: .....................................................</div>
      </div>
      <div class="sig-box">
        <div class="sig-title">Yürürlük & Onay Tarihi</div>
        <div class="sig-line">Tarih: ..... / ..... / 2026</div>
      </div>
    </div>

    <div class="footer-note">
      * Personelin vardiya saatinden en az 10 dakika önce şubede hazır bulunması gerekmektedir. Vardiya değişiklikleri yalnızca şube yöneticisi bilgisi ve onayı ile gerçekleştirilebilir.
    </div>
  </div>

  <script>
    window.addEventListener("load", function() {
      // Auto trigger print preview after rendering
      setTimeout(function() {
        window.print();
      }, 400);
    });
  </script>
</body>
</html>`
}

export function openVardiyaPdf(options: VardiyaPdfOptions) {
  // Show picker modal for orientation
  const existing = document.getElementById("vardiya-pdf-picker")
  if (existing) existing.remove()

  const overlay = document.createElement("div")
  overlay.id = "vardiya-pdf-picker"
  overlay.innerHTML = `
    <div class="vardiya-picker-backdrop">
      <div class="vardiya-picker-panel" role="dialog" aria-modal="true">
        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
          <div style="width: 38px; height: 38px; border-radius: 10px; background: #0f766e; color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 16px;">V</div>
          <div>
            <h2 style="margin: 0; font-size: 17px; font-weight: 800; color: #0f172a;">Vardiya Planı Yazdır / PDF İndir</h2>
            <div style="font-size: 12px; color: #64748b;">${escapeHtml(options.subeAd)} &bull; ${escapeHtml(options.rangeLabel)}</div>
          </div>
        </div>

        <p style="margin: 8px 0 16px; color: #475569; font-size: 13px; line-height: 1.45;">
          Vardiya saatleri, renk kodları ve nöbetçi özetleriyle hazırlanmış A4 formatında profesyonel çizelge oluşturulacak.
        </p>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
          <button type="button" data-orientation="landscape" class="btn-landscape" style="min-height: 64px; cursor: pointer; border: 2px solid #0f766e; border-radius: 12px; background: #ecfdf5; color: #065f46; font: inherit; text-align: left; padding: 12px 14px;">
            <div style="font-size: 14px; font-weight: 900; display: flex; align-items: center; gap: 6px;">
              <span>📄 Yatay A4 (Önerilen)</span>
            </div>
            <div style="font-size: 11px; color: #047857; margin-top: 4px; font-weight: 600;">
              Haftalık tüm günler ve saatler geniş net görünür
            </div>
          </button>

          <button type="button" data-orientation="portrait" class="btn-portrait" style="min-height: 64px; cursor: pointer; border: 1.5px solid #cbd5e1; border-radius: 12px; background: #f8fafc; color: #0f172a; font: inherit; text-align: left; padding: 12px 14px;">
            <div style="font-size: 14px; font-weight: 800;">
              <span>📋 Dikey A4</span>
            </div>
            <div style="font-size: 11px; color: #64748b; margin-top: 4px; font-weight: 600;">
              Daha az gün veya kompakt dikey liste
            </div>
          </button>

          <button type="button" data-cancel="true" style="grid-column: 1 / -1; height: 38px; cursor: pointer; border: 1px solid #e2e8f0; border-radius: 8px; background: #fff; color: #64748b; font-weight: 700; font-size: 12px;">
            Vazgeç
          </button>
        </div>
      </div>
    </div>
  `

  const style = document.createElement("style")
  style.textContent = `
    #vardiya-pdf-picker { position: fixed; inset: 0; z-index: 10000; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    #vardiya-pdf-picker .vardiya-picker-backdrop { display: flex; min-height: 100%; align-items: center; justify-content: center; background: rgba(15, 23, 42, 0.6); backdrop-filter: blur(4px); padding: 20px; }
    #vardiya-pdf-picker .vardiya-picker-panel { width: min(500px, 100%); border: 1px solid rgba(148, 163, 184, 0.4); border-radius: 16px; background: #fff; box-shadow: 0 25px 60px rgba(15, 23, 42, 0.35); padding: 20px; }
    #vardiya-pdf-picker button:hover { filter: brightness(0.97); }
  `

  overlay.appendChild(style)
  document.body.appendChild(overlay)

  overlay.addEventListener("click", (event) => {
    const target = event.target as HTMLElement
    const button = target.closest("button")
    if (!button) return

    overlay.remove()
    const orientation = button.dataset.orientation as "landscape" | "portrait" | undefined
    if (orientation) {
      const html = buildVardiyaHtml(options, orientation)
      const printWindow = window.open("", "_blank")
      if (printWindow) {
        printWindow.document.open()
        printWindow.document.write(html)
        printWindow.document.close()
      }
    }
  })
}
