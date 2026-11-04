# ГАДЮКА — сайт бренда

Лендинг и каталог бренда уличной одежды ГАДЮКА с админкой: тексты, картинки, коллекции, заявки в Telegram.

- `frontend/` — Next.js 16 (сайт и админка, только отображение) → [frontend/README.md](frontend/README.md)
- `backend/` — NestJS 12 + Fastify, Prisma 7, PostgreSQL 18, MinIO (данные, правила, картинки, заявки, вход) → [backend/README.md](backend/README.md)
- `shared/` — тексты ru/en и типы API, общие для обоих → [shared/README.md](shared/README.md)
- `deploy/`, `docker-compose*.yml` — продакшен на одном сервере (этот файл)

## Как устроено

```
Интернет ──► прокси :80 / :443  (Caddy  или  nginx + certbot)
               ├─ /_next/static/*, /brand/* ── файлы сборки с диска (предсжатые br / zstd / gzip)
               ├─ /media/* ──────────────────► backend:4000   картинки из MinIO
               └─ всё остальное ─────────────► frontend:3000  Next.js: сайт, /admin, /api/leads
                                                    │  x-internal-key, внутренняя сеть
                                                    ▼
                                              backend:4000 (NestJS) ──► postgres, minio, api.telegram.org
                              backup: ежедневно ──► postgres, minio, api.telegram.org
```

Наружу открыт только прокси (80/443). Next.js, бэкенд, PostgreSQL и MinIO доступны только внутри
docker-сетей; у PostgreSQL и MinIO нет даже выхода в интернет. Бэкенд работает ролью БД без права менять
схему и пользователем MinIO с доступом только к своему бакету.

| Сервис          | Что делает                                                                                                 |
| --------------- | ---------------------------------------------------------------------------------------------------------- |
| `caddy`/`nginx` | HTTPS (Let's Encrypt), сжатие, заголовки безопасности, лимиты тела запроса, статика с диска                |
| `certbot`       | только вариант nginx: выпуск и продление сертификата                                                       |
| `frontend`      | Next.js (standalone); при старте выкладывает статику сборки в общую папку для прокси                       |
| `backend`       | API (NestJS); наружу — только `/media/*`                                                                   |
| `postgres`      | PostgreSQL 18                                                                                              |
| `minio`         | S3-хранилище картинок (веб-консоль выключена)                                                              |
| `minio-init`    | разово при каждом запуске: бакет и пользователь бэкенда                                                    |
| `backup`        | ежедневный архив PostgreSQL + MinIO в Telegram; после доставки удаляет его с сервера                       |
| `migrate`       | разово при каждом запуске: миграции БД и роль бэкенда (только чтение/запись строк)                         |
| `seed`          | разово при каждом запуске: админ, новые тексты по умолчанию, стартовый контент (правки админки не трогает) |

## Требования

- VPS: 2 vCPU, 4 ГБ RAM (при 2 ГБ — обязательно swap, см. ниже), 40 ГБ SSD; x86_64 или arm64.
- Debian 12/13 или Ubuntu 22.04/24.04, доступ root или пользователь с `sudo`.
- Домен: A-запись (и AAAA, если у сервера есть IPv6) указывает на IP сервера **до** первого запуска.
- Открыты порты 80/tcp и 443/tcp (для HTTP/3 у Caddy ещё 443/udp).

Docker и всё остальное скрипт поставит сам.

## Запуск одной командой

```bash
sudo apt-get update && sudo apt-get install -y git
sudo install -d -o "$(id -un)" -g "$(id -gn)" /opt/gadyuka   # папка ваша: git pull без sudo
git clone <URL репозитория> /opt/gadyuka                     # или rsync без node_modules, .next, .env
cd /opt/gadyuka

sudo ./deploy/up-caddy.sh      # вариант 1: Caddy (рекомендуется)
# или
sudo ./deploy/up-nginx.sh      # вариант 2: nginx + certbot
```

При первом запуске скрипт спросит домен, логин и пароль админа (пусто — сгенерирует и покажет один раз),
токен Telegram-бота и chat id (можно пропустить), для nginx — e-mail для Let's Encrypt. Без терминала
значения передаются переменными: `sudo DOMAIN=gadyuka.ru ADMIN_LOGIN=admin ./deploy/up-caddy.sh`.
Первая сборка — 5–10 минут.

**Какой вариант выбрать.** Caddy проще: сертификаты и их продление встроены, статика отдаётся в brotli /
zstd, есть HTTP/3. nginx — если привычнее он: официальный образ умеет только gzip (модулей brotli / zstd
в нём нет), сертификат выпускает и продлевает отдельный контейнер certbot. Опции `up-nginx.sh`:
`--staging` (тестовый сертификат Let's Encrypt — для первой пробы, лимиты мягче), `--letsencrypt`
(настоящий, по умолчанию), `--self-signed` (самоподписанный, для проверки без домена). Переключаться между
вариантами можно в любой момент — просто запустите другой скрипт.

### Что делает скрипт

1. Проверяет, что система — Debian / Ubuntu, и перезапускает себя через `sudo`, если нужно.
2. Ставит Docker Engine, compose и buildx из официального репозитория Docker (если их нет).
3. Создаёт `.env` из `.env.example`: генерирует все секреты (`openssl rand -hex`), записывает ответы,
   `chmod 600`. При повторных запусках только проверяет его и дописывает недостающее.
4. Создаёт папки данных `~/docker-volumes/gadyuka/*` (домашняя папка того, кто запустил `sudo`) с нужными
   владельцами для каждого образа.
5. Собирает образы backend и frontend и запускает всё: `postgres → migrate → minio → minio-init → seed →
   backend → frontend → прокси`; ждёт, пока все сервисы станут healthy (у nginx — пока сертификат выпущен
   и сайт работает по HTTPS). Если что-то не поднялось — печатает статус и последние строки логов.
6. Ставит ротацию лога бэкенда (`/etc/logrotate.d/gadyuka`), удаляет старые образы, печатает адреса.

Скрипт можно запускать сколько угодно раз — это же и команда обновления.

## Переменные окружения

Все — в `.env` в корне (шаблон с комментариями: [.env.example](.env.example)). Скрипт заполняет их сам.

| Переменная                                                    | Что это                                                                                         |
| ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `DOMAIN`, `SITE_URL`                                          | домен и `https://<домен>` (canonical, sitemap, ссылки в Telegram); после смены — запуск скрипта |
| `WWW_REDIRECT`                                                | `1` — `www.<домен>` с сертификатом и редиректом на основной (нужна DNS-запись www)              |
| `ADMIN_LOGIN`, `ADMIN_PASSWORD`                               | вход в админку (пароль ≥ 16 символов)                                                           |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_OWNER_ID`, `TELEGRAM_DRY_RUN` | заявки и бэкапы в Telegram; `TELEGRAM_DRY_RUN=1` — не отправлять, бэкапы остаются на сервере   |
| `BACKUP_SCHEDULE`, `BACKUP_TIMEZONE`                          | cron-расписание и часовой пояс; по умолчанию `30 3 * * *`, `Europe/Moscow`                     |
| `POSTGRES_*`, `APP_DB_*`                                      | БД: владелец (миграции, сид) и роль бэкенда                                                     |
| `MINIO_ROOT_*`, `S3_*`                                        | MinIO: администратор и пользователь бэкенда с правами только на бакет                           |
| `INTERNAL_API_KEY`, `AUTH_ACCESS_SECRET`, `IP_HASH_SALT`      | секреты бэкенда (смена `AUTH_ACCESS_SECRET` разлогинивает админа)                               |
| `GOOGLE_SITE_VERIFICATION`, `YANDEX_VERIFICATION`             | коды подтверждения поисковиков (мета-теги)                                                      |
| `LETSENCRYPT_EMAIL`, `LETSENCRYPT_STAGING`, `NGINX_TLS_MODE`  | только вариант nginx                                                                            |
| `COMPOSE_FILE`, `VOLUMES_DIR`, `HTTP_PORT`, `HTTPS_PORT`      | выбранный прокси, папка данных, порты (ставит скрипт)                                           |

Пароли БД и MinIO после первого запуска не меняйте (данные уже созданы с ними). Остальное можно менять в
`.env` и запускать скрипт снова.

## Где лежат данные

`~/docker-volumes/gadyuka/` (точный путь — `VOLUMES_DIR` в `.env`):

| Папка                          | Что внутри                                                |
| ------------------------------ | --------------------------------------------------------- |
| `postgres/`                    | база PostgreSQL 18 (`18/docker`)                          |
| `minio/`                       | картинки (бакет `S3_BUCKET`)                              |
| `backups/pending/`             | только ещё не доставленные в Telegram архивы и их части   |
| `backend/logs/`                | `backend.log` — JSON-лог бэкенда (ротация 14 дней)        |
| `frontend/cache/`              | кэш Next.js (оптимизированные картинки)                   |
| `frontend/static/`             | статика сборки для прокси (старые сборки хранятся 7 дней) |
| `caddy/data/`, `caddy/config/` | сертификаты и настройки Caddy                             |
| `nginx/certs/`, `certbot/www/` | сертификаты Let's Encrypt и файлы проверки домена (nginx) |

`./deploy/down.sh` останавливает контейнеры, данные остаются.

## Обновление

```bash
cd /opt/gadyuka
git pull                       # или rsync новой версии
sudo ./deploy/up-caddy.sh      # тот же скрипт, что и при установке (или up-nginx.sh)
```

Скрипт пересобирает образы, применяет миграции, запускает сид (новые тексты из `shared/messages`
появляются, правки из админки остаются), пересоздаёт только изменившиеся контейнеры и удаляет старые образы.
Простой — секунды. Правки контента в админке видны сразу, без пересборки. Статика прошлой сборки хранится
ещё 7 дней — у открытых вкладок не ломаются старые скрипты.

## Бэкапы и восстановление

Контейнер `backup` каждый день в 03:30 по Москве (`BACKUP_SCHEDULE`, `BACKUP_TIMEZONE`) создаёт
`gadyuka-backup_<дата>.tar.gz` с дампом PostgreSQL и всеми медиа MinIO, затем отправляет его в тот же
Telegram-чат, что и заявки (`TELEGRAM_BOT_TOKEN`, `TELEGRAM_OWNER_ID`). Файлы больше 45 МиБ делятся на
нумерованные части. **После подтверждения доставки всех части и архив удаляются с сервера.**

```bash
sudo docker compose logs -f backup
sudo docker compose run --rm backup /opt/gadyuka-backup/backup-now.sh   # создать и отправить сейчас
```

При ошибке доставки файлы остаются в `~/docker-volumes/gadyuka/backups/pending/` (точный корень —
`VOLUMES_DIR`). Уже принятые части отмечены и повторно не отправляются; остальные будут отправлены при
следующем запуске. Новый архив всё равно создаётся ежедневно, поэтому при постоянной ошибке следите за
местом на диске и логами `backup`: неотправленные копии автоматически не удаляются. `TELEGRAM_DRY_RUN=1`
также оставляет архив локально и не вызывает Telegram.

В архивах есть заявки с персональными данными: защищайте доступ к Telegram-чату и серверу. Локальная папка
`backups/` создаётся установщиком с правами `700`.

Для восстановления скачайте архив из Telegram. Если он разбит на части, сначала соберите их в один файл
(суффиксы `.000`, `.001`, …), затем распакуйте и передайте дамп существующему скрипту:

```bash
# Только для многотомного архива:
cat gadyuka-backup_2026-11-04_033000.tar.gz.* > gadyuka-backup_2026-11-04_033000.tar.gz

mkdir -p ./gadyuka-restore
tar -xzf gadyuka-backup_2026-11-04_033000.tar.gz -C ./gadyuka-restore
sudo ./deploy/restore.sh ./gadyuka-restore/db_2026-11-04_033000.dump
```

Папка `media/` лежит рядом с дампом в архиве, поэтому `restore.sh` найдёт её автоматически. Восстановление
заменяет базу после подтверждения и работает как на том же, так и на новом сервере после `up-*.sh`.

Прежний локальный вариант без Telegram остаётся доступен отдельно:

```bash
sudo ./deploy/backup.sh        # backups/db_<дата>.dump + backups/media/ в корне репозитория
```

Его дампы старше 14 дней удаляются, а `backups/media/` только дополняется. Для локальных копий по старому
cron-расписанию используйте `deploy/backup.sh`; для ежедневной отправки в Telegram настраивать cron не нужно.

## Логи и состояние

```bash
cd /opt/gadyuka
sudo docker compose ps                          # статус и healthcheck всех сервисов
sudo docker compose logs -f backend frontend    # приложение (заявки, Telegram, ошибки)
sudo docker compose logs -f backup              # расписание, доставка и причины сохранения архивов
sudo docker compose logs -f caddy               # или: nginx certbot — HTTPS и сертификаты
sudo docker compose logs seed migrate           # последний запуск сида и миграций
sudo docker compose exec postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"'   # консоль БД
```

Логи контейнеров Docker хранит по 5 × 10 МБ на сервис; бэкенд дополнительно пишет
`~/docker-volumes/gadyuka/backend/logs/backend.log`.

## Админка

`https://<домен>/admin` — логин `ADMIN_LOGIN`, пароль `ADMIN_PASSWORD` из `.env` (аккаунт создаёт сид).
5 неверных попыток в минуту — пауза 5 минут.

- **Сменить пароль:** новое значение `ADMIN_PASSWORD` в `.env` → `sudo ./deploy/up-caddy.sh` (сид обновит
  пароль и завершит все сессии админа).
- **Включить Telegram:** [@BotFather](https://t.me/BotFather) → `/newbot` → токен; откройте бота и нажмите
  Start; chat id — у [@userinfobot](https://t.me/userinfobot). В `.env`: `TELEGRAM_BOT_TOKEN`,
  `TELEGRAM_OWNER_ID`, `TELEGRAM_DRY_RUN=0` → запуск скрипта. Проверка:
  ```bash
  curl -sS -X POST https://<домен>/api/leads -H 'Content-Type: application/json' \
    -d '{"type":"CONTACT","name":"Проверка","email":"test@example.org","message":"Тестовая заявка","locale":"ru","consent":true,"hp":""}'
  ```
  → `201 {"ok":true,"id":"…"}`. Заявка сохраняется, даже если Telegram недоступен: её можно отправить
  повторно из админки. Не больше 5 заявок за 10 минут с одного IP.

## Подготовка сервера (рекомендуется)

Один раз под root, до первого запуска:

```bash
# пользователь для работы вместо root, вход только по ключу
adduser --disabled-password --gecos "" deploy && usermod -aG sudo deploy && passwd deploy
mkdir -p /home/deploy/.ssh && cp ~/.ssh/authorized_keys /home/deploy/.ssh/ && chown -R deploy:deploy /home/deploy/.ssh
# отдельный файл с именем 00-…: в sshd побеждает первое значение, а облачные образы кладут в
# sshd_config.d свой «PasswordAuthentication yes» (правка самого sshd_config его не перебивает)
printf 'PasswordAuthentication no\nKbdInteractiveAuthentication no\nPermitRootLogin prohibit-password\n' > /etc/ssh/sshd_config.d/00-gadyuka.conf
sshd -t && systemctl restart ssh

# автоматические обновления безопасности, часовой пояс
apt-get install -y unattended-upgrades && dpkg-reconfigure -plow unattended-upgrades
timedatectl set-timezone Europe/Moscow

# swap 2 ГБ (обязательно при RAM ≤ 4 ГБ: сборка образов)
fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab

# файрвол: SSH и веб
apt-get install -y ufw
ufw default deny incoming && ufw default allow outgoing
ufw allow OpenSSH && ufw allow 80/tcp && ufw allow 443/tcp && ufw allow 443/udp && ufw enable
```

Docker публикует порты в обход UFW — поэтому в compose наружу опубликованы только 80/443 прокси, всё
остальное только во внутренних сетях. HSTS включён только для основного домена; `includeSubDomains`
добавляйте (в `deploy/caddy/Caddyfile` / `deploy/nginx/snippets/security-headers-base.conf`), только когда
**все** поддомены работают по HTTPS.

После запуска: добавьте сайт в Яндекс.Вебмастер и Google Search Console (коды — в
`YANDEX_VERIFICATION` / `GOOGLE_SITE_VERIFICATION`, затем запуск скрипта), отправьте `/sitemap.xml`.

## Частые проблемы

| Симптом                                                                               | Что проверить                                                                                                                                                                                                                                                      |
| ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| сертификат не выпускается                                                             | `dig +short <домен>` = IP сервера? открыты 80 и 443? `docker compose logs caddy` (или `certbot`)                                                                                                                                                                   |
| скрипт: «port 80 is already in use»                                                   | на сервере уже есть веб-сервер: `systemctl disable --now apache2 nginx`                                                                                                                                                                                            |
| сборка падает / сервер зависает при сборке                                            | мало памяти — добавьте swap (выше)                                                                                                                                                                                                                                 |
| в ссылках / sitemap не тот домен                                                      | `DOMAIN` и `SITE_URL` в `.env` → запуск скрипта (фронтенд пересоберётся)                                                                                                                                                                                           |
| картинки не грузятся, `/media/…` 502                                                  | `docker compose ps minio backend`, `docker compose logs minio-init backend`                                                                                                                                                                                        |
| заявки не приходят в Telegram                                                         | `TELEGRAM_DRY_RUN=0`? бот запущен (Start)? верный `TELEGRAM_OWNER_ID`? ошибка видна у заявки в админке                                                                                                                                                             |
| `seed` или `migrate` завершились с ошибкой                                            | `docker compose logs seed migrate`; после исправления — запуск скрипта                                                                                                                                                                                             |
| postgres перезапускается, `mkdir … Permission denied`                                 | Docker не может писать в папку данных: на сервере запускайте `sudo ./deploy/up-caddy.sh` **без** `--skip-host-setup`; скрипт сам выставит владельцев и, если не получится, скажет почему (rootless Docker, Docker из snap, userns-remap)                           |
| `migrate`: `P1000 Authentication failed` / postgres: `password authentication failed` | `.env` создан заново, а база в `~/docker-volumes/gadyuka/postgres` осталась от прошлой установки с другим паролем. Скрипт сам выставляет владельцу базы пароль из `.env` — просто запустите его снова. Для тестовой установки без данных можно и удалить эту папку |

## Ограничения

- Посетители по IPv6: без IPv6 в самом Docker (`ip6tables` + `enable_ipv6` у сети) их соединения приходят
  в контейнер прокси через docker-proxy с внутреннего адреса — лимиты заявок и входа считаются для всех
  IPv6-посетителей вместе. По IPv4 адрес посетителя настоящий.
- Вариант nginx: только gzip (нет модулей brotli / zstd), без HTTP/3.
- Один экземпляр frontend и backend (обновление сессии админки и кэши — в памяти процесса).

## Локальная разработка

```bash
# бэкенд: PostgreSQL :5433 и MinIO :9010 в Docker, API на http://127.0.0.1:4000
cd backend && npm ci && cp .env.example .env    # заполнить пустые секреты
docker compose up -d && npm run prisma:deploy && npm run db:seed && npm run start:dev

# фронтенд: http://localhost:3000 (именно localhost, не 127.0.0.1)
cd frontend && npm ci && cp .env.example .env   # INTERNAL_API_KEY = значение из backend/.env
npm run dev -- -H localhost
```

Весь продакшен-стек локально (только Docker Desktop / OrbStack на macOS или Windows — на Linux-сервере этот флаг не нужен, запускайте через `sudo` без него):
`DOMAIN=localhost HTTP_PORT=8080 HTTPS_PORT=8443 ./deploy/up-caddy.sh --skip-host-setup` → `https://localhost:8443`
(у Caddy свой локальный сертификат; для nginx — `./deploy/up-nginx.sh --self-signed --skip-host-setup`).

## Документация

- [frontend/README.md](frontend/README.md) — сайт и админка, что где менять.
- [frontend/docs/ARCHITECTURE.md](frontend/docs/ARCHITECTURE.md), [CONVENTIONS.md](frontend/docs/CONVENTIONS.md) — устройство фронтенда.
- [frontend/docs/COMPRESSION.md](frontend/docs/COMPRESSION.md) — сжатие и что делает прокси.
- [backend/README.md](backend/README.md) — API, окружение, сид, тесты; [backend/docs/](backend/docs/CLAUDE.md) — правила кода.
- [shared/README.md](shared/README.md), [shared/contracts/README.md](shared/contracts/README.md) — тексты и типы API.
- Файлы деплоя: `docker-compose.yml` (+ `docker-compose.caddy.yml` / `docker-compose.nginx.yml`),
  `deploy/` (скрипты, `caddy/Caddyfile`, `nginx/`), `backend/Dockerfile`, `frontend/Dockerfile`, `.env.example`.
