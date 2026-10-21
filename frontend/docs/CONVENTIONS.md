# ГАДЮКА — соглашения по коду

Справочник «что где лежит и как устроено». Обзор архитектуры — `docs/ARCHITECTURE.md`, как добавлять текст — `../.claude/skills/site-texts/SKILL.md`, новая функция от контракта до экрана — `../shared/contracts/README.md`.

## Тексты

Весь видимый текст сайта — `shared/messages/{ru,en}.json` в корне репозитория (импорт `@shared/messages/*`) → сид → таблица `Message` бэкенда → `getSiteMessages(locale)` (`src/i18n/site-messages.ts`, `GET /api/v1/public/messages/:locale`) поверх JSON-дефолтов. Секции лендинга берут строки из `content.texts['<ключ>']`, серверный код — `getTranslations`, шаблоны с React-узлами — `formatNodes` (`src/components/site/message-template.tsx`). Метаданные текстов (порядок разделов, `required`, вид `richtext` / `template` / `link`, картинки лендинга) — `shared/messages/meta/site-texts.json` (по ним бэкенд проверяет правки, сайт берёт оттуда ключи картинок, `src/lib/content/registry.ts`); подписи разделов и текстов в админке — `shared/messages/admin/ru.json` → `admin.siteTexts`. Интерфейс админки — `shared/messages/admin/ru.json` (`getTranslations` / `useTranslations` / `getAdminTranslations` — последний строит переводчик из встроенных сообщений, без бэкенда). Демо-контент сида — `shared/messages/content/{ru,en}.json`. В коде нет кириллических литералов — это проверяют `src/lib/content/site-copy.test.ts` и `src/lib/admin/admin-copy.test.ts`.

## Бэкенд (`src/lib/api`, подробно — README там)

Фронтенд только отображает: чтение и запись — через бэкенд, правил и валидации здесь нет. Публичные данные — `publicRead(path)` (request-time + `'use cache'` + `cacheTag('content')`), страницы админки — `readAdminData(path)` / `readAdminRow(path)` (`src/lib/api/admin-read.ts`, после `requireAdminPage()`), server actions админки — `adminApiAction(label, () => adminRequest(path, { method, body }), { revalidatesContent, onSuccess, fieldErrors })` (ошибки бэкенда → `ActionResult` с переведёнными `fieldErrors`; `fieldErrors` — отказы, которые форма показывает и у поля). Типы — `@shared/contracts/<область>`. Запросы админки — `src/lib/admin/queries/<область>.ts`, действия — `src/lib/admin/actions/<область>.ts`, вид для компонентов — рядом (`catalog-view.ts`, `content-entities.ts`, `site-texts.ts`, `types.ts` → `EntityRow`). Операции списков (публикация, порядок, удаление) — `src/lib/admin/actions/entities.ts` → `/api/v1/admin/entities/*`.

## Переводимые поля

Тексты UI сайта — `Message` (см. «Тексты»). Переводимые поля сущностей приходят из API как `LocalizedText` (`{ ru, en }`, `shared/contracts/common.ts`); чтение в админке — `src/lib/localized-text.ts` (`readText(value, locale)` с фолбэком на ru, `missingLocales`, `parseLocalizedText` для ответов route handlers); сайт получает от бэкенда уже локализованные строки. Хранение (обрезка пробелов, пустые переводы не сохраняются) — бэкенд

## Локали

`src/i18n/locales.ts` — единственный список. ru без префикса, en — `/en`

## Дизайн (публичная часть)

«Нуар-комикс» (`concepts/01-noir-comic`) + красная лента «ГАДЮКА» из `concepts/03-editorial-ink`: стили `src/styles/noir.css`, шрифты Tektur / Montserrat / Shantell Sans через `next/font` (Tektur и Montserrat — preload; Shantell — один статичный вес 700, без preload: рукописного текста на первом экране нет). Запасной шрифт Tektur до его загрузки — `Tektur Caps Fallback` в `noir.css` (Arial, подогнанный под заглавные: почти весь Tektur — капсом), а ширины в Tektur заданы в `em`, не в `ch` (`ch` считается по запасному шрифту) — заголовки не переносятся иначе и страница не прыгает, когда шрифт приходит. CSS отдаётся отдельным кэшируемым файлом (`<link>`); `experimental.inlineCss` выключен намеренно: он дублирует стили в RSC-payload и удваивает HTML, замеры — в комментарии в `next.config.ts`

## Порядок глав

`CHAPTER_ORDER` в `src/lib/content/registry.ts` (Каталог → О нас → [лента] → Пошив → Спецпредложения → Новости → Галерея → Отзывы → Партнёры → Контакты): номера «Глава NN» и колонтитулы «— NN —» выводятся из него. Меню (шапка, мобильное меню, подвал) — таблица `MenuItem` (админка «Меню»: подпись, ссылка, «в шапке» / «в подвале», порядок, публикация); сид создаёт 6 пунктов в порядке глав (Главная, Каталог, О нас, Индивидуальный пошив, Специальное предложение, Контакты); ссылки строит `src/components/site/nav.ts` (`#якорь` → главная + якорь, `/путь` → путь с языком, внешние — в новой вкладке). К «Партнёрам» ведёт кнопка в «О нас»

## Анимации

GSAP 3.15 (ScrollTrigger, SplitText) + Lenis 1.3: провайдер `src/components/site/motion/SmoothScroll.tsx`, сцены секций `src/components/site/scenes/*` (`useScene` = `gsap.context` + revert). Скрытие-до-анимации — только под `html.motion` (inline-скрипт). Интро обложки — CSS с первого кадра (`html.is-intro`, `noir.css` «COVER INTRO», кривые GSAP как `linear()` из `scripts/css-eases.mjs`); `HeroScene` добавляет только то, что после интро. Сцены настраиваются лениво (`motion/scheduler.ts`: видимые сразу, остальные за 1,5 экрана до появления, по одной на задачу; ScrollTrigger, SplitText и Lenis грузятся после монтирования), до настройки стартовые состояния рисует CSS под `html.motion-pending` + `[data-scene-pending]` на корне сцены (страховка — 4 с после `load`, если бандл или ScrollTrigger не пришли; ScrollTrigger запрашивается при гидратации, не пришёл за 6 с — сцены показываются без анимации). Главы лендинга — `content-visibility: auto` (только где есть scroll anchoring, `@supports (overflow-anchor: auto)`; Safari раскладывает главы обычным образом; оценки высот в `noir.css`; заранее главы не раскладываются — переход по якорю догоняет цель кадр за кадром, `tweenScroll` из `motion/scroll-tween.ts`). `ScrollTrigger.refresh` — только через `scheduleRefresh` (`motion/env.ts` + `motion/refresh-gate.ts`): мышь/трекпад — «безопасный» `refresh(true)`; тач-экран — только когда страница стоит (ни пальца, ни прокрутки, включая инерцию) не меньше 1 с, и не полный `refresh()`, а каждый триггер по отдельности (`env.ts refreshEach`): полный пересчёт прокручивает окно в 0 и обратно, и встроенный браузер Telegram (WebView с user agent обычного Chrome) после этого швырял следующий свайп на тысячи пикселей; закреплений (pin) у триггеров нет — иначе нужен полный пересчёт, а изменения высоты меньше 96 px пересчёт не вызывают вовсе (полный пересчёт прокручивает окно в 0 и обратно и на телефоне откатывал свайп — прыжки до 543 px в Chrome на Android); свой автоматический на `load` выключен, изменение одной лишь высоты окна на тач-экране его не вызывает. Поздние главы (холодный визит по медленной сети): если посетитель листает, пока JS ещё не загрузился, глава, подошедшая к экрану в стартовом состоянии, получает `data-scene-late` (встроенный «поздний затвор» в `motion/boot.ts`, только после прокрутки самим посетителем и только до первой настройки сцен) — CSS не рисует её стартовые состояния, а при настройке уже виденные элементы остаются как есть (`effects.ts unseen()`), ниже экрана — анимируются как обычно; без этого главы были пустыми блоками и «выезжали» под пальцем. Защита от ложных тапов (`TAP_GUARD` в `motion/boot.ts`, пороги в `motion/tap-guard.ts`, первым делом на каждой странице, с анимациями и без): клик и его совместимый `mousedown` от касания, которое застало страницу в движении (инерция, видимая часть плавной прокрутки к якорю; при занятом главном потоке окно шире), сдвинуло её или вложенную прокрутку (меню, ряд обложек) или проехало пальцем больше 24 px, отменяются до всех обработчиков — Android WebView (Telegram, Instagram, VK, WhatsApp), в отличие от Chrome, превращал часть быстрых свайпов в клики: ссылка под пальцем уводила страницу к своей главе («перескакивает при быстрой прокрутке»), открывала лайтбокс галереи или страницу коллекции, поле формы получало фокус с клавиатурой; клавиатура (`detail 0`), мышь и перо не трогаются. Оттуда же `window.__gadyukaScrollAt` (змейка не отдаёт голову пальцу, под которым страница всё ещё едет) и `window.__gadyukaInput` (первое действие посетителя ещё до гидрации — выравнивание по `#якорю` из адреса в `SmoothScroll` после него не срабатывает). Диагностика на устройстве: `?diag=1` (плашка `public/diag/scroll-diag.js`, в том числе счётчик заблокированных тапов), переключатели `?lite=0 | 1`, `?snake=0` (`motion/boot.ts`). Встроенные браузеры приложений (Telegram, Instagram, VK… — WebView, `motion/in-app.ts`, по user agent; сайт, добавленный на экран «Домой» iOS, к ним не относится — `navigator.standalone`/`display-mode: standalone`): `html.motion-lite`вместо сцен — страница сразу в финальном виде, ScrollTrigger и Lenis не грузятся; остаются интро обложки, CSS-петли (дождь, бегущие строки, красная лента, язык змеи), а уход обложки, дрейф SFX и ленты — CSS scroll-driven анимации, цвет фото по центру —`motion/lite.ts`. Высота обложки в px (`--hero-h`, `html.hero-px`), а не `100svh`, — во встроенных браузерах и на всех сенсорных экранах (Telegram притворяется Chrome и по user agent не распознаётся): приложение меняет высоту WebView посреди прокрутки (сворачивающееся нижнее меню, шторка, клавиатура), `100svh`шла за ней, и всё ниже обложки прыгало на экране — scroll anchoring изменение окна не компенсирует (замерено в WebView эмулятора: прыжок на высоту меню при каждом её переключении; с px — ни одного); px берётся заново только при смене ширины или наверху страницы. Язык змеи (обложка и крупный план в «О нас») — CSS-анимация`tongue-flick`своего слоя (компоситор), а не GSAP.`prefers-reduced-motion` — без Lenis и анимаций, всё видно сразу

## Полоса прокрутки

На публичных страницах вместо системной — змея у правого края (`src/components/site/chrome/ScrollSpine.tsx`, на всех ширинах; прогресс рисует CSS — scroll-driven анимации в `noir.css`, с первого кадра и без скрипта при прокрутке; где их нет — rAF в компоненте). Голову можно тянуть (мышь, перо; палец — только после удержания головы ~0,3 с, `TOUCH_HOLD_MS`: свайп, начатый на голове, и любое касание дорожки у края на тач-экране — обычная прокрутка страницы, иначе большой палец у правого края перебрасывал страницу на экраны вперёд — так было во встроенном браузере Telegram), нажатие мышью на дорожку плавно ведёт страницу туда. На тач-экране зоны захвата — только в боковом поле (`--side`), дорожка ловит лишь тап (он ведёт страницу туда), свайп по ней листает страницу как обычно; захват отпускается и при потере фокуса окна, контекстном меню, движении без нажатой кнопки, отмене касания. Системный скроллбар скрыт в `noir.css` под `html.snake-bar` (ставит `MOTION_BOOT`, а страницам, которые рисует клиент — 404, — сама змея); без JS остаётся системный, змеи нет, а если бандл не пришёл — страховка `MOTION_BOOT` возвращает системный через 4 с после `load` (без `html.snake-ready`). В режиме принудительных цветов (высокий контраст Windows) змея рисуется системными цветами. Внутренние прокрутки (мобильное меню, лента обложек) и админка (свой корневой layout) — со своими скроллбарами

## Чтение контента

Только во время запроса: `publicRead(path)` (`src/lib/api/public.ts`: `connection()` + `'use cache'` + `cacheTag('content')` + `cacheLife('hours')`), `next build` бэкенд не вызывает; корневой layout `[locale]` и блокирующиеся страницы — `export const instant = false`. Лендинг и коллекция — `getLanding(locale)` / `getCollectionBySlug(slug, locale)` из `@/lib/content` (свои кэш-функции, `src/lib/content/public-api.ts`)

## Клиентский бандл

клиентские компоненты не импортируют ICU-рантайм (`intl-messageformat`, парсер — проверяет `test/client-imports.test.ts`; шаблоны с аргументами форматирует сервер, `message-template.tsx`) и реестр текстов: якоря — `@/lib/content/anchors`, намерения заявки — `@/lib/lead-intent`, конфигурация формы — `@/lib/lead-form-config`, валидатор заявки и разбор ответа API — `@/lib/leads` (ручные проверки без зависимостей, ~1 КБ gzip), `LocalizedText` и его чтение — `@/lib/localized-text`, лимиты форм админки — `@/lib/admin/limits`, типы соцсетей — `@/lib/content/social`. Пакеты бэкенда (zod, Prisma, pg, sharp, AWS SDK …) запрещены во всём `src/` (тот же тест). На публичных страницах нет клиентского next-intl и `next/image`: системные строки сервер передаёт пропсами (`src/components/site/labels.ts`), картинки — `<img>` с атрибутами `getImageProps` (`image-props.ts`)

## Сброс кэша после записи

Server Action: `adminApiAction(…, { revalidatesContent: true })` или `revalidateContent()`; Route Handler: `revalidateContentFromRoute()`

## Медиа

S3/MinIO, ключи и обработка — в бэкенде. `Media.key` = `<admin|user>/<ownerId>/<uuid>/image.webp`, `Media.url` = `/media/<key>` (строит бэкенд) — сайт и админка используют `url` как есть. Отдача — `src/app/media/[...key]/route.ts` (прокси на `${BACKEND_URL}/media/<key>`, `src/lib/api/media-proxy.ts`); загрузка — `src/app/admin/api/media/route.ts` (поток на бэкенд, `src/lib/api/media.ts`); `next/image` разрешает `/media/**` (`next.config.ts` → `images.localPatterns`)

## Бренд-ассеты

`public/brand/*` (SVG с `currentColor`); публичные страницы запрашивают их по URL с хешем содержимого (`?v=…`: `next.config.ts` считает хеши `public/brand/*.svg` при сборке → `brandAssetUrl`; в CSS — свойства `--brand-…` на `<html>`, `brand/brand-assets.ts`), такие ответы кэшируются навсегда (`immutable`), без `?v` — `max-age=0, must-revalidate`; правка файла дойдёт до всех со следующей сборкой. Змея на обложке — `<use href="/brand/logo-red-tongue-ink.svg?v=…#ink">` (у `<g>` логотипа `id="ink"` — не удалять); сплошной красный язык под её контуром — `logo-red-tongue-fill.svg#fill` (силуэт языка из альфа-канала `assets/cutout/logo-red-tongue.png`, `node scripts/trace-tongue-fill.mjs`, нужен potrace). Потрейс-векторы сайта (`logo-red-tongue-ink`, `head-closeup-*`, `head-front-ink`, `tongue-red`, `wordmark-ink`) и буквы вордмарка `src/components/site/brand/wordmark-paths.ts` — сгенерированы `node scripts/optimize-brand-svg.mjs` из исходников `assets/vector/` (координаты на более грубой сетке K, компактная запись; руками не править — менять таблицу K в скрипте и сверять рендер старого и нового). Арт глав ниже первого экрана (маски, фигура в отзывах) и шрифт Shantell запрашиваются, только когда глава ближе 1,5 экрана к видимой области (подвал — ближе половины экрана): `html.near-gate` + `[data-near]` (`motion/boot.ts`, только production и только с JS; публичные страницы ссылаются друг на друга обычными `<a>` — при переходе через `next/link` шлюз надо снимать)

## Разметка для редактирования

`data-edit="<ключ сообщения>"`, `data-edit-img="<ключ картинки>"`; поля сущностей и пункты меню — `data-entity="Product" data-entity-id="…"` + `data-field="title"`

## Форма заявок

одна форма «Письмо в редакцию» в контактах (`src/components/site/LeadForm.tsx`, якорь `#lead-form`); поле «Тема» = тип заявки (пошив → TAILORING, сотрудничество → PARTNERSHIP, вопрос/другое → CONTACT). Кнопки на сайте выбирают тему: ссылки с `data-lead-type` / `data-lead-subject` (на лендинге) или `/?topic=…&subject=…#lead-form` (с других страниц) — `src/components/site/lead-links.ts`. Без JS (или до гидратации) форма — обычный POST на `/api/leads` (urlencoded), ответ 303 → `/#lead-sent` / `#lead-invalid` / `#lead-failed`, сообщение показывает CSS `:target`

## Telegram

уведомления о заявках отправляет бэкенд (`TELEGRAM_*` — его переменные); в dev/тестах `TELEGRAM_DRY_RUN=1`, реальные сообщения не отправляются, такие заявки помечаются «не отправлено» (`telegramSent=false`), админка показывает жёлтый баннер (`GET /api/v1/admin/leads/telegram/status`)

## Заявки: лимиты

на бэкенде: 5 заявок / 10 мин на IP (IPv6 — на /64), проверка и вставка в одной транзакции под `pg_advisory_xact_lock`; больше 60 заявок / 10 мин на весь сайт — сохраняются без уведомления в Telegram. IP посетителя этот сервер передаёт в `x-client-ip` (`src/lib/api/client-ip.ts`: `X-Real-IP`, иначе последний адрес `X-Forwarded-For`)

## Смена языка

`LanguageSwitcher` ведёт на ту же главу в другом языке (`/#reviews` → `/en#reviews`, `src/components/site/locale-switch.ts`); без JS — на начало страницы. Глубокие ссылки (`#product-…`, `#lead-form`) после загрузки выравниваются под шапку без учёта анимационных сдвигов (`SmoothScroll`)

## Партнёры в сиде

заглушки «Партнёр 01…03» сид бэкенда создаёт скрытыми (`published: false`): `Partner.name` один на все языки, поэтому до появления настоящих партнёров сайт показывает свои переведённые ячейки «Место для партнёра» / «Your brand here»

## Каталог

лендинг + страница коллекции `/catalog/<slug>` (`src/app/[locale]/catalog/[slug]/page.tsx`, в sitemap, BreadcrumbList + ItemList JSON-LD; Product в JSON-LD только у товаров с ценой)

## Заголовки безопасности

`next.config.ts` → `headers()` и обратный прокси (одинаковые; базовый CSP без script-src; требования к прокси — `docs/COMPRESSION.md`)

## Доступ к админке

Все маршруты — только после входа (логин + пароль аккаунта бэкенда; `ADMIN_PASSWORD` / открытой админки больше нет). Вход/выход — `src/lib/admin/actions/auth.ts` (httpOnly-cookies `gadyuka_admin_access` / `gadyuka_admin_refresh`, `src/lib/api/session-cookies.ts`). `src/proxy.ts` → `src/lib/api/admin-proxy.ts`: просроченный access-токен (по `exp`) + refresh → один refresh на токен (single flight, 30 с), новые cookies в ответ и в текущий рендер; без сессии — 307 на `/admin/login?next=…` (оптимистично). Граница безопасности — `requireAdminPage` / `requireAdminRoute` (`src/lib/admin/auth.ts`, `GET /auth/me` бэкенда раз на запрос) в каждой странице, запросе и route handler; server actions защищает бэкенд — он проверяет токен и роль на каждом вызове (401 → «Сессия истекла…»). `/admin/api/*` вне прокси (загрузки не буферизуются) — там токен не обновляется: на 401 клиент перезагружает страницу. Dev-сервер — на `localhost` (`next dev -H localhost`)

## Загрузка в админке

у каждого раздела и страницы с данными свой `loading.tsx` (скелетон) — иначе навигация блокируется (проверка instant navigation в dev)

## OG-картинка по умолчанию

`public/opengraph-image.png` (`/opengraph-image.png`), используется, если в «Настройках» не выбрана своя; фавикон — `src/app/favicon.ico` (из `icon.png`)
