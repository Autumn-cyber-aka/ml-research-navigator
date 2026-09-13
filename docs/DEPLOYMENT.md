# Public deployment

Status (2026-09-13): **prepared, not yet publicly deployed**. Render and Aiven login pages are open for the account owner; both still require login. No hosting resource, database credential or live URL has been created or verified. Source publication and cloud hosting are distinct deliverables.

## Intended free topology

Browser → HTTPS Render Python Web Service → TLS Aiven MySQL → dedicated `navigator` database.

Use the committed `render.yaml` Blueprint, a **Free** web service and **Free** MySQL plan. Do not choose a trial that requires paid resources. Render's free web service sleeps after inactivity and has ephemeral storage; all application state belongs in MySQL. Aiven's free tier has resource/inactivity limits. Review current provider terms before creation:

- [Render free service limitations](https://render.com/docs/free)
- [Render Blueprint specification](https://render.com/docs/blueprint-spec)
- [Aiven free MySQL](https://aiven.io/docs/products/mysql/concepts/mysql-free-tier)

## Deployment checklist

1. Account owner completes provider signup/login, terms and any CAPTCHA. Never request passwords in chat.
2. Create a new free Aiven MySQL service, dedicated `navigator` database and verified CA file. Use the provider's actual hostname/port; do not guess a hostname or copy the local Unix socket.
3. Initialize the **empty cloud database only** with `flask --app navigator init-db` and `flask --app navigator seed`, using a schema-management identity. Seed contains fictional catalogue metadata, no accounts or user activity. Never upload local application data or `.env`.
4. Use a separate runtime identity limited to SELECT, INSERT, UPDATE, DELETE on `navigator`. Keep schema credentials outside the running web app. For existing installations, run `flask --app navigator migrate-db` with the migration identity before upgrading.
5. Create Render service from this repo. Blueprint uses pinned Python, `$PORT`, two Gunicorn workers, `/health`, `COOKIE_SECURE=1`, `TRUST_PROXY=1`, and generated `SECRET_KEY`. Trust one proxy only; do not expose this trusted-proxy setting directly to untrusted clients.
6. Supply MYSQL_HOST, MYSQL_PORT, MYSQL_USER, MYSQL_PASSWORD, MYSQL_DATABASE privately. Add Secret File `mysql-ca.pem`; MYSQL_SSL_CA points to `/etc/secrets/mysql-ca.pem`. The SSL context verifies certificates and hostnames, requiring TLS 1.2 or newer. Missing/invalid CA must be fixed, not bypassed. Leave MYSQL_UNIX_SOCKET unset.
7. Allow provider egress addresses if database network controls support them. Verify health, catalogue, registration/login/logout, private/public ownership boundaries, helpful votes, ranking and graph. Record actual HTTPS URL and deployment revision after success.
8. Confirm database persistence after web redeploy. Keep backups off ephemeral web storage; free tier does not imply guaranteed recovery. Schedule/perform `flask --app navigator prune-sessions` without logging secrets.

## Verification boundary

The committed test output verifies local MySQL and application behavior. Hosting tests check trusted-proxy opt-in and TLS configuration with mocks; they do **not** prove a live TLS handshake, resource provisioning or internet availability. Record those separately after deployment. Demo accounts created during verification are test activity, not evidence of real user adoption.

Public-service limitations remain: no moderation or account recovery, no email verification, no production SLA, small database-backed login throttle and no full anti-abuse system. This is a learning portfolio demonstration. Do not store sensitive personal data in it.

For the child-friendly walkthrough, read [lesson 16](lessons/10_PUBLIC_DEPLOYMENT.md).
