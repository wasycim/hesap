import { PersonnelDynamicQr } from "@/components/mesai/personnel-dynamic-qr"
import { requireAuth } from "@/lib/qr-attendance/auth"

export default async function MesaiQrPage() {
  await requireAuth()

  return <PersonnelDynamicQr />
}
