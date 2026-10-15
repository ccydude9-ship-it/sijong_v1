import React, { useCallback, useEffect, useRef } from 'react';
import { LockKeyhole, Volume2, Sparkles } from 'lucide-react';
export function TitleScreen({
  onStart,
  onTeacher,
}: {
  onStart: () => void;
  onTeacher: () => void;
}) {
  const started = useRef(false);
  const start = useCallback(() => {
    if (started.current) return;
    started.current = true;
    onStart();
  }, [onStart]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (
        e.repeat ||
        ['Tab', 'Shift', 'Control', 'Alt', 'Meta'].includes(e.key) ||
        (e.target instanceof HTMLElement && e.target.closest('[data-teacher-entry]'))
      )
        return;
      e.preventDefault();
      start();
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [start]);
  return (
    <main className="title-screen" onClick={start}>
      <div className="arcade-top">
        <span className="eyebrow">
          <span className="tiny-dot" /> MY LITTLE DAY · 나의 하루를 플레이!
        </span>
        <button
          className="ghost light"
          data-teacher-entry
          onClick={(e) => {
            e.stopPropagation();
            onTeacher();
          }}
        >
          <LockKeyhole size={15} />
          선생님 입장
        </button>
      </div>
      <div className="title-stars" aria-hidden="true">
        <span>✦</span>
        <span>✧</span>
        <span>✦</span>
        <span>+</span>
      </div>
      <section className="title-center">
        <span className="little-badge">
          <Sparkles size={14} /> 나만의 하루가 게임이 되는 시간
        </span>
        <h1 aria-label="시계는 째깍! 하루는 찰칵!">
          <span>
            시계는 <strong>째깍!</strong>
          </span>
          <span>
            하루는 <em>찰칵!</em>
          </span>
        </h1>
        <div className="camera-emblem" aria-hidden="true">
          <svg viewBox="0 0 240 180">
            <path
              d="M58 37h32l12-18h42l12 18h31a20 20 0 0 1 20 20v94a20 20 0 0 1-20 20H52a20 20 0 0 1-20-20V57a20 20 0 0 1 20-20z"
              fill="#98d5c5"
              stroke="#17283a"
              strokeWidth="7"
            />
            <path d="M51 40v-12h31v12" fill="#ffc672" stroke="#17283a" strokeWidth="6" />
            <circle cx="119" cy="104" r="55" fill="#fff9e9" stroke="#17283a" strokeWidth="7" />
            <circle cx="119" cy="104" r="44" fill="none" stroke="#e9d7bb" strokeWidth="2" />
            {Array.from({ length: 12 }, (_, i) => (
              <line
                key={i}
                x1="119"
                y1="65"
                x2="119"
                y2="71"
                transform={`rotate(${i * 30} 119 104)`}
                stroke="#17283a"
                strokeWidth="3"
                strokeLinecap="round"
              />
            ))}
            <path
              d="M119 104 96 85m23 19 30-24"
              stroke="#17283a"
              strokeWidth="7"
              strokeLinecap="round"
            />
            <circle cx="119" cy="104" r="6" fill="#ef8a78" />
            <circle cx="181" cy="58" r="6" fill="#fff9e9" />
          </svg>
          <span className="emblem-spark">✦</span>
        </div>
        <button
          className="start-prompt"
          aria-label="게임 시작"
          onClick={(e) => {
            e.stopPropagation();
            start();
          }}
        >
          <span>PRESS ANY BUTTON</span>
          <small>게임을 시작하려면 아무 버튼이나 누르세요</small>
        </button>
        <p className="title-caption">째깍 읽고, 착착 맞추고, 찰칵 들려줘!</p>
      </section>
      <footer className="arcade-bottom">
        <span>
          <Volume2 size={14} /> 즐겁게 배우는 나만의 시간 여행
        </span>
        <span>
          PLAYER 1–6 <span className="tiny-dot" />
        </span>
      </footer>
    </main>
  );
}
