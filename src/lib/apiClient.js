"use client";

import { translateApiError } from "@/lib/apiErrors";

// Thin fetch wrapper around the /api route handlers.
// Auth is a JWT httpOnly cookie set by /api/auth/login, so every request
// sends credentials. The token is also mirrored to localStorage and sent as a
// Bearer header as a fallback for environments that drop the cookie.

function authHeader() {
  if (typeof window === "undefined") return {};
  const t = window.localStorage.getItem("charity_token");
  return t ? { Authorization: `Bearer ${t}` } : {};
}

// The API route handlers answer in English (src/lib/apiResponse.js's fail()),
// on purpose -- it keeps server logs and tests grep-able in one language.
// The app itself is French/Arabic only, so every error message is localized
// right here, at the single place all of them pass through on their way to a
// toast. See src/lib/apiErrors.js for the FR/AR dictionary. The locale cookie
// is the same one next-intl reads server-side (src/i18n/request.ts).
function currentLocale() {
  if (typeof document === "undefined") return "fr";
  const match = document.cookie.match(/(?:^|;\s*)locale=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : "fr";
}

async function request(path, { method = "GET", body, params } = {}) {
  let url = `/api${path}`;
  if (params) {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") qs.append(k, v);
    });
    const s = qs.toString();
    if (s) url += `?${s}`;
  }

  const res = await fetch(url, {
    method,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...authHeader(),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  let json = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }

  if (!res.ok || (json && json.success === false)) {
    const locale = currentLocale();
    const rawMessage =
      (json && json.message) ||
      (locale === "ar"
        ? `فشل الطلب (${res.status}).`
        : `La requ\u00eate a \u00e9chou\u00e9 (${res.status}).`);
    const message = translateApiError(rawMessage, locale);
    const err = new Error(message);
    err.status = res.status;
    err.code = json && json.code;
    throw err;
  }
  return json ? json.data : null;
}

export const api = {
  get: (path, params) => request(path, { params }),
  post: (path, body) => request(path, { method: "POST", body }),
  put: (path, body) => request(path, { method: "PUT", body }),
  del: (path) => request(path, { method: "DELETE" }),
};

export function saveSession(data) {
  if (typeof window === "undefined" || !data) return;
  if (data.token) window.localStorage.setItem("charity_token", data.token);
  if (data.user) window.localStorage.setItem("charity_user", JSON.stringify(data.user));
  if (data.mosque)
    window.localStorage.setItem("charity_mosque", JSON.stringify(data.mosque));
}

export function readUser() {
  if (typeof window === "undefined") return null;
  try {
    return JSON.parse(window.localStorage.getItem("charity_user") || "null");
  } catch {
    return null;
  }
}

export function clearSession() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem("charity_token");
  window.localStorage.removeItem("charity_user");
  window.localStorage.removeItem("charity_mosque");
}