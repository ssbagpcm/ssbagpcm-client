// ==UserScript==
// @name         SSBAGPCM Client
// @version      1.2.1
// @description  ssbagpcm's starblast client
// @author       ssbagpcm
// @match        https://starblast.io/
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // ================= ANTI-RELOAD PROTECTION =================
    if (window.__SSBAGPCM_LOADED__) return;
    window.__SSBAGPCM_LOADED__ = true;

    // ================= SEQUENCER - WEBSOCKET INTERCEPT =================
    const STORAGE_KEY = 'sb_seq_v26';
    const MAX_LINES = 5;
    let socket = null;
    let running = false;
    let looping = false;
    let delay = 500;
    let seqGui = null;

    const OG = window.WebSocket;
    window.WebSocket = function(a, b) {
        const ws = b ? new OG(a, b) : new OG(a);
        socket = ws;
        return ws;
    };
    window.WebSocket.prototype = OG.prototype;

    // ================= SEQUENCER GUI =================
    function createSequencerGUI() {
        if (seqGui) {
            seqGui.classList.toggle('hide');
            return;
        }

        seqGui = document.createElement('div');
        seqGui.id = 'sbseq';
        seqGui.innerHTML = `
            <div id="seq-head">SEQUENCER
                <div id="seq-btns">
                    <button id="seq-min">-</button>
                    <button id="seq-close">x</button>
                </div>
            </div>
            <div id="seq-body">
                <div id="seq-lines"></div>
                <div id="seq-delay">
                    <div id="seq-track"><div id="seq-fill"></div><div id="seq-thumb"></div></div>
                    <span id="seq-val">500ms</span>
                </div>
                <div id="seq-controls">
                    <button id="seq-start">START</button>
                    <button id="seq-stop">STOP</button>
                </div>
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
            .seq-char.space{background:rgba(100,220,160,0.2) !important;border-color:rgba(100,220,160,0.5) !important;box-shadow:inset 0 0 15px rgba(100,220,160,0.15) !important}
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

        // Clean up existing elements first
        const existingStyle = document.getElementById('sbseq-style');
        const existingGui = document.getElementById('sbseq');
        if (existingStyle) existingStyle.remove();
        if (existingGui) existingGui.remove();

        document.head.appendChild(css);
        document.body.appendChild(seqGui);

        initSequencer();
    }

    function initSequencer() {
        const gui = seqGui;
        const linesCont = gui.querySelector('#seq-lines');

        function createChar() {
            const i = document.createElement('input');
            i.type = 'text';
            i.maxLength = 1;
            i.className = 'seq-char';
            i.placeholder = '-';
            i.dataset.space = 'false';
            return i;
        }

        function isExplicitSpace(input) {
            return input.dataset.space === 'true';
        }

        function setExplicitSpace(input) {
            input.value = '';
            input.dataset.space = 'true';
            input.classList.add('space');
            input.placeholder = '';
        }

        function clearChar(input) {
            input.value = '';
            input.dataset.space = 'false';
            input.classList.remove('space');
            input.placeholder = '-';
        }

        function getCharValue(input) {
            if (isExplicitSpace(input)) return ' ';
            return input.value;
        }

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
            const data = {
                lines: [...linesCont.children].map(l =>
                    [...l.querySelectorAll('.seq-char')].map(i => ({
                        value: i.value,
                        isSpace: isExplicitSpace(i)
                    }))
                ),
                delay,
                loop: gui.querySelector('#seq-loopchk').checked
            };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        }

        function load() {
            try {
                const d = JSON.parse(localStorage.getItem(STORAGE_KEY));
                if (!d || !d.lines?.length) throw new Error();

                linesCont.innerHTML = '';
                const linesToLoad = d.lines.slice(0, MAX_LINES);

                linesToLoad.forEach(row => {
                    const line = document.createElement('div');
                    line.className = 'seq-line';
                    const cleanRow = row.slice(0, 5);

                    cleanRow.forEach(cell => {
                        const inp = createChar();
                        if (typeof cell === 'object') {
                            if (cell.isSpace) {
                                setExplicitSpace(inp);
                            } else {
                                inp.value = (cell.value || '').replace(/[^a-zA-Z]/g, '').toUpperCase();
                            }
                        } else {
                            inp.value = (cell || '').replace(/[^a-zA-Z]/g, '').toUpperCase();
                        }
                        line.appendChild(inp);
                    });

                    while (line.children.length < 5) line.appendChild(createChar());
                    linesCont.appendChild(line);
                });

                while (linesCont.children.length < MAX_LINES) addLine();

                delay = d.delay || 500;
                gui.querySelector('#seq-loopchk').checked = !!d.loop;
                updateDelay();
            } catch {
                linesCont.innerHTML = '';
                for (let i = 0; i < MAX_LINES; i++) addLine();
            }
        }

        function updateDelay() {
            const pct = ((delay - 100) / 1900) * 100;
            gui.querySelector('#seq-fill').style.width = pct + '%';
            gui.querySelector('#seq-thumb').style.left = pct + '%';
            gui.querySelector('#seq-val').textContent = delay + 'ms';
        }

        function stopSeq() {
            running = false;
            document.querySelectorAll('.seq-line.active').forEach(l => l.classList.remove('active'));
        }

        function buildMessage(line) {
            const chars = line.querySelectorAll('.seq-char');
            let msg = '';
            chars.forEach(c => {
                const val = getCharValue(c);
                if (val) msg += val;
            });
            return msg;
        }

        function isLineEmpty(line) {
            const chars = line.querySelectorAll('.seq-char');
            for (let c of chars) {
                if (c.value || isExplicitSpace(c)) return false;
            }
            return true;
        }

        async function runSeq() {
            if (!socket || socket.readyState !== 1) {
                stopSeq();
                return;
            }

            const lines = linesCont.children;

            for (let i = 0; i < lines.length; i++) {
                if (!running) break;

                if (isLineEmpty(lines[i])) continue;

                lines[i].classList.add('active');

                const msg = buildMessage(lines[i]);

                if (msg.length > 0) {
                    socket.send(JSON.stringify({ name: 'say', data: msg }));
                }

                await new Promise(r => setTimeout(r, delay));
                lines[i].classList.remove('active');
            }

            if (running && looping) {
                runSeq();
            } else {
                stopSeq();
            }
        }

        document.addEventListener('keydown', e => {
            if (!e.target.matches('.seq-char')) return;

            e.stopPropagation();
            e.stopImmediatePropagation();

            const input = e.target;
            const line = input.parentNode;
            const chars = Array.from(line.querySelectorAll('.seq-char'));
            const index = chars.indexOf(input);
            const allLines = Array.from(linesCont.children);
            const lineIdx = allLines.indexOf(line);

            if (e.key === ' ') {
                e.preventDefault();
                setExplicitSpace(input);
                const next = input.nextElementSibling || line.nextElementSibling?.firstElementChild;
                next?.focus();
                save();
                return;
            }

            if (e.key === 'Delete') {
                e.preventDefault();
                clearChar(input);
                let nextFocus = null;
                if (index > 0) nextFocus = chars[index - 1];
                else if (index < chars.length - 1) nextFocus = chars[index + 1];
                else if (lineIdx > 0) nextFocus = allLines[lineIdx - 1].lastElementChild;
                else if (lineIdx < allLines.length - 1) nextFocus = allLines[lineIdx + 1].firstElementChild;
                nextFocus?.focus();
                save();
                return;
            }

            if (e.key === 'Backspace') {
                e.preventDefault();
                if (input.value || isExplicitSpace(input)) {
                    clearChar(input);
                } else if (index > 0) {
                    chars[index - 1].focus();
                    clearChar(chars[index - 1]);
                } else if (lineIdx > 0) {
                    allLines[lineIdx - 1].lastElementChild.focus();
                }
                save();
                return;
            }

            if (e.key === 'Enter') {
                e.preventDefault();
                return;
            }

            if (e.key === 'Escape') {
                e.preventDefault();
                input.blur();
                return;
            }

            if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Tab'].includes(e.key)) {
                e.preventDefault();

                switch (e.key) {
                    case 'Tab':
                        const nextTab = e.shiftKey
                            ? (input.previousElementSibling || (lineIdx > 0 ? allLines[lineIdx - 1].lastElementChild : null))
                            : (input.nextElementSibling || line.nextElementSibling?.firstElementChild);
                        nextTab?.focus();
                        break;
                    case 'ArrowRight':
                        if (index < chars.length - 1) chars[index + 1].focus();
                        else if (lineIdx < allLines.length - 1) allLines[lineIdx + 1].children[0].focus();
                        break;
                    case 'ArrowLeft':
                        if (index > 0) chars[index - 1].focus();
                        else if (lineIdx > 0) allLines[lineIdx - 1].lastElementChild?.focus();
                        break;
                    case 'ArrowDown':
                        if (lineIdx < allLines.length - 1) {
                            const next = allLines[lineIdx + 1].children;
                            next[Math.min(index, next.length - 1)].focus();
                        }
                        break;
                    case 'ArrowUp':
                        if (lineIdx > 0) {
                            const prev = allLines[lineIdx - 1].children;
                            prev[Math.min(index, prev.length - 1)].focus();
                        }
                        break;
                }
                return;
            }

            if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
                if (/^[a-zA-Z]$/.test(e.key)) {
                    input.dataset.space = 'false';
                    input.classList.remove('space');
                    input.placeholder = '-';
                } else {
                    e.preventDefault();
                }
            }
        }, true);

        document.addEventListener('input', e => {
            if (!e.target.matches('.seq-char')) return;

            const input = e.target;

            input.dataset.space = 'false';
            input.classList.remove('space');
            input.placeholder = '-';

            input.value = input.value.replace(/[^a-zA-Z]/g, '').toUpperCase();

            if (input.value.length === 1) {
                const next = input.nextElementSibling || input.parentElement.nextElementSibling?.firstElementChild;
                next?.focus();
            }

            save();
        });

        document.addEventListener('keyup', e => {
            if (e.target.matches('.seq-char')) {
                e.stopPropagation();
                e.stopImmediatePropagation();
            }
        }, true);

        document.addEventListener('keypress', e => {
            if (e.target.matches('.seq-char')) {
                e.stopPropagation();
                e.stopImmediatePropagation();
            }
        }, true);

        let sliding = false;
        gui.querySelector('#seq-track').addEventListener('mousedown', e => { sliding = true; moveSlider(e); });
        document.addEventListener('mousemove', e => sliding && moveSlider(e));
        document.addEventListener('mouseup', () => sliding && (sliding = false, save()));

        function moveSlider(e) {
            const rect = gui.querySelector('#seq-track').getBoundingClientRect();
            let p = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
            delay = Math.round((100 + p * 1900) / 50) * 50;
            updateDelay();
        }

        let dragging = false, ox, oy;
        gui.querySelector('#seq-head').addEventListener('mousedown', e => {
            if (e.target.tagName === 'BUTTON') return;
            dragging = true;
            const r = gui.getBoundingClientRect();
            ox = e.clientX - r.left;
            oy = e.clientY - r.top;
        });
        document.addEventListener('mousemove', e => {
            if (dragging) {
                gui.style.left = (e.clientX - ox) + 'px';
                gui.style.top = (e.clientY - oy) + 'px';
            }
        });
        document.addEventListener('mouseup', () => dragging = false);

        gui.querySelector('#seq-start').onclick = () => {
            if (running) return;
            running = true;
            looping = gui.querySelector('#seq-loopchk').checked;
            runSeq();
        };

        gui.querySelector('#seq-stop').onclick = stopSeq;

        gui.querySelector('#seq-min').onclick = () => {
            gui.classList.toggle('min');
            gui.querySelector('#seq-min').textContent = gui.classList.contains('min') ? '+' : '-';
        };

        gui.querySelector('#seq-close').onclick = () => gui.classList.toggle('hide');
        gui.querySelector('#seq-loopchk').addEventListener('change', save);

        updateDelay();
        load();
    }

    function toggleSequencer() {
        if (!seqGui) {
            createSequencerGUI();
        } else {
            seqGui.classList.toggle('hide');
        }
    }

    // ================= CLIENT CORE =================

    if (localStorage.getItem('emopacity') === null) localStorage.setItem('emopacity', '5');
    if (localStorage.getItem('gemindeed') === null) localStorage.setItem('gemindeed', JSON.stringify('#ff0000'));
    if (localStorage.getItem('gemindeed1') === null) localStorage.setItem('gemindeed1', JSON.stringify('#ff8080'));

    const BRAND = 'SSBAGPCM CLIENT';
    const SHIPYARD_URL = 'https://starblast.dankdmitron.dev/';
    const GITHUB_URL = 'https://github.com/ssbagpcm';

    function screenHTML(mainText, subText) {
        return `
        <html>
            <head>
                <meta charset="utf-8" />
                <title>${BRAND}</title>
                <style>
                    *{box-sizing:border-box}
                    html,body{height:100%; margin:0; background:#000; display:flex; align-items:center; justify-content:center; font-family: Arial, sans-serif; overflow:hidden;}
                    .wrap{text-align:center; padding:24px; width:min(1200px, 94vw);}
                    .main{color:#fff; font-weight:900; letter-spacing:0.10em; text-transform:uppercase; font-size:clamp(90px, 9vw, 210px); line-height:1.0; text-shadow: 0 2px 0 rgba(255,255,255,0.15), 0 20px 40px rgba(0,0,0,0.90);}
                    .sub{margin-top:18px; color:#fff; font-weight:700; letter-spacing:0.22em; text-transform:uppercase; font-size:clamp(22px, 2.2vw, 42px); opacity:0.92;}
                    .spinner{width:clamp(72px, 5vw, 110px); height:clamp(72px, 5vw, 110px); border-radius:999px; margin:40px auto 0; border:5px solid rgba(255,255,255,0.18); border-top-color:#fff; animation:spin 0.95s linear infinite;}
                    @keyframes spin { to { transform: rotate(360deg); } }
                </style>
            </head>
            <body>
                <div class="wrap">
                    <div class="main">${mainText}</div>
                    <div class="sub">${subText}</div>
                    <div class="spinner"></div>
                </div>
            </body>
        </html>`;
    }

    function renderFullscreenScreen(mainText, subText) {
        try {
            document.open();
            document.write(screenHTML(mainText, subText));
            document.close();
        } catch (_) {}
    }

    function showThanksScreen() {
        try {
            if (document && document.body) {
                document.title = BRAND;
                document.body.innerHTML = `
                <div style="height:100vh; display:flex; align-items:center; justify-content:center; background:#000; color:#fff; font-family: Arial, sans-serif; text-align:center; padding:24px;">
                    <div>
                        <div style="font-weight:900; letter-spacing:0.10em; text-transform:uppercase; font-size:clamp(80px, 8vw, 200px); line-height:1.0; text-shadow: 0 20px 40px rgba(0,0,0,0.90);">Thanks for using the client</div>
                        <div style="margin-top:18px; font-weight:700; letter-spacing:0.22em; text-transform:uppercase; font-size:clamp(20px, 2vw, 40px); opacity:0.92;">${BRAND}</div>
                        <div class="spinner" style="width:72px; height:72px; border-radius:999px; margin:34px auto 0; border:5px solid rgba(255,255,255,0.18); border-top-color:#fff; animation:spin 0.95s linear infinite;"></div>
                    </div>
                </div>
                <style>@keyframes spin { to { transform: rotate(360deg); } }</style>`;
            }
        } catch (_) {}
    }

    const Client = new (class {
        checkgame() {
            try {
                return (window.location.pathname === '/' && window.module && window.module.exports && window.module.exports.settings && Object.values(window.module.exports.settings).find(e => e && e.mode).mode.id !== 'welcome' && window.location.href !== 'https://starblast.io/#');
            } catch (_) { return false; }
        }
    })();

    window.ClientStorage = new (class {
        _readString(key, fallback) {
            const raw = localStorage.getItem(key);
            if (raw == null) { localStorage.setItem(key, JSON.stringify(fallback)); return fallback; }
            try { const parsed = JSON.parse(raw); return typeof parsed === 'string' ? parsed : fallback; } catch (_) { if (typeof raw === 'string' && raw[0] === '#') return raw; return fallback; }
        }
        _readInt(key, fallback) {
            const raw = localStorage.getItem(key);
            if (raw == null) { localStorage.setItem(key, String(fallback)); return fallback; }
            try { const parsed = JSON.parse(raw); const n = typeof parsed === 'number' ? parsed : parseInt(String(parsed), 10); return Number.isFinite(n) ? n : fallback; } catch (_) { return fallback; }
        }
        emotes() { const n = this._readInt('emopacity', 5); return Math.max(1, Math.min(5, n)); }
        gem1() { return this._readString('gemindeed', '#ff0000'); }
        gem2() { return this._readString('gemindeed1', '#ff8080'); }
    })();

    function openSettings() {
        const candidates = ['.social .sbg-gears', '.social .fa-gears', '.social .fa-cog', '.sbg-gears'];
        for (const sel of candidates) {
            const el = document.querySelector(sel);
            if (el) { el.click(); return true; }
        }
        return false;
    }

    // Store interval IDs for cleanup
    let patchUIInterval = null;
    let gemPatchInterval = null;
    let emotePatchInterval = null;

    function cleanupIntervals() {
        if (patchUIInterval) { clearInterval(patchUIInterval); patchUIInterval = null; }
        if (gemPatchInterval) { clearInterval(gemPatchInterval); gemPatchInterval = null; }
        if (emotePatchInterval) { clearInterval(emotePatchInterval); emotePatchInterval = null; }
    }

    function patchUI() {
        const logo = document.getElementById('logo');
        if (logo && !logo.dataset.ssbagpcmDone) {
            logo.dataset.ssbagpcmDone = '1';
            logo.innerHTML = `<a id="ssbagpcm-brand-link" href="${GITHUB_URL}" style="display:block; width:100%; text-align:center; text-decoration:none; cursor:pointer; color:#fff;">
                <div style="font-weight:900; letter-spacing:0.10em; text-transform:uppercase; font-size: clamp(60px, 6.2vw, 140px); line-height:1; text-shadow: 0 2px 0 rgba(255,255,255,0.12), 0 22px 36px rgba(0,0,0,0.92);">SSBAGPCM</div>
                <div style="margin-top: 6px; font-weight:800; letter-spacing:0.22em; text-transform:uppercase; font-size: clamp(16px, 1.8vw, 30px); opacity:0.92;">Client</div>
            </a>`;
            const brandLink = document.getElementById('ssbagpcm-brand-link');
            if (brandLink) {
                brandLink.addEventListener('click', (e) => {
                    e.preventDefault(); showThanksScreen(); setTimeout(() => { window.location.href = GITHUB_URL; }, 0);
                });
            }
        }

        ['training', 'facebook', 'twitter'].forEach(id => {
            const el = document.getElementById(id) || document.querySelector(`.social .sbg-${id}`);
            if (el) el.remove();
        });

        const community = document.querySelector('.textcentered.community.changelog-new');
        if (community && !community.dataset.ssbagpcmShipyard) {
            community.dataset.ssbagpcmShipyard = '1';
            community.style.display = 'flex'; community.style.justifyContent = 'center';
            community.innerHTML = `<a id="ssbagpcm-shipyard-btn" href="${SHIPYARD_URL}" style="text-decoration:none; color:#fff; font-weight:900; font-size:18px; letter-spacing:0.14em; text-transform:uppercase; padding:10px 0;">Shipyard</a>`;
            const shipyardBtn = document.getElementById('ssbagpcm-shipyard-btn');
            if (shipyardBtn) {
                shipyardBtn.addEventListener('click', (e) => {
                    e.preventDefault(); showThanksScreen(); setTimeout(() => { window.location.href = SHIPYARD_URL; }, 0);
                });
            }
        }
    }

    function installTabIndicator() {
        const originalTitle = document.title || 'Starblast.io';
        const updateTitle = () => {
            if (!document.hidden) { document.title = originalTitle; return; }
            document.title = Client.checkgame() ? '🔴 In game - Starblast' : '🟢 Not in game - Starblast';
        };
        document.addEventListener('visibilitychange', updateTitle);
        window.addEventListener('focus', () => { document.title = originalTitle; });
    }

    function installGemRuntimePatch() {
        if (gemPatchInterval) clearInterval(gemPatchInterval);
        gemPatchInterval = setInterval(() => {
            let CrystalObject = null;
            for (const k in window) {
                try {
                    const val = window[k];
                    if (val && val.prototype && typeof val.prototype.createModel === 'function' && Function.prototype.toString.call(val.prototype.createModel).includes('Crystal')) {
                        CrystalObject = val; break;
                    }
                } catch (_) {}
            }
            if (!CrystalObject) return;
            clearInterval(gemPatchInterval);
            gemPatchInterval = null;
            const old = CrystalObject.prototype.getModelInstance;
            CrystalObject.prototype.getModelInstance = function () {
                const res = old.apply(this, arguments);
                try {
                    const color = window.ClientStorage.gem1(), spec = window.ClientStorage.gem2();
                    if (this.material.color.set) this.material.color.set(color);
                    if (this.material.specular.set) this.material.specular.set(spec);
                } catch (_) {}
                return res;
            };
        }, 100);
    }

    async function ClientLoader() {
        // Check if already loaded by looking for our marker in the DOM
        if (document.querySelector('[data-ssbagpcm-loaded="true"]')) {
            console.log('[SSBAGPCM] Client already loaded, skipping reload.');
            return;
        }

        renderFullscreenScreen('SSBAGPCM CLIENT', 'Loading...');
        window.addEventListener('beforeunload', () => { try { showThanksScreen(); } catch (_) {} });

        const xhr = new XMLHttpRequest();
        xhr.open('GET', 'https://starblast.io');
        xhr.onreadystatechange = function () {
            if (xhr.readyState !== 4) return;
            try {
                let src = xhr.responseText;
                if (!src) return;

                // Add marker to prevent reload issues
                src = src.replace('<head>', '<head><meta data-ssbagpcm-loaded="true">');

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
                        const kStep = (smatch && smatch[0]) ? smatch[0] : 'step';
                        src = src.replace(settingsregex[0], `${settingsregex[0]}emopacity:{name:"Emote Capacity",value:5,skipauto:!0,type:"range",min:1,max:5,${kStep}:1,filter:"default,app,mobile"},gemindeed:{name:"Gem Color 1",value:ClientStorage.gem1(),skipauto:!0,type:"color",filter:"default,app,mobile"},gemindeed1:{name:"Gem Color 2",value:ClientStorage.gem2(),skipauto:!0,type:"color",filter:"default,app,mobile"},`);
                    }

                    const beepMatch = src.match(/e\.[iI10OlL]{4,6}\.[iI10OlL]{4,6}\.beep\(4\+\.2\*math\.random\(\)/gi);
                    const bKeys = beepMatch ? beepMatch[0].match(/[iI10OlL]{4,6}/g) : null;
                    if (bKeys) {
                        src = src.replace(/for\(f=document\.queryselectorall\("\.option\s*input\[type=range\]"\),\s*i=function\(e\)\{.*?,1\)\}\)\}\}/gis, `for (f = document.querySelectorAll(".option input[type=range], .option input[type=color]"), i = function(e) { return function(i) { if (i.type === "range") { if (i.id === "emopacity") { i.addEventListener("input", function (s) { x = document.querySelector("#" + i.getAttribute("id") + "_value"), x.innerText = parseInt(i.value, 10), e.updateSettings(s, !0) }); i.dispatchEvent(new Event("input")); } else { i.addEventListener("input", function (s) { x = document.querySelector("#" + i.getAttribute("id") + "_value"), x.innerText = "0" === i.value ? t("Off") : Math.round(50 * i.value) + " %", e.updateSettings(s, !0) }); i.dispatchEvent(new Event("input")); if ("sounds" === i.id) i.addEventListener("change", function (t) { e.${bKeys[0]}.${bKeys[1]}.beep(4 + .2 * Math.random(), 1) }) } } else if (i.type === "color") { const update = function (s) { var x = document.querySelector("#" + i.getAttribute("id") + "_value"); if (x) x.innerText = i.value; return e.updateSettings(s, !0); }; i.addEventListener("input", update); try { if (i.id === "gemindeed") i.value = ClientStorage.gem1(); if (i.id === "gemindeed1") i.value = ClientStorage.gem2(); var x0 = document.querySelector("#" + i.getAttribute("id") + "_value"); if (x0) x0.innerText = i.value; } catch (_){} } } }`);
                    }
                } catch (_) {}

                document.open();
                document.write(src);
                document.close();

                // Clean up old intervals before creating new ones
                cleanupIntervals();

                patchUIInterval = setInterval(patchUI, 100);
                installTabIndicator();
                installGemRuntimePatch();

                document.addEventListener('keydown', (e) => {
                    if (e.ctrlKey && e.key.toLowerCase() === 's') { e.preventDefault(); openSettings(); }
                    if (e.altKey && e.key.toLowerCase() === 'n') { e.preventDefault(); e.stopPropagation(); toggleSequencer(); }
                    if (e.ctrlKey && e.altKey && e.key.toLowerCase() === 'p') { e.preventDefault(); toggleSequencer(); }
                }, true);

                if (emotePatchInterval) clearInterval(emotePatchInterval);
                emotePatchInterval = setInterval(() => {
                    if (window.ChatPanel && window.ChatPanel.prototype.typed) {
                        clearInterval(emotePatchInterval);
                        emotePatchInterval = null;
                        window.ChatPanel.prototype.typed = new Function('return ' + window.ChatPanel.prototype.typed.toString().replace('>=4', '>=ClientStorage.emotes()'))();
                    }
                }, 100);

                console.log('SSBAGPCM Client Loaded. Alt+N or Ctrl+Alt+P for Sequencer.');

            } catch (err) { console.error('[ssbagpcm] Error:', err); }
        };
        xhr.send();
    }

    if (window.location.pathname === '/') {
        // Additional check to prevent multiple loads
        if (!document.querySelector('[data-ssbagpcm-loaded="true"]')) {
            setTimeout(ClientLoader, 1);
        }
    }

})();
