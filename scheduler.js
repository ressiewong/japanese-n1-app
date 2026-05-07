// ===== scheduler.js =====
// スマート出題順：間違えた問題優先、たまに復習、未出題もバランスよく

// 問題IDリストをスコアリングしてソート
// priority: missed(未正答) > review(正答だが1回以上間違い) > unseen > mastered
function buildQueue(qids) {
  const records = loadRecords();
  const now = Date.now();

  // 各qidにスコアをつける（大きいほど優先）
  const scored = qids.map(qid => {
    const r = records[qid];

    if (!r || r.seen === 0) {
      // 未出題
      return { qid, priority: 'unseen', score: 1000 + Math.random() * 100 };
    }

    const accuracy = r.correct / r.seen;

    if (r.lastWrong) {
      // 直近で間違えた → 最優先
      return { qid, priority: 'missed', score: 3000 + (1 - accuracy) * 500 + Math.random() * 50 };
    }

    if (r.seen > 0 && accuracy < 1.0) {
      // 一度以上間違えたことがある → 復習対象
      return { qid, priority: 'review', score: 2000 + (1 - accuracy) * 500 + Math.random() * 100 };
    }

    // 完全マスター（全問正答）→ たまに出す
    // seenが多いほど出にくくする
    const masteredScore = Math.random() * 200 - r.seen * 20;
    return { qid, priority: 'mastered', score: masteredScore };
  });

  // スコア降順でソート
  scored.sort((a, b) => b.score - a.score);

  return scored;
}

// モードのqidリストからセッション用キューを組み立て（10問）
function buildSession(mode) {
  const qids = MODE_QUESTIONS[mode];
  const scored = buildQueue(qids);

  // missed → review → unseen → mastered の順で最大10問
  const missed   = scored.filter(x => x.priority === 'missed');
  const review   = scored.filter(x => x.priority === 'review');
  const unseen   = scored.filter(x => x.priority === 'unseen');
  const mastered = scored.filter(x => x.priority === 'mastered');

  // キュー構築：間違えた問題を優先しつつ、復習・未出題もバランスよく
  let queue = [];

  // まず missed を全部入れる（最大5問）
  queue = queue.concat(missed.slice(0, 5).map(x => x.qid));

  // review を追加（残り枠）
  const reviewSlots = Math.min(review.length, Math.max(0, 7 - queue.length));
  queue = queue.concat(review.slice(0, reviewSlots).map(x => x.qid));

  // unseen を追加
  const unseenSlots = Math.min(unseen.length, Math.max(0, 9 - queue.length));
  queue = queue.concat(unseen.slice(0, unseenSlots).map(x => x.qid));

  // mastered でたまに復習（1〜2問）
  if (mastered.length > 0 && queue.length < 10) {
    queue = queue.concat(mastered.slice(0, 1).map(x => x.qid));
  }

  // 10問に満たない場合は残りを追加
  if (queue.length < 5) {
    const already = new Set(queue);
    const extra = scored.filter(x => !already.has(x.qid)).map(x => x.qid);
    queue = queue.concat(extra.slice(0, 10 - queue.length));
  }

  // ただし missed は先頭に固定、それ以外はシャッフル
  const missedIds = new Set(missed.slice(0, 5).map(x => x.qid));
  const front = queue.filter(id => missedIds.has(id));
  const rest  = shuffleArr(queue.filter(id => !missedIds.has(id)));

  return front.concat(rest);
}

// 配列シャッフル
function shuffleArr(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// キューの各問題のステータスを返す（バッジ表示用）
function getQueueStatuses(queue, currentIdx) {
  const records = loadRecords();
  return queue.map((qid, i) => {
    if (i === currentIdx) return 'current';
    const r = records[qid];
    if (!r || r.seen === 0) return 'unseen';
    if (r.lastWrong) return 'missed';
    if (r.correct < r.seen) return 'review';
    return 'unseen';
  });
}
