"use client";

import { createContext, useContext, useMemo } from "react";
import { createT, getDictionary, type Translator } from "./index";

const I18nContext = createContext<Translator | null>(null);

export function I18nProvider({ locale, children }: { locale: string; children: React.ReactNode }) {
  const value = useMemo(() => createT(getDictionary(locale)), [locale]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useT(): Translator {
  const ctx = useContext(I18nContext);
  // Outside the provider (e.g. login page) fall back to the default dictionary.
  return ctx ?? createT(getDictionary("lv"));
}
