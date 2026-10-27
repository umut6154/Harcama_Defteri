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
html, body { margin: 0; padding: 0; display: block; width: 100%; max-width: none; min-width: 0; background: #0c0d19; text-align: left; }
#root { max-width: none; width: 100%; margin: 0; padding: 0; text-align: left; }
button, input, select { font-family: inherit; }
.hk { text-align: left; min-height: 100vh; background: #0c0d19; color: #e8e9f5; font-family: 'Segoe UI', system-ui, -apple-system, Roboto, Helvetica, Arial, sans-serif; padding: 28px 20px 40px; }
.hk-wrap { max-width: 1100px; margin: 0 auto; display: flex; flex-direction: column; gap: 20px; }
.hk h1, .hk h2, .hk h3, .hk p { margin: 0; }

.hk-head { display: flex; flex-direction: column; gap: 2px; }
.hk-brand { display: flex; align-items: center; gap: 10px; }
.hk-logo { width: 32px; height: 32px; border-radius: 9px; background: #2a1f1a; display: grid; place-items: center; font-size: 18px; }
.hk-title { font-size: 26px; font-weight: 800; letter-spacing: -0.01em; color: #fff; }
.hk-sub { font-size: 13px; color: #8d90ad; }
.hk-user { font-size: 12px; color: #6f7291; }

.hk-balance { border-radius: 24px; padding: 24px 26px; background: linear-gradient(90deg, #5b63ff 0%, #8b4fff 100%); box-shadow: 0 14px 40px rgba(91,99,255,.25); }
.hk-balance .lbl { font-size: 13px; color: rgba(255,255,255,.82); }
.hk-balance .big { margin-top: 4px; font-size: 46px; line-height: 1.1; font-weight: 800; color: #fff; letter-spacing: -0.02em; }
.hk-balance .row { margin-top: 16px; display: flex; gap: 36px; flex-wrap: wrap; }
.hk-balance .row b { display: block; font-size: 18px; font-weight: 700; color: #fff; }

.hk-sumhead { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
.hk-sumhead h2 { font-size: 18px; font-weight: 700; color: #fff; }
.hk-select { background: #0c0d19; color: #fff; border: 1px solid #cfd2e6; border-radius: 8px; padding: 6px 12px; font-size: 14px; cursor: pointer; outline: none; }
.hk-select:focus { box-shadow: 0 0 0 2px #7478ff; }

.hk-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.hk-panel { background: #141628; border: 1px solid #23263f; border-radius: 16px; padding: 16px; min-height: 210px; display: flex; flex-direction: column; }
.hk-panel h3 { font-size: 14px; font-weight: 500; color: #8d90ad; margin-bottom: 14px; }
.hk-empty { font-size: 12px; color: #6f7291; }
.hk-cat { margin-bottom: 14px; }
.hk-cat-top { display: flex; justify-content: space-between; font-size: 14px; color: #f1f2fb; }
.hk-cat-top span:last-child { font-weight: 500; }
.hk-bar { margin-top: 7px; height: 8px; border-radius: 999px; background: #1f2240; overflow: hidden; }
.hk-bar > i { display: block; height: 100%; border-radius: 999px; background: #7478ff; }
.hk-chart { flex: 1; min-height: 140px; position: relative; }

.hk-date { font-size: 11px; color: #6f7291; margin: 16px 0 7px 4px; }
.hk-list { display: flex; flex-direction: column; gap: 8px; }
.hk-item { display: flex; align-items: center; justify-content: space-between; gap: 12px; background: #141628; border: 1px solid #23263f; border-radius: 12px; padding: 10px 14px; }
.hk-item-l { display: flex; align-items: center; gap: 12px; min-width: 0; }
.hk-ico { width: 36px; height: 36px; border-radius: 10px; background: #1e2140; display: grid; place-items: center; font-size: 16px; flex-shrink: 0; }
.hk-item-t { min-width: 0; }
.hk-item-t b { display: block; font-size: 14px; font-weight: 700; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.hk-item-t small { display: block; font-size: 11px; color: #6f7291; margin-top: 1px; }
.hk-item-r { display: flex; align-items: center; gap: 12px; flex-shrink: 0; }
.hk-amt { font-size: 14px; font-weight: 700; }
.hk-amt.out { color: #ff4d6d; }
.hk-amt.in { color: #3ddc84; }
.hk-icon-btn { background: none; border: 0; padding: 2px; cursor: pointer; display: grid; place-items: center; color: #9a9db8; transition: color .15s; }
.hk-icon-btn:hover { color: #fff; }
.hk-icon-btn.del { color: #5b64d6; }
.hk-icon-btn.del:hover { color: #ff4d6d; }
.hk-icon-btn svg { width: 15px; height: 15px; }
.hk-none { font-size: 13px; color: #6f7291; padding: 18px 0; }

.hk-foot { display: flex; flex-wrap: wrap; gap: 8px; padding: 12px 0 90px; }
.hk-fbtn { display: inline-flex; align-items: center; gap: 6px; padding: 7px 12px; border-radius: 12px; border: 1px solid #262a47; background: #141628; color: #e8e9f5; font-size: 12px; cursor: pointer; transition: background .15s; }
.hk-fbtn:hover { background: #1c1f38; }
.hk-fbtn svg { width: 14px; height: 14px; }
.hk-file { display: none; }

.hk-fab { position: fixed; right: 32px; bottom: 32px; width: 48px; height: 48px; border-radius: 50%; border: 0; background: #7478ff; color: #fff; display: grid; place-items: center; cursor: pointer; box-shadow: 0 8px 24px rgba(116,120,255,.45); transition: transform .12s, background .15s; z-index: 20; }
.hk-fab:hover { background: #8c90ff; }
.hk-fab:active { transform: scale(.9); }
.hk-fab svg { width: 24px; height: 24px; }

.hk-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.7); display: grid; place-items: center; padding: 16px; z-index: 50; }
.hk-modal { width: 100%; max-width: 380px; background: #12142a; border: 1px solid #262a47; border-radius: 16px; padding: 20px; box-shadow: 0 24px 60px rgba(0,0,0,.6); }
.hk-modal h3 { font-size: 16px; font-weight: 700; color: #fff; margin-bottom: 16px; }
.hk-overlay.top { z-index: 60; }
.hk-dlg-msg { font-size: 14px; line-height: 1.5; color: #e8e9f5; margin: 0 0 14px; white-space: pre-line; }
.hk-form { display: flex; flex-direction: column; gap: 12px; }
.hk-two { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.hk-type { padding: 10px; border-radius: 12px; border: 0; background: #1c1f38; color: #e8e9f5; font-size: 14px; font-weight: 600; cursor: pointer; transition: background .15s; }
.hk-type.on-out { background: #ff4d6d; color: #fff; }
.hk-type.on-in { background: #4af28f; color: #06210f; }
.hk-label { display: block; }
.hk-label span { display: block; font-size: 11px; color: #8d90ad; margin-bottom: 4px; }
.hk-input { width: 100%; background: #1c1f38; border: 1px solid #2a2e4f; border-radius: 12px; padding: 10px 14px; font-size: 14px; color: #fff; outline: none; color-scheme: dark; }
.hk-input::placeholder { color: #5f6382; }
.hk-input:focus { border-color: #7478ff; }
.hk-cancel, .hk-save { padding: 10px; border-radius: 12px; border: 0; font-size: 14px; font-weight: 600; cursor: pointer; transition: background .15s; }
.hk-cancel { background: #1c1f38; color: #e8e9f5; }
.hk-cancel:hover { background: #252949; }
.hk-save { background: #7478ff; color: #fff; }
.hk-save:hover { background: #8c90ff; }

@media (max-width: 720px) {
  .hk { padding: 20px 14px 40px; }
  .hk-grid { grid-template-columns: 1fr; }
  .hk-balance .big { font-size: 36px; }
  .hk-fab { right: 18px; bottom: 18px; }
}
`;

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

  const chartData = useMemo(() => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const days = new Date(y, m, 0).getDate();
    const totals = Array.from({ length: days }, (_, i) => {
      const d = `${selectedMonth}-${pad(i + 1)}`;
      return monthly.filter((t) => t.date === d && t.type === 'gider').reduce((a, t) => a + parseFloat(t.amount), 0);
    });
    return {
      labels: totals.map((_, i) => `${i + 1}. gün`),
      datasets: [{ data: totals, backgroundColor: '#6e74ff', hoverBackgroundColor: '#9aa0ff', borderRadius: 2, barPercentage: 0.55, categoryPercentage: 1, minBarLength: 2 }],
    };
  }, [monthly, selectedMonth]);

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => ` ${fmt(c.parsed.y)} ₺` } } },
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
            <span className="hk-logo">💰</span>
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
          <div className="big">{fmt2(currentBalance)} ₺</div>
          <div className="row">
            <div>
              <p className="lbl">Bu ay gelen</p>
              <b>{fmt(monthlyIncome)} ₺</b>
            </div>
            <div>
              <p className="lbl">Bu ay harcanan</p>
              <b>{fmt(monthlyExpense)} ₺</b>
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
                  <div className="hk-cat" key={cat}>
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
                    <div className="hk-item" key={item.id}>
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
