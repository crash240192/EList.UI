# EList UI — Архитектурный план

## 1. Анализ макета (ea.html)

**Выявленные паттерны дизайна:**
- Тёмная тема по умолчанию (`#0f0f0f` фон, `#1a1a1a` поверхности)
- Акцентный цвет: фиолетовый градиент `#6366f1 → #8b5cf6` (indigo/violet)
- Шрифт: системный стек (`-apple-system, BlinkMacSystemFont, Segoe UI`)
- Радиус скруглений: 8–12px
- Боковая выдвижная панель навигации (не постоянная на мобиле)
- Header 64px с логотипом, переключателем темы, аватаром профиля
- CSS Custom Properties для тематизации → **CSS Modules**

---

## 2. Структура проекта (Feature-Sliced Design)

```
src/
├── app/
│   ├── providers/          ← AppLayout (header + sidebar + outlet)
│   ├── router/             ← createBrowserRouter, lazy-loading страниц
│   └── store/              ← Zustand: тема, избранное, авторизация, фильтры
│
├── pages/
│   ├── home/               ← Карта + список + фильтры + EventModal
│   ├── event/              ← Страница мероприятия, альбомы, обсуждения
│   ├── user/               ← Профиль пользователя
│   ├── my-events/          ← Мои мероприятия (активные / архив)
│   ├── create-event/       ← Создание и редактирование мероприятия
│   ├── auth/               ← Логин, регистрация, активация, восстановление пароля
│   ├── wallet/             ← Кошелёк и тарифы
│   ├── invitations/        ← Приглашения
│   ├── settings/           ← Настройки аккаунта
│   ├── admin/              ← Админка (типы, контакты, тарифы)
│   └── event-albums/       ← Альбомы мероприятий
│
├── features/
│   ├── event-list/         ← useEvents, useMyEvents, useEventsMapShort
│   ├── event-map/          ← Яндекс.Карты: карта, пикер, модалки
│   ├── event-filters/      ← FilterBar, CategoryTypePicker, MobileFilterSheet
│   ├── event-discussion/   ← Обсуждения мероприятия
│   ├── event/              ← Участники, рейтинг, приглашения, BW-списки
│   ├── auth/               ← AuthGuard, RequireAuth, геолокация, активация
│   ├── subscriptions/      ← Подписки на организаторов
│   ├── notifications/      ← WebSocket-уведомления
│   ├── media/              ← Альбомы и загрузка фото
│   └── invitations/        ← Стор приглашений
│
├── entities/
│   ├── event/              ← IEvent, API, EventCard, EventListItem
│   ├── user/               ← IAccount, кошелёк, аватар
│   ├── invitation/         ← Приглашения
│   ├── media/              ← Альбомы и файлы
│   ├── conversation/       ← Обсуждения
│   └── admin/              ← Тарифы и валидаторы
│
└── shared/
    ├── api/                ← HTTP-клиент, file storage
    ├── hooks/              ← useDebounce, useInfiniteScroll, useGeolocation
    ├── lib/                ← ageLimit, yandex-maps, datetime, breakpoints
    └── ui/                 ← DatePicker, CoverUpload, ConfirmDialog, ...
```

---

## 3. Ключевые технические решения

### Аутентификация
API использует **кастомную схему N3** (не Bearer):
```
authorization-jwt: <token>
```
`apiClient` автоматически добавляет заголовок из `useAuthStore` (cookie).
При 401 — редирект на `/login`.

### Пагинация
API возвращает `PagedList { pageIndex, pageSize, total, result[] }`.
`useEvents` управляет бесконечным скроллом через `IntersectionObserver`.

### Мок-режим
`VITE_USE_MOCK=true` в `.env.local` — запросы идут в mock-данные.

### Карта
Интегрированы **Яндекс.Карты 3.0** через `shared/lib/yandex-maps.ts`.
В dev прокси `/yandex-maps-api` обходит CORS.
Компоненты: `EventMap`, `YandexMapPicker`, `MapPickerModal`, `EventMapModal`.

### Возрастное ограничение мероприятия
Допустимые значения: **0+, 6+, 12+, 16+, 18+** (`shared/lib/ageLimit.ts`).
В форме создания/редактирования — выпадающий список.
Максимум ограничивается лимитом тарифа (`tariffValidator.ageLimit`):
- тариф с лимитом 12+ → доступны 0+, 6+, 12+
- без тарифа или лимит 0 → только 0+

---

## 4. Соответствие API-эндпоинтов и фич

| Фича                        | Эндпоинт                              | Метод |
|-----------------------------|---------------------------------------|-------|
| Поиск событий               | `/api/events/search`                  | POST  |
| Получить событие            | `/api/events/get/{id}`                | GET   |
| Создать событие             | `/api/events/create`                  | POST  |
| Обновить событие            | `/api/events/update/{id}`             | PUT   |
| Начать событие              | `/api/events/start/{id}`              | PUT   |
| Завершить событие           | `/api/events/finish/{id}`             | PUT   |
| Участвовать                 | `/api/events/participation/join/{id}` | POST  |
| Покинуть                    | `/api/events/participation/leave/{id}`| POST  |
| Параметры (цена, возраст)   | `/api/events/parameters/get/{id}`     | GET   |
| Категории                   | `/api/events/categories/getAll`       | GET   |
| Типы событий                | `/api/events/types/getAll`            | GET   |
| Авторизация                 | `/api/authorization`                  | POST  |
| Данные аккаунта             | `/api/accounts/getData`               | GET   |
| Кошелёк                     | `/api/wallet/get`                     | GET   |
| Контакты                    | `/api/contacts/getAccountContacts`    | GET   |
| Подписки                    | `/api/subscriptions/...`              | GET   |

---

## 5. Команды разработки

```bash
npm run dev      # Vite dev server (localhost:5173)
npm run build    # Type-check + build (tsc && vite build)
npm run preview  # Preview production build
npm run lint     # ESLint
```

Переменные окружения — см. `.env.example` (`VITE_API_BASE_URL`, `VITE_USE_MOCK`, `VITE_YANDEX_MAPS_KEY`, ...).

---

## 6. Статус реализации

### ✅ Реализовано
- Полный CRUD мероприятий, поиск, участие, BW-списки, приглашения
- Яндекс.Карты: просмотр, поиск, пикер при создании/редактировании
- HomePage: карта + список + фильтры (десктоп и мобильный sheet)
- EventPage: обложка, участники, рейтинг, обсуждения, альбомы, шаринг
- CreateEventPage: форма с тарифными ограничениями, возраст — select (0+/6+/12+/16+/18+)
- MyEventsPage, UserPage, WalletPage, InvitationsPage, SettingsPage
- Auth: логин, регистрация, активация, восстановление пароля
- AdminPage: категории/типы, контакты, тарифы и валидаторы
- Уведомления (WebSocket), подписки, медиа-альбомы
- Zustand-сторы, JWT-аутентификация, тёмная/светлая тема

### 🔧 Возможные доработки
1. **История операций кошелька** — сейчас частично на мок-данных
2. **E2E / unit-тесты** — тестовый фреймворк не настроен
3. **Группировка участников «мои друзья»** — если потребуется на бэкенде
4. **Оптимизация бандла** — lazy chunks, code splitting

---

## 7. Промпт для последующих задач (AI / Qwen Coder)

```
Ты — Senior React/TypeScript разработчик. Проект — EList UI, агрегатор городских мероприятий.

СТЕК: React 18, TypeScript, Vite, CSS Modules, Zustand, React Router v6.
АРХИТЕКТУРА: Feature-Sliced Design (FSD). Слои: app → pages → features → entities → shared.
АЛИАСЫ: @/ = src/.
ТЕМА: CSS Custom Properties (--bg, --surface, --border, --accent, --text-primary).
API: REST, базовый URL из import.meta.env.VITE_API_BASE_URL.
     Авторизация: заголовок "authorization-jwt: <token>".
     Ответы: CommandResult<T> { success, errorCode, message, result }.

ЗАДАЧА: [ВСТАВЬ ЗАДАЧУ ЗДЕСЬ]

ТРЕБОВАНИЯ:
1. Строго соблюдай FSD.
2. CSS Modules (*.module.css), без inline-стилей где возможно.
3. TypeScript без any.
4. Логику выноси в hooks / shared/lib.
5. Функциональные компоненты.
```
