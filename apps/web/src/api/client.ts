import type { StudyAnswer, Question, QuestionDTO } from "@quarry/shared";
export type { StudyAnswer };
export interface Tag {
  id: string;
  name: string;
  target_type: "file" | "question";
  color: string | null;
}
export interface Document {
  id: string;
  name: string;
  description?: string;
  folder_id?: string | null;
  parent_id?: string | null;
  tag_ids: string[];
  updated_at: string;
}
export type QuestionView = Omit<
  Question,
  "options" | "blanks" | "explanation"
> & {
  explanation?: string;
  material?: string | null;
  options?: { id: string; content: string; is_correct?: boolean }[];
  blanks?: { id: string; valid_answers?: string[] }[];
  reference_answer?: string;
  max_score?: number;
  options_order_fixed?: boolean;
  score_mode?: string;
};
export interface Item {
  id: string;
  question: QuestionView;
  source_question_id: string | null;
}
export interface Section {
  id: string;
  title: string;
  question_type: string;
  items: Item[];
  shuffle_questions: boolean;
  fixed_groups: string[][];
}
export interface Folder extends Document {
  parent_id: string | null;
}
export interface Bank extends Document {
  description: string;
  folder_id: string | null;
}
export interface Paper extends Bank {
  sections: Section[];
  full_score: number;
  time_limit_seconds: number | null;
  follow_source: boolean;
  shuffle_options: boolean;
  shuffle_sections: boolean;
  shuffle_materials: boolean;
  merged_shuffle_sections: string[][];
  score_mode: string;
}
export interface RecordView {
  id: string;
  question_id: string;
  attempt_index: number;
  answer: StudyAnswer;
  score: number | null;
  is_correct: number | null;
  answered_at: string;
}
export interface Session {
  paper_name?: string;
  time_limit_seconds?: number | null;
  paused_at?: string | null;
  id: string;
  paper_id: string;
  mode: "practice" | "exam";
  status: "in_progress" | "paused" | "completed";
  current_index: number;
  draft_answers: Record<string, StudyAnswer>;
  items: Item[];
  records: RecordView[];
  start_time: string;
  end_time: string | null;
  paused_duration_seconds: number;
  effective_duration_seconds: number;
}
export interface Mistake {
  source_folder_id?: string | null;
  id: string;
  source_paper_id: string | null;
  source_paper_name: string | null;
  question_snapshot: QuestionView;
  mastery_status: "reviewing" | "mastered";
  wrong_count: number;
  created_at: string;
  history: {
    source_paper_id?: string | null;
    answered_at: string;
    source_paper_name?: string | null;
    answer: StudyAnswer;
  }[];
}
export interface Dashboard {
  total_questions_answered: number;
  deduplicated_questions_count: number;
  total_duration_seconds: number;
  daily_heatmap: { date: string; count: number; duration_seconds: number }[];
}
export interface TrashItem {
  id: string;
  entity: "folders" | "question_banks" | "papers" | "questions";
  name?: string;
  stem?: string;
}
export type Query = Record<
  string,
  string | number | boolean | readonly string[] | undefined
>;
export type DocumentInput = {
  name: string;
  folder_id?: string | null;
  parent_id?: string | null;
  description?: string;
  tag_ids?: string[];
};
export type PaperInput = Omit<
  Partial<Paper>,
  "id" | "updated_at" | "parent_id" | "sections"
> & { sections?: ComposerSection[] };
export interface ComposerSection {
  id: string;
  title: string;
  question_type: string;
  shuffle_questions: boolean;
  fixed_groups: string[][];
  items: { id?: string; source_question_id?: string; question?: unknown }[];
}
export interface FollowDiff {
  item_id: string;
  source_invalid: boolean;
  changes: Record<string, { before: unknown; after: unknown }>;
}
export interface ImportPreview {
  name: string;
  entity: "bank" | "paper";
  description: string;
  questions: QuestionView[];
  attachments: { id: string }[];
}
export class BackendError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
    readonly details?: unknown,
  ) {
    super(message);
  }
}
declare global {
  interface Window {
    __QUARRY_API_URL__?: string;
  }
}
export function apiBase() {
  return (
    (typeof window !== "undefined" && window.__QUARRY_API_URL__) ||
    import.meta.env.VITE_API_URL ||
    "http://127.0.0.1:48123"
  );
}
export class BackendClient {
  constructor(
    readonly baseUrl = apiBase(),
    readonly transport: typeof fetch = (...args) => fetch(...args),
  ) {}
  url(path: string, query: Query = {}) {
    const url = new URL("/api/" + path, this.baseUrl);
    for (const [key, value] of Object.entries(query))
      if (value !== undefined)
        url.searchParams.set(
          key,
          Array.isArray(value) ? value.join(",") : String(value),
        );
    return url.toString();
  }
  async request<T>(
    path: string,
    method = "GET",
    input?: unknown,
    query?: Query,
    binary = false,
  ): Promise<T> {
    const multipart = input instanceof FormData;
    const response = await this.transport(this.url(path, query), {
      method,
      ...(input === undefined
        ? {}
        : {
            body: multipart ? input : JSON.stringify(input),
            ...(multipart
              ? {}
              : { headers: { "Content-Type": "application/json" } }),
          }),
    });
    if (binary && response.ok) return (await response.blob()) as T;
    const result = (await response.json()) as {
      success: boolean;
      data: T;
      error?: { message: string; code: string; details?: unknown };
    };
    if (!response.ok || !result.success)
      throw new BackendError(
        result.error?.message ?? "请求失败",
        response.status,
        result.error?.code ?? "HTTP_ERROR",
        result.error?.details,
      );
    return result.data;
  }
  private crud<T, I>(path: string) {
    return {
      list: (query?: Query) => this.request<T[]>(path, "GET", undefined, query),
      get: (id: string) => this.request<T>(`${path}/${id}`),
      create: (input: I) => this.request<T>(path, "POST", input),
      update: (id: string, input: Partial<I>) =>
        this.request<T>(`${path}/${id}`, "PUT", input),
      delete: (id: string) => this.request<null>(`${path}/${id}`, "DELETE"),
    };
  }
  folders = this.crud<Folder, DocumentInput>("folders");
  banks = this.crud<Bank, DocumentInput>("banks");
  questions = this.crud<
    QuestionView,
    QuestionDTO & { material?: string | null }
  >("questions");
  papers = {
    ...this.crud<Paper, PaperInput>("papers"),
    compose: (id: string, sections: ComposerSection[]) =>
      this.request<Paper>(`papers/${id}`, "PUT", { sections }),
    addItem: (
      id: string,
      input: { question?: unknown; source_question_id?: string },
    ) => this.request<Paper>(`papers/${id}/items`, "POST", input),
    removeItem: (id: string, itemId: string) =>
      this.request<null>(`papers/${id}/items/${itemId}`, "DELETE"),
    followDiff: (id: string) =>
      this.request<FollowDiff[]>(`papers/${id}/follow-diff`),
    applyFollow: (id: string) =>
      this.request<Paper>(`papers/${id}/apply-follow`, "POST"),
  };
  tags = {
    list: (target_type?: "file" | "question") =>
      this.request<Tag[]>("tags", "GET", undefined, { target_type }),
    create: (input: Omit<Tag, "id" | "color"> & { color?: string | null }) =>
      this.request<Tag>("tags", "POST", input),
    updateColor: (id: string, color: string) =>
      this.request<Tag>(`tags/${id}`, "PUT", { color }),
  };
  sessions = {
    list: () => this.request<Session[]>("sessions"),
    get: (id: string) => this.request<Session>(`sessions/${id}`),
    start: (paper_id: string, mode: Session["mode"]) =>
      this.request<Session>("sessions", "POST", { paper_id, mode }),
    saveDraft: (
      id: string,
      input: {
        current_index?: number;
        question_id?: string;
        user_answer?: StudyAnswer;
      },
    ) => this.request<Session>(`sessions/${id}/draft`, "POST", input),
    submitQuestion: (
      id: string,
      input: {
        question_id: string;
        answer: StudyAnswer;
        attempt_index: number;
      },
    ) =>
      this.request<RecordView>(`sessions/${id}/submit-question`, "POST", input),
    submitExam: (
      id: string,
      answers: { question_id: string; answer: StudyAnswer }[],
    ) =>
      this.request<{ score: number }>(`sessions/${id}/submit-exam`, "POST", {
        answers,
      }),
    complete: (id: string) =>
      this.request<Session>(`sessions/${id}/complete`, "POST"),
    finishPractice: (id: string) =>
      this.request<Session>(`sessions/${id}/complete`, "POST"),
    pause: (id: string) =>
      this.request<Session>(`sessions/${id}/pause`, "POST"),
    resume: (id: string) =>
      this.request<Session>(`sessions/${id}/resume`, "POST"),
  };
  mistakes = {
    list: (query?: Query) =>
      this.request<Mistake[]>("mistakes", "GET", undefined, query),
    mastery: (id: string, mastery_status: Mistake["mastery_status"]) =>
      this.request<Mistake>(`mistakes/${id}/mastery`, "PUT", {
        mastery_status,
      }),
    createPaper: (ids: string[], name: string) =>
      this.request<Paper>("mistakes/create-paper", "POST", { ids, name }),
    manual: (session_id: string, study_record_id: string) =>
      this.request<Mistake>("mistakes", "POST", {
        session_id,
        study_record_id,
      }),
  };
  analytics = {
    getDashboard: () => this.request<Dashboard>("analytics/dashboard"),
  };
  trash = {
    list: () => this.request<TrashItem[]>("trash"),
    restore: (entity: TrashItem["entity"], id: string) =>
      this.request<null>(`trash/${entity}/${id}/restore`, "POST"),
    purge: (entity: TrashItem["entity"], id: string) =>
      this.request<null>(`trash/${entity}/${id}`, "DELETE"),
  };
  backup = {
    export: (
      entity: "folder" | "bank" | "paper",
      id: string,
      format = "quarry",
    ) =>
      this.request<Blob>(
        `export/${entity}/${id}`,
        "GET",
        undefined,
        { format },
        true,
      ),
    importPreview: (file: File) =>
      this.request<ImportPreview>("import/preview", "POST", this.file(file)),
    importCommit: (file: File) =>
      this.request<unknown>("import/commit", "POST", this.file(file)),
    backupCreate: () =>
      this.request<Blob>("backup/create", "POST", undefined, undefined, true),
    backupRestore: (file: File) =>
      this.request<unknown>("backup/restore", "POST", this.file(file)),
  };
  private file(file: File) {
    const form = new FormData();
    form.set("file", file);
    return form;
  }
  attachments = {
    upload: (file: File) =>
      this.request<{ id: string; url: string }>(
        "attachments",
        "POST",
        this.file(file),
      ),
    url: (id: string) => this.url(`attachments/${encodeURIComponent(id)}`),
  };
}
export const client = new BackendClient();
