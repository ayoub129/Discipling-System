import fs from 'node:fs';
const env=Object.fromEntries(fs.readFileSync('.env.local','utf8').trim().split(/\r?\n/).map(line=>{const i=line.indexOf('=');return[line.slice(0,i),line.slice(i+1)]}));
const result=await fetch(env.NEXT_PUBLIC_SUPABASE_URL+'/auth/v1/settings',{headers:{apikey:env.NEXT_PUBLIC_SUPABASE_ANON_KEY}});
const body=await result.json();console.log('Auth connection status:',result.status);console.log(result.ok?{signupEnabled:!body.disable_signup,emailEnabled:body.external?.email}:body);
