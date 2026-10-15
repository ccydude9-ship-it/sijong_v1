import React from 'react';
import { House, UserRound } from 'lucide-react';
export function ModeShell({
  studentName,
  onHome,
  children,
}: {
  studentName: string;
  onHome: () => Promise<void>;
  children: React.ReactNode;
}) {
  return (
    <main className="page activity-page">
      <header className="student-top">
        <button className="secondary home-button" onClick={() => void onHome()}>
          <House size={17} />
          홈으로 돌아가기
        </button>
        <span className="student-chip">
          <UserRound size={16} />
          {studentName}
        </span>
      </header>
      {children}
    </main>
  );
}
