import React, { useState } from 'react';
import MapArea from './components/MapArea';
import LayerControls from './components/LayerControls';
import './index.css';

function App() {
  const [activeLayers, setActiveLayers] = useState({
    favorites: true,
    historical: false,
    neighborhoods: false,
    aiGenerated: false
  });

  const toggleLayer = (layerId) => {
    setActiveLayers(prev => ({
      ...prev,
      [layerId]: !prev[layerId]
    }));
  };

  return (
    <>
      <div style={{ position: 'relative', width: '100%', height: '100%' }}>
        <MapArea activeLayers={activeLayers} />
        <LayerControls activeLayers={activeLayers} toggleLayer={toggleLayer} />
      </div>
    </>
  );
}

export default App;
