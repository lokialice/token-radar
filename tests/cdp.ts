// A minimal Chrome DevTools Protocol client over Node's built-in WebSocket, for driving the page in a real browser
// and measuring which bytes of a script ran. Standard library only.
import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export function findChrome(): string | undefined {
  const candidates = [process.env.CHROME, '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser'];
  return candidates.find((c) => c !== undefined && existsSync(c));
}

type Params = Record<string, unknown>;
interface Event {
  method: string;
  sessionId?: string;
  params: any;
}

export class Browser {
  private nextId = 1;
  private pending = new Map<number, { ok: (v: any) => void; fail: (e: Error) => void }>();
  readonly events: Event[] = [];
  private waiters: ((e: Event) => void)[] = [];

  private proc: ChildProcess;
  private ws: WebSocket;

  private constructor(proc: ChildProcess, ws: WebSocket) {
    this.proc = proc;
    this.ws = ws;
    ws.addEventListener('message', (m) => {
      const msg = JSON.parse(String(m.data));
      if (msg.id !== undefined) {
        const p = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) p?.fail(new Error(`${msg.error.message}`));
        else p?.ok(msg.result);
      } else {
        const e: Event = { method: msg.method, sessionId: msg.sessionId, params: msg.params };
        this.events.push(e);
        for (const w of this.waiters) w(e);
      }
    });
  }

  static async launch(chrome: string): Promise<Browser> {
    const proc = spawn(chrome, ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${mkdtempSync(join(tmpdir(), 'radar-chrome-'))}`, '--no-first-run', '--disable-gpu', ...(process.env.CI ? ['--no-sandbox'] : []), '--hide-scrollbars', '--window-size=1440,900', 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] });
    const url = await new Promise<string>((ok, fail) => {
      let text = '';
      proc.stderr!.on('data', (d) => {
        text += d;
        const m = text.match(/DevTools listening on (ws:\/\/\S+)/);
        if (m) ok(m[1]!);
      });
      proc.once('exit', () => fail(new Error('Chrome exited before it was ready')));
    });
    const ws = new WebSocket(url);
    await new Promise<void>((ok, fail) => {
      ws.addEventListener('open', () => ok());
      ws.addEventListener('error', () => fail(new Error('DevTools socket failed')));
    });
    return new Browser(proc, ws);
  }

  send(method: string, params: Params = {}, sessionId?: string): Promise<any> {
    const id = this.nextId++;
    this.ws.send(JSON.stringify({ id, method, params, sessionId }));
    return new Promise((ok, fail) => this.pending.set(id, { ok, fail }));
  }

  /** Resolves with the next event the test asks for, from now on. */
  waitFor(method: string, sessionId: string, timeoutMs = 20_000): Promise<Event> {
    return new Promise((ok, fail) => {
      const timer = setTimeout(() => fail(new Error(`timed out waiting for ${method}`)), timeoutMs);
      const w = (e: Event): void => {
        if (e.method === method && e.sessionId === sessionId) {
          clearTimeout(timer);
          this.waiters = this.waiters.filter((x) => x !== w);
          ok(e);
        }
      };
      this.waiters.push(w);
    });
  }

  async page(): Promise<Page> {
    const { targetId } = await this.send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await this.send('Target.attachToTarget', { targetId, flatten: true });
    const page = new Page(this, sessionId);
    for (const domain of ['Page', 'Runtime', 'Profiler']) await page.send(`${domain}.enable`);
    return page;
  }

  close(): void {
    this.ws.close();
    this.proc.kill();
  }
}

/** One range of a script V8 reports, with how many times it ran. */
interface Range {
  startOffset: number;
  endOffset: number;
  count: number;
}

export class Page {
  /** Uncaught errors and console errors seen on this page. */
  readonly problems: string[] = [];
  private seen = 0;

  private browser: Browser;
  readonly session: string;

  constructor(browser: Browser, session: string) {
    this.browser = browser;
    this.session = session;
  }

  send(method: string, params: Params = {}): Promise<any> {
    return this.browser.send(method, params, this.session);
  }

  /** Evaluate an expression in the page and return its value (a promise is awaited). */
  async eval<T = any>(expression: string): Promise<T> {
    const r = await this.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(`in the page: ${r.exceptionDetails.exception?.description ?? r.exceptionDetails.text}`);
    return r.result.value as T;
  }

  /** Navigate (or reload) and wait for the load event; the waiter is set before the command so the event cannot be missed. */
  private async go(method: string, params: Params = {}): Promise<void> {
    const loaded = this.browser.waitFor('Page.loadEventFired', this.session);
    await this.send(method, params);
    await loaded;
  }

  /** Open a URL with precise coverage on, so the scripts' first run is measured; wait until the page has drawn its rows. */
  async open(url: string): Promise<void> {
    await this.go('Page.navigate', { url: 'about:blank' });
    await this.send('Profiler.startPreciseCoverage', { callCount: true, detailed: true });
    await this.go('Page.navigate', { url });
    // The page rewrites its own address as it runs, so load the original URL again rather than reloading.
    await this.go('Page.navigate', { url: 'about:blank' });
    await this.go('Page.navigate', { url });
    await this.eval('new Promise((ok, fail) => { const end = Date.now() + 15000; const t = setInterval(() => { if (document.querySelector("#hud .chip")) { clearInterval(t); ok(1); } else if (Date.now() > end) { clearInterval(t); fail(new Error("the page never drew")); } }, 20); })');
    this.collectProblems();
  }

  collectProblems(): void {
    for (const e of this.browser.events.slice(this.seen)) {
      if (e.sessionId !== this.session) continue;
      if (e.method === 'Runtime.exceptionThrown') this.problems.push(e.params.exceptionDetails.exception?.description ?? e.params.exceptionDetails.text);
      if (e.method === 'Runtime.consoleAPICalled' && e.params.type === 'error') this.problems.push(e.params.args.map((a: any) => a.value ?? a.description).join(' '));
    }
    this.seen = this.browser.events.length;
  }

  /** Which characters of each script ran at least once since `open`, by script file name. */
  async coverage(): Promise<Map<string, Uint8Array>> {
    const { result } = await this.send('Profiler.takePreciseCoverage');
    await this.send('Profiler.stopPreciseCoverage');
    const out = new Map<string, Uint8Array>();
    for (const script of result as { url: string; functions: { ranges: Range[] }[] }[]) {
      const name = script.url.split('/').pop()!;
      if (!/\.js$/.test(name) || name === 'data.js') continue;
      const ranges = script.functions.flatMap((f) => f.ranges).sort((a, b) => a.startOffset - b.startOffset || b.endOffset - a.endOffset);
      const end = Math.max(...ranges.map((r) => r.endOffset));
      const ran = new Uint8Array(end);
      for (const r of ranges) ran.fill(r.count > 0 ? 1 : 0, r.startOffset, r.endOffset);
      out.set(name, ran);
    }
    return out;
  }
}
