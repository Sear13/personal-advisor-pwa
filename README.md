Personal Advisor PWA (ChatBot)

An installable Progressive Web App with a small Node/Express backend that proxies to OpenRouter (LLM provider).
No build step, no database — configure .env, run the server, and you’re up.

0) Repository

Repository: https://github.com/<your-org-or-user>/<your-repo>

Replace with your real repo link after you paste this file.

1) Requirements

Node.js 18+ (LTS recommended)

An OpenRouter API key → https://openrouter.ai

(Production) A Linux server (Ubuntu 22.04+), Nginx reverse proxy, and HTTPS certificate (Let’s Encrypt)

2) Project layout (what matters)
ai-index/
  app/                  # front-end modules (UI, client API, helpers, PWA helpers)
  assets/               # backgrounds, icons, favicon
  downloads/            # generated PDFs/TXTs (served statically)
  server/
    server.js           # Express server (serves frontend + /api/chat)
    logs/               # JSONL chat logs (gitignored)
  index.html            # main page
  style.css             # UI styles
  sw.js                 # service worker (cache app shell)
  manifest.webmanifest  # PWA manifest
package.json
.gitignore


No bundler or build tools — all static files are served by Express.

3) Quick start (local)

Works on Windows/macOS/Linux.

Clone

git clone https://github.com/<your-org-or-user>/<your-repo>.git
cd <your-repo>


Install

npm install


Create .env
Create ai-index/server/.env with:

# REQUIRED
OPENROUTER_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxx

# OPTIONAL
# If set, all /api/chat requests must include x-classroom-key=<this secret>
CLASSROOM_SECRET=

# CORS: which origin may call /api/chat (frontend origin)
ALLOWED_ORIGIN=http://localhost:5000

# Optional housekeeping
CLEAN_ON_BOOT=0
MAX_DOWNLOAD_AGE_HOURS=24
MAX_LOG_AGE_DAYS=7


Run

npm run start


Open: http://localhost:5000

Dev mode with auto-restart (optional):

npm run dev

4) Using the app

Type a message and press Send.

Stop cancels the current request.

Reload ↻ reloads the page (and nudges the Service Worker to update).

The app is installable as a PWA (Chrome/Brave/Edge show an “Install” icon, or you’ll see an Install button when allowed).

5) Production deployment (Ubuntu + Nginx)

Below is a copy-paste friendly guide for a typical Ubuntu VPS.

5.1 Install Node.js (LTS) & git
# as a non-root sudo user
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs git
node -v

5.2 Clone the repo
cd /opt
sudo git clone https://github.com/<your-org-or-user>/<your-repo>.git personal-advisor
sudo chown -R $USER:$USER personal-advisor
cd personal-advisor
npm ci

5.3 Configure environment
mkdir -p ai-index/server
nano ai-index/server/.env


Paste:

OPENROUTER_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxx
ALLOWED_ORIGIN=https://advisor.your-domain.com
CLASSROOM_SECRET=
CLEAN_ON_BOOT=0
MAX_DOWNLOAD_AGE_HOURS=24
MAX_LOG_AGE_DAYS=7

5.4 Run with PM2 (recommended)
sudo npm i -g pm2
pm2 start ai-index/server/server.js --name personal-advisor
pm2 save
pm2 startup  # follow the printed instructions


Check: pm2 status and pm2 logs personal-advisor

5.5 Nginx reverse proxy

Install Nginx:

sudo apt-get install -y nginx


Create a site config:

sudo nano /etc/nginx/sites-available/personal-advisor.conf


Paste (change the domain):

server {
  server_name advisor.your-domain.com;

  # HTTP -> redirect to HTTPS
  listen 80;
  listen [::]:80;
  location / { return 301 https://$host$request_uri; }
}

server {
  server_name advisor.your-domain.com;

  listen 443 ssl http2;
  listen [::]:443 ssl http2;

  # Certs (replace with your certbot paths)
  ssl_certificate     /etc/letsencrypt/live/advisor.your-domain.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/advisor.your-domain.com/privkey.pem;

  # Proxy to Node on 5000
  location / {
    proxy_pass         http://127.0.0.1:5000;
    proxy_http_version 1.1;
    proxy_set_header   Upgrade $http_upgrade;
    proxy_set_header   Connection "upgrade";
    proxy_set_header   Host $host;
    proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header   X-Forwarded-Proto $scheme;
  }
}


Enable & reload:

sudo ln -s /etc/nginx/sites-available/personal-advisor.conf /etc/nginx/sites-enabled/personal-advisor.conf
sudo nginx -t
sudo systemctl reload nginx

5.6 HTTPS (Let’s Encrypt)
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d advisor.your-domain.com


Set ALLOWED_ORIGIN=https://advisor.your-domain.com in .env, then:

pm2 restart personal-advisor

5.7 Smoke test

Open https://advisor.your-domain.com
 in a browser.
DevTools → Application → Manifest should show ✓ installable.

6) Updating the server
cd /opt/personal-advisor
git pull
npm ci                # if package.json changed
pm2 restart personal-advisor


If the browser shows the old UI (Service Worker caching), hard-refresh or Unregister/Update the Service Worker (DevTools → Application → Service Workers).

7) Security & CORS

ALLOWED_ORIGIN must match the frontend origin (e.g., https://advisor.your-domain.com).

If you set CLASSROOM_SECRET, all /api/chat requests must include:

x-classroom-key: <the-secret>


Your OpenRouter API key stays on the server (never sent to the browser).

8) Admin & housekeeping

Generated files (PDF/TXT) are in ai-index/downloads/ and served at /downloads/....

Logs are JSONL in ai-index/server/logs/ (gitignored).

Optional cleanup endpoint (only if CLASSROOM_SECRET is set):

POST /admin/cleanup
x-classroom-key: <secret>


This clears downloads/ and server/logs/.

9) Troubleshooting

Install button doesn’t appear

Must be HTTPS; ensure /manifest.webmanifest and /sw.js are reachable.

DevTools → Application → “Installability” for diagnostics.

CORS error

ALLOWED_ORIGIN must match the exact domain you open in the browser.

Restart PM2 after .env changes.

UI looks stale

Service Worker caching — do a hard refresh, or unregister SW in DevTools.

OpenRouter error

Verify OPENROUTER_API_KEY and model availability on your plan.

Check server logs: pm2 logs personal-advisor.

10) Notes for assessors

No DB, no migrations.

Run locally with npm run start.

Clean, commented server (ai-index/server/server.js).

Frontend split into small modules in ai-index/app/ for easy maintenance.

11) One-liner API test (from the server)
curl -X POST http://127.0.0.1:5000/api/chat \
  -H 'Content-Type: application/json' \
  -d '{"prompt":"Say hello","sessionId":"test"}'


You should receive JSON with the model’s reply.

License: MIT (see LICENSE)
Author: Your Name / Your Org
