const e = React.createElement;

const ink = {
  bg: "#14181F",
  surface: "#1B212B",
  border: "#2A323F",
  borderDashed: "#3A4250",
  text: "#EDEAE3",
  textDim: "#7C8494",
  accent: "#D9A441",
  danger: "#B5544B",
};

const serif = "'Iowan Old Style', 'Palatino Linotype', Georgia, 'Times New Roman', serif";
const sans = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
const STORAGE_KEY = "ledger-habits-v1";

// ---------- date / math helpers ----------

function dateKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function daysBetween(fromKey, toKey) {
  const [fy, fm, fd] = fromKey.split("-").map(Number);
  const [ty, tm, td] = toKey.split("-").map(Number);
  const a = new Date(fy, fm - 1, fd);
  const b = new Date(ty, tm - 1, td);
  return Math.round((b - a) / 86400000);
}

function buildGrid(completions) {
  const cells = [];
  for (let i = 34; i >= 0; i--) {
    const d = daysAgo(i);
    cells.push({ key: dateKey(d), isToday: i === 0, done: !!completions[dateKey(d)] });
  }
  return cells;
}

function streakFor(completions) {
  let cursor = new Date();
  if (!completions[dateKey(cursor)]) cursor = daysAgo(1);
  let n = 0;
  while (completions[dateKey(cursor)]) {
    n++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return n;
}

// Compounding target: base grown by rate% per day since the habit's start date, capped at `cap` if set.
function computeTarget(habit, dayIndex) {
  if (!habit.base) return null;
  const rate = habit.rate || 0;
  const raw = habit.base * Math.pow(1 + rate / 100, Math.max(dayIndex, 0));
  const capped = habit.cap != null && raw >= habit.cap;
  const value = habit.cap != null ? Math.min(raw, habit.cap) : raw;
  return { value: Math.round(value), capped };
}

function currentDayIndex(habit) {
  return Math.max(daysBetween(habit.startDate, dateKey(new Date())), 0);
}

function monthPrefixOf(dateStr) {
  return dateStr.slice(0, 7);
}

function completedThisMonth(habit, prefix) {
  return Object.keys(habit.completions).filter((k) => habit.completions[k] && k.startsWith(prefix)).length;
}

function possibleDaysThisMonth(habit, monthStartKey, todayKey) {
  const effectiveStart = habit.startDate > monthStartKey ? habit.startDate : monthStartKey;
  if (effectiveStart > todayKey) return 0;
  return daysBetween(effectiveStart, todayKey) + 1;
}

function emptyForm() {
  return { id: null, name: "", base: "", unit: "", rate: "1", cap: "", startDate: dateKey(new Date()) };
}

function loadHabits() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

// ---------- small chart components ----------

function Donut({ doneSum, remainingSum, pct }) {
  const size = 140;
  const cx = size / 2;
  const cy = size / 2;
  const r = 60;
  const strokeWidth = 16;
  const circumference = 2 * Math.PI * r;
  const total = doneSum + remainingSum;
  const doneFrac = total > 0 ? doneSum / total : 0;

  return e(
    "div",
    { style: { position: "relative", width: size, height: size } },
    e(
      "svg",
      { width: size, height: size, viewBox: `0 0 ${size} ${size}` },
      e(
        "g",
        { transform: `rotate(-90 ${cx} ${cy})` },
        e("circle", { cx, cy, r, fill: "none", stroke: ink.border, strokeWidth }),
        doneFrac > 0 &&
          e("circle", {
            cx,
            cy,
            r,
            fill: "none",
            stroke: ink.accent,
            strokeWidth,
            strokeLinecap: "round",
            strokeDasharray: `${doneFrac * circumference} ${circumference}`,
          })
      )
    ),
    e(
      "div",
      {
        style: {
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        },
      },
      e("div", { style: { fontFamily: serif, fontSize: 26, color: ink.accent, lineHeight: 1 } }, `${pct}%`),
      e("div", { style: { fontSize: 10, color: ink.textDim, marginTop: 2 } }, "completed")
    )
  );
}

function MiniBarChart({ data }) {
  const maxValue = Math.max(...data.map((d) => d.count), 1);
  const scaleMax = Math.max(maxValue + 1, 4);

  return e(
    "div",
    { style: { display: "flex", flexDirection: "column" } },
    e(
      "div",
      { style: { display: "flex", alignItems: "flex-end", gap: 10, height: 150 } },
      data.map((d) =>
        e(
          "div",
          {
            key: d.name,
            style: { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", height: "100%" },
          },
          e("div", { style: { fontSize: 11, color: ink.text, marginBottom: 4 } }, String(d.count)),
          e("div", {
            style: {
              width: "70%",
              minHeight: 2,
              height: `${(d.count / scaleMax) * 100}%`,
              background: ink.accent,
              borderRadius: "4px 4px 0 0",
              transition: "height 200ms ease",
            },
          })
        )
      )
    ),
    e(
      "div",
      { style: { display: "flex", gap: 10, marginTop: 8 } },
      data.map((d) =>
        e(
          "div",
          { key: `${d.name}-label`, style: { flex: 1, textAlign: "center", fontSize: 11, color: ink.textDim, wordBreak: "break-word" } },
          d.name
        )
      )
    )
  );
}

// ---------- main app ----------

function App() {
  const [habits, setHabits] = React.useState(loadHabits);
  const [form, setForm] = React.useState(null);
  const [err, setErr] = React.useState("");

  React.useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(habits));
    } catch {
      setErr("Couldn't save. Storage may be full.");
      setTimeout(() => setErr(""), 2500);
    }
  }, [habits]);

  function openAdd() {
    setForm(emptyForm());
  }

  function openEdit(h) {
    setForm({
      id: h.id,
      name: h.name,
      base: h.base ?? "",
      unit: h.unit ?? "",
      rate: h.rate ?? 0,
      cap: h.cap ?? "",
      startDate: h.startDate,
    });
  }

  function saveForm() {
    const name = form.name.trim();
    if (!name) return;
    const base = form.base === "" ? null : Number(form.base);
    const cap = form.cap === "" ? null : Number(form.cap);
    if (base != null && cap != null && cap < base) {
      setErr("End point should be greater than the starting amount.");
      setTimeout(() => setErr(""), 3000);
      return;
    }
    const rate = form.rate === "" ? 0 : Number(form.rate);
    const unit = form.unit.trim();

    if (form.id == null) {
      const habit = {
        id: Date.now().toString(),
        name,
        base,
        unit,
        rate,
        cap,
        startDate: form.startDate || dateKey(new Date()),
        completions: {},
      };
      setHabits([...habits, habit]);
    } else {
      setHabits(
        habits.map((h) =>
          h.id === form.id ? { ...h, name, base, unit, rate, cap, startDate: form.startDate || h.startDate } : h
        )
      );
    }
    setForm(null);
  }

  function toggleDay(habitId, key) {
    setHabits(
      habits.map((h) => {
        if (h.id !== habitId) return h;
        const completions = { ...h.completions };
        if (completions[key]) delete completions[key];
        else completions[key] = true;
        return { ...h, completions };
      })
    );
  }

  function removeHabit(id) {
    if (!window.confirm("Remove this habit and its history?")) return;
    setHabits(habits.filter((h) => h.id !== id));
    if (form && form.id === id) setForm(null);
  }

  const todayKey = dateKey(new Date());
  const todayLabel = new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
  const monthPrefix = monthPrefixOf(todayKey);
  const monthStartKey = `${monthPrefix}-01`;
  const monthLabel = new Date().toLocaleDateString(undefined, { month: "long", year: "numeric" });

  const barData = habits.map((h) => ({ name: h.name, count: completedThisMonth(h, monthPrefix) }));
  let doneSum = 0;
  let possibleSum = 0;
  habits.forEach((h) => {
    doneSum += completedThisMonth(h, monthPrefix);
    possibleSum += possibleDaysThisMonth(h, monthStartKey, todayKey);
  });
  const monthPct = possibleSum > 0 ? Math.round((doneSum / possibleSum) * 100) : 0;
  const remainingSum = Math.max(possibleSum - doneSum, 0);

  const inputStyle = {
    background: ink.bg,
    border: `1px solid ${ink.border}`,
    borderRadius: 5,
    color: ink.text,
    fontFamily: sans,
    fontSize: 14,
    padding: "8px 10px",
    outline: "none",
    width: "100%",
    boxSizing: "border-box",
  };

  return e(
    "div",
    { style: { background: ink.bg, minHeight: "100vh", fontFamily: sans, color: ink.text, padding: "28px 18px 60px" } },
    e(
      "div",
      { style: { maxWidth: 440, margin: "0 auto" } },

      // header
      e(
        "div",
        { style: { marginBottom: 26 } },
        e("div", { style: { fontFamily: serif, fontSize: 26, fontWeight: 600, letterSpacing: 0.2 } }, "Ledger"),
        e("div", { style: { color: ink.textDim, fontSize: 13, marginTop: 2 } }, todayLabel)
      ),

      habits.length === 0 &&
        !form &&
        e(
          "div",
          { style: { color: ink.textDim, fontSize: 14, lineHeight: 1.6, marginBottom: 20 } },
          "No entries yet. Add a habit below and mark today's square once it's done."
        ),

      // habit list
      e(
        "div",
        { style: { display: "flex", flexDirection: "column", gap: 14 } },
        habits.map((h) => {
          const grid = buildGrid(h.completions);
          const streak = streakFor(h.completions);
          const dayIndex = currentDayIndex(h);
          const target = computeTarget(h, dayIndex);
          const nextTarget = computeTarget(h, dayIndex + 1);

          return e(
            "div",
            { key: h.id, style: { background: ink.surface, border: `1px solid ${ink.border}`, borderRadius: 8, padding: "14px 14px 16px" } },

            e(
              "div",
              { style: { display: "flex", justifyContent: "space-between", alignItems: "flex-start" } },
              e("div", { style: { fontFamily: serif, fontSize: 17, fontWeight: 600, paddingRight: 8 } }, h.name),
              e(
                "div",
                { style: { display: "flex", alignItems: "center", gap: 12, flexShrink: 0 } },
                e(
                  "button",
                  {
                    onClick: () => openEdit(h),
                    style: { background: "none", border: "none", color: ink.textDim, fontSize: 14, cursor: "pointer", padding: 2 },
                    "aria-label": `Edit ${h.name}`,
                  },
                  "\u270E"
                ),
                e(
                  "button",
                  {
                    onClick: () => removeHabit(h.id),
                    style: { background: "none", border: "none", color: ink.textDim, fontSize: 16, cursor: "pointer", padding: 2, lineHeight: 1 },
                    "aria-label": `Remove ${h.name}`,
                  },
                  "\u00D7"
                )
              )
            ),

            e(
              "div",
              { style: { display: "flex", justifyContent: "space-between", alignItems: "flex-end", margin: "6px 0 12px" } },
              e(
                "div",
                null,
                target &&
                  e(
                    "div",
                    { style: { color: ink.accent, fontSize: 13, fontWeight: 600 } },
                    `${target.value}${h.unit ? ` ${h.unit}` : ""} today${target.capped ? " \u00B7 at cap" : ""}`
                  ),
                target &&
                  target.capped &&
                  e("div", { style: { color: ink.textDim, fontSize: 11, marginTop: 2 } }, `Capped at ${h.cap}${h.unit ? ` ${h.unit}` : ""}`),
                target &&
                  !target.capped &&
                  h.rate > 0 &&
                  e(
                    "div",
                    { style: { color: ink.textDim, fontSize: 11, marginTop: 2 } },
                    `Tomorrow: ${nextTarget.value}${h.unit ? ` ${h.unit}` : ""}${nextTarget.capped ? " (cap reached)" : ""}`
                  )
              ),
              e(
                "div",
                { style: { textAlign: "right", flexShrink: 0 } },
                e("div", { style: { fontFamily: serif, fontSize: 22, color: ink.accent, lineHeight: 1 } }, String(streak)),
                e("div", { style: { fontSize: 11, color: ink.textDim } }, streak === 1 ? "day" : "days")
              )
            ),

            e(
              "div",
              { style: { display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 } },
              grid.map((c) =>
                e("button", {
                  key: c.key,
                  onClick: () => toggleDay(h.id, c.key),
                  "aria-label": c.key,
                  style: {
                    aspectRatio: "1",
                    borderRadius: 3,
                    border: c.isToday ? `1.5px solid ${ink.accent}` : `1px solid ${ink.border}`,
                    background: c.done ? ink.accent : "transparent",
                    cursor: "pointer",
                    padding: 0,
                    transition: "transform 120ms ease, background 120ms ease",
                  },
                })
              )
            )
          );
        })
      ),

      // monthly summary
      habits.length > 0 &&
        e(
          "div",
          { style: { background: ink.surface, border: `1px solid ${ink.border}`, borderRadius: 8, padding: "16px 14px", marginTop: 18 } },
          e(
            "div",
            { style: { display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 14 } },
            e("div", { style: { fontFamily: serif, fontSize: 17, fontWeight: 600 } }, "This month"),
            e("div", { style: { color: ink.textDim, fontSize: 12 } }, monthLabel)
          ),
          e(
            "div",
            { style: { display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 18 } },
            e(Donut, { doneSum, remainingSum, pct: monthPct }),
            e(
              "div",
              { style: { display: "flex", gap: 16, marginTop: 10 } },
              e(
                "div",
                { style: { display: "flex", alignItems: "center", gap: 6 } },
                e("span", { style: { width: 8, height: 8, borderRadius: 2, background: ink.accent, display: "inline-block" } }),
                e("span", { style: { fontSize: 11, color: ink.textDim } }, `Done (${doneSum})`)
              ),
              e(
                "div",
                { style: { display: "flex", alignItems: "center", gap: 6 } },
                e("span", { style: { width: 8, height: 8, borderRadius: 2, background: ink.border, display: "inline-block" } }),
                e("span", { style: { fontSize: 11, color: ink.textDim } }, `Remaining (${remainingSum})`)
              )
            )
          ),
          e(MiniBarChart, { data: barData })
        ),

      // add / edit form
      e(
        "div",
        { style: { marginTop: 14 } },
        form
          ? e(
              "div",
              { style: { background: ink.surface, border: `1px solid ${ink.border}`, borderRadius: 8, padding: 14, display: "flex", flexDirection: "column", gap: 8 } },
              e("input", {
                autoFocus: true,
                value: form.name,
                onChange: (ev) => setForm({ ...form, name: ev.target.value }),
                placeholder: "Habit name",
                style: inputStyle,
              }),
              e("input", {
                type: "date",
                value: form.startDate,
                onChange: (ev) => setForm({ ...form, startDate: ev.target.value }),
                style: inputStyle,
              }),
              e(
                "div",
                { style: { display: "flex", gap: 8 } },
                e("input", {
                  value: form.base,
                  onChange: (ev) => setForm({ ...form, base: ev.target.value }),
                  placeholder: "Start",
                  inputMode: "decimal",
                  style: inputStyle,
                }),
                e("input", {
                  value: form.unit,
                  onChange: (ev) => setForm({ ...form, unit: ev.target.value }),
                  placeholder: "Unit",
                  style: inputStyle,
                })
              ),
              e(
                "div",
                { style: { display: "flex", gap: 8 } },
                e("input", {
                  value: form.rate,
                  onChange: (ev) => setForm({ ...form, rate: ev.target.value }),
                  placeholder: "Growth %/day",
                  inputMode: "decimal",
                  style: inputStyle,
                }),
                e("input", {
                  value: form.cap,
                  onChange: (ev) => setForm({ ...form, cap: ev.target.value }),
                  placeholder: "End point",
                  inputMode: "decimal",
                  style: inputStyle,
                })
              ),
              e(
                "div",
                { style: { color: ink.textDim, fontSize: 11, lineHeight: 1.5 } },
                "Leave start blank for a plain checkbox habit. Otherwise the target grows by the given % each day until it reaches the end point."
              ),
              e(
                "div",
                { style: { display: "flex", gap: 10, marginTop: 2 } },
                e(
                  "button",
                  {
                    onClick: saveForm,
                    style: { background: ink.accent, border: "none", color: ink.bg, borderRadius: 5, padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" },
                  },
                  "Save"
                ),
                e(
                  "button",
                  { onClick: () => setForm(null), style: { background: "none", border: "none", color: ink.textDim, fontSize: 13, cursor: "pointer" } },
                  "Cancel"
                )
              )
            )
          : e(
              "button",
              {
                onClick: openAdd,
                style: {
                  width: "100%",
                  background: "none",
                  border: `1px dashed ${ink.borderDashed}`,
                  borderRadius: 8,
                  padding: "13px 14px",
                  color: ink.textDim,
                  fontFamily: sans,
                  fontSize: 14,
                  cursor: "pointer",
                  textAlign: "left",
                },
              },
              "+ New habit"
            )
      ),

      err && e("div", { style: { marginTop: 12, color: ink.danger, fontSize: 12 } }, err)
    )
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(e(App));
