FROM postgres:17-alpine

RUN apk add --no-cache \
    ca-certificates \
    curl \
    restic \
    tzdata

COPY docker/ops/run-cron.sh /usr/local/bin/run-cron
COPY docker/ops/scheduler-entrypoint.sh /usr/local/bin/scheduler-entrypoint
COPY docker/ops/backup-entrypoint.sh /usr/local/bin/backup-entrypoint
COPY docker/ops/backup-now.sh /usr/local/bin/backup-now
COPY docker/ops/restore-backup.sh /usr/local/bin/restore-backup
COPY docker/ops/nextcrm.crontab /etc/crontabs/root

RUN chmod 0555 \
    /usr/local/bin/run-cron \
    /usr/local/bin/scheduler-entrypoint \
    /usr/local/bin/backup-entrypoint \
    /usr/local/bin/backup-now \
    /usr/local/bin/restore-backup \
    && chmod 0600 /etc/crontabs/root
