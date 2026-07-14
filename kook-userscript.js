const fs = require('fs');
const path = require('path');

const src = __dirname;
const verFile = path.join(src, '.version');

// read current version, bump patch
let ver = '1.0';
if (fs.existsSync(verFile)) {
  ver = fs.readFileSync(verFile, 'utf8').trim();
}
const parts = ver.split('.');
parts[parts.length - 1] = String(Number(parts[parts.length - 1]) + 1);
const nextVer = parts.join('.');
fs.writeFileSync(verFile, nextVer);

const css = fs.readFileSync(path.join(src, 'src', 'kook-adblock.css'), 'utf8');
const sound = fs.readFileSync(path.join(src, 'src', 'kook-sound.js'), 'utf8');
const enhance = fs.readFileSync(path.join(src, 'src', 'kook-enhance.js'), 'utf8');
const noStreamer = fs.readFileSync(path.join(src, 'src', 'kook-no-streamer-mode.js'), 'utf8');

// strip outer IIFE wrappers and extract inner code
const inner = (fn) => {
  let body = fn.replace(/^\(function\s*\(\)\s*\{/, '').replace(/\}\)\(\);?\s*$/, '');
  body = body.replace(/^\s*'use strict';\s*/m, '');
  return body.trim();
};

const meta = `// ==UserScript==
// @name         KOOK净化
// @namespace    https://greasyfork.org/zh-CN/scripts/546095
// @version      ${nextVer}
// @description  隐藏KOOK网页版广告，替换入场音效，禁用主播模式进程检测
// @author       KOOK Purifier
// @match        https://www.kookapp.cn/*
// @match        https://kookapp.cn/*
// @icon         https://www.kookapp.cn/favicon.ico
// @grant        none
// @downloadURL  https://greasyfork.org/zh-CN/scripts/546095-kook%E5%87%80%E5%8C%96/code/koOK%E5%87%80%E5%8C%96.user.js
// @updateURL    https://greasyfork.org/zh-CN/scripts/546095-kook%E5%87%80%E5%8C%96/code/koOK%E5%87%80%E5%8C%96.meta.js
// ==/UserScript==
`;

const out = meta + `\n(function () {\n"use strict";\n\n${inner(sound)}\n\n${inner(enhance)}\n\n${inner(noStreamer)}\n\nconst s = document.createElement("style");\ns.textContent = \`\n${css}\n\`;\ndocument.head.appendChild(s);\nconsole.log("[KOOK净化]");\n})();\n`;

const dist = path.join(src, 'dist');
if (!fs.existsSync(dist)) fs.mkdirSync(dist);
const outPath = path.join(dist, 'kook净化.js');

fs.writeFileSync(outPath, out);

console.log(`[OK] dist/kook净化.js v${nextVer} (${out.length} chars)`);
