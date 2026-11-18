"use strict";

function normalizeAnswer(text) {
  return String(text ?? "").normalize("NFKC").toLowerCase()
    .replace(/[’‘]/g, "'").replace(/[‐‑–—]/g, "-")
    .replace(/(?<=\d),(?=\d{3}(?:\D|$))/g, "")
    .replace(/\s+/g, " ").trim().replace(/[.!。]+$/, "");
}

function matchesAnswer(input, expected) {
  const value = normalizeAnswer(input);
  const key = normalizeAnswer(expected);
  if (!value || !key) return false;
  if (value === key) return true;

  // IELTS keys supply optional words in parentheses.
  if (key.includes("(")) {
    const without = normalizeAnswer(key.replace(/\([^)]*\)/g, ""));
    const withWords = normalizeAnswer(key.replace(/[()]/g, ""));
    return value === without || value === withWords;
  }
  // Two highlighted terms in the source are displayed with a slash.
  if (key.includes(" / ")) return value === key.replace(" / ", " ");
  return false;
}

function gradeScene(scene, entries) {
  const results = scene.answers.map((answer, index) => {
    const value = entries[index] ?? "";
    return { answer, value, correct: answer === null ? null : matchesAnswer(value, answer) };
  });
  const first = (scene.part - 1) * 10 + 1;
  for (const group of scene.multi) {
    const indexes = group.map((n) => n - first);
    const available = indexes.map((i) => normalizeAnswer(scene.answers[i]));
    for (const i of indexes) {
      const answerIndex = available.indexOf(normalizeAnswer(entries[i]));
      results[i].correct = answerIndex !== -1;
      if (answerIndex !== -1) available.splice(answerIndex, 1);
    }
  }
  return results;
}
