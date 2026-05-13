import type { ApplicantHint } from "./types";

/** 仅从标题推断申报主体倾向，不能替代正文中的申报对象条款 */
export function inferApplicantHint(title: string): ApplicantHint {
  const person =
    /个人|劳动者|居民|灵活就业|参保人|城乡居民|高校毕业生|毕业生|失业(?:保险|登记)|求职创业|生活补贴|博士人才|新引进博士|职业技能提升|技能提升|职业培训|培训补贴|证书|资格(考试|认定)|社会工作者|公证|律师|遗嘱|养老待遇|医保|生育保险|社保卡|轮候|公租房|保障性住房|公积金提取|技能评价补贴|评价补贴|见习|家政|公益性岗位/.test(
      title,
    );
  const enterprise =
    /企业|用人单位|公司|规模以上|工业企业|产业园区|专精特新|高新技术企|高企|科技型中小|技改|工业互联网|产业链|项目申报指南|训力券|产业用房|扩岗补助|劳务派遣/.test(
      title,
    );
  if (person && !enterprise) return "个人可办";
  if (enterprise && !person) return "企业为主";
  return "不限";
}
