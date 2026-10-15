import type {Store} from '../db';import type {ProgressService} from '../progress/service';import type {Session,SnapshotEvent,TeacherSnapshot} from '../../../../packages/contracts/src/index';import {gradeTimes} from '../../../../packages/domain/src/index';import {fail} from '../errors';
type Entry={session:Session;send:(e:SnapshotEvent)=>void;close:()=>void};
export class EventHub{
 private entries=new Set<Entry>();private sweep:ReturnType<typeof setInterval>;
 constructor(readonly store:Store,readonly progress:ProgressService){this.sweep=setInterval(()=>{if(!store.db.isOpen)return;for(const e of [...this.entries])if(!this.valid(e))this.remove(e);},1000);this.sweep.unref();}
 private valid(e:Entry){const s=this.store.sessions.get(e.session.id);return !!s&&s.expiresAt>Date.now()&&!!this.store.lessons.get(e.session.lessonId!);}
 teacherSnapshot(lessonId:string):TeacherSnapshot{const l=this.store.lessons.get(lessonId)||fail(404,'수업을 찾을 수 없습니다');return {lessonId,phase:l.phase,phaseRevision:l.revision,students:this.store.students.list(lessonId).map(s=>{const p=this.store.progress.get(s.id),cards=this.store.students.cards(s.id);return {studentId:s.id,displayName:s.displayName,distinction:s.distinction,progressRevision:p.revision,stage:p.stage,correctTimeCount:cards.length-gradeTimes(cards,p.answers).length,solvedCount:this.store.practice.list(s.id).filter(q=>q.solved).length,connected:[...this.entries].some(e=>e.session.studentId===s.id&&this.valid(e)),completedAt:p.completedAt};})};}
 private deliver(e:Entry){if(!this.valid(e)){this.remove(e);return;}try{e.send({type:'snapshot',data:e.session.role==='teacher'?this.teacherSnapshot(e.session.lessonId!):this.progress.read(e.session)});}catch{this.remove(e);}}
 private teachers(lessonId:string){for(const e of [...this.entries])if(e.session.role==='teacher'&&e.session.lessonId===lessonId)this.deliver(e);}
 private remove(e:Entry){if(!this.entries.delete(e))return;try{e.close();}catch{}if(this.store.db.isOpen&&this.store.lessons.get(e.session.lessonId!))this.teachers(e.session.lessonId!);}
 subscribe(session:Session,send:(event:SnapshotEvent)=>void,close:()=>void=()=>{}){if(!['student','teacher'].includes(session.role))fail(403,'학생 또는 선생님 접속이 필요합니다');if(!session.lessonId||!this.store.lessons.get(session.lessonId))fail(404,'수업을 찾을 수 없습니다');const e={session,send,close};if(!this.valid(e))fail(401,'다시 접속해 주세요');this.entries.add(e);this.deliver(e);this.teachers(session.lessonId);return ()=>this.remove(e);}
 publishCommitted(lessonId:string){for(const e of [...this.entries])if(e.session.lessonId===lessonId)this.deliver(e);}
 revoke(ids:string[]){for(const e of [...this.entries])if(ids.includes(e.session.id))this.remove(e);}
 close(){clearInterval(this.sweep);for(const e of [...this.entries]){this.entries.delete(e);try{e.close();}catch{}}}
}
