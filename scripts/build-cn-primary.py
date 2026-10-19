#!/usr/bin/env python3
"""Compile version-controlled authoring records; no LLM/network at build time."""
import hashlib, json
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'data/cn-primary'
AUTHOR = ROOT / 'authoring/cn-primary'
VERSION = 'cn-primary-2022-draft.1'

def read(p): return json.loads(p.read_text())
def write(name, value):
    (OUT/name).write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n')

def build():
    OUT.mkdir(parents=True,exist_ok=True)
    sources=read(AUTHOR/'sources.json')
    groups=read(AUTHOR/'groups.json')
    topics=[]; edges=[]; mappings=[]; locators=[]; clusters=[]
    ids={r['id']: 'mt_cn_'+r['id'] for g in groups for r in g['items']}
    if len(ids)!=sum(len(g['items']) for g in groups): raise ValueError('duplicate authoring ID')
    for g in groups:
        src=next(s for s in sources if s['slug']==g['source'])
        slug='cn-moe-2022-'+src['slug']
        code=g['code']; key=slug+':'+code
        locators.append({'key':key,'code':code,'sourceSlug':slug,'section':g['section'],
            'pdfPages':g['pages'],'printedPages':[p-src['printedPageOffset'] for p in g['pages']],
            'sourceGradeRange':g['sourceGrades'],'codeOrigin':'project-assigned-section-locator',
            'mappingGranularity':'section','reviewStatus':'pending-subject-expert-review'})
        for r in g['items']:
            grades=r.get('grades',g['grades']); evidence=r['evidence']
            topics.append({'id':ids[r['id']],'type':r['type'],'subject':src['subject'],'domain':g['domain'],
                'name':r['name'],'description':r['description'],'ageRangeStart':grades[0]+5,
                'ageRangeEnd':grades[1]+6,'centrality':None,'evidence':evidence,
                'assessmentPrompt':r['assessment'],'standards':[key]})
            mappings.append({'topicId':ids[r['id']],'gradeRange':grades,'standardKeys':[key],
                'alignment':'author-decomposed-from-section','reviewStatus':'pending-subject-expert-review'})
            for dep in r.get('prerequisites',[]):
                prereq,strength,reason=dep
                if prereq not in ids: raise ValueError('unknown prerequisite '+prereq)
                edges.append({'topicId':ids[r['id']],'prerequisiteId':ids[prereq],'strength':strength,'reason':reason})
        clusters.append({'subject':src['subject'],'domain':g['domain'],'ageRangeStart':g['grades'][0]+5,'summary':g['summary']})
    merged={}
    for c in clusters:
        k=(c['subject'],c['domain'],c['ageRangeStart'])
        if k in merged: merged[k]['summary']+=' '+c['summary']
        else: merged[k]=dict(c)
    clusters=list(merged.values())
    curricula=[]
    for s in sources:
        slug='cn-moe-2022-'+s['slug']; rows=[{'key':x['key'],'code':x['code']} for x in locators if x['sourceSlug']==slug]
        curricula.append({'slug':slug,'country':'CN','name':s['title'],'version':'2022',
            'sourceUrl':s['url'],'textIncluded':False,'license':'Upstream source terms; no license granted by this fork for source PDFs.',
            'topicCount':len(rows),'topics':rows})
    write('topics.json',{'version':VERSION,'topicCount':len(topics),'topics':topics})
    write('dependencies.json',{'version':VERSION,'note':'topicId depends on prerequisiteId. All edges are authored pedagogical hypotheses, not official MOE mandates; pending expert review. hard describes a logical prerequisite in this decomposition, not an access gate.','edgeCount':len(edges),'dependencies':edges})
    write('clusters.json',{'version':VERSION,'clusterCount':len(clusters),'clusters':clusters})
    write('curriculum-standards.json',{'note':'Codes are project-assigned section locators, NOT official standard identifiers. Source text is not reproduced. See provenance.json for page ranges.','codesOnlySources':[c['slug'] for c in curricula],'curriculumCount':len(curricula),'curricula':curricula})
    write('provenance.json',{'version':VERSION,'status':'draft','sourceIndexUrl':'https://www.moe.gov.cn/srcsite/A26/s8001/202204/t20220420_619921.html','sources':sources,'standardLocators':locators,'topicMappings':mappings,'dependencyPolicy':{'origin':'author-inferred','expertReviewed':False,'learnerValidated':False},'agePolicy':'Display estimates for entry at age six; gradeRange is authoritative within this draft; never infer learner mastery from age.','coverageClaim':'Broad primary subject framework, six-three school system; not an exhaustive or officially endorsed decomposition. English starts at grades 3-4. Arts uses source bands 1-2, 3-5, 6-7, with grade 6 extracted separately. No grade 7 nodes.'})
    counts={'topics':len(topics),'topicsBySubject':dict(sorted(Counter(t['subject'] for t in topics).items())),'dependencies':len(edges),'curricula':len(curricula),'curriculumStandards':len(locators),'topicStandardLinks':sum(len(t['standards']) for t in topics),'clusters':len(clusters)}
    files={}
    for name in ['topics.json','dependencies.json','curriculum-standards.json','clusters.json','provenance.json']:
        b=(OUT/name).read_bytes(); files[name]={'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()}
    write('manifest.json',{'dataset':'中国小学课程知识图谱（基于2022年版义务教育课标）','taxonomyVersion':VERSION,'status':'draft','sourceDate':'2026-10-19','upstreamCommit':'96a7933754af672e1bfdbf7ecb05c325860c6e0d','counts':counts,'files':files,'excluded':['source PDF text','student data','empirical mastery estimates','official prerequisite claims','textbook edition mappings'],'expertReviewCompleted':False})
    print(json.dumps(counts,ensure_ascii=False,indent=2))

if __name__=='__main__': build()
