import FirmaDetailClient from "./firma-detail-client"

export const dynamic = "force-dynamic"
export const revalidate = 0

export default function FirmaDetailPage({ params }: { params: Promise<{ firmaId: string }> }) {
  return <FirmaDetailClient params={params} />
}
