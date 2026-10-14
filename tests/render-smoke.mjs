import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/**
 * Renders the dispatch form for real.
 *
 * Every other check in this repo reads the source as text, which is why a
 * declaration-order mistake got through: a useMemo callback reading a const
 * declared two hundred lines below it is valid-looking text, compiles, builds,
 * passes lint and passes 159 static checks, and only throws "Cannot access 'x'
 * before initialization" when the component actually runs.
 *
 * renderToString executes the component body, which is the only way to catch
 * that class of error. It needs no DOM, and it is the same path the browser
 * takes when the page opens.
 */

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const vite = await createServer({
  root: appRoot,
  logLevel: 'error',
  server: { middlewareMode: true },
  appType: 'custom',
});

let failed = false;

try {
  const mod = await vite.ssrLoadModule('/src/pages/NewOutingPage.jsx');
  const Page = mod.NewOutingPage ?? mod.default;
  assert.ok(Page, 'NewOutingPage exported no component');

  // Nothing is fetched during render, so queries stay idle and the form renders
  // its empty state. That is enough to execute the whole component body.
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, enabled: false } },
  });

  const html = renderToString(
    React.createElement(
      QueryClientProvider,
      { client: queryClient },
      React.createElement(
        MemoryRouter,
        { initialEntries: ['/outings/new'] },
        React.createElement(Page, {}),
      ),
    ),
  );

  assert.ok(html.length > 0, 'render produced no output');
  console.log(`PASS - NewOutingPage rendered (${html.length} chars of HTML)`);
} catch (err) {
  failed = true;
  console.log('FAIL - NewOutingPage threw while rendering:');
  const msg = String((err && err.stack) || err).split('\n').slice(0, 4).join('\n');
  console.log(msg);
} finally {
  await vite.close();
}

if (failed) process.exitCode = 1;