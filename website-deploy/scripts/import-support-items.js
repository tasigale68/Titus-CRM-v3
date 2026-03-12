// One-time script to import NDIS support items into Supabase
// Run: node scripts/import-support-items.js

const fs = require('fs');

const SUPABASE_URL = 'https://octdvaicofjmaetgfect.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_KEY) {
  console.error('Set SUPABASE_SERVICE_KEY env var');
  process.exit(1);
}

const items = JSON.parse(
  fs.readFileSync(
    '/home/tasig/Titus-Agreement-Creator-17th-Feb-26/backend/data/ndis_support_items_2025_26.json',
    'utf8'
  )
);

console.log(`Loaded ${items.length} items`);

const rows = items.map(item => ({
  support_item_number: item.supportItemNumber,
  support_item_name: item.supportItemName,
  category: item.supportCategoryPace || null,
  rate_act: item.rates?.ACT ?? null,
  rate_nsw: item.rates?.NSW ?? null,
  rate_nt: item.rates?.NT ?? null,
  rate_qld: item.rates?.QLD ?? null,
  rate_sa: item.rates?.SA ?? null,
  rate_tas: item.rates?.TAS ?? null,
  rate_vic: item.rates?.VIC ?? null,
  rate_wa: item.rates?.WA ?? null,
  rate_remote: item.rates?.Remote ?? null,
  rate_very_remote: item.rates?.VeryRemote ?? null,
}));

async function insertBatch(batch) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/support_items`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Prefer': 'return=minimal',
    },
    body: JSON.stringify(batch),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Insert failed: ${res.status} ${text}`);
  }
}

async function main() {
  const BATCH_SIZE = 500;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    await insertBatch(batch);
    console.log(`Inserted ${Math.min(i + BATCH_SIZE, rows.length)}/${rows.length}`);
  }
  console.log('Done!');
}

main().catch(console.error);
