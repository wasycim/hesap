"use client"

import { useEffect } from "react"

const toolbarSelectors = [
  'iframe[src*="vercel.live"]',
  'script[src*="vercel.live"]',
  'link[href*="vercel.live"]',
  '[data-vercel-toolbar]',
  '[data-vercel-feedback]',
  '[data-vercel-live]',
  '#vercel-toolbar',
  '#vercel-live-feedback',
  '[id^="vercel-live"]',
  '[class*="vercel-toolbar"]',
  '[class*="vercel-live"]',
]

export function VercelToolbarBlocker() {
  useEffect(() => {
    const style = document.createElement("style")
    style.setAttribute("data-vercel-toolbar-blocker", "true")
    style.textContent = `${toolbarSelectors.join(",")} { display: none !important; opacity: 0 !important; pointer-events: none !important; visibility: hidden !important; }`

    const removeToolbarNodes = () => {
      document.querySelectorAll(toolbarSelectors.join(",")).forEach((node) => node.remove())
    }

    document.head.appendChild(style)
    removeToolbarNodes()

    const observer = new MutationObserver(removeToolbarNodes)
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
    })

    return () => {
      observer.disconnect()
      style.remove()
    }
  }, [])

  return null
}
