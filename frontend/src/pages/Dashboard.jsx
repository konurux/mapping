import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import { api, formatApiError } from "../lib/api";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "../components/ui/dialog";
import { Label } from "../components/ui/label";
import { Plus, Map as MapIcon, Globe, Lock, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";

const formatDate = (iso) => {
  try { return new Date(iso).toLocaleDateString("ru-RU", { day: "2-digit", month: "short", year: "numeric" }); }
  catch { return ""; }
};

export default function Dashboard() {
  const [maps, setMaps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [open, setOpen] = useState(false);
  const nav = useNavigate();

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/maps");
      setMaps(data);
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail) || err.message);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const createMap = async (e) => {
    e.preventDefault();
    setCreating(true);
    try {
      const { data } = await api.post("/maps", { title: title || "Без названия", description });
      setOpen(false);
      setTitle(""); setDescription("");
      nav(`/editor/${data.id}`);
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail) || err.message);
    } finally { setCreating(false); }
  };

  const remove = async (id) => {
    if (!window.confirm("Удалить карту? Это действие необратимо.")) return;
    try {
      await api.delete(`/maps/${id}`);
      setMaps((p) => p.filter((m) => m.id !== id));
      toast.success("Карта удалена");
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail) || err.message);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white" data-testid="dashboard-page">
      <Navbar />
      <main className="max-w-[1400px] mx-auto px-6 lg:px-10 pt-24 pb-16">
        <div className="flex items-end justify-between mb-10 flex-wrap gap-4">
          <div>
            <span className="label-overline">Мои карты</span>
            <h1 className="font-heading text-3xl sm:text-4xl font-bold tracking-tight mt-2">Твои миры</h1>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="bg-amber-500 hover:bg-amber-600 text-black font-semibold h-11 px-5" data-testid="create-map-button">
                <Plus className="w-4 h-4 mr-2" /> Новая карта
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-[#141414] border-white/10 text-white">
              <DialogHeader>
                <DialogTitle className="font-heading">Создать карту</DialogTitle>
              </DialogHeader>
              <form onSubmit={createMap} className="space-y-4">
                <div>
                  <Label htmlFor="t" className="text-zinc-300">Название</Label>
                  <Input id="t" value={title} onChange={(e) => setTitle(e.target.value)}
                    placeholder="Континент Эльдара"
                    className="bg-black/40 border-white/10 text-white mt-2"
                    data-testid="create-map-title-input" />
                </div>
                <div>
                  <Label htmlFor="d" className="text-zinc-300">Описание</Label>
                  <Input id="d" value={description} onChange={(e) => setDescription(e.target.value)}
                    placeholder="Мир последней эпохи..."
                    className="bg-black/40 border-white/10 text-white mt-2" />
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={creating}
                    className="bg-amber-500 hover:bg-amber-600 text-black font-semibold"
                    data-testid="create-map-confirm">
                    {creating ? "Создаём..." : "Создать"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {loading ? (
          <p className="text-zinc-500">Загрузка...</p>
        ) : maps.length === 0 ? (
          <div className="border border-dashed border-white/10 rounded-lg p-16 text-center" data-testid="empty-state">
            <MapIcon className="w-10 h-10 mx-auto text-zinc-600" />
            <h3 className="font-heading text-xl mt-4">Здесь пока пусто</h3>
            <p className="text-zinc-500 mt-2 text-sm">Создай первую карту, чтобы начать строить свой мир.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {maps.map((m) => (
              <div key={m.id}
                className="group bg-[#141414] border border-white/10 rounded-md overflow-hidden transition-all hover:-translate-y-1 hover:border-white/20 flex flex-col"
                data-testid="dashboard-map-card">
                <div className="aspect-[16/10] bg-[#0d0d0d] relative cursor-pointer" onClick={() => nav(`/editor/${m.id}`)}>
                  <div className="editor-canvas w-full h-full flex items-center justify-center">
                    <MapIcon className="w-10 h-10 text-zinc-700" />
                  </div>
                  <div className="absolute top-2 right-2 backdrop-blur-md bg-black/60 border border-white/10 rounded-sm px-2 py-1 text-[10px] font-semibold uppercase tracking-wider flex items-center gap-1">
                    {m.is_public ? (<><Globe className="w-3 h-3 text-amber-400" /> Публичная</>) : (<><Lock className="w-3 h-3 text-zinc-400" /> Личная</>)}
                  </div>
                </div>
                <div className="p-4 flex flex-col gap-2 flex-1">
                  <h3 className="font-heading font-semibold truncate">{m.title}</h3>
                  <p className="text-xs text-zinc-500 line-clamp-2 flex-1">{m.description || "Без описания"}</p>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs text-zinc-600">{formatDate(m.updated_at)}</span>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost"
                        className="h-8 w-8 p-0 text-zinc-400 hover:text-white hover:bg-white/10"
                        onClick={() => nav(`/editor/${m.id}`)} data-testid="map-card-edit-button">
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost"
                        className="h-8 w-8 p-0 text-zinc-400 hover:text-red-400 hover:bg-red-500/10"
                        onClick={() => remove(m.id)} data-testid="map-card-delete-button">
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
