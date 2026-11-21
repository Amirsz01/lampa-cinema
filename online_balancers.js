(function () {
    'use strict';

    var PREFIX = 'lob_';
    var SOURCES = [
        { id: 'lumex', name: 'Lumex' },
        { id: 'lumex_ads', name: 'Lumex (Ads)' },
        { id: 'hdrezka', name: 'HDrezka' },
        { id: 'kinobase', name: 'Kinobase' },
        { id: 'collaps', name: 'Collaps' },
        { id: 'collaps_dash', name: 'Collaps (DASH)' },
        { id: 'cdnmovies', name: 'CDNMovies' },
        { id: 'filmix', name: 'Filmix' },
        { id: 'zetflix', name: 'Zetflix' },
        { id: 'fancdn', name: 'FanCDN' },
        { id: 'fancdn_id', name: 'FanCDN (ID)' },
        { id: 'fanserials', name: 'FanSerials' },
        { id: 'videoseed', name: 'VideoSeed' },
        { id: 'vibix', name: 'Vibix' },
        { id: 'redheadsound', name: 'RedHeadSound' },
        { id: 'redheadsound_dash', name: 'RedHeadSound (DASH)' },
        { id: 'cdnvideohub', name: 'CDNVideoHub' },
        { id: 'anilibria', name: 'AniLibria' },
        { id: 'anilibria_top', name: 'AniLibria.top' },
        { id: 'animelib', name: 'AnimeLib' },
        { id: 'kodik', name: 'Kodik' },
        { id: 'alloha', name: 'Alloha' },
        { id: 'kinopub', name: 'KinoPub' }
    ];

    function storage() {
        return typeof Lampa !== 'undefined' && Lampa.Storage ? Lampa.Storage : null;
    }

    function initializeSettings() {
        var store = storage();
        if (!store || typeof store.get !== 'function' || typeof store.set !== 'function') return;

        SOURCES.forEach(function (source) {
            var key = PREFIX + 'enabled_' + source.id;
            if (store.get(key) === undefined || store.get(key) === null) {
                store.set(key, false);
            }
        });
    }

    function boot() {
        initializeSettings();
        if (typeof console !== 'undefined' && console.info) {
            console.info('[Lampa Cinema] Starter loaded. Provider adapters are not implemented yet.');
        }
    }

    var api = {
        version: '0.1.0',
        sources: SOURCES.slice(),
        prefix: PREFIX,
        boot: boot
    };

    if (typeof window !== 'undefined') window.LampaOnlineBalancers = api;
    boot();
}());
