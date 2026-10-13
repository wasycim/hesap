const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing supabase credentials");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function run() {
  console.log("Adding secili_personeller column to kargo_prim_kayitlari...");
  // Try querying kargo_prim_kayitlari to see if column exists
  const { data, error } = await supabase.from('kargo_prim_kayitlari').select('secili_personeller').limit(1);
  if (error && error.message.includes('secili_personeller')) {
    console.log("Column does not exist, executing RPC or raw query if possible or checking columns...");
    // If column doesn't exist, we can use RPC or raw SQL endpoint if available, or postgres connection
  } else {
    console.log("Column query result:", data, error);
  }
}

run();
