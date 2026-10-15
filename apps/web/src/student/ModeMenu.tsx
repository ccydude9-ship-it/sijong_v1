import React from 'react';
import { Clock3, Layers3, Camera, ArrowUpRight, UserRound } from 'lucide-react';
import type { StudentMode } from '../../../../packages/contracts/src/index';
const modes = [
  {
    id: 'practice' as const,
    name: '연습모드',
    title: '째깍! 읽어 봐',
    description: '시계와 친해지는 시간',
    icon: Clock3,
    badge: '가볍게 시작해요',
    tone: 'peach',
  },
  {
    id: 'practical' as const,
    name: '실전모드',
    title: '착착! 맞춰 봐',
    description: '내 하루를 순서대로 착착',
    icon: Layers3,
    badge: '나만의 카드 8장',
    tone: 'mint',
  },
  {
    id: 'sharing' as const,
    name: '공유모드',
    title: '찰칵! 들려줘',
    description: '나의 소중한 하루 이야기',
    icon: Camera,
    badge: '내 하루를 소개해요',
    tone: 'lavender',
  },
];
export function ModeMenu({
  studentName,
  onSelect,
  onChangeName,
  changingName = false,
}: {
  studentName: string;
  onSelect: (mode: StudentMode) => void;
  onChangeName: () => Promise<void>;
  changingName?: boolean;
}) {
  return (
    <main className="page mode-page">
      <div className="student-top">
        <span className="student-chip">
          <UserRound size={16} />
          {studentName}
        </span>
        <button className="ghost" disabled={changingName} onClick={() => void onChangeName()}>
          이름 다시 고르기
        </button>
      </div>
      <header className="page-heading">
        <span className="eyebrow">STEP 02 · SELECT YOUR ADVENTURE</span>
        <h1>
          무엇을 해 볼까요?<span className="heading-star">✦</span>
        </h1>
        <p>{studentName}의 하루, 신나는 시간 여행을 시작해요.</p>
      </header>
      <div className="mode-grid">
        {modes.map((m, i) => (
          <button
            key={m.id}
            disabled={changingName}
            className={`mode-tile ${m.tone}`}
            onClick={() => onSelect(m.id)}
          >
            <div className="mode-top">
              <span>
                0{i + 1} · {m.name}
              </span>
              <ArrowUpRight size={22} />
            </div>
            <div className="mode-icon">
              <m.icon size={64} strokeWidth={1.5} />
            </div>
            <span className="mode-title">{m.title}</span>
            <span className="mode-description">{m.description}</span>
            <span className="mode-badge">{m.badge}</span>
          </button>
        ))}
      </div>
      <p className="subtle center">하고 싶은 활동을 골라요. 언제든 홈으로 돌아올 수 있어요.</p>
    </main>
  );
}
