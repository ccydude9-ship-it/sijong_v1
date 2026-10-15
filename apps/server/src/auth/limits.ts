import {hashValue} from './crypto';import {fail} from '../errors';
export class LoginLimits{
 private counts=new Map<string,{count:number;until:number}>();
 check(ip:string,identity:string){const now=Date.now();for(const [k,v]of this.counts)if(v.until<=now)this.counts.delete(k);for(const [key,max]of [[`ip:${ip}`,20],[`id:${hashValue(identity)}`,5]] as const){const c=this.counts.get(key);if(c&&c.count>=max)fail(429,'잠시 기다린 뒤 다시 시도해 주세요');}}
 failed(ip:string,identity:string){for(const key of [`ip:${ip}`,`id:${hashValue(identity)}`]){const c=this.counts.get(key);this.counts.set(key,{count:(c?.count||0)+1,until:c?.until||Date.now()+300000});}}
}
