"""Generate local-only credentials without printing them or overwriting a file."""
import argparse
import os
from pathlib import Path
import secrets

parser = argparse.ArgumentParser()
parser.add_argument("--output", type=Path, default=Path(".env"))
args = parser.parse_args()
values = {"SECRET_KEY": secrets.token_urlsafe(48), "MYSQL_HOST": "127.0.0.1", "MYSQL_PORT": "3306",
          "MYSQL_USER": "navigator", "MYSQL_PASSWORD": secrets.token_urlsafe(32),
          "MYSQL_ROOT_PASSWORD": secrets.token_urlsafe(32), "MYSQL_DATABASE": "navigator", "COOKIE_SECURE": "0"}
fd = os.open(args.output, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
with os.fdopen(fd, "w") as f:
    f.write("# Local credentials. Never commit this file.\n")
    for key, value in values.items():
        f.write(f"{key}={value}\n")
print(f"Created {args.output}. Existing files are never overwritten.")
