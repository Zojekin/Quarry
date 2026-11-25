import { useMemo, useState } from "react";
import { ArrowRight, Calendar, Play, Sparkles, Trash2, Upload } from "lucide-react";
import logoUrl from "../assets/logo.svg";
import { client } from "../api/client.js";
import type { Dashboard, Mistake, Paper, Session } from "../api/client.js";
import { formatTime, type Route } from "../state.js";
import { QuestionPreview } from "../components/QuestionPreview.js";
import { CliGuideCard } from "../components/CliGuideCard.js";
import { DiagnosticsCard } from "../components/DiagnosticsCard.js";
import { PreferencesSettingsCard } from "../components/PreferencesSettingsCard.js";
import { TagManagerCard } from "../components/TagManagerCard.js";
import {
  Button,
  EmptyState,
  Facet,
  Notice,
  PromptDialog,
  SearchField,
  Segmented,
  StatusPill,
  types,
  useConfirmation,
  useLoad,
  useViewState,
} from "../components/ui.js";
import { Badge } from "../components/ui/badge.js";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card.js";
import { Checkbox } from "../components/ui/checkbox.js";
import { Input } from "../components/ui/input.js";
import { Popover, PopoverContent, PopoverTrigger } from "../components/ui/popover.js";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table.js";
import { cn } from "../lib/utils.js";
import { download } from "./Library.js";

function dateText(iso: string) {
  return new Date(iso).toLocaleDateString("zh-CN");
}

function buildHeatmapCells(
  year: number,
  metric: "answers" | "duration",
  days: Dashboard["daily_heatmap"],
) {
  const byDate = new Map(days.map((d) => [d.date, d]));
  const start = new Date(Date.UTC(year, 0, 1));
  const firstOffset = start.getUTCDay();
  const gridStart = new Date(Date.UTC(year, 0, 1 - firstOffset));
  const today = new Date().toISOString().slice(0, 10);

  const cells: {
    date: string;
    value: number;
    level: number;
    future: boolean;
    outsideYear: boolean;
  }[] = [];

  for (let i = 0; i < 371; i++) {
    const dt = new Date(gridStart.getTime() + i * 86400000);
    const iso = dt.toISOString().slice(0, 10);
    const item = byDate.get(iso);
    const value = item
      ? metric === "answers"
        ? item.count
        : Math.round(item.duration_seconds / 60)
      : 0;
    const level =
      value === 0
        ? 0
        : value <= (metric === "answers" ? 2 : 5)
          ? 1
          : value <= (metric === "answers" ? 6 : 15)
            ? 2
            : value <= (metric === "answers" ? 12 : 30)
              ? 3
              : 4;
    cells.push({
      date: iso,
      value,
      level,
      future: iso > today,
      outsideYear: dt.getUTCFullYear() !== year,
    });
  }
  return cells;
}

export function Home({ navigate }: { navigate: (route: Route) => void }) {
  const [metric, setMetric] = useState<"answers" | "duration">("answers");
  const [year, setYear] = useState(String(new Date().getUTCFullYear()));
  const [hoveredCell, setHoveredCell] = useState<{
    date: string;
    value: number;
  }>();

  const { data, error } = useLoad(
    () =>
      Promise.all([
        client.analytics.getDashboard(),
        client.sessions.list(),
        client.mistakes.list({ mastery_status: "reviewing" }),
        client.papers.list().catch(() => [] as Paper[]),
      ]),
    [],
  );

  const [dashboard, sessions = [], reviewingMistakes = [], papers = []] =
    data ?? [];
  const paperNames = new Map(papers.map((p) => [p.id, p.name]));
  const sessionTitle = (s: Session) =>
    paperNames.get(s.paper_id) ?? s.paper_name ?? "未命名套题";

  const pending = [...sessions]
    .filter((s) => s.status !== "completed")
    .sort((a, b) => Date.parse(b.start_time) - Date.parse(a.start_time));
  const leadSession = pending[0];
  const otherPending = pending.slice(1, 5);

  const years = useMemo(() => {
    const set = new Set<number>([new Date().getUTCFullYear()]);
    for (const d of dashboard?.daily_heatmap ?? []) {
      set.add(Number(d.date.slice(0, 4)));
    }
    return Array.from(set).sort((a, b) => b - a);
  }, [dashboard?.daily_heatmap]);

  const cells = useMemo(
    () =>
      buildHeatmapCells(Number(year), metric, dashboard?.daily_heatmap ?? []),
    [year, metric, dashboard?.daily_heatmap],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="m-0 font-serif text-[28px] font-semibold tracking-[-0.02em] text-foreground">
            学习概览
          </h1>
          <p className="m-0 mt-1 text-[13.5px] text-muted-foreground">
            把刷题记录、专注续答与错题巩固收敛在同一张平静工作台上
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate({ page: "library" })}
        >
          进入题库与套题
          <ArrowRight className="size-3.5" />
        </Button>
      </div>

      <Notice error={error} loading={!data && !error} />

      {data && (
        <>
          {/* Focus-First Resume Hero Bar (Above the fold at 960×760) */}
          {leadSession && (
            <Card className="border-primary/25 bg-card p-5">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusPill
                      state={
                        leadSession.status === "paused" ? "paused" : "in_progress"
                      }
                    >
                      {leadSession.status === "paused" ? "已暂停" : "进行中"}
                    </StatusPill>
                    <Badge variant="outline">
                      {leadSession.mode === "exam" ? "考试模式" : "练习模式"}
                    </Badge>
                    <span className="text-[12.5px] text-muted-foreground tabular-nums">
                      已用时{" "}
                      <span data-dynamic-date="duration">
                        {formatTime(leadSession.effective_duration_seconds)}
                      </span>
                    </span>
                  </div>
                  <h2 className="m-0 truncate font-serif text-[20px] font-semibold text-foreground">
                    {sessionTitle(leadSession)}
                  </h2>
                </div>
                <Button
                  variant="default"
                  onClick={() => navigate({ page: "study", id: leadSession.id })}
                >
                  <Play className="size-3.5" />
                  继续作答
                </Button>
              </div>
            </Card>
          )}

          {/* Unified KPI + Heatmap Composite Card */}
          <Card className="p-5">
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
              <div>
                <div className="text-[12.5px] font-medium text-muted-foreground">
                  累计作答次数
                </div>
                <div className="mt-1 font-serif text-[32px] leading-tight font-normal text-foreground tabular-nums">
                  {dashboard?.total_questions_answered ?? 0}
                </div>
              </div>
              <div>
                <div className="text-[12.5px] font-medium text-muted-foreground">
                  去重覆盖题数
                </div>
                <div className="mt-1 font-serif text-[32px] leading-tight font-normal text-primary tabular-nums">
                  {dashboard?.deduplicated_questions_count ?? 0}
                </div>
              </div>
              <div>
                <div className="text-[12.5px] font-medium text-muted-foreground">
                  累计专注时长
                </div>
                <div
                  className="mt-1 font-serif text-[32px] leading-tight font-normal text-foreground tabular-nums"
                  data-dynamic-date="duration"
                >
                  {formatTime(dashboard?.total_duration_seconds ?? 0)}
                </div>
              </div>
            </div>

            <div className="mt-6 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <h2 className="m-0 text-[14.5px] font-semibold text-foreground">
                    学习热力图
                  </h2>
                  {hoveredCell && (
                    <span className="text-[12px] text-muted-foreground tabular-nums">
                      {hoveredCell.date}：{hoveredCell.value}{" "}
                      {metric === "answers" ? "题" : "分钟"}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    aria-label="年份"
                    value={year}
                    onChange={(e) => setYear(e.target.value)}
                    className="h-8 rounded-md border border-input bg-card px-2.5 text-[13px] font-medium text-foreground shadow-[0_1px_2px_rgba(23,27,25,0.04)] outline-none focus-visible:border-primary"
                  >
                    {years.map((y) => (
                      <option key={y} value={String(y)}>
                        {y} 年
                      </option>
                    ))}
                  </select>
                  <Segmented
                    label="统计维度"
                    options={[
                      ["answers", "作答量"],
                      ["duration", "用时"],
                    ]}
                    value={metric}
                    onChange={(v) => setMetric(v as "answers" | "duration")}
                  />
                </div>
              </div>

              <div className="overflow-x-auto pb-1">
                <div className="w-full">
                  <div className="quarry-heat-months">
                    {[
                      "1月",
                      "2月",
                      "3月",
                      "4月",
                      "5月",
                      "6月",
                      "7月",
                      "8月",
                      "9月",
                      "10月",
                      "11月",
                      "12月",
                    ].map((m) => (
                      <span key={m}>{m}</span>
                    ))}
                  </div>
                  <div
                    className="quarry-heat-grid heat-grid"
                    role="grid"
                    aria-label="年度学习热力图"
                  >
                    {cells.map((cell) => (
                      <i
                        key={cell.date}
                        title={`${cell.date}: ${cell.value}`}
                        data-outside-year={cell.outsideYear ? "true" : undefined}
                        className={cn(
                          cell.future
                            ? "future"
                            : cell.level > 0
                              ? `lv${cell.level}`
                              : "",
                        )}
                        onMouseEnter={() =>
                          setHoveredCell({ date: cell.date, value: cell.value })
                        }
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {/* Lower Two-Column Summary on Canvas */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card className="p-5">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="m-0 text-[15px] font-semibold text-foreground">
                  待续会话
                </h2>
                <span className="text-[12px] text-muted-foreground tabular-nums">
                  {pending.length} 条
                </span>
              </div>
              {pending.length === 0 ? (
                <p className="m-0 py-4 text-[13px] text-muted-foreground">
                  当前没有未完成的练习或考试。前往题库与套题挑选一套开始吧。
                </p>
              ) : (
                <div className="space-y-2">
                  {(otherPending.length > 0 ? otherPending : pending.slice(0, 3)).map(
                    (s) => (
                      <div
                        key={s.id}
                        className="flex items-center justify-between gap-3 rounded-lg bg-muted/45 px-3.5 py-2.5"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[13.5px] font-medium text-foreground">
                            {sessionTitle(s)}
                          </div>
                          <div className="mt-0.5 text-[12px] text-muted-foreground tabular-nums">
                            {s.mode === "exam" ? "考试" : "练习"} ·{" "}
                            <span data-dynamic-date="duration">
                              {formatTime(s.effective_duration_seconds)}
                            </span>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => navigate({ page: "study", id: s.id })}
                        >
                          继续
                        </Button>
                      </div>
                    ),
                  )}
                </div>
              )}
            </Card>

            <Card className="p-5">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="m-0 text-[15px] font-semibold text-foreground">
                  待复习错题
                </h2>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate({ page: "mistakes" })}
                >
                  前往错题本
                  <ArrowRight className="size-3.5" />
                </Button>
              </div>
              {reviewingMistakes.length === 0 ? (
                <p className="m-0 py-4 text-[13px] text-muted-foreground">
                  所有错题均已掌握，继续保持好状态。
                </p>
              ) : (
                <div className="space-y-2">
                  {reviewingMistakes.slice(0, 4).map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => navigate({ page: "mistakes" })}
                      className="flex w-full items-center justify-between gap-3 rounded-lg bg-muted/45 px-3.5 py-2.5 text-left transition-colors hover:bg-muted"
                    >
                      <span className="min-w-0 flex-1 truncate text-[13.5px] text-foreground">
                        {m.question_snapshot.content}
                      </span>
                      <span className="shrink-0 text-[12px] text-muted-foreground tabular-nums">
                        错 {m.wrong_count} 次
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

export function Records({ navigate }: { navigate: (route: Route) => void }) {
  const [status, setStatus] = useViewState<
    "all" | "completed" | "in_progress" | "paused"
  >("records-status", "all");
  const [modeFilter, setModeFilter] = useViewState<string[] | undefined>(
    "records-mode",
    undefined,
  );
  const [search, setSearch] = useViewState("records-search", "");

  const { data, error } = useLoad(
    () =>
      Promise.all([
        client.sessions.list(),
        client.papers.list().catch(() => [] as Paper[]),
      ]),
    [],
  );

  const [sessions = [], papers = []] = data ?? [];
  const paperMap = new Map(papers.map((p) => [p.id, p]));

  const rows = [...sessions]
    .sort((a, b) => Date.parse(b.start_time) - Date.parse(a.start_time))
    .filter((s) => {
      const title = paperMap.get(s.paper_id)?.name ?? s.paper_name ?? "";
      const matchStatus = status === "all" || s.status === status;
      const matchMode = modeFilter === undefined || modeFilter.includes(s.mode);
      const matchSearch =
        !search || title.toLowerCase().includes(search.toLowerCase());
      return matchStatus && matchMode && matchSearch;
    });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="m-0 font-serif text-[26px] font-semibold tracking-[-0.02em]">
          练习记录
        </h1>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Segmented
            label="状态筛选"
            options={[
              ["all", "全部"],
              ["completed", "已完成"],
              ["in_progress", "进行中"],
              ["paused", "已暂停"],
            ]}
            value={status}
            onChange={(v) => setStatus(v as typeof status)}
          />
          <Facet
            label="作答模式"
            options={[
              { id: "practice", name: "练习" },
              { id: "exam", name: "考试" },
            ]}
            value={modeFilter}
            onChange={setModeFilter}
          />
        </div>
        <SearchField
          label="搜索套题名称"
          value={search}
          onChange={setSearch}
        />
      </div>

      <Notice error={error} loading={!data && !error} />

      {data && rows.length === 0 && (
        <EmptyState
          title="没有符合条件的作答记录"
          detail="尝试切换筛选条件，或到题库与套题中开始一次新的练习。"
        />
      )}

      {data && rows.length > 0 && (
        <Table aria-label="作答记录列表">
          <TableHeader>
            <TableRow>
              <TableHead>套题名称</TableHead>
              <TableHead className="w-24">模式</TableHead>
              <TableHead className="w-28">状态</TableHead>
              <TableHead className="w-24">已答 / 总题</TableHead>
              <TableHead className="w-24">用时</TableHead>
              <TableHead className="w-28">开始时间</TableHead>
              <TableHead className="w-28 text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((s) => {
              const completed = s.status === "completed";
              const title = paperMap.get(s.paper_id)?.name ?? s.paper_name ?? "套题作答";
              return (
                <TableRow key={s.id}>
                  <TableCell className="font-medium text-foreground">
                    {title}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {s.mode === "exam" ? "考试" : "练习"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <StatusPill state={s.status}>
                      {completed
                        ? "已完成"
                        : s.status === "paused"
                          ? "已暂停"
                          : "进行中"}
                    </StatusPill>
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {new Set(s.records.map((r) => r.question_id)).size} /{" "}
                    {s.items.length}
                  </TableCell>
                  <TableCell className="tabular-nums">
                    <span data-dynamic-date="duration">
                      {formatTime(s.effective_duration_seconds)}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground tabular-nums">
                    <span data-dynamic-date="date">
                      {dateText(s.start_time)}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        navigate({
                          page: completed ? "result" : "study",
                          id: s.id,
                        })
                      }
                    >
                      {completed ? "查看报告" : "继续作答"}
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

export function Mistakes({
  navigate,
  onChanged,
}: {
  navigate: (route: Route) => void;
  onChanged: () => void;
}) {
  const [mastery, setMastery] = useViewState<"reviewing" | "mastered" | "all">(
    "mistakes-mastery",
    "reviewing",
  );
  const [paperFilter, setPaperFilter] = useViewState<string[] | undefined>(
    "mistakes-paper",
    undefined,
  );
  const [folderFilter, setFolderFilter] = useViewState<string[] | undefined>(
    "mistakes-folder",
    undefined,
  );
  const [tagFilter, setTagFilter] = useViewState<string[] | undefined>(
    "mistakes-tag",
    undefined,
  );
  const [typeFilter, setTypeFilter] = useViewState<string[] | undefined>(
    "mistakes-type",
    undefined,
  );
  const [dateFrom, setDateFrom] = useViewState("mistakes-from", "");
  const [dateTo, setDateTo] = useViewState("mistakes-to", "");
  const [search, setSearch] = useViewState("mistakes-search", "");
  const [selected, setSelected] = useState<string[]>([]);
  const [inspectId, setInspectId] = useState<string>();
  const [reveal, setReveal] = useState(true);
  const [naming, setNaming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const { data, error, reload } = useLoad(
    () =>
      Promise.all([
        client.mistakes.list({
          mastery_status: mastery,
          source_paper_ids: paperFilter,
          folder_ids: folderFilter,
          tag_ids: tagFilter,
          types: typeFilter,
          date_from: dateFrom || undefined,
          date_to: dateTo || undefined,
          search: search || undefined,
        }),
        client.papers.list(),
        client.folders.list(),
        client.tags.list("question"),
      ]),
    [
      mastery,
      JSON.stringify(paperFilter),
      JSON.stringify(folderFilter),
      JSON.stringify(tagFilter),
      JSON.stringify(typeFilter),
      dateFrom,
      dateTo,
      search,
    ],
  );

  const [mistakes = [], papers = [], folders = [], qTags = []] = data ?? [];
  const inspected = mistakes.find((m) => m.id === inspectId) ?? mistakes[0];
  const validSelected = selected.filter((id) =>
    mistakes.some((m) => m.id === id),
  );

  async function toggleMastery(m: Mistake) {
    setBusy(true);
    try {
      await client.mistakes.mastery(
        m.id,
        m.mastery_status === "reviewing" ? "mastered" : "reviewing",
      );
      onChanged();
      reload();
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function createReviewPaper(name: string) {
    setBusy(true);
    try {
      const created = await client.mistakes.createPaper(validSelected, name);
      setNaming(false);
      setSelected([]);
      navigate({ page: "paper", id: created.id });
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="m-0 font-serif text-[26px] font-semibold tracking-[-0.02em]">
          错题本
        </h1>
        <Button
          variant="default"
          disabled={validSelected.length === 0 || busy}
          onClick={() => setNaming(true)}
        >
          <Sparkles className="size-3.5" />
          生成错题复习套题
        </Button>
      </div>

      {/* Single-Row Facet Filters */}
      <div className="mistake-filter-row flex flex-wrap items-center gap-2">
        <Segmented
          label="掌握状态"
          options={[
            ["reviewing", "待复习"],
            ["mastered", "已掌握"],
            ["all", "全部"],
          ]}
          value={mastery}
          onChange={(v) => setMastery(v as typeof mastery)}
        />
        <Facet
          label="来源套题"
          options={papers.map((p) => ({ id: p.id, name: p.name }))}
          value={paperFilter}
          onChange={setPaperFilter}
        />
        <Facet
          label="文件夹"
          options={folders.map((f) => ({ id: f.id, name: f.name }))}
          value={folderFilter}
          onChange={setFolderFilter}
        />
        <Facet
          label="题目标签"
          options={qTags}
          value={tagFilter}
          onChange={setTagFilter}
        />
        <Facet
          label="题型"
          options={types}
          value={typeFilter}
          onChange={setTypeFilter}
        />
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn(
                (dateFrom || dateTo) && "border-primary/35 bg-accent/70",
              )}
            >
              <Calendar className="size-3.5" />
              日期
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-64 space-y-3 p-3.5">
            <label className="block space-y-1 text-[12.5px] font-medium">
              <span>起始日期</span>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </label>
            <label className="block space-y-1 text-[12.5px] font-medium">
              <span>结束日期</span>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </label>
            {(dateFrom || dateTo) && (
              <Button
                size="sm"
                variant="ghost"
                className="w-full"
                onClick={() => {
                  setDateFrom("");
                  setDateTo("");
                }}
              >
                清除日期筛选
              </Button>
            )}
          </PopoverContent>
        </Popover>
        <SearchField label="搜索错题" value={search} onChange={setSearch} />
      </div>

      <Notice error={error || message} loading={!data && !error} />

      {data && mistakes.length === 0 && (
        <EmptyState
          title="没有匹配的错题"
          detail="调整筛选条件，或完成套题作答后在错题本中回顾错题。"
        />
      )}

      {data && mistakes.length > 0 && (
        <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
          <div className="space-y-2.5">
            {mistakes.map((m) => {
              const active = inspected?.id === m.id;
              const isChecked = validSelected.includes(m.id);
              const q = m.question_snapshot;
              const qType =
                types.find((t) => t.id === q.type)?.name ?? q.type;
              return (
                <Card
                  key={m.id}
                  onClick={() => setInspectId(m.id)}
                  className={cn(
                    "mistake-row cursor-pointer p-4 transition-all hover:border-black/15",
                    active && "border-primary/45 ring-1 ring-primary/20",
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className="pt-0.5" onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        aria-label={`选择错题 ${q.content}`}
                        checked={isChecked}
                        onCheckedChange={(checked) =>
                          setSelected((prev) =>
                            checked
                              ? Array.from(new Set([...prev, m.id]))
                              : prev.filter((id) => id !== m.id),
                          )
                        }
                      />
                    </div>
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-1.5 text-[12px]">
                        <StatusPill state={m.mastery_status}>
                          {m.mastery_status === "mastered" ? "已掌握" : "待复习"}
                        </StatusPill>
                        <Badge variant="outline">{qType}</Badge>
                        {m.source_paper_name && (
                          <span className="truncate text-muted-foreground">
                            来自 {m.source_paper_name}
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        aria-pressed={active}
                        aria-label={`预览错题 ${q.content}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setInspectId(m.id);
                        }}
                        className="line-clamp-2 block w-full text-left font-serif text-[15.5px] leading-relaxed font-normal text-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:underline"
                      >
                        {q.content}
                      </button>
                      <div className="flex flex-wrap items-center gap-3 text-[12px] text-muted-foreground tabular-nums">
                        <span>错误 {m.wrong_count} 次</span>
                        <span>
                          加入{" "}
                          <span data-dynamic-date="date">
                            {dateText(m.created_at)}
                          </span>
                        </span>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={(e) => {
                        e.stopPropagation();
                        void toggleMastery(m);
                      }}
                    >
                      {m.mastery_status === "reviewing"
                        ? "标记已掌握"
                        : "标记待复习"}
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>

          {inspected && (
            <Card className="p-5 lg:sticky lg:top-16">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h2 className="m-0 text-[15px] font-semibold">题目预览</h2>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setReveal((r) => !r)}
                >
                  {reveal ? "收起解析" : "展开解析"}
                </Button>
              </div>
              <QuestionPreview
                question={inspected.question_snapshot}
                reveal={reveal}
              />
              <div className="mt-5 space-y-2 border-t border-border pt-4">
                <div className="text-[12.5px] font-semibold text-muted-foreground">
                  历史作答记录（{inspected.history.length} 次）
                </div>
                <div className="space-y-1.5">
                  {inspected.history.map((h, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between gap-2 rounded-md bg-muted/45 px-3 py-1.5 text-[12px] tabular-nums"
                    >
                      <span data-dynamic-date="timestamp">
                        {new Date(h.answered_at).toLocaleString("zh-CN")}
                      </span>
                      {h.source_paper_name && (
                        <span className="truncate text-muted-foreground">
                          {h.source_paper_name}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          )}
        </div>
      )}

      {naming && (
        <PromptDialog
          title="保存复习套题"
          label="复习套题名称"
          initialValue={`错题巩固 ${new Date().toLocaleDateString("zh-CN")}`}
          onClose={() => setNaming(false)}
          onAccept={(name) => void createReviewPaper(name)}
        />
      )}
    </div>
  );
}

export function Settings() {
  const [restoreRevision, setRestoreRevision] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const confirm = useConfirmation();

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="m-0 font-serif text-[26px] font-semibold tracking-[-0.02em]">
          系统设置
        </h1>
      </div>

      <Notice error={message} loading={false} />
      <TagManagerCard key={restoreRevision} />

      {/* Backup & About Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <img
              src={logoUrl}
              alt="题匣标志"
              className="size-10 rounded-lg border border-border object-contain p-1"
            />
            <div>
              <CardTitle>{__PRODUCT__.name}</CardTitle>
              <CardDescription>
                版本 {__PRODUCT__.version} · 本地隐私离线题库工作台
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-2.5 pt-2">
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => {
              setBusy(true);
              void client.backup
                .backupCreate()
                .then((blob) =>
                  download(
                    blob,
                    `quarry-backup-${new Date().toISOString().slice(0, 10)}.quarry-backup`,
                  ),
                )
                .catch((e) => setMessage((e as Error).message))
                .finally(() => setBusy(false));
            }}
          >
            完整备份
          </Button>
          <label className="file-input-button">
            <Upload className="size-3.5" />
            <span>恢复备份</span>
            <input
              type="file"
              accept=".zip,.quarry-backup"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (!file) return;
                confirm.ask(
                  "完整恢复将用备份文件覆盖当前全部本地数据，确认继续吗？",
                  () => {
                    setBusy(true);
                    void client.backup
                      .backupRestore(file)
                      .then(() => {
                        setMessage("恢复完成，请刷新页面");
                        setRestoreRevision((revision) => revision + 1);
                      })
                      .catch((e) => setMessage((e as Error).message))
                      .finally(() => setBusy(false));
                  },
                );
              }}
            />
          </label>
        </CardContent>
      </Card>
      <PreferencesSettingsCard />
      <CliGuideCard />
      <DiagnosticsCard />
      {confirm.dialog}
    </div>
  );
}

const trashLabels = {
  folders: "文件夹",
  question_banks: "题库",
  papers: "套题",
  questions: "题目",
} as const;

export function Trash({ onChanged }: { onChanged: () => void }) {
  const { data, error, reload } = useLoad(() => client.trash.list(), []);
  const [message, setMessage] = useState("");
  const confirm = useConfirmation();

  return (
    <div className="space-y-5">
      <div>
        <h1 className="m-0 font-serif text-[26px] font-semibold tracking-[-0.02em]">
          回收站
        </h1>
      </div>

      <Notice error={error || message} loading={!data && !error} />

      {data && data.length === 0 && (
        <EmptyState
          title="回收站为空"
          detail="被删除的文件夹、题库与套题会暂时存放在这里。"
        />
      )}

      {data && data.length > 0 && (
        <Table aria-label="回收站项目">
          <TableHeader>
            <TableRow>
              <TableHead>名称</TableHead>
              <TableHead className="w-24">类型</TableHead>
              <TableHead className="w-40 text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((item) => {
              const title = item.name ?? item.stem ?? "未命名项目";
              return (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{title}</TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {trashLabels[item.entity]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="inline-flex items-center justify-end gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          void client.trash
                            .restore(item.entity, item.id)
                            .then(() => {
                              onChanged();
                              reload();
                            })
                            .catch((e) => setMessage((e as Error).message))
                        }
                      >
                        恢复
                      </Button>
                      <Button
                        size="sm"
                        variant="destructiveGhost"
                        onClick={() =>
                          confirm.ask(
                            `确认永久删除「${title}」吗？此操作不可撤销。`,
                            () =>
                              void client.trash
                                .purge(item.entity, item.id)
                                .then(() => {
                                  onChanged();
                                  reload();
                                })
                                .catch((e) => setMessage((e as Error).message)),
                          )
                        }
                      >
                        <Trash2 className="size-3.5" />
                        永久删除
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
      {confirm.dialog}
    </div>
  );
}
