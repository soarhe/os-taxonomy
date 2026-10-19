# 中国小学课程知识图谱

> 本页说明冻结的小学独立版。新增初中内容请见[小学及初中贯通版](README.zh-CN.md)。

基于教育部《义务教育课程方案和课程标准（2022年版）》，沿用 Marble 的微知识点、先修关系、课程标准映射、领域聚类四层组织方式。版本：`cn-primary-2022-draft.1`。本版本是 AI 辅助编写、尚未经学科专家审核的结构化初稿，不是教育部发布的知识图谱，也不是课标逐条完整转录。

数据入口：[data/cn-primary](data/cn-primary)。原仓库数据和 schema 保留，便于分别使用和比较。

| 学科 | 知识节点 |
|---|---:|
| 数学 | 90 |
| 科学 | 70 |
| 语文 | 31 |
| 道德与法治 | 25 |
| 艺术 | 21 |
| 英语 | 20 |
| 劳动 | 19 |
| 信息科技 | 16 |
| 体育与健康 | 16 |
| **合计** | **308** |

另有 **380 条依赖关系、77 个领域学段聚类、81 个课标章节定位记录**。81 是项目组织的章节定位数，不代表官方标准条目数或覆盖率。

## 数据组织

| 文件 | 用途 |
|---|---|
| [topics.json](data/cn-primary/topics.json) | 稳定的 `mt_cn_` ID、类型、学科、领域、年龄、描述、可观察证据、评估提示及来源键 |
| [dependencies.json](data/cn-primary/dependencies.json) | `topicId` 依赖 `prerequisiteId`，包含 hard/soft 强度和编写理由 |
| [curriculum-standards.json](data/cn-primary/curriculum-standards.json) | 9 门课标来源及项目章节定位代码，采用 codes-only 格式 |
| [clusters.json](data/cn-primary/clusters.json) | 按学科、领域、起始年龄归组的内容摘要 |
| [provenance.json](data/cn-primary/provenance.json) | 节点年级、原课标学段、PDF 页码、印刷页码、来源 SHA-256、审核状态 |
| [manifest.json](data/cn-primary/manifest.json) | 数量、数据版本、上游版本、文件校验和及范围说明 |

前四个文件遵守上游 schema，扩展信息放入 provenance，避免在核心对象里增加不兼容字段。五种知识点类型保留为 CONCEPTUAL、PROCEDURAL、REPRESENTATIONAL、LANGUAGE、META。

## 课标依据与解释边界

官方入口：[教育部关于印发义务教育课程方案和课程标准（2022年版）的通知](https://www.moe.gov.cn/srcsite/A26/s8001/202204/t20220420_619921.html)。9 份 PDF 的独立链接、校验和和总页数见 [sources.json](authoring/cn-primary/sources.json)。本版本固定采用 2022 年版，不声称已核对截至构建日的全部后续修订。

- 范围是六三学制小学 1—6 年级；英语从 3 年级开始，未纳入可选的低年级预备学习。艺术保留 1—2、3—5、6—7 的原学段信息，仅将第三学段的小学部分编入本图谱。
- 年龄由年级推算（最低年级 +5 至最高年级 +6），是数据兼容约定，不是对儿童发展的诊断或入学年龄规定。
- 课标 PDF 经本地 OCR 辅助阅读；映射以**章节及页码范围**为粒度，尚未经过双人逐条复核。来源页码不是每个自编句子的逐字出处。部分跨年级内容的拆分属于编写判断。
- `S1-*` 等 code 是**项目自编章节定位符**，不是教育部官方条款编号。`textIncluded:false` 表示没有收录原课标正文；节点描述和评估证据是重新组织的表述。
- hard/soft 均为编写者推断，未做专家校准或学习效果验证。hard 表示建议优先掌握的基础，不应用作强制学习门槛；soft 表示有帮助的背景。`centrality:null` 表示未计算或校准。
- 所有节点均为 `pending-subject-expert-review`。本版本适合作为内容审核、检索和教学产品原型的起点。

详细缺口见 [COVERAGE-CN.md](COVERAGE-CN.md)。

## 构建、验证与查询

需要 Python 3.9+ 与支持 `node:test` 的 Node.js 20+；不需要安装第三方依赖。构建过程不访问网络。

```sh
npm run build:cn
npm run validate
npm run validate:cn
npm test
node scripts/query-cn.mjs search 分数
node scripts/query-cn.mjs topic mt_cn_math_fraction_add2
node scripts/query-cn.mjs prerequisites mt_cn_math_fraction_add2
node scripts/query-cn.mjs prerequisites mt_cn_math_fraction_add2 --include-soft
node scripts/query-cn.mjs unlocks mt_cn_math_fraction_add2
```

先用 search 获取实际 ID。先修查询输出去重后的拓扑顺序，默认只包含 hard 边；不涉及学生掌握度判断。

上游校验器检查引用、数量及 SHA-256；中国数据校验器额外检查核心 schema、hard+soft 全图无环、年级范围、来源页码、章节定位及审核元数据。schema 检查器仅支持当前上游四份 schema 使用的关键字，遇到未知关键字报错，不是通用 JSON Schema 引擎。自动检查不等于学科正确性审核。

编写入口是 [compile_records.py](authoring/cn-primary/compile_records.py)，生成 `groups.json` 后，由 [build-cn-primary.py](scripts/build-cn-primary.py) 编译为数据文件。修改流程见 [CONTRIBUTING-CN.md](CONTRIBUTING-CN.md)。

## 署名与许可

本 fork 基于 [withmarbleapp/os-taxonomy](https://github.com/withmarbleapp/os-taxonomy)，保留其署名及许可文件；数据库遵循 ODbL-1.0，自编文字遵循 CC-BY-SA-4.0。中国课程扩展由 soarhe 的 fork 借助 AI 编写。教育部原始课标的权利不因本项目许可而改变；仓库不附带原始 PDF 或整段课标正文。使用时应同时注明本 fork 的数据版本、上游 Marble 项目与官方课标来源。
