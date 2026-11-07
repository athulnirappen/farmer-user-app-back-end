# Deploying to one server

The API, Postgres and the admin site run on one Ubuntu server with Docker. Caddy serves both over HTTPS.

## First-time setup

1. **Server.** Create an Ubuntu 24.04 VPS (1–2 GB RAM, Mumbai region) and turn on the provider's snapshots.
2. **DNS.** Point two A records at the server's IP, for example `api.yourdomain.in` and `admin.yourdomain.in`.
3. **Docker and Git.** On the server:
   ```sh
   curl -fsSL https://get.docker.com | sh
   sudo usermod -aG docker $USER   # then log out and back in
   ```
4. **Code.** Clone both repos side by side, because the admin site is built from `../admin-web`:
   ```sh
   mkdir ~/farmer && cd ~/farmer
   git clone https://github.com/athulnirappen/farmer-user-app-back-end.git back-end
   git clone <admin-web repo url> admin-web
   ```
5. **Settings.** Copy the example and fill in every value:
   ```sh
   cd back-end
   cp .env.production.example .env.production
   ```
   Make the secrets with `openssl rand -base64 48`, and use the same database password in `POSTGRES_PASSWORD` and `DATABASE_URL`.
6. **Deploy:**
   ```sh
   chmod +x deploy/*.sh
   ./deploy/deploy.sh
   ```
7. **First admin.** Create it once, then change `ADMIN_REGISTRATION_SECRET` in `.env.production` and run `docker compose -f docker-compose.prod.yml up -d api`:
   ```sh
   curl -X POST https://api.yourdomain.in/api/v1/auth/admin/register \
     -H 'Content-Type: application/json' \
     -H 'x-admin-registration-secret: <ADMIN_REGISTRATION_SECRET>' \
     -d '{"name":"...","email":"...","password":"..."}'
   ```
   Then sign in to the admin site and add the categories. Don't run `db:seed` here: it creates demo users and a default admin password.
8. **Nightly backups** (`crontab -e`):
   ```
   30 2 * * * /home/<user>/farmer/back-end/deploy/backup.sh >> /home/<user>/backups.log 2>&1
   ```

## Day to day

- **Update:** run `./deploy/deploy.sh`. It pulls both repos, backs up, migrates and restarts.
- **Logs:** run `docker compose -f docker-compose.prod.yml logs -f api`. While `ALLOW_CONSOLE_SMS=true`, tester OTP codes show up here.
- **Restore a backup:**
  ```sh
  docker compose -f docker-compose.prod.yml exec -T postgres \
    pg_restore -U $POSTGRES_USER -d $POSTGRES_DB --clean < ~/backups/db-<stamp>.dump
  ```
