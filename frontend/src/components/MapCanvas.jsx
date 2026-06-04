import React, { useRef, useState, useEffect, useCallback } from "react";

/**
 * Figma-like SVG map canvas: pen / rect / line / marker / text / select / pan.
 * Navigation: wheel = pan, Shift+wheel = horizontal, Ctrl/Cmd+wheel = zoom,
 * Space+drag = pan, Middle-mouse drag = pan, Hand tool = drag pan.
 */
export default function MapCanvas({
  readOnly = false,
  tool = "pan",
  layers = [],
  polygons = [],
  markers = [],
  lines = [],
  texts = [],
  onAddPolygon,
  onAddMarker,
  onAddLine,
  onAddText,
  onSelectShape,
  selectedShapeId,
  onUpdatePolygon,
  activeLayerId,
  fillColor = "#F59E0B",
  strokeColor = "#F59E0B",
}) {
  const svgRef = useRef(null);
  const [transform, setTransform] = useState({ x: 0, y: 0, k: 1 });
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef(null);
  const [spaceDown, setSpaceDown] = useState(false);
  const [drawingPoints, setDrawingPoints] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [rectStart, setRectStart] = useState(null);
  const [rectEnd, setRectEnd] = useState(null);
  const [openMarker, setOpenMarker] = useState(null);
  const labelDragRef = useRef(null);
  const [drawMode, setDrawMode] = useState(null);

  const visibleLayers = new Set(layers.filter((l) => l.visible).map((l) => l.id));

  const getWorld = useCallback((evt) => {
    const svg = svgRef.current;
    if (!svg) return [0, 0];
    const rect = svg.getBoundingClientRect();
    return [(evt.clientX - rect.left - transform.x) / transform.k, (evt.clientY - rect.top - transform.y) / transform.k];
  }, [transform]);

  const onWheel = (e) => {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      const factor = e.deltaY > 0 ? 0.92 : 1.08;
      const rect = svgRef.current.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      const newK = Math.min(8, Math.max(0.15, transform.k * factor));
      const nx = cx - (cx - transform.x) * (newK / transform.k);
      const ny = cy - (cy - transform.y) * (newK / transform.k);
      setTransform({ x: nx, y: ny, k: newK });
    } else {
      const dx = e.shiftKey ? e.deltaY : e.deltaX;
      const dy = e.shiftKey ? 0 : e.deltaY;
      setTransform((t) => ({ ...t, x: t.x - dx, y: t.y - dy }));
    }
  };

  const finishDrawing = useCallback(() => {
    if (!activeLayerId) { setDrawingPoints([]); setCursor(null); setDrawMode(null); return; }
    if (drawMode === "polygon" && drawingPoints.length >= 3) {
      const cxw = drawingPoints.reduce((a, p) => a + p[0], 0) / drawingPoints.length;
      const cyw = drawingPoints.reduce((a, p) => a + p[1], 0) / drawingPoints.length;
      onAddPolygon && onAddPolygon({
        id: crypto.randomUUID(), layer_id: activeLayerId, points: drawingPoints,
        name: "Новая область", fill: fillColor, stroke: "#FFFFFF", opacity: 0.35,
        label_x: cxw, label_y: cyw, label_size: 14,
      });
    } else if (drawMode === "line" && drawingPoints.length >= 2) {
      onAddLine && onAddLine({
        id: crypto.randomUUID(), layer_id: activeLayerId, points: drawingPoints,
        name: "Маршрут", color: strokeColor, width: 2,
      });
    }
    setDrawingPoints([]); setCursor(null); setDrawMode(null);
  }, [drawMode, drawingPoints, activeLayerId, fillColor, strokeColor, onAddPolygon, onAddLine]);

  const cancelDrawing = () => { setDrawingPoints([]); setCursor(null); setDrawMode(null); };

  useEffect(() => {
    const onKeyDown = (e) => {
      const tag = (e.target.tagName || "").toLowerCase();
      if (e.code === "Space" && !e.repeat) {
        if (tag === "input" || tag === "textarea") return;
        e.preventDefault();
        setSpaceDown(true);
      }
      if (drawMode === "polygon" || drawMode === "line") {
        if (e.key === "Enter") finishDrawing();
        if (e.key === "Escape") cancelDrawing();
      }
    };
    const onKeyUp = (e) => { if (e.code === "Space") setSpaceDown(false); };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  });

  useEffect(() => {
    if (tool !== "pen" && drawMode === "polygon") cancelDrawing();
    if (tool !== "line" && drawMode === "line") cancelDrawing();
    if (tool !== "rect") { setRectStart(null); setRectEnd(null); }
  }, [tool]); // eslint-disable-line

  const effectivePan = tool === "pan" || spaceDown;

  const onMouseDown = (e) => {
    if (e.button === 1 || effectivePan) {
      setIsPanning(true);
      panStart.current = { x: e.clientX - transform.x, y: e.clientY - transform.y };
      return;
    }
    if (tool === "rect" && e.button === 0 && !readOnly && activeLayerId) {
      const [wx, wy] = getWorld(e);
      setRectStart([wx, wy]); setRectEnd([wx, wy]);
    }
  };

  const onMouseMove = (e) => {
    if (isPanning && panStart.current) {
      setTransform((t) => ({ ...t, x: e.clientX - panStart.current.x, y: e.clientY - panStart.current.y }));
      return;
    }
    if (labelDragRef.current) {
      const [wx, wy] = getWorld(e);
      onUpdatePolygon && onUpdatePolygon(labelDragRef.current, { label_x: wx, label_y: wy });
      return;
    }
    if ((drawMode === "polygon" || drawMode === "line") && drawingPoints.length > 0) setCursor(getWorld(e));
    if (rectStart && tool === "rect") setRectEnd(getWorld(e));
  };

  const onMouseUp = () => {
    if (isPanning) { setIsPanning(false); panStart.current = null; return; }
    if (labelDragRef.current) { labelDragRef.current = null; return; }
    if (tool === "rect" && rectStart && rectEnd && !readOnly && activeLayerId) {
      const [x1, y1] = rectStart, [x2, y2] = rectEnd;
      const minX = Math.min(x1, x2), maxX = Math.max(x1, x2);
      const minY = Math.min(y1, y2), maxY = Math.max(y1, y2);
      if (Math.abs(maxX - minX) > 4 && Math.abs(maxY - minY) > 4) {
        onAddPolygon && onAddPolygon({
          id: crypto.randomUUID(), layer_id: activeLayerId,
          points: [[minX, minY], [maxX, minY], [maxX, maxY], [minX, maxY]],
          name: "Область", fill: fillColor, stroke: "#FFFFFF", opacity: 0.35,
          label_x: (minX + maxX) / 2, label_y: (minY + maxY) / 2, label_size: 14,
        });
      }
      setRectStart(null); setRectEnd(null);
    }
  };

  const onCanvasClick = (e) => {
    if (readOnly) return;
    if (isPanning || effectivePan) return;
    if (e.target.dataset?.uihit) return;
    const [wx, wy] = getWorld(e);
    if (tool === "pen") {
      if (!activeLayerId) return;
      if (drawMode !== "polygon") { setDrawMode("polygon"); setDrawingPoints([[wx, wy]]); return; }
      if (drawingPoints.length >= 3) {
        const [fx, fy] = drawingPoints[0];
        if (Math.hypot(wx - fx, wy - fy) < 10 / transform.k) { finishDrawing(); return; }
      }
      setDrawingPoints((p) => [...p, [wx, wy]]);
    } else if (tool === "line") {
      if (!activeLayerId) return;
      if (drawMode !== "line") { setDrawMode("line"); setDrawingPoints([[wx, wy]]); return; }
      setDrawingPoints((p) => [...p, [wx, wy]]);
    } else if (tool === "marker") {
      if (!activeLayerId) return;
      onAddMarker && onAddMarker({
        id: crypto.randomUUID(), layer_id: activeLayerId, x: wx, y: wy,
        title: "Новая метка", description: "", color: strokeColor,
      });
    } else if (tool === "text") {
      if (!activeLayerId) return;
      onAddText && onAddText({
        id: crypto.randomUUID(), layer_id: activeLayerId, x: wx, y: wy,
        text: "Текст", size: 18, color: "#FFFFFF",
      });
    }
  };

  const cursorStyle =
    isPanning ? "grabbing" : effectivePan ? "grab" :
    (tool === "pen" || tool === "line" || tool === "rect" || tool === "marker" || tool === "text") ? "crosshair" :
    "default";

  const drawingPath = drawingPoints.length === 0 ? "" :
    drawingPoints.map((p, i) => (i === 0 ? `M ${p[0]} ${p[1]}` : `L ${p[0]} ${p[1]}`)).join(" ") +
    (cursor ? ` L ${cursor[0]} ${cursor[1]}` : "");

  return (
    <div className="absolute inset-0 editor-canvas overflow-hidden">
      <svg
        ref={svgRef}
        className="w-full h-full select-none"
        style={{ cursor: cursorStyle, touchAction: "none" }}
        onWheel={onWheel}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={() => { setIsPanning(false); panStart.current = null; }}
        onClick={onCanvasClick}
        onDoubleClick={() => (drawMode === "polygon" || drawMode === "line") && finishDrawing()}
        data-testid="map-editor-canvas"
      >
        <g transform={`translate(${transform.x},${transform.y}) scale(${transform.k})`}>
          {polygons.filter((p) => visibleLayers.has(p.layer_id)).map((p) => {
            const d = p.points.map((pt, i) => (i === 0 ? `M ${pt[0]} ${pt[1]}` : `L ${pt[0]} ${pt[1]}`)).join(" ") + " Z";
            const isSelected = selectedShapeId === p.id;
            const cx = p.label_x != null ? p.label_x : p.points.reduce((a, pt) => a + pt[0], 0) / p.points.length;
            const cy = p.label_y != null ? p.label_y : p.points.reduce((a, pt) => a + pt[1], 0) / p.points.length;
            const labelSize = p.label_size || 14;
            return (
              <g key={p.id}>
                <path d={d} fill={p.fill} fillOpacity={p.opacity}
                  stroke={isSelected ? "#F59E0B" : p.stroke}
                  strokeWidth={isSelected ? 2.5 : 1.5}
                  strokeLinejoin="round" vectorEffect="non-scaling-stroke"
                  data-uihit="1"
                  style={{
                    cursor: tool === "select" ? "pointer" : (tool === "marker" || tool === "text" ? "crosshair" : undefined),
                    pointerEvents: tool === "marker" || tool === "text" ? "none" : "auto",
                  }}
                  onClick={(e) => {
                    if (tool === "select" && !readOnly) {
                      e.stopPropagation();
                      onSelectShape && onSelectShape({ type: "polygon", id: p.id });
                    }
                  }} />
                {p.name && (
                  <text x={cx} y={cy} fill="#fff" fontSize={labelSize} textAnchor="middle"
                    data-uihit="1"
                    style={{
                      fontFamily: "Unbounded, sans-serif", fontWeight: 600,
                      paintOrder: "stroke", stroke: "#000", strokeWidth: 3, strokeLinejoin: "round",
                      cursor: isSelected && !readOnly ? "move" : (tool === "select" ? "pointer" : undefined),
                      pointerEvents: tool === "marker" || tool === "text" ? "none" : "auto",
                      userSelect: "none",
                    }}
                    onMouseDown={(e) => {
                      if (isSelected && !readOnly && tool === "select") {
                        e.stopPropagation();
                        labelDragRef.current = p.id;
                      }
                    }}
                    onClick={(e) => {
                      if (tool === "select" && !readOnly) {
                        e.stopPropagation();
                        onSelectShape && onSelectShape({ type: "polygon", id: p.id });
                      }
                    }}>
                    {p.name}
                  </text>
                )}
                {isSelected && !readOnly && p.points.map((pt, i) => (
                  <circle key={i} cx={pt[0]} cy={pt[1]} r={5 / transform.k}
                    fill="#F59E0B" stroke="#000" strokeWidth={1.5 / transform.k} />
                ))}
              </g>
            );
          })}

          {lines.filter((l) => visibleLayers.has(l.layer_id)).map((l) => {
            const d = l.points.map((pt, i) => (i === 0 ? `M ${pt[0]} ${pt[1]}` : `L ${pt[0]} ${pt[1]}`)).join(" ");
            const isSelected = selectedShapeId === l.id;
            return (
              <path key={l.id} d={d} fill="none" stroke={l.color}
                strokeWidth={isSelected ? l.width + 1 : l.width}
                vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round"
                data-uihit="1"
                style={{ cursor: tool === "select" ? "pointer" : undefined }}
                onClick={(e) => {
                  if (tool === "select" && !readOnly) {
                    e.stopPropagation();
                    onSelectShape && onSelectShape({ type: "line", id: l.id });
                  }
                }} />
            );
          })}

          {texts.filter((t) => visibleLayers.has(t.layer_id)).map((t) => {
            const isSelected = selectedShapeId === t.id;
            return (
              <text key={t.id} x={t.x} y={t.y} fill={t.color} fontSize={t.size}
                data-uihit="1"
                style={{
                  fontFamily: "Unbounded, sans-serif", fontWeight: 600,
                  paintOrder: "stroke", stroke: "#000", strokeWidth: 3, strokeLinejoin: "round",
                  cursor: tool === "select" ? "pointer" : undefined, userSelect: "none",
                  textDecoration: isSelected ? "underline" : "none",
                }}
                onClick={(e) => {
                  if (tool === "select" && !readOnly) {
                    e.stopPropagation();
                    onSelectShape && onSelectShape({ type: "text", id: t.id });
                  }
                }}>
                {t.text}
              </text>
            );
          })}

          {drawingPoints.length > 0 && (
            <g pointerEvents="none">
              <path d={drawingPath} fill={drawMode === "polygon" ? fillColor : "none"}
                fillOpacity={drawMode === "polygon" ? 0.2 : 0}
                stroke="#F59E0B" strokeWidth={1.5} strokeDasharray="6 4" vectorEffect="non-scaling-stroke" />
              {drawingPoints.map((p, i) => (
                <circle key={i} cx={p[0]} cy={p[1]} r={(i === 0 && drawMode === "polygon" ? 7 : 4) / transform.k}
                  fill={i === 0 && drawMode === "polygon" ? "#0A0A0A" : "#F59E0B"}
                  stroke="#F59E0B" strokeWidth={1.5 / transform.k} />
              ))}
            </g>
          )}

          {tool === "rect" && rectStart && rectEnd && (
            <rect x={Math.min(rectStart[0], rectEnd[0])} y={Math.min(rectStart[1], rectEnd[1])}
              width={Math.abs(rectStart[0] - rectEnd[0])} height={Math.abs(rectStart[1] - rectEnd[1])}
              fill={fillColor} fillOpacity={0.2}
              stroke="#F59E0B" strokeDasharray="6 4" vectorEffect="non-scaling-stroke"
              pointerEvents="none" />
          )}

          {markers.filter((m) => visibleLayers.has(m.layer_id)).map((m) => {
            const isSelected = selectedShapeId === m.id;
            const r = 8 / transform.k;
            return (
              <g key={m.id} transform={`translate(${m.x},${m.y})`}
                data-uihit="1"
                onClick={(e) => {
                  e.stopPropagation();
                  if (readOnly) { setOpenMarker(m.id === openMarker ? null : m.id); return; }
                  if (tool === "select") onSelectShape && onSelectShape({ type: "marker", id: m.id });
                  else setOpenMarker(m.id === openMarker ? null : m.id);
                }}
                style={{ cursor: "pointer" }}>
                <circle r={r + 3 / transform.k} fill="#000" opacity={0.5} />
                <circle r={r} fill={m.color} stroke={isSelected ? "#fff" : "rgba(0,0,0,0.8)"}
                  strokeWidth={(isSelected ? 2 : 1.5) / transform.k} />
                <circle r={r * 0.35} fill="#000" opacity={0.5} />
                {openMarker === m.id && (
                  <foreignObject x={14 / transform.k} y={-14 / transform.k}
                    width={240 / transform.k} height={160 / transform.k}>
                    <div xmlns="http://www.w3.org/1999/xhtml"
                      style={{
                        background: "rgba(20,20,20,0.95)", border: "1px solid rgba(255,255,255,0.12)",
                        borderRadius: 6, padding: 10, color: "white",
                        fontFamily: "IBM Plex Sans, sans-serif",
                        transform: `scale(${1 / transform.k})`, transformOrigin: "0 0",
                        width: 240, maxHeight: 160, overflow: "auto",
                      }}>
                      <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>{m.title || "Без названия"}</div>
                      <div style={{ color: "#a1a1aa", fontSize: 12, whiteSpace: "pre-wrap" }}>{m.description || "Нет описания"}</div>
                    </div>
                  </foreignObject>
                )}
              </g>
            );
          })}
        </g>
      </svg>

      {(drawMode === "polygon" || drawMode === "line") && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 backdrop-blur-md bg-black/70 border border-white/10 rounded-md px-4 py-2 text-xs text-zinc-300 z-50">
          Точек: <span className="text-amber-400 font-semibold">{drawingPoints.length}</span>
          {drawMode === "polygon" && drawingPoints.length >= 3 && <> · клик по первой точке — замкнуть</>}
          {" "}· Enter / двойной клик — завершить · Esc — отменить
        </div>
      )}

      <div className="absolute bottom-4 left-4 backdrop-blur-md bg-black/60 border border-white/10 rounded-md px-3 py-1.5 text-xs text-zinc-400 z-40 flex items-center gap-3 font-mono">
        <span>{Math.round(transform.k * 100)}%</span>
        <span className="text-zinc-600">·</span>
        <span className="hidden sm:inline">Ctrl + колесо — зум · Space + drag — перемещение</span>
      </div>
    </div>
  );
}
