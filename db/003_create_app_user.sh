#!/bin/sh
set -eu

APP_USER="${MYSQL_APP_USER:-}"
APP_PASSWORD="${MYSQL_APP_PASSWORD:-}"
APP_DATABASE="${MYSQL_DATABASE:-app5p}"

if [ -z "$APP_USER" ] || [ -z "$APP_PASSWORD" ]; then
  echo "MYSQL_APP_USER/MYSQL_APP_PASSWORD nao informados; usuario dedicado da aplicacao nao sera criado."
  exit 0
fi

mysql --protocol=socket -uroot -p"${MYSQL_ROOT_PASSWORD}" <<SQL
CREATE USER IF NOT EXISTS '${APP_USER}'@'%' IDENTIFIED BY '${APP_PASSWORD}';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX ON \`${APP_DATABASE}\`.* TO '${APP_USER}'@'%';
FLUSH PRIVILEGES;
SQL

echo "Usuario dedicado da aplicacao '${APP_USER}' configurado com permissoes no banco '${APP_DATABASE}'."
