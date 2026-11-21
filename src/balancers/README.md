# Адаптеры источников

Каждый источник должен быть отдельным адаптером, реализующим контракт из `src/core/adapter-contract.js`.

Минимальный пример:

```js
var adapter = LOB.createAdapter({
    id: 'example',
    name: 'Example',
    search: function (query) {
        // Вернуть Promise со списком результатов.
        return Promise.resolve([]);
    },
    resolve: function (item) {
        // Вернуть Promise с разрешённым URL/потоком,
        // если это разрешено API источника.
        return Promise.resolve(null);
    }
});
```

До реализации проверьте официальную документацию API, авторизацию, условия использования и совместимость с Lampa. Не храните секреты в клиентском коде. Не обходите DRM, paywall или авторизацию. Не включайте адаптер в каталог до проверки его работы.
