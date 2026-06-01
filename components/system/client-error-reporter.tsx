"use client"

import { useEffect } from "react"

export function ClientErrorReporter() {
  useEffect(() => {
    function send(payload: { message: string; stack?: string; path?: string }) {
      fetch("/api/error-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        keepalive: true,
      }).catch(() => undefined)
    }

    function onError(event: ErrorEvent) {
      send({
        message: event.message || "Client error",
        stack: event.error?.stack || "",
        path: window.location.pathname,
      })
    }

    function onUnhandled(event: PromiseRejectionEvent) {
      const reason = event.reason
      send({
        message: reason instanceof Error ? reason.message : String(reason || "Unhandled promise rejection"),
        stack: reason instanceof Error ? reason.stack : "",
        path: window.location.pathname,
      })
    }

    window.addEventListener("error", onError)
    window.addEventListener("unhandledrejection", onUnhandled)
    return () => {
      window.removeEventListener("error", onError)
      window.removeEventListener("unhandledrejection", onUnhandled)
    }
  }, [])

  return null
}
