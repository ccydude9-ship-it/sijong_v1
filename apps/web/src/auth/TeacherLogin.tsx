import React, { useState } from 'react';
import { LockKeyhole, ArrowLeft } from 'lucide-react';
import { useSession } from './SessionProvider';
export function TeacherLogin({ onDone, onBack }: { onDone: () => void; onBack: () => void }) {
  const auth = useSession(),
    [password, setPassword] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  return (
    <main className="page form-page">
      <button className="ghost" onClick={onBack}>
        <ArrowLeft size={18} />
        처음으로
      </button>
      <section className="panel login-panel">
        <LockKeyhole size={32} />
        <h1>선생님 입장</h1>
        <p>아이들의 하루를 준비하고 함께 살펴봐요.</p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError('');
            try {
              await auth.loginTeacher(password);
              setPassword('');
              onDone();
            } catch (e) {
              setError(e instanceof Error ? e.message : '다시 시도해 주세요');
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            선생님 비밀번호
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              required
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          {error && (
            <p role="alert" className="notice error">
              {error}
            </p>
          )}
          <button className="primary" disabled={busy}>
            입장하기
          </button>
        </form>
      </section>
    </main>
  );
}
