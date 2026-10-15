import type { RequestHandler } from 'express';
import type { Session } from '../../../../packages/contracts/src/index';
import { AuthService } from './service';
import { equal } from './crypto';
import { fail } from '../errors';
export const authenticate =
  (auth: AuthService): RequestHandler =>
  (req, res, next) => {
    res.locals.session = auth.lookup(req.cookies?.sijong);
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      if (req.get('Origin') !== auth.config.publicOrigin)
        fail(403, '이 앱 화면에서 다시 시도해 주세요');
      const s = res.locals.session;
      if (s && !equal(req.get('X-CSRF-Token') || '', s.csrfToken))
        fail(403, '화면을 새로 열어 주세요');
    }
    next();
  };
export const requireRole =
  (...roles: Session['role'][]): RequestHandler =>
  (_req, res, next) => {
    const s = res.locals.session;
    if (!s) fail(401, '다시 접속해 주세요');
    if (!roles.includes(s.role)) fail(403, '접근할 수 없습니다');
    next();
  };
