# ⛏ MC Launcher

Кастомный лаунчер Minecraft с авторизацией через собственный сервер (Yggdrasil-совместимый).  
Позволяет запускать лицензионный и нелицензионный Minecraft, управлять скинами и версиями.

---

## ✨ Возможности

| Функция | Описание |
|---------|----------|
| 🔐 Авторизация | Собственный Yggdrasil-сервер — логин, регистрация, токены |
| ☕ Java | Автоскачивание и установка Java 21 (Adoptium) |
| 📦 Версии | Загрузка любой версии Minecraft напрямую с серверов Mojang |
| 🎨 Скины | Загрузка PNG-скина, выбор модели (классик/slim) |
| 📡 Сессии | Совместимость с серверами через Yggdrasil session API |
| 🖥️ Консоль | Вывод логов игры в реальном времени |
| 🔧 Настройки | Кастомный путь к Java, папка игры, объём памяти |
| 🪟 Custom UI | Frameless-окно с тайтлбаром, тёмная тема |

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

### Для владельцев сервера (auth-server)

#### Требования
- Node.js 18+

#### Установка

```bash
git clone https://github.com/YOUR_USERNAME/minecraft-launcher.git
cd minecraft-launcher/auth-server
npm install
npm start
```

Сервер запустится на `http://localhost:3000`.  
При первом старте автоматически генерируется RSA-4096 пара ключей.

#### Порты и маршруты

| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/` | Yggdrasil metadata (authlib-injector читает при старте) |
| POST | `/api/register` | Регистрация |
| POST | `/authserver/authenticate` | Вход |
| POST | `/authserver/validate` | Проверка токена |
| POST | `/authserver/refresh` | Обновление токена |
| POST | `/sessionserver/session/minecraft/join` | Присоединение к серверу |
| GET | `/sessionserver/session/minecraft/hasJoined` | Проверка игрока на сервере |
| GET | `/sessionserver/session/minecraft/profile/:uuid` | Профиль игрока |
| POST | `/api/skin` | Загрузка скина (base64 PNG) |
| DELETE | `/api/skin` | Сброс скина |
| GET | `/skins/:uuid.png` | Получение скина |

---

## 🔨 Сборка из исходников

### Требования
- Node.js 18+
- npm 9+

### Установка зависимостей

```bash
git clone https://github.com/YOUR_USERNAME/minecraft-launcher.git
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

Или через батники (Windows):
```
start_auth.bat
start_launsher.bat
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
├── auth-server/             # Сервер авторизации
│   ├── src/
│   │   ├── index.js         # Express-приложение
│   │   ├── database.js      # JSON-хранилище (users, tokens, sessions)
│   │   ├── crypto.js        # RSA ключи + подпись текстур
│   │   ├── skins.js         # Работа с PNG-файлами скинов
│   │   └── routes/
│   │       ├── api.js           # /api/* (register, skin)
│   │       ├── authserver.js    # /authserver/* (Yggdrasil auth)
│   │       └── sessionserver.js # /sessionserver/* (Yggdrasil session)
│   └── package.json
│
├── launcher/                # Electron-лаунчер
│   ├── src/
│   │   ├── main/
│   │   │   ├── index.ts     # Главный процесс, IPC
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
├── start_auth.bat           # Быстрый запуск сервера
├── start_launsher.bat       # Быстрый запуск лаунчера
└── README.md
```

---

## 🛠️ Стек технологий

**Лаунчер:**
- [Electron](https://electronjs.org/) — десктопное приложение
- [React 18](https://react.dev/) + TypeScript — UI
- [electron-vite](https://electron-vite.org/) — сборка
- [axios](https://axios-http.com/) — HTTP
- [adm-zip](https://github.com/cthackers/adm-zip) — распаковка библиотек/Java
- [authlib-injector](https://github.com/yushijinhun/authlib-injector) — патч Minecraft клиента для кастомного auth

**Auth Server:**
- [Express](https://expressjs.com/) — HTTP-сервер
- [bcryptjs](https://github.com/dcodeIO/bcrypt.js) — хэширование паролей
- [Node.js crypto](https://nodejs.org/api/crypto.html) — RSA-4096 ключи и подпись
- JSON-файл — хранилище данных (без нативных зависимостей)

---

## ⚠️ Важные заметки

- **Приватный ключ** (`auth-server/data/private.pem`) никогда не коммитится в git (добавлен в `.gitignore`)
- Auth-сервер нужен только если ты хочешь **собственную авторизацию** (для своего сервера Minecraft)
- Для работы в интернете auth-сервер нужно задеплоить на VPS и настроить HTTPS
- `authlib-injector` скачивается автоматически при первом запуске игры

---

## 📜 Лицензия

[MIT](LICENSE)
