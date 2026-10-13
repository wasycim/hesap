const { createClient } = require("@supabase/supabase-js");
const dotenv = require("dotenv");
const path = require("path");

dotenv.config({ path: path.join(__dirname, "../.env.local") });
dotenv.config({ path: path.join(__dirname, "../.env") });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(url, key);

async function run() {
  const { data: subeler } = await supabase.from("subeler").select("*");

  // Find exact 5A branch
  const sube5a = (subeler || []).find((s) => s.ad === "5A" || s.kod === "5A");

  console.log("Targeting 5A sube:", sube5a);

  if (!sube5a) {
    console.error("Could not find 5A sube!");
    return;
  }

  const userId = "ce264f2e-1c1b-4cf1-a046-05e37c5e8409"; // Test App user_id

  // Update personeller
  const { data: updatedP, error: pErr } = await supabase
    .from("personeller")
    .update({ sube_id: sube5a.id })
    .eq("user_id", userId)
    .select();

  if (pErr) console.error("Update personeller error:", pErr);
  else console.log("Updated personeller for Test App to 5A:", updatedP);

  // Update user_profiles
  const { data: updatedProf, error: profErr } = await supabase
    .from("user_profiles")
    .update({ sube_id: sube5a.id })
    .eq("user_id", userId)
    .select();

  if (profErr) console.error("Update user_profiles error:", profErr);
  else console.log("Updated user_profiles for Test App to 5A:", updatedProf);
}

run().catch(console.error);
