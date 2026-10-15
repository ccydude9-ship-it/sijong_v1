import { describe,it,expect } from 'vitest';
import {toMinuteOfDay,toClockTime,handAngles,validateCards,gradeTimes,gradeOrder,matchPracticeCard} from '../../packages/domain/src/index';
import { makeValidCards } from '../helpers/cards';
describe('clock learning rules',()=>{
 it('converts noon and midnight',()=>{expect(toMinuteOfDay({hour:12,minute:0},'am')).toBe(0);expect(toMinuteOfDay({hour:12,minute:30},'pm')).toBe(750);});
 it('places half hour hand between numbers',()=>expect(handAngles({hour:3,minute:30})).toEqual({hour:105,minute:180}));
 it('covers_all_24_clock_faces',()=>{for(let h=1;h<=12;h++)for(const minute of [0,30] as const){const t={hour:h,minute};expect(toClockTime(toMinuteOfDay(t,'pm'))).toEqual(t);expect(handAngles(t).minute).toBe(minute*6);}});
 it('rejects_out_of_range_time',()=>{for(const hour of [0,13,NaN,1.5])expect(()=>toMinuteOfDay({hour,minute:0},'am')).toThrow();expect(()=>toClockTime(-30)).toThrow();expect(()=>toClockTime(1440)).toThrow();});
 it('requires_exactly_eight_unique_cards',()=>{const c=makeValidCards();expect(validateCards(c)).toEqual([]);expect(validateCards(c.slice(1)).length).toBeGreaterThan(0);expect(validateCards(c.map((x,i)=>i===1?{...x,minuteOfDay:420}:x)).length).toBeGreaterThan(0);expect(validateCards(c.map(x=>({...x,id:'same'}))).length).toBeGreaterThan(0);});
 it('requires_wake_before_sleep',()=>{const c=makeValidCards();c[0].minuteOfDay=1410;expect(validateCards(c).length).toBeGreaterThan(0);c[0].kind='custom';expect(validateCards(c).length).toBeGreaterThan(0);});
 it('marks_only_wrong_time_ids',()=>{const c=makeValidCards(),a=Object.fromEntries(c.map(x=>[x.id,toClockTime(x.minuteOfDay)]));a.c2={hour:1,minute:0};expect(gradeTimes(c,a)).toEqual(['c2']);});
 it('marks misplaced card positions',()=>expect(gradeOrder(makeValidCards(),['c2','c1','c3','c4','c5','c6','c7','c8'])).toEqual(['c2','c1']));
 it('rejects_missing_duplicate_or_foreign_order_ids',()=>{for(const ids of [[],Array(8).fill('c1'),['foreign','c2','c3','c4','c5','c6','c7','c8']])expect(()=>gradeOrder(makeValidCards(),ids)).toThrow();});
 it('matches earlier am card and allows no match',()=>{const c=makeValidCards();expect(matchPracticeCard([c[0],{...c[0],id:'pm',minuteOfDay:1140}],{hour:7,minute:0})?.id).toBe('c1');expect(matchPracticeCard(c,{hour:2,minute:0})).toBeNull();});
});
