# Lampa Cinema

Независимый плагин-каркас для Lampa, предназначенный для подключения онлайн-источников через отдельные адаптеры.

## Состояние проекта

Версия: 0.1.0 (starter).

Сейчас реализованы точка входа, список планируемых источников и контракт адаптера. Поисковые и playback-адаптеры для перечисленных источников ещё не реализованы и не проверены. Все источники выключены по умолчанию. Это не готовый каталог работающих балансеров.

## Планируемые источники

- Lumex
- Lumex (Ads)
- HDrezka
- Kinobase
- Collaps
- Collaps (DASH)
- CDNMovies
- Filmix
- Zetflix
- FanCDN
- FanCDN (ID)
- FanSerials
- VideoSeed
- Vibix
- RedHeadSound
- RedHeadSound (DASH)
- CDNVideoHub
- AniLibria
- AniLibria.top
- AnimeLib
- Kodik
- Alloha
- KinoPub

## Разработка

Контракт адаптера находится в `src/core/adapter-contract.js`, инструкции — в `src/balancers/README.md`.

Не добавляйте приватные токены, cookies или учётные данные. Не обходите авторизацию, DRM или технические ограничения провайдеров. Перед реализацией каждого источника проверьте доступность публичного API, условия использования и совместимость с Lampa.

## Подключение

После включения GitHub Pages плагин будет доступен по адресу:

`https://amirsz01.github.io/lampa-cinema/online_balancers.js`

Добавьте этот URL в Lampa как источник плагина.
