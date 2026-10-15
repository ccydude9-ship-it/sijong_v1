import React from 'react';import {Volume2,VolumeX} from 'lucide-react';
export function SoundToggle({enabled,onToggle}:{enabled:boolean;onToggle:()=>void}){return <button className="ghost" aria-label={enabled?'소리 끄기':'소리 켜기'} aria-pressed={enabled} onClick={onToggle}>{enabled?<Volume2 size={17}/>:<VolumeX size={17}/>}<span>{enabled?'소리 켜짐':'소리 꺼짐'}</span></button>;}
