import type { PolicyKind } from "./types";

/** 标题关键词：越高价值倾向「有钱 / 可申报」 */
const MONEY_KEYWORDS: { word: string; weight: number; label: string }[] = [
  { word: "兑付", weight: 5, label: "兑付" },
  { word: "专项资金", weight: 4, label: "专项资金" },
  { word: "财政补助", weight: 4, label: "财政补助" },
  { word: "奖励资金", weight: 4, label: "奖励资金" },
  { word: "资助", weight: 3, label: "资助" },
  { word: "补贴", weight: 3, label: "补贴" },
  { word: "贴息", weight: 3, label: "贴息" },
  { word: "贴保", weight: 3, label: "贴保" },
  { word: "补助", weight: 3, label: "补助" },
  { word: "奖励", weight: 3, label: "奖励" },
  { word: "扶持", weight: 2, label: "扶持" },
  { word: "后补助", weight: 3, label: "后补助" },
  { word: "申报指南", weight: 3, label: "申报指南" },
  { word: "申请指南", weight: 3, label: "申请指南" },
  { word: "项目申报", weight: 2, label: "项目申报" },
  { word: "拟资助", weight: 3, label: "拟资助" },
  { word: "拟发放", weight: 3, label: "拟发放" },
  { word: "稳岗", weight: 2, label: "稳岗" },
  { word: "返还", weight: 2, label: "返还" },
  { word: "生活补贴", weight: 3, label: "生活补贴" },
  { word: "技能提升", weight: 3, label: "技能提升" },
  { word: "职业培训", weight: 2, label: "职业培训" },
  { word: "培训补贴", weight: 3, label: "培训补贴" },
  { word: "证书", weight: 1, label: "证书" },
  { word: "资格认定", weight: 2, label: "资格认定" },
  { word: "求职创业", weight: 3, label: "求职创业" },
];

export function scoreTitle(title: string): { score: number; signals: string[] } {
  let score = 0;
  const signals: string[] = [];
  for (const { word, weight, label } of MONEY_KEYWORDS) {
    if (title.includes(word)) {
      score += weight;
      if (!signals.includes(label)) signals.push(label);
    }
  }
  return { score, signals };
}

export function classifyKind(title: string): PolicyKind {
  if (/征求意见|征求意见稿|公开征求/.test(title)) return "征求意见";
  if (/公示|拟资助|拟发放|名单/.test(title)) return "公示名单";
  if (/申报指南|申请指南|操作规程|扶持计划/.test(title)) return "申报指南";
  if (/办法|规定|措施|通知$|印发|通告$/.test(title)) return "政策法规";
  return "其他";
}
