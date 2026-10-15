import React from 'react';
import { Camera, Stars } from 'lucide-react';
import type { StudentSnapshot } from '../../../../packages/contracts/src/index';
export function StudentShareView({ snapshot }: { snapshot: StudentSnapshot }) {
  return (
    <section>
      <header className="page-heading">
        <span className="eyebrow">공유모드 · MY LITTLE DAY</span>
        <h1>찰칵! 내 하루를 들려줘</h1>
        <p>내가 가장 좋아하는 시간은 언제인가요?</p>
      </header>
      {snapshot.progress.stage !== 'completed' ? (
        <div className="panel empty-state">
          <Camera size={60} strokeWidth={1.5} />
          <h2>내 하루 이야기를 준비해요</h2>
          <p>실전모드에서 일과표를 완성해 주세요</p>
        </div>
      ) : (
        <>
          <p className="notice">
            <Stars size={18} /> {snapshot.student.displayName}의 소중한 하루가 완성됐어요!
          </p>
          <div className="timeline">
            {snapshot.progress.order.map((id, i) => {
              const c = snapshot.cards.find((c) => c.id === id)!;
              const answer = snapshot.progress.answers[id];
              return (
                <article className="timeline-card" key={id}>
                  <span className="timeline-index">{i + 1}</span>
                  <img src={`/api/images/${c.imageId}`} alt={c.title} />
                  <div>
                    <span className="eyebrow">
                      {c.minuteOfDay < 720 ? '오전' : '오후'} {answer?.hour}시{' '}
                      {answer?.minute === 30 ? '30분' : ''}
                    </span>
                    <h3>{c.title}</h3>
                  </div>
                </article>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}
