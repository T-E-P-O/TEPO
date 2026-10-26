// Cattura screenshot UI via Edge DevTools Protocol; richiede il dev server su :5173.
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const APP = 'http://127.0.0.1:5173';
const API = 'http://localhost:8080';
const PORT = 9333;
const OUT = path.join(process.cwd(), '.tmp', 'shots');
const PROFILE = path.join(os.tmpdir(), `tepo-edge-${Date.now()}`);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitFor(fn, timeout = 15000, interval = 250) {
  const start = Date.now();
  let lastError;
  while (Date.now() - start < timeout) {
    try {
      if (await fn()) return true;
    } catch (error) {
      lastError = error;
    }
    await sleep(interval);
  }
  throw lastError ?? new Error('waitFor timeout');
}

async function getJson(url, options) {
  const response = await fetch(url, options);
  if (!response.ok) throw new Error(`${url} -> HTTP ${response.status}`);
  return response.json();
}

function connect(wsUrl) {
  const ws = new WebSocket(wsUrl);
  const pending = new Map();
  const listeners = new Map();
  let nextId = 0;

  ws.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (message.id) {
      const handler = pending.get(message.id);
      if (!handler) return;
      pending.delete(message.id);
      if (message.error) handler.reject(new Error(message.error.message));
      else handler.resolve(message.result);
      return;
    }
    const handlers = listeners.get(message.method) ?? [];
    for (const handler of handlers) handler(message.params);
  });

  const open = new Promise((resolve, reject) => {
    ws.addEventListener('open', () => resolve());
    ws.addEventListener('error', () => reject(new Error('CDP websocket error')));
  });

  return {
    ws,
    open,
    send(method, params = {}) {
      const id = (nextId += 1);
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
        ws.send(JSON.stringify({ id, method, params }));
      });
    },
    on(method, handler) {
      const handlers = listeners.get(method) ?? [];
      handlers.push(handler);
      listeners.set(method, handlers);
    },
    close() {
      try {
        ws.close();
      } catch {
        // niente
      }
    }
  };
}

const DEMO_CANDIDATES = [
  'OPT-001',
  'OPT-003',
  'OPT-005',
  'OPT-007',
  'OPT-009',
  'OPT-013',
  'OPT-014',
  'OPT-016',
  'OPT-024'
];

const CONSTRAINTS = {
  incompatibilities: [['OPT-001', 'OPT-021']],
  prerequisites: [['OPT-014', 'OPT-013']],
  maxNumber: null,
  maxNumberOptionIds: []
};

async function postOptimize(objective) {
  const payload = {
    budgetCents: 50_000_000,
    objective,
    candidateOptionIds: DEMO_CANDIDATES,
    ...CONSTRAINTS
  };
  const result = await getJson(`${API}/api/scenarios/SCN-DEMO/optimize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  return { payload, result };
}

async function main() {
  await mkdir(OUT, { recursive: true });

  const edge = spawn(
    EDGE,
    [
      '--headless=new',
      '--disable-gpu',
      '--no-first-run',
      '--no-default-browser-check',
      '--hide-scrollbars',
      '--remote-debugging-port=' + PORT,
      '--user-data-dir=' + PROFILE,
      '--window-size=1440,1000',
      'about:blank'
    ],
    { stdio: 'ignore' }
  );

  let cdp;
  try {
    await waitFor(async () => {
      const version = await getJson(`http://127.0.0.1:${PORT}/json/version`);
      return Boolean(version.webSocketDebuggerUrl);
    }, 20000);

    const target = await getJson(
      `http://127.0.0.1:${PORT}/json/new?about:blank`,
      { method: 'PUT' }
    );
    cdp = connect(target.webSocketDebuggerUrl);
    await cdp.open;
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');

    const evaluate = async (expression, awaitPromise = false) => {
      const response = await cdp.send('Runtime.evaluate', {
        expression,
        returnByValue: true,
        awaitPromise
      });
      if (response.exceptionDetails) {
        throw new Error(
          response.exceptionDetails.exception?.description ??
            response.exceptionDetails.text ??
            'evaluate failed'
        );
      }
      return response.result.value;
    };

    const setViewport = async (width, height) => {
      await cdp.send('Emulation.setDeviceMetricsOverride', {
        width,
        height,
        deviceScaleFactor: 1,
        mobile: width < 600
      });
    };

    const goto = async (url, settle = 1400) => {
      await cdp.send('Page.navigate', { url });
      await waitFor(async () => (await evaluate('document.readyState')) === 'complete');
      await sleep(settle);
    };

    const setTheme = async (theme) => {
      await evaluate(`(() => {
        document.documentElement.setAttribute('data-theme', '${theme}');
        try { localStorage.setItem('tepo:theme', '${theme}'); } catch (e) {}
        window.dispatchEvent(new Event('tepo:theme'));
        return true;
      })()`);
      await sleep(520);
    };

    const shot = async (name) => {
      const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' });
      await writeFile(path.join(OUT, `${name}.png`), Buffer.from(data, 'base64'));
      console.log(`captured ${name}.png`);
    };

    const shotFull = async (name) => {
      const metrics = await cdp.send('Page.getLayoutMetrics');
      const size = metrics.cssContentSize ?? metrics.contentSize;
      const { data } = await cdp.send('Page.captureScreenshot', {
        format: 'png',
        captureBeyondViewport: true,
        clip: { x: 0, y: 0, width: size.width, height: size.height, scale: 1 }
      });
      await writeFile(path.join(OUT, `${name}.png`), Buffer.from(data, 'base64'));
      console.log(`captured ${name}.png (full page)`);
    };

    const captureThemes = async (name, url, settle = 1600) => {
      await goto(`${APP}${url}`, settle);
      await setTheme('light');
      await shot(`${name}-relazione`);
      await setTheme('dark');
      await shot(`${name}-sala-operativa`);
      await setTheme('light');
    };

    // Precarica la sessione A/B con dati reali dal backend
    await goto(APP, 1600);
    try {
      const [scenarioA, scenarioB] = await Promise.all([
        postOptimize('ENERGY_SAVING'),
        postOptimize('CO2_REDUCTION')
      ]);
      const storedA = {
        id: 'A',
        name: 'Scenario A',
        payload: scenarioA.payload,
        result: scenarioA.result,
        createdAt: new Date(Date.now() - 12 * 60 * 1000).toISOString()
      };
      const storedB = {
        id: 'B',
        name: 'Scenario B',
        payload: scenarioB.payload,
        result: scenarioB.result,
        createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString()
      };
      const last = {
        payload: scenarioB.payload,
        result: scenarioB.result,
        savedAt: new Date(Date.now() - 5 * 60 * 1000).toISOString()
      };
      await evaluate(
        `(() => {
          sessionStorage.setItem('tepo:scenarioA', ${JSON.stringify(JSON.stringify(storedA))});
          sessionStorage.setItem('tepo:scenarioB', ${JSON.stringify(JSON.stringify(storedB))});
          sessionStorage.setItem('tepo:lastResult', ${JSON.stringify(JSON.stringify(last))});
          return true;
        })()`
      );
      console.log('seeded A/B scenarios from backend');
    } catch (error) {
      console.warn(`seed skipped: ${error.message}`);
    }

    const fonts = await evaluate(
      'JSON.stringify([...document.fonts].map(f => f.family + ":" + f.status))'
    );
    console.log('fonts', fonts);

    // Desktop: tutte le pagine, due registri
    await setViewport(1440, 1000);
    await captureThemes('01-dashboard', '/', 1800);
    await captureThemes('02-buildings', '/buildings');
    await captureThemes('03-interventions', '/interventions');
    await captureThemes('04-scenario', '/scenario');
    await captureThemes('05-result', '/result', 1800);
    await captureThemes('06-compare', '/compare', 1800);
    await captureThemes('07-map', '/map', 3000);
    await captureThemes('08-import', '/import');

    // Sensibilità: esegue davvero l'analisi
    await goto(`${APP}/sensitivity`, 1800);
    const clicked = await evaluate(`(() => {
      const button = [...document.querySelectorAll('button')].find((b) =>
        /Esegui analisi/i.test(b.textContent || '')
      );
      if (button) { button.click(); return true; }
      return false;
    })()`);
    console.log(`sensitivity analysis clicked: ${clicked}`);
    if (clicked) {
      try {
        await waitFor(
          async () =>
            evaluate(
              `(document.body.innerText || '').includes('Stabilità delle selezioni')`
            ),
          120000,
          1000
        );
        await sleep(1200);
        await shot('09-sensitivity-relazione');
        await shotFull('09-sensitivity-full-relazione');
        await setTheme('dark');
        await shot('09-sensitivity-sala-operativa');
        await shotFull('09-sensitivity-full-sala-operativa');
        await setTheme('light');
      } catch (error) {
        console.warn(`sensitivity results not ready: ${error.message}`);
        await shot('09-sensitivity-relazione');
      }
    }

    // Mobile: pagine chiave
    await setViewport(390, 844);
    await captureThemes('10-dashboard-mobile', '/', 1800);
    await captureThemes('11-result-mobile', '/result', 1800);
    await captureThemes('12-scenario-mobile', '/scenario', 1800);

    // Laptop 1366: verifica della densità
    await setViewport(1366, 768);
    await captureThemes('13-result-laptop', '/result', 1800);
  } finally {
    cdp?.close();
    edge.kill();
    await sleep(400);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
