import { useCallback, useEffect, useState } from 'react';

// 저장은 두 가지로 나뉜다.
// - 기기 기록(활동 로그·교사 메모·시트 URL): 기기 브라우저(localStorage)에 남아 새로고침해도 그대로다.
// - 학생 진행(이름·답·별·푼 문제·만든 자료): 이 화면에서만 기억한다. 새로고침하면 지워지고 처음부터 시작한다.

// 기기 브라우저에 저장 (시크릿 창 등에서는 조용히 무시)
export function loadStored<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw == null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

export function saveStored<T>(key: string, value: T) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // 저장 공간을 쓸 수 없어도 활동은 계속된다.
  }
}

export function removeStoredByPrefix(prefix: string) {
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith(prefix))
      .forEach((k) => localStorage.removeItem(k));
  } catch {
    // 무시
  }
}

// 학생 진행은 메모리에만 둔다 (새로고침하면 사라짐)
const session = new Map<string, unknown>();

export function loadSession<T>(key: string, fallback: T): T {
  return session.has(key) ? (session.get(key) as T) : fallback;
}

export function saveSession<T>(key: string, value: T) {
  session.set(key, value);
}

export function clearSession() {
  session.clear();
}

// 예전 버전이 기기에 남긴 학생 진행(이름·답·푼 문제)을 지운다. 기기 기록(로그·메모·시트 URL)은 그대로 둔다.
const OLD_PROGRESS_PREFIXES = ['avg_player_name', 'avg_solved_', 'avg_a2_'];
export function clearOldProgress() {
  OLD_PROGRESS_PREFIXES.forEach(removeStoredByPrefix);
}

interface KeyedBackend {
  load: <T>(key: string, fallback: T) => T;
  save: <T>(key: string, value: T) => void;
}

const DEVICE: KeyedBackend = { load: loadStored, save: saveStored };
const SESSION: KeyedBackend = { load: loadSession, save: saveSession };

// key가 바뀌면(예: 학생 이름 변경) 그 key에 저장된 값을 불러와 쓴다.
function useKeyedState<T>(key: string, fallback: T, backend: KeyedBackend) {
  const [entry, setEntry] = useState(() => ({ key, value: backend.load(key, fallback) }));
  const current = entry.key === key ? entry : { key, value: backend.load(key, fallback) };
  if (entry.key !== key) setEntry(current);

  useEffect(() => {
    backend.save(current.key, current.value);
  }, [current.key, current.value, backend]);

  const setValue = useCallback(
    (v: T | ((prev: T) => T)) => {
      setEntry((prev) => {
        const base = prev.key === key ? prev.value : backend.load(key, fallback);
        const next = typeof v === 'function' ? (v as (p: T) => T)(base) : v;
        return { key, value: next };
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key]
  );

  return [current.value, setValue] as const;
}

// 기기 기록용 (새로고침해도 남음)
export const useStoredState = <T,>(key: string, fallback: T) => useKeyedState(key, fallback, DEVICE);
// 학생 진행용 (새로고침하면 처음부터)
export const useSessionState = <T,>(key: string, fallback: T) => useKeyedState(key, fallback, SESSION);
