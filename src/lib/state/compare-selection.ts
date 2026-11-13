"use client";

import { useCallback, useSyncExternalStore } from "react";

const STORAGE_KEY = "orbitflame_compare_ids";
const CHANGE_EVENT = "orbitflame:compare-selection-change";
const MAX_COMPARE_ITEMS = 4;

let cachedRaw = "[]";
let cachedParsed: string[] = [];
const EMPTY_IDS: string[] = [];

function readRaw(): string {
  if (typeof window === "undefined") return "[]";
  try {
    return window.sessionStorage.getItem(STORAGE_KEY) ?? "[]";
  } catch {
    return "[]";
  }
}

function getSnapshot(): string[] {
  const raw = readRaw();
  if (raw === cachedRaw) return cachedParsed;
  cachedRaw = raw;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      cachedParsed = parsed.filter((item): item is string => typeof item === "string").slice(0, MAX_COMPARE_ITEMS);
      return cachedParsed;
    }
  } catch {
    // Ignore malformed sessionStorage payload
  }
  cachedParsed = EMPTY_IDS;
  return cachedParsed;
}

function getServerSnapshot(): string[] {
  return EMPTY_IDS;
}

function subscribe(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = () => callback();
  window.addEventListener(CHANGE_EVENT, handler);
  window.addEventListener("storage", handler);
  return () => {
    window.removeEventListener(CHANGE_EVENT, handler);
    window.removeEventListener("storage", handler);
  };
}

export function setCompareIds(ids: string[]): string[] {
  const unique = [...new Set(ids.filter((id) => id.trim().length > 0))].slice(0, MAX_COMPARE_ITEMS);
  const serialized = JSON.stringify(unique);
  if (typeof window !== "undefined") {
    try {
      window.sessionStorage.setItem(STORAGE_KEY, serialized);
    } catch {
      // Ignore storage quota / privacy mode errors
    }
    cachedRaw = serialized;
    cachedParsed = unique;
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }
  return unique;
}

export function useCompareSelection() {
  const selectedIds = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const toggleId = useCallback((id: string) => {
    const current = getSnapshot();
    if (current.includes(id)) {
      return setCompareIds(current.filter((item) => item !== id));
    }
    if (current.length >= MAX_COMPARE_ITEMS) return current;
    return setCompareIds([...current, id]);
  }, []);

  const replaceIds = useCallback((ids: string[]) => {
    return setCompareIds(ids);
  }, []);

  const clearIds = useCallback(() => {
    return setCompareIds([]);
  }, []);

  return { selectedIds, toggleId, replaceIds, clearIds, maxItems: MAX_COMPARE_ITEMS };
}
