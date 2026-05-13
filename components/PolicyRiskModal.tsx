"use client";

import { useCallback, useEffect, useState } from "react";
import type { PolicyItem } from "@/lib/types";
import type { PolicyRiskAnalysis } from "@/lib/policy-risk-analysis";

type Props = {
  item: PolicyItem | null;
  open: boolean;
  onClose: () => void;
};

export function PolicyRiskModal({ item, open, onClose }: Props) {
  const [data, setData] = useState<PolicyRiskAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const run = useCallback(async () => {
    if (!item) return;
    setLoading(true);
    setErr(null);
    setData(null);
    try {
      const res = await fetch("/api/analyze-policy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item }),
      });
      const j = await res.json();
      if (!res.ok) {
        throw new Error((j as { error?: string }).error || res.statusText);
      }
      setData(j as PolicyRiskAnalysis);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "分析失败");
    } finally {
      setLoading(false);
    }
  }, [item]);

  useEffect(() => {
    if (open && item) void run();
    if (!open) {
      setData(null);
      setErr(null);
    }
  }, [open, item, run]);

  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);

  if (!open) return null;

  const riskStyles =
    data?.riskLevel === "高"
      ? "bg-red-950/60 text-red-200 border-red-800/80"
      : data?.riskLevel === "中"
        ? "bg-amber-950/50 text-amber-100 border-amber-800/70"
        : "bg-slate-800/80 text-slate-200 border-slate-600/60";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="policy-risk-title"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 flex items-start justify-between gap-4 border-b border-[var(--border)] bg-[var(--surface)] px-5 py-4">
          <div>
            <h2 id="policy-risk-title" className="text-lg font-semibold text-white">
              政策解析与合规评估
            </h2>
            <p className="mt-1 text-xs text-[var(--muted)] leading-relaxed">
              主题：<strong className="text-slate-300">合法吃透规则</strong>、
              <strong className="text-slate-300">压缩信息差</strong>、
              <strong className="text-slate-300">正确申报与流程优化</strong>
              。场景侧重政策补贴，可类比电商/企业流程中「规则清晰、材料齐全」的经验，不涉及灰色返利或刷单。配置{" "}
              <code className="text-slate-400">OPENAI_API_KEY</code> 时走大模型，否则为规则引擎。
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm text-[var(--muted)] hover:bg-white/5 hover:text-white"
          >
            关闭
          </button>
        </div>

        <div className="space-y-5 px-5 py-4 text-sm leading-relaxed text-[var(--text)]">
          {item && (
            <div className="rounded-lg border border-[var(--border)] bg-[var(--bg)]/80 p-3 text-[var(--muted)]">
              <p className="font-medium text-sky-200/90">{item.title}</p>
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-block break-all text-xs text-blue-400 hover:underline"
              >
                {item.url}
              </a>
            </div>
          )}

          {loading && (
            <p className="text-[var(--muted)]">正在生成分析…</p>
          )}
          {err && (
            <div className="rounded-lg border border-red-900/50 bg-red-950/30 px-3 py-2 text-red-200">
              {err}
            </div>
          )}

          {data && (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full border px-3 py-1 text-xs font-medium ${riskStyles}`}
                >
                  风险：{data.riskLevel}
                </span>
                <span className="text-xs text-[var(--muted)]">
                  来源：{data.mode === "openai" ? "大模型" : "规则引擎"}
                </span>
              </div>
              <p className="text-[var(--muted)]">{data.summary}</p>

              <section>
                <h3 className="font-medium text-white">一、压缩信息差</h3>
                <ul className="mt-2 list-disc space-y-1.5 pl-5 text-[var(--muted)]">
                  {data.informationGapBullets.map((b, i) => (
                    <li key={i}>{b}</li>
                  ))}
                </ul>
              </section>

              <section>
                <h3 className="font-medium text-white">二、合法收益与规则边界</h3>
                <p className="mt-2 text-[var(--muted)]">{data.legitimateValueSummary}</p>
              </section>

              <section>
                <h3 className="font-medium text-white">三、合规操作清单（熟悉规则 → 正确申报 → 流程优化）</h3>
                <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-[var(--muted)]">
                  {data.operationChecklist.map((b, i) => (
                    <li key={i}>{b}</li>
                  ))}
                </ol>
              </section>

              {data.integrityObservation && (
                <div className="rounded-lg border border-amber-900/40 bg-amber-950/20 p-3 text-amber-100/90">
                  <p className="font-medium text-amber-200">资金与廉政观察</p>
                  <p className="mt-1 text-xs">{data.integrityObservation}</p>
                </div>
              )}

              <section>
                <h3 className="font-medium text-white">四、异常点与双方改进</h3>
                <p className="mt-1 text-xs text-slate-500">
                  下表从「问题现象 → 官方怎么改 → 经办人合法怎么做」展开，便于对账与内控。
                </p>
                <ul className="mt-3 space-y-4">
                  {data.improvements.map((p, i) => (
                    <li
                      key={i}
                      className="rounded-lg border border-[var(--border)] bg-[var(--bg)]/60 p-4"
                    >
                      <p className="font-medium text-white">{p.title}</p>
                      <dl className="mt-3 space-y-2 text-xs">
                        <div>
                          <dt className="text-slate-500">问题 / 现象</dt>
                          <dd className="text-slate-300">{p.problem}</dd>
                        </div>
                        <div>
                          <dt className="text-slate-500">发布方 / 制度修补</dt>
                          <dd className="text-slate-300">{p.authorityFix}</dd>
                        </div>
                        <div>
                          <dt className="text-slate-500">经办方合法动作</dt>
                          <dd className="text-slate-300">{p.applicantLawfulActions}</dd>
                        </div>
                      </dl>
                    </li>
                  ))}
                </ul>
              </section>

              <p className="border-t border-[var(--border)] pt-3 text-xs text-slate-500">
                {data.disclaimer}
              </p>
            </>
          )}
        </div>

        <div className="flex flex-wrap justify-end gap-2 border-t border-[var(--border)] px-5 py-3">
          <button
            type="button"
            onClick={() => item && void run()}
            disabled={loading || !item}
            className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm text-white hover:bg-white/5 disabled:opacity-40"
          >
            重新分析
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--accent-dim)]"
          >
            完成
          </button>
        </div>
      </div>
    </div>
  );
}
