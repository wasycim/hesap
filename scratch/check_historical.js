const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function run() {
  const [giderRes, corbaRes, auditRes] = await Promise.all([
    supabase.from('gider_kayitlari').select('personel_paylari, personel_mesai_detaylari'),
    supabase.from('corbalar').select('personel_id'),
    supabase.from('audit_logs').select('*').limit(20)
  ]);

  const pPayKeys = new Set();
  (giderRes.data || []).forEach(row => {
    if (row.personel_paylari) Object.keys(row.personel_paylari).forEach(k => pPayKeys.add(k));
    if (row.personel_mesai_detaylari) Object.keys(row.personel_mesai_detaylari).forEach(k => pPayKeys.add(k));
  });

  const corbaPersonelIds = new Set((corbaRes.data || []).map(c => c.personel_id));

  console.log("Personnel IDs found in past Gider Kayitlari:", Array.from(pPayKeys));
  console.log("Personnel IDs found in past Corba Kayitlari:", Array.from(corbaPersonelIds));
}

run();
