import React, { useState, useEffect } from 'react';
import MapArea from './components/MapArea';
import LayerControls from './components/LayerControls';
import './index.css';

function App() {
  const [activeLayers, setActiveLayers] = useState({
    historical: false,
    neighborhoods: true,
    parks: false,
    squares: false,
    museums: true,
    events: true,
    monuments: true,
    embassies: true
  });

  const [geoJsonData, setGeoJsonData] = useState(null);
  const [dcBoundary, setDcBoundary] = useState(null);
  const [neighborhoodList, setNeighborhoodList] = useState([]);
  const [hiddenNeighborhoods, setHiddenNeighborhoods] = useState(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedNeighborhoods, setSelectedNeighborhoods] = useState(new Set());

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

    // Fetch DC Boundary
    fetch('https://maps2.dcgis.dc.gov/dcgis/rest/services/DCGIS_DATA/Administrative_Other_Boundaries_WebMercator/MapServer/10/query?where=1%3D1&outFields=*&outSR=4326&f=geojson')
      .then(res => res.json())
      .then(data => setDcBoundary(data))
      .catch(err => console.error("Error fetching DC Boundary:", err));
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

  const toggleAllNeighborhoodsVisibility = () => {
    if (hiddenNeighborhoods.size === neighborhoodList.length && neighborhoodList.length > 0) {
      setHiddenNeighborhoods(new Set());
    } else {
      setHiddenNeighborhoods(new Set(neighborhoodList));
    }
  };

  return (
    <>
      <div style={{ position: 'relative', width: '100%', height: '100%' }}>
        <MapArea 
          activeLayers={activeLayers} 
          geoJsonData={geoJsonData}
          hiddenNeighborhoods={hiddenNeighborhoods}
          dcBoundary={dcBoundary}
          searchQuery={searchQuery}
          selectedNeighborhoods={selectedNeighborhoods}
          setSelectedNeighborhoods={setSelectedNeighborhoods}
        />
        <LayerControls 
          activeLayers={activeLayers} 
          toggleLayer={toggleLayer}
          neighborhoodList={neighborhoodList}
          hiddenNeighborhoods={hiddenNeighborhoods}
          toggleNeighborhoodVisibility={toggleNeighborhoodVisibility}
          toggleAllNeighborhoodsVisibility={toggleAllNeighborhoodsVisibility}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
        />
      </div>
    </>
  );
}

export default App;
