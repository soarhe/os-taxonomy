import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { graphErrors } from './lib/cn-graph.mjs';
import { checkSchema } from './lib/schema-check.mjs';
const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'..');
export function validateDataset(data, schemas) {
  const errors=[];
  const check=(ok,msg)=>{if(!ok)errors.push(msg);};
  for(const name of ['topics','dependencies','clusters','curriculum-standards']) checkSchema(data[name],schemas[name],name,errors);
  if(errors.length) return errors;
  const ts=data.topics.topics, ds=data.dependencies.dependencies, cs=data.clusters.clusters;
  const p=data.provenance, m=data.manifest, curr=data['curriculum-standards'].curricula;
  const combined=p.version==='cn-compulsory-2022-draft.1';
  const maxGrade=combined?9:6;
  if(combined)check(JSON.stringify(p.scope?.gradeRange)==='[1,9]','invalid combined scope');
  errors.push(...graphErrors(ts,ds));
  const topicIds=new Set(ts.map(t=>t.id)), mapById=new Map(p.topicMappings.map(x=>[x.topicId,x]));
  const locByKey=new Map(p.standardLocators.map(x=>[x.key,x]));
  const sources=new Map(p.sources.map(x=>['cn-moe-2022-'+x.slug,x]));
  const standardKeys=new Set(curr.flatMap(c=>c.topics.map(x=>x.key)));
  check(topicIds.size===ts.length,'duplicate topic id');
  check(mapById.size===p.topicMappings.length,'duplicate topic mapping');
  check(locByKey.size===p.standardLocators.length,'duplicate standard locator');
  check(p.topicMappings.length===ts.length,'topic mapping count mismatch');
  check(p.standardLocators.length===standardKeys.size,'standard locator count mismatch');
  check(p.status==='draft' && m.status==='draft','unreviewed dataset must remain draft');
  check(p.dependencyPolicy.origin==='author-inferred' && p.dependencyPolicy.expertReviewed===false,'incorrect dependency provenance');
  check(sources.size===p.sources.length,'duplicate source');
  for(const c of curr) {
    const source=sources.get(c.slug);
    check(source?.url===c.sourceUrl && source?.title===c.name,`curriculum source mismatch ${c.slug}`);
  }
  for(const s of p.sources) {
    check(/^https:\/\/www\.moe\.gov\.cn\//.test(s.url),`non-MOE source ${s.slug}`);
    check(/^[a-f0-9]{64}$/.test(s.sha256),`invalid source checksum ${s.slug}`);
    check(Number.isInteger(s.pdfPageCount)&&s.pdfPageCount>0,`missing source page count ${s.slug}`);
  }
  for(const t of ts) {
    check(t.id.startsWith('mt_cn_'),`wrong namespace ${t.id}`);
    check(t.name?.trim() && t.description.trim(),`empty text ${t.id}`);
    check(t.evidence.length>0 && t.evidence.every(x=>x.trim().length>0),`empty evidence ${t.id}`);
    check(t.assessmentPrompt?.includes('{{name}}'),`missing assessment placeholder ${t.id}`);
    check(t.centrality===null,'uncalibrated centrality must be null');
    const map=mapById.get(t.id);
    if(!map) {errors.push(`missing mapping ${t.id}`);continue;}
    const [lo,hi]=map.gradeRange??[];
    check(Number.isInteger(lo)&&Number.isInteger(hi)&&lo>=1&&hi<=maxGrade&&lo<=hi,`invalid grade range ${t.id}`);
    check(t.ageRangeStart===lo+5 && t.ageRangeEnd===hi+6,`age convention mismatch ${t.id}`);
    check(JSON.stringify(map.standardKeys)===JSON.stringify(t.standards),`mapping key mismatch ${t.id}`);
    check(map.reviewStatus==='pending-subject-expert-review',`review status missing ${t.id}`);
    check(t.standards.length>0 && new Set(t.standards).size===t.standards.length,`empty/duplicate standards ${t.id}`);
    for(const k of t.standards) {
      const loc=locByKey.get(k);check(standardKeys.has(k)&&!!loc,`missing locator ${k}`);
      if(loc)check(lo>=loc.sourceGradeRange[0]&&hi<=loc.sourceGradeRange[1],`source grade mismatch ${t.id}`);
    }
  }
  for(const map of p.topicMappings) check(topicIds.has(map.topicId),`orphan mapping ${map.topicId}`);
  for(const loc of p.standardLocators) {
    check(standardKeys.has(loc.key),`orphan locator ${loc.key}`);
    const s=sources.get(loc.sourceSlug);
    check(!!s,`unknown source ${loc.sourceSlug}`);
    check(loc.codeOrigin==='project-assigned-section-locator' && loc.mappingGranularity==='section',`misrepresented code ${loc.key}`);
    check(loc.pdfPages?.length>0 && loc.pdfPages.length===loc.printedPages?.length,`missing pages ${loc.key}`);
    for(const [i,page] of (loc.pdfPages??[]).entries()) {
      check(Number.isInteger(page)&&page>0&&page<=s?.pdfPageCount,`invalid PDF page ${loc.key}`);
      check(loc.printedPages[i]===page-s?.printedPageOffset,`printed page mismatch ${loc.key}`);
    }
  }
  for(const d of ds) {
    check(d.reason?.trim(),`missing dependency reason ${d.topicId}`);
    const a=mapById.get(d.topicId), b=mapById.get(d.prerequisiteId);
    if(a&&b)check(b.gradeRange[0]<=a.gradeRange[1],`future prerequisite ${d.topicId}`);
  }
  const clusterKeys=cs.map(c=>`${c.subject}|${c.domain}|${c.ageRangeStart}`);
  check(new Set(clusterKeys).size===clusterKeys.length,'duplicate cluster');
  for(const t of ts)check(clusterKeys.includes(`${t.subject}|${t.domain}|${t.ageRangeStart}`),`missing cluster ${t.id}`);
  const counts={topics:ts.length,dependencies:ds.length,curricula:curr.length,curriculumStandards:standardKeys.size,topicStandardLinks:ts.reduce((n,t)=>n+t.standards.length,0),clusters:cs.length};
  for(const [k,v] of Object.entries(counts))check(m.counts[k]===v,`manifest count mismatch ${k}`);
  const subjects={};for(const t of ts)subjects[t.subject]=(subjects[t.subject]??0)+1;
  check(JSON.stringify(Object.entries(subjects).sort())===JSON.stringify(Object.entries(m.counts.topicsBySubject).sort()),'subject counts mismatch');
  if(combined) {
    const options=p.scope.topicOptions??[], byOption=new Map(options.map(x=>[x.topicId,x]));
    const junior=ts.filter(t=>mapById.get(t.id)?.gradeRange[0]>=7);
    check(m.counts.topicsByStage?.junior===junior.length && m.counts.topicsByStage?.primary===ts.length-junior.length,'stage count mismatch');
    check(m.counts.crossStageDependencies===ds.filter(d=>mapById.get(d.topicId)?.gradeRange[0]>=7 && mapById.get(d.prerequisiteId)?.gradeRange[1]<=6).length,'cross-stage count mismatch');
    check(byOption.size===options.length && options.length===junior.length,'junior option count mismatch');
    for(const t of junior) {
      const o=byOption.get(t.id), g=mapById.get(t.id).gradeRange;
      check(!!o,`missing junior option ${t.id}`);
      const path=t.subject==='科学'?'integrated':['物理','化学','生物学'].includes(t.subject)?'disciplinary':null;
      check(o?.sciencePathway===path,`incorrect science pathway ${t.id}`);
      check(['stage-framework','arts-option-8-9','school-conditional-7','school-selected-sport'].includes(o?.selection),`invalid selection ${t.id}`);
      if(t.subject==='艺术' && g[0]===8)check(o?.selection==='arts-option-8-9',`unmarked arts option ${t.id}`);
      if(o?.selection==='school-conditional-7')check(t.subject==='艺术' && g[0]===7 && g[1]===7,`conditional arts grade mismatch ${t.id}`);
    }
    for(const d of ds) {
      const a=byOption.get(d.topicId), b=byOption.get(d.prerequisiteId);
      if(a?.sciencePathway && b?.sciencePathway)check(a.sciencePathway===b.sciencePathway,`cross-pathway dependency ${d.topicId}`);
      if(b?.selection==='school-conditional-7')check(d.strength==='soft',`optional course made mandatory ${d.topicId}`);
      if(mapById.get(d.topicId)?.gradeRange[1]<=6)check(mapById.get(d.prerequisiteId)?.gradeRange[1]<=6,`junior prerequisite imposed on primary ${d.topicId}`);
    }
  }
  return errors;
}
export function loadDataset(dir=resolve(ROOT,'data/cn-primary')) {
  const data={},schemas={};
  for(const name of ['topics','dependencies','clusters','curriculum-standards','provenance','manifest'])data[name]=JSON.parse(readFileSync(resolve(dir,name+'.json'),'utf8'));
  for(const name of ['topics','dependencies','clusters','curriculum-standards'])schemas[name]=JSON.parse(readFileSync(resolve(ROOT,'schema',name+'.schema.json'),'utf8'));
  return {data,schemas};
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const {data,schemas}=loadDataset(process.argv[2]&&resolve(process.argv[2]));
  const errors=validateDataset(data,schemas);
  if(errors.length){console.error(errors.join('\n'));process.exitCode=1;}
  else console.log(`✓ China dataset: schemas, DAG (hard + soft), grades, sources, page locators and counts OK; ${data.topics.topicCount} draft topics.`);
}
