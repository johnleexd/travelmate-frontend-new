'use client';
import { createContext, useCallback, useContext } from 'react';
export const ActivityPhotoRecovery = createContext<((day: number, index: number, imageUrl: string) => void) | undefined>(undefined);
export function useActivityPhotoFailure(day: number, index: number, imageUrl?: string) {
  const recover = useContext(ActivityPhotoRecovery);
  return useCallback(() => { if (imageUrl) recover?.(day, index, imageUrl); }, [recover, day, index, imageUrl]);
}
