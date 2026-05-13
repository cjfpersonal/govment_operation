import * as cheerio from "cheerio";
import type { DepartmentId, PolicyItem } from "./types";
import { inferApplicantHint } from "./applicant-hint";
import { inferListingRiskLevel } from "./policy-risk-analysis";
import { classifyKind, scoreTitle } from "./money-signals";
import { fetchHtml } from "./fetch-html";

type RawListing = Omit<
  PolicyItem,
  "department" | "departmentLabel" | "applicantHint" | "riskLevel"
>;

function stableId(url: string): string {
  const m = url.match(/post_(\d+)\.html/);
  return m ? m[1] : Buffer.from(url).toString("base64url").slice(0, 24);
}

function normalizeTitle(titleAttr: string | undefined, text: string): string {
  const t = (titleAttr?.trim() || text.replace(/\s+/g, " ").trim()).replace(
    /^[\d\s.、]+/,
    "",
  );
  return t;
}

/** 如 2026年05月11日 → 2026-05-11 */
function normalizeCnDate(raw: string): string | null {
  const m = raw.trim().match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
  if (!m) return null;
  const y = m[1];
  const mo = m[2].padStart(2, "0");
  const d = m[3].padStart(2, "0");
  return `${y}-${mo}-${d}`;
}

function parseStic(html: string): RawListing[] {
  const $ = cheerio.load(html);
  const out: RawListing[] = [];
  const seen = new Set<string>();

  $('a[href*="stic.sz.gov.cn/xxgk/tzgg/content/post_"]').each((_, el) => {
    const a = $(el);
    const href = a.attr("href");
    if (!href || !href.includes("/xxgk/tzgg/content/post_")) return;
    const url = href.startsWith("http")
      ? href
      : `https:${href.replace(/^\/\//, "https://")}`;
    if (seen.has(url)) return;
    seen.add(url);
    const title = normalizeTitle(a.attr("title"), a.text());
    if (!title || title.length < 6) return;
    const span = a.next("span").text().trim();
    const publishedAt = /^\d{4}-\d{2}-\d{2}$/.test(span) ? span : null;
    const { score, signals } = scoreTitle(title);
    out.push({
      id: stableId(url),
      title,
      url,
      publishedAt,
      moneySignals: signals,
      moneyScore: score,
      kind: classifyKind(title),
    });
  });
  return out;
}

function parseGxj(html: string): RawListing[] {
  const $ = cheerio.load(html);
  const out: RawListing[] = [];
  const seen = new Set<string>();

  $('a[href*="gxj.sz.gov.cn"][href*="/tzgg/content/post_"]').each((_, el) => {
    const a = $(el);
    const href = a.attr("href");
    if (!href?.includes("post_")) return;
    const url = href.startsWith("http") ? href : `https:${href}`;
    if (seen.has(url)) return;
    seen.add(url);
    const title = normalizeTitle(a.attr("title"), a.text().replace(/^\d+/, ""));
    if (!title || title.length < 6) return;
    const prev = a.prev("span").text().trim();
    const publishedAt = /^\d{4}-\d{2}-\d{2}$/.test(prev) ? prev : null;
    const { score, signals } = scoreTitle(title);
    out.push({
      id: stableId(url),
      title,
      url,
      publishedAt,
      moneySignals: signals,
      moneyScore: score,
      kind: classifyKind(title),
    });
  });
  return out;
}

function parseHrss(html: string): RawListing[] {
  const $ = cheerio.load(html);
  const out: RawListing[] = [];
  const seen = new Set<string>();

  $('a[href*="hrss.sz.gov.cn"][href*="/tzgg/content/post_"]').each((_, el) => {
    const a = $(el);
    const href = a.attr("href");
    if (!href?.includes("post_")) return;
    const url = href.startsWith("http") ? href : `https:${href}`;
    if (seen.has(url)) return;
    seen.add(url);
    const title = normalizeTitle(a.attr("title"), a.text());
    if (!title || title.length < 6) return;
    const prev = a.prev("span").text().trim();
    const publishedAt = /^\d{4}-\d{2}-\d{2}$/.test(prev) ? prev : null;
    const { score, signals } = scoreTitle(title);
    out.push({
      id: stableId(url),
      title,
      url,
      publishedAt,
      moneySignals: signals,
      moneyScore: score,
      kind: classifyKind(title),
    });
  });
  return out;
}

/** 市监局：列表为 li > a > h3 + p(发布日期) */
function parseAmr(html: string): RawListing[] {
  const $ = cheerio.load(html);
  const out: RawListing[] = [];
  const seen = new Set<string>();

  $('a[href*="amr.sz.gov.cn"][href*="/tzgg/content/post_"]').each((_, el) => {
    const a = $(el);
    const href = a.attr("href");
    if (!href?.includes("post_")) return;
    const url = href.startsWith("http") ? href : `https:${href}`;
    if (seen.has(url)) return;
    seen.add(url);
    const title = a.find("h3").first().text().trim() || normalizeTitle(a.attr("title"), a.text());
    if (!title || title.length < 6) return;
    const p = a.find("p").first().text();
    const dm = p.match(/发布日期[：:\s]*(\d{4}-\d{2}-\d{2})/);
    const publishedAt = dm ? dm[1] : null;
    const { score, signals } = scoreTitle(title);
    out.push({
      id: stableId(url),
      title,
      url,
      publishedAt,
      moneySignals: signals,
      moneyScore: score,
      kind: classifyKind(title),
    });
  });
  return out;
}

/** 市政府信息公开：多部门汇总 */
function parseSzGov(html: string): RawListing[] {
  const $ = cheerio.load(html);
  const out: RawListing[] = [];
  const seen = new Set<string>();

  $('a[href*="sz.gov.cn/cn/xxgk/zfxxgj/tzgg/content/post_"]').each((_, el) => {
    const a = $(el);
    const href = a.attr("href");
    if (!href?.includes("post_")) return;
    const url = href.startsWith("http") ? href : `https:${href}`;
    if (seen.has(url)) return;
    seen.add(url);
    const title = normalizeTitle(a.attr("title"), a.text());
    if (!title || title.length < 6) return;
    const li = a.closest("li");
    let publishedAt: string | null = null;
    li.find("span").each((_, sp) => {
      const t = $(sp).text().trim();
      const n = normalizeCnDate(t);
      if (n) publishedAt = n;
    });
    const { score, signals } = scoreTitle(title);
    out.push({
      id: stableId(url),
      title,
      url,
      publishedAt,
      moneySignals: signals,
      moneyScore: score,
      kind: classifyKind(title),
    });
  });
  return out;
}

const LIST_PAGES: Record<
  DepartmentId,
  { label: string; urls: string[]; parse: (html: string) => RawListing[] }
> = {
  gxj: {
    label: "深圳市工业和信息化局",
    urls: [
      "https://gxj.sz.gov.cn/xxgk/xxgkml/qt/tzgg/index.html",
      "https://gxj.sz.gov.cn/xxgk/xxgkml/qt/tzgg/index_2.html",
      "https://gxj.sz.gov.cn/xxgk/xxgkml/qt/tzgg/index_3.html",
    ],
    parse: parseGxj,
  },
  stic: {
    label: "深圳市科技创新局",
    urls: [
      "https://stic.sz.gov.cn/xxgk/tzgg/index.html",
      "https://stic.sz.gov.cn/xxgk/tzgg/index_2.html",
      "https://stic.sz.gov.cn/xxgk/tzgg/index_3.html",
    ],
    parse: parseStic,
  },
  hrss: {
    label: "深圳市人力资源和社会保障局",
    urls: [
      "https://hrss.sz.gov.cn/xxgk/qtxx/tzgg/index.html",
      "https://hrss.sz.gov.cn/xxgk/qtxx/tzgg/index_2.html",
      "https://hrss.sz.gov.cn/xxgk/qtxx/tzgg/index_3.html",
      "https://hrss.sz.gov.cn/ztfw/shbx/tzgg/index.html",
      "https://hrss.sz.gov.cn/ztfw/shbx/tzgg/index_2.html",
      "https://hrss.sz.gov.cn/ztfw/shbx/tzgg/index_3.html",
    ],
    parse: parseHrss,
  },
  amr: {
    label: "深圳市市场监督管理局",
    urls: [
      "https://amr.sz.gov.cn/xxgk/qt/tzgg/index.html",
      "https://amr.sz.gov.cn/xxgk/qt/tzgg/index_2.html",
      "https://amr.sz.gov.cn/xxgk/qt/tzgg/index_3.html",
    ],
    parse: parseAmr,
  },
  szgov: {
    label: "深圳市政府信息公开（通知公告）",
    urls: [
      "https://www.sz.gov.cn/cn/xxgk/zfxxgj/tzgg/index.html",
      "https://www.sz.gov.cn/cn/xxgk/zfxxgj/tzgg/index_2.html",
      "https://www.sz.gov.cn/cn/xxgk/zfxxgj/tzgg/index_3.html",
    ],
    parse: parseSzGov,
  },
};

export async function scrapeDepartment(
  id: DepartmentId,
): Promise<{ items: PolicyItem[]; error?: string }> {
  const cfg = LIST_PAGES[id];
  const merged = new Map<string, RawListing>();

  try {
    for (const url of cfg.urls) {
      const html = await fetchHtml(url);
      for (const row of cfg.parse(html)) {
        merged.set(row.url, row);
      }
    }
    const items: PolicyItem[] = [...merged.values()].map((row) => ({
      ...row,
      department: id,
      departmentLabel: cfg.label,
      applicantHint: inferApplicantHint(row.title),
      riskLevel: inferListingRiskLevel({
        title: row.title,
        moneyScore: row.moneyScore,
      }),
    }));
    items.sort((a, b) => {
      const da = a.publishedAt || "";
      const db = b.publishedAt || "";
      return db.localeCompare(da);
    });
    return { items };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { items: [], error: msg };
  }
}

export async function scrapeAll(): Promise<{
  items: PolicyItem[];
  sources: { id: DepartmentId; ok: boolean; error?: string; count: number }[];
}> {
  const ids: DepartmentId[] = ["gxj", "stic", "hrss", "amr", "szgov"];
  const results = await Promise.all(ids.map((id) => scrapeDepartment(id)));
  const sources = results.map((r, i) => ({
    id: ids[i],
    ok: !r.error,
    error: r.error,
    count: r.items.length,
  }));
  const merged = new Map<string, PolicyItem>();
  for (const r of results) {
    for (const item of r.items) merged.set(item.url, item);
  }
  const items = [...merged.values()].sort((a, b) => {
    const da = a.publishedAt || "";
    const db = b.publishedAt || "";
    return db.localeCompare(da);
  });
  return { items, sources };
}
