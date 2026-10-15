import {randomBytes,randomUUID} from 'node:crypto';import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';import {dirname} from 'node:path';
import type {Store} from '../db';import type {Config} from '../config';import type {Session} from '../../../../packages/contracts/src/index';import {fail} from '../errors';import {hashValue,hmac,passwordHash,verifyPassword,equal} from './crypto';
export class AuthService{
 private key:Buffer;onRevoke:(id:string)=>void=()=>{};
 constructor(readonly store:Store,readonly config:Config){mkdirSync(dirname(config.keyPath),{recursive:true});try{this.key=readFileSync(config.keyPath);}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;this.key=randomBytes(32);writeFileSync(config.keyPath,this.key,{flag:'wx',mode:0o600});}if(this.key.length!==32)throw Error('서버 키가 올바르지 않습니다');this.bootstrapTeacher(config.teacherPassword||'');}
 bootstrapTeacher(password:string){if(this.store.settings.get('teacher-password'))return;if(password.length<8)throw Error('SIJONG_TEACHER_PASSWORD에 8자 이상 초기 비밀번호가 필요합니다');this.store.settings.set('teacher-password',passwordHash(password));}
 codeHash(code:string){return hmac(this.key,code);}
 issue(role:Session['role'],lessonId:string|null=null,studentId:string|null=null){const token=randomBytes(32).toString('hex');const session:Session={id:randomUUID(),role,lessonId,studentId,expiresAt:Date.now()+8*3600000};const csrfToken=randomBytes(32).toString('hex');this.store.sessions.set({...session,tokenHash:hashValue(token),csrfToken});return {token,csrfToken,session};}
 loginTeacher(password:string){if(!verifyPassword(password,this.store.settings.get('teacher-password')||''))fail(401,'접속 정보를 확인해 주세요');return this.issue('teacher');}
 loginClassroom(code:string){const l=this.store.lessons.list().find(l=>l.phase!=='ended');if(!l?.codeHash||!equal(this.codeHash(code),l.codeHash))fail(401,'접속 정보를 확인해 주세요');return this.issue('classroom',l.id);}
 selectStudent(s:Session,id:string){if(s.role!=='classroom')fail(403,'이름을 다시 선택해 주세요');const student=this.store.students.get(id),l=this.store.lessons.get(s.lessonId!);if(!student||student.lessonId!==s.lessonId||!l||l.phase==='ended')fail(403,'이 수업에서 이름을 선택해 주세요');this.logout(s.id);return this.issue('student',s.lessonId,id);}
 resetStudent(s:Session){if(s.role!=='student')fail(403,'학생 접속이 필요합니다');this.logout(s.id);return this.issue('classroom',s.lessonId);}
 lookup(token:string|undefined){if(!token)return;const s=this.store.sessions.find(hashValue(token));if(!s)return;if(s.expiresAt<=Date.now()){this.logout(s.id);return;}return s;}
 logout(id:string){this.store.sessions.delete(id);this.onRevoke(id);}
 revokeLessonSessions(lessonId:string){for(const s of this.store.sessions.list())if(s.lessonId===lessonId)this.logout(s.id);}
 changeTeacherPassword(password:string){if(password.length<8)fail(400,'8자 이상 비밀번호가 필요합니다');this.store.settings.set('teacher-password',passwordHash(password));for(const s of this.store.sessions.list())if(s.role==='teacher')this.logout(s.id);}
}
