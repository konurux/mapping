import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Compass, LogOut } from "lucide-react";
import { Button } from "../components/ui/button";

export const Navbar = ({ minimal = false }) => {
  const { user, logout } = useAuth();
  const nav = useNavigate();

  return (
    <header className="fixed top-0 left-0 right-0 z-50 backdrop-blur-xl bg-black/60 border-b border-white/10">
      <div className="max-w-[1400px] mx-auto px-6 lg:px-10 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 group" data-testid="nav-logo">
          <div className="w-8 h-8 rounded-md bg-amber-500 flex items-center justify-center">
            <Compass className="w-4 h-4 text-black" />
          </div>
          <span className="font-heading font-bold text-lg tracking-tight">MapForge</span>
        </Link>

        {!minimal && (
          <nav className="flex items-center gap-3">
            {user ? (
              <>
                <span className="hidden sm:block text-sm text-zinc-400 mr-2">{user.name}</span>
                <Link to="/dashboard">
                  <Button variant="ghost" className="text-zinc-200 hover:text-white hover:bg-white/10" data-testid="nav-dashboard">
                    Мои карты
                  </Button>
                </Link>
                <Button
                  variant="ghost"
                  onClick={async () => { await logout(); nav("/"); }}
                  className="text-zinc-300 hover:text-white hover:bg-white/10"
                  data-testid="nav-logout"
                >
                  <LogOut className="w-4 h-4" />
                </Button>
              </>
            ) : (
              <>
                <Link to="/login">
                  <Button variant="ghost" className="text-zinc-200 hover:text-white hover:bg-white/10" data-testid="nav-login">
                    Войти
                  </Button>
                </Link>
                <Link to="/register">
                  <Button className="bg-amber-500 hover:bg-amber-600 text-black font-semibold" data-testid="nav-register">
                    Начать
                  </Button>
                </Link>
              </>
            )}
          </nav>
        )}
      </div>
    </header>
  );
};

export default Navbar;
