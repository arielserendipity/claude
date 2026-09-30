import { useCallback, useEffect, useState } from 'react';

// 새로고침해도 학생 작업이 남도록 기기 브라우저에 저장한다. (시크릿 창 등에서는 조용히 무시)
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

// key가 바뀌면(예: 학생 이름 변경) 그 key에 저장된 값을 불러와 쓴다.
export function useStoredState<T>(key: string, fallback: T) {
  const [entry, setEntry] = useState(() => ({ key, value: loadStored(key, fallback) }));
  const current = entry.key === key ? entry : { key, value: loadStored(key, fallback) };
  if (entry.key !== key) setEntry(current);

  useEffect(() => {
    saveStored(current.key, current.value);
  }, [current.key, current.value]);

  const setValue = useCallback(
    (v: T | ((prev: T) => T)) => {
      setEntry((prev) => {
        const base = prev.key === key ? prev.value : loadStored(key, fallback);
        const next = typeof v === 'function' ? (v as (p: T) => T)(base) : v;
        return { key, value: next };
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key]
  );

  return [current.value, setValue] as const;
}
