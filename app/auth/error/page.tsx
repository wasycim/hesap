import Link from "next/link"
import { AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { PublicAuthFooter } from "@/components/auth/public-auth-footer"

export default function AuthErrorPage() {
  return (
    <main className="min-h-screen bg-background px-4 py-8 text-foreground">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-md items-center justify-center">
        <Card className="w-full rounded-2xl border bg-card shadow-2xl">
          <CardHeader className="text-center">
            <div className="mb-4 flex justify-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-destructive/10">
                <AlertTriangle className="h-6 w-6 text-destructive" />
              </div>
            </div>
            <CardTitle className="text-2xl font-bold">Bir hata oluştu</CardTitle>
            <CardDescription>
              Kimlik doğrulama sırasında bir sorun oluştu. Lütfen tekrar deneyin.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-center text-sm text-muted-foreground">
              Bu hata genellikle doğrulama bağlantısının süresi dolduğunda veya geçersiz olduğunda oluşur.
            </p>
          </CardContent>
          <CardFooter>
            <Link href="/auth/giris" className="w-full">
              <Button className="h-11 w-full rounded-xl">Giriş sayfasına dön</Button>
            </Link>
          </CardFooter>
        </Card>
      </div>
      <PublicAuthFooter className="mx-auto -mt-2 max-w-md pb-1" />
    </main>
  )
}
