import fs from 'node:fs';
const compiler=await import('typescript');
const ts=compiler.default;
for(const file of ['time','validation']){
 const source=fs.readFileSync(`lib/${file}.ts`,'utf8');
 const output=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,esModuleInterop:true}});
 fs.mkdirSync('.test-build',{recursive:true});fs.writeFileSync(`.test-build/${file}.js`,output.outputText);
}
const {createRequire}=await import('node:module');const require=createRequire(import.meta.url);
const {createQuest,editQuest,questValues,rewardFields}=require('../.test-build/validation.js');
const {dateKey,zonedTimeToIso,addDays}=require('../.test-build/time.js');
const {default:assert}=await import('node:assert/strict');let checks=0;
const valid={title:'Focus',date:'2026-10-05',startTime:'09:00',endTime:'10:00',timezone:'Africa/Casablanca',xp:25,points:5};
assert.equal(createQuest.safeParse(valid).success,true);checks++;
for(const values of [{title:' '},{date:'2026-02-30'},{startTime:'25:00'},{endTime:'08:00'},{xp:-5},{xp:Infinity},{points:'5'},{timezone:'Nowhere/Invalid'}]){assert.equal(createQuest.safeParse({...valid,...values}).success,false);checks++;}
assert.equal(editQuest.safeParse({id:'11111111-1111-4111-8111-111111111111',status:'completed',xp:500}).success,false);checks++;
assert.equal(editQuest.safeParse({id:'11111111-1111-4111-8111-111111111111',status:'hacked'}).success,false);checks++;
const stored=questValues({...valid,id:'11111111-1111-4111-8111-111111111111'});
assert.equal(stored.planned_start,'2026-10-05T08:00:00.000Z');checks++;
assert.equal(stored.estimated_minutes,60);checks++;
assert.equal(zonedTimeToIso('2026-01-15','09:00','America/New_York'),'2026-01-15T14:00:00.000Z');checks++;
assert.equal(zonedTimeToIso('2026-07-15','09:00','America/New_York'),'2026-07-15T13:00:00.000Z');checks++;
assert.throws(()=>zonedTimeToIso('2026-03-08','02:30','America/New_York'),/does not exist/);checks++;
assert.equal(dateKey(new Date('2026-10-05T23:30:00Z'),'Africa/Casablanca'),'2026-10-06');checks++;
assert.equal(addDays('2028-02-28',1),'2028-02-29');checks++;
assert.equal(rewardFields.safeParse({name:'Break',pointCost:1,minimumLevel:1,minimumRankId:null,minimumDisciplineScore:0,cooldownHours:0,maxRedemptionsPerWeek:null}).success,true);checks++;
console.log(`${checks} input and timezone assertions passed.`);
