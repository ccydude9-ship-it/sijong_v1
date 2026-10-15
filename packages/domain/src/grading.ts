import {toClockTime,type ClockTime} from './time';
import type {Card} from './cards';
export type AnswerMap=Record<string,ClockTime|null>;
export function gradeTimes(cards:Card[],answers:AnswerMap):string[]{return cards.filter(c=>{const a=answers[c.id],t=toClockTime(c.minuteOfDay);return !a||a.hour!==t.hour||a.minute!==t.minute;}).map(c=>c.id);}
export function gradeOrder(cards:Card[],order:string[]):string[]{if(order.length!==cards.length||new Set(order).size!==cards.length||order.some(id=>!cards.some(c=>c.id===id)))throw new Error('카드 8장을 빠짐없이 배열해 주세요');const sorted=[...cards].sort((a,b)=>a.minuteOfDay-b.minuteOfDay);return order.filter((id,i)=>id!==sorted[i].id);}
export function matchPracticeCard(cards:Card[],t:ClockTime):Card|null{return [...cards].sort((a,b)=>a.minuteOfDay-b.minuteOfDay).find(c=>{const target=toClockTime(c.minuteOfDay);return target.hour===t.hour&&target.minute===t.minute;})??null;}
