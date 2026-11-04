# ГАДЮКА — архитектура сайта и админки

Решения владельца (16.10.2026): VPS в Финляндии · Next.js + встроенная админка · PostgreSQL + Prisma · TypeScript строго без `any` · SEO · языки EN + RU (расширяемо до любых) · заявки → Telegram-бот + список в админке · коллекция «Меня запомнят» (никогда не «первая»).

Решения 20.10.2026: весь текст — в `shared/messages/*.json` и из них сидом в БД (правится в админке) · картинки — в S3 (MinIO) · меню, соцсети, шкала звёзд отзывов — данные в БД · ESLint заменён на oxlint + oxfmt.

Решения 21.10.2026 (разделение на frontend / backend): вся серверная логика — правила, валидация, БД, S3 и Telegram — в NestJS-бэкенде (`../backend`); этот Next.js только отображает и пересылает, сервер Next — тонкий клиент бэкенда (`src/lib/api`). Тексты — `shared/messages` в корне репозитория (общие с бэкендом), типы API — `shared/contracts`. Вход в админку — логин + пароль аккаунта бэкенда, все маршруты админки только после входа.

## Что где

| Что                                                                                   | Где                                                                                                    |
| ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| данные, правила, валидация форм, БД (Prisma 7, PostgreSQL 18), миграции, сид          | `../backend` (`prisma/`, `src/usecases`, `src/core`, `src/cli/seed`)                                   |
| картинки: загрузка, `sharp` → WebP, MinIO, отдача `/media/<key>`                      | бэкенд (`src/module/storage`, `src/module/image`, `src/usecases/admin/media`)                          |
| заявки: проверка, honeypot, лимиты, Telegram                                          | бэкенд (`src/usecases/public/leads`, `src/module/lead-notification`)                                   |
| сессии админки (JWT + refresh-токены), роли                                           | бэкенд (`src/usecases/auth`, `src/module/auth-token`)                                                  |
| тексты (дефолты), их метаданные (разделы, виды, обязательность, картинки)             | `../shared/messages`, `../shared/messages/meta/site-texts.json`                                        |
| типы запросов и ответов API                                                           | `../shared/contracts` (README там — путь новой функции от контракта до экрана)                         |
| страницы сайта и админки, компоненты, анимации, SEO                                   | здесь (`src/app`, `src/components`, `src/lib/seo`)                                                     |
| сервер Next: клиент API, cookies сессии, прокси, пересылка `/media`, заявок, загрузок | здесь (`src/lib/api`, `src/proxy.ts`, `src/app/media`, `src/app/api/leads`, `src/app/admin/api/media`) |

Во фронтенде нет кода БД, S3, Telegram, `sharp`, zod и правил валидации — `test/client-imports.test.ts` падает, если такой пакет появится в `src/` или в `package.json`.

## Стек

- **Фреймворк:** Next.js 16 (App Router, Cache Components, Turbopack, `output: "standalone"`), React 19.
- **Язык:** TypeScript `strict` + `noUncheckedIndexedAccess`; линтер oxlint (`.oxlintrc.json`), форматтер oxfmt (`.oxfmtrc.json`).
- **Бэкенд:** NestJS (`../backend`) — `src/lib/api` (fetch на `BACKEND_URL` с `x-internal-key`, IP посетителя в `x-client-ip`, его User-Agent в `x-client-user-agent`, токен админа в `Authorization`; ожидание ответа — `ApiRequestTimeoutMs` контракта, 10 с, дольше только там, где контракт маршрута это говорит); ошибки — ключи `shared/messages` (+ ICU-значения), переводит фронтенд.
- **Валидация:** на бэкенде (class-validator, ключи сообщений). Во фронтенде — только подсказки до отправки: форма заявки (`src/lib/leads.ts`, те же правила, что у бэкенда — меняются вместе), лимиты полей форм админки (`src/lib/admin/limits.ts`, `media-constants.ts`); решает всегда бэкенд.
- **i18n:** next-intl 4. Локали `ru` (по умолчанию, без префикса: `/`) и `en` (`/en`), список — `src/i18n/locales.ts`. Тексты сайта — `shared/messages/{ru,en}.json` (`@shared/messages/*`) → таблица `Message` бэкенда; тексты админки — `shared/messages/admin/ru.json` (только в бандле, не в БД).
- **Картинки:** ссылка `/media/<key>` с того же домена (`src/app/media/[...key]` проксирует на бэкенд); `next/image` (`images.localPatterns`).
- **Анимации (публичная часть):** GSAP + ScrollTrigger + SplitText, Lenis.
- **Админка UI:** Tailwind CSS v4 (только в админке), серверные компоненты + server actions.
- **Тесты:** Vitest — отображение, мапперы ответов бэкенда, действия и запросы админки (бэкенд замокан), клиентские проверки, регрессия «нет захардкоженного текста» и «нет серверных пакетов».
- **Деплой:** корневой docker-compose репозитория (frontend + backend + Postgres + MinIO + прокси); сборка образа — из корня (импорт `../shared`).

## Структура

```
../shared/messages/{ru,en}.json         — тексты сайта (дефолты + набор ключей + типы next-intl) → сид бэкенда → Message
../shared/messages/admin/ru.json        — интерфейс админки (namespace "admin"), только русский, не в БД
../shared/messages/content/{ru,en}.json — демо-контент сида бэкенда
../shared/messages/meta/site-texts.json — порядок разделов, виды и обязательность текстов, картинки лендинга
../shared/contracts/*.ts                — типы запросов и ответов API бэкенда (по файлу на область)
src/i18n/                               — локали, routing, request.ts (сообщения бэкенда поверх JSON), site-messages.ts
src/proxy.ts                            — next-intl + сессия админки (обновление токена, src/lib/api/admin-proxy.ts)
src/lib/api/                            — клиент бэкенда: publicRead, readAdminData/Row, adminApiAction, сессия (README там)
src/app/[locale]/                       — лендинг, страница коллекции /catalog/<slug>, 404, ошибка
src/app/admin/**                        — админка (RU), вне локалей; api/media — пересылка загрузок на бэкенд
src/app/media/[...key]/route.ts         — прокси картинок на бэкенд (ETag/304, Range, immutable-кэш)
src/app/api/leads/route.ts              — приём заявки (JSON и форма без JS) → POST /api/v1/public/leads, 303-якоря
src/lib/content/                        — чтение контента сайта: getLanding(locale), getCollectionBySlug, мапперы, registry.ts
src/lib/admin/                          — запросы (queries/<область>.ts), server actions (actions/*), вид для админки, i18n
src/lib/leads.ts, lead-*.ts             — форма заявки: конфигурация, клиентская проверка, намерения CTA
src/lib/seo/                            — metadata, hreflang, JSON-LD, sitemap
src/components/site/**, admin/**        — UI сайта и админки
public/brand/**                         — статичная бренд-графика (SVG)
../.claude/skills/site-texts/SKILL.md   — как добавлять текст (обязательно для агентов)
```

## Тексты

1. `shared/messages/ru.json` / `en.json` — источник дефолтов и набора ключей. Ключ = путь через точку (`hero.title`, `forms.errors.required`).
2. Сид бэкенда (`npm run db:seed` в `../backend`) кладёт каждую строку в `Message(key, locale, value, editedAt)`: создаёт недостающие, обновляет строки с `editedAt IS NULL` новым дефолтом, правки из админки (`editedAt` задан) не трогает. `SEED_OVERWRITE=1` — сбросить всё к JSON.
3. Сайт читает `getSiteMessages(locale)` (`src/i18n/site-messages.ts` → `GET /api/v1/public/messages/:locale` бэкенда, `'use cache'` + тег `content`): строки из БД поверх JSON (правила — `SiteMessagesService` бэкенда). Бэкенд недоступен — сайт рендерится на JSON-дефолтах. Читается только во время запроса (см. «Данные сайта: только во время запроса»).
4. Админка «Тексты сайта» (`/admin/content`): разделы = верхние namespace (порядок — `shared/messages/meta/site-texts.json`), вкладки языков, поиск, «изменено», «вернуть по умолчанию». Проверки сохранения — на бэкенде: ICU-синтаксис, пробное форматирование, те же `{аргументы}` и `<теги>`, что у дефолта; тексты вида `template` (их подставляет клиентский код сайта) — только простые `{name}`; обязательные тексты нельзя оставить пустыми по-русски; если текст успели изменить в другой вкладке, сохранение отклоняется целиком (409, сообщение собирает `src/lib/admin/site-text-save.ts`). После записи — `updateTag('content')`, сайт обновляется сразу.
5. Регрессионные тесты `src/lib/content/site-copy.test.ts` и `src/lib/admin/admin-copy.test.ts` падают на кириллице в литералах и на ключах, которых нет в JSON; `src/lib/content/registry.test.ts` и `src/components/site/message-template.test.ts` сверяют метаданные текстов с тем, что рендерит сайт.

Порядок добавления текста — `../.claude/skills/site-texts/SKILL.md`.

## Модель данных

Источник — схема бэкенда (`../backend/prisma/models/*.prisma`, одна init-миграция + CHECK-ограничения). Переводимые поля — JSON `LocalizedText = { [locale]: string }` (`shared/contracts/common.ts`; чтение во фронтенде — `src/lib/localized-text.ts`), новый язык не требует миграций. Сущности: `Message`, `ContentImage` (картинки лендинга по ключу), `User` (админ из `ADMIN_LOGIN` / `ADMIN_PASSWORD` бэкенда), `Session` / `RefreshToken`, `Media` (ключ `<admin|user>/<ownerId>/<uuid>/image.webp`, `url` = `/media/<key>`), `MenuItem`, `SocialLink`, `Collection`, `Product` (+ `ProductImage`), `Review` (оценка 1..`reviewRatingMax`), `NewsItem`, `GalleryItem`, `Offer`, `Partner`, `Lead`, `SiteSettings` (одна строка). Ответы API для страниц — `shared/contracts/<область>.ts`.

## Картинки

- Загрузка: медиатека → `POST /admin/api/media` (route handler пересылает поток на `POST /api/v1/admin/media`, без буферизации) → бэкенд проверяет формат по сигнатуре (JPEG, PNG, WebP, AVIF, GIF; без SVG), ≤ 50 МБ → `sharp` → WebP → MinIO → строка `Media`. Лимиты в `src/lib/admin/media-constants.ts` — только подсказка до отправки, совпадают с бэкендом.
- Отдача: бэкенд (`GET|HEAD /media/<key>`: `Cache-Control: immutable`, ETag/304, Range, `nosniff`, CSP `sandbox`); `src/app/media/[...key]/route.ts` (`src/lib/api/media-proxy.ts`) стримит с того же домена, пробрасывая `If-None-Match` / `Range` и заголовки ответа, — он же источник для `/_next/image`. В production прокси может отправлять `/media/*` прямо на бэкенд (`docs/COMPRESSION.md`). Бакет приватный, MinIO и бэкенд наружу не открыты.
- Удаление — только если картинка нигде не используется (бэкенд проверяет все связи, админка показывает, где она используется).

## Админка (`/admin`, по-русски)

Дашборд · Тексты сайта · Меню · Соцсети · Коллекции и товары · Отзывы (звёзды по шкале из настроек) · Новости · Галерея · Спецпредложения · Партнёры · Медиатека · Заявки · Настройки (контакты, SEO, OG-картинка, шкала оценок).

- Страница: `requireAdminPage()` → `src/lib/admin/queries/<область>.ts` (`readAdminData` / `readAdminRow`, нет строки → `notFound()`) → вид для компонентов (строки списков `EntityRow`, подписи по-русски).
- Форма: server action `src/lib/admin/actions/<область>.ts` → `adminApiAction(label, () => adminRequest(path, { method, body }), { revalidatesContent, onSuccess, fieldErrors })`: ошибки валидации бэкенда → переведённые `fieldErrors` по путям полей (`title.en`), отказы → тост (и у поля через `fieldErrors`), успех → `updateTag('content')` + тост.
- Списки: публикация, порядок (drag & drop), удаление — общие `/api/v1/admin/entities/*` (`src/lib/admin/actions/entities.ts` → `src/lib/api/entities.ts`).
- Доступ: все маршруты админки — только после входа. `/admin/login`: логин + пароль → `POST /api/v1/auth/login` → httpOnly-cookies `gadyuka_admin_access` (JWT, 15 мин) и `gadyuka_admin_refresh` (30 дней, ротация), `Path=/`, `SameSite=Lax`, `Secure` в production. `src/proxy.ts`: просроченный access + refresh → ОДИН refresh на refresh-токен (single flight в процессе, результат переиспользуется 30 с — бэкенд отзывает всю сессию при повторном предъявлении старого refresh); без сессии страница → 307 на `/admin/login?next=…`. Граница безопасности — `requireAdminPage` / `requireAdminRoute` (`src/lib/admin/auth.ts`: `GET /auth/me` раз на запрос) и сам бэкенд, который проверяет токен и роль ADMIN на каждом `/admin/*` (в том числе для server actions: 401 → «Сессия истекла…»). Выход — `POST /auth/logout` + удаление cookies. Админка закрыта от индексации.

## Заявки

Форма «Письмо в редакцию» → `POST /api/leads` (этот сервер: разбор JSON или формы без JS с лимитом тела, IP посетителя из `X-Real-IP` / последнего `X-Forwarded-For`) → `POST /api/v1/public/leads` бэкенда: проверка (`forms.errors.*`), honeypot, лимит 5 заявок / 10 мин на сеть, сохранение, уведомление в Telegram в фоне (сбой Telegram заявку не теряет: «не отправлено» + повтор из админки). Ответ браузеру — прежний контракт (`201 { ok, id }`, `422 { fieldErrors }`, `429`, полный список — в `src/app/api/leads/route.ts`; без JS — 303 на `#lead-sent` / `#lead-invalid` / `#lead-failed`). Клиентская проверка формы (`src/lib/leads.ts`) повторяет правила бэкенда.

## Данные сайта: только во время запроса

`next build` (Docker-сборка) проходит без бэкенда: публичные данные читаются только во время запроса и кэшируются.

- `publicRead(path)` (`src/lib/api/public.ts`) = `await connection()` (вне кэша: пререндер останавливается здесь, сборка бэкенд не вызывает) + `cachedPublicRead` (`'use cache'` + `cacheTag('content')` + `cacheLife('hours')`). Ошибка — `ApiRequestError`, в кэш не попадает. Лендинг и страница коллекции читаются своими кэш-функциями (`src/lib/content/public-api.ts`: лендинг укорачивает кэш до конца ближайшего спецпредложения, коллекция превращает 404/400 в «не найдено»).
- Корневой layout `[locale]` и страницы, которые блокируются на этих данных, объявляют `export const instant = false`. `generateStaticParams` бэкенд не вызывает (плейсхолдер). `generateMetadata`, `sitemap.ts`, `manifest.ts` — через `publicRead` или `await connection()` первым делом.
- Тексты сайта (`loadSiteMessages`): `connection()` → кэшированный `GET /api/v1/public/messages/:locale`, при недоступном бэкенде — дефолты из `shared/messages`. next-intl вне дерева `[locale]` (админка) берёт дефолты из `shared/messages` и бэкенд не вызывает.
- Сброс: каждое изменение публичного контента — `updateTag('content')`, бэкенд сам сбрасывает свой кэш текстов (`SiteMessagesService.invalidate`).

## SEO

`generateMetadata` по языкам, canonical + `hreflang`, Open Graph/Twitter, JSON-LD (ClothingStore/Organization, ItemList/Product, BreadcrumbList), `sitemap.xml` (даты — `GET /api/v1/public/sitemap`), `robots.txt`, `manifest`, `<html lang>`, alt на всех языках, шрифты через `next/font`.

Метаданные блокирующие для всех посетителей (`htmlLimitedBots: /.*/` в `next.config.ts`): страницы рендерятся во время запроса, и с потоковыми метаданными ответ начинался раньше, чем страница успевала вызвать `notFound()` — неизвестный путь или коллекция отвечали `200` + `noindex` вместо `404`. Теперь статус известен до начала тела: `404` для браузеров и всех роботов. Цена (замер на лендинге, тёплый кэш): TTFB +11–17 мс, FCP / LCP / загрузка — без изменений в пределах шума.

## Окружение

`.env` (не в git), шаблон — `.env.example`: `BACKEND_URL` (внутренний адрес бэкенда, dev `http://127.0.0.1:4000`), `INTERNAL_API_KEY` (= `INTERNAL_API_KEY` бэкенда), `SITE_URL`, необязательно `GOOGLE_SITE_VERIFICATION` / `YANDEX_VERIFICATION`. Всё остальное (`POSTGRES_*`, `S3_*`, `TELEGRAM_*`, `IP_HASH_SALT`, `ADMIN_*`) — переменные бэкенда.

Сборка: `turbopack.root` и `outputFileTracingRoot` = корень репозитория (импорт `../shared`), поэтому standalone-сервер лежит в `.next/standalone/frontend/server.js` (зависимости — `.next/standalone/frontend/node_modules`: next, react, sharp для `/_next/image`), статику копировать в `.next/standalone/frontend/.next/static` и `.next/standalone/frontend/public`; `postbuild` удаляет скопированные `.env*` (`scripts/clean-standalone-env.mjs`) и пишет предсжатые копии статики (`scripts/precompress.mjs`). Контейнер — с `HOSTNAME=0.0.0.0` (с `127.0.0.1` next-intl зацикливает редирект `/`).
