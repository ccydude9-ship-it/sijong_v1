import React from 'react';
import { PartyPopper } from 'lucide-react';
export function CompletedView({
  onShare,
  onReadAgain,
}: {
  onShare: () => void;
  onReadAgain: () => Promise<void>;
}) {
  return (
    <section className="completed panel">
      <PartyPopper size={68} strokeWidth={1.5} />
      <span className="eyebrow">MISSION COMPLETE</span>
      <h1>내 하루 완성!</h1>
      <p>시계를 읽고, 나의 하루를 멋지게 정리했어요.</p>
      <button className="primary" onClick={onShare}>
        내 하루 들려주기
      </button>
      <button className="ghost" onClick={() => void onReadAgain()}>
        시각 다시 읽기
      </button>
    </section>
  );
}
