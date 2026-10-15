export type ClockTime={hour:number;minute:0|30};
export type Period='am'|'pm';
export function assertClock(t:ClockTime){if(!Number.isInteger(t.hour)||t.hour<1||t.hour>12||![0,30].includes(t.minute))throw new Error('올바른 시각을 선택해 주세요');}
export function toMinuteOfDay(t:ClockTime,p:Period):number{assertClock(t);if(p!=='am'&&p!=='pm')throw new Error('오전·오후를 선택해 주세요');return (t.hour%12+(p==='pm'?12:0))*60+t.minute;}
export function toClockTime(n:number):ClockTime{if(!Number.isInteger(n)||n<0||n>=1440||n%30!==0)throw new Error('올바른 하루 시각이 아닙니다');return {hour:Math.floor(n/60)%12||12,minute:n%60 as 0|30};}
export function handAngles(t:ClockTime){assertClock(t);return {hour:(t.hour%12)*30+t.minute*.5,minute:t.minute*6};}
