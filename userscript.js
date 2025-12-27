// ==UserScript==
// @name         SSBAGPCM Client (light)
// @version      1.0.2
// @description  Lightweight client: loader + lowercase names + emote capacity slider + all mods + ad blocking + shipyard button + logo text
// @author       ssbagpcm
// @match        https://starblast.io/
// @grant        none
// ==/UserScript==

'use strict';

/* Defaults */
if (localStorage.getItem('emopacity') === null) localStorage.setItem('emopacity', '5');

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
          width:min(1100px, 92vw);
        }
        .main{
          color:#fff;
          font-weight:800;
          letter-spacing:0.08em;
          text-transform:uppercase;
          font-size:clamp(64px, 8vw, 160px);
          line-height:1.0;
          text-shadow:
            0 2px 0 rgba(255,255,255,0.15),
            0 6px 0 rgba(255,255,255,0.08),
            0 16px 32px rgba(0,0,0,0.85);
        }
        .sub{
          margin-top:16px;
          color:#fff;
          font-weight:600;
          letter-spacing:0.18em;
          text-transform:uppercase;
          font-size:clamp(18px, 2vw, 34px);
          opacity:0.9;
          text-shadow: 0 10px 22px rgba(0,0,0,0.9);
        }
        .spinner{
          width:clamp(60px, 4vw, 96px);
          height:clamp(60px, 4vw, 96px);
          border-radius:999px;
          margin:34px auto 0;
          border:4px solid rgba(255,255,255,0.18);
          border-top-color:#fff;
          animation:spin 0.95s linear infinite;
          filter: drop-shadow(0 18px 24px rgba(0,0,0,0.85));
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
              font-weight:800; letter-spacing:0.08em; text-transform:uppercase;
              font-size:clamp(56px, 7vw, 140px);
              text-shadow: 0 2px 0 rgba(255,255,255,0.12), 0 16px 32px rgba(0,0,0,0.85);
            ">Thanks for using the client</div>
            <div style="
              margin-top:14px; font-weight:600; letter-spacing:0.18em; text-transform:uppercase;
              font-size:clamp(16px, 1.8vw, 30px); opacity:0.9;
            ">${BRAND}</div>
            <div style="
              width:clamp(54px, 4vw, 90px); height:clamp(54px, 4vw, 90px);
              border-radius:999px; margin:28px auto 0;
              border:4px solid rgba(255,255,255,0.18); border-top-color:#fff;
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
  emotes() {
    const n = parseInt(localStorage.getItem('emopacity'), 10);
    return Number.isFinite(n) ? Math.max(1, Math.min(5, n)) : 5;
  }
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
          font-weight:800;
          letter-spacing:0.10em;
          text-transform:uppercase;
          font-size: clamp(44px, 5.8vw, 110px);
          line-height:1;
          text-shadow:
            0 2px 0 rgba(255,255,255,0.12),
            0 7px 0 rgba(255,255,255,0.06),
            0 18px 30px rgba(0,0,0,0.90);
        ">SSBAGPCM</div>
        <div style="
          margin-top: 4px;
          color:#fff;
          font-weight:700;
          letter-spacing:0.22em;
          text-transform:uppercase;
          font-size: clamp(14px, 1.6vw, 26px);
          opacity:0.9;
          text-shadow: 0 12px 22px rgba(0,0,0,0.90);
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
        font-weight:800;
        font-size: 18px;
        letter-spacing:0.12em;
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

      // Emote capacity slider (best-effort)
      try {
        const settingsregex = src.match(/music:\{[^{}]*\},/);
        if (settingsregex && settingsregex[0]) {
          const settingsmatch = settingsregex[0].match(/[iI10OlL]{4,6}/g);
          const keyForStep = (settingsmatch && settingsmatch[0]) ? settingsmatch[0] : 'step';
          src = src.replace(
            settingsregex[0],
            `${settingsregex[0]}emopacity:{name:"Emote Capacity",value:5,skipauto:!0,type:"range",min:1,max:5,${keyForStep}:1,filter:"default,app,mobile"},`
          );
        }

        const beepMatch = src.match(/e\.[iI10OlL]{4,6}\.[iI10OlL]{4,6}\.beep\(4\+\.2\*math\.random\(\)/gi);
        const beepKeys = beepMatch && beepMatch[0] ? beepMatch[0].match(/[iI10OlL]{4,6}/g) : null;

        if (beepKeys && beepKeys.length >= 2) {
          src = src.replace(
            /for\(f=document\.queryselectorall\("\.option\s*input\[type=range\]"\),\s*i=function\(e\)\{.*?,1\)\}\)\}\}/gis,
            `for (f = document.querySelectorAll(".option input[type=range]"), i = function(e) {
              return function(i) {
                if (i.id === "emopacity") {
                  i.addEventListener("input", function (s) {
                    return x = document.querySelector("#" + i.getAttribute("id") + "_value"),
                      x.innerText = parseInt(i.value, 10),
                      e.updateSettings(s, !0)
                  });
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
              }
            }`
          );
        }
      } catch (_) {}

      document.open();
      document.write(src);
      document.close();

      const uiInt = setInterval(patchUI, 100);
      setTimeout(() => clearInterval(uiInt), 4000);

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

      const emoteInt = setInterval(() => {
        if (window.ChatPanel && window.ChatPanel.prototype && typeof window.ChatPanel.prototype.typed === 'function') {
          clearInterval(emoteInt);
          try {
            window.ChatPanel.prototype.typed = new Function(
              'return ' + window.ChatPanel.prototype.typed.toString().replace('>=4', '>=ClientStorage.emotes()')
            )();
          } catch (_) {}
        }
      }, 100);

    } catch (err) {
      console.error('[ssbagpcm] Error:', err);
    }
  };
  xhr.send();
}

if (window.location.pathname === '/') {
  setTimeout(ClientLoader, 1);
}
