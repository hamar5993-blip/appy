import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const esc = (s: string) => String(s).replace(/[&<>"']/g, c => 
  ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c] || c)
);

export const trunc = (s: string, n: number) => s.length > n ? s.slice(0, n-1) + '…' : s;
export const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
export const shuffle = <T,>(a: T[]): T[] => { 
  const arr = [...a]; 
  for(let i = arr.length-1; i > 0; i--) { 
    const j = Math.floor(Math.random()*(i+1)); 
    [arr[i], arr[j]] = [arr[j], arr[i]]; 
  } 
  return arr; 
};
export const clampN = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
