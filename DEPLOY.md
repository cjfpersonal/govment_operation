# PM2（在项目根执行，勿粘贴进 nginx）：HOSTNAME=0.0.0.0 PORT=8888 pm2 start npm --name sz-policy-monitor -- start

upstream sz_policy_next {
  server 127.0.0.1:8888;
  keepalive 64;
}

server {
  listen 80;
  server_name jyera.com;
  return 301 https://$host$request_uri;
}

server {
  listen 443 ssl;
  server_name jyera.com;

  ssl_certificate     /etc/nginx/ssl/jyera.com_bundle.crt;
  ssl_certificate_key /etc/nginx/ssl/jyera.com.key;
  ssl_session_timeout 5m;
  ssl_ciphers ECDHE-RSA-AES128-GCM-SHA256:ECDHE:ECDH:AES:HIGH:!NULL:!aNULL:!MD5:!ADH:!RC4;
  ssl_protocols TLSv1.2 TLSv1.3;
  ssl_prefer_server_ciphers on;

  client_max_body_size 16m;
  gzip on;
  gzip_types text/plain text/css application/json application/javascript text/xml application/xml;

  # Next 使用 basePath /gov 时，上游必须收到带 /gov 的 URI，故 proxy_pass 不要用 http://...:8888/ 尾斜杠（否则会剥前缀，变成 /_next、/api 对不上）
  location = /gov {
    return 301 /gov/;
  }

  location ^~ /gov/ {
    proxy_pass http://sz_policy_next;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 120s;
    proxy_send_timeout 120s;
  }

  # 只保留一个 /boss/，避免与 location /boss 重复
  location ^~ /boss/ {
    alias /home/lighthouse/dist-boss/;
    index index.html;
    try_files $uri $uri/ /index.html;
  }

  location ^~ /btc/ {
    alias /home/lighthouse/dist-btc/;
    index index.html;
    try_files $uri $uri/ /index.html;
  }

  location / {
    alias /home/lighthouse/dist/public/;
    try_files $uri $uri/ /index.html;
  }
}
