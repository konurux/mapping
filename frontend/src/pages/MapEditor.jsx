import React, { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { api, formatApiError } from "../lib/api";
import MapCanvas from "../components/MapCanvas";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import {
  Hand, PenTool, MapPin, MousePointer, Save, ArrowLeft, Square, Spline,
  Type, Eye, EyeOff, Trash2, Plus, ChevronRight, ChevronDown, Copy, Lock, Globe, Compass,
} from "lucide-react";
import { toast } from "sonner";

const TOOLS = [
  { id: "select", icon: MousePointer, label: "Выбор (V)", shortcut: "v" },
  { id: "pan", icon: Hand, label: "Рука (H / Space)", shortcut: "h" },
  { id: "pen", icon: PenTool, label: "Перо — область (P)", shortcut: "p" },
  { id: "rect", icon: Square, label: "Прямоугольник (R)", shortcut: "r" },
  { id: "line", icon: Spline, label: "Маршрут (L)", shortcut: "l" },
  { id: "marker", icon: MapPin, label: "Маркер (M)", shortcut: "m" },
  { id: "text", icon: Type, label: "Текст (T)", shortcut: "t" },
];

const PALETTE = ["#F59E0B", "#EF4444", "#10B981", "#3B82F6", "#A855F7", "#EC4899", "#FFFFFF"];

const ColorPicker = ({ value, onChange }) => (
  <div className="flex flex-wrap gap-2 mt-2">
    {PALETTE.map((c) => (
      <button key={c} type="button" onClick={() => onChange(c)}
        className={`w-7 h-7 rounded-md border-2 transition-transform hover:scale-110 ${value === c ? "border-white" : "border-white/10"}`}
        style={{ background: c }} />
    ))}
  </div>
);

export default function MapEditor() {
  const { id } = useParams();
  const nav = useNavigate();
  const [mapDoc, setMapDoc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tool, setTool] = useState("select");
  const [activeLayerId, setActiveLayerId] = useState(null);
  const [selected, setSelected] = useState(null);
  const [fillColor, setFillColor] = useState("#F59E0B");
  const [strokeColor, setStrokeColor] = useState("#F59E0B");
  const [collapsedLayers, setCollapsedLayers] = useState({});

  const load = useCallback(async () => {
    try {
      const { data } = await api.get(`/maps/${id}`);
      setMapDoc({ ...data, lines: data.lines || [], texts: data.texts || [] });
      setActiveLayerId(data.layers[0]?.id || null);
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail) || err.message);
      nav("/dashboard");
    } finally { setLoading(false); }
  }, [id, nav]);

  useEffect(() => { load(); }, [load]);

  const update = (patch) => setMapDoc((m) => ({ ...m, ...patch }));

  const save = useCallback(async () => {
    if (!mapDoc) return;
    setSaving(true);
    try {
      const { data } = await api.put(`/maps/${id}`, {
        title: mapDoc.title, description: mapDoc.description,
        layers: mapDoc.layers, polygons: mapDoc.polygons,
        markers: mapDoc.markers, lines: mapDoc.lines, texts: mapDoc.texts,
      });
      setMapDoc({ ...data, lines: data.lines || [], texts: data.texts || [] });
      toast.success("Сохранено");
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail) || err.message);
    } finally { setSaving(false); }
  }, [id, mapDoc]);

  const deleteSelected = useCallback(() => {
    if (!selected || !mapDoc) return;
    if (selected.type === "polygon") update({ polygons: mapDoc.polygons.filter((p) => p.id !== selected.id) });
    if (selected.type === "marker") update({ markers: mapDoc.markers.filter((m) => m.id !== selected.id) });
    if (selected.type === "line") update({ lines: mapDoc.lines.filter((l) => l.id !== selected.id) });
    if (selected.type === "text") update({ texts: mapDoc.texts.filter((t) => t.id !== selected.id) });
    setSelected(null);
  }, [selected, mapDoc]);

  useEffect(() => {
    const onKey = (e) => {
      const tag = (e.target.tagName || "").toLowerCase();
      if ((e.ctrlKey || e.metaKey) && e.key === "s") { e.preventDefault(); save(); return; }
      if (tag === "input" || tag === "textarea") return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const t = TOOLS.find((tt) => tt.shortcut === e.key.toLowerCase());
      if (t) setTool(t.id);
      if (e.key === "Delete" || e.key === "Backspace") deleteSelected();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const addLayer = () => {
    const layer = { id: crypto.randomUUID(), name: `Слой ${mapDoc.layers.length + 1}`, visible: true };
    update({ layers: [...mapDoc.layers, layer] });
    setActiveLayerId(layer.id);
  };
  const toggleLayerVisibility = (lid) => update({ layers: mapDoc.layers.map((l) => l.id === lid ? { ...l, visible: !l.visible } : l) });
  const renameLayer = (lid, name) => update({ layers: mapDoc.layers.map((l) => l.id === lid ? { ...l, name } : l) });
  const deleteLayer = (lid) => {
    if (mapDoc.layers.length === 1) { toast.error("Должен остаться хотя бы один слой"); return; }
    if (!window.confirm("Удалить слой со всем содержимым?")) return;
    const newLayers = mapDoc.layers.filter((l) => l.id !== lid);
    update({
      layers: newLayers,
      polygons: mapDoc.polygons.filter((p) => p.layer_id !== lid),
      markers: mapDoc.markers.filter((m) => m.layer_id !== lid),
      lines: mapDoc.lines.filter((x) => x.layer_id !== lid),
      texts: mapDoc.texts.filter((x) => x.layer_id !== lid),
    });
    if (activeLayerId === lid) setActiveLayerId(newLayers[0].id);
    if (selected && [...mapDoc.polygons, ...mapDoc.markers, ...mapDoc.lines, ...mapDoc.texts].find((x) => x.id === selected.id)?.layer_id === lid) setSelected(null);
  };

  const onAddPolygon = (poly) => { update({ polygons: [...mapDoc.polygons, poly] }); setSelected({ type: "polygon", id: poly.id }); setTool("select"); };
  const onAddMarker = (mk) => { update({ markers: [...mapDoc.markers, mk] }); setSelected({ type: "marker", id: mk.id }); setTool("select"); };
  const onAddLine = (l) => { update({ lines: [...mapDoc.lines, l] }); setSelected({ type: "line", id: l.id }); setTool("select"); };
  const onAddText = (t) => { update({ texts: [...mapDoc.texts, t] }); setSelected({ type: "text", id: t.id }); setTool("select"); };

  const onUpdatePolygon = (pid, patch) => update({ polygons: mapDoc.polygons.map((p) => p.id === pid ? { ...p, ...patch } : p) });
  const updateSelected = (patch) => {
    if (!selected) return;
    if (selected.type === "polygon") update({ polygons: mapDoc.polygons.map((p) => p.id === selected.id ? { ...p, ...patch } : p) });
    if (selected.type === "marker") update({ markers: mapDoc.markers.map((m) => m.id === selected.id ? { ...m, ...patch } : m) });
    if (selected.type === "line") update({ lines: mapDoc.lines.map((l) => l.id === selected.id ? { ...l, ...patch } : l) });
    if (selected.type === "text") update({ texts: mapDoc.texts.map((t) => t.id === selected.id ? { ...t, ...patch } : t) });
  };

  const toggleShare = async () => {
    try {
      const { data } = await api.post(`/maps/${id}/share`);
      setMapDoc({ ...data, lines: data.lines || [], texts: data.texts || [] });
      if (data.is_public) {
        const url = `${window.location.origin}/m/${data.share_token}`;
        await navigator.clipboard.writeText(url).catch(() => {});
        toast.success("Карта опубликована. Ссылка скопирована.");
      } else toast.success("Карта снова приватная");
    } catch (err) { toast.error(formatApiError(err.response?.data?.detail) || err.message); }
  };

  const copyShareLink = async () => {
    const url = `${window.location.origin}/m/${mapDoc.share_token}`;
    await navigator.clipboard.writeText(url).catch(() => {});
    toast.success("Ссылка скопирована");
  };

  if (loading || !mapDoc) {
    return <div className="min-h-screen flex items-center justify-center bg-[#0A0A0A] text-zinc-400">Загрузка карты...</div>;
  }

  const shapesByLayer = (lid) => [
    ...mapDoc.polygons.filter((p) => p.layer_id === lid).map((p) => ({ kind: "polygon", id: p.id, name: p.name || "Область", icon: PenTool })),
    ...mapDoc.lines.filter((p) => p.layer_id === lid).map((p) => ({ kind: "line", id: p.id, name: p.name || "Маршрут", icon: Spline })),
    ...mapDoc.markers.filter((p) => p.layer_id === lid).map((p) => ({ kind: "marker", id: p.id, name: p.title || "Метка", icon: MapPin })),
    ...mapDoc.texts.filter((p) => p.layer_id === lid).map((p) => ({ kind: "text", id: p.id, name: p.text || "Текст", icon: Type })),
  ];

  const selectedPolygon = selected?.type === "polygon" ? mapDoc.polygons.find((p) => p.id === selected.id) : null;
  const selectedMarker = selected?.type === "marker" ? mapDoc.markers.find((m) => m.id === selected.id) : null;
  const selectedLine = selected?.type === "line" ? mapDoc.lines.find((l) => l.id === selected.id) : null;
  const selectedText = selected?.type === "text" ? mapDoc.texts.find((t) => t.id === selected.id) : null;

  return (
    <div className="w-screen h-screen overflow-hidden bg-[#0A0A0A] text-white relative flex" data-testid="map-editor-page">
      <MapCanvas
        tool={tool}
        layers={mapDoc.layers}
        polygons={mapDoc.polygons}
        markers={mapDoc.markers}
        lines={mapDoc.lines}
        texts={mapDoc.texts}
        onAddPolygon={onAddPolygon}
        onAddMarker={onAddMarker}
        onAddLine={onAddLine}
        onAddText={onAddText}
        onSelectShape={setSelected}
        onUpdatePolygon={onUpdatePolygon}
        selectedShapeId={selected?.id}
        activeLayerId={activeLayerId}
        fillColor={fillColor}
        strokeColor={strokeColor}
      />

      {/* Top Bar */}
      <div className="absolute top-4 left-4 right-4 h-14 flex items-center justify-between z-40 backdrop-blur-md bg-black/60 border border-white/10 rounded-lg px-4">
        <div className="flex items-center gap-3 min-w-0">
          <Link to="/dashboard" className="text-zinc-400 hover:text-white transition-colors" data-testid="editor-back-button">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="w-px h-6 bg-white/10" />
          <Compass className="w-4 h-4 text-amber-400 shrink-0" />
          <Input value={mapDoc.title} onChange={(e) => update({ title: e.target.value })}
            className="bg-transparent border-none text-white font-heading font-semibold text-base focus-visible:ring-0 px-0 h-8 min-w-0"
            data-testid="editor-title-input" />
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" className="text-zinc-300 hover:text-white hover:bg-white/10" onClick={toggleShare} data-testid="share-map-button">
            {mapDoc.is_public ? <Globe className="w-4 h-4 mr-2 text-amber-400" /> : <Lock className="w-4 h-4 mr-2" />}
            {mapDoc.is_public ? "Публичная" : "Поделиться"}
          </Button>
          {mapDoc.is_public && mapDoc.share_token && (
            <Button variant="ghost" className="text-zinc-300 hover:text-white hover:bg-white/10" onClick={copyShareLink} data-testid="copy-share-link-button">
              <Copy className="w-4 h-4 mr-2" /> Ссылка
            </Button>
          )}
          <Button onClick={save} disabled={saving} className="bg-amber-500 hover:bg-amber-600 text-black font-semibold" data-testid="save-map-button">
            <Save className="w-4 h-4 mr-2" />{saving ? "Сохранение..." : "Сохранить"}
          </Button>
        </div>
      </div>

      {/* Tools Sidebar */}
      <div className="absolute top-1/2 -translate-y-1/2 left-4 w-14 flex flex-col gap-1 z-40 bg-black/80 backdrop-blur-md border border-white/10 rounded-lg p-2">
        {TOOLS.map((t) => (
          <button key={t.id} className={`tool-btn ${tool === t.id ? "active" : ""}`}
            onClick={() => setTool(t.id)} title={t.label}
            data-testid={`tool-${t.id}-button`}>
            <t.icon className="w-4 h-4" />
          </button>
        ))}
      </div>

      {/* Layers panel */}
      <div className="absolute top-24 bottom-4 left-20 w-72 z-40 bg-black/80 backdrop-blur-md border border-white/10 rounded-lg flex flex-col overflow-hidden">
        <div className="p-3 border-b border-white/10 flex items-center justify-between">
          <span className="label-overline">Слои</span>
          <Button size="sm" variant="ghost" className="h-7 px-2 text-zinc-300 hover:bg-white/10" onClick={addLayer} data-testid="add-layer-button">
            <Plus className="w-3.5 h-3.5" />
          </Button>
        </div>
        <div className="flex-1 overflow-auto p-2 space-y-1">
          {mapDoc.layers.map((l) => {
            const collapsed = collapsedLayers[l.id];
            const items = shapesByLayer(l.id);
            return (
              <div key={l.id} data-testid="layer-list-item">
                <div className={`flex items-center gap-1 px-2 py-1.5 rounded-md cursor-pointer transition-colors ${activeLayerId === l.id ? "bg-white/10" : "hover:bg-white/5"}`}
                  onClick={() => setActiveLayerId(l.id)}>
                  <button onClick={(e) => { e.stopPropagation(); setCollapsedLayers((s) => ({ ...s, [l.id]: !s[l.id] })); }} className="text-zinc-500 hover:text-white">
                    {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); toggleLayerVisibility(l.id); }} className="text-zinc-400 hover:text-white" data-testid="layer-visibility-toggle">
                    {l.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                  </button>
                  <input value={l.name} onChange={(e) => renameLayer(l.id, e.target.value)} onClick={(e) => e.stopPropagation()}
                    className="bg-transparent border-none text-sm text-white flex-1 outline-none min-w-0" />
                  <span className="text-[10px] text-zinc-500 px-1">{items.length}</span>
                  <button onClick={(e) => { e.stopPropagation(); deleteLayer(l.id); }} className="text-zinc-500 hover:text-red-400">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
                {!collapsed && items.length > 0 && (
                  <div className="ml-5 mt-1 space-y-0.5 border-l border-white/5 pl-2">
                    {items.map((it) => {
                      const isSel = selected?.id === it.id;
                      return (
                        <div key={it.id}
                          className={`flex items-center gap-2 px-2 py-1 rounded text-xs cursor-pointer transition-colors ${isSel ? "bg-amber-500/15 text-amber-300" : "text-zinc-400 hover:bg-white/5 hover:text-white"}`}
                          onClick={() => { setSelected({ type: it.kind, id: it.id }); setTool("select"); }}>
                          <it.icon className="w-3 h-3 shrink-0" />
                          <span className="truncate">{it.name}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Properties panel */}
      <div className="absolute top-24 bottom-4 right-4 w-80 z-40 bg-black/80 backdrop-blur-md border border-white/10 rounded-lg flex flex-col overflow-hidden">
        <div className="p-4 flex-1 overflow-auto">
          <span className="label-overline">Свойства</span>

          {!selected && (tool === "pen" || tool === "rect") && (
            <div className="mt-4">
              <Label className="text-xs text-zinc-400">Цвет области</Label>
              <ColorPicker value={fillColor} onChange={setFillColor} />
              <p className="text-xs text-zinc-500 mt-3 leading-relaxed">
                {tool === "pen" ? "Кликай для добавления точек, клик по первой точке или Enter — замкнуть. Esc — отменить." : "Зажми ЛКМ и тяни — нарисуй прямоугольную область."}
              </p>
            </div>
          )}
          {!selected && tool === "line" && (
            <div className="mt-4">
              <Label className="text-xs text-zinc-400">Цвет линии</Label>
              <ColorPicker value={strokeColor} onChange={setStrokeColor} />
              <p className="text-xs text-zinc-500 mt-3">Кликай для точек маршрута. Enter / двойной клик — завершить.</p>
            </div>
          )}
          {!selected && tool === "marker" && (
            <div className="mt-4">
              <Label className="text-xs text-zinc-400">Цвет маркера</Label>
              <ColorPicker value={strokeColor} onChange={setStrokeColor} />
              <p className="text-xs text-zinc-500 mt-3">Кликни по холсту — поставь метку. Маркеры можно ставить внутри областей.</p>
            </div>
          )}
          {!selected && tool === "text" && (
            <p className="text-xs text-zinc-500 mt-4">Кликни — добавь свободный текст в любое место карты.</p>
          )}
          {!selected && (tool === "select" || tool === "pan") && (
            <p className="text-xs text-zinc-500 mt-4 leading-relaxed">
              Выбери объект на карте или в дереве слоёв слева.<br /><br />
              <span className="text-zinc-400 font-semibold">Навигация:</span><br />
              · колесо — pan · Shift+колесо — горизонтально<br />
              · Ctrl/⌘ + колесо — зум<br />
              · Space + drag — рука<br />
              · V / H / P / R / L / M / T — инструменты
            </p>
          )}

          {selectedPolygon && (
            <div className="mt-4 space-y-3" data-testid="polygon-properties">
              <div>
                <Label className="text-xs text-zinc-400">Название</Label>
                <Input value={selectedPolygon.name} onChange={(e) => updateSelected({ name: e.target.value })}
                  className="bg-black/40 border-white/10 text-white mt-1 h-9" />
                <p className="text-[11px] text-zinc-500 mt-1">Можно перетаскивать подпись по карте — она привязана к области.</p>
              </div>
              <div>
                <Label className="text-xs text-zinc-400">Размер подписи: {Math.round(selectedPolygon.label_size || 14)}px</Label>
                <input type="range" min="8" max="48" value={selectedPolygon.label_size || 14}
                  onChange={(e) => updateSelected({ label_size: Number(e.target.value) })}
                  className="w-full accent-amber-500 mt-2" />
              </div>
              <div>
                <Label className="text-xs text-zinc-400">Цвет заливки</Label>
                <ColorPicker value={selectedPolygon.fill} onChange={(c) => updateSelected({ fill: c })} />
              </div>
              <div>
                <Label className="text-xs text-zinc-400">Прозрачность: {Math.round(selectedPolygon.opacity * 100)}%</Label>
                <input type="range" min="0" max="100" value={selectedPolygon.opacity * 100}
                  onChange={(e) => updateSelected({ opacity: Number(e.target.value) / 100 })}
                  className="w-full accent-amber-500 mt-2" />
              </div>
              <Button variant="ghost" className="w-full text-red-400 hover:text-red-300 hover:bg-red-500/10" onClick={deleteSelected}>
                <Trash2 className="w-4 h-4 mr-2" /> Удалить область
              </Button>
            </div>
          )}

          {selectedMarker && (
            <div className="mt-4 space-y-3" data-testid="marker-properties">
              <div>
                <Label className="text-xs text-zinc-400">Заголовок</Label>
                <Input value={selectedMarker.title} onChange={(e) => updateSelected({ title: e.target.value })}
                  className="bg-black/40 border-white/10 text-white mt-1 h-9" />
              </div>
              <div>
                <Label className="text-xs text-zinc-400">Описание</Label>
                <Textarea value={selectedMarker.description} onChange={(e) => updateSelected({ description: e.target.value })}
                  className="bg-black/40 border-white/10 text-white mt-1 min-h-24" />
              </div>
              <div>
                <Label className="text-xs text-zinc-400">Цвет</Label>
                <ColorPicker value={selectedMarker.color} onChange={(c) => updateSelected({ color: c })} />
              </div>
              <Button variant="ghost" className="w-full text-red-400 hover:text-red-300 hover:bg-red-500/10" onClick={deleteSelected}>
                <Trash2 className="w-4 h-4 mr-2" /> Удалить маркер
              </Button>
            </div>
          )}

          {selectedLine && (
            <div className="mt-4 space-y-3" data-testid="line-properties">
              <div>
                <Label className="text-xs text-zinc-400">Название</Label>
                <Input value={selectedLine.name} onChange={(e) => updateSelected({ name: e.target.value })}
                  className="bg-black/40 border-white/10 text-white mt-1 h-9" />
              </div>
              <div>
                <Label className="text-xs text-zinc-400">Цвет</Label>
                <ColorPicker value={selectedLine.color} onChange={(c) => updateSelected({ color: c })} />
              </div>
              <div>
                <Label className="text-xs text-zinc-400">Толщина: {selectedLine.width}px</Label>
                <input type="range" min="1" max="10" value={selectedLine.width}
                  onChange={(e) => updateSelected({ width: Number(e.target.value) })}
                  className="w-full accent-amber-500 mt-2" />
              </div>
              <Button variant="ghost" className="w-full text-red-400 hover:text-red-300 hover:bg-red-500/10" onClick={deleteSelected}>
                <Trash2 className="w-4 h-4 mr-2" /> Удалить маршрут
              </Button>
            </div>
          )}

          {selectedText && (
            <div className="mt-4 space-y-3" data-testid="text-properties">
              <div>
                <Label className="text-xs text-zinc-400">Текст</Label>
                <Textarea value={selectedText.text} onChange={(e) => updateSelected({ text: e.target.value })}
                  className="bg-black/40 border-white/10 text-white mt-1 min-h-20" />
              </div>
              <div>
                <Label className="text-xs text-zinc-400">Размер: {Math.round(selectedText.size)}px</Label>
                <input type="range" min="10" max="72" value={selectedText.size}
                  onChange={(e) => updateSelected({ size: Number(e.target.value) })}
                  className="w-full accent-amber-500 mt-2" />
              </div>
              <div>
                <Label className="text-xs text-zinc-400">Цвет</Label>
                <ColorPicker value={selectedText.color} onChange={(c) => updateSelected({ color: c })} />
              </div>
              <Button variant="ghost" className="w-full text-red-400 hover:text-red-300 hover:bg-red-500/10" onClick={deleteSelected}>
                <Trash2 className="w-4 h-4 mr-2" /> Удалить текст
              </Button>
            </div>
          )}
        </div>

        <div className="px-4 py-3 border-t border-white/10 text-[11px] text-zinc-500 grid grid-cols-2 gap-1">
          <span>Областей: <span className="text-zinc-300">{mapDoc.polygons.length}</span></span>
          <span>Маркеров: <span className="text-zinc-300">{mapDoc.markers.length}</span></span>
          <span>Маршрутов: <span className="text-zinc-300">{mapDoc.lines.length}</span></span>
          <span>Текста: <span className="text-zinc-300">{mapDoc.texts.length}</span></span>
        </div>
      </div>
    </div>
  );
}
