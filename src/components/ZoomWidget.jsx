import React from 'react';
import { useMap } from 'react-leaflet';
import { Plus, Minus } from 'lucide-react';

const ZoomWidget = () => {
  const map = useMap();

  return (
    <div 
      className="glass-panel"
      style={{
        position: 'absolute',
        bottom: '24px',
        right: '24px',
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        borderRadius: '12px',
        padding: 0
      }}
    >
      <button 
        className="zoom-button"
        onClick={() => map.zoomIn()}
        title="Zoom In"
      >
        <Plus size={20} />
      </button>
      <div style={{ height: '1px', background: 'var(--border-glass)', width: '100%' }}></div>
      <button 
        className="zoom-button"
        onClick={() => map.zoomOut()}
        title="Zoom Out"
      >
        <Minus size={20} />
      </button>
    </div>
  );
};

export default ZoomWidget;
