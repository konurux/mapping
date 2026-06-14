import axios from "axios";

// Прямо указываем адрес твоего бэкенда
const BACKEND_URL = "https://mapping-zg12.onrender.com";
export const API_BASE = `${BACKEND_URL}/api`;

export const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
});

// Этот блок прикрепляет токен, чтобы ты оставался в системе после входа
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("mf_token");
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export function formatApiError(detail) {
  if (detail == null) return "Что-то пошло не так. Попробуйте ещё раз.";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail))
    return detail.map((e) => (e && typeof e.msg === "string" ? e.msg : JSON.stringify(e))).filter(Boolean).join(" ");
  if (detail && typeof detail.msg === "string") return detail.msg;
  return String(detail);
}