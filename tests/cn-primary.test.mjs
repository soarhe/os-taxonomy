import test from 'node:test';
import assert from 'node:assert/strict';
import {graphErrors,prerequisiteOrder} from '../scripts/lib/cn-graph.mjs';
import {checkSchema} from '../scripts/lib/schema-check.mjs';
import {loadDataset,validateDataset} from '../scripts/validate-cn.mjs';
const topics=['a','b','c','d','e'].map(id=>({id}));
const edge=(topicId,prerequisiteId,strength='hard')=>({topicId,prerequisiteId,strength});
const edges=[edge('d','b'),edge('d','c'),edge('b','a'),edge('c','a'),edge('d','e','soft')];
test('diamond prerequisites are deduplicated and ordered; soft edges are opt-in',()=>{
 assert.deepEqual(prerequisiteOrder(topics,edges,'d'),['a','b','c']);
 assert.deepEqual(prerequisiteOrder(topics,edges,'d',true),['a','b','c','e']);
 assert.deepEqual(graphErrors(topics,edges),[]);
});
test('cycles, missing endpoints, duplicate edges and self edges fail',()=>{
 for(const ds of [[edge('a','b','soft'),edge('b','a','soft')],[edge('a','missing')],[edge('a','b'),edge('a','b')],[edge('a','a')]])assert.ok(graphErrors(topics,ds).length);
 assert.throws(()=>prerequisiteOrder(topics,[edge('a','b'),edge('b','a')],'a'),/Cycle/);
 assert.throws(()=>prerequisiteOrder(topics,[],'missing'),/Unknown/);
});
test('schema evaluator rejects invalid properties and unsupported schema keywords',()=>{
 const s={type:'object',required:['n'],properties:{n:{type:'integer',minimum:1}},additionalProperties:false};
 assert.equal(checkSchema({n:2},s).length,0);
 for(const v of [{n:0},{n:'2'},{n:2,x:3},{}])assert.ok(checkSchema(v,s).length);
 assert.throws(()=>checkSchema({}, {oneOf:[]}),/Unsupported/);
});
const {data,schemas}=loadDataset();
test('complete dataset satisfies format and provenance constraints',()=>assert.deepEqual(validateDataset(data,schemas),[]));
for(const [name,mutate,pattern] of [
 ['grade',d=>d.provenance.topicMappings[0].gradeRange=[0,7],/grade range/],
 ['source page',d=>d.provenance.standardLocators[0].pdfPages=[9999],/PDF page/],
 ['missing locator',d=>d.provenance.standardLocators.shift(),/locator/],
 ['mapping',d=>d.provenance.topicMappings[0].standardKeys=[],/mapping key/],
 ['count',d=>d.manifest.counts.topics++,/count mismatch/],
 ['official-code misrepresentation',d=>d.provenance.standardLocators[0].codeOrigin='official',/misrepresented/],
 ['extra core field',d=>d.topics.topics[0].grade=1,/extra field/]
])test(`rejects corrupted ${name}`,()=>{const d=structuredClone(data);mutate(d);assert.match(validateDataset(d,schemas).join('\n'),pattern);});
