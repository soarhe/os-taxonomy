import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadDataset } from './validate-cn.mjs';
import { prerequisiteOrder } from './lib/cn-graph.mjs';
const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const usage='Usage: node scripts/query-cn.mjs search <text> [--stage junior|primary] | topic <id> | prerequisites <id> [--include-soft] | unlocks <id>; any command accepts --dataset primary|compulsory (default primary)';
try {
  const args=process.argv.slice(2), positional=[];
  let dataset='primary', stage, includeSoft=false;
  for(let i=0;i<args.length;i++) {
    if(['--dataset','--stage'].includes(args[i]) && (!args[i+1] || args[i+1].startsWith('--')))throw new Error(usage);
    if(args[i]==='--dataset')dataset=args[++i];
    else if(args[i]==='--stage')stage=args[++i];
    else if(args[i]==='--include-soft')includeSoft=true;
    else if(args[i].startsWith('--'))throw new Error(usage);
    else positional.push(args[i]);
  }
  const [command,value]=positional;
  if(!['primary','compulsory'].includes(dataset) || positional.length!==2 || (stage && (!['junior','primary'].includes(stage)||command!=='search')) || (includeSoft && command!=='prerequisites'))throw new Error(usage);
  const {data}=loadDataset(resolve(ROOT,'data',`cn-${dataset}`));
  const ts=data.topics.topics, ds=data.dependencies.dependencies;
  const byId=new Map(ts.map(t=>[t.id,t]));
  const mappings=new Map(data.provenance.topicMappings.map(m=>[m.topicId,m]));
  const options=new Map((data.provenance.scope?.topicOptions??[]).map(o=>[o.topicId,o]));
  const brief=id=>{const t=byId.get(id);if(!t)throw new Error(`Unknown topic: ${id}`);return {id,name:t.name,subject:t.subject,gradeRange:mappings.get(id).gradeRange};};
  let output;
  if(command==='search')output=ts.filter(t=>(t.name+t.description+t.subject+t.domain).includes(value)).filter(t=>!stage||(stage==='junior'?mappings.get(t.id).gradeRange[0]>=7:mappings.get(t.id).gradeRange[1]<=6)).map(t=>brief(t.id));
  else if(command==='prerequisites')output={target:brief(value),policy:'Authored draft; not a mastery decision or mandatory gate. Optional course paths must be selected locally.',includeSoft,order:prerequisiteOrder(ts,ds,value,includeSoft).map(brief)};
  else if(command==='unlocks' && byId.has(value))output=ds.filter(d=>d.prerequisiteId===value).map(d=>({...brief(d.topicId),strength:d.strength,reason:d.reason}));
  else if(command==='topic' && byId.has(value))output={...byId.get(value),mapping:mappings.get(value),option:options.get(value)??null,sources:data.provenance.standardLocators.filter(x=>byId.get(value).standards.includes(x.key)).map(x=>({...x,url:data.provenance.sources.find(s=>'cn-moe-2022-'+s.slug===x.sourceSlug)?.url}))};
  else throw new Error(usage);
  console.log(JSON.stringify(output,null,2));
} catch(e) {console.error(e.message);process.exitCode=1;}
