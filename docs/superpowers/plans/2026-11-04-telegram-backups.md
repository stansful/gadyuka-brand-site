# Telegram Backups Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ежедневно архивировать PostgreSQL и MinIO, доставлять архив в Telegram и удалять серверную копию только после подтверждённой доставки.

**Architecture:** Отдельный Docker-сервис с BusyBox cron запускает shell-сценарий. Сценарий создаёт `pg_dump -Fc` и зеркало медиа, собирает tar.gz, при необходимости делит его на части до 45 МиБ и вызывает Bot API `sendDocument`; состояние неотправленных архивов хранится в bind mount.

**Tech Stack:** Bash, Alpine/postgres:18.1, MinIO `mc`, curl, jq, Docker Compose, Node.js `node:test` для изолированных сценарных тестов.

**Spec:** `docs/superpowers/specs/2026-11-04-telegram-backups-design.md`

## Global Constraints

- Существующие `deploy/backup.sh` и `deploy/restore.sh` не ломать и не заменять.
- Использовать существующие `TELEGRAM_BOT_TOKEN`, `TELEGRAM_OWNER_ID`, `TELEGRAM_DRY_RUN`; не выводить токен и пароли в логи.
- Не добавлять npm-зависимости и не монтировать Docker socket.
- Удалять архив только после проверки HTTP-ответа и JSON `.ok == true` для всех частей.
- Не выполнять git commit без отдельного запроса пользователя.

## Review Focus

- Telegram принял часть, но процесс завершился до записи маркера: повторная попытка может продублировать только неподтверждённую локально часть, не удаляя архив преждевременно; Task 1 проверяет возобновление по маркерам.
- Ответ HTTP 200 с `ok:false`: считать доставку неуспешной; Task 1 проверяет сохранение архива.
- Архив больше 45 МиБ: делить до загрузки и удалять только после всех ответов; Task 1 проверяет несколько частей маленьким тестовым порогом, Task 2 — реальный `split` образа.
- Одновременный cron и ручной запуск: не создавать и не отправлять один архив дважды; Task 1 добавляет блокировку на общем `BACKUP_DIR`, Task 2 проверяет наличие `flock` в образе.
- `TELEGRAM_DRY_RUN=1` и пустая конфигурация: не отправлять и не удалять; Task 1 проверяет оба случая.

---

### Task 1: Архивирование и надёжная доставка

**Files:**
- Create: `deploy/backup/backup-now.sh`
- Create: `deploy/backup/test/backup-now.test.mjs`
- Create: `deploy/backup/test/fake-split.mjs`

**Interfaces:**
- Consumes: `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_NAME`, `POSTGRES_USER`, `POSTGRES_PASS`, `MINIO_ROOT_USER`, `MINIO_ROOT_PASSWORD`, `S3_BUCKET`, `TELEGRAM_*`; `BACKUP_DIR` (по умолчанию `/backups`).
- Produces: выполняемый `backup-now.sh`; архив `gadyuka-backup_<UTC timestamp>.tar.gz[.NNN]`; тестовые переключатели `TELEGRAM_API_URL`, `BACKUP_CHUNK_BYTES`.

- [ ] **Step 1: Написать сценарные тесты с поддельными `pg_dump`, `mc`, `curl` и `flock`, но настоящими `tar` и файловой системой.** Проверить: содержимое архива; успешное удаление; `ok:false` сохраняет архив; повтор пропускает ранее отправленные части; dry-run не вызывает curl; пустая конфигурация завершается ошибкой без архива; второй процесс при занятой блокировке не запускает дамп.
- [ ] **Step 2: Запустить `node --test deploy/backup/test/backup-now.test.mjs` и убедиться в FAIL из-за отсутствующего `backup-now.sh`.**
- [ ] **Step 3: Реализовать `backup-now.sh`.** Атомарная `flock`-блокировка; временная папка с trap; `pg_dump` и `mc mirror`; tar.gz; GNU/BusyBox `split -d -a 3` при превышении 45 МиБ; curl с таймаутами и повторами; проверка JSON через jq; `.sent`-маркеры; обход `pending` по порядку; удаление папки архива только после полного успеха.
- [ ] **Step 4: Повторить тест — ожидается PASS всех сценариев.**
- [ ] **Step 5: Проверить `bash -n deploy/backup/backup-now.sh` и отсутствие секретов/команд с `set -x` в коде.**

### Task 2: Контейнер и ежедневное расписание

**Files:**
- Create: `deploy/backup/Dockerfile`
- Create: `deploy/backup/entrypoint.sh`
- Modify: `docker-compose.yml` (новый сервис, том и сборка)
- Modify: `deploy/lib.sh` (владелец папки backups, сборка образа, подсказки)
- Test: `deploy/backup/test/backup-now.test.mjs`

**Interfaces:**
- Consumes: `backup-now.sh` из Task 1.
- Produces: сервис `backup`; ручная команда `docker compose run --rm backup /opt/gadyuka-backup/backup-now.sh`; `BACKUP_SCHEDULE='30 3 * * *'`, `BACKUP_TIMEZONE='Europe/Moscow'`.

- [ ] **Step 1: Добавить проверку образа:** он содержит совместимые `pg_dump`, `mc`, `curl`, `jq`, `flock`, `crond`; entrypoint с аргументами выполняет переданную команду, без аргументов устанавливает заданное cron-расписание.
- [ ] **Step 2: Создать Dockerfile на `postgres:18.1-alpine3.23`, скопировать `mc` из закреплённого MinIO-образа и добавить только необходимые пакеты.** Написать entrypoint, который направляет вывод задачи в Docker logs.
- [ ] **Step 3: Подключить сервис к `data` и `edge`, выдать только нужные секреты, смонтировать `${VOLUMES_DIR}/backups`, добавить hardening, restart и healthcheck планировщика.** Добавить `backups:0:0:700` в `VOLUME_SPECS` и образ в сборку.
- [ ] **Step 4: Запустить `bash -n` для скриптов, `docker compose config --quiet`, `docker compose build backup` и smoke-run тестового сценария в собранном образе с поддельными внешними командами.** Ожидаются валидная конфигурация, успешная сборка и прохождение тестов.

### Task 3: Настройки и эксплуатационная документация

**Files:**
- Modify: `.env.example`
- Modify: `README.md`
- Modify: `deploy/lib.sh`
- Update if needed: `docs/superpowers/specs/2026-11-04-telegram-backups-design.md`

**Interfaces:**
- Consumes: сервис и команды из Tasks 1–2.
- Produces: документированные настройки, запуск, восстановление одного и многотомного архива, диагностика неотправленных файлов.

- [ ] **Step 1: Добавить `BACKUP_SCHEDULE` и `BACKUP_TIMEZONE` с значениями по умолчанию и пояснением общих Telegram-переменных.** Сохранять эти переменные при sudo-первом запуске и записывать переданные значения в `.env`.
- [ ] **Step 2: Обновить README:** автоматический контейнер в схеме/таблице, ручной запуск, логи, правило удаления после отправки, место pending-файлов, предупреждение о росте занятого места при постоянном сбое, команды `cat part.* > archive.tar.gz`, распаковка и существующий `restore.sh`.
- [ ] **Step 3: Прогнать полный набор проверок Tasks 1–2, `git diff --check` и `git status --short`; удалить только созданные проверками временные файлы.**
