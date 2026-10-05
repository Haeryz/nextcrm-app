"""Production VPS helper for the client-fix → proof workflow (see CLAUDE.md).

Reads credentials from `.env.agent.local` in the repo root (template:
scripts/agent/env.example). Requires `pip install paramiko`.

  python scripts/agent/vps.py sh "docker ps"
  python scripts/agent/vps.py sql query.sql          # wrapped in BEGIN READ ONLY
  python scripts/agent/vps.py sql - <<< "select 1"   # SQL from stdin
  python scripts/agent/vps.py wait-deploy            # waits for a new app container
"""

import os
import sys
import time
from pathlib import Path

import paramiko

ROOT = Path(__file__).resolve().parents[2]
DB_CMD = "docker exec -i nextcrm-supabase-1 psql -U postgres -d nextcrm -P pager=off"
APP_CONTAINER = "nextcrm-appbuild-1"


def load_env():
    path = ROOT / ".env.agent.local"
    if not path.exists():
        sys.exit("Missing .env.agent.local — copy scripts/agent/env.example and fill it in.")
    env = {}
    for line in path.read_text(encoding="utf8").splitlines():
        if "=" in line and not line.lstrip().startswith("#"):
            key, value = line.split("=", 1)
            env[key.strip()] = value.strip()
    return env


def connect(env):
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(
        env["VPS_HOST"],
        username=env.get("VPS_USER", "root"),
        password=env["VPS_PASSWORD"],
        timeout=20,
    )
    return client


def run(client, command, stdin_text=None, timeout=120):
    stdin, stdout, stderr = client.exec_command(command, timeout=timeout)
    if stdin_text is not None:
        stdin.write(stdin_text)
        stdin.channel.shutdown_write()
    out = stdout.read().decode(errors="replace")
    err = stderr.read().decode(errors="replace")
    return out, err


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    env = load_env()
    client = connect(env)
    action = sys.argv[1]

    if action == "sh":
        out, err = run(client, sys.argv[2])
        sys.stdout.write(out)
        sys.stderr.write(err)
    elif action == "sql":
        source = sys.argv[2] if len(sys.argv) > 2 else "-"
        sql = sys.stdin.read() if source == "-" else Path(source).read_text(encoding="utf8")
        # Reads only. Data fixes ship as a prisma migration, never ad-hoc writes.
        out, err = run(client, DB_CMD, f"BEGIN READ ONLY;\n{sql}\nROLLBACK;\n")
        sys.stdout.write(out)
        sys.stderr.write(err)
    elif action == "wait-deploy":
        before, _ = run(client, f"docker inspect {APP_CONTAINER} --format '{{{{.Created}}}}'")
        before = before.strip()
        print(f"current container created {before}; waiting for a newer one…", flush=True)
        for _ in range(60):
            time.sleep(30)
            now, _ = run(client, f"docker inspect {APP_CONTAINER} --format '{{{{.Created}}}}'")
            if now.strip() and now.strip() != before:
                health, _ = run(client, f"curl -s -o /dev/null -w '%{{http_code}}' {env.get('PROD_URL', 'https://mektek.id')}/api/health")
                print(f"deployed: container created {now.strip()}, health {health}")
                return
        sys.exit("timed out after 30 min waiting for a new container")
    else:
        sys.exit(__doc__)


if __name__ == "__main__":
    main()
