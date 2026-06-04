import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import { useAuth } from "../context/AuthContext";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { Label } from "../components/ui/label";
import { toast } from "sonner";

export default function Login() {
  const { login, formatApiError } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      toast.success("Добро пожаловать!");
      nav("/dashboard");
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail) || err.message);
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white topo-bg" data-testid="login-page">
      <Navbar minimal />
      <div className="min-h-screen flex items-center justify-center px-6 pt-24 pb-12">
        <form onSubmit={submit} className="w-full max-w-md bg-[#141414] border border-white/10 rounded-lg p-8 slide-up">
          <span className="label-overline">Вход</span>
          <h1 className="font-heading text-3xl font-bold mt-2 mb-6">С возвращением</h1>
          <div className="space-y-4">
            <div>
              <Label htmlFor="email" className="text-zinc-300">Email</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                className="bg-black/40 border-white/10 text-white focus-visible:ring-amber-500 mt-2"
                data-testid="login-email-input" />
            </div>
            <div>
              <Label htmlFor="password" className="text-zinc-300">Пароль</Label>
              <Input id="password" type="password" required minLength={6} value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-black/40 border-white/10 text-white focus-visible:ring-amber-500 mt-2"
                data-testid="login-password-input" />
            </div>
          </div>
          <Button type="submit" disabled={loading} className="w-full mt-6 bg-amber-500 hover:bg-amber-600 text-black font-semibold h-11" data-testid="login-form-submit-button">
            {loading ? "Входим..." : "Войти"}
          </Button>
          <p className="mt-6 text-sm text-zinc-400 text-center">
            Нет аккаунта? <Link to="/register" className="text-amber-400 hover:text-amber-300">Зарегистрироваться</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
