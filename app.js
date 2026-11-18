"use strict";

function startListening(bank, descriptions = {}, mediaUrl = (relative) => relative) {
  const questionTexts = window.LISTENING_QUESTION_TEXTS ?? {};
  const translations = window.LISTENING_BILINGUAL ?? { docs: {}, cues: {} };
  const main = document.querySelector("#main");
  const dialog = document.querySelector("#confirm");
  const pageSize = 10;
  const locale = new Intl.NumberFormat("zh-CN");
  const firstQuestion = (scene) => (scene.part - 1) * 10 + 1;
  const sceneById = new Map(bank.map((scene) => [scene.id, scene]));
  const counts = [1, 2, 3, 4].map((p) => bank.filter((scene) => scene.part === p).length);
  const answerCount = bank.reduce((sum, scene) => sum + scene.answers.filter(Boolean).length, 0);
  const audioCount = bank.filter((scene) => scene.audio).length;
  const ui = { part: 0, search: "", page: 0, expanded: "", audioOnly: false };
  let session = null;
  let attempts = {};

  try { attempts = JSON.parse(localStorage.getItem("listening-attempts") ?? "{}") || {}; }
  catch { attempts = {}; }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    })[c]);
  }

  function go(view) {
    if (location.hash === "#" + view) render();
    else location.hash = view;
  }

  function banner(isPractice) {
    const wave = [12,17,25,32,18,39,57,35,46,67,81,47,30,51,64,28,35,46,79,91,56,39,57,80,49,71,88,64,32,49,56,41,26,37,62,47,30,22,32,27,20,13];
    return `<section class="hero">
      <div class="hero-copy">
        <div class="eyebrow">11 月听力题库</div>
        <h1>${isPractice ? "雅思听力机考练习" : "雅思听力场景答案"}</h1>
        <p>${isPractice ? "按 Part 单篇练习，也可组合四个 Part 限时作答。" : "按场景查答案，按题号核对填空词和选项。"} </p>
        <div class="hero-actions">${isPractice
          ? '<button class="button primary" data-action="mock">开始 40 题组合练习 <span aria-hidden="true">→</span></button>'
          : '<a class="button primary" href="#practice">进入机考练习 <span aria-hidden="true">→</span></a>'}
          ${isPractice ? '<button class="button secondary" data-action="audio-only" aria-pressed="' + ui.audioOnly + '">只看有音频</button>' : ""}
        </div>
        ${isPractice ? '<p class="hint">组合练习的 Part 1 为关键词填空，Part 2–4 使用原题和音频。</p>' : ""}
      </div>
      <div class="hero-board">
        <div class="board-top"><span>IELTS LISTENING</span><strong>Part 1–4</strong></div>
        <div class="wave" aria-hidden="true">${wave.map((n) => '<span style="height:'+n+'%"></span>').join("")}</div>
        <div class="stats"><div><strong>${bank.length}</strong><span>听力场景</span></div><div><strong>${locale.format(answerCount)}</strong><span>小题答案</span></div><div><strong>${audioCount}</strong><span>原录音</span></div></div>
      </div>
    </section>`;
  }

  function sourceInfo(scene) {
    const variants = scene.variants.map(({label, diff}) => `<p>${escapeHtml(label)}　${Object.entries(diff).map(([n, v]) => 'Q'+escapeHtml(n)+' '+escapeHtml(v)).join("，")}</p>`).join("");
    const sources = scene.source.flatMap((file) => file.split("\n")).map((s) => `<p>${escapeHtml(s)}</p>`).join("");
    const notes = scene.notes.map((s) => `<p>${escapeHtml(s)}</p>`).join("");
    const alias = scene.aliases.length ? `<p>另见题名　${escapeHtml(scene.aliases.join(" / "))}</p>` : "";
    return `<details><summary>出处与版本说明</summary>${alias}${sources}${variants}${notes}</details>`;
  }

  function answerCard(scene) {
    return `<div class="scene-card" id="key-${scene.id}">
      <div class="answer-grid">${scene.answers.map((answer, i) =>
        `<div class="answer-cell"><b>Q${firstQuestion(scene)+i}</b><span>${escapeHtml(answer ?? "原资料未列")}</span></div>`).join("")}</div>
      ${sourceInfo(scene)}
    </div>`;
  }

  function sceneList(isPractice) {
    const search = ui.search.trim().toLowerCase();
    const filtered = bank.filter((scene) => (!ui.part || scene.part === ui.part)
      && (!isPractice || !ui.audioOnly || scene.audio)
      && (!search || [scene.zh, scene.en, scene.id, descriptions[scene.id], ...scene.aliases, ...(!isPractice ? scene.answers : [])]
        .some((s) => s?.toLowerCase().includes(search))));
    const maxPage = Math.max(0, Math.ceil(filtered.length / pageSize) - 1);
    ui.page = Math.min(ui.page, maxPage);
    const list = filtered.slice(ui.page * pageSize, (ui.page + 1) * pageSize).map((s) => {
      const expanded = !isPractice && ui.expanded === s.id;
      const mode = s.audio ? "原题 + 音频" : s.pages ? "有原题" : "关键词填空";
      const info = isPractice && Object.hasOwn(attempts, s.id) ? `上次 ${attempts[s.id]} 题对` : mode;
      const action = isPractice
        ? `<button class="button primary small scene-action" data-action="start" data-id="${s.id}">开始练习</button>`
        : `<button class="button secondary small scene-action" data-action="expand" data-id="${s.id}" aria-expanded="${expanded}">${expanded ? "收起答案" : "查看答案"}</button>`;
      return `<div class="scene-row"><span class="scene-id">${s.id}</span>
        <div class="scene-title"><strong>${escapeHtml(s.zh)}</strong><small lang="en">${escapeHtml(s.en)}</small><p class="description">${escapeHtml(descriptions[s.id] ?? "")}</p></div>
        <span class="scene-type">${info}</span>${action}</div>${expanded ? answerCard(s) : ""}`;
    }).join("");
    const supplement = (!isPractice || !ui.audioOnly) && (!ui.part || ui.part === 1)
      && (!search || "bay view holiday village 海湾景观度假村".includes(search))
      ? '<div class="exam-nav"><div><strong>Part 1 补充原题 · Bay View Holiday Village</strong><p class="hint">游客了解度假村的小木屋、短住优惠和家庭活动。原资料缺少音频和答案。</p></div><a class="button secondary small" href="' + escapeHtml(mediaUrl("questions/extra-bay-view.webp")) + '" target="_blank" rel="noopener">查看原题</a></div>' : '';
    document.querySelector("#matches").textContent = `${filtered.length} 个场景`;
    document.querySelector("#scene-list").innerHTML = `<div class="scenes">
      <div class="scene-head"><span>编号</span><span>场景</span><span>资料</span><span></span></div>
      ${list || '<div class="empty">没有找到匹配的场景。试试其他关键词。</div>'}
    </div>${filtered.length > pageSize ? `<div class="pages"><button class="button secondary small" data-action="prev-page" ${ui.page === 0 ? "disabled" : ""}>上一页</button>
      <span>第 ${ui.page+1} / ${maxPage+1} 页</span><button class="button secondary small" data-action="next-page" ${ui.page === maxPage ? "disabled" : ""}>下一页</button></div>` : ""}${supplement}`;
  }

  function library(isPractice) {
    main.innerHTML = banner(isPractice) + `<section class="library" id="library" aria-labelledby="library-title">
      <div class="library-head"><h2 id="library-title">${isPractice ? "选择练习场景" : "场景与答案"}</h2><span id="matches" aria-live="polite"></span></div>
      <div class="controls"><div class="filters" aria-label="按 Part 筛选">
        ${[0,1,2,3,4].map((p) => `<button class="filter" data-action="filter" data-part="${p}" aria-pressed="${ui.part===p}">${p === 0 ? "全部" : `Part ${p} · ${counts[p-1]}`}</button>`).join("")}</div>
        <input class="search" type="search" id="search" aria-label="搜索场景" placeholder="${isPractice ? "搜索场景或编号" : "搜索场景、编号或答案"}" value="${escapeHtml(ui.search)}">
      </div>
      <div id="scene-list"></div>
    </section>`;
    document.querySelector("#search").addEventListener("input", (event) => {
      ui.search = event.target.value;
      ui.page = 0;
      sceneList(isPractice);
    });
    sceneList(isPractice);
  }

  function newSession(scenes, timed) {
    session = {
      scenes, timed, index: 0, deadline: timed ? Date.now() + 30 * 60_000 : 0,
      answers: scenes.map(() => Array(10).fill("")),
      flags: scenes.map(() => Array(10).fill(false)),
      activeQuestions: scenes.map((scene) => scene.answers.findIndex((answer) => answer !== null)),
      audio: scenes.map(() => ({ played: false, done: false })),
      submitted: false,
    };
    go("session");
  }

  function randomScene(part) {
    const options = bank.filter((s) => s.part === part && s.answers.every(Boolean)
      && (part === 1 ? s.clues.every(Boolean) : s.audio && s.pages));
    return options[Math.floor(Math.random() * options.length)];
  }

  function renderAudio(scene) {
    if (!scene.audio) return `<div class="player"><strong>${scene.pages ? "原题练习" : "关键词填空"}</strong><span class="audio-status">本场景资料未附录音。</span></div>`;
    const src = escapeHtml(mediaUrl("audio/" + scene.id + ".ogg"));
    const media = `<audio id="audio" src="${src}" preload="metadata" ${session.timed ? "" : "controls"}></audio>`;
    if (!session.timed) return `<div class="player"><strong>原音频</strong>${media}</div>`;
    const status = session.audio[session.index];
    return `<div class="player"><strong>原音频 · 单次播放</strong>
      <button id="play" class="button secondary small" data-action="play" ${status.played ? 'disabled' : ''}>播放</button>
      <progress id="audio-progress" aria-label="播放进度" max="1" value="${status.done ? 1 : 0}"></progress>
      <span class="audio-status" id="audio-status">${status.done ? "播放结束" : status.played ? "已播放" : "就绪"}</span>
      <label class="audio-status">音量 <input id="volume" aria-label="音量" type="range" min="0" max="1" step=".05" value="1"></label>${media}
    </div>`;
  }

  function bilingualRows(scene) {
    if (scene.pages) return translations.docs[scene.id] ?? (questionTexts[scene.id] ?? "").split("\n").map((line) => [line, ""]);
    const chinese = translations.cues[scene.id] ?? [];
    return scene.clues.map((clue, i) => [`${firstQuestion(scene) + i}  ${clue || "原资料未列"}`, chinese[i] || ""]);
  }

  function questionText(scene, bothLanguages = false) {
    if (bothLanguages) return bilingualRows(scene).map(([english, chinese]) =>
      chinese ? `${english.trim()}\n${chinese}\n` : english.trim()).join("\n");
    if (scene.pages) return questionTexts[scene.id] ?? "";
    return bilingualRows(scene).map(([english]) => english).join("\n");
  }

  function rowQuestions(line, scene) {
    const prefix = line.match(/^\s*(\d{1,2})(?=[ .、)])/);
    const numbers = [...line.matchAll(/\b(\d{1,2})(?=\s*[._…·．]{3,})/g)].map((part) => Number(part[1]));
    if (prefix) numbers.push(Number(prefix[1]));
    const start = firstQuestion(scene);
    return [...new Set(numbers.filter((n) => n >= start && n < start + 10))].join(" ");
  }

  function bilingualPanel(scene) {
    const lines = bilingualRows(scene).map(([english, chinese]) => {
      if (!english.trim()) return '<div class="bilingual-break" aria-hidden="true"></div>';
      return `<div class="bilingual-row" data-questions="${rowQuestions(english, scene)}"><span lang="en">${escapeHtml(english.trim())}</span>
        <span class="bilingual-zh" lang="zh-CN">${escapeHtml(chinese)}</span></div>`;
    }).join("");
    return `<div class="bilingual-text" id="question-text" tabindex="0"><div class="bilingual-head" aria-hidden="true"><span>英文题目</span><span>中文译文</span></div>${lines}</div>`;
  }

  function promptPanel(scene) {
    const words = questionText(scene);
    const title = scene.pages ? "听力原题" : "场景填空";
    const textButton = scene.pages && words
      ? '<button class="button secondary small" data-action="question-text" aria-expanded="false" aria-controls="question-images">原题图片</button>' : "";
    const copyButtons = words ? '<button class="button secondary small" data-action="copy-question">复制英文</button><button class="button secondary small" data-action="copy-bilingual">复制中英</button>' : "";
    const images = scene.pages
      ? `<div id="question-images" class="question-images" ${words ? "hidden" : ""}>${Array.from({length:scene.pages}, (_, i) => {
          const src = escapeHtml(mediaUrl(`questions/${scene.id}-${i+1}.webp`));
          return `<a href="${src}" target="_blank" rel="noopener" aria-label="放大原题第 ${i+1} 页"><img class="question-image" src="${src}" alt="原题第 ${i+1} 页，共 ${scene.pages} 页" ${i ? 'loading="lazy"' : ""}></a>`;
        }).join("")}</div>` : "";
    return `<section class="panel"><div class="panel-head"><h2>${title}</h2><div class="answer-tools">${textButton}${copyButtons}</div>
      <span role="status" id="copy-feedback"></span></div>${words ? bilingualPanel(scene) : ""}${images}</section>`;
  }

  function exam() {
    if (!session) return library(true);
    if (session.submitted) return results();
    const index = session.index;
    const scene = session.scenes[index];
    const first = firstQuestion(scene);
    const inputs = scene.answers.map((a, i) => {
      const number = first + i;
      return `<div class="answer-label"><label for="a-${i}">${number}</label>
        <input id="a-${i}" data-answer="${i}" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" maxlength="100"
         value="${escapeHtml(session.answers[index][i])}" placeholder="${a === null ? "原资料未列" : "输入答案"}" ${a === null ? "disabled" : ""}>
        <button class="flag" data-action="flag" data-item="${i}" aria-label="标记第 ${number} 题待检查" aria-pressed="${session.flags[index][i]}" ${a === null ? "disabled" : ""}>标记</button>
        ${session.timed ? "" : `<span class="inline-key" hidden>参考答案　${escapeHtml(a ?? "原资料未列")}</span>`}</div>`;
    }).join("");
    main.innerHTML = `<section>
      <div class="exam-top"><div><a class="back" href="#practice">← 练习题库</a><h1>${escapeHtml(scene.zh)}</h1><p lang="en">${escapeHtml(scene.en)}</p><p class="description">${escapeHtml(descriptions[scene.id] ?? "")}</p></div>${session.timed ? '<output class="clock" id="timer" aria-label="剩余时间"></output>' : ""}</div>
      <div class="part-switch" aria-label="切换 Part">
        ${session.scenes.map((s, i) => `<button class="filter" data-action="part" data-item="${i}" aria-pressed="${i===index}">Part ${s.part} · Q${firstQuestion(s)}–${firstQuestion(s)+9}</button>`).join("")}
      </div>
      ${renderAudio(scene)}
      <div class="exam-grid">
        ${promptPanel(scene)}
        <section class="panel"><div class="panel-head"><h2>答题区</h2><div class="answer-tools"><span id="filled"></span>
          ${session.timed ? "" : '<button class="button secondary small" data-action="key" aria-expanded="false">查看参考答案</button>'}</div></div>
        <div class="sheet-body">${inputs}</div></section>
      </div>
      <div class="exam-nav">
        <div class="numbers" aria-label="导航题号">${scene.answers.map((a,i) => `<button class="number" data-action="number" data-item="${i}" ${a===null?"disabled":""}>${first+i}</button>`).join("")}</div>
        <div class="dialog-actions"><button class="button secondary" data-action="next-answer">下一题</button>
         ${index+1<session.scenes.length ? '<button class="button secondary" data-action="next-part">下一 Part</button>' : ""}
         <button class="button primary" data-action="submit">交卷</button></div>
      </div>
    </section>`;
    main.querySelectorAll("[data-answer]").forEach((el) => {
      const item = Number(el.dataset.answer);
      el.addEventListener("focus", () => {
        session.activeQuestions[index] = item;
        showProgress();
        const text = main.querySelector("#question-text");
        const prompt = text?.querySelector(".bilingual-current");
        if (prompt && !text.hidden) {
          const row = prompt.getBoundingClientRect();
          const panel = text.getBoundingClientRect();
          if (row.top < panel.top || row.bottom > panel.bottom) text.scrollTop += row.top - panel.top - 8;
        }
      });
      el.addEventListener("input", () => {
        session.answers[index][item] = el.value;
        showProgress();
      });
      el.addEventListener("keydown", (event) => {
        if (event.key === "Enter" && !event.isComposing) {
          event.preventDefault();
          nextQuestion();
        }
      });
    });
    showProgress();
    updateTimer();

    const audio = document.querySelector("#audio");
    if (!audio) return;
    audio.addEventListener("error", () => {
      const status = document.querySelector("#audio-status") ?? audio;
      status.insertAdjacentHTML("afterend", '<span class="bad">音频加载失败。请重试或检查题库文件。</span>');
    });
    if (!session.timed) return;
    document.querySelector("#volume").addEventListener("input", (event) => { audio.volume = Number(event.target.value); });
    audio.addEventListener("timeupdate", () => {
      if (audio.duration > 0) document.querySelector("#audio-progress").value = audio.currentTime / audio.duration;
    });
    audio.addEventListener("ended", () => {
      session.audio[index].done = true;
      document.querySelector("#audio-status").textContent = "播放结束";
      document.querySelector("#audio-progress").value = 1;
      if (index === session.scenes.length - 1) session.deadline = Math.min(session.deadline, Date.now() + 120_000);
    });
  }

  function showProgress() {
    const index = session.index;
    const values = session.answers[index];
    const flags = session.flags[index];
    const answered = values.filter((s) => s.trim()).length;
    const available = session.scenes[index].answers.filter(Boolean).length;
    document.querySelector("#filled").textContent = "已答 " + answered + " / " + available;
    main.querySelectorAll(".number").forEach((el, i) => {
      el.classList.toggle("filled", Boolean(values[i]?.trim()));
      el.classList.toggle("marked", flags[i]);
      if (i === session.activeQuestions[index]) el.setAttribute("aria-current", "step");
      else el.removeAttribute("aria-current");
    });
    const number = firstQuestion(session.scenes[index]) + session.activeQuestions[index];
    main.querySelector(".bilingual-current")?.classList.remove("bilingual-current");
    main.querySelector(`.bilingual-row[data-questions~="${number}"]`)?.classList.add("bilingual-current");
    main.querySelector('[data-action="next-answer"]').disabled = nextAnswerIndex() === -1 && index === session.scenes.length - 1;
  }

  function nextAnswerIndex() {
    const index = session.index;
    const active = session.activeQuestions[index];
    return session.scenes[index].answers.findIndex((answer, i) => i > active && answer !== null);
  }

  function focusAnswer(index) {
    main.querySelector(`#a-${index}`)?.focus();
  }

  function switchPart(next, focusFirst = false) {
    if (next === session.index || !session.scenes[next]) return;
    const audio = main.querySelector("#audio");
    if (session.timed && audio && !audio.paused && !audio.ended) {
      main.querySelector("#audio-status").textContent = "请听完本段音频再切换。";
      return;
    }
    session.index = next;
    if (focusFirst) session.activeQuestions[next] = session.scenes[next].answers.findIndex((answer) => answer !== null);
    exam();
    window.scrollTo(0, 0);
    if (focusFirst) focusAnswer(session.activeQuestions[next]);
  }

  function nextQuestion() {
    const next = nextAnswerIndex();
    if (next >= 0) focusAnswer(next);
    else switchPart(session.index + 1, true);
  }

  function showQuestionText(show) {
    main.querySelector("#question-images").hidden = show;
    main.querySelector("#question-text").hidden = !show;
    const toggle = main.querySelector('[data-action="question-text"]');
    toggle.setAttribute("aria-expanded", String(!show));
    toggle.textContent = show ? "原题图片" : "中英对照";
  }

  async function copyQuestion(bothLanguages) {
    const scene = session.scenes[session.index];
    const feedback = main.querySelector("#copy-feedback");
    try {
      await navigator.clipboard.writeText(questionText(scene, bothLanguages));
      feedback.textContent = bothLanguages ? "中英题目已复制" : "英文题目已复制";
    } catch {
      if (!feedback.isConnected) return;
      if (scene.pages) showQuestionText(true);
      main.querySelector("#question-text")?.focus();
      feedback.textContent = "可在对照区选中文字，再用复制快捷键。";
    }
  }

  function updateTimer() {
    const timer = document.querySelector("#timer");
    if (!timer || !session?.timed || session.submitted) return;
    const seconds = Math.max(0, Math.ceil((session.deadline - Date.now()) / 1000));
    timer.textContent = [Math.floor(seconds / 60), seconds % 60].map((x) => String(x).padStart(2, "0")).join(":");
    if (seconds === 0) finish();
  }

  function finish() {
    if (!session || session.submitted) return;
    session.submitted = true;
    if (dialog.open) dialog.close();
    for (const [i, scene] of session.scenes.entries()) {
      attempts[scene.id] = gradeScene(scene, session.answers[i]).filter((item) => item.correct === true).length;
    }
    try { localStorage.setItem("listening-attempts", JSON.stringify(attempts)); }
    catch { /* Practice results remain available in this tab. */ }
    go("results");
  }

  function results() {
    if (!session?.submitted) return library(true);
    let right = 0;
    let total = 0;
    const sections = session.scenes.map((scene, i) => {
      const grades = gradeScene(scene, session.answers[i]);
      const score = grades.filter((item) => item.correct === true).length;
      const count = grades.filter((item) => item.answer !== null).length;
      right += score;
      total += count;
      return `<details class="result" open><summary>Part ${scene.part} · ${escapeHtml(scene.zh)}　${score}/${count}</summary>
      <table><thead><tr><th scope="col">题号</th><th scope="col">你的答案</th><th scope="col">参考答案</th><th scope="col">结果</th></tr></thead><tbody>
      ${grades.map((row, j) => `<tr><td>Q${firstQuestion(scene)+j}</td><td>${escapeHtml(row.value || "—")}</td>
      <td>${escapeHtml(row.answer ?? "原资料未列")}</td><td class="${row.correct === null ? "" : row.correct ? "ok" : "bad"}">${row.correct === null ? "不计分" : row.correct ? "正确" : row.value.trim() ? "答错" : "未答"}</td></tr>`).join("")}
      </tbody></table></details>`;
    });
    const nextScene = session.timed ? null : bank[bank.indexOf(session.scenes[0]) + 1];
    main.innerHTML = `<div class="exam-top"><div><a class="back" href="#practice">← 练习题库</a><h1>练习结果</h1></div>
      <div class="dialog-actions"><button class="button secondary" data-action="retry">重做本组</button>
        ${nextScene ? `<button class="button primary" data-action="start" data-id="${nextScene.id}">下一场景</button>` : ""}</div></div>
      <div class="result-summary"><p>答对题数</p><h2>${right} / ${total}</h2><p>正确率 ${total ? Math.round(right / total * 100) : 0}%</p></div>${sections.join("")}`;
  }

  function view() {
    return location.hash.slice(1);
  }

  function render() {
    const route = view();
    const onAnswers = !["practice", "session", "results"].includes(route);
    document.querySelectorAll("[data-nav]").forEach((el) => {
      if (el.dataset.nav === (onAnswers ? "answers" : "practice")) el.setAttribute("aria-current", "page");
      else el.removeAttribute("aria-current");
    });
    if (route === "session") exam();
    else if (route === "results") results();
    else library(!onAnswers);
  }

  main.addEventListener("click", async (event) => {
    const el = event.target.closest("button[data-action]");
    if (!el) return;
    const action = el.dataset.action;
    const item = Number(el.dataset.item);
    const isPractice = view() === "practice";

    if (action === "filter") {
      ui.part = Number(el.dataset.part);
      ui.page = 0;
      main.querySelectorAll("button[data-part]").forEach((btn) => btn.setAttribute("aria-pressed", btn === el));
      sceneList(isPractice);
    } else if (action === "audio-only") {
      ui.audioOnly = !ui.audioOnly;
      ui.page = 0;
      el.setAttribute("aria-pressed", ui.audioOnly);
      sceneList(true);
    } else if (action === "prev-page" || action === "next-page") {
      ui.page += action === "prev-page" ? -1 : 1;
      sceneList(isPractice);
      document.querySelector("#library").scrollIntoView({ block: "start" });
    } else if (action === "expand") {
      ui.expanded = ui.expanded === el.dataset.id ? "" : el.dataset.id;
      sceneList(false);
      main.querySelector(`button[data-id="${el.dataset.id}"]`).focus({preventScroll:true});
    } else if (action === "start") {
      newSession([sceneById.get(el.dataset.id)], false);
    } else if (action === "mock") {
      newSession([1,2,3,4].map(randomScene), true);
    } else if (action === "part" || action === "next-part") {
      switchPart(action === "part" ? item : session.index + 1);
    } else if (action === "next-answer") {
      nextQuestion();
    } else if (action === "question-text") {
      showQuestionText(el.getAttribute("aria-expanded") === "true");
    } else if (action === "copy-question" || action === "copy-bilingual") {
      await copyQuestion(action === "copy-bilingual");
    } else if (action === "play") {
      const index = session.index;
      const audio = document.querySelector("#audio");
      el.disabled = true;
      try {
        await audio.play();
        session.audio[index].played = true;
        document.querySelector("#audio-status").textContent = "播放中";
      } catch {
        el.disabled = false;
        document.querySelector("#audio-status").textContent = "播放失败，请重试。";
      }
    } else if (action === "number") {
      focusAnswer(item);
    } else if (action === "flag") {
      const flags = session.flags[session.index];
      flags[item] = !flags[item];
      el.setAttribute("aria-pressed", flags[item]);
      showProgress();
    } else if (action === "key") {
      const showing = el.getAttribute("aria-expanded") === "true";
      for (const answer of main.querySelectorAll(".inline-key")) answer.hidden = showing;
      el.setAttribute("aria-expanded", String(!showing));
      el.textContent = showing ? "查看参考答案" : "收起参考答案";
    } else if (action === "submit") {
      const unanswered = session.scenes.reduce((sum, scene, i) =>
        sum + scene.answers.filter((a,j) => a !== null && !session.answers[i][j].trim()).length, 0);
      document.querySelector("#confirm-copy").textContent = unanswered
        ? `还有 ${unanswered} 道小题未作答。提交后可查看逐题对照。`
        : "提交后可查看得分和逐题对照。";
      dialog.returnValue = "";
      dialog.showModal();
    } else if (action === "retry") {
      newSession(session.scenes, session.timed);
    }
  });

  dialog.addEventListener("close", () => {
    if (dialog.returnValue === "submit") finish();
  });
  window.addEventListener("hashchange", () => {
    ui.page = 0;
    ui.search = "";
    render();
    window.scrollTo(0, 0);
  });
  setInterval(updateTimer, 300);
  render();
}

if (window.LISTENING_BANK) startListening(window.LISTENING_BANK, window.SCENE_DESCRIPTIONS);
