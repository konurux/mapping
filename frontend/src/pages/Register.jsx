import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import { useAuth } from "../context/AuthContext";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { Label } from "../components/ui/label";
import { toast } from "sonner";

export default function Register() {
  const { register, formatApiError } = useAuth();
  const nav = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await register(email, password, name);
      toast.success("Аккаунт создан!");
      nav("/dashboard");
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail) || err.message);
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white topo-bg" data-testid="register-page">
      <Navbar minimal />
      <div className="min-h-screen flex items-center justify-center px-6 pt-24 pb-12">
        <form onSubmit={submit} className="w-full max-w-md bg-[#141414] border border-white/10 rounded-lg p-8 slide-up">
          <span className="label-overline">Регистрация</span>
          <h1 className="font-heading text-3xl font-bold mt-2 mb-6">Создай аккаунт</h1>
          <div className="space-y-4">
            <div>
              <Label htmlFor="name" className="text-zinc-300">Имя</Label>
              <Input id="name" required value={name} onChange={(e) => setName(e.target.value)}
                className="bg-black/40 border-white/10 text-white focus-visible:ring-amber-500 mt-2"
                data-testid="register-name-input" />
            </div>
            <div>
              <Label htmlFor="email" className="text-zinc-300">Email</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                className="bg-black/40 border-white/10 text-white focus-visible:ring-amber-500 mt-2"
                data-testid="register-email-input" />
            </div>
            <div>
              <Label htmlFor="password" className="text-zinc-300">Пароль</Label>
              <Input id="password" type="password" required minLength={6} value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-black/40 border-white/10 text-white focus-visible:ring-amber-500 mt-2"
                data-testid="register-password-input" />
              <p className="text-xs text-zinc-500 mt-1">Минимум 6 символов</p>
            </div>
          </div>
          <Button type="submit" disabled={loading} className="w-full mt-6 bg-amber-500 hover:bg-amber-600 text-black font-semibold h-11" data-testid="register-form-submit-button">
            {loading ? "Создаём..." : "Создать аккаунт"}
          </Button>
          <p className="mt-6 text-sm text-zinc-400 text-center">
            Уже есть аккаунт? <Link to="/login" className="text-amber-400 hover:text-amber-300">Войти</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
