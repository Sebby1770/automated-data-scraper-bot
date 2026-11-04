import { useEffect } from "react";

const watches = [
  { name: "TSLA price drop", source: "Public quote", rule: "below 180", state: "Quiet" },
  { name: "Housing keyword", source: "Public RSS", rule: "title contains studio", state: "1 new" },
  { name: "Shop listing", source: "Public HTML", rule: "price under 40", state: "Quiet" }
];

export function Site() {
  useEffect(() => {
    document.title = "Scraper Bot";
  }, []);

  return (
    <div className="site">
      <header className="site-nav">
        <a className="site-mark" href="/">
          Scraper Bot
        </a>
        <a className="site-nav-button" href="/console">
          Open the console
        </a>
      </header>

      <main>
        <section className="site-hero">
          <div>
            <p className="site-kicker">Public pages only</p>
            <h1>Watch a page. Hear about the change.</h1>
            <p className="site-lead">
              Point the bot at a public listing, a feed, or a JSON API. Write the rule in a sentence.
              The console keeps the last run on this computer and tells you what showed up.
            </p>
            <div className="site-actions">
              <a className="site-nav-button" href="/console">
                Open the console
              </a>
              <a className="site-text-link" href="#how">
                How a watch works
              </a>
            </div>
          </div>
          <aside className="site-card" aria-label="Example watches">
            <p>Today’s desk</p>
            <ul>
              {watches.map((watch) => (
                <li key={watch.name}>
                  <strong>{watch.name}</strong>
                  <span>{watch.source}</span>
                  <span>{watch.rule}</span>
                  <em>{watch.state}</em>
                </li>
              ))}
            </ul>
          </aside>
        </section>

        <section className="site-steps" id="how">
          <h2>Three moves, then it waits.</h2>
          <ol>
            <li>
              <strong>Name a public URL</strong>
              <span>HTML, RSS, CSV, a sitemap, or JSON. Login walls and private accounts stay out.</span>
            </li>
            <li>
              <strong>Say what matters</strong>
              <span>A price under 40, a new title, or a field that changed since last time.</span>
            </li>
            <li>
              <strong>Read the difference</strong>
              <span>After two runs the console writes a sentence you can copy, and lists alerts that arrived or left.</span>
            </li>
          </ol>
        </section>

        <section className="site-note">
          <h2>Polite by choice.</h2>
          <p>
            robots.txt and the pause between requests start off, so a demo does not surprise you.
            Turn them on when you want the bot to wait. Nothing here is built to slip past a login,
            a paywall, or a check that asks whether you are a person.
          </p>
        </section>
      </main>

      <footer className="site-foot">
        <p>Scraper Bot 0.14.0</p>
        <a href="/console">Console</a>
      </footer>
    </div>
  );
}
