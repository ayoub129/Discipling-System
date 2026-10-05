const fs=require('fs');
const paths=['supabase/upgrade-existing.sql','supabase/migrations/202610050001_baseline.sql','supabase/migrations/202610050002_atomic_operations.sql','supabase/migrations/202610050003_maintenance.sql','supabase/import-existing-events.sql'];
const sql=paths.map(p=>fs.readFileSync(p,'utf8').replace(/^\uFEFF/,'').replace(/^begin;\s*$/gmi,'').replace(/^commit;\s*$/gmi,'')).join('\n');
fs.writeFileSync('supabase/live-upgrade.sql','begin;\n'+sql+'\ncommit;\n');
