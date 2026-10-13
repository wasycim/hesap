async function checkRsc() {
  const res = await fetch('https://pamukkaleturizm.info/dashboard/kargo-cari', {
    headers: { 'RSC': '1' }
  })
  const text = await res.text()
  console.log('RSC Payload length:', text.length)
  console.log('RSC contains Firma Filtresi:', text.includes('Firma Filtresi'))
  console.log('RSC contains selectedFirmaFilter:', text.includes('selectedFirmaFilter'))
  
  const chunkMatches = [...text.matchAll(/static\/chunks\/[^\"]+/g)].map(m => m[0])
  console.log('RSC Chunks found:', chunkMatches)

  for (const chunk of chunkMatches) {
    const jsRes = await fetch('https://pamukkaleturizm.info/_next/' + chunk)
    const js = await jsRes.text()
    if (js.includes('Firma Filtresi') || js.includes('selectedFirmaFilter')) {
      console.log('🎉🎉🎉 FOUND Firma Filtresi IN PROD CHUNK:', chunk)
    }
  }
}
checkRsc()
