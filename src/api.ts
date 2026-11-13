const DEFAULT_API_BASE_URL = "/api/public";
const configuredApiBaseUrl =
  import.meta.env.VITE_API_BASE_URL?.trim() || DEFAULT_API_BASE_URL;
export const API_BASE_URL = configuredApiBaseUrl.replace(/\/+$/, "");
export const API_DOCS_URL = `${API_BASE_URL.startsWith("http")
  ? API_BASE_URL.replace(/\/api\/public$/, "")
  : "https://gamma-dream-garden.lovable.app"}/docs`;

export type ApiErrorBody = {
  error?: {
    code?: string;
    message?: string;
    details?: unknown;
  };
};

export class ApiError extends Error {
  code?: string;
  details?: unknown;
  status: number;

  constructor(message: string, status: number, code?: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, options);
  } catch {
    throw new ApiError(
      "Could not reach LearnLoop. Check your connection and API URL, then try again.",
      0,
    );
  }

  const raw = await response.text();
  let data: unknown;
  try {
    data = raw ? JSON.parse(raw) : undefined;
  } catch {
    data = undefined;
  }

  if (!response.ok) {
    const body = data as ApiErrorBody | undefined;
    throw new ApiError(
      body?.error?.message || `LearnLoop returned an error (${response.status}).`,
      response.status,
      body?.error?.code,
      body?.error?.details,
    );
  }

  if (data === undefined) {
    throw new ApiError("LearnLoop returned an unreadable response.", response.status);
  }
  return data as T;
}

function json<T>(path: string, method: "POST" | "PATCH", body?: unknown) {
  return request<T>(path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
}

export type Consent = { academic: boolean; wellbeing: boolean };
export type Student = {
  id: string;
  display_name: string;
  course?: string;
  consent: Consent;
  created_at?: string;
  checks?: number;
  last_check?: number;
};
export type Module = {
  id: string;
  name: string;
  code?: string;
  course?: string;
  description?: string;
};
export type Question = {
  id: string;
  position: number;
  topic: string;
  prompt: string;
  options: string[];
};
export type Quiz = {
  quiz_id: string;
  module_id: string;
  kind: "level_check" | "retest";
  ai_generated?: boolean;
  notice?: string | null;
  source?: string;
  topics?: string[];
  questions: Question[];
  before?: {
    overall_score_pct?: number;
    target_topics_score_pct?: number;
  };
};
export type TopicResult = {
  topic: string;
  correct?: number;
  total?: number;
  mastery_pct: number;
  status: "gap" | "partial" | "understood" | string;
};
export type Attempt = {
  attempt_id: string;
  quiz_id: string;
  kind: string;
  score: { correct: number; total: number; score_pct: number };
  topics: TopicResult[];
  strong_topics: string[];
  partial_topics: string[];
  weak_topics: string[];
  comparison: {
    before_score: number;
    after_score: number;
    delta: number;
    improved: boolean;
  } | null;
};
export type StudyPlan = {
  study_plan_id: string;
  topic: string;
  current_mastery?: { mastery_pct: number; status: string };
  source?: string;
  ai_generated?: boolean;
  plan: {
    summary?: string;
    explanation?: string;
    example?: { title?: string; content?: string; walkthrough?: string };
    practice_questions?: Array<{
      question: string;
      answer?: string;
      hint?: string;
    }>;
    next_steps?: string[];
  };
};
export type Progress = {
  student?: Student;
  modules?: Array<{
    module_id: string;
    name: string;
    topics?: TopicResult[];
    latest_level_check_score_pct?: number | null;
    latest_retest_score_pct?: number | null;
  }>;
};
export type Insights = {
  module?: { module_id: string; code?: string; name: string };
  privacy?: {
    aggregated_only?: boolean;
    includes_only_students_with_academic_consent?: boolean;
    students_excluded_without_consent?: number;
    wellbeing_data_included?: boolean;
  };
  cohort_size?: number;
  suppressed?: boolean;
  insufficient_data?: boolean;
  attempts?: {
    level_check_count?: number;
    retest_count?: number;
    average_level_check_score_pct?: number | null;
    average_retest_score_pct?: number | null;
  };
  topics?: Array<{
    topic: string;
    students_assessed?: number;
    average_mastery_pct: number;
    cohort_status: string;
    gap_count?: number;
    partial_count?: number;
    understood_count?: number;
  }>;
  priority_topics?: string[];
};
export type GammaJob = {
  job_id: string;
  kind?: string;
  status: "pending" | "completed" | "failed" | string;
  gamma_url?: string | null;
  export_url?: string | null;
  created_at?: string;
  checks?: number;
  last_check?: number;
  error?: string | null;
};

export const api = {
  health: () => request<{ status: string }>("/health"),
  createStudent: (body: {
    display_name: string;
    course: string;
    academic_consent: boolean;
    wellbeing_consent: boolean;
  }) => json<Student>("/students", "POST", body),
  getStudent: (id: string) =>
    request<Student>(`/students/${encodeURIComponent(id)}`),
  updateConsent: (id: string, body: {
    academic_consent?: boolean;
    wellbeing_consent?: boolean;
  }) => json<Student>(`/students/${encodeURIComponent(id)}`, "PATCH", body),
  createModule: (body: {
    name: string;
    code?: string;
    course?: string;
    description?: string;
  }) => json<Module>("/modules", "POST", body),
  uploadContent: (moduleId: string, file: File) => {
    const body = new FormData();
    body.set("module_id", moduleId);
    body.set("file", file);
    return request<{
      id: string;
      filename: string;
      char_count: number;
      suitable_for_generation: boolean;
    }>("/content", { method: "POST", body });
  },
  startLevelCheck: (moduleId: string, studentId: string, useSeededQuiz = false) =>
    json<Quiz>(`/modules/${encodeURIComponent(moduleId)}/level-check`, "POST", {
      student_id: studentId,
      ...(useSeededQuiz ? { use_seeded_quiz: true } : {}),
    }),
  startRetest: (
    moduleId: string,
    studentId: string,
    options: { topics?: string[]; questionCount?: number } = {},
  ) =>
    json<Quiz>(`/modules/${encodeURIComponent(moduleId)}/retest`, "POST", {
      student_id: studentId,
      ...(options.topics?.length ? { topics: options.topics.slice(0, 5) } : {}),
      ...(options.questionCount ? { question_count: options.questionCount } : {}),
    }),
  submitAttempt: (
    quizId: string,
    studentId: string,
    answers: Array<{ question_id: string; selected_index: number }>,
  ) => json<Attempt>("/attempts", "POST", {
    quiz_id: quizId,
    student_id: studentId,
    answers,
  }),
  createStudyPlan: (moduleId: string, studentId: string) =>
    json<StudyPlan>("/study-plans", "POST", {
      module_id: moduleId,
      student_id: studentId,
    }),
  getProgress: (id: string) =>
    request<Progress>(`/students/${encodeURIComponent(id)}/progress`),
  getInsights: (id: string) =>
    request<Insights>(`/modules/${encodeURIComponent(id)}/insights`),
  submitWellbeing: (
    id: string,
    body: { mood: number; stress: number; note?: string },
  ) => json<{ checkin_id: string; stored: boolean; visible_to_lecturers: false }>(
    `/students/${encodeURIComponent(id)}/wellbeing-checkins`,
    "POST",
    body,
  ),
  createStudyMaterial: (studentId: string, moduleId: string, planId: string) =>
    json<GammaJob>("/gamma/study-material", "POST", {
      student_id: studentId,
      module_id: moduleId,
      study_plan_id: planId,
    }),
  createInstitutionReport: (moduleId: string) =>
    json<GammaJob>("/gamma/institution-report", "POST", { module_id: moduleId }),
  getGammaJob: (id: string) =>
    request<GammaJob>(`/gamma/jobs/${encodeURIComponent(id)}`),
};
