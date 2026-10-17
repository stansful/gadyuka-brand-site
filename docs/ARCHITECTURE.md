# ГАДЮКА — архитектура сайта и админки

Решения владельца (16.10.2026): VPS в Финляндии · Next.js + встроенная админка · PostgreSQL + Prisma · TypeScript строго без `any` · SEO · языки EN + RU (расширяемо до любых) · заявки → Telegram-бот + список в админке · админка пока открыта всем · коллекция «Меня запомнят» (никогда не «первая»).

## Стек
| Слой | Выбор |
|---|---|
| Фреймворк | Next.js 16 (App Router, Turbopack, `output: "standalone"`), React 19 |
| Язык | TypeScript `strict` + `noUncheckedIndexedAccess`; ESLint `@typescript-eslint/no-explicit-any: error` |
| БД | PostgreSQL 17, Prisma 7 (`prisma.config.ts`, генератор `prisma-client`, драйвер-адаптер `@prisma/adapter-pg`) |
| Валидация | zod 4 — на всех границах (формы, server actions, JSON-поля из БД) |
| i18n | next-intl 4: локали `ru` (по умолчанию, без префикса: `/`) и `en` (`/en`). Список локалей — один массив в `src/i18n/locales.ts`; добавить язык = добавить код + заполнить переводы в админке |
| Картинки | загрузка на сервер в `UPLOAD_DIR` (volume), `sharp` → webp + размеры; раздача через `/uploads/...` (Caddy в проде, route handler как запасной путь); `next/image` |
| Анимации (публичная часть) | GSAP 3.13 + ScrollTrigger + SplitText, Lenis — из npm |
| Админка UI | Tailwind CSS v4 (только в админке), серверные компоненты + server actions |
| Тесты | Vitest для бизнес-логики (валидация заявок, форматирование Telegram, локализация, загрузки) |
| Деплой | Docker Compose: `app` (Next standalone) + `db` (postgres:17) + `caddy` (HTTPS, раздача `/uploads`) |

## Структура
```
prisma/schema.prisma, prisma/migrations/, prisma/seed.ts   — модель и сид из BRIEF.md (ru + en)
prisma.config.ts
src/i18n/{locales.ts,routing.ts,request.ts,navigation.ts}
src/proxy.ts                         — next-intl (в Next 16 middleware → proxy)
src/app/[locale]/layout.tsx, page.tsx — лендинг (дизайн — выбранный концепт из concepts/)
src/app/[locale]/catalog/[slug]/      — страница коллекции (SEO)
src/app/admin/**                      — админка (RU), вне локалей
src/app/api/leads/route.ts            — приём заявок
src/app/uploads/[...path]/route.ts    — отдача загруженных файлов (fallback)
src/app/{sitemap.ts,robots.ts,manifest.ts}
src/lib/db.ts                         — PrismaClient singleton
src/lib/content/                      — типизированный слой чтения контента (getLanding(locale) → LandingContent)
src/lib/i18n-text.ts                  — LocalizedText (zod), t(text, locale) с фолбэком на ru
src/lib/media.ts                      — загрузка/валидация/обработка изображений
src/lib/leads.ts, src/lib/telegram.ts — заявки, отправка в Telegram (HTML-экранирование, ретраи, не теряем заявку при сбое)
src/lib/seo/                          — metadata, hreflang, JSON-LD (Organization/ClothingStore, Product, BreadcrumbList)
src/components/site/**                — секции лендинга
src/components/admin/**               — UI админки
messages/{ru,en}.json                 — только системные строки (ошибки форм и т.п.); весь видимый контент — в БД
public/brand/**                       — логотип/вордмарк/SVG из assets/
```

## Модель данных (Prisma)
Переводимые поля — `Json` со структурой `LocalizedText = { [locale]: string }` (валидируется zod при чтении/записи). Так новый язык не требует миграций.

- **ContentBlock** — `key` (PK, точечный ключ = `data-edit` / `data-edit-img` из концептов, напр. `hero.cta`, `about.title`), `section`, `kind` (TEXT | RICHTEXT | IMAGE | LINK), `value Json?` (LocalizedText), `mediaId?`, `order`, `updatedAt`. Тексты всех секций-«одиночек» (hero, about, tailoring, reviews, news, gallery, offers, partners, contacts, footer, меню, кнопки).
- **Media** — файл: `path`, `mime`, `width`, `height`, `size`, `alt Json` (LocalizedText), `createdAt`.
- **Collection** — `slug` (unique), `title`, `description` (LT), `coverId?`, `order`, `published`.
- **Product** — `slug`, `collectionId`, `title`, `description`, `details` (LT), `price Int?` (₽), `images` (ProductImage: productId, mediaId, order), `order`, `published`.
- **Review** — `author`, `role` (LT), `text` (LT), `avatarId?`, `rating?`, `order`, `published`.
- **NewsItem** — `slug`, `title`, `excerpt`, `body` (LT), `date`, `imageId?`, `published`.
- **GalleryItem** — `mediaId`, `caption` (LT), `order`, `published`.
- **Offer** — `title`, `text`, `badge`, `ctaLabel` (LT), `ctaHref?`, `validUntil?`, `imageId?`, `order`, `published`.
- **Partner** — `name`, `url?`, `logoId?`, `description` (LT), `order`, `published`.
- **Lead** — `type` (TAILORING | PARTNERSHIP | CONTACT), `name`, `email?`, `phone?`, `message`, `locale`, `status` (NEW | IN_PROGRESS | DONE | SPAM), `telegramSent`, `telegramError?`, `ipHash?`, `meta Json?`, `createdAt`.
- **SiteSettings** (одна строка) — `phone`, `email`, `address` (LT), `socials Json` (`{type,url}[]`), `seoTitle`, `seoDescription` (LT), `ogImageId?`.

## Админка (`/admin`, по-русски)
Дашборд (счётчики, последние заявки) · Контент секций (группы по секциям, вкладки языков RU/EN/…, выбор картинки из медиатеки, ссылка «посмотреть на сайте») · Коллекции и товары (CRUD, фото с порядком, публикация) · Отзывы · Новости · Галерея · Спецпредложения · Партнёры · Медиатека (мульти-загрузка, alt на всех языках, удаление с проверкой использования) · Заявки (фильтр по типу/статусу, смена статуса, повторная отправка в Telegram) · Настройки (контакты, соцсети, SEO по языкам, OG-картинка).
После сохранения — `revalidateTag`/`revalidatePath`, сайт обновляется сразу.
Доступ: сейчас открыт всем. Заложен выключатель: если задан `ADMIN_PASSWORD` — вход по паролю (подписанная httpOnly-cookie). Админка закрыта от индексации (`noindex`, robots).

## Заявки
Формы «Оставить заявку» (пошив), «Оставить заявку для сотрудничества», «Связаться» → `POST /api/leads` → zod-валидация + honeypot + лимит частоты по IP-хэшу → сохранение в БД → сообщение в Telegram (`TELEGRAM_BOT_TOKEN`, `TELEGRAM_OWNER_ID` из `.env`). Сбой Telegram не теряет заявку: `telegramSent=false` + текст ошибки, повтор из админки. В тестах и dev Telegram отключён (`TELEGRAM_DRY_RUN=1`).

## SEO
`generateMetadata` по языкам (title/description из настроек), canonical + `hreflang` (ru, en, x-default), Open Graph/Twitter, JSON-LD (ClothingStore/Organization, ItemList/Product для каталога, BreadcrumbList), `sitemap.xml` с альтернативами языков, `robots.txt`, `manifest`, favicon из логотипа, `<html lang>`, семантичные заголовки, alt на всех языках, шрифты через `next/font` (кириллица, self-hosted), Core Web Vitals (lazy-картинки, анимации только transform/opacity, reduced-motion).

## Окружение
`.env` (не в git): `DATABASE_URL`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_OWNER_ID`, `TELEGRAM_DRY_RUN`, `UPLOAD_DIR`, `SITE_URL`, `ADMIN_PASSWORD` (опц.), `IP_HASH_SALT`. `.env.example` — те же ключи без значений.
Локально: `docker compose -f docker-compose.dev.yml up -d` (Postgres) → `npm run db:migrate` → `npm run db:seed` → `npm run dev`.
