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

const historicalEventsData = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: {
        NAME: "Assassination of Abraham Lincoln",
        YEAR: "1865",
        SUMMARY: "President Abraham Lincoln was assassinated by John Wilkes Booth while attending a play at Ford's Theatre."
      },
      geometry: { type: "Point", coordinates: [-77.0258, 38.8967] }
    },
    {
      type: "Feature",
      properties: {
        NAME: "\"I Have a Dream\" Speech",
        YEAR: "1963",
        SUMMARY: "Dr. Martin Luther King Jr. delivered his historic speech during the March on Washington for Jobs and Freedom at the Lincoln Memorial."
      },
      geometry: { type: "Point", coordinates: [-77.0502, 38.8893] }
    },
    {
      type: "Feature",
      properties: {
        NAME: "Burning of Washington",
        YEAR: "1814",
        SUMMARY: "British forces set fire to many public buildings, including the White House and the Capitol, during the War of 1812."
      },
      geometry: { type: "Point", coordinates: [-77.0365, 38.8977] }
    },
    {
      type: "Feature",
      properties: {
        NAME: "Watergate Break-in",
        YEAR: "1972",
        SUMMARY: "Five men were arrested for breaking into the DNC headquarters at the Watergate complex, sparking a major political scandal."
      },
      geometry: { type: "Point", coordinates: [-77.0544, 38.8995] }
    },
    {
      type: "Feature",
      properties: {
        NAME: "Bonus Army Encampment",
        YEAR: "1932",
        SUMMARY: "Thousands of WWI veterans gathered at Anacostia Flats to demand cash-payment redemption of their service certificates."
      },
      geometry: { type: "Point", coordinates: [-76.9858, 38.8733] }
    },
    {
      type: "Feature",
      properties: {
        NAME: "Woman Suffrage Procession",
        YEAR: "1913",
        SUMMARY: "The first suffragist parade in Washington, D.C. marched down Pennsylvania Avenue from the Capitol."
      },
      geometry: { type: "Point", coordinates: [-77.0091, 38.8899] }
    }
  ]
};

const MapArea = ({ activeLayers, geoJsonData, hiddenNeighborhoods }) => {
  const dcCenter = [38.9072, -77.0369];
  const favorites = exportData.favorites || [];
  const [selectedNeighborhood, setSelectedNeighborhood] = useState(null);
  const [parksData, setParksData] = useState(null);
  const [squaresData, setSquaresData] = useState(null);
  const [museumsData, setMuseumsData] = useState(null);

  useEffect(() => {
    if ((activeLayers.parks || activeLayers.squares) && !parksData && !squaresData) {
      const p1 = fetch('https://maps2.dcgis.dc.gov/dcgis/rest/services/DCGIS_DATA/Recreation_WebMercator/MapServer/9/query?where=1%3D1&outFields=*&outSR=4326&f=geojson').then(res => res.json());
      const p2 = fetch('https://maps2.dcgis.dc.gov/dcgis/rest/services/DCGIS_DATA/Recreation_WebMercator/MapServer/10/query?where=1%3D1&outFields=*&outSR=4326&f=geojson').then(res => res.json());
      
      Promise.all([p1, p2])
        .then(([localParks, nationalParks]) => {
          const allFeatures = [
            ...(localParks.features || []),
            ...(nationalParks.features || [])
          ];

          const isSquareOrCircle = (name) => {
            if (!name) return false;
            const n = name.toLowerCase();
            return n.includes('square') || n.includes('circle') || n.includes('triangle');
          };

          const pFeatures = [];
          const sFeatures = [];

          allFeatures.forEach(f => {
            const name = f.properties?.NAME || "";
            if (isSquareOrCircle(name)) {
              sFeatures.push(f);
            } else {
              pFeatures.push(f);
            }
          });

          setParksData({ type: "FeatureCollection", features: pFeatures });
          setSquaresData({ type: "FeatureCollection", features: sFeatures });
        })
        .catch(err => console.error("Error fetching parks/squares data:", err));
    }
  }, [activeLayers.parks, activeLayers.squares, parksData, squaresData]);

  useEffect(() => {
    if (activeLayers.museums && !museumsData) {
      fetch('https://opendata.dc.gov/api/download/v1/items/2e65fc16edc3481989d2cc17e6f8c533/geojson?layers=54')
        .then(res => res.json())
        .then(data => {
          data.features.push({
            type: "Feature",
            properties: {
              DCGISPLACE_NAMES_PTNAME: "Daughters of the American Revolution Museum"
            },
            geometry: {
              type: "Point",
              coordinates: [-77.0395, 38.8923]
            }
          });
          setMuseumsData(data);
        })
        .catch(err => console.error("Error fetching museums data:", err));
    }
  }, [activeLayers.museums, museumsData]);

  const parksStyle = {
    fillColor: '#22c55e',
    fillOpacity: 0.4,
    color: '#4ade80',
    weight: 2,
  };

  const squaresStyle = {
    fillColor: '#0ea5e9',
    fillOpacity: 0.4,
    color: '#38bdf8',
    weight: 2,
  };

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

            // Custom overrides for neighborhoods that are poorly placed or sized by the auto-calculation
            const customOverrides = {
              "Arboretum": { center: [38.9125, -76.9670], radius: 600 },
              "Adams Morgan": { center: [38.9220, -77.0420], radius: 500 },
              "Woodley Park": { center: [38.9250, -77.0530], radius: 550 },
              "Cleveland Park": { center: [38.9350, -77.0580], radius: 600 }
            };

            return neighborhoods.map((name, i) => {
              // Check if this specific neighborhood is toggled off
              if (hiddenNeighborhoods && hiddenNeighborhoods.has(name)) {
                return null;
              }

              // Distribute individual neighborhood hotspots around the cluster center
              let pos = [center.lat, center.lng];
              let finalRadius = radiusMeters;

              if (customOverrides[name]) {
                pos = customOverrides[name].center;
                finalRadius = customOverrides[name].radius;
              } else if (N > 1) {
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
                  radius={finalRadius * (isSelected ? 1.5 : 1.2)}
                  pathOptions={{
                    color: isSelected ? '#ffffff' : color,
                    weight: isSelected ? 2 : 0,
                    fillColor: color,
                    fillOpacity: isSelected ? 0.7 : 0.3,
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

      {/* Parks Layer */}
      {activeLayers.parks && parksData && (
        <GeoJSON 
          data={parksData}
          style={parksStyle}
          onEachFeature={(feature, layer) => {
            const name = feature.properties?.NAME || "Park";
            layer.bindTooltip(
              `<div style="font-family: 'Outfit', sans-serif; font-weight: 600; font-size: 14px; color: var(--text-primary);"><span style="color: #4ade80; margin-right: 4px;">•</span>${name}</div>`, 
              {
                permanent: false,
                direction: 'center',
                className: 'custom-tooltip'
              }
            );
          }}
        />
      )}

      {/* Squares & Circles Layer */}
      {activeLayers.squares && squaresData && (
        <GeoJSON 
          data={squaresData}
          style={squaresStyle}
          onEachFeature={(feature, layer) => {
            const name = feature.properties?.NAME || "Square/Circle";
            layer.bindTooltip(
              `<div style="font-family: 'Outfit', sans-serif; font-weight: 600; font-size: 14px; color: var(--text-primary);"><span style="color: #38bdf8; margin-right: 4px;">•</span>${name}</div>`, 
              {
                permanent: false,
                direction: 'center',
                className: 'custom-tooltip'
              }
            );
          }}
        />
      )}

      {/* Museums Layer */}
      {activeLayers.museums && museumsData && (
        <GeoJSON 
          data={museumsData}
          pointToLayer={(feature, latlng) => {
            return L.circleMarker(latlng, {
              radius: 6,
              fillColor: '#8b5cf6', // purple
              color: '#a78bfa',
              weight: 2,
              opacity: 1,
              fillOpacity: 0.8
            });
          }}
          onEachFeature={(feature, layer) => {
            const name = feature.properties?.DCGISPLACE_NAMES_PTNAME || "Museum";
            layer.bindTooltip(
              `<div style="font-family: 'Outfit', sans-serif; font-weight: 600; font-size: 14px; color: var(--text-primary);"><span style="color: #a78bfa; margin-right: 4px;">•</span>${name}</div>`, 
              {
                permanent: false,
                direction: 'top',
                className: 'custom-tooltip'
              }
            );
          }}
        />
      )}

      {/* Historical Data Layer */}
      {activeLayers.historical && (
        <GeoJSON 
          data={historicalEventsData}
          pointToLayer={(feature, latlng) => {
            return L.circleMarker(latlng, {
              radius: 8,
              fillColor: '#f59e0b', // amber
              color: '#fbbf24',
              weight: 2,
              opacity: 1,
              fillOpacity: 0.9
            });
          }}
          onEachFeature={(feature, layer) => {
            const { NAME, YEAR, SUMMARY } = feature.properties;
            layer.bindTooltip(
              `<div style="font-family: 'Outfit', sans-serif; max-width: 500px;">
                 <div style="font-weight: 700; font-size: 15px; color: var(--text-primary); margin-bottom: 4px; display: flex; align-items: center; gap: 6px;">
                   <span style="color: #fbbf24;">★</span> ${NAME}
                 </div>
                 <div style="font-weight: 600; font-size: 13px; color: #fbbf24; margin-bottom: 6px;">
                   ${YEAR}
                 </div>
                 <div style="font-weight: 400; font-size: 13px; color: var(--text-secondary); line-height: 1.4;">
                   ${SUMMARY}
                 </div>
               </div>`, 
              {
                permanent: false,
                direction: 'top',
                className: 'custom-tooltip historical-tooltip'
              }
            );
          }}
        />
      )}

      <ZoomWidget />
    </MapContainer>
  );
};

export default MapArea;
