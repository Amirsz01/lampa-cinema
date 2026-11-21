(function (root) {
    'use strict';

    var VERSION = '0.2.0';
    var PREFIX = 'lob_';
    var SOURCES = [
        ['lumex', 'Lumex'], ['lumex_ads', 'Lumex (Ads)'], ['hdrezka', 'HDrezka'],
        ['kinobase', 'Kinobase'], ['collaps', 'Collaps'], ['collaps_dash', 'Collaps (DASH)'],
        ['cdnmovies', 'CDNMovies'], ['filmix', 'Filmix'], ['zetflix', 'Zetflix'],
        ['fancdn', 'FanCDN'], ['fancdn_id', 'FanCDN (ID)'], ['fanserials', 'FanSerials'],
        ['videoseed', 'VideoSeed'], ['vibix', 'Vibix'], ['redheadsound', 'RedHeadSound'],
        ['redheadsound_dash', 'RedHeadSound (DASH)'], ['cdnvideohub', 'CDNVideoHub'],
        ['anilibria', 'AniLibria'], ['anilibria_top', 'AniLibria.top'], ['animelib', 'AnimeLib'],
        ['kodik', 'Kodik'], ['alloha', 'Alloha'], ['kinopub', 'KinoPub']
    ].map(function (item) {
        return { id: item[0], name: item[1], status: item[0] === 'anilibria' ? 'search-ready' : 'planned' };
    });

    var adapters = {};

    function requestJSON(url) {
        return new Promise(function (resolve, reject) {
            var xhr = new XMLHttpRequest();
            xhr.open('GET', url, true);
            xhr.timeout = 15000;
            xhr.setRequestHeader('Accept', 'application/json');
            xhr.onreadystatechange = function () {
                if (xhr.readyState !== 4) return;
                if (xhr.status < 200 || xhr.status >= 300) {
                    reject(new Error('HTTP ' + xhr.status));
                    return;
                }
                try { resolve(JSON.parse(xhr.responseText)); }
                catch (error) { reject(new Error('Invalid JSON response')); }
            };
            xhr.onerror = function () { reject(new Error('Network or CORS error')); };
            xhr.ontimeout = function () { reject(new Error('Request timeout')); };
            xhr.send();
        });
    }

    function normalizeAniLibria(item) {
        var names = item.names || {};
        var posters = item.posters || {};
        var poster = posters.original || posters.medium || posters.small || {};
        return {
            id: item.id,
            source: 'anilibria',
            title: names.ru || names.alternative || names.en || 'Без названия',
            originalTitle: names.en || '',
            year: item.year || '',
            poster: poster.url || poster.src || '',
            description: item.description || '',
            raw: item
        };
    }

    adapters.anilibria = {
        id: 'anilibria',
        name: 'AniLibria',
        capabilities: ['search'],
        search: function (query) {
            var url = 'https://api.anilibria.tv/v3/title/search?search=' +
                encodeURIComponent(query) +
                '&filter=id,names,posters,year,description&limit=15';
            return requestJSON(url).then(function (data) {
                var list = Array.isArray(data) ? data : (data.list || []);
                return list.map(normalizeAniLibria);
            });
        },
        resolve: function () {
            return Promise.reject(new Error('Получение прямого потока для AniLibria ещё не реализовано'));
        }
    };

    function getStorage() {
        return root.Lampa && root.Lampa.Storage ? root.Lampa.Storage : null;
    }

    function initSettings() {
        var store = getStorage();
        if (!store || typeof store.get !== 'function' || typeof store.set !== 'function') return;
        SOURCES.forEach(function (source) {
            var key = PREFIX + 'enabled_' + source.id;
            if (store.get(key) === undefined || store.get(key) === null) store.set(key, false);
        });
    }

    function notify(message) {
        if (root.Lampa && root.Lampa.Noty && typeof root.Lampa.Noty.show === 'function') {
            root.Lampa.Noty.show(message);
        } else if (root.console && root.console.info) {
            root.console.info('[Lampa Cinema] ' + message);
        }
    }

    function showResults(source, results) {
        if (!root.Lampa || !root.Lampa.Select || typeof root.Lampa.Select.show !== 'function') {
            notify('Найдено: ' + results.length + '. В этой версии Lampa нет Select API.');
            return;
        }
        if (!results.length) {
            notify(source.name + ': ничего не найдено');
            return;
        }
        root.Lampa.Select.show({
            title: source.name + ' — результаты',
            items: results.map(function (item) {
                return { title: item.title + (item.year ? ' (' + item.year + ')' : ''), item: item };
            }),
            onSelect: function (selected) {
                var item = selected.item;
                notify(item.title + ': поиск работает, получение видеопотока пока не подключено.');
            }
        });
    }

    function searchSource(source, movie) {
        var store = getStorage();
        var enabled = store && store.get(PREFIX + 'enabled_' + source.id) === true;
        if (!enabled) {
            notify(source.name + ' выключен в настройках Lampa Cinema');
            return;
        }
        var adapter = adapters[source.id];
        if (!adapter || typeof adapter.search !== 'function') {
            notify(source.name + ': адаптер ещё не реализован');
            return;
        }
        var query = movie.original_title || movie.original_name || movie.title || movie.name || '';
        if (!query) {
            notify('Не удалось определить название фильма');
            return;
        }
        notify('Поиск в ' + source.name + '…');
        adapter.search(query).then(function (results) {
            showResults(source, results);
        }).catch(function (error) {
            notify(source.name + ': ' + error.message);
        });
    }

    function openSourceMenu(movie) {
        if (!root.Lampa || !root.Lampa.Select || typeof root.Lampa.Select.show !== 'function') {
            notify('Lampa Cinema загружен, но Select API недоступен');
            return;
        }
        root.Lampa.Select.show({
            title: 'Lampa Cinema — источники',
            items: SOURCES.map(function (source) {
                var status = source.status === 'search-ready' ? 'поиск доступен' : 'в разработке';
                return { title: source.name + ' · ' + status, source: source };
            }),
            onSelect: function (selected) {
                searchSource(selected.source, movie);
            }
        });
    }

    function registerLampa() {
        if (!root.Lampa || !root.Lampa.Manifest) return;
        root.Lampa.Manifest.plugins = {
            type: 'video',
            onContextMenu: function () {
                return { title: 'Lampa Cinema' };
            },
            onContextLauch: function (card) {
                openSourceMenu(card || {});
            }
        };
    }

    function boot() {
        initSettings();
        registerLampa();
        if (root.console && root.console.info) {
            root.console.info('[Lampa Cinema] v' + VERSION + ' loaded; AniLibria search adapter ready, other providers planned.');
        }
    }

    var api = {
        version: VERSION,
        sources: SOURCES,
        adapters: adapters,
        boot: boot,
        search: function (sourceId, query) {
            if (!adapters[sourceId]) return Promise.reject(new Error('Adapter not implemented'));
            return adapters[sourceId].search(query);
        }
    };

    root.LampaOnlineBalancers = api;
    if (root.Lampa && root.Lampa.Listener && typeof root.Lampa.Listener.follow === 'function') {
        if (root.appready) boot();
        else root.Lampa.Listener.follow('app', function (event) {
            if (event.type === 'ready') boot();
        });
    } else {
        boot();
    }
}(typeof window !== 'undefined' ? window : this));
