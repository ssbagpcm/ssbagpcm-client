// ==UserScript==
// @name         SSBAGPCM Client
// @version      1.1.0
// @description  ssbagpcm's starblast client
// @author       ssbagpcm
// @match        https://starblast.io/
// @grant        none
// ==/UserScript==

(function() {
    'use strict';


    let popup = null;
    let intervalId = null;
    let isRunning = false;
    let currentIndex = 0;

    function createKeySequencePopup() {
        if (popup) {
            popup.style.display = popup.style.display === 'none' ? 'block' : 'none';
            return;
        }

        const style = document.createElement('style');
        style.textContent = `
            #ks-popup {
                position: fixed;
                top: 100px;
                left: 100px;
                width: 280px;
                background: rgba(30, 30, 30, 0.4);
                backdrop-filter: blur(8px);
                -webkit-backdrop-filter: blur(8px);
                border-radius: 12px;
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
                border: 1px solid rgba(255, 255, 255, 0.1);
                z-index: 2147483647;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                font-size: 13px;
                color: rgba(255, 255, 255, 0.9);
                user-select: none;
            }
            #ks-header {
                padding: 14px 16px;
                background: rgba(255, 255, 255, 0.05);
                border-radius: 12px 12px 0 0;
                border-bottom: 1px solid rgba(255, 255, 255, 0.08);
                cursor: move;
                font-weight: 600;
                font-size: 14px;
                display: flex;
                justify-content: space-between;
                align-items: center;
                letter-spacing: 0.3px;
            }
            #ks-header span {
                opacity: 0.4;
                font-size: 11px;
                font-weight: normal;
            }
            #ks-body { padding: 16px; }
            #ks-body label {
                display: block;
                margin-bottom: 6px;
                font-size: 12px;
                color: rgba(255, 255, 255, 0.6);
                font-weight: 500;
            }
            #ks-body input[type="text"], #ks-body input[type="number"] {
                width: 100%;
                padding: 12px 14px;
                margin-bottom: 14px;
                border: 1px solid rgba(255, 255, 255, 0.1);
                border-radius: 8px;
                box-sizing: border-box;
                font-size: 14px;
                background: rgba(255, 255, 255, 0.08);
                color: rgba(255, 255, 255, 0.95);
            }
            #ks-status {
                text-align: center;
                padding: 12px;
                background: rgba(255, 255, 255, 0.05);
                border-radius: 8px;
                margin-bottom: 14px;
                font-weight: 500;
                font-size: 13px;
                color: rgba(255, 255, 255, 0.7);
                border: 1px solid rgba(255, 255, 255, 0.08);
            }
            #ks-status.running { background: rgba(255, 255, 255, 0.1); color: rgba(255, 255, 255, 0.95); }
            #ks-buttons { display: flex; gap: 10px; }
            #ks-buttons button {
                flex: 1;
                padding: 12px 0;
                border: 1px solid rgba(255, 255, 255, 0.15);
                border-radius: 8px;
                cursor: pointer;
                font-size: 12px;
                font-weight: 600;
                text-transform: uppercase;
                background: rgba(255, 255, 255, 0.08);
                color: rgba(255, 255, 255, 0.85);
                transition: all 0.2s;
            }
            #ks-buttons button:hover { background: rgba(255, 255, 255, 0.15); }
        `;
        document.head.appendChild(style);

        popup = document.createElement('div');
        popup.id = 'ks-popup';
        popup.innerHTML = `
            <div id="ks-header">Key Sequence <span>Alt+N to toggle</span></div>
            <div id="ks-body">
                <label>Letters</label>
                <input type="text" id="ks-sequence" placeholder="abc" autocomplete="off" spellcheck="false" />
                <label>Interval (ms)</label>
                <input type="number" id="ks-interval" value="1000" min="50" step="50" />
                <div id="ks-status" class="stopped">Stopped</div>
                <div id="ks-buttons">
                    <button id="ks-start">Start</button>
                    <button id="ks-stop">Stop</button>
                </div>
            </div>
        `;

        document.body.appendChild(popup);
        makeDraggable();
        setupKeyEvents();
        updateStatusDisplay();
    }

    function makeDraggable() {
        const header = document.getElementById('ks-header');
        let isDragging = false, offsetX, offsetY;
        header.addEventListener('mousedown', (e) => {
            isDragging = true;
            offsetX = e.clientX - popup.offsetLeft;
            offsetY = e.clientY - popup.offsetTop;
        });
        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            popup.style.left = (e.clientX - offsetX) + 'px';
            popup.style.top = (e.clientY - offsetY) + 'px';
        });
        document.addEventListener('mouseup', () => isDragging = false);
    }

    function setupKeyEvents() {
        document.getElementById('ks-start').addEventListener('click', startSequence);
        document.getElementById('ks-stop').addEventListener('click', stopSequence);
        const inputs = popup.querySelectorAll('input');
        inputs.forEach(input => {
            ['keydown', 'keyup', 'keypress'].forEach(event => {
                input.addEventListener(event, (e) => e.stopPropagation());
            });
        });
        document.getElementById('ks-sequence').addEventListener('input', (e) => {
            e.target.value = e.target.value.replace(/[^a-zA-Z]/g, '');
        });
    }

    function updateStatusDisplay() {
        const status = document.getElementById('ks-status');
        if (!status) return;
        if (isRunning) {
            status.className = 'running';
        } else {
            status.textContent = 'Stopped';
            status.className = 'stopped';
        }
    }

    function sendKey(key) {
        const target = document.querySelector('canvas') || document.body;
        const keyCode = key.toUpperCase().charCodeAt(0);
        ['keydown', 'keyup'].forEach(type => {
            target.dispatchEvent(new KeyboardEvent(type, {
                key: key.toLowerCase(),
                code: 'Key' + key.toUpperCase(),
                keyCode: keyCode,
                which: keyCode,
                bubbles: true,
                cancelable: true
            }));
        });
    }

    function startSequence() {
        if (isRunning) return;
        const sequence = document.getElementById('ks-sequence').value.replace(/[^a-zA-Z]/g, '');
        const interval = parseInt(document.getElementById('ks-interval').value) || 1000;
        const status = document.getElementById('ks-status');

        if (sequence.length === 0) {
            status.textContent = 'No letters';
            status.className = 'stopped';
            return;
        }

        isRunning = true;
        currentIndex = 0;
        intervalId = setInterval(() => {
            const key = sequence[currentIndex];
            sendKey(key);
            const statusBox = document.getElementById('ks-status');
            if (statusBox) {
                statusBox.textContent = 'Sending: ' + key.toUpperCase();
                statusBox.className = 'running';
            }
            currentIndex = (currentIndex + 1) % sequence.length;
        }, interval);
        updateStatusDisplay();
    }

    function stopSequence() {
        if (intervalId) { clearInterval(intervalId); intervalId = null; }
        isRunning = false;
        currentIndex = 0;
        updateStatusDisplay();
    }

    function toggleKeyPopup() {
        if (!popup) createKeySequencePopup();
        else popup.style.display = (popup.style.display === 'none' ? 'block' : 'none');
    }


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

    function patchUI() {
        const logo = document.getElementById('logo');
        if (logo && !logo.dataset.ssbagpcmDone) {
            logo.dataset.ssbagpcmDone = '1';
            logo.innerHTML = `<a id="ssbagpcm-brand-link" href="${GITHUB_URL}" style="display:block; width:100%; text-align:center; text-decoration:none; cursor:pointer; color:#fff;">
                <div style="font-weight:900; letter-spacing:0.10em; text-transform:uppercase; font-size: clamp(60px, 6.2vw, 140px); line-height:1; text-shadow: 0 2px 0 rgba(255,255,255,0.12), 0 22px 36px rgba(0,0,0,0.92);">SSBAGPCM</div>
                <div style="margin-top: 6px; font-weight:800; letter-spacing:0.22em; text-transform:uppercase; font-size: clamp(16px, 1.8vw, 30px); opacity:0.92;">Client</div>
            </a>`;
            document.getElementById('ssbagpcm-brand-link').addEventListener('click', (e) => {
                e.preventDefault(); showThanksScreen(); setTimeout(() => { window.location.href = GITHUB_URL; }, 0);
            });
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
            document.getElementById('ssbagpcm-shipyard-btn').addEventListener('click', (e) => {
                e.preventDefault(); showThanksScreen(); setTimeout(() => { window.location.href = SHIPYARD_URL; }, 0);
            });
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
        const t = setInterval(() => {
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
            clearInterval(t);
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
        renderFullscreenScreen('SSBAGPCM CLIENT', 'Loading...');
        window.addEventListener('beforeunload', () => { try { showThanksScreen(); } catch (_) {} });

        const xhr = new XMLHttpRequest();
        xhr.open('GET', 'https://starblast.io');
        xhr.onreadystatechange = function () {
            if (xhr.readyState !== 4) return;
            try {
                let src = xhr.responseText;
                if (!src) return;

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

                setInterval(patchUI, 100);
                installTabIndicator();
                installGemRuntimePatch();

                document.addEventListener('keydown', (e) => {
                    if (e.ctrlKey && e.key.toLowerCase() === 's') { e.preventDefault(); openSettings(); }
                    if (e.altKey && e.key.toLowerCase() === 'n') { e.preventDefault(); e.stopPropagation(); toggleKeyPopup(); }
                }, true);

                const emoteInt = setInterval(() => {
                    if (window.ChatPanel && window.ChatPanel.prototype.typed) {
                        clearInterval(emoteInt);
                        window.ChatPanel.prototype.typed = new Function('return ' + window.ChatPanel.prototype.typed.toString().replace('>=4', '>=ClientStorage.emotes()'))();
                    }
                }, 100);

                console.log('SSBAGPCM Client & Key Sequence Loaded. Alt+N for Key Sequence Menu.');

            } catch (err) { console.error('[ssbagpcm] Error:', err); }
        };
        xhr.send();
    }

    if (window.location.pathname === '/') {
        setTimeout(ClientLoader, 1);
    }

})();
