import { redirect } from "next/navigation"
import { LoginForm } from "@/components/mesai/login-form"
import { getAuthSession } from "@/lib/qr-attendance/auth"

export default async function LoginPage() {
  const session = await getAuthSession()

  if (session?.role === "ADMIN") {
    redirect("/personel-mesai")
  }

  if (session) {
    redirect("/mesai-qr")
  }

  return <LoginForm />
}
