import React, { useState, useEffect } from 'react';
import MapArea from './components/MapArea';
import LayerControls from './components/LayerControls';
import './index.css';

function App() {
  const [activeLayers, setActiveLayers] = useState({
    favorites: true,
    historical: false,
    neighborhoods: false,
    aiGenerated: false,
    parks: false,
    squares: false,
    museums: false
  });

  const [geoJsonData, setGeoJsonData] = useState(null);
  const [neighborhoodList, setNeighborhoodList] = useState([]);
  const [hiddenNeighborhoods, setHiddenNeighborhoods] = useState(new Set());

  useEffect(() => {
    // Fetch geojson and extract individual neighborhood names
    fetch('https://raw.githubusercontent.com/alulsh/dc-micromobility-by-neighborhood/main/dc-neighborhoods.geojson')
      .then(res => res.json())
      .then(data => {
        setGeoJsonData(data);
        
        // Extract unique neighborhoods
        const allNames = new Set();
        data.features.forEach(feature => {
          const rawNames = feature.properties?.NBH_NAMES || '';
          const names = rawNames.split(',').map(n => n.trim()).filter(n => n);
          names.forEach(n => allNames.add(n));
        });
        
        const sortedNames = Array.from(allNames).sort();
        setNeighborhoodList(sortedNames);
      })
      .catch(err => console.error("Error fetching neighborhoods GeoJSON:", err));
  }, []);

  const toggleLayer = (layerId) => {
    setActiveLayers(prev => ({
      ...prev,
      [layerId]: !prev[layerId]
    }));
  };

  const toggleNeighborhoodVisibility = (name) => {
    setHiddenNeighborhoods(prev => {
      const newSet = new Set(prev);
      if (newSet.has(name)) {
        newSet.delete(name);
      } else {
        newSet.add(name);
      }
      return newSet;
    });
  };

  return (
    <>
      <div style={{ position: 'relative', width: '100%', height: '100%' }}>
        <MapArea 
          activeLayers={activeLayers} 
          geoJsonData={geoJsonData}
          hiddenNeighborhoods={hiddenNeighborhoods}
        />
        <LayerControls 
          activeLayers={activeLayers} 
          toggleLayer={toggleLayer}
          neighborhoodList={neighborhoodList}
          hiddenNeighborhoods={hiddenNeighborhoods}
          toggleNeighborhoodVisibility={toggleNeighborhoodVisibility}
        />
      </div>
    </>
  );
}

export default App;
