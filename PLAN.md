# EList UI — Архитектурный план и промпт для Qwen Coder

## 1. Анализ макета (ea.html)

**Выявленные паттерны дизайна:**
- Тёмная тема по умолчанию (`#0f0f0f` фон, `#1a1a1a` поверхности)
- Акцентный цвет: фиолетовый градиент `#6366f1 → #8b5cf6` (indigo/violet)
- Шрифт: системный стек (`-apple-system, BlinkMacSystemFont, Segoe UI`)
- Радиус скруглений: 8–12px
- Боковая выдвижная панель навигации (не постоянная на мобиле)
- Header 64px с логотипом, переключателем темы, аватаром профиля
- CSS Custom Properties для тематизации (не Tailwind) → **выбран CSS Modules**

---

## 2. Структура проекта (Feature-Sliced Design)

```
src/
├── app/
│   ├── providers/
│   │   ├── AppLayout.tsx        ← Корневой layout (header + sidebar + outlet)
│   │   └── AppLayout.module.css
│   ├── router/
│   │   └── index.tsx            ← createBrowserRouter, lazy-loading страниц
│   └── store/
│       └── index.ts             ← Zustand: useThemeStore, useFavoritesStore,
│                                             useAuthStore, useFiltersStore
│
├── pages/
│   ├── home/
│   │   ├── HomePage.tsx         ← Карта + список + фильтры
│   │   ├── FilterBar.tsx        ← Панель фильтров (дата, тип, цена, радиус)
│   │   ├── EventModal.tsx       ← Всплывающий превью-модал события
│   │   └── *.module.css
│   ├── event/
│   │   ├── EventPage.tsx        ← Полная страница события (accordion-секции)
│   │   └── EventPage.module.css
│   ├── user/
│   │   ├── UserPage.tsx         ← Профиль пользователя
│   │   └── UserPage.module.css
│   ├── my-events/
│   │   ├── MyEventsPage.tsx     ← Мои события (вкладки: активные / архив)
│   │   └── MyEventsPage.module.css
│   └── create-event/
│       ├── CreateEventPage.tsx  ← Создание и редактирование мероприятия
│       └── CreateEventPage.module.css
│
├── features/
│   ├── event-list/
│   │   └── useEvents.ts         ← Custom hook: загрузка + пагинация событий
│   ├── event-map/               ← [TODO] интеграция карты
│   ├── event-filters/           ← [TODO] каскадные фильтры тип/подтип
│   ├── favorites/               ← через useFavoritesStore (zustand + persist)
│   └── auth/                    ← [TODO] форма входа/регистрации
│
├── entities/
│   ├── event/
│   │   ├── types.ts             ← IEvent, IEventType, IEventCategory, IEventParameters
│   │   ├── api.ts               ← fetchEvents, fetchEventById, joinEvent, ...
│   │   ├── index.ts             ← публичный barrel
│   │   └── ui/
│   │       ├── EventCard.tsx    ← Compound Component карточки
│   │       └── EventCard.module.css
│   └── user/
│       ├── types.ts             ← IAccount, IPersonInfo, IContact, ISubscription
│       └── api.ts               ← [TODO]
│
└── shared/
    ├── api/
    │   ├── client.ts            ← HTTP-клиент (fetch + JWT header "Authorization-jwt")
    │   └── types.ts             ← CommandResult<T>, PagedList<T>, Gender
    └── hooks/
        └── index.ts             ← useDebounce, useLocalStorage, useInfiniteScroll, useGeolocation
```

---

## 3. Ключевые технические решения

### Аутентификация
API использует **кастомную схему N3** (не Bearer):
```
Authorization-jwt: <token>   ← заголовок запроса
```
`apiClient` в `shared/api/client.ts` автоматически добавляет его из `localStorage`.
Для логина: `POST /eList/api/authorization` → сохранить JWT в `useAuthStore`.

### Пагинация
API возвращает `EventPagedList { pageIndex, pageSize, total, result[] }`.
`useEvents` хук управляет бесконечным скроллом через `IntersectionObserver`.

### Мок-режим
Установите `VITE_USE_MOCK=true` в `.env.local` — все запросы уйдут в `fetchEventsMock`.
Полезно для разработки без поднятого бэкенда.

### Карта
Сейчас — плейсхолдер с mock-маркерами. Для продакшна интегрируйте:
```bash
# Вариант A — Leaflet (open source, без ключа)
npm install react-leaflet leaflet @types/leaflet

# Вариант B — Яндекс.Карты 3.0 (актуальная версия для РФ)
npm install @yandex/ymaps3-types
```
Компонент карты разместите в `features/event-map/EventMap.tsx`.

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

## 5. Промпт для Qwen Coder — последующие задачи

Используй этот промпт при работе с Qwen Coder для продолжения разработки:

---

```
Ты — Senior React/TypeScript разработчик. Проект — EList UI, агрегатор городских мероприятий.

СТЕК: React 18, TypeScript, Vite, CSS Modules, Zustand, React Router v6.
АРХИТЕКТУРА: Feature-Sliced Design (FSD). Слои: app → pages → features → entities → shared.
АЛИАСЫ: @/ = src/. Пример: import { IEvent } from '@/entities/event'.
ТЕМА: CSS Custom Properties (--bg, --surface, --border, --accent, --text-primary и т.д.).
API: REST, базовый URL из import.meta.env.VITE_API_BASE_URL.
     Авторизация: заголовок "Authorization-jwt: <token>" (схема N3, не Bearer).
     Все ответы обёрнуты в CommandResult<T> { success, errorCode, message, result }.

ЗАДАЧА: [ВСТАВЬ ЗАДАЧУ ЗДЕСЬ]

ТРЕБОВАНИЯ:
1. Строго соблюдай FSD — не импортируй из более высоких слоёв вниз.
2. Используй CSS Modules (*.module.css), не inline-стили.
3. Типизируй всё через TypeScript (no any).
4. Выноси логику в custom hooks.
5. Компоненты — функциональные, без class components.
6. Выдай полный код файлов, готовый к вставке в проект.
```

---

## 6. Чеклист интеграции с репозиторием github.com/crash240192/EList.UI

### Шаг 1 — Подготовка репозитория
```bash
git clone https://github.com/crash240192/EList.UI.git
cd EList.UI
```

### Шаг 2 — Установка зависимостей
```bash
npm install
# или если нужна чистая установка:
npm install react react-dom react-router-dom zustand
npm install -D typescript @types/react @types/react-dom vite @vitejs/plugin-react
```

### Шаг 3 — Копирование файлов каркаса
Скопируй сгенерированные файлы в `src/` согласно структуре FSD выше.
Заменяй существующие если они конфликтуют.

### Шаг 4 — Настройка алиасов
- Вставь `vite.config.ts` (с alias `@` → `src/`)
- Вставь `tsconfig.json` (с `paths: { "@/*": ["src/*"] }`)

### Шаг 5 — Переменные окружения
```bash
cp .env.example .env.local
# Отредактируй VITE_API_BASE_URL и VITE_USE_MOCK
```

### Шаг 6 — Запуск
```bash
npm run dev   # http://localhost:3000
```

---

## 7. Что реализовано в каркасе / Что нужно дописать

### ✅ Реализовано
- Все TypeScript-типы из Swagger (IEvent, IEventCategory, IEventType, IEventParameters, IAccount, ...)
- HTTP-клиент с JWT-аутентификацией и обработкой ошибок
- `entities/event/api.ts` — полный CRUD + поиск + участие
- `EventCard` — Compound Component (Cover, Title, Meta, Price, Rating, FavoriteButton, Preset)
- `useEvents` — бесконечный скролл с пагинацией
- `useDebounce`, `useLocalStorage`, `useInfiniteScroll`, `useGeolocation`
- Zustand-сторы: тема, избранное, авторизация, фильтры
- AppLayout — header + выдвижной sidebar + переключатель темы
- HomePage — карта (плейсхолдер) + список + FilterBar + EventModal
- EventPage — полная страница события с аккордеон-секциями
- Роутинг с lazy-loading всех страниц

### 🔧 Нужно дописать (в порядке приоритета)
1. **Интеграция карты** — `features/event-map/EventMap.tsx` (Leaflet или Яндекс.Карты)
2. **UserPage** — `pages/user/UserPage.tsx` (профиль, подписки, рейтинг)
3. **MyEventsPage** — `pages/my-events/MyEventsPage.tsx` (вкладки: активные/архив)
4. **CreateEventPage** — `pages/create-event/CreateEventPage.tsx` (форма создания/редактирования)
5. **Форма авторизации** — страница логина/регистрации
6. **Каскадные фильтры тип/подтип** — подгрузка типов при выборе категории
7. **Страница кошелька** — баланс, тариф, операции
8. **Рейтинг ожидания** — голосование + отображение
9. **Список участников** — с группировкой "мои друзья"
10. **Медиа-альбомы** — фотогалерея события
