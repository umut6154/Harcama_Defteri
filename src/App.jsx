import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Pencil, Trash2, Cloud, Download, Upload, CircleDot, Plus } from 'lucide-react';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip } from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, onSnapshot, setDoc } from 'firebase/firestore';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip);

/* ---------- Firebase (Google girişi) ----------
   Değerler Firebase Console > Proje ayarları > Web uygulaması (Hesap) bölümünden.
   İstersen .env ile (VITE_FIREBASE_*) üzerine yazabilirsin. */
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyB042bsauPaln_IaNQuCbvNKC_kdxg7Yk8',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'hesap-e6709.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'hesap-e6709',
  storageBucket: 'hesap-e6709.firebasestorage.app',
  messagingSenderId: '741274434933',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:741274434933:web:8522dd927a08d2088f273c',
};
const getFirebaseApp = () => {
  if (!firebaseConfig.apiKey) return null;
  return getApps().length ? getApp() : initializeApp(firebaseConfig);
};
const getFirebaseAuth = () => {
  const app = getFirebaseApp();
  return app ? getAuth(app) : null;
};
const getFirebaseDb = () => {
  const app = getFirebaseApp();
  return app ? getFirestore(app) : null;
};

/* ---------- Sabitler ---------- */
const CATEGORIES = {
  gider: [
    { name: 'Yemek', icon: '🍽️' },
    { name: 'Market', icon: '🛒' },
    { name: 'Yurt/KYK', icon: '🏠' },
    { name: 'Abonelik', icon: '📺' },
    { name: 'Eğlence', icon: '🎬' },
    { name: 'Kişisel Bakım', icon: '💈' },
    { name: 'Ulaşım', icon: '🚌' },
    { name: 'Diğer', icon: '📦' },
  ],
  gelir: [
    { name: 'Burs/Harçlık', icon: '🎓' },
    { name: 'Maaş', icon: '💼' },
    { name: 'Diğer Gelir', icon: '💵' },
  ],
};
const CAT_COLORS = { 'Yemek': '#ff8a3d', 'Market': '#34e8a0', 'Yurt/KYK': '#5b8bff', 'Abonelik': '#a05bff', 'Eğlence': '#ff5c8a', 'Kişisel Bakım': '#22d3ee', 'Ulaşım': '#ffc857', 'Diğer': '#9aa0d8', 'Burs/Harçlık': '#34e8a0', 'Maaş': '#22d3ee', 'Diğer Gelir': '#7dffc0' };
const colorOf = (name) => CAT_COLORS[name] || '#9aa0d8';
const ALL_CATEGORIES = [...CATEGORIES.gider, ...CATEGORIES.gelir];
const iconOf = (name) => ALL_CATEGORIES.find((c) => c.name === name)?.icon || '📦';
const MONTHS_TR = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];

/* ---------- Yardımcılar ---------- */
const pad = (n) => String(n).padStart(2, '0');
const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const fmt = (n) => Number(n).toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 2, useGrouping: 'always' });
const fmt2 = (n) => Number(n).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: 'always' });
const trDate = (iso) => iso.split('-').reverse().join('.');
const monthLabel = (ym) => {
  const [y, m] = ym.split('-');
  return `${MONTHS_TR[parseInt(m, 10) - 1]} ${y}`;
};
const readJSON = (key, fallback) => {
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : fallback;
  } catch {
    return fallback;
  }
};

/* ---------- Yedek dosyası okuyucu (eski/farklı formatları da tanır) ---------- */
const pick = (o, keys) => {
  for (const k of keys) if (o[k] !== undefined && o[k] !== null && o[k] !== '') return o[k];
  return undefined;
};
const toNumber = (v) => {
  if (typeof v === 'number') return v;
  if (typeof v !== 'string') return NaN;
  let t = v.replace(/[₺\s]/g, '').replace(/^\+/, '');
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
  return parseFloat(t);
};
const toDateStr = (v) => {
  if (v === undefined || v === null) return null;
  if (typeof v === 'object' && typeof v.seconds === 'number') v = v.seconds * 1000; // Firestore Timestamp
  if (typeof v === 'number') {
    const d = new Date(v < 1e12 ? v * 1000 : v);
    return isNaN(d) ? null : `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }
  const t = String(v).trim();
  let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${pad(+m[2])}-${pad(+m[3])}`;
  m = t.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})/);
  if (m) return `${m[3]}-${pad(+m[2])}-${pad(+m[1])}`;
  const d = new Date(t);
  return isNaN(d) ? null : `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const looksLikeTx = (o) =>
  o && typeof o === 'object' && !Array.isArray(o) &&
  pick(o, ['amount', 'tutar', 'miktar', 'value', 'price', 'total']) !== undefined;
const findTxArray = (node, depth = 0) => {
  if (depth > 5 || node === null || typeof node !== 'object') return null;
  if (Array.isArray(node)) return node.some(looksLikeTx) ? node : null;
  let best = null;
  for (const v of Object.values(node)) {
    const r = Array.isArray(v) ? (v.some(looksLikeTx) ? v : null) : findTxArray(v, depth + 1);
    if (r && (!best || r.length > best.length)) best = r;
  }
  return best;
};
const findInitial = (node, depth = 0) => {
  if (depth > 3 || node === null || typeof node !== 'object' || Array.isArray(node)) return undefined;
  const v = pick(node, ['initialBalance', 'baslangicBakiye', 'başlangıçBakiyesi', 'baslangicBakiyesi', 'startBalance', 'openingBalance', 'startingBalance']);
  if (v !== undefined && !isNaN(toNumber(v))) return toNumber(v);
  for (const c of Object.values(node)) {
    const r = findInitial(c, depth + 1);
    if (r !== undefined) return r;
  }
  return undefined;
};
const cleanCat = (raw, type) => {
  const list = CATEGORIES[type].map((c) => c.name);
  const t = String(raw || '').replace(/[^\p{L}\p{N}/ ]/gu, '').trim().toLocaleLowerCase('tr');
  const hit = list.find((n) => n.toLocaleLowerCase('tr') === t) || ALL_CATEGORIES.find((c) => c.name.toLocaleLowerCase('tr') === t)?.name;
  if (hit && list.includes(hit)) return hit;
  return type === 'gelir' ? 'Diğer Gelir' : 'Diğer';
};
const normalizeBackup = (parsed) => {
  const arr = findTxArray(parsed);
  if (!arr) return { list: [], initial: undefined };
  const stamp = Date.now();
  const list = arr
    .filter(looksLikeTx)
    .map((o, i) => {
      let amt = toNumber(pick(o, ['amount', 'tutar', 'miktar', 'value', 'price', 'total']));
      if (isNaN(amt) || amt === 0) return null;
      const rawType = String(pick(o, ['type', 'tip', 'tur', 'tür', 'kind', 'direction']) ?? '').toLocaleLowerCase('tr');
      let type;
      if (/gelir|income|in$|credit|\+/.test(rawType)) type = 'gelir';
      else if (/gider|expense|out$|debit|-/.test(rawType)) type = 'gider';
      else {
        const c = String(pick(o, ['category', 'kategori', 'cat']) ?? '');
        type = amt < 0 ? 'gider' : ALL_CATEGORIES.slice(CATEGORIES.gider.length).some((x) => c.includes(x.name)) ? 'gelir' : 'gider';
      }
      amt = Math.abs(amt);
      const date = toDateStr(pick(o, ['date', 'tarih', 'createdAt', 'created_at', 'timestamp', 'time']));
      if (!date) return null;
      return {
        id: String(pick(o, ['id', '_id']) ?? stamp + i),
        type,
        amount: amt,
        category: cleanCat(pick(o, ['category', 'kategori', 'cat']), type),
        date,
        description: String(pick(o, ['description', 'aciklama', 'açıklama', 'note', 'not', 'title', 'name', 'baslik']) ?? '').trim(),
      };
    })
    .filter(Boolean);
  // aynı id'ler çakışırsa benzersiz yap
  const seen = new Set();
  list.forEach((t, i) => {
    while (seen.has(t.id)) t.id = `${t.id}_${i}`;
    seen.add(t.id);
  });
  return { list, initial: findInitial(parsed) };
};

/* ---------- Stil (Tailwind GEREKMEZ, tamamen bu dosyada) ---------- */
const CSS = `
*, *::before, *::after { box-sizing: border-box; }
html, body { margin: 0; padding: 0; display: block; width: 100%; max-width: none; min-width: 0; background: #0b0c1a; text-align: left; }
#root { max-width: none; width: 100%; margin: 0; padding: 0; text-align: left; }
button, input, select { font-family: inherit; }
.hk { position: relative; overflow: hidden; text-align: left; min-height: 100vh; background: #0b0c1a; color: #e8e9f5; font-family: 'Segoe UI', system-ui, -apple-system, Roboto, Helvetica, Arial, sans-serif; padding: 28px 20px 40px; }
.hk::before, .hk::after { content: ''; position: fixed; width: 520px; height: 520px; border-radius: 50%; filter: blur(110px); opacity: .22; pointer-events: none; z-index: 0; animation: hk-drift 22s ease-in-out infinite alternate; }
.hk::before { top: -160px; left: -120px; background: #6a5cff; }
.hk::after { bottom: -200px; right: -140px; background: #12c8e8; animation-delay: -9s; }
.hk-wrap { position: relative; z-index: 1; max-width: 1100px; margin: 0 auto; display: flex; flex-direction: column; gap: 20px; }
.hk h1, .hk h2, .hk h3, .hk p { margin: 0; }

.hk-head { display: flex; flex-direction: column; gap: 2px; }
.hk-brand { display: flex; align-items: center; gap: 12px; }
.hk-logo { width: 38px; height: 38px; border-radius: 12px; background: linear-gradient(135deg, #5b63ff, #a05bff); display: grid; place-items: center; font-size: 22px; font-weight: 800; color: #fff; box-shadow: 0 6px 20px rgba(124,92,255,.5); animation: hk-float 3.6s ease-in-out infinite; }
.hk-title { font-size: 28px; font-weight: 800; letter-spacing: -0.01em; background: linear-gradient(90deg, #fff 30%, #9fb4ff 70%, #5fe3f5); -webkit-background-clip: text; background-clip: text; color: transparent; }
.hk-sub { font-size: 13px; color: #9a9dc0; }
.hk-user { font-size: 12px; color: #7f83a8; }

.hk-balance { position: relative; overflow: hidden; border-radius: 26px; padding: 26px 28px; background: linear-gradient(110deg, #4f5bff, #8b4fff, #c24bff, #4f5bff); background-size: 300% 100%; animation: hk-rise .7s cubic-bezier(.2,.8,.2,1) both, hk-flow 14s linear infinite; box-shadow: 0 18px 48px rgba(110,80,255,.38); }
.hk-balance::after { content: ''; position: absolute; top: 0; bottom: 0; width: 40%; left: -60%; background: linear-gradient(100deg, transparent, rgba(255,255,255,.22), transparent); transform: skewX(-18deg); animation: hk-shine 1.4s .5s ease-out 1 both; }
.hk-balance .lbl { font-size: 13px; color: rgba(255,255,255,.85); }
.hk-balance .big { margin-top: 4px; font-size: 48px; line-height: 1.1; font-weight: 800; color: #fff; letter-spacing: -0.02em; text-shadow: 0 4px 24px rgba(0,0,0,.25); }
.hk-balance .row { margin-top: 18px; display: flex; gap: 12px; flex-wrap: wrap; }
.hk-balance .row > div { background: rgba(255,255,255,.14); border: 1px solid rgba(255,255,255,.18); backdrop-filter: blur(6px); border-radius: 16px; padding: 10px 16px; min-width: 150px; }
.hk-balance .row b { display: block; font-size: 18px; font-weight: 700; color: #fff; }
.hk-balance .row > div:first-child b::before { content: '▲ '; font-size: 11px; color: #7dffc0; }
.hk-balance .row > div:last-child b::before { content: '▼ '; font-size: 11px; color: #ffb3c6; }

.hk-sumhead { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
.hk-sumhead h2 { font-size: 18px; font-weight: 700; color: #fff; }
.hk-select { background: #151833; color: #fff; border: 1px solid #3a3f73; border-radius: 10px; padding: 7px 14px; font-size: 14px; cursor: pointer; outline: none; transition: border-color .2s, box-shadow .2s; }
.hk-select:hover { border-color: #22d3ee; }
.hk-select:focus { box-shadow: 0 0 0 3px rgba(34,211,238,.35); }

.hk-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.hk-panel { background: linear-gradient(160deg, #181b3a, #121530); border: 1px solid #292d57; border-radius: 18px; padding: 18px; min-height: 210px; display: flex; flex-direction: column; animation: hk-rise .6s .12s cubic-bezier(.2,.8,.2,1) both; transition: border-color .25s, transform .25s; }
.hk-panel:hover { border-color: #4a50a0; transform: translateY(-2px); }
.hk-panel h3 { font-size: 14px; font-weight: 600; color: #a9adcf; margin-bottom: 14px; }
.hk-empty { font-size: 12px; color: #7f83a8; }
.hk-cat { margin-bottom: 14px; }
.hk-cat-top { display: flex; justify-content: space-between; font-size: 14px; color: #f1f2fb; }
.hk-cat-top span:last-child { font-weight: 600; }
.hk-bar { margin-top: 7px; height: 9px; border-radius: 999px; background: #1f2347; overflow: hidden; }
.hk-bar > i { display: block; height: 100%; border-radius: 999px; background: linear-gradient(90deg, #5b63ff, #8f7bff); transform-origin: left; animation: hk-grow .9s cubic-bezier(.2,.8,.2,1) both; }
.hk-chart { flex: 1; min-height: 140px; position: relative; }

.hk-date { font-size: 12px; font-weight: 600; color: #8d92c4; margin: 18px 0 8px 4px; }
.hk-list { display: flex; flex-direction: column; gap: 8px; }
.hk-item { display: flex; align-items: center; justify-content: space-between; gap: 12px; background: #141731; border: 1px solid #25294d; border-left: 3px solid #ff5c8a; border-radius: 14px; padding: 10px 14px; animation: hk-slide .45s cubic-bezier(.2,.8,.2,1) both; transition: transform .2s, background .2s, border-color .2s; }
.hk-item:nth-child(2) { animation-delay: .05s; } .hk-item:nth-child(3) { animation-delay: .1s; } .hk-item:nth-child(4) { animation-delay: .15s; } .hk-item:nth-child(n+5) { animation-delay: .2s; }
.hk-item:hover { transform: translateX(4px); background: #1a1e40; border-color: #3b4087; border-left-color: inherit; }
.hk-item-l { display: flex; align-items: center; gap: 12px; min-width: 0; }
.hk-ico { width: 38px; height: 38px; border-radius: 12px; background: rgba(255,92,138,.16); display: grid; place-items: center; font-size: 17px; flex-shrink: 0; transition: transform .25s; }
.hk-item:hover .hk-ico { transform: scale(1.12) rotate(-6deg); }
.hk-item-t { min-width: 0; }
.hk-item-t b { display: block; font-size: 14px; font-weight: 700; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.hk-item-t small { display: block; font-size: 11px; color: #8d92c4; margin-top: 1px; }
.hk-item-r { display: flex; align-items: center; gap: 12px; flex-shrink: 0; }
.hk-amt { font-size: 14px; font-weight: 700; }
.hk-amt.out { color: #ff6b93; }
.hk-amt.in { color: #34e8a0; }
.hk-icon-btn { background: none; border: 0; padding: 4px; border-radius: 8px; cursor: pointer; display: grid; place-items: center; color: #8d92c4; transition: color .15s, background .15s, transform .15s; }
.hk-icon-btn:hover { color: #22d3ee; background: rgba(34,211,238,.12); transform: scale(1.15); }
.hk-icon-btn.del { color: #8d92c4; }
.hk-icon-btn.del:hover { color: #ff5c8a; background: rgba(255,92,138,.14); }
.hk-icon-btn svg { width: 15px; height: 15px; }
.hk-none { font-size: 13px; color: #8d92c4; padding: 18px 0; }

.hk-foot { display: flex; flex-wrap: wrap; gap: 8px; padding: 12px 0 130px; }
.hk-fbtn { display: inline-flex; align-items: center; gap: 6px; padding: 8px 14px; border-radius: 12px; border: 1px solid #2d3260; background: #151833; color: #e8e9f5; font-size: 12px; cursor: pointer; transition: background .2s, border-color .2s, transform .2s, box-shadow .2s; }
.hk-fbtn:hover { background: #1c2048; border-color: #22d3ee; transform: translateY(-2px); box-shadow: 0 8px 20px rgba(34,211,238,.15); }
.hk-fbtn svg { width: 14px; height: 14px; color: #22d3ee; }
.hk-file { display: none; }

.hk-fab { position: fixed; right: 32px; bottom: calc(88px + env(safe-area-inset-bottom, 0px)); width: 54px; height: 54px; border-radius: 50%; border: 0; background: linear-gradient(135deg, #5b63ff, #a05bff); color: #fff; display: grid; place-items: center; cursor: pointer; box-shadow: 0 10px 28px rgba(124,92,255,.55); transition: transform .2s; z-index: 20; animation: hk-pulse 2.8s ease-out infinite; }
.hk-fab:hover { transform: rotate(90deg) scale(1.08); }
.hk-fab:active { transform: scale(.9); }
.hk-fab svg { width: 26px; height: 26px; }

.hk-overlay { position: fixed; inset: 0; background: rgba(5,6,16,.72); backdrop-filter: blur(4px); display: grid; place-items: center; padding: 16px; z-index: 50; animation: hk-fade .2s both; }
.hk-modal { width: 100%; max-width: 380px; background: linear-gradient(160deg, #1a1d40, #12142a); border: 1px solid #333873; border-radius: 20px; padding: 22px; box-shadow: 0 24px 60px rgba(0,0,0,.6), 0 0 40px rgba(124,92,255,.18); animation: hk-pop .3s cubic-bezier(.2,1.2,.3,1) both; }
.hk-modal h3 { font-size: 16px; font-weight: 700; color: #fff; margin-bottom: 16px; }
.hk-overlay.top { z-index: 60; }
.hk-dlg-msg { font-size: 14px; line-height: 1.5; color: #e8e9f5; margin: 0 0 14px; white-space: pre-line; }
.hk-form { display: flex; flex-direction: column; gap: 12px; }
.hk-two { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.hk-type { padding: 10px; border-radius: 12px; border: 0; background: #20244a; color: #e8e9f5; font-size: 14px; font-weight: 600; cursor: pointer; transition: background .2s, transform .15s; }
.hk-type:hover { transform: translateY(-1px); }
.hk-type.on-out { background: linear-gradient(135deg, #ff4f86, #ff7a6b); color: #fff; }
.hk-type.on-in { background: linear-gradient(135deg, #2ee89a, #5bf0c8); color: #06210f; }
.hk-label { display: block; }
.hk-label span { display: block; font-size: 11px; color: #9a9dc0; margin-bottom: 4px; }
.hk-input { width: 100%; background: #1c1f42; border: 1px solid #30356a; border-radius: 12px; padding: 10px 14px; font-size: 14px; color: #fff; outline: none; color-scheme: dark; transition: border-color .2s, box-shadow .2s; }
.hk-input::placeholder { color: #666b95; }
.hk-input:focus { border-color: #22d3ee; box-shadow: 0 0 0 3px rgba(34,211,238,.22); }
.hk-cancel, .hk-save { padding: 10px; border-radius: 12px; border: 0; font-size: 14px; font-weight: 600; cursor: pointer; transition: background .2s, transform .15s, box-shadow .2s; }
.hk-cancel { background: #20244a; color: #e8e9f5; }
.hk-cancel:hover { background: #2a2f5c; }
.hk-save { background: linear-gradient(135deg, #5b63ff, #a05bff); color: #fff; }
.hk-save:hover { transform: translateY(-1px); box-shadow: 0 8px 20px rgba(124,92,255,.45); }

@keyframes hk-rise { from { opacity: 0; transform: translateY(18px); } to { opacity: 1; transform: none; } }
@keyframes hk-slide { from { opacity: 0; transform: translateX(-14px); } to { opacity: 1; transform: none; } }
@keyframes hk-grow { from { transform: scaleX(0); } to { transform: scaleX(1); } }
@keyframes hk-flow { to { background-position: 300% 0; } }
@keyframes hk-shine { to { left: 130%; } }
@keyframes hk-float { 0%,100% { transform: translateY(0) rotate(0); } 50% { transform: translateY(-4px) rotate(-4deg); } }
@keyframes hk-drift { to { transform: translate(60px, 40px) scale(1.15); } }
@keyframes hk-pulse { 0% { box-shadow: 0 10px 28px rgba(124,92,255,.55), 0 0 0 0 rgba(124,92,255,.5); } 70%,100% { box-shadow: 0 10px 28px rgba(124,92,255,.55), 0 0 0 18px rgba(124,92,255,0); } }
@keyframes hk-fade { from { opacity: 0; } to { opacity: 1; } }
@keyframes hk-pop { from { opacity: 0; transform: scale(.9) translateY(10px); } to { opacity: 1; transform: none; } }

@media (max-width: 720px) {
  .hk { padding: 20px 14px 40px; }
  .hk-grid { grid-template-columns: 1fr; }
  .hk-balance .big { font-size: 38px; }
  .hk-balance .row > div { flex: 1; min-width: 130px; }
  .hk-fab { right: 18px; bottom: calc(88px + env(safe-area-inset-bottom, 0px)); }
}
@media (prefers-reduced-motion: reduce) {
  .hk *, .hk::before, .hk::after { animation: none !important; transition: none !important; }
}
/* ===== Renk paleti ve ek animasyonlar ===== */
.hk { background-image: radial-gradient(900px 520px at 88% 0%, rgba(255,92,138,.11), transparent 60%), radial-gradient(800px 520px at 0% 100%, rgba(34,211,238,.09), transparent 60%); }
.hk-title { background: linear-gradient(90deg, #fff, #9fb4ff, #5fe3f5, #ffb36b, #ff7aa8, #fff); background-size: 250% 100%; -webkit-background-clip: text; background-clip: text; color: transparent; animation: hk-title 9s linear infinite; }
.hk-sumhead h2 { background: linear-gradient(90deg, #ffc857, #ff5c8a); -webkit-background-clip: text; background-clip: text; color: transparent; }
.hk-balance .row > div:first-child { background: rgba(52,232,160,.22); border-color: rgba(125,255,192,.4); }
.hk-balance .row > div:last-child { background: rgba(255,92,138,.24); border-color: rgba(255,179,198,.4); }
.hk-balance .row > div { transition: transform .25s; }
.hk-balance .row > div:hover { transform: translateY(-3px) scale(1.03); }
.hk-balance .big, .hk-amt { font-variant-numeric: tabular-nums; }

.hk-grid > .hk-panel:nth-child(1) { border-top: 3px solid #a05bff; background: linear-gradient(160deg, #271b52, #121530 70%); }
.hk-grid > .hk-panel:nth-child(1) h3 { color: #cdb0ff; }
.hk-grid > .hk-panel:nth-child(2) { border-top: 3px solid #22d3ee; background: linear-gradient(160deg, #0d2e3e, #121530 70%); animation-delay: .24s; }
.hk-grid > .hk-panel:nth-child(2) h3 { color: #7eeaf7; }

.hk-bar { background: rgba(255,255,255,.07); }
.hk-bar > i { position: relative; background: linear-gradient(90deg, var(--c, #7c83ff), color-mix(in srgb, var(--c, #7c83ff) 55%, #fff)); box-shadow: 0 0 12px color-mix(in srgb, var(--c, #7c83ff) 55%, transparent); }
.hk-bar > i::after { content: ''; position: absolute; inset: 0; background: linear-gradient(100deg, transparent 30%, rgba(255,255,255,.5) 50%, transparent 70%); background-size: 220% 100%; animation: hk-sweep 2.8s linear infinite; }
.hk-cat-top span:first-child { transition: transform .2s; }
.hk-cat:hover .hk-cat-top span:first-child { transform: translateX(4px); color: var(--c); }

.hk-date { display: inline-block; background: rgba(34,211,238,.12); color: #7eeaf7; border: 1px solid rgba(34,211,238,.25); padding: 3px 12px; border-radius: 999px; margin: 18px 0 8px 2px; }
.hk-item { border-left-color: var(--c, #ff5c8a); }
.hk-item:hover { border-color: color-mix(in srgb, var(--c, #7c83ff) 55%, #25294d); border-left-color: var(--c, #ff5c8a); box-shadow: 0 8px 26px color-mix(in srgb, var(--c, #7c83ff) 25%, transparent); }
.hk-ico { background: color-mix(in srgb, var(--c, #ff5c8a) 22%, transparent); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--c, #ff5c8a) 40%, transparent); }
.hk-item:hover .hk-ico { transform: scale(1.15) rotate(-8deg); }

.hk-fbtn:nth-of-type(1) { --b: #22d3ee; } .hk-fbtn:nth-of-type(2) { --b: #34e8a0; } .hk-fbtn:nth-of-type(3) { --b: #ffc857; } .hk-fbtn:nth-of-type(4) { --b: #ff5c8a; }
.hk-fbtn { border-color: color-mix(in srgb, var(--b, #2d3260) 40%, #2d3260); }
.hk-fbtn svg { color: var(--b, #22d3ee); transition: transform .3s; }
.hk-fbtn:hover { border-color: var(--b); background: color-mix(in srgb, var(--b) 14%, #151833); box-shadow: 0 8px 22px color-mix(in srgb, var(--b) 25%, transparent); }
.hk-fbtn:hover svg { transform: scale(1.25) rotate(-10deg); }

.hk-fab { background: linear-gradient(135deg, #5b63ff, #a05bff, #ff5c8a); background-size: 200% 200%; animation: hk-pulse 2.8s ease-out infinite, hk-hue 5s ease-in-out infinite alternate; }
.hk-modal { position: relative; overflow: hidden; }
.hk-modal::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 4px; background: linear-gradient(90deg, #22d3ee, #a05bff, #ff5c8a, #ffc857); background-size: 200% 100%; animation: hk-title 5s linear infinite; }
.hk-select:hover { border-color: #ff5c8a; }

@keyframes hk-title { to { background-position: 250% 0; } }
@keyframes hk-sweep { from { background-position: 220% 0; } to { background-position: -120% 0; } }
@keyframes hk-hue { to { background-position: 100% 100%; } }
@media (prefers-reduced-motion: reduce) { .hk *::before, .hk *::after { animation: none !important; } }
`;

/* Sayılar değişirken yumuşakça sayar */
const CountUp = ({ value, format }) => {
  const [v, setV] = useState(0);
  const from = useRef(0);
  useEffect(() => {
    const a = from.current, b = value, t0 = performance.now();
    if (a === b) return;
    let raf;
    const step = (t) => {
      const p = Math.min((t - t0) / 800, 1);
      const cur = a + (b - a) * (1 - Math.pow(1 - p, 3));
      from.current = cur;
      setV(cur);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <>{format(v)}</>;
};

/* ---------- Uygulama ---------- */
export default function App() {
  const [user, setUser] = useState(null);
  const [syncState, setSyncState] = useState('local'); // local | loading | synced | error
  const cloudReady = useRef(false); // ilk bulut verisi geldi mi?
  const lastRemote = useRef(null); // buluta en son yazılan/okunan içeriğin özeti
  const [transactions, setTransactions] = useState(() => readJSON('hk_transactions', []));
  const [initialBalance, setInitialBalance] = useState(() => parseFloat(localStorage.getItem('hk_initial_balance')) || 0);
  const [selectedMonth, setSelectedMonth] = useState(todayStr().slice(0, 7));

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [type, setType] = useState('gider');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState(CATEGORIES.gider[0].name);
  const [date, setDate] = useState(todayStr());
  const [description, setDescription] = useState('');
  const fileRef = useRef(null);
  const hoverIdx = useRef(null); // grafikte üzerine gelinen/dokunulan gün

  // Uygulamanın kendi pencereleri (tarayıcının alert/confirm/prompt kutuları engellenebildiği için)
  const [dlg, setDlg] = useState(null); // { kind: 'alert'|'confirm'|'prompt', message, value, resolve }
  const ask = (opts) => new Promise((resolve) => setDlg({ value: '', ...opts, resolve }));
  const closeDlg = (result) => {
    if (dlg) dlg.resolve(result);
    setDlg(null);
  };
  const uiAlert = (message) => ask({ kind: 'alert', message });
  const uiConfirm = (message) => ask({ kind: 'confirm', message });
  const uiPrompt = (message, value = '') => ask({ kind: 'prompt', message, value: String(value) });

  useEffect(() => localStorage.setItem('hk_transactions', JSON.stringify(transactions)), [transactions]);
  // Tarayıcı sekmesi simgesi + tema rengi (uygulama renkleriyle uyumlu)
  useEffect(() => {
    const svg = "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='#5b63ff'/><stop offset='1' stop-color='#a05bff'/></linearGradient></defs><rect width='64' height='64' rx='16' fill='url(#g)'/><text x='32' y='45' font-size='38' font-weight='800' text-anchor='middle' fill='#fff' font-family='Segoe UI,Arial,sans-serif'>₺</text><circle cx='51' cy='13' r='5' fill='#22d3ee'/></svg>";
    let link = document.querySelector("link[rel~='icon']");
    if (!link) { link = document.createElement('link'); link.rel = 'icon'; document.head.appendChild(link); }
    link.type = 'image/svg+xml';
    link.href = 'data:image/svg+xml,' + encodeURIComponent(svg);
    let meta = document.querySelector("meta[name='theme-color']");
    if (!meta) { meta = document.createElement('meta'); meta.name = 'theme-color'; document.head.appendChild(meta); }
    meta.content = '#0b0c1a';
    document.title = 'Hesap Kitap';
  }, []);
  useEffect(() => localStorage.setItem('hk_initial_balance', String(initialBalance)), [initialBalance]);
  // Firebase oturumunu dinle (sayfa yenilenince giriş korunur)
  useEffect(() => {
    localStorage.removeItem('hk_user'); // eski sahte giriş kaydını temizle
    const auth = getFirebaseAuth();
    if (!auth) return;
    return onAuthStateChanged(auth, (u) => setUser(u ? { name: u.displayName, email: u.email, uid: u.uid } : null));
  }, []);

  // Bulut eşleme (Firestore): her kullanıcının verisi users/{uid} belgesinde, sadece kendisi okuyup yazabilir
  useEffect(() => {
    const db = getFirebaseDb();
    if (!user || !db) {
      cloudReady.current = false;
      lastRemote.current = null;
      setSyncState('local');
      return;
    }
    let first = true;
    setSyncState('loading');
    const unsub = onSnapshot(
      doc(db, 'users', user.uid),
      (snap) => {
        if (snap.metadata.hasPendingWrites) return; // kendi yazdığımız değişikliğin yankısı
        const data = snap.exists() ? snap.data() : null;
        const remoteList = Array.isArray(data?.transactions) ? data.transactions : [];
        const remoteBalance = typeof data?.initialBalance === 'number' ? data.initialBalance : null;
        if (first) {
          first = false;
          // İlk eşleme: bu cihazdaki kayıtlarla buluttakileri id'ye göre birleştir
          setTransactions((local) => {
            const ids = new Set(remoteList.map((t) => t.id));
            return [...remoteList, ...local.filter((t) => !ids.has(t.id))];
          });
          if (remoteBalance !== null) setInitialBalance(remoteBalance);
          lastRemote.current = null; // birleşmiş hali buluta yazılsın
          cloudReady.current = true;
          setSyncState('synced');
          return;
        }
        const bal = remoteBalance ?? 0;
        const json = JSON.stringify({ transactions: remoteList, initialBalance: bal });
        if (json === lastRemote.current) return;
        lastRemote.current = json;
        setTransactions(remoteList);
        setInitialBalance(bal);
      },
      () => setSyncState('error')
    );
    return () => unsub();
  }, [user]);

  // Yerel değişiklikleri buluta yaz
  useEffect(() => {
    if (!user || !cloudReady.current) return;
    const db = getFirebaseDb();
    if (!db) return;
    const json = JSON.stringify({ transactions, initialBalance });
    if (json === lastRemote.current) return;
    lastRemote.current = json;
    setDoc(doc(db, 'users', user.uid), { transactions, initialBalance, updatedAt: Date.now() }).catch(() => setSyncState('error'));
  }, [transactions, initialBalance, user]);

  const sum = (list, t) => list.filter((x) => x.type === t).reduce((a, x) => a + parseFloat(x.amount), 0);
  const currentBalance = initialBalance + sum(transactions, 'gelir') - sum(transactions, 'gider');

  const monthOptions = useMemo(() => {
    const set = new Set(transactions.map((t) => t.date.slice(0, 7)));
    set.add(todayStr().slice(0, 7));
    set.add(selectedMonth);
    return [...set].sort().reverse();
  }, [transactions, selectedMonth]);

  const monthly = useMemo(() => transactions.filter((t) => t.date.startsWith(selectedMonth)), [transactions, selectedMonth]);
  const monthlyIncome = sum(monthly, 'gelir');
  const monthlyExpense = sum(monthly, 'gider');

  const categoryExpenses = useMemo(() => {
    const map = {};
    monthly.filter((t) => t.type === 'gider').forEach((t) => {
      map[t.category] = (map[t.category] || 0) + parseFloat(t.amount);
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [monthly]);

  const barColor = (c) => {
    const h = hoverIdx.current;
    if (h === null) return '#7c83ff';
    return c.dataIndex === h ? '#22d3ee' : 'rgba(124,131,255,0.25)';
  };
  const barBorder = (c) => (hoverIdx.current !== null && c.dataIndex === hoverIdx.current ? '#ffffff' : 'rgba(0,0,0,0)');

  const chartData = useMemo(() => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const days = new Date(y, m, 0).getDate();
    const totals = Array.from({ length: days }, (_, i) => {
      const d = `${selectedMonth}-${pad(i + 1)}`;
      return monthly.filter((t) => t.date === d && t.type === 'gider').reduce((a, t) => a + parseFloat(t.amount), 0);
    });
    return {
      labels: totals.map((_, i) => `${i + 1}. gün`),
      datasets: [
        {
          data: totals,
          // Seçili gün parlak pembe-kırmızı + beyaz çerçeve, diğerleri soluklaşır
          backgroundColor: barColor,
          hoverBackgroundColor: barColor,
          borderColor: barBorder,
          hoverBorderColor: barBorder,
          borderWidth: 2,
          borderRadius: 3,
          barPercentage: 0.6,
          categoryPercentage: 1,
          minBarLength: 2,
        },
      ],
    };
  }, [monthly, selectedMonth]);

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 700, easing: 'easeOutQuart' },
    interaction: { mode: 'index', intersect: false }, // ince/kısa çubuklarda bile sütunun herhangi bir yeri seçer
    onHover: (_e, els, chart) => {
      const idx = els.length ? els[0].index : null;
      if (idx !== hoverIdx.current) {
        hoverIdx.current = idx;
        chart.update('none');
      }
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#1b1e45',
        borderColor: '#22d3ee',
        borderWidth: 1,
        padding: 10,
        callbacks: {
          label: (c) => ` ${fmt(c.parsed.y)} ₺`,
          labelColor: () => ({ borderColor: '#ffffff', backgroundColor: '#22d3ee' }),
        },
      },
    },
    scales: { x: { display: false }, y: { display: false, beginAtZero: true } },
  };

  const grouped = useMemo(() => {
    const sorted = [...monthly].sort((a, b) => (a.date === b.date ? Number(b.id) - Number(a.id) : b.date.localeCompare(a.date)));
    const groups = [];
    sorted.forEach((t) => {
      const last = groups[groups.length - 1];
      if (last && last.date === t.date) last.items.push(t);
      else groups.push({ date: t.date, items: [t] });
    });
    return groups;
  }, [monthly]);

  const openNew = () => {
    setEditingId(null);
    setType('gider');
    setCategory(CATEGORIES.gider[0].name);
    setAmount('');
    setDescription('');
    setDate(todayStr());
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
    setAmount('');
    setDescription('');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const val = parseFloat(amount);
    if (!val || val <= 0) return;
    const entry = { id: editingId || Date.now().toString(), type, amount: val, category, date, description: description.trim() };
    setTransactions((prev) => (editingId ? prev.map((t) => (t.id === editingId ? entry : t)) : [entry, ...prev]));
    if (!date.startsWith(selectedMonth)) setSelectedMonth(date.slice(0, 7));
    closeModal();
  };

  const handleEdit = (item) => {
    setEditingId(item.id);
    setType(item.type);
    setAmount(String(item.amount));
    setCategory(item.category);
    setDate(item.date);
    setDescription(item.description || '');
    setIsModalOpen(true);
  };

  const handleDelete = async (item) => {
    const ok = await uiConfirm(`${trDate(item.date)} - ${item.description || item.category} - ${fmt(item.amount)} ₺ silinsin mi?`);
    if (ok) setTransactions((prev) => prev.filter((t) => t.id !== item.id));
  };

  const exportBackup = () => {
    const blob = new Blob([JSON.stringify({ initialBalance, transactions }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `hesap_kitap_yedek_${todayStr()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const importBackup = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const text = String(evt.target.result).replace(/^\uFEFF/, '');
        const parsed = JSON.parse(text);
        const { list, initial } = normalizeBackup(parsed);
        if (list.length === 0) {
          const keys = Array.isArray(parsed) ? 'liste' : Object.keys(parsed || {}).join(', ');
          uiAlert(`Dosyada okunabilir kayıt bulunamadı. (Dosyadaki alanlar: ${keys || 'boş'})`);
          return;
        }
        setTransactions(list);
        if (typeof initial === 'number') setInitialBalance(initial);
        const months = [...new Set(list.map((t) => t.date.slice(0, 7)))].sort().reverse();
        if (!months.includes(selectedMonth)) setSelectedMonth(months[0]);
        uiAlert(`Yedek yüklendi! ${list.length} kayıt aktarıldı.`);
      } catch {
        uiAlert('Geçersiz dosya! Dosya bozuk veya JSON değil.');
      }
    };
    reader.readAsText(file, 'UTF-8');
    e.target.value = '';
  };

  const handleSetInitialBalance = async () => {
    const val = await uiPrompt('Başlangıç bakiyesi (₺):', initialBalance);
    if (val === null) return;
    const n = parseFloat(String(val).replace(',', '.'));
    if (!isNaN(n)) setInitialBalance(n);
  };

  const handleLogin = async () => {
    const auth = getFirebaseAuth();
    if (!auth) {
      uiAlert('Firebase ayarı eksik: .env dosyasına VITE_FIREBASE_API_KEY ve VITE_FIREBASE_APP_ID ekleyip siteyi yeniden başlat.');
      return;
    }
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' }); // her seferinde "Bir hesap seç" penceresi
    try {
      await signInWithPopup(auth, provider);
    } catch (err) {
      if (err.code === 'auth/popup-closed-by-user' || err.code === 'auth/cancelled-popup-request') return;
      if (err.code === 'auth/api-key-not-valid.-please-pass-a-valid-api-key.' || err.code === 'auth/invalid-api-key') uiAlert('API anahtarı geçersiz. Firebase Console\'daki apiKey değerini koddaki firebaseConfig içine harfi harfine kopyala.');
      else if (err.code === 'auth/operation-not-allowed') uiAlert('Google girişi kapalı. Firebase > Authentication > Sign-in method > Google\'ı etkinleştir.');
      else if (err.code === 'auth/unauthorized-domain') uiAlert('Bu alan adı Firebase\'de yetkili değil. Authentication > Settings > Authorized domains kısmına ekle.');
      else if (err.code === 'auth/popup-blocked') uiAlert('Tarayıcı giriş penceresini engelledi. Adres çubuğundaki "pencere engellendi" simgesinden izin verip tekrar dene.');
      else uiAlert(`Giriş yapılamadı (${err.code || err.message})`);
    }
  };

  const handleLogout = async () => {
    if (!(await uiConfirm('Çıkış yapınca bu cihazdaki kayıtlar temizlenir; hesabında kayıtlı kalır. Devam edilsin mi?'))) return;
    cloudReady.current = false; // temizlenen veri buluta yazılmasın
    lastRemote.current = null;
    const auth = getFirebaseAuth();
    try {
      if (auth) await signOut(auth);
    } finally {
      setTransactions([]);
      setInitialBalance(0);
      setUser(null);
    }
  };

  return (
    <div className="hk">
      <style>{CSS}</style>
      <div className="hk-wrap">
        <header className="hk-head">
          <div className="hk-brand">
            <span className="hk-logo">₺</span>
            <h1 className="hk-title">Hesap Kitap</h1>
          </div>
          <p className="hk-sub">Gelir gider takibim</p>
          {user && (
            <p className="hk-user">
              {syncState === 'synced' && `✓ Eşleşti • ${user.email}`}
              {syncState === 'loading' && `Eşleniyor… • ${user.email}`}
              {syncState === 'error' && `⚠ Eşleme hatası • ${user.email} (Firestore kurallarını kontrol et)`}
              {syncState === 'local' && user.email}
            </p>
          )}
        </header>

        <section className="hk-balance">
          <p className="lbl">Güncel bakiye</p>
          <div className="big"><CountUp value={currentBalance} format={fmt2} /> ₺</div>
          <div className="row">
            <div>
              <p className="lbl">Bu ay gelen</p>
              <b><CountUp value={monthlyIncome} format={fmt} /> ₺</b>
            </div>
            <div>
              <p className="lbl">Bu ay harcanan</p>
              <b><CountUp value={monthlyExpense} format={fmt} /> ₺</b>
            </div>
          </div>
        </section>

        <section>
          <div className="hk-sumhead">
            <h2>Aylık özet</h2>
            <select className="hk-select" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)}>
              {monthOptions.map((m) => (
                <option key={m} value={m}>{monthLabel(m)}</option>
              ))}
            </select>
          </div>

          <div className="hk-grid">
            <div className="hk-panel">
              <h3>Kategoriye göre harcama</h3>
              {categoryExpenses.length === 0 ? (
                <p className="hk-empty">Bu ay henüz harcama yok.</p>
              ) : (
                categoryExpenses.map(([cat, val]) => (
                  <div className="hk-cat" key={cat} style={{ '--c': colorOf(cat) }}>
                    <div className="hk-cat-top">
                      <span>{iconOf(cat)} {cat}</span>
                      <span>{fmt(val)} ₺</span>
                    </div>
                    <div className="hk-bar"><i style={{ width: `${Math.max((val / monthlyExpense) * 100, 1)}%` }} /></div>
                  </div>
                ))
              )}
            </div>

            <div className="hk-panel">
              <h3>Günlük harcama</h3>
              <div className="hk-chart">
                <Bar data={chartData} options={chartOptions} />
              </div>
            </div>
          </div>
        </section>

        <section>
          {grouped.length === 0 && <p className="hk-none">Bu ay için kayıt yok. Sağ alttaki + ile ekleyebilirsin.</p>}
          {grouped.map((g) => (
            <div key={g.date}>
              <p className="hk-date">{trDate(g.date)}</p>
              <div className="hk-list">
                {g.items.map((item) => {
                  const income = item.type === 'gelir';
                  return (
                    <div className="hk-item" key={item.id} style={{ '--c': colorOf(item.category) }}>
                      <div className="hk-item-l">
                        <span className="hk-ico">{iconOf(item.category)}</span>
                        <div className="hk-item-t">
                          <b>{item.description || item.category}</b>
                          <small>{item.category}</small>
                        </div>
                      </div>
                      <div className="hk-item-r">
                        <span className={`hk-amt ${income ? 'in' : 'out'}`}>{income ? '+' : '-'}{fmt(item.amount)} ₺</span>
                        <button className="hk-icon-btn" onClick={() => handleEdit(item)} aria-label="Düzenle"><Pencil /></button>
                        <button className="hk-icon-btn del" onClick={() => handleDelete(item)} aria-label="Sil"><Trash2 /></button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </section>

        <footer className="hk-foot">
          {user ? (
            <button className="hk-fbtn" onClick={handleLogout}><Cloud /> Çıkış yap</button>
          ) : (
            <button className="hk-fbtn" onClick={handleLogin}><Cloud /> Google ile giriş</button>
          )}
          <button className="hk-fbtn" onClick={exportBackup}><Download /> Yedek indir</button>
          <button className="hk-fbtn" onClick={() => fileRef.current?.click()}><Upload /> Yedek yükle</button>
          <input ref={fileRef} className="hk-file" type="file" accept=".json,application/json" onChange={importBackup} />
          <button className="hk-fbtn" onClick={handleSetInitialBalance}><CircleDot /> Başlangıç bakiyesi</button>
        </footer>

        <button className="hk-fab" onClick={openNew} aria-label="Yeni kayıt"><Plus /></button>

        {isModalOpen && (
          <div className="hk-overlay" onClick={closeModal}>
            <div className="hk-modal" onClick={(e) => e.stopPropagation()}>
              <h3>{editingId ? 'Kaydı düzenle' : 'Yeni kayıt'}</h3>
              <form className="hk-form" onSubmit={handleSubmit}>
                <div className="hk-two">
                  <button type="button" className={`hk-type ${type === 'gider' ? 'on-out' : ''}`} onClick={() => { setType('gider'); setCategory(CATEGORIES.gider[0].name); }}>Gider</button>
                  <button type="button" className={`hk-type ${type === 'gelir' ? 'on-in' : ''}`} onClick={() => { setType('gelir'); setCategory(CATEGORIES.gelir[0].name); }}>Gelir</button>
                </div>

                <label className="hk-label">
                  <span>Tutar (₺)</span>
                  <input className="hk-input" type="number" inputMode="decimal" step="0.01" min="0" required autoFocus value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" />
                </label>

                <label className="hk-label">
                  <span>Kategori</span>
                  <select className="hk-input" value={category} onChange={(e) => setCategory(e.target.value)}>
                    {CATEGORIES[type].map((c) => (
                      <option key={c.name} value={c.name}>{c.icon} {c.name}</option>
                    ))}
                  </select>
                </label>

                <label className="hk-label">
                  <span>Tarih</span>
                  <input className="hk-input" type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
                </label>

                <label className="hk-label">
                  <span>Açıklama</span>
                  <input className="hk-input" type="text" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="İsteğe bağlı" />
                </label>

                <div className="hk-two">
                  <button type="button" className="hk-cancel" onClick={closeModal}>Vazgeç</button>
                  <button type="submit" className="hk-save">Kaydet</button>
                </div>
              </form>
            </div>
          </div>
        )}
        {dlg && (
          <div className="hk-overlay top" onClick={() => closeDlg(dlg.kind === 'confirm' ? false : dlg.kind === 'prompt' ? null : undefined)}>
            <div className="hk-modal" onClick={(e) => e.stopPropagation()}>
              <p className="hk-dlg-msg">{dlg.message}</p>
              {dlg.kind === 'prompt' && (
                <input
                  className="hk-input"
                  autoFocus
                  value={dlg.value}
                  onChange={(e) => setDlg({ ...dlg, value: e.target.value })}
                  onKeyDown={(e) => e.key === 'Enter' && closeDlg(dlg.value)}
                  style={{ marginBottom: 14 }}
                />
              )}
              {dlg.kind === 'alert' ? (
                <button className="hk-save" style={{ width: '100%' }} onClick={() => closeDlg()} autoFocus>Tamam</button>
              ) : (
                <div className="hk-two">
                  <button className="hk-cancel" onClick={() => closeDlg(dlg.kind === 'confirm' ? false : null)}>Vazgeç</button>
                  <button className="hk-save" onClick={() => closeDlg(dlg.kind === 'confirm' ? true : dlg.value)} autoFocus={dlg.kind === 'confirm'}>Tamam</button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
