import { Router } from 'express';
import type { ProgressService } from './service';
import { progressSchema } from '../../../../packages/contracts/src/index';
export function progressRoutes(service: ProgressService) {
  const r = Router();
  r.get('/state', (_req, res) => res.json(service.read(res.locals.session)));
  r.put('/progress', (req, res) =>
    res.json(service.apply(res.locals.session, progressSchema.parse(req.body))),
  );
  return r;
}
