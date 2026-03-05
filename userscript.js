// ==UserScript==
// @name         SSBAGPCM Client
// @version      2.1
// @description  navbar and everything fixed + sector listing
// @author       ssbagpcm
// @match        https://starblast.io/
// @run-at       document-start
// @grant        none
// ==/UserScript==

// a bit ai generated
// you get any troubles, dm discord : ssbagpcm
// client full of bugs for now, good luck

(function () {
    'use strict';

    if (window.__SSBAGPCM_LOADED__) return;
    window.__SSBAGPCM_LOADED__ = true;

    const noop = () => undefined;
    const noopFalse = () => false;
    const noopNull = () => null;

    window.alert = noop;
    window.confirm = noopFalse;
    window.prompt = noopNull;

    try {
        Object.defineProperty(window, 'alert', { value: noop, writable: false, configurable: false, enumerable: false });
        Object.defineProperty(window, 'confirm', { value: noopFalse, writable: false, configurable: false, enumerable: false });
        Object.defineProperty(window, 'prompt', { value: noopNull, writable: false, configurable: false, enumerable: false });
    } catch (e) { }

    try {
        Window.prototype.alert = noop;
        Window.prototype.confirm = noopFalse;
        Window.prototype.prompt = noopNull;
    } catch (e) { }

    // ===== CUSTOM DEFAULT NAMES =====
    const CUSTOM_NAMES = ["SSBAGPCM's client"];
    Object.defineProperty(window, 'lO10l', {
        get: function () { return CUSTOM_NAMES; },
        set: function (val) { },
        configurable: true,
        enumerable: true
    });

    // ===== EARLY CSS =====
    const earlyCSS = document.createElement('style');
    earlyCSS.id = 'ssbagpcm-early';
    earlyCSS.textContent = `
        #logo > img, #logo > canvas, #logo > svg { display: none !important; }
        #logo:not([data-patched]) { visibility: hidden !important; }
        #logo[data-patched] { visibility: visible !important; opacity: 1 !important; }
        #training, #facebook, #twitter, .social .sbg-training, .social .sbg-facebook, .social .sbg-twitter { display: none !important; }
        .textcentered.community.changelog-new { display: none !important; }
        .modal .modecp { display: none !important; }
        .mod .totalplayed { display: none !important; }
    `;
    (document.head || document.documentElement).appendChild(earlyCSS);

    // ===== CONSTANTS =====
    const BRAND = 'SSBAGPCM CLIENT';
    const VERSION = '2.1';
    const GITHUB_URL = 'https://github.com/ssbagpcm';
    const STORAGE_KEY = 'sb_seq_v26';
    const MAX_LINES = 5;

    // ===== SHARED STATE =====
    let socket = null;
    let navEl = null;
    let sharePopup = null;
    let infoPopup = null;
    let botsPopup = null;
    let seqGui = null;
    let sectorPopup = null;
    let running = false;
    let looping = false;
    let delay = 500;
    let deathMessageSent = false;

    // ===== SECTOR LISTING STATE =====
    let sectorData = null;
    let sectorZones = {};
    let sectorTotalP = 0;
    let sectorTotalS = 0;
    let sectorEnabledModes = { survival: true, team: true, deathmatch: true, invasion: true };
    let sectorEnabledRegions = {};
    let sectorAllRegions = [];
    let sectorAlertServers = {};
    let sectorShareOverlay = null;

    // ===== HELPER: CHECK SOCKET CONNECTED =====
    function isSocketConnected() {
        return socket && socket.readyState === WebSocket.OPEN;
    }

    // ===== STORAGE =====
    if (localStorage.getItem('emopacity') === null) localStorage.setItem('emopacity', '5');
    if (localStorage.getItem('gemindeed') === null) localStorage.setItem('gemindeed', JSON.stringify('#ff0000'));
    if (localStorage.getItem('gemindeed1') === null) localStorage.setItem('gemindeed1', JSON.stringify('#ff8080'));

    window.ClientStorage = new (class {
        _readString(key, fallback) {
            const raw = localStorage.getItem(key);
            if (raw == null) { localStorage.setItem(key, JSON.stringify(fallback)); return fallback; }
            try { const parsed = JSON.parse(raw); return typeof parsed === 'string' ? parsed : fallback; }
            catch (_) { if (typeof raw === 'string' && raw[0] === '#') return raw; return fallback; }
        }
        _readInt(key, fallback) {
            const raw = localStorage.getItem(key);
            if (raw == null) { localStorage.setItem(key, String(fallback)); return fallback; }
            try { const parsed = JSON.parse(raw); const n = typeof parsed === 'number' ? parsed : parseInt(String(parsed), 10); return Number.isFinite(n) ? n : fallback; }
            catch (_) { return fallback; }
        }
        emotes() { return Math.max(1, Math.min(5, this._readInt('emopacity', 5))); }
        gem1() { return this._readString('gemindeed', '#ff0000'); }
        gem2() { return this._readString('gemindeed1', '#ff8080'); }
    })();

    // ===== HELPER: CHECK IF TARGET IS SCRIPT UI =====
    function isScriptUI(target) {
        if (!target || !target.closest) return false;
        return target.closest('#sbn') ||
            target.closest('#sbseq') ||
            target.closest('#wss') ||
            target.closest('#sbn-share-popup') ||
            target.closest('#sbn-info-popup') ||
            target.closest('#sbn-bots-popup') ||
            target.closest('#freecam-indicator') ||
            target.closest('#wss-overlay') ||
            target.closest('#sector-popup') ||
            target.closest('#sector-share-overlay') ||
            target.closest('.modal');
    }

    // ===== WEBSOCKET INTERCEPT =====
    const RealWS = window.WebSocket;
    const Sniffer = (function () {
        const MAX_MSG = 1500, MAX_DOM = 400;
        let msgs = [], wsRef = null, wsUrl = '', panel = null, shown = false, paused = false;
        let fText = '', fDir = 'all', batchQ = [], batchPending = false;
        let altHeld = false, overlay = null;
        let autoScroll = false, hideBlobs = false;

        function hookWS(ws, url) {
            wsRef = ws; wsUrl = url;
            const realSend = ws.send.bind(ws);
            ws.send = function (d) { addMsg('out', d); return realSend(d); };
            ws.addEventListener('message', e => addMsg('in', e.data));
            ws.addEventListener('open', () => { addMsg('sys', 'CONNECTED: ' + url); urlBar(); updateUIVisibility(); });
            ws.addEventListener('close', () => { addMsg('sys', 'DISCONNECTED'); urlBar(); socket = null; updateUIVisibility(); });
            ws.addEventListener('error', () => { socket = null; updateUIVisibility(); });
            urlBar();
        }

        window.WebSocket = function (u, p) {
            const ws = p ? new RealWS(u, p) : new RealWS(u);
            hookWS(ws, u || '');
            socket = ws;
            updateUIVisibility();
            return ws;
        };
        window.WebSocket.prototype = RealWS.prototype;
        window.WebSocket.CONNECTING = 0;
        window.WebSocket.OPEN = 1;
        window.WebSocket.CLOSING = 2;
        window.WebSocket.CLOSED = 3;

        function decode(raw) {
            if (typeof raw === 'string') return raw;
            if (raw instanceof ArrayBuffer) {
                const u8 = new Uint8Array(raw);
                if (!u8.length) return '[empty]';
                try {
                    const t = new TextDecoder('utf-8', { fatal: true }).decode(u8);
                    if (/^[\x20-\x7e\r\n\t]+$/.test(t)) return t;
                } catch (_) { }
                const n = Math.min(u8.length, 48); let h = '';
                for (let i = 0; i < n; i++) h += u8[i].toString(16).padStart(2, '0') + ' ';
                return '[' + u8.length + 'B] ' + h.trim() + (u8.length > n ? ' ...' : '');
            }
            if (raw instanceof Blob) return '[Blob ' + raw.size + 'B]';
            return String(raw);
        }

        function addMsg(dir, raw) {
            if (paused) return;
            const d = new Date();
            const ts = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0') + ':' +
                String(d.getSeconds()).padStart(2, '0') + '.' + String(d.getMilliseconds()).padStart(3, '0');
            const data = decode(raw);
            const isBlob = data.startsWith('[') && (data.includes(' bytes]') || data.includes('B]'));
            const entry = { id: msgs.length, dir, ts, data, isBlob };
            msgs.push(entry);
            if (msgs.length > MAX_MSG) msgs = msgs.slice(-MAX_MSG);
            if (shown && panel) {
                batchQ.push(entry);
                if (!batchPending) { batchPending = true; requestAnimationFrame(flushBatch); }
            }
        }

        function passes(m) {
            if (fDir !== 'all' && m.dir !== fDir && m.dir !== 'sys') return false;
            if (fText && !m.data.toLowerCase().includes(fText)) return false;
            if (hideBlobs && m.isBlob) return false;
            return true;
        }

        function flushBatch() {
            batchPending = false;
            if (!panel || !shown) { batchQ = []; return; }
            const log = panel.querySelector('#wl');
            if (!log) return;
            const frag = document.createDocumentFragment();
            const items = batchQ.splice(0, 80);
            for (const m of items) { if (passes(m)) frag.appendChild(makeRow(m)); }
            log.appendChild(frag);
            while (log.children.length > MAX_DOM) log.removeChild(log.firstChild);
            if (autoScroll) log.scrollTop = log.scrollHeight;
            cntUpdate();
            if (batchQ.length) { batchPending = true; requestAnimationFrame(flushBatch); }
        }

        function rebuild() {
            if (!panel) return;
            const log = panel.querySelector('#wl');
            if (!log) return;
            log.innerHTML = ''; batchQ = [];
            const f = msgs.filter(passes), start = Math.max(0, f.length - MAX_DOM);
            const frag = document.createDocumentFragment();
            for (let i = start; i < f.length; i++) frag.appendChild(makeRow(f[i]));
            log.appendChild(frag);
            cntUpdate();
        }

        function makeRow(m) {
            const r = document.createElement('div');
            r.className = 'wr wr-' + m.dir;
            r._d = m.data;
            const h = document.createElement('div'); h.className = 'wh';
            const t = document.createElement('span'); t.className = 'wt'; t.textContent = m.ts;
            const b = document.createElement('span'); b.className = 'wb wb-' + m.dir;
            b.textContent = m.dir === 'in' ? 'IN' : m.dir === 'out' ? 'OUT' : 'SYS';
            const p = document.createElement('span'); p.className = 'wpv';
            p.textContent = m.data.length > 160 ? m.data.substring(0, 160) + '...' : m.data;
            const a = document.createElement('span'); a.className = 'wa';
            a.innerHTML = '<button data-a="copy">COPY</button><button data-a="load">LOAD</button>';
            h.append(t, b, p, a); r.appendChild(h);
            return r;
        }

        function cntUpdate() {
            if (!panel) return;
            const el = panel.querySelector('#wc');
            if (el) el.textContent = msgs.length + ' total';
        }

        function urlBar() {
            if (!panel) return;
            const el = panel.querySelector('#wu');
            if (!el) return;
            if (wsRef && wsRef.readyState <= 1) { el.textContent = wsUrl || '?'; el.className = 'wu'; }
            else { el.textContent = wsUrl ? wsUrl + ' (closed)' : 'None'; el.className = 'wu wuo'; }
        }

        function toClip(t) {
            if (navigator.clipboard?.writeText) navigator.clipboard.writeText(t).catch(() => clipFB(t));
            else clipFB(t);
        }
        function clipFB(t) {
            const e = document.createElement('textarea'); e.value = t;
            e.style.cssText = 'position:fixed;left:-9999px;opacity:0';
            document.body.appendChild(e); e.select(); document.execCommand('copy'); e.remove();
        }
        function flash(b, t) {
            const o = b.textContent; b.textContent = t; b.classList.add('wfl');
            setTimeout(() => { b.textContent = o; b.classList.remove('wfl'); }, 800);
        }
        function pretty(s) { try { return JSON.stringify(JSON.parse(s), null, 2); } catch (_) { return s; } }

        function createPanel() {
            if (panel) return;
            panel = document.createElement('div'); panel.id = 'wss'; panel.innerHTML = SNIFFER_HTML;
            document.body.appendChild(panel);
            ['mousedown', 'mouseup', 'click', 'dblclick', 'contextmenu', 'wheel'].forEach(ev =>
                panel.addEventListener(ev, e => e.stopPropagation()));
            ['keydown', 'keyup', 'keypress'].forEach(ev =>
                panel.addEventListener(ev, e => e.stopPropagation()));
            let dg = false, ox = 0, oy = 0;
            const stopDrag = () => { dg = false; rs = false; };
            panel.querySelector('#wh').addEventListener('mousedown', e => {
                if (e.target.closest('.whb')) return;
                dg = true; const r = panel.getBoundingClientRect(); ox = e.clientX - r.left; oy = e.clientY - r.top;
            });
            document.addEventListener('mousemove', e => {
                if (!dg) return;
                panel.style.left = (e.clientX - ox) + 'px'; panel.style.top = (e.clientY - oy) + 'px'; panel.style.right = 'auto';
            });
            document.addEventListener('mouseup', stopDrag);
            panel.addEventListener('mouseup', stopDrag);
            let rs = false, sw = 0, sh = 0, sx = 0, sy = 0;
            panel.querySelector('#wr').addEventListener('mousedown', e => {
                rs = true; const r = panel.getBoundingClientRect();
                sw = r.width; sh = r.height; sx = e.clientX; sy = e.clientY; e.stopPropagation();
            });
            document.addEventListener('mousemove', e => {
                if (!rs) return;
                panel.style.width = Math.max(360, sw + e.clientX - sx) + 'px';
                panel.style.height = Math.max(300, sh + e.clientY - sy) + 'px';
            });
            panel.addEventListener('click', e => {
                const btn = e.target.closest('button');
                if (!btn) return;
                const a = btn.dataset.a;
                if (a === 'copy') { const row = btn.closest('.wr'); if (row?._d) { toClip(row._d); flash(btn, 'OK'); } }
                else if (a === 'load') { const row = btn.closest('.wr'); if (row?._d) { panel.querySelector('#wta').value = pretty(row._d); flash(btn, 'OK'); } }
                else if (a === 'close') toggle();
                else if (a === 'min') { panel.classList.toggle('wmin'); btn.textContent = panel.classList.contains('wmin') ? '+' : '−'; }
                else if (a === 'pause') { paused = !paused; btn.textContent = paused ? 'RESUME' : 'PAUSE'; btn.classList.toggle('wpon', paused); }
                else if (a === 'autoscroll') { autoScroll = !autoScroll; btn.classList.toggle('wton', autoScroll); btn.textContent = autoScroll ? 'SCROLL ON' : 'SCROLL OFF'; if (autoScroll && panel) { const l = panel.querySelector('#wl'); if (l) l.scrollTop = l.scrollHeight; } }
                else if (a === 'blobs') { hideBlobs = !hideBlobs; btn.classList.toggle('wton', hideBlobs); btn.textContent = hideBlobs ? 'BINARY HIDDEN' : 'BINARY'; rebuild(); }
                else if (a === 'clear') { msgs = []; batchQ = []; rebuild(); }
                else if (a === 'copyall') { toClip(msgs.filter(passes).map(m => '[' + m.ts + '] [' + m.dir.toUpperCase() + '] ' + m.data).join('\n')); flash(btn, 'COPIED'); }
                else if (a === 'send') doSend();
                else if (a === 'fmt') { const ta = panel.querySelector('#wta'); ta.value = pretty(ta.value); }
                else if (a === 'cmp') { const ta = panel.querySelector('#wta'); try { ta.value = JSON.stringify(JSON.parse(ta.value)); } catch (_) { } }
            });
            panel.querySelector('#wl').addEventListener('click', e => {
                if (e.target.closest('.wa')) return;
                const row = e.target.closest('.wr');
                if (!row) return;
                let det = row.querySelector('.wdet');
                if (det) { det.remove(); row.classList.remove('wex'); }
                else if (row._d) {
                    det = document.createElement('div'); det.className = 'wdet';
                    const pre = document.createElement('pre'); pre.className = 'wjson';
                    pre.textContent = pretty(row._d); det.appendChild(pre);
                    row.appendChild(det); row.classList.add('wex');
                }
            });
            panel.querySelectorAll('.wdir').forEach(b => b.addEventListener('click', () => {
                panel.querySelectorAll('.wdir').forEach(x => x.classList.remove('act'));
                b.classList.add('act'); fDir = b.dataset.d; rebuild();
            }));
            panel.querySelector('#wfi').addEventListener('input', e => { fText = e.target.value.toLowerCase(); rebuild(); });
            panel.querySelector('#wta').addEventListener('keydown', e => {
                if (e.ctrlKey && e.key === 'Enter') { e.preventDefault(); doSend(); }
            });
            urlBar(); rebuild();
        }

        function doSend() {
            const ta = panel.querySelector('#wta'), val = ta.value.trim();
            if (!val) return;
            const btn = panel.querySelector('[data-a="send"]');
            if (!wsRef || wsRef.readyState !== 1) { if (btn) flash(btn, 'NO CONN'); return; }
            wsRef.send(val);
            if (btn) flash(btn, 'SENT');
        }

        function toggle() {
            shown = !shown;
            if (shown) { createPanel(); panel.style.display = 'flex'; rebuild(); }
            else if (panel) panel.style.display = 'none';
        }

        function createOverlay() {
            if (overlay) return;
            overlay = document.createElement('div');
            overlay.id = 'wss-overlay';
            ['mousedown', 'mouseup', 'click', 'dblclick', 'contextmenu', 'wheel', 'mousemove', 'pointerdown', 'pointerup', 'pointermove'].forEach(ev =>
                overlay.addEventListener(ev, e => { e.stopPropagation(); e.stopImmediatePropagation(); e.preventDefault(); }, true));
            document.body.appendChild(overlay);
        }
        function showOverlay() {
            if (!overlay) createOverlay();
            overlay.style.display = 'block';
        }
        function hideOverlay() {
            if (overlay) overlay.style.display = 'none';
        }

        window.addEventListener('keydown', e => {
            if (e.key === 'Alt' && !altHeld) { altHeld = true; showOverlay(); }
        }, true);
        window.addEventListener('keyup', e => {
            if (e.key === 'Alt' && altHeld) { altHeld = false; hideOverlay(); }
        }, true);
        window.addEventListener('blur', () => { if (altHeld) { altHeld = false; hideOverlay(); } });

        return { toggle, isShown: () => shown };
    })();

    // ===== BOTS SYSTEM =====
    const BotsSystem = (function () {
        let srvUrl = '';
        let joinMsg = null;
        const bots = [];
        const MAX = 3;
        let isCooldown = false;
        let isSpawning = false;

        const C_DIM = 'color:#444;font-size:10px;';
        const C_OK = 'color:#5a8a65;font-weight:bold;font-size:11px;';
        const C_WARN = 'color:#8a7a4a;font-weight:bold;font-size:11px;';
        const C_ERR = 'color:#8a4a4a;font-weight:bold;font-size:11px;';

        function adsLog(msg, s = C_DIM) {
            console.log('%c[ADS]%c ' + msg, 'color:#333;font-weight:bold;font-size:10px;letter-spacing:1px;', s);
        }

        // Hook into WebSocket send to capture join messages - like bots.js (any non-ghost)
        const originalSend = RealWS.prototype.send;
        RealWS.prototype.send = function (data) {
            if (!this._ghost && typeof data === 'string') {
                try { const p = JSON.parse(data); if (p.name && p.name.includes('ojct')) joinMsg = p; } catch (e) { }
            }
            return originalSend.call(this, data);
        };

        function getPlayerServerUrl() {
            if (socket && socket.readyState === WebSocket.OPEN && socket.url) return socket.url;
            return srvUrl || '';
        }

        // Capture server URL from ANY starblast.io WebSocket - like bots.js Proxy
        const snifferWS = window.WebSocket;
        window.WebSocket = function (u, p) {
            if (u && u.includes('starblast.io') && !u.includes('/api')) srvUrl = u;
            return snifferWS(u, p);
        };
        window.WebSocket.prototype = snifferWS.prototype;
        window.WebSocket.CONNECTING = snifferWS.CONNECTING || 0;
        window.WebSocket.OPEN = snifferWS.OPEN || 1;
        window.WebSocket.CLOSING = snifferWS.CLOSING || 2;
        window.WebSocket.CLOSED = snifferWS.CLOSED || 3;

        function startCooldown() {
            isCooldown = true;
            let t = 45;
            const btn = document.getElementById('_ago');
            const iv = setInterval(() => {
                if (btn) btn.textContent = `COOLDOWN · ${t}s`;
                if (--t < 0) { clearInterval(iv); isCooldown = false; if (btn) btn.textContent = 'SPAWN'; }
            }, 1000);
        }

        function killBot(bot) {
            bot.killed = true;
            bot.timers.forEach(clearInterval);
            bot.timers = [];
            try { if (bot.ws.readyState <= 1) bot.ws.close(); } catch (e) { }
            const i = bots.indexOf(bot);
            if (i > -1) bots.splice(i, 1);
        }

        function killAll(silent) {
            const n = bots.length;
            while (bots.length) killBot(bots[0]);
            updateBotList();
            if (!silent && n > 0) adsLog(`Autokilled ${n} bot(s)`, C_WARN);
            return n;
        }

        function updateBotList() {
            const el = document.getElementById('_aBotList');
            if (!el) return;
            if (!bots.length) { el.innerHTML = '<div class="ads-bots-empty">—</div>'; return; }
            el.innerHTML = bots.map(b => {
                let dc = 'ads-bot-dot', st = '';
                if (b.entered) { dc += ' active'; st = 'ACTIVE'; }
                else if (b.ws.readyState <= 1) { dc += ' joining'; st = 'JOINING'; }
                else { dc += ' dead'; st = 'CLOSED'; }
                return `<div class="ads-bot-row"><span class="${dc}"></span><span class="ads-bot-name">${b.name}</span><span class="ads-bot-state">${st}</span></div>`;
            }).join('');
        }

        function spawnBot(name, team, index, retryCount = 0) {
            const MAX_RETRIES = 3;
            const TIMEOUT = 12000;

            return new Promise(resolve => {
                const urlToUse = getPlayerServerUrl();
                if (!urlToUse || !joinMsg) {
                    adsLog(`#${index + 1} "${name}" — no server/join data (join a game first)`, C_ERR);
                    resolve(false);
                    return;
                }

                adsLog(`#${index + 1} "${name}" — connecting to your server${retryCount > 0 ? ` (retry ${retryCount}/${MAX_RETRIES})` : ''}...`);

                let resolved = false;
                let ws;

                try { ws = new RealWS(urlToUse); ws._ghost = true; } catch (e) {
                    adsLog(`#${index + 1} "${name}" — WS creation failed`, C_ERR);
                    if (retryCount < MAX_RETRIES) {
                        setTimeout(() => resolve(spawnBot(name, team, index, retryCount + 1)), 2000);
                    } else resolve(false);
                    return;
                }
                const bot = { ws, name, timers: [], killed: false, entered: false, index };
                bots.push(bot);
                updateBotList();

                function done(success) { if (resolved) return; resolved = true; resolve(success); }

                const timeout = setTimeout(() => {
                    if (resolved) return;
                    adsLog(`#${index + 1} "${name}" — timeout, killing...`, C_WARN);
                    killBot(bot); updateBotList();
                    if (retryCount < MAX_RETRIES) {
                        setTimeout(async () => done(await spawnBot(name, team, index, retryCount + 1)), 2000);
                    } else { adsLog(`#${index + 1} "${name}" — max retries`, C_ERR); done(false); }
                }, TIMEOUT);

                ws.onopen = () => {
                    if (bot.killed) return;
                    adsLog(`#${index + 1} "${name}" — socket open`);
                    const m = JSON.parse(JSON.stringify(joinMsg));
                    m.data.player_name = name;
                    m.data.client_ship_id = Date.now() + Math.random();
                    try { ws.send(JSON.stringify(m)); } catch (e) {
                        clearTimeout(timeout); killBot(bot); updateBotList(); done(false); return;
                    }
                    bot.timers.push(setInterval(() => {
                        if (bot.killed) return;
                        try { if (ws.readyState === 1) ws.send('{}'); }
                        catch (e) { killBot(bot); updateBotList(); }
                    }, 2000));
                    updateBotList();
                };

                ws.onmessage = (e) => {
                    if (bot.killed) return;
                    try {
                        const m = JSON.parse(e.data);
                        if (m.name === 'welcome') {
                            adsLog(`#${index + 1} "${name}" — welcome`);
                            setTimeout(() => {
                                if (ws.readyState === 1 && !bot.killed) {
                                    try { ws.send(JSON.stringify({ name: 'enter', data: { team: +team, spectate: false } })); }
                                    catch (e) { }
                                }
                            }, 800);
                        }
                        if (m.name === 'entered') {
                            bot.entered = true;
                            clearTimeout(timeout);
                            adsLog(`#${index + 1} "${name}" — entered ✓`, C_OK);
                            updateBotList();
                            bot.timers.push(setInterval(() => {
                                if (bot.killed) return;
                                try {
                                    if (ws.readyState === 1) ws.send(JSON.stringify({ name: 'respawn' }));
                                    else { killBot(bot); updateBotList(); }
                                } catch (e) { killBot(bot); updateBotList(); }
                            }, 3000));
                            done(true);
                        }
                        if (m.name === 'error' || m.name === 'kicked' || m.name === 'banned') {
                            clearTimeout(timeout); killBot(bot); updateBotList();
                            done(false);
                        }
                    } catch (ex) { }
                };

                ws.onerror = () => {
                    if (bot.killed) return;
                    clearTimeout(timeout); killBot(bot); updateBotList();
                    if (retryCount < MAX_RETRIES) {
                        setTimeout(async () => done(await spawnBot(name, team, index, retryCount + 1)), 2000);
                    } else { done(false); }
                };

                ws.onclose = () => {
                    if (bot.killed) return;
                    clearTimeout(timeout);
                    bot.timers.forEach(clearInterval); bot.timers = [];
                    const i = bots.indexOf(bot);
                    if (i > -1) bots.splice(i, 1);
                    updateBotList();
                    if (!resolved && retryCount < MAX_RETRIES) {
                        setTimeout(async () => done(await spawnBot(name, team, index, retryCount + 1)), 2000);
                    } else done(false);
                };
            });
        }

        setInterval(() => {
            for (let i = bots.length - 1; i >= 0; i--) {
                const b = bots[i];
                if (b.ws.readyState >= 2 && !b.killed) { killBot(b); updateBotList(); }
            }
        }, 5000);

        function saveData() {
            const panel = document.getElementById('_adsPanel');
            const d = {
                n0: document.getElementById('_an0')?.value || '',
                n1: document.getElementById('_an1')?.value || '',
                n2: document.getElementById('_an2')?.value || '',
                team: parseInt(document.getElementById('_atVal')?.textContent || '0'),
                minimized: panel?.classList.contains('minimized') || false
            };
            localStorage.setItem('ads_settings', JSON.stringify(d));
        }
        function loadData() {
            try { return JSON.parse(localStorage.getItem('ads_settings')) || null; } catch (e) { return null; }
        }

        function getTeam() {
            return parseInt(document.getElementById('_atVal')?.textContent || '0');
        }

        function setTeam(v) {
            v = Math.max(0, Math.min(4, v));
            const el = document.getElementById('_atVal');
            if (el) el.textContent = v;
            saveData();
        }

        function buildUI() {
            if (document.getElementById('_adsPanel')) return;
            const saved = loadData() || { n0: 'AD 1', n1: 'AD 2', n2: 'AD 3', team: 0, minimized: false };

            const panel = document.createElement('div');
            panel.id = '_adsPanel';
            if (saved.minimized) panel.classList.add('minimized');
            panel.innerHTML = `
                <div class="ads-head" id="_aHead">
                    <span>ADS</span>
                    <div class="ads-head-controls">
                        <span id="_aMin">${saved.minimized ? '+' : '−'}</span>
                        <span id="_aClose">×</span>
                    </div>
                </div>
                <div class="ads-body">
                    <div class="ads-status" id="_aStatus">WAITING</div>
                    <input id="_an0" type="text" value="${saved.n0}" placeholder="Bot 1 name">
                    <input id="_an1" type="text" value="${saved.n1}" placeholder="Bot 2 name">
                    <input id="_an2" type="text" value="${saved.n2}" placeholder="Bot 3 name">
                    <div class="ads-team-row">
                        <span>TEAM</span>
                        <div class="ads-stepper">
                            <button class="ads-stepper-btn" id="_atMinus">−</button>
                            <div class="ads-stepper-val" id="_atVal">${saved.team}</div>
                            <button class="ads-stepper-btn" id="_atPlus">+</button>
                        </div>
                    </div>
                    <button id="_ago" class="ads-btn primary">SPAWN</button>
                    <button id="_akill" class="ads-btn danger">TERMINATE</button>
                    <div class="ads-bots" id="_aBotList">
                        <div class="ads-bots-empty">—</div>
                    </div>
                </div>
            `;

            // Stepper buttons
            panel.querySelector('#_atMinus').onclick = (e) => { e.stopPropagation(); setTeam(getTeam() - 1); };
            panel.querySelector('#_atPlus').onclick = (e) => { e.stopPropagation(); setTeam(getTeam() + 1); };

            // Minimize
            panel.querySelector('#_aMin').onclick = (e) => {
                e.stopPropagation();
                const m = panel.classList.toggle('minimized');
                panel.querySelector('#_aMin').textContent = m ? '+' : '−';
                saveData();
            };

            // Close
            panel.querySelector('#_aClose').onclick = (e) => {
                e.stopPropagation();
                closeBotsPopup();
            };

            // Autosave
            ['_an0', '_an1', '_an2'].forEach(id => panel.querySelector('#' + id).oninput = saveData);

            // Drag
            panel.querySelector('#_aHead').onmousedown = (e) => {
                if (e.target.closest('.ads-head-controls')) return;
                const popup = panel.closest('#sbn-bots-popup');
                if (!popup) return;
                const startX = popup.offsetLeft;
                const startY = popup.offsetTop;
                const mx = e.clientX;
                const my = e.clientY;
                const stopDrag = () => {
                    document.removeEventListener('mousemove', onMove, true);
                    document.removeEventListener('mouseup', stopDrag, true);
                    const saved = JSON.parse(localStorage.getItem('ads_settings') || '{}');
                    saved.position = { top: popup.offsetTop, left: popup.offsetLeft };
                    localStorage.setItem('ads_settings', JSON.stringify(saved));
                };
                const onMove = (ev) => {
                    const dx = ev.clientX - mx;
                    const dy = ev.clientY - my;
                    popup.style.top = (startY + dy) + 'px';
                    popup.style.left = (startX + dx) + 'px';
                    popup.style.transform = 'none';
                };
                document.addEventListener('mousemove', onMove, true);
                document.addEventListener('mouseup', stopDrag, true);
            };

            // Spawn
            panel.querySelector('#_ago').onclick = async () => {
                if (isCooldown || isSpawning) return;
                if (!getPlayerServerUrl() || !joinMsg) { return; }

                if (bots.length > 0) { killAll(true); }

                isSpawning = true;
                const btn = panel.querySelector('#_ago');
                btn.disabled = true;
                btn.textContent = 'SPAWNING...';

                const names = [
                    panel.querySelector('#_an0').value,
                    panel.querySelector('#_an1').value,
                    panel.querySelector('#_an2').value
                ];
                const team = getTeam();
                const valid = names.filter(n => n.trim());

                adsLog(`═══ Deploying ${valid.length} bot(s) · Team ${team} ═══`);

                let ok = 0;
                for (let i = 0; i < names.length; i++) {
                    const n = names[i].trim();
                    if (!n) continue;
                    adsLog(`── Bot #${i + 1}: "${n}" ──`);
                    if (await spawnBot(n, team, i)) ok++;
                    if (i < names.length - 1 && names[i + 1]?.trim()) await new Promise(r => setTimeout(r, 1500));
                }

                adsLog(`═══ Result: ${ok}/${valid.length} active ═══`, ok > 0 ? C_OK : C_ERR);

                isSpawning = false;
                btn.disabled = false;
                btn.textContent = 'SPAWN';
            };

            // Kill
            panel.querySelector('#_akill').onclick = () => {
                const n = bots.length;
                if (!n) { return; }
                killAll(false);
                startCooldown();
            };

            // Status
            setInterval(() => {
                const s = panel.querySelector('#_aStatus');
                if (!s) return;
                if (!getPlayerServerUrl()) s.textContent = 'NO SERVER';
                else if (!joinMsg) s.textContent = 'NEED JOIN';
                else if (isSpawning) s.textContent = `SPAWNING · ${bots.length}/${MAX}`;
                else if (isCooldown) s.textContent = 'COOLDOWN';
                else s.textContent = `READY · ${bots.length}/${MAX}`;
                updateBotList();
            }, 500);

            return panel;
        }

        return { buildUI, updateBotList };
    })();

    // ===== FAST RESPAWN + AUTO "G" ON DEATH (ONLY WHEN SOCKET CONNECTED) =====
    const origST = window.setTimeout;
    window.setTimeout = function (fn, d) {
        if (typeof fn === 'function' && isSocketConnected()) {
            const s = fn.toString();
            if (s.includes('killed(') || (s.includes('.hide()') && s.includes('pending_respawn'))) {
                if (!deathMessageSent) {
                    deathMessageSent = true;
                    socket.send('{"name":"say","data":"G"}');
                    origST(() => { deathMessageSent = false; }, 3000);
                }
                socket.send('{"name":"respawn"}');
                return -1;
            }
        }
        return origST(fn, d);
    };

    // ===== UI VISIBILITY MANAGEMENT =====
    function updateUIVisibility() {
        const connected = isSocketConnected();
        const inGameHash = /^#\d+/.test(location.hash);

        if (connected && inGameHash) {
            // In game with socket - show navbar, hide sector listing
            showNavbar();
            hideSectorPopup();
        } else {
            // Not in game or no socket - hide navbar, show sector listing
            hideNavbar();
            showSectorPopup();
        }
    }

    setInterval(() => {
        try {
            const connected = isSocketConnected();
            const inGameHash = /^#\d+/.test(location.hash);

            if (connected && inGameHash) {
                try { socket.send('{"name":"respawn"}'); } catch (_) { }
                for (const sel of ['#logo', '#respawn', '#game_over']) {
                    const el = document.querySelector(sel);
                    if (el && el.style.display !== 'none') el.style.display = 'none';
                }
                const cw = document.getElementById('canvaswrapper');
                if (cw && cw.style.filter) cw.style.filter = '';
                showNavbar();
                hideSectorPopup();
            } else {
                const l = document.getElementById('logo');
                if (l && l.style.display === 'none') l.style.display = 'block';
                hideNavbar();
                showSectorPopup();
            }
        } catch (e) { console.error('[SSBAGPCM] UI visibility:', e); }
    }, 500);

    window.addEventListener('hashchange', updateUIVisibility);

    // ===== FREECAM (FIXED) =====
    const Freecam = (function () {
        const R = 90, Zmin = 0.9, Zmax = 3, Zdef = 1.6, Zs = 0.1;
        let Z = Zdef, Zt = Zdef, active = false, ox = 0, oy = 0, drag = false, dx = 0, dy = 0;
        let indicator = null;

        const inGame = () => /^#\d+$/.test(location.hash) && isSocketConnected();
        const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
        const limit = () => { let d = Math.sqrt(ox * ox + oy * oy); if (d > R) { ox *= R / d; oy *= R / d; } };

        function createIndicator() {
            if (indicator) return;
            indicator = document.createElement('div');
            indicator.id = 'freecam-indicator';
            indicator.innerHTML = `<span class="fc-text">FREECAM</span><span class="fc-key">I</span>`;
            document.body.appendChild(indicator);
        }

        function updateIndicator() {
            if (!indicator) createIndicator();
            if (active) {
                indicator.classList.add('active');
            } else {
                indicator.classList.remove('active');
            }
        }

        const setCursor = (hide) => {
            let s = document.getElementById('fc-hide');
            if (hide && !s) {
                s = document.createElement('style');
                s.id = 'fc-hide';
                s.textContent = `#canvaswrapper canvas { cursor: none !important; }`;
                document.head.appendChild(s);
            } else if (!hide && s) {
                s.remove();
            }
        };

        const zoomLoop = () => {
            Z += (Zt - Z) * Zs;
            if (Math.abs(Zt - Z) > 0.001) requestAnimationFrame(zoomLoop);
        };

        function hookCamera() {
            if (typeof THREE === 'undefined') return setTimeout(hookCamera, 200);
            const orig = THREE.PerspectiveCamera.prototype.updateProjectionMatrix;
            THREE.PerspectiveCamera.prototype.updateProjectionMatrix = function () {
                if (this.position?.z > 50 && this.position.z < 150) {
                    if (!this._bz) this._bz = this.fov;
                    if (active) {
                        this.fov = clamp(this._bz / Z, 10, 90);
                        if (!this._bp) this._bp = { x: this.position.x, y: this.position.y };
                        this.position.x = this._bp.x + ox;
                        this.position.y = this._bp.y + oy;
                    } else {
                        this._bp = null;
                    }
                }
                return orig.call(this);
            };
        }

        function toggle() {
            active = !active;
            if (!active) { ox = oy = 0; Zt = Z = Zdef; drag = false; }
            setCursor(active);
            updateIndicator();
        }

        function init() {
            hookCamera();

            window.addEventListener('wheel', e => {
                if (!inGame() || !active) return;
                if (isScriptUI(e.target)) return;
                e.preventDefault(); e.stopPropagation();
                Zt = clamp(Zt + (e.deltaY > 0 ? -0.08 : 0.08), Zmin, Zmax);
                requestAnimationFrame(zoomLoop);
            }, { passive: false, capture: true });

            window.addEventListener('keydown', e => {
                if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
                if (!inGame()) return;

                if (e.key === 'i' || e.key === 'I') {
                    e.preventDefault();
                    e.stopPropagation();
                    e.stopImmediatePropagation();
                    toggle();
                    return false;
                }

                if (active && !e.ctrlKey && !e.altKey && !isScriptUI(e.target)) {
                    e.preventDefault();
                    e.stopImmediatePropagation();
                }
            }, true);

            window.addEventListener('keyup', e => {
                if (active && inGame() && (e.key === 'i' || e.key === 'I')) {
                    e.preventDefault();
                    e.stopPropagation();
                    e.stopImmediatePropagation();
                }
            }, true);

            window.addEventListener('mousedown', e => {
                if (active && inGame()) {
                    if (isScriptUI(e.target)) return;

                    drag = true;
                    dx = e.clientX;
                    dy = e.clientY;
                    e.preventDefault();
                    e.stopImmediatePropagation();
                }
            }, true);

            window.addEventListener('mousemove', e => {
                if (active && inGame() && drag) {
                    if (isScriptUI(e.target)) return;

                    ox -= (e.clientX - dx) * 0.3;
                    oy += (e.clientY - dy) * 0.3;
                    limit();
                    dx = e.clientX;
                    dy = e.clientY;
                }
            }, true);

            window.addEventListener('mouseup', (e) => {
                if (drag) {
                    drag = false;
                    if (active && inGame() && !isScriptUI(e.target)) {
                        e.preventDefault();
                        e.stopImmediatePropagation();
                    }
                }
            }, true);

            window.addEventListener('click', e => {
                if (active && inGame()) {
                    if (isScriptUI(e.target)) return;

                    e.preventDefault();
                    e.stopImmediatePropagation();
                }
            }, true);

            window.addEventListener('contextmenu', e => {
                if (active && inGame()) {
                    if (isScriptUI(e.target)) return;

                    e.preventDefault();
                    e.stopImmediatePropagation();
                }
            }, true);

            window.addEventListener('hashchange', () => {
                active = false;
                ox = oy = 0;
                Zt = Z = Zdef;
                drag = false;
                setCursor(false);
                updateIndicator();
                updateUIVisibility();
            });
        }

        return { init, toggle, isOn: () => active };
    })();

    // ===== IN-GAME NAVBAR =====
    const ICONS = {
        grip: `<svg width="10" height="18" viewBox="0 0 10 18" fill="currentColor"><circle cx="2.5" cy="3" r="1.5"/><circle cx="7.5" cy="3" r="1.5"/><circle cx="2.5" cy="9" r="1.5"/><circle cx="7.5" cy="9" r="1.5"/><circle cx="2.5" cy="15" r="1.5"/><circle cx="7.5" cy="15" r="1.5"/></svg>`,
        freecam: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="2" fill="currentColor"/></svg>`,
        screenshot: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>`,
        share: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>`,
        expand: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>`,
        compress: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="14" y1="10" x2="21" y2="3"/><line x1="3" y1="21" x2="10" y2="14"/></svg>`,
        info: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`,
        terminal: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>`,
        bots: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>`,
        chat: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>`,
        settings: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"/></svg>`,
        x: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`
    };

    function createNavbar() {
        if (document.getElementById('sbn')) return;

        const nav = document.createElement('div');
        nav.id = 'sbn';
        nav.innerHTML = `
            <div id="sbn-drag" title="Drag to move">${ICONS.grip}</div>
            <button id="sbn-freecam" title="Freecam (I)">${ICONS.freecam}</button>
            <button id="sbn-sequencer" title="Sequencer (Alt+N)">${ICONS.chat}</button>
            <button id="sbn-sniffer" title="WebSocket Sniffer (Alt+J)">${ICONS.terminal}</button>
            <button id="sbn-bots" title="Bots">${ICONS.bots}</button>
            <div id="sbn-sep"></div>
            <button id="sbn-screenshot" title="Screenshot">${ICONS.screenshot}</button>
            <button id="sbn-share" title="Share">${ICONS.share}</button>
            <button id="sbn-fullscreen" title="Fullscreen">${ICONS.expand}</button>
            <button id="sbn-settings" title="Settings (Ctrl+S)">${ICONS.settings}</button>
            <button id="sbn-info" title="Info">${ICONS.info}</button>
            <div id="sbn-sep"></div>
            <button id="sbn-quit" title="Quit to menu">${ICONS.x}</button>
        `;
        document.body.appendChild(nav);
        navEl = nav;

        ['mousedown', 'click', 'dblclick', 'contextmenu', 'wheel'].forEach(ev =>
            nav.addEventListener(ev, e => e.stopPropagation()));

        const drag = nav.querySelector('#sbn-drag');
        let dragging = false, ox = 0, oy = 0;
        drag.addEventListener('mousedown', (e) => {
            dragging = true;
            ox = e.clientX - nav.offsetLeft;
            oy = e.clientY - nav.offsetTop;
            e.preventDefault();
        });
        document.addEventListener('mousemove', (e) => {
            if (!dragging) return;
            nav.style.left = (e.clientX - ox) + 'px';
            nav.style.top = (e.clientY - oy) + 'px';
            nav.style.transform = 'none';
        });
        document.addEventListener('mouseup', () => { dragging = false; });
        nav.addEventListener('mouseup', () => { dragging = false; });

        nav.querySelector('#sbn-freecam').addEventListener('click', () => {
            Freecam.toggle();
        });

        nav.querySelector('#sbn-sequencer').addEventListener('click', () => {
            toggleSequencer();
        });

        nav.querySelector('#sbn-sniffer').addEventListener('click', () => {
            Sniffer.toggle();
        });

        nav.querySelector('#sbn-bots').addEventListener('click', (e) => {
            e.stopPropagation();
            toggleBotsPopup();
        });

        nav.querySelector('#sbn-screenshot').addEventListener('click', () => {
            takeScreenshot();
        });

        nav.querySelector('#sbn-share').addEventListener('click', (e) => {
            e.stopPropagation();
            toggleSharePopup();
        });

        nav.querySelector('#sbn-fullscreen').addEventListener('click', () => {
            if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen().catch(() => { });
                nav.querySelector('#sbn-fullscreen').innerHTML = ICONS.compress;
            } else {
                document.exitFullscreen();
                nav.querySelector('#sbn-fullscreen').innerHTML = ICONS.expand;
            }
        });

        nav.querySelector('#sbn-settings').addEventListener('click', () => {
            toggleSettings();
        });

        nav.querySelector('#sbn-info').addEventListener('click', (e) => {
            e.stopPropagation();
            toggleInfoPopup();
        });

        nav.querySelector('#sbn-quit').addEventListener('click', () => {
            location.hash = '';
            location.reload();
        });

        document.addEventListener('click', (e) => {
            if (sharePopup && !sharePopup.contains(e.target) && !e.target.closest('#sbn-share')) {
                closeSharePopup();
            }
            if (infoPopup && !infoPopup.contains(e.target) && !e.target.closest('#sbn-info')) {
                closeInfoPopup();
            }
        });
    }

    function takeScreenshot() {
        const canvas = document.querySelector('#canvaswrapper canvas');
        if (!canvas) return;

        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                try {
                    const w = canvas.width;
                    const h = canvas.height;
                    const captureCanvas = document.createElement('canvas');
                    captureCanvas.width = w;
                    captureCanvas.height = h;
                    const ctx = captureCanvas.getContext('2d');

                    ctx.drawImage(canvas, 0, 0);

                    const imageData = ctx.getImageData(0, 0, 1, 1);
                    const hasContent = imageData.data[3] > 0;

                    if (!hasContent) {
                        const gl = canvas.getContext('webgl') || canvas.getContext('webgl2');
                        if (gl) {
                            const pixels = new Uint8Array(w * h * 4);
                            gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

                            const imgData = ctx.createImageData(w, h);
                            for (let y = 0; y < h; y++) {
                                for (let x = 0; x < w; x++) {
                                    const srcIdx = ((h - y - 1) * w + x) * 4;
                                    const dstIdx = (y * w + x) * 4;
                                    imgData.data[dstIdx] = pixels[srcIdx];
                                    imgData.data[dstIdx + 1] = pixels[srcIdx + 1];
                                    imgData.data[dstIdx + 2] = pixels[srcIdx + 2];
                                    imgData.data[dstIdx + 3] = pixels[srcIdx + 3];
                                }
                            }
                            ctx.putImageData(imgData, 0, 0);
                        }
                    }

                    const dataUrl = captureCanvas.toDataURL('image/png');
                    const a = document.createElement('a');
                    a.href = dataUrl;
                    a.download = 'starblast_' + Date.now() + '.png';
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                } catch (e) {
                    console.error('Screenshot failed:', e);
                }
            });
        });
    }

    function showNavbar() {
        if (!navEl) createNavbar();
        if (navEl) navEl.style.display = 'flex';
    }

    function hideNavbar() {
        if (navEl) {
            navEl.style.display = 'none';
            closeSharePopup();
            closeInfoPopup();
            closeBotsPopup();
        }
    }

    function toggleSharePopup() {
        if (sharePopup) { closeSharePopup(); return; }
        closeInfoPopup();

        const link = location.href;
        const popup = document.createElement('div');
        popup.id = 'sbn-share-popup';
        popup.innerHTML = `
            <div class="sbn-popup-title">Share Room</div>
            <div class="sbn-popup-row">
                <input id="sbn-share-link" readonly value="${link}" />
                <button id="sbn-copy" title="Copy"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg></button>
            </div>
            <div class="sbn-qr">
                <img src="https://api.qrserver.com/v1/create-qr-code/?size=120x120&bgcolor=0a0a0a&color=ffffff&data=${encodeURIComponent(link)}" alt="QR" width="120" height="120" />
            </div>
        `;
        document.body.appendChild(popup);
        sharePopup = popup;

        ['mousedown', 'mouseup', 'click', 'dblclick', 'contextmenu', 'wheel'].forEach(ev =>
            popup.addEventListener(ev, e => e.stopPropagation()));

        const btn = document.querySelector('#sbn-share');
        if (btn && navEl) {
            const r = btn.getBoundingClientRect();
            popup.style.top = (navEl.offsetTop + navEl.offsetHeight + 10) + 'px';
            popup.style.left = (r.left + r.width / 2) + 'px';
        }

        popup.querySelector('#sbn-copy').addEventListener('click', () => {
            const input = popup.querySelector('#sbn-share-link');
            navigator.clipboard.writeText(input.value).then(() => {
                const copyBtn = popup.querySelector('#sbn-copy');
                copyBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4f4" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
                setTimeout(() => { copyBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>`; }, 1500);
            });
        });

        popup.querySelector('#sbn-share-link').addEventListener('click', function () {
            this.select();
        });
    }

    function closeSharePopup() {
        if (sharePopup) { sharePopup.remove(); sharePopup = null; }
    }

    function toggleInfoPopup() {
        if (infoPopup) { closeInfoPopup(); return; }
        closeSharePopup();

        const hash = location.hash.replace('#', '');
        const popup = document.createElement('div');
        popup.id = 'sbn-info-popup';
        popup.innerHTML = `
            <div class="sbn-popup-title">Game Info</div>
            <div class="sbn-info-row"><span>Room</span><span>#${hash}</span></div>
            <div class="sbn-info-row"><span>URL</span><span>${location.host}</span></div>
            <div class="sbn-info-row"><span>Time</span><span>${new Date().toLocaleTimeString()}</span></div>
            <div class="sbn-info-row"><span>Fullscreen</span><span>${document.fullscreenElement ? 'Yes' : 'No'}</span></div>
            <div class="sbn-info-row"><span>Freecam</span><span>${Freecam.isOn() ? 'On' : 'Off'}</span></div>
        `;
        document.body.appendChild(popup);
        infoPopup = popup;

        ['mousedown', 'mouseup', 'click', 'dblclick', 'contextmenu', 'wheel'].forEach(ev =>
            popup.addEventListener(ev, e => e.stopPropagation()));

        const btn = document.querySelector('#sbn-info');
        if (btn && navEl) {
            const r = btn.getBoundingClientRect();
            popup.style.top = (navEl.offsetTop + navEl.offsetHeight + 10) + 'px';
            popup.style.left = (r.left + r.width / 2) + 'px';
        }
    }

    function closeInfoPopup() {
        if (infoPopup) { infoPopup.remove(); infoPopup = null; }
    }

    function toggleBotsPopup() {
        if (botsPopup) { closeBotsPopup(); return; }
        closeSharePopup();
        closeInfoPopup();

        const popup = document.createElement('div');
        popup.id = 'sbn-bots-popup';
        const botsPanel = BotsSystem.buildUI();
        popup.appendChild(botsPanel);
        document.body.appendChild(popup);
        botsPopup = popup;

        // Load saved position or use default
        const saved = JSON.parse(localStorage.getItem('ads_settings') || '{}');
        if (saved.position) {
            popup.style.top = saved.position.top + 'px';
            popup.style.left = saved.position.left + 'px';
        } else {
            popup.style.top = '100px';
            popup.style.left = '20px';
        }
        popup.style.transform = 'none';

        ['mousedown', 'mouseup', 'click', 'dblclick', 'contextmenu', 'wheel'].forEach(ev =>
            popup.addEventListener(ev, e => e.stopPropagation()));
    }

    function closeBotsPopup() {
        if (botsPopup) { botsPopup.remove(); botsPopup = null; }
    }

    // ===== SETTINGS =====
    function toggleSettings() {
        const modal = document.querySelector('.modal');
        const isOpen = modal && modal.style.display !== 'none' && modal.offsetParent !== null;

        if (isOpen) {
            const closeBtn = modal.querySelector('.close-modal');
            if (closeBtn) closeBtn.click();
        } else {
            openSettings();
        }
    }

    function openSettings() {
        try {
            if (window.module?.exports?.settings) {
                const settings = Object.values(window.module.exports.settings);
                for (const s of settings) {
                    if (s && typeof s.showModal === 'function') {
                        s.showModal('settings');
                        return true;
                    }
                    if (s && s.ui && typeof s.ui.showModal === 'function') {
                        s.ui.showModal('settings');
                        return true;
                    }
                }
            }
        } catch (_) { }

        const selectors = [
            'i.sbg-gears',
            '.sbg-gears',
            '.social i.sbg-gears',
            '.social .sbg-gears',
            '.social .fa-gears',
            '.social .fa-cog',
            '.fa-cog',
            '.fa-gear',
            '[class*="gears"]',
            '[class*="settings"]'
        ];

        for (const s of selectors) {
            const elements = document.querySelectorAll(s);
            for (const e of elements) {
                if (e && e.offsetParent !== null) {
                    const evt = new MouseEvent('click', {
                        bubbles: true,
                        cancelable: true,
                        view: window
                    });
                    e.dispatchEvent(evt);
                    return true;
                }
            }
        }

        const social = document.querySelector('.social');
        if (social) {
            const origDisplay = social.style.display;
            const origOpacity = social.style.opacity;
            const origVisibility = social.style.visibility;
            const origPointer = social.style.pointerEvents;

            social.style.cssText = 'display: flex !important; opacity: 1 !important; visibility: visible !important; pointer-events: auto !important;';

            setTimeout(() => {
                for (const s of selectors) {
                    const e = social.querySelector(s);
                    if (e) {
                        const evt = new MouseEvent('click', {
                            bubbles: true,
                            cancelable: true,
                            view: window
                        });
                        e.dispatchEvent(evt);

                        setTimeout(() => {
                            social.style.display = origDisplay;
                            social.style.opacity = origOpacity;
                            social.style.visibility = origVisibility;
                            social.style.pointerEvents = origPointer;
                        }, 50);
                        return;
                    }
                }
                social.style.display = origDisplay;
                social.style.opacity = origOpacity;
                social.style.visibility = origVisibility;
                social.style.pointerEvents = origPointer;
            }, 10);
        }

        return false;
    }

    function makeModalsDraggable() {
        let currentModal = null;
        let dragging = false;
        let offsetX = 0;
        let offsetY = 0;

        document.addEventListener('mousedown', (e) => {
            const header = e.target.closest('.modal .header');
            if (!header || e.target.closest('.close-modal')) return;

            const modal = header.closest('.modal');
            if (!modal) return;

            currentModal = modal;
            dragging = true;

            const rect = modal.getBoundingClientRect();
            offsetX = e.clientX - rect.left;
            offsetY = e.clientY - rect.top;

            modal.style.transition = 'none';
            header.style.cursor = 'grabbing';
            e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
            if (!dragging || !currentModal) return;

            currentModal.style.position = 'fixed';
            currentModal.style.left = (e.clientX - offsetX) + 'px';
            currentModal.style.top = (e.clientY - offsetY) + 'px';
            currentModal.style.right = 'auto';
            currentModal.style.bottom = 'auto';
            currentModal.style.transform = 'none';
            currentModal.style.margin = '0';
        });

        document.addEventListener('mouseup', () => {
            if (dragging && currentModal) {
                const header = currentModal.querySelector('.header');
                if (header) header.style.cursor = 'grab';
                currentModal.style.transition = '';
            }
            dragging = false;
            currentModal = null;
        });
    }

    // ===== SECTOR LISTING POPUP =====
    const SECTOR_ICONS = {
        survival: 'accessibility',
        team: 'people',
        deathmatch: 'whatshot',
        invasion: 'blur_off'
    };

    // ===== SECTOR LISTING POPUP CSS =====
    const SECTOR_CSS = `
/* ===== SECTOR LISTING POPUP ===== */
#sector-popup {
    position: fixed;
    left: 24px;
    top: 50%;
    transform: translateY(-50%);
    width: 420px;
    max-width: 95vw;
    max-height: 72vh;
    background: rgba(8,8,12,.94);
    backdrop-filter: blur(32px);
    -webkit-backdrop-filter: blur(32px);
    border: 1px solid rgba(255,255,255,.08);
    border-radius: 14px;
    display: none;
    flex-direction: column;
    overflow: hidden;
    z-index: 999998;
    box-shadow: 0 24px 64px rgba(0,0,0,.7);
    font-family: 'Inter', system-ui, -apple-system, sans-serif;
}

.sector-titlebar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 13px 16px;
    border-bottom: 1px solid rgba(255,255,255,.06);
    flex-shrink: 0;
    min-height: 50px;
    background: rgba(255,255,255,.02);
}

.sector-titlebar-title {
    font-size: 11px;
    font-weight: 600;
    color: rgba(255,255,255,.4);
    letter-spacing: 2px;
}

.sector-titlebar-meta {
    font-size: 11px;
    color: rgba(255,255,255,.35);
    display: flex;
    gap: 14px;
    align-items: center;
}

.sector-titlebar-meta span {
    display: flex;
    align-items: center;
    gap: 4px;
}

.sector-titlebar-meta .material-icons-round { font-size: 13px; }

.sector-filters-section {
    padding: 14px 16px;
    border-bottom: 1px solid rgba(255,255,255,.04);
    flex-shrink: 0;
}

.sector-filters-row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 10px;
}

.sector-filters-row:last-child {
    margin-bottom: 0;
}

.sector-filter-label {
    font-size: 9px;
    font-weight: 700;
    color: rgba(255,255,255,.25);
    text-transform: uppercase;
    letter-spacing: .8px;
    min-width: 50px;
}

.sector-filters-chips {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
    flex: 1;
}

.sector-filter-chip {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 6px 12px;
    border: 1px solid rgba(255,255,255,.08);
    border-radius: 8px;
    background: rgba(255,255,255,.02);
    color: rgba(255,255,255,.35);
    font-family: inherit;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    transition: all .15s;
    white-space: nowrap;
}

.sector-filter-chip .material-icons-round { font-size: 14px; }
.sector-filter-chip.active { color: rgba(255,255,255,.85); border-color: rgba(255,255,255,.15); background: rgba(255,255,255,.06); }
.sector-filter-chip:hover { border-color: rgba(255,255,255,.12); background: rgba(255,255,255,.04); }

.sector-region-chip {
    padding: 6px 11px;
    border: 1px solid rgba(255,255,255,.08);
    border-radius: 8px;
    background: rgba(255,255,255,.02);
    color: rgba(255,255,255,.35);
    font-family: inherit;
    font-size: 10px;
    font-weight: 600;
    cursor: pointer;
    transition: all .15s;
    white-space: nowrap;
}

.sector-region-chip.active { color: rgba(255,255,255,.85); border-color: rgba(255,255,255,.15); background: rgba(255,255,255,.06); }
.sector-region-chip:hover { border-color: rgba(255,255,255,.12); }

.sector-content {
    flex: 1;
    overflow-y: auto;
    padding: 10px 0;
}

.sector-content::-webkit-scrollbar { width: 5px; }
.sector-content::-webkit-scrollbar-track { background: transparent; }
.sector-content::-webkit-scrollbar-thumb { background: rgba(255,255,255,.1); border-radius: 3px; }

.sector-zone { padding: 0 16px; margin-bottom: 18px; }

.sector-zone-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 0;
    margin-bottom: 6px;
}

.sector-zone-name {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: rgba(255,255,255,.35);
}

.sector-zone-alert-btn {
    display: flex;
    align-items: center;
    background: none;
    border: none;
    cursor: pointer;
    color: rgba(255,255,255,.2);
    padding: 4px;
    border-radius: 6px;
    transition: all .15s;
}

.sector-zone-alert-btn .material-icons-round { font-size: 16px; }
.sector-zone-alert-btn.on { color: rgba(100,220,160,1); }
.sector-zone-alert-btn:hover { color: rgba(255,255,255,.5); }

.sector-server-row {
    display: grid;
    grid-template-columns: 20px 1fr 46px 34px 28px 28px;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    border-radius: 10px;
    transition: background .1s;
    margin-bottom: 2px;
}

.sector-server-row:hover { background: rgba(255,255,255,.04); }
.sector-server-row .sector-mode-icon { font-size: 16px; color: rgba(255,255,255,.25); }

.sector-server-name {
    font-size: 13px;
    font-weight: 500;
    color: rgba(255,255,255,.7);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.sector-server-row.closed .sector-server-name { color: rgba(255,255,255,.3); }
.sector-server-row.fresh .sector-server-name { color: #fff; font-weight: 600; }

.sector-server-time {
    font-size: 11px;
    font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace;
    color: rgba(255,255,255,.35);
    text-align: right;
    font-weight: 500;
}

.sector-server-row.fresh .sector-server-time { color: rgba(255,255,255,.6); }

.sector-server-stat {
    display: flex;
    align-items: center;
    gap: 3px;
    font-size: 11px;
    color: rgba(255,255,255,.35);
    justify-content: center;
}

.sector-server-stat .material-icons-round { font-size: 14px; }

.sector-action-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: 7px;
    border: 1px solid rgba(255,255,255,.08);
    background: rgba(255,255,255,.02);
    color: rgba(255,255,255,.4);
    cursor: pointer;
    transition: all .15s;
    text-decoration: none;
}

.sector-action-btn .material-icons-round { font-size: 15px; }

.sector-action-btn:hover {
    background: rgba(255,255,255,.1);
    color: #fff;
    border-color: rgba(255,255,255,.15);
}

.sector-status-text {
    text-align: center;
    padding: 50px 20px;
    color: rgba(255,255,255,.35);
    font-size: 13px;
}

/* ===== SECTOR SHARE OVERLAY ===== */
#sector-share-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,.6);
    display: none;
    align-items: center;
    justify-content: center;
    z-index: 9999999;
    backdrop-filter: blur(4px);
    -webkit-backdrop-filter: blur(4px);
}

#sector-share-overlay.visible { display: flex; }

.sector-share-popup {
    background: rgba(8,8,12,.96);
    border: 1px solid rgba(255,255,255,.1);
    border-radius: 16px;
    padding: 28px;
    width: 300px;
    max-width: 90vw;
    box-shadow: 0 30px 80px rgba(0,0,0,.7);
    text-align: center;
}

.sector-share-popup h3 {
    font-size: 11px;
    font-weight: 700;
    color: rgba(255,255,255,.4);
    margin-bottom: 4px;
    text-transform: uppercase;
    letter-spacing: 2px;
}

.sector-share-server-name {
    font-size: 12px;
    color: rgba(255,255,255,.5);
    margin-bottom: 20px;
}

.sector-qr-container {
    display: flex;
    justify-content: center;
    margin-bottom: 18px;
    padding: 10px;
    background: rgba(255,255,255,.03);
    border-radius: 12px;
    border: 1px solid rgba(255,255,255,.06);
}

.sector-qr-container img { border-radius: 8px; }

.sector-share-link-row {
    display: flex;
    gap: 6px;
    margin-bottom: 14px;
}

.sector-share-link-input {
    flex: 1;
    padding: 10px 12px;
    border: 1px solid rgba(255,255,255,.08);
    border-radius: 8px;
    font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace;
    font-size: 10px;
    color: rgba(255,255,255,.6);
    outline: none;
    background: rgba(0,0,0,.3);
}

.sector-copy-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0 14px;
    border: 1px solid rgba(255,255,255,.1);
    border-radius: 8px;
    background: rgba(255,255,255,.04);
    cursor: pointer;
    color: rgba(255,255,255,.5);
    transition: all .15s;
    font-family: inherit;
    font-size: 11px;
    font-weight: 600;
    gap: 5px;
}

.sector-copy-btn:hover { background: rgba(255,255,255,.1); color: #fff; }
.sector-copy-btn .material-icons-round { font-size: 14px; }

.sector-share-close-btn {
    background: none;
    border: 1px solid rgba(255,255,255,.1);
    border-radius: 8px;
    padding: 9px 24px;
    font-family: inherit;
    font-size: 11px;
    font-weight: 600;
    color: rgba(255,255,255,.4);
    cursor: pointer;
    transition: all .15s;
}

.sector-share-close-btn:hover { background: rgba(255,255,255,.06); color: rgba(255,255,255,.7); }

.sector-copied-toast {
    position: fixed;
    bottom: 30px;
    left: 50%;
    transform: translateX(-50%) translateY(20px);
    background: rgba(100,220,160,.9);
    color: #000;
    padding: 10px 20px;
    border-radius: 8px;
    font-size: 12px;
    font-weight: 600;
    opacity: 0;
    transition: all .25s;
    pointer-events: none;
    z-index: 99999999;
}

.sector-copied-toast.show {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
}
`;

    function createSectorPopup() {
        if (sectorPopup) return;

        // Inject sector CSS
        if (!document.getElementById('sector-popup-css')) {
            const style = document.createElement('style');
            style.id = 'sector-popup-css';
            style.textContent = SECTOR_CSS;
            document.head.appendChild(style);
        }

        // Load Material Icons
        if (!document.querySelector('link[href*="Material+Icons"]')) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = 'https://fonts.googleapis.com/icon?family=Material+Icons+Round';
            document.head.appendChild(link);
        }

        sectorPopup = document.createElement('div');
        sectorPopup.id = 'sector-popup';
        sectorPopup.innerHTML = `
        <div class="sector-titlebar">
            <div class="sector-titlebar-title">SECTOR LISTING</div>
            <div class="sector-titlebar-meta">
                <span><span class="material-icons-round">dns</span><span id="sector-total-servers">—</span></span>
                <span><span class="material-icons-round">person</span><span id="sector-total-players">—</span></span>
            </div>
        </div>
        <div class="sector-filters-section">
            <div class="sector-filters-row">
                <span class="sector-filter-label">MODE</span>
                <div class="sector-filters-chips">
                    <button class="sector-filter-chip active" data-mode="survival">
                        <span class="material-icons-round">accessibility</span> Survival
                    </button>
                    <button class="sector-filter-chip active" data-mode="team">
                        <span class="material-icons-round">people</span> Team
                    </button>
                    <button class="sector-filter-chip active" data-mode="deathmatch">
                        <span class="material-icons-round">whatshot</span> DM
                    </button>
                    <button class="sector-filter-chip active" data-mode="invasion">
                        <span class="material-icons-round">blur_off</span> Invasion
                    </button>
                </div>
            </div>
            <div class="sector-filters-row">
                <span class="sector-filter-label">REGION</span>
                <div class="sector-filters-chips" id="sector-region-filters"></div>
            </div>
        </div>
        <div class="sector-content" id="sector-zone-wrapper">
            <div class="sector-status-text">Loading...</div>
        </div>
    `;

        document.body.appendChild(sectorPopup);

        // Create share overlay
        sectorShareOverlay = document.createElement('div');
        sectorShareOverlay.id = 'sector-share-overlay';
        sectorShareOverlay.innerHTML = `
        <div class="sector-share-popup">
            <h3>SHARE</h3>
            <div class="sector-share-server-name" id="sector-share-server-name"></div>
            <div class="sector-qr-container" id="sector-qr-container"></div>
            <div class="sector-share-link-row">
                <input class="sector-share-link-input" id="sector-share-link-input" readonly>
                <button class="sector-copy-btn" id="sector-copy-btn">
                    <span class="material-icons-round">content_copy</span> Copy
                </button>
            </div>
            <button class="sector-share-close-btn" id="sector-share-close-btn">Close</button>
        </div>
    `;
        document.body.appendChild(sectorShareOverlay);

        // Toast
        const toast = document.createElement('div');
        toast.id = 'sector-copied-toast';
        toast.className = 'sector-copied-toast';
        toast.textContent = 'Copied';
        document.body.appendChild(toast);

        // Stop propagation
        ['mousedown', 'mouseup', 'click', 'dblclick', 'contextmenu', 'wheel'].forEach(ev => {
            sectorPopup.addEventListener(ev, e => e.stopPropagation());
            sectorShareOverlay.addEventListener(ev, e => e.stopPropagation());
        });

        // Filter chips - mode
        sectorPopup.querySelectorAll('.sector-filter-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                chip.classList.toggle('active');
                sectorEnabledModes[chip.dataset.mode] = chip.classList.contains('active');
                renderSectorZones();
            });
        });

        // Share overlay events
        sectorShareOverlay.addEventListener('click', (e) => {
            if (e.target === sectorShareOverlay) closeSectorShare();
        });
        sectorShareOverlay.querySelector('#sector-share-close-btn').addEventListener('click', closeSectorShare);
        sectorShareOverlay.querySelector('#sector-copy-btn').addEventListener('click', () => {
            const input = document.getElementById('sector-share-link-input');
            navigator.clipboard.writeText(input.value).then(() => {
                const t = document.getElementById('sector-copied-toast');
                t.classList.add('show');
                setTimeout(() => t.classList.remove('show'), 1400);
            });
        });

        // Start fetching
        fetchSectorData();
        setInterval(fetchSectorData, 10000);
        setInterval(updateSectorTimes, 1000);
    }

    function showSectorPopup() {
        if (!sectorPopup) createSectorPopup();
        if (sectorPopup) sectorPopup.style.display = 'flex';
    }

    function hideSectorPopup() {
        if (sectorPopup) sectorPopup.style.display = 'none';
        if (sectorShareOverlay) sectorShareOverlay.classList.remove('visible');
    }

    function fetchSectorData() {
        fetch('https://starblast.io/simstatus.json')
            .then(res => res.json())
            .then(data => {
                sectorData = data;
                processSectorData();
                renderSectorZones();
            })
            .catch(() => {
                const wrapper = document.getElementById('sector-zone-wrapper');
                if (wrapper) wrapper.innerHTML = '<div class="sector-status-text">Connection error</div>';
            });
    }

    function processSectorData() {
        sectorZones = {};
        sectorTotalP = 0;
        sectorTotalS = 0;

        sectorData.forEach(region => {
            region.systems.forEach(sys => {
                const loc = region.location;
                if (!sectorZones[loc]) sectorZones[loc] = [];
                sectorZones[loc].push({
                    name: sys.name,
                    time: sys.time,
                    players: sys.players,
                    id: sys.id,
                    open: sys.open,
                    mode: sys.mode,
                    crime: sys.criminal_activity || 0
                });
                sectorTotalP += sys.players;
                sectorTotalS++;
            });
        });

        buildSectorRegionFilters(Object.keys(sectorZones).sort());
    }

    function buildSectorRegionFilters(regions) {
        const newR = regions.filter(r => !sectorAllRegions.includes(r));
        if (newR.length === 0 && regions.length === sectorAllRegions.length) return;

        sectorAllRegions = regions;
        const container = document.getElementById('sector-region-filters');
        if (!container) return;
        container.innerHTML = '';

        regions.forEach(r => {
            if (typeof sectorEnabledRegions[r] === 'undefined') sectorEnabledRegions[r] = true;
            const active = sectorEnabledRegions[r] ? 'active' : '';
            const chip = document.createElement('button');
            chip.className = `sector-region-chip ${active}`;
            chip.dataset.region = r;
            chip.textContent = r;
            chip.addEventListener('click', () => {
                chip.classList.toggle('active');
                sectorEnabledRegions[r] = chip.classList.contains('active');
                renderSectorZones();
            });
            container.appendChild(chip);
        });
    }

    function renderSectorZones() {
        if (!sectorData) return;

        const totalServersEl = document.getElementById('sector-total-servers');
        const totalPlayersEl = document.getElementById('sector-total-players');
        if (totalServersEl) totalServersEl.textContent = sectorTotalS;
        if (totalPlayersEl) totalPlayersEl.textContent = sectorTotalP;

        const wrapper = document.getElementById('sector-zone-wrapper');
        if (!wrapper) return;
        wrapper.innerHTML = '';

        const keys = Object.keys(sectorZones).sort();
        let anyVisible = false;

        keys.forEach(key => {
            if (!sectorEnabledRegions[key]) return;

            const systems = sectorZones[key].sort((a, b) => a.time - b.time);
            const safeKey = key.replace(/\s+/g, '');
            const visible = systems.filter(s => sectorEnabledModes[s.mode]);
            if (visible.length === 0) return;

            anyVisible = true;
            const alertOn = sectorAlertServers[safeKey] === 'checked';

            const zone = document.createElement('div');
            zone.className = 'sector-zone';

            let html = `
                <div class="sector-zone-header">
                    <span class="sector-zone-name">${key} (${visible.length})</span>
                    <button class="sector-zone-alert-btn ${alertOn ? 'on' : ''}" id="alertBtn-${safeKey}" data-key="${key}">
                        <span class="material-icons-round">notifications</span>
                    </button>
                </div>
            `;

            visible.forEach(sys => {
                const min = Math.floor(sys.time / 60);
                const sec = String(sys.time % 60).padStart(2, '0');
                const fresh = min < 15;
                const link = `https://starblast.io/#${sys.id}`;

                if (min === 0 && sectorAlertServers[safeKey] === 'checked') {
                    try {
                        const n = new Notification(`New sector — ${key}`, { body: sys.name, tag: 'sb' });
                        setTimeout(() => n.close(), 4000);
                    } catch (e) { }
                    sectorAlertServers[safeKey] = 'unchecked';
                    const btn = document.getElementById(`alertBtn-${safeKey}`);
                    if (btn) btn.classList.remove('on');
                }

                const cls = `sector-server-row${fresh ? ' fresh' : ''}${!sys.open ? ' closed' : ''}`;
                const safeName = sys.name.replace(/'/g, "\\'");

                html += `
                    <div class="${cls}">
                        <span class="material-icons-round sector-mode-icon">${SECTOR_ICONS[sys.mode] || 'help'}</span>
                        <span class="sector-server-name">${sys.name}</span>
                        <span class="sector-server-time sector-minutes">${min}:${sec}</span>
                        <span class="sector-server-stat"><span class="material-icons-round">person</span>${sys.players}</span>
                        <a class="sector-action-btn" href="${link}" target="_blank" title="Join"><span class="material-icons-round">play_arrow</span></a>
                        <button class="sector-action-btn sector-share-btn" data-link="${link}" data-name="${safeName}" title="Share"><span class="material-icons-round">qr_code_2</span></button>
                    </div>
                `;
            });

            zone.innerHTML = html;
            wrapper.appendChild(zone);

            // Alert button
            zone.querySelector('.sector-zone-alert-btn').addEventListener('click', function () {
                const k = this.dataset.key;
                const id = k.replace(/\s+/g, '');
                if (sectorAlertServers[id] === 'checked') {
                    sectorAlertServers[id] = 'unchecked';
                    this.classList.remove('on');
                } else {
                    if (Notification.permission !== 'granted') Notification.requestPermission();
                    sectorAlertServers[id] = 'checked';
                    this.classList.add('on');
                }
            });

            // Share buttons
            zone.querySelectorAll('.sector-share-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    openSectorShare(btn.dataset.link, btn.dataset.name);
                });
            });
        });

        if (!anyVisible) {
            wrapper.innerHTML = '<div class="sector-status-text">No sectors</div>';
        }
    }

    function updateSectorTimes() {
        document.querySelectorAll('.sector-minutes').forEach(el => {
            const parts = el.textContent.split(':');
            const t = parseInt(parts[0]) * 60 + parseInt(parts[1]) + 1;
            el.textContent = Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0');
        });
    }

    function openSectorShare(link, name) {
        document.getElementById('sector-share-server-name').textContent = name;
        document.getElementById('sector-share-link-input').value = link;

        const qrContainer = document.getElementById('sector-qr-container');
        qrContainer.innerHTML = '';

        // Simple QR code via API
        const img = document.createElement('img');
        img.src = `https://api.qrserver.com/v1/create-qr-code/?size=130x130&bgcolor=0a0a0a&color=ffffff&data=${encodeURIComponent(link)}`;
        img.alt = 'QR';
        img.width = 130;
        img.height = 130;
        qrContainer.appendChild(img);

        sectorShareOverlay.classList.add('visible');
    }

    function closeSectorShare() {
        sectorShareOverlay.classList.remove('visible');
    }

    // ===== SEQUENCER GUI =====
    function createSequencerGUI() {
        if (seqGui) { seqGui.classList.toggle('hide'); return; }

        seqGui = document.createElement('div');
        seqGui.id = 'sbseq';
        seqGui.innerHTML = `
            <div id="seq-head">SEQUENCER
                <div id="seq-btns"><button id="seq-min">−</button><button id="seq-close">×</button></div>
            </div>
            <div id="seq-body">
                <div id="seq-lines"></div>
                <div id="seq-delay">
                    <div id="seq-track"><div id="seq-fill"></div><div id="seq-thumb"></div></div>
                    <span id="seq-val">500ms</span>
                </div>
                <div id="seq-controls"><button id="seq-start">START</button><button id="seq-stop">STOP</button></div>
                <label id="seq-loop">
                    <input type="checkbox" id="seq-loopchk">
                    <div id="seq-switch"><div id="seq-knob"></div></div>
                    <span>Infinite Loop</span>
                </label>
            </div>
        `;
        document.body.appendChild(seqGui);

        ['mousedown', 'click', 'dblclick', 'contextmenu', 'wheel'].forEach(ev =>
            seqGui.addEventListener(ev, e => e.stopPropagation()));

        initSequencer();
    }

    function initSequencer() {
        const gui = seqGui;
        const linesCont = gui.querySelector('#seq-lines');

        const createChar = () => { const i = document.createElement('input'); i.type = 'text'; i.maxLength = 1; i.className = 'seq-char'; i.placeholder = '−'; i.dataset.space = 'false'; return i; };
        const isExplicitSpace = (inp) => inp.dataset.space === 'true';
        const setExplicitSpace = (inp) => { inp.value = ''; inp.dataset.space = 'true'; inp.classList.add('space'); inp.placeholder = ''; };
        const clearChar = (inp) => { inp.value = ''; inp.dataset.space = 'false'; inp.classList.remove('space'); inp.placeholder = '−'; };
        const getCharValue = (inp) => isExplicitSpace(inp) ? ' ' : inp.value;

        function addLine() {
            if (linesCont.children.length >= MAX_LINES) return false;
            const line = document.createElement('div');
            line.className = 'seq-line';
            for (let i = 0; i < 5; i++) line.appendChild(createChar());
            linesCont.appendChild(line);
            line.querySelector('.seq-char').focus();
            save();
            return true;
        }

        function save() {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({
                lines: [...linesCont.children].map(l => [...l.querySelectorAll('.seq-char')].map(i => ({ value: i.value, isSpace: isExplicitSpace(i) }))),
                delay,
                loop: gui.querySelector('#seq-loopchk').checked
            }));
        }

        function load() {
            try {
                const d = JSON.parse(localStorage.getItem(STORAGE_KEY));
                if (!d?.lines?.length) throw 0;
                linesCont.innerHTML = '';
                d.lines.slice(0, MAX_LINES).forEach(row => {
                    const line = document.createElement('div');
                    line.className = 'seq-line';
                    row.slice(0, 5).forEach(cell => {
                        const inp = createChar();
                        if (typeof cell === 'object' && cell.isSpace) setExplicitSpace(inp);
                        else inp.value = ((cell?.value ?? cell) || '').replace(/[^a-zA-Z]/g, '').toUpperCase();
                        line.appendChild(inp);
                    });
                    while (line.children.length < 5) line.appendChild(createChar());
                    linesCont.appendChild(line);
                });
                while (linesCont.children.length < MAX_LINES) addLine();
                delay = d.delay || 500;
                gui.querySelector('#seq-loopchk').checked = !!d.loop;
                updateDelay();
            } catch { linesCont.innerHTML = ''; for (let i = 0; i < MAX_LINES; i++) addLine(); }
        }

        function updateDelay() {
            const pct = ((delay - 100) / 1900) * 100;
            gui.querySelector('#seq-fill').style.width = pct + '%';
            gui.querySelector('#seq-thumb').style.left = pct + '%';
            gui.querySelector('#seq-val').textContent = delay + 'ms';
        }

        const stopSeq = () => { running = false; document.querySelectorAll('.seq-line.active').forEach(l => l.classList.remove('active')); };
        const buildMessage = (line) => { let m = ''; line.querySelectorAll('.seq-char').forEach(c => { const v = getCharValue(c); if (v) m += v; }); return m; };
        const isLineEmpty = (line) => { for (let c of line.querySelectorAll('.seq-char')) if (c.value || isExplicitSpace(c)) return false; return true; };

        async function runSeq() {
            if (!isSocketConnected()) { stopSeq(); return; }
            for (let i = 0; i < linesCont.children.length; i++) {
                if (!running) break;
                const line = linesCont.children[i];
                if (isLineEmpty(line)) continue;
                line.classList.add('active');
                const msg = buildMessage(line);
                if (msg) socket.send(JSON.stringify({ name: 'say', data: msg }));
                await new Promise(r => setTimeout(r, delay));
                line.classList.remove('active');
            }
            if (running && looping) runSeq(); else stopSeq();
        }

        document.addEventListener('keydown', e => {
            if (!e.target.matches('.seq-char')) return;
            e.stopPropagation(); e.stopImmediatePropagation();
            const inp = e.target, line = inp.parentNode, chars = [...line.querySelectorAll('.seq-char')], idx = chars.indexOf(inp), allLines = [...linesCont.children], lineIdx = allLines.indexOf(line);

            if (e.key === ' ') { e.preventDefault(); setExplicitSpace(inp); (inp.nextElementSibling || line.nextElementSibling?.firstElementChild)?.focus(); save(); return; }
            if (e.key === 'Delete') { e.preventDefault(); clearChar(inp); (chars[idx - 1] || chars[idx + 1] || allLines[lineIdx - 1]?.lastElementChild || allLines[lineIdx + 1]?.firstElementChild)?.focus(); save(); return; }
            if (e.key === 'Backspace') { e.preventDefault(); if (inp.value || isExplicitSpace(inp)) clearChar(inp); else if (idx > 0) { chars[idx - 1].focus(); clearChar(chars[idx - 1]); } else allLines[lineIdx - 1]?.lastElementChild?.focus(); save(); return; }
            if (e.key === 'Enter' || e.key === 'Escape') { e.preventDefault(); if (e.key === 'Escape') inp.blur(); return; }
            if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Tab'].includes(e.key)) {
                e.preventDefault();
                if (e.key === 'Tab') (e.shiftKey ? inp.previousElementSibling || allLines[lineIdx - 1]?.lastElementChild : inp.nextElementSibling || line.nextElementSibling?.firstElementChild)?.focus();
                else if (e.key === 'ArrowRight') (idx < chars.length - 1 ? chars[idx + 1] : allLines[lineIdx + 1]?.children[0])?.focus();
                else if (e.key === 'ArrowLeft') (idx > 0 ? chars[idx - 1] : allLines[lineIdx - 1]?.lastElementChild)?.focus();
                else if (e.key === 'ArrowDown' && lineIdx < allLines.length - 1) allLines[lineIdx + 1].children[Math.min(idx, allLines[lineIdx + 1].children.length - 1)]?.focus();
                else if (e.key === 'ArrowUp' && lineIdx > 0) allLines[lineIdx - 1].children[Math.min(idx, allLines[lineIdx - 1].children.length - 1)]?.focus();
                return;
            }
            if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey && !/^[a-zA-Z]$/.test(e.key)) e.preventDefault();
        }, true);

        document.addEventListener('input', e => {
            if (!e.target.matches('.seq-char')) return;
            const inp = e.target;
            inp.dataset.space = 'false'; inp.classList.remove('space'); inp.placeholder = '−';
            inp.value = inp.value.replace(/[^a-zA-Z]/g, '').toUpperCase();
            if (inp.value.length === 1) (inp.nextElementSibling || inp.parentElement.nextElementSibling?.firstElementChild)?.focus();
            save();
        });

        ['keyup', 'keypress'].forEach(ev => document.addEventListener(ev, e => { if (e.target.matches('.seq-char')) { e.stopPropagation(); e.stopImmediatePropagation(); } }, true));

        let sliding = false;
        gui.querySelector('#seq-track').addEventListener('mousedown', e => { sliding = true; moveSlider(e); });
        document.addEventListener('mousemove', e => sliding && moveSlider(e));
        document.addEventListener('mouseup', () => { if (sliding) { sliding = false; save(); } });
        gui.addEventListener('mouseup', () => { if (sliding) { sliding = false; save(); } });
        function moveSlider(e) { const r = gui.querySelector('#seq-track').getBoundingClientRect(); delay = Math.round((100 + Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * 1900) / 50) * 50; updateDelay(); }

        let dragging = false, ox, oy;
        gui.querySelector('#seq-head').addEventListener('mousedown', e => { if (e.target.tagName !== 'BUTTON') { dragging = true; const r = gui.getBoundingClientRect(); ox = e.clientX - r.left; oy = e.clientY - r.top; } });
        document.addEventListener('mousemove', e => { if (dragging) { gui.style.left = (e.clientX - ox) + 'px'; gui.style.top = (e.clientY - oy) + 'px'; } });
        document.addEventListener('mouseup', () => dragging = false);
        gui.addEventListener('mouseup', () => dragging = false);

        gui.querySelector('#seq-start').onclick = () => { if (!running) { running = true; looping = gui.querySelector('#seq-loopchk').checked; runSeq(); } };
        gui.querySelector('#seq-stop').onclick = stopSeq;
        gui.querySelector('#seq-min').onclick = () => { gui.classList.toggle('min'); gui.querySelector('#seq-min').textContent = gui.classList.contains('min') ? '+' : '−'; };
        gui.querySelector('#seq-close').onclick = () => gui.classList.toggle('hide');
        gui.querySelector('#seq-loopchk').addEventListener('change', save);

        updateDelay();
        load();
    }

    function toggleSequencer() { if (!seqGui) createSequencerGUI(); else seqGui.classList.toggle('hide'); }

    // ===== SNIFFER HTML =====
    const SNIFFER_HTML = `<div id="wh"><span class="wht">WEBSOCKET SNIFFER</span><span class="whb"><button data-a="min">−</button><button data-a="close">×</button></span></div>
<div id="wb"><div id="wub"><span class="wul">ENDPOINT</span><span id="wu" class="wu">None</span></div>
<div id="wtb"><div class="wtr1"><input type="text" id="wfi" spellcheck="false" autocomplete="off"/><span class="wdg"><button class="wdir act" data-d="all">ALL</button><button class="wdir" data-d="in">IN</button><button class="wdir" data-d="out">OUT</button></span></div><div class="wtr"><button data-a="autoscroll">SCROLL OFF</button><button data-a="blobs">BINARY</button><button data-a="pause">PAUSE</button><button data-a="clear">CLEAR</button><button data-a="copyall">COPY ALL</button></div></div>
<div id="wc" class="wct">0 total</div><div id="wl"></div>
<div id="ws"><div class="wsh"><span>SEND</span><span class="wsa"><button data-a="fmt">FORMAT</button><button data-a="cmp">COMPACT</button><button data-a="send">SEND</button></span></div><textarea id="wta" rows="5" spellcheck="false"></textarea><div class="wshn">Ctrl+Enter to send • Alt to freeze game UI</div></div></div><div id="wr"></div>`;

    // ===== THEME CSS =====
    const CSS = `

/* ===== NON-SELECTABLE UI ===== */
*, *::before, *::after {
    user-select: none !important;
    -webkit-user-select: none !important;
    -moz-user-select: none !important;
    -ms-user-select: none !important;
}

input, textarea, [contenteditable="true"],
input[type="text"], input[type="password"], input[type="email"], input[type="number"],
.wjson, pre, code, .seq-char, .sector-share-link-input {
    user-select: text !important;
    -webkit-user-select: text !important;
    -moz-user-select: text !important;
    -ms-user-select: text !important;
}

/* ===== GLOBAL SCROLLBARS ===== */
*::-webkit-scrollbar {
    width: 10px !important;
    height: 10px !important;
}
*::-webkit-scrollbar-track {
    background: rgba(0,0,0,.3) !important;
    border-radius: 5px !important;
}
*::-webkit-scrollbar-thumb {
    background: rgba(255,255,255,.15) !important;
    border-radius: 5px !important;
    border: 2px solid transparent !important;
    background-clip: padding-box !important;
}
*::-webkit-scrollbar-thumb:hover {
    background: rgba(255,255,255,.25) !important;
    background-clip: padding-box !important;
}
*::-webkit-scrollbar-corner {
    background: transparent !important;
}
* {
    scrollbar-width: thin !important;
    scrollbar-color: rgba(255,255,255,.15) rgba(0,0,0,.3) !important;
}

/* ===== BASE ===== */
html, body {
    background: #050505 !important;
    font-family: 'Inter', system-ui, -apple-system, sans-serif !important;
}

/* ===== HIDE JUNK ===== */
.adblock, .adsbyvli, [data-ad-slot],
#cgpreroll, #preroll, #home, #home_mobile,
.MFhlx ins, .gplay,
.sbg-facebook, .sbg-twitter, #facebook, #twitter,
.mobile-social, .sbg-diamond,
#_outbd_3, #cdm-zone-01, [id^="cdm-zone-0"],
.sbg-info, .cookieconsent,
[data-translate-base="promocontest"],
.github-fork-ribbon, #cgbottom,
.atcb, .atcb_button_wrapper,
#respawn, #game_over, #respawn_swap,
#adblocked_message,
.stats .fa-facebook, .stats .fa-twitter,
.stats .fa-vk, .stats .fa-envelope,
.textcentered.community.changelog-new,
.modal .modecp,
.mod .totalplayed {
    display: none !important;
}

/* ===== OVERLAY ===== */
#overlay {
    box-shadow: none !important;
    text-shadow: none !important;
    color: #e0e0e0 !important;
}

/* ===== LOADING BAR ===== */
.loadwrapper {
    background: #0a0a0a !important;
    height: 3px !important;
    border-radius: 2px !important;
    overflow: hidden !important;
}
.loadwrapper .progress {
    height: 3px !important;
    background: linear-gradient(90deg, #3a3a3a, #666) !important;
    border-radius: 2px !important;
}

/* ===== INPUT WRAPPER ===== */
.inputwrapper {
    background: #0a0a0a !important;
    border: 1px solid #1a1a1a !important;
    box-shadow: none !important;
    text-shadow: none !important;
    border-radius: 10px !important;
    height: 48px !important;
    margin-top: 14px !important;
}

#player input[type="text"] {
    background: transparent !important;
    border: none !important;
    color: #e0e0e0 !important;
    text-shadow: none !important;
    font-size: 15px !important;
    font-weight: 400 !important;
    letter-spacing: .3px !important;
    font-family: 'Inter', system-ui, -apple-system, sans-serif !important;
    height: 48px !important;
    line-height: 48px !important;
}

/* ===== PLACEHOLDERS ===== */
::placeholder, ::-webkit-input-placeholder, ::-moz-placeholder, :-ms-input-placeholder {
    color: #3a3a3a !important;
    text-shadow: none !important;
    font-family: 'Inter', system-ui, -apple-system, sans-serif !important;
    font-size: 14px !important;
}

/* ===== COLOR PICKER ===== */
.colorchosen {
    border-radius: 8px !important;
    border: 1px solid #2a2a2a !important;
    width: 28px !important;
    height: 28px !important;
    margin-top: 9px !important;
}
#colors span {
    border-radius: 8px !important;
    border: 2px solid transparent !important;
    width: 28px !important;
    height: 28px !important;
    opacity: .65 !important;
    transition: all .2s ease !important;
}
#colors span:hover { opacity: 1 !important; transform: scale(1.08) !important; }
#colors span.selected {
    opacity: 1 !important;
    box-shadow: 0 0 0 2px rgba(255,255,255,.8) !important;
    transform: scale(1.12) !important;
}

/* ===== PLAY BUTTON - DARK THEME ===== */
#player button,
.donate-btn {
    background: #0a0a0a !important;
    border: 1px solid #1a1a1a !important;
    box-shadow: none !important;
    text-shadow: none !important;
    border-radius: 10px !important;
    color: #888 !important;
    font-weight: 500 !important;
    letter-spacing: .5px !important;
    font-family: 'Inter', system-ui, -apple-system, sans-serif !important;
    font-size: 14px !important;
    padding: 14px 48px !important;
    cursor: pointer !important;
    transition: all .2s ease !important;
}
#player button:hover,
.donate-btn:hover {
    background: #111 !important;
    border-color: #2a2a2a !important;
    color: #ccc !important;
}

#player #play {
    background: linear-gradient(135deg, #1a1a1a 0%, #0a0a0a 100%) !important;
    border: 1px solid #2a2a2a !important;
    color: #e0e0e0 !important;
    font-weight: 600 !important;
    padding: 14px 52px 28px !important;
    box-shadow: 0 4px 20px rgba(0,0,0,.5) !important;
}
#player #play:hover {
    background: linear-gradient(135deg, #222 0%, #111 100%) !important;
    border-color: #3a3a3a !important;
    color: #fff !important;
    box-shadow: 0 6px 28px rgba(0,0,0,.6) !important;
}

#play.orange {
    background: linear-gradient(135deg, #b86820 0%, #8a4a10 100%) !important;
    border: 1px solid #c07020 !important;
    color: #fff !important;
    text-shadow: none !important;
    box-shadow: 0 4px 20px rgba(184,104,32,.3) !important;
}
#play.orange:hover {
    background: linear-gradient(135deg, #c87830 0%, #9a5a18 100%) !important;
    box-shadow: 0 6px 28px rgba(184,104,32,.4) !important;
}

#play #game_modes {
    background: rgba(0,0,0,.3) !important;
    font-size: 11px !important;
    letter-spacing: .4px !important;
    color: rgba(255,255,255,.4) !important;
    border-radius: 0 0 10px 10px !important;
    overflow: hidden !important;
    padding: 6px 0 !important;
}
#play.orange #game_modes {
    color: rgba(255,255,255,.5) !important;
    background: rgba(0,0,0,.25) !important;
}

.playbtn i {
    color: #3a3a3a !important;
    text-shadow: none !important;
    transition: color .2s ease !important;
}
.playbtn i:hover {
    color: #888 !important;
}

/* ===== SOCIAL BAR ===== */
.social { background: transparent !important; }
.social i,
.mobile-tools i,
.stats i {
    background: #0a0a0a !important;
    border: 1px solid #1a1a1a !important;
    box-shadow: none !important;
    text-shadow: none !important;
    color: #555 !important;
    border-radius: 10px !important;
    transition: all .2s ease !important;
}
.social i:hover,
.mobile-tools i:hover,
.stats i:hover {
    background: #111 !important;
    border-color: #2a2a2a !important;
    color: #aaa !important;
}

/* ===== FOLLOWTOOLS ===== */
.followtools a,
.followtools a:visited {
    background: #0a0a0a !important;
    border: 1px solid #1a1a1a !important;
    box-shadow: none !important;
    text-shadow: none !important;
    color: #666 !important;
    border-radius: 10px !important;
    padding: 10px !important;
    margin: 4px !important;
    transition: all .2s ease !important;
}
.followtools a:hover {
    background: #111 !important;
    border-color: #2a2a2a !important;
    color: #ccc !important;
}
.followtools a.big { text-shadow: none !important; border-radius: 10px !important; }
.followtools a.big i { text-shadow: none !important; }
.followtools a.big.cup i {
    background-image: none !important;
    -webkit-background-clip: unset !important;
    background-clip: unset !important;
    color: #c9a030 !important;
}
.followtools a.gold,
.followtools a.gold:visited,
#donate_mobile {
    background: #0a0a0a !important;
    border-color: #2a2010 !important;
    text-shadow: none !important;
    color: #c9a030 !important;
    box-shadow: none !important;
}
.followtools a.gold:hover {
    background: #111 !important;
    border-color: #3a3018 !important;
    color: #e0b840 !important;
}
.followtools span { letter-spacing: 0 !important; }

/* ===== MODAL - UNIFIED DARK THEME ===== */
.modal {
    background: #080808 !important;
    border: 1px solid #1a1a1a !important;
    border-radius: 16px !important;
    box-shadow: 0 30px 100px rgba(0,0,0,.95) !important;
    color: #a0a0a0 !important;
    text-shadow: none !important;
    overflow: hidden !important;
    animation: modal-in .2s ease both !important;
}
@keyframes modal-in {
    from { opacity: 0; transform: scale(0.95); }
    to { opacity: 1; transform: scale(1); }
}
.modal .header {
    background: #0a0a0a !important;
    border-bottom: 1px solid #1a1a1a !important;
    padding: 16px 22px !important;
    margin: 0 !important;
    font-size: 12px !important;
    font-weight: 600 !important;
    letter-spacing: 1.5px !important;
    color: #666 !important;
    display: flex !important;
    align-items: center !important;
    justify-content: space-between !important;
    min-height: 22px !important;
    position: sticky !important;
    top: 0 !important;
    z-index: 10 !important;
    border-radius: 16px 16px 0 0 !important;
    cursor: grab !important;
    transition: none !important;
}
.modal .header:active {
    cursor: grabbing !important;
}
.modal .modaltitle { flex: 1 !important; order: 1 !important; }
.modal .close-modal {
    color: #444 !important;
    border-radius: 8px !important;
    transition: all .2s ease !important;
    width: 32px !important;
    height: 32px !important;
    line-height: 32px !important;
    font-size: 20px !important;
    text-align: center !important;
    float: none !important;
    flex-shrink: 0 !important;
    cursor: pointer !important;
    order: 2 !important;
}
.modal .close-modal:hover { background: #151515 !important; color: #aaa !important; }
.modal .modalbody {
    padding: 22px 26px !important;
    font-size: 14px !important;
    color: #888 !important;
    overflow-y: auto !important;
    overflow-x: hidden !important;
    max-height: 70vh !important;
}

/* ===== MOD BROWSER ===== */
.modal .modwrap {
    display: flex !important;
    flex-wrap: wrap !important;
    justify-content: center !important;
    gap: 15px !important;
}
.modal .modwrap h2 {
    width: 100% !important;
    text-align: center !important;
    color: #666 !important;
    font-size: 14px !important;
    margin: 15px 0 10px !important;
    padding-bottom: 10px !important;
    border-bottom: 1px solid #1a1a1a !important;
}
.modal .mod {
    width: calc(33% - 10px) !important;
    min-width: 180px !important;
    border-radius: 10px !important;
    overflow: hidden !important;
    background: #0a0a0a !important;
    border: 1px solid #1a1a1a !important;
    transition: all .2s ease !important;
    cursor: pointer !important;
    position: relative !important;
}
.modal .mod:hover {
    border-color: #333 !important;
    transform: translateY(-3px) !important;
    box-shadow: 0 10px 30px rgba(0,0,0,.5) !important;
}
.modal .mod img {
    width: 100% !important;
    height: 120px !important;
    object-fit: cover !important;
    display: block !important;
}
.modal .mod .title {
    padding: 10px 12px !important;
    font-size: 13px !important;
    color: #ccc !important;
    background: #0a0a0a !important;
    white-space: nowrap !important;
    overflow: hidden !important;
    text-overflow: ellipsis !important;
}

/* ===== SETTINGS OPTIONS ===== */
.modal .modalbody div.option {
    border-bottom: 1px solid #111 !important;
    height: auto !important;
    min-height: 44px !important;
    padding: 10px 0 !important;
    line-height: 24px !important;
    display: flex !important;
    align-items: center !important;
    justify-content: space-between !important;
}

.modal .modalbody select,
.modal .modalbody input[type=text],
.modal .modalbody input.number {
    background: #0a0a0a !important;
    border: 1px solid #1a1a1a !important;
    border-radius: 8px !important;
    color: #bbb !important;
    font-family: 'Inter', system-ui, -apple-system, sans-serif !important;
    font-size: 13px !important;
    padding: 8px 12px !important;
    outline: none !important;
    transition: border-color .2s ease !important;
}
.modal .modalbody select:focus,
.modal .modalbody input[type=text]:focus,
.modal .modalbody input.number:focus { border-color: #3a3a3a !important; }

.modal .modalbody .range {
    background: #0a0a0a !important;
    border: 1px solid #1a1a1a !important;
    border-radius: 8px !important;
    float: right !important;
    height: 32px !important;
    line-height: 32px !important;
}

.modal .modalbody .gmodes span {
    border: 1px solid #1a1a1a !important;
    border-radius: 8px !important;
    color: #555 !important;
    background: #0a0a0a !important;
    transition: all .2s ease !important;
}
.modal .modalbody .gmodes span:hover { background: #111 !important; color: #888 !important; }
.modal .modalbody .gmodes span.selected {
    background: linear-gradient(135deg, #2a2a2a, #1a1a1a) !important;
    border-color: #3a3a3a !important;
    box-shadow: none !important;
    color: #e0e0e0 !important;
}

.modal .modalbody span.region { border-radius: 8px !important; transition: all .2s ease !important; }
.modal .modalbody span.region:hover { background: #111 !important; }
.modal .modalbody span.region.active {
    background: linear-gradient(135deg, #2a2a2a, #1a1a1a) !important;
    border: none !important;
    box-shadow: none !important;
    text-shadow: none !important;
    color: #e0e0e0 !important;
    border-radius: 8px !important;
}

.modal .modalbody .regions {
    background: #060606 !important;
    border-bottom: 1px solid #151515 !important;
    margin: 0 -26px 22px -26px !important;
    padding: 14px 0 !important;
}

.modal .modal-header {
    background: #060606 !important;
    border-bottom: 1px solid #151515 !important;
    margin: -22px -26px 22px -26px !important;
    padding: 18px 26px !important;
    font-size: 13px !important;
    color: #555 !important;
}

.modal .modalbody hr { border-color: #151515 !important; margin: 18px 0 !important; }
.modal .modalbody label { color: #888 !important; }

/* ===== SWITCH / TOGGLE ===== */
.switch { width: 48px !important; height: 26px !important; }
.slider {
    background-color: #1a1a1a !important;
    border-radius: 13px !important;
    transition: background-color .2s ease !important;
}
.slider:before {
    height: 20px !important; width: 20px !important;
    left: 3px !important; bottom: 3px !important;
    background-color: #555 !important;
    border-radius: 50% !important;
    transition: all .2s ease !important;
}
input:checked + .slider { background-color: #3a3a3a !important; }
input:checked + .slider:before { background-color: #e0e0e0 !important; transform: translateX(22px) !important; }
input:focus + .slider { box-shadow: none !important; }

/* ===== RANGE INPUT ===== */
input[type=range] { -webkit-appearance: none !important; background: transparent !important; }
input[type=range]::-webkit-slider-runnable-track {
    height: 6px !important; background: #1a1a1a !important; border-radius: 3px !important;
    border: none !important; box-shadow: none !important;
}
input[type=range]::-webkit-slider-thumb {
    -webkit-appearance: none !important; height: 18px !important; width: 18px !important;
    border-radius: 50% !important; background: #888 !important; border: none !important;
    box-shadow: 0 2px 8px rgba(0,0,0,.5) !important; margin-top: -6px !important; cursor: pointer !important;
    transition: background .2s !important;
}
input[type=range]::-webkit-slider-thumb:hover { background: #aaa !important; }

/* ===== GAME LOADER ===== */
.gameloader { color: #666 !important; }
.gameloaderwrapper {
    background: #0a0a0a !important; border: 1px solid #1a1a1a !important;
    box-shadow: none !important; border-radius: 8px !important;
    height: 10px !important; overflow: hidden !important;
}
.loaderprogress { background: linear-gradient(90deg, #3a3a3a, #555) !important; border-radius: 8px !important; }
.textprogress {
    text-shadow: none !important; color: #444 !important;
    font-weight: 500 !important; font-size: 14px !important; margin-top: 18px !important;
}

/* ===== TUTORIAL ===== */
.tutorial { color: #444 !important; border-radius: 10px !important; }
.desktop { background: rgba(255,255,255,.02) !important; border-radius: 10px !important; margin-top: 32px !important; }
[class^="kb-"] {
    background: #0a0a0a !important; border: 1px solid #1a1a1a !important;
    border-radius: 6px !important; color: #666 !important; box-shadow: none !important;
}
.mouse-container {
    background: #0a0a0a !important; border: 1px solid #1a1a1a !important;
    border-radius: 10px !important; color: #444 !important;
}
.mouse-top { border-bottom-color: #1a1a1a !important; }
.mouse-left { border-right-color: #1a1a1a !important; }

/* ===== CHANGELOG ===== */
.changelog-new, .extrabutton {
    background: #080808 !important; border: 1px solid #151515 !important;
    box-shadow: none !important; border-radius: 10px !important; padding: 12px 16px !important;
}
.changelog-new h2 { border-bottom: 1px solid #151515 !important; color: #555 !important; font-size: 13px !important; }
.changelog-new .fa-star, .extrabutton .fa-star { color: #c9a030 !important; }
a.full-changelog, a.full-changelog:visited {
    color: #444 !important; text-shadow: none !important;
    border-top: 1px solid #151515 !important; background: #060606 !important;
    border-radius: 0 0 10px 10px !important; font-size: 11px !important; transition: color .2s ease !important;
}
a.full-changelog:hover { color: #aaa !important; background: #0a0a0a !important; }

/* ===== MISC ===== */
.schedule {
    background: #080808 !important; border: 1px solid #151515 !important;
    box-shadow: none !important; border-radius: 10px !important;
}
.countdown, .event-time { background: #060606 !important; border-radius: 6px !important; color: #555 !important; }
.alphacentauri h2 { border-bottom-color: #151515 !important; color: #666 !important; }
.alphacentauri button {
    background: linear-gradient(135deg, #8a1a1a, #601010) !important;
    border: none !important; border-radius: 8px !important;
    box-shadow: none !important; font-family: 'Inter', system-ui, sans-serif !important;
    transition: all .2s ease !important;
}
.alphacentauri button:hover { background: linear-gradient(135deg, #a02020, #701818) !important; }
.alphacentauri img { box-shadow: none !important; border-radius: 10px !important; }

.frozenbg, .frozenbg:visited {
    background: #0a0a0a !important; border: 1px solid #1a1a1a !important;
    box-shadow: none !important; text-shadow: none !important; color: #888 !important;
    border-radius: 8px !important; transition: all .2s ease !important;
}
.frozenbg:hover { background: #111 !important; color: #ccc !important; }
.hotbg, .hotbg:visited {
    background: linear-gradient(135deg, #8a1a1a, #601010) !important;
    border: none !important; box-shadow: none !important;
    color: #fff !important; border-radius: 8px !important;
}

.stats input, .ecpinput {
    background: #0a0a0a !important; border: 1px solid #1a1a1a !important; box-shadow: none !important;
    border-radius: 8px !important; color: #bbb !important; text-shadow: none !important;
    font-family: 'Inter', system-ui, -apple-system, sans-serif !important;
}
#customEventable {
    background: #0a0a0a !important; border: 1px solid #1a1a1a !important; box-shadow: none !important;
    text-shadow: none !important; color: #888 !important; border-radius: 8px !important;
    transition: all .2s ease !important;
}
#customEventable:hover { background: #111 !important; color: #ccc !important; }
#licenceKey { background: #0a0a0a !important; border: 1px solid #1a1a1a !important; border-radius: 8px !important; color: #bbb !important; }
#licenceKeyBtn {
    background: linear-gradient(135deg, #2a2a2a, #1a1a1a) !important;
    border: 1px solid #3a3a3a !important;
    border-radius: 8px !important;
    color: #e0e0e0 !important;
    transition: all .2s ease !important;
}
#licenceKeyBtn:hover { background: linear-gradient(135deg, #3a3a3a, #2a2a2a) !important; }

/* ===== LINKS ===== */
a { color: #666 !important; text-decoration: none !important; transition: color .2s !important; }
a:hover { color: #ccc !important; }
a:visited { color: #555 !important; }

/* ===== RANKINGS ===== */
#ranks .rankings tbody tr:nth-child(odd) { background: rgba(255,255,255,.015) !important; }
#ranks .rankings th { color: #444 !important; }
#ranks .rankings th.orating { background: rgba(255,255,255,.015) !important; border: 1px dashed #1a1a1a !important; }
#ranks .rankings td.trophies { background: rgba(255,255,255,.015) !important; border-right: 1px dashed #1a1a1a !important; }

/* ===== BUY ===== */
.pricechoice span {
    background: #0a0a0a !important; border: 1px solid #1a1a1a !important; border-radius: 8px !important;
    color: #555 !important; transition: all .2s ease !important;
}
.pricechoice span:hover { background: #111 !important; color: #888 !important; }
.pricechoice span.active { background: linear-gradient(135deg, #2a2a2a, #1a1a1a) !important; border-color: #3a3a3a !important; box-shadow: none !important; color: #e0e0e0 !important; }
.buy-table tr { border: 1px solid #111 !important; }
.buy-on {
    background: linear-gradient(135deg, #2a2a2a, #1a1a1a) !important;
    border: 1px solid #3a3a3a !important;
    border-radius: 8px !important;
    color: #e0e0e0 !important;
    text-shadow: none !important;
    box-shadow: none !important;
    transition: all .2s ease !important;
}
.buy-on:hover { background: linear-gradient(135deg, #3a3a3a, #2a2a2a) !important; color: #fff !important; }
.download-apps img { border: 1px solid #1a1a1a !important; border-radius: 10px !important; }
.download-apps img:hover { border-color: #3a3a3a !important; }

/* ===== TOOLTIPS ===== */
[data-tooltip]:before {
    background-color: #0a0a0a !important; border: 1px solid #1a1a1a !important; border-radius: 8px !important;
    box-shadow: 0 10px 30px rgba(0,0,0,.8) !important; color: #aaa !important;
    font-family: 'Inter', system-ui, -apple-system, sans-serif !important; font-size: 12px !important;
}
[data-tooltip]:after { border-top-color: #0a0a0a !important; }

.customizeship {
    background: #080808 !important; border: 1px solid #151515 !important;
    border-radius: 10px !important; padding: 14px 18px !important; margin: 14px 0 !important;
}
.customtable i { opacity: .35 !important; transition: opacity .2s !important; }
.customtable i:hover { opacity: 1 !important; }
.sandboxmode {
    background: #060606 !important; border-radius: 10px !important;
    border: 1px solid #151515 !important; padding: 14px 22px 0 22px !important; margin-top: 12px !important;
}

/* ===== IN-GAME NAVBAR ===== */
#sbn {
    position: fixed;
    top: 16px;
    left: 50%;
    transform: translateX(-50%);
    display: none;
    align-items: center;
    gap: 4px;
    background: rgba(8,8,12,.94);
    backdrop-filter: blur(24px);
    -webkit-backdrop-filter: blur(24px);
    border: 1px solid rgba(255,255,255,.08);
    border-radius: 14px;
    padding: 7px 12px;
    z-index: 999999;
    user-select: none;
    font-family: 'Inter', system-ui, -apple-system, sans-serif;
    box-shadow: 0 8px 32px rgba(0,0,0,.6);
}
#sbn button {
    background: transparent;
    border: none;
    color: #555;
    width: 42px;
    height: 42px;
    border-radius: 10px;
    cursor: pointer;
    font-size: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all .2s ease;
    padding: 0;
}
#sbn button:hover {
    background: rgba(255,255,255,.08);
    color: #e0e0e0;
}
#sbn button svg {
    stroke: currentColor;
}
#sbn-quit {
    color: #555 !important;
}
#sbn-quit:hover {
    background: rgba(255,80,80,.12) !important;
    color: #f66 !important;
}
#sbn-freecam.active,
#sbn-sequencer.active,
#sbn-sniffer.active,
#sbn-bots.active {
    background: rgba(100,220,160,.15) !important;
    color: rgba(100,220,160,1) !important;
}
#sbn-settings.active {
    background: rgba(255,180,60,.15) !important;
    color: rgba(255,200,80,1) !important;
}
#sbn-drag {
    width: 20px;
    height: 42px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: grab;
    flex-shrink: 0;
    color: #333;
    margin-right: 4px;
}
#sbn-drag:hover { color: #555; }
#sbn-drag:active { cursor: grabbing; }
#sbn-sep {
    width: 1px;
    height: 26px;
    background: rgba(255,255,255,.08);
    margin: 0 4px;
    flex-shrink: 0;
}

/* ===== SHARE/INFO POPUPS ===== */
#sbn-share-popup,
#sbn-info-popup {
    position: fixed;
    transform: translateX(-50%);
    background: #0a0a0a;
    border: 1px solid #1a1a1a;
    border-radius: 12px;
    padding: 18px;
    z-index: 9999999;
    font-family: 'Inter', system-ui, -apple-system, sans-serif;
    color: #888;
    font-size: 13px;
    min-width: 240px;
    animation: sbn-pop .2s ease both;
    box-shadow: 0 16px 48px rgba(0,0,0,.7);
}
@keyframes sbn-pop {
    from { opacity: 0; transform: translateX(-50%) translateY(-8px); }
    to { opacity: 1; transform: translateX(-50%) translateY(0); }
}
.sbn-popup-title {
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 1.5px;
    color: #444;
    margin-bottom: 14px;
    text-transform: uppercase;
}
.sbn-popup-row {
    display: flex;
    gap: 8px;
    margin-bottom: 14px;
}
.sbn-popup-row input {
    flex: 1;
    background: #080808;
    border: 1px solid #1a1a1a;
    border-radius: 8px;
    color: #bbb;
    font-size: 11px;
    padding: 8px 12px;
    outline: none;
    font-family: 'Inter', system-ui, sans-serif;
    min-width: 0;
}
.sbn-popup-row button {
    background: #111;
    border: 1px solid #1a1a1a;
    border-radius: 8px;
    color: #666;
    width: 36px;
    height: 36px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all .2s ease;
    flex-shrink: 0;
    padding: 0;
}
.sbn-popup-row button:hover { background: #1a1a1a; color: #ccc; }
.sbn-qr {
    display: flex;
    justify-content: center;
    padding: 8px;
    background: #080808;
    border-radius: 10px;
    border: 1px solid #151515;
}
.sbn-qr img { border-radius: 6px; display: block; }
.sbn-info-row {
    display: flex;
    justify-content: space-between;
    padding: 8px 0;
    border-bottom: 1px solid #111;
    font-size: 12px;
}
.sbn-info-row:last-child { border-bottom: none; }
.sbn-info-row span:first-child { color: #444; }
.sbn-info-row span:last-child { color: #aaa; font-weight: 500; }

/* ===== BOTS POPUP STYLES ===== */
#sbn-bots-popup {
    position: fixed;
    top: 100px;
    left: 20px;
    z-index: 999999;
    min-width: 280px;
    width: 280px;
    background: transparent;
    border: none;
    padding: 0;
    box-shadow: none;
}
#sbn-bots-popup #_adsPanel {
    position: relative;
    top: 0;
    left: 0;
    width: 100%;
    background: #080808;
    border: 1px solid #1a1a1a;
    border-radius: 16px;
    box-shadow: 0 30px 100px rgba(0,0,0,.95);
    color: #a0a0a0;
    font-family: 'Inter', system-ui, -apple-system, sans-serif;
    overflow: hidden;
    animation: ads-in .2s ease both;
    user-select: none;
}
#sbn-bots-popup #_adsPanel.minimized .ads-body {
    display: none;
}
#sbn-bots-popup #_adsPanel.minimized .ads-head {
    border-bottom: none;
}
@keyframes ads-in {
    from { opacity: 0; transform: scale(.95); }
    to { opacity: 1; transform: scale(1); }
}
#sbn-bots-popup .ads-head {
    background: #0a0a0a;
    border-bottom: 1px solid #1a1a1a;
    padding: 16px 22px;
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 1.5px;
    color: #666;
    display: flex;
    align-items: center;
    justify-content: space-between;
    min-height: 22px;
    cursor: grab;
    border-radius: 16px 16px 0 0;
}
#sbn-bots-popup .ads-head:active {
    cursor: grabbing;
}
#sbn-bots-popup #_adsPanel.minimized .ads-head {
    border-radius: 16px;
}
#sbn-bots-popup .ads-head-controls {
    display: flex;
    gap: 6px;
}
#sbn-bots-popup .ads-head-controls span {
    color: #444;
    border-radius: 8px;
    transition: all .2s ease;
    width: 32px;
    height: 32px;
    line-height: 32px;
    font-size: 20px;
    text-align: center;
    cursor: pointer;
    display: inline-block;
}
#sbn-bots-popup .ads-head-controls span:hover {
    background: #151515;
    color: #aaa;
}
#sbn-bots-popup .ads-body {
    padding: 22px 26px;
    font-size: 14px;
    color: #888;
}
#sbn-bots-popup .ads-status {
    font-size: 9px;
    font-weight: 600;
    letter-spacing: 1.5px;
    color: #333;
    margin-bottom: 14px;
    text-transform: uppercase;
}
#sbn-bots-popup .ads-body input[type=text] {
    width: 100%;
    background: #0a0a0a;
    border: 1px solid #1a1a1a;
    border-radius: 8px;
    color: #bbb;
    font-family: 'Inter', system-ui, -apple-system, sans-serif;
    font-size: 13px;
    padding: 8px 12px;
    outline: none;
    margin-bottom: 6px;
    box-sizing: border-box;
    transition: border-color .2s ease;
}
#sbn-bots-popup .ads-body input[type=text]:focus {
    border-color: #3a3a3a;
}
#sbn-bots-popup .ads-body input[type=text]::placeholder {
    color: #3a3a3a;
    font-size: 12px;
}
#sbn-bots-popup .ads-team-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 8px;
    margin-bottom: 6px;
}
#sbn-bots-popup .ads-team-row span {
    font-size: 11px;
    color: #555;
    letter-spacing: .5px;
}
#sbn-bots-popup .ads-stepper {
    display: flex;
    align-items: center;
    gap: 0;
    border: 1px solid #1a1a1a;
    border-radius: 8px;
    overflow: hidden;
    background: #0a0a0a;
}
#sbn-bots-popup .ads-stepper-btn {
    width: 30px;
    height: 30px;
    border: none;
    background: transparent;
    color: #555;
    font-size: 15px;
    font-weight: 600;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all .15s ease;
    font-family: 'Inter', system-ui, sans-serif;
    padding: 0;
    line-height: 1;
}
#sbn-bots-popup .ads-stepper-btn:hover {
    background: #151515;
    color: #ccc;
}
#sbn-bots-popup .ads-stepper-btn:active {
    background: #1a1a1a;
}
#sbn-bots-popup .ads-stepper-val {
    width: 28px;
    height: 30px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 13px;
    font-weight: 600;
    color: #bbb;
    border-left: 1px solid #1a1a1a;
    border-right: 1px solid #1a1a1a;
    background: #080808;
    font-family: 'Inter', system-ui, sans-serif;
}
#sbn-bots-popup .ads-btn {
    width: 100%;
    padding: 14px 0;
    margin-top: 5px;
    cursor: pointer;
    border: 1px solid #1a1a1a;
    border-radius: 10px;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: .5px;
    background: #0a0a0a;
    color: #888;
    transition: all .2s ease;
    font-family: 'Inter', system-ui, -apple-system, sans-serif;
}
#sbn-bots-popup .ads-btn:hover:not(:disabled) {
    background: #111;
    border-color: #2a2a2a;
    color: #ccc;
}
#sbn-bots-popup .ads-btn:disabled {
    opacity: .3;
    cursor: not-allowed;
}
#sbn-bots-popup .ads-btn.primary {
    background: linear-gradient(135deg, #1a1a1a, #0a0a0a);
    border: 1px solid #2a2a2a;
    color: #e0e0e0;
    font-weight: 600;
    margin-top: 12px;
    box-shadow: 0 4px 20px rgba(0,0,0,.5);
}
#sbn-bots-popup .ads-btn.primary:hover:not(:disabled) {
    background: linear-gradient(135deg, #222, #111);
    border-color: #3a3a3a;
    color: #fff;
    box-shadow: 0 6px 28px rgba(0,0,0,.6);
}
#sbn-bots-popup .ads-btn.danger:hover:not(:disabled) {
    background: rgba(255,80,80,.06);
    border-color: rgba(255,80,80,.15);
    color: rgba(255,100,100,.7);
}
#sbn-bots-popup .ads-bots {
    margin-top: 12px;
}
#sbn-bots-popup .ads-bots-empty {
    font-size: 9px;
    color: #222;
    text-align: center;
    padding: 6px 0;
    letter-spacing: .5px;
}
#sbn-bots-popup .ads-bot-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 7px 0;
    font-size: 11px;
    border-bottom: 1px solid #111;
}
#sbn-bots-popup .ads-bot-row:last-child {
    border-bottom: none;
}
#sbn-bots-popup .ads-bot-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #1a1a1a;
    flex-shrink: 0;
    transition: all .3s;
}
#sbn-bots-popup .ads-bot-dot.active {
    background: rgba(100,220,160,.6);
    box-shadow: 0 0 8px rgba(100,220,160,.2);
}
#sbn-bots-popup .ads-bot-dot.joining {
    background: rgba(255,200,80,.5);
    box-shadow: 0 0 8px rgba(255,200,80,.15);
}
#sbn-bots-popup .ads-bot-dot.dead {
    background: rgba(255,80,80,.4);
}
#sbn-bots-popup .ads-bot-name {
    color: #666;
    flex: 1;
}
#sbn-bots-popup .ads-bot-state {
    font-size: 8px;
    font-weight: 600;
    letter-spacing: .8px;
    color: #333;
}

/* ===== FREECAM INDICATOR ===== */
#freecam-indicator {
    position: fixed;
    bottom: 40px;
    left: 50%;
    transform: translateX(-50%);
    display: none;
    align-items: center;
    gap: 14px;
    padding: 14px 24px;
    background: rgba(8,8,12,.9);
    backdrop-filter: blur(24px);
    -webkit-backdrop-filter: blur(24px);
    border: 1px solid rgba(255,255,255,.08);
    border-radius: 12px;
    font-family: system-ui, -apple-system, sans-serif;
    color: #fff;
    z-index: 999998;
    box-shadow: 0 16px 48px rgba(0,0,0,.6);
    user-select: none;
    pointer-events: none;
}
#freecam-indicator.active {
    display: flex;
    animation: fc-fadein 0.25s ease;
}
@keyframes fc-fadein {
    from { opacity: 0; transform: translateX(-50%) translateY(10px) scale(0.92); }
    to { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
}
.fc-text {
    font-weight: 600;
    font-size: 11px;
    letter-spacing: 2.5px;
    color: rgba(255,255,255,.5);
}
.fc-key {
    padding: 6px 12px;
    background: rgba(255,255,255,.06);
    border: 1px solid rgba(255,255,255,.1);
    border-radius: 8px;
    font-size: 12px;
    font-weight: 600;
    color: rgba(255,255,255,.7);
}



/* ===== SECTOR SHARE OVERLAY ===== */
#sector-share-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,.6);
    display: none;
    align-items: center;
    justify-content: center;
    z-index: 9999999;
    backdrop-filter: blur(4px);
    -webkit-backdrop-filter: blur(4px);
}

#sector-share-overlay.visible { display: flex; }

.sector-share-popup {
    background: rgba(8,8,12,.96);
    border: 1px solid rgba(255,255,255,.1);
    border-radius: 16px;
    padding: 28px;
    width: 300px;
    max-width: 90vw;
    box-shadow: 0 30px 80px rgba(0,0,0,.7);
    text-align: center;
}

.sector-share-popup h3 {
    font-size: 11px;
    font-weight: 700;
    color: rgba(255,255,255,.4);
    margin-bottom: 4px;
    text-transform: uppercase;
    letter-spacing: 2px;
}

.sector-share-server-name {
    font-size: 12px;
    color: rgba(255,255,255,.5);
    margin-bottom: 20px;
}

.sector-qr-container {
    display: flex;
    justify-content: center;
    margin-bottom: 18px;
    padding: 10px;
    background: rgba(255,255,255,.03);
    border-radius: 12px;
    border: 1px solid rgba(255,255,255,.06);
}

.sector-qr-container img { border-radius: 8px; }

.sector-share-link-row {
    display: flex;
    gap: 6px;
    margin-bottom: 14px;
}

.sector-share-link-input {
    flex: 1;
    padding: 10px 12px;
    border: 1px solid rgba(255,255,255,.08);
    border-radius: 8px;
    font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace;
    font-size: 10px;
    color: rgba(255,255,255,.6);
    outline: none;
    background: rgba(0,0,0,.3);
}

.sector-copy-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0 14px;
    border: 1px solid rgba(255,255,255,.1);
    border-radius: 8px;
    background: rgba(255,255,255,.04);
    cursor: pointer;
    color: rgba(255,255,255,.5);
    transition: all .15s;
    font-family: inherit;
    font-size: 11px;
    font-weight: 600;
    gap: 5px;
}

.sector-copy-btn:hover { background: rgba(255,255,255,.1); color: #fff; }
.sector-copy-btn .material-icons-round { font-size: 14px; }

.sector-share-close-btn {
    background: none;
    border: 1px solid rgba(255,255,255,.1);
    border-radius: 8px;
    padding: 9px 24px;
    font-family: inherit;
    font-size: 11px;
    font-weight: 600;
    color: rgba(255,255,255,.4);
    cursor: pointer;
    transition: all .15s;
}

.sector-share-close-btn:hover { background: rgba(255,255,255,.06); color: rgba(255,255,255,.7); }

.sector-copied-toast {
    position: fixed;
    bottom: 30px;
    left: 50%;
    transform: translateX(-50%) translateY(20px);
    background: rgba(100,220,160,.9);
    color: #000;
    padding: 10px 20px;
    border-radius: 8px;
    font-size: 12px;
    font-weight: 600;
    opacity: 0;
    transition: all .25s;
    pointer-events: none;
    z-index: 99999999;
}

.sector-copied-toast.show {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
}

/* ===== SEQUENCER ===== */
#sbseq {
    position: fixed;
    top: 80px;
    left: 60px;
    width: 380px;
    background: rgba(8,8,12,.94);
    backdrop-filter: blur(32px);
    -webkit-backdrop-filter: blur(32px);
    border: 1px solid rgba(255,255,255,.08);
    border-radius: 16px;
    font-family: system-ui, sans-serif;
    color: #e0e0e0;
    box-shadow: 0 24px 64px rgba(0,0,0,.7);
    z-index: 999999;
    user-select: none;
    overflow: hidden;
}
#sbseq.min #seq-body { display: none; }
#sbseq.hide { opacity: 0; pointer-events: none; transform: scale(0.92); transition: all .25s; }
#seq-head {
    padding: 16px 20px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid rgba(255,255,255,.06);
    cursor: grab;
    font-size: 11px;
    letter-spacing: 2.5px;
    color: rgba(255,255,255,.4);
    font-weight: 600;
}
#seq-head:active { cursor: grabbing; }
#seq-btns button {
    background: none;
    border: none;
    color: rgba(255,255,255,.4);
    font-size: 20px;
    width: 32px;
    height: 32px;
    border-radius: 8px;
    cursor: pointer;
    transition: all .2s;
}
#seq-btns button:hover { background: rgba(255,255,255,.1); color: #fff; }
#seq-body { padding: 20px 22px; display: flex; flex-direction: column; gap: 18px; }
#seq-lines { display: flex; flex-direction: column; gap: 12px; max-height: 350px; overflow-y: auto; }
.seq-line { display: flex; gap: 10px; justify-content: center; }
.seq-char {
    width: 52px;
    height: 52px;
    border: 1px solid rgba(255,255,255,.1);
    border-radius: 10px;
    background: rgba(0,0,0,.4);
    color: #e0e0e0;
    text-align: center;
    font-size: 20px;
    font-weight: 600;
    outline: none;
    transition: all .2s;
    text-transform: uppercase;
    caret-color: transparent;
}
.seq-char::placeholder { color: rgba(255,255,255,.15); }
.seq-char:focus {
    border-color: rgba(100,220,160,.6);
    background: rgba(0,0,0,.5);
    box-shadow: 0 0 0 4px rgba(100,220,160,.15);
}
.seq-char.space {
    background: rgba(100,220,160,.2) !important;
    border-color: rgba(100,220,160,.5) !important;
}
.seq-line.active .seq-char {
    border-color: rgba(100,220,160,.9);
    box-shadow: 0 0 0 4px rgba(100,220,160,.2);
}
#seq-delay {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 14px 18px;
    background: rgba(255,255,255,.02);
    border-radius: 12px;
    border: 1px solid rgba(255,255,255,.04);
}
#seq-track {
    flex: 1;
    height: 8px;
    background: rgba(255,255,255,.08);
    border-radius: 4px;
    position: relative;
    cursor: pointer;
}
#seq-fill {
    height: 100%;
    width: 26%;
    background: linear-gradient(90deg, rgba(100,220,160,.5), rgba(100,220,160,1));
    border-radius: 4px;
}
#seq-thumb {
    position: absolute;
    top: 50%;
    left: 26%;
    width: 18px;
    height: 18px;
    background: #e0e0e0;
    border-radius: 50%;
    transform: translate(-50%, -50%);
    box-shadow: 0 3px 12px rgba(0,0,0,.5);
}
#seq-val {
    font-size: 12px;
    color: rgba(255,255,255,.5);
    min-width: 56px;
    text-align: right;
    font-variant-numeric: tabular-nums;
}
#seq-controls { display: flex; gap: 12px; }
#seq-controls button {
    flex: 1;
    padding: 16px 0;
    border: none;
    border-radius: 12px;
    font-weight: 600;
    letter-spacing: .6px;
    cursor: pointer;
    transition: all .25s;
    font-size: 12px;
}
#seq-start {
    background: linear-gradient(135deg, rgba(80,200,140,.9), rgba(60,170,110,.9));
    color: #fff;
}
#seq-start:hover { background: linear-gradient(135deg, rgba(90,210,150,1), rgba(70,180,120,1)); }
#seq-stop {
    background: rgba(255,255,255,.05);
    color: rgba(255,255,255,.6);
    border: 1px solid rgba(255,255,255,.1);
}
#seq-stop:hover { background: rgba(255,255,255,.1); color: #fff; }
#seq-loop {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 16px;
    padding: 14px 28px;
    background: rgba(255,255,255,.02);
    border: 1px solid rgba(255,255,255,.05);
    border-radius: 30px;
    cursor: pointer;
    font-size: 12px;
    color: rgba(255,255,255,.5);
}
#seq-loop input { display: none; }
#seq-switch {
    width: 52px;
    height: 28px;
    background: rgba(255,255,255,.1);
    border-radius: 14px;
    position: relative;
}
#seq-knob {
    position: absolute;
    top: 3px;
    left: 3px;
    width: 22px;
    height: 22px;
    background: #e0e0e0;
    border-radius: 50%;
    transition: .3s cubic-bezier(.4,0,.2,1);
    box-shadow: 0 3px 10px rgba(0,0,0,.3);
}
#seq-loopchk:checked ~ #seq-switch { background: rgba(100,220,160,.5); }
#seq-loopchk:checked ~ #seq-switch #seq-knob { left: 27px; }

/* ===== WEBSOCKET SNIFFER ===== */
#wss {
    position: fixed;
    top: 80px;
    right: 50px;
    width: 600px;
    height: 720px;
    display: none;
    flex-direction: column;
    background: rgba(8,8,12,.94);
    backdrop-filter: blur(32px);
    -webkit-backdrop-filter: blur(32px);
    border: 1px solid rgba(255,255,255,.08);
    border-radius: 16px;
    font-family: system-ui, -apple-system, sans-serif;
    color: #e0e0e0;
    box-shadow: 0 30px 80px rgba(0,0,0,.7);
    z-index: 999999;
    overflow: hidden;
    user-select: none;
}
#wss input, #wss textarea, #wss .wjson { user-select: text; -webkit-user-select: text; }
#wss.wmin #wb, #wss.wmin #wr { display: none; }
#wss.wmin { height: auto !important; }
#wh {
    padding: 14px 20px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid rgba(255,255,255,.06);
    cursor: grab;
    flex-shrink: 0;
}
#wh:active { cursor: grabbing; }
.wht {
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 2.5px;
    color: rgba(255,255,255,.4);
}
.whb { display: flex; gap: 6px; }
.whb button {
    background: none;
    border: none;
    color: rgba(255,255,255,.4);
    font-size: 20px;
    width: 32px;
    height: 32px;
    border-radius: 8px;
    cursor: pointer;
    transition: all .2s;
}
.whb button:hover { background: rgba(255,255,255,.1); color: #fff; }
#wb { flex: 1; display: flex; flex-direction: column; overflow: hidden; min-height: 0; }
#wub {
    padding: 12px 20px;
    display: flex;
    align-items: center;
    gap: 12px;
    border-bottom: 1px solid rgba(255,255,255,.04);
    flex-shrink: 0;
    background: rgba(255,255,255,.015);
}
.wul {
    font-size: 9px;
    font-weight: 600;
    letter-spacing: 1.5px;
    color: rgba(255,255,255,.25);
}
.wu { font-size: 11px; color: rgba(100,220,160,.8); word-break: break-all; }
.wuo { color: rgba(255,100,100,.7); }
#wtb {
    padding: 12px 18px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    border-bottom: 1px solid rgba(255,255,255,.04);
    flex-shrink: 0;
}
.wtr1 { display: flex; align-items: center; gap: 10px; }
#wfi {
    flex: 1;
    min-width: 80px;
    background: rgba(255,255,255,.04);
    border: 1px solid rgba(255,255,255,.08);
    border-radius: 8px;
    padding: 9px 14px;
    color: #e0e0e0;
    font-size: 12px;
    font-family: system-ui, -apple-system, sans-serif;
    outline: none;
    transition: border-color .2s;
}
#wfi:focus { border-color: rgba(100,220,160,.4); background: rgba(255,255,255,.06); }
#wfi::placeholder { color: rgba(255,255,255,.2); }
.wdg {
    display: flex;
    border-radius: 8px;
    overflow: hidden;
    border: 1px solid rgba(255,255,255,.08);
    flex-shrink: 0;
}
.wdir {
    background: rgba(255,255,255,.03);
    border: none;
    color: rgba(255,255,255,.35);
    font-size: 9px;
    font-weight: 600;
    letter-spacing: 1px;
    padding: 7px 12px;
    cursor: pointer;
    transition: all .2s;
}
.wdir + .wdir { border-left: 1px solid rgba(255,255,255,.06); }
.wdir.act { background: rgba(100,220,160,.15); color: rgba(100,220,160,1); }
.wdir:hover { background: rgba(255,255,255,.08); color: rgba(255,255,255,.6); }
.wtr { display: flex; gap: 8px; flex-wrap: wrap; }
.wtr button {
    background: rgba(255,255,255,.04);
    border: 1px solid rgba(255,255,255,.08);
    border-radius: 8px;
    color: rgba(255,255,255,.45);
    font-size: 9px;
    font-weight: 600;
    letter-spacing: .8px;
    padding: 7px 12px;
    cursor: pointer;
    transition: all .2s;
    white-space: nowrap;
}
.wtr button:hover { background: rgba(255,255,255,.1); color: #fff; }
.wtr button.wfl { background: rgba(100,220,160,.2); color: rgba(100,220,160,1); border-color: rgba(100,220,160,.3); }
.wtr button.wpon { background: rgba(255,180,60,.15); color: rgba(255,200,80,1); border-color: rgba(255,200,80,.3); }
.wtr button.wton { background: rgba(100,220,160,.15); color: rgba(100,220,160,1); border-color: rgba(100,220,160,.25); }
.wct {
    padding: 6px 20px 8px;
    font-size: 9px;
    color: rgba(255,255,255,.18);
    letter-spacing: .6px;
    flex-shrink: 0;
}
#wl { flex: 1; overflow-y: auto; overflow-x: hidden; min-height: 0; padding: 0 4px; }
.wr { border-bottom: 1px solid rgba(255,255,255,.02); transition: background .15s; }
.wr:hover { background: rgba(255,255,255,.03); }
.wr.wex { background: rgba(255,255,255,.025); }
.wr .wh {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 7px 16px;
    cursor: pointer;
    min-height: 32px;
}
.wt { font-size: 10px; color: rgba(255,255,255,.18); flex-shrink: 0; min-width: 80px; }
.wb {
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 1px;
    padding: 3px 8px;
    border-radius: 5px;
    flex-shrink: 0;
}
.wb-in { background: rgba(80,160,255,.12); color: rgba(120,180,255,.9); border: 1px solid rgba(80,160,255,.2); }
.wb-out { background: rgba(255,180,60,.12); color: rgba(255,200,100,.9); border: 1px solid rgba(255,180,60,.2); }
.wb-sys { background: rgba(160,100,255,.12); color: rgba(180,140,255,.9); border: 1px solid rgba(160,100,255,.2); }
.wpv {
    flex: 1;
    font-size: 11px;
    color: rgba(255,255,255,.45);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    min-width: 0;
}
.wa { display: flex; gap: 6px; flex-shrink: 0; opacity: 0; transition: opacity .15s; }
.wr:hover .wa { opacity: 1; }
.wa button {
    background: rgba(255,255,255,.05);
    border: 1px solid rgba(255,255,255,.1);
    border-radius: 6px;
    color: rgba(255,255,255,.45);
    font-size: 9px;
    font-weight: 600;
    letter-spacing: .5px;
    padding: 4px 10px;
    cursor: pointer;
    transition: all .15s;
}
.wa button:hover { background: rgba(255,255,255,.12); color: #fff; }
.wa button.wfl { background: rgba(100,220,160,.2); color: rgba(100,220,160,1); }
.wdet { padding: 0 16px 10px 108px; }
.wjson {
    font-size: 11px;
    line-height: 1.5;
    color: rgba(200,220,240,.75);
    background: rgba(0,0,0,.35);
    border: 1px solid rgba(255,255,255,.05);
    border-radius: 10px;
    padding: 12px 16px;
    margin: 0;
    white-space: pre-wrap;
    word-break: break-all;
    max-height: 280px;
    overflow-y: auto;
    font-family: "SF Mono", "Cascadia Code", "Fira Code", Consolas, monospace;
}
#ws {
    border-top: 1px solid rgba(255,255,255,.06);
    padding: 14px 18px 16px;
    flex-shrink: 0;
    background: rgba(255,255,255,.015);
}
.wsh { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
.wsh > span:first-child {
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 2px;
    color: rgba(255,255,255,.25);
}
.wsa { display: flex; gap: 6px; }
.wsa button {
    background: rgba(255,255,255,.04);
    border: 1px solid rgba(255,255,255,.08);
    border-radius: 8px;
    color: rgba(255,255,255,.45);
    font-size: 9px;
    font-weight: 600;
    letter-spacing: .6px;
    padding: 8px 14px;
    cursor: pointer;
    transition: all .2s;
}
.wsa button:hover { background: rgba(255,255,255,.1); color: #fff; }
[data-a="send"] {
    background: linear-gradient(135deg, rgba(100,220,160,.2), rgba(60,180,120,.3)) !important;
    border-color: rgba(100,220,160,.25) !important;
    color: rgba(100,220,160,1) !important;
}
[data-a="send"]:hover {
    background: linear-gradient(135deg, rgba(100,220,160,.3), rgba(60,180,120,.4)) !important;
    color: #fff !important;
}
[data-a="send"].wfl { background: rgba(100,220,160,.35) !important; color: #fff !important; }
#wta {
    width: 100%;
    min-height: 90px;
    max-height: 180px;
    background: rgba(0,0,0,.35);
    border: 1px solid rgba(255,255,255,.07);
    border-radius: 10px;
    padding: 12px 16px;
    color: #ddd;
    font-size: 12px;
    font-family: system-ui, -apple-system, sans-serif;
    resize: none;
    outline: none;
    transition: border-color .2s;
    line-height: 1.5;
    box-sizing: border-box;
}
#wta:focus { border-color: rgba(100,220,160,.35); background: rgba(0,0,0,.45); }
#wta::placeholder { color: rgba(255,255,255,.15); }
.wshn {
    font-size: 9px;
    color: rgba(255,255,255,.15);
    text-align: center;
    margin-top: 8px;
}
#wr {
    position: absolute;
    bottom: 0;
    right: 0;
    width: 24px;
    height: 24px;
    cursor: nwse-resize;
    z-index: 10;
    opacity: .2;
    transition: opacity .2s;
}
#wr:hover { opacity: .5; }
#wr::before, #wr::after {
    content: '';
    position: absolute;
    border-radius: 50%;
    background: rgba(255,255,255,.5);
}
#wr::before { bottom: 6px; right: 6px; width: 3px; height: 3px; }
#wr::after { bottom: 6px; right: 12px; width: 2px; height: 2px; box-shadow: 6px -6px 0 0 rgba(255,255,255,.5); }
#wss-overlay {
    display: none;
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 999998;
    background: rgba(0,0,0,.15);
    backdrop-filter: blur(2px);
    -webkit-backdrop-filter: blur(2px);
    cursor: default;
}
    `;

    // ===== BRAND HTML =====
    const BRAND_HTML = `<a id="ssbagpcm-brand-link" href="${GITHUB_URL}" style="display:block; width:100%; text-align:center; text-decoration:none; cursor:pointer; color:#e0e0e0;">
        <div style="font-weight:900; letter-spacing:0.10em; text-transform:uppercase; font-size: clamp(60px, 6.2vw, 140px); line-height:1; text-shadow: 0 2px 0 rgba(255,255,255,0.08), 0 22px 36px rgba(0,0,0,0.92);">SSBAGPCM</div>
        <div style="margin-top: 8px; font-weight:700; letter-spacing:0.22em; text-transform:uppercase; font-size: clamp(16px, 1.8vw, 30px); opacity:0.6;">Client</div>
    </a>`;

    // ===== LOGO PATCHER =====
    let logoObserver = null;

    function patchLogo() {
        const logo = document.getElementById('logo');
        if (!logo) return false;
        if (logo.dataset.patched === 'true' && logo.querySelector('#ssbagpcm-brand-link')) return true;

        logo.innerHTML = BRAND_HTML;
        logo.dataset.patched = 'true';
        logo.style.visibility = 'visible';
        logo.style.opacity = '1';

        const link = logo.querySelector('#ssbagpcm-brand-link');
        if (link && !link.dataset.bound) {
            link.dataset.bound = 'true';
            link.addEventListener('click', (e) => {
                e.preventDefault();
                showThanksScreen();
                setTimeout(() => { window.location.href = GITHUB_URL; }, 100);
            });
        }
        return true;
    }

    function setupLogoObserver() {
        if (logoObserver) logoObserver.disconnect();
        logoObserver = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                if (mutation.target.id === 'logo' || mutation.target.closest?.('#logo') ||
                    [...(mutation.addedNodes || [])].some(n => n.id === 'logo' || n.querySelector?.('#logo'))) {
                    const logo = document.getElementById('logo');
                    if (logo && !logo.querySelector('#ssbagpcm-brand-link')) patchLogo();
                }
            }
        });
        logoObserver.observe(document.documentElement, { childList: true, subtree: true });
    }

    // ===== UI PATCHER =====
    function patchUI() {
        patchLogo();

        // On CACHE les éléments au lieu de les détruire (.remove()),
        // sinon le jeu crashe quand il essaie de les nettoyer au lancement de la partie !
        ['training', 'facebook', 'twitter'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.display = 'none';
        });

        document.querySelectorAll('.social .sbg-training, .social .sbg-facebook, .social .sbg-twitter, .textcentered.community.changelog-new').forEach(el => {
            el.style.display = 'none';
        });

        document.querySelectorAll('.modal .modecp, .mod .totalplayed').forEach(el => {
            el.style.display = 'none';
        });
    }

    // ===== SCREENS =====
    function showThanksScreen() {
        try {
            document.title = BRAND;
            document.body.innerHTML = `<div style="height:100vh;display:flex;align-items:center;justify-content:center;background:#050505;color:#e0e0e0;font-family:Arial,sans-serif;text-align:center;padding:24px"><div><div style="font-weight:900;letter-spacing:.1em;text-transform:uppercase;font-size:clamp(80px,8vw,200px);line-height:1;text-shadow:0 20px 40px rgba(0,0,0,.9)">Thanks for using</div><div style="margin-top:18px;font-weight:700;letter-spacing:.22em;text-transform:uppercase;font-size:clamp(20px,2vw,40px);opacity:.6">${BRAND}</div><div style="width:72px;height:72px;border-radius:999px;margin:34px auto 0;border:4px solid rgba(255,255,255,.12);border-top-color:#888;animation:spin .95s linear infinite"></div></div></div><style>@keyframes spin{to{transform:rotate(360deg)}}</style>`;
        } catch (_) { }
    }

    function showLoadingScreen() {
        try {
            document.open();
            document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="ssbagpcm-loaded" content="true"><title>${BRAND}</title><style>*{box-sizing:border-box}html,body{height:100%;margin:0;background:#050505;display:flex;align-items:center;justify-content:center;font-family:Arial,sans-serif;overflow:hidden}.wrap{text-align:center;padding:24px;width:min(1200px,94vw)}.main{color:#e0e0e0;font-weight:900;letter-spacing:.1em;text-transform:uppercase;font-size:clamp(90px,9vw,210px);line-height:1;text-shadow:0 2px 0 rgba(255,255,255,.08),0 20px 40px rgba(0,0,0,.9)}.sub{margin-top:18px;color:#e0e0e0;font-weight:700;letter-spacing:.22em;text-transform:uppercase;font-size:clamp(22px,2.2vw,42px);opacity:.6}.spinner{width:clamp(72px,5vw,110px);height:clamp(72px,5vw,110px);border-radius:999px;margin:40px auto 0;border:4px solid rgba(255,255,255,.12);border-top-color:#888;animation:spin .95s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}</style></head><body><div class="wrap"><div class="main">SSBAGPCM CLIENT</div><div class="sub">Loading...</div><div class="spinner"></div></div></body></html>`);
            document.close();
        } catch (_) { }
    }

    // ===== HELPERS =====
    function isInGame() {
        try {
            return window.module?.exports?.settings && Object.values(window.module.exports.settings).find(e => e?.mode)?.mode?.id !== 'welcome';
        } catch (_) { return false; }
    }

    // ===== INTERVALS =====
    let patchInterval = null, gemInterval = null, emoteInterval = null;

    function cleanupIntervals() {
        [patchInterval, gemInterval, emoteInterval].forEach(i => i && clearInterval(i));
        patchInterval = gemInterval = emoteInterval = null;
    }

    function installGemPatch() {
        if (gemInterval) clearInterval(gemInterval);
        gemInterval = setInterval(() => {
            for (const k in window) {
                try {
                    if (window[k]?.prototype?.createModel && Function.prototype.toString.call(window[k].prototype.createModel).includes('Crystal')) {
                        clearInterval(gemInterval); gemInterval = null;
                        const old = window[k].prototype.getModelInstance;
                        window[k].prototype.getModelInstance = function () {
                            const r = old.apply(this, arguments);
                            try { this.material.color?.set(window.ClientStorage.gem1()); this.material.specular?.set(window.ClientStorage.gem2()); } catch (_) { }
                            return r;
                        };
                        return;
                    }
                } catch (_) { }
            }
        }, 100);
    }

    function installTabIndicator() {
        const orig = document.title || 'Starblast.io';
        const update = () => { document.title = document.hidden ? (isInGame() ? '🔴 In game' : '🟢 Menu') : orig; };
        document.addEventListener('visibilitychange', update);
        window.addEventListener('focus', () => { document.title = orig; });
    }

    function installDraggableWeaponStore() {
        let wsRef = null;
        let dragging = false;
        let startMx = 0, startMy = 0;
        let startX = 0, startY = 0;

        const waitForWS = setInterval(() => {
            if (!window.WeaponStore?.prototype?.O0010) return;
            clearInterval(waitForWS);

            const origShow = window.WeaponStore.prototype.O0010;
            window.WeaponStore.prototype.O0010 = function () {
                wsRef = this;
                return origShow.apply(this, arguments);
            };
            setupDragListeners();
        }, 150);

        function getCanvas() { return document.querySelector('#canvaswrapper canvas'); }
        function normMouse(e) {
            const c = getCanvas();
            if (!c) return null;
            const r = c.getBoundingClientRect();
            return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
        }

        function setupDragListeners() {
            document.addEventListener('mousedown', (e) => {
                if (!wsRef || !wsRef.shown || !wsRef.visible) return;
                const m = normMouse(e);
                if (!m) return;
                const pos = wsRef.llIIl || wsRef.OI0I1;
                if (!pos) return;
                const [px, py, pw, ph] = pos;
                if (m.x >= px && m.x <= px + pw && m.y >= py && m.y <= py + ph * 0.15) {
                    dragging = true;
                    startMx = m.x;
                    startMy = m.y;
                    startX = px;
                    startY = py;
                    e.stopImmediatePropagation();
                    e.preventDefault();
                }
            }, true);

            document.addEventListener('mousemove', (e) => {
                if (!dragging || !wsRef) return;
                const m = normMouse(e);
                if (!m) return;
                let newX = startX + (m.x - startMx);
                let newY = startY + (m.y - startMy);
                if (wsRef.llIIl) { wsRef.llIIl[0] = newX; wsRef.llIIl[1] = newY; }
                if (wsRef.OI0I1) { wsRef.OI0I1[0] = newX; wsRef.OI0I1[1] = newY; }
            }, true);

            document.addEventListener('mouseup', (e) => {
                if (dragging) {
                    dragging = false;
                    e.stopImmediatePropagation();
                    e.preventDefault();
                }
            }, true);
        }
    }

    // ===== INJECT CSS & FONT =====
    function injectCSS() {
        if (document.getElementById('ssbagpcm-theme')) return;
        const s = document.createElement('style');
        s.id = 'ssbagpcm-theme';
        s.textContent = CSS;
        (document.head || document.documentElement).appendChild(s);
    }

    function loadFont() {
        if (document.getElementById('ssbagpcm-font')) return;
        const link = document.createElement('link');
        link.id = 'ssbagpcm-font';
        link.rel = 'stylesheet';
        link.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap';
        (document.head || document.documentElement).appendChild(link);
    }

    // ===== MAIN LOADER =====
    async function ClientLoader() {
        if (document.querySelector('[name="ssbagpcm-loaded"]')) {
            console.log('[SSBAGPCM] Already loaded');
            setupPostLoad();
            return;
        }

        showLoadingScreen();

        try {
            const res = await fetch('https://starblast.io/', { cache: 'no-store' });
            let src = await res.text();

            src = src.replace('<head>', '<head><meta name="ssbagpcm-loaded" content="true">');
            src = src.replace('<head>', `<head><style id="ssbagpcm-early">#logo>img,#logo>canvas,#logo>svg{display:none!important}#logo:not([data-patched]){visibility:hidden!important}#logo[data-patched]{visibility:visible!important;opacity:1!important}#training,#facebook,#twitter,.social .sbg-training,.social .sbg-facebook,.social .sbg-twitter,.textcentered.community.changelog-new,.modal .modecp,.mod .totalplayed{display:none!important}</style>`);

            src = src.replace(/\.toUpperCase\(\)/g, '');
            src = src.replace(/text-transform:\s*uppercase;/gim, '');
            src = src.replace('https://starblast.io/modsinfo.json', 'https://raw.githubusercontent.com/ssbagpcm/ssbagpcm-client/main/mods.js');
            src = src.replace(/html5\.api\.gamedistribution\.com\/libs\/gd\/api\.js|sdk\.crazygames\.com\/crazygames-sdk-v1\.js|api\.adinplay\.com\/libs\/aiptag\/pub\/NRN\/starblast\.io\/tag\.min\.js/g, 'ads.blocked');
            src = src.replace(/<script[^>]*atcb\.min\.js[^>]*><\/script>/gi, '');

            src = src.replace(/e\.fillText\(t\("KEEP CLEAR"\),/g, 'e.fillText("ssbagpcm",');
            src = src.replace(
                'e.fillRect(.25 * this.canvas.width, this.canvas.height / 6, .5 * this.canvas.width, 4), e.font = "20pt FontAwesome"',
                'e.fillRect(.25 * this.canvas.width, this.canvas.height / 6, .5 * this.canvas.width, 4), e.fillText("ssbagpcm", this.canvas.width / 2, .875 * this.canvas.height), e.font = "20pt FontAwesome"'
            );

            try {
                const reegtest = src.match(/if\("select"!==(\w+\.)type\)e\+='<div\s*class="option">'\+t\(\w+\.name\)\+'<label\s*class="switch"><input\s*type="checkbox"\s*'\+\(\w+\.value\?'checked="checked"':""\)\+'\s*id="'\+(\w+)\+'""><div\s*class="slider"><\/div><\/label><\/div>';/);
                if (reegtest) src = src.replace(reegtest[0], `if ("select" !== ${reegtest[1]}type) if ("color" === ${reegtest[1]}type) { e += '<div class="option">' + t(${reegtest[1]}name) + '<div class="range" style="cursor:pointer;"><input id="' + ${reegtest[2]} + '" type="color" style="width:140px;height:32px;border:0;background:transparent;cursor:pointer;"><span id="' + ${reegtest[2]} + '_value" style="margin-left:10px;">' + ${reegtest[1]}value + '</span></div></div>'; } else { e+='<div class="option">'+t(${reegtest[1]}name)+'<label class="switch"><input type="checkbox" '+(${reegtest[1]}value?'checked="checked"':"")+' id="'+ ${reegtest[2]} +'""><div class="slider"></div></label></div>'}`);

                const settingsregex = src.match(/music:\{[^{}]*\},/);
                if (settingsregex) {
                    const smatch = settingsregex[0].match(/[iI10OlL]{4,6}/g);
                    const kStep = (smatch?.[0]) || 'step';
                    src = src.replace(settingsregex[0], `${settingsregex[0]}emopacity:{name:"Emote Capacity",value:5,skipauto:!0,type:"range",min:1,max:5,${kStep}:1,filter:"default,app,mobile"},gemindeed:{name:"Gem Color 1",value:ClientStorage.gem1(),skipauto:!0,type:"color",filter:"default,app,mobile"},gemindeed1:{name:"Gem Color 2",value:ClientStorage.gem2(),skipauto:!0,type:"color",filter:"default,app,mobile"},`);
                }

                const beepMatch = src.match(/e\.[iI10OlL]{4,6}\.[iI10OlL]{4,6}\.beep\(4\+\.2\*math\.random\(\)/gi);
                const bKeys = beepMatch?.[0]?.match(/[iI10OlL]{4,6}/g);
                if (bKeys) {
                    src = src.replace(/for\(f=document\.queryselectorall\("\.option\s*input\[type=range\]"\),\s*i=function\(e\)\{.*?,1\)\}\)\}\}/gis, `for (f = document.querySelectorAll(".option input[type=range], .option input[type=color]"), i = function(e) { return function(i) { if (i.type === "range") { if (i.id === "emopacity") { i.addEventListener("input", function (s) { x = document.querySelector("#" + i.getAttribute("id") + "_value"), x.innerText = parseInt(i.value, 10), e.updateSettings(s, !0) }); i.dispatchEvent(new Event("input")); } else { i.addEventListener("input", function (s) { x = document.querySelector("#" + i.getAttribute("id") + "_value"), x.innerText = "0" === i.value ? t("Off") : Math.round(50 * i.value) + " %", e.updateSettings(s, !0) }); i.dispatchEvent(new Event("input")); if ("sounds" === i.id) i.addEventListener("change", function (t) { e.${bKeys[0]}.${bKeys[1]}.beep(4 + .2 * Math.random(), 1) }) } } else if (i.type === "color") { const update = function (s) { var x = document.querySelector("#" + i.getAttribute("id") + "_value"); if (x) x.innerText = i.value; return e.updateSettings(s, !0); }; i.addEventListener("input", update); try { if (i.id === "gemindeed") i.value = ClientStorage.gem1(); if (i.id === "gemindeed1") i.value = ClientStorage.gem2(); var x0 = document.querySelector("#" + i.getAttribute("id") + "_value"); if (x0) x0.innerText = i.value; } catch (_){} } } }`);
                }
            } catch (_) { }

            document.open();
            document.write(src);
            document.close();

            setupPostLoad();
        } catch (err) { console.error('[SSBAGPCM] Error:', err); }
    }

    function setupPostLoad() {
        cleanupIntervals();

        injectCSS();
        loadFont();

        patchInterval = setInterval(patchUI, 50);

        const waitForBody = setInterval(() => {
            if (document.body) {
                clearInterval(waitForBody);
                setupLogoObserver();
                patchUI();
                Freecam.init();
                makeModalsDraggable();
                injectCSS();
                loadFont();

                // Initial UI visibility check
                updateUIVisibility();
            }
        }, 10);

        installTabIndicator();
        installGemPatch();
        installDraggableWeaponStore();

        // Keyboard shortcuts
        document.addEventListener('keydown', e => {
            if (e.ctrlKey && e.key.toLowerCase() === 's') { e.preventDefault(); toggleSettings(); }
            if (e.altKey && e.key.toLowerCase() === 'n') { e.preventDefault(); e.stopPropagation(); toggleSequencer(); }
            if (e.ctrlKey && e.altKey && e.key.toLowerCase() === 'p') { e.preventDefault(); toggleSequencer(); }
            if (e.altKey && e.key.toLowerCase() === 'j') { e.preventDefault(); e.stopPropagation(); Sniffer.toggle(); }
        }, true);

        // Emote patch
        emoteInterval = setInterval(() => {
            if (window.ChatPanel?.prototype?.typed) {
                clearInterval(emoteInterval); emoteInterval = null;
                window.ChatPanel.prototype.typed = new Function('return ' + window.ChatPanel.prototype.typed.toString().replace('>=4', '>=ClientStorage.emotes()'))();
            }
        }, 100);

        // Re-inject CSS on document changes
        const origClose = document.close;
        document.close = function () {
            const r = origClose.apply(document, arguments);
            setTimeout(() => { injectCSS(); loadFont(); }, 0);
            const obs = new MutationObserver(() => {
                if (!document.getElementById('ssbagpcm-theme')) { injectCSS(); loadFont(); }
            });
            if (document.documentElement) obs.observe(document.documentElement, { childList: true, subtree: true });
            return r;
        };

        document.addEventListener('DOMContentLoaded', () => { injectCSS(); loadFont(); updateUIVisibility(); });
        window.addEventListener('load', () => { injectCSS(); loadFont(); updateUIVisibility(); });
        window.addEventListener('beforeunload', () => { try { showThanksScreen(); } catch (_) { } });

        // Update navbar button states + UI visibility
        setInterval(() => {
            if (navEl) {
                const fcBtn = navEl.querySelector('#sbn-freecam');
                const seqBtn = navEl.querySelector('#sbn-sequencer');
                const sniffBtn = navEl.querySelector('#sbn-sniffer');
                const settingsBtn = navEl.querySelector('#sbn-settings');

                if (fcBtn) fcBtn.classList.toggle('active', Freecam.isOn());
                if (seqBtn) seqBtn.classList.toggle('active', seqGui && !seqGui.classList.contains('hide'));
                if (sniffBtn) sniffBtn.classList.toggle('active', Sniffer.isShown());
                const botsBtn = navEl.querySelector('#sbn-bots');
                if (botsBtn) botsBtn.classList.toggle('active', !!botsPopup);
                if (settingsBtn) {
                    const modal = document.querySelector('.modal');
                    settingsBtn.classList.toggle('active', modal && modal.style.display !== 'none' && modal.offsetParent !== null);
                }
            }
        }, 200);

        console.log(`[SSBAGPCM] Client v${VERSION} Loaded`);
    }

    // ===== START =====
    if (window.location.pathname === '/') {
        if (!document.querySelector('[name="ssbagpcm-loaded"]')) {
            setTimeout(ClientLoader, 1);
        } else {
            injectCSS();
            loadFont();
            document.readyState === 'complete' ? setupPostLoad() : window.addEventListener('load', setupPostLoad);
        }
    }
})();
