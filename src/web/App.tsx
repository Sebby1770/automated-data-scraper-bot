import {
  Activity,
  AlertTriangle,
  Bell,
  Braces,
  CheckCircle2,
  ClipboardCopy,
  Clock3,
  Database,
  Download,
  ExternalLink,
  History,
  Loader2,
  Play,
  RefreshCw,
  Rss,
  Search,
  Shield,
  ShoppingBag,
  TrendingUp,
  Wand2,
  X
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

type SourceType = "html" | "rss" | "stooq" | "json";
type NotifierType = "console" | "discord" | "telegram" | "slack";
type TestableNotifierType = "discord" | "telegram" | "slack";
type RuleOperator = "<" | "<=" | ">" | ">=" | "==" | "!=" | "contains" | "not_contains" | "regex" | "exists";

interface DashboardSource {
  id: string;
  type: SourceType;
  label: string;
  target: string;
  detail: string;
  fieldCount?: number;
}

interface DashboardRule {
  name: string;
  source: string;
  allCount: number;
  anyCount: number;
  message?: string;
}

interface DashboardNotifier {
  type: NotifierType;
  enabled: boolean;
  ready: boolean;
  missingEnv: string[];
}

interface DashboardConfig {
  loadedAt: string;
  secured: boolean;
  settings: {
    runIntervalSeconds: number;
    maxConcurrency: number;
    requestTimeoutMs: number;
    stateTtlDays: number;
  };
  sources: DashboardSource[];
  rules: DashboardRule[];
  notifiers: DashboardNotifier[];
  cronSchedule?: string;
}

interface AlertItem {
  id: string;
  ruleName: string;
  sourceLabel: string;
  title: string;
  url?: string;
  message: string;
  matchedAt: string;
}

interface SourceHealth {
  sourceId: string;
  sourceLabel: string;
  lastFetchAt: string;
  itemCount: number;
  error?: string;
}

interface RunSummary {
  startedAt: string;
  finishedAt: string;
  sourceCount: number;
  itemCount: number;
  matchedCount: number;
  alertCount: number;
  errors: string[];
  sourceHealth?: SourceHealth[];
  alerts?: AlertItem[];
}

interface ConfigValidationResult {
  valid: boolean;
  warnings: string[];
  errors: string[];
}

interface ApiResponse<T> {
  ok: boolean;
  data?: T;
  error?: string;
}

interface RunResult {
  dryRun: boolean;
  summary: RunSummary;
}

interface RunHistoryEntry {
  id: string;
  startedAt: string;
  finishedAt: string;
  dryRun: boolean;
  durationMs: number;
  itemCount: number;
  matchedCount: number;
  alertCount: number;
  errorCount: number;
}

const RUN_HISTORY_KEY = "scraperRunHistory";
const MAX_RUN_HISTORY = 10;

const sourceIcons: Record<SourceType, typeof ShoppingBag> = {
  html: ShoppingBag,
  rss: Rss,
  stooq: TrendingUp,
  json: Braces
};

const sourceTone: Record<SourceType, string> = {
  html: "tone-teal",
  rss: "tone-amber",
  stooq: "tone-blue",
  json: "tone-violet"
};

const ruleOperators: RuleOperator[] = ["<", "<=", ">", ">=", "==", "!=", "contains", "not_contains", "regex", "exists"];

export function App() {
  const [config, setConfig] = useState<DashboardConfig | null>(null);
  const [runResult, setRunResult] = useState<RunResult | null>(null);
  const [runHistory, setRunHistory] = useState<RunHistoryEntry[]>(() => loadRunHistory());
  const [status, setStatus] = useState<"idle" | "loading" | "running">("loading");
  const [error, setError] = useState<string | null>(null);
  const [dryRun, setDryRun] = useState(true);
  const [secret, setSecret] = useState(() => window.localStorage.getItem("dashboardSecret") ?? "");
  const [ruleFilter, setRuleFilter] = useState("");
  const [validation, setValidation] = useState<ConfigValidationResult | null>(null);
  const [validating, setValidating] = useState(false);
  const [testingNotifier, setTestingNotifier] = useState<TestableNotifierType | null>(null);
  const [ruleBuilderOpen, setRuleBuilderOpen] = useState(false);
  const [ruleDraft, setRuleDraft] = useState({
    name: "",
    source: "",
    field: "price",
    operator: "<=" as RuleOperator,
    value: "",
    message: ""
  });
  const [copyStatus, setCopyStatus] = useState<string | null>(null);

  const readyNotifiers = useMemo(() => config?.notifiers.filter((notifier) => notifier.ready).length ?? 0, [config]);
  const lastRunMs = useMemo(() => {
    if (!runResult) {
      return undefined;
    }

    return new Date(runResult.summary.finishedAt).getTime() - new Date(runResult.summary.startedAt).getTime();
  }, [runResult]);

  const filteredRules = useMemo(() => {
    const rules = config?.rules ?? [];
    const query = ruleFilter.trim().toLowerCase();
    if (!query) {
      return rules;
    }

    return rules.filter((rule) => {
      const haystack = [rule.name, rule.source, rule.message ?? ""].join(" ").toLowerCase();
      return haystack.includes(query);
    });
  }, [config?.rules, ruleFilter]);

  useEffect(() => {
    void refreshConfig();
  }, []);

  async function refreshConfig() {
    setStatus("loading");
    setError(null);

    try {
      const response = await fetch("/api/config");
      const payload = (await response.json()) as ApiResponse<DashboardConfig>;
      if (!payload.ok || !payload.data) {
        throw new Error(payload.error ?? "Unable to load dashboard config");
      }
      setConfig(payload.data);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setStatus("idle");
    }
  }

  const runScrape = useCallback(async () => {
    setStatus("running");
    setError(null);
    window.localStorage.setItem("dashboardSecret", secret);

    try {
      const response = await fetch("/api/run", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(secret ? { "x-dashboard-secret": secret } : {})
        },
        body: JSON.stringify({ dryRun })
      });
      const payload = (await response.json()) as ApiResponse<RunResult>;
      if (!payload.ok || !payload.data) {
        throw new Error(payload.error ?? "Scrape failed");
      }

      setRunResult(payload.data);
      const entry = createHistoryEntry(payload.data);
      setRunHistory((previous) => {
        const nextHistory = [entry, ...previous].slice(0, MAX_RUN_HISTORY);
        saveRunHistory(nextHistory);
        return nextHistory;
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setStatus("idle");
    }
  }, [dryRun, secret]);

  async function validateConfig() {
    setValidating(true);
    setError(null);

    try {
      const response = await fetch("/api/config/validate");
      const payload = (await response.json()) as ApiResponse<ConfigValidationResult>;
      if (!payload.ok || !payload.data) {
        throw new Error(payload.error ?? "Config validation failed");
      }
      setValidation(payload.data);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setValidating(false);
    }
  }

  async function testNotifier(type: TestableNotifierType) {
    setTestingNotifier(type);
    setError(null);
    window.localStorage.setItem("dashboardSecret", secret);

    try {
      const response = await fetch("/api/test-notifier", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(secret ? { "x-dashboard-secret": secret } : {})
        },
        body: JSON.stringify({ type })
      });
      const payload = (await response.json()) as ApiResponse<{ type: TestableNotifierType; sentAt: string }>;
      if (!payload.ok) {
        throw new Error(payload.error ?? "Notifier test failed");
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setTestingNotifier(null);
    }
  }

  async function copyRuleYaml() {
    const yaml = buildRuleYaml(ruleDraft);
    await navigator.clipboard.writeText(yaml);
    setCopyStatus("Rule YAML copied to clipboard");
    setTimeout(() => setCopyStatus(null), 2500);
  }

  const isBusy = status === "loading" || status === "running" || validating;

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.ctrlKey && event.key === "Enter" && !isBusy) {
        event.preventDefault();
        void runScrape();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isBusy, runScrape]);

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-lockup">
          <span className="brand-mark">
            <Activity size={22} aria-hidden="true" />
          </span>
          <div>
            <h1>Scraper Bot Console</h1>
            <p>{config ? `${config.sources.length} sources · ${config.rules.length} rules` : "Loading bot config"}</p>
          </div>
        </div>

        <div className="action-row">
          {config?.secured ? (
            <label className="secret-field">
              <Shield size={16} aria-hidden="true" />
              <input
                aria-label="Dashboard secret"
                type="password"
                placeholder="Dashboard secret"
                value={secret}
                onChange={(event) => setSecret(event.target.value)}
              />
            </label>
          ) : null}

          <div className="segmented" aria-label="Run mode">
            <button className={dryRun ? "active" : ""} type="button" onClick={() => setDryRun(true)}>
              Dry run
            </button>
            <button className={!dryRun ? "active" : ""} type="button" onClick={() => setDryRun(false)}>
              Live alerts
            </button>
          </div>

          <button className="secondary-button" type="button" onClick={validateConfig} disabled={isBusy}>
            {validating ? <Loader2 className="spin" size={16} aria-hidden="true" /> : <Shield size={16} aria-hidden="true" />}
            Validate config
          </button>
          <button className="secondary-button" type="button" onClick={() => setRuleBuilderOpen(true)} disabled={!config}>
            <Wand2 size={16} aria-hidden="true" />
            Rule builder
          </button>
          <button className="icon-button" type="button" title="Refresh config" onClick={refreshConfig} disabled={isBusy}>
            <RefreshCw size={18} aria-hidden="true" />
          </button>
          <button className="primary-button" type="button" onClick={runScrape} disabled={isBusy} title="Run scrape (Ctrl+Enter)">
            {status === "running" ? <Loader2 className="spin" size={18} aria-hidden="true" /> : <Play size={18} aria-hidden="true" />}
            Run Scrape
          </button>
        </div>
      </header>

      {error ? (
        <section className="status-banner error" role="alert">
          <AlertTriangle size={18} aria-hidden="true" />
          <span>{error}</span>
        </section>
      ) : null}

      {validation ? (
        <section className={`status-banner ${validation.valid ? "ok" : "error"}`} role="status">
          {validation.valid ? <CheckCircle2 size={18} aria-hidden="true" /> : <AlertTriangle size={18} aria-hidden="true" />}
          <div className="validation-copy">
            <strong>{validation.valid ? "Config looks valid" : "Config has errors"}</strong>
            {validation.errors.length > 0 ? (
              <ul>
                {validation.errors.map((issue) => (
                  <li key={issue}>{issue}</li>
                ))}
              </ul>
            ) : null}
            {validation.warnings.length > 0 ? (
              <ul className="warning-list">
                {validation.warnings.map((issue) => (
                  <li key={issue}>{issue}</li>
                ))}
              </ul>
            ) : null}
          </div>
        </section>
      ) : null}

      {copyStatus ? (
        <section className="status-banner ok" role="status">
          <CheckCircle2 size={18} aria-hidden="true" />
          <span>{copyStatus}</span>
        </section>
      ) : null}

      <section className="metric-grid" aria-label="Bot overview">
        <Metric icon={Database} label="Sources" value={config?.sources.length ?? "—"} accent="teal" />
        <Metric icon={Search} label="Rules" value={config?.rules.length ?? "—"} accent="blue" />
        <Metric icon={Bell} label="Ready Notifiers" value={`${readyNotifiers}/${config?.notifiers.length ?? 0}`} accent="rose" />
        <Metric
          icon={Clock3}
          label="Last Run"
          value={runResult ? formatDuration(lastRunMs ?? 0) : "Not run"}
          detail={runResult ? formatTimestamp(runResult.summary.finishedAt) : undefined}
          accent="amber"
        />
      </section>

      <section className="workspace-grid">
        <div className="panel wide-panel">
          <div className="panel-heading">
            <div>
              <h2>Sources</h2>
              <p>{config?.cronSchedule ? `Cron ${config.cronSchedule}` : "Local scheduler ready"}</p>
            </div>
          </div>
          <SourceTable sources={config?.sources ?? []} />
        </div>

        <div className="panel">
          <div className="panel-heading">
            <div>
              <h2>Notifiers</h2>
              <p>{config?.settings.runIntervalSeconds ? `${config.settings.runIntervalSeconds}s interval` : "Waiting for config"}</p>
            </div>
          </div>
          <NotifierList
            notifiers={config?.notifiers ?? []}
            testingNotifier={testingNotifier}
            onTest={testNotifier}
          />
        </div>

        <div className="panel">
          <div className="panel-heading">
            <div>
              <h2>Source Health</h2>
              <p>{runResult?.summary.sourceHealth?.length ? "Latest run per source" : "Run a scrape to populate health"}</p>
            </div>
          </div>
          <SourceHealthPanel health={runResult?.summary.sourceHealth ?? []} />
        </div>

        <div className="panel wide-panel">
          <div className="panel-heading">
            <div>
              <h2>Rules</h2>
              <p>
                {config
                  ? `${filteredRules.length} of ${config.rules.length} rules · ${config.settings.maxConcurrency} concurrent checks`
                  : "Waiting for config"}
              </p>
            </div>
            <label className="filter-field">
              <Search size={16} aria-hidden="true" />
              <input
                aria-label="Filter rules"
                type="search"
                placeholder="Filter rules…"
                value={ruleFilter}
                onChange={(event) => setRuleFilter(event.target.value)}
              />
            </label>
          </div>
          <RuleTable rules={filteredRules} />
        </div>

        <div className="panel">
          <div className="panel-heading">
            <div>
              <h2>Run History</h2>
              <p>Last {MAX_RUN_HISTORY} runs stored locally</p>
            </div>
            <History size={18} aria-hidden="true" />
          </div>
          <RunHistoryPanel history={runHistory} />
        </div>

        <div className="panel result-panel" data-testid="run-results">
          <div className="panel-heading">
            <div>
              <h2>Run Output</h2>
              <p>{runResult ? (runResult.dryRun ? "Dry run" : "Live alerts") : "No run yet"}</p>
            </div>
            {runResult ? <StatusPill ok={runResult.summary.errors.length === 0} /> : null}
          </div>
          <RunOutput result={runResult} />
        </div>
      </section>

      {ruleBuilderOpen ? (
        <RuleBuilderModal
          sources={config?.sources ?? []}
          draft={ruleDraft}
          onChange={setRuleDraft}
          onClose={() => setRuleBuilderOpen(false)}
          onCopy={copyRuleYaml}
        />
      ) : null}
    </main>
  );
}

function Metric(props: {
  icon: typeof Database;
  label: string;
  value: string | number;
  detail?: string;
  accent: "teal" | "blue" | "rose" | "amber";
}) {
  const Icon = props.icon;
  return (
    <div className={`metric metric-${props.accent}`}>
      <Icon size={20} aria-hidden="true" />
      <span>{props.label}</span>
      <strong>{props.value}</strong>
      {props.detail ? <small className="metric-detail">{props.detail}</small> : null}
    </div>
  );
}

function SourceTable({ sources }: { sources: DashboardSource[] }) {
  if (sources.length === 0) {
    return <EmptyState label="No sources loaded" />;
  }

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Source</th>
            <th>Target</th>
            <th>Detail</th>
          </tr>
        </thead>
        <tbody>
          {sources.map((source) => {
            const Icon = sourceIcons[source.type];
            return (
              <tr key={source.id}>
                <td>
                  <span className={`source-cell ${sourceTone[source.type]}`}>
                    <Icon size={16} aria-hidden="true" />
                    <span>
                      <strong>{source.label}</strong>
                      <small>{source.id}</small>
                    </span>
                  </span>
                </td>
                <td>
                  <span className="target-text">{source.target}</span>
                </td>
                <td>{source.fieldCount ? `${source.fieldCount} fields · ${source.detail}` : source.detail}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function RuleTable({ rules }: { rules: DashboardRule[] }) {
  if (rules.length === 0) {
    return <EmptyState label="No rules match the current filter" />;
  }

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Rule</th>
            <th>Source</th>
            <th>Criteria</th>
            <th>Message</th>
          </tr>
        </thead>
        <tbody>
          {rules.map((rule) => (
            <tr key={rule.name}>
              <td>
                <strong>{rule.name}</strong>
              </td>
              <td>{rule.source}</td>
              <td>
                <span className="criteria-pill">{rule.allCount} all</span>
                <span className="criteria-pill">{rule.anyCount} any</span>
              </td>
              <td className="message-cell">{rule.message ?? "Default alert message"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function NotifierList({
  notifiers,
  testingNotifier,
  onTest
}: {
  notifiers: DashboardNotifier[];
  testingNotifier: TestableNotifierType | null;
  onTest: (type: TestableNotifierType) => void;
}) {
  if (notifiers.length === 0) {
    return <EmptyState label="No notifiers loaded" />;
  }

  return (
    <div className="notifier-list">
      {notifiers.map((notifier) => {
        const testable = notifier.type === "discord" || notifier.type === "telegram" || notifier.type === "slack";

        return (
          <div className="notifier-row" key={notifier.type}>
            <div>
              <strong>{notifier.type}</strong>
              <span>{notifier.enabled ? "Enabled" : "Disabled"}</span>
            </div>
            <div className="notifier-actions">
              {testable ? (
                <button
                  className="test-button"
                  type="button"
                  disabled={!notifier.ready || testingNotifier !== null}
                  onClick={() => onTest(notifier.type as TestableNotifierType)}
                >
                  {testingNotifier === notifier.type ? <Loader2 className="spin" size={14} aria-hidden="true" /> : null}
                  Test
                </button>
              ) : null}
              <StatusPill ok={notifier.ready} label={notifier.ready ? "Ready" : notifier.missingEnv[0] ?? "Off"} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SourceHealthPanel({ health }: { health: SourceHealth[] }) {
  if (health.length === 0) {
    return <EmptyState label="No source health data yet" />;
  }

  return (
    <div className="health-list">
      {health.map((entry) => (
        <div className="health-row" key={entry.sourceId}>
          <div>
            <strong>{entry.sourceLabel}</strong>
            <span>
              {entry.itemCount} items · {formatTimestamp(entry.lastFetchAt)}
            </span>
          </div>
          <StatusPill ok={!entry.error} label={entry.error ? "Error" : "OK"} />
        </div>
      ))}
      {health.some((entry) => entry.error) ? (
        <div className="error-list compact">
          {health
            .filter((entry) => entry.error)
            .map((entry) => (
              <div key={`${entry.sourceId}-error`}>
                <AlertTriangle size={16} aria-hidden="true" />
                <span>
                  {entry.sourceId}: {entry.error}
                </span>
              </div>
            ))}
        </div>
      ) : null}
    </div>
  );
}

function RuleBuilderModal({
  sources,
  draft,
  onChange,
  onClose,
  onCopy
}: {
  sources: DashboardSource[];
  draft: {
    name: string;
    source: string;
    field: string;
    operator: RuleOperator;
    value: string;
    message: string;
  };
  onChange: (next: typeof draft) => void;
  onClose: () => void;
  onCopy: () => void;
}) {
  const yamlPreview = buildRuleYaml(draft);

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div className="modal-panel" role="dialog" aria-modal="true" aria-labelledby="rule-builder-title" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2 id="rule-builder-title">Rule builder</h2>
            <p>Compose a rule and copy the YAML snippet into your config file.</p>
          </div>
          <button className="icon-button" type="button" aria-label="Close rule builder" onClick={onClose}>
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <div className="rule-form">
          <label>
            Name
            <input
              value={draft.name}
              onChange={(event) => onChange({ ...draft, name: event.target.value })}
              placeholder="Retail item below budget"
            />
          </label>
          <label>
            Source
            <select value={draft.source} onChange={(event) => onChange({ ...draft, source: event.target.value })}>
              <option value="">Select source</option>
              {sources.map((source) => (
                <option key={source.id} value={source.id}>
                  {source.label} ({source.id})
                </option>
              ))}
            </select>
          </label>
          <label>
            Field
            <input value={draft.field} onChange={(event) => onChange({ ...draft, field: event.target.value })} placeholder="price" />
          </label>
          <label>
            Operator
            <select
              value={draft.operator}
              onChange={(event) => onChange({ ...draft, operator: event.target.value as RuleOperator })}
            >
              {ruleOperators.map((operator) => (
                <option key={operator} value={operator}>
                  {operator}
                </option>
              ))}
            </select>
          </label>
          <label>
            Value
            <input value={draft.value} onChange={(event) => onChange({ ...draft, value: event.target.value })} placeholder="35" />
          </label>
          <label className="full-width">
            Message
            <input
              value={draft.message}
              onChange={(event) => onChange({ ...draft, message: event.target.value })}
              placeholder="{{title}} is {{price}}: {{url}}"
            />
          </label>
        </div>

        <pre className="yaml-preview">{yamlPreview}</pre>

        <div className="modal-actions">
          <button className="secondary-button" type="button" onClick={onClose}>
            Close
          </button>
          <button className="primary-button" type="button" onClick={onCopy}>
            <ClipboardCopy size={16} aria-hidden="true" />
            Copy YAML
          </button>
        </div>
      </div>
    </div>
  );
}

function RunHistoryPanel({ history }: { history: RunHistoryEntry[] }) {
  if (history.length === 0) {
    return <EmptyState label="No runs recorded yet" />;
  }

  return (
    <div className="history-list">
      {history.map((entry) => (
        <div className="history-row" key={entry.id}>
          <div>
            <strong>{formatTimestamp(entry.finishedAt)}</strong>
            <span>
              {entry.dryRun ? "Dry run" : "Live"} · {formatDuration(entry.durationMs)} · {entry.alertCount} alerts
            </span>
          </div>
          <span className={`history-pill ${entry.errorCount > 0 ? "warn" : "ok"}`}>
            {entry.errorCount > 0 ? `${entry.errorCount} errors` : "Clean"}
          </span>
        </div>
      ))}
    </div>
  );
}

function RunOutput({ result }: { result: RunResult | null }) {
  if (!result) {
    return <EmptyState label="Waiting for first run" />;
  }

  const alerts = result.summary.alerts ?? [];
  const durationMs =
    new Date(result.summary.finishedAt).getTime() - new Date(result.summary.startedAt).getTime();

  return (
    <div className="run-output">
      <div className="run-meta">
        <div>
          <span>Started</span>
          <strong>{formatTimestamp(result.summary.startedAt)}</strong>
        </div>
        <div>
          <span>Finished</span>
          <strong>{formatTimestamp(result.summary.finishedAt)}</strong>
        </div>
        <div>
          <span>Duration</span>
          <strong>{formatDuration(durationMs)}</strong>
        </div>
      </div>

      <div className="summary-strip">
        <span>{result.summary.itemCount} items</span>
        <span>{result.summary.matchedCount} matches</span>
        <span>{result.summary.alertCount} alerts</span>
      </div>

      {alerts.length > 0 ? (
        <div className="export-row">
          <button className="export-button" type="button" onClick={() => downloadAlertsJson(alerts, result.summary.finishedAt)}>
            <Download size={16} aria-hidden="true" />
            Export JSON
          </button>
          <button className="export-button" type="button" onClick={() => downloadAlertsCsv(alerts, result.summary.finishedAt)}>
            <Download size={16} aria-hidden="true" />
            Export CSV
          </button>
        </div>
      ) : null}

      {result.summary.errors.length > 0 ? (
        <div className="error-list">
          {result.summary.errors.map((runError) => (
            <div key={runError}>
              <AlertTriangle size={16} aria-hidden="true" />
              <span>{runError}</span>
            </div>
          ))}
        </div>
      ) : null}

      {alerts.length > 0 ? (
        <div className="alert-list">
          {alerts.map((alert) => (
            <article className="alert-item" key={alert.id}>
              <div>
                <span>{alert.ruleName}</span>
                <strong>{alert.title}</strong>
                <p>{alert.message}</p>
              </div>
              {alert.url ? (
                <a href={alert.url} target="_blank" rel="noreferrer" title="Open alert target">
                  <ExternalLink size={16} aria-hidden="true" />
                </a>
              ) : null}
            </article>
          ))}
        </div>
      ) : (
        <EmptyState label="No alerts matched" />
      )}
    </div>
  );
}

function StatusPill({ ok, label }: { ok: boolean; label?: string }) {
  return (
    <span className={`status-pill ${ok ? "ok" : "warn"}`}>
      {ok ? <CheckCircle2 size={14} aria-hidden="true" /> : <AlertTriangle size={14} aria-hidden="true" />}
      {label ?? (ok ? "Clean" : "Attention")}
    </span>
  );
}

function EmptyState({ label }: { label: string }) {
  return <div className="empty-state">{label}</div>;
}

function loadRunHistory(): RunHistoryEntry[] {
  try {
    const raw = window.localStorage.getItem(RUN_HISTORY_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as RunHistoryEntry[];
    return Array.isArray(parsed) ? parsed.slice(0, MAX_RUN_HISTORY) : [];
  } catch {
    return [];
  }
}

function saveRunHistory(history: RunHistoryEntry[]): void {
  window.localStorage.setItem(RUN_HISTORY_KEY, JSON.stringify(history));
}

function createHistoryEntry(result: RunResult): RunHistoryEntry {
  const durationMs =
    new Date(result.summary.finishedAt).getTime() - new Date(result.summary.startedAt).getTime();

  return {
    id: `${result.summary.startedAt}-${result.summary.finishedAt}`,
    startedAt: result.summary.startedAt,
    finishedAt: result.summary.finishedAt,
    dryRun: result.dryRun,
    durationMs,
    itemCount: result.summary.itemCount,
    matchedCount: result.summary.matchedCount,
    alertCount: result.summary.alertCount,
    errorCount: result.summary.errors.length
  };
}

function formatTimestamp(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "medium"
  }).format(new Date(value));
}

function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms} ms`;
  }

  const seconds = ms / 1000;
  if (seconds < 60) {
    return `${seconds.toFixed(1)} s`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainder = Math.round(seconds % 60);
  return `${minutes}m ${remainder}s`;
}

function downloadAlertsJson(alerts: AlertItem[], finishedAt: string): void {
  const stamp = finishedAt.replace(/[:.]/g, "-");
  downloadFile(`alerts-${stamp}.json`, JSON.stringify(alerts, null, 2), "application/json");
}

function downloadAlertsCsv(alerts: AlertItem[], finishedAt: string): void {
  const headers = ["id", "ruleName", "sourceLabel", "title", "url", "message", "matchedAt"];
  const rows = alerts.map((alert) =>
    headers.map((header) => csvEscape(String(alert[header as keyof AlertItem] ?? ""))).join(",")
  );
  const stamp = finishedAt.replace(/[:.]/g, "-");
  downloadFile(`alerts-${stamp}.csv`, [headers.join(","), ...rows].join("\n"), "text/csv");
}

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function buildRuleYaml(draft: {
  name: string;
  source: string;
  field: string;
  operator: RuleOperator;
  value: string;
  message: string;
}): string {
  const ruleName = draft.name.trim() || "New rule";
  const source = draft.source.trim() || "source-id";
  const value = formatYamlValue(draft.value);
  const messageLine = draft.message.trim() ? `\n    message: ${JSON.stringify(draft.message.trim())}` : "";

  return [
    "  - name: " + JSON.stringify(ruleName),
    "    source: " + source,
    "    all:",
    "      - field: " + draft.field,
    "        operator: " + draft.operator,
    `        value: ${value}${messageLine}`
  ].join("\n");
}

function formatYamlValue(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return '""';
  }

  const numeric = Number(trimmed);
  if (!Number.isNaN(numeric) && trimmed === String(numeric)) {
    return String(numeric);
  }

  if (trimmed === "true" || trimmed === "false") {
    return trimmed;
  }

  return JSON.stringify(trimmed);
}

function downloadFile(filename: string, content: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}