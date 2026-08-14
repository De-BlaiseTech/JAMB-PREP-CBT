const $ = id => document.getElementById(id);
const subjects = JSON.parse(localStorage.getItem('mockSubjects') || '[]');
const user = JSON.parse(localStorage.getItem('jambUser') || '{}');
const SESSION_VERSION = 3;

$('student').textContent = user.name || 'Practice Student';

let questions = [];
let answers = {};
let flags = {};
let index = 0;
let expiresAt = 0;
let examId = '';
let submitting = false;

function setLoading(text) {
  $('question').textContent = text;
  $('options').innerHTML = '<div class="empty">Please wait while we prepare your test.</div>';
  $('counter').textContent = 'Preparing your test…';
  $('progress').style.width = '0%';
  $('prev').disabled = true;
  $('next').disabled = true;
  $('flag').disabled = true;
  $('submit').disabled = true;
  $('submitTop').disabled = true;
}

function clearLoading() {
  $('next').disabled = false;
  $('flag').disabled = false;
  $('submit').disabled = false;
  $('submitTop').disabled = false;
}

function save() {
  localStorage.setItem('examSession', JSON.stringify({
    version: SESSION_VERSION,
    examId,
    questions,
    answers,
    flags,
    index,
    expiresAt,
    subjects,
    updatedAt: Date.now()
  }));
}

// Always rebuild the question array into subject blocks using the student's
// selected subject order. This protects against an older/mixed saved session.
function organizeQuestionsBySubject(list) {
  if (!Array.isArray(list) || !list.length) return [];

  const buckets = new Map();
  for (const subject of subjects) buckets.set(subject, []);

  for (const q of list) {
    if (buckets.has(q.subject)) buckets.get(q.subject).push(q);
  }

  return subjects.flatMap(subject => buckets.get(subject) || []);
}

function loadSession() {
  try {
    const s = JSON.parse(localStorage.getItem('examSession') || 'null');

    if (!s || !s.examId || !Array.isArray(s.questions) || !s.questions.length) {
      return false;
    }

    if (!Array.isArray(s.subjects) || JSON.stringify(s.subjects) !== JSON.stringify(subjects)) {
      return false;
    }

    examId = s.examId;
    answers = s.answers || {};
    flags = s.flags || {};
    expiresAt = Number(s.expiresAt) || 0;

    // Reorder even an existing session. This fixes sessions created by an
    // earlier version where questions could be mixed between subjects.
    const organized = organizeQuestionsBySubject(s.questions);

    if (organized.length !== s.questions.length) {
      return false;
    }

    const currentQuestionId = s.questions[Number(s.index) || 0]?.id;
    const newIndex = organized.findIndex(q => q.id === currentQuestionId);

    questions = organized;
    index = newIndex >= 0 ? newIndex : 0;

    // If this is an older session, immediately upgrade it to the new format.
    save();
    return true;
  } catch {
    return false;
  }
}

function subjectIndexes(subject) {
  const out = [];
  questions.forEach((q, i) => {
    if (q.subject === subject) out.push(i);
  });
  return out;
}

function currentSubject() {
  return questions[index]?.subject || '';
}

function firstIndexOfSubject(subject) {
  return questions.findIndex(q => q.subject === subject);
}

function lastIndexOfSubject(subject) {
  for (let i = questions.length - 1; i >= 0; i--) {
    if (questions[i].subject === subject) return i;
  }
  return -1;
}

function nextSubject(subject) {
  const pos = subjects.indexOf(subject);
  return pos >= 0 && pos < subjects.length - 1 ? subjects[pos + 1] : null;
}

function previousSubject(subject) {
  const pos = subjects.indexOf(subject);
  return pos > 0 ? subjects[pos - 1] : null;
}

function render() {
  if (!questions.length) return;

  const q = questions[index];
  const subj = q.subject;
  const subjectFirst = index === firstIndexOfSubject(subj);
  const subjectLast = index === lastIndexOfSubject(subj);
  const nextSub = nextSubject(subj);

  $('subject').textContent = q.subject + (q.topic ? ' • ' + q.topic : '');

  const localPosition = subjectIndexes(q.subject).indexOf(index) + 1;
  const localTotal = subjectIndexes(q.subject).length;
  $('counter').textContent = `${q.subject}: Question ${localPosition} of ${localTotal}`;

  $('question').textContent = q.question;
  $('progress').style.width = ((index + 1) / questions.length * 100) + '%';

  $('options').replaceChildren(
    ...(q.options || []).map((o, i) => {
      const b = document.createElement('button');
      b.className = 'option-btn ' + (answers[q.id] === i ? 'selected' : '');
      b.dataset.i = i;

      const letter = document.createElement('span');
      letter.className = 'letter';
      letter.textContent = String.fromCharCode(65 + i);

      const text = document.createElement('span');
      text.textContent = o;

      b.append(letter, text);

      b.onclick = () => {
        answers[q.id] = +b.dataset.i;
        save();
        render();
      };

      return b;
    })
  );

  $('prev').disabled = index === 0;
  $('next').textContent = subjectLast
    ? (nextSub ? `Next: ${nextSub} →` : 'Finish →')
    : 'Next →';

  $('flag').textContent = flags[q.id] ? '⚑ Unflag' : '⚑ Flag';
  $('navsummary').textContent = `${Object.keys(answers).length}/${questions.length}`;

  // Subject selector: jumping is allowed only when the student deliberately
  // selects a subject. Normal Next/Previous navigation never skips subjects.
  $('subjects').replaceChildren(
    ...subjects.map(subject => {
      const b = document.createElement('button');
      b.className = q.subject === subject ? 'active' : '';
      b.textContent = subject;
      b.onclick = () => {
        const target = firstIndexOfSubject(subject);
        if (target >= 0) {
          index = target;
          save();
          render();
        }
      };
      return b;
    })
  );

  // Keep the question palette grouped in the same subject order.
  $('numbers').replaceChildren(
    ...questions.map((x, i) => {
      const b = document.createElement('button');
      b.className = `num-btn ${i === index ? 'current' : ''} ${answers[x.id] !== undefined ? 'answered' : ''} ${flags[x.id] ? 'flagged' : ''}`;
      b.textContent = i + 1;
      b.title = `${x.subject} — Question ${subjectIndexes(x.subject).indexOf(i) + 1}`;
      b.onclick = () => {
        index = i;
        save();
        render();
      };
      return b;
    })
  );
}

function openSubmit() {
  const unanswered = questions.length - Object.keys(answers).length;
  $('confirmText').textContent = unanswered
    ? `You have ${unanswered} unanswered question${unanswered === 1 ? '' : 's'}. You can still submit.`
    : 'All questions have been answered. Submit and see your result now?';
  $('confirm').showModal();
}

function updateClock() {
  const left = Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));
  const m = Math.floor(left / 60);
  const s = left % 60;

  $('timer').textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  $('timer').classList.toggle('warn', left <= 120);

  if (left <= 0) {
    clearInterval(window.examClock);
    submitExam(true);
  }
}

function startClock() {
  clearInterval(window.examClock);
  updateClock();
  window.examClock = setInterval(updateClock, 1000);
}

async function submitExam(auto = false) {
  if (submitting || !examId || !questions.length) return;

  submitting = true;
  clearInterval(window.examClock);
  $('confirmSubmit').disabled = true;
  $('submit').disabled = true;
  $('submitTop').disabled = true;

  try {
    const fb = await import('./firebase-bridge.js');
    const cleanAnswers = {};

    Object.entries(answers).forEach(([id, value]) => {
      const n = Number(value);
      if (Number.isInteger(n) && n >= 0 && n <= 3) cleanAnswers[id] = n;
    });

    const response = await fb.submitExam(examId, cleanAnswers, questions, subjects);
    const result = response.result;

    localStorage.setItem('lastResult', JSON.stringify(result));
    localStorage.removeItem('examSession');
    localStorage.removeItem('activeExamId');

    location.href = 'result.html?attempt=' + encodeURIComponent(result.id);
  } catch (e) {
    submitting = false;
    $('confirmSubmit').disabled = false;
    $('submit').disabled = false;
    $('submitTop').disabled = false;

    alert(e?.message || 'The test could not be submitted. Please check your connection and try again.');
    if (auto) startClock();
  }
}

// Previous: stay in the current subject. Only when at Q1 of a subject does
// Previous intentionally move to the last question of the previous subject.
$('prev').onclick = () => {
  if (index === 0) return;

  const subj = currentSubject();

  if (index === firstIndexOfSubject(subj)) {
    const prevSub = previousSubject(subj);
    if (prevSub) {
      index = lastIndexOfSubject(prevSub);
      save();
      render();
    }
  } else {
    index--;
    save();
    render();
  }
};

// NEXT: this is deliberately based on the end of the CURRENT SUBJECT, not
// merely on the next array item. Therefore Next cannot switch subjects early.
$('next').onclick = () => {
  const subj = currentSubject();
  const last = lastIndexOfSubject(subj);

  if (index < last) {
    // Still inside this subject: advance one question only.
    index++;
    save();
    render();
    return;
  }

  // We have reached the last question of this subject.
  const nextSub = nextSubject(subj);

  if (nextSub) {
    index = firstIndexOfSubject(nextSub);
    save();
    render();
  } else {
    openSubmit();
  }
};

$('flag').onclick = () => {
  const id = questions[index].id;
  flags[id] = !flags[id];
  save();
  render();
};

$('submit').onclick = $('submitTop').onclick = openSubmit;
$('cancel').onclick = () => $('confirm').close();
$('confirmSubmit').onclick = () => {
  $('confirm').close();
  submitExam();
};

(async () => {
  setLoading('Loading your practice test…');

  if (!subjects.length) {
    location.replace('setup.html');
    return;
  }

  if (!loadSession()) {
    location.replace('setup.html');
    return;
  }

  if (expiresAt && Date.now() > expiresAt) {
    localStorage.removeItem('examSession');
    localStorage.removeItem('activeExamId');
    location.replace('setup.html');
    return;
  }

  try {
    const fb = await import('./firebase-bridge.js');
    const u = await fb.currentUser();
    if (!u) {
      location.replace('index.html');
      return;
    }
  } catch {
    location.replace('index.html');
    return;
  }

  clearLoading();
  save();
  render();
  startClock();
})();
