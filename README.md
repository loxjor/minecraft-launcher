# ⛏ MC Launcher

Кастомный лаунчер Minecraft с авторизацией через собственный сервер (Yggdrasil-совместимый).  
Позволяет запускать Minecraft, управлять скинами и версиями без аккаунта Mojang.

---

## ✨ Возможности

| Функция | Описание |
|---------|----------|
| 🔐 Авторизация | Собственный Yggdrasil-сервер — логин, регистрация, токены |
| ☕ Java | Автоскачивание и установка Java 21 (Adoptium) |
| 📦 Версии | Загрузка любой версии Minecraft напрямую с серверов Mojang |
| 🎨 Скины | Загрузка PNG-скина, выбор модели (классик/slim), 3D-просмотр |
| 🖼️ Дефолтный скин | Пользователи без своего скина получают общий дефолтный |
| ✏️ Смена ника | Инлайн-редактирование с кулдауном 24 часа |
| 📡 Сессии | Совместимость с серверами через Yggdrasil session API |
| 🖥️ Консоль | Вывод логов игры в реальном времени, выделение и копирование |
| 🔧 Настройки | Кастомный путь к Java, папка игры, объём памяти |
| 🐳 Docker | Auth-сервер готов к запуску в контейнере |

---

## 🏗️ Архитектура

```
┌─────────────────────────────┐      HTTP      ┌──────────────────────────┐
│      MC Launcher            │ ─────────────► │     Auth Server          │
│   (Electron + React)        │                │   (Node.js + Express)    │
│                             │                │                          │
│  • Авторизация              │ ◄───────────── │  • Yggdrasil API         │
│  • Скачивание версий        │   JWT tokens   │  • Хранение пользовате-  │
│  • Управление Java          │                │    лей (JSON)            │
│  • Запуск игры              │                │  • Раздача скинов        │
│  • Управление скинами       │                │  • RSA подпись текстур   │
└─────────────────────────────┘                └──────────────────────────┘
           │
           │ authlib-injector (javaagent)
           ▼
┌─────────────────────────────┐
│     Minecraft Client        │
│  (скачивается автоматом)    │
└─────────────────────────────┘
```

---

## 🚀 Быстрый старт

### Для пользователей

1. Скачай установщик `MC-Launcher-Setup-x.x.x.exe` из [Releases](../../releases)
2. Установи и запусти
3. На экране входа нажми **«Изменить»** и укажи URL сервера авторизации
4. Зарегистрируйся или войди

### Auth-сервер — Docker (рекомендуется)

```bash
git clone https://github.com/loxjor/minecraft-launcher.git
cd minecraft-launcher/auth-server
```

Отредактируй `docker-compose.yml` — укажи свой IP или домен:

```yaml
environment:
  - PUBLIC_HOST=1.2.3.4:3000   # твой внешний IP или домен
```

Запусти:

```bash
docker compose up -d
```

Проверь:

```bash
curl http://localhost:3000/api/health
```

> **Данные** (`db.json`, RSA-ключи, скины) хранятся в `./data/` — при пересборке контейнера не теряются.

### Auth-сервер — без Docker

#### Требования
- Node.js 18+

```bash
cd minecraft-launcher/auth-server
npm install
npm start
```

Сервер запустится на `http://localhost:3000`.  
При первом старте автоматически генерируется RSA-4096 пара ключей.

---

## 🔌 API auth-сервера

| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/` | Yggdrasil metadata (authlib-injector) |
| GET | `/api/health` | Проверка работоспособности |
| POST | `/api/register` | Регистрация |
| PUT | `/api/username` | Смена ника (кулдаун 24 ч) |
| POST | `/api/skin` | Загрузка скина (base64 PNG) |
| DELETE | `/api/skin` | Сброс скина |
| GET | `/api/skin/info` | Информация о скине текущего пользователя |
| POST | `/api/skin/default` | Установка дефолтного скина для всех |
| GET | `/skins/:file` | Получение PNG-скина (fallback → default.png) |
| POST | `/authserver/authenticate` | Вход |
| POST | `/authserver/validate` | Проверка токена |
| POST | `/authserver/refresh` | Обновление токена |
| POST | `/authserver/invalidate` | Выход (инвалидация токена) |
| POST | `/authserver/signout` | Выход по логину/паролю |
| POST | `/sessionserver/session/minecraft/join` | Присоединение к серверу |
| GET | `/sessionserver/session/minecraft/hasJoined` | Проверка игрока на сервере |
| GET | `/sessionserver/session/minecraft/profile/:uuid` | Профиль игрока |

---

## 🔨 Сборка из исходников

### Требования
- Node.js 18+
- npm 9+

```bash
git clone https://github.com/loxjor/minecraft-launcher.git
cd minecraft-launcher
npm run install:all
```

### Запуск в режиме разработки

```bash
# Терминал 1 — auth server
npm run auth:dev

# Терминал 2 — лаунчер
npm run launcher
```

### Сборка установщика (.exe)

```bash
cd launcher
npm run package
```

Готовый установщик появится в `launcher/dist/`.

---

## 📁 Структура проекта

```
minecraft-launcher/
├── auth-server/
│   ├── assets/
│   │   └── default.png          # Дефолтный скин (для пользователей без своего)
│   ├── src/
│   │   ├── index.js             # Express-приложение
│   │   ├── database.js          # JSON-хранилище (users, tokens, sessions)
│   │   ├── crypto.js            # RSA-4096 ключи + подпись текстур
│   │   ├── skins.js             # Работа с PNG-файлами скинов
│   │   └── routes/
│   │       ├── api.js           # /api/*
│   │       ├── authserver.js    # /authserver/* (Yggdrasil auth)
│   │       └── sessionserver.js # /sessionserver/* (Yggdrasil session)
│   ├── Dockerfile
│   ├── docker-compose.yml
│   └── package.json
│
├── launcher/
│   ├── src/
│   │   ├── main/
│   │   │   ├── index.ts     # Главный процесс, IPC-хендлеры
│   │   │   ├── auth.ts      # HTTP-клиент к auth-серверу
│   │   │   ├── java.ts      # Поиск и загрузка Java
│   │   │   ├── minecraft.ts # Загрузка версий, запуск игры
│   │   │   └── config.ts    # Чтение/запись конфига
│   │   ├── preload/
│   │   │   └── index.ts     # contextBridge API
│   │   └── renderer/src/
│   │       ├── App.tsx
│   │       └── pages/
│   │           ├── Login.tsx
│   │           ├── Register.tsx
│   │           └── Home.tsx  # Play, Console, Skin, Settings
│   └── package.json
│
└── README.md
```

---

## 🛠️ Стек технологий

**Лаунчер:**
- [Electron](https://electronjs.org/) + [React 18](https://react.dev/) + TypeScript
- [electron-vite](https://electron-vite.org/) — сборка
- [skinview3d](https://github.com/bs-community/skinview3d) — 3D-просмотр скина
- [axios](https://axios-http.com/) — HTTP
- [authlib-injector](https://github.com/yushijinhun/authlib-injector) — патч Minecraft для кастомного auth

**Auth Server:**
- [Express](https://expressjs.com/) — HTTP-сервер
- [bcryptjs](https://github.com/dcodeIO/bcrypt.js) — хэширование паролей
- [Node.js crypto](https://nodejs.org/api/crypto.html) — RSA-4096 и подпись текстур
- JSON-файл — хранилище данных (без нативных зависимостей)
- [Docker](https://www.docker.com/) — контейнеризация

---

## ⚠️ Важные заметки

- **Приватный ключ** (`auth-server/data/private.pem`) никогда не коммитится в git
- Скины пользователей хранятся в `auth-server/data/skins/` и тоже не попадают в git
- Дефолтный скин (`auth-server/assets/default.png`) — в репозитории, можно заменить
- `authlib-injector` скачивается автоматически при первом запуске игры
- Для работы в интернете укажи реальный IP/домен в `PUBLIC_HOST`

---

## 📜 Лицензия

[MIT](LICENSE)
