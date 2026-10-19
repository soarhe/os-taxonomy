import { loadDataset } from './validate-cn.mjs';
import { prerequisiteOrder } from './lib/cn-graph.mjs';
const {data}=loadDataset();
const [command,value,...flags]=process.argv.slice(2);
const ts=data.topics.topics, ds=data.dependencies.dependencies;
const byId=new Map(ts.map(t=>[t.id,t]));
const brief=id=>{const t=byId.get(id);if(!t)throw new Error(`Unknown topic: ${id}`);return {id,name:t.name,subject:t.subject};};
try {
  let output;
  if(command==='search' && value)output=ts.filter(t=>(t.name+t.description+t.subject+t.domain).includes(value)).map(t=>brief(t.id));
  else if(command==='prerequisites' && value)output={target:brief(value),policy:'Authored draft; not a mastery decision or mandatory gate.',includeSoft:flags.includes('--include-soft'),order:prerequisiteOrder(ts,ds,value,flags.includes('--include-soft')).map(brief)};
  else if(command==='unlocks' && byId.has(value))output=ds.filter(d=>d.prerequisiteId===value).map(d=>({...brief(d.topicId),strength:d.strength,reason:d.reason}));
  else if(command==='topic' && byId.has(value))output={...byId.get(value),mapping:data.provenance.topicMappings.find(x=>x.topicId===value),sources:data.provenance.standardLocators.filter(x=>byId.get(value).standards.includes(x.key))};
  else throw new Error('Usage: node scripts/query-cn.mjs search <text> | topic <id> | prerequisites <id> [--include-soft] | unlocks <id>');
  console.log(JSON.stringify(output,null,2));
} catch(e) {console.error(e.message);process.exitCode=1;}
