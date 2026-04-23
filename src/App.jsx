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
    embassies: true,
    floodZones: false,
    topography: false,
    propertyValues: false,
    crime: false,
    bikeLanes: false,
    metro: false
  });

  const [geoJsonData, setGeoJsonData] = useState(null);
  const [dcBoundary, setDcBoundary] = useState(null);
  const [floodZonesData, setFloodZonesData] = useState(null);
  const [neighborhoodList, setNeighborhoodList] = useState([]);
  const [hiddenNeighborhoods, setHiddenNeighborhoods] = useState(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [previousActiveLayers, setPreviousActiveLayers] = useState(null);
  const [selectedNeighborhoods, setSelectedNeighborhoods] = useState(new Set());

  const [isLeftAligned, setIsLeftAligned] = useState(false);

  useEffect(() => {
    // Fetch geojson and extract individual neighborhood names
    fetch('https://raw.githubusercontent.com/alulsh/dc-micromobility-by-neighborhood/main/dc-neighborhoods.geojson')
      .then(res => res.json())
      .then(data => {
        
        // Extract unique neighborhoods
        const allNames = new Set();
        data.features.forEach(feature => {
          let rawNames = feature.properties?.NBH_NAMES || '';
          
          // Inject missing neighborhoods that the DC dataset grouped together
          if (rawNames.includes('Spring Valley, Palisades')) {
            rawNames += ', Kent, Berkley, Dalecarlia';
            feature.properties.NBH_NAMES = rawNames;
          }

          const names = rawNames.split(',').map(n => n.trim()).filter(n => n);
          names.forEach(n => allNames.add(n));
        });
        
        setGeoJsonData(data);
        
        const sortedNames = Array.from(allNames).sort();
        setNeighborhoodList(sortedNames);
      })
      .catch(err => console.error("Error fetching neighborhoods GeoJSON:", err));

    // Fetch DC Boundary
    fetch('https://maps2.dcgis.dc.gov/dcgis/rest/services/DCGIS_DATA/Administrative_Other_Boundaries_WebMercator/MapServer/10/query?where=1%3D1&outFields=*&outSR=4326&f=geojson')
      .then(res => res.json())
      .then(data => setDcBoundary(data))
      .catch(err => console.error("Error fetching DC Boundary:", err));
      
    // Fetch Flood Zones
    fetch('https://maps2.dcgis.dc.gov/dcgis/rest/services/DCGIS_DATA/Environment_Flood/MapServer/73/query?where=1%3D1&outFields=*&outSR=4326&f=geojson')
      .then(res => res.json())
      .then(data => setFloodZonesData(data))
      .catch(err => console.error("Error fetching Flood Zones:", err));
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

  const handleSearchChange = (newQuery) => {
    if (searchQuery === '' && newQuery !== '') {
      // Starting a search: remember current layers
      setPreviousActiveLayers(activeLayers);
    } else if (searchQuery !== '' && newQuery === '') {
      // Cleared search: restore previous layers
      if (previousActiveLayers) {
        setActiveLayers(previousActiveLayers);
        setPreviousActiveLayers(null);
      }
    }
    setSearchQuery(newQuery);
  };
  return (
    <>
      <div style={{ position: 'relative', width: '100%', height: '100%' }}>
        <MapArea 
          activeLayers={activeLayers} 
          geoJsonData={geoJsonData}
          hiddenNeighborhoods={hiddenNeighborhoods}
          dcBoundary={dcBoundary}
          floodZonesData={floodZonesData}
          searchQuery={searchQuery}
          selectedNeighborhoods={selectedNeighborhoods}
          setSelectedNeighborhoods={setSelectedNeighborhoods}
          isLeftAligned={isLeftAligned}
        />
        <LayerControls 
          activeLayers={activeLayers} 
          toggleLayer={toggleLayer}
          neighborhoodList={neighborhoodList}
          hiddenNeighborhoods={hiddenNeighborhoods}
          toggleNeighborhoodVisibility={toggleNeighborhoodVisibility}
          toggleAllNeighborhoodsVisibility={toggleAllNeighborhoodsVisibility}
          searchQuery={searchQuery}
          setSearchQuery={handleSearchChange}
          isLeftAligned={isLeftAligned}
          setIsLeftAligned={setIsLeftAligned}
        />
      </div>
    </>
  );
}

export default App;
