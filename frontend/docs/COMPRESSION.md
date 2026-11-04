# Сжатие ответов: что делает сборка и что должен делать прокси

Короткая памятка для настройки обратного прокси (Caddy или nginx корневого docker-compose репозитория).
Здесь — только требования к нему; конфиги: `deploy/caddy/Caddyfile` и `deploy/nginx/` в корне
репозитория (как запускать — корневой `readme_dev.md`).

## Что уже делает сборка

`npm run build` → `postbuild` → `scripts/precompress.mjs` пишет рядом с каждым текстовым файлом
сборки предсжатые копии:

| Копия        | Алгоритм                       | Когда есть                           |
| ------------ | ------------------------------ | ------------------------------------ |
| `<файл>.br`  | brotli, качество 11 (максимум) | всегда                               |
| `<файл>.zst` | zstd, уровень 19 (окно ≤ 8 МБ) | если в Node есть `zlib.zstdCompress` |
| `<файл>.gz`  | gzip -9                        | всегда                               |

- Каталоги: `.next/static` и `public` (и их копии в `.next/standalone`, если туда что-то скопировано).
  Docker-образ фронтенда берёт `public` и `.next/static` из сборки — копии попадают в образ вместе с
  оригиналами.
- Расширения: `js mjs cjs css svg json txt xml webmanifest html map`. Уже сжатые форматы
  (`woff2`, `png`, `jpg`, `webp`, `avif`, `ico`) не трогаются.
- Файлы меньше 1 КБ и файлы, которые не стали меньше, остаются без копий — их прокси отдаёт как есть.
- Скрипт идемпотентный (копия не старше оригинала, которая распаковывается в него же, — пропускается,
  иначе пересоздаётся; копия без оригинала — удаляется),
  ручной запуск: `npm run compress-assets`. Копии в `public/` в git не попадают (`.gitignore`).

Объём (сборка 21.10.2026): `.next/static` 1376 КиБ → br 399 КиБ / zst 430 КиБ / gz 453 КиБ;
`public` 392 КиБ → br 106 КиБ / zst 113 КиБ / gz 124 КиБ (бренд-SVG: `head-closeup-ink.svg` 147 КБ →
br 41 КБ против gzip 49 КБ). Время — около секунды.

## Next сам по себе

`compress: true` в `next.config.ts` оставлен: это запасной gzip для запросов мимо прокси
(`next start`, healthcheck, ошибка в конфиге прокси). Next умеет только gzip, и **не сжимает
ответ, если в запросе нет `Accept-Encoding`** (проверено). Сам Next предсжатые `.br/.gz` не отдаёт —
они нужны только прокси.

## Что должен делать прокси

### 1. Статика сборки — с диска, предсжатой копией

| URL                     | Файл на диске                   | Cache-Control                                                                                           |
| ----------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `/_next/static/*`       | `.next/static/*` (без `/_next`) | `public, max-age=31536000, immutable` (имена с хэшем содержимого)                                       |
| `/brand/*` с `?v=…`     | `public/brand/*`                | `public, max-age=31536000, immutable`                                                                   |
| `/brand/*` без `?v`     | `public/brand/*`                | `public, max-age=0, must-revalidate`                                                                    |
| прочие файлы `public/*` | `public/*`                      | `public, max-age=0` (как у Next); можно и не отдавать с диска, а проксировать — их почти не запрашивают |

- Выбор копии по `Accept-Encoding` клиента с учётом q-значений; при равенстве порядок
  предпочтения **br → zstd → gzip** (br q11 меньше всех: JS лендинга 186.6 КиБ против 219.8 КиБ в gzip, −15 %). Нет
  подходящей копии или клиент не принимает сжатие → оригинал без `Content-Encoding`.
- Ответ с копией: `Content-Encoding` по копии, `Content-Type` и `Content-Length` — оригинала и
  копии соответственно, **`Vary: Accept-Encoding`** у всех вариантов (и у несжатого тоже),
  ETag свой у каждой копии (у Caddy так и есть). Range-запросы — по выбранной копии.
- Те же заголовки безопасности, что и у остальных ответов (как в `next.config.ts` → `headers()`).
- Файла нет на диске → передать запрос в Next (он ответит 404 сам), а не отдавать свою страницу.
- Caddy: `file_server` с `precompressed br zstd gzip` (сжатие на лету для этих путей не нужно —
  копии уже есть; файлы < 1 КБ без копий можно отдать как есть). Нужен Caddy ≥ 2.11.7: 2.10.x отвечал
  на любую предсжатую копию `206 Partial Content` даже без `Range` (неверный ответ на обычный запрос)
  (проверка: `curl -s -o /dev/null -w '%{http_code}' -H 'Accept-Encoding: br' https://домен/_next/static/…`
  → `200`). Прокси читает `.next/static` и `public`
  из общей папки `~/docker-volumes/gadyuka/frontend/static`: контейнер `frontend` при каждом старте
  выкладывает туда файлы своей сборки (`frontend/docker/publish-static.mjs`; файлы прошлых сборок живут
  ещё 7 дней), прокси монтирует её только на чтение.
- nginx: `gzip_static on;` (есть в официальном образе). `brotli_static on;` (модуль ngx_brotli) и
  `zstd_static on;` (zstd-nginx-module) требуют своей сборки nginx — в корневом варианте nginx их нет,
  статика отдаётся `.gz`-копиями, динамика — gzip 6.

### 2. Динамика (HTML, RSC, JSON, Server Actions) — сжимает сам прокси

- **Не передавать `Accept-Encoding` в Next** (Caddy: `header_up -Accept-Encoding` в `reverse_proxy`;
  nginx: `proxy_set_header Accept-Encoding "";`). Иначе Next отвечает своим gzip, а уже сжатый ответ
  прокси повторно не сжимает — посетитель получает gzip вместо zstd, Node тратит время на сжатие. Проверка после настройки:
  `curl -s -D - -o /dev/null -H 'Accept-Encoding: zstd' https://домен/` → `Content-Encoding: zstd`.
- Сжимать: `text/html`, `text/x-component` (RSC и ответы Server Actions), `application/json`,
  `text/plain`, `application/xml` / `text/xml` (sitemap), `application/manifest+json`,
  `image/svg+xml`, `application/javascript`, `text/css`. Не сжимать: картинки `/_next/image` и
  `/media/*` (AVIF/WebP/PNG/JPEG), `woff2`.
- Алгоритм для динамики: zstd среднего уровня (Caddy `zstd better` ≈ уровень 7) или brotli 4–6
  (nginx), запасной gzip 6 для клиентов без них. Brotli 11 для динамики слишком медленный.
- `Vary`: **добавить** `Accept-Encoding` к `Vary` от Next, не заменяя его (Next ставит
  `Vary: rsc, next-router-state-tree, next-router-prefetch, next-router-segment-prefetch, Accept-Encoding` —
  HTML и RSC одного URL различаются по этим заголовкам).
- Не ломать стриминг: Next отдаёт HTML частями (сначала статическая оболочка, потом динамические
  части), без `Content-Length`. Прокси не должен копить ответ целиком, а сжатие — сбрасывать
  буфер вместе с апстримом (Caddy сбрасывает сразу ответы без `Content-Length`; nginx —
  `proxy_buffering off` для страниц). Проверить на шаге 5 по времени до первого байта.
- `Cache-Control` динамики не трогать (Next ставит `s-maxage=3600, stale-while-revalidate=…` для
  пререндера и `no-store` для API).
- Ответы меньше ~256 байт (редиректы, 304) не сжимать (Caddy: `minimum_length 256`).

### 3. `/media/*` — можно прямо на бэкенд

Картинки отдаёт бэкенд (`GET|HEAD /media/<key>` без `x-internal-key`: ETag/304, Range, `Cache-Control:
public, max-age=31536000, immutable`, `nosniff`, CSP `sandbox`). Next проксирует их сам
(`src/app/media/[...key]/route.ts`), поэтому прокси может ничего не делать. Быстрее — отправить
`/media/*` прямо на бэкенд (`reverse_proxy /media/* backend:4000` / `location /media/ { proxy_pass
http://backend:4000; }`), минуя Node-процесс Next: заголовки ответа бэкенда не трогать, не сжимать,
`Range` и `If-None-Match` пропускать. Остальные пути бэкенда наружу НЕ публиковать (их защищает только
`x-internal-key`). `/_next/image` ходит за картинками в сам Next (`/media/…` того же origin) — это работает
при любом варианте.

### 4. IP посетителя

Next передаёт бэкенду IP посетителя в `x-client-ip` (лимиты входа в админку и заявок):
`src/lib/api/client-ip.ts` берёт `X-Real-IP`, иначе **последний** адрес `X-Forwarded-For` (тот, что дописал
наш прокси; посетитель может подставить только адреса перед ним), и никогда — присланный браузером
`x-client-ip`. Поэтому прокси обязан **перезаписывать** `X-Real-IP` адресом TCP-соединения: Caddy —
`header_up X-Real-IP {remote_host}` (`X-Forwarded-For` Caddy без `trusted_proxies` тоже
перезаписывает); nginx — `proxy_set_header X-Real-IP $remote_addr;` и `proxy_set_header X-Forwarded-For
$remote_addr;` (или `$proxy_add_x_forwarded_for` — последний адрес всё равно ставит nginx). Порт Next
наружу не публиковать: без прокси оба заголовка присылает сам посетитель и обходит лимиты.

## Сколько это даёт

Замеры `measure.mjs` (headless Chrome 1440×900, кэш отключён, прокрутка всей страницы).
«Через прокси» — модель требований выше (`/_next/static` и `public` с диска предсжатыми копиями,
динамика — zstd 7 без `Accept-Encoding` к Next):

| Страница                   | HTML gzip (Next) | HTML zstd 7 | HTML brotli 5 | Всего, `next start` | Всего через прокси |
| -------------------------- | ---------------- | ----------- | ------------- | ------------------- | ------------------ |
| `/`                        | 47.0 КБ          | 33.7 КБ     | 32.4 КБ       | 769.7 КиБ           | 689.8 КиБ          |
| `/en`                      | 43.1 КБ          | 31.8 КБ     | 30.6 КБ       | —                   | —                  |
| `/catalog/menya-zapomnyat` | 26.5 КБ          | 18.9 КБ     | 17.8 КБ       | 508.2 КиБ           | 455.4 КиБ          |

HTML жмётся заметно лучше gzip, потому что несёт RSC-пейлоад вторым экземпляром: окно gzip (32 КБ)
повтор не видит, окна zstd/brotli — видят.
