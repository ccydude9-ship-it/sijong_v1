import React from 'react';
import { it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ClockFace } from '../../apps/web/src/components/ClockFace';
import { TimeInput } from '../../apps/web/src/components/TimeInput';
import { SoundToggle } from '../../apps/web/src/components/SoundToggle';
it('clock_accessible_label_does_not_reveal_answer', () => {
  render(<ClockFace time={{ hour: 3, minute: 30 }} hint="zoom" />);
  expect(screen.getByRole('img', { name: '바늘시계' })).toBeVisible();
  expect(screen.queryByText('3시 30분')).toBeNull();
});
it('time_controls_are_keyboard_native_buttons', () => {
  const change = vi.fn();
  render(<TimeInput value={null} onChange={change} error={false} />);
  fireEvent.click(screen.getByRole('button', { name: '5시' }));
  expect(change).toHaveBeenCalledWith({ hour: 5, minute: 0 });
  expect(screen.getByRole('group', { name: '시 선택' })).toBeVisible();
});
it('sound_has_explicit_mute_control', () => {
  const toggle = vi.fn();
  render(<SoundToggle enabled={false} onToggle={toggle} />);
  fireEvent.click(screen.getByRole('button', { name: '소리 켜기' }));
  expect(toggle).toHaveBeenCalledTimes(1);
});
