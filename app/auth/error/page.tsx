import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertTriangle } from "lucide-react"

export default function AuthErrorPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-destructive/10">
              <AlertTriangle className="w-6 h-6 text-destructive" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold">Bir Hata Oluştu</CardTitle>
          <CardDescription>
            Kimlik doğrulama sırasında bir sorun oluştu. Lütfen tekrar deneyin.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center">
            Bu hata genellikle doğrulama linkinin süresi dolduğunda veya geçersiz olduğunda oluşur.
          </p>
        </CardContent>
        <CardFooter className="flex flex-col gap-2">
          <Link href="/auth/giris" className="w-full">
            <Button className="w-full">Giriş Sayfasına Dön</Button>
          </Link>
          <Link href="/auth/kayit" className="w-full">
            <Button variant="outline" className="w-full">Yeniden Kayıt Ol</Button>
          </Link>
        </CardFooter>
      </Card>
    </div>
  )
}
