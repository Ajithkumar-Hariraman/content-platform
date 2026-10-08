import { Router } from 'express';
import { openapi } from './specification.js';
const escape = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (char) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        char
      ] ?? char,
  );
export function docsRoutes(): Router {
  const router = Router();
  router.get('/openapi.json', (_req, res) => res.json(openapi));
  router.get('/', (_req, res) => {
    res.type('html').send(
      `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>CloudOps API reference</title></head><body><h1>CloudOps API reference</h1><p>OpenAPI 3.1. <a href="/api/docs/openapi.json">Machine-readable specification</a>.</p><p>Login establishes HttpOnly cookies. Obtain the CSRF token from login or me and send X-CSRF-Token on authenticated mutations. Permissions are enforced by the API.</p>${Object.entries(
        openapi.paths,
      )
        .map(
          ([path, methods]) =>
            `<section><h2>${escape(path)}</h2>${Object.entries(methods)
              .map(
                ([method, details]) =>
                  `<details><summary>${escape(method.toUpperCase())} ${escape(details.summary)}</summary><pre>${escape(JSON.stringify(details, null, 2))}</pre></details>`,
              )
              .join('')}</section>`,
        )
        .join(
          '',
        )}<h2>Schemas and authentication</h2><pre>${escape(JSON.stringify(openapi.components, null, 2))}</pre></body></html>`,
    );
  });
  return router;
}
