import React from 'react';import {Wifi,WifiOff} from 'lucide-react';
export function ConnectionStatus({connected}:{connected:boolean}){return <span className="connection-status" role="status">{connected?<Wifi size={13}/>:<WifiOff size={13}/>} {connected?'수업에 연결됨':'수업 연결 확인 중'}</span>;}
