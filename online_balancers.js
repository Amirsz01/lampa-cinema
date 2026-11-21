(function (root) {
    'use strict';

    var VERSION = '0.7.1';
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
        return { id: item[0], name: item[1], status: (item[0] === 'anilibria' || item[0] === 'collaps') ? 'search-ready' : 'planned' };
    });

    var adapters = {};

    function proxyLink(url, proxyBase) {
        var pos = url.indexOf('/');
        if (pos !== -1 && url.charAt(pos + 1) === '/') pos++;
        var prefix = pos !== -1 ? url.substring(0, pos + 1) : '';
        var rest = pos !== -1 ? url.substring(pos + 1) : url;
        return proxyBase + 'enc/' + encodeURIComponent(root.btoa(prefix)) + '/' + rest;
    }

    function getProxyBase() {
        var store = getStorage();
        var value = store && typeof store.get === 'function' ? store.get(PREFIX + 'proxy_url') : '';
        if (typeof value !== 'string') return '';
        value = value.trim();
        if (!value) return '';
        return value.replace(/\/+$/, '') + '/';
    }

    function requestJSON(url) {
        return new Promise(function (resolve, reject) {
            var proxyBase = getProxyBase();
            var requestUrl = proxyBase ? proxyLink(url, proxyBase) : url;

            if (root.Lampa && typeof root.Lampa.Reguest === 'function') {
                var network = new root.Lampa.Reguest();
                network.timeout(30000);
                network.silent(requestUrl, function (json) {
                    if (typeof json === 'string') {
                        try { json = JSON.parse(json); }
                        catch (error) { reject(new Error('AniLibria вернула некорректный JSON')); return; }
                    }
                    resolve(json);
                }, function (a, c) {
                    reject(new Error(network.errorDecode ? network.errorDecode(a, c) : 'Ошибка запроса. Проверьте API и адрес прокси.'));
                });
                return;
            }

            var xhr = new XMLHttpRequest();
            xhr.open('GET', requestUrl, true);
            xhr.timeout = 30000;
            xhr.setRequestHeader('Accept', 'application/json');
            xhr.onreadystatechange = function () {
                if (xhr.readyState !== 4) return;
                if (xhr.status < 200 || xhr.status >= 300) {
                    reject(new Error('HTTP ' + xhr.status));
                    return;
                }
                try { resolve(JSON.parse(xhr.responseText)); }
                catch (error) { reject(new Error('AniLibria вернула некорректный JSON')); }
            };
            xhr.onerror = function () { reject(new Error('Ошибка сети или CORS. Укажите CORS-прокси в настройках.')); };
            xhr.ontimeout = function () { reject(new Error('Тайм-аут запроса')); };
            xhr.send();
        });
    }

    function releaseTitle(item) {
        var name = item && item.name;
        if (name && typeof name === 'object') return name.main || name.english || name.alternative || 'Без названия';
        return typeof name === 'string' && name ? name : 'Без названия';
    }

    function normalizeAniLibria(item) {
        var poster = item.poster || {};
        var image = poster.optimized || poster;
        return {
            id: item.id,
            source: 'anilibria',
            title: releaseTitle(item),
            originalTitle: item.name_english || '',
            year: item.year || '',
            poster: image.src || image.preview || poster.src || poster.preview || '',
            description: item.description || '',
            raw: item
        };
    }

    adapters.anilibria = {
        id: 'anilibria',
        name: 'AniLibria',
        capabilities: ['search', 'episodes', 'hls'],
        search: function (query) {
            var queries = Array.isArray(query) ? query : [query];
            queries = queries.filter(function (value, index) {
                return typeof value === 'string' && value.trim() &&
                    queries.indexOf(value) === index;
            }).map(function (value) { return value.trim(); }).slice(0, 6);

            if (!queries.length) return Promise.resolve([]);

            return Promise.all(queries.map(function (value) {
                var url = 'https://anilibria.top/api/v1/app/search/releases?query=' +
                    encodeURIComponent(value);
                return requestJSON(url).then(function (data) {
                    var list = Array.isArray(data) ? data : (data.data || data.list || []);
                    return list.map(normalizeAniLibria);
                }).catch(function () {
                    // Ошибка одного варианта названия не должна отменять остальные запросы.
                    return [];
                });
            })).then(function (groups) {
                var result = [];
                var seen = {};
                groups.forEach(function (list) {
                    list.forEach(function (item) {
                        var key = String(item.id || item.title);
                        if (seen[key]) return;
                        seen[key] = true;
                        result.push(item);
                    });
                });
                return result;
            });
        },
        resolve: function (item) {
            if (!item || !item.id) return Promise.reject(new Error('Не указан ID релиза AniLibria'));
            return requestJSON('https://anilibria.top/api/v1/anime/releases/' + encodeURIComponent(item.id))
                .then(function (data) {
                    if (!data || !Array.isArray(data.episodes)) throw new Error('У релиза нет списка серий');
                    return data;
                });
        }
    };


    function requestText(url, headers) {
        return new Promise(function (resolve, reject) {
            var proxyBase = getProxyBase();
            var requestUrl = proxyBase ? proxyLink(url, proxyBase) : url;
            if (!root.Lampa || typeof root.Lampa.Reguest !== 'function') {
                reject(new Error('Для Collaps требуется сетевой модуль Lampa'));
                return;
            }
            var network = new root.Lampa.Reguest();
            network.timeout(15000);
            network.native(requestUrl, function (data) {
                resolve(typeof data === 'string' ? data : String(data || ''));
            }, function (a, b) {
                reject(new Error(network.errorDecode ? network.errorDecode(a, b) : 'Ошибка запроса Collaps'));
            }, false, { dataType: 'text', headers: headers || {} });
        });
    }

    function parseCollapsPlayer(text) {
        var source = String(text || '').replace(/\\n/g, '');
        var marker = source.search(/makePlayer\s*\(/);
        if (marker < 0) throw new Error('Collaps не вернул конфигурацию плеера');
        var start = source.indexOf('{', marker);
        if (start < 0) throw new Error('В ответе Collaps отсутствует конфигурация');
        var depth = 0;
        var quote = '';
        var escaped = false;
        var end = -1;
        for (var i = start; i < source.length; i++) {
            var ch = source.charAt(i);
            if (quote) {
                if (escaped) escaped = false;
                else if (ch === '\\') escaped = true;
                else if (ch === quote) quote = '';
                continue;
            }
            if (ch === '"' || ch === "'" || ch === '`') { quote = ch; continue; }
            if (ch === '{') depth++;
            else if (ch === '}' && --depth === 0) { end = i + 1; break; }
        }
        if (end < 0) throw new Error('Конфигурация Collaps обрезана');
        var configText = source.slice(start, end);
        try { return JSON.parse(configText); }
        catch (e) {
            try { return (new Function('return (' + configText + ')'))(); }
            catch (error) { throw new Error('Не удалось разобрать ответ Collaps'); }
        }
    }

    adapters.collaps = {
        id: 'collaps',
        name: 'Collaps',
        capabilities: ['search', 'seasons', 'episodes', 'hls'],
        search: function (queries, movie) {
            // movie.id в Lampa обычно является TMDB/internal ID, а не ID Кинопоиска.
            // Передаём его в /kp/ только если источник карточки явно Kinopoisk.
            var kp = movie && (movie.kinopoisk_id || movie.kp_id || movie.kinopoisk);
            var imdb = movie && (movie.imdb_id || movie.imdb);
            var ids = [];
            if (kp) ids.push('kp/' + encodeURIComponent(kp));
            if (imdb) ids.push('imdb/' + encodeURIComponent(imdb));
            if (!ids.length && movie && movie.id && /^(kp|kinopoisk)$/i.test(String(movie.source || ''))) {
                ids.push('kp/' + encodeURIComponent(movie.id));
            }
            if (!ids.length) return Promise.reject(new Error('Для Collaps нужен ID Кинопоиска или IMDb'));
            var hosts = ['https://api.nextembed.ws/embed/', 'https://api.kinogram.best/embed/'];
            function attempt(index, hostIndex) {
                if (index >= ids.length) return Promise.resolve([]);
                if (hostIndex >= hosts.length) return attempt(index + 1, 0);
                return requestText(hosts[hostIndex] + ids[index]).then(function (html) {
                    var config = parseCollapsPlayer(html);
                    var seasons = config.playlist && config.playlist.seasons || [];
                    var normalized = {
                        id: ids[index],
                        source: 'collaps',
                        title: config.title || (movie && (movie.title || movie.name)) || 'Collaps',
                        year: movie && movie.year || '',
                        raw: config
                    };
                    if (seasons.length || config.source) return [normalized];
                    return attempt(index, hostIndex + 1);
                }).catch(function () { return attempt(index, hostIndex + 1); });
            }
            return attempt(0, 0);
        },
        resolve: function (item) {
            if (!item || !item.raw) return Promise.reject(new Error('Нет данных Collaps'));
            var config = item.raw;
            var seasons = config.playlist && config.playlist.seasons || [];
            var entries = [];
            seasons.forEach(function (season) {
                (season.episodes || []).forEach(function (episode) {
                    var url = episode.hls || episode.dasha || episode.dash || '';
                    if (url) entries.push({
                        season: season.season,
                        ordinal: Number(episode.episode) || entries.length + 1,
                        title: episode.title || ('Серия ' + episode.episode),
                        hls: url,
                        audio: episode.audio || {},
                        subtitles: episode.cc || []
                    });
                });
            });
            if (!entries.length && config.source) {
                var url = config.source.hls || config.source.dasha || config.source.dash;
                if (url) entries.push({ ordinal: 1, title: config.title || item.title, hls: url, audio: config.source.audio || {}, subtitles: config.source.cc || [] });
            }
            if (!entries.length) return Promise.reject(new Error('В ответе Collaps нет доступных HLS-серий'));
            return Promise.resolve({ title: config.title || item.title, episodes: entries });
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
            if ((source.id === 'anilibria' || source.id === 'collaps') && (store.get(key) === undefined || store.get(key) === null)) {
                store.set(key, true);
            } else if (store.get(key) === undefined || store.get(key) === null) {
                store.set(key, false);
            }
        });
        if (store.get(PREFIX + 'proxy_url') === undefined || store.get(PREFIX + 'proxy_url') === null) {
            store.set(PREFIX + 'proxy_url', '');
        }
    }

    function notify(message) {
        if (root.Lampa && root.Lampa.Noty && typeof root.Lampa.Noty.show === 'function') {
            root.Lampa.Noty.show(message);
        } else if (root.console && root.console.info) {
            root.console.info('[Lampa Cinema] ' + message);
        }
    }

    function showResults(source, results, movie, query) {
        if (!results.length) {
            notify(source.name + ': ничего не найдено');
            return;
        }
        openResultsPage(source, results, movie, query);
    }

    function openResultsPage(source, results, movie, query) {
        if (!root.Lampa || !root.Lampa.Component || !root.Lampa.Activity ||
            !root.Lampa.Explorer || !root.Lampa.Scroll) {
            root.Lampa.Select.show({
                title: source.name + ' — результаты',
                items: results.map(function (item) {
                    return { title: item.title, item: item };
                }),
                onSelect: function (selected) { openEpisodes(selected.item); }
            });
            return;
        }

        var pageId = 'lampa_cinema_results';
        function page(object) {
            var activity = this;
            var files = new root.Lampa.Explorer(object);
            var scroll = new root.Lampa.Scroll({ mask: true, over: true });
            var destroyed = false;
            var last = null;

            function headButton(title, action) {
                var el = root.jQuery('<div class="selector filter__item"><span></span></div>');
                el.find('span').text(title);
                el.on('hover:enter click', action);
                return el;
            }

            function renderHead() {
                var head = root.jQuery('<div class="online_mod__head"></div>');
                head.append(headButton('Балансер: ' + source.name, chooseSource));
                head.append(headButton('Уточнить поиск: ' + query, refineSearch));
                files.appendHead(head);
            }

            function chooseSource() {
                root.Lampa.Select.show({
                    title: 'Выбор балансера',
                    items: SOURCES.map(function (item) {
                        return {
                            title: item.name + (item.id === source.id ? ' ✓' : '') +
                                (item.status === 'planned' ? ' · в разработке' : ''),
                            source: item
                        };
                    }),
                    onSelect: function (selected) {
                        if (selected.source.id === source.id) return;
                        searchSource(selected.source, movie, query);
                    }
                });
            }

            function refineSearch() {
                if (!root.Lampa.Input || typeof root.Lampa.Input.edit !== 'function') return;
                root.Lampa.Input.edit({
                    title: 'Уточнить поиск',
                    value: query,
                    free: true,
                    nosave: true
                }, function (value) {
                    value = typeof value === 'string' ? value.trim() : '';
                    if (value) searchSource(source, movie, value);
                });
            }

            function showEpisodes(item) {
                notify('Загружаю список серий…');
                adapters[item.source || 'anilibria'].resolve(item).then(function (detail) {
                    if (destroyed) return;
                    var episodes = episodeEntries(detail);
                    if (!episodes.length) {
                        notify('У этого релиза нет доступных серий');
                        return;
                    }
                    showEpisodeMenu(detail, episodes);
                }).catch(function (error) {
                    if (!destroyed) notify('Не удалось загрузить серии: ' + error.message);
                });
            }

            this.create = function () {
                renderHead();
                files.appendFiles(scroll.render());
                results.forEach(function (item) {
                    var year = item.year ? ' · ' + item.year : '';
                    var row = root.jQuery(
                        '<div class="torrent-item selector">' +
                        '<div class="torrent-item__body">' +
                        '<div class="torrent-item__title"></div>' +
                        '<div class="torrent-item__details"></div>' +
                        '</div></div>'
                    );
                    row.find('.torrent-item__title').text(item.title);
                    row.find('.torrent-item__details').text(source.name + year);
                    row.on('hover:enter click', function () {
                        showEpisodes(item);
                    });
                    scroll.append(row);
                });
                this.start();
                return this.render();
            };

            this.start = function () {
                if (root.Lampa.Controller) {
                    root.Lampa.Controller.add('content', {
                        toggle: function () {
                            root.Lampa.Controller.collectionSet(scroll.render(), files.render());
                            root.Lampa.Controller.collectionFocus(last || false, scroll.render());
                        },
                        up: function () { root.Lampa.Controller.toggle('head'); },
                        down: function () { root.Lampa.Navigator.move('down'); },
                        right: function () { root.Lampa.Navigator.move('right'); },
                        left: function () { root.Lampa.Controller.toggle('menu'); },
                        back: function () { root.Lampa.Activity.backward(); }
                    });
                    root.Lampa.Controller.toggle('content');
                }
            };

            this.render = function () { return files.render(); };
            this.pause = function () {};
            this.stop = function () {};
            this.destroy = function () {
                destroyed = true;
                if (scroll && scroll.destroy) scroll.destroy();
                if (files && files.destroy) files.destroy();
            };
        }

        root.Lampa.Component.add(pageId, page);
        root.Lampa.Activity.push({
            url: '',
            title: source.name + ' — результаты',
            component: pageId,
            movie: movie,
            search: query,
            page: 1
        });
    }

    function episodeEntries(detail) {
        var episodes = detail && Array.isArray(detail.episodes) ? detail.episodes : [];
        // Некоторые ответы API оборачивают релиз в data/release.
        if (!episodes.length && detail && detail.data) {
            var nested = detail.data.release || detail.data;
            if (nested && Array.isArray(nested.episodes)) episodes = nested.episodes;
        }
        return episodes.slice().sort(function (a, b) {
            var left = Number(a.sort_order !== undefined ? a.sort_order : a.ordinal) || 0;
            var right = Number(b.sort_order !== undefined ? b.sort_order : b.ordinal) || 0;
            return left - right;
        });
    }

    function episodeNumber(episode, index) {
        return episode.ordinal !== undefined && episode.ordinal !== null ? episode.ordinal :
            (episode.sort_order !== undefined && episode.sort_order !== null ? episode.sort_order : index + 1);
    }

    function availableQuality(episode, preferred) {
        var order = preferred || 'hls_720';
        var ids = [order, 'hls_1080', 'hls_720', 'hls_480'];
        for (var i = 0; i < ids.length; i++) {
            if (episode && episode[ids[i]]) return episode[ids[i]];
        }
        return '';
    }

    function playEpisode(detail, episode, playlist) {
        var qualities = [
            { id: 'hls_1080', title: '1080p' },
            { id: 'hls_720', title: '720p' },
            { id: 'hls_480', title: '480p' }
        ].filter(function (quality) {
            return playlist.some(function (item) { return !!(item[quality.id] || item.hls); });
        });

        if (!qualities.length) {
            notify('Для выбранного сезона нет доступных HLS-потоков');
            return;
        }

        function start(quality) {
            var queue = playlist.map(function (item, index) {
                var url = item[quality.id] || item.hls || availableQuality(item, quality.id);
                if (!url) return null;
                var number = episodeNumber(item, index);
                return {
                    url: url,
                    title: (detail.title || releaseTitle(detail)) + ' — серия ' + number,
                    episode: number,
                    season: item.season || 1,
                    source: 'AniLibria'
                };
            }).filter(Boolean);

            var currentIndex = queue.findIndex(function (item) {
                return String(item.episode) === String(episodeNumber(episode, playlist.indexOf(episode)));
            });
            if (currentIndex < 0) currentIndex = 0;
            if (!queue.length) {
                notify('Не удалось сформировать список воспроизведения');
                return;
            }
            if (!root.Lampa || !root.Lampa.Player || typeof root.Lampa.Player.play !== 'function') {
                notify('В этой версии Lampa не найден Lampa.Player.play');
                return;
            }

            // Штатный контракт Lampa: сначала запускаем выбранную серию,
            // затем передаём полный упорядоченный плейлист для автоперехода.
            root.Lampa.Player.play(queue[currentIndex]);
            if (queue.length > 1 && typeof root.Lampa.Player.playlist === 'function') {
                root.Lampa.Player.playlist(queue);
            } else if (queue.length > 1) {
                notify('Автопереход недоступен в этой версии Lampa');
            }
        }

        if (qualities.length === 1) {
            start(qualities[0]);
            return;
        }
        root.Lampa.Select.show({
            title: 'Качество — серия ' + episodeNumber(episode, playlist.indexOf(episode)),
            items: qualities.map(function (quality) {
                return { title: quality.title, quality: quality };
            }),
            onSelect: function (selected) { start(selected.quality); }
        });
    }

    function openEpisodes(item) {
        notify('Загружаю сезоны и серии AniLibria…');
        adapters[item.source || 'anilibria'].resolve(item).then(function (detail) {
            var episodes = episodeEntries(detail);
            if (!episodes.length) {
                notify('API AniLibria не вернул серии для этого релиза. Попробуйте другой сезон/релиз.');
                return;
            }
            // В AniLibria отдельные сезоны часто представлены отдельными релизами.
            // Внутри выбранного релиза серии идут по sort_order/ordinal.
            root.Lampa.Select.show({
                title: releaseTitle(detail) + ' — выбор серии',
                items: episodes.map(function (episode, index) {
                    var number = episodeNumber(episode, index);
                    return {
                        title: 'Серия ' + number + (episode.name ? ' — ' + episode.name : ''),
                        episode: episode
                    };
                }),
                onSelect: function (selected) {
                    playEpisode(detail, selected.episode, episodes);
                }
            });
        }).catch(function (error) {
            notify('Не удалось загрузить серии AniLibria: ' + error.message);
        });
    }

    function showEpisodeMenu(detail, episodes) {
        root.Lampa.Select.show({
            title: releaseTitle(detail) + ' — серии',
            items: episodes.map(function (episode, index) {
                return { title: 'Серия ' + episodeNumber(episode, index) + (episode.name ? ' — ' + episode.name : ''), episode: episode };
            }),
            onSelect: function (selected) { playEpisode(detail, selected.episode, episodes); }
        });
    }

    function movieSearchQueries(movie) {
        movie = movie || {};
        var values = [];

        function add(value) {
            if (typeof value === 'string') {
                value = value.trim();
                if (value && values.indexOf(value) === -1) values.push(value);
            }
        }

        // Lampa/TMDB может передать японское original_title, поэтому ищем
        // также по локализованному названию и доступным альтернативным полям.
        [
            movie.title, movie.name,
            movie.original_title, movie.original_name,
            movie.ru_title, movie.en_title,
            movie.alternative_title, movie.alt_title
        ].forEach(add);

        var alternatives = movie.alternative_titles || movie.alternative_names;
        if (Array.isArray(alternatives)) {
            alternatives.forEach(function (item) {
                add(typeof item === 'string' ? item : (item && (item.title || item.name)));
            });
        } else if (alternatives && typeof alternatives === 'object') {
            Object.keys(alternatives).forEach(function (key) {
                add(alternatives[key]);
            });
        }

        return values.slice(0, 6);
    }

    function searchSource(source, movie, customQuery) {
        var store = getStorage();
        var enabledValue = store && store.get(PREFIX + 'enabled_' + source.id);
        // Lampa Storage в разных сборках может возвращать boolean, число или строку.
        // Выключенным считаем только явные false/0; строка 'true' не должна блокировать источник.
        var enabled = enabledValue !== false && enabledValue !== 0 && enabledValue !== 'false' && enabledValue !== '0';
        if (!enabled) {
            notify(source.name + ' выключен в настройках Lampa Cinema');
            return;
        }
        var adapter = adapters[source.id];
        if (!adapter || typeof adapter.search !== 'function') {
            notify(source.name + ': адаптер ещё не реализован');
            return;
        }
        var queries = customQuery ? [customQuery] : movieSearchQueries(movie);
        if (!queries.length) {
            notify('Не удалось определить название фильма');
            return;
        }
        notify('Поиск в ' + source.name + ' по ' + queries.length + ' названиям…');
        adapter.search(queries, movie).then(function (results) {
            showResults(source, results, movie, queries[0]);
        }).catch(function (error) {
            notify(source.name + ': ' + error.message);
        });
    }

    function editProxySetting() {
        var store = getStorage();
        if (!store || !root.Lampa || !root.Lampa.Input || typeof root.Lampa.Input.edit !== 'function') {
            notify('Настройки ввода недоступны в этой версии Lampa');
            return;
        }
        var current = store.get(PREFIX + 'proxy_url') || '';
        root.Lampa.Input.edit({
            title: 'Адрес CORS-прокси',
            value: current,
            free: true,
            nosave: true,
            placeholder: 'https://your-worker.example/'
        }, function (value) {
            value = typeof value === 'string' ? value.trim() : '';
            if (value && !/^https?:\/\//i.test(value)) {
                notify('Адрес прокси должен начинаться с http:// или https://');
                return;
            }
            store.set(PREFIX + 'proxy_url', value.replace(/\/+$/, ''));
            notify(value ? 'Прокси сохранён' : 'Прокси отключён. Запросы будут идти напрямую');
        });
    }

    function openSourceMenu(movie) {
        if (!root.Lampa || !root.Lampa.Select || typeof root.Lampa.Select.show !== 'function') {
            notify('Lampa Cinema загружен, но Select API недоступен');
            return;
        }
        // Сначала показываем источники с реализованным поиском/воспроизведением.
        // Порядок внутри каждой группы сохраняется.
        var orderedSources = SOURCES.slice().sort(function (a, b) {
            var aReady = a.status !== 'planned' ? 1 : 0;
            var bReady = b.status !== 'planned' ? 1 : 0;
            return bReady - aReady;
        });

        root.Lampa.Select.show({
            title: 'Lampa Cinema — источники',
            items: [{ title: '⚙ Настройки прокси', action: 'proxy_settings' }].concat(orderedSources.map(function (source) {
                var status = source.status === 'search-ready' ? 'доступен' : 'в разработке';
                return { title: source.name + ' · ' + status, source: source };
            })),
            onSelect: function (selected) {
                if (selected.action === 'proxy_settings') {
                    editProxySetting();
                    return;
                }
                searchSource(selected.source, movie);
            }
        });
    }

    function registerLampa() {
        if (!root.Lampa || !root.Lampa.Manifest) return;

        root.Lampa.Manifest.plugins = {
            type: 'video',
            version: VERSION,
            name: 'Lampa Cinema',
            description: 'Поиск и просмотр через AniLibria и Collaps',
            component: 'lampa_cinema',
            onContextMenu: function () {
                return { name: 'Lampa Cinema', description: 'Поиск и просмотр через балансеры' };
            },
            onContextLauch: function (card) {
                openSourceMenu(card || {});
            }
        };

        // Кнопка непосредственно на странице фильма/сериала.
        if (root.Lampa.Listener && typeof root.Lampa.Listener.follow === 'function' && !root.lampaCinemaFullButtonBound) {
            root.lampaCinemaFullButtonBound = true;
            root.Lampa.Listener.follow('full', function (event) {
                if (event.type !== 'complite' || !event.object || !event.object.activity) return;
                var activity = event.object.activity;
                if (!activity.render || typeof root.jQuery !== 'function') return;

                var $root = root.jQuery(activity.render());
                if (!$root.length || $root.find('.view--lampa-cinema').length) return;

                var button = root.jQuery(
                    '<div class="full-start__button selector view--lampa-cinema">' +
                    '<svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">' +
                    '<path fill="currentColor" d="M8 5v14l11-7z"/></svg>' +
                    '<span>Lampa Cinema</span></div>'
                );

                button.on('hover:enter click', function () {
                    openSourceMenu(event.data && event.data.movie ? event.data.movie : {});
                });

                var anchor = $root.find('.view--torrent').last();
                if (anchor.length) anchor.after(button);
                else $root.find('.full-start__buttons').append(button);
            });
        }
    }

    function boot() {
        initSettings();
        registerLampa();
        if (root.console && root.console.info) {
            root.console.info('[Lampa Cinema] v' + VERSION + ' loaded; AniLibria and Collaps adapters enabled; other providers planned.');
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
