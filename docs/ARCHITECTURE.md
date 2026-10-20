# ГАДЮКА — архитектура сайта и админки

Решения владельца (16.10.2026): VPS в Финляндии · Next.js + встроенная админка · PostgreSQL + Prisma · TypeScript строго без `any` · SEO · языки EN + RU (расширяемо до любых) · заявки → Telegram-бот + список в админке · админка пока открыта всем · коллекция «Меня запомнят» (никогда не «первая»).

Решения 20.10.2026: весь текст — в `messages/*.json` и из них сидом в БД (правится в админке) · картинки — в S3 (MinIO) · меню, соцсети, шкала звёзд отзывов — данные в БД · ESLint заменён на oxlint + oxfmt.

## Стек

- **Фреймворк:** Next.js 16 (App Router, Cache Components, Turbopack, `output: "standalone"`), React 19.
- **Язык:** TypeScript `strict` + `noUncheckedIndexedAccess`; линтер oxlint (`.oxlintrc.json`), форматтер oxfmt (`.oxfmtrc.json`).
- **БД:** PostgreSQL 17, Prisma 7 (`prisma.config.ts`, генератор `prisma-client`, драйвер-адаптер `@prisma/adapter-pg`).
- **Валидация:** zod 4 на всех границах (формы, server actions, JSON-поля из БД, env).
- **i18n:** next-intl 4. Локали `ru` (по умолчанию, без префикса: `/`) и `en` (`/en`), список — `src/i18n/locales.ts`. Тексты сайта — `messages/{ru,en}.json` → таблица `Message`; тексты админки — `messages/admin/ru.json`.
- **Картинки:** загрузка в админке → `sharp` → WebP (≤ 2400 px) → S3/MinIO (`@aws-sdk/client-s3`), ссылка `/media/<key>` с того же домена; `next/image`.
- **Анимации (публичная часть):** GSAP + ScrollTrigger + SplitText, Lenis.
- **Админка UI:** Tailwind CSS v4 (только в админке), серверные компоненты + server actions.
- **Тесты:** Vitest — бизнес-логика, валидация, локализация, медиа, регрессия «нет захардкоженного текста».
- **Деплой:** Docker Compose — `app` (Next standalone) + `db` (postgres:17) + `minio` (`pgsty/minio`, форк MinIO: официальный образ больше не публикуется) + `caddy` (HTTPS). Подробно — `DEPLOY.md`.

## Структура

```
messages/{ru,en}.json                 — тексты сайта (дефолты + набор ключей + типы next-intl) → сид → Message
messages/admin/ru.json                — интерфейс админки (namespace "admin"), только русский, не в БД
messages/content/{ru,en}.json         — демо-контент для сида (коллекция, товары, отзывы, меню, alt …)
prisma/schema.prisma, migrations/     — модель данных (одна init-миграция + CHECK-ограничения)
prisma/seed.ts, prisma/seed/*.ts      — сид: админ, сообщения, медиа → S3, картинки лендинга, сущности
src/i18n/                             — локали, routing, request.ts (сообщения из БД поверх JSON), message-format.ts (ICU)
src/proxy.ts                          — next-intl (в Next 16 middleware → proxy)
src/app/[locale]/                     — лендинг, страница коллекции /catalog/<slug>, 404, ошибка
src/app/admin/**                      — админка (RU), вне локалей
src/app/media/[...key]/route.ts       — отдача картинок из S3 (immutable-кэш, ETag/304)
src/app/api/leads/route.ts            — приём заявок
src/lib/content/                      — слой чтения контента: getLanding(locale), реестр текстов (registry.ts)
src/lib/storage/                      — S3-клиент, ключи и ссылки медиа
src/lib/media.ts                      — валидация и обработка изображений
src/lib/admin/                        — запросы, server actions, схемы, i18n админки
src/lib/leads.ts, src/lib/telegram.ts — заявки и уведомления в Telegram
src/lib/seo/                          — metadata, hreflang, JSON-LD, sitemap
src/components/site/**, admin/**      — UI сайта и админки
public/brand/**                       — статичная бренд-графика (SVG)
.claude/skills/site-texts/SKILL.md    — как добавлять текст (обязательно для агентов)
```

## Тексты

1. `messages/ru.json` / `en.json` — источник дефолтов и набора ключей. Ключ = путь через точку (`hero.title`, `forms.errors.required`).
2. Сид (`npm run db:seed`) кладёт каждую строку в `Message(key, locale, value, editedAt)`: создаёт недостающие, обновляет строки с `editedAt IS NULL` новым дефолтом, правки из админки (`editedAt` задан) не трогает. `SEED_OVERWRITE=1` — сбросить всё к JSON. Ключи, удалённые из JSON, сид только показывает в отчёте.
3. Сайт читает `getSiteMessages(locale)` (`src/i18n/site-messages.ts`, `'use cache'` + тег `content`): строки из БД поверх JSON. Нет строки — берётся дефолт; БД недоступна — сайт рендерится на JSON-дефолтах.
4. Админка «Тексты сайта» (`/admin/content`): разделы = верхние namespace, вкладки языков, поиск, «изменено», «вернуть по умолчанию». При сохранении проверяются ICU-синтаксис, пробное форматирование и то, что `{аргументы}` и `<теги>` совпадают с дефолтом; тексты вида `template` (их подставляет клиентский код сайта) — только простые `{name}` без plural/select; обязательные тексты (заголовки, кнопки, подписи полей, aria-названия, ошибки формы) нельзя оставить пустыми по-русски. Форма отправляет только изменённые тексты вместе с исходным значением; если текст успели изменить в другой вкладке, сохранение отклоняется целиком (`src/lib/admin/site-text-save.ts`, advisory lock). После записи — `revalidateContent()`, сайт обновляется сразу.
5. Регрессионные тесты `src/lib/content/site-copy.test.ts` и `src/lib/admin/admin-copy.test.ts` падают на кириллице в литералах и на ключах, которых нет в JSON.

Порядок добавления текста — `.claude/skills/site-texts/SKILL.md`.

## Модель данных (Prisma)

Переводимые поля сущностей — `Json` со структурой `LocalizedText = { [locale]: string }` (zod при чтении и записи), новый язык не требует миграций.

- **Message** — `(key, locale)` PK, `value`, `editedAt?` (null = значение из сида), `updatedAt`. Все тексты UI сайта.
- **ContentImage** — `key` (`about.image`, `tailoring.image`) → `mediaId?`. Картинки лендинга.
- **User** — `role` (ADMIN | USER), `name`. Сейчас одна строка ADMIN из сида (вход по-прежнему по `ADMIN_PASSWORD`); USER — задел под пользователей сайта.
- **Media** — `ownerType` (ADMIN | USER), `ownerId` → User, `uuid`, `bucket`, `key` = `<admin|user>/<ownerId>/<uuid>/image.webp` (CHECK), `url` = `/media/<key>`, `mime`, `width`, `height`, `size`, `alt` (LT), `originalName`.
- **MenuItem** — `label` (LT), `href` (`#якорь`, `/путь`, `https://…`, `mailto:`, `tel:`), `showInHeader`, `showInFooter`, `order`, `published`.
- **SocialLink** — `type` (TELEGRAM | VK | INSTAGRAM | WHATSAPP | YOUTUBE | TIKTOK | PINTEREST | WEBSITE | OTHER), `url`, `label` (LT, пусто = подпись из `social.<TYPE>`), `order`, `published`.
- **Collection** — `slug`, `title`, `description` (LT), `coverId?`, `order`, `published`.
- **Product** — `slug`, `collectionId`, `title`, `description`, `details` (LT), `price Int?` (₽), `images` (ProductImage), `order`, `published`.
- **Review** — `author`, `role` (LT), `text` (LT), `avatarId?`, `rating?` (1..`reviewRatingMax`, CHECK 1..10), `userId?` (задел), `order`, `published`.
- **NewsItem**, **GalleryItem**, **Offer**, **Partner** — как раньше (тексты LT, картинки → Media).
- **Lead** — заявки (тип, контакты, статус, отправка в Telegram, ipHash для лимитов).
- **SiteSettings** (одна строка) — `phone`, `email`, `address` (LT), `seoTitle`, `seoDescription` (LT), `ogImageId?`, `reviewRatingMax` (1..10, по умолчанию 5).

## Картинки (S3 / MinIO)

- Загрузка: `POST /admin/api/media` → проверка формата по сигнатуре (JPEG, PNG, WebP, AVIF, GIF; без SVG), ≤ 15 МБ → `sharp` → WebP → `PutObject` в бакет `S3_BUCKET` по ключу `admin/<ownerId>/<uuid>/image.webp` → строка `Media`. Если запись в БД не удалась, объект удаляется.
- Отдача: `src/app/media/[...key]/route.ts` стримит объект из S3 (`Cache-Control: immutable`, ETag/304, `nosniff`, CSP `sandbox`); он же источник для `/_next/image`. Бакет приватный, MinIO наружу не открыт.
- Удаление — только если картинка нигде не используется (проверка по всем связям).
- Сид загружает картинки из `assets/` в тот же бакет; uuid детерминирован (повторный сид не дублирует объекты, новая версия файла → новый uuid → новый URL).

## Админка (`/admin`, по-русски)

Дашборд · Тексты сайта · Меню · Соцсети · Коллекции и товары · Отзывы (звёзды по шкале из настроек) · Новости · Галерея · Спецпредложения · Партнёры · Медиатека · Заявки · Настройки (контакты, SEO, OG-картинка, шкала оценок).
Каждое сохранение публичного контента вызывает `revalidateContent()`.
Доступ: сейчас открыт (`ADMIN_ALLOW_OPEN=1` в проде). Если задан `ADMIN_PASSWORD` — вход по паролю (подписанная httpOnly-cookie). Админка закрыта от индексации.

## Заявки

Форма «Письмо в редакцию» → `POST /api/leads` → zod + honeypot + лимит по IP-хэшу → БД → Telegram (`TELEGRAM_BOT_TOKEN`, `TELEGRAM_OWNER_ID`). Сбой Telegram не теряет заявку: `telegramSent=false` + текст ошибки, повтор из админки. Шаблоны сообщений — `telegram.*` в messages. В dev и тестах `TELEGRAM_DRY_RUN=1`.

## SEO

`generateMetadata` по языкам, canonical + `hreflang`, Open Graph/Twitter, JSON-LD (ClothingStore/Organization, ItemList/Product, BreadcrumbList), `sitemap.xml`, `robots.txt`, `manifest`, `<html lang>`, alt на всех языках, шрифты через `next/font`.

## Окружение

`.env` (не в git), шаблон — `.env.example`: `DATABASE_URL`, `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_FORCE_PATH_STYLE`, `TELEGRAM_*`, `SITE_URL`, `IP_HASH_SALT`, `ADMIN_PASSWORD`, `ADMIN_ALLOW_OPEN`, `ADMIN_SESSION_SECRET`; в проде ещё `MINIO_ROOT_USER`, `MINIO_ROOT_PASSWORD`, `POSTGRES_*`, `APP_DB_*`, `DOMAIN`.
Локально: `npm run db:up` (Postgres + MinIO) → `npm run db:deploy` → `npm run db:seed` → `npm run dev`.
