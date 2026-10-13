const { createClient } = require("@supabase/supabase-js")

const supabaseUrl = "https://jchicxqyguywutnstwhu.supabase.co"
const serviceRoleKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpjaGljeHF5Z3V5d3V0bnN0d2h1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjQyNzA0NSwiZXhwIjoyMDkyMDAzMDQ1fQ.dW-9xS9ZSq-Z5Cs7vt5zsbLylDrJhCt4d0NTMBCLVFs"

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function resetTestData() {
  console.log("Resetting all avans, mesai, and advances in gider_kayitlari...")

  // 1. Delete all avans_talepleri
  const { error: err1 } = await admin.from("avans_talepleri").delete().neq("id", "00000000-0000-0000-0000-000000000000")
  if (err1) console.error("Error deleting avans_talepleri:", err1.message)
  else console.log("✅ avans_talepleri cleared.")

  // 2. Delete all overtime_approvals
  const { error: err2 } = await admin.from("overtime_approvals").delete().neq("id", "00000000-0000-0000-0000-000000000000")
  if (err2) console.error("Error deleting overtime_approvals:", err2.message)
  else console.log("✅ overtime_approvals cleared.")

  // 3. Delete attendance_logs
  const { error: err3 } = await admin.from("attendance_logs").delete().neq("id", 0)
  if (err3) console.error("Error deleting attendance_logs:", err3.message)
  else console.log("✅ attendance_logs cleared.")

  // 4. Reset personel_paylari and personel_mesai_detaylari in gider_kayitlari
  const { data: giderRows } = await admin.from("gider_kayitlari").select("id, personel_paylari, personel_mesai_detaylari")
  if (giderRows) {
    for (const row of giderRows) {
      if (row.personel_paylari || row.personel_mesai_detaylari) {
        await admin.from("gider_kayitlari").update({
          personel_paylari: {},
          personel_mesai_detaylari: {}
        }).eq("id", row.id)
      }
    }
    console.log("✅ gider_kayitlari advance & manual overtime cleared.")
  }

  console.log("ALL TEST DATA & ADVANCES RESET COMPLETED CLEANLY!")
}

resetTestData().catch(console.error)
