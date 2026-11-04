# Метрики посещений сайта

## Цель

Дать админу понимание реальной посещаемости сайта: сколько уникальных посетителей зашло за час/день, с фильтрами и графиком, без внешних сервисов и без хранения персональных данных.

## Что считаем визитом

**Уникальное посещение с одного IP за часовой bucket (UTC).**
Первый запрос публичного endpoint'а с IP-адреса в течение часа создаёт запись; последующие запросы с того же IP в тот же час обновляют только `lastAt`.

Почасовая гранулярность позволяет строить графики «по часам» и при этом агрегировать «по дням» через `count(distinct ip_hash)` за календарный день.

## Цели и не-цели

**В scope:**
- запись уникальных визитов на публичных страницах сайта;
- хранение только анонимизированных данных (хеш IP, урезанный User-Agent, путь, время);
- отдельная админ-страница `/admin/visits` с графиком и фильтрами;
- небольшой виджет на дашборде: сегодня / вчера + ссылка на страницу визитов.

**Out of scope:**
- отслеживание внутренних переходов, кликов, целей;
- realtime / WebSocket;
- автоматическая ротация / удаление старых записей (сейчас трафик невелик, лимит не нужен);
- точный учёт каждого обращения — см. «Ограничения».

## Ограничения

Next.js-фронтенд кеширует публичные данные через `'use cache'` + `cacheTag('content')`. Поэтому backend-перехватчик фиксирует только запросы, которые дошли до бэкенда (промахи кеша / первая загрузка после ревалидации). Это даёт **тенденцию**, но не абсолютно точный счётчик каждой загрузки страницы. Если позже понадобится точность, проще добавить лёгкий клиентский ping, чем менять текущую схему.

## Рассмотренные подходы

| Подход | Плюсы | Минусы | Решение |
|---|---|---|---|
| **A. Таблица `visits`, одна строка на (час, хеш IP)** | Поддерживает графики по часам и по дням, минимум мусора | На высокой посещаемости больше строк, чем в daily | **Выбрано** |
| B. Таблица `daily_visits`, одна строка на (день, хеш IP) | Меньше строк | Нельзя построить честный почасовой график | Отклонено |
| C. Таблица `visitor_events` для каждого запроса + `count(distinct ip)` | Гибкая аналитика, популярные страницы | Таблица растёт быстро | Отклонено |
| D. Внешний сервис (Yandex/Google/Plausible) | Много функций из коробки | Внешняя зависимость, cookie-баннеры, приватность | Отклонено |

## Как будем делать

### 1. Модель данных

Новая Prisma-модель `Visit`:

```prisma
model Visit {
  id         String   @id @default(dbgenerated("uuidv7()")) @db.Uuid
  hourBucket DateTime @map("hour_bucket")
  ipHash     String   @map("ip_hash")
  firstAt    DateTime @default(now()) @map("first_at")
  lastAt     DateTime @default(now()) @map("last_at")
  userAgent  String?  @map("user_agent") @db.VarChar(512)
  path       String?  @map("path") @db.VarChar(2048)
  createdAt  DateTime @default(now()) @map("created_at")
  updatedAt  DateTime @updatedAt @map("updated_at")

  @@unique([hourBucket, ipHash])
  @@index([hourBucket(sort: Desc)])
  @@map("visits")
}
```

- `hourBucket` — дата+время, усечённые до начала часа (UTC).
- `ipHash` — HMAC-SHA256 сети посетителя (переиспользуем существующий `VisitorNetworkHasher`, вынеся его в `module/common`).
- `path` — первый путь, с которого пришёл посетитель в этот час.
- `userAgent` — урезанный до 512 символов `x-client-user-agent`.

### 2. Запись визитов

- Создать `VisitTrackingInterceptor` в slice S1 (`public/content`).
- Применить его к `PublicContentModule` через `APP_INTERCEPTOR` или `@UseInterceptors` на уровне модуля, чтобы перехватывать все публичные страницы (landing, каталог, коллекции, настройки, sitemap, сообщения).
- НЕ трекаем `health`, `/media`, `/api/leads` и админские endpoint'ы.
- Interceptor после обработки запроса выполняет `upsert`:
  - `(hourBucket, ipHash)` → `firstAt = coalesce(existing.firstAt, now)`, `lastAt = now`.
- Ошибка записи не ломает ответ сайта (логируем, но не падаем).

### 3. Админские endpoint'ы

#### 3.1. Сводка для дашборда

Расширить `GET /api/v1/admin/dashboard`, добавив в `DashboardResponse`:

```ts
visits: {
  today: number;
  yesterday: number;
}
```

- `today` / `yesterday` — `count(distinct ipHash)` за соответствующие сутки.

#### 3.2. Страница визитов

Новый endpoint:

```
GET /api/v1/admin/visits/stats?from=YYYY-MM-DD&to=YYYY-MM-DD&granularity=day|hour
```

Ответ:

```ts
{
  points: { bucket: string; count: number }[];
  total: number;
}
```

- `granularity=day` — `count(distinct ipHash)` за каждый день между `from` и `to`.
- `granularity=hour` — `count(distinct ipHash)` за каждый час между `from 00:00` и `to 23:00`.
- `total` — общее число уникальных IP за весь период.

Дополнительно:

```
GET /api/v1/admin/visits/recent?limit=20
```

Список последних визитов (по `lastAt` desc) для быстрого контроля.

### 4. Frontend

#### 4.1. Страница `/admin/visits`

- **Фильтры** (через URL search params):
  - диапазон: сегодня / 7 дней / 30 дней / произвольные `from`/`to`;
  - гранулярность: час / день;
  - тип графика: линия / столбцы.
- **График**: собственный SVG-компонент (`components/admin/ui/Chart.tsx`), без новых зависимостей. При наведении показывает тултип с bucket и count.
- **Таблица** последних визитов: время, путь, User-Agent (сокращённо).

#### 4.2. Виджет на дашборде

В `frontend/src/app/admin/(panel)/page.tsx` добавить карточку:
- «Визиты сегодня» / «вчера»;
- ссылка «Подробнее →» на `/admin/visits`.

#### 4.3. Контракты и тексты

- Обновить `shared/contracts/dashboard.ts` (добавить `visits` в `DashboardResponse`).
- Новый контракт `shared/contracts/visits.ts` для stats/recent.
- Тексты добавить в `shared/messages/admin/ru.json` (и `en.json`) по правилам site-texts.

### 5. Миграции и тесты

- Prisma-migration для `visits`.
- Юнит-тест на `VisitTrackingInterceptor` (in-memory репозиторий / мок Prisma).
- E2E-тест на `/api/v1/admin/visits/stats`: создаём несколько визитов, проверяем агрегаты по часам и дням.
- E2E-тест на dashboard: проверяем `visits.today` / `visits.yesterday`.

## Что остаётся за мной (исполнителю)

- Вынести `VisitorNetworkHasher` в `module/common`.
- Реализовать interceptor, репозиторий, usecases, controller'ы.
- Обновить shared-контракты.
- Реализовать страницу `/admin/visits` с графиком и фильтрами и виджет на дашборде.
- Написать миграцию и тесты.
