#!/usr/bin/env python3
"""Build the combined grades 1–9 graph without changing primary artifacts."""
import importlib.util,json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('cn_build',ROOT/'scripts/build-cn-primary.py')
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
read=lambda p:json.loads(p.read_text())
if __name__=='__main__':
    groups=read(ROOT/'authoring/cn-primary/groups.json')+read(ROOT/'authoring/cn-junior/groups.json')
    sources=read(ROOT/'authoring/cn-primary/sources.json')+read(ROOT/'authoring/cn-junior/sources.json')
    module.build(out=ROOT/'data/cn-compulsory',sources=sources,groups=groups,version='cn-compulsory-2022-draft.1',
      dataset_name='中国小学及初中课程知识图谱（基于2022年版义务教育课标）',
      coverage='Broad grades 1–9 framework in the six-three school system; not exhaustive. Primary records retained. Junior grade ranges describe stage scope rather than textbook scheduling. Integrated science and disciplinary science are separate source pathways, not equivalent or jointly mandatory. Arts selections are not all mandatory.',
      scope={'gradeRange':[1,9],'schoolSystem':'six-three',
       'primarySnapshot':'cn-primary-2022-draft.1','juniorGradePolicy':'Stage scope, not prescribed year-by-year timetable. Most new nodes use 7–9; arts retains its 6–7 and 8–9 source bands.',
       'sciencePathways':{'integrated':['science'],'disciplinary':['physics','chemistry','biology'],'policy':'Select according to local curriculum; no equivalence or mandatory combined load asserted. Geography remains a separate subject in this graph.'},
       'artsPolicy':'Grades 7 music/art continue the 6–7 source band. Dance/drama/film in grade 7 are school-conditional. Grades 8–9 are selectable arts strands, not all required.',
       'topicOptions':[{ 'topicId':'mt_cn_'+item['id'],'selection':g.get('selection','stage-framework'), 'sciencePathway':('integrated' if g['source']=='science' else 'disciplinary' if g['source'] in ['physics','chemistry','biology'] else None)} for g in groups if g['grades'][0]>=7 for item in g['items']]})
