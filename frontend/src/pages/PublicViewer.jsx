import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api, formatApiError } from "../lib/api";
import MapCanvas from "../components/MapCanvas";
import { Compass, ArrowLeft } from "lucide-react";
import { Button } from "../components/ui/button";

export default function PublicViewer() {
  const { token } = useParams();
  const [mapDoc, setMapDoc] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get(`/public/maps/${token}`);
        setMapDoc(data);
      } catch (err) {
        setError(formatApiError(err.response?.data?.detail) || err.message);
      } finally { setLoading(false); }
    })();
  }, [token]);

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-[#0A0A0A] text-zinc-400">Загрузка...</div>;
  if (error || !mapDoc) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex flex-col items-center justify-center text-white px-6">
        <h1 className="font-heading text-3xl font-bold mb-2">Карта недоступна</h1>
        <p className="text-zinc-400 mb-6">{error || "Эта карта больше не публичная или была удалена."}</p>
        <Link to="/">
          <Button className="bg-amber-500 hover:bg-amber-600 text-black font-semibold">
            <ArrowLeft className="w-4 h-4 mr-2" /> На главную
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="w-screen h-screen overflow-hidden bg-[#0A0A0A] text-white relative" data-testid="public-map-viewer">
      <MapCanvas
        readOnly
        tool="pan"
        layers={mapDoc.layers}
        polygons={mapDoc.polygons}
        markers={mapDoc.markers}
        lines={mapDoc.lines || []}
        texts={mapDoc.texts || []}
      />

      <div className="absolute top-4 left-4 right-4 h-14 flex items-center justify-between z-40 backdrop-blur-md bg-black/60 border border-white/10 rounded-lg px-4">
        <div className="flex items-center gap-3 min-w-0">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-amber-500 flex items-center justify-center">
              <Compass className="w-4 h-4 text-black" />
            </div>
            <span className="font-heading font-bold text-sm hidden sm:block">MapForge</span>
          </Link>
          <div className="w-px h-6 bg-white/10" />
          <div className="min-w-0">
            <div className="font-heading font-semibold truncate">{mapDoc.title}</div>
            {mapDoc.description && <div className="text-xs text-zinc-500 truncate">{mapDoc.description}</div>}
          </div>
        </div>
        <div className="text-xs text-zinc-500 hidden sm:block">
          Областей: <span className="text-zinc-300">{mapDoc.polygons.length}</span> · Маркеров: <span className="text-zinc-300">{mapDoc.markers.length}</span>
        </div>
      </div>

      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 backdrop-blur-md bg-black/60 border border-white/10 rounded-md px-4 py-2 text-xs text-zinc-400">
        Кликай по маркерам для деталей · колесо — pan · Ctrl+колесо — зум
      </div>
    </div>
  );
}
