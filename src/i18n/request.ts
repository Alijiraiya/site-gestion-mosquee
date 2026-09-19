import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";
import { appMessages } from "@/lib/i18n";

export const locales = ["fr", "ar"];
export const defaultLocale = "fr";

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get("locale")?.value;
  const locale = locales.includes(cookieLocale) ? cookieLocale : defaultLocale;

  const messages = (await import(`../messages/${locale}.json`)).default;

  return {
    locale,
    messages: { ...messages, App: appMessages[locale] },
  };
});
