"use client";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
import { registerImg } from "@/lib/utils";
import { useState } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { translateApiError } from "@/lib/apiErrors";

export default function RegisterPage() {
  const router = useRouter();
  const language = useLocale();
  const translations = useTranslations().raw("register");
  const isRTL = language === "ar";

  const [step, setStep] = useState(1);
  const commonInputProps = {
    autoComplete: "off",
    autoCorrect: "off",
    autoCapitalize: "none",
    spellCheck: "false",
  };
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    password: "",
    mosque: {
      name: "",
      wilaya: "",
      commune: "",
      address: "",
      phone: "",
    },
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });

  const change = (e) => {
    const { name, value } = e.target;
    if (name.startsWith("mosque.")) {
      const key = name.split(".")[1];
      setForm((p) => ({ ...p, mosque: { ...p.mosque, [key]: value } }));
    } else {
      setForm((p) => ({ ...p, [name]: value }));
    }
    if (message.text) setMessage({ type: "", text: "" });
  };

  const next = (e) => {
    e && e.preventDefault();
    setStep(2);
  };

  const back = (e) => {
    e && e.preventDefault();
    setStep(1);
  };

  const submit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setMessage({ type: "", text: "" });
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(form),
      });
      const payload = await res.json();
      if (!res.ok || !payload?.success)
        throw new Error(
          (payload?.message && translateApiError(payload.message, language)) ||
            translations.error,
        );
      setMessage({ type: "success", text: translations.success });
      router.push("/dashboard");
    } catch (err) {
      setMessage({
        type: "error",
        text: err.message || translations.error,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <motion.main
      dir={isRTL ? "rtl" : "ltr"}
      className="relative min-h-[100dvh] w-full overflow-x-hidden"
    >
      <Image
        sizes="100vw"
        src={registerImg}
        alt="Mosque"
        fill
        priority
        className="scale-105 object-cover blur-md"
      />
      <div className="absolute inset-0 bg-black/15 dark:bg-black/40" />

      <motion.div
        initial={{ opacity: 0, scale: 1.1 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.4 }}
        className="relative z-10 flex min-h-[100dvh] items-center justify-center p-3 sm:p-4 md:p-6 lg:p-8 xl:p-10 2xl:p-12 3xl:p-16"
      >
        <div className="flex w-full max-w-sm flex-col overflow-hidden rounded-2xl bg-white shadow-2xl sm:max-w-md md:max-w-xl lg:max-w-4xl lg:flex-row  dark:bg-linear-142 dark:from-0% dark:from-[#223D8F] dark:to-[#0A1129] dark:to-73%">
          <div className="relative hidden lg:block lg:w-[44%] xl:w-[46%] 2xl:w-1/2">
            <Image
              src={registerImg}
              alt="Mosque"
              fill
              sizes="(max-width: 1023px) 0px, (max-width: 1535px) 45vw, 50vw"
              className="object-cover"
            />
          </div>

          <div
            dir={isRTL ? "rtl" : "ltr"}
            className="flex min-w-0 flex-1 items-center justify-center px-5 py-7 sm:px-8 sm:py-9 md:px-12 md:py-10 lg:px-10 lg:py-8 xl:px-12 xl:py-10 2xl:px-16 2xl:py-12 3xl:px-20 3xl:py-14"
          >
            <div className="w-full max-w-sm sm:max-w-md md:max-w-lg lg:max-w-md xl:max-w-lg 2xl:max-w-xl 3xl:max-w-2xl">
              <Link
                href="/"
                className="mb-3 flex items-center gap-2 text-sm text-primary transition-colors duration-100 hover:text-primary/60 sm:mb-4 md:text-base lg:mb-3 lg:text-sm xl:mb-4 xl:text-base 2xl:mb-5 3xl:text-lg"
              >
                {isRTL ? <ArrowRight size={16} /> : <ArrowLeft size={16} />}
                {translations.back}
              </Link>

              <h1 className="text-3xl font-bold text-foreground sm:text-[2rem] md:text-4xl lg:text-3xl ">
                {translations.title}
              </h1>
              <p className="mb-6 mt-2 text-sm text-foreground/60 sm:mb-8 sm:text-base md:mb-10 lg:mb-6 lg:text-sm xl:mb-8   ">
                {step === 1
                  ? translations.subtitleStep1
                  : translations.subtitleStep2}
              </p>

              <form onSubmit={step === 1 ? next : submit} className="space-y-4 sm:space-y-5 md:space-y-5 lg:space-y-4 ">
                {step === 1 ? (
                  <>
                    <div>
                      <label className="mb-2 block text-sm font-medium text-foreground/80">
                        {translations.firstName}
                      </label>
                      <input
                        {...commonInputProps}
                        name="firstName"
                        value={form.firstName}
                        onChange={change}
                        required
                        placeholder={translations.placeholder.firstName}
                        className="w-full rounded-lg border px-3 py-2"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-foreground/80">
                        {translations.lastName}
                      </label>
                      <input
                        {...commonInputProps}
                        name="lastName"
                        value={form.lastName}
                        onChange={change}
                        required
                        className="w-full rounded-lg border px-3 py-2"
                        placeholder={translations.placeholder.lastName}
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-foreground/80">
                        {translations.emailLabel}
                      </label>
                      <input
                        {...commonInputProps}
                        name="email"
                        type="email"
                        value={form.email}
                        onChange={change}
                        required
                        placeholder={translations.placeholder.email}
                        className="w-full rounded-lg border px-3 py-2"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-foreground/80">
                        {translations.phoneLabel}
                      </label>
                      <input
                        dir={"ltr"}
                        {...commonInputProps}
                        name="phone"
                        value={form.phone}
                        onChange={change}
                        placeholder={translations.placeholder.phone}
                        className={
                          "w-full rounded-lg border  px-3 py-2" +
                          (isRTL ? " text-right" : "")
                        }
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-foreground/80">
                        {translations.passwordLabel}
                      </label>
                      <input
                        {...commonInputProps}
                        autoComplete="new-password"
                        name="password"
                        type="password"
                        value={form.password}
                        onChange={change}
                        required
                        placeholder={translations.placeholder.password}
                        className="w-full rounded-lg border px-3 py-2"
                      />
                    </div>

                    <div className="flex flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <p className="flex flex-wrap items-center justify-center gap-2 text-center text-sm text-gray-500 sm:justify-start">
                        {translations.hasAccount}
                        <Link
                          href="/login"
                          className="font-semibold text-emerald-500 hover:text-emerald-600"
                        >
                          {translations.login || "Se connecter"}
                        </Link>
                      </p>
                      <button
                        type="submit"
                        className="h-11 w-full rounded-lg bg-emerald-500 px-6 text-white hover:bg-emerald-600 sm:w-auto md:h-12 lg:h-11 xl:h-12 2xl:h-13 3xl:h-14"
                      >
                        {translations.nextButton}
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <label className="mb-2 block text-sm font-medium text-foreground/80">
                        {translations.mosqueName}
                      </label>
                      <input
                        {...commonInputProps}
                        name="mosque.name"
                        value={form.mosque.name}
                        onChange={change}
                        required
                        placeholder={translations.placeholder.mosqueName}
                        className="w-full rounded-lg border px-3 py-2"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-foreground/80">
                        {translations.wilaya}
                      </label>
                      <input
                        placeholder={translations.placeholder.wilaya}
                        {...commonInputProps}
                        name="mosque.wilaya"
                        value={form.mosque.wilaya}
                        onChange={change}
                        className="w-full rounded-lg border px-3 py-2"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-foreground/80">
                        {translations.commune}
                      </label>
                      <input
                        placeholder={translations.placeholder.commune}
                        {...commonInputProps}
                        name="mosque.commune"
                        value={form.mosque.commune}
                        onChange={change}
                        className="w-full rounded-lg border px-3 py-2"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-foreground/80">
                        {translations.address}
                      </label>
                      <input
                        {...commonInputProps}
                        placeholder={translations.placeholder.address}
                        name="mosque.address"
                        value={form.mosque.address}
                        onChange={change}
                        className="w-full rounded-lg border px-3 py-2"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-foreground/80">
                        {translations.mosquePhone}
                      </label>
                      <input
                        dir={"ltr"}
                        placeholder={translations.placeholder.mosquePhone}
                        {...commonInputProps}
                        name="mosque.phone"
                        value={form.mosque.phone}
                        onChange={change}
                        className={
                          "w-full rounded-lg border px-3 py-2" +
                          (isRTL ? " text-right" : "")
                        }
                      />
                    </div>

                    {message.text ? (
                      <p
                        className={`text-sm ${message.type === "error" ? "text-red-600" : "text-emerald-600"}`}
                      >
                        {message.text}
                      </p>
                    ) : null}

                    <div className="flex flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-center">
                      <button
                        type="button"
                        onClick={back}
                        className="h-11 w-full rounded-lg border px-6 sm:w-auto md:h-12 lg:h-11 xl:h-12 2xl:h-13 3xl:h-14"
                      >
                        {translations.backButton}
                      </button>
                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="flex h-11 w-full items-center justify-center rounded-lg bg-emerald-500 px-6 text-white hover:bg-emerald-600 disabled:opacity-70 sm:w-auto md:h-12 lg:h-11 xl:h-12 2xl:h-13 3xl:h-14"
                      >
                        {isSubmitting ? (
                          <>
                            <Loader2 className="mr-2 animate-spin" size={16} />
                            {translations.creating}
                          </>
                        ) : (
                          translations.createButton
                        )}
                      </button>
                    </div>
                  </>
                )}
              </form>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.main>
  );
}