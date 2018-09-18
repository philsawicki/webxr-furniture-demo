import Application from './application';


/**
 * Install the WebXR Polyfill and Shim to support discrepancies between browser
 * and device vendors.
 */
if (window.WebXRPolyfill) {
    const polyfill = new WebXRPolyfill();

    if (window.WebXRVersionShim) {
        const versionShim = new WebXRVersionShim();
    }
}


/**
 * Launch the Application.
 */
const app = new Application();

/**
 * Install Service Worker.
 */
if ('serviceWorker' in navigator) {
    window.addEventListener('load', async () => {
        try {
            const navigatorInstance = navigator as Navigator;
            const registration = await navigatorInstance.serviceWorker.register('service-worker.js');
            console.log('ServiceWorker registration successful with scope:', registration.scope);
        } catch (ex) {
            console.log('ServiceWorker registration failed:', ex);
        }
    });
}
