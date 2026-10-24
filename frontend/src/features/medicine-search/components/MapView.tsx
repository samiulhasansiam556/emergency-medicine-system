"use client";

import "leaflet/dist/leaflet.css";
import { useEffect } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from "react-leaflet";
import type { NearbyPharmacy } from "@/lib/types";

function Recenter({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng]);
  }, [lat, lng, map]);
  return null;
}

interface Props {
  center: { lat: number; lng: number };
  pharmacies: NearbyPharmacy[];
}

export default function MapView({ center, pharmacies }: Props) {
  return (
    <MapContainer
      center={[center.lat, center.lng]}
      zoom={13}
      className="h-full w-full rounded-xl"
    >
      <Recenter lat={center.lat} lng={center.lng} />
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {/* You */}
      <CircleMarker
        center={[center.lat, center.lng]}
        radius={9}
        pathOptions={{ color: "#1d4ed8", fillColor: "#3b82f6", fillOpacity: 0.9 }}
      >
        <Popup>Your location</Popup>
      </CircleMarker>

      {/* Pharmacies */}
      {pharmacies.map(({ pharmacy, distanceKm, available }) => {
        const allLow = available.every((a) => a.status === "LOW");
        return (
          <CircleMarker
            key={pharmacy.id}
            center={[pharmacy.location.latitude, pharmacy.location.longitude]}
            radius={10}
            pathOptions={{
              color: allLow ? "#b45309" : "#15803d",
              fillColor: allLow ? "#f59e0b" : "#22c55e",
              fillOpacity: 0.9,
            }}
          >
            <Popup>
              <strong>{pharmacy.name}</strong>
              <br />
              {distanceKm} km away
              <br />
              {pharmacy.phone}
            </Popup>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}