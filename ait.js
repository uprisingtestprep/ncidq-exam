/* NCIDQ Bonus AIT (Alternative Item Type) Practice — Application Logic
 *
 * Models the real IDIX exam's newer interactive item types (drag-and-drop
 * sequencing, hot spot) as a self-contained bonus practice mode, separate
 * from the main timed MCQ exam so it can never affect that flow's state.
 *
 * Reordering uses tap-to-move up/down buttons rather than native HTML5
 * drag-and-drop, since HTML5 drag events do not fire reliably on iOS/Android
 * touch devices — the same lesson applied elsewhere in this project's
 * interactive question types.
 */

let aitQuestions = [];
let aitState = { current: 0, answers: {} }; // answers[id] = {checked, correct, order?, zone?}

document.addEventListener("DOMContentLoaded", () => {
  aitQuestions = (window.AIT_QUESTIONS || []).slice();

  const launchBtn = document.getElementById("ait-launch-btn");
  if (launchBtn) {
    launchBtn.addEventListener("click", () => {
      document.getElementById("access-gate").style.display = "none";
      document.getElementById("ait-app").style.display = "block";
      aitState = { current: 0, answers: {} };
      renderAitQuestion();
    });
  }

  const exitBtn = document.getElementById("ait-exit-btn");
  if (exitBtn) exitBtn.addEventListener("click", exitAitPractice);

  const resExitBtn = document.getElementById("ait-res-exit-btn");
  if (resExitBtn) resExitBtn.addEventListener("click", exitAitPractice);

  const resRestartBtn = document.getElementById("ait-res-restart-btn");
  if (resRestartBtn) {
    resRestartBtn.addEventListener("click", () => {
      document.getElementById("ait-results-screen").style.display = "none";
      document.getElementById("ait-app").style.display = "block";
      aitState = { current: 0, answers: {} };
      renderAitQuestion();
    });
  }

  document.getElementById("ait-prev-btn").addEventListener("click", () => {
    if (aitState.current > 0) {
      aitState.current -= 1;
      renderAitQuestion();
    }
  });
  document.getElementById("ait-next-btn").addEventListener("click", () => {
    if (aitState.current < aitQuestions.length - 1) {
      aitState.current += 1;
      renderAitQuestion();
    } else {
      showAitResults();
    }
  });
  document.getElementById("ait-check-btn").addEventListener("click", checkAitAnswer);
});

function exitAitPractice() {
  document.getElementById("ait-app").style.display = "none";
  document.getElementById("ait-results-screen").style.display = "none";
  document.getElementById("access-gate").style.display = "flex";
}

function domainLabelSafe(key) {
  return (typeof domainLabel === "function") ? domainLabel(key) : (key || "");
}

function renderAitQuestion() {
  const q = aitQuestions[aitState.current];
  const total = aitQuestions.length;

  document.getElementById("ait-q-counter").textContent = `Question ${aitState.current + 1} of ${total}`;
  document.getElementById("ait-q-domain").textContent = domainLabelSafe(q.domain);
  document.getElementById("ait-q-type-tag").textContent =
    q.type === "ordering" ? "Sequencing" : "Hot Spot";
  document.getElementById("ait-progress-bar").style.width =
    `${((aitState.current + 1) / total) * 100}%`;
  document.getElementById("ait-prompt-text").textContent = q.prompt;

  const explBox = document.getElementById("ait-explanation-box");
  explBox.style.display = "none";

  const body = document.getElementById("ait-question-body");
  body.innerHTML = "";

  if (q.type === "ordering") {
    renderOrderingQuestion(q, body);
  } else if (q.type === "hotspot") {
    renderHotspotQuestion(q, body);
  }

  // Restore prior check state if this question was already answered/checked
  const prior = aitState.answers[q.id];
  if (prior && prior.checked) {
    showAitExplanation(q, prior.correct);
  }

  document.getElementById("ait-prev-btn").disabled = aitState.current === 0;
  document.getElementById("ait-next-btn").textContent =
    aitState.current === total - 1 ? "Finish" : "Next →";
}

/* ── Ordering (tap-to-reorder sequencing) ─────────────────────────────── */

function renderOrderingQuestion(q, container) {
  const prior = aitState.answers[q.id];
  // currentOrder is a list of indices into q.items representing the
  // candidate's current arrangement; starts as the given shuffled order.
  const currentOrder = (prior && prior.order) ? prior.order.slice()
    : q.items.map((_, i) => i);

  const list = document.createElement("div");
  list.className = "ait-order-list";

  function draw() {
    list.innerHTML = "";
    currentOrder.forEach((itemIdx, pos) => {
      const row = document.createElement("div");
      row.className = "ait-order-row";

      const num = document.createElement("span");
      num.className = "ait-order-num";
      num.textContent = (pos + 1) + ".";

      const label = document.createElement("span");
      label.className = "ait-order-label";
      label.textContent = q.items[itemIdx];

      const controls = document.createElement("span");
      controls.className = "ait-order-controls";

      const upBtn = document.createElement("button");
      upBtn.className = "ait-order-btn";
      upBtn.textContent = "↑";
      upBtn.setAttribute("aria-label", "Move up");
      upBtn.disabled = pos === 0;
      upBtn.addEventListener("click", () => {
        [currentOrder[pos - 1], currentOrder[pos]] = [currentOrder[pos], currentOrder[pos - 1]];
        aitState.answers[q.id] = { ...(aitState.answers[q.id] || {}), order: currentOrder.slice(), checked: false };
        draw();
      });

      const downBtn = document.createElement("button");
      downBtn.className = "ait-order-btn";
      downBtn.textContent = "↓";
      downBtn.setAttribute("aria-label", "Move down");
      downBtn.disabled = pos === currentOrder.length - 1;
      downBtn.addEventListener("click", () => {
        [currentOrder[pos + 1], currentOrder[pos]] = [currentOrder[pos], currentOrder[pos + 1]];
        aitState.answers[q.id] = { ...(aitState.answers[q.id] || {}), order: currentOrder.slice(), checked: false };
        draw();
      });

      controls.appendChild(upBtn);
      controls.appendChild(downBtn);
      row.appendChild(num);
      row.appendChild(label);
      row.appendChild(controls);
      list.appendChild(row);
    });
  }

  draw();
  container.appendChild(list);

  const hint = document.createElement("p");
  hint.className = "ait-hint";
  hint.textContent = "Use the arrows to put the steps in order, first to last.";
  container.appendChild(hint);

  if (!aitState.answers[q.id]) {
    aitState.answers[q.id] = { order: currentOrder.slice(), checked: false };
  }
}

/* ── Hot Spot (click the correct region) ──────────────────────────────── */

function renderHotspotQuestion(q, container) {
  const wrap = document.createElement("div");
  wrap.className = "ait-hotspot-wrap";

  const imgBox = document.createElement("div");
  imgBox.className = "ait-hotspot-imgbox";

  const img = document.createElement("img");
  img.className = "ait-hotspot-img";
  img.src = q.image;
  img.alt = q.prompt;
  imgBox.appendChild(img);

  const prior = aitState.answers[q.id];
  const selectedZone = prior ? prior.zone : null;

  Object.entries(q.zones).forEach(([zoneKey, z]) => {
    const marker = document.createElement("div");
    marker.className = "ait-hotspot-zone";
    marker.style.left = z.left + "%";
    marker.style.top = z.top + "%";
    marker.style.width = z.width + "%";
    marker.style.height = z.height + "%";
    if (selectedZone === zoneKey) marker.classList.add("ait-zone-selected");
    marker.addEventListener("click", () => {
      aitState.answers[q.id] = { zone: zoneKey, checked: false };
      imgBox.querySelectorAll(".ait-hotspot-zone").forEach(m => m.classList.remove("ait-zone-selected"));
      marker.classList.add("ait-zone-selected");
    });
    imgBox.appendChild(marker);
  });

  wrap.appendChild(imgBox);
  container.appendChild(wrap);

  const hint = document.createElement("p");
  hint.className = "ait-hint";
  hint.textContent = "Click or tap directly on the region that answers the prompt above.";
  container.appendChild(hint);

  if (!aitState.answers[q.id]) {
    aitState.answers[q.id] = { zone: null, checked: false };
  }
}

/* ── Checking / scoring ───────────────────────────────────────────────── */

function checkAitAnswer() {
  const q = aitQuestions[aitState.current];
  const ans = aitState.answers[q.id] || {};
  let correct = false;

  if (q.type === "ordering") {
    const order = ans.order || q.items.map((_, i) => i);
    correct = JSON.stringify(order) === JSON.stringify(q.correct_order);
  } else if (q.type === "hotspot") {
    correct = ans.zone === q.correct_zone;
  }

  aitState.answers[q.id] = { ...ans, checked: true, correct };
  showAitExplanation(q, correct);
}

function showAitExplanation(q, correct) {
  const box = document.getElementById("ait-explanation-box");
  const label = box.querySelector(".explanation-label");
  const text = document.getElementById("ait-explanation-text");
  label.textContent = correct ? "Correct" : "Not Quite";
  label.style.color = correct ? "var(--pass)" : "var(--fail)";
  text.textContent = q.explanation;
  box.style.display = "block";
}

function showAitResults() {
  const total = aitQuestions.length;
  let correctCount = 0;
  aitQuestions.forEach(q => {
    const a = aitState.answers[q.id];
    if (a && a.checked && a.correct) correctCount += 1;
  });
  document.getElementById("ait-app").style.display = "none";
  document.getElementById("ait-results-screen").style.display = "flex";
  document.getElementById("ait-res-score").textContent =
    `${correctCount} of ${total} correct (${Math.round((correctCount / total) * 100)}%)`;
}
