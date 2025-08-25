Personal Advisor PWA (ChatBot)

DEMO in Stackblitz https://stackblitz.com/~/github.com/Sear13/personal-advisor-pwa! (Just For Showcase the api works if you download the below repo).

An installable Progressive Web App with a small Node/Express backend that proxies to OpenRouter (LLM provider).
No build step, no database — configure .env, run the server, and you’re up.

Repository

Repo: https://github.com/Sear13/personal-advisor-pwa

Requirements

Node.js 18+ (LTS recommended)

An OpenRouter API key → https://openrouter.ai

(Production) Ubuntu 22.04+ server, Nginx reverse proxy, HTTPS (Let’s Encrypt)

Project layout
ai-index/
  app/                  # front-end modules (UI, API client, helpers, PWA helpers)
  assets/               # backgrounds, icons, favicon
  downloads/            # generated PDFs/TXTs (served statically)
  server/
    server.js           # Express server (serves frontend + /api/chat)
    logs/               # JSONL chat logs (gitignored)
    .env                # secrets (create from .env.example)
  index.html            # main page
  style.css             # styles
  sw.js                 # service worker (PWA)
  manifest.webmanifest  # PWA manifest
package.json


No bundler/build tools — all static files are served by Express.

Quick start (local)

Works on Windows/macOS/Linux.

# 1) Get the code
git clone https://github.com/Sear13/personal-advisor-pwa.git
cd personal-advisor-pwa

# 2) Install dependencies
npm install

# 3) Configure your API key
cp ai-index/server/.env.example ai-index/server/.env
# then edit ai-index/server/.env and set:
# OPENROUTER_API_KEY=sk-xxxxxxxxxxxxxxxx...

# 4) Run the server
npm run start

# 5) Open the app
# http://localhost:5000


Optional dev mode (auto-restart on code changes):

npm run dev


Scripts (must exist in package.json):

{
  "scripts": {
    "start": "node ai-index/server/server.js",
    "dev": "nodemon ai-index/server/server.js"
  }
}

What to edit (if needed)

API key: ai-index/server/.env → OPENROUTER_API_KEY=...

CORS origin: ALLOWED_ORIGIN → where the site is served from

local: http://localhost:5000

production: https://advisor.your-domain.com

Icons/backgrounds: ai-index/assets/

Frontend: ai-index/app/, ai-index/index.html, ai-index/style.css

Backend: ai-index/server/server.js

Using the app

Type a message → Send

Stop → cancels the current request

↻ Reload → refreshes the page (nudges the Service Worker to update)

Install as a PWA (Chrome/Brave/Edge show an Install icon, or the Install button appears when allowed)

Production deployment (Ubuntu + Nginx)

Goal: Node on port 5000 with PM2, Nginx in front with HTTPS.

1) Install Node & git
# as a sudo-enabled user
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs git
node -v

2) Get the code & install
cd /opt
sudo git clone https://github.com/Sear13/personal-advisor-pwa.git personal-advisor
sudo chown -R $USER:$USER personal-advisor
cd personal-advisor
npm ci

3) Configure environment
cp ai-index/server/.env.example ai-index/server/.env
nano ai-index/server/.env


Set:

OPENROUTER_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxx
ALLOWED_ORIGIN=https://advisor.your-domain.com
CLASSROOM_SECRET=         # (optional) require x-classroom-key header
CLEAN_ON_BOOT=0
MAX_DOWNLOAD_AGE_HOURS=24
MAX_LOG_AGE_DAYS=7
# PORT (optional) defaults to 5000
# PORT=5000

4) Run with PM2 (keeps the app alive)
sudo npm i -g pm2
pm2 start ai-index/server/server.js --name personal-advisor
pm2 save
pm2 startup   # follow the printed command to enable on boot


Useful:

pm2 status
pm2 logs personal-advisor
pm2 restart personal-advisor

5) Nginx reverse proxy

Install Nginx:

sudo apt-get install -y nginx


Create the site config:

sudo nano /etc/nginx/sites-available/personal-advisor.conf


Paste (change the domain):

server {
  server_name advisor.your-domain.com;
  listen 80;
  listen [::]:80;
  location / { return 301 https://$host$request_uri; }
}

server {
  server_name advisor.your-domain.com;

  listen 443 ssl http2;
  listen [::]:443 ssl http2;

  # Replace with your certbot paths
  ssl_certificate     /etc/letsencrypt/live/advisor.your-domain.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/advisor.your-domain.com/privkey.pem;

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

6) HTTPS (Let’s Encrypt)
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d advisor.your-domain.com


Update .env if needed:

ALLOWED_ORIGIN=https://advisor.your-domain.com


Restart:

pm2 restart personal-advisor

7) Smoke test

Open https://advisor.your-domain.com
.
DevTools → Application → Manifest should show ✓ installable.

Updating the server
cd /opt/personal-advisor
git pull
npm ci                          # if package.json changed
pm2 restart personal-advisor


If the UI looks stale: hard refresh or unregister/update the Service Worker in DevTools.

Troubleshooting

Install button doesn’t appear

Must be HTTPS; /manifest.webmanifest and /sw.js must be reachable at site root.

DevTools → Application → “Installability” shows diagnostics.

CORS error

ALLOWED_ORIGIN must exactly match the public site URL (protocol + host).

Provider error

Verify OPENROUTER_API_KEY and model availability on your plan.

Logs: pm2 logs personal-advisor.

Where files/logs go

Generated files: ai-index/downloads/ (served at /downloads/...)

Logs: ai-index/server/logs/ (gitignored)

One-liner API test (from the server)
curl -X POST http://127.0.0.1:5000/api/chat \
  -H 'Content-Type: application/json' \
  -d '{"prompt":"Say hello","sessionId":"test"}'

License

MIT (see LICENSE)

Optional helper files

ai-index/server/.env.example

# REQUIRED
OPENROUTER_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxx

# CORS (frontend origin)
ALLOWED_ORIGIN=http://localhost:5000

# Optional API gate (if set, clients must send x-classroom-key: <value>)
CLASSROOM_SECRET=

# Housekeeping
CLEAN_ON_BOOT=0
MAX_DOWNLOAD_AGE_HOURS=24
MAX_LOG_AGE_DAYS=7

# PORT support (defaults to 5000)
# PORT=5000


deploy/nginx.conf

# Copy to /etc/nginx/sites-available/personal-advisor.conf and adjust domain/cert paths
server {
  server_name advisor.your-domain.com;
  listen 80;
  listen [::]:80;
  location / { return 301 https://$host$request_uri; }
}

server {
  server_name advisor.your-domain.com;

  listen 443 ssl http2;
  listen [::]:443 ssl http2;

  ssl_certificate     /etc/letsencrypt/live/advisor.your-domain.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/advisor.your-domain.com/privkey.pem;

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


**pm2.config.cjs (optional)
module.exports = {
  apps: [
    {
      name: "personal-advisor",
      script: "ai-index/server/server.js",
      env: {
        NODE_ENV: "production",
        PORT: 5000
      }
    }
  ]
};

Author: Dimitrios Katsikis 
