// ===== storage.js =====
// 各問題の解答履歴をlocalStorageに保存・読み込み

const STORAGE_KEY = 'jlpt_n1_records';

// 全記録を取得 { qid: { seen: N, correct: N, lastWrong: bool } }
function loadRecords() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch(e) {
    return {};
  }
}

// 全記録を保存
function saveRecords(records) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch(e) {}
}

// 1問の結果を記録
function recordAnswer(qid, isCorrect) {
  const records = loadRecords();
  if (!records[qid]) records[qid] = { seen: 0, correct: 0, lastWrong: false };
  records[qid].seen++;
  if (isCorrect) {
    records[qid].correct++;
    records[qid].lastWrong = false;
  } else {
    records[qid].lastWrong = true;
  }
  saveRecords(records);
  return records[qid];
}

// 全記録をリセット
function resetRecords() {
  localStorage.removeItem(STORAGE_KEY);
}

// 全体統計を計算
function getGlobalStats() {
  const records = loadRecords();
  let totalSeen = 0, totalCorrect = 0;
  Object.values(records).forEach(r => {
    totalSeen   += r.seen;
    totalCorrect += r.correct;
  });
  return { totalSeen, totalCorrect };
}
