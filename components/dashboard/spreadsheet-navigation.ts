import type { KeyboardEvent } from "react"

function isSpreadsheetControl(element: Element | null): element is HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement {
  if (
    !(element instanceof HTMLInputElement) &&
    !(element instanceof HTMLSelectElement) &&
    !(element instanceof HTMLTextAreaElement)
  ) {
    return false
  }

  return !element.disabled && !(element instanceof HTMLInputElement && element.type === "hidden")
}

function findSpreadsheetControl(cell: Element | undefined) {
  const controls = Array.from(cell?.querySelectorAll("input, select, textarea") || [])
  return controls.find(isSpreadsheetControl) || null
}

export function handleSpreadsheetKeyDown(event: KeyboardEvent<HTMLElement>) {
  const control = event.currentTarget
  const cell = control.closest("td")
  if (!cell) return

  const row = cell.parentElement
  if (!row) return

  const tableBody = row.parentElement
  if (!tableBody) return

  const colIndex = Array.from(row.children).indexOf(cell)
  const rowIndex = Array.from(tableBody.children).indexOf(row)

  const isTextControl = control instanceof HTMLInputElement || control instanceof HTMLTextAreaElement
  const atStart = !isTextControl || control.selectionStart === 0 || control.selectionStart === null
  const atEnd = !isTextControl || control.selectionEnd === (control.value || "").length || control.selectionEnd === null
  let targetControl: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null = null

  if (event.key === "ArrowUp") {
    let currentRowIndex = rowIndex - 1
    while (currentRowIndex >= 0) {
      const targetCell = tableBody.children[currentRowIndex]?.children[colIndex]
      const foundControl = findSpreadsheetControl(targetCell)
      if (foundControl) {
        targetControl = foundControl
        break
      }
      currentRowIndex -= 1
    }
  } else if (event.key === "ArrowDown") {
    let currentRowIndex = rowIndex + 1
    while (currentRowIndex < tableBody.children.length) {
      const targetCell = tableBody.children[currentRowIndex]?.children[colIndex]
      const foundControl = findSpreadsheetControl(targetCell)
      if (foundControl) {
        targetControl = foundControl
        break
      }
      currentRowIndex += 1
    }
  } else if (event.key === "ArrowLeft") {
    if (atStart) {
      let currentColIndex = colIndex - 1
      while (currentColIndex >= 0) {
        const foundControl = findSpreadsheetControl(row.children[currentColIndex])
        if (foundControl) {
          targetControl = foundControl
          break
        }
        currentColIndex -= 1
      }
    }
  } else if (event.key === "ArrowRight") {
    if (atEnd) {
      let currentColIndex = colIndex + 1
      while (currentColIndex < row.children.length) {
        const foundControl = findSpreadsheetControl(row.children[currentColIndex])
        if (foundControl) {
          targetControl = foundControl
          break
        }
        currentColIndex += 1
      }
    }
  } else {
    return
  }

  if (!targetControl) return

  event.preventDefault()
  targetControl.focus()
  if (targetControl instanceof HTMLInputElement || targetControl instanceof HTMLTextAreaElement) {
    targetControl.select()
  }
}
