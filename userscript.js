// ==UserScript==
// @name         SSBAGPCM Client
// @version      1.3.1
// @description  ssbagpcm's starblast client
// @author       ssbagpcm
// @match        https://starblast.io/
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // ================= EARLY CSS - HIDE ORIGINAL LOGO CONTENT =================
    const earlyCSS = document.createElement('style');
    earlyCSS.id = 'ssbagpcm-early';
    earlyCSS.textContent = `
        /* Hide original logo IMAGE but keep the container for positioning */
        #logo > img, #logo > canvas, #logo > svg {
            display: none !important;
        }
        /* Hide logo until we patch it */
        #logo:not([data-patched]) {
            visibility: hidden !important;
        }
        /* Show once patched */
        #logo[data-patched] {
            visibility: visible !important;
            opacity: 1 !important;
        }
        /* Hide unwanted elements */
        #training, #facebook, #twitter,
        .social .sbg-training, .social .sbg-facebook, .social .sbg-twitter {
            display: none !important;
        }
    `;
    (document.head || document.documentElement).appendChild(earlyCSS);

    // ================= ANTI-RELOAD PROTECTION =================
    if (window.__SSBAGPCM_INSTANCE__) return;
    window.__SSBAGPCM_INSTANCE__ = Date.now();

    // ================= WEBSOCKET INTERCEPT =================
    const STORAGE_KEY = 'sb_seq_v26';
    const MAX_LINES = 5;
    let socket = null;
    let running = false;
    let looping = false;
    let delay = 500;
    let seqGui = null;

    if (!window.__WS_INTERCEPTED__) {
        window.__WS_INTERCEPTED__ = true;
        const OG = window.WebSocket;
        window.WebSocket = function(a, b) {
            const ws = b ? new OG(a, b) : new OG(a);
            socket = ws;
            return ws;
        };
        window.WebSocket.prototype = OG.prototype;
    }

    // ================= CONSTANTS =================
    const BRAND = 'SSBAGPCM CLIENT';
    const SHIPYARD_URL = 'https://starblast.dankdmitron.dev/';
    const GITHUB_URL = 'https://github.com/ssbagpcm';

    // ================= STORAGE =================
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

    // ================= BRAND HTML =================
    const BRAND_HTML = `<a id="ssbagpcm-brand-link" href="${GITHUB_URL}" style="display:block; width:100%; text-align:center; text-decoration:none; cursor:pointer; color:#fff;">
        <div style="font-weight:900; letter-spacing:0.10em; text-transform:uppercase; font-size: clamp(60px, 6.2vw, 140px); line-height:1; text-shadow: 0 2px 0 rgba(255,255,255,0.12), 0 22px 36px rgba(0,0,0,0.92);">SSBAGPCM</div>
        <div style="margin-top: 6px; font-weight:800; letter-spacing:0.22em; text-transform:uppercase; font-size: clamp(16px, 1.8vw, 30px); opacity:0.92;">Client</div>
    </a>`;

    // ================= LOGO PATCHER =================
    let logoObserver = null;

    function patchLogo() {
        const logo = document.getElementById('logo');
        if (!logo) return false;

        // Check if already correctly patched
        if (logo.dataset.patched === 'true' && logo.querySelector('#ssbagpcm-brand-link')) {
            return true;
        }

        // Clear and set new content
        logo.innerHTML = BRAND_HTML;
        logo.dataset.patched = 'true';

        // Force visibility
        logo.style.visibility = 'visible';
        logo.style.opacity = '1';

        // Add click handler
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
                // If logo was modified or children changed
                if (mutation.target.id === 'logo' ||
                    mutation.target.closest?.('#logo') ||
                    [...(mutation.addedNodes || [])].some(n => n.id === 'logo' || n.querySelector?.('#logo'))) {

                    const logo = document.getElementById('logo');
                    if (logo && !logo.querySelector('#ssbagpcm-brand-link')) {
                        // Our content was removed, re-patch
                        patchLogo();
                    }
                }
            }
        });

        // Observe the entire document for logo changes
        logoObserver.observe(document.documentElement, {
            childList: true,
            subtree: true
        });
    }

    // ================= UI PATCHER =================
    function patchUI() {
        // Patch logo
        patchLogo();

        // Remove unwanted elements
        ['training', 'facebook', 'twitter'].forEach(id => {
            document.getElementById(id)?.remove();
        });
        document.querySelectorAll('.social .sbg-training, .social .sbg-facebook, .social .sbg-twitter').forEach(el => el.remove());

        // Patch shipyard
        const community = document.querySelector('.textcentered.community.changelog-new');
        if (community && !community.dataset.patched) {
            community.dataset.patched = 'true';
            community.style.display = 'flex';
            community.style.justifyContent = 'center';
            community.innerHTML = `<a id="ssbagpcm-shipyard-btn" href="${SHIPYARD_URL}" style="text-decoration:none; color:#fff; font-weight:900; font-size:18px; letter-spacing:0.14em; text-transform:uppercase; padding:10px 0;">Shipyard</a>`;

            const btn = document.getElementById('ssbagpcm-shipyard-btn');
            if (btn) {
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    showThanksScreen();
                    setTimeout(() => { window.location.href = SHIPYARD_URL; }, 100);
                });
            }
        }
    }

    // ================= SEQUENCER GUI =================
    function createSequencerGUI() {
        if (seqGui) { seqGui.classList.toggle('hide'); return; }

        seqGui = document.createElement('div');
        seqGui.id = 'sbseq';
        seqGui.innerHTML = `
            <div id="seq-head">SEQUENCER
                <div id="seq-btns"><button id="seq-min">-</button><button id="seq-close">x</button></div>
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

        const css = document.createElement('style');
        css.id = 'sbseq-style';
        css.textContent = `
            #sbseq{position:fixed;top:70px;left:50px;width:370px;background:rgba(10,10,18,0.78);backdrop-filter:blur(32px);border:1px solid rgba(255,255,255,0.08);border-radius:20px;font-family:system-ui,sans-serif;color:#fff;box-shadow:0 30px 80px rgba(0,0,0,0.7);z-index:999999;user-select:none;overflow:hidden}
            #sbseq.min #seq-body{display:none}#sbseq.hide{opacity:0;pointer-events:none;transform:scale(0.92);transition:all .25s}
            #seq-head{padding:14px 20px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid rgba(255,255,255,0.06);cursor:grab;font-size:11px;letter-spacing:2.5px;color:rgba(255,255,255,0.5);font-weight:600}
            #seq-head:active{cursor:grabbing}
            #seq-btns button{background:none;border:none;color:rgba(255,255,255,0.5);font-size:20px;width:30px;height:30px;border-radius:8px;cursor:pointer;transition:all .2s}
            #seq-btns button:hover{background:rgba(255,255,255,0.15);color:#fff}
            #seq-body{padding:20px 22px;display:flex;flex-direction:column;gap:18px}
            #seq-lines{display:flex;flex-direction:column;gap:12px;max-height:340px;overflow-y:auto}
            .seq-line{display:flex;gap:10px;justify-content:center}
            .seq-char{width:50px;height:50px;border:1px solid rgba(255,255,255,0.1);border-radius:12px;background:rgba(0,0,0,0.4);color:#fff;text-align:center;font-size:20px;font-weight:600;outline:none;transition:all .2s;text-transform:uppercase;caret-color:transparent}
            .seq-char::placeholder{color:rgba(255,255,255,0.2)}
            .seq-char:focus{border-color:rgba(100,220,160,0.7);background:rgba(0,0,0,0.55);box-shadow:0 0 0 4px rgba(100,220,160,0.18)}
            .seq-char.space{background:rgba(100,220,160,0.2)!important;border-color:rgba(100,220,160,0.5)!important;box-shadow:inset 0 0 15px rgba(100,220,160,0.15)!important}
            .seq-line.active .seq-char{border-color:rgba(100,220,160,0.9);box-shadow:0 0 0 4px rgba(100,220,160,0.25)}
            #seq-delay{display:flex;align-items:center;gap:16px;padding:14px 18px;background:rgba(255,255,255,0.02);border-radius:14px;border:1px solid rgba(255,255,255,0.05)}
            #seq-track{flex:1;height:7px;background:rgba(255,255,255,0.08);border-radius:4px;position:relative;cursor:pointer}
            #seq-fill{height:100%;width:26%;background:linear-gradient(90deg,rgba(100,220,160,0.6),rgba(100,220,160,1));border-radius:4px}
            #seq-thumb{position:absolute;top:50%;left:26%;width:18px;height:18px;background:#fff;border-radius:50%;transform:translate(-50%,-50%);box-shadow:0 3px 12px rgba(0,0,0,0.5)}
            #seq-val{font-size:12px;color:rgba(255,255,255,0.6);min-width:56px;text-align:right;font-variant-numeric:tabular-nums}
            #seq-controls{display:flex;gap:12px}
            #seq-controls button{flex:1;padding:16px 0;border:none;border-radius:14px;font-weight:600;letter-spacing:0.6px;cursor:pointer;transition:all .25s}
            #seq-start{background:linear-gradient(135deg,rgba(80,200,140,0.9),rgba(60,170,110,0.9));color:#fff}
            #seq-stop{background:rgba(255,255,255,0.05);color:rgba(255,255,255,0.7);border:1px solid rgba(255,255,255,0.1)}
            #seq-loop{display:flex;align-items:center;justify-content:center;gap:16px;padding:14px 28px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.06);border-radius:40px;cursor:pointer}
            #seq-loop input{display:none}
            #seq-switch{width:52px;height:30px;background:rgba(255,255,255,0.1);border-radius:15px;position:relative}
            #seq-knob{position:absolute;top:3px;left:3px;width:24px;height:24px;background:#fff;border-radius:50%;transition:.3s cubic-bezier(.4,0,.2,1);box-shadow:0 3px 10px rgba(0,0,0,0.3)}
            #seq-loopchk:checked~#seq-switch{background:rgba(100,220,160,0.6)}
            #seq-loopchk:checked~#seq-switch #seq-knob{left:25px}
        `;

        document.getElementById('sbseq-style')?.remove();
        document.getElementById('sbseq')?.remove();
        document.head.appendChild(css);
        document.body.appendChild(seqGui);
        initSequencer();
    }

    function initSequencer() {
        const gui = seqGui;
        const linesCont = gui.querySelector('#seq-lines');

        const createChar = () => { const i = document.createElement('input'); i.type = 'text'; i.maxLength = 1; i.className = 'seq-char'; i.placeholder = '-'; i.dataset.space = 'false'; return i; };
        const isExplicitSpace = (inp) => inp.dataset.space === 'true';
        const setExplicitSpace = (inp) => { inp.value = ''; inp.dataset.space = 'true'; inp.classList.add('space'); inp.placeholder = ''; };
        const clearChar = (inp) => { inp.value = ''; inp.dataset.space = 'false'; inp.classList.remove('space'); inp.placeholder = '-'; };
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
            if (!socket || socket.readyState !== 1) { stopSeq(); return; }
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
            if (e.key === 'Delete') { e.preventDefault(); clearChar(inp); (chars[idx-1] || chars[idx+1] || allLines[lineIdx-1]?.lastElementChild || allLines[lineIdx+1]?.firstElementChild)?.focus(); save(); return; }
            if (e.key === 'Backspace') { e.preventDefault(); if (inp.value || isExplicitSpace(inp)) clearChar(inp); else if (idx > 0) { chars[idx-1].focus(); clearChar(chars[idx-1]); } else allLines[lineIdx-1]?.lastElementChild?.focus(); save(); return; }
            if (e.key === 'Enter' || e.key === 'Escape') { e.preventDefault(); if (e.key === 'Escape') inp.blur(); return; }
            if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Tab'].includes(e.key)) {
                e.preventDefault();
                if (e.key === 'Tab') (e.shiftKey ? inp.previousElementSibling || allLines[lineIdx-1]?.lastElementChild : inp.nextElementSibling || line.nextElementSibling?.firstElementChild)?.focus();
                else if (e.key === 'ArrowRight') (idx < chars.length-1 ? chars[idx+1] : allLines[lineIdx+1]?.children[0])?.focus();
                else if (e.key === 'ArrowLeft') (idx > 0 ? chars[idx-1] : allLines[lineIdx-1]?.lastElementChild)?.focus();
                else if (e.key === 'ArrowDown' && lineIdx < allLines.length-1) allLines[lineIdx+1].children[Math.min(idx, allLines[lineIdx+1].children.length-1)]?.focus();
                else if (e.key === 'ArrowUp' && lineIdx > 0) allLines[lineIdx-1].children[Math.min(idx, allLines[lineIdx-1].children.length-1)]?.focus();
                return;
            }
            if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey && !/^[a-zA-Z]$/.test(e.key)) e.preventDefault();
        }, true);

        document.addEventListener('input', e => {
            if (!e.target.matches('.seq-char')) return;
            const inp = e.target;
            inp.dataset.space = 'false'; inp.classList.remove('space'); inp.placeholder = '-';
            inp.value = inp.value.replace(/[^a-zA-Z]/g, '').toUpperCase();
            if (inp.value.length === 1) (inp.nextElementSibling || inp.parentElement.nextElementSibling?.firstElementChild)?.focus();
            save();
        });

        ['keyup','keypress'].forEach(ev => document.addEventListener(ev, e => { if (e.target.matches('.seq-char')) { e.stopPropagation(); e.stopImmediatePropagation(); } }, true));

        let sliding = false;
        gui.querySelector('#seq-track').addEventListener('mousedown', e => { sliding = true; moveSlider(e); });
        document.addEventListener('mousemove', e => sliding && moveSlider(e));
        document.addEventListener('mouseup', () => { if (sliding) { sliding = false; save(); } });
        function moveSlider(e) { const r = gui.querySelector('#seq-track').getBoundingClientRect(); delay = Math.round((100 + Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * 1900) / 50) * 50; updateDelay(); }

        let dragging = false, ox, oy;
        gui.querySelector('#seq-head').addEventListener('mousedown', e => { if (e.target.tagName !== 'BUTTON') { dragging = true; const r = gui.getBoundingClientRect(); ox = e.clientX - r.left; oy = e.clientY - r.top; } });
        document.addEventListener('mousemove', e => { if (dragging) { gui.style.left = (e.clientX - ox) + 'px'; gui.style.top = (e.clientY - oy) + 'px'; } });
        document.addEventListener('mouseup', () => dragging = false);

        gui.querySelector('#seq-start').onclick = () => { if (!running) { running = true; looping = gui.querySelector('#seq-loopchk').checked; runSeq(); } };
        gui.querySelector('#seq-stop').onclick = stopSeq;
        gui.querySelector('#seq-min').onclick = () => { gui.classList.toggle('min'); gui.querySelector('#seq-min').textContent = gui.classList.contains('min') ? '+' : '-'; };
        gui.querySelector('#seq-close').onclick = () => gui.classList.toggle('hide');
        gui.querySelector('#seq-loopchk').addEventListener('change', save);

        updateDelay();
        load();
    }

    function toggleSequencer() { if (!seqGui) createSequencerGUI(); else seqGui.classList.toggle('hide'); }

    // ================= SCREENS =================
    function showThanksScreen() {
        try {
            document.title = BRAND;
            document.body.innerHTML = `<div style="height:100vh;display:flex;align-items:center;justify-content:center;background:#000;color:#fff;font-family:Arial,sans-serif;text-align:center;padding:24px"><div><div style="font-weight:900;letter-spacing:.1em;text-transform:uppercase;font-size:clamp(80px,8vw,200px);line-height:1;text-shadow:0 20px 40px rgba(0,0,0,.9)">Thanks for using</div><div style="margin-top:18px;font-weight:700;letter-spacing:.22em;text-transform:uppercase;font-size:clamp(20px,2vw,40px);opacity:.92">${BRAND}</div><div style="width:72px;height:72px;border-radius:999px;margin:34px auto 0;border:5px solid rgba(255,255,255,.18);border-top-color:#fff;animation:spin .95s linear infinite"></div></div></div><style>@keyframes spin{to{transform:rotate(360deg)}}</style>`;
        } catch (_) {}
    }

    function showLoadingScreen() {
        try {
            document.open();
            document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="ssbagpcm-loaded" content="true"><title>${BRAND}</title><style>*{box-sizing:border-box}html,body{height:100%;margin:0;background:#000;display:flex;align-items:center;justify-content:center;font-family:Arial,sans-serif;overflow:hidden}.wrap{text-align:center;padding:24px;width:min(1200px,94vw)}.main{color:#fff;font-weight:900;letter-spacing:.1em;text-transform:uppercase;font-size:clamp(90px,9vw,210px);line-height:1;text-shadow:0 2px 0 rgba(255,255,255,.15),0 20px 40px rgba(0,0,0,.9)}.sub{margin-top:18px;color:#fff;font-weight:700;letter-spacing:.22em;text-transform:uppercase;font-size:clamp(22px,2.2vw,42px);opacity:.92}.spinner{width:clamp(72px,5vw,110px);height:clamp(72px,5vw,110px);border-radius:999px;margin:40px auto 0;border:5px solid rgba(255,255,255,.18);border-top-color:#fff;animation:spin .95s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}</style></head><body><div class="wrap"><div class="main">SSBAGPCM CLIENT</div><div class="sub">Loading...</div><div class="spinner"></div></div></body></html>`);
            document.close();
        } catch (_) {}
    }

    // ================= HELPERS =================
    function openSettings() { for (const s of ['.social .sbg-gears','.social .fa-gears','.social .fa-cog','.sbg-gears']) { const e = document.querySelector(s); if (e) { e.click(); return true; } } return false; }
    function isInGame() { try { return window.module?.exports?.settings && Object.values(window.module.exports.settings).find(e => e?.mode)?.mode?.id !== 'welcome'; } catch (_) { return false; } }

    // ================= INTERVALS =================
    let patchInterval = null, gemInterval = null, emoteInterval = null;
    function cleanupIntervals() { [patchInterval, gemInterval, emoteInterval].forEach(i => i && clearInterval(i)); patchInterval = gemInterval = emoteInterval = null; }

    function installGemPatch() {
        if (gemInterval) clearInterval(gemInterval);
        gemInterval = setInterval(() => {
            for (const k in window) {
                try {
                    if (window[k]?.prototype?.createModel && Function.prototype.toString.call(window[k].prototype.createModel).includes('Crystal')) {
                        clearInterval(gemInterval); gemInterval = null;
                        const old = window[k].prototype.getModelInstance;
                        window[k].prototype.getModelInstance = function() {
                            const r = old.apply(this, arguments);
                            try { this.material.color?.set(window.ClientStorage.gem1()); this.material.specular?.set(window.ClientStorage.gem2()); } catch (_) {}
                            return r;
                        };
                        return;
                    }
                } catch (_) {}
            }
        }, 100);
    }

    function installTabIndicator() {
        const orig = document.title || 'Starblast.io';
        const update = () => { document.title = document.hidden ? (isInGame() ? '🔴 In game' : '🟢 Menu') : orig; };
        document.addEventListener('visibilitychange', update);
        window.addEventListener('focus', () => { document.title = orig; });
    }

    // ================= MAIN LOADER =================
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

            // Marker
            src = src.replace('<head>', '<head><meta name="ssbagpcm-loaded" content="true">');

            // Early CSS
            src = src.replace('<head>', `<head><style id="ssbagpcm-early">#logo>img,#logo>canvas,#logo>svg{display:none!important}#logo:not([data-patched]){visibility:hidden!important}#logo[data-patched]{visibility:visible!important;opacity:1!important}#training,#facebook,#twitter,.social .sbg-training,.social .sbg-facebook,.social .sbg-twitter{display:none!important}</style>`);

            // Patches
            src = src.replace(/\.toUpperCase\(\)/g, '');
            src = src.replace(/text-transform:\s*uppercase;/gim, '');
            src = src.replace('https://starblast.io/modsinfo.json', 'https://raw.githubusercontent.com/officialtroller/starblast-things/refs/heads/main/modsinfo.js');
            src = src.replace(/html5\.api\.gamedistribution\.com\/libs\/gd\/api\.js|sdk\.crazygames\.com\/crazygames-sdk-v1\.js|api\.adinplay\.com\/libs\/aiptag\/pub\/NRN\/starblast\.io\/tag\.min\.js/g, 'ads.blocked');

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
            } catch (_) {}

            document.open();
            document.write(src);
            document.close();

            setupPostLoad();
        } catch (err) { console.error('[SSBAGPCM] Error:', err); }
    }

    function setupPostLoad() {
        cleanupIntervals();

        // Patch UI continuously
        patchInterval = setInterval(patchUI, 50);

        // Setup observer for logo changes
        const waitForBody = setInterval(() => {
            if (document.body) {
                clearInterval(waitForBody);
                setupLogoObserver();
                patchUI();
            }
        }, 10);

        installTabIndicator();
        installGemPatch();

        // Keyboard shortcuts
        document.addEventListener('keydown', e => {
            if (e.ctrlKey && e.key.toLowerCase() === 's') { e.preventDefault(); openSettings(); }
            if (e.altKey && e.key.toLowerCase() === 'n') { e.preventDefault(); e.stopPropagation(); toggleSequencer(); }
            if (e.ctrlKey && e.altKey && e.key.toLowerCase() === 'p') { e.preventDefault(); toggleSequencer(); }
        }, true);

        // Emote patch
        emoteInterval = setInterval(() => {
            if (window.ChatPanel?.prototype?.typed) {
                clearInterval(emoteInterval); emoteInterval = null;
                window.ChatPanel.prototype.typed = new Function('return ' + window.ChatPanel.prototype.typed.toString().replace('>=4', '>=ClientStorage.emotes()'))();
            }
        }, 100);

        window.addEventListener('beforeunload', () => { try { showThanksScreen(); } catch (_) {} });

        console.log('[SSBAGPCM] Client Loaded. Alt+N or Ctrl+Alt+P for Sequencer.');
    }

    // ================= START =================
    if (window.location.pathname === '/') {
        if (!document.querySelector('[name="ssbagpcm-loaded"]')) {
            setTimeout(ClientLoader, 1);
        } else {
            document.readyState === 'complete' ? setupPostLoad() : window.addEventListener('load', setupPostLoad);
        }
    }
})();
