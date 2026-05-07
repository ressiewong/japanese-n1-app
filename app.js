// ===== app.js =====
// メインクイズロジック

// ===== 定数 =====
const MODE_LABELS = {
  kanji:   { text:'漢字',  badge:'badge-kanji',   desc:'問題１・２：漢字の読み方・書き方（N1必考）' },
  vocab:   { text:'語彙',  badge:'badge-vocab',   desc:'問題３・４：文脈語彙・同義語・用法（N1常考）' },
  grammar: { text:'文法',  badge:'badge-grammar', desc:'問題５：文法形式の判断（N1重點）' },
  context: { text:'文脈',  badge:'badge-context', desc:'問題６：文章の流れ（N1高分題）' },
};

// ===== 状態 =====
let mode        = 'kanji';
let sessionQueue = [];   // qidの配列
let curIdx      = 0;
let sessionCorrect = 0;
let sessionWrong   = [];  // { qid, chosen, correct }
let answered    = false;

// ===== 初期化 =====
window.addEventListener('DOMContentLoaded', () => {
  updateGlobalStats();
  switchMode('kanji');
});

// ===== モード切替 =====
function switchMode(m) {
  mode = m;
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.getElementById('tab-' + m).classList.add('active');
  document.getElementById('mode-desc').textContent = MODE_LABELS[m].desc;
  startSession();
}

// ===== セッション開始 =====
function startSession() {
  sessionQueue   = buildSession(mode);
  curIdx         = 0;
  sessionCorrect = 0;
  sessionWrong   = [];

  document.getElementById('quiz-area').classList.remove('hidden');
  document.getElementById('result-area').classList.add('hidden');

  renderQuestion();
  updateGlobalStats();
}

// ===== 問題描画 =====
function renderQuestion() {
  if (curIdx >= sessionQueue.length) {
    showResult();
    return;
  }

  const qid = sessionQueue[curIdx];
  const q   = ALL_QUESTIONS[qid];
  if (!q) { curIdx++; renderQuestion(); return; }

  const total = sessionQueue.length;

  // Progress bar
  document.getElementById('progress').style.width = (curIdx / total * 100) + '%';
  document.getElementById('prog-label').textContent = (curIdx + 1) + '/' + total;

  // Queue badges
  renderQueueBadges();

  // Type badge
  const badge = document.getElementById('type-badge');
  badge.className = 'type-badge ' + MODE_LABELS[mode].badge;
  badge.textContent = MODE_LABELS[mode].text;

  // Q id label + 履歴
  const rec = loadRecords()[qid];
  let histText = '';
  if (rec && rec.seen > 0) {
    histText = `過去: ${rec.seen}回 / 正答: ${rec.correct}回`;
  }
  document.getElementById('q-id-label').textContent = histText;

  // Context
  const ctxEl = document.getElementById('q-context');
  if (q.context) {
    ctxEl.style.display = 'block';
    ctxEl.textContent = q.context;
  } else {
    ctxEl.style.display = 'none';
  }

  // Question text
  document.getElementById('q-main').innerHTML = q.main;
  document.getElementById('q-sub').textContent  = q.sub || '';

  // Reset
  const fb = document.getElementById('feedback');
  fb.style.display = 'none';
  fb.className = 'feedback';
  document.getElementById('grammar-detail').style.display = 'none';
  document.getElementById('next-btn').style.display = 'none';
  document.getElementById('q-history').style.display = 'none';

  answered = false;

  // Choices
  const choicesEl = document.getElementById('choices');
  choicesEl.innerHTML = '';
  q.choices.forEach((c, i) => {
    const btn = document.createElement('button');
    btn.className = 'choice';
    btn.innerHTML = `<span style="opacity:.5;font-size:12px;margin-right:6px;">${i+1}.</span>${c}`;
    btn.onclick = () => selectAnswer(i);
    choicesEl.appendChild(btn);
  });
}

// ===== キューバッジ描画 =====
function renderQueueBadges() {
  const statuses = getQueueStatuses(sessionQueue, curIdx);
  const container = document.getElementById('queue-badges');
  container.innerHTML = '';
  statuses.forEach((status, i) => {
    const span = document.createElement('span');
    span.className = 'q-badge ' + status;
    span.textContent = i + 1;
    container.appendChild(span);
  });
}

// ===== 回答処理 =====
function selectAnswer(idx) {
  if (answered) return;
  answered = true;

  const qid = sessionQueue[curIdx];
  const q   = ALL_QUESTIONS[qid];
  const isCorrect = idx === q.ans;

  // 記録
  recordAnswer(qid, isCorrect);
  updateGlobalStats();

  if (isCorrect) {
    sessionCorrect++;
  } else {
    sessionWrong.push({ qid, chosen: idx, correct: q.ans });
  }

  // 選択肢をスタイル
  const btns = document.querySelectorAll('.choice');
  btns.forEach(b => b.classList.add('disabled'));
  btns[idx].classList.add(isCorrect ? 'correct' : 'wrong');
  if (!isCorrect) btns[q.ans].classList.add('correct');

  // フィードバック
  const fb = document.getElementById('feedback');
  fb.style.display = 'block';
  if (isCorrect) {
    fb.className = 'feedback correct';
    fb.innerHTML = `✓ 正解！<br><span style="font-size:12px;">${q.exp}</span>`;
  } else {
    fb.className = 'feedback wrong';
    fb.innerHTML = `✗ 不正解。正解：<strong>${q.choices[q.ans]}</strong><br><span style="font-size:12px;">${q.exp}</span>`;
  }

  // 文法詳細パネル（不正解時 or 文法問題）
  if (q.grammarDetail && (!isCorrect)) {
    showGrammarDetail(q.grammarDetail);
  }

  // 次へボタン
  document.getElementById('next-btn').style.display = 'block';

  // 問題履歴ミニ表示
  renderQHistory(isCorrect, qid);
}

// ===== 文法詳細パネル =====
function showGrammarDetail(gd) {
  const el = document.getElementById('grammar-detail');
  el.style.display = 'block';
  el.innerHTML = `
    <h4>📘 ${gd.pattern}</h4>
    <div class="gd-section">
      <div class="gd-label">意味</div>
      <div>${gd.meaning}</div>
    </div>
    <div class="gd-section">
      <div class="gd-label">接続・用法・注意</div>
      <div style="white-space:pre-line;">${gd.usage}</div>
    </div>
    <div class="gd-section">
      <div class="gd-label">例文</div>
      ${gd.examples.map(e => `<div class="gd-example">・${e}</div>`).join('')}
    </div>
  `;
}

// ===== 問題履歴ミニ =====
function renderQHistory(isCorrect, qid) {
  const rec = loadRecords()[qid] || {};
  const histEl = document.getElementById('q-history');
  histEl.style.display = 'block';
  histEl.innerHTML = `
    <div class="q-history-row ${isCorrect ? 'correct' : 'wrong'}">
      <span>${isCorrect ? '✓' : '✗'}</span>
      <span>この問題の累計：${rec.seen || 0}回中 ${rec.correct || 0}回正解</span>
    </div>
  `;
}

// ===== 次の問題 =====
function nextQ() {
  curIdx++;
  renderQuestion();
  renderQueueBadges();
}

// ===== 結果画面 =====
function showResult() {
  document.getElementById('quiz-area').classList.add('hidden');
  document.getElementById('result-area').classList.remove('hidden');

  const total = sessionQueue.length;
  const pct   = total > 0 ? Math.round(sessionCorrect / total * 100) : 0;

  document.getElementById('r-pct').textContent = pct + '%';
  document.getElementById('r-cor').textContent = sessionCorrect;
  document.getElementById('r-wro').textContent = sessionWrong.length;
  document.getElementById('r-tot').textContent = total;

  const msgs = [
    '繼續努力！間違えた問題を重点的に！💪',
    'まあまあ！もう一回チャレンジ！👍',
    'なかなか良い！あと少しで合格圏！🌟',
    '優秀！この調子で7月1日も頑張ろう！🏆',
  ];
  document.getElementById('r-msg').textContent = msgs[pct < 50 ? 0 : pct < 70 ? 1 : pct < 90 ? 2 : 3];

  // 間違えた問題レビュー
  renderWrongReview();
}

// ===== 間違えた問題レビュー =====
function renderWrongReview() {
  const container = document.getElementById('wrong-review');
  if (sessionWrong.length === 0) {
    container.innerHTML = '<p style="color:var(--green-t);font-size:14px;text-align:center;">✓ 全問正解！素晴らしい！</p>';
    return;
  }

  let html = `<h3>✗ 間違えた問題（${sessionWrong.length}問）</h3>`;
  sessionWrong.forEach(({ qid, chosen, correct }) => {
    const q = ALL_QUESTIONS[qid];
    if (!q) return;
    html += `
      <div class="wr-item">
        <div class="wr-q">${q.main.replace(/<[^>]+>/g, '')}</div>
        <div>あなたの答え：<span style="color:var(--red-t);">${q.choices[chosen]}</span></div>
        <div class="wr-correct">正解：${q.choices[correct]}</div>
        <div class="wr-exp">${q.exp}</div>
        ${q.grammarDetail ? `
          <div class="wr-grammar-detail">
            <strong>${q.grammarDetail.pattern}</strong><br>
            ${q.grammarDetail.meaning}<br>
            <span style="white-space:pre-line;font-size:11px;">${q.grammarDetail.usage}</span>
          </div>` : ''}
      </div>
    `;
  });
  container.innerHTML = html;
}

// ===== 再挑戦（優先錯題） =====
function restart() {
  startSession();
}

// ===== グローバル統計更新 =====
function updateGlobalStats() {
  const { totalSeen, totalCorrect } = getGlobalStats();
  const totalWrong = totalSeen - totalCorrect;
  const rate = totalSeen > 0 ? Math.round(totalCorrect / totalSeen * 100) : null;

  document.getElementById('chip-total').textContent   = `📊 總計: ${totalSeen}問`;
  document.getElementById('chip-correct').textContent = `✓ 正答: ${totalCorrect}`;
  document.getElementById('chip-wrong').textContent   = `✗ 錯誤: ${totalWrong}`;
  document.getElementById('chip-rate').textContent    = rate !== null ? `正答率: ${rate}%` : '正答率: —';
}

// ===== リセット確認 =====
function confirmReset() {
  if (confirm('全ての記録をリセットしますか？')) {
    resetRecords();
    updateGlobalStats();
    startSession();
  }
}
