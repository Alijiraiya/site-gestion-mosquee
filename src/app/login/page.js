"use client";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Eye, EyeOff, Loader2 } from "lucide-react";
import { loginImg } from "@/lib/utils";
import { Field } from "@/components/ui";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { translateApiError } from "@/lib/apiErrors";

export default function LoginPage() {
  const router = useRouter();
  const language = useLocale();
  const translations = useTranslations().raw("login");
  const isRTL = language === "ar";
  const [form, setForm] = useState({ wilaya: "", commune: "", mosqueId: "", password: "" });
  const [wilayas, setWilayas] = useState([]);
  const [communes, setCommunes] = useState([]);
  const [mosques, setMosques] = useState([]);
  // Keep the server and the first client render identical. The options request
  // starts in an effect (after hydration), so loading must start as false here.
  const [isLoadingOptions, setIsLoadingOptions] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: value,
      ...(name === "wilaya" ? { commune: "", mosqueId: "" } : {}),
      ...(name === "commune" ? { mosqueId: "" } : {}),
    }));
    if (message.text) setMessage({ type: "", text: "" });
  };

  const loadOptions = async (params = "") => {
    const response = await fetch(`/api/auth/login${params ? `?${params}` : ""}`);
    const payload = await response.json();
    if (!response.ok || !payload?.success) throw new Error("Unable to load mosque options.");
    return payload.data;
  };

  useEffect(() => {
    setIsLoadingOptions(true);
    loadOptions()
      .then((data) => setWilayas(data.wilayas || []))
      .catch(() => setMessage({ type: "error", text: translations.loadMosquesError }))
      .finally(() => setIsLoadingOptions(false));
  }, []);

  useEffect(() => {
    if (!form.wilaya) {
      setCommunes([]);
      return;
    }
    loadOptions(`wilaya=${encodeURIComponent(form.wilaya)}`)
      .then((data) => setCommunes(data.communes || []))
      .catch(() => setMessage({ type: "error", text: translations.loadCommunesError }));
  }, [form.wilaya]);

  useEffect(() => {
    if (!form.wilaya || !form.commune) {
      setMosques([]);
      return;
    }
    const params = new URLSearchParams({ wilaya: form.wilaya, commune: form.commune });
    loadOptions(params.toString())
      .then((data) => setMosques(data.mosques || []))
      .catch(() => setMessage({ type: "error", text: translations.loadMosquesError }));
  }, [form.wilaya, form.commune]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setMessage({ type: "", text: "" });

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          mosqueId: form.mosqueId,
          password: form.password,
        }),
      });

      const payload = await response.json();

      if (!response.ok || !payload?.success) {
        const localizedError = {
          401: translations.invalidCredentials,
          403: translations.inactiveAccount,
        }[response.status];
        throw new Error(
          localizedError ||
            (payload?.message && translateApiError(payload.message, language)) ||
            translations.loginError,
        );
      }

      setMessage({
        type: "success",
        text: translations.loginSuccess,
      });
      router.push("/dashboard");
    } catch (error) {
      setMessage({
        type: "error",
        text: error.message || translations.loginError,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <motion.main
      dir={isRTL ? "rtl" : "ltr"}
      className="relative min-h-[100dvh] w-full overflow-hidden"
    >
      <Image
        src={loginImg}
        alt="Mosque"
        fill
        sizes="100vw"
        priority
        className="scale-105 object-cover blur-md"
      />

      <div className="absolute inset-0 bg-black/15 dark:bg-black/40" />

      <motion.div
        initial={{ opacity: 0, scale: 1.1 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 flex min-h-[100dvh] items-center justify-center p-3 sm:p-4 md:p-6 lg:p-8 xl:p-10 2xl:p-12 3xl:p-16"
      >
        <div className="flex w-full max-w-sm flex-col overflow-hidden rounded-2xl bg-white shadow-2xl sm:max-w-md md:max-w-xl lg:max-w-4xl lg:flex-row  dark:bg-linear-142 dark:from-0% dark:from-[#223D8F] dark:to-[#0A1129] dark:to-73%">
          <div className="relative hidden lg:block lg:w-[44%] xl:w-[46%] 2xl:w-1/2">
            <Image
              src={loginImg}
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
                {translations.back || "Retour"}
              </Link>

              <h1 className="text-3xl font-bold text-foreground sm:text-[2rem] md:text-4xl lg:text-3xl xl:text-4xl 2xl:text-[2.5rem] 3xl:text-5xl">
                {translations.title}
              </h1>

              <p className="mb-6 mt-2 text-sm text-foreground/60 sm:mb-8 sm:text-base md:mb-10 lg:mb-6 lg:text-sm xl:mb-8 xl:text-base 2xl:mb-10 3xl:mb-12 3xl:text-lg">
                {translations.subtitle || "Connectez-vous à votre compte"}
              </p>

              <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5 md:space-y-5 lg:space-y-4 xl:space-y-5 2xl:space-y-6 3xl:space-y-7">
                <Field label={translations.wilayaLabel} required>
                  <select
                    name="wilaya"
                    value={form.wilaya}
                    onChange={handleChange}
                    required
                    disabled={isLoadingOptions}
                  >
                    <option value="">{translations.wilayaPlaceholder}</option>
                    {wilayas.map((wilaya) => <option key={wilaya} value={wilaya}>{wilaya}</option>)}
                  </select>
                </Field>

                <Field label={translations.communeLabel} required>
                  <select
                    name="commune"
                    value={form.commune}
                    onChange={handleChange}
                    required
                    disabled={!form.wilaya || isLoadingOptions}
                  >
                    <option value="">{translations.communePlaceholder}</option>
                    {communes.map((commune) => <option key={commune} value={commune}>{commune}</option>)}
                  </select>
                </Field>

                <Field label={translations.mosqueLabel} required>
                  <select
                    name="mosqueId"
                    value={form.mosqueId}
                    onChange={handleChange}
                    required
                    disabled={!form.commune || isLoadingOptions}
                  >
                    <option value="">{translations.mosquePlaceholder}</option>
                    {mosques.map((mosque) => <option key={mosque.id} value={mosque.id}>{mosque.name}</option>)}
                  </select>
                </Field>

                <div>
                  <label className="mb-2 block text-sm font-medium text-foreground/80">
                    {translations.passwordLabel || "Mot de passe"}
                  </label>

                  <div className="flex h-11 items-center rounded-lg border border-gray-200 bg-background px-4 sm:h-12 md:h-12 lg:h-11 xl:h-12 2xl:h-13 3xl:h-14">
                    <input
                      name="password"
                      value={form.password}
                      onChange={handleChange}
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      autoCorrect="off"
                      autoCapitalize="none"
                      spellCheck="false"
                      required
                      placeholder={
                        translations.passwordPlaceholder || "••••••••••"
                      }
                      className="flex-1 bg-transparent text-gray-900 outline-none placeholder:text-gray-900/70 dark:text-white dark:placeholder:text-white/60"
                    />

                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      className="ml-2 text-gray-400 transition hover:text-gray-600"
                      aria-label={
                        showPassword
                          ? "Masquer le mot de passe"
                          : "Afficher le mot de passe"
                      }
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>

                  <div className="mt-2 flex justify-end">
                    <Link
                      href="/forgot-password"
                      className="text-sm text-emerald-500 hover:text-emerald-600"
                    >
                      {translations.forgotPassword || "Mot de passe oublié ?"}
                    </Link>
                  </div>
                </div>

                {message.text ? (
                  <p
                    className={`text-sm ${
                      message.type === "error"
                        ? "text-red-600"
                        : "text-emerald-600"
                    }`}
                  >
                    {message.text}
                  </p>
                ) : null}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="mt-1 flex h-11 w-full items-center justify-center rounded-lg bg-emerald-500 font-medium text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-70 sm:mt-2 sm:h-12 md:h-12 lg:h-11 xl:h-12 2xl:h-13 3xl:h-14"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={18} className="mr-2 animate-spin" />
                      {translations.loggingIn || "Connexion..."}
                    </>
                  ) : (
                    translations.loginButton || "Se connecter"
                  )}
                </button>
              </form>

              <p className="mt-6 flex flex-wrap items-center justify-center gap-2 text-center text-sm text-gray-500 sm:mt-8 md:mt-9 lg:mt-6 xl:mt-8 2xl:mt-10 3xl:mt-12 3xl:text-base">
                {translations.noAccount || "Vous n'avez pas de compte ?"}
                <Link
                  href="/register"
                  className="font-semibold text-emerald-500 hover:text-emerald-600"
                >
                  {translations.register || "Créer un compte"}
                </Link>
              </p>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.main>
  );
}