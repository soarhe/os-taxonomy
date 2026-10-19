import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve,dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { loadDataset,validateDataset } from '../scripts/validate-cn.mjs';
import {prerequisiteOrder} from '../scripts/lib/cn-graph.mjs';
const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const primary=loadDataset().data;
const {data,schemas}=loadDataset(resolve(ROOT,'data/cn-compulsory'));
const mapping=new Map(data.provenance.topicMappings.map(m=>[m.topicId,m]));
test('combined dataset validates and retains exact primary nodes, edges and mappings',()=>{
 assert.deepEqual(validateDataset(data,schemas),[]);
 for(const [key,rows] of [['topics','topics'],['dependencies','dependencies']])assert.deepEqual(data[key][rows].slice(0,primary[key][rows].length),primary[key][rows]);
 assert.deepEqual(data.provenance.topicMappings.slice(0,primary.provenance.topicMappings.length),primary.provenance.topicMappings);
 const old=new Set(primary.topics.topics.map(t=>t.id));
 for(const t of data.topics.topics.filter(t=>!old.has(t.id)))assert.ok(mapping.get(t.id).gradeRange[0]>=7);
});
test('junior equation prerequisites reach existing primary concepts',()=>{
 const path=prerequisiteOrder(data.topics.topics,data.dependencies.dependencies,'mt_cn_jm_linear_eq');
 assert.ok(path.includes('mt_cn_math_equation_property'));
 assert.ok(path.includes('mt_cn_jm_polynomial'));
 assert.equal(new Set(path).size,path.length);
});
test('optional grade-7 arts are never hard prerequisites of grade-8 choices',()=>{
 const path=prerequisiteOrder(data.topics.topics,data.dependencies.dependencies,'mt_cn_ja_dance_create');
 assert.ok(!path.includes('mt_cn_ja_dance7'));
 assert.ok(prerequisiteOrder(data.topics.topics,data.dependencies.dependencies,'mt_cn_ja_dance_create',true).includes('mt_cn_ja_dance7'));
});
for(const [name,mutate,pattern] of [
 ['grade ten',d=>d.provenance.topicMappings.at(-1).gradeRange=[7,10],/invalid grade range/],
 ['arts option',d=>d.provenance.scope.topicOptions.find(o=>o.topicId==='mt_cn_ja_dance_create').selection='stage-framework',/unmarked arts option/],
 ['missing path',d=>d.provenance.scope.topicOptions.find(o=>o.topicId==='mt_cn_js_energy').sciencePathway=null,/incorrect science pathway/],
 ['cross pathway',d=>d.dependencies.dependencies.push({topicId:'mt_cn_js_energy',prerequisiteId:'mt_cn_jp_work',strength:'hard',reason:'bad cross path'}),/cross-pathway dependency/],
 ['optional gate',d=>d.dependencies.dependencies.find(e=>e.prerequisiteId==='mt_cn_ja_dance7').strength='hard',/optional course made mandatory/],
 ['source mismatch',d=>d['curriculum-standards'].curricula[0].sourceUrl='https://example.com',/curriculum source mismatch/]
])test(`rejects ${name}`,()=>{const changed=structuredClone(data);mutate(changed);assert.match(validateDataset(changed,schemas).join('\n'),pattern);});
test('CLI stage search and topic provenance work outside the repository cwd',()=>{
 const run=(...args)=>JSON.parse(execFileSync(process.execPath,[resolve(ROOT,'scripts/query-cn.mjs'),...args],{cwd:'/private/tmp',encoding:'utf8',stdio:'pipe'}));
 const matches=run('search','数学','--dataset','compulsory','--stage','junior');
 assert.ok(matches.length>0);assert.ok(matches.every(t=>t.gradeRange[0]>=7));
 const topic=run('topic','mt_cn_js_energy','--dataset','compulsory');
 assert.equal(topic.option.sciencePathway,'integrated');
 assert.ok(topic.sources[0].url.startsWith('https://www.moe.gov.cn/'));
 assert.throws(()=>run('search','数学','--dataset','nonexistent'));
});
