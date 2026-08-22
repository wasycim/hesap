const { createClient } = require("@supabase/supabase-js");
const dotenv = require("dotenv");
const path = require("path");

dotenv.config({ path: path.join(__dirname, "../.env.local") });
dotenv.config({ path: path.join(__dirname, "../.env") });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(url, key);

async function run() {
  const userId = "ce264f2e-1c1b-4cf1-a046-05e37c5e8409";
  
  const { data: subeler } = await supabase.from("subeler").select("*").limit(1);
  const subeId = subeler && subeler[0] ? subeler[0].id : null;

  // Insert or update Test App in personeller
  const { data: existing } = await supabase.from("personeller").select("*").eq("user_id", userId);
  
  if (!existing || existing.length === 0) {
    const { data: inserted, error } = await supabase.from("personeller").insert({
      user_id: userId,
      ad: "Test App",
      sube_id: subeId,
      aktif: true,
      sabit_vardiya: "08:00-17:00",
      sira: 9999,
      aylik_maas: 30000,
      banka_maas: 15000,
      nakit_maas: 15000,
      saatlik_mesai_ucreti: 150.00
    }).select();

    if (error) {
      console.error("Error inserting Test App personnel:", error);
    } else {
      console.log("SUCCESSFULLY INSERTED TEST APP PERSONNEL:", inserted);
    }
  } else {
    console.log("Test App personnel already exists:", existing[0]);
  }
}

run().catch(console.error);
