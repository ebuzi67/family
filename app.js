/* 우리 가족 대시보드
   - 모든 기록은 이 태블릿 브라우저 안(localStorage)에만 저장된다. 인터넷으로 보내지 않는다.
   - 날씨·미세먼지만 Open-Meteo(무료, 키 없음)에서 받아 온다. 위치(도시 좌표)만 보낸다. */
(() => {
'use strict';

// ---------- 기본값 ----------
const KEY = 'familyDash.v1';
const ANIMALS = [
  { id: 'polarbear', name: '북극곰', zone: [0.06, 0.30], ground: 0.80 },
  { id: 'bear', name: '곰', zone: [0.36, 0.62], ground: 0.86 },
  { id: 'bee', name: '꿀벌', zone: [0.68, 0.95], ground: 0.62, fly: true },
];
const STAGE_NAMES = ['아기', '어린이', '다 큰'];
const STAGE_AT = [0, 10, 25];   // 이 동물로 모은 스티커 수가 이만큼이면 그 단계
const GROWN_AT = 40;            // 40장이면 다 키워서 마을로 이사
const WHO = { mom: '엄마', dad: '아빠', kid: '아이', family: '가족' };
const CITIES = {
  seoul: ['서울', 37.5665, 126.978], incheon: ['인천', 37.4563, 126.7052], suwon: ['수원', 37.2636, 127.0286],
  daejeon: ['대전', 36.3504, 127.3845], sejong: ['세종', 36.48, 127.289], daegu: ['대구', 35.8714, 128.6014],
  gwangju: ['광주', 35.1595, 126.8526], ulsan: ['울산', 35.5384, 129.3114], busan: ['부산', 35.1796, 129.0756],
  jeju: ['제주', 33.4996, 126.5312], chuncheon: ['춘천', 37.8813, 127.7298], jeonju: ['전주', 35.8242, 127.148],
};
const STATUS = [['🏠', '집'], ['💼', '회사'], ['🌙', '야근 중'], ['🚗', '오는 중'], ['🏃', '운동 중'], ['🛒', '장보는 중'], ['🍽️', '약속'], ['😴', '자는 중']];
const REASONS = ['양치를 혼자 했어요', '숙제를 다 했어요', '정리정돈을 했어요', '책을 읽었어요', '심부름을 했어요', '골고루 먹었어요', '일찍 잤어요', '동생·친구를 도왔어요'];

// 공휴일 (대체공휴일 포함). 해마다 여기에 다음 해를 더하면 된다.
const HOLIDAYS = {
  '2026-01-01': '신정', '2026-02-16': '설날', '2026-02-17': '설날', '2026-02-18': '설날', '2026-03-01': '삼일절', '2026-03-02': '대체공휴일',
  '2026-05-05': '어린이날', '2026-05-24': '부처님오신날', '2026-05-25': '대체공휴일', '2026-06-03': '지방선거', '2026-06-06': '현충일',
  '2026-08-15': '광복절', '2026-08-17': '대체공휴일', '2026-09-24': '추석', '2026-09-25': '추석', '2026-09-26': '추석',
  '2026-10-03': '개천절', '2026-10-05': '대체공휴일', '2026-10-09': '한글날', '2026-12-25': '성탄절',
  '2027-01-01': '신정', '2027-02-06': '설날', '2027-02-07': '설날', '2027-02-08': '설날', '2027-02-09': '대체공휴일', '2027-03-01': '삼일절',
  '2027-05-05': '어린이날', '2027-05-13': '부처님오신날', '2027-06-06': '현충일', '2027-08-15': '광복절', '2027-08-16': '대체공휴일',
  '2027-09-14': '추석', '2027-09-15': '추석', '2027-09-16': '추석', '2027-10-03': '개천절', '2027-10-04': '대체공휴일',
  '2027-10-09': '한글날', '2027-10-11': '대체공휴일', '2027-12-25': '성탄절', '2027-12-27': '대체공휴일',
};

const fresh = () => ({
  settings: { names: { mom: '엄마', dad: '아빠', kid: '나율' }, kidBirth: '', schoolStart: '09:00', schoolEnd: '14:40',
    vacStart: '', vacEnd: '', city: 'seoul', lat: null, lon: null, pin: '0000', mode: 'auto', wake: true },
  todos: { mom: [], dad: [], kid: [], common: [] },
  shopping: [],
  events: [],
  days: [],
  trip: null,
  stickers: { log: [], grown: [], animal: 0, base: 0, autoDay: '' },
  status: { dad: 0, mom: 0 },
  weather: null,
});

// ---------- 저장 ----------
let S;
let page = 'home';
function load() {
  try { S = JSON.parse(localStorage.getItem(KEY)) || null; } catch (e) { S = null; }
  const f = fresh();
  if (!S) { S = f; return; }
  for (const k in f) if (S[k] === undefined) S[k] = f[k];
  S.settings = Object.assign(f.settings, S.settings);
  S.settings.names = Object.assign(f.settings.names, S.settings.names);
  if (S.settings.names.kid === '아이') S.settings.names.kid = '나율'; // 예전 기본 이름이면 나율로
  S.todos = Object.assign(f.todos, S.todos);
  S.stickers = Object.assign(f.stickers, S.stickers);
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { toast('저장 공간에 쓰지 못했어요'); } }

// ---------- 작은 도구 ----------
const $ = (s, el = document) => el.querySelector(s);
const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
const pad2 = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const parse = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const dayDiff = (a, b) => Math.round((parse(ymd(b)) - parse(ymd(a))) / 86400000);
const WD = ['일', '월', '화', '수', '목', '금', '토'];
const nm = (who) => (who === 'family' ? '가족' : S.settings.names[who] || WHO[who]);
const color = (who) => `var(--${who || 'family'})`;
const today = () => new Date();
// 받침에 맞는 조사: josa('곰', '이', '가') → '곰이'
const josa = (w, a, b) => {
  const c = String(w).charCodeAt(String(w).length - 1);
  if (c < 0xac00 || c > 0xd7a3) return w + b;
  const jong = (c - 0xac00) % 28;
  if (a === '으로') return w + (jong === 0 || jong === 8 ? '로' : '으로');
  return w + (jong ? a : b);
};

// ---------- 음력 → 양력 (브라우저 내장 달력 사용) ----------
const lunarFmt = new Intl.DateTimeFormat('en-u-ca-chinese', { year: 'numeric', month: 'numeric', day: 'numeric', timeZone: 'UTC' });
const lunarCache = {};
function lunarParts(d) {
  const p = lunarFmt.formatToParts(new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())));
  const g = (t) => (p.find((x) => x.type === t) || {}).value || '';
  const m = g('month');
  return { y: +g('relatedYear') || +g('year'), m: parseInt(m, 10), leap: /bis|\D/.test(m.replace(/^\d+/, '')), d: +g('day') };
}
function lunarToSolar(ly, lm, ld) {
  const k = `${ly}-${lm}-${ld}`;
  if (k in lunarCache) return lunarCache[k];
  let best = null, last = null;
  for (let d = new Date(ly, 0, 1); d < new Date(ly + 1, 2, 1); d = addDays(d, 1)) {
    const p = lunarParts(d);
    if (p.y !== ly || p.m !== lm || p.leap) continue;
    last = new Date(d);
    if (p.d === ld) { best = new Date(d); break; }
  }
  return (lunarCache[k] = best || last); // 30일이 없는 달이면 그 달 마지막 날
}
// 해마다 오는 날의 다음 날짜
function nextOccur(day, from = today()) {
  const base = parse(ymd(from));
  for (let y = from.getFullYear() - 1; y <= from.getFullYear() + 1; y++) {
    const d = day.lunar ? lunarToSolar(y, day.m, day.d) : new Date(y, day.m - 1, day.d);
    if (d && d >= base) return d;
  }
  return null;
}
// 특정 날짜에 해당하는 해마다 오는 날
function yearlyOn(dateStr) {
  const d = parse(dateStr);
  return allYearly().filter((x) => {
    if (!x.lunar) return x.m === d.getMonth() + 1 && x.d === d.getDate();
    const s = lunarToSolar(d.getFullYear(), x.m, x.d) ;
    const s2 = lunarToSolar(d.getFullYear() - 1, x.m, x.d);
    return (s && ymd(s) === dateStr) || (s2 && ymd(s2) === dateStr);
  });
}
function allYearly() {
  const list = S.days.slice();
  if (S.settings.kidBirth) {
    const [, m, d] = S.settings.kidBirth.split('-').map(Number);
    list.push({ id: 'kidbirth', title: `${S.settings.names.kid} 생일`, m, d, lunar: false, who: 'kid', auto: true });
  }
  return list;
}

// ---------- 테마 (자동: 학교 시간엔 어른 화면) ----------
function isOffDay(d) {
  const s = ymd(d);
  if (d.getDay() === 0 || d.getDay() === 6 || HOLIDAYS[s]) return true;
  const { vacStart, vacEnd } = S.settings;
  if (vacStart && vacEnd && s >= vacStart && s <= vacEnd) return true;
  return S.events.some((e) => e.date === s && e.off);
}
function wantTheme(now) {
  const m = S.settings.mode;
  if (m === 'adult') return 'adult';
  if (m === 'kid') return 'kid';
  if (isOffDay(now)) return 'kid';
  const hm = `${pad2(now.getHours())}:${pad2(now.getMinutes())}`;
  return hm >= S.settings.schoolStart && hm < S.settings.schoolEnd ? 'adult' : 'kid';
}
function applyTheme() {
  const now = today();
  const t = wantTheme(now);
  const h = now.getHours();
  const cls = ['notranslate', 'theme-' + t];
  if (t === 'adult' && (h >= 19 || h < 6)) cls.push('night');
  const next = cls.join(' ');
  if (document.body.className !== next) { document.body.className = next; if (page === 'home') renderHero(); }
  $('#modeTxt').textContent = { auto: '자동', adult: '어른', kid: '아이' }[S.settings.mode];
}

// ---------- 화면 크기 맞추기 ----------
function fit() {
  const s = Math.min(innerWidth / 1280, innerHeight / 800);
  $('#stage').style.transform = `translate(-50%, -50%) scale(${s})`;
}

// ---------- 시계 ----------
function renderClock() {
  const d = today();
  const h = d.getHours();
  $('#dateText').textContent = `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 ${WD[d.getDay()]}요일${HOLIDAYS[ymd(d)] ? ' · ' + HOLIDAYS[ymd(d)] : ''}`;
  $('#ampm').textContent = h < 12 ? '오전' : '오후';
  $('#timeText').textContent = `${h % 12 || 12}:${pad2(d.getMinutes())}`;
}

// ---------- 날씨 ----------
const WCODE = (c) => {
  if (c === 0) return ['☀️', '맑음'];
  if (c <= 2) return ['🌤️', '구름 조금'];
  if (c === 3) return ['☁️', '흐림'];
  if (c <= 48) return ['🌫️', '안개'];
  if (c <= 57) return ['🌦️', '이슬비'];
  if (c <= 67) return ['🌧️', '비'];
  if (c <= 77) return ['🌨️', '눈'];
  if (c <= 82) return ['🌧️', '소나기'];
  if (c <= 86) return ['🌨️', '눈'];
  return ['⛈️', '뇌우'];
};
function airGrade(pm10, pm25) {
  if (pm10 == null && pm25 == null) return [0, '정보 없음', '·'];
  const g10 = pm10 == null ? 0 : pm10 <= 30 ? 1 : pm10 <= 80 ? 2 : pm10 <= 150 ? 3 : 4;
  const g25 = pm25 == null ? 0 : pm25 <= 15 ? 1 : pm25 <= 35 ? 2 : pm25 <= 75 ? 3 : 4;
  const g = Math.max(g10, g25);
  return [g, ['', '좋음', '보통', '나쁨', '매우 나쁨'][g], ['', '😊', '🙂', '😷', '😫'][g]];
}
function coords() {
  const s = S.settings;
  if (s.city === 'here' && s.lat != null) return [s.lat, s.lon];
  const c = CITIES[s.city] || CITIES.seoul;
  return [c[1], c[2]];
}
async function fetchWeather() {
  const [la, lo] = coords();
  try {
    const q = `latitude=${la}&longitude=${lo}&timezone=Asia%2FSeoul`;
    const [w, a] = await Promise.all([
      fetch(`https://api.open-meteo.com/v1/forecast?${q}&current=temperature_2m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&forecast_days=7`).then((r) => r.json()),
      fetch(`https://air-quality-api.open-meteo.com/v1/air-quality?${q}&current=pm10,pm2_5`).then((r) => r.json()).catch(() => null),
    ]);
    if (!w || !w.current) throw new Error('no data');
    S.weather = { at: Date.now(), w, a };
    save();
  } catch (e) { /* 인터넷이 안 되면 마지막에 받은 날씨를 그대로 보여 준다 */ }
  renderWeather();
}
let weatherTip = '';
function renderWeather() {
  const el = $('#weather');
  const W = S.weather;
  if (!W) { weatherTip = ''; el.innerHTML = `<div class="wtop"><div class="air g0"><span class="f">미세먼지</span><span class="face">·</span></div><div class="now"><div class="d">날씨를 불러오는 중이에요…<br>인터넷 연결을 확인해 주세요.</div></div></div>`; return; }
  const { w, a } = W;
  const pm10 = a?.current?.pm10, pm25 = a?.current?.pm2_5;
  const [g, gt, face] = airGrade(pm10, pm25);
  const [ic, txt] = WCODE(w.current.weather_code);
  const dd = w.daily;
  const fc = dd.time.slice(1, 5).map((t, i) => {
    const d = parse(t); const [e] = WCODE(dd.weather_code[i + 1]);
    return `<div>${WD[d.getDay()]} ${e} <b>${Math.round(dd.temperature_2m_max[i + 1])}°</b>${Math.round(dd.temperature_2m_min[i + 1])}°</div>`;
  }).join('');
  const rain = dd.precipitation_probability_max[0] ?? 0;
  const tmin = dd.temperature_2m_min[0], tmax = dd.temperature_2m_max[0];
  let tip = '나들이하기 좋은 날씨예요';
  if (rain >= 50) tip = '우산 챙기세요 ☂️';
  else if (g >= 3) tip = '마스크 챙기세요 😷';
  else if (tmin <= 0) tip = '많이 추워요. 따뜻하게 입어요 🧣';
  else if (tmin <= 8) tip = '쌀쌀해요. 겉옷 챙기세요 🧥';
  else if (tmax >= 30) tip = '더워요. 물 많이 마셔요 💧';
  weatherTip = `오늘은 ${txt}, ${Math.round(tmin)}~${Math.round(tmax)}° · ${tip}`;
  el.innerHTML = `<div class="wtop">
      <div class="air g${g}"><span class="f">미세먼지</span><span class="face">${face}</span>${gt}</div>
      <div class="now"><span class="ic">${ic}</span><span class="t">${Math.round(w.current.temperature_2m)}°</span>
        <div class="d"><b>${txt}</b><br>최고 ${Math.round(tmax)}° · 최저 ${Math.round(tmin)}°<br>비 ${rain}% · 초미세 ${pm25 != null ? Math.round(pm25) : '-'}㎍</div></div>
    </div><div class="fc">${fc}</div>`;
}

// ---------- 달력 ----------
function eventsOn(ds) {
  const list = S.events.filter((e) => e.date === ds).map((e) => ({ ...e, kind: 'ev' }));
  yearlyOn(ds).forEach((y) => list.push({ id: y.id, title: y.title, who: y.who || 'family', kind: 'yearly', time: '' }));
  return list.sort((a, b) => (a.time || '99').localeCompare(b.time || '99'));
}
function renderCal() {
  const t = today();
  const start = addDays(parse(ymd(t)), -t.getDay());
  let rows = '';
  for (let w = 0; w < 4; w++) {
    rows += '<tr>';
    for (let i = 0; i < 7; i++) {
      const d = addDays(start, w * 7 + i);
      const ds = ymd(d);
      const evs = eventsOn(ds);
      const cls = [i === 0 ? 'sun' : i === 6 ? 'sat' : '', HOLIDAYS[ds] ? 'hol' : '', ds === ymd(t) ? 'today' : '', d < parse(ymd(t)) ? 'past' : '', evs.length ? 'has' : ''].join(' ');
      const dots = evs.slice(0, 3).map((e) => `<i style="--c:${color(e.who)}"></i>`).join('');
      rows += `<td class="${cls}" data-day="${ds}" style="--c:${evs.length ? color(evs[0].who) : 'inherit'}"><span class="n">${d.getDate()}</span><div class="dots">${dots}</div></td>`;
    }
    rows += '</tr>';
  }
  const lg = ['kid', 'mom', 'dad', 'family'].map((k) => `<span><i style="background:${color(k)}"></i>${esc(nm(k))}</span>`).join('');
  $('#cal').innerHTML = `<div class="ttl">${t.getMonth() + 1}월 달력<div class="legend">${lg}</div><button class="add" data-act="addEvent">+</button></div>
    <table><tr>${WD.map((x) => `<th>${x}</th>`).join('')}</tr>${rows}</table>`;
}

// ---------- 오늘 / 내일 ----------
function renderDays2() {
  const t = today();
  const hm = `${pad2(t.getHours())}:${pad2(t.getMinutes())}`;
  const col = (d, label, isToday) => {
    const ds = ymd(d);
    const evs = eventsOn(ds);
    const list = evs.length ? evs.slice(0, 4).map((e) => {
      const gone = isToday && e.time && e.time < hm;
      const tm = e.time ? `${(+e.time.slice(0, 2) % 12 || 12)}:${e.time.slice(3)}` : '종일';
      return `<div class="ev ${gone ? 'gone' : ''}"><span class="tm">${tm}</span><span class="tx" style="--c:${color(e.who)}">${esc(e.title)}</span></div>`;
    }).join('') + (evs.length > 4 ? `<div class="muted">+${evs.length - 4}개 더</div>` : '') : '<div class="empty">일정이 없어요</div>';
    return `<div data-day="${ds}"><div class="ttl">${label} <small>${d.getMonth() + 1}/${d.getDate()} ${WD[d.getDay()]}</small></div>${list}</div>`;
  };
  $('#days2').innerHTML = col(t, '오늘', true) + col(addDays(t, 1), '내일', false);
}

// ---------- 할 일 ----------
function cleanTodos() {
  // 끝낸 할 일은 다음 날이 되면 자동으로 정리한다
  const ds = ymd(today());
  for (const k in S.todos) S.todos[k] = S.todos[k].filter((x) => !x.done || x.doneAt === ds);
}
function renderTodos() {
  const TINT = { kid: '#fff4df', mom: '#fdeaf1', dad: '#e6f0fd' };
  const card = (k) => {
    const list = S.todos[k];
    const done = list.filter((x) => x.done).length;
    const items = list.length ? list.slice(0, 6).map((x) => `<div class="ti"><span class="chk ${x.done ? 'done' : ''}" data-act="toggleTodo" data-k="${k}" data-id="${x.id}">${esc(x.text)}</span><button class="x" data-act="delTodo" data-k="${k}" data-id="${x.id}">✕</button></div>`).join('') + (list.length > 6 ? `<div class="muted">+${list.length - 6}개 더</div>` : '') : '<div class="empty">할 일이 없어요<br>+를 눌러 넣어요</div>';
    const badge = !list.length ? '' : done === list.length ? '<span class="badge" style="--c:#34b37a">다 했어요!</span>' : `<span class="badge">${list.length - done}개 남음</span>`;
    return `<div class="mission" style="--tint:${TINT[k]};--c:${color(k)}"><div class="mh">${esc(nm(k))} 할 일 ${badge}<button class="add" data-act="addTodo" data-k="${k}">+</button></div>
      <div class="inner"><div class="tl">${items}</div><div class="foot"><div class="pbar"><i style="width:${list.length ? (done / list.length) * 100 : 0}%"></i></div>✓ ${done}/${list.length}</div></div></div>`;
  };
  $('#missions').innerHTML = card('kid') + card('mom') + card('dad');
  const common = S.todos.common.map((x) => `<span class="pill ${x.done ? 'done' : ''}" data-act="toggleTodo" data-k="common" data-id="${x.id}">${esc(x.text)}</span>`).join('') || '<span class="muted">없어요</span>';
  const shop = S.shopping.map((x) => `<span class="pill" data-act="bought" data-id="${x.id}">${esc(x.text)}</span>`).join('') || '<span class="muted">살 것이 없어요</span>';
  $('#shop').innerHTML = `<div class="sec"><div class="lb">🛒 장보기 ${S.shopping.length}<button class="add" data-act="addShop">+</button></div><div class="pills">${shop}</div></div>
    <div class="sec"><div class="lb">🏠 공통 할 일<button class="add" data-act="addTodo" data-k="common">+</button></div><div class="pills">${common}</div></div>`;
}

// ---------- 스티커와 동물 ----------
const total = () => S.stickers.log.reduce((a, x) => a + x.n, 0);
function growth() {
  const st = S.stickers;
  const a = ANIMALS[st.animal % ANIMALS.length];
  const got = Math.max(0, total() - st.base);
  let stage = 0;
  STAGE_AT.forEach((v, i) => { if (got >= v) stage = i; });
  const nextAt = stage < 2 ? STAGE_AT[stage + 1] : GROWN_AT;
  return { a, got, stage, nextAt, left: nextAt - got, pct: Math.min(100, Math.round(((got - STAGE_AT[stage]) / (nextAt - STAGE_AT[stage])) * 100)) };
}
function img(a, stage) { return `img/${a.id}-${stage + 1}.png`; }
function checkGrown() {
  // 다 키우면 마을로 이사하고 다음 동물이 온다
  let moved = null;
  while (total() - S.stickers.base >= GROWN_AT) {
    const a = ANIMALS[S.stickers.animal % ANIMALS.length];
    S.stickers.grown.push({ animal: a.id, date: ymd(today()), seed: Math.random() });
    S.stickers.base += GROWN_AT;
    S.stickers.animal++;
    moved = a;
  }
  return moved;
}
function addSticker(n, reason, by) {
  const before = growth();
  S.stickers.log.unshift({ id: uid(), date: ymd(today()), n, reason, by });
  const moved = checkGrown();
  save();
  const after = growth();
  if (moved) celebrate(`img/${moved.id}-3.png`, `${josa(moved.name, '을', '를')} 다 키웠어요! 마을로 이사 가요 🎉`);
  else if (after.stage > before.stage) celebrate(img(after.a, after.stage), `${STAGE_NAMES[after.stage]} ${josa(after.a.name, '으로', '로')} 자랐어요! ✨`);
  else toast(`⭐ 스티커 +${n}장 · ${reason}`);
  renderAll();
}
function autoKidSticker() {
  const list = S.todos.kid;
  const ds = ymd(today());
  if (list.length && list.every((x) => x.done) && S.stickers.autoDay !== ds) {
    S.stickers.autoDay = ds;
    addSticker(1, '오늘 할 일을 다 했어요', '할 일');
  }
}
function vocative(name) {
  const c = name.charCodeAt(name.length - 1);
  if (c < 0xac00 || c > 0xd7a3) return name;
  return name + ((c - 0xac00) % 28 ? '아' : '야');
}
function renderKid() { renderHero(); renderData(); }
function renderHero() {
  const g = growth();
  const s = S.settings;
  const now = today();
  const h = now.getHours();
  const theme = wantTheme(now);
  const title = theme === 'kid'
    ? `${esc(vocative(s.names.kid))}, ${h < 11 ? '좋은 아침!' : h >= 19 ? '오늘도 수고했어!' : '안녕!'}`
    : (h < 12 ? '좋은 아침이에요!' : h < 18 ? '좋은 오후예요!' : '편안한 저녁이에요!');
  const ds = ymd(now);
  const todayN = eventsOn(ds).length;
  const left = ['kid', 'mom', 'dad', 'common'].reduce((a, k) => a + S.todos[k].filter((x) => !x.done).length, 0);
  // 네 번째 줄: 여행이 있으면 여행, 아니면 가장 가까운 기념일
  let fourth = { ic: '🎂', bg: '#fdeaf1', text: '기념일을 설정에서 넣어요', act: 'data-tab="settings"' };
  if (S.trip) {
    const n = S.trip.date ? dayDiff(now, parse(S.trip.date)) : null;
    const done = S.trip.items.filter((x) => x.done).length;
    fourth = { ic: '✈️', bg: '#e6f0fd', text: `${S.trip.title}${n != null && n >= 0 ? ' D-' + n : ''} · 챙김 ${done}/${S.trip.items.length}`, act: 'data-tab="trip"' };
  } else {
    const nx = allYearly().map((y) => ({ t: y.title, d: nextOccur(y) })).filter((x) => x.d).sort((a, b) => a.d - b.d)[0];
    if (nx) { const n = dayDiff(now, nx.d); fourth.text = `${nx.t} ${n === 0 ? '오늘! 🎉' : 'D-' + n}`; fourth.act = ''; }
  }
  const links = [
    { ic: '📅', bg: '#e6f0fd', text: `오늘 일정 ${todayN}개`, act: `data-day="${ds}"` },
    { ic: '✅', bg: '#e3f6ec', text: left ? `할 일 ${left}개 남았어요` : '할 일을 다 했어요!', act: '' },
    { ic: '🛒', bg: '#fff4df', text: S.shopping.length ? `장보기 ${S.shopping.length}개` : '장보기 목록이 비었어요', act: 'data-act="addShop"' },
    fourth,
  ];
  $('#hero').innerHTML = `<h1>${title}</h1>
    <div class="sub">${esc(weatherTip || '오늘도 즐거운 하루 보내요')}</div>
    <div class="links">${links.map((l) => `<button ${l.act}><i style="background:${l.bg}">${l.ic}</i>${esc(l.text)}</button>`).join('')}</div>
    <div class="tag" data-tab="village">${STAGE_NAMES[g.stage]} ${g.a.name}<br><b>${g.stage < 2 ? '다음 단계까지' : '마을 이사까지'} ${g.left}장</b></div>
    <span class="spark" style="right:30px;top:24px;color:#ffb648">✦</span>
    <div class="chara" data-tab="village"><img src="${heroImg(g)}" alt=""></div>`;
}
// 메인 화면 그림은 늘 북극곰. 지금 북극곰을 키우는 중이면 그 단계 그림, 아니면 손 흔드는 북극곰
function heroImg(g) { return g.a.id === 'polarbear' ? img(g.a, g.stage) : 'img/polarbear-2.png'; }
function renderData() {
  const g = growth();
  const pct = Math.min(100, Math.round((g.got / GROWN_AT) * 100));
  const C = 2 * Math.PI * 40;
  $('#data').innerHTML = `<div class="card ring" data-tab="village"><div class="rc"><svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" stroke="var(--soft)" stroke-width="10"/><circle cx="50" cy="50" r="40" stroke="var(--accent2)" stroke-width="10" stroke-dasharray="${(C * pct) / 100} ${C}" transform="rotate(-90 50 50)"/></svg><b>${pct}%</b></div><div class="rl2">${g.a.name} 다 키우기</div></div>
    <div class="mini"><div class="card" data-tab="sticker"><em>⭐</em><b>${total()}</b><span>받은 스티커</span></div><div class="card" data-tab="village"><em>🏡</em><b>${S.stickers.grown.length}</b><span>마을 친구</span></div></div>`;
}

// ---------- 다가오는 날 ----------
function renderDday() {
  const t = today();
  const list = allYearly().map((y) => ({ title: y.title, d: nextOccur(y), lunar: y.lunar })).filter((x) => x.d);
  if (S.trip && S.trip.date && parse(S.trip.date) >= parse(ymd(t))) list.push({ title: `✈️ ${S.trip.title}`, d: parse(S.trip.date) });
  S.events.filter((e) => e.dday && parse(e.date) >= parse(ymd(t))).forEach((e) => list.push({ title: e.title, d: parse(e.date) }));
  list.sort((a, b) => a.d - b.d);
  const rows = list.slice(0, 4).map((x) => {
    const n = dayDiff(t, x.d);
    return `<b>${n === 0 ? 'D-DAY' : 'D-' + n}</b><span>${esc(x.title)}${x.lunar ? ' <small class="muted">(음력)</small>' : ''}</span><span class="dt">${x.d.getMonth() + 1}/${x.d.getDate()}</span>`;
  }).join('');
  $('#dday').innerHTML = `<div class="ttl">다가오는 날<button class="add r" data-act="addDay">+</button></div>${rows ? `<div class="dl">${rows}</div>` : '<div class="empty">+를 눌러 생일·기념일을 넣어 주세요</div>'}`;
}

// ---------- 엄마·아빠는 지금 ----------
function renderStatus() {
  const one = (k) => { const [e, t] = STATUS[S.status[k] % STATUS.length]; return `<div class="st" data-act="status" data-k="${k}"><span class="em">${e}</span><div><div class="who">${esc(josa(nm(k), '은', '는'))} 지금</div><div class="what">${t}</div></div></div>`; };
  $('#status').innerHTML = `<div class="ttl" style="margin-bottom:2px">지금 어디?</div>${one('dad')}${one('mom')}`;
}

// ---------- 여행 ----------
function renderTripMini() {}
function renderTripPage() {
  const T = S.trip;
  const el = $('#tripPage');
  if (!T) {
    el.innerHTML = `<h2>🧳 여행</h2><p class="note">여행을 만들면 대시보드에 준비물 체크리스트와 D-day가 나와요.</p><br><button class="btn" data-act="newTrip">+ 새 여행 만들기</button>`;
    return;
  }
  const list = (cat) => T.items.filter((x) => x.cat === cat).map((x) => `<div class="rowx"><span class="chk grow1 ${x.done ? 'done' : ''}" data-act="toggleTrip" data-id="${x.id}">${esc(x.text)}</span><button class="x" data-act="delTrip" data-id="${x.id}">✕</button></div>`).join('') || '<div class="empty">아직 없어요</div>';
  el.innerHTML = `<h2>🧳 ${esc(T.title)} <small class="muted">${T.date ? T.date + ' 출발' : ''}${T.end ? ' ~ ' + T.end : ''}</small></h2>
    <div class="btns" style="margin-bottom:10px"><button class="btn sub" data-act="editTrip">여행 정보 고치기</button><button class="btn sub" data-act="uncheckTrip">체크 모두 풀기</button><button class="btn red" data-act="endTrip">여행 끝 (지우기)</button></div>
    <div class="two" style="height:calc(100% - 100px)">
      <div><h3>챙길 물건 <button class="add" data-act="addTrip" data-cat="pack">+</button></h3>${list('pack')}</div>
      <div><h3>살 것 <button class="add" data-act="addTrip" data-cat="buy">+</button></h3>${list('buy')}</div>
    </div>`;
}

// ---------- 동물 마을 ----------
const SAY = ['안녕! 반가워 👋', '오늘도 힘내!', '스티커 고마워!', '같이 놀자!', '최고야! 👍', '오늘 기분 좋아 😊', '꿀처럼 달콤한 하루!', '사랑해 💛'];
function renderVillage() {
  const g = growth();
  const thumbs = [0, 1, 2].map((i) => `<span><img src="${img(g.a, i)}" class="${i > g.stage ? 'lock' : ''}" alt=""></span>`).join('');
  const msg = g.got === 0 ? `새 친구 ${josa(g.a.name, '이', '가')} 왔어요! 스티커를 모으면 쑥쑥 자라요.` : g.stage === 2 ? `다 큰 ${josa(g.a.name, '이에요', '예요')}! ${g.left}장만 더 모으면 마을로 이사 가요.` : `${STAGE_NAMES[g.stage]} ${josa(g.a.name, '이에요', '예요')}. ${g.left}장 더 모으면 ${STAGE_NAMES[g.stage + 1]} ${josa(g.a.name, '이', '가')} 돼요!`;
  $('#grow').innerHTML = `<div class="ttl" style="--c:#e8679a;align-self:flex-start">지금 키우는 친구 <small>스티커 ${total()}장</small></div>
    <img class="big" src="${img(g.a, g.stage)}" alt="">
    <div class="gname">${STAGE_NAMES[g.stage]} ${g.a.name}</div>
    <div class="gsub">${S.stickers.animal + 1}번째 친구 · ${g.got}/${GROWN_AT}장</div>
    <div class="bar"><i style="width:${Math.round((g.got / GROWN_AT) * 100)}%"></i></div>
    <div class="stages">${thumbs}</div>
    <div class="bubble">${msg}<small>다음 단계까지 스티커 ${g.left}장</small></div>`;

  const grown = S.stickers.grown;
  const counts = {};
  const animals = grown.map((x, i) => {
    const a = ANIMALS.find((y) => y.id === x.animal) || ANIMALS[0];
    const c = (counts[a.id] = (counts[a.id] || 0) + 1);
    const r = (x.seed ?? ((i * 0.618) % 1));
    const left = (a.zone[0] + (a.zone[1] - a.zone[0]) * ((r * 7 + c * 0.37) % 1)) * 100;
    const top = (a.ground + (a.fly ? -0.1 * ((c * 0.53) % 1) : 0.08 * ((c * 0.41) % 1))) * 100;
    return { a, left, top, i, date: x.date };
  }).sort((p, q) => p.top - q.top);
  const html = animals.map((p) => `<div class="a ${p.a.fly ? 'fly' : ''}" data-act="say" data-i="${p.i}" style="left:${p.left}%;top:${p.top}%;width:${p.a.fly ? 96 : 124}px;z-index:${Math.round(p.top)}"><img src="img/${p.a.id}-3.png" alt="" style="animation-delay:-${(p.i * 0.7) % 3}s"><span>${p.a.name}</span></div>`).join('');
  $('#village').innerHTML = `<div class="ttl" style="--c:#2fae6b">${esc(S.settings.names.kid)}의 동물 마을 <small>다 키운 친구 ${grown.length}마리</small></div>
    <div class="vbg">${html}${grown.length ? '' : `<div class="hint">스티커 ${GROWN_AT}장을 모아 친구를 다 키우면<br>여기 마을로 이사 와요 🏡</div>`}</div>`;

  const rl = S.stickers.log.slice(0, 6).map((x) => `<span>${+x.date.slice(5, 7)}/${+x.date.slice(8)}</span><b>+${x.n}장</b><span>${esc(x.reason)}</span><span class="by">${esc(x.by)}</span>`).join('');
  $('#recent').innerHTML = `<div class="ttl" style="--c:#3f7fd8">최근 스티커</div>${rl ? `<div class="rl">${rl}</div>` : '<div class="empty">아직 스티커가 없어요. 스티커 탭에서 줄 수 있어요.</div>'}`;
}

// ---------- 스티커 페이지 ----------
function renderStickerPage() {
  const log = S.stickers.log.map((x) => `<div class="rowx"><span style="width:60px">${+x.date.slice(5, 7)}/${+x.date.slice(8)}</span><b style="color:#e8679a;width:56px">+${x.n}장</b><span class="grow1">${esc(x.reason)}</span><span class="muted">${esc(x.by)}</span><button class="x" data-act="delSticker" data-id="${x.id}">✕</button></div>`).join('') || '<div class="empty">아직 없어요</div>';
  $('#stickerPage').innerHTML = `<h2>⭐ ${esc(S.settings.names.kid)}의 스티커</h2>
    <div class="two"><div>
      <div class="bigcount">${total()}장</div>
      <p class="note">잘한 일을 누르면 스티커 1장을 줘요. 엄마·아빠 비밀번호가 필요해요.<br>${esc(S.settings.names.kid)} 할 일을 하루에 다 끝내면 스티커 1장이 자동으로 생겨요.</p>
      <div class="reasons">${REASONS.map((r) => `<button data-act="give" data-r="${esc(r)}">${esc(r)}</button>`).join('')}<button data-act="giveCustom">✏️ 직접 쓰기</button></div>
    </div><div>
      <h3 style="margin-top:0">받은 기록</h3>${log}
    </div></div>`;
}

// ---------- 설정 ----------
function renderSettings() {
  const s = S.settings;
  const cityOpts = Object.entries(CITIES).map(([k, v]) => `<option value="${k}" ${s.city === k ? 'selected' : ''}>${v[0]}</option>`).join('') + `<option value="here" ${s.city === 'here' ? 'selected' : ''}>현재 위치</option>`;
  const days = S.days.map((d) => `<div class="rowx"><span class="grow1"><b style="color:${color(d.who)}">●</b> ${esc(d.title)}</span><span class="muted">${d.lunar ? '음력 ' : ''}${d.m}월 ${d.d}일</span><button class="x" data-act="delDay" data-id="${d.id}">✕</button></div>`).join('') || '<div class="empty">아직 없어요</div>';
  $('#settingsPage').innerHTML = `<h2>⚙ 설정</h2>
    <h3>가족</h3>
    <div class="setgrid">
      <span>엄마 부르는 이름</span><input data-set="names.mom" value="${esc(s.names.mom)}">
      <span>아빠 부르는 이름</span><input data-set="names.dad" value="${esc(s.names.dad)}">
      <span>아이 이름</span><input data-set="names.kid" value="${esc(s.names.kid)}">
      <span>아이 생일</span><input type="date" data-set="kidBirth" value="${esc(s.kidBirth)}">
    </div>
    <h3>생일·기념일 (해마다 오는 날) <button class="add" data-act="addDay">+</button></h3>
    <div style="max-width:760px">${days}</div>
    <h3>화면 바꾸기</h3>
    <div class="setgrid">
      <span>화면 모드</span><select data-set="mode"><option value="auto" ${s.mode === 'auto' ? 'selected' : ''}>자동 (학교 시간엔 어른 화면)</option><option value="kid" ${s.mode === 'kid' ? 'selected' : ''}>늘 동물 화면</option><option value="adult" ${s.mode === 'adult' ? 'selected' : ''}>늘 어른 화면</option></select>
      <span>학교 가는 시간</span><div class="inl"><input type="time" data-set="schoolStart" value="${s.schoolStart}"> ~ <input type="time" data-set="schoolEnd" value="${s.schoolEnd}"></div>
      <span>방학 기간</span><div class="inl"><input type="date" data-set="vacStart" value="${s.vacStart}"> ~ <input type="date" data-set="vacEnd" value="${s.vacEnd}"></div>
    </div>
    <p class="note">자동 모드: 평일 학교 시간에는 차분한 어른 화면, 하교 후·주말·공휴일·방학·'쉬는 날' 일정에는 동물 화면이 나와요.</p>
    <h3>날씨 지역</h3>
    <div class="setgrid"><span>지역</span><select data-set="city">${cityOpts}</select></div>
    <h3>잠금·화면</h3>
    <div class="setgrid">
      <span>엄마·아빠 비밀번호</span><div class="inl"><button class="btn sub" data-act="changePin">비밀번호 바꾸기</button><span class="muted">${s.pin === '0000' ? '⚠️ 처음 비밀번호는 0000이에요. 꼭 바꿔 주세요.' : '설정됨'}</span></div>
      <span>화면 켜 두기</span><div class="inl"><button class="btn sub" data-act="wake">${s.wake ? '켜짐 (화면이 안 꺼져요)' : '꺼짐'}</button><button class="btn sub" data-act="full">전체 화면</button></div>
    </div>
    <h3>백업 (꼭 가끔 해 주세요)</h3>
    <p class="note">기록은 이 태블릿 브라우저 안에만 있어요. 브라우저 기록을 지우거나 태블릿을 바꾸면 사라지니, 가끔 백업 파일로 저장해 두세요.</p>
    <div class="btns" style="margin-top:8px"><button class="btn" data-act="export">백업 파일 저장</button><button class="btn sub" data-act="import">백업 파일 불러오기</button><button class="btn sub" data-act="demo">예시 데이터 넣어 보기</button><button class="btn red" data-act="reset">모두 지우기</button></div>
    <input type="file" id="importFile" accept=".json,application/json" class="hidden">
    <p class="note" style="margin-top:18px">날씨: Open-Meteo · 기록은 인터넷으로 보내지 않아요.</p>`;
}

// ---------- 입력 창 ----------
let modalDone = null;
function openSheet(html, onSubmit) {
  $('#sheet').innerHTML = html;
  $('#modal').classList.remove('hidden');
  modalDone = onSubmit;
  const first = $('#sheet input[type=text]');
  if (first) setTimeout(() => first.focus(), 50);
}
function closeSheet() { $('#modal').classList.add('hidden'); modalDone = null; }
function form({ title, fields, ok = '저장', extra = '' }, cb) {
  const html = `<h3>${title}</h3>` + fields.map((f) => {
    if (f.type === 'who') return `<label>${f.label}</label><div class="opts" data-name="${f.name}">${(f.options || ['family', 'kid', 'mom', 'dad']).map((k) => `<button type="button" data-v="${k}" class="${(f.value || 'family') === k ? 'on' : ''}">${esc(nm(k))}</button>`).join('')}</div>`;
    if (f.type === 'check') return `<label style="display:flex;gap:8px;align-items:center"><input type="checkbox" name="${f.name}" ${f.value ? 'checked' : ''}> ${f.label}</label>`;
    if (f.type === 'select') return `<label>${f.label}</label><select name="${f.name}">${f.options.map(([v, t]) => `<option value="${v}" ${String(f.value) === String(v) ? 'selected' : ''}>${t}</option>`).join('')}</select>`;
    return `<label>${f.label}</label><input type="${f.type || 'text'}" name="${f.name}" value="${esc(f.value ?? '')}" placeholder="${esc(f.ph || '')}">`;
  }).join('') + extra + `<div class="foot2"><button class="btn sub" data-act="close">취소</button><button class="btn" data-act="submit">${ok}</button></div>`;
  openSheet(html, () => {
    const v = {};
    $('#sheet').querySelectorAll('[name]').forEach((el) => { v[el.name] = el.type === 'checkbox' ? el.checked : el.value.trim(); });
    $('#sheet').querySelectorAll('.opts').forEach((el) => { v[el.dataset.name] = $('button.on', el)?.dataset.v; });
    return cb(v);
  });
}
function askPin(cb, title = '엄마·아빠 비밀번호') {
  let val = '';
  const draw = () => {
    $('#pinDots').innerHTML = [0, 1, 2, 3].map((i) => `<i class="${i < val.length ? 'f' : ''}"></i>`).join('');
  };
  openSheet(`<h3 style="text-align:center">${title}</h3><div class="pin" id="pinDots"></div><div class="pad">${[1, 2, 3, 4, 5, 6, 7, 8, 9, '취소', 0, '⌫'].map((k) => `<button data-pin="${k}">${k}</button>`).join('')}</div>`, null);
  draw();
  pinHandler = (k) => {
    if (k === '취소') { closeSheet(); pinHandler = null; return; }
    if (k === '⌫') val = val.slice(0, -1); else if (val.length < 4) val += k;
    draw();
    if (val.length === 4) {
      if (val === S.settings.pin) { pinHandler = null; closeSheet(); cb(); }
      else { val = ''; setTimeout(draw, 150); toast('비밀번호가 달라요'); }
    }
  };
}
let pinHandler = null;
let toastTimer;
function toast(msg, undo) {
  const el = $('#toast');
  el.innerHTML = esc(msg) + (undo ? ' <button id="undoBtn">되돌리기</button>' : '');
  el.classList.remove('hidden');
  if (undo) $('#undoBtn').onclick = () => { undo(); el.classList.add('hidden'); };
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add('hidden'), undo ? 5000 : 2500);
}
function celebrate(src, text) {
  const d = document.createElement('div');
  d.className = 'cele';
  d.innerHTML = `<img src="${src}" alt=""><div>${esc(text)}</div><div class="muted" style="font-family:var(--font);margin-top:10px">화면을 누르면 닫혀요</div>`;
  d.onclick = () => d.remove();
  $('#stage').appendChild(d);
  setTimeout(() => d.remove(), 6000);
}

// ---------- 일정 창 ----------
function dayModal(ds) {
  const d = parse(ds);
  const evs = eventsOn(ds);
  const list = evs.map((e) => `<div class="rowx"><span style="width:52px" class="muted">${e.time || '종일'}</span><span class="grow1" style="border-left:3px solid ${color(e.who)};padding-left:8px">${esc(e.title)}${e.off ? ' <small class="muted">(쉬는 날)</small>' : ''}${e.kind === 'yearly' ? ' <small class="muted">(해마다)</small>' : ''}</span>${e.kind === 'ev' ? `<button class="x" data-act="delEvent" data-id="${e.id}" data-day="${ds}">✕</button>` : ''}</div>`).join('') || '<div class="empty">일정이 없어요</div>';
  openSheet(`<h3>${d.getMonth() + 1}월 ${d.getDate()}일 (${WD[d.getDay()]})${HOLIDAYS[ds] ? ' · ' + HOLIDAYS[ds] : ''}</h3><div class="list">${list}</div>
    <div class="foot2"><button class="btn sub" data-act="close">닫기</button><button class="btn" data-act="addEvent" data-day="${ds}">+ 일정 추가</button></div>`, null);
}
function addEvent(ds) {
  form({ title: '일정 추가', fields: [
    { name: 'title', label: '무엇을 하나요?', ph: '예: 수영 수업' },
    { name: 'date', label: '날짜', type: 'date', value: ds || ymd(today()) },
    { name: 'time', label: '시간 (비우면 종일)', type: 'time' },
    { name: 'who', label: '누구 일정?', type: 'who', value: 'family' },
    { name: 'off', label: '쉬는 날이에요 (학교 안 가요 → 동물 화면)', type: 'check' },
    { name: 'dday', label: '다가오는 날(D-day)에도 보여 주기', type: 'check' },
  ] }, (v) => {
    if (!v.title || !v.date) { toast('내용과 날짜를 넣어 주세요'); return false; }
    S.events.push({ id: uid(), title: v.title, date: v.date, time: v.time, who: v.who, off: v.off, dday: v.dday });
    save(); renderAll(); toast('일정을 넣었어요');
  });
}
function addDay() {
  form({ title: '해마다 오는 날 추가', fields: [
    { name: 'title', label: '이름', ph: '예: 엄마 생일, 결혼기념일, 할머니 생신' },
    { name: 'm', label: '월', type: 'select', options: Array.from({ length: 12 }, (_, i) => [i + 1, `${i + 1}월`]), value: 1 },
    { name: 'd', label: '일', type: 'select', options: Array.from({ length: 31 }, (_, i) => [i + 1, `${i + 1}일`]), value: 1 },
    { name: 'lunar', label: '음력이에요', type: 'check' },
    { name: 'who', label: '누구?', type: 'who', value: 'family' },
  ] }, (v) => {
    if (!v.title) { toast('이름을 넣어 주세요'); return false; }
    S.days.push({ id: uid(), title: v.title, m: +v.m, d: +v.d, lunar: v.lunar, who: v.who });
    save(); renderAll(); toast('기념일을 넣었어요');
  });
}

// ---------- 음악 (반짝반짝 작은 별, 소리를 직접 만들어 연주) ----------
let audio = null, playTimer = null;
const TUNE = 'C C G G A A G- F F E E D D C- G G F F E E D- G G F F E E D- C C G G A A G- F F E E D D C-';
const FREQ = { C: 523.25, D: 587.33, E: 659.25, F: 698.46, G: 783.99, A: 880 };
function toggleMusic() {
  const btn = $('#musicBtn');
  if (playTimer) { clearTimeout(playTimer); playTimer = null; btn.classList.remove('playing'); return; }
  audio = audio || new (window.AudioContext || window.webkitAudioContext)();
  audio.resume();
  btn.classList.add('playing');
  const notes = TUNE.split(' ');
  let i = 0;
  const step = () => {
    const n = notes[i % notes.length];
    const len = n.endsWith('-') ? 0.84 : 0.42;
    const o = audio.createOscillator(), g = audio.createGain();
    o.type = 'triangle'; o.frequency.value = FREQ[n[0]];
    const t = audio.currentTime;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.18, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + len * 0.95);
    o.connect(g).connect(audio.destination); o.start(t); o.stop(t + len);
    i++;
    playTimer = setTimeout(step, len * 1000 * (i % notes.length === 0 ? 3 : 1));
  };
  step();
}

// ---------- 화면 켜 두기 ----------
let wakeLock = null;
async function keepAwake() {
  if (!S.settings.wake || !('wakeLock' in navigator) || document.visibilityState !== 'visible') return;
  try { wakeLock = await navigator.wakeLock.request('screen'); } catch (e) { /* 화면을 한 번 눌러야 켜지는 기기도 있다 */ }
}

// ---------- 누르기 처리 ----------
function showTab(t) {
  page = t;
  document.querySelectorAll('#side [data-tab]').forEach((b) => b.classList.toggle('on', b.dataset.tab === t));
  document.querySelectorAll('.page').forEach((p) => p.classList.toggle('on', p.id === 'page-' + t));
  renderAll();
}
function findList(k) { return k === 'shop' ? S.shopping : S.todos[k]; }

const ACT = {
  mode() { S.settings.mode = { auto: 'kid', kid: 'adult', adult: 'auto' }[S.settings.mode]; save(); applyTheme(); toast({ auto: '자동 모드: 학교 시간엔 어른 화면', kid: '늘 동물 화면', adult: '늘 어른 화면' }[S.settings.mode]); },
  music: toggleMusic,
  close: closeSheet,
  submit() { if (modalDone && modalDone() !== false) closeSheet(); },
  addEvent(el) { addEvent(el.dataset.day); },
  delEvent(el) { const e = S.events.find((x) => x.id === el.dataset.id); S.events = S.events.filter((x) => x.id !== el.dataset.id); save(); renderAll(); dayModal(el.dataset.day); toast('일정을 지웠어요', () => { S.events.push(e); save(); renderAll(); }); },
  addDay,
  delDay(el) { if (confirm('이 기념일을 지울까요?')) { S.days = S.days.filter((x) => x.id !== el.dataset.id); save(); renderAll(); } },
  addTodo(el) {
    const k = el.dataset.k;
    form({ title: `${k === 'common' ? '공통' : nm(k)} 할 일 추가`, fields: [{ name: 'text', label: '할 일', ph: '예: 책 반납하기' }] }, (v) => {
      if (!v.text) return false;
      S.todos[k].push({ id: uid(), text: v.text, done: false }); save(); renderAll();
    });
  },
  toggleTodo(el) {
    const x = S.todos[el.dataset.k].find((y) => y.id === el.dataset.id);
    if (!x) return;
    x.done = !x.done; x.doneAt = x.done ? ymd(today()) : '';
    save(); renderAll();
    if (el.dataset.k === 'kid') autoKidSticker();
  },
  delTodo(el) {
    const k = el.dataset.k; const list = S.todos[k]; const i = list.findIndex((y) => y.id === el.dataset.id);
    const [x] = list.splice(i, 1); save(); renderAll();
    toast(`'${x.text}' 지웠어요`, () => { list.splice(i, 0, x); save(); renderAll(); });
  },
  addShop() {
    form({ title: '장보기 추가', fields: [{ name: 'text', label: '살 것 (쉼표로 여러 개)', ph: '예: 우유, 계란, 사과' }] }, (v) => {
      if (!v.text) return false;
      v.text.split(/[,，]/).map((t) => t.trim()).filter(Boolean).forEach((t) => S.shopping.push({ id: uid(), text: t }));
      save(); renderAll();
    });
  },
  bought(el) {
    const i = S.shopping.findIndex((y) => y.id === el.dataset.id);
    const [x] = S.shopping.splice(i, 1); save(); renderAll();
    toast(`${x.text} 샀어요 ✓`, () => { S.shopping.splice(i, 0, x); save(); renderAll(); });
  },
  status(el) {
    const k = el.dataset.k;
    openSheet(`<h3>${esc(josa(nm(k), '은', '는'))} 지금?</h3><div class="reasons">${STATUS.map(([e, t], i) => `<button data-act="setStatus" data-k="${k}" data-i="${i}">${e} ${t}</button>`).join('')}</div><div class="foot2"><button class="btn sub" data-act="close">닫기</button></div>`, null);
  },
  setStatus(el) { S.status[el.dataset.k] = +el.dataset.i; save(); closeSheet(); renderAll(); },
  give(el) { const r = el.dataset.r; askPin(() => addSticker(1, r, '엄마·아빠')); },
  giveCustom() {
    askPin(() => form({ title: '스티커 주기', fields: [{ name: 'reason', label: '잘한 일', ph: '예: 혼자 일어났어요' }, { name: 'n', label: '몇 장?', type: 'select', options: [[1, '1장'], [2, '2장'], [3, '3장'], [5, '5장']], value: 1 }] }, (v) => {
      if (!v.reason) return false;
      setTimeout(() => addSticker(+v.n, v.reason, '엄마·아빠'), 0);
    }));
  },
  delSticker(el) {
    askPin(() => {
      S.stickers.log = S.stickers.log.filter((x) => x.id !== el.dataset.id);
      if (S.stickers.base > total()) { // 이미 이사 간 동물은 그대로 두고, 진행만 0부터
        S.stickers.base = total();
      }
      save(); renderAll(); toast('스티커 기록을 지웠어요');
    });
  },
  say(el) {
    const v = el.closest('.vbg');
    v.querySelectorAll('.say').forEach((s) => s.remove());
    const s = document.createElement('div');
    s.className = 'say';
    s.textContent = SAY[Math.floor(Math.random() * SAY.length)];
    s.style.left = el.style.left; s.style.top = `calc(${el.style.top} - ${el.offsetHeight + 6}px)`;
    v.appendChild(s);
    setTimeout(() => s.remove(), 2500);
  },
  newTrip() { ACT.editTrip(true); },
  editTrip(isNew) {
    const T = isNew === true ? null : S.trip;
    form({ title: T ? '여행 정보 고치기' : '새 여행', fields: [
      { name: 'title', label: '여행 이름', value: T?.title, ph: '예: 바닷가 가족 여행' },
      { name: 'date', label: '출발일', type: 'date', value: T?.date },
      { name: 'end', label: '돌아오는 날', type: 'date', value: T?.end },
      ...(T ? [] : [{ name: 'basic', label: '기본 준비물 채워 넣기', type: 'check', value: true }]),
    ] }, (v) => {
      if (!v.title) return false;
      if (T) Object.assign(T, { title: v.title, date: v.date, end: v.end });
      else {
        const pack = ['옷', '잠옷', '세면도구', '비상약', '충전기', '모자', '선크림', '물티슈', '카메라', '책·놀잇감'];
        const buy = ['간식', '물', '과일'];
        S.trip = { title: v.title, date: v.date, end: v.end, items: v.basic ? [...pack.map((t) => ({ id: uid(), text: t, cat: 'pack', done: false })), ...buy.map((t) => ({ id: uid(), text: t, cat: 'buy', done: false }))] : [] };
        if (v.date) S.events.push({ id: uid(), title: `✈️ ${v.title}`, date: v.date, time: '', who: 'family' });
      }
      save(); renderAll();
    });
  },
  addTrip(el) {
    const cat = el.dataset.cat;
    form({ title: cat === 'buy' ? '살 것 추가' : '챙길 물건 추가', fields: [{ name: 'text', label: '쉼표로 여러 개 넣을 수 있어요', ph: '예: 수영복, 튜브' }] }, (v) => {
      if (!v.text) return false;
      v.text.split(/[,，]/).map((t) => t.trim()).filter(Boolean).forEach((t) => S.trip.items.push({ id: uid(), text: t, cat, done: false }));
      save(); renderAll();
    });
  },
  toggleTrip(el) { const x = S.trip.items.find((y) => y.id === el.dataset.id); if (x) { x.done = !x.done; save(); renderAll(); } },
  delTrip(el) { S.trip.items = S.trip.items.filter((y) => y.id !== el.dataset.id); save(); renderAll(); },
  uncheckTrip() { S.trip.items.forEach((x) => (x.done = false)); save(); renderAll(); },
  endTrip() { if (confirm('여행을 끝내고 준비물 목록을 지울까요?')) { S.trip = null; save(); renderAll(); } },
  changePin() {
    askPin(() => form({ title: '새 비밀번호 (숫자 4자리)', fields: [{ name: 'pin', label: '새 비밀번호', type: 'password', ph: '숫자 4자리' }] }, (v) => {
      if (!/^\d{4}$/.test(v.pin)) { toast('숫자 4자리로 넣어 주세요'); return false; }
      S.settings.pin = v.pin; save(); renderAll(); toast('비밀번호를 바꿨어요');
    }), '지금 비밀번호');
  },
  wake() { S.settings.wake = !S.settings.wake; save(); if (S.settings.wake) keepAwake(); else if (wakeLock) wakeLock.release(); renderAll(); },
  full() { const d = document.documentElement; (d.requestFullscreen || d.webkitRequestFullscreen || (() => {})).call(d); },
  export() {
    const data = { ...S, weather: null, _app: 'family-dashboard', _at: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `가족대시보드-백업-${ymd(today())}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    toast('백업 파일을 저장했어요');
  },
  import() { askPin(() => $('#importFile').click()); },
  demo() { if (confirm('예시 데이터를 넣을까요? 지금 기록은 지워져요.')) { S = demoData(); save(); renderAll(); toast('예시 데이터를 넣었어요'); } },
  reset() { askPin(() => { if (confirm('정말 모든 기록을 지울까요? 되돌릴 수 없어요.')) { S = fresh(); save(); renderAll(); } }); },
};

document.addEventListener('click', (ev) => {
  const p = ev.target.closest('[data-pin]');
  if (p && pinHandler) { const k = p.dataset.pin; pinHandler(k === '취소' || k === '⌫' ? k : String(k)); return; }
  const o = ev.target.closest('.opts button');
  if (o) { o.parentElement.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b === o)); return; }
  const a = ev.target.closest('[data-act]');
  if (a && ACT[a.dataset.act]) { ACT[a.dataset.act](a); return; }
  const t = ev.target.closest('[data-tab]');
  if (t) { closeSheet(); showTab(t.dataset.tab); return; }
  const d = ev.target.closest('[data-day]');
  if (d && !$('#modal').contains(d)) { dayModal(d.dataset.day); return; }
  if (ev.target.id === 'modal') closeSheet();
});
document.addEventListener('keydown', (ev) => {
  if (ev.key === 'Enter' && !$('#modal').classList.contains('hidden') && modalDone) { ev.preventDefault(); ACT.submit(); }
  if (ev.key === 'Escape') closeSheet();
});
document.addEventListener('change', (ev) => {
  const el = ev.target;
  if (el.id === 'importFile' && el.files[0]) {
    el.files[0].text().then((txt) => {
      try {
        const d = JSON.parse(txt);
        if (d._app !== 'family-dashboard') throw new Error();
        localStorage.setItem(KEY, JSON.stringify(d)); load(); save(); renderAll(); toast('백업을 불러왔어요');
      } catch (e) { toast('이 파일은 대시보드 백업이 아니에요'); }
    });
    el.value = '';
    return;
  }
  const key = el.dataset.set;
  if (!key) return;
  if (key.startsWith('names.')) S.settings.names[key.slice(6)] = el.value.trim() || WHO[key.slice(6)];
  else S.settings[key] = el.value;
  if (key === 'city' && el.value === 'here') {
    navigator.geolocation?.getCurrentPosition((p) => { S.settings.lat = +p.coords.latitude.toFixed(3); S.settings.lon = +p.coords.longitude.toFixed(3); save(); fetchWeather(); }, () => toast('위치를 쓸 수 없어요. 도시를 골라 주세요'));
  }
  save(); applyTheme(); renderAll();
  if (key === 'city') fetchWeather();
});

// ---------- 예시 데이터 ----------
function demoData() {
  const d = fresh();
  const t = today();
  const on = (n) => ymd(addDays(t, n));
  d.settings.kidBirth = `${t.getFullYear() - 10}-${pad2(((t.getMonth() + 1) % 12) + 1)}-12`;
  d.todos.kid = [{ id: uid(), text: '수학 익힘책 2쪽' }, { id: uid(), text: '줄넘기 100번' }, { id: uid(), text: '책가방 챙기기' }].map((x) => ({ ...x, done: false }));
  d.todos.mom = ['책 반납하기', '식물 물 주기', '겨울옷 정리'].map((t2) => ({ id: uid(), text: t2, done: false }));
  d.todos.dad = ['분리수거', '자동차 점검 예약', '사진 정리하기'].map((t2) => ({ id: uid(), text: t2, done: false }));
  d.todos.common = [{ id: uid(), text: '가족 사진 고르기', done: false }];
  d.shopping = ['우유', '사과', '식빵', '요거트'].map((t2) => ({ id: uid(), text: t2 }));
  d.events = [
    { id: uid(), title: '도서관 가기', date: on(0), time: '16:00', who: 'kid' },
    { id: uid(), title: '피아노 학원', date: on(0), time: '17:30', who: 'kid' },
    { id: uid(), title: '가족 주말 브런치', date: on(1), time: '11:00', who: 'family' },
    { id: uid(), title: '건강 검진', date: on(3), time: '09:00', who: 'dad' },
    { id: uid(), title: '미술 교실', date: on(4), time: '15:00', who: 'kid' },
    { id: uid(), title: '동창 모임', date: on(6), time: '19:00', who: 'mom' },
    { id: uid(), title: '수영 수업', date: on(8), time: '16:00', who: 'kid' },
    { id: uid(), title: '영화 보는 날', date: on(12), time: '', who: 'family' },
    { id: uid(), title: '학교 재량휴업일', date: on(15), time: '', who: 'kid', off: true },
  ];
  d.days = [
    { id: uid(), title: '엄마 생일', m: 3, d: 2, lunar: false, who: 'mom' },
    { id: uid(), title: '아빠 생일', m: 8, d: 21, lunar: false, who: 'dad' },
    { id: uid(), title: '결혼기념일', m: 12, d: 4, lunar: false, who: 'family' },
    { id: uid(), title: '할머니 생신', m: 11, d: 3, lunar: true, who: 'family' },
  ];
  d.trip = { title: '바닷가 가족 여행', date: on(9), end: on(11), items: ['잠옷', '세면도구', '비상약', '모자', '선크림', '수영복', '튜브', '모래놀이', '충전기', '물티슈', '카메라'].map((x, i) => ({ id: uid(), text: x, cat: 'pack', done: i < 3 })).concat(['간식통', '생수', '과일'].map((x) => ({ id: uid(), text: x, cat: 'buy', done: false }))) };
  d.events.push({ id: uid(), title: '✈️ 바닷가 가족 여행', date: on(9), time: '', who: 'family' });
  const reasons = ['양치를 혼자 했어요', '오늘 할 일을 다 했어요', '정리정돈을 했어요', '책을 읽었어요'];
  for (let i = 0; i < 52; i++) d.stickers.log.push({ id: uid(), date: on(-Math.floor(i / 2)), n: 1, reason: reasons[i % 4], by: i % 4 === 1 ? '할 일' : '엄마' });
  d.stickers.grown = [{ animal: 'polarbear', date: on(-20), seed: 0.35 }];
  d.stickers.base = 40; d.stickers.animal = 1;
  d.status = { dad: 2, mom: 0 };
  return d;
}

// ---------- 그리기 ----------
function renderAll() {
  cleanTodos();
  renderClock();
  if (page === 'home') { renderWeather(); renderCal(); renderDays2(); renderTodos(); renderKid(); renderDday(); renderStatus(); }
  if (page === 'village') renderVillage();
  if (page === 'sticker') renderStickerPage();
  if (page === 'trip') renderTripPage();
  if (page === 'settings') renderSettings();
}

// ---------- 시작 ----------
load();
fit();
addEventListener('resize', fit);
applyTheme();
renderAll();
fetchWeather();
keepAwake();
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { keepAwake(); renderAll(); } });
document.addEventListener('click', () => { if (S.settings.wake && !wakeLock) keepAwake(); }, { once: true });
let lastDay = ymd(today());
setInterval(() => {
  renderClock();
  applyTheme();
  const ds = ymd(today());
  if (ds !== lastDay) { lastDay = ds; renderAll(); }
}, 1000 * 15);
setInterval(() => { if (page === 'home' && $('#modal').classList.contains('hidden')) renderAll(); }, 60 * 1000);
setInterval(fetchWeather, 30 * 60 * 1000);
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
window.__dash = { get S() { return S; }, demoData, renderAll, showTab };
})();
