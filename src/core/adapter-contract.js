(function (root) {
    'use strict';

    function createAdapter(definition) {
        if (!definition || typeof definition !== 'object') {
            throw new TypeError('Adapter definition must be an object');
        }
        if (!definition.id || typeof definition.id !== 'string') {
            throw new TypeError('Adapter must have a string id');
        }
        if (typeof definition.search !== 'function') {
            throw new TypeError('Adapter must implement search(query)');
        }
        if (typeof definition.resolve !== 'function') {
            throw new TypeError('Adapter must implement resolve(item)');
        }

        return Object.freeze({
            id: definition.id,
            name: definition.name || definition.id,
            search: definition.search,
            resolve: definition.resolve
        });
    }

    root.LOB = root.LOB || {};
    root.LOB.createAdapter = createAdapter;
}(typeof window !== 'undefined' ? window : this));
