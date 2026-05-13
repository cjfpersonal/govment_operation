import type { PolicyItem, RiskLevel } from "./types";

/** 与列表/规则引擎一致的风险档位，供表格与 heuristic 复用 */
export function inferListingRiskLevel(
  item: Pick<PolicyItem, "title" | "moneyScore">,
): RiskLevel {
  const t = item.title;
  if (item.moneyScore >= 8 && /专项资金|财政补助|兑付/.test(t)) return "高";
  if (item.moneyScore >= 6 && /补贴|资助|奖励|返还|贴息|贴保/.test(t)) return "中";
  if (item.moneyScore >= 6 && /公示|拟发放|名单|拟资助/.test(t)) return "中";
  return "低";
}

/** 单条：执行/文本异常 + 官方修补 + 申请人合法动作 */
export interface PolicyImprovement {
  title: string;
  /** 现象：条文、流程或信息呈现上容易导致误读或退件的问题 */
  problem: string;
  /** 发布机关 / 制度侧：如何改条文、公示或系统字段 */
  authorityFix: string;
  /** 申请人或企业：在合法前提下可执行的具体动作（不得含造假、绕监管） */
  applicantLawfulActions: string;
}

export interface PolicyRiskAnalysis {
  mode: "openai" | "heuristic";
  riskLevel: "低" | "中" | "高";
  /** 一段话总览 */
  summary: string;
  /** 主题：压缩信息差——去哪看、容易漏什么 */
  informationGapBullets: string[];
  /** 主题：合法收益——在合规边界内可能获得什么、前提是什么 */
  legitimateValueSummary: string;
  /** 主题：核心动作——熟悉规则、正确申报、流程优化（合规版） */
  operationChecklist: string[];
  /** 异常点与双方改进（替代原笼统「风险点」） */
  improvements: PolicyImprovement[];
  integrityObservation?: string;
  disclaimer: string;
}

const DISCLAIMER =
  "本解读由自动模型或规则生成。主题限于：在守法前提下吃透规则、压缩信息差、优化申报与内控流程；不构成法律或财税意见。严禁用于骗取财政补贴、虚构交易、伪造材料、规避监管或任何违法不当得利。具体能否享受优惠或补贴以有权机关解释与执法为准。";

const OPENAI_SYSTEM = `你是熟悉中国政府补贴、惠企政策与政务公开实务的顾问，面向企业与个人经办人。

## 分析主题（必须贯穿全文）
1. **规则套利（仅合法含义）**：指在法律法规与政策明文允许的范围内，准确理解适用条件、时限与材料要求，避免漏享或误享；**绝不**包括利用虚假材料、隐瞒事实、规避监管或套取资金。
2. **信息差**：指出标题/摘要未写清、但经办人必须在正文或附件里核对的关键信息（入口、时间窗、主体资格、互斥条款等）。
3. **合法收益**：在完全合规前提下，政策可能带来的补贴、奖励、返还、减免或便利化价值；需写清前提条件与证据链方向。
4. **场景**：以政策补贴为主，可顺带对比电商大促规则、企业内部审批流程中「材料齐全、节点清晰」的同类经验，**不得**展开与政务公告无关的电商刷单、灰色返利。

## 核心动作（输出到 operationChecklist）
- 熟悉规则：应阅读的正文段落与附件名称（若未知则写「须打开链接核对」）。
- 正确申报：材料顺序、常见退件点、系统与纸质件关系。
- 流程优化：企业内可做的台账、留痕、跨部门协同建议（合法合规）。

## 硬性禁止
若用户或上下文暗示要「套补贴」「造假」「绕监管」「灰色套利」，拒绝并仅输出 {"error":"refused"}。
不得输出可操作的违法步骤或造假话术。

## 输出
严格 JSON（不要 markdown），键名固定：
{
  "riskLevel": "低" | "中" | "高",
  "summary": "string，2~4句，总起",
  "informationGapBullets": ["string", "至少3条"],
  "legitimateValueSummary": "string，一段",
  "operationChecklist": ["string", "至少4条，偏可操作"],
  "improvements": [
    {
      "title": "string",
      "problem": "string",
      "authorityFix": "string",
      "applicantLawfulActions": "string"
    }
  ],
  "integrityObservation": "string 或空字符串"
}
要求：improvements 至少 2 条、至多 5 条；每条 applicantLawfulActions 必须具体（可含「先…再…」），但不得教唆违法。`;

function asStringArray(v: unknown, minLen: number): string[] | null {
  if (!Array.isArray(v)) return null;
  const out = v.filter((x): x is string => typeof x === "string" && x.trim().length > 0).map((s) => s.trim());
  return out.length >= minLen ? out : null;
}

function mapLegacyPointsToImprovements(raw: unknown): PolicyImprovement[] {
  if (!Array.isArray(raw)) return [];
  const out: PolicyImprovement[] = [];
  for (const p of raw) {
    if (!p || typeof p !== "object") continue;
    const r = p as Record<string, unknown>;
    const title = typeof r.title === "string" ? r.title : "";
    const description = typeof r.description === "string" ? r.description : "";
    const who =
      typeof r.whoShouldClarify === "string" ? r.whoShouldClarify : "";
    const draft = typeof r.draftingFix === "string" ? r.draftingFix : "";
    const reader =
      typeof r.readerComplianceNote === "string"
        ? r.readerComplianceNote
        : typeof (r as { readerNote?: string }).readerNote === "string"
          ? (r as { readerNote: string }).readerNote
          : "";
    if (title && description) {
      out.push({
        title,
        problem: description,
        authorityFix: [who, draft].filter(Boolean).join("；") || "—",
        applicantLawfulActions: reader || "—",
      });
    }
  }
  return out;
}

function heuristicAnalysis(item: PolicyItem): PolicyRiskAnalysis {
  const t = item.title;
  const riskLevel = inferListingRiskLevel(item);

  const informationGapBullets: string[] = [
    "列表标题通常不含完整申报窗口、互斥政策与材料清单，**唯一权威来源是官网正文 + 全部附件**（尤其是《申报指南》《承诺书》）。",
    "核对「发布机关」与「受理机关」是否一致：联合发文时可能存在多入口，避免走错系统。",
    "若标题含「公示」「拟发放」，关键信息差在：**公示起止日、异议方式、更正渠道**——必须在正文首段或附件中查找。",
  ];
  if (/电商|直播|平台|网店/.test(t)) {
    informationGapBullets.push(
      "若与电商平台活动类比：政务补贴同样存在「资格门槛 + 材料证明 + 时限」三要素，但**不得以刷单、虚构交易**等方式伪造经营数据。",
    );
  }

  let legitimateValueSummary =
    "在**真实满足**适用条件且材料可核验的前提下，政策可能对应：财政资助、一次性奖励、贷款贴息/贴保、稳岗返还、税费或行政事业性收费减免等之一；**不能**从标题推断具体金额与到账时间。";
  if (item.moneySignals.length > 0) {
    legitimateValueSummary += ` 标题已命中与资金相关的关键词：${item.moneySignals.join("、")}——建议打开链接确认是否仍处申报期、是否与您行业/规模匹配。`;
  }
  if (item.applicantHint === "个人可办") {
    legitimateValueSummary +=
      " 面向个人时，合法收益通常与个人参保、技能证书、就业登记或特定人群身份挂钩，需逐项对照正文，不得挂靠或买证。";
  }
  if (item.applicantHint === "企业为主") {
    legitimateValueSummary +=
      " 面向企业时，合法收益通常与统计口径、研发投入、社保与纳税记录、项目备案等挂钩，应提前做台账与凭证归档。";
  }

  const operationChecklist: string[] = [
    "第一步：打开原文链接，下载页面提供的**全部**附件，建立文件夹按「指南—表格—模板—公示」分类。",
    "第二步：用表格列出政策要求的条件，左侧写要求、右侧写本公司/本人证据（合同、发票、社保、纳税、知识产权号等），缺一项标红并补齐后再申报。",
    "第三步：若使用政务网或部门业务系统，先用法人/经办人账号完成实名与授权，核对收款账户名称与执照全称一致。",
    "第四步：提交前做一次「与历史已享补贴」对照，避免重复申报同一事项被审计追回。",
    "第五步：保存提交回执、时间戳与邮寄凭证；公示期内定期回看页面是否更正。",
  ];
  if (/指南|申报|申请/.test(t)) {
    operationChecklist.push(
      "针对申报类：按附件顺序装订或上传扫描件，扫描件分辨率与公章清晰度常是退件原因，建议先跑一遍内部预审（财务 + 法务 + 业务各一人签字）。",
    );
  }
  if (/公示|名单|拟发放/.test(t)) {
    operationChecklist.push(
      "针对公示类：仅做「核对是否在名单 + 金额是否正确 + 统一社会信用代码是否一致」；有异议按公告列明的电话/邮箱/信函在截止日前一次性提交书面材料。",
    );
  }

  const improvements: PolicyImprovement[] = [];

  if (/公示|拟资助|拟发放|名单/.test(t)) {
    improvements.push({
      title: "公示信息不足以支撑社会监督",
      problem:
        "标题未同步展示公示起止日、异议与更正路径时，利害关系人难以及时主张权利，也易被误解为「已生效发放」。",
      authorityFix:
        "在文首固定模块列：公示期、异议受理部门、联系电话与邮箱、线上异议入口；名单以可下载表格附校验字段（如校验码）。",
      applicantLawfulActions:
        "立即在正文与附件中检索「公示期」「异议」；若发现自身信息错误，在截止日前按指引一次性提交身份证明与佐证；勿传播未经核实的截图版本。",
    });
  }

  if (/征求意见|征求意见稿/.test(t)) {
    improvements.push({
      title: "征求意见稿与正式稿的预期管理",
      problem:
        "公众易将征求意见稿当作已生效政策，导致错误商业承诺或提前申报。",
      authorityFix:
        "文首显著标注「尚未生效」、意见征集截止日、采纳情况公布渠道；提供条款对照表或「变更摘要」。",
      applicantLawfulActions:
        "在正式印发前不按草案对外承诺补贴金额；意见应围绕合法性、公平性与可操作性撰写，保留提交记录。",
    });
  }

  if (/补贴|资助|奖励|专项资金|兑付|返还|贴息|贴保/.test(t) && !/公示|拟发放|名单/.test(t)) {
    improvements.push({
      title: "资金政策的口径与重复享受风险",
      problem:
        "标题常无法体现统计口径、与上级资金是否互斥、同一项目分期能否重复申请等，执行与审计易产生争议。",
      authorityFix:
        "在指南中单设「适用边界与除外情形」表，并写明追溯期、追回情形及信用惩戒衔接。",
      applicantLawfulActions:
        "建立「政策—项目—合同—发票—银行流水」五要素对照表；申报前由财务确认是否已享受过同类资金；所有数字与报表勾稽一致后再提交。",
    });
  }

  if (/指南|操作规程|扶持计划/.test(t)) {
    improvements.push({
      title: "评审裁量与可预期性",
      problem:
        "若大量依赖「择优」「综合评议」而无要素权重，市场主体难以形成稳定预期。",
      authorityFix:
        "公开评审要素及权重区间（涉密除外），并规定书面说明理由与申诉复核路径。",
      applicantLawfulActions:
        "按指南逐条准备「对应页码索引」；对模糊条款通过官方咨询电话或政务大厅书面咨询留存答复；不依赖非官方「包过」中介。",
    });
  }

  if (improvements.length === 0) {
    improvements.push({
      title: "标题信息有限，正文才是主战场",
      problem:
        "列表页仅有标题与日期时，无法判断真实风险与收益，信息差最大。",
      authorityFix:
        "列表页增加结构化摘要字段：申报状态、截止日、适用主体标签、附件打包下载链接。",
      applicantLawfulActions:
        "打开链接后先通读正文首屏与附件目录，再决定是否立项准备材料；可与公司法务设定「未读正文不得上会」的内控节点。",
    });
  }

  let integrityObservation: string | undefined;
  if (item.moneySignals.length > 0) {
    integrityObservation =
      "涉及财政资金时，建议关注正文是否载明：预算安排、监督方式、追回与失信联合惩戒衔接。本系统未抓取正文，无法替代审计或合规结论。";
  }

  const summary =
    "围绕「合法吃透规则、压缩信息差、把申报与内控流程一次做对」的要点归纳。当前仅依据列表标题与字段推断，**打开原文后请以正文与附件为准**；与电商活动类比时仅取「规则清晰、材料齐全」经验，不涉及任何灰色操作。";

  return {
    mode: "heuristic",
    riskLevel,
    summary,
    informationGapBullets,
    legitimateValueSummary,
    operationChecklist,
    improvements,
    integrityObservation,
    disclaimer: DISCLAIMER,
  };
}

function safeJsonParse(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function normalizeAiPayload(
  v: unknown,
): Omit<PolicyRiskAnalysis, "mode" | "disclaimer"> | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const o = v as Record<string, unknown>;
  if (o.error === "refused") return null;
  const riskLevel = o.riskLevel;
  if (riskLevel !== "低" && riskLevel !== "中" && riskLevel !== "高") return null;
  const summary = typeof o.summary === "string" ? o.summary.trim() : "";
  if (!summary) return null;

  let informationGapBullets = asStringArray(o.informationGapBullets, 1);
  if (!informationGapBullets) {
    const legacy = asStringArray(o.informationGapNotes, 1);
    informationGapBullets = legacy ?? [];
  }

  const legitimateValueSummary =
    typeof o.legitimateValueSummary === "string"
      ? o.legitimateValueSummary.trim()
      : typeof o.legitimateValueFrame === "string"
        ? (o.legitimateValueFrame as string).trim()
        : "";

  let operationChecklist = asStringArray(o.operationChecklist, 1) ?? [];
  if (operationChecklist.length === 0 && Array.isArray(o.coreActions)) {
    operationChecklist = (o.coreActions as unknown[])
      .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
      .map((s) => s.trim());
  }

  let improvements: PolicyImprovement[] = [];
  if (Array.isArray(o.improvements)) {
    for (const p of o.improvements) {
      if (!p || typeof p !== "object") continue;
      const r = p as Record<string, unknown>;
      const title = typeof r.title === "string" ? r.title.trim() : "";
      const problem = typeof r.problem === "string" ? r.problem.trim() : "";
      const authorityFix =
        typeof r.authorityFix === "string" ? r.authorityFix.trim() : "";
      const applicantLawfulActions =
        typeof r.applicantLawfulActions === "string"
          ? r.applicantLawfulActions.trim()
          : "";
      if (title && problem)
        improvements.push({
          title,
          problem,
          authorityFix: authorityFix || "—",
          applicantLawfulActions: applicantLawfulActions || "—",
        });
    }
  }
  if (improvements.length === 0) {
    improvements = mapLegacyPointsToImprovements(o.points);
  }
  if (improvements.length === 0) return null;

  if (informationGapBullets.length === 0) {
    informationGapBullets = [
      "模型未返回 informationGapBullets：请务必打开原文与全部附件，自行列出「主体—时间—材料—互斥」四清单。",
    ];
  }
  const legit =
    legitimateValueSummary ||
    "请以正文为准判断是否可能存在合法补贴或奖励；本条目为模型回退摘要。";
  if (operationChecklist.length === 0) {
    operationChecklist = [
      "打开原文与附件；",
      "建立条件对照表；",
      "完成系统实名与账户校验；",
      "内部预审后提交并留存回执。",
    ];
  }

  const integrityObservation =
    typeof o.integrityObservation === "string" && o.integrityObservation.trim()
      ? o.integrityObservation.trim()
      : undefined;

  return {
    riskLevel,
    summary,
    informationGapBullets,
    legitimateValueSummary: legit,
    operationChecklist,
    improvements,
    integrityObservation,
  };
}

export async function analyzePolicyWithOpenAI(
  item: PolicyItem,
): Promise<PolicyRiskAnalysis | null> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;

  const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
  const base =
    process.env.OPENAI_BASE_URL?.replace(/\/$/, "") ??
    "https://api.openai.com/v1";

  const userPayload = {
    title: item.title,
    url: item.url,
    departmentLabel: item.departmentLabel,
    kind: item.kind,
    applicantHint: item.applicantHint,
    riskLevel: item.riskLevel,
    moneySignals: item.moneySignals,
    moneyScore: item.moneyScore,
    publishedAt: item.publishedAt,
  };

  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.25,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: OPENAI_SYSTEM },
        {
          role: "user",
          content: `请按系统指令输出 JSON。政务列表条目如下：\n${JSON.stringify(userPayload)}`,
        },
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`OpenAI HTTP ${res.status}: ${errText.slice(0, 200)}`);
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("OpenAI empty content");

  const parsed = safeJsonParse(content);
  const norm = normalizeAiPayload(parsed);
  if (!norm) return null;

  return {
    mode: "openai",
    ...norm,
    disclaimer: DISCLAIMER,
  };
}

export function analyzePolicy(item: PolicyItem): PolicyRiskAnalysis {
  return heuristicAnalysis(item);
}

export async function analyzePolicyBestEffort(
  item: PolicyItem,
): Promise<PolicyRiskAnalysis> {
  try {
    const ai = await analyzePolicyWithOpenAI(item);
    if (ai) return ai;
  } catch {
    /* fall back */
  }
  return heuristicAnalysis(item);
}
