import React, { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, GeoJSON, Circle, Tooltip } from 'react-leaflet';
import ZoomWidget from './ZoomWidget';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default marker icons in Vite + Leaflet
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
import iconRetina from 'leaflet/dist/images/marker-icon-2x.png';

let DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconRetinaUrl: iconRetina,
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

import exportData from '../../dc_layer_lab_export.json';

const MapArea = ({ activeLayers }) => {
  const dcCenter = [38.9072, -77.0369];
  const favorites = exportData.favorites || [];
  const [geoJsonData, setGeoJsonData] = useState(null);
  const [selectedNeighborhood, setSelectedNeighborhood] = useState(null);

  useEffect(() => {
    // Only fetch if layer is active and we don't have the data yet
    if (activeLayers.neighborhoods && !geoJsonData) {
      fetch('https://raw.githubusercontent.com/alulsh/dc-micromobility-by-neighborhood/main/dc-neighborhoods.geojson')
        .then(res => res.json())
        .then(data => setGeoJsonData(data))
        .catch(err => console.error("Error fetching neighborhoods GeoJSON:", err));
    }
  }, [activeLayers.neighborhoods, geoJsonData]);

  return (
    <MapContainer 
      center={dcCenter} 
      zoom={12} 
      style={{ height: '100%', width: '100%', zIndex: 0 }}
      zoomControl={false}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
      />
      
      {activeLayers.favorites && favorites.map(fav => (
        <Marker key={fav.id} position={[fav.lat, fav.lng]}>
          <Popup>
            <div style={{ padding: '8px', minWidth: '150px' }}>
              <h3 style={{ margin: '0 0 8px 0', fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>
                {fav.name}
              </h3>
              <p style={{ margin: '0', fontSize: '14px', color: 'var(--text-secondary)' }}>
                {fav.address}
              </p>
              <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--accent-hover)' }}>
                Saved: {new Date(fav.createdAt).toLocaleDateString()}
              </div>
            </div>
          </Popup>
        </Marker>
      ))}

      {/* Placeholders for other layers */}
      {activeLayers.historical && (
        <Marker position={[38.8895, -77.0353]}>
           <Popup>Washington Monument (Historical Data layer)</Popup>
        </Marker>
      )}

      {/* Neighborhoods Layer */}
      {activeLayers.neighborhoods && geoJsonData && (
        <>
          {geoJsonData.features.flatMap((feature, featureIndex) => {
            const rawNames = feature.properties?.NBH_NAMES || 'Unknown Neighborhood';
            const clusterName = feature.properties?.NAME || 'Neighborhood Cluster';
            const neighborhoods = rawNames.split(',').map(n => n.trim());
            const N = neighborhoods.length;
            
            // Calculate cluster bounds to position individual hotspots
            const layer = L.geoJSON(feature);
            const bounds = layer.getBounds();
            const center = bounds.getCenter();
            
            // Base radius related to the cluster's size
            const radiusMeters = center.distanceTo(bounds.getNorthEast()) / 2;

            const latDiff = bounds.getNorth() - bounds.getSouth();
            const lngDiff = bounds.getEast() - bounds.getWest();
            const radiusY = latDiff * 0.2;
            const radiusX = lngDiff * 0.2;

            return neighborhoods.map((name, i) => {
              // Distribute individual neighborhood hotspots around the cluster center
              let pos = [center.lat, center.lng];
              if (N > 1) {
                const angle = (i / N) * Math.PI * 2;
                pos = [
                  center.lat + Math.sin(angle) * radiusY,
                  center.lng + Math.cos(angle) * radiusX
                ];
              }

              // Color hash based on individual neighborhood name
              const colors = ['#ef4444', '#f97316', '#f59e0b', '#84cc16', '#22c55e', '#10b981', '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1', '#8b5cf6', '#d946ef', '#f43f5e'];
              let hash = 0;
              for (let j = 0; j < name.length; j++) {
                hash = name.charCodeAt(j) + ((hash << 5) - hash);
              }
              const color = colors[Math.abs(hash) % colors.length];
              const isSelected = selectedNeighborhood === name;

              return (
                <Circle
                  key={`${featureIndex}-${i}`}
                  center={pos}
                  radius={radiusMeters * (isSelected ? 1.5 : 1.2)}
                  pathOptions={{
                    color: isSelected ? '#ffffff' : color,
                    weight: isSelected ? 2 : 0,
                    fillColor: color,
                    fillOpacity: isSelected ? 0.9 : 0.6,
                    className: isSelected ? 'blurry-node-selected' : 'blurry-node'
                  }}
                  eventHandlers={{
                    click: () => setSelectedNeighborhood(name)
                  }}
                >
                  <Tooltip sticky direction="top" opacity={0.95}>
                    <div style={{ fontFamily: "'Outfit', sans-serif", minWidth: '120px' }}>
                      <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-secondary)', marginBottom: '4px', borderBottom: '1px solid var(--border-glass)', paddingBottom: '4px' }}>
                        {clusterName}
                      </div>
                      <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)' }}>
                        <span style={{ color: 'var(--accent-primary)', marginRight: '4px' }}>•</span> 
                        {name}
                      </div>
                    </div>
                  </Tooltip>
                </Circle>
              );
            });
          })}
        </>
      )}

      <ZoomWidget />
    </MapContainer>
  );
};

export default MapArea;
