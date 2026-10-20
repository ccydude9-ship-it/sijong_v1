import express from 'express';
import { readFileSync } from 'node:fs';
import { liveRoutes } from './live/routes';
import { fileURLToPath } from 'node:url';
import { EventHub } from './events/hub';
import { eventRoutes } from './events/routes';
import { ProgressService } from './progress/service';
import { progressRoutes } from './progress/routes';
import { PracticeService } from './practice/service';
import { practiceRoutes } from './practice/routes';
import { ImageService } from './images/service';
import { imageRoutes } from './images/routes';
import { LessonService } from './lessons/service';
import { lessonRoutes } from './lessons/routes';
import cookieParser from 'cookie-parser';
import type { Store } from './db';
import type { Config } from './config';
import { AuthService } from './auth/service';
import { authenticate, requireRole } from './auth/middleware';
import { authRoutes } from './auth/routes';
import { errorHandler } from './errors';
export function createApp({ store, config }: { store: Store; config: Config }) {
  const app = express(),
    auth = new AuthService(store, config);
  app.disable('x-powered-by');
  app.use((_req, res, next) => {
    res.set({
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'same-origin',
      'Content-Security-Policy':
        "default-src 'self';script-src 'self';style-src 'self' 'unsafe-inline';font-src 'self';img-src 'self' data:;connect-src 'self';object-src 'none';base-uri 'self';frame-ancestors 'none'",
    });
    next();
  });
  app.locals.auth = auth;
  app.locals.store = store;
  app.use(cookieParser());
  app.use('/api/live/setup', express.json({ limit: '18mb' }));
  app.use('/api', express.json({ limit: '128kb' }), authenticate(auth));
  app.use('/api/live', liveRoutes(auth));
  app.use('/api', authRoutes(auth));
  app.use('/api/student', requireRole('student'));
  app.use('/api/teacher', requireRole('teacher'));
  const practice = new PracticeService(store);
  app.locals.practice = practice;
  app.use('/api/student', practiceRoutes(practice));
  const progress = new ProgressService(store);
  app.locals.progress = progress;
  app.use('/api/student', progressRoutes(progress));
  const images = new ImageService(store);
  app.locals.images = images;
  app.use('/api', imageRoutes(images));
  const lessons = new LessonService(store, auth);
  app.locals.lessons = lessons;
  lessons.onDelete = () => images.removeUnreferenced();
  app.use('/api/teacher', lessonRoutes(lessons));
  const hub = new EventHub(store, progress);
  app.locals.hub = hub;
  auth.onRevoke = (id) => hub.revoke([id]);
  for (const service of [lessons, practice, progress])
    service.onCommit = (id) => hub.publishCommitted(id);
  app.use('/api', eventRoutes(hub));
  app.get('/api/health', (_req, res) => {
    store.one('SELECT 1');
    res.json({ ok: true, database: 'ok' });
  });
  app.use('/api', (_req, res) =>
    res.status(404).json({ message: '요청한 기능을 찾을 수 없습니다' }),
  );
  if (config.standalone) {
    const standalone = readFileSync(
      new URL('../../../index.html', import.meta.url),
      'utf8',
    ).replace('<head>', '<head><meta name="classroom-live" content="enabled">');
    app.get(['/', '/index.html'], (_req, res) => {
      res.set('Cache-Control', 'no-store');
      res.set(
        'Content-Security-Policy',
        "default-src 'self';script-src 'self' 'unsafe-inline';style-src 'self' 'unsafe-inline';img-src 'self' data:;connect-src 'self';object-src 'none';base-uri 'none';frame-ancestors 'none'",
      );
      res.type('html').send(standalone);
    });
  }
  const webRoot = fileURLToPath(new URL('../../web/dist/', import.meta.url));
  app.use(express.static(webRoot));
  app.get('/{*path}', (_req, res) => res.sendFile(`${webRoot}index.html`));
  app.use(errorHandler);
  return app;
}
