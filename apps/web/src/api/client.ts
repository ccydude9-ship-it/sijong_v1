import type {z} from 'zod';
let csrf='';export const setCsrf=(value:string)=>{csrf=value;};
export class ApiError extends Error{constructor(public status:number,message:string,public details?:unknown){super(message);}}
export async function request<T>(path:string,init:RequestInit={},schema?:z.ZodType<T>):Promise<T>{const headers=new Headers(init.headers);if(init.body&&!headers.has('Content-Type'))headers.set('Content-Type','application/json');if(init.method&&!['GET','HEAD'].includes(init.method))headers.set('X-CSRF-Token',csrf);const res=await fetch(path,{...init,headers,credentials:'same-origin'});const body=await res.json();if(!res.ok)throw new ApiError(res.status,body.message||'다시 시도해 주세요',body.details);return schema?schema.parse(body):body as T;}
export const json=(method:string,body:object):RequestInit=>({method,body:JSON.stringify(body)});
