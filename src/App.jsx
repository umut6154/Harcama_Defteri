import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Pencil, Trash2, Cloud, Download, Upload, CircleDot, Plus, TrendingUp, TrendingDown, Wallet } from 'lucide-react';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip } from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, onSnapshot, setDoc } from 'firebase/firestore';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip);

/* ---------- Firebase (Google girişi) ---------- */
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
const CAT_COLORS = {
  'Yemek': '#ff7a1a',
  'Market': '#10c98f',
  'Yurt/KYK': '#3b7bff',
  'Abonelik': '#9b5cff',
  'Eğlence': '#ff4d8d',
  'Kişisel Bakım': '#06b6d4',
  'Ulaşım': '#f5b700',
  'Diğer': '#7c83c9',
  'Burs/Harçlık': '#16c784',
  'Maaş': '#0ea5e9',
  'Diğer Gelir': '#84cc16',
};
const colorOf = (name) => CAT_COLORS[name] || '#7c83c9';
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
const dayName = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'][new Date(y, m - 1, d).getDay()];
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
  const seen = new Set();
  list.forEach((t, i) => {
    while (seen.has(t.id)) t.id = `${t.id}_${i}`;
    seen.add(t.id);
  });
  return { list, initial: findInitial(parsed) };
};

/* ---------- Stil (Tailwind GEREKMEZ, tamamen bu dosyada) ---------- */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap');
*, *::before, *::after { box-sizing: border-box; }
@property --hk-hue { syntax: '<angle>'; inherits: true; initial-value: 0deg; }
html, body { margin: 0; padding: 0; display: block; width: 100%; max-width: none; min-width: 0; background: #fff6fb; color-scheme: light; text-align: left; }
#root { max-width: none; width: 100%; margin: 0; padding: 0; text-align: left; }
button, input, select { font-family: inherit; }

.hk { --ink: #1f1a4d; --mute: #6b6a93; position: relative; overflow: hidden; min-height: 100vh; color: var(--ink); font-family: 'Poppins', 'Segoe UI', system-ui, sans-serif; padding: 26px 18px 40px; --cyc: 12s; animation: hk-spin var(--cyc) linear infinite; }
.hk-bg { position: fixed; inset: 0; z-index: 0; overflow: hidden; pointer-events: none; filter: hue-rotate(var(--hk-hue));
  background:
    radial-gradient(900px 500px at 8% -5%, #ffd6ec 0%, transparent 60%),
    radial-gradient(800px 500px at 100% 5%, #cfe3ff 0%, transparent 55%),
    radial-gradient(900px 600px at 90% 100%, #ffe9b8 0%, transparent 55%),
    radial-gradient(800px 600px at 0% 95%, #c8f5e4 0%, transparent 55%),
    #fff6fb; }
.hk h1, .hk h2, .hk h3, .hk p { margin: 0; }
.hk-blob { position: absolute; border-radius: 50%; filter: blur(70px); opacity: .55; pointer-events: none; z-index: 0; animation: hk-drift 16s ease-in-out infinite alternate; }
.hk-blob.b1 { width: 340px; height: 340px; background: #ff7ab8; top: 12%; left: -90px; }
.hk-blob.b2 { width: 300px; height: 300px; background: #7aa8ff; top: 40%; right: -80px; animation-delay: -5s; }
.hk-blob.b3 { width: 280px; height: 280px; background: #ffd25e; bottom: -80px; left: 30%; animation-delay: -9s; }
.hk-wrap { position: relative; z-index: 1; max-width: 1080px; margin: 0 auto; display: flex; flex-direction: column; gap: 22px; }

/* Üst bar */
.hk-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.hk-brand { display: flex; align-items: center; gap: 12px; }
.hk-logo { width: 48px; height: 48px; border-radius: 16px; background: linear-gradient(135deg, #ff7a1a, #ff4d8d 55%, #9b5cff); display: grid; place-items: center; font-size: 26px; font-weight: 800; color: #fff; box-shadow: 0 10px 24px rgba(255,77,141,.4); animation: hk-float 3.4s ease-in-out infinite; filter: hue-rotate(var(--hk-hue)); }
.hk-title { font-size: 28px; font-weight: 800; letter-spacing: -.01em; background: linear-gradient(90deg, #ff7a1a, #ff4d8d, #9b5cff); -webkit-background-clip: text; background-clip: text; color: transparent; -webkit-text-fill-color: transparent; filter: hue-rotate(var(--hk-hue)); }
.hk-sub { font-size: 12.5px; color: var(--mute); margin-top: 1px; }
.hk-chip { display: inline-flex; align-items: center; gap: 8px; background: #fff; border-radius: 999px; padding: 6px 14px 6px 6px; font-size: 12px; font-weight: 600; color: var(--ink); box-shadow: 0 6px 18px rgba(80,60,160,.12); max-width: 100%; }
.hk-chip i { font-style: normal; width: 26px; height: 26px; border-radius: 50%; display: grid; place-items: center; color: #fff; font-size: 12px; font-weight: 700; background: linear-gradient(135deg, #3b7bff, #9b5cff); flex-shrink: 0; }
.hk-chip span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.hk-chip.err i { background: linear-gradient(135deg, #ff4d4d, #ff9a3d); }
.hk-chip.ok i { background: linear-gradient(135deg, #10c98f, #06b6d4); }

/* Bakiye alanı */
.hk-hero { display: grid; grid-template-columns: 1.7fr 1fr; gap: 16px; }
.hk-balance { position: relative; overflow: hidden; border-radius: 30px; padding: 28px 30px; color: #fff; background: linear-gradient(120deg, #7c3aed, #ec4899 45%, #ff7a1a 100%); background-size: 200% 200%; animation: hk-rise .7s cubic-bezier(.2,.8,.2,1) both, hk-flow var(--cyc) ease-in-out infinite; box-shadow: 0 24px 50px rgba(236,72,153,.35); }
.hk-balance::before { content: ''; position: absolute; width: 260px; height: 260px; border-radius: 50%; right: -70px; top: -90px; background: rgba(255,255,255,.2); }
.hk-balance::after { content: ''; position: absolute; width: 180px; height: 180px; border-radius: 50%; right: 60px; bottom: -100px; background: rgba(255,230,120,.35); }
.hk-balance > * { position: relative; z-index: 1; }
.hk-balance .lbl { font-size: 13px; opacity: .92; font-weight: 500; }
.hk-balance .big { margin-top: 6px; font-size: 50px; line-height: 1.1; font-weight: 800; letter-spacing: -.02em; font-variant-numeric: tabular-nums; text-shadow: 0 4px 20px rgba(0,0,0,.18); }
.hk-balance .mini { margin-top: 18px; display: inline-flex; align-items: center; gap: 8px; background: rgba(255,255,255,.22); border: 1px solid rgba(255,255,255,.4); border-radius: 999px; padding: 6px 14px; font-size: 12px; font-weight: 600; backdrop-filter: blur(6px); }

.hk-side { display: grid; grid-template-rows: 1fr 1fr; gap: 16px; }
.hk-stat { position: relative; overflow: hidden; border-radius: 24px; padding: 18px 20px; color: #fff; display: flex; flex-direction: column; justify-content: center; animation: hk-rise .7s .1s cubic-bezier(.2,.8,.2,1) both; transition: transform .25s, box-shadow .25s; }
.hk-stat:hover { transform: translateY(-4px) scale(1.02); }
.hk-stat.in { background: linear-gradient(135deg, #10c98f, #06b6d4); box-shadow: 0 16px 34px rgba(16,201,143,.38); }
.hk-stat.out { background: linear-gradient(135deg, #ff4d8d, #ff9a3d); box-shadow: 0 16px 34px rgba(255,77,141,.38); animation-delay: .2s; }
.hk-stat::after { content: ''; position: absolute; width: 110px; height: 110px; border-radius: 50%; right: -30px; top: -40px; background: rgba(255,255,255,.22); }
.hk-stat .lbl { font-size: 12px; font-weight: 500; opacity: .95; display: flex; align-items: center; gap: 6px; }
.hk-stat .lbl svg { width: 15px; height: 15px; }
.hk-stat b { margin-top: 4px; font-size: 24px; font-weight: 800; font-variant-numeric: tabular-nums; position: relative; z-index: 1; }

/* Aylık özet */
.hk-sumhead { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; gap: 10px; }
.hk .hk-sumhead h2 { display: flex; align-items: center; gap: 10px; font-size: 25px; font-weight: 800; letter-spacing: -.01em; color: #1f1a4d; -webkit-text-fill-color: #1f1a4d; opacity: 1; text-shadow: 0 2px 0 rgba(255,255,255,.9); }
.hk .hk-sumhead h2::before { content: ''; width: 8px; height: 28px; border-radius: 99px; background: linear-gradient(180deg, #ff7a1a, #ff4d8d, #9b5cff); filter: hue-rotate(var(--hk-hue)); }
.hk-select { background: #fff; color: var(--ink); border: 2px solid transparent; border-radius: 999px; padding: 9px 18px; font-size: 14px; font-weight: 600; cursor: pointer; outline: none; box-shadow: 0 6px 18px rgba(80,60,160,.14); background-image: linear-gradient(#fff, #fff), linear-gradient(90deg, #ff7a1a, #ff4d8d, #9b5cff); background-origin: border-box; background-clip: padding-box, border-box; transition: box-shadow .2s; filter: hue-rotate(var(--hk-hue)); }
.hk-select:focus { box-shadow: 0 0 0 4px rgba(155,92,255,.25); }

.hk-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.hk-panel { position: relative; overflow: hidden; border-radius: 26px; padding: 22px; min-height: 240px; display: flex; flex-direction: column; background: #fff; box-shadow: 0 14px 38px rgba(80,60,160,.13); animation: hk-rise .6s .15s cubic-bezier(.2,.8,.2,1) both; transition: transform .3s, box-shadow .3s; }
.hk-panel:hover { transform: translateY(-4px); box-shadow: 0 22px 48px rgba(80,60,160,.2); }
.hk-panel::before { content: ''; position: absolute; left: 0; right: 0; top: 0; height: 6px; background: linear-gradient(90deg, #ff7a1a, #ff4d8d, #9b5cff, #3b7bff, #10c98f); filter: hue-rotate(var(--hk-hue)); }
.hk-panel h3 { font-size: 15px; font-weight: 700; margin-bottom: 14px; }
.hk-empty { font-size: 13px; color: var(--mute); }
.hk-stack { display: flex; height: 14px; border-radius: 999px; overflow: hidden; margin-bottom: 18px; background: #eee9ff; }
.hk-stack i { display: block; height: 100%; transition: flex .6s; }
.hk-cat { margin-bottom: 13px; }
.hk-cat-top { display: flex; justify-content: space-between; align-items: center; font-size: 14px; font-weight: 500; }
.hk-cat-top span:first-child { display: flex; align-items: center; gap: 8px; transition: transform .2s; }
.hk-cat-top span:first-child em { font-style: normal; width: 28px; height: 28px; border-radius: 9px; display: grid; place-items: center; font-size: 14px; background: var(--cs); }
.hk-cat-top span:last-child { font-weight: 700; color: var(--c); }
.hk-cat:hover .hk-cat-top span:first-child { transform: translateX(4px); }
.hk-bar { margin-top: 7px; height: 9px; border-radius: 999px; background: var(--cs); overflow: hidden; }
.hk-bar > i { display: block; height: 100%; border-radius: 999px; background: linear-gradient(90deg, var(--c), var(--c2)); transform-origin: left; animation: hk-grow .9s cubic-bezier(.2,.8,.2,1) both; }
.hk-chart { flex: 1; min-height: 160px; position: relative; }

/* Kayıt listesi */
.hk-date { display: inline-flex; align-items: center; gap: 8px; font-size: 12px; font-weight: 700; color: #fff; background: linear-gradient(90deg, #7c3aed, #ec4899); padding: 5px 14px; border-radius: 999px; margin: 18px 0 10px 2px; box-shadow: 0 8px 18px rgba(236,72,153,.28); filter: hue-rotate(var(--hk-hue)); }
.hk-date small { font-weight: 500; opacity: .85; font-size: 11px; }
.hk-list { display: flex; flex-direction: column; gap: 10px; }
.hk-item { display: flex; align-items: center; justify-content: space-between; gap: 12px; background: #fff; border-radius: 20px; padding: 11px 14px 11px 12px; box-shadow: 0 8px 22px rgba(80,60,160,.1); position: relative; overflow: hidden; animation: hk-slide .45s cubic-bezier(.2,.8,.2,1) both; transition: transform .2s, box-shadow .2s; }
.hk-item::before { content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 5px; background: linear-gradient(180deg, var(--c), var(--c2)); }
.hk-item:nth-child(2) { animation-delay: .05s; } .hk-item:nth-child(3) { animation-delay: .1s; } .hk-item:nth-child(4) { animation-delay: .15s; } .hk-item:nth-child(n+5) { animation-delay: .2s; }
.hk-item:hover { transform: translateX(5px); box-shadow: 0 14px 30px rgba(80,60,160,.18); }
.hk-item-l { display: flex; align-items: center; gap: 12px; min-width: 0; padding-left: 6px; }
.hk-ico { width: 44px; height: 44px; border-radius: 15px; background: linear-gradient(135deg, var(--cs), var(--cs2)); display: grid; place-items: center; font-size: 20px; flex-shrink: 0; transition: transform .25s; }
.hk-item:hover .hk-ico { transform: scale(1.15) rotate(-8deg); }
.hk-item-t { min-width: 0; }
.hk-item-t b { display: block; font-size: 14px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.hk-item-t small { display: inline-block; margin-top: 3px; font-size: 11px; font-weight: 600; color: var(--c); background: var(--cs); padding: 2px 9px; border-radius: 999px; }
.hk-item-r { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
.hk-amt { font-size: 15px; font-weight: 800; font-variant-numeric: tabular-nums; padding: 5px 12px; border-radius: 999px; }
.hk-amt.out { color: #e11d48; background: #ffe4ec; }
.hk-amt.in { color: #059669; background: #d9fbe9; }
.hk-icon-btn { background: #f1eeff; border: 0; padding: 7px; border-radius: 10px; cursor: pointer; display: grid; place-items: center; color: #6d4aff; transition: background .15s, transform .15s, color .15s; }
.hk-icon-btn:hover { background: #6d4aff; color: #fff; transform: scale(1.12); }
.hk-icon-btn.del { background: #ffe9ee; color: #e11d48; }
.hk-icon-btn.del:hover { background: #e11d48; color: #fff; }
.hk-icon-btn svg { width: 15px; height: 15px; }
.hk-none { display: flex; flex-direction: column; align-items: center; gap: 8px; text-align: center; padding: 36px 18px; background: rgba(255,255,255,.78); border-radius: 28px; border: 2px dashed #d8cbff; backdrop-filter: blur(6px); }
.hk-none-ico { width: 74px; height: 74px; border-radius: 26px; display: grid; place-items: center; color: #fff; margin-bottom: 6px; background: linear-gradient(135deg, #ff7a1a, #ff4d8d 55%, #9b5cff); box-shadow: 0 14px 30px rgba(255,77,141,.38); animation: hk-float 3.4s ease-in-out infinite; filter: hue-rotate(var(--hk-hue)); }
.hk-none-ico svg { width: 36px; height: 36px; }
.hk-none b { font-size: 18px; font-weight: 800; color: var(--ink); }
.hk-none p { font-size: 13px; color: var(--mute); max-width: 320px; line-height: 1.5; }
.hk-none button { margin-top: 8px; display: inline-flex; align-items: center; gap: 6px; padding: 10px 20px; border: 0; border-radius: 999px; color: #fff; font-size: 13px; font-weight: 700; cursor: pointer; background: linear-gradient(135deg, #ff4d8d, #9b5cff); box-shadow: 0 10px 22px rgba(155,92,255,.35); filter: hue-rotate(var(--hk-hue)); transition: transform .2s, box-shadow .2s; }
.hk-none button:hover { transform: translateY(-3px) scale(1.04); box-shadow: 0 16px 28px rgba(155,92,255,.45); }
.hk-none button svg { width: 16px; height: 16px; }

/* Alt butonlar */
.hk-foot { display: flex; flex-wrap: wrap; gap: 10px; padding: 14px 0 130px; }
.hk-fbtn { display: inline-flex; align-items: center; gap: 8px; padding: 11px 18px; border-radius: 999px; border: 0; color: #fff; font-size: 13px; font-weight: 700; cursor: pointer; box-shadow: 0 10px 22px rgba(80,60,160,.22); transition: transform .2s, box-shadow .2s, filter .2s; }
.hk-fbtn:nth-of-type(1) { background: linear-gradient(135deg, #06b6d4, #3b7bff); }
.hk-fbtn:nth-of-type(2) { background: linear-gradient(135deg, #10c98f, #84cc16); }
.hk-fbtn:nth-of-type(3) { background: linear-gradient(135deg, #ffb300, #ff7a1a); }
.hk-fbtn:nth-of-type(4) { background: linear-gradient(135deg, #ff4d8d, #9b5cff); }
.hk-fbtn:hover { transform: translateY(-3px) scale(1.04); filter: brightness(1.08); box-shadow: 0 16px 30px rgba(80,60,160,.3); }
.hk-fbtn svg { width: 16px; height: 16px; transition: transform .3s; }
.hk-fbtn:hover svg { transform: rotate(-15deg) scale(1.2); }
.hk-file { display: none; }

.hk-fab { position: fixed; right: 30px; bottom: calc(80px + env(safe-area-inset-bottom, 0px)); width: 62px; height: 62px; border-radius: 50%; border: 0; background: linear-gradient(135deg, #ff7a1a, #ff4d8d, #9b5cff); background-size: 200% 200%; color: #fff; display: grid; place-items: center; cursor: pointer; transition: transform .2s; z-index: 20; filter: hue-rotate(var(--hk-hue)); animation: hk-pulse 2.6s ease-out infinite; }
.hk-fab:hover { transform: rotate(90deg) scale(1.1); }
.hk-fab:active { transform: scale(.9); }
.hk-fab svg { width: 30px; height: 30px; }

/* Pencereler */
.hk-overlay { position: fixed; inset: 0; background: rgba(48,26,110,.45); backdrop-filter: blur(6px); display: grid; place-items: center; padding: 16px; z-index: 50; animation: hk-fade .2s both; }
.hk-overlay.top { z-index: 60; }
.hk-modal { position: relative; overflow: hidden; width: 100%; max-width: 400px; background: #fff; border-radius: 28px; padding: 28px 24px 24px; box-shadow: 0 30px 70px rgba(48,26,110,.4); animation: hk-pop .3s cubic-bezier(.2,1.2,.3,1) both; color: var(--ink); }
.hk-modal::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 8px; background: linear-gradient(90deg, #ff7a1a, #ff4d8d, #9b5cff, #3b7bff, #10c98f); filter: hue-rotate(var(--hk-hue)); }
.hk-modal h3 { font-size: 19px; font-weight: 800; margin-bottom: 16px; }
.hk-dlg-msg { font-size: 14px; line-height: 1.55; margin: 0 0 16px; white-space: pre-line; font-weight: 500; }
.hk-form { display: flex; flex-direction: column; gap: 13px; }
.hk-two { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.hk-type { padding: 12px; border-radius: 14px; border: 2px solid #ece6ff; background: #f7f4ff; color: var(--mute); font-size: 14px; font-weight: 700; cursor: pointer; transition: all .2s; }
.hk-type:hover { transform: translateY(-2px); }
.hk-type.on-out { background: linear-gradient(135deg, #ff4d8d, #ff9a3d); border-color: transparent; color: #fff; box-shadow: 0 10px 20px rgba(255,77,141,.35); }
.hk-type.on-in { background: linear-gradient(135deg, #10c98f, #06b6d4); border-color: transparent; color: #fff; box-shadow: 0 10px 20px rgba(16,201,143,.35); }
.hk-label { display: block; }
.hk-label span { display: block; font-size: 12px; font-weight: 600; color: var(--mute); margin-bottom: 5px; }
.hk-input { width: 100%; background: #f7f4ff; border: 2px solid #ece6ff; border-radius: 14px; padding: 11px 14px; font-size: 14px; font-weight: 500; color: var(--ink); outline: none; color-scheme: light; transition: border-color .2s, box-shadow .2s, background .2s; }
.hk-input::placeholder { color: #aaa6d0; }
.hk-input:focus { border-color: #9b5cff; background: #fff; box-shadow: 0 0 0 4px rgba(155,92,255,.18); }
.hk-cancel, .hk-save { padding: 12px; border-radius: 14px; border: 0; font-size: 14px; font-weight: 700; cursor: pointer; transition: transform .15s, box-shadow .2s, background .2s; }
.hk-cancel { background: #f1eeff; color: #5b3df0; }
.hk-cancel:hover { background: #e6e0ff; }
.hk-save { color: #fff; filter: hue-rotate(var(--hk-hue)); background: linear-gradient(135deg, #ff4d8d, #9b5cff); box-shadow: 0 10px 22px rgba(155,92,255,.35); }
.hk-save:hover { transform: translateY(-2px); box-shadow: 0 14px 28px rgba(155,92,255,.45); }

@keyframes hk-rise { from { opacity: 0; transform: translateY(18px); } to { opacity: 1; transform: none; } }
@keyframes hk-slide { from { opacity: 0; transform: translateX(-14px); } to { opacity: 1; transform: none; } }
@keyframes hk-grow { from { transform: scaleX(0); } to { transform: scaleX(1); } }
@keyframes hk-flow { 0%,100% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } }
@keyframes hk-float { 0%,100% { transform: translateY(0) rotate(0); } 50% { transform: translateY(-5px) rotate(-5deg); } }
@keyframes hk-drift { to { transform: translate(60px, 40px) scale(1.2); } }
@keyframes hk-pulse { 0% { box-shadow: 0 12px 28px rgba(255,77,141,.55), 0 0 0 0 rgba(255,122,26,.5); } 70%,100% { box-shadow: 0 12px 28px rgba(255,77,141,.55), 0 0 0 22px rgba(255,122,26,0); } }
@keyframes hk-fade { from { opacity: 0; } to { opacity: 1; } }
@keyframes hk-pop { from { opacity: 0; transform: scale(.9) translateY(10px); } to { opacity: 1; transform: none; } }
@keyframes hk-spin { to { --hk-hue: 360deg; } }

@media (max-width: 760px) {
  .hk { padding: 18px 14px 40px; }
  .hk-hero { grid-template-columns: 1fr; }
  .hk-side { grid-template-columns: 1fr 1fr; grid-template-rows: none; }
  .hk-grid { grid-template-columns: 1fr; }
  .hk-balance { padding: 24px 22px; }
  .hk-balance .big { font-size: 38px; }
  .hk-stat b { font-size: 19px; }
  .hk-fab { right: 18px; bottom: calc(80px + env(safe-area-inset-bottom, 0px)); }
}
@media (prefers-reduced-motion: reduce) {
  .hk, .hk *, .hk::before, .hk::after, .hk *::before, .hk *::after { animation: none !important; transition: none !important; }
}
`;

/* Renk yardımcıları (hex + saydamlık) */
const soft = (hex) => `${hex}22`;
const soft2 = (hex) => `${hex}40`;
const lighter = (hex) => `${hex}b8`;
const catVars = (name) => {
  const c = colorOf(name);
  return { '--c': c, '--c2': lighter(c), '--cs': soft(c), '--cs2': soft2(c) };
};

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
  const cloudReady = useRef(false);
  const lastRemote = useRef(null);
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
  const hoverIdx = useRef(null);

  const [dlg, setDlg] = useState(null);
  const ask = (opts) => new Promise((resolve) => setDlg({ value: '', ...opts, resolve }));
  const closeDlg = (result) => {
    if (dlg) dlg.resolve(result);
    setDlg(null);
  };
  const uiAlert = (message) => ask({ kind: 'alert', message });
  const uiConfirm = (message) => ask({ kind: 'confirm', message });
  const uiPrompt = (message, value = '') => ask({ kind: 'prompt', message, value: String(value) });

  useEffect(() => localStorage.setItem('hk_transactions', JSON.stringify(transactions)), [transactions]);
  useEffect(() => {
    const svg = "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='#ff7a1a'/><stop offset='.5' stop-color='#ff4d8d'/><stop offset='1' stop-color='#9b5cff'/></linearGradient></defs><rect width='64' height='64' rx='16' fill='url(#g)'/><text x='32' y='45' font-size='38' font-weight='800' text-anchor='middle' fill='#fff' font-family='Segoe UI,Arial,sans-serif'>₺</text><circle cx='51' cy='13' r='5' fill='#ffd25e'/></svg>";
    let link = document.querySelector("link[rel~='icon']");
    if (!link) { link = document.createElement('link'); link.rel = 'icon'; document.head.appendChild(link); }
    link.type = 'image/svg+xml';
    link.href = 'data:image/svg+xml,' + encodeURIComponent(svg);
    let meta = document.querySelector("meta[name='theme-color']");
    if (!meta) { meta = document.createElement('meta'); meta.name = 'theme-color'; document.head.appendChild(meta); }
    meta.content = '#ff4d8d';
    document.title = 'Hesap Kitap';
  }, []);
  useEffect(() => localStorage.setItem('hk_initial_balance', String(initialBalance)), [initialBalance]);
  useEffect(() => {
    localStorage.removeItem('hk_user');
    const auth = getFirebaseAuth();
    if (!auth) return;
    return onAuthStateChanged(auth, (u) => setUser(u ? { name: u.displayName, email: u.email, uid: u.uid } : null));
  }, []);

  // Bulut eşleme (Firestore)
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
        if (snap.metadata.hasPendingWrites) return;
        const data = snap.exists() ? snap.data() : null;
        const remoteList = Array.isArray(data?.transactions) ? data.transactions : [];
        const remoteBalance = typeof data?.initialBalance === 'number' ? data.initialBalance : null;
        if (first) {
          first = false;
          const known = localStorage.getItem('hk_synced_uid') === user.uid;
          if (known && data) {
            setTransactions(remoteList);
            lastRemote.current = JSON.stringify({ transactions: remoteList, initialBalance: remoteBalance ?? 0 });
          } else {
            setTransactions((local) => {
              const ids = new Set(remoteList.map((t) => t.id));
              return [...remoteList, ...local.filter((t) => !ids.has(t.id))];
            });
            lastRemote.current = null;
          }
          localStorage.setItem('hk_synced_uid', user.uid);
          if (remoteBalance !== null) setInitialBalance(remoteBalance);
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

  // Gökkuşağı renkli günlük çubuklar; üzerine gelinen gün parlar, diğerleri soluklaşır
  const barColor = (c) => {
    const hue = (c.dataIndex * 11 + 330) % 360;
    const h = hoverIdx.current;
    if (h === null) return `hsl(${hue}, 88%, 60%)`;
    return c.dataIndex === h ? `hsl(${hue}, 95%, 52%)` : `hsla(${hue}, 88%, 60%, 0.3)`;
  };
  const barBorder = (c) => (hoverIdx.current !== null && c.dataIndex === hoverIdx.current ? '#1f1a4d' : 'rgba(0,0,0,0)');

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
          backgroundColor: barColor,
          hoverBackgroundColor: barColor,
          borderColor: barBorder,
          hoverBorderColor: barBorder,
          borderWidth: 2,
          borderRadius: 6,
          barPercentage: 0.72,
          categoryPercentage: 1,
          minBarLength: 3,
        },
      ],
    };
  }, [monthly, selectedMonth]);

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 700, easing: 'easeOutQuart' },
    interaction: { mode: 'index', intersect: false },
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
        backgroundColor: '#1f1a4d',
        titleColor: '#ffd25e',
        bodyColor: '#fff',
        padding: 10,
        cornerRadius: 12,
        callbacks: {
          label: (c) => ` ${fmt(c.parsed.y)} ₺`,
          labelColor: () => ({ borderColor: '#fff', backgroundColor: '#ff4d8d' }),
        },
      },
    },
    scales: { x: { display: false }, y: { display: false, beginAtZero: true } },
  };

  const grouped = useMemo(() => {
    const sorted = [...monthly].sort((a, b) => (a.date === b.date ? String(b.id).localeCompare(String(a.id), undefined, { numeric: true }) : b.date.localeCompare(a.date)));
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
    reader.onload = async (evt) => {
      try {
        const text = String(evt.target.result).replace(/^\uFEFF/, '');
        const parsed = JSON.parse(text);
        const { list, initial } = normalizeBackup(parsed);
        if (list.length === 0) {
          const keys = Array.isArray(parsed) ? 'liste' : Object.keys(parsed || {}).join(', ');
          uiAlert(`Dosyada okunabilir kayıt bulunamadı. (Dosyadaki alanlar: ${keys || 'boş'})`);
          return;
        }
        if (transactions.length > 0 && !(await uiConfirm(`Mevcut ${transactions.length} kayıt silinip yerine yedekteki ${list.length} kayıt yüklenecek. Devam edilsin mi?`))) return;
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
    const raw = String(val).trim();
    const n = /^\d{1,3}(\.\d{3})+$/.test(raw) ? parseFloat(raw.replace(/\./g, '')) : toNumber(raw);
    if (!isNaN(n)) setInitialBalance(n);
  };

  const handleLogin = async () => {
    const auth = getFirebaseAuth();
    if (!auth) {
      uiAlert('Firebase ayarı eksik: .env dosyasına VITE_FIREBASE_API_KEY ve VITE_FIREBASE_APP_ID ekleyip siteyi yeniden başlat.');
      return;
    }
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
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
    const synced = syncState === 'synced' && cloudReady.current;
    const msg = synced
      ? 'Çıkış yapınca bu cihazdaki kayıtlar temizlenir; hesabında kayıtlı kalır. Devam edilsin mi?'
      : '⚠ Kayıtların buluta eşlenmedi! Çıkarsan bu cihazdaki kayıtlar kalıcı olarak silinir. Önce "Yedek indir" ile yedek al. Yine de çıkılsın mı?';
    if (!(await uiConfirm(msg))) return;
    localStorage.removeItem('hk_synced_uid');
    cloudReady.current = false;
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

  const initial = user ? (user.name || user.email || '?').trim().charAt(0).toUpperCase() : '';
  const chipClass = syncState === 'synced' ? 'ok' : syncState === 'error' ? 'err' : '';

  return (
    <div className="hk">
      <style>{CSS}</style>
      <div className="hk-bg">
        <span className="hk-blob b1" />
        <span className="hk-blob b2" />
        <span className="hk-blob b3" />
      </div>
      <div className="hk-wrap">
        <header className="hk-head">
          <div className="hk-brand">
            <span className="hk-logo">₺</span>
            <div>
              <h1 className="hk-title">Hesap Kitap</h1>
              <p className="hk-sub">Gelir gider takibim</p>
            </div>
          </div>
          {user && (
            <div className={`hk-chip ${chipClass}`}>
              <i>{initial}</i>
              <span>
                {syncState === 'synced' && `✓ Eşleşti • ${user.email}`}
                {syncState === 'loading' && `Eşleniyor… • ${user.email}`}
                {syncState === 'error' && `⚠ Eşleme hatası • ${user.email}`}
                {syncState === 'local' && user.email}
              </span>
            </div>
          )}
        </header>

        <section className="hk-hero">
          <div className="hk-balance">
            <p className="lbl">Güncel bakiye</p>
            <div className="big"><CountUp value={currentBalance} format={fmt2} /> ₺</div>
          </div>
          <div className="hk-side">
            <div className="hk-stat in">
              <p className="lbl"><TrendingUp /> Bu ay gelen</p>
              <b><CountUp value={monthlyIncome} format={fmt} /> ₺</b>
            </div>
            <div className="hk-stat out">
              <p className="lbl"><TrendingDown /> Bu ay harcanan</p>
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
                <>
                  <div className="hk-stack">
                    {categoryExpenses.map(([cat, val]) => (
                      <i key={cat} style={{ flex: val, background: colorOf(cat) }} title={cat} />
                    ))}
                  </div>
                  {categoryExpenses.map(([cat, val]) => (
                    <div className="hk-cat" key={cat} style={catVars(cat)}>
                      <div className="hk-cat-top">
                        <span><em>{iconOf(cat)}</em> {cat}</span>
                        <span>{fmt(val)} ₺</span>
                      </div>
                      <div className="hk-bar"><i style={{ width: `${Math.max((val / monthlyExpense) * 100, 1)}%` }} /></div>
                    </div>
                  ))}
                </>
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
          {grouped.length === 0 && (
            <div className="hk-none">
              <span className="hk-none-ico"><Wallet /></span>
              <b>Bu ay için kayıt yok</b>
              <p>İlk gelir ya da giderini ekleyerek {monthLabel(selectedMonth)} ayını başlat.</p>
              <button type="button" onClick={openNew}><Plus /> İlk kaydı ekle</button>
            </div>
          )}
          {grouped.map((g) => (
            <div key={g.date}>
              <p className="hk-date">{trDate(g.date)} <small>{dayName(g.date)}</small></p>
              <div className="hk-list">
                {g.items.map((item) => {
                  const income = item.type === 'gelir';
                  return (
                    <div className="hk-item" key={item.id} style={catVars(item.category)}>
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
              <h3>{editingId ? '✏️ Kaydı düzenle' : '✨ Yeni kayıt'}</h3>
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
