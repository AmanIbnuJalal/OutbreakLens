import { useEffect } from "react";
import * as L from "leaflet";
import { CircleMarker, MapContainer, Popup, TileLayer, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.heat";
import type { HeatmapPoint } from "@workspace/api-client-react";

declare module "leaflet" {
  function heatLayer(
    latlngs: Array<[number, number, number]>,
    options?: {
      radius?: number;
      blur?: number;
      maxZoom?: number;
      max?: number;
      minOpacity?: number;
      gradient?: Record<number, string>;
    },
  ): Layer;
}

const BENGALURU_CENTER: [number, number] = [12.9716, 77.5946];

function HeatLayer({ points }: { points: HeatmapPoint[] }) {
  const map = useMap();

  useEffect(() => {
    if (!points.length) return;
    const heat = L.heatLayer(
      points.map((point) => [
        point.lat,
        point.lng,
        Math.max(0.1, Math.min(1, point.intensity)),
      ]),
      {
        radius: 48,
        blur: 34,
        maxZoom: 14,
        max: 1,
        minOpacity: 0.42,
        gradient: {
          0.2: "#55b7aa",
          0.45: "#f0c75e",
          0.72: "#ef8e4a",
          1: "#d9564b",
        },
      },
    ).addTo(map);

    return () => {
      map.removeLayer(heat);
    };
  }, [map, points]);

  return null;
}

export function OutbreakMap({ points }: { points: HeatmapPoint[] }) {
  const center = points.length
    ? [points[0].lat, points[0].lng] as [number, number]
    : BENGALURU_CENTER;

  return (
    <div className="relative h-[350px] overflow-hidden rounded-xl border border-border">
      <MapContainer
        center={center}
        zoom={11}
        scrollWheelZoom
        className="h-full w-full"
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <HeatLayer points={points} />
        {points.map((point) => (
          <CircleMarker
            key={point.locationName}
            center={[point.lat, point.lng]}
            radius={7}
            pathOptions={{ color: "#ffffff", weight: 2, fillColor: "#173944", fillOpacity: 0.9 }}
          >
            <Popup>
              <strong>{point.locationName}</strong>
              <br />
              Signal intensity: {Math.round(point.intensity * 100)}%
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>
      {!points.length && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center bg-background/40 text-sm text-muted-foreground">
          No locations mapped yet
        </div>
      )}
      <div className="pointer-events-none absolute bottom-3 left-3 z-[1000] rounded-lg border border-white/70 bg-white/85 px-2.5 py-2 text-[10px] text-muted-foreground shadow-sm backdrop-blur">
        <div className="mb-1 font-semibold text-foreground">Signal intensity</div>
        <div className="flex items-center gap-2">
          <span className="h-2 w-20 rounded-full bg-gradient-to-r from-[#55b7aa] via-[#f0c75e] to-[#d9564b]" />
          <span>low</span>
          <span>high</span>
        </div>
      </div>
    </div>
  );
}