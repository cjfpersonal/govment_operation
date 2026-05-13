"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  ApplicantHint,
  DepartmentId,
  PolicyItem,
  PoliciesResponse,
  RiskLevel,
} from "@/lib/types";
import {
  matchPolicies,
  type CompanyProfile,
  type Industry,
} from "@/lib/match";
import { PolicyRiskModal } from "@/components/PolicyRiskModal";

const DEPT_OPTIONS: { id: DepartmentId; short: string }[] = [
  { id: "gxj", short: "工信" },
  { id: "stic", short: "科技" },
  { id: "hrss", short: "人社" },
  { id: "amr", short: "市监" },
  { id: "szgov", short: "市公开" },
];

const SOURCE_CHIP: Record<DepartmentId, string> = {
  gxj: "工信局",
  stic: "科技局",
  hrss: "人社局",
  amr: "市监局",
  szgov: "市政府信息公开",
};

function deptShort(id: DepartmentId): string {
  return DEPT_OPTIONS.find((d) => d.id === id)?.short ?? id;
}

function audienceColor(h: ApplicantHint): string {
  if (h === "个人可办") return "text-cyan-200/90";
  if (h === "企业为主") return "text-violet-200/90";
  return "text-slate-400";
}

function riskLevelStyle(level: RiskLevel): string {
  if (level === "高") return "text-red-300 font-medium";
  if (level === "中") return "text-amber-200 font-medium";
  return "text-slate-400";
}

const KINDS = [
  "申报指南",
  "公示名单",
  "征求意见",
  "政策法规",
  "其他",
] as const;

export function Dashboard() {
  const [data, setData] = useState<PoliciesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [dept, setDept] = useState<DepartmentId | "all">("all");
  const [minScore, setMinScore] = useState(0);
  const [kind, setKind] = useState<(typeof KINDS)[number] | "all">("all");
  const [q, setQ] = useState("");
  const [profile, setProfile] = useState<CompanyProfile>({
    industry: "软件与信息技术",
    isHighTech: false,
    isSmeTech: false,
    employees: "51-300",
  });
  const [audience, setAudience] = useState<"all" | ApplicantHint>("all");
  const [riskItem, setRiskItem] = useState<PolicyItem | null>(null);
  const [riskOpen, setRiskOpen] = useState(false);

  const load = useCallback(async (nocache: boolean) => {
    setLoading(true);
    setErr(null);
    try {
      const url = nocache ? "/api/policies?nocache=1" : "/api/policies";
      const res = await fetch(url);
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error((j as { error?: string }).error || res.statusText);
      }
      const json = (await res.json()) as PoliciesResponse;
      setData(json);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(false);
  }, [load]);

  const baseList = data?.items ?? [];

  const filtered = useMemo(() => {
    let rows = baseList;
    if (dept !== "all") rows = rows.filter((p) => p.department === dept);
    if (kind !== "all") rows = rows.filter((p) => p.kind === kind);
    rows = rows.filter((p) => p.moneyScore >= minScore);
    if (q.trim()) {
      const qq = q.trim().toLowerCase();
      rows = rows.filter((p) => p.title.toLowerCase().includes(qq));
    }
    if (audience !== "all") {
      rows = rows.filter((p) => p.applicantHint === audience);
    }
    rows = matchPolicies(rows, profile);
    return rows;
  }, [baseList, dept, kind, minScore, q, audience, profile]);

  return (
    <div className="mx-auto w-full max-w-[min(100%,96rem)] px-4 py-10 pb-24 sm:px-6 lg:px-8">
      <header className="mb-10 border-b border-[var(--border)] pb-8">
        <p className="text-sm uppercase tracking-widest text-[var(--muted)]">
          Shenzhen · live government listings
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white md:text-4xl">
          深圳政策雷达
        </h1>
        <p className="mt-3 max-w-[min(100%,56rem)] text-[var(--muted)] leading-relaxed">
          数据抓取工信局、科技局、人社局（含社会保险专题）、市市场监管局及深圳市政府信息公开「通知公告」多栏目列表，按标题标注资金信号与「个人 / 企业」粗判。大众常关心的个人补贴、社保待遇、技能提升、求职创业等多出现在人社与市公开栏目；具体对象与材料以官网正文及附件为准。
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void load(true)}
            disabled={loading}
            className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white transition hover:bg-[var(--accent-dim)] disabled:opacity-50"
          >
            {loading ? "同步中…" : "强制刷新（跳过缓存）"}
          </button>
          {data?.meta.fetchedAt && (
            <span className="text-sm text-[var(--muted)]">
              最近拉取：{new Date(data.meta.fetchedAt).toLocaleString("zh-CN")}
            </span>
          )}
        </div>
        {data?.meta.sources && (
          <ul className="mt-4 flex flex-wrap gap-2 text-sm">
            {data.meta.sources.map((s) => (
              <li
                key={s.id}
                className={`rounded-full border px-3 py-1 ${
                  s.ok
                    ? "border-emerald-800/80 bg-emerald-950/40 text-emerald-200"
                    : "border-red-900/80 bg-red-950/40 text-red-200"
                }`}
              >
                {SOURCE_CHIP[s.id]}
                ：{s.ok ? `${s.count} 条` : `失败 ${s.error ?? ""}`}
              </li>
            ))}
          </ul>
        )}
      </header>

      {err && (
        <div className="mb-6 rounded-lg border border-red-900/60 bg-red-950/30 px-4 py-3 text-red-200">
          {err}
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-[1fr_min(22rem,100%)]">
        <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)]/80 p-5 shadow-xl backdrop-blur">
          <h2 className="text-lg font-medium text-white">公告列表</h2>
          <div className="mt-4 flex flex-col gap-4 md:flex-row md:flex-wrap">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-[var(--muted)]">部门</span>
              <select
                className="rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-white"
                value={dept}
                onChange={(e) =>
                  setDept(e.target.value as DepartmentId | "all")
                }
              >
                <option value="all">全部</option>
                {DEPT_OPTIONS.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.short}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-[var(--muted)]">类型</span>
              <select
                className="rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-white"
                value={kind}
                onChange={(e) =>
                  setKind(e.target.value as (typeof KINDS)[number] | "all")
                }
              >
                <option value="all">全部</option>
                {KINDS.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-[var(--muted)]">面向（标题推断）</span>
              <select
                className="rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-white"
                value={audience}
                onChange={(e) =>
                  setAudience(e.target.value as typeof audience)
                }
              >
                <option value="all">全部</option>
                <option value="个人可办">更偏个人（补贴、社保、培训等）</option>
                <option value="企业为主">更偏企业申报</option>
                <option value="不限">不限/难区分</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-[var(--muted)]">最低资金信号分</span>
              <input
                type="number"
                min={0}
                max={50}
                className="w-28 rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-white"
                value={minScore}
                onChange={(e) => setMinScore(Number(e.target.value) || 0)}
              />
            </label>
            <label className="flex min-w-[200px] flex-1 flex-col gap-1 text-sm">
              <span className="text-[var(--muted)]">标题搜索</span>
              <input
                className="rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-white placeholder:text-slate-600"
                placeholder="例如：训力券、技改、稳岗"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </label>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[min(100%,56rem)] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-[var(--muted)]">
                  <th className="py-2 pr-3 font-medium">日期</th>
                  <th className="py-2 pr-3 font-medium">部门</th>
                  <th className="py-2 pr-3 font-medium">标题</th>
                  <th className="py-2 pr-3 font-medium">面向</th>
                  <th className="py-2 pr-3 font-medium">风险</th>
                  <th className="py-2 pr-3 font-medium">信号</th>
                  <th className="py-2 pr-3 font-medium">类型</th>
                  <th className="py-2 font-medium">解析</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr
                    key={p.url}
                    className="border-b border-[var(--border)]/60 hover:bg-white/5"
                  >
                    <td className="whitespace-nowrap py-2.5 pr-3 text-[var(--muted)]">
                      {p.publishedAt ?? "—"}
                    </td>
                    <td className="whitespace-nowrap py-2.5 pr-3 text-sky-200/90">
                      {deptShort(p.department)}
                    </td>
                    <td className="py-2.5 pr-3">
                      <a
                        href={p.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-300 hover:underline"
                      >
                        {p.title}
                      </a>
                    </td>
                    <td className={`whitespace-nowrap py-2.5 pr-3 text-xs ${audienceColor(p.applicantHint)}`}>
                      {p.applicantHint}
                    </td>
                    <td className={`whitespace-nowrap py-2.5 pr-3 text-sm ${riskLevelStyle(p.riskLevel)}`}>
                      {p.riskLevel}
                    </td>
                    <td className="max-w-[min(100%,20rem)] py-2.5 pr-3 text-xs text-amber-200/90">
                      {p.moneySignals.length ? p.moneySignals.join("、") : "—"}
                    </td>
                    <td className="whitespace-nowrap py-2.5 pr-3 text-[var(--muted)]">
                      {p.kind}
                    </td>
                    <td className="py-2.5">
                      <button
                        type="button"
                        onClick={() => {
                          setRiskItem(p);
                          setRiskOpen(true);
                        }}
                        className="whitespace-nowrap rounded-md border border-violet-800/80 bg-violet-950/40 px-2 py-1 text-xs text-violet-200 hover:bg-violet-900/50"
                      >
                        解析评估
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!loading && filtered.length === 0 && (
              <p className="py-8 text-center text-[var(--muted)]">无匹配条目</p>
            )}
          </div>
        </section>

        <aside className="space-y-6">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)]/80 p-5">
            <h2 className="text-lg font-medium text-white">谁能拿（粗匹配）</h2>
            <p className="mt-2 text-xs leading-relaxed text-[var(--muted)]">
              行业、资质勾选会<strong className="text-slate-400">实时</strong>
              筛选左侧列表并重排。勾选「高新」或「科中小」时，只保留标题中含对应关键词的公告；两者都勾选则
              <strong className="text-slate-400">满足其一</strong>
              即显示。不能替代政策原文。
            </p>
            <label className="mt-4 flex flex-col gap-1 text-sm">
              <span className="text-[var(--muted)]">行业</span>
              <select
                className="rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-white"
                value={profile.industry}
                onChange={(e) =>
                  setProfile((p) => ({
                    ...p,
                    industry: e.target.value as Industry,
                  }))
                }
              >
                {(
                  [
                    "制造业",
                    "软件与信息技术",
                    "生物医药",
                    "批发零售/商贸",
                    "其他",
                  ] as Industry[]
                ).map((i) => (
                  <option key={i} value={i}>
                    {i}
                  </option>
                ))}
              </select>
            </label>
            <div className="mt-3 space-y-2 text-sm">
              <label className="flex items-center gap-2 text-[var(--text)]">
                <input
                  type="checkbox"
                  checked={!!profile.isHighTech}
                  onChange={(e) =>
                    setProfile((p) => ({ ...p, isHighTech: e.target.checked }))
                  }
                />
                高新技术企业
              </label>
              <label className="flex items-center gap-2 text-[var(--text)]">
                <input
                  type="checkbox"
                  checked={!!profile.isSmeTech}
                  onChange={(e) =>
                    setProfile((p) => ({ ...p, isSmeTech: e.target.checked }))
                  }
                />
                科技型中小企业
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[var(--muted)]">员工规模</span>
                <select
                  className="rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-white"
                  value={profile.employees}
                  onChange={(e) =>
                    setProfile((p) => ({
                      ...p,
                      employees: e.target.value as CompanyProfile["employees"],
                    }))
                  }
                >
                  <option value="1-50">1–50</option>
                  <option value="51-300">51–300</option>
                  <option value="300+">300 以上</option>
                </select>
              </label>
            </div>
          </div>

          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)]/80 p-5 text-sm text-[var(--muted)] leading-relaxed">
            <h3 className="font-medium text-white">怎么申请</h3>
            <ol className="mt-3 list-decimal space-y-2 pl-4">
              <li>点击标题跳转官网原文，查找附件中的申报指南、资金表与材料清单。</li>
              <li>确认申报主体、时间窗口、系统入口（如科技业务管理系统）。</li>
              <li>资金类通知常含「专项资金」「拟资助公示」等词，公示类多为结果而非新窗口。</li>
            </ol>
            <h3 className="mt-5 font-medium text-white">个人 / 大众资质与待遇</h3>
            <p className="mt-2">
              真正「门槛不高、面向自然人」的多集中在人社（补贴公示、社保专题）及市政府信息公开中民政、教育、住建等部门通知，例如职业技能提升补贴、求职创业补贴、各类待遇发放公示等；市监局栏目多为监管通报与食品/特种设备许可类公告，是否与您相关需看正文。
            </p>
            <p className="mt-2">
              没有统一「全民资质证」：常见是个人参加国家职业资格或技能等级评价、按条件申领补贴或享受社保待遇，以当年指南为准。
            </p>
          </div>
        </aside>
      </div>

      <footer className="mt-16 border-t border-[var(--border)] pt-8 text-center text-xs text-[var(--muted)]">
        非政府网站；不存储正文；请以各链接指向的 gxj / stic / hrss / amr / sz.gov.cn 官网发布为准。
      </footer>

      <PolicyRiskModal
        item={riskItem}
        open={riskOpen}
        onClose={() => {
          setRiskOpen(false);
          setRiskItem(null);
        }}
      />
    </div>
  );
}
