(() => {
  // ---------- ステージデータ ----------
  const STAGES = {
    words: {
      title: "ステージ1：単語",
      prompts: [
        "cat", "river", "light", "focus", "frame",
        "sound", "quick", "apple", "storm", "clear"
      ]
    },
    phrases: {
      title: "ステージ2：文章",
      prompts: [
        "type fast but stay accurate",
        "practice makes improvement",
        "keep your hands relaxed",
        "consistency beats intensity",
        "errors teach more than success"
      ]
    },
    paragraph: {
      title: "ステージ3：長文",
      prompts: [
        "Typing is a skill that improves with deliberate practice. Focus on accuracy first, then add speed.",
        "When learning to type, resist the urge to chase speed early. A steady approach builds durable skill.",
        "Good typists correct mistakes quickly without losing flow. They value precision under pressure."
      ]
    }
  };

  const difficultyConfig = {
    easy:   { timePerPrompt: 24, comboBonus: 5, missPenalty: 8 },
    normal: { timePerPrompt: 18, comboBonus: 8, missPenalty: 10 },
    hard:   { timePerPrompt: 14, comboBonus: 12, missPenalty: 12 }
  };

  // ---------- 要素取得 ----------
  const el = (id) => document.getElementById(id);
  const typingInput = el("typingInput");
  const promptBuffer = el("promptBuffer");
  const progress = el("progress");
  const score = el("score");
  const accuracy = el("accuracy");
  const wpm = el("wpm");
  const misses = el("misses");
  const combo = el("combo");
  const time = el("time");
  const progressBarFill = el("progressBarFill");
  const stageName = el("stageName");
  const difficultySelect = el("difficulty");
  const btnStart = el("btnStart");
  const btnReset = el("btnReset");
  const btnSkip = el("btnSkip");

  // ---------- 状態 ----------
  const state = {
    stageId: null,
    prompts: [],
    promptIndex: 0,
    startedAt: 0,
    timeLeft: 0,
    totalCharsTyped: 0,
    totalCorrectChars: 0,
    totalMisses: 0,
    score: 0,
    combo: 0,
    maxCombo: 0,
    skipUsed: false,
    wpmSamples: [],
    running: false
  };

  // ---------- 初期化 ----------
  const init = () => {
    const stageId = sessionStorage.getItem("selectedStage");
    if (!stageId || !STAGES[stageId]) {
      window.location.href = "index.html";
      return;
    }

    state.stageId = stageId;
    state.prompts = STAGES[stageId].prompts;
    stageName.textContent = STAGES[stageId].title;
    renderCurrentPrompt();
    updateHud();
  };

  // ---------- 表示更新 ----------
  const renderCurrentPrompt = () => {
    const prompt = getCurrentPrompt();
    promptBuffer.innerHTML = `<span class="remaining">${escapeHtml(prompt)}</span>`;
    typingInput.value = "";
  };

  const getCurrentPrompt = () => state.prompts[state.promptIndex] || "";

  const escapeHtml = (s) =>
    s.replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));

  const renderPromptBuffer = (target, input) => {
    let i = 0;
    while (i < input.length && i < target.length && input[i] === target[i]) i++;
    const done = target.slice(0, i);
    const current = target[i] || "";
    const remaining = target.slice(i + (current ? 1 : 0));

    promptBuffer.innerHTML = `
      <span class="done">${escapeHtml(done)}</span>
      ${current ? `<span class="current">${escapeHtml(current)}</span>` : ""}
      <span class="remaining">${escapeHtml(remaining)}</span>
    `;
  };

  const fmtTime = (s) => {
    const m = Math.floor(s / 60);
    const r = Math.floor(s % 60);
    return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
  };

  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

  const updateHud = () => {
    progress.textContent = `${state.promptIndex} / ${state.prompts.length}`;
    score.textContent = `${state.score}`;
    misses.textContent = `${state.totalMisses}`;
    combo.textContent = `${state.combo}`;
    const acc = state.totalCharsTyped
      ? Math.round((state.totalCorrectChars / state.totalCharsTyped) * 100)
      : 0;
    accuracy.textContent = `${acc}%`;

    const avgWpm =
      state.wpmSamples.length
        ? Math.round(state.wpmSamples.reduce((a, b) => a + b, 0) / state.wpmSamples.length)
        : 0;
    wpm.textContent = `${avgWpm}`;

    time.textContent = fmtTime(state.timeLeft);
    const ratio = state.totalCharsTyped
      ? state.totalCorrectChars / state.totalCharsTyped
      : 0;
    progressBarFill.style.width = `${clamp(ratio * 100, 0, 100)}%`;
  };

  // ---------- ゲーム処理 ----------
  const recalcTimeLeft = () => {
    const diff = difficultyConfig[difficultySelect.value];
    const base = diff.timePerPrompt;
    const len = getCurrentPrompt().length;
    const scaled = Math.round(base + Math.min(20, len * 0.6));
    state.timeLeft = scaled;
  };

  let tickTimer = null;
  const startTick = () => {
    stopTick();
    tickTimer = setInterval(() => {
      if (!state.running) return;
      state.timeLeft = clamp(state.timeLeft - 1, 0, 9999);
      updateHud();
      if (state.timeLeft <= 0) {
        handleTimeUp();
      }
    }, 1000);
  };
  const stopTick = () => {
    if (tickTimer) clearInterval(tickTimer);
    tickTimer = null;
  };

  const startGame = () => {
    state.running = true;
    typingInput.disabled = false;
    typingInput.focus();
    recalcTimeLeft();
    startTick();
    state.startedAt = performance.now();
  };

  const handleTimeUp = () => {
    const diff = difficultyConfig[difficultySelect.value];
    state.totalMisses++;
    state.combo = 0;
    state.score = Math.max(0, state.score - diff.missPenalty);
    advancePromptOrFinish();
  };

  const advancePromptOrFinish = () => {
    state.promptIndex++;
    if (state.promptIndex >= state.prompts.length) {
      finishStage();
    } else {
      renderCurrentPrompt();
      recalcTimeLeft();
      updateHud();
    }
  };

  const finishStage = () => {
    state.running = false;
    typingInput.disabled = true;
    stopTick();

    const resultData = {
      stage: STAGES[state.stageId].title,
      progress: `${state.promptIndex} / ${state.prompts.length}`,
      score: state.score,
      accuracy: Math.round((state.totalCorrectChars / state.totalCharsTyped) * 100),
      wpm: Math.round(state.wpmSamples.reduce((a, b) => a + b, 0) / state.wpmSamples.length),
      misses: state.totalMisses,
      maxCombo: state.maxCombo,
      timeLeft: fmtTime(state.timeLeft)
    };

    sessionStorage.setItem("gameResult", JSON.stringify(resultData));
    window.location.href = "result.html";
  };

  const onEnter = () => {
    if (!state.running) return;
    const target = getCurrentPrompt();
    const input = typingInput.value;
    state.totalCharsTyped += input.length;
    let correctChars = 0;
    for (let i = 0; i < Math.min(input.length, target.length); i++) {
      if (input[i] === target[i]) correctChars++;
    }
    state.totalCorrectChars += correctChars;
    const isExact = input === target;
    const diff = difficultyConfig[difficultySelect.value];

    const elapsedMs = performance.now() - state.startedAt;
    const minutes = Math.max(elapsedMs / 60000, 0.001);
    const wpmNow = Math.round((input.length / 5) / minutes);
    state.wpmSamples.push(wpmNow);
    state.startedAt = performance.now();

    if (isExact) {
      state.combo++;
      state.maxCombo = Math.max(state.maxCombo, state.combo);
      const baseScore = Math.max(5, Math.round(target.length * 2));
      const bonus = diff.comboBonus * Math.max(0, state.combo - 1);
      state.score += baseScore + bonus + clamp(state.timeLeft, 0, 20);
      advancePromptOrFinish();
    } else {
      state.totalMisses++;
      state.combo = 0;
      state.score = Math.max(0, state.score - diff.missPenalty);
      state.timeLeft = clamp(state.timeLeft - 2, 0, 9999);
      updateHud();
    }
  };

  const onInputChange = () => {
    if (!state.running) return;
    renderPromptBuffer(getCurrentPrompt(), typingInput.value);
  };

  const onSkip = () => {
    if (!state.running || state.skipUsed) return;
    state.skipUsed = true;
    state.score = Math.max(0, state.score - 15);
    advancePromptOrFinish();
  };

  // ---------- イベント登録 ----------
  btnStart.addEventListener("click", () => {
    startGame();
  });

  btnReset.addEventListener("click", () => {
    stopTick();
    typingInput.disabled = true;
    typingInput.value = "";
    state.running = false;
    state.promptIndex = 0;
    state.score = 0;
    state.totalMisses = 0;
    state.combo = 0;
    state.maxCombo = 0;
    state.totalCharsTyped = 0;
    state.totalCorrectChars = 0;
    state.wpmSamples = [];
    state.skipUsed = false;
    renderCurrentPrompt();
    updateHud();
  });

  btnSkip.addEventListener("click", onSkip);

  typingInput.addEventListener("input", onInputChange);
  typingInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      onEnter();
    }
  });

  difficultySelect.addEventListener("change", () => {
    if (state.running) {
      recalcTimeLeft();
      updateHud();
    }
  });

  // ---------- 初期化呼び出し ----------
  init();
})();
