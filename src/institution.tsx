import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { MODULE_CATALOG } from "./moduleCatalog";

// Everything in this file is a front-end mock backed by localStorage (no backend, no real roles).

export function readJSON<T>(key: string, fallback: T): T {
  try {
    const saved = localStorage.getItem(key);
    return saved ? (JSON.parse(saved) as T) : fallback;
  } catch {
    return fallback;
  }
}

function useLS<T>(key: string, initial: T): [T, (value: T | ((previous: T) => T)) => void] {
  const [value, setValue] = useState<T>(() => readJSON(key, initial));
  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage unavailable */ }
  }, [key, value]);
  return [value, setValue];
}

function Panel({ title, subtitle, children, className = "" }: { title?: string; subtitle?: string; children: ReactNode; className?: string }) {
  return (
    <section className={`card ${className}`}>
      {(title || subtitle) && <div className="card-heading"><div>{title && <h2>{title}</h2>}{subtitle && <p>{subtitle}</p>}</div></div>}
      {children}
    </section>
  );
}

const sameModule = (a: string, b: string) => a.trim().replace(/\s+/g, " ").toLowerCase() === b.trim().replace(/\s+/g, " ").toLowerCase();

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

/* ---------- Support cases and psychologist booking (shared by student + institution) ---------- */

export type SupportCase = {
  id: string;
  studentId: string;
  studentName: string;
  moduleName: string;
  reason: string;
  status: "recommended" | "booked" | "declined";
  slotId?: string;
  createdAt: string;
};

const CASES_KEY = "learnloop-support-cases";
const SLOTS_KEY = "learnloop-psych-slots";
const TAKEN_SLOTS = new Set<string>();

type Slot = { id: string; label: string };

function buildSlots(): Slot[] {
  const slots: Slot[] = [];
  const day = new Date();
  let added = 0;
  while (added < 4) {
    day.setDate(day.getDate() + 1);
    if (day.getDay() === 0 || day.getDay() === 6) continue;
    const date = day.toISOString().slice(0, 10);
    const dayLabel = day.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
    for (const time of ["09:00", "11:00", "14:00", "16:00"]) slots.push({ id: `${date}T${time}`, label: `${dayLabel} · ${time}` });
    added += 1;
  }
  slots.forEach((slot, index) => { if (index % 5 === 1) TAKEN_SLOTS.add(slot.id); });
  return slots;
}

export function openSupportCase(student: { id: string; display_name: string }, moduleName: string) {
  const cases = readJSON<SupportCase[]>(CASES_KEY, []);
  if (cases.some((item) => item.studentId === student.id && item.status === "recommended")) return;
  cases.push({
    id: uid(),
    studentId: student.id,
    studentName: student.display_name,
    moduleName,
    reason: "Three consecutive tests below 50%",
    status: "recommended",
    createdAt: new Date().toISOString(),
  });
  localStorage.setItem(CASES_KEY, JSON.stringify(cases));
}

export function ConsultationCard({ student }: { student: { id: string; display_name: string } }) {
  const [cases, setCases] = useLS<SupportCase[]>(CASES_KEY, []);
  const [booked, setBooked] = useLS<Record<string, string>>(SLOTS_KEY, {});
  const slots = useMemo(buildSlots, []);
  const [slotId, setSlotId] = useState("");
  const [consent, setConsent] = useState(false);
  const mine = cases.filter((item) => item.studentId === student.id);
  const active = mine.find((item) => item.status === "recommended");
  const confirmed = [...mine].reverse().find((item) => item.status === "booked");
  const slotLabel = (id?: string) => slots.find((slot) => slot.id === id)?.label ?? id ?? "";

  function book(event: FormEvent) {
    event.preventDefault();
    if (!consent || !slotId || booked[slotId] || TAKEN_SLOTS.has(slotId)) return;
    setBooked((previous) => ({ ...previous, [slotId]: student.id }));
    setCases((previous) => {
      const target = previous.find((item) => item.studentId === student.id && item.status === "recommended");
      if (target) return previous.map((item) => item.id === target.id ? { ...item, status: "booked", slotId } : item);
      return [...previous, { id: uid(), studentId: student.id, studentName: student.display_name, moduleName: "—", reason: "Student requested a consultation", status: "booked", slotId, createdAt: new Date().toISOString() }];
    });
    setSlotId("");
    setConsent(false);
  }

  function decline() {
    setCases((previous) => previous.map((item) => item.studentId === student.id && item.status === "recommended" ? { ...item, status: "declined" } : item));
  }

  return (
    <Panel title="Confidential consultation" subtitle="Optional support with the institution's psychologist. Struggling with tests is common and not a diagnosis.">
      {active && (
        <div className="privacy-callout compact"><span className="privacy-large">◇</span><p>We noticed a few tough tests in a row. You are not in trouble. A private chat with the psychologist is available if you would like it. {active.moduleName !== "—" ? `(${active.moduleName})` : ""}</p></div>
      )}
      {confirmed && (
        <p className="success-line" role="status"><span>✓</span> Booked: {slotLabel(confirmed.slotId)} with the institution psychologist. A confirmation has been sent to you. Reply to it if you need to change the time.</p>
      )}
      <form className="form-stack" onSubmit={book}>
        <fieldset className="chip-fieldset">
          <legend>Available times</legend>
          <div className="chip-group">
            {slots.map((slot) => {
              const taken = TAKEN_SLOTS.has(slot.id) || !!booked[slot.id];
              return (
                <label key={slot.id} className={`chip ${slotId === slot.id ? "active" : ""} ${taken ? "chip-disabled" : ""}`}>
                  <input type="radio" name="slot" value={slot.id} disabled={taken} checked={slotId === slot.id} onChange={() => setSlotId(slot.id)} />
                  <span>{slot.label}{taken ? " · taken" : ""}</span>
                </label>
              );
            })}
          </div>
        </fieldset>
        <label className="check-line"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} /> I agree to share my name and this appointment with the psychologist. My wellbeing details stay private.</label>
        <div className="button-row">
          <button className="button button-primary" type="submit" disabled={!consent || !slotId}>Book consultation</button>
          {active && <button className="button button-quiet" type="button" onClick={decline}>Not now</button>}
        </div>
      </form>
    </Panel>
  );
}

/* ---------- Learning materials ---------- */

type Material = {
  id: string;
  module: string;
  title: string;
  kind: string;
  notes: string;
  fileName?: string;
  author: string;
  updatedAt: string;
  versions: Array<{ title: string; notes: string; at: string }>;
};
const KINDS = ["Lecture slides", "PDF", "Textbook", "Study guide", "Personal notes", "Explanation / example"];
const MATERIALS_KEY = "learnloop-materials";
const SEED_MATERIALS: Material[] = [
  { id: "seed-1", module: "Python Basics", title: "Variables and data types", kind: "Study guide", notes: "A variable is a named box for a value. Python works out the type (int, float, str, bool) from the value you store.", author: "Course team", updatedAt: "2026-01-20", versions: [] },
  { id: "seed-2", module: "Python Basics", title: "Loops cheat sheet", kind: "PDF", notes: "for loops walk through a collection; while loops repeat until a condition is false.", fileName: "loops-cheatsheet.pdf", author: "Course team", updatedAt: "2026-01-22", versions: [] },
];

export function ModuleNotesCard({ moduleName }: { moduleName: string }) {
  const items = readJSON<Material[]>(MATERIALS_KEY, SEED_MATERIALS).filter((item) => sameModule(item.module, moduleName) && item.notes);
  if (!items.length) return null;
  return (
    <Panel title="Notes from your lecturers" subtitle={`Shared learning notes for ${moduleName}.`}>
      <div className="material-list">
        {items.map((item) => <article key={item.id} className="material"><strong>{item.title}</strong><small>{item.kind} · {item.author}</small><p>{item.notes}</p></article>)}
      </div>
    </Panel>
  );
}

export function MaterialsPage({ staffName, modules, extraModules }: { staffName: string; modules: string[]; extraModules: string[] }) {
  const [materials, setMaterials] = useLS<Material[]>(MATERIALS_KEY, SEED_MATERIALS);
  const [moduleName, setModuleName] = useState(modules[0] ?? "Python Basics");
  const options = useMemo(() => Array.from(new Set([...modules, ...extraModules, ...MODULE_CATALOG])), [modules, extraModules]);
  const [editing, setEditing] = useState<string | null>(null);
  const [saved, setSaved] = useState("");
  const current = moduleName.trim();
  const list = materials.filter((item) => sameModule(item.module, current));

  function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const file = form.get("file");
    const fileName = file instanceof File && file.name ? file.name : undefined;
    const material: Material = {
      id: uid(),
      module: current,
      title: String(form.get("title") || "").trim(),
      kind: String(form.get("kind") || KINDS[0]),
      notes: String(form.get("notes") || "").trim(),
      fileName,
      author: staffName,
      updatedAt: new Date().toISOString().slice(0, 10),
      versions: [],
    };
    setMaterials((previous) => [...previous, material]);
    setSaved(`"${material.title}" was added to the ${current} notes.`);
    formElement.reset();
  }

  function update(event: FormEvent<HTMLFormElement>, id: string) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setMaterials((previous) => previous.map((item) => item.id === id ? {
      ...item,
      title: String(form.get("title") || item.title).trim(),
      notes: String(form.get("notes") || "").trim(),
      updatedAt: new Date().toISOString().slice(0, 10),
      versions: [...item.versions, { title: item.title, notes: item.notes, at: item.updatedAt }],
    } : item));
    setEditing(null);
  }

  return (
    <div className="content-grid" style={{ gridTemplateColumns: "minmax(0, 1fr)" }}>
      <Panel title="Contribute learning material" subtitle="Slides, PDFs, study guides, personal notes and your own explanations. They are added to the module's shared notes.">
        <form className="form-stack" onSubmit={add}>
          <div className="form-row">
            <label className="field">Module<input value={moduleName} onChange={(event) => setModuleName(event.target.value)} list="materials-catalog" required autoComplete="off" placeholder="Search or type a module name" /><datalist id="materials-catalog">{options.map((item) => <option key={item} value={item} />)}</datalist></label>
            <label className="field">Type<select name="kind" defaultValue={KINDS[0]}>{KINDS.map((item) => <option key={item}>{item}</option>)}</select></label>
          </div>
          <label className="field">Title<input name="title" required maxLength={150} placeholder="e.g. Recursion explained with examples" /></label>
          <label className="field">File <span className="optional-label">Optional</span><input name="file" type="file" /></label>
          <label className="field">Notes, explanation or insight<textarea name="notes" required rows={4} maxLength={4000} placeholder="Add your own explanation, example or tip for students." /></label>
          <button className="button button-primary" type="submit">Add to module notes</button>
          {saved && <p className="success-line" role="status"><span>✓</span> {saved}</p>}
        </form>
      </Panel>
      <Panel title={`${current} — shared notes (${list.length})`} subtitle="Everything below is available to enrolled students. Edits keep earlier versions.">
        <div className="material-list">
          {list.map((item) => (
            <article key={item.id} className="material">
              {editing === item.id ? (
                <form className="form-stack" onSubmit={(event) => update(event, item.id)}>
                  <label className="field">Title<input name="title" defaultValue={item.title} required maxLength={150} /></label>
                  <label className="field">Notes<textarea name="notes" defaultValue={item.notes} rows={4} maxLength={4000} /></label>
                  <div className="button-row"><button className="button button-primary button-small" type="submit">Save update</button><button className="button button-quiet button-small" type="button" onClick={() => setEditing(null)}>Cancel</button></div>
                </form>
              ) : (
                <>
                  <div className="material-head"><strong>{item.title}</strong><button type="button" className="text-button" onClick={() => setEditing(item.id)}>Edit / correct</button></div>
                  <small>{item.kind}{item.fileName ? ` · ${item.fileName}` : ""} · {item.author} · updated {item.updatedAt}{item.versions.length ? ` · ${item.versions.length} earlier version${item.versions.length > 1 ? "s" : ""} kept` : ""}</small>
                  {item.notes && <p>{item.notes}</p>}
                </>
              )}
            </article>
          ))}
          {!list.length && <p className="field-hint">No material yet for this module.</p>}
        </div>
      </Panel>
    </div>
  );
}

/* ---------- Teaching / specialisation ---------- */

export type TeachingEntry = { module: string; teaches: boolean; expert: boolean; support: boolean };
export const TEACHING_KEY = "learnloop-teaching";
export const SEED_TEACHING: TeachingEntry[] = [{ module: "Python Basics", teaches: true, expert: true, support: true }];

export function TeachingPage({
  entries,
  setEntries,
  extraModules,
}: {
  entries: TeachingEntry[];
  setEntries: (value: TeachingEntry[] | ((previous: TeachingEntry[]) => TeachingEntry[])) => void;
  extraModules: string[];
}) {
  const [name, setName] = useState("");
  const options = useMemo(() => Array.from(new Set([...extraModules, ...MODULE_CATALOG])), [extraModules]);

  function add(event: FormEvent) {
    event.preventDefault();
    const value = name.trim();
    if (!value || entries.some((item) => item.module.toLowerCase() === value.toLowerCase())) return;
    setEntries((previous) => [...previous, { module: value, teaches: true, expert: false, support: false }]);
    setName("");
  }
  const toggle = (module: string, key: "teaches" | "expert" | "support") =>
    setEntries((previous) => previous.map((item) => item.module === module ? { ...item, [key]: !item[key] } : item));

  return (
    <div className="content-grid modules-layout">
      <Panel title="Add a module" subtitle="Register modules you teach, specialise in, or are happy to support. You can change this at any time.">
        <form className="form-stack" onSubmit={add}>
          <label className="field">Module name<input value={name} onChange={(event) => setName(event.target.value)} list="teaching-catalog" autoComplete="off" placeholder="Search or type a module name" /><datalist id="teaching-catalog">{options.map((item) => <option key={item} value={item} />)}</datalist></label>
          <button className="button button-primary" type="submit" disabled={!name.trim()}>Add module</button>
        </form>
      </Panel>
      <Panel title={`Your modules (${entries.length})`} subtitle="You can only monitor students in these modules.">
        <div className="material-list">
          {entries.map((item) => (
            <article key={item.module} className="material">
              <div className="material-head"><strong>{item.module}</strong><button type="button" className="text-button" onClick={() => setEntries((previous) => previous.filter((entry) => entry.module !== item.module))}>Remove</button></div>
              <div className="check-row">
                <label className="check-line"><input type="checkbox" checked={item.teaches} onChange={() => toggle(item.module, "teaches")} /> I teach this</label>
                <label className="check-line"><input type="checkbox" checked={item.expert} onChange={() => toggle(item.module, "expert")} /> My specialisation</label>
                <label className="check-line"><input type="checkbox" checked={item.support} onChange={() => toggle(item.module, "support")} /> I can give guidance</label>
              </div>
            </article>
          ))}
          {!entries.length && <p className="field-hint">No modules yet. Add one to start monitoring students.</p>}
        </div>
      </Panel>
    </div>
  );
}

/* ---------- Monitoring (mock roster) ---------- */

type Test = { module: string; topic: string; score: number };
type RosterStudent = { id: string; name: string; tests: Test[]; assigned: number; missed: string[] };

const roster: RosterStudent[] = [
  { id: "s1", name: "Thandi Mokoena", assigned: 6, missed: [], tests: [{ module: "Python Basics", topic: "Loops", score: 72 }, { module: "Python Basics", topic: "Functions", score: 68 }, { module: "Python Basics", topic: "Lists", score: 81 }, { module: "Python Basics", topic: "Loops", score: 77 }] },
  { id: "s2", name: "Sipho Dlamini", assigned: 6, missed: ["What does range(3) return?", "Which loop runs at least once?"], tests: [{ module: "Python Basics", topic: "Variables", score: 55 }, { module: "Python Basics", topic: "Loops", score: 42 }, { module: "Python Basics", topic: "Loops", score: 38 }, { module: "Python Basics", topic: "Functions", score: 35 }] },
  { id: "s3", name: "Aisha Patel", assigned: 5, missed: ["Primary key vs foreign key", "What does JOIN do?"], tests: [{ module: "Databases", topic: "Keys", score: 45 }, { module: "Databases", topic: "Joins", score: 30 }, { module: "Databases", topic: "Joins", score: 40 }] },
  { id: "s4", name: "Pieter van Wyk", assigned: 5, missed: ["Big-O of binary search"], tests: [{ module: "Data Structures", topic: "Arrays", score: 88 }, { module: "Data Structures", topic: "Trees", score: 61 }, { module: "Data Structures", topic: "Sorting", score: 52 }] },
  { id: "s5", name: "Lerato Nkosi", assigned: 6, missed: ["Mutable vs immutable types"], tests: [{ module: "Python Basics", topic: "Variables", score: 90 }, { module: "Python Basics", topic: "Loops", score: 84 }] },
  { id: "s6", name: "Kabelo Mahlangu", assigned: 6, missed: ["Slicing a list", "What does append return?"], tests: [{ module: "Python Basics", topic: "Lists", score: 48 }, { module: "Python Basics", topic: "Lists", score: 52 }, { module: "Python Basics", topic: "Functions", score: 58 }] },
  { id: "s7", name: "Naledi Sithole", assigned: 4, missed: [], tests: [{ module: "Web Development", topic: "HTML", score: 79 }, { module: "Web Development", topic: "CSS", score: 83 }] },
  { id: "s8", name: "Ruan Botha", assigned: 4, missed: ["Flexbox vs grid"], tests: [{ module: "Web Development", topic: "CSS", score: 44 }, { module: "Web Development", topic: "JavaScript", score: 49 }, { module: "Web Development", topic: "JavaScript", score: 41 }] },
];

function analyse(student: RosterStudent, modules: string[]) {
  const tests = student.tests.filter((item) => modules.includes(item.module));
  if (!tests.length) return null;
  const average = Math.round(tests.reduce((sum, item) => sum + item.score, 0) / tests.length);
  const topics = new Map<string, number[]>();
  tests.forEach((item) => topics.set(item.topic, [...(topics.get(item.topic) ?? []), item.score]));
  const weak = [...topics].filter(([, scores]) => scores.reduce((a, b) => a + b, 0) / scores.length < 50).map(([topic]) => topic);
  let streak = 0;
  for (let index = tests.length - 1; index >= 0 && tests[index].score < 50; index -= 1) streak += 1;
  return { tests, average, completion: Math.round((tests.length / student.assigned) * 100), weak, streak };
}

export function MonitoringPage({ modules }: { modules: string[] }) {
  const rows = roster.flatMap((student) => {
    const info = analyse(student, modules);
    return info ? [{ student, ...info }] : [];
  });
  const needHelp = rows.filter((row) => row.streak >= 3 || row.average < 50);
  if (!modules.length) return <Panel><div className="empty-state"><h3>No modules selected</h3><p>You can only monitor students in modules you teach, specialise in or support. Add them on the Teaching page.</p></div></Panel>;

  return (
    <div className="content-grid" style={{ gridTemplateColumns: "minmax(0, 1fr)" }}>
      <Panel title="Students in your modules" subtitle={`Showing ${rows.length} student${rows.length === 1 ? "" : "s"} in ${modules.join(", ")}. Students in other modules are not shown.`}>
        <div className="stat-row">
          <div className="stat"><span>STUDENTS</span><strong>{rows.length}</strong></div>
          <div className="stat"><span>AVERAGE SCORE</span><strong>{rows.length ? Math.round(rows.reduce((sum, row) => sum + row.average, 0) / rows.length) : 0}%</strong></div>
          <div className="stat"><span>NEED SUPPORT</span><strong>{needHelp.length}</strong></div>
        </div>
        <div className="table-scroll">
          <table className="data-table">
            <thead><tr><th>Student</th><th>Average</th><th>Completed</th><th>Weak topics</th><th>Repeated mistakes</th><th>Status</th></tr></thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.student.id}>
                  <td><strong>{row.student.name}</strong><small>{row.tests.length} tests</small></td>
                  <td>{row.average}%</td>
                  <td>{row.completion}%</td>
                  <td>{row.weak.length ? row.weak.join(", ") : "—"}</td>
                  <td>{row.student.missed.length ? row.student.missed.join("; ") : "—"}</td>
                  <td>{row.streak >= 3 ? <span className="badge badge-gap">Support recommended</span> : row.average < 50 ? <span className="badge badge-gap">Needs intervention</span> : row.average < 65 ? <span className="badge badge-warn">Keep an eye</span> : <span className="badge badge-good">On track</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

/* ---------- Support cases (lecturer + support personnel view) ---------- */

export function SupportCasesPage({ modules }: { modules: string[] }) {
  const [cases, setCases] = useLS<SupportCase[]>(CASES_KEY, []);
  const [booked] = useLS<Record<string, string>>(SLOTS_KEY, {});
  const slots = useMemo(buildSlots, []);

  useEffect(() => {
    const seeded = roster.flatMap((student) => {
      const info = analyse(student, modules);
      return info && info.streak >= 3 ? [{ student, module: info.tests[info.tests.length - 1].module }] : [];
    });
    setCases((previous) => {
      const additions = seeded
        .filter(({ student }) => !previous.some((item) => item.studentId === student.id))
        .map(({ student, module }): SupportCase => ({ id: `seed-${student.id}`, studentId: student.id, studentName: student.name, moduleName: module, reason: "Three consecutive tests below 50%", status: "recommended", createdAt: new Date().toISOString() }));
      return additions.length ? [...previous, ...additions] : previous;
    });
  }, [modules, setCases]);

  const [staffView, setStaffView] = useState(false);
  const label = { recommended: "Consultation recommended", booked: "Consultation arranged", declined: "Student chose not to book" } as const;
  const appointments = Object.entries(booked).map(([slotId, studentId]) => ({ slotId, name: cases.find((item) => item.studentId === studentId)?.studentName ?? "Student", label: slots.find((slot) => slot.id === slotId)?.label ?? slotId }));

  return (
    <div className="content-grid modules-layout">
      <Panel title="Students flagged for support" subtitle="Triggered after three consecutive failed tests. This is a prompt to help, not a judgement or a diagnosis.">
        <div className="material-list">
          {cases.map((item) => (
            <article key={item.id} className="material">
              <div className="material-head"><strong>{item.studentName}</strong><span className={`badge ${item.status === "booked" ? "badge-good" : "badge-warn"}`}>{label[item.status]}</span></div>
              <small>{item.moduleName !== "—" ? `${item.moduleName} · ` : ""}{item.reason}</small>
              <p>Academic support: consider a check-in, extra practice or office hours. Wellbeing details are not shown here.</p>
            </article>
          ))}
          {!cases.length && <p className="field-hint">No students are currently flagged.</p>}
        </div>
      </Panel>
      <Panel title="Psychologist schedule" subtitle="Visible to authorised support personnel only. Lecturers see just that a consultation was arranged.">
        <label className="check-line"><input type="checkbox" checked={staffView} onChange={(event) => setStaffView(event.target.checked)} /> I am authorised student-support personnel</label>
        <div className="material-list">
          {staffView && appointments.map((item) => <article key={item.slotId} className="material"><strong>{item.label}</strong><small>{item.name} · confirmation sent to the student</small></article>)}
          {staffView && !appointments.length && <p className="field-hint">No consultations booked yet.</p>}
          {!staffView && <p className="field-hint">Appointment details are hidden to protect student confidentiality.</p>}
        </div>
      </Panel>
    </div>
  );
}
