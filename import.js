"use strict";

const picker = document.querySelector("#bank-directory");
const feedback = document.querySelector("#import-feedback");
const hasStrings = (items) => Array.isArray(items) && items.every((item) => typeof item === "string");
const isScene = (scene) => scene && Number.isInteger(scene.part) && scene.part >= 1 && scene.part <= 4 &&
  new RegExp("^P" + scene.part + "-[0-9]{3}$").test(scene.id) &&
  typeof scene.zh === "string" && typeof scene.en === "string" &&
  Number.isInteger(scene.pages) && scene.pages >= 0 && scene.pages <= 20 &&
  typeof scene.audio === "boolean" && hasStrings(scene.clues) && scene.clues.length === 10 &&
  Array.isArray(scene.answers) && scene.answers.length === 10 &&
  scene.answers.every((key) => key === null || typeof key === "string") &&
  [scene.source, scene.notes, scene.aliases].every(hasStrings) &&
  Array.isArray(scene.variants) && scene.variants.every((v) => v && typeof v.label === "string" &&
    v.diff && typeof v.diff === "object" && Object.values(v.diff).every((answer) => typeof answer === "string")) &&
  Array.isArray(scene.multi) && scene.multi.every((group) => Array.isArray(group) &&
    group.every((n) => Number.isInteger(n) && n > (scene.part - 1) * 10 && n <= scene.part * 10));

picker.addEventListener("change", async () => {
  const chosen = [...picker.files];
  if (!chosen.length) return;
  picker.disabled = true;
  feedback.textContent = "正在读取题库文件…";
  try {
    const indexes = chosen.filter((file) => file.name === "bank.json");
    if (indexes.length !== 1) throw new Error("请选择解压后的 IELTS-Listening-Bank 文件夹。");
    const index = indexes[0];
    const parent = index.webkitRelativePath.slice(0, -"bank.json".length);
    const files = new Map(chosen.filter((file) => file.webkitRelativePath.startsWith(parent))
      .map((file) => [file.webkitRelativePath.slice(parent.length), file]));
    const { version, bank, descriptions } = JSON.parse(await index.text());
    if (version !== 1 || !Array.isArray(bank) || bank.length !== 339 ||
        !bank.every(isScene) || new Set(bank.map((scene) => scene.id)).size !== bank.length ||
        !descriptions || bank.some((scene) => typeof descriptions[scene.id] !== "string")) {
      throw new Error("题库文件格式不正确。请重新解压题库包。");
    }
    const paths = ["questions/extra-bay-view.webp"];
    for (const scene of bank) {
      if (scene.audio) paths.push("audio/" + scene.id + ".ogg");
      for (let i = 1; i <= scene.pages; i++) paths.push(`questions/${scene.id}-${i}.webp`);
    }
    if (paths.some((p) => !files.get(p)?.size)) {
      throw new Error("题库文件夹里缺少音频或题图。请完整解压后再选。");
    }
    const urls = new Map();
    const localUrl = (relative) => {
      if (!urls.has(relative)) urls.set(relative, URL.createObjectURL(files.get(relative)));
      return urls.get(relative);
    };
    document.body.classList.remove("import-mode");
    startListening(bank, descriptions, localUrl);
  } catch (error) {
    feedback.textContent = error instanceof SyntaxError ? "题库文件无法读取。请重新解压题库包。" : error.message;
    picker.value = "";
    picker.disabled = false;
  }
});
