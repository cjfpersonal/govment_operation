# 部署说明：静态资源与 Node 应用

## 重要结论

本项目使用 **Next.js App Router + API Routes**（`/api/policies`、`/api/analyze-policy`）。服务端要执行抓取与可选大模型调用，**整站不能只做 `output: 'export'` 纯静态 HTML**（没有 Node 就没有 API）。

可以拆成两部分理解：

| 部分 | 是否适合单独当「纯静态」托管 | 说明 |
|------|------------------------------|------|
| `/_next/static/*`（JS/CSS chunk） | **是** | 默认与页面同源（站点根下 `/_next/static`）；也可单独放到别的域名/路径，此时构建要带 `ASSET_PREFIX` |
| HTML、API、动态路由 | **否** | 需要 **Node 进程**（或 Vercel / 云函数等托管 `next start` 或 standalone） |

## 自建服务器部署（Linux 常见）

### 环境要求

- **Node.js**：建议 **20 LTS**（与 Next 15 兼容；不低于 18）。
- **系统**：抓取走 `curl` 回退时需已安装 **`curl`** 且在 `PATH` 中。
- 若使用「解析评估」：在服务器配置 **`OPENAI_API_KEY`**（见 `.env.example`，用 `.env.local` 或进程环境变量，勿提交密钥）。

### 方式一：标准构建（`next start`）

在服务器项目目录执行：

```bash
git clone <你的仓库地址> sz-policy-monitor && cd sz-policy-monitor
npm ci
# 按需：复制 .env.example 为 .env.local 并填写 OPENAI_API_KEY 等
npm run build
HOSTNAME=0.0.0.0 PORT=3000 npm run start
```

默认只监听本机时外网访问不到，务必 **`HOSTNAME=0.0.0.0`**（或你指定的网卡地址）。生产环境建议前面加 **Nginx/Caddy** 做 HTTPS 与反代，见下文。

### 方式二：standalone（部署目录更小）

在**能完成构建**的机器上（可与运行机同一台）：

```bash
npm ci
npm run build:standalone
```

将整仓同步到服务器后，在**项目根目录**（存在 `.next/standalone/server.js`）执行：

```bash
HOSTNAME=0.0.0.0 PORT=3000 npm run start:standalone
```

`build:standalone` 已把 `.next/static`（及 `public`）拷入 standalone，避免静态 404。

### 反向代理（Nginx）

假设 Next 监听 **`127.0.0.1:3000`**（`HOSTNAME=0.0.0.0 PORT=3000` 即可）。将下面保存为 **`/etc/nginx/sites-available/sz-policy-monitor`**（文件名自定），把 **`your-domain.com`**、证书路径改成你的；再在 `sites-enabled` 里做软链并重载：

```bash
sudo ln -sf /etc/nginx/sites-available/sz-policy-monitor /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

**站点配置示例**（HTTP 跳 HTTPS + 反代）：

```nginx
upstream nextjs_upstream {
  server 127.0.0.1:3000;
  keepalive 64;
}

server {
  listen 80;
  listen [::]:80;
  server_name your-domain.com;
  return 301 https://$host$request_uri;
}

server {
  listen 443 ssl http2;
  listen [::]:443 ssl http2;
  server_name your-domain.com;

  ssl_certificate     /etc/letsencrypt/live/your-domain.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

  client_max_body_size 16m;

  gzip on;
  gzip_types text/plain text/css application/json application/javascript text/xml application/xml;

  location / {
    proxy_pass http://nextjs_upstream;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 120s;
    proxy_send_timeout 120s;
  }
}
```

**和「项目目录」怎么对应？**

- 这段配置是 **反向代理**，**没有** `root` / `alias` 指向你的 Next 代码目录。所有请求交给本机 **`127.0.0.1:3000`** 上的 Node 进程；你在哪个目录执行 `npm run build` / `npm run start`（例如 `/var/www/sz-policy-monitor`），由 **PM2 / systemd 的 `WorkingDirectory`** 指定，**不必**写进 Nginx。
- 配置里出现的磁盘路径主要是 **TLS 证书**（`ssl_certificate`、`ssl_certificate_key`），按你本机证书实际位置修改即可。

**其它说明：** **`proxy_read_timeout`** 略加长，便于列表抓取、AI 解析等接口偶尔较慢；证书路径以 **Let’s Encrypt** 为例，其它 CA 请改 `ssl_certificate` 两行。若暂时无 TLS，可只保留 `listen 80` 的 `server` 块里那段 `location /`，去掉 `return 301` 与 443 块（仅内网/测试）。

### 进程守护（示例）

使用 **PM2**（需全局安装 `pm2`）：

```bash
HOSTNAME=0.0.0.0 PORT=3000 pm2 start npm --name sz-policy-monitor -- start
pm2 save
```

standalone 时：

```bash
HOSTNAME=0.0.0.0 PORT=3000 pm2 start npm --name sz-policy-monitor -- run start:standalone
```

也可用 **systemd** 把上述 `npm run start` 写成 `ExecStart`。

### 与上文「静态资源 / ASSET_PREFIX」的关系

同一台机、同源部署：**不必**设 `ASSET_PREFIX`，`npm run build` 后 `npm run start` 即可。仅当你把 `_next/static` 放到别的 URL 根时，才在**构建**时设置 `ASSET_PREFIX`，详见后文方案 A。

## `ASSET_PREFIX` 默认行为（最常见）

**不设或留空 = 没有 `assetPrefix`，就是「站点根」**：页面和静态资源同一源，浏览器请求形如 `https://你的域名/_next/static/...`。

日常部署直接：

```bash
npm run build
npm run start
```

若要顺带打出一份可拷贝的静态目录（路径仍是同源 `/_next/static`，**不必**设 `ASSET_PREFIX`）：

```bash
npm run build:static
```

生成 `./dist-static-assets/_next/static`，可同步到与页面同域、且对外映射为 `/_next/static` 的 Nginx/OSS 等（与 HTML 里引用一致）。

## 方案 A：静态资源放到 CDN（或对象存储 + CDN）

**整站不能「只部署到 CDN」**：HTML 与 `/api/*` 仍须在你自己的服务器（或 PaaS）上跑 Node，见上文「自建服务器」与 Nginx 反代。

能放到 CDN 的只有构建产物里的 **`_next/static/*`**（JS、CSS 等）。做法是：构建时让页面引用 CDN 上的绝对地址，再把本地打好的目录上传到 CDN 源站（OSS 桶、S3、R2 等），由 CDN 对外提供 HTTPS。

### 步骤概要

1. **确定 CDN 对外 URL 根**（浏览器能打开的 HTTPS 前缀，**不要**末尾 `/`），例如：  
   `https://img.example.com/sz-policy`  
   上传后须能访问：  
   `https://img.example.com/sz-policy/_next/static/...`  
   （即「根」下面要有 `_next/static` 这一层。）

2. **在本机或 CI 上一条命令构建并打包**（`ASSET_PREFIX` 必须与上一步的 URL 根完全一致）：

   ```bash
   ASSET_PREFIX=https://img.example.com/sz-policy npm run build:static
   ```

   会生成 **`dist-static-assets/_next/static/`**（里面是 chunk 文件）。

3. **上传到 CDN 源**：把本地 **`dist-static-assets` 下的 `_next` 整棵**同步到存储桶/静态站点里，使线上路径为：

   `ASSET_PREFIX` + `/_next/static/` + `...`  

   各云厂商控制台「上传目录」、**`ossutil sync`**、**`aws s3 sync`**、**`rclone copy`** 均可；关键是线上目录结构与第 1 步一致。

### 本地用 `http-server` 自检（路径要对）

`dist-static-assets` 里应是 **`_next/static/...`** 这一层级，**文档根**必须能访问到 `/_next/static/` 这条路径：

- **错误**：`cd dist-static-assets/_next/static && http-server` —— 文件会变成 `http://localhost:8080/某 chunk.js`，缺少前面的 **`/_next/static/`**，和页面里引用的 URL 不一致。
- **正确**（在项目根目录）：

  ```bash
  npx http-server dist-static-assets -p 8080
  ```

  此时应能打开类似：`http://127.0.0.1:8080/_next/static/chunks/...js`（若 404，看文件名是否拼对）。

**说明**：这样只能验证「静态文件能否按路径访问」；**没有**首页、**没有** API。完整站点仍要用 **`npm run start`**（或 standalone）。若未全局安装 `http-server`，用上面的 **`npx http-server`** 即可。

4. **源站跑同一套构建**：把**同一次** `npm run build:static` 产生的 **`.next` 整目录**（以及 `node_modules`、`package.json` 等）部署到服务器，执行 `npm run start`（或 standalone）。**不要**在源站用未带 `ASSET_PREFIX` 的旧构建，否则 HTML 里脚本地址与 CDN 上的文件对不上。

5. **缓存**：CDN 上对 `/_next/static/` 下带 hash 的文件可设较长缓存（如 `Cache-Control: public, max-age=31536000, immutable`），具体在各 CDN / OSS 控制台配置。

### 与「只反代、不同源」的区别

| 场景 | 是否需要 `ASSET_PREFIX` |
|------|-------------------------|
| 用户访问 `https://你的域名/`，JS 也从同一域名 `/_next/static` 拉 | **不需要** |
| JS/CSS 从 `https://cdn.xxx/前缀/_next/static` 拉 | **需要**，且与上传路径一致 |

若主站与静态资源 **不同域名**，一般无需为 `<script src=...>` 单独配 CORS；若浏览器控制台出现跨域相关报错，再在 CDN/OSS 上为 `/_next/static/*` 按需补响应头。

## 方案 B：`standalone` 与容器（补充）

与「自建服务器 · 方式二」相同：`npm run build:standalone` 后 `HOSTNAME=0.0.0.0 PORT=3000 npm run start:standalone`。在 Docker 中可复制项目根（含 `.next/standalone`）为镜像工作目录，用 `node .next/standalone/server.js` 启动，并同样设置 `HOSTNAME` / `PORT`。

## 方案 C：若坚持「整站只有静态文件」

需要 **改造架构**：例如把抓取与 AI 迁到独立后端（云函数 / 自建 API），前端改为纯静态或 SSG，通过 `fetch(你的API)` 拉数据，并处理浏览器跨域与政务站限制。当前仓库未按此模式实现。

## 环境变量小结

| 变量 | 阶段 | 作用 |
|------|------|------|
| `ASSET_PREFIX` | **build**，可选 | 不设则同源 `/_next/static`；设了则为 Next `assetPrefix`（绝对 URL 根） |
| `STANDALONE=1` | **build** | 输出 `.next/standalone` 便于容器部署 |
| `HOSTNAME` / `PORT` | **runtime** | `next start` / standalone 监听地址与端口（外网访问常用 `HOSTNAME=0.0.0.0`） |
| `OPENAI_API_KEY` | **runtime** | 服务端解析评估（可选） |
