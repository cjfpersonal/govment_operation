export type DepartmentId = "gxj" | "stic" | "hrss" | "amr" | "szgov";

/** 标题粗判谁更可能去办（个人 / 企业 / 两者都可能） */
export type ApplicantHint = "个人可办" | "企业为主" | "不限";

/** 列表页启发式风险档位（与规则引擎一致，非弹窗内大模型结论） */
export type RiskLevel = "低" | "中" | "高";

export type PolicyKind =
  | "申报指南"
  | "公示名单"
  | "征求意见"
  | "政策法规"
  | "其他";

export interface PolicyItem {
  id: string;
  title: string;
  url: string;
  publishedAt: string | null;
  department: DepartmentId;
  departmentLabel: string;
  /** 标题命中资金相关关键词 */
  moneySignals: string[];
  moneyScore: number;
  /** 粗分类 */
  kind: PolicyKind;
  /** 从标题推断的申报主体倾向 */
  applicantHint: ApplicantHint;
  /** 列表启发式风险等级 */
  riskLevel: RiskLevel;
}

export interface SyncMeta {
  fetchedAt: string;
  sources: { id: DepartmentId; ok: boolean; error?: string; count: number }[];
}

export interface PoliciesResponse {
  meta: SyncMeta;
  items: PolicyItem[];
}
