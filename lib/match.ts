import type { PolicyItem } from "./types";

export type Industry =
  | "制造业"
  | "软件与信息技术"
  | "生物医药"
  | "批发零售/商贸"
  | "其他";

export interface CompanyProfile {
  industry: Industry;
  /** 是否高新技术企业 */
  isHighTech?: boolean;
  /** 是否科技型中小企业 */
  isSmeTech?: boolean;
  /** 员工规模 */
  employees?: "1-50" | "51-300" | "300+";
}

const INDUSTRY_TITLE_PATTERNS: Record<Industry, RegExp[]> = {
  制造业: [/制造|工业|技改|设备|智能工厂|专精特新|产业链/],
  软件与信息技术: [
    /软件|信息|数字化|工业互联网|人工智能|AI|训力券|算力|网络|数据|云计算|网信|智能化|研发|算法/,
  ],
  生物医药: [/生物|医药|医疗器械|合成生物/],
  "批发零售/商贸": [/电商|外贸|展会|商贸|零售/],
  其他: [],
};

/** 非投资建议：用标题关键词做粗筛，具体以正文与申报指南为准 */
export function matchPolicies(
  items: PolicyItem[],
  profile: CompanyProfile,
): PolicyItem[] {
  const patterns = INDUSTRY_TITLE_PATTERNS[profile.industry];
  const industryMatch = (title: string) =>
    profile.industry === "其他" ||
    patterns.some((re) => re.test(title));

  const credentialMatch = (title: string) => {
    const needH = !!profile.isHighTech;
    const needS = !!profile.isSmeTech;
    const h = /高新|高企/.test(title);
    const s = /科技型中小企业|科技型中小|科技型中小微企业|科技型中小微|科技型/.test(
      title,
    );
    if (needH && needS) return h || s;
    if (needH) return h;
    if (needS) return s;
    return true;
  };

  const boost = (title: string) => {
    let s = 0;
    if (profile.isHighTech && /高新|高企/.test(title)) s += 2;
    if (
      profile.isSmeTech &&
      /科技型中小企业|科技型中小|科技型中小微企业|科技型中小微|科技型/.test(title)
    ) {
      s += 2;
    }
    if (profile.employees === "1-50" && /创业|就业|岗|培训|技能/.test(title))
      s += 1;
    if (profile.employees === "300+" && /稳岗|返还|规模/.test(title)) s += 1;
    return s;
  };

  return items
    .filter((p) => industryMatch(p.title))
    .filter((p) => credentialMatch(p.title))
    .map((p) => ({
      ...p,
      moneyScore: p.moneyScore + boost(p.title),
    }))
    .sort(
      (a, b) =>
        b.moneyScore - a.moneyScore ||
        (b.publishedAt || "").localeCompare(a.publishedAt || ""),
    );
}
