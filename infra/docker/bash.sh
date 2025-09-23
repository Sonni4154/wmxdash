#!/bin/bash
# 1) Inspect (optional, just to see the loop)
ls -l /etc/nginx/sites-available/wemakemarin.conf
ls -l /etc/nginx/sites-enabled/wemakemarin.conf
readlink -f /etc/nginx/sites-available/wemakemarin.conf || true
readlink -f /etc/nginx/sites-enabled/wemakemarin.conf   || true

# 2) Remove the looped entries
rm -f /etc/nginx/sites-enabled/wemakemarin.conf
rm -f /etc/nginx/sites-available/wemakemarin.conf

# 3) Recreate a real file (note: /api proxy_pass has **no trailing slash**)
cat >/etc/nginx/sites-available/wemakemarin.conf <<'NGINX'
server {
  listen 443 ssl http2;
  listen [::]:443 ssl http2;
  server_name wemakemarin.com www.wemakemarin.com;

  ssl_certificate     /etc/letsencrypt/live/wemakemarin.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/wemakemarin.com/privkey.pem;
  include /etc/letsencrypt/options-ssl-nginx.conf;
  ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

  # ACME (just in case)
  location ^~ /.well-known/acme-challenge/ {
    root /var/www/html;
    default_type "text/plain";
  }

  # API → Express on 3000 (keep /api prefix)
  location /api/ {
    proxy_http_version 1.1;
    proxy_set_header Host              $host;
    proxy_set_header X-Real-IP         $remote_addr;
    proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_pass http://127.0.0.1:3000;   # ← no trailing slash
  }

  # Web → Next.js on 5173
  location / {
    proxy_http_version 1.1;
    proxy_set_header Host              $host;
    proxy_set_header X-Real-IP         $remote_addr;
    proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_pass http://127.0.0.1:5173;
  }
}

# HTTP → HTTPS redirect
server {
  listen 80;
  listen [::]:80;
  server_name wemakemarin.com www.wemakemarin.com;

  location ^~ /.well-known/acme-challenge/ {
    root /var/www/html;
    default_type "text/plain";
  }

  return 301 https://$host$request_uri;
}
NGINX

# 4) Link it correctly (enabled → available)
ln -s /etc/nginx/sites-available/wemakemarin.conf /etc/nginx/sites-enabled/wemakemarin.conf

# (Optional) ensure default site is off
rm -f /etc/nginx/sites-enabled/default

# 5) Reload Nginx
nginx -t && systemctl reload nginx

