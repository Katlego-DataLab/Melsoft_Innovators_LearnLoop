import {
  CSSProperties,
  FormEvent,
  ReactNode,
  SetStateAction,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  API_DOCS_URL,
  api,
  ApiError,
  Attempt,
  GammaJob,
  Insights,
  Module,
  Progress,
  Quiz,
  Student,
  StudyPlan,
} from "./api";

type Role = "Student" | "Lecturer" | "Admin";
type Page =
  | "Profile"
  | "Study"
  | "Quiz"
  | "Results"
  | "Study plan"
  | "Re-test"
  | "Progress"
  | "Wellbeing"
  | "Insights"
  | "Modules";
type Connection = "checking" | "connected" | "demo";
type ProfileDetails = {
  studentNumber: string;
  institution: string;
  qualification: string;
  year: string;
  moduleIds: string[];
};
type StoredQuizAnswers = Record<string, number>;
type ScoreStyle = CSSProperties & { "--score": string };

const SEED_MODULE: Module = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Python Basics",
  code: "PY101",
  course: "Computer Science",
};
const STUDENT_NAV: Array<{ page: Page; note?: string }> = [
  { page: "Profile" },
  { page: "Study" },
  { page: "Quiz", note: "Assessment" },
  { page: "Results" },
  { page: "Study plan" },
  { page: "Re-test" },
  { page: "Progress" },
  { page: "Wellbeing" },
];
const ROLE_NAV: Record<Exclude<Role, "Student">, Page[]> = {
  Lecturer: ["Insights"],
  Admin: ["Modules"],
};

function useStored<T>(
  key: string,
  initialValue: T,
): [T, (value: SetStateAction<T>) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const saved = localStorage.getItem(key);
      return saved ? (JSON.parse(saved) as T) : initialValue;
    } catch {
      return initialValue;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Storage may be unavailable in private browsing; the in-memory app still works.
    }
  }, [key, value]);
  return [value, setValue];
}

function Icon({ kind }: { kind: string }) {
  const paths: Record<string, string> = {
    Profile: "M20 21a8 8 0 0 0-16 0M12 13a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z",
    Study: "M4 19.5A2.5 2.5 0 0 1 6.5 17H20M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z",
    Quiz: "M9 11 12 14 22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11",
    Results: "M3 3v18h18M18 17V9M13 17V5M8 17v-3",
    "Study plan": "M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01",
    "Re-test": "M20 7v5h-5M4 17v-5h5m-4.1-3a8 8 0 0 1 13.2-2L20 12M4 12l1.9 5a8 8 0 0 0 13.2-2",
    Progress: "M3 3v18h18M7 14l4-4 4 4 6-7",
    Wellbeing: "M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z",
    Insights: "M3 3v18h18M7 14v4M12 9v9M17 5v13",
    Modules: "M4 5.5A2.5 2.5 0 0 1 6.5 3H20v18H6.5A2.5 2.5 0 0 1 4 18.5Zm0 0v13",
  };
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
      <path d={paths[kind] || paths.Profile} />
    </svg>
  );
}

function ErrorNotice({ message }: { message: string }) {
  return (
    <div className="notice notice-error" role="alert">
      <span className="notice-symbol" aria-hidden="true">!</span>
      <div><strong>We couldn’t complete that request.</strong><p>{message}</p></div>
    </div>
  );
}

function EmptyState({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="empty-state">
      <span className="empty-mark" aria-hidden="true">↗</span>
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}

function Card({
  title,
  subtitle,
  children,
  className = "",
}: {
  title?: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`card ${className}`}>
      {(title || subtitle) && (
        <div className="card-heading">
          <div>{title && <h2>{title}</h2>}{subtitle && <p>{subtitle}</p>}</div>
        </div>
      )}
      {children}
    </section>
  );
}

function StatusBadge({ value }: { value: string }) {
  const status = value.toLowerCase();
  const label =
    status === "understood" ? "Strong" : status === "partial" ? "In progress" : "Needs focus";
  return <span className={`badge ${status === "understood" ? "badge-good" : status === "partial" ? "badge-warn" : "badge-gap"}`}>{label}</span>;
}

function App() {
  const [role, setRole] = useStored<Role>("learnloop-role", "Student");
  const [page, setPage] = useStored<Page>("learnloop-page", "Profile");
  const [student, setStudent] = useStored<Student | null>("learnloop-student", null);
  const [profileDetails, setProfileDetails] = useStored<ProfileDetails | null>(
    "learnloop-profile-details",
    null,
  );
  const [modules, setModules] = useStored<Module[]>("learnloop-modules", [SEED_MODULE]);
  const [selectedModuleId, setSelectedModuleId] = useStored(
    "learnloop-selected-module",
    SEED_MODULE.id,
  );
  const [quiz, setQuiz] = useStored<Quiz | null>("learnloop-quiz", null);
  const [answers, setAnswers] = useStored<StoredQuizAnswers>("learnloop-answers", {});
  const [questionIndex, setQuestionIndex] = useStored("learnloop-question-index", 0);
  const [attempt, setAttempt] = useStored<Attempt | null>("learnloop-attempt", null);
  const [studyPlan, setStudyPlan] = useStored<StudyPlan | null>("learnloop-study-plan", null);
  const [connection, setConnection] = useState<Connection>("checking");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [uploadedContent, setUploadedContent] = useState("");
  const [progress, setProgress] = useState<Progress | null>(null);
  const [insights, setInsights] = useState<Insights | null>(null);
  const [gammaJob, setGammaJob] = useStored<GammaJob | null>("learnloop-gamma-job", null);

  const selectedModule =
    modules.find((item) => item.id === selectedModuleId) ?? modules[0] ?? SEED_MODULE;
  const flowModuleId = quiz?.module_id || selectedModule.id;
  const pageItems = useMemo(
    () => (role === "Student" ? STUDENT_NAV.map((item) => item.page) : ROLE_NAV[role]),
    [role],
  );

  useEffect(() => {
    let active = true;
    api.health().then(async () => {
      if (!active) return;
      setConnection("connected");
      const savedId = student?.id;
      if (savedId) {
        try {
          const currentStudent = await api.getStudent(savedId);
          if (active) setStudent((previous) => ({
            ...previous,
            ...currentStudent,
            consent: currentStudent.consent ?? previous?.consent ?? { academic: false, wellbeing: false },
          }));
        } catch (requestError) {
          if (active) setError(errorMessage(requestError));
        }
      }
    }).catch(() => {
      if (!active) return;
      setConnection("demo");
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (role === "Student" && !pageItems.includes(page)) setPage(student ? "Study" : "Profile");
    if (role !== "Student" && !pageItems.includes(page)) setPage(pageItems[0]);
  }, [role, page, pageItems, student, setPage]);

  useEffect(() => {
    if (page !== "Progress" || connection !== "connected" || !student) return;
    let active = true;
    setBusy("progress");
    api.getProgress(student.id).then((value) => {
      if (active) setProgress(value);
    }).catch((requestError: unknown) => {
      if (active) setError(errorMessage(requestError));
    }).finally(() => {
      if (active) setBusy("");
    });
    return () => { active = false; };
  }, [page, connection, student]);

  function errorMessage(value: unknown): string {
    if (value instanceof ApiError) {
      const details = value.details;
      if (details && typeof details === "object") {
        const detailText = Object.entries(details as Record<string, unknown>)
          .map(([field, issue]) => `${field}: ${String(issue)}`)
          .join(" · ");
        return detailText ? `${value.message} ${detailText}` : value.message;
      }
      return value.message;
    }
    return value instanceof Error ? value.message : "An unexpected error occurred.";
  }

  async function run(key: string, action: () => Promise<void>) {
    if (connection !== "connected") return;
    setBusy(key);
    setError("");
    try {
      await action();
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setBusy("");
    }
  }

  function go(nextPage: Page) {
    setError("");
    setPage(nextPage);
  }

  function setRoleAndPage(nextRole: Role) {
    setRole(nextRole);
    setPage(nextRole === "Student" ? (student ? "Study" : "Profile") : ROLE_NAV[nextRole][0]);
    setError("");
  }

  async function handleProfileCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const displayName = String(form.get("displayName") || "").trim();
    const qualification = String(form.get("qualification") || "").trim();
    const year = String(form.get("year") || "").trim();
    const course = `${qualification} (Year ${year})`;
    const detail: ProfileDetails = {
      studentNumber: String(form.get("studentNumber") || "").trim(),
      institution: String(form.get("institution") || "").trim(),
      qualification,
      year,
      moduleIds: form.getAll("moduleIds").map(String),
    };
    const academicConsent = form.get("academicConsent") === "on";
    const wellbeingConsent = form.get("wellbeingConsent") === "on";
    await run("create-student", async () => {
      const created = await api.createStudent({
        display_name: displayName,
        course,
        academic_consent: academicConsent,
        wellbeing_consent: wellbeingConsent,
      });
      setStudent(created);
      setProfileDetails(detail);
      if (detail.moduleIds[0]) setSelectedModuleId(detail.moduleIds[0]);
      setPage("Study");
    });
  }

  async function saveConsent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!student) return;
    const form = new FormData(event.currentTarget);
    await run("consent", async () => {
      const updated = await api.updateConsent(student.id, {
        academic_consent: form.get("academicConsent") === "on",
        wellbeing_consent: form.get("wellbeingConsent") === "on",
      });
      setStudent((previous) => previous ? { ...previous, consent: updated.consent } : previous);
    });
  }

  async function uploadFile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const file = form.get("file");
    if (!(file instanceof File) || !file.name) {
      setError("Choose a PDF or TXT file to upload.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Files must be 5 MB or smaller.");
      return;
    }
    await run("upload", async () => {
      const stored = await api.uploadContent(selectedModule.id, file);
      setUploadedContent(`${stored.filename} · ${stored.char_count.toLocaleString()} readable characters`);
      formElement.reset();
    });
  }

  async function startQuiz(kind: "level" | "retest") {
    if (!student || !selectedModule) return;
    await run(kind, async () => {
      const moduleId = kind === "retest" ? flowModuleId : selectedModule.id;
      const created = kind === "level"
        ? await api.startLevelCheck(moduleId, student.id)
        : await api.startRetest(moduleId, student.id);
      setQuiz(created);
      setAnswers({});
      setQuestionIndex(0);
      setAttempt(null);
      if (kind === "level") setStudyPlan(null);
      setPage(kind === "level" ? "Quiz" : "Re-test");
    });
  }

  async function submitQuiz() {
    if (!student || !quiz) return;
    const submittedAnswers = quiz.questions.map((question) => ({
      question_id: question.id,
      selected_index: answers[question.id],
    }));
    await run("submit-attempt", async () => {
      const result = await api.submitAttempt(quiz.quiz_id, student.id, submittedAnswers);
      setAttempt(result);
      setPage("Results");
    });
  }

  async function createPlan() {
    if (!student) return;
    await run("study-plan", async () => {
      const plan = await api.createStudyPlan(flowModuleId, student.id);
      setStudyPlan(plan);
      setPage("Study plan");
    });
  }

  async function loadInsights() {
    if (!selectedModule) return;
    await run("insights", async () => {
      setInsights(await api.getInsights(selectedModule.id));
    });
  }

  async function createModule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    await run("create-module", async () => {
      const created = await api.createModule({
        name: String(form.get("name") || "").trim(),
        code: String(form.get("code") || "").trim() || undefined,
        course: String(form.get("course") || "").trim() || undefined,
        description: String(form.get("description") || "").trim() || undefined,
      });
      setModules((previous) => [...previous.filter((item) => item.id !== created.id), created]);
      setSelectedModuleId(created.id);
      setInsights(null);
      formElement.reset();
    });
  }

  async function submitWellbeing(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!student?.consent.wellbeing) return;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    await run("wellbeing", async () => {
      const result = await api.submitWellbeing(student.id, {
        mood: Number(form.get("mood")),
        stress: Number(form.get("stress")),
        note: String(form.get("note") || "").trim() || undefined,
      });
      if (!result.stored) throw new Error("The API did not confirm that the check-in was stored.");
      setError("");
      window.alert("Your check-in was submitted privately. It is not visible to lecturers.");
      formElement.reset();
    });
  }

  async function pollGamma(start: () => Promise<GammaJob>, kind: string) {
    await run("gamma", async () => {
      let job = { ...(await start()), kind };
      setGammaJob(job);
      for (let poll = 0; poll < 10 && job.status === "pending"; poll += 1) {
        await new Promise((resolve) => window.setTimeout(resolve, 2500));
        job = { ...(await api.getGammaJob(job.job_id)), kind };
        setGammaJob(job);
      }
    });
  }

  const activePage = role === "Student" ? page : ROLE_NAV[role][0];
  const activeTitle = activePage === "Study" ? "Your study space" :
    activePage === "Quiz" ? "Level check" :
      activePage === "Results" ? "Your results" :
        activePage === "Study plan" ? "A plan for your next step" :
          activePage === "Re-test" ? "Your re-test" :
            activePage === "Progress" ? "Your progress" :
              activePage === "Wellbeing" ? "Wellbeing check-in" :
                activePage === "Insights" ? "Module insights" :
                  activePage === "Modules" ? "Module administration" : "Your profile";

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#" onClick={(event) => { event.preventDefault(); go("Profile"); }}>
          <span className="brand-mark" aria-hidden="true"><span /></span>
          <span>learnloop<small>STUDENT SUCCESS</small></span>
        </a>
        <div className="sidebar-rule" />
        <p className="sidebar-label">{role === "Student" ? "YOUR LEARNING" : "INSTITUTION"}</p>
        <nav className="main-nav" aria-label="Main navigation">
          {(role === "Student" ? STUDENT_NAV : ROLE_NAV[role].map((item) => ({ page: item }))).map(({ page: item }) => {
            const disabled =
              (item === "Quiz" && !quiz) ||
              (item === "Results" && !attempt) ||
              (item === "Study plan" && !studyPlan) ||
              (item === "Re-test" && !attempt);
            return (
              <button
                className={`nav-item ${activePage === item ? "active" : ""}`}
                key={item}
                type="button"
                onClick={() => go(item)}
                aria-current={activePage === item ? "page" : undefined}
                disabled={disabled}
              >
                <Icon kind={item} />
                <span>{item}</span>
                {item === "Quiz" && quiz && <span className="nav-dot" />}
              </button>
            );
          })}
        </nav>
        <div className="sidebar-bottom">
          <div className={`connection-mini ${connection}`}>
            <span className="connection-dot" />
            {connection === "connected" ? "API connected" : connection === "checking" ? "Connecting…" : "Demo mode"}
          </div>
          <div className="sidebar-caption">Your learning journey, at your pace.</div>
          <a className="docs-link" href={API_DOCS_URL} target="_blank" rel="noreferrer">
            API documentation <span aria-hidden="true">↗</span>
          </a>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="breadcrumbs"><span>LearnLoop</span><span className="crumb-slash">/</span>{activePage}</div>
          <div className="topbar-right">
            <label className="role-label" htmlFor="role-switch">Demo role</label>
            <select id="role-switch" value={role} onChange={(event) => setRoleAndPage(event.target.value as Role)}>
              <option>Student</option>
              <option>Lecturer</option>
              <option>Admin</option>
            </select>
            <span className="role-note">not authentication</span>
          </div>
        </header>

        <div className="page-wrap">
          {connection === "demo" && (
            <div className="demo-banner" role="status">
              <span className="demo-label">DEMO MODE</span>
              <span>API unavailable. No changes are being saved. The listed Python Basics module is reference data only.</span>
              <button type="button" className="text-button" onClick={() => window.location.reload()}>Retry</button>
            </div>
          )}
          {connection === "checking" && (
            <div className="connection-banner" role="status"><span className="spinner" /> Checking LearnLoop API…</div>
          )}

          <div className="page-heading">
            <div>
              <p className="eyebrow">{role === "Student" ? "STUDENT SPACE" : "INSTITUTION SPACE"}</p>
              <h1>{activeTitle}</h1>
              <p className="page-subtitle">{pageSubtitle(activePage)}</p>
            </div>
            {role === "Student" && student && (
              <div className="student-chip">
                <span className="avatar">{initials(student.display_name)}</span>
                <span><strong>{student.display_name}</strong><small>{student.course || "LearnLoop student"}</small></span>
              </div>
            )}
          </div>

          {error && <ErrorNotice message={error} />}

          {role === "Student" && activePage === "Profile" && (
            <ProfilePage
              student={student}
              modules={modules}
              profileDetails={profileDetails}
              busy={busy}
              connected={connection === "connected"}
              onCreate={handleProfileCreate}
              onConsentSave={saveConsent}
            />
          )}
          {role === "Student" && activePage === "Study" && (
            <StudyPage
              student={student}
              modules={modules}
              selectedModuleId={selectedModule.id}
              connected={connection === "connected"}
              busy={busy}
              uploadedContent={uploadedContent}
              onSelectModule={setSelectedModuleId}
              onUpload={uploadFile}
              onStart={() => startQuiz("level")}
              onGoProfile={() => go("Profile")}
            />
          )}
          {role === "Student" && (activePage === "Quiz" || activePage === "Re-test") && (
            <QuizPage
              quiz={quiz}
              answers={answers}
              index={questionIndex}
              busy={busy}
              connected={connection === "connected"}
              retest={activePage === "Re-test"}
              onSelect={(questionId, answerIndex) => setAnswers((previous) => ({ ...previous, [questionId]: answerIndex }))}
              onIndex={setQuestionIndex}
              onSubmit={submitQuiz}
              onStartRetest={() => startQuiz("retest")}
            />
          )}
          {role === "Student" && activePage === "Results" && (
            <ResultsPage
              attempt={attempt}
              retest={quiz?.kind === "retest"}
              busy={busy}
              onPlan={createPlan}
              onRetest={() => startQuiz("retest")}
              onStudy={() => go("Study")}
            />
          )}
          {role === "Student" && activePage === "Study plan" && (
            <StudyPlanPage
              plan={studyPlan}
              busy={busy}
              connected={connection === "connected"}
              gammaJob={gammaJob}
              onCreate={createPlan}
              onGamma={() => student && studyPlan && pollGamma(() => api.createStudyMaterial(student.id, flowModuleId, studyPlan.study_plan_id), "study_material")}
              onPoll={() => gammaJob && pollGamma(() => api.getGammaJob(gammaJob.job_id), "study_material")}
              onRetest={() => startQuiz("retest")}
            />
          )}
          {role === "Student" && activePage === "Progress" && (
            <ProgressPage progress={progress} busy={busy} onRefresh={() => student && run("progress", async () => setProgress(await api.getProgress(student.id)))} />
          )}
          {role === "Student" && activePage === "Wellbeing" && (
            <WellbeingPage student={student} busy={busy} onSubmit={submitWellbeing} onProfile={() => go("Profile")} />
          )}
          {role === "Lecturer" && activePage === "Insights" && (
            <InsightsPage
              modules={modules}
              selectedModuleId={selectedModule.id}
              insights={insights}
              busy={busy}
              connected={connection === "connected"}
              gammaJob={gammaJob}
              onSelect={(id) => { setSelectedModuleId(id); setInsights(null); }}
              onLoad={loadInsights}
              onReport={() => pollGamma(() => api.createInstitutionReport(selectedModule.id), "institution_report")}
              onPoll={() => gammaJob && pollGamma(() => api.getGammaJob(gammaJob.job_id), "institution_report")}
            />
          )}
          {role === "Admin" && activePage === "Modules" && (
            <AdminPage
              modules={modules}
              selectedModuleId={selectedModule.id}
              gammaJob={gammaJob}
              busy={busy}
              connected={connection === "connected"}
              onCreate={createModule}
              onSelect={setSelectedModuleId}
              onReport={() => pollGamma(() => api.createInstitutionReport(selectedModule.id), "institution_report")}
              onPoll={() => gammaJob && pollGamma(() => api.getGammaJob(gammaJob.job_id), "institution_report")}
            />
          )}

          <footer className="page-footer">
            <span>Made for steady progress, not perfection.</span>
            {connection === "connected" && <span>Connected to LearnLoop API · POC</span>}
            {connection === "demo" && <span>Demo reference content is not saved data</span>}
          </footer>
        </div>
      </main>
    </div>
  );
}

function pageSubtitle(page: Page) {
  const subtitles: Record<Page, string> = {
    Profile: "A few details help us shape a more relevant learning space.",
    Study: "Choose a module and begin with a gentle check of what you already know.",
    Quiz: "Take your time. Your answers are marked securely by LearnLoop.",
    Results: "See what feels familiar and where a little more practice may help.",
    "Study plan": "A focused explanation and practice for your next learning step.",
    "Re-test": "Try a short set of new questions on topics you want to strengthen.",
    Progress: "A view of your learning history and topic mastery.",
    Wellbeing: "A private, optional moment to check in with yourself.",
    Insights: "Anonymous, aggregated learning insights for this module.",
    Modules: "Create a module or request an anonymous institution report.",
  };
  return subtitles[page];
}

function initials(name?: string) {
  return (name || "LL").split(/\s+/).slice(0, 2).map((part) => part.charAt(0)).join("").toUpperCase();
}

function ProfilePage({
  student,
  modules,
  profileDetails,
  busy,
  connected,
  onCreate,
  onConsentSave,
}: {
  student: Student | null;
  modules: Module[];
  profileDetails: ProfileDetails | null;
  busy: string;
  connected: boolean;
  onCreate: (event: FormEvent<HTMLFormElement>) => void;
  onConsentSave: (event: FormEvent<HTMLFormElement>) => void;
}) {
  if (student) {
    return (
      <div className="content-grid profile-layout">
        <Card title="Your profile" subtitle="Your account details are returned by the LearnLoop API.">
          <div className="profile-summary">
            <span className="avatar avatar-large">{initials(student.display_name)}</span>
            <div><h3>{student.display_name}</h3><p>{student.course || "Course not provided by API"}</p></div>
          </div>
          <dl className="detail-list">
            <div><dt>Student number</dt><dd>{profileDetails?.studentNumber || "Not recorded in this browser"}</dd></div>
            <div><dt>Institution</dt><dd>{profileDetails?.institution || "Not recorded in this browser"}</dd></div>
            <div><dt>Selected modules</dt><dd>{profileDetails?.moduleIds.map((id) => modules.find((item) => item.id === id)?.name).filter(Boolean).join(", ") || "No local selection"}</dd></div>
          </dl>
          <p className="inline-note">The API does not expose fields for student number, institution, or student-to-module enrolment. Those details shown here are saved only in this browser.</p>
        </Card>
        <Card title="Your privacy choices" subtitle="You can change either choice at any time. Both are separate and optional.">
          <form onSubmit={onConsentSave}>
            <ConsentOption
              key={`academic-${student.consent?.academic ?? false}`}
              name="academicConsent"
              checked={student.consent?.academic ?? false}
              title="Academic monitoring"
              description="Allow your results to be included in anonymous, aggregated module insights."
            />
            <ConsentOption
              key={`wellbeing-${student.consent?.wellbeing ?? false}`}
              name="wellbeingConsent"
              checked={student.consent?.wellbeing ?? false}
              title="Wellbeing check-ins"
              description="Allow you to submit optional wellbeing check-ins. They are not shown to lecturers."
            />
            <button className="button button-primary button-wide" disabled={!connected || !!busy} type="submit">
              {busy === "consent" ? <><span className="spinner spinner-light" /> Saving…</> : "Save privacy choices"}
            </button>
          </form>
        </Card>
      </div>
    );
  }

  return (
    <div className="content-grid profile-layout">
      <Card title="A little about you" subtitle="Fields marked with * are needed to create your student record.">
        <form className="form-stack" onSubmit={onCreate}>
          <div className="form-row">
            <label className="field">Full name *
              <input name="displayName" required maxLength={100} placeholder="e.g. Thandi Mokoena" autoComplete="name" />
            </label>
            <label className="field">Student number *
              <input name="studentNumber" required maxLength={80} placeholder="e.g. 2026-01482" />
            </label>
          </div>
          <label className="field">Institution *
            <input name="institution" required maxLength={150} placeholder="Your university or college" />
          </label>
          <div className="form-row">
            <label className="field">Qualification *
              <input name="qualification" required maxLength={120} placeholder="e.g. BSc Computer Science" />
            </label>
            <label className="field">Year of study *
              <select name="year" required defaultValue="">
                <option value="" disabled>Select year</option>
                {[1, 2, 3, 4, 5, 6].map((year) => <option key={year} value={year}>{year}{year === 1 ? "st" : year === 2 ? "nd" : year === 3 ? "rd" : "th"} year</option>)}
              </select>
            </label>
          </div>
          <fieldset className="module-fieldset">
            <legend>Modules you’re studying</legend>
            <p className="field-hint">Choose from known or locally created modules. The backend has no enrolment endpoint.</p>
            <div className="module-checks">
              {modules.map((module) => (
                <label key={module.id} className="check-card">
                  <input type="checkbox" name="moduleIds" value={module.id} />
                  <span><strong>{module.name}</strong><small>{module.code || "Module"}{module.course ? ` · ${module.course}` : ""}</small></span>
                </label>
              ))}
            </div>
          </fieldset>
          <div className="consent-panel">
            <p className="consent-heading">Your choices start off</p>
            <ConsentOption name="academicConsent" title="Academic monitoring" description="Include my results in anonymous, aggregated module insights." />
            <ConsentOption name="wellbeingConsent" title="Wellbeing check-ins" description="Let me submit private, optional wellbeing check-ins." />
          </div>
          <p className="inline-note">The backend stores your name, qualification/year, and these two choices. Student number, institution, and selected modules are kept in this browser only.</p>
          <button className="button button-primary button-wide" disabled={!connected || !!busy} type="submit">
            {busy === "create-student" ? <><span className="spinner spinner-light" /> Creating profile…</> : "Create my profile"}
          </button>
          {!connected && <p className="field-hint">Profile creation becomes available when the API is connected.</p>}
        </form>
      </Card>
      <aside className="side-column">
        <div className="soft-card welcome-card">
          <div className="welcome-orbit"><span>ll</span></div>
          <p className="eyebrow">A GENTLER WAY TO LEARN</p>
          <h2>Every next step counts.</h2>
          <p>LearnLoop helps you notice what you know, focus where it matters, and keep moving at your own pace.</p>
        </div>
        <div className="privacy-footnote"><span className="privacy-icon">◇</span><p><strong>Your privacy matters</strong><br />Academic and wellbeing consent are independent. You can leave both off.</p></div>
      </aside>
    </div>
  );
}

function ConsentOption({
  name,
  title,
  description,
  checked,
}: {
  name: string;
  title: string;
  description: string;
  checked?: boolean;
}) {
  return (
    <label className="consent-option">
      <span className="consent-copy"><strong>{title}</strong><small>{description}</small></span>
      <span className="switch">
        <input type="checkbox" name={name} defaultChecked={checked ?? false} />
        <span className="switch-track" aria-hidden="true" />
      </span>
    </label>
  );
}

function StudyPage({
  student,
  modules,
  selectedModuleId,
  connected,
  busy,
  uploadedContent,
  onSelectModule,
  onUpload,
  onStart,
  onGoProfile,
}: {
  student: Student | null;
  modules: Module[];
  selectedModuleId: string;
  connected: boolean;
  busy: string;
  uploadedContent: string;
  onSelectModule: (id: string) => void;
  onUpload: (event: FormEvent<HTMLFormElement>) => void;
  onStart: () => void;
  onGoProfile: () => void;
}) {
  const [fileName, setFileName] = useState("");
  const module = modules.find((item) => item.id === selectedModuleId) ?? modules[0];
  return (
    <div className="content-grid study-layout">
      <div className="main-column">
        {!student ? (
          <Card><EmptyState title="Create your student profile first">Your profile connects your study sessions and results to you. Create one before starting a level check.</EmptyState><button className="button button-primary" type="button" onClick={onGoProfile}>Set up profile</button></Card>
        ) : (
          <Card title="Choose where to begin" subtitle="A level check gives you a starting point, not a grade.">
            <label className="field">Study module
              <select value={selectedModuleId} onChange={(event) => onSelectModule(event.target.value)}>
                {modules.map((item) => <option key={item.id} value={item.id}>{item.name}{item.code ? ` · ${item.code}` : ""}</option>)}
              </select>
            </label>
            {module && <div className="module-summary"><span className="module-monogram">{module.code?.slice(0, 2) || "LL"}</span><div><strong>{module.name}</strong><p>{module.description || module.course || "Take a small step and see what you already understand."}</p></div></div>}
            <div className="study-benefits">
              <div><span className="benefit-number">01</span><strong>Check in</strong><p>Answer a few questions at your own pace.</p></div>
              <div><span className="benefit-number">02</span><strong>Find your focus</strong><p>See strong and developing topics.</p></div>
              <div><span className="benefit-number">03</span><strong>Keep growing</strong><p>Get a clear next step for practice.</p></div>
            </div>
            <button className="button button-primary button-large" type="button" onClick={onStart} disabled={!connected || !!busy || !module || !student}>
              {busy === "level" ? <><span className="spinner spinner-light" /> Preparing your level check…</> : <>Start level check <span aria-hidden="true">→</span></>}
            </button>
            <p className="field-hint">Your answers are marked by the API after you submit. Correct answers are not sent with the quiz.</p>
          </Card>
        )}
        {student && <Card title="Add your own study material" subtitle="PDF and TXT files up to 5 MB. Text is extracted securely by the backend.">
          <form className="upload-row" onSubmit={onUpload}>
            <label className="file-picker">
              <input type="file" name="file" accept=".pdf,.txt,application/pdf,text/plain" onChange={(event) => setFileName(event.target.files?.[0]?.name || "")} />
              <span className="upload-symbol" aria-hidden="true">↑</span>
              <span><strong>{fileName || "Choose a PDF or TXT file"}</strong><small>PDF or plain text · max 5 MB</small></span>
            </label>
            <button className="button button-secondary" disabled={!connected || !!busy || !fileName} type="submit">
              {busy === "upload" ? <><span className="spinner" /> Uploading…</> : "Upload content"}
            </button>
          </form>
          {uploadedContent && <p className="success-line" role="status"><span>✓</span> Uploaded to the backend: {uploadedContent}</p>}
          <p className="field-hint">Uploaded content can inform quiz generation. Upload errors are shown without substituting mock content.</p>
        </Card>}
      </div>
      <aside className="side-column">
        <div className="soft-card focus-card">
          <span className="card-kicker">A NOTE FOR YOU</span>
          <h2>Learning isn’t a straight line.</h2>
          <p>Use your results as a guide for what to explore next. A topic that needs practice is simply a topic you haven’t mastered yet.</p>
          <div className="decorative-line"><span /><span /><span /></div>
        </div>
        <div className="mini-stat"><span className="mini-icon">✳</span><div><strong>Built around your pace</strong><small>No timers. No leaderboards. Just your progress.</small></div></div>
      </aside>
    </div>
  );
}

function QuizPage({
  quiz,
  answers,
  index,
  busy,
  connected,
  retest,
  onSelect,
  onIndex,
  onSubmit,
  onStartRetest,
}: {
  quiz: Quiz | null;
  answers: StoredQuizAnswers;
  index: number;
  busy: string;
  connected: boolean;
  retest: boolean;
  onSelect: (questionId: string, answerIndex: number) => void;
  onIndex: (index: number) => void;
  onSubmit: () => void;
  onStartRetest: () => void;
}) {
  if (!quiz) return <Card><EmptyState title="No assessment yet">Start a level check from your Study page. Your answers will stay on this device until you submit them.</EmptyState></Card>;
  const question = quiz.questions[index];
  const answeredCount = quiz.questions.filter((item) => answers[item.id] !== undefined).length;
  const progressPercent = quiz.questions.length ? (answeredCount / quiz.questions.length) * 100 : 0;
  if (!question) return <Card><EmptyState title="No questions were returned">The API did not provide questions for this assessment. Go back to Study and try again.</EmptyState><button className="button button-secondary" type="button" onClick={onStartRetest}>Try a re-test</button></Card>;
  return (
    <div className="quiz-layout">
      {quiz.ai_generated && <div className="notice notice-ai"><span className="notice-symbol">AI</span><div><strong>AI-generated content</strong><p>{quiz.notice || "This quiz was generated by AI because no suitable uploaded study material was used."}</p></div></div>}
      {retest && <div className="retest-context"><span>BEFORE SCORE</span><strong>{quiz.before?.overall_score_pct ?? quiz.before?.target_topics_score_pct ?? "—"}{quiz.before?.overall_score_pct != null || quiz.before?.target_topics_score_pct != null ? "%" : ""}</strong><small>We’ll compare your results after submission.</small></div>}
      <Card className="quiz-card">
        <div className="quiz-topline"><span>{retest ? "RE-TEST" : "LEVEL CHECK"}</span><span>Question {index + 1} of {quiz.questions.length}</span></div>
        <div className="progress-track" aria-label={`${answeredCount} of ${quiz.questions.length} questions answered`}><span style={{ width: `${progressPercent}%` }} /></div>
        <p className="topic-label">{question.topic}</p>
        <h2 className="question-prompt">{question.prompt}</h2>
        <fieldset className="answer-options">
          <legend className="sr-only">Choose one answer</legend>
          {question.options.map((option, optionIndex) => (
            <label key={`${question.id}-${optionIndex}`} className={`answer-option ${answers[question.id] === optionIndex ? "selected" : ""}`}>
              <input type="radio" name={`question-${question.id}`} checked={answers[question.id] === optionIndex} onChange={() => onSelect(question.id, optionIndex)} />
              <span className="option-marker">{String.fromCharCode(65 + optionIndex)}</span>
              <span>{option}</span>
            </label>
          ))}
        </fieldset>
        <div className="quiz-controls">
          <button className="button button-quiet" type="button" onClick={() => onIndex(Math.max(0, index - 1))} disabled={index === 0}>← Previous</button>
          {index < quiz.questions.length - 1 ? (
            <button className="button button-secondary" type="button" onClick={() => onIndex(index + 1)}>Next question →</button>
          ) : (
            <button className="button button-primary" type="button" onClick={onSubmit} disabled={!connected || !!busy || answeredCount !== quiz.questions.length}>
              {busy === "submit-attempt" ? <><span className="spinner spinner-light" /> Submitting…</> : "Submit answers"}
            </button>
          )}
        </div>
        {index === quiz.questions.length - 1 && answeredCount !== quiz.questions.length && <p className="validation-hint">Answer all {quiz.questions.length} questions before submitting ({answeredCount} answered).</p>}
        <p className="field-hint">You can review and change your answers before submitting. The answer key is not available in this quiz.</p>
      </Card>
    </div>
  );
}

function ResultsPage({
  attempt,
  retest,
  busy,
  onPlan,
  onRetest,
  onStudy,
}: {
  attempt: Attempt | null;
  retest: boolean;
  busy: string;
  onPlan: () => void;
  onRetest: () => void;
  onStudy: () => void;
}) {
  if (!attempt) return <Card><EmptyState title="Your results will appear here">Complete and submit a quiz to see your results from the backend.</EmptyState><button className="button button-primary" type="button" onClick={onStudy}>Go to Study</button></Card>;
  const percentage = attempt.score.score_pct;
  return (
    <div className="results-layout">
      <Card className="score-card">
        <div className="score-content">
          <div className="score-ring" style={{ "--score": `${percentage}%` } as ScoreStyle}><span>{percentage}<small>%</small></span></div>
          <div><p className="eyebrow">ASSESSMENT COMPLETE</p><h2>{percentage >= 70 ? "A strong foundation." : percentage >= 40 ? "You’re building momentum." : "A useful place to begin."}</h2><p>{attempt.score.correct} of {attempt.score.total} answers correct. Every result helps you choose a next step.</p></div>
        </div>
        {retest && attempt.comparison && <div className="comparison-strip"><div><span>BEFORE</span><strong>{attempt.comparison.before_score}%</strong></div><span className="comparison-arrow">→</span><div><span>AFTER</span><strong>{attempt.comparison.after_score}%</strong></div><div className={`improvement ${attempt.comparison.improved ? "positive" : ""}`}>{attempt.comparison.delta > 0 ? "+" : ""}{attempt.comparison.delta}% {attempt.comparison.improved ? "improvement" : "change"}</div></div>}
      </Card>
      <Card title="Topic overview" subtitle="Based on your submitted answers.">
        <div className="outcome-groups">
          <div><span className="outcome-label">STRONG</span><strong>{attempt.strong_topics?.length ? attempt.strong_topics.join(", ") : "No strong topics yet"}</strong></div>
          <div><span className="outcome-label">PARTIAL</span><strong>{attempt.partial_topics?.length ? attempt.partial_topics.join(", ") : "None returned"}</strong></div>
          <div><span className="outcome-label">NEEDS FOCUS</span><strong>{attempt.weak_topics?.length ? attempt.weak_topics.join(", ") : "None returned"}</strong></div>
        </div>
        {attempt.topics?.length ? <div className="topic-results">
          {attempt.topics.map((topic) => (
            <div className="topic-result" key={topic.topic}>
              <div className="topic-result-top"><strong>{topic.topic}</strong><StatusBadge value={topic.status} /></div>
              <div className="mastery-row"><span className="mastery-track"><span className={`mastery-fill ${topic.status}`} style={{ width: `${Math.min(100, Math.max(0, topic.mastery_pct))}%` }} /></span><span>{topic.mastery_pct}%</span></div>
            </div>
          ))}
        </div> : <EmptyState title="No topic breakdown available">The API did not return topic results for this attempt.</EmptyState>}
      </Card>
      <div className="result-actions">
        {attempt.weak_topics?.length > 0 && <button className="button button-primary" type="button" onClick={onPlan} disabled={!!busy}>{busy === "study-plan" ? <><span className="spinner spinner-light" /> Making a plan…</> : "Build my study plan →"}</button>}
        {(attempt.weak_topics?.length > 0 || attempt.partial_topics?.length > 0) && <button className="button button-secondary" type="button" onClick={onRetest} disabled={!!busy}>Try a re-test</button>}
        <button className="button button-quiet" type="button" onClick={onStudy}>Back to Study</button>
      </div>
    </div>
  );
}

function StudyPlanPage({
  plan,
  busy,
  connected,
  gammaJob,
  onCreate,
  onGamma,
  onPoll,
  onRetest,
}: {
  plan: StudyPlan | null;
  busy: string;
  connected: boolean;
  gammaJob: GammaJob | null;
  onCreate: () => void;
  onGamma: () => void;
  onPoll: () => void;
  onRetest: () => void;
}) {
  if (!plan) return <Card>  <EmptyState title="Your study plan is waiting">Complete a level check first. LearnLoop uses your weakest topic to build a focused plan.</EmptyState><button className="button button-primary" type="button" onClick={onCreate} disabled={!connected || !!busy}>{busy === "study-plan" ? "Making your plan…" : "Create a study plan"}</button></Card>;
  return (
    <div className="plan-layout">
      <Card className="plan-hero">
        <p className="eyebrow">YOUR FOCUS TOPIC</p>
        <div className="plan-topic-row"><h2>{plan.topic}</h2><StatusBadge value={plan.current_mastery?.status || "gap"} /></div>
        <p className="plan-summary">{plan.plan.summary || "A focused path to strengthen your understanding."}</p>
        {plan.ai_generated && <div className="notice notice-ai compact-notice"><span className="notice-symbol">AI</span><div><strong>AI-generated study material</strong><p>This plan was generated by AI. Review it alongside your course materials.</p></div></div>}
      </Card>
      <div className="plan-columns">
        <Card title="Understand the idea">
          <p className="reading-copy">{plan.plan.explanation || "No explanation was returned for this topic."}</p>
          {plan.plan.example && <div className="worked-example"><p className="card-kicker">{plan.plan.example.title || "WORKED EXAMPLE"}</p>{plan.plan.example.content && <pre><code>{plan.plan.example.content}</code></pre>}{plan.plan.example.walkthrough && <p>{plan.plan.example.walkthrough}</p>}</div>}
        </Card>
        <Card title="Practice a little" subtitle="Try these questions at your own pace.">
          {plan.plan.practice_questions?.length ? plan.plan.practice_questions.map((item, index) => (
            <div className="practice-item" key={`${index}-${item.question}`}>
              <p><span className="practice-number">{String(index + 1).padStart(2, "0")}</span>{item.question}</p>
              {item.hint && <p className="practice-hint">Hint: {item.hint}</p>}
              {item.answer && <details><summary>Reveal a suggested answer</summary><p>{item.answer}</p></details>}
            </div>
          )) : <EmptyState title="No practice questions">The API did not include practice questions for this plan.</EmptyState>}
          {!!plan.plan.next_steps?.length && <div className="next-steps"><strong>When you’re ready</strong><ul>{plan.plan.next_steps.map((step) => <li key={step}>{step}</li>)}</ul></div>}
        </Card>
      </div>
      <Card title="Take it a little further" subtitle="Optional: request a polished study guide in Gamma.">
        <div className="gamma-action">
          <div><strong>Turn this plan into study material</strong><p>Gamma receives your study plan only—not your name or wellbeing information.</p></div>
          <button className="button button-secondary" type="button" onClick={onGamma} disabled={!connected || !!busy}>
            {busy === "gamma" ? <><span className="spinner" /> Requesting…</> : "Request Gamma material"}
          </button>
        </div>
        <GammaJobStatus job={gammaJob} kind="study_material" busy={busy === "gamma"} onPoll={onPoll} />
      </Card>
      <button className="button button-primary" type="button" onClick={onRetest} disabled={!connected || !!busy}>Ready to try a re-test? <span aria-hidden="true">→</span></button>
    </div>
  );
}

function GammaJobStatus({ job, kind, busy, onPoll }: { job: GammaJob | null; kind: string; busy: boolean; onPoll: () => void }) {
  if (!job || job.kind !== kind) return null;
  if (job.status === "completed" && job.gamma_url) return <p className="success-line" role="status"><span>✓</span> Your material is ready. <a href={job.gamma_url} target="_blank" rel="noreferrer">Open in Gamma ↗</a></p>;
  if (job.status === "completed") return <p className="gamma-failed" role="status">Gamma completed the request but did not return a result link.</p>;
  if (job.status === "failed") return <p className="gamma-failed" role="status">{job.error || "Gamma could not complete this request. You can try again later."}</p>;
  return <div className="gamma-pending" role="status"><span className="spinner" /> Gamma is preparing your material. {busy ? "Checking status…" : "It may take a little while."} <button type="button" className="text-button" onClick={onPoll} disabled={busy}>Check status</button></div>;
}

function ProgressPage({
  progress,
  busy,
  onRefresh,
}: {
  progress: Progress | null;
  busy: string;
  onRefresh: () => void;
}) {
  const progressModules = progress?.modules ?? [];
  return (
    <div className="progress-layout">
      <Card title="Your learning record" subtitle="Progress data comes directly from the LearnLoop API. Wellbeing data is never included.">
        <div className="card-action-row"><span className="api-tag">API DATA</span><button type="button" className="button button-quiet button-small" disabled={!!busy} onClick={onRefresh}>{busy === "progress" ? <><span className="spinner" /> Refreshing…</> : "Refresh progress ↻"}</button></div>
        {!progress ? <EmptyState title="No progress loaded yet">{busy === "progress" ? "Loading your progress…" : "Your saved assessments and topic mastery will appear here."}</EmptyState> :
          !progressModules.length ? <EmptyState title="A fresh start">There are no progress records for this student yet. Complete a level check to begin.</EmptyState> :
            progressModules.map((item) => (
              <div className="progress-module" key={item.module_id}>
                <div className="progress-module-header"><div><p className="eyebrow">MODULE</p><h3>{item.name}</h3></div><div className="score-history"><span>Level check <strong>{item.latest_level_check_score_pct == null ? "—" : `${item.latest_level_check_score_pct}%`}</strong></span><span>Re-test <strong>{item.latest_retest_score_pct == null ? "—" : `${item.latest_retest_score_pct}%`}</strong></span></div></div>
                {item.topics?.length ? <div className="topic-results">{item.topics.map((topic) => <div className="topic-result" key={topic.topic}><div className="topic-result-top"><strong>{topic.topic}</strong><StatusBadge value={topic.status} /></div><div className="mastery-row"><span className="mastery-track"><span className={`mastery-fill ${topic.status}`} style={{ width: `${Math.min(100, Math.max(0, topic.mastery_pct))}%` }} /></span><span>{topic.mastery_pct}%</span></div></div>)}</div> : <p className="field-hint">No topic mastery has been returned yet.</p>}
              </div>
            ))}
      </Card>
    </div>
  );
}

function WellbeingPage({
  student,
  busy,
  onSubmit,
  onProfile,
}: {
  student: Student | null;
  busy: string;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onProfile: () => void;
}) {
  if (!student) return <Card><EmptyState title="Create a student profile first">A wellbeing check-in is attached to your student record.</EmptyState><button className="button button-secondary" type="button" onClick={onProfile}>Go to profile</button></Card>;
  if (!student.consent?.wellbeing) return (
    <Card title="An optional private check-in" subtitle="You decide whether this feature is right for you.">
      <div className="privacy-callout"><span className="privacy-large">◇</span><div><h3>Wellbeing consent is off</h3><p>We won’t offer to submit a check-in until you choose to enable wellbeing consent. Check-ins are private and are not included in lecturer insights.</p></div></div>
      <button className="button button-secondary" type="button" onClick={onProfile}>Review privacy choices</button>
    </Card>
  );
  return (
    <div className="content-grid wellbeing-layout">
      <Card title="How are you feeling today?" subtitle="This is optional. There are no right or wrong answers.">
        <div className="privacy-callout compact"><span className="privacy-large">◇</span><p>Your check-in is private. It is not shown to lecturers, does not affect your academic results, and can be skipped.</p></div>
        <form className="form-stack" onSubmit={onSubmit}>
          <fieldset className="scale-fieldset"><legend>Your mood <span>1 = very low · 5 = great</span></legend><div className="scale-options">{[1, 2, 3, 4, 5].map((value) => <label key={value}><input type="radio" name="mood" value={value} required /><span>{value}</span></label>)}</div></fieldset>
          <fieldset className="scale-fieldset"><legend>Your stress level <span>1 = calm · 5 = very stressed</span></legend><div className="scale-options">{[1, 2, 3, 4, 5].map((value) => <label key={value}><input type="radio" name="stress" value={value} required /><span>{value}</span></label>)}</div></fieldset>
          <label className="field">Anything else you’d like to note? <span className="optional-label">Optional</span><textarea name="note" maxLength={500} rows={4} placeholder="Share only what you feel comfortable sharing." /></label>
          <button className="button button-primary" type="submit" disabled={!!busy}>{busy === "wellbeing" ? <><span className="spinner spinner-light" /> Submitting privately…</> : "Submit private check-in"}</button>
          <p className="field-hint">Submission is offered only because you enabled wellbeing consent. You can withdraw that consent in your Profile.</p>
        </form>
      </Card>
      <aside className="side-column"><div className="soft-card focus-card"><span className="card-kicker">A GENTLE REMINDER</span><h2>Taking a pause is progress, too.</h2><p>This check-in is not medical advice or a crisis service. If you need support, please reach out to someone you trust or a qualified professional.</p></div></aside>
    </div>
  );
}

function InsightsPage({
  modules,
  selectedModuleId,
  insights,
  busy,
  connected,
  gammaJob,
  onSelect,
  onLoad,
  onReport,
  onPoll,
}: {
  modules: Module[];
  selectedModuleId: string;
  insights: Insights | null;
  busy: string;
  connected: boolean;
  gammaJob: GammaJob | null;
  onSelect: (id: string) => void;
  onLoad: () => void;
  onReport: () => void;
  onPoll: () => void;
}) {
  return (
    <div className="institution-layout">
      <Card title="Anonymous module insights" subtitle="The API aggregates results only from students with academic monitoring consent.">
        <div className="selector-action">
          <label className="field">Module<select value={selectedModuleId} onChange={(event) => onSelect(event.target.value)}>{modules.map((item) => <option key={item.id} value={item.id}>{item.name}{item.code ? ` · ${item.code}` : ""}</option>)}</select></label>
          <button className="button button-primary" type="button" disabled={!connected || !!busy} onClick={onLoad}>{busy === "insights" ? <><span className="spinner spinner-light" /> Loading…</> : "Load insights"}</button>
        </div>
        <div className="privacy-banner"><span>◇</span><p><strong>Privacy by design</strong> — no student names, individual results, wellbeing data, or referrals are shown here. Topic distributions may be suppressed for cohorts smaller than three.</p></div>
        {!insights ? <EmptyState title="Choose a module to begin">Load insights to see the anonymous aggregate returned by the API. No individual student data is requested.</EmptyState> :
          insights.suppressed || insights.insufficient_data ? <div className="suppression-state"><span className="suppression-icon">•••</span><h3>More consenting responses are needed</h3><p>The API has suppressed topic distributions to protect student privacy. No individual data is available in this view.</p></div> :
            <InsightsData insights={insights} />}
      </Card>
      <Card title="Institution report" subtitle="Optional Gamma report generated only from anonymous module insights.">
        <div className="gamma-action"><div><strong>Request an aggregated report</strong><p>Gamma receives the module’s anonymous insights, never student-level data.</p></div><button className="button button-secondary" type="button" disabled={!connected || !!busy} onClick={onReport}>{busy === "gamma" ? <><span className="spinner" /> Requesting…</> : "Request Gamma report"}</button></div>
        <GammaJobStatus job={gammaJob} kind="institution_report" busy={busy === "gamma"} onPoll={onPoll} />
      </Card>
    </div>
  );
}

function InsightsData({ insights }: { insights: Insights }) {
  const topics = insights.topics ?? [];
  return (
    <div className="insights-data">
      <div className="aggregate-stats">
        <div><span>Consenting cohort</span><strong>{insights.cohort_size ?? "—"}</strong></div>
        <div><span>Level checks</span><strong>{insights.attempts?.level_check_count ?? "—"}</strong></div>
        <div><span>Average level check</span><strong>{insights.attempts?.average_level_check_score_pct == null ? "—" : `${insights.attempts.average_level_check_score_pct}%`}</strong></div>
      </div>
      {!topics.length ? <EmptyState title="No topic aggregates yet">The API has no topic distribution available for this module.</EmptyState> :
        <div className="topic-results">{topics.map((topic) => <div className="topic-result" key={topic.topic}><div className="topic-result-top"><strong>{topic.topic}</strong><StatusBadge value={topic.cohort_status} /></div><div className="mastery-row"><span className="mastery-track"><span className={`mastery-fill ${topic.cohort_status}`} style={{ width: `${Math.min(100, Math.max(0, topic.average_mastery_pct))}%` }} /></span><span>{topic.average_mastery_pct}% average</span></div><p className="topic-distribution">{topic.gap_count ?? 0} need focus · {topic.partial_count ?? 0} developing · {topic.understood_count ?? 0} strong</p></div>)}</div>}
      {!!insights.priority_topics?.length && <p className="priority-topics"><strong>Priority topics:</strong> {insights.priority_topics.join(" · ")}</p>}
      <p className="field-hint">{insights.privacy?.students_excluded_without_consent ?? 0} student(s) without academic consent excluded. Wellbeing data included: no.</p>
    </div>
  );
}

function AdminPage({
  modules,
  selectedModuleId,
  gammaJob,
  busy,
  connected,
  onCreate,
  onSelect,
  onReport,
  onPoll,
}: {
  modules: Module[];
  selectedModuleId: string;
  gammaJob: GammaJob | null;
  busy: string;
  connected: boolean;
  onCreate: (event: FormEvent<HTMLFormElement>) => void;
  onSelect: (id: string) => void;
  onReport: () => void;
  onPoll: () => void;
}) {
  return (
    <div className="content-grid admin-layout">
      <Card title="Create a module" subtitle="This is the module creation action exposed by the backend.">
        <form className="form-stack" onSubmit={onCreate}>
          <label className="field">Module name *<input name="name" required maxLength={150} placeholder="e.g. Introduction to Statistics" /></label>
          <div className="form-row"><label className="field">Module code<input name="code" maxLength={30} placeholder="e.g. STA101" /></label><label className="field">Course<input name="course" maxLength={150} placeholder="e.g. BCom (Year 1)" /></label></div>
          <label className="field">Description<textarea name="description" rows={4} maxLength={2000} placeholder="Briefly describe the module topics." /></label>
          <button className="button button-primary" type="submit" disabled={!connected || !!busy}>{busy === "create-module" ? <><span className="spinner spinner-light" /> Creating…</> : "Create module"}</button>
        </form>
        <p className="inline-note">There is no API endpoint to list or edit modules. Created modules are kept in this browser so they can be selected in this demo.</p>
      </Card>
      <Card title="Available module references" subtitle="Seeded API module and modules created in this browser.">
        <div className="module-list">
          {modules.map((module) => <button key={module.id} type="button" className={`module-list-item ${selectedModuleId === module.id ? "selected" : ""}`} onClick={() => onSelect(module.id)}><span className="module-monogram">{module.code?.slice(0, 2) || "LL"}</span><span><strong>{module.name}</strong><small>{module.code || module.id}{module.course ? ` · ${module.course}` : ""}</small></span><span className="module-check">{selectedModuleId === module.id ? "✓" : "→"}</span></button>)}
        </div>
      </Card>
      <Card title="Aggregated Gamma report" subtitle="Only anonymous module insights are used to generate this report.">
        <div className="selector-action"><label className="field">Module<select value={selectedModuleId} onChange={(event) => onSelect(event.target.value)}>{modules.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><button className="button button-secondary" type="button" disabled={!connected || !!busy} onClick={onReport}>{busy === "gamma" ? "Requesting…" : "Request report"}</button></div>
        <GammaJobStatus job={gammaJob} kind="institution_report" busy={busy === "gamma"} onPoll={onPoll} />
        <p className="field-hint">The API may reject report requests when the consenting cohort is too small or Gamma is not configured.</p>
      </Card>
    </div>
  );
}

export default App;
