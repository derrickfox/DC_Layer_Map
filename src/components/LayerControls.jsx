import React from 'react';
import { Layers, MapPin, History, Sparkles, Map } from 'lucide-react';

const LayerControls = ({ activeLayers, toggleLayer }) => {
  return (
    <div 
      className="glass-panel"
      style={{
        position: 'absolute',
        top: '24px',
        right: '24px',
        width: '320px',
        padding: '24px',
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        gap: '20px'
      }}
    >
      <div>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          <Layers size={24} className="text-gradient" />
          <span className="text-gradient">DC Layer Lab</span>
        </h2>
        <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
          Toggle map layers and explore custom datasets.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <button 
          className={`glass-button ${activeLayers.favorites ? 'active' : ''}`}
          onClick={() => toggleLayer('favorites')}
          style={{ justifyContent: 'flex-start', padding: '12px 16px' }}
        >
          <MapPin size={18} />
          My Favorites
        </button>

        <button 
          className={`glass-button ${activeLayers.historical ? 'active' : ''}`}
          onClick={() => toggleLayer('historical')}
          style={{ justifyContent: 'flex-start', padding: '12px 16px' }}
        >
          <History size={18} />
          Historical Data
        </button>

        <button 
          className={`glass-button ${activeLayers.neighborhoods ? 'active' : ''}`}
          onClick={() => toggleLayer('neighborhoods')}
          style={{ justifyContent: 'flex-start', padding: '12px 16px' }}
        >
          <Map size={18} />
          Neighborhoods
        </button>

        <button 
          className={`glass-button ${activeLayers.aiGenerated ? 'active' : ''}`}
          onClick={() => toggleLayer('aiGenerated')}
          style={{ justifyContent: 'flex-start', padding: '12px 16px' }}
        >
          <Sparkles size={18} />
          AI Generated Layers
        </button>
      </div>

      <div style={{ 
        marginTop: 'auto', 
        paddingTop: '20px', 
        borderTop: '1px solid var(--border-glass)',
        fontSize: '12px',
        color: 'var(--text-secondary)',
        textAlign: 'center'
      }}>
        Powered by Antigravity Applets
      </div>
    </div>
  );
};

export default LayerControls;
