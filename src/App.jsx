import React, { useState, useEffect } from 'react';
import MapArea from './components/MapArea';
import LayerControls from './components/LayerControls';
import './index.css';

const DEFAULT_VISIBLE_NEIGHBORHOODS = new Set([
  'Adams Morgan',
  'American University Park',
  'Barnaby Woods',
  'Berkley',
  'Bloomingdale',
  'Brightwood',
  'Buzzard Point',
  'Cardozo/Shaw',
  'Cathedral Heights',
  'Chevy Chase',
  'Chinatown',
  'Cleveland Park',
  'Columbia Heights',
  'Connecticut Avenue/K Street',
  'Downtown',
  'Dupont Circle',
  'Foggy Bottom',
  'Friendship Heights',
  'Forest Hills',
  'Foxhall Crescent',
  'Foxhall Village',
  'Georgetown',
  'Glover Park',
  'Burleith/Hillandale',
  'Kalorama Heights',
  'Observatory Circle',
  'Logan Circle',
  'Mt. Pleasant',
  'Kent',
  'North Cleveland Park',
  'Palisades',
  'Petworth',
  'Shaw',
  'Spring Valley',
  'Takoma',
  'Tenleytown',
  'Truxton Circle',
  'U Street Corridor',
  'Union Station',
  'Van Ness',
  'Wesley Heights',
  'Woodley Park',
  'Brookland',
  'Brentwood',
  'Fort Lincoln',
  'Fort Totten',
  'Eckington',
  'Edgewood',
  'H Street Corridor',
  'Ivy City',
  'Langdon',
  'Lamont Riggs',
  'Le Droit Park',
  'Michigan Park',
  'Queens Chapel',
  'Trinidad',
  'Woodridge',
  'Arboretum',
  'Benning',
  'Carver Langston',
  'Deanwood',
  'Historic Anacostia',
  'Kenilworth',
  'Kingman Park',
  'River Terrace',
  'Barracks Row',
  'Barry Farm',
  'Bellevue',
  'Capitol Hill',
  'Capitol View',
  'Congress Heights',
  'Crestwood',
  'Fairlawn',
  'Fort Dupont',
  'Hill East',
  'Hillcrest',
  'National Mall',
  'Navy Yard',
  'Penn Branch',
  'Randle Highlands',
  'Shipley Terrace',
  'Stanton Park',
  'Southwest/Waterfront',
  'Washington Highlands',
  'Woodland/Fort Stanton'
]);

const SYNTHETIC_NEIGHBORHOODS = [
  'U Street Corridor',
  'H Street Corridor',
  'Barracks Row',
  'Hill East'
];

function App() {
  const [activeLayers, setActiveLayers] = useState({
    historical: false,
    neighborhoods: true,
    parks: false,
    squares: false,
    museums: true,
    dcps: false,
    librariesRecPools: false,
    muralsPublicArt: false,
    historicLandmarks: false,
    events: true,
    monuments: true,
    embassies: true,
    wards: false,
    floodZones: false,
    topography: false,
    propertyValues: false,
    crime: false,
    foodDeserts: false,
    farmersMarkets: false,
    bikeLanes: false,
    bus: false,
    metro: false,
    zoning: false
  });

  const [geoJsonData, setGeoJsonData] = useState(null);
  const [dcBoundary, setDcBoundary] = useState(null);
  const [floodZonesData, setFloodZonesData] = useState(null);
  const [neighborhoodList, setNeighborhoodList] = useState([]);
  const [hiddenNeighborhoods, setHiddenNeighborhoods] = useState(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [previousActiveLayers, setPreviousActiveLayers] = useState(null);
  const [layerSuspendSnapshot, setLayerSuspendSnapshot] = useState(null);
  const [selectedNeighborhoods, setSelectedNeighborhoods] = useState(new Set());
  const [showNeighborhoodBackgrounds, setShowNeighborhoodBackgrounds] = useState(true);

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

          const names = rawNames
            .split(',')
            .map(n => n.trim())
            .filter(n => n && n !== 'Anacostia River');
          names.forEach(n => allNames.add(n));
        });
        SYNTHETIC_NEIGHBORHOODS.forEach(name => allNames.add(name));
        
        setGeoJsonData(data);
        
        const sortedNames = Array.from(allNames).sort();
        setNeighborhoodList(sortedNames);
        setHiddenNeighborhoods(new Set(sortedNames.filter(name => !DEFAULT_VISIBLE_NEIGHBORHOODS.has(name))));
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

  const toggleSuspendAllLayers = () => {
    if (layerSuspendSnapshot) {
      setActiveLayers(layerSuspendSnapshot);
      setLayerSuspendSnapshot(null);
    } else {
      setLayerSuspendSnapshot({ ...activeLayers });
      setActiveLayers((prev) => {
        const next = {};
        for (const key of Object.keys(prev)) {
          next[key] = false;
        }
        return next;
      });
    }
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
          showNeighborhoodBackgrounds={showNeighborhoodBackgrounds}
        />
        <LayerControls 
          activeLayers={activeLayers} 
          toggleLayer={toggleLayer}
          layersSuspended={layerSuspendSnapshot !== null}
          onToggleSuspendAllLayers={toggleSuspendAllLayers}
          neighborhoodList={neighborhoodList}
          hiddenNeighborhoods={hiddenNeighborhoods}
          toggleNeighborhoodVisibility={toggleNeighborhoodVisibility}
          toggleAllNeighborhoodsVisibility={toggleAllNeighborhoodsVisibility}
          searchQuery={searchQuery}
          setSearchQuery={handleSearchChange}
          isLeftAligned={isLeftAligned}
          setIsLeftAligned={setIsLeftAligned}
          showNeighborhoodBackgrounds={showNeighborhoodBackgrounds}
          toggleNeighborhoodBackgrounds={() => setShowNeighborhoodBackgrounds(prev => !prev)}
        />
      </div>
    </>
  );
}

export default App;
