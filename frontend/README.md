# ГАДЮКА — сайт и админка

Лендинг бренда уличной одежды ГАДЮКА (Краснодар) со встроенной админкой.
Next.js 16 · PostgreSQL 17 + Prisma 7 · MinIO (S3) для картинок · next-intl (ru/en) · TypeScript strict · oxlint + oxfmt.

![Главная](docs/screenshots/site-home.png)

## Запуск локально

```bash
cp .env.example .env    # dev-значения уже подходят; TELEGRAM_* — по желанию
npm install             # postinstall → prisma generate
npm run db:up           # Postgres + MinIO в docker (бакет gadyuka-media создаётся сам)
npm run db:deploy       # применить миграции
npm run db:seed         # тексты из messages/*.json, картинки → MinIO, демо-контент
npm run dev             # http://localhost:3000
```

Проверки: `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm test`, `npm run build` (сборке нужна БД).

## Куда идти

| Что                                    | Адрес                                                                  |
| -------------------------------------- | ---------------------------------------------------------------------- |
| Сайт (русский)                         | http://localhost:3000                                                  |
| Сайт (английский)                      | http://localhost:3000/en                                               |
| Страница коллекции                     | http://localhost:3000/catalog/menya-zapomnyat                          |
| Админка                                | http://localhost:3000/admin                                            |
| Тексты сайта                           | http://localhost:3000/admin/content                                    |
| Меню / соцсети                         | http://localhost:3000/admin/menu · http://localhost:3000/admin/socials |
| Настройки (контакты, SEO, шкала звёзд) | http://localhost:3000/admin/settings                                   |
| Медиатека                              | http://localhost:3000/admin/media                                      |
| Консоль MinIO                          | http://127.0.0.1:9001 (логин и пароль — `docker-compose.dev.yml`)      |
| База данных (Prisma Studio)            | `npm run db:studio`                                                    |

Админка в dev открыта без пароля (жёлтый баннер). Пароль включается переменной `ADMIN_PASSWORD`.

## Что где менять

- **Любой текст сайта** — админка «Тексты сайта». Значения по умолчанию лежат в `messages/ru.json` и `messages`, сид кладёт их в таблицу `Message`. Правки из админки сид не перезаписывает.
- **Телефон, e-mail, адрес, SEO, шкала звёзд отзывов** — «Настройки».
- **Пункты меню** (шапка и подвал) — «Меню». **Ссылки на соцсети и мессенджеры** — «Соцсети».
- **Коллекции, товары, отзывы, новости, галерея, спецпредложения, партнёры** — одноимённые разделы. Новая коллекция появляется на сайте сразу после публикации.
- **Картинки** — «Медиатека». Файлы хранятся в MinIO по ключу `admin/<id>/<uuid>/image.webp`, ссылка `/media/…` — в таблице `Media`.
- **Интерфейс админки** — `messages/admin/ru.json`. **Демо-контент сида** — `messages`.

Как добавлять новый текст в код — `../.claude`. Правила для агентов — `AGENTS.md`.

## Скриншоты

|                                                          |                                                          |
| -------------------------------------------------------- | -------------------------------------------------------- |
| ![Отзывы со звёздами](docs/screenshots/site-reviews.png) | ![Контакты и форма](docs/screenshots/site-contacts.png)  |
| ![Страница коллекции](docs/screenshots/site-catalog.png) | ![Дашборд](docs/screenshots/admin-dashboard.png)         |
| ![Тексты сайта](docs/screenshots/admin-texts.png)        | ![Меню](docs/screenshots/admin-menu.png)                 |
| ![Соцсети](docs/screenshots/admin-socials.png)           | ![Отзыв: выбор звёзд](docs/screenshots/admin-review.png) |
| ![Настройки](docs/screenshots/admin-settings.png)        | ![Медиатека](docs/screenshots/admin-media.png)           |

## Документация

- `docs/ARCHITECTURE.md` — стек, модель данных, тексты, картинки, админка.
- `docs/CONVENTIONS.md` — соглашения по коду (дизайн, анимации, кэш, заявки, доступ к админке …).
- `DEPLOY.md` — деплой на VPS (Docker Compose: app, Postgres, MinIO, Caddy), бэкапы.
- `BRIEF.md` — бриф и исходные тексты.
