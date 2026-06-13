// ==UserScript==
// @name         AdBlock Banner Remover
// @namespace    adblock-banner-remover
// @version      1.22
// @match        https://screenrant.com/*
// @match        https://www.destructoid.com/*
// @match        *://*.bloomberg.com/news/*
// @match        https://www.redgifs.com/*
// @match        https://gameinformer.com/*
// @match        https://www.theverge.com/*
// @match        https://www.axios.com/*
// @match        https://www.thegamer.com/*
// @match        https://www.polygon.com/*
// @match        https://wegotthiscovered.com/*
// @match        https://www.wegotthiscovered.com/*
// Valnet 계열 (AdsNinja "Mural" 안티-애드블록 공용)
// @match        https://gamerant.com/*
// @match        https://www.cbr.com/*
// @match        https://collider.com/*
// @match        https://movieweb.com/*
// @match        https://www.dualshockers.com/*
// @match        https://www.hardcoregamer.com/*
// @match        https://www.androidpolice.com/*
// @match        https://www.makeuseof.com/*
// @match        https://www.howtogeek.com/*
// @match        https://www.xda-developers.com/*
// @match        https://www.pocket-lint.com/*
// @match        https://www.pocketnow.com/*
// @match        https://www.thethings.com/*
// @match        https://www.thetravel.com/*
// @match        https://www.therichest.com/*
// @match        https://news.denfaminicogamer.jp/*
// @match        *://namu.wiki/*
// @match        *://*.namu.wiki/*
// @run-at       document-start
// ==/UserScript==

(function () {
    // ── Bloomberg: intercept Sparkle config BEFORE any page script runs ────────
    if (location.hostname.includes('bloomberg.com')) {
        let _cfg = undefined;
        Object.defineProperty(window, '__sparkleConfig', {
            get() { return _cfg; },
            set(v) {
                if (v && typeof v === 'object') {
                    v.adBlockerShouldBeBlocked = false;
                    v.isAdBlockerBlocked = false;
                    v.adblock = false;
                }
                _cfg = v;
            },
            configurable: true,
            enumerable: true,
        });
    }

    // ── DOM-dependent code: runs after <body> exists ───────────────────────────
    function init() {
        const RULES = [
            'dialog.adblock',
            'dialog[data-promotion-zone]',
            '.dgEhJe6g',
            '.fEy1Z2XT',
            '[data-feed-module-type="boost"]',
            '[data-feed-module-type="live-cam"]',
            '.liveAdButton',
        ];

        function removeBySelectors() {
            RULES.forEach(sel => {
                document.querySelectorAll(sel).forEach(el => el.remove());
            });
        }

        // Admiral 안티-애드블록: iframe(my.getadmiral.com) + "Powered By" 링크 감지.
        // href 가 %67e%74... 처럼 URL 인코딩으로 난독화돼 있어도 브라우저가 디코딩한
        // el.href/el.src(resolved) 로 잡는다. 배너 통째로 제거 + 스크롤 잠금 해제.
        function removeAdmiral() {
            const hits = [];
            document.querySelectorAll('a[href], iframe[src]').forEach(el => {
                const resolved = el.href || el.src || '';
                const raw = el.getAttribute('href') || el.getAttribute('src') || '';
                if (/getadmiral|admiral\.com/i.test(resolved) || /getadmiral|%67%65%74%61|%67e%74%61/i.test(raw)) {
                    hits.push(el);
                }
            });
            hits.forEach(el => {
                let node = el;
                while (node.parentElement && node.parentElement !== document.body) {
                    node = node.parentElement;
                }
                if (node.parentElement === document.body) node.remove();
            });
        }

        function unlockScroll() {
            const s = document.body.style;
            s.overflow = '';
            s.paddingRight = '';
            document.documentElement.style.overflow = '';
        }

        let bbgRunning = false;

        function handleBloomberg() {
            if (!location.hostname.includes('bloomberg.com')) return;
            if (bbgRunning) return;

            if (!document.getElementById('bbg-patch')) {
                const style = document.createElement('style');
                style.id = 'bbg-patch';
                style.textContent = [
                    '[class*="shimmeringParagraph"],[class*="Placeholder_shimmering"],[class*="placeholderParagraphWrapper"]{display:none!important}',
                    '.reg-ui-client,[data-component="reg-ui-client"]{display:none!important}',
                    '#fence-overlay,[id*="fence"],[class*="fence-"]{display:none!important}',
                    '[class*="sparkle-gate"],[class*="SparkleGate"],[id*="sparkle-gate"]{display:none!important}',
                ].join('');
                (document.head || document.documentElement).appendChild(style);
            }

            document.body.removeAttribute('data-reg-ui-client-status');
            document.body.style.overflow = '';

            const nextDataEl = document.getElementById('__NEXT_DATA__');
            if (!nextDataEl) return;
            let paragraphs = [];
            try {
                const data = JSON.parse(nextDataEl.textContent);
                const content = data?.props?.pageProps?.story?.body?.content ?? [];
                paragraphs = extractParagraphs(content);
            } catch (e) { return; }
            if (!paragraphs.length) return;

            const bodyContainer =
                document.querySelector('[data-testid="body-block"]') ||
                document.querySelector('.body-content') ||
                document.querySelector('[class*="body-content"]');
            if (!bodyContainer) return;

            const realPs = bodyContainer.querySelectorAll('p:not([data-bbg])');
            const offset = realPs.length;
            if (offset === 0) return;

            // How many paragraphs do we still need to inject?
            const need = paragraphs.length - offset;
            const have = bodyContainer.querySelectorAll('p[data-bbg]').length;
            if (have >= need && need >= 0) return; // already injected or nothing to inject

            bbgRunning = true;
            bodyContainer.querySelectorAll('p[data-bbg]').forEach(el => el.remove());
            for (let i = offset; i < paragraphs.length; i++) {
                const p = document.createElement('p');
                p.textContent = paragraphs[i];
                p.setAttribute('data-bbg', '1');
                bodyContainer.appendChild(p);
            }
            bbgRunning = false;
        }

        function extractParagraphs(nodes) {
            const result = [];
            for (const node of nodes) {
                if (node.type === 'paragraph') {
                    const text = collectText(node.content ?? []);
                    if (text) result.push(text);
                } else if (Array.isArray(node.content)) {
                    result.push(...extractParagraphs(node.content));
                }
            }
            return result;
        }

        function collectText(nodes) {
            return nodes.map(n => n.value ?? collectText(n.content ?? [])).join('');
        }

        function handleRedgifs() {
            if (!location.hostname.includes('redgifs.com')) return;

            function toSlug(text) {
                return text.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
            }

            function getHref(tile) {
                const h4 = tile.querySelector('.tileTitle h4');
                if (h4) {
                    const title = (h4.getAttribute('title') || h4.textContent).trim();
                    if (title) return '/niches/' + toSlug(title);
                }
                const id = tile.dataset.feedItemId;
                if (id) return '/watch/' + id;
                return null;
            }

            function wrap(tile) {
                if (tile.dataset.rgWrapped) return;
                tile.dataset.rgWrapped = '1';
                const href = getHref(tile);
                if (!href) return;
                const a = document.createElement('a');
                a.href = href;
                a.style.cssText = 'position:absolute;inset:0;z-index:2;';
                a.addEventListener('click', (e) => {
                    if (e.ctrlKey || e.metaKey || e.shiftKey) return;
                    e.preventDefault();
                    const clickArea = tile.querySelector('.clickArea');
                    if (clickArea) {
                        a.style.pointerEvents = 'none';
                        clickArea.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
                        requestAnimationFrame(() => { a.style.pointerEvents = ''; });
                    }
                });
                a.addEventListener('auxclick', (e) => {
                    if (e.button === 1) {
                        e.preventDefault();
                        window.open(href, '_blank', 'noopener noreferrer');
                    }
                });
                tile.style.position = 'relative';
                tile.appendChild(a);
            }

            document.querySelectorAll('.tileItem:not([data-rg-wrapped])').forEach(wrap);

            document.querySelectorAll('.GifNichesPopup-Item:not([data-rg-wrapped])').forEach(item => {
                item.dataset.rgWrapped = '1';
                const nicheLink = item.querySelector('.nicheCard');
                const btn = item.querySelector('button');
                if (!nicheLink || !btn) return;
                const href = nicheLink.getAttribute('href');
                if (!href) return;
                const a = document.createElement('a');
                a.href = href;
                a.style.cssText = 'position:absolute;inset:0;z-index:1;';
                a.addEventListener('click', (e) => {
                    if (e.ctrlKey || e.metaKey || e.shiftKey) return;
                    e.preventDefault();
                    a.style.pointerEvents = 'none';
                    btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
                    requestAnimationFrame(() => { a.style.pointerEvents = ''; });
                });
                btn.style.position = 'relative';
                btn.appendChild(a);
            });
        }

        function handleGameInformer() {
            if (!location.hostname.includes('gameinformer.com')) return;

            if (!document.getElementById('gi-patch')) {
                const style = document.createElement('style');
                style.id = 'gi-patch';
                style.textContent = [
                    // 구독 유도 박스
                    '.premium-content-block{display:none!important}',
                    // 어드블록 감지 stripe (ads_blocker_stripe.css 기반)
                    '[class*="adblock-stripe"],[class*="ads-blocker"],[class*="adblocker"]{display:none!important}',
                ].join('');
                (document.head || document.documentElement).appendChild(style);
            }
        }

        function handleTheVerge() {
            if (!location.hostname.includes('theverge.com')) return;

            if (!document.getElementById('verge-patch')) {
                const style = document.createElement('style');
                style.id = 'verge-patch';
                style.textContent = [
                    // zephr-anchor 는 본문 컨테이너이므로 제외하고 오버레이만 숨김
                    '[class*="zephr"],[id*="zephr"]:not(#zephr-anchor){display:none!important}',
                    '#zephr-anchor{display:block!important}',
                    '[class*="paywall"],[class*="Paywall"]{display:none!important}',
                    '[class*="duet--paywall"]{display:none!important}',
                    '[class*="blur"],[class*="Blur"],[style*="filter:blur"]{filter:none!important}',
                    '[class*="gated"],[class*="Gated"]{filter:none!important;-webkit-mask-image:none!important;mask-image:none!important;max-height:none!important;overflow:visible!important}',
                    'body,html{overflow:auto!important;height:auto!important}',
                ].join('');
                (document.head || document.documentElement).appendChild(style);
            }

            // zephr-anchor 본문 강제 복원 (인라인/JS 로 숨겨진 경우 대비)
            const anchor = document.getElementById('zephr-anchor');
            if (anchor) {
                anchor.style.display = '';
                anchor.style.visibility = 'visible';
                anchor.style.maxHeight = 'none';
                anchor.style.overflow = 'visible';
            }

            document.body.style.overflow = '';
            document.documentElement.style.overflow = '';
        }

        function handleAxios() {
            if (!location.hostname.includes('axios.com')) return;

            if (!document.getElementById('axios-patch')) {
                const style = document.createElement('style');
                style.id = 'axios-patch';
                style.textContent = [
                    // "Go deeper" 본문은 이미 DOM에 있음 — 강제로 표시
                    '.gated-content{display:block!important}',
                    // Piano(tinypass) 월·스피너·페이드 컨테이너 제거
                    '#piano-wall,#piano-container,#piano-spinner,#paywall-fallback-container,#piano-recaptcha{display:none!important}',
                ].join('');
                (document.head || document.documentElement).appendChild(style);
            }

            document.body.style.overflow = '';
            document.documentElement.style.overflow = '';
        }

        // Valnet/AdsNinja "Mural" 안티-애드블록 (Valnet 계열 공용)
        // 호스트 목록 대신 런타임 시그니처로 감지 — @match 된 새 Valnet 사이트에 자동 대응
        function isValnetPage() {
            return window.VALNET_GLOBAL_ISADBLOCK !== undefined
                || typeof window.vnPromoAsyncFlags !== 'undefined'
                || !!document.querySelector('[class*="mural"],[id*="mural"]');
        }

        function handleDenfaminicogamer() {
            if (!location.hostname.includes('denfaminicogamer.jp')) return;

            if (!document.getElementById('dfng-patch')) {
                const style = document.createElement('style');
                style.id = 'dfng-patch';
                style.textContent = [
                    '[id^="fs-"],[id^="is-"]{display:none!important}',
                    '[id^="pp-"],[id^="hovl-"]{display:none!important}',
                    '#tjo,#tjm,#tj2,#dc{display:none!important}',
                    'aside.diw,aside.azl,aside.drc{display:none!important}',
                    'body.noScroll{overflow:auto!important}',
                ].join('');
                (document.head || document.documentElement).appendChild(style);
            }

            document.body.classList.remove('noScroll');
            document.body.style.overflow = '';
        }

        // namu.wiki 모바일: 본문 사이에 끼어드는 스폰서 광고 배너(쿠팡·더클린 등) 제거.
        // 광고는 .GwkMbxJD 래퍼 + table.fYo+p5E4(data-v-36a82db9) 시그니처로 구분 —
        // 본문 표(JGWZE7f2)는 래퍼가 없으므로 건드리지 않는다. AdSense 슬롯도 함께 숨김.
        function handleNamuwiki() {
            if (!location.hostname.includes('namu.wiki')) return;

            if (!document.getElementById('namu-patch')) {
                const style = document.createElement('style');
                style.id = 'namu-patch';
                style.textContent = [
                    '.GwkMbxJD{display:none!important}',
                    'table.fYo\\+p5E4{display:none!important}',
                    '#WJVqvTLF7,#VIqBBwVNL{display:none!important}',
                    'ins.adsbygoogle{display:none!important}',
                    'iframe[src*="googlesyndication"],iframe[src*="googleads"],iframe[id^="google_ads"],iframe[src*="doubleclick"]{display:none!important}',
                ].join('');
                (document.head || document.documentElement).appendChild(style);
            }

            // 광고만 빠지면 자리를 잡아두던 부모 컨테이너가 공백으로 남는다.
            // 광고가 유일한 내용이던 상위 래퍼까지 따라 올라가며 접는다.
            document.querySelectorAll('.GwkMbxJD,#WJVqvTLF7,#VIqBBwVNL,ins.adsbygoogle').forEach(el => {
                let node = el;
                while (node.parentElement && node.parentElement !== document.body) {
                    const parent = node.parentElement;
                    const meaningful = Array.from(parent.children).some(c =>
                        c !== node &&
                        c.style.display !== 'none' &&
                        (c.textContent.trim() || c.querySelector('img,video,table,iframe,svg'))
                    );
                    if (meaningful) break;
                    node = parent;
                }
                if (node !== el) node.style.setProperty('display', 'none', 'important');
            });
        }

        // Valnet 계열 아티클 리미터 팝업 (.w-login-layout) — polygon, gamerant 등 공용
        function handleValnetArticleLimiter() {
            if (!document.querySelector('.w-login-layout')) return;

            document.querySelectorAll('.w-login-layout').forEach(el => {
                const modal = el.parentElement;
                (modal && modal !== document.body ? modal : el).remove();
            });

            document.body.style.overflow = '';
            document.documentElement.style.overflow = '';
        }

        function handleValnet() {
            if (!isValnetPage()) return;

            if (!document.getElementById('valnet-patch')) {
                const style = document.createElement('style');
                style.id = 'valnet-patch';
                style.textContent = [
                    // AdsNinja "Mural" 안티-애드블록 오버레이 제거
                    '[class*="mural"],[id*="mural"]{display:none!important}',
                    '[class*="adblock"],[id*="adblock"],[class*="ad-block"],[id*="ad-block"],[class*="anti-adblock"]{display:none!important}',
                    // 오버레이가 거는 스크롤 잠금 해제
                    'body{overflow:auto!important;position:static!important}',
                    'html{overflow:auto!important}',
                ].join('');
                (document.head || document.documentElement).appendChild(style);
            }

            document.body.style.overflow = '';
            document.documentElement.style.overflow = '';
            document.body.style.position = '';
        }

        function remove() {
            removeBySelectors();
            removeAdmiral();
            unlockScroll();
            handleBloomberg();
            handleRedgifs();
            handleGameInformer();
            handleTheVerge();
            handleAxios();
            handleDenfaminicogamer();
            handleValnetArticleLimiter();
            handleValnet();
            handleNamuwiki();
        }

        remove();
        new MutationObserver(remove).observe(document.body, { childList: true, subtree: true });
    }

    if (document.body) {
        init();
    } else {
        document.addEventListener('DOMContentLoaded', init);
    }
})();
