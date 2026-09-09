# EC2/Vercel configuration (13.53.46.72)

This configuration supersedes the old Render migration and 54.234.16.107 deployment instructions. Application, ML, APIx and Supabase schema behavior are unchanged.

## Vercel

Set these for the appropriate Production/Preview environments and redeploy:

```dotenv
BACKEND_ORIGIN=http://13.53.46.72
NEXT_PUBLIC_API_BASE_URL=/backend-api
NEXT_PUBLIC_API_V1_PREFIX=/api/v1
NEXT_PUBLIC_DEV_BEARER_TOKEN=
```

Keep the existing NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY and NEXT_PUBLIC_HCAPTCHA_SITEKEY values. Delete the obsolete EC2_BACKEND_URL setting. BACKEND_ORIGIN is server-only and must be available at build time; production builds reject a missing origin or an arbitrary public development token. A legacy demo-token value is tolerated but ignored by the production client; leaving this variable empty is still recommended. Supabase session JWTs continue to authorize users normally.

The rewrite is `/backend-api/:path*` -> `${BACKEND_ORIGIN}/:path*`. Browser API requests therefore use `/backend-api/api/v1/...`. The older `/api/proxy/...` compatibility route also uses BACKEND_ORIGIN directly, avoiding a second request through Vercel itself. All client API requests and downloads use the central API client.

For local development, set BACKEND_ORIGIN=http://127.0.0.1:8000. The optional NEXT_PUBLIC_DEV_BEARER_TOKEN=demo-token is a known non-secret development shortcut only, accepted only by a non-production backend with AUTH_STRICT=false. Arbitrary tokens are rejected by Next configuration; no privileged token is injected by a server route. Real authentication remains unchanged.

## EC2 backend

Preserve existing Supabase and Redis secrets in the EC2 environment. Confirm these non-secret production settings:

```dotenv
PORT=10000
APP_ENV=production
ENVIRONMENT=production
AUTH_STRICT=true
CORS_ORIGINS=["http://localhost:3000","http://127.0.0.1:3000","https://sih-56.vercel.app"]
```

Nginx listens on public port 80 and proxies to http://127.0.0.1:8000. Docker publishes `127.0.0.1:8000:10000`; PORT=10000 is explicitly set in the API Compose service. Do not expose port 8000 or 10000 in AWS security groups.

The checked-in docker-compose.yml still represents the existing development stack, including development Postgres credentials and a local database. This task did not replace database/Redis configuration. **Use your existing EC2 production Compose overrides/environment that point to Supabase**, not the development DB entries. An env_file alone does not override values explicitly listed under Compose environment.

## Commands after pulling

Run in the existing EC2 checkout, with your existing production Compose selection/overrides active (COMPOSE_FILE or the same `-f` arguments you currently use):

```bash
git pull --ff-only
cd airpulse-api
docker compose config --quiet
docker compose config --services
docker compose up -d --no-deps --build api
docker compose ps api
docker compose logs --tail=60 api
curl --fail http://127.0.0.1:8000/health
sudo nginx -t
sudo systemctl reload nginx
curl --fail http://127.0.0.1/health
```

If EC2 is using `docker run` rather than Compose, preserve the existing command's env file, mounts, network and restart settings; rebuild its image and recreate it with `-p 127.0.0.1:8000:10000 -e PORT=10000`. Do not launch the development Compose stack over an existing production setup.

Nginx location configuration should retain existing settings and include:

```nginx
location / {
    proxy_pass http://127.0.0.1:8000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

After the Vercel redeploy:

```bash
curl --fail https://sih-56.vercel.app/backend-api/health
curl -i https://sih-56.vercel.app/backend-api/api/v1/live/config?source=happyfares
```

The protected endpoint should require a genuine session (401 without one is expected). Sign in normally and verify authenticated requests and Supabase Realtime in the browser.

## Manual infrastructure/security steps

- Ensure EC2 IPv4 is 13.53.46.72; consider an Elastic IP so restarts do not change the rewrite target.
- Permit HTTP 80 for the current public Nginx endpoint; restrict SSH to your own IP. Keep DB/Redis ports private. The development Compose file still publishes those ports and must not be treated as a hardened production setup.
- The browser-to-Vercel connection is HTTPS, but Vercel-to-EC2 currently uses unencrypted HTTP and carries authorization headers. Configure a domain and TLS on Nginx, then change BACKEND_ORIGIN to its HTTPS origin when ready. No TLS infrastructure was changed in this task.
- If a real privileged token was ever placed in NEXT_PUBLIC_DEV_BEARER_TOKEN, remove it from Vercel and rotate it. This audit checked code behavior, not the inaccessible Vercel environment or historical bundles.

## Verification

Configuration regression script: `node frontend/scripts/verify-deployment-config.cjs`.
Compatibility proxy compression/status regression: `node frontend/scripts/verify-proxy-compression.cjs`.
Frontend production build: `cd frontend && npm run build -- --webpack`.
Backend settings/FastAPI import and Vercel/localhost CORS checks were run locally. Docker/Nginx/EC2 deployment checks must run on EC2; Docker is not available in this local environment. No production deployment was performed.
