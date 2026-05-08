"use client"

import { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from "react"

type SaveHandler = () => Promise<void | boolean> | void | boolean

interface UnsavedChangesContextType {
  isDirty: boolean
  markDirty: () => void
  markClean: () => void
  registerSaveHandler: (handler: SaveHandler | null) => void
}

const UnsavedChangesContext = createContext<UnsavedChangesContextType | undefined>(undefined)

export function UnsavedChangesProvider({ children }: { children: ReactNode }) {
  const [isDirty, setIsDirty] = useState(false)
  const [showPopup, setShowPopup] = useState(false)
  const [pendingUrl, setPendingUrl] = useState<string | null>(null)
  const [hasSaveHandler, setHasSaveHandler] = useState(false)
  const saveHandlerRef = useRef<SaveHandler | null>(null)

  const markDirty = useCallback(() => setIsDirty(true), [])
  const markClean = useCallback(() => setIsDirty(false), [])
  const registerSaveHandler = useCallback((handler: SaveHandler | null) => {
    saveHandlerRef.current = handler
    setHasSaveHandler(Boolean(handler))
  }, [])

  useEffect(() => {
    const markDirtyFromInput = (event: Event) => {
      const target = event.target as HTMLElement | null
      if (!target) return
      if (target.closest("[data-unsaved-ignore='true']")) return
      if (target.closest("input, textarea, select")) {
        markDirty()
      }
    }

    const markDirtyFromActionButton = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null
      if (!target) return
      const button = target.closest("button") as HTMLButtonElement | null
      if (!button) return
      if (button.closest("[data-unsaved-ignore='true']")) return

      const text = (button.textContent || "").toLocaleLowerCase("tr-TR")
      const isAddButton = text.includes("satÄ±r ekle") || text.includes("satir ekle")
      const isTableDeleteButton = !!button.closest("tbody") && button.className.includes("text-red")

      if (isAddButton || isTableDeleteButton) {
        markDirty()
      }
    }

    document.addEventListener("input", markDirtyFromInput, true)
    document.addEventListener("change", markDirtyFromInput, true)
    document.addEventListener("click", markDirtyFromActionButton, true)

    return () => {
      document.removeEventListener("input", markDirtyFromInput, true)
      document.removeEventListener("change", markDirtyFromInput, true)
      document.removeEventListener("click", markDirtyFromActionButton, true)
    }
  }, [markDirty])

  useEffect(() => {
    const interceptLinks = (event: MouseEvent) => {
      if (!isDirty) return

      const target = event.target as HTMLElement | null
      const link = target?.closest("a") as HTMLAnchorElement | null
      if (!link || !link.href) return
      if (link.target === "_blank") return
      if (link.href === window.location.href) return

      event.preventDefault()
      event.stopPropagation()
      setPendingUrl(link.href)
      setShowPopup(true)
    }

    document.addEventListener("click", interceptLinks, true)
    return () => document.removeEventListener("click", interceptLinks, true)
  }, [isDirty])

  async function saveAndContinue() {
    if (saveHandlerRef.current) {
      await saveHandlerRef.current()
    }

    setIsDirty(false)
    setShowPopup(false)

    if (pendingUrl) {
      window.location.href = pendingUrl
    }
  }

  function leaveWithoutSaving() {
    setIsDirty(false)
    setShowPopup(false)

    if (pendingUrl) {
      window.location.href = pendingUrl
    }
  }

  return (
    <UnsavedChangesContext.Provider value={{ isDirty, markDirty, markClean, registerSaveHandler }}>
      {children}

      {showPopup && (
        <div data-unsaved-ignore="true" className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h2 className="mb-2 text-lg font-bold text-gray-900">KaydedilmemiÅŸ deÄŸiÅŸiklikler var</h2>
            <p className="mb-5 text-sm text-gray-600">
              YaptÄ±ÄŸÄ±nÄ±z iÅŸlemler kaydedilmedi. Ã‡Ä±kmadan Ã¶nce kaydetmek ister misiniz?
            </p>

            <div className="flex justify-end gap-3">
              <button
                onClick={leaveWithoutSaving}
                className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-gray-100"
              >
                Kaydetmeden Ã§Ä±k
              </button>
              {hasSaveHandler && (
                <button
                  onClick={saveAndContinue}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                >
                  Kaydet
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </UnsavedChangesContext.Provider>
  )
}

export function useUnsavedChanges() {
  const context = useContext(UnsavedChangesContext)
  if (!context) {
    throw new Error("useUnsavedChanges must be used within UnsavedChangesProvider")
  }
  return context
}
