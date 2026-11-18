import { useSyncExternalStore } from 'react';
import { laser } from '../device/laser';

export const useLaser = () => useSyncExternalStore(laser.subscribe, laser.getState);
export const useLaserLog = () => useSyncExternalStore(laser.subscribe, laser.getLog);

/** 234,5 cm → „2,345 m” */
export const fmtMeters = (cm: number) => `${(cm / 100).toFixed(3).replace('.', ',')} m`;
