import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

async function fetchViaNode(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": UA,
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
    },
    next: { revalidate: 0 },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  return res.text();
}

/** 部分政务 CDN 与 Node/OpenSSL 组合会握手失败，curl 通常可用 */
async function fetchViaCurl(url: string): Promise<string> {
  const { stdout, stderr } = await execFileAsync("curl", [
    "-4",
    "-sSL",
    "--compressed",
    "--http1.1",
    "-A",
    UA,
    "--connect-timeout",
    "12",
    "--max-time",
    "45",
    url,
  ]);

  const out = Buffer.isBuffer(stdout) ? stdout : Buffer.from(String(stdout));
  const err = Buffer.isBuffer(stderr) ? stderr : Buffer.from(String(stderr));
  const errText = err.toString("utf8");
  if (errText.trim()) {
    console.warn("[fetch-html] curl stderr:", errText.slice(0, 400));
  }
  const html = out.toString("utf8");
  if (html.length < 200) {
    throw new Error(
      `curl short response (${html.length}b): ${url} body=${html.slice(0, 120)}`,
    );
  }
  return html;
}

export async function fetchHtml(url: string): Promise<string> {
  try {
    return await fetchViaCurl(url);
  } catch (curlErr) {
    try {
      return await fetchViaNode(url);
    } catch {
      const a = curlErr instanceof Error ? curlErr.message : String(curlErr);
      throw new Error(`fetchHtml failed (curl then node): ${a}`);
    }
  }
}
