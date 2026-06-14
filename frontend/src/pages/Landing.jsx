import React from "react";
import { Link } from "react-router-dom";
import Navbar from "../components/Navbar";
import { Button } from "../components/ui/button";
import { MapPin, Layers, Pencil, Share2, PenTool, Globe } from "lucide-react";

const Feature = ({ icon: Icon, title, desc }) => (
  <div className="bg-[#141414] border border-white/10 p-6 rounded-md transition-all hover:-translate-y-1 hover:border-white/20">
    <div className="w-10 h-10 rounded-md bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mb-4">
      <Icon className="w-5 h-5 text-amber-400" />
    </div>
    <h3 className="font-heading font-semibold text-lg mb-2">{title}</h3>
    <p className="text-sm text-zinc-400 leading-relaxed">{desc}</p>
  </div>
);

export default function Landing() {
  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white" data-testid="landing-page">
      <Navbar />
      <section className="relative overflow-hidden topo-bg grain min-h-screen flex items-center pt-24 pb-12">
        <div className="max-w-[1400px] mx-auto w-full px-6 lg:px-10 grid lg:grid-cols-12 gap-10 items-center relative z-10">
          <div className="lg:col-span-7 slide-up">
            <span className="label-overline">Конструктор интерактивных карт</span>
            <h1 className="font-heading text-4xl sm:text-5xl lg:text-7xl font-black tracking-tighter leading-[0.95] mt-4">
              Создавай миры,<br />
              <span className="text-amber-400">которые оживают</span>
            </h1>
            <p className="mt-6 text-base sm:text-lg text-zinc-300 max-w-xl leading-relaxed">
              Интерактивные карты для настольных игр, ролевых кампаний, фэнтезийных вселенных
              и историй. Маркеры, слои, маршруты — всё в одном редакторе.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/register">
                <Button className="bg-amber-500 hover:bg-amber-600 text-black font-semibold h-12 px-6 text-base" data-testid="hero-get-started">
                  Создать карту бесплатно
                </Button>
              </Link>
              <Link to="/login">
                <Button variant="outline" className="border-white/20 hover:border-white/50 bg-transparent text-white hover:bg-white/5 h-12 px-6 text-base" data-testid="hero-login">
                  У меня уже есть аккаунт
                </Button>
              </Link>
            </div>
            <div className="mt-12 flex flex-wrap gap-8 text-sm text-zinc-500">
              <div><span className="text-white font-semibold">SVG-рендер</span> · без потери качества</div>
              <div><span className="text-white font-semibold">Слои</span> · сложные миры</div>
              <div><span className="text-white font-semibold">Шаринг</span> · одним кликом</div>
            </div>
          </div>
          <div className="lg:col-span-5 relative">
            <div className="aspect-[4/5] rounded-lg overflow-hidden border border-white/10 bg-[#0d0d0d] relative shadow-2xl">
              <img
                src="https://ibb.co/W4StQHhv"
                alt="Превью редактора карт"
                className="w-full h-full object-cover opacity-90"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
              <div className="absolute bottom-4 left-4 right-4 backdrop-blur-md bg-black/50 border border-white/10 rounded-md p-3 flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                <span className="text-xs text-zinc-300 font-mono">live preview · редактор открыт</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-24 border-t border-white/5">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-10">
          <div className="mb-12 max-w-2xl">
            <span className="label-overline">Возможности</span>
            <h2 className="font-heading text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight mt-3">Всё для построения миров</h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <Feature icon={Pencil} title="Pen-инструмент" desc="Рисуй области точка за точкой как в Figma. Замыкай контур кликом по первой точке." />
            <Feature icon={MapPin} title="Маркеры и описания" desc="Размещай точки интереса с заголовками и описаниями — даже внутри областей." />
            <Feature icon={Layers} title="Слои карты" desc="Каждая фигура попадает в свой слой. Управляй видимостью, переименовывай и удаляй." />
            <Feature icon={PenTool} title="Подписи внутри областей" desc="Двигай название по карте, задавай размер шрифта — текст всегда привязан к области." />
            <Feature icon={Share2} title="Публичные ссылки" desc="Делись готовой картой по ссылке — гостям не нужна регистрация." />
            <Feature icon={Globe} title="Для любых проектов" desc="RPG-кампании, фэнтези-вселенные, исторические маршруты, презентации, истории." />
          </div>
        </div>
      </section>

      <section className="py-24 border-t border-white/5">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-10 text-center">
          <h2 className="font-heading text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight">Начни строить свой мир сегодня</h2>
          <p className="mt-4 text-zinc-400 max-w-xl mx-auto">Бесплатная регистрация. Без ограничений на количество карт.</p>
          <div className="mt-8">
            <Link to="/register">
              <Button className="bg-amber-500 hover:bg-amber-600 text-black font-semibold h-12 px-8" data-testid="cta-register">
                Зарегистрироваться
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/5 py-8">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-10 text-center text-sm text-zinc-500">
          MapForge · Конструктор интерактивных карт
        </div>
      </footer>
    </div>
  );
}
