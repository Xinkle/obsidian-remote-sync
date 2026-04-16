import { moment } from "obsidian";
import en from "./locales/en";
import ko from "./locales/ko";

const localeMap: { [key: string]: any } = {
  en,
  ko,
};

export function t(key: string, vars?: { [key: string]: string | number }): string {
  const locale = moment.locale();
  const strings = localeMap[locale] || localeMap["en"];
  let result = strings[key] || en[key as keyof typeof en] || key;

  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      result = result.replace(`{{${k}}}`, String(v));
    }
  }
  return result;
}
