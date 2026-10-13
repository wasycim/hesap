import Link from "next/link"

type PublicAuthFooterProps = {
  className?: string
}

export function PublicAuthFooter({ className = "" }: PublicAuthFooterProps) {
  return (
    <footer className={`text-center text-xs text-muted-foreground ${className}`}>
      <p className="leading-relaxed">
        Hesap, Wasy Systems tarafından işletilen şirket içi rapor ve mesai takip sistemidir.
      </p>
      <nav className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
        <Link href="/privacy-policy" className="transition hover:text-foreground">
          Gizlilik Politikası
        </Link>
        <Link href="/data-deletion" className="transition hover:text-foreground">
          Veri Silme
        </Link>
        <Link href="/mobile-support" className="transition hover:text-foreground">
          Destek
        </Link>
        <Link href="/status" className="transition hover:text-foreground">
          Sistem Durumu
        </Link>
      </nav>
    </footer>
  )
}
