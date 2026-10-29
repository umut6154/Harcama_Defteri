import { useRef, useEffect } from 'react';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Pencil, Trash2, Cloud, Download, Upload, CircleDot, Plus, TrendingUp, TrendingDown, Wallet } from 'lucide-react';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip } from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, onSnapshot, setDoc } from 'firebase/firestore';
import { initFX, triggerConfetti, triggerPuff, useFX } from './hk-fx';

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
  'Market': '#14b8d4',
  'Yurt/KYK': '#3b7bff',
  'Abonelik': '#9b5cff',
  'Eğlence': '#ff4d8d',
  'Kişisel Bakım': '#06b6d4',
  'Ulaşım': '#f5b700',
  'Diğer': '#7c83c9',
  'Burs/Harçlık': '#2f9bff',
  'Maaş': '#6a7cff',
  'Diğer Gelir': '#5bc8f5',
};
const colorOf = (name) => CAT_COLORS[name] || '#7c83c9';
const ALL_CATEGORIES = [...CATEGORIES.gider, ...CATEGORIES.gelir];
const iconOf = (name) => ALL_CATEGORIES.find((c) => c.name === name)?.icon || '📦';
const MONTHS = {
  tr: ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'],
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
};
const DAYS = {
  tr: ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'],
  en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
};

/* ---------- Diller (kayıtlar her zaman Türkçe kategori adıyla saklanır; sadece görünüm çevrilir) ---------- */
const STR = {
  tr: {
    sub: 'Gelir gider takibim',
    synced: 'Eşleşti', syncing: 'Eşleniyor…', syncErr: 'Eşleme hatası',
    balance: 'Güncel bakiye', monthIn: 'Bu ay gelen', monthOut: 'Bu ay harcanan',
    summary: 'Aylık özet', byCat: 'Kategoriye göre harcama', noSpend: 'Bu ay henüz harcama yok.', daily: 'Günlük harcama',
    noRec: 'Bu ay için kayıt yok', startMonth: (m) => `İlk gelir ya da giderini ekleyerek ${m} ayını başlat.`, addFirst: 'İlk kaydı ekle',
    logout: 'Çıkış yap', login: 'Google ile giriş', exp: 'Yedek indir', imp: 'Yedek yükle', initBal: 'Başlangıç bakiyesi',
    newRec: 'Yeni kayıt', editRec: '✏️ Kaydı düzenle', newRecT: '✨ Yeni kayıt', expense: 'Gider', income: 'Gelir',
    amount: 'Tutar (₺)', category: 'Kategori', date: 'Tarih', desc: 'Açıklama', optional: 'İsteğe bağlı', cancel: 'Vazgeç', save: 'Kaydet', ok: 'Tamam',
    edit: 'Düzenle', del: 'Sil', dayN: (n) => `${n}. gün`, langBtn: 'Dili değiştir',
    delAsk: (d, t, a) => `${d} - ${t} - ${a} ₺ silinsin mi?`,
    initPrompt: 'Başlangıç bakiyesi (₺):',
    noReadable: (k) => `Dosyada okunabilir kayıt bulunamadı. (Dosyadaki alanlar: ${k})`, listWord: 'liste', emptyWord: 'boş',
    replaceAsk: (a, b) => `Mevcut ${a} kayıt silinip yerine yedekteki ${b} kayıt yüklenecek. Devam edilsin mi?`,
    imported: (n) => `Yedek yüklendi! ${n} kayıt aktarıldı.`, badFile: 'Geçersiz dosya! Dosya bozuk veya JSON değil.',
    fbMissing: 'Firebase ayarı eksik: .env dosyasına VITE_FIREBASE_API_KEY ve VITE_FIREBASE_APP_ID ekleyip siteyi yeniden başlat.',
    badKey: "API anahtarı geçersiz. Firebase Console'daki apiKey değerini koddaki firebaseConfig içine harfi harfine kopyala.",
    gOff: "Google girişi kapalı. Firebase > Authentication > Sign-in method > Google'ı etkinleştir.",
    badDomain: "Bu alan adı Firebase'de yetkili değil. Authentication > Settings > Authorized domains kısmına ekle.",
    popup: 'Tarayıcı giriş penceresini engelledi. Adres çubuğundaki "pencere engellendi" simgesinden izin verip tekrar dene.',
    loginFail: (c) => `Giriş yapılamadı (${c})`,
    outSynced: 'Çıkış yapınca bu cihazdaki kayıtlar temizlenir; hesabında kayıtlı kalır. Devam edilsin mi?',
    outUnsynced: '⚠ Kayıtların buluta eşlenmedi! Çıkarsan bu cihazdaki kayıtlar kalıcı olarak silinir. Önce "Yedek indir" ile yedek al. Yine de çıkılsın mı?',
    cats: {},
  },
  en: {
    sub: 'My income & expense tracker',
    synced: 'Synced', syncing: 'Syncing…', syncErr: 'Sync error',
    balance: 'Current balance', monthIn: 'Income this month', monthOut: 'Spent this month',
    summary: 'Monthly summary', byCat: 'Spending by category', noSpend: 'No spending this month yet.', daily: 'Daily spending',
    noRec: 'No records this month', startMonth: (m) => `Add your first income or expense to start ${m}.`, addFirst: 'Add first record',
    logout: 'Sign out', login: 'Sign in with Google', exp: 'Download backup', imp: 'Upload backup', initBal: 'Starting balance',
    newRec: 'New record', editRec: '✏️ Edit record', newRecT: '✨ New record', expense: 'Expense', income: 'Income',
    amount: 'Amount (₺)', category: 'Category', date: 'Date', desc: 'Description', optional: 'Optional', cancel: 'Cancel', save: 'Save', ok: 'OK',
    edit: 'Edit', del: 'Delete', dayN: (n) => `Day ${n}`, langBtn: 'Change language',
    delAsk: (d, t, a) => `Delete ${d} - ${t} - ${a} ₺?`,
    initPrompt: 'Starting balance (₺):',
    noReadable: (k) => `No readable records found in the file. (Fields in file: ${k})`, listWord: 'list', emptyWord: 'empty',
    replaceAsk: (a, b) => `Your current ${a} records will be deleted and replaced with the ${b} records from the backup. Continue?`,
    imported: (n) => `Backup loaded! ${n} records imported.`, badFile: 'Invalid file! The file is corrupted or not JSON.',
    fbMissing: 'Firebase config is missing: add VITE_FIREBASE_API_KEY and VITE_FIREBASE_APP_ID to your .env file and restart the site.',
    badKey: 'Invalid API key. Copy the apiKey from the Firebase Console exactly into firebaseConfig in the code.',
    gOff: 'Google sign-in is disabled. Enable Google in Firebase > Authentication > Sign-in method.',
    badDomain: 'This domain is not authorized in Firebase. Add it under Authentication > Settings > Authorized domains.',
    popup: 'The browser blocked the sign-in window. Allow pop-ups from the address bar icon and try again.',
    loginFail: (c) => `Could not sign in (${c})`,
    outSynced: 'Signing out clears the records on this device; they stay saved in your account. Continue?',
    outUnsynced: '⚠ Your records are not synced to the cloud! If you sign out, the records on this device will be permanently deleted. Download a backup first. Sign out anyway?',
    cats: { 'Yemek': 'Food', 'Market': 'Groceries', 'Yurt/KYK': 'Dorm/KYK', 'Abonelik': 'Subscriptions', 'Eğlence': 'Entertainment', 'Kişisel Bakım': 'Personal Care', 'Ulaşım': 'Transport', 'Diğer': 'Other', 'Burs/Harçlık': 'Scholarship/Allowance', 'Maaş': 'Salary', 'Diğer Gelir': 'Other Income' },
  },
};
let curLang = 'tr';
const catLabel = (name) => STR[curLang].cats[name] || name;

/* ---------- Yardımcılar ---------- */
const pad = (n) => String(n).padStart(2, '0');
const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const loc = () => (curLang === 'en' ? 'en-US' : 'tr-TR');
const fmt = (n) => Number(n).toLocaleString(loc(), { minimumFractionDigits: 0, maximumFractionDigits: 2, useGrouping: 'always' });
const fmt2 = (n) => Number(n).toLocaleString(loc(), { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: 'always' });
const trDate = (iso) => {
  const [y, m, d] = iso.split('-');
  return curLang === 'en' ? `${m}/${d}/${y}` : `${d}.${m}.${y}`;
};
const monthLabel = (ym) => {
  const [y, m] = ym.split('-');
  return `${MONTHS[curLang][parseInt(m, 10) - 1]} ${y}`;
};
const dayName = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return DAYS[curLang][new Date(y, m - 1, d).getDay()];
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
@property --p { syntax: '<number>'; inherits: true; initial-value: 0.5; }
html, body { margin: 0; padding: 0; display: block; width: 100%; max-width: none; min-width: 0; background: #fff6fb; color-scheme: light; text-align: left; }
#root { max-width: none; width: 100%; margin: 0; padding: 0; text-align: left; }
button, input, select { font-family: inherit; }

.hk { --ink: #1f1a4d; --mute: #6b6a93; position: relative; overflow: hidden; min-height: 100vh; color: var(--ink); font-family: 'Poppins', 'Segoe UI', system-ui, sans-serif; padding: 26px 18px 40px; --cyc: 8s; animation: hk-spin var(--cyc) steps(64, end) infinite alternate;
  --p: .5;
  --h1: calc(215 + 76 * var(--p)); --h2: calc(272 + 76 * var(--p)); --h3: calc(329 + 76 * var(--p)); --h4: calc(243 + 76 * var(--p)); --h5: calc(300 + 76 * var(--p));
  --c1: oklch(.76 .16 var(--h1)); --c2: oklch(.74 .18 var(--h2)); --c3: oklch(.74 .19 var(--h3)); --c4: oklch(.75 .17 var(--h4)); --c5: oklch(.74 .19 var(--h5));
  --d1: oklch(.66 .19 var(--h1)); --d2: oklch(.62 .22 var(--h2)); --d3: oklch(.64 .23 var(--h3));
  --b1: oklch(.93 .06 var(--h3)); --b2: oklch(.93 .05 var(--h1)); --b3: oklch(.93 .06 var(--h5)); --b4: oklch(.93 .06 var(--h2)); }
.hk-bg { position: fixed; inset: 0; z-index: 0; overflow: hidden; pointer-events: none;
  background:
    radial-gradient(900px 500px at 8% -5%, var(--b1) 0%, transparent 60%),
    radial-gradient(800px 500px at 100% 5%, var(--b2) 0%, transparent 55%),
    radial-gradient(900px 600px at 90% 100%, var(--b3) 0%, transparent 55%),
    radial-gradient(800px 600px at 0% 95%, var(--b4) 0%, transparent 55%),
    #fff7fb; }
.hk h1, .hk h2, .hk h3, .hk p { margin: 0; }
.hk-blob { position: absolute; border-radius: 50%; filter: blur(70px); opacity: .55; pointer-events: none; z-index: 0; will-change: transform; animation: hk-drift 16s ease-in-out infinite alternate; }
.hk-blob.b1 { width: 340px; height: 340px; background: var(--c3); top: 12%; left: -90px; }
.hk-blob.b2 { width: 300px; height: 300px; background: var(--c1); top: 40%; right: -80px; animation-delay: -5s; }
.hk-blob.b3 { width: 280px; height: 280px; background: var(--c2); bottom: -80px; left: 30%; animation-delay: -9s; }
.hk-wrap { position: relative; z-index: 1; max-width: 1080px; margin: 0 auto; display: flex; flex-direction: column; gap: 22px; }

/* Üst bar */
.hk-head { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: start; gap: 12px 10px; }
.hk-brand { display: flex; align-items: center; gap: 12px; min-width: 0; }
.hk-brand > div:last-child { min-width: 0; }
.hk-logo { width: 48px; height: 48px; border-radius: 16px; background: linear-gradient(135deg, var(--d1), var(--d2) 55%, var(--d3)); display: grid; place-items: center; font-size: 26px; font-weight: 800; color: #fff; box-shadow: 0 10px 24px rgba(255,77,141,.4); animation: hk-float 3.4s ease-in-out infinite; }
.hk-title { font-size: 28px; font-weight: 800; letter-spacing: -.01em; background: linear-gradient(90deg, var(--d1), var(--d2), var(--d3)); -webkit-background-clip: text; background-clip: text; color: transparent; -webkit-text-fill-color: transparent; }
.hk-sub { font-size: 12.5px; color: var(--mute); margin-top: 1px; }
.hk-chip { grid-column: 1 / -1; grid-row: 2; justify-self: start; display: inline-flex; align-items: center; gap: 8px; background: #fff; border-radius: 999px; padding: 6px 14px 6px 6px; font-size: 12px; font-weight: 600; color: var(--ink); box-shadow: 0 6px 18px rgba(80,60,160,.12); max-width: 100%; }
.hk-chip i { font-style: normal; width: 26px; height: 26px; border-radius: 50%; display: grid; place-items: center; color: #fff; font-size: 12px; font-weight: 700; background: linear-gradient(135deg, #3b7bff, #9b5cff); flex-shrink: 0; }
.hk-chip span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.hk-chip.err i { background: linear-gradient(135deg, #ff4d4d, #ff9a3d); }
.hk-chip.ok i { background: linear-gradient(135deg, var(--d1), var(--d2)); }

/* Bakiye alanı */
.hk-lang { grid-column: 2; grid-row: 1; justify-self: end; margin-top: 7px; flex-shrink: 0; white-space: nowrap; display: inline-flex; align-items: center; padding: 4px; gap: 2px; border: 0; border-radius: 999px; cursor: pointer; background: #fff; box-shadow: 0 6px 18px rgba(80,60,160,.14); transition: transform .2s, box-shadow .2s; }
.hk-lang:hover { transform: translateY(-2px); box-shadow: 0 10px 22px rgba(80,60,160,.2); }
.hk-lang b { font-size: 12px; font-weight: 700; padding: 6px 11px; border-radius: 999px; color: var(--mute); transition: background .25s, color .25s; }
.hk-lang b.on { color: #fff; background: linear-gradient(135deg, var(--d1), var(--d2) 55%, var(--d3)); }
.hk-hero { display: grid; grid-template-columns: 1.7fr 1fr; gap: 16px; }
.hk-balance { position: relative; overflow: hidden; border-radius: 30px; padding: 28px 30px; color: #fff; background: linear-gradient(120deg, var(--d1), var(--d2) 50%, var(--d3)); animation: hk-rise .7s cubic-bezier(.2,.8,.2,1) both; box-shadow: 0 24px 50px color-mix(in srgb, var(--d2) 40%, transparent); }
.hk-balance::before { content: ''; position: absolute; width: 260px; height: 260px; border-radius: 50%; right: -70px; top: -90px; background: rgba(255,255,255,.2); }
.hk-balance::after { content: ''; position: absolute; width: 180px; height: 180px; border-radius: 50%; right: 60px; bottom: -100px; background: rgba(255,230,120,.35); }
.hk-balance > * { position: relative; z-index: 1; }
.hk-balance .lbl { font-size: 13px; opacity: .92; font-weight: 500; }
.hk-balance .big { margin-top: 6px; font-size: 50px; line-height: 1.1; font-weight: 800; letter-spacing: -.02em; font-variant-numeric: tabular-nums; text-shadow: 0 4px 20px rgba(0,0,0,.18); }
.hk-balance .mini { margin-top: 18px; display: inline-flex; align-items: center; gap: 8px; background: rgba(255,255,255,.22); border: 1px solid rgba(255,255,255,.4); border-radius: 999px; padding: 6px 14px; font-size: 12px; font-weight: 600; backdrop-filter: blur(6px); }

.hk-side { display: grid; grid-template-rows: 1fr 1fr; gap: 16px; }
.hk-stat { position: relative; overflow: hidden; border-radius: 24px; padding: 18px 20px; color: #fff; display: flex; flex-direction: column; justify-content: center; animation: hk-rise .7s .1s cubic-bezier(.2,.8,.2,1) both; transition: transform .25s, box-shadow .25s; }
.hk-stat:hover { transform: translateY(-4px) scale(1.02); }
.hk-stat.in { background: linear-gradient(120deg, var(--d1), var(--d2) 50%, var(--d3)); box-shadow: 0 16px 34px color-mix(in srgb, var(--d2) 40%, transparent); }
.hk-stat.out { background: linear-gradient(120deg, var(--d1), var(--d2) 50%, var(--d3)); box-shadow: 0 16px 34px color-mix(in srgb, var(--d2) 40%, transparent); animation-delay: .2s; }
.hk-stat::after { content: ''; position: absolute; width: 110px; height: 110px; border-radius: 50%; right: -30px; top: -40px; background: rgba(255,255,255,.22); }
.hk-stat .lbl { font-size: 12px; font-weight: 500; opacity: .95; display: flex; align-items: center; gap: 6px; white-space: nowrap; }
.hk-stat .lbl svg { width: 15px; height: 15px; flex-shrink: 0; }
.hk-stat b { margin-top: 4px; font-size: 24px; font-weight: 800; font-variant-numeric: tabular-nums; position: relative; z-index: 1; }

/* Aylık özet */
.hk-sumhead { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; gap: 10px; }
.hk .hk-sumhead h2 { display: flex; align-items: center; gap: 10px; font-size: 25px; font-weight: 800; letter-spacing: -.01em; color: #1f1a4d; -webkit-text-fill-color: #1f1a4d; opacity: 1; text-shadow: 0 2px 0 rgba(255,255,255,.9); }
.hk .hk-sumhead h2::before { content: ''; width: 8px; height: 28px; border-radius: 99px; background: linear-gradient(180deg, var(--c1), var(--c2), var(--c3)); }
.hk-select { background: #fff; color: var(--ink); border: 2px solid transparent; border-radius: 999px; padding: 9px 18px; font-size: 14px; font-weight: 600; cursor: pointer; outline: none; box-shadow: 0 6px 18px rgba(80,60,160,.14); background-image: linear-gradient(#fff, #fff), linear-gradient(90deg, var(--c1), var(--c2), var(--c3)); background-origin: border-box; background-clip: padding-box, border-box; transition: box-shadow .2s; }
.hk-select:focus { box-shadow: 0 0 0 4px rgba(155,92,255,.25); }

.hk-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.hk-panel { position: relative; overflow: hidden; border-radius: 26px; padding: 22px; min-height: 240px; display: flex; flex-direction: column; background: #fff; box-shadow: 0 14px 38px rgba(80,60,160,.13); animation: hk-rise .6s .15s cubic-bezier(.2,.8,.2,1) both; transition: transform .3s, box-shadow .3s; }
.hk-panel:hover { transform: translateY(-4px); box-shadow: 0 22px 48px rgba(80,60,160,.2); }
.hk-panel::before { content: ''; position: absolute; left: 0; right: 0; top: 0; height: 6px; background: linear-gradient(90deg, var(--c1), var(--c4), var(--c2), var(--c5), var(--c3)); }
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
.hk-date { display: inline-flex; align-items: center; gap: 8px; font-size: 12px; font-weight: 700; color: #fff; background: linear-gradient(90deg, var(--d1), var(--d3)); padding: 5px 14px; border-radius: 999px; margin: 18px 0 10px 2px; box-shadow: 0 8px 18px color-mix(in srgb, var(--d3) 35%, transparent); }
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
.hk-amt.out { color: color-mix(in srgb, var(--d3) 75%, #000); background: color-mix(in srgb, var(--d3) 14%, #fff); }
.hk-amt.in { color: color-mix(in srgb, var(--d1) 70%, #000); background: color-mix(in srgb, var(--d1) 14%, #fff); }
.hk-icon-btn { background: #f1eeff; border: 0; padding: 7px; border-radius: 10px; cursor: pointer; display: grid; place-items: center; color: #6d4aff; transition: background .15s, transform .15s, color .15s; }
.hk-icon-btn:hover { background: #6d4aff; color: #fff; transform: scale(1.12); }
.hk-icon-btn.del { background: #ffe9ee; color: #e11d48; }
.hk-icon-btn.del:hover { background: #e11d48; color: #fff; }
.hk-icon-btn svg { width: 15px; height: 15px; }
.hk-none { display: flex; flex-direction: column; align-items: center; gap: 8px; text-align: center; padding: 36px 18px; background: rgba(255,255,255,.9); border-radius: 28px; border: 2px dashed #d8cbff; }
.hk-none-ico { width: 74px; height: 74px; border-radius: 26px; display: grid; place-items: center; color: #fff; margin-bottom: 6px; background: linear-gradient(135deg, var(--d1), var(--d2) 55%, var(--d3)); box-shadow: 0 14px 30px rgba(255,77,141,.38); animation: hk-float 3.4s ease-in-out infinite; }
.hk-none-ico svg { width: 36px; height: 36px; }
.hk-none b { font-size: 18px; font-weight: 800; color: var(--ink); }
.hk-none p { font-size: 13px; color: var(--mute); max-width: 320px; line-height: 1.5; }
.hk-none button { margin-top: 8px; display: inline-flex; align-items: center; gap: 6px; padding: 10px 20px; border: 0; border-radius: 999px; color: #fff; font-size: 13px; font-weight: 700; cursor: pointer; background: linear-gradient(135deg, var(--d2), var(--d3)); box-shadow: 0 10px 22px rgba(155,92,255,.35); transition: transform .2s, box-shadow .2s; }
.hk-none button:hover { transform: translateY(-3px) scale(1.04); box-shadow: 0 16px 28px rgba(155,92,255,.45); }
.hk-none button svg { width: 16px; height: 16px; }

/* Alt butonlar */
.hk-foot { display: flex; flex-wrap: wrap; gap: 10px; padding: 14px 0 130px; }
.hk-fbtn { display: inline-flex; align-items: center; gap: 8px; padding: 11px 18px; border-radius: 999px; border: 0; color: #fff; font-size: 13px; font-weight: 700; cursor: pointer; box-shadow: 0 10px 22px rgba(80,60,160,.22); transition: transform .2s, box-shadow .2s, filter .2s; }
.hk-fbtn:nth-of-type(1) { background: linear-gradient(135deg, var(--d1), var(--d2)); }
.hk-fbtn:nth-of-type(2) { background: linear-gradient(135deg, var(--d2), var(--d3)); }
.hk-fbtn:nth-of-type(3) { background: linear-gradient(135deg, var(--d3), var(--d1)); }
.hk-fbtn:nth-of-type(4) { background: linear-gradient(135deg, var(--d1), var(--d3)); }
.hk-fbtn:hover { transform: translateY(-3px) scale(1.04); filter: brightness(1.08); box-shadow: 0 16px 30px rgba(80,60,160,.3); }
.hk-fbtn svg { width: 16px; height: 16px; transition: transform .3s; }
.hk-fbtn:hover svg { transform: rotate(-15deg) scale(1.2); }
.hk-file { display: none; }

.hk-fab { position: fixed; right: 30px; bottom: calc(80px + env(safe-area-inset-bottom, 0px)); width: 62px; height: 62px; border-radius: 50%; border: 0; background: linear-gradient(135deg, var(--d1), var(--d2), var(--d3)); color: #fff; display: grid; place-items: center; cursor: pointer; transition: transform .2s; z-index: 20; box-shadow: 0 12px 28px color-mix(in srgb, var(--d2) 55%, transparent); }
.hk-fab::after { content: ''; position: absolute; inset: 0; border-radius: 50%; background: var(--d2); z-index: -1; opacity: 0; animation: hk-ring 2.6s ease-out infinite; }
.hk-fab:hover { transform: rotate(90deg) scale(1.1); }
.hk-fab:active { transform: scale(.9); }
.hk-fab svg { width: 30px; height: 30px; }

/* Pencereler */
.hk-overlay { position: fixed; inset: 0; background: rgba(48,26,110,.45); backdrop-filter: blur(6px); display: grid; place-items: center; padding: 16px; z-index: 50; animation: hk-fade .2s both; }
.hk-overlay.top { z-index: 60; }
.hk-modal { position: relative; overflow: hidden; width: 100%; max-width: 400px; background: #fff; border-radius: 28px; padding: 28px 24px 24px; box-shadow: 0 30px 70px rgba(48,26,110,.4); animation: hk-pop .3s cubic-bezier(.2,1.2,.3,1) both; color: var(--ink); }
.hk-modal::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 8px; background: linear-gradient(90deg, var(--c1), var(--c4), var(--c2), var(--c5), var(--c3)); }
.hk-modal h3 { font-size: 19px; font-weight: 800; margin-bottom: 16px; }
.hk-dlg-msg { font-size: 14px; line-height: 1.55; margin: 0 0 16px; white-space: pre-line; font-weight: 500; }
.hk-form { display: flex; flex-direction: column; gap: 13px; }
.hk-two { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.hk-type { padding: 12px; border-radius: 14px; border: 2px solid #ece6ff; background: #f7f4ff; color: var(--mute); font-size: 14px; font-weight: 700; cursor: pointer; transition: all .2s; }
.hk-type:hover { transform: translateY(-2px); }
.hk-type.on-out { background: linear-gradient(135deg, var(--d3), var(--d2)); border-color: transparent; color: #fff; box-shadow: 0 10px 20px color-mix(in srgb, var(--d3) 38%, transparent); }
.hk-type.on-in { background: linear-gradient(135deg, var(--d1), var(--d2)); border-color: transparent; color: #fff; box-shadow: 0 10px 20px color-mix(in srgb, var(--d1) 38%, transparent); }
.hk-label { display: block; }
.hk-label span { display: block; font-size: 12px; font-weight: 600; color: var(--mute); margin-bottom: 5px; }
.hk-input { width: 100%; background: #f7f4ff; border: 2px solid #ece6ff; border-radius: 14px; padding: 11px 14px; font-size: 14px; font-weight: 500; color: var(--ink); outline: none; color-scheme: light; transition: border-color .2s, box-shadow .2s, background .2s; }
.hk-input::placeholder { color: #aaa6d0; }
.hk-input:focus { border-color: #9b5cff; background: #fff; box-shadow: 0 0 0 4px rgba(155,92,255,.18); }
.hk-cancel, .hk-save { padding: 12px; border-radius: 14px; border: 0; font-size: 14px; font-weight: 700; cursor: pointer; transition: transform .15s, box-shadow .2s, background .2s; }
.hk-cancel { background: #f1eeff; color: #5b3df0; }
.hk-cancel:hover { background: #e6e0ff; }
.hk-save { color: #fff; background: linear-gradient(135deg, var(--d2), var(--d3)); box-shadow: 0 10px 22px rgba(155,92,255,.35); }
.hk-save:hover { transform: translateY(-2px); box-shadow: 0 14px 28px rgba(155,92,255,.45); }

@keyframes hk-rise { from { opacity: 0; transform: translateY(18px); } to { opacity: 1; transform: none; } }
@keyframes hk-slide { from { opacity: 0; transform: translateX(-14px); } to { opacity: 1; transform: none; } }
@keyframes hk-grow { from { transform: scaleX(0); } to { transform: scaleX(1); } }
@keyframes hk-flow { 0%,100% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } }
@keyframes hk-float { 0%,100% { transform: translateY(0) rotate(0); } 50% { transform: translateY(-5px) rotate(-5deg); } }
@keyframes hk-drift { to { transform: translate(60px, 40px) scale(1.2); } }
@keyframes hk-ring { from { transform: scale(1); opacity: .5; } to { transform: scale(1.55); opacity: 0; } }
@keyframes hk-fade { from { opacity: 0; } to { opacity: 1; } }
@keyframes hk-pop { from { opacity: 0; transform: scale(.9) translateY(10px); } to { opacity: 1; transform: none; } }
@keyframes hk-spin { from { --p: 0; } to { --p: 1; } }
@media (max-width: 760px) {
  .hk { padding: 18px 14px 40px; }
  .hk-blob { filter: blur(44px); }
  .hk-blob.b3 { display: none; }
  .hk-foot { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; padding: 8px 0 130px; }
  .hk-fbtn { flex-direction: column; justify-content: center; align-items: center; gap: 5px; padding: 11px 4px; border-radius: 18px; font-size: 10.5px; font-weight: 700; line-height: 1.2; text-align: center; min-width: 0; }
  .hk-fbtn svg { width: 18px; height: 18px; flex-shrink: 0; }
  .hk-hero { grid-template-columns: 1fr; }
  .hk-side { grid-template-columns: 1fr 1fr; grid-template-rows: none; }
  .hk-grid { grid-template-columns: 1fr; }
  .hk-balance { padding: 24px 22px; }
  .hk-balance .big { font-size: 38px; }
  .hk-stat { padding: 16px 14px; }
  .hk-stat .lbl { font-size: 11.5px; gap: 5px; }
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
  const [lang, setLang] = useState(() => (localStorage.getItem('hk_lang') === 'en' ? 'en' : 'tr'));
  curLang = lang;
  const T = STR[lang];
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
  const ptrY = useRef(-1); // grafikte imlecin/parmağın dikey konumu

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
  // Tarayıcı otomatik çevirisini (Chrome "Çevir" vb.) kapat; sayfa dilini seçili dile ayarla
  useEffect(() => {
    localStorage.setItem('hk_lang', lang);
    const root = document.documentElement;
    root.lang = lang;
    root.setAttribute('translate', 'no');
    root.classList.add('notranslate');
    let m = document.querySelector("meta[name='google']");
    if (!m) { m = document.createElement('meta'); m.name = 'google'; document.head.appendChild(m); }
    m.content = 'notranslate';
    let c = document.querySelector("meta[http-equiv='Content-Language']");
    if (!c) { c = document.createElement('meta'); c.httpEquiv = 'Content-Language'; document.head.appendChild(c); }
    c.content = lang;
  }, [lang]);
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
    const hue = (340 - c.dataIndex * 4 + 360) % 360;
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
      labels: totals.map((_, i) => T.dayN(i + 1)),
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
  }, [monthly, selectedMonth, lang]);

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 700, easing: 'easeOutQuart' },
    // Kaydırırken tetiklenmesin: sadece fare hareketi ve dokunup bırakma (tıklama) dinlenir
    events: ['mousemove', 'mouseout', 'click'],
    interaction: { mode: 'index', intersect: false },
    onHover: (e, els, chart) => {
      ptrY.current = e.y ?? -1;
      const el = els.length ? els[0] : null;
      // Sadece çubuğa yakınken (en fazla 26px yukarısına kadar) algıla
      const idx = el && ptrY.current >= el.element.y - 26 ? el.index : null;
      if (idx !== hoverIdx.current) {
        hoverIdx.current = idx;
        chart.update('none');
      }
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        filter: (item) => ptrY.current >= item.element.y - 26,
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

  // FX hook
  const fx = useFX();
  useEffect(() => initFX(), []);

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
    // >>> EFEKTLER <<<
    if (type === 'gelir') triggerConfetti(); else triggerPuff();
    // >>> EFEKTLER SONU <<<
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
    const ok = await uiConfirm(T.delAsk(trDate(item.date), item.description || catLabel(item.category), fmt(item.amount)));
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
          const keys = Array.isArray(parsed) ? T.listWord : Object.keys(parsed || {}).join(', ');
          uiAlert(T.noReadable(keys || T.emptyWord));
          return;
        }
        if (transactions.length > 0 && !(await uiConfirm(T.replaceAsk(transactions.length, list.length)))) return;
        setTransactions(list);
        if (typeof initial === 'number') setInitialBalance(initial);
        const months = [...new Set(list.map((t) => t.date.slice(0, 7)))].sort().reverse();
        if (!months.includes(selectedMonth)) setSelectedMonth(months[0]);
        uiAlert(T.imported(list.length));
      } catch {
        uiAlert(T.badFile);
      }
    };
    reader.readAsText(file, 'UTF-8');
    e.target.value = '';
  };

  const handleSetInitialBalance = async () => {
    const val = await uiPrompt(T.initPrompt, initialBalance);
    if (val === null) return;
    const raw = String(val).trim();
    const n = /^\d{1,3}(\.\d{3})+$/.test(raw) ? parseFloat(raw.replace(/\./g, '')) : toNumber(raw);
    if (!isNaN(n)) setInitialBalance(n);
  };

  const handleLogin = async () => {
    const auth = getFirebaseAuth();
    if (!auth) {
      uiAlert(T.fbMissing);
      return;
    }
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    try {
      await signInWithPopup(auth, provider);
    } catch (err) {
      if (err.code === 'auth/popup-closed-by-user' || err.code === 'auth/cancelled-popup-request') return;
      if (err.code === 'auth/api-key-not-valid.-please-pass-a-valid-api-key.' || err.code === 'auth/invalid-api-key') uiAlert(T.badKey);
      else if (err.code === 'auth/operation-not-allowed') uiAlert(T.gOff);
      else if (err.code === 'auth/unauthorized-domain') uiAlert(T.badDomain);
      else if (err.code === 'auth/popup-blocked') uiAlert(T.popup);
      else uiAlert(T.loginFail(err.code || err.message));
    }
  };

  const handleLogout = async () => {
    const synced = syncState === 'synced' && cloudReady.current;
    const msg = synced ? T.outSynced : T.outUnsynced;
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
    <div className="hk notranslate" translate="no" lang={lang}>
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
              <p className="hk-sub">{T.sub}</p>
            </div>
          </div>
          <div className="hk-chip {chipClass}">
            <i>{initial}</i>
            <span>{syncState === 'synced' ? T.synced : syncState === 'loading' ? T.syncing : syncState === 'error' ? T.syncErr : 'Yerel'}</span>
          </div>
          <button className="hk-lang" onClick={() => setLang(lang === 'tr' ? 'en' : 'tr')} aria-label={T.langBtn}>
            <b className={lang === 'tr' ? 'on' : ''}>TR</b>
            <b className={lang === 'en' ? 'on' : ''}>EN</b>
          </button>
        </header>

        <div className="hk-hero">
          <div className="hk-balance">
            <div className="lbl">{T.balance}</div>
            <div className="big"><CountUp value={currentBalance} format={fmt} /> ₺</div>
            <div className="mini">
              <TrendingUp className="in" style={{width:14,height:14,color:'#fff'}} /> <span>{T.monthIn}: {fmt(monthlyIncome)} ₺</span>
              <TrendingDown className="out" style={{width:14,height:14,color:'#fff'}} /> <span>{T.monthOut}: {fmt(monthlyExpense)} ₺</span>
            </div>
          </div>
          <div className="hk-side">
            <div className="hk-stat in">
              <div className="lbl"><TrendingUp style={{width:15,height:15}} /> {T.monthIn}</div>
              <b>{fmt(monthlyIncome)} ₺</b>
            </div>
            <div className="hk-stat out">
              <div className="lbl"><TrendingDown style={{width:15,height:15}} /> {T.monthOut}</div>
              <b>{fmt(monthlyExpense)} ₺</b>
            </div>
          </div>
        </div>

        <div className="hk-sumhead">
          <h2>{T.summary} <select className="hk-select" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)}>{monthOptions.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}</select></h2>
        </div>

        <div className="hk-grid">
          <div className="hk-panel">
            <h3>{T.byCat}</h3>
            {categoryExpenses.length === 0 ? (
              <p className="hk-empty">{T.noSpend}</p>
            ) : (
              <>
                <div className="hk-stack">
                  {categoryExpenses.map(([cat, val], i) => {
                    const total = categoryExpenses.reduce((a, [, v]) => a + v, 0);
                    return <i key={cat} style={{flex: `${val / total * 100}%`, background: colorOf(cat)}} />;
                  })}
                </div>
                {categoryExpenses.map(([cat, val]) => (
                  <div className="hk-cat" key={cat} style={catVars(cat)}>
                    <div className="hk-cat-top">
                      <span><em>{iconOf(cat)}</em>{catLabel(cat)}</span>
                      <span>{fmt(val)} ₺</span>
                    </div>
                    <div className="hk-bar"><i style={{width: `${(val / monthlyExpense) * 100}%`}} /></div>
                  </div>
                ))}
              </>
            )}
          </div>

          <div className="hk-panel">
            <h3>{T.daily}</h3>
            <div className="hk-chart">
              <Bar data={chartData} options={chartOptions} />
            </div>
          </div>
        </div>

        {grouped.length === 0 ? (
          <div className="hk-none">
            <div className="hk-none-ico"><Plus style={{width:36,height:36}} /></div>
            <b>{T.noRec}</b>
            <p>{T.startMonth(monthLabel(selectedMonth))}</p>
            <button onClick={openNew}><Plus style={{width:16,height:16}} /> {T.addFirst}</button>
          </div>
        ) : (
          <div className="hk-list">
            {grouped.map((g) => (
              <React.Fragment key={g.date}>
                <div className="hk-date">{dayName(g.date)} {trDate(g.date)} <small>{g.items.length} kayıt</small></div>
                {g.items.map((t) => (
                  <div className="hk-item" key={t.id} style={catVars(t.category)}>
                    <div className="hk-item-l">
                      <span className="hk-ico">{iconOf(t.category)}</span>
                      <div className="hk-item-t">
                        <b>{t.description || catLabel(t.category)}</b>
                        <small>{catLabel(t.category)}</small>
                      </div>
                    </div>
                    <div className="hk-item-r">
                      <span className={`hk-amt ${t.type === 'gider' ? 'out' : 'in'}`}>{t.type === 'gider' ? '-' : '+'}{fmt(t.amount)} ₺</span>
                      <button className="hk-icon-btn" onClick={() => handleEdit(t)} aria-label={T.edit}><Pencil style={{width:15,height:15}} /></button>
                      <button className="hk-icon-btn del" onClick={() => handleDelete(t)} aria-label={T.del}><Trash2 style={{width:15,height:15}} /></button>
                    </div>
                  </div>
                ))}
              </React.Fragment>
            ))}
          </div>
        )}

        <footer className="hk-foot">
          <button className="hk-fbtn" onClick={openNew}><Plus style={{width:16,height:16}} /> {T.newRecT}</button>
          <button className="hk-fbtn" onClick={handleSetInitialBalance}><Wallet style={{width:16,height:16}} /> {T.initBal}</button>
          <button className="hk-fbtn" onClick={exportBackup}><Download style={{width:16,height:16}} /> {T.exp}</button>
          <button className="hk-fbtn" onClick={() => fileRef.current?.click()}><Upload style={{width:16,height:16}} /> {T.imp}</button>
          <input className="hk-file" type="file" ref={fileRef} accept=".json" onChange={importBackup} hidden />
          {user ? (
            <button className="hk-fbtn" onClick={handleLogout}><CircleDot style={{width:16,height:16}} /> {T.logout}</button>
          ) : (
            <button className="hk-fbtn" onClick={handleLogin}><Cloud style={{width:16,height:16}} /> {T.login}</button>
          )}
        </footer>

        <button className="hk-fab" onClick={openNew} aria-label={T.newRec}><Plus style={{width:30,height:30}} /></button>

        {dlg && (
          <div className="hk-overlay {dlg.kind === 'prompt' ? 'top' : ''}" onClick={() => dlg.kind !== 'prompt' && closeDlg(false)}>
            <div className="hk-modal" onClick={(e) => e.stopPropagation()}>
              <h3>{dlg.title || (dlg.kind === 'confirm' ? 'Onay' : dlg.kind === 'prompt' ? 'Giriş' : 'Bilgi')}</h3>
              {dlg.message && <p className="hk-dlg-msg">{dlg.message}</p>}
              {dlg.kind === 'prompt' && (
                <input className="hk-input" defaultValue={dlg.value} ref={(el) => el?.focus()} onKeyDown={(e) => e.key === 'Enter' && closeDlg(e.target.value)} />
              )}
              <div className="hk-form">
                {dlg.kind === 'confirm' && (
                  <>
                    <button className="hk-cancel" onClick={() => closeDlg(false)}>{T.cancel}</button>
                    <button className="hk-save" onClick={() => closeDlg(true)}>{T.ok}</button>
                  </>
                )}
                {dlg.kind === 'prompt' && (
                  <>
                    <button className="hk-cancel" onClick={() => closeDlg(null)}>{T.cancel}</button>
                    <button className="hk-save" onClick={() => {}}>{T.ok}</button>
                  </>
                )}
                {dlg.kind === 'alert' && (
                  <button className="hk-save" onClick={() => closeDlg(true)}>{T.ok}</button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
