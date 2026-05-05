# ⛏ MC Launcher

Кастомный лаунчер Minecraft с авторизацией через собственный сервер (Yggdrasil-совместимый).  
Позволяет запускать Minecraft, управлять скинами и версиями без аккаунта Mojang.

> **Auth-сервер** вынесен в отдельный репозиторий: [loxjor/mc-auth-server](https://github.com/loxjor/mc-auth-server)

---

## ✨ Возможности

| Функция | Описание |
|---------|----------|
| 🔐 Авторизация | Подключение к Yggdrasil-серверу — логин, регистрация, токены |
| ☕ Java | Автоскачивание и установка Java 21 (Adoptium) |
| 📦 Версии | Загрузка любой версии Minecraft напрямую с серверов Mojang |
| 🎨 Скины | Загрузка PNG-скина, выбор модели (классик/slim), 3D-просмотр |
| ✏️ Смена ника | Инлайн-редактирование с кулдауном 24 часа |
| 📡 Сессии | Совместимость с серверами через Yggdrasil session API |
| 🖥️ Консоль | Вывод логов игры в реальном времени, выделение и копирование |
| 🔧 Настройки | Кастомный путь к Java, папка игры, объём памяти |

---

## 🏗️ Архитектура

```
┌─────────────────────────────┐      HTTP      ┌──────────────────────────┐
│      MC Launcher            │ ─────────────► │     MC Auth Server       │
│   (Electron + React)        │                │   (Node.js + Express)    │
│                             │                │                          │
│  • Авторизация              │ ◄───────────── │  • Yggdrasil API         │
│  • Скачивание версий        │   tokens       │  • Хранение пользователей│
│  • Управление Java          │                │  • Раздача скинов        │
│  • Запуск игры              │                │  • RSA подпись текстур   │
│  • Управление скинами       │                │                          │
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

### Запуск auth-сервера

Инструкция в отдельном репо: [loxjor/mc-auth-server](https://github.com/loxjor/mc-auth-server)

---

## 🔨 Сборка из исходников

### Требования
- Node.js 18+
- npm 9+

```bash
git clone https://github.com/loxjor/minecraft-launcher.git
cd minecraft-launcher
npm run install:all
npm run dev
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
└── README.md
```

---

## 🛠️ Стек технологий

- [Electron](https://electronjs.org/) + [React 18](https://react.dev/) + TypeScript
- [electron-vite](https://electron-vite.org/) — сборка
- [skinview3d](https://github.com/bs-community/skinview3d) — 3D-просмотр скина
- [axios](https://axios-http.com/) — HTTP
- [authlib-injector](https://github.com/yushijinhun/authlib-injector) — патч Minecraft для кастомного auth

---

## ⚠️ Важные заметки

- `authlib-injector` скачивается автоматически при первом запуске игры
- Для работы в интернете auth-сервер нужно задеплоить на VPS

---

## 📜 Лицензия

[MIT](LICENSE)
