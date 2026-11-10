# CLAUDE.md

## Dev server

The deployed API, called the "dev server", is at **https://antoha805-nest-demo.duckdns.org/api**. For example, posts are at `/api/posts`, and `/api/posts?q=` searches them. `/api` on its own returns 404, as it has no route.

- **Domain:** `antoha805-nest-demo.duckdns.org`, a DuckDNS name pointing at the instance. Caddy serves it over HTTPS with a Let's Encrypt certificate and refuses TLS for any other name, so requests to the bare IP fail.
- **Instance:** AWS EC2, Arm, `eu-north-1`, IP `13.63.143.101`.
- **OS:** Amazon Linux 2023, a custom build, not Ubuntu.

### SSH

```bash
ssh -i ~/.ssh/nest-demo.pem ec2-user@13.63.143.101
```

- Log in as `ec2-user`. The `ubuntu` user is rejected.
- `ec2-user` needs `sudo` to run `docker`.
- Even so, the app lives in `/home/ubuntu`: `docker-compose.prod.yml`, `prod.env` (with `DOMAIN` and the secrets) and the compose project `ubuntu`. `deploy/auto-deploy.sh` depends on that directory and project name.
- The containers are `ubuntu-api-1`, `ubuntu-caddy-1` and `ubuntu-postgres-1`.

### Useful commands on the instance

```bash
sudo docker ps
sudo docker logs --tail 100 ubuntu-api-1
journalctl -u nest-demo-deploy -n 50   # what the auto-deploy timer did
```

### Deploys

Each push to `main` is deployed automatically: CI publishes `ghcr.io/antoha805/nest-demo`, and the instance's timer applies it within about a minute, running any pending migrations (see "Automatic deployment" in `README.md`). To check that a change is live, call the dev server rather than assuming it is.
