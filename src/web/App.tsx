import {
  Activity,
  AlertTriangle,
  Bell,
  CheckCircle2,
  Clock3,
  Database,
  ExternalLink,
  Loader2,
  Play,
  RefreshCw,
  Rss,
  Search,
  Shield,
  ShoppingBag,
  TrendingUp
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type SourceType = "html" | "rss" | "stooq";
type NotifierType = "console" | "discord" | "telegram";

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

interface RunSummary {
  startedAt: string;
  finishedAt: string;
  sourceCount: number;
  itemCount: number;
  matchedCount: number;
  alertCount: number;
  errors: string[];
  alerts?: AlertItem[];
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

const sourceIcons: Record<SourceType, typeof ShoppingBag> = {
  html: ShoppingBag,
  rss: Rss,
  stooq: TrendingUp
};

const sourceTone: Record<SourceType, string> = {
  html: "tone-teal",
  rss: "tone-amber",
  stooq: "tone-blue"
};

export function App() {
  const [config, setConfig] = useState<DashboardConfig | null>(null);
  const [runResult, setRunResult] = useState<RunResult | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "running">("loading");
  const [error, setError] = useState<string | null>(null);
  const [dryRun, setDryRun] = useState(true);
  const [secret, setSecret] = useState(() => window.localStorage.getItem("dashboardSecret") ?? "");

  const readyNotifiers = useMemo(() => config?.notifiers.filter((notifier) => notifier.ready).length ?? 0, [config]);
  const lastRunMs = useMemo(() => {
    if (!runResult) {
      return undefined;
    }

    return new Date(runResult.summary.finishedAt).getTime() - new Date(runResult.summary.startedAt).getTime();
  }, [runResult]);

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

  async function runScrape() {
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
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setStatus("idle");
    }
  }

  const isBusy = status === "loading" || status === "running";

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

          <button className="icon-button" type="button" title="Refresh config" onClick={refreshConfig} disabled={isBusy}>
            <RefreshCw size={18} aria-hidden="true" />
          </button>
          <button className="primary-button" type="button" onClick={runScrape} disabled={isBusy}>
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

      <section className="metric-grid" aria-label="Bot overview">
        <Metric icon={Database} label="Sources" value={config?.sources.length ?? "—"} accent="teal" />
        <Metric icon={Search} label="Rules" value={config?.rules.length ?? "—"} accent="blue" />
        <Metric icon={Bell} label="Ready Notifiers" value={`${readyNotifiers}/${config?.notifiers.length ?? 0}`} accent="rose" />
        <Metric icon={Clock3} label="Last Run" value={lastRunMs === undefined ? "Not run" : `${lastRunMs} ms`} accent="amber" />
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
          <NotifierList notifiers={config?.notifiers ?? []} />
        </div>

        <div className="panel wide-panel">
          <div className="panel-heading">
            <div>
              <h2>Rules</h2>
              <p>{config ? `${config.settings.maxConcurrency} concurrent source checks` : "Waiting for config"}</p>
            </div>
          </div>
          <RuleTable rules={config?.rules ?? []} />
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
    </main>
  );
}

function Metric(props: {
  icon: typeof Database;
  label: string;
  value: string | number;
  accent: "teal" | "blue" | "rose" | "amber";
}) {
  const Icon = props.icon;
  return (
    <div className={`metric metric-${props.accent}`}>
      <Icon size={20} aria-hidden="true" />
      <span>{props.label}</span>
      <strong>{props.value}</strong>
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
    return <EmptyState label="No rules loaded" />;
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

function NotifierList({ notifiers }: { notifiers: DashboardNotifier[] }) {
  if (notifiers.length === 0) {
    return <EmptyState label="No notifiers loaded" />;
  }

  return (
    <div className="notifier-list">
      {notifiers.map((notifier) => (
        <div className="notifier-row" key={notifier.type}>
          <div>
            <strong>{notifier.type}</strong>
            <span>{notifier.enabled ? "Enabled" : "Disabled"}</span>
          </div>
          <StatusPill ok={notifier.ready} label={notifier.ready ? "Ready" : notifier.missingEnv[0] ?? "Off"} />
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

  return (
    <div className="run-output">
      <div className="summary-strip">
        <span>{result.summary.itemCount} items</span>
        <span>{result.summary.matchedCount} matches</span>
        <span>{result.summary.alertCount} alerts</span>
      </div>

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
