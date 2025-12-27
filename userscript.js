// ==UserScript==
// @name         SSBAGPCM Client (light)
// @version      1.0.3
// @description  Lightweight client: big white loader + lowercase names + emote capacity slider + gem colors + all mods + ad blocking + shipyard button + logo link
// @author       ssbagpcm
// @match        https://starblast.io/
// @grant        none
// ==/UserScript==

'use strict';

/* Defaults */
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
        html,body{height:100%; margin:0}
        body{
          background:#000;
          display:flex;
          align-items:center;
          justify-content:center;
          font-family: Arial, Helvetica, sans-serif;
          overflow:hidden;
        }
        .wrap{
          text-align:center;
          padding:24px;
          width:min(1200px, 94vw);
        }
        .main{
          color:#fff;
          font-weight:900;
          letter-spacing:0.10em;
          text-transform:uppercase;
          font-size:clamp(90px, 9vw, 210px);
          line-height:1.0;
          text-shadow:
            0 2px 0 rgba(255,255,255,0.15),
            0 7px 0 rgba(255,255,255,0.08),
            0 20px 40px rgba(0,0,0,0.90);
        }
        .sub{
          margin-top:18px;
          color:#fff;
          font-weight:700;
          letter-spacing:0.22em;
          text-transform:uppercase;
          font-size:clamp(22px, 2.2vw, 42px);
          opacity:0.92;
          text-shadow: 0 14px 26px rgba(0,0,0,0.95);
        }
        .spinner{
          width:clamp(72px, 5vw, 110px);
          height:clamp(72px, 5vw, 110px);
          border-radius:999px;
          margin:40px auto 0;
          border:5px solid rgba(255,255,255,0.18);
          border-top-color:#fff;
          animation:spin 0.95s linear infinite;
          filter: drop-shadow(0 18px 24px rgba(0,0,0,0.90));
        }
        @keyframes spin { to { transform: rotate(360deg); } }
      </style>
    </head>
    <body>
      <div class="wrap">
        <div class="main">${mainText}</div>
        <div class="sub">${subText}</div>
        <div class="spinner" aria-hidden="true"></div>
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
  // Best-effort: some browsers may not paint during unload.
  try {
    if (document && document.body) {
      document.title = BRAND;
      document.body.innerHTML = `
        <div style="
          height:100vh; display:flex; align-items:center; justify-content:center;
          background:#000; color:#fff; font-family: Arial, Helvetica, sans-serif; text-align:center; padding:24px;
        ">
          <div>
            <div style="
              font-weight:900; letter-spacing:0.10em; text-transform:uppercase;
              font-size:clamp(80px, 8vw, 200px);
              line-height:1.0;
              text-shadow: 0 2px 0 rgba(255,255,255,0.12), 0 20px 40px rgba(0,0,0,0.90);
            ">Thanks for using the client</div>
            <div style="
              margin-top:18px; font-weight:700; letter-spacing:0.22em; text-transform:uppercase;
              font-size:clamp(20px, 2vw, 40px); opacity:0.92;
            ">${BRAND}</div>
            <div style="
              width:clamp(72px, 5vw, 110px); height:clamp(72px, 5vw, 110px);
              border-radius:999px; margin:34px auto 0;
              border:5px solid rgba(255,255,255,0.18); border-top-color:#fff;
              animation:spin 0.95s linear infinite;
            "></div>
          </div>
        </div>
        <style>@keyframes spin { to { transform: rotate(360deg); } }</style>
      `;
    }
  } catch (_) {}
}

const Client = new (class {
  checkgame() {
    try {
      return (
        window.location.pathname === '/' &&
        window.module &&
        window.module.exports &&
        window.module.exports.settings &&
        Object.values(window.module.exports.settings).find(e => e && e.mode).mode.id !== 'welcome' &&
        window.location.href !== 'https://starblast.io/#'
      );
    } catch (_) {
      return false;
    }
  }
})();

window.ClientStorage = new (class {
  _readString(key, fallback) {
    const raw = localStorage.getItem(key);
    if (raw == null) {
      localStorage.setItem(key, JSON.stringify(fallback));
      return fallback;
    }
    try {
      const parsed = JSON.parse(raw);
      return typeof parsed === 'string' ? parsed : fallback;
    } catch (_) {
      // Sometimes it may already be stored as "#rrggbb"
      if (typeof raw === 'string' && raw[0] === '#') return raw;
      localStorage.setItem(key, JSON.stringify(fallback));
      return fallback;
    }
  }
  _readInt(key, fallback) {
    const raw = localStorage.getItem(key);
    if (raw == null) {
      localStorage.setItem(key, String(fallback));
      return fallback;
    }
    try {
      const parsed = JSON.parse(raw);
      const n = typeof parsed === 'number' ? parsed : parseInt(String(parsed), 10);
      return Number.isFinite(n) ? n : fallback;
    } catch (_) {
      const n = parseInt(String(raw), 10);
      return Number.isFinite(n) ? n : fallback;
    }
  }
  emotes() {
    const n = this._readInt('emopacity', 5);
    return Math.max(1, Math.min(5, n));
  }
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
  // Replace logo with big clickable text to GitHub (same tab)
  const logo = document.getElementById('logo');
  if (logo && !logo.dataset.ssbagpcmDone) {
    logo.dataset.ssbagpcmDone = '1';
    logo.style.opacity = '1';

    logo.innerHTML = `
      <a id="ssbagpcm-brand-link" href="${GITHUB_URL}" style="
        display:block;
        width:100%;
        text-align:center;
        text-decoration:none;
        user-select:none;
        cursor:pointer;
        padding: 8px 0 2px;
        color:#fff;
      ">
        <div style="
          color:#fff;
          font-family: Arial, Helvetica, sans-serif;
          font-weight:900;
          letter-spacing:0.10em;
          text-transform:uppercase;
          font-size: clamp(60px, 6.2vw, 140px);
          line-height:1;
          text-shadow:
            0 2px 0 rgba(255,255,255,0.12),
            0 7px 0 rgba(255,255,255,0.06),
            0 22px 36px rgba(0,0,0,0.92);
        ">SSBAGPCM</div>
        <div style="
          margin-top: 6px;
          color:#fff;
          font-weight:800;
          letter-spacing:0.22em;
          text-transform:uppercase;
          font-size: clamp(16px, 1.8vw, 30px);
          opacity:0.92;
          text-shadow: 0 14px 26px rgba(0,0,0,0.95);
        ">Client</div>
      </a>
    `;

    const brandLink = document.getElementById('ssbagpcm-brand-link');
    if (brandLink) {
      brandLink.addEventListener('click', (e) => {
        e.preventDefault();
        try { showThanksScreen(); } catch (_) {}
        setTimeout(() => { window.location.href = GITHUB_URL; }, 0);
      });
    }
  }

  // Remove some buttons
  const training = document.getElementById('training');
  if (training) training.remove();
  const facebook = document.querySelector('.social .sbg-facebook');
  if (facebook) facebook.remove();
  const twitter = document.querySelector('.social .sbg-twitter');
  if (twitter) twitter.remove();

  // Replace community links with centered Shipyard button, no borders
  const community = document.querySelector('.textcentered.community.changelog-new');
  if (community && !community.dataset.ssbagpcmShipyard) {
    community.dataset.ssbagpcmShipyard = '1';

    community.style.display = 'flex';
    community.style.justifyContent = 'center';
    community.style.alignItems = 'center';

    community.innerHTML = `
      <a id="ssbagpcm-shipyard-btn" href="${SHIPYARD_URL}" style="
        display:inline-block;
        text-align:center;
        text-decoration:none;
        color:#fff;
        font-weight:900;
        font-size: 18px;
        letter-spacing:0.14em;
        text-transform:uppercase;
        padding: 10px 0;
      ">Shipyard</a>
    `;

    const btn = document.getElementById('ssbagpcm-shipyard-btn');
    if (btn) {
      btn.removeAttribute('target');
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        try { showThanksScreen(); } catch (_) {}
        setTimeout(() => { window.location.href = SHIPYARD_URL; }, 0);
      });
    }
  }
}

function installTabIndicator() {
  const originalTitle = document.title || 'Starblast.io';

  function updateTitle() {
    if (!document.hidden) {
      document.title = originalTitle;
      return;
    }
    document.title = Client.checkgame()
      ? '🔴 In game - Starblast'
      : '🟢 Not in game - Starblast';
  }

  document.addEventListener('visibilitychange', updateTitle);
  window.addEventListener('focus', () => { document.title = originalTitle; });
}

function installGemRuntimePatch() {
  // Applies gem colors in-game by overriding the Crystal model material colors.
  const t = setInterval(() => {
    let CrystalObject = null;

    for (const k in window) {
      try {
        const val = window[k];
        if (val && val.prototype && typeof val.prototype.createModel === 'function') {
          const s = Function.prototype.toString.call(val.prototype.createModel);
          if (s.includes('Crystal')) {
            CrystalObject = val;
            break;
          }
        }
      } catch (_) {}
    }

    if (!CrystalObject) return;

    clearInterval(t);

    const old = CrystalObject.prototype.getModelInstance;
    if (typeof old !== 'function') return;

    CrystalObject.prototype.getModelInstance = function () {
      const res = old.apply(this, arguments);
      try {
        const color = window.ClientStorage.gem1();
        const spec = window.ClientStorage.gem2();
        if (this && this.material && this.material.color && typeof this.material.color.set === 'function') {
          this.material.color.set(color);
        }
        if (this && this.material && this.material.specular && typeof this.material.specular.set === 'function') {
          this.material.specular.set(spec);
        }
      } catch (_) {}
      return res;
    };
  }, 100);
}

async function ClientLoader() {
  renderFullscreenScreen('SSBAGPCM CLIENT', 'Loading...');

  window.addEventListener('beforeunload', () => {
    try { showThanksScreen(); } catch (_) {}
  });

  const xhr = new XMLHttpRequest();
  xhr.open('GET', 'https://starblast.io');
  xhr.onreadystatechange = function () {
    if (xhr.readyState !== 4) return;

    try {
      let src = xhr.responseText;
      if (!src) return;

      // Lowercase names
      src = src.replace(/\.toUpperCase\(\)/g, '');
      src = src.replace(/text-transform:\s*uppercase;/gim, '');

      // All mods always available
      src = src.replace(
        'https://starblast.io/modsinfo.json',
        'https://raw.githubusercontent.com/officialtroller/starblast-things/refs/heads/main/modsinfo.js'
      );

      // Ad blocking
      src = src.replace('html5.api.gamedistribution.com/libs/gd/api.js', 'ads.blocked');
      src = src.replace('https://sdk.crazygames.com/crazygames-sdk-v1.js', 'https://ads.blocked');
      src = src.replace('api.adinplay.com/libs/aiptag/pub/NRN/starblast.io/tag.min.js', 'ads.blocked');

      // Add "color" input support in settings menu (best-effort)
      try {
        const reegtest = src.match(
          /if\("select"!==(\w+\.)type\)e\+='<div\s*class="option">'\+t\(\w+\.name\)\+'<label\s*class="switch"><input\s*type="checkbox"\s*'\+\(\w+\.value\?'checked="checked"':""\)\+'\s*id="'\+(\w+)\+'""><div\s*class="slider"><\/div><\/label><\/div>';/
        );

        if (reegtest && reegtest[0]) {
          src = src.replace(
            reegtest[0],
            `if ("select" !== ${reegtest[1]}type) if ("color" === ${reegtest[1]}type) { e += '<div class="option">' + t(${reegtest[1]}name) + '<div class="range" style="cursor:pointer;">' + '<input id="' + ${reegtest[2]} + '" type="color" style="width:140px;height:32px;border:0;background:transparent;cursor:pointer;">' + '<span id="' + ${reegtest[2]} + '_value" style="margin-left:10px;">' + ${reegtest[1]}value + '</span>' + '</div></div>'; } else { e+='<div class="option">'+t(${reegtest[1]}name)+'<label class="switch"><input type="checkbox" '+(${reegtest[1]}value?'checked="checked"':"")+' id="'+ ${reegtest[2]} +'""><div class="slider"></div></label></div>'}`
          );
        }
      } catch (_) {}

      // Add settings entries: emote capacity + gem colors (best-effort)
      try {
        const settingsregex = src.match(/music:\{[^{}]*\},/);
        if (settingsregex && settingsregex[0]) {
          const settingsmatch = settingsregex[0].match(/[iI10OlL]{4,6}/g);
          const keyForStep = (settingsmatch && settingsmatch[0]) ? settingsmatch[0] : 'step';

          src = src.replace(
            settingsregex[0],
            `${settingsregex[0]}emopacity:{name:"Emote Capacity",value:5,skipauto:!0,type:"range",min:1,max:5,${keyForStep}:1,filter:"default,app,mobile"},gemindeed:{name:"Gem Color 1",value:ClientStorage.gem1(),skipauto:!0,type:"color",filter:"default,app,mobile"},gemindeed1:{name:"Gem Color 2",value:ClientStorage.gem2(),skipauto:!0,type:"color",filter:"default,app,mobile"},`
          );
        }

        // Make the settings handler handle range + color inputs, and show integer for emopacity
        const beepMatch = src.match(/e\.[iI10OlL]{4,6}\.[iI10OlL]{4,6}\.beep\(4\+\.2\*math\.random\(\)/gi);
        const beepKeys = beepMatch && beepMatch[0] ? beepMatch[0].match(/[iI10OlL]{4,6}/g) : null;

        if (beepKeys && beepKeys.length >= 2) {
          src = src.replace(
            /for\(f=document\.queryselectorall\("\.option\s*input\[type=range\]"\),\s*i=function\(e\)\{.*?,1\)\}\)\}\}/gis,
            `for (f = document.querySelectorAll(".option input[type=range], .option input[type=color]"), i = function(e) {
              return function(i) {
                if (i.type === "range") {
                  if (i.id === "emopacity") {
                    i.addEventListener("input", function (s) {
                      return x = document.querySelector("#" + i.getAttribute("id") + "_value"),
                        x.innerText = parseInt(i.value, 10),
                        e.updateSettings(s, !0)
                    });
                    i.dispatchEvent(new Event("input"));
                  } else {
                    if (
                      i.addEventListener("input", function (s) {
                        return x = document.querySelector("#" + i.getAttribute("id") + "_value"),
                          x.innerText = "0" === i.value ? t("Off") : Math.round(50 * i.value) + " %",
                          e.updateSettings(s, !0)
                      }),
                      i.dispatchEvent(new Event("input")),
                      "sounds" === i.id
                    ) return i.addEventListener("change", function (t) {
                      return e.${beepKeys[0]}.${beepKeys[1]}.beep(4 + .2 * Math.random(), 1)
                    })
                  }
                } else if (i.type === "color") {
                  const update = function (s) {
                    var x = document.querySelector("#" + i.getAttribute("id") + "_value");
                    if (x) x.innerText = i.value;
                    return e.updateSettings(s, !0);
                  };
                  i.addEventListener("input", update);
                  // Initialize from storage so it matches what you saved
                  try {
                    if (i.id === "gemindeed") i.value = ClientStorage.gem1();
                    if (i.id === "gemindeed1") i.value = ClientStorage.gem2();
                    var x0 = document.querySelector("#" + i.getAttribute("id") + "_value");
                    if (x0) x0.innerText = i.value;
                  } catch (_){}
                }
              }
            }`
          );
        }
      } catch (_) {}

      document.open();
      document.write(src);
      document.close();

      // UI patches
      const uiInt = setInterval(patchUI, 100);
      setTimeout(() => clearInterval(uiInt), 4000);

      // Ctrl+S opens settings
      document.addEventListener('keydown', function (e) {
        if (e.ctrlKey && (e.key === 's' || e.key === 'S')) {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          openSettings();
          return false;
        }
      });

      installTabIndicator();

      // Emote capacity: ensure the in-game check actually uses your setting value
      const emoteInt = setInterval(() => {
        if (window.ChatPanel && window.ChatPanel.prototype && typeof window.ChatPanel.prototype.typed === 'function') {
          clearInterval(emoteInt);
          try {
            // Replace the hardcoded ">=4" with ">=ClientStorage.emotes()"
            window.ChatPanel.prototype.typed = new Function(
              'return ' + window.ChatPanel.prototype.typed.toString().replace('>=4', '>=ClientStorage.emotes()')
            )();
          } catch (_) {}
        }
      }, 100);

      // Gem colors runtime application
      installGemRuntimePatch();

    } catch (err) {
      console.error('[ssbagpcm] Error:', err);
    }
  };
  xhr.send();
}

if (window.location.pathname === '/') {
  setTimeout(ClientLoader, 1);
}
