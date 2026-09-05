// ==========================================================================
// Service Worker Registration
// ==========================================================================

export function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('./service-worker.js')
                .then(reg => {
                    console.log('Service Worker registered successfully.', reg);
                    
                    // 新しいサービスワーカー（アップデート）のインストール完了を検知してリロード
                    reg.onupdatefound = () => {
                        const installingWorker = reg.installing;
                        if (installingWorker) {
                            installingWorker.onstatechange = () => {
                                if (installingWorker.state === 'installed') {
                                    if (navigator.serviceWorker.controller) {
                                        console.log('New version detected. Reloading...');
                                        window.location.reload();
                                    }
                                }
                            };
                        }
                    };
                })
                .catch(err => console.log('Service Worker registration failed.', err));
        });
    }
}
