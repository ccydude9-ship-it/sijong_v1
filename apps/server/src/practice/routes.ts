import { Router } from 'express';
import type { PracticeService } from './service';
import { clockSchema } from '../../../../packages/contracts/src/index';
export function practiceRoutes(service: PracticeService) {
  const r = Router();
  r.post('/practice/next', (_req, res) => res.json(service.next(res.locals.session)));
  r.post('/practice/:id/check', (req, res) =>
    res.json(service.check(res.locals.session, req.params.id, clockSchema.parse(req.body))),
  );
  return r;
}
