import {spawnSync} from 'node:child_process';
for(const file of ['database.mjs','legacy-upgrade.mjs','validation.mjs','account-storage.mjs']){
 const result=spawnSync(process.execPath,['--wasm-num-compilation-tasks=1','--liftoff-only','--max-old-space-size=512',`tests/${file}`],{stdio:'inherit'});
 if(result.status!==0)process.exit(result.status||1);
}
