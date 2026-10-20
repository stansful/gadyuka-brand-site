# ГАДЮКА — развёртывание на VPS (Финляндия, Ubuntu 24.04)

Пошаговая инструкция: от чистого сервера до работающего сайта с HTTPS, заявками в Telegram и ежедневными бэкапами.

## Как это устроено

```
Интернет ──► caddy :80/:443 ──► app:3000 (Next.js: сайт + /admin + /api/leads + /media/*)
             (HTTPS, Let's            │                          │
              Encrypt)                ▼                          ▼
                       db (PostgreSQL 17)        minio (S3-хранилище картинок, бакет S3_BUCKET)
                       — только внутри сервера   — только внутри сервера, наружу не открыт
```

| Сервис       | Что делает                                                                                                                                                         | Данные (тома Docker)               |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------- |
| `caddy`      | HTTPS-сертификат для `DOMAIN`, прокси на приложение                                                                                                                | `gadyuka_caddy_data` (сертификаты) |
| `app`        | сайт Next.js; подключается к БД ролью `APP_DB_USER` — только чтение/запись строк, без права менять схему; отдаёт картинки по адресам `/media/…`, читая их из MinIO | —                                  |
| `db`         | PostgreSQL 17; порт открыт **только** на `127.0.0.1`; при первом запуске создаёт роль `APP_DB_USER` (`deploy/postgres/initdb`)                                    | `gadyuka_pgdata` (база)            |
| `minio`      | S3-хранилище картинок (загрузки из админки и стартовые картинки сида); порт не опубликован, веб-консоль выключена                                                  | `gadyuka_minio_data` (картинки)    |
| `minio-init` | при каждом `docker compose up` создаёт бакет и отдельного пользователя MinIO для приложения (права только на этот бакет) и завершается                             | —                                  |
| `tools`      | разовые задачи: миграции, наполнение базы (сид, вместе с загрузкой стартовых картинок в MinIO) — от суперпользователя `POSTGRES_USER`. Не запускается сам          | —                                  |

Картинки хранятся в бакете MinIO закрыто: браузер получает их только через приложение по адресу `/media/<admin|user>/<id владельца>/<uuid>/image.webp` (кэш на год — файл по одному адресу никогда не меняется). Образ MinIO — `pgsty/minio` (поддерживаемая сообществом сборка того же сервера: официальный образ `minio/minio` больше не публикуется); версия закреплена в `docker-compose.yml`.

Важная особенность: при сборке образа (`docker compose build app`) Next.js заранее рендерит страницы `/` и `/en` **из базы данных**. Поэтому база должна быть запущена и с применёнными миграциями **до** сборки приложения — порядок команд ниже это учитывает.

Файлы деплоя в репозитории: `Dockerfile`, `docker-compose.yml`, `Caddyfile`, `deploy`, `.dockerignore`, `.env.example`.

---

## 1. Сервер

Рекомендуемый минимум: **2 vCPU, 4 ГБ RAM, 40 ГБ SSD**, Ubuntu 24.04 LTS, дата-центр в Финляндии (например, Хельсинки). На 2 ГБ RAM сборка тоже пройдёт, но обязательно со swap (шаг 2.3).

### 1.1. Вход по SSH-ключу

На своём компьютере (если ключа ещё нет):

```bash
ssh-keygen -t ed25519 -C "gadyuka-vps"
ssh-copy-id root@<IP-сервера>
ssh root@<IP-сервера>
```

## 2. Первичная настройка сервера

### 2.1. Обновления и пользователь для деплоя

```bash
apt update && apt -y upgrade
apt -y install ca-certificates curl git ufw unattended-upgrades
dpkg-reconfigure -plow unattended-upgrades      # автоматические обновления безопасности → Yes

adduser --disabled-password --gecos "" deploy
usermod -aG sudo deploy
mkdir -p /home/deploy/.ssh && cp ~/.ssh/authorized_keys /home/deploy/.ssh/
chown -R deploy:deploy /home/deploy/.ssh && chmod 700 /home/deploy/.ssh && chmod 600 /home/deploy/.ssh/authorized_keys
passwd deploy                                    # пароль нужен для sudo
```

### 2.2. Запрет входа по паролю

Убедитесь, что вход `ssh deploy@<IP>` по ключу работает, затем:

```bash
sudo sed -i 's/^#\?PasswordAuthentication .*/PasswordAuthentication no/; s/^#\?PermitRootLogin .*/PermitRootLogin prohibit-password/' /etc/ssh/sshd_config
sudo systemctl restart ssh
```

### 2.3. Swap (обязательно при RAM ≤ 4 ГБ)

```bash
sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile
sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

### 2.4. Часовой пояс (для логов и бэкапов)

```bash
sudo timedatectl set-timezone Europe/Moscow
```

## 3. Установка Docker

Официальный репозиторий Docker для Ubuntu 24.04:

```bash
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
  | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt update
sudo apt -y install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

sudo usermod -aG docker deploy      # перелогиньтесь, чтобы группа применилась
docker --version && docker compose version
```

## 4. Файрвол

Открыты только SSH и веб (HTTP/3 использует 443/udp):

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 443/udp
sudo ufw enable
sudo ufw status verbose
```

> Docker публикует порты в обход UFW. Поэтому в `docker-compose.yml` наружу опубликованы только 80/443 (Caddy), а PostgreSQL — исключительно на `127.0.0.1`. Не меняйте это без необходимости.

## 5. DNS

У регистратора домена создайте записи (TTL 300–3600):

| Тип    | Имя   | Значение                               |
| ------ | ----- | -------------------------------------- |
| `A`    | `@`   | IPv4 сервера                           |
| `AAAA` | `@`   | IPv6 сервера (если есть)               |
| `A`    | `www` | IPv4 сервера (необязательно, см. ниже) |

Проверка (должен вернуться IP сервера):

```bash
dig +short gadyuka.ru
```

Caddy получит сертификат Let's Encrypt автоматически при первом запуске — для этого домен **уже** должен указывать на сервер, а порты 80/443 быть открыты. Чтобы `www.домен` перенаправлялся на основной домен, раскомментируйте блок `www.{$DOMAIN}` в конце `Caddyfile`.

Сжатие ответов — блок `encode` в `Caddyfile` (zstd уровня `better`, для браузеров без zstd — gzip 6). После правки `Caddyfile` проверьте его до перезапуска: `docker compose exec caddy caddy validate --config /etc/caddy/Caddyfile`, затем `docker compose restart caddy`; сжатие видно так: `curl -s -o /dev/null -w '%{size_download}\n' -H 'Accept-Encoding: zstd' https://домен/` (и с `gzip`).

HSTS (`Strict-Transport-Security` в `Caddyfile`) сейчас действует только на основной домен. Когда **все** поддомены (www, почта и т. п.) будут открываться по HTTPS, допишите в это значение `; includeSubDomains` — браузеры запоминают его на год, поэтому раньше времени включать нельзя.

## 6. Код на сервере

```bash
sudo mkdir -p /opt/gadyuka && sudo chown deploy:deploy /opt/gadyuka
cd /opt/gadyuka
git clone <URL-репозитория> .
```

Если репозитория нет — скопируйте проект со своего компьютера (без `node_modules`, `.next`, `.env`):

```bash
rsync -av --exclude node_modules --exclude .next --exclude .env --exclude src/generated \
  ./ deploy@<IP-сервера>:/opt/gadyuka/
```

## 7. Файл `.env`

```bash
cd /opt/gadyuka
cp .env.example .env
chmod 600 .env
openssl rand -hex 24      # → POSTGRES_PASSWORD (суперпользователь БД)
openssl rand -hex 24      # → APP_DB_PASSWORD (роль приложения)
openssl rand -hex 32      # → IP_HASH_SALT
openssl rand -base64 24   # → ADMIN_PASSWORD (пароль админки)
openssl rand -hex 32      # → ADMIN_SESSION_SECRET
openssl rand -hex 24      # → MINIO_ROOT_PASSWORD (администратор MinIO)
openssl rand -hex 24      # → S3_SECRET_ACCESS_KEY (пользователь MinIO для приложения)
nano .env
```

Заполните так (пример для домена `gadyuka.ru`):

```dotenv
DOMAIN=gadyuka.ru
SITE_URL=https://gadyuka.ru

# Суперпользователь БД — только для контейнера db и служебного tools (миграции, сид)
POSTGRES_USER=gadyuka
POSTGRES_PASSWORD=<первый результат openssl rand -hex 24>
POSTGRES_DB=gadyuka
# Роль, которой подключается сайт: только чтение/запись строк, без права менять схему
APP_DB_USER=gadyuka_app
APP_DB_PASSWORD=<второй результат openssl rand -hex 24>
# Роль приложения и её пароль. Хост 127.0.0.1 — для сборки образа; контейнер app сам заменяет его на db
DATABASE_URL=postgresql://gadyuka_app:<APP_DB_PASSWORD>@127.0.0.1:5432/gadyuka?schema=public

TELEGRAM_BOT_TOKEN=<токен от @BotFather, раздел 10>
TELEGRAM_OWNER_ID=<ваш chat id, раздел 10>
TELEGRAM_DRY_RUN=0

# Хранилище картинок (MinIO). Администратор MinIO — только для контейнеров minio и minio-init (и бэкапов)
MINIO_ROOT_USER=gadyuka-root
MINIO_ROOT_PASSWORD=<результат openssl rand -hex 24>
# Пользователь MinIO, которым работает сайт: minio-init создаёт его с правами только на бакет S3_BUCKET
S3_BUCKET=gadyuka-media
S3_ACCESS_KEY_ID=gadyuka-app
S3_SECRET_ACCESS_KEY=<ещё один результат openssl rand -hex 24>
S3_REGION=us-east-1
# Адрес хранилища задаёт docker-compose.yml (http://minio:9000); строка ниже — только для порядка
S3_ENDPOINT=http://minio:9000
S3_FORCE_PATH_STYLE=1

# Обязательно (не короче 16 символов): без него форма заявок не работает
IP_HASH_SALT=<результат openssl rand -hex 32>

# Обязательно (не короче 16 символов): без пароля админка в production ЗАКРЫТА для всех
ADMIN_PASSWORD=<результат openssl rand -base64 24>
# Подписывает сессии админки вместе с паролем; смена значения разлогинивает всех
ADMIN_SESSION_SECRET=<результат openssl rand -hex 32>
# Только если осознанно нужна админка БЕЗ пароля (не рекомендуется): ADMIN_ALLOW_OPEN=1
ADMIN_ALLOW_OPEN=

# Необязательно: подтверждение прав в Яндекс.Вебмастере / Google Search Console (код из мета-тега)
YANDEX_VERIFICATION=
GOOGLE_SITE_VERIFICATION=
```

Правила:

- пароли БД и MinIO — только из `openssl rand -hex …` (без спецсимволов, чтобы не ломать `DATABASE_URL` и команды `mc`);
- `S3_ACCESS_KEY_ID` не должен совпадать с `MINIO_ROOT_USER`: сайт работает отдельным пользователем MinIO без прав администратора. Пароль этого пользователя можно сменить в `.env` в любой момент — `minio-init` применит его при следующем `docker compose up -d`;
- `ADMIN_PASSWORD` задаётся **до** первого запуска: админка доступна из интернета сразу после `docker compose up`. Без пароля (или с паролем короче 16 символов) production-админка не открывается никому, а на `/admin/login` объяснено, что настроить. Сохраните пароль в менеджере паролей;
- `SITE_URL` — ровно `https://<DOMAIN>`, без слеша в конце: из него строятся canonical, hreflang, sitemap и Open Graph (значение «запекается» при сборке — после изменения пересоберите `app`);
- `.env` никогда не попадает в образ: при сборке он передаётся как секрет BuildKit только на время `next build`.

## 8. Первый запуск

Все команды — из `/opt/gadyuka`.

```bash
# 1) база данных (при первом запуске пустого тома сама создаёт роль APP_DB_USER)
docker compose up -d db
docker compose logs db | grep app-role     # → [app-role] role "gadyuka_app" is ready

# 1а) хранилище картинок: бакет и пользователь MinIO для сайта
docker compose up -d minio minio-init
docker compose logs minio-init             # → Bucket created … / Added user `gadyuka-app` … / Attached Policies: [app-media]

# 2) образ для служебных задач и миграции (от суперпользователя POSTGRES_USER)
docker compose --profile tools build tools
docker compose --profile tools run --rm tools npx prisma migrate deploy

# 3) наполнение базы стартовым контентом (тексты ru/en, коллекция «Меня запомнят»; картинки — в MinIO)
docker compose --profile tools run --rm tools npm run db:seed

# 4) сборка приложения (нужна запущенная и мигрированная БД, ~3–6 минут)
docker compose build app

# 5) запуск всего стека
docker compose up -d
docker compose ps
docker compose logs -f app caddy        # Ctrl+C — выйти из логов
```

Проверьте:

- `https://<домен>/` и `https://<домен>/en` — сайт на русском и английском;
- `https://<домен>/robots.txt`, `https://<домен>/sitemap.xml`, `https://<домен>/manifest.webmanifest`;
- картинки на главной загружаются; любая из них открывается по адресу вида `https://<домен>/media/admin/…/image.webp` (адрес — в админке → «Медиатека» → картинка → «Открыть файл»);
- `https://<домен>/admin` — открывается страница входа; войдите паролем `ADMIN_PASSWORD`;
- заявка из формы «Связаться» приходит в Telegram и видна в админке → «Заявки».

Сид можно запускать повторно: если база уже засеяна (есть «Настройки сайта»), он только добавляет недостающие блоки контента и стартовые картинки, а коллекции, товары, отзывы, новости, галерею, спецпредложения, партнёров и настройки **не трогает** — удалённое или переименованное в админке не вернётся. `SEED_OVERWRITE=1` (`docker compose --profile tools run --rm -e SEED_OVERWRITE=1 tools npm run db:seed`) **сбрасывает** засеянные записи к исходным (и восстанавливает удалённые демо-записи, фото товаров — по сиду) — используйте осознанно.

### 8.1. Если сервер был развёрнут до появления роли `APP_DB_USER`

База уже существует, поэтому скрипт роли не запускался автоматически. Один раз:

```bash
nano .env        # добавьте APP_DB_USER, APP_DB_PASSWORD, ADMIN_PASSWORD, ADMIN_SESSION_SECRET (раздел 7)
                 # и замените в DATABASE_URL пользователя/пароль на APP_DB_USER/APP_DB_PASSWORD
docker compose up -d db                                                 # пересоздаёт db с новыми переменными
docker compose exec db sh /docker-entrypoint-initdb.d/10-app-role.sh    # создаёт роль и выдаёт права
docker compose build app && docker compose up -d                        # приложение — уже под новой ролью
```

Тот же `exec … 10-app-role.sh` нужен после смены `APP_DB_PASSWORD`.

## 9. Обновление сайта

```bash
cd /opt/gadyuka
git pull                                                     # или rsync новой версии

docker compose --profile tools build tools                   # новый код + миграции
docker compose --profile tools run --rm tools npx prisma migrate deploy
docker compose --profile tools run --rm tools npm run db:seed   # новые тексты из messages/*.json, правки админки не трогает
docker compose build app                                     # сборка из актуальной БД
docker compose up -d                                         # пересоздаёт изменившиеся контейнеры
docker image prune -f                                        # удалить старые образы
```

Миграции и сид выполняются **до** сборки, потому что сборка читает базу. Делает это только `tools` (суперпользователь): контейнер `app` работает ролью без права менять схему, поэтому сам миграции не запускает (`SKIP_MIGRATIONS=1` в `docker-compose.yml`). Новые таблицы из миграций автоматически получают права для роли приложения. Простой при обновлении — несколько секунд на пересоздание контейнера.

Повторный сид на рабочей базе безопасен: он создаёт тексты (`Message`), которых ещё нет, обновляет тексты, которые никто не правил в админке, до нового значения из `messages`, а тексты, картинки и записи, изменённые в админке, не трогает. Если шаг пропустить, сайт всё равно покажет новые тексты — из JSON по умолчанию.

> **20.10.2026 миграции пересобраны в одну init-миграцию** (тексты в БД, медиа в MinIO). Сервер, развёрнутый раньше, не обновляется через `migrate deploy`: реальных данных там не было, поэтому разверните его заново — `docker compose down -v` (удалит базу и старый том `uploads`), затем раздел 8 целиком.

Не задавайте `HOSTNAME=127.0.0.1` для контейнера `app`: при таком адресе Next.js считает запросы «локальными» и прокси языков уходит в цикл редиректов. В `docker-compose.yml` стоит `0.0.0.0` — так и оставьте.

Правки контента в админке появляются на сайте сразу, пересборка для них не нужна.

## 10. Telegram: бот для заявок

### 10.1. Создание бота

1. В Telegram откройте [@BotFather](https://t.me/BotFather) → `/newbot` → придумайте имя и username (должен заканчиваться на `bot`).
2. BotFather пришлёт токен вида `123456789:AA…` → это `TELEGRAM_BOT_TOKEN`. Никому его не пересылайте и не публикуйте.
3. **Откройте своего бота и нажмите «Start»** — без этого бот не сможет вам писать.

### 10.2. Ваш chat id (`TELEGRAM_OWNER_ID`)

Самый простой способ — написать боту [@userinfobot](https://t.me/userinfobot): он ответит вашим `Id` (число). Для группы: добавьте бота в группу, отправьте в ней сообщение и выполните на сервере (токен не попадёт в историю команд благодаря пробелу в начале и `read`):

```bash
 read -rs TOKEN && curl -s "https://api.telegram.org/bot$TOKEN/getUpdates" | grep -o '"chat":{"id":-\?[0-9]*' ; unset TOKEN
```

### 10.3. Включение

В `.env`: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_OWNER_ID`, `TELEGRAM_DRY_RUN=0`, затем:

```bash
docker compose up -d --force-recreate app
```

Проверочная заявка:

```bash
curl -sS -X POST https://<домен>/api/leads \
  -H 'Content-Type: application/json' \
  -d '{"type":"CONTACT","name":"Проверка","email":"test@example.org","message":"Тестовая заявка","locale":"ru","consent":true,"hp":""}'
# → {"ok":true,"id":"…"} (HTTP 201), сообщение в Telegram через пару секунд
```

Если Telegram недоступен или настроен неверно, заявка **всё равно сохраняется** в базе: в админке у неё будет отметка «не отправлено в Telegram» и текст ошибки, а кнопка повторной отправки отправит её ещё раз. Причины смотрите в логах: `docker compose logs app | grep telegram`. Если забыть `TELEGRAM_DRY_RUN=1`, заявки тоже помечаются «не отправлено», а в админке висит жёлтое предупреждение.

С одного IP (для IPv6 — с одной сети /64) принимается не больше 5 заявок за 10 минут (ответ 429). Если на весь сайт пришло больше 60 заявок за 10 минут (флуд), новые заявки сохраняются, но в Telegram автоматически не отправляются — в админке они помечены «не отправлено», настоящие можно отправить кнопкой повторной отправки.

## 11. Смена (ротация) токена Telegram-бота

Нужно, если токен мог утечь, или для плановой смены:

1. [@BotFather](https://t.me/BotFather) → `/mybots` → выберите бота → **API Token** → **Revoke current token**. Старый токен перестаёт работать сразу.
2. Скопируйте новый токен и замените `TELEGRAM_BOT_TOKEN` в `/opt/gadyuka/.env` (`nano .env`).
3. Перезапустите приложение: `docker compose up -d --force-recreate app`.
4. Проверьте: отправьте тестовую заявку (раздел 10.3) или нажмите «Отправить повторно» у любой заявки в админке.

Пересобирать образ не нужно — токен читается при запуске контейнера. Заявки, пришедшие между шагами 1 и 3, сохранены в базе — отправьте их повторно из админки.

## 12. Пароль админки (`ADMIN_PASSWORD`)

Пароль задаётся ещё в разделе 7, до первого запуска. В production без него (или с паролем короче 16 символов) `/admin` закрыта для всех — это защита от случайно открытой админки с заявками и личными данными клиентов.

Смена пароля:

```bash
openssl rand -base64 24          # новый пароль (не короче 16 символов)
nano .env                        # ADMIN_PASSWORD=<пароль>
docker compose up -d --force-recreate app
```

Вход — на странице `/admin/login`, сессия живёт 3 дня. После смены `ADMIN_PASSWORD` или `ADMIN_SESSION_SECRET` все ранее выданные сессии становятся недействительны — так же можно срочно «выкинуть» всех, если пароль или cookie могли утечь. После 10 неверных попыток с одного IP вход блокируется на 15 минут.

Открыть админку без пароля можно только явно: `ADMIN_PASSWORD=` пусто и `ADMIN_ALLOW_OPEN=1`, затем пересоздать контейнер. Так делать не рекомендуется: любой посетитель увидит заявки с телефонами и почтой.

## 13. Бэкапы (PostgreSQL + картинки из MinIO)

### 13.1. Скрипт

```bash
sudo mkdir -p /opt/gadyuka/backups && sudo chown deploy:deploy /opt/gadyuka/backups
chmod 700 /opt/gadyuka/backups      # дампы с личными данными — только для deploy
nano /opt/gadyuka/backup.sh
```

Каталог `backups/` внесён в `.gitignore`: дампы не должны попасть в git, даже если выполнить `git add .` в `/opt/gadyuka`.

```sh
#!/bin/sh
# Ежедневный бэкап ГАДЮКИ: дамп PostgreSQL (хранит 14 дней) + копия бакета картинок MinIO.
set -eu
# Дампы содержат все заявки (имена, телефоны, e-mail) — файлы доступны только владельцу.
umask 077
cd /opt/gadyuka
STAMP=$(date +%Y-%m-%d_%H%M)
DIR=/opt/gadyuka/backups
mkdir -p "$DIR/media"
chmod 700 "$DIR"

docker compose exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > "$DIR/db_$STAMP.dump"

# Картинки: зеркало бакета обычными файлами (backups/media/<ключ>). Только докачивает новое и
# ничего не удаляет: файл по одному адресу никогда не меняется, поэтому в зеркале есть картинки
# для любого из хранимых дампов, даже удалённые потом в админке.
BUCKET=$(sed -n 's/^S3_BUCKET=//p' .env | tail -n 1)
docker compose run --rm --no-deps -T -u "$(id -u):$(id -g)" -e BUCKET="${BUCKET:-gadyuka-media}" \
  -v "$DIR/media":/backup/media --entrypoint /bin/sh minio -c \
  'mc alias set local http://minio:9000 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD" >/dev/null &&
   mc mirror --quiet --overwrite "local/$BUCKET" /backup/media >/dev/null'

find "$DIR" -maxdepth 1 -type f -name 'db_*.dump' -mtime +14 -delete
echo "backup ok: $STAMP"
```

Зеркало `backups/media/` растёт вместе с медиатекой (каждая загрузка — один WebP до 2400 px, обычно 100–600 КБ). Если нужно освободить место, удалите его целиком — следующий запуск скачает текущее содержимое бакета заново.

```bash
chmod +x /opt/gadyuka/backup.sh
/opt/gadyuka/backup.sh && ls -lh /opt/gadyuka/backups      # проверка вручную
```

### 13.2. Расписание (cron)

```bash
crontab -e
```

```cron
30 3 * * * /opt/gadyuka/backup.sh >> /opt/gadyuka/backups/backup.log 2>&1
```

Копии на том же сервере не спасут при потере сервера — регулярно забирайте их наружу, например с домашнего компьютера:

```bash
rsync -av deploy@<IP-сервера>:/opt/gadyuka/backups/ ~/gadyuka-backups/
```

(или настройте `rclone` в S3-совместимое хранилище и добавьте его вызов в конец `backup.sh`). Каталог `backups/media/` создаётся контейнером от имени пользователя `deploy`, поэтому `rsync` забирает его вместе с дампами.

### 13.3. Восстановление

```bash
cd /opt/gadyuka
docker compose stop app
# база (дамп формата custom, -c = удалить и пересоздать объекты)
docker compose exec -T db sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c --if-exists' < backups/db_2026-10-16_0330.dump
# права роли приложения на восстановленные таблицы
docker compose exec db sh /docker-entrypoint-initdb.d/10-app-role.sh
# картинки: бакет и пользователь приложения (на новом сервере), затем файлы из зеркала
docker compose up -d minio minio-init
BUCKET=$(sed -n 's/^S3_BUCKET=//p' .env | tail -n 1)
docker compose run --rm --no-deps -T -e BUCKET="${BUCKET:-gadyuka-media}" \
  -v /opt/gadyuka/backups/media:/backup/media:ro --entrypoint /bin/sh minio -c \
  'mc alias set local http://minio:9000 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD" >/dev/null &&
   mc mirror --overwrite /backup/media "local/$BUCKET"'
docker compose up -d app
```

Восстанавливать картинки можно и поверх работающего хранилища: `mc mirror` только добавляет недостающие файлы. Тип файла (`image/webp`) MinIO определяет по расширению.

После восстановления сохраните любую запись в админке — это обновит кэш сайта.

## 14. Обслуживание и диагностика

```bash
docker compose ps                         # статус и healthcheck
docker compose logs -f --tail=200 app     # логи приложения (заявки, Telegram, ошибки)
docker compose logs -f caddy              # HTTPS / сертификаты
docker compose restart app                # перезапуск приложения
docker compose exec db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"'   # консоль БД
docker compose logs minio minio-init      # хранилище картинок
docker system df                          # место, занятое Docker
df -h                                     # место на диске
```

Частые проблемы:

| Симптом                                                      | Что проверить                                                                                                                                                                   |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docker compose build app` падает с ошибкой подключения к БД | запущена ли `db` (`docker compose up -d db`), совпадает ли пароль в `DATABASE_URL` и `APP_DB_PASSWORD`, создана ли роль (раздел 8.1), хост в `DATABASE_URL` — `127.0.0.1`       |
| `permission denied for table …` в логах `app`                | роль приложения без прав — выполните `docker compose exec db sh /docker-entrypoint-initdb.d/10-app-role.sh`                                                                     |
| `/admin` пишет «Админка закрыта»                             | не задан `ADMIN_PASSWORD` или он короче 16 символов (раздел 12)                                                                                                                 |
| картинки не показываются, `/media/…` отвечает 502            | `docker compose ps minio` (healthy?), `docker compose logs minio-init` (завершился с кодом 0?), `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` в `.env`; в логах `app` — `[media]` |
| `/media/…` отвечает 404 для картинки из админки              | файла нет в бакете (например, бакет восстановлен не полностью) — восстановите картинки из `backups/media` (раздел 13.3)                                                         |
| загрузка в админке: «Не удалось сохранить файл»              | MinIO недоступен или у пользователя приложения нет прав — `docker compose up -d minio-init`, логи `app` (`[admin] media upload failed`)                                         |
| форма заявок отвечает ошибкой 500, в логах `IP_HASH_SALT`    | задайте `IP_HASH_SALT` (раздел 7) и пересоздайте `app`                                                                                                                          |
| сборка падает на «relation … does not exist»                 | не применены миграции — выполните шаг 2 из раздела 8                                                                                                                            |
| сертификат не выпускается                                    | DNS указывает на сервер? открыты 80 и 443? `docker compose logs caddy`                                                                                                          |
| заявки не приходят в Telegram                                | `TELEGRAM_DRY_RUN=0`? бот запущен вами (/start)? верен `TELEGRAM_OWNER_ID`? в админке у заявки видна ошибка                                                                     |
| в ссылках / sitemap неверный домен                           | `SITE_URL` в `.env` → пересоберите `app` (раздел 9)                                                                                                                             |
| сборка падает из-за нехватки памяти                          | добавьте swap (раздел 2.3)                                                                                                                                                      |

## 15. SEO после запуска

- Добавьте сайт в [Яндекс.Вебмастер](https://webmaster.yandex.ru/) и [Google Search Console](https://search.google.com/search-console); код подтверждения из мета-тега впишите в `YANDEX_VERIFICATION` / `GOOGLE_SITE_VERIFICATION` и пересоберите `app`.
- Отправьте в них `https://<домен>/sitemap.xml`.
- `robots.txt` закрывает от индексации `/admin` и `/api/`; страницы админки дополнительно помечены `noindex`.
- Картинку для соцсетей (Open Graph), заголовки и описания для каждого языка меняйте в админке → «Настройки». Если OG-картинка не выбрана, используется фирменная `/opengraph-image.png`.
