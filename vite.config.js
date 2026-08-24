import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import pkg from './package.json' with { type: 'json' };

// ===================================================================================
// 빌드 설정
// -----------------------------------------------------------------------------------
// [PWA]
//   manifest 파일만 있고 서비스 워커가 없어서 '설치'가 실제로는 동작하지 않았다.
//   설치 유도도, 오프라인도, 두 번째 로딩 가속도 전부 없는 상태였다.
//
//   registerType: 'autoUpdate' — 새 버전이 올라가면 알아서 갈아탄다.
//   사용자에게 "새 버전이 있어요, 새로고침하시겠어요?"를 묻지 않는다.
//   운동하다가 그런 창을 만나면 그냥 방해다.
//
// [캐시하지 않는 것]
//   Firestore·인증·카카오 API 는 캐시하면 안 된다. 오래된 경기 상태를 보여주거나
//   로그인이 이상해진다. Firestore 는 자체 오프라인 캐시가 이미 있다(firebase.js).
//
// [청크 나누기]
//   firebase 와 지도 관련 코드가 커서, 한 덩어리로 묶이면 첫 화면이 느려진다.
// ===================================================================================

export default defineConfig({
    define: {
        __APP_VERSION__: JSON.stringify(`v${pkg.version}`),
    },
    plugins: [
        react(),
        VitePWA({
            registerType: 'autoUpdate',
            includeAssets: [
                'apple-touch-icon.png',
                'favicon-32.png',
                'favicon-64.png',
                'icon.svg',
            ],
            manifest: {
                id: '/',
                name: 'COCKSTAR · 콕스타',
                short_name: 'COCKSTAR',
                description: '배드민턴 실시간 매칭 · 코트를 지배하라',
                start_url: '/',
                scope: '/',
                display: 'standalone',
                orientation: 'portrait',
                theme_color: '#08090C',
                background_color: '#08090C',
                lang: 'ko',
                categories: ['sports', 'social'],
                icons: [
                    { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
                    { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
                    { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
                    { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
                ],
                shortcuts: [
                    { name: '경기방 찾기', short_name: '경기', url: '/game' },
                    { name: '내 주변 체육관', short_name: '콕맵', url: '/map' },
                ],
            },
            workbox: {
                // SPA 라 어떤 주소로 들어와도 index.html 을 돌려줘야 한다
                navigateFallback: '/index.html',
                navigateFallbackDenylist: [/^\/__/, /\/[^/?]+\.[^/]+$/],
                globPatterns: ['**/*.{js,css,html,png,svg,woff2}'],
                cleanupOutdatedCaches: true,
                clientsClaim: true,
                skipWaiting: true,
                runtimeCaching: [
                    {
                        // 상품 사진 — 바뀌는 일이 드물고 용량이 크다
                        urlPattern: /^https:\/\/.*\.(?:png|jpg|jpeg|webp|gif)$/i,
                        handler: 'CacheFirst',
                        options: {
                            cacheName: 'images',
                            expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 14 },
                        },
                    },
                    {
                        // 웹폰트 — 한 번 받으면 오래 쓴다
                        urlPattern: /^https:\/\/(fonts\.googleapis\.com|fonts\.gstatic\.com|cdn\.jsdelivr\.net)\//,
                        handler: 'StaleWhileRevalidate',
                        options: {
                            cacheName: 'fonts',
                            expiration: { maxEntries: 40, maxAgeSeconds: 60 * 60 * 24 * 90 },
                        },
                    },
                    {
                        // 실시간 데이터는 절대 캐시하지 않는다 (오래된 경기 상태를 보여주면 안 된다)
                        urlPattern: /^https:\/\/(firestore|identitytoolkit|securetoken)\.googleapis\.com\//,
                        handler: 'NetworkOnly',
                    },
                    {
                        urlPattern: /^https:\/\/(dapi\.kakao\.com|t1\.daumcdn\.net|t1\.kakaocdn\.net)\//,
                        handler: 'NetworkOnly',
                    },
                ],
            },
            devOptions: {
                // 개발 중에는 꺼둔다 — 서비스 워커가 캐시를 붙들고 있으면
                // 코드를 고쳐도 화면이 안 바뀌어 한참을 헤매게 된다
                enabled: false,
            },
        }),
    ],
    build: {
        rollupOptions: {
            output: {
                manualChunks: {
                    'firebase-app': ['firebase/app', 'firebase/auth', 'firebase/firestore'],
                    'react-vendor': ['react', 'react-dom', 'react-router-dom'],
                },
            },
        },
    },
    test: {
        environment: 'jsdom',
        globals: true,
        setupFiles: ['./src/test/setup.js'],
        css: false,
    },
});
