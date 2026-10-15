import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { mkdirSync, readFileSync, chmodSync } from 'node:fs';
import { dirname } from 'node:path';
import type {
  LessonRecord,
  StudentRecord,
  Card,
  StudentProgress,
  ImageRecord,
  SessionRecord,
  PracticeRecord,
} from './storage/records';
export class Store {
  readonly db: DatabaseSync;
  constructor(readonly config: { dbPath: string; uploadDir: string }) {
    mkdirSync(dirname(config.dbPath), { recursive: true, mode: 0o700 });
    mkdirSync(config.uploadDir, { recursive: true, mode: 0o700 });
    this.db = new DatabaseSync(config.dbPath);
    chmodSync(config.dbPath, 0o600);
    this.db.exec('PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;');
    this.db.exec(readFileSync(new URL('../migrations/001-initial.sql', import.meta.url), 'utf8'));
  }
  run(sql: string, ...params: SQLInputValue[]) {
    return this.db.prepare(sql).run(...params);
  }
  all<T>(sql: string, ...params: SQLInputValue[]): T[] {
    return this.db.prepare(sql).all(...params) as unknown as T[];
  }
  one<T>(sql: string, ...params: SQLInputValue[]): T | undefined {
    return this.db.prepare(sql).get(...params) as unknown as T | undefined;
  }
  records<T>(sql: string, ...params: SQLInputValue[]): T[] {
    return this.all<{ body: string }>(sql, ...params).map((r) => JSON.parse(r.body) as T);
  }
  record<T>(sql: string, ...params: SQLInputValue[]): T | undefined {
    return this.records<T>(sql, ...params)[0];
  }
  transaction<T>(fn: () => T): T {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const r = fn();
      this.db.exec('COMMIT');
      return r;
    } catch (e) {
      this.db.exec('ROLLBACK');
      throw e;
    }
  }
  close() {
    if (this.db.isOpen) this.db.close();
  }
  settings = {
    get: (key: string) =>
      this.one<{ value: string }>('SELECT value FROM settings WHERE key=?', key)?.value,
    set: (key: string, value: string) => {
      this.run(
        'INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',
        key,
        value,
      );
    },
  };
  lessons = {
    get: (id: string) => this.record<LessonRecord>('SELECT body FROM lessons WHERE id=?', id),
    list: () => this.records<LessonRecord>('SELECT body FROM lessons ORDER BY rowid DESC'),
    create: (r: LessonRecord) => {
      this.run('INSERT INTO lessons(id,body) VALUES(?,?)', r.id, JSON.stringify(r));
    },
    set: (r: LessonRecord) => {
      this.run('UPDATE lessons SET body=? WHERE id=?', JSON.stringify(r), r.id);
    },
  };
  students = {
    list: (lessonId: string) =>
      this.records<StudentRecord>(
        "SELECT body FROM students WHERE lesson_id=? ORDER BY json_extract(body,'$.slot')",
        lessonId,
      ),
    get: (id: string) => this.record<StudentRecord>('SELECT body FROM students WHERE id=?', id),
    set: (s: StudentRecord) => {
      this.run(
        'INSERT INTO students(id,lesson_id,body) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET body=excluded.body',
        s.id,
        s.lessonId,
        JSON.stringify(s),
      );
    },
    cards: (id: string) =>
      this.records<Card>('SELECT body FROM cards WHERE student_id=? ORDER BY rowid', id),
    setCard: (c: Card) => {
      this.run(
        'INSERT INTO cards(id,student_id,image_id,body) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET image_id=excluded.image_id,body=excluded.body',
        c.id,
        c.studentId,
        c.imageId,
        JSON.stringify(c),
      );
    },
  };
  progress = {
    get: (id: string) => this.record<StudentProgress>('SELECT body FROM progress WHERE id=?', id)!,
    set: (p: StudentProgress) => {
      this.run(
        'INSERT INTO progress(id,body) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET body=excluded.body',
        p.studentId,
        JSON.stringify(p),
      );
    },
  };
  images = {
    get: (id: string) => this.record<ImageRecord>('SELECT body FROM images WHERE id=?', id),
    list: () => this.records<ImageRecord>('SELECT body FROM images'),
    set: (r: ImageRecord) => {
      this.run('INSERT INTO images(id,body) VALUES(?,?)', r.id, JSON.stringify(r));
    },
  };
  sessions = {
    get: (id: string) => this.record<SessionRecord>('SELECT body FROM sessions WHERE id=?', id),
    find: (hash: string) =>
      this.record<SessionRecord>(
        "SELECT body FROM sessions WHERE json_extract(body,'$.tokenHash')=?",
        hash,
      ),
    set: (s: SessionRecord) => {
      this.run('INSERT INTO sessions(id,body) VALUES(?,?)', s.id, JSON.stringify(s));
    },
    list: () => this.records<SessionRecord>('SELECT body FROM sessions'),
    delete: (id: string) => {
      this.run('DELETE FROM sessions WHERE id=?', id);
    },
  };
  operations = {
    find: (scope: string, id: string) =>
      this.one<{ request_hash: string; response: string }>(
        'SELECT request_hash,response FROM operations WHERE scope=? AND id=?',
        scope,
        id,
      ),
    set: (scope: string, id: string, hash: string, response: unknown) => {
      this.run(
        'INSERT INTO operations(scope,id,request_hash,response) VALUES(?,?,?,?)',
        scope,
        id,
        hash,
        JSON.stringify(response),
      );
    },
  };
  practice = {
    get: (id: string) => this.record<PracticeRecord>('SELECT body FROM practice WHERE id=?', id),
    list: (studentId: string) =>
      this.records<PracticeRecord>(
        'SELECT body FROM practice WHERE student_id=? ORDER BY rowid DESC',
        studentId,
      ),
    set: (r: PracticeRecord) => {
      this.run(
        'INSERT INTO practice(id,student_id,body) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET body=excluded.body',
        r.id,
        r.studentId,
        JSON.stringify(r),
      );
    },
  };
}
export function openStore(config: { dbPath: string; uploadDir: string }): Store {
  return new Store(config);
}
