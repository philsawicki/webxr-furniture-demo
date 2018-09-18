(function () {
    'use strict';

    self.addEventListener('fetch', (event) => {
        event.respondWith(caches.match(event.request).then(response => {
            if (response) {
                return response;
            }
            return fetch(event.request);
        }));
    });

}());
//# sourceMappingURL=service-worker.js.map
