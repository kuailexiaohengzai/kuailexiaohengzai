/**
 * 一条 JSON 存档：已解锁关卡、最高分、最高连击、总局数、最后游玩日、连续天数。
 * 有 wx.setUserCloudStorage 时同步最高分和最高连击，方便以后做好友榜。
 */

const STORAGE_KEY = 'zaishua-progress-v1';
const SESSION_KEY = 'zaishua-session';

function emptyProgress() {
  return {
    level: 1,
    bestScore: 0,
    bestCombo: 0,
    totalRuns: 0,
    lastPlayedDate: '',
    dailyStreak: 0,
  };
}

function positiveInt(value, fallback) {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n) || n < 1) return fallback;
  return n;
}

function nonNegInt(value) {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n) || n < 0) return 0;
  return n;
}

function normalize(raw) {
  const base = emptyProgress();
  if (!raw || typeof raw !== 'object') return base;
  base.level = positiveInt(raw.level, 1);
  base.bestScore = nonNegInt(raw.bestScore);
  base.bestCombo = nonNegInt(raw.bestCombo);
  base.totalRuns = nonNegInt(raw.totalRuns);
  base.dailyStreak = nonNegInt(raw.dailyStreak);
  if (typeof raw.lastPlayedDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.lastPlayedDate)) {
    base.lastPlayedDate = raw.lastPlayedDate;
  }
  return base;
}

function parseBlob(raw) {
  if (raw == null || raw === '') return emptyProgress();
  if (typeof raw === 'object') return normalize(raw);
  if (typeof raw !== 'string') return emptyProgress();
  try {
    return normalize(JSON.parse(raw));
  } catch (err) {
    return emptyProgress();
  }
}

function dateString(date) {
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  const d = date.getDate();
  return y + '-' + (m < 10 ? '0' : '') + m + '-' + (d < 10 ? '0' : '') + d;
}

function shiftDays(date, days) {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  next.setDate(next.getDate() + days);
  return next;
}

function touchStreak(progress, now) {
  const current = normalize(progress);
  const today = dateString(now);
  if (current.lastPlayedDate === today) return current;
  const yesterday = dateString(shiftDays(now, -1));
  if (current.lastPlayedDate === yesterday) current.dailyStreak += 1;
  else current.dailyStreak = 1;
  current.lastPlayedDate = today;
  return current;
}

function saveProgress(progress, storage) {
  const blob = JSON.stringify(normalize(progress));
  storage.setStorageSync(STORAGE_KEY, blob);
  return blob;
}

function loadProgress(storage) {
  let raw = null;
  try {
    raw = storage.getStorageSync(STORAGE_KEY);
  } catch (err) {
    raw = null;
  }
  return parseBlob(raw);
}

function syncCloud(api, progress) {
  if (!api || typeof api.setUserCloudStorage !== 'function') return;
  try {
    api.setUserCloudStorage({
      KVDataList: [
        { key: 'bestScore', value: String(progress.bestScore) },
        { key: 'bestCombo', value: String(progress.bestCombo) },
      ],
      fail: function () {},
      complete: function () {},
    });
  } catch (err) {}
}

function createStore(wxApi) {
  const api = wxApi === undefined
    ? (typeof wx !== 'undefined' ? wx : null)
    : wxApi;

  return {
    load: function () {
      if (!api || typeof api.getStorageSync !== 'function') return emptyProgress();
      return loadProgress(api);
    },
    save: function (progress) {
      const normalized = normalize(progress);
      if (api && typeof api.setStorageSync === 'function') {
        try {
          api.setStorageSync(STORAGE_KEY, JSON.stringify(normalized));
        } catch (err) {}
      }
      syncCloud(api, normalized);
      return normalized;
    },
  };
}

module.exports = {
  STORAGE_KEY: STORAGE_KEY,
  SESSION_KEY: SESSION_KEY,
  emptyProgress: emptyProgress,
  normalize: normalize,
  parseBlob: parseBlob,
  dateString: dateString,
  touchStreak: touchStreak,
  saveProgress: saveProgress,
  loadProgress: loadProgress,
  createStore: createStore,
};
