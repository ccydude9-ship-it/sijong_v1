import React, { useRef } from 'react';
import { ArrowLeft, ArrowRight, Grip } from 'lucide-react';
import type { StudentSnapshot, StudentProgress } from '../../../../packages/contracts/src/index';
export function OrderingView({
  snapshot,
  progress,
  onOrder,
  onCheck,
  onReadAgain,
  busy,
}: {
  snapshot: StudentSnapshot;
  progress: StudentProgress;
  onOrder: (ids: string[]) => void;
  onCheck: () => Promise<void>;
  onReadAgain: () => Promise<void>;
  busy: boolean;
}) {
  const dragging = useRef<string | null>(null);
  function move(id: string, target: number) {
    if (busy) return;
    const ids = [...progress.order],
      index = ids.indexOf(id);
    if (index < 0 || target < 0 || target >= ids.length || index === target) return;
    ids.splice(index, 1);
    ids.splice(target, 0, id);
    onOrder(ids);
  }
  return (
    <section>
      <header className="page-heading">
        <span className="eyebrow">실전모드 · STEP 02</span>
        <h1>내 하루를 순서대로!</h1>
        <p>이른 시각부터 늦은 시각까지, 카드를 착착 놓아 봐요.</p>
      </header>
      <div className="order-grid">
        {progress.order.map((id, i) => {
          const c = snapshot.cards.find((c) => c.id === id)!;
          const answer = progress.answers[id];
          return (
            <article
              key={id}
              className="order-card"
              data-order-card={id}
              data-testid={`ordering-${id}`}
              data-error={progress.wrongOrderIds.includes(id) ? 'order' : undefined}
            >
              <div className="order-card-top">
                <span>{String(i + 1).padStart(2, '0')}</span>
                <button
                  className="drag-handle"
                  disabled={busy}
                  aria-label={`${c.title} 카드 끌어 이동`}
                  style={{ touchAction: 'none' }}
                  onPointerDown={(e) => {
                    dragging.current = id;
                    e.currentTarget.setPointerCapture?.(e.pointerId);
                  }}
                  onPointerMove={(e) => {
                    if (!dragging.current) return;
                    const hit = document
                      .elementFromPoint(e.clientX, e.clientY)
                      ?.closest<HTMLElement>('[data-order-card]')?.dataset.orderCard;
                    if (hit) move(dragging.current, progress.order.indexOf(hit));
                  }}
                  onPointerUp={() => (dragging.current = null)}
                  onPointerCancel={() => (dragging.current = null)}
                >
                  <Grip size={20} />
                </button>
              </div>
              <img src={`/api/images/${c.imageId}`} alt={c.title} />
              <h3>{c.title}</h3>
              <p className="order-time">
                {c.minuteOfDay < 720 ? '오전' : '오후'} {answer?.hour ?? '?'}시{' '}
                {answer?.minute === 30 ? '30분' : ''}
              </p>
              <div className="order-controls">
                <button
                  aria-label={`${c.title} 앞으로`}
                  disabled={busy || i === 0}
                  onClick={() => move(id, i - 1)}
                >
                  <ArrowLeft size={16} />
                  앞으로
                </button>
                <button
                  aria-label={`${c.title} 뒤로`}
                  disabled={busy || i === 7}
                  onClick={() => move(id, i + 1)}
                >
                  뒤로
                  <ArrowRight size={16} />
                </button>
              </div>
              {progress.wrongOrderIds.includes(id) && (
                <p className="input-error">이 카드의 자리를 다시 살펴봐요</p>
              )}
            </article>
          );
        })}
      </div>
      <div className="activity-actions">
        <button className="ghost" disabled={busy} onClick={() => void onReadAgain()}>
          시각 다시 읽기
        </button>
        <button className="primary" disabled={busy} onClick={() => void onCheck()}>
          완성하기
        </button>
      </div>
    </section>
  );
}
