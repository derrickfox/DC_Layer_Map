import React, { useState } from 'react';
import { Layers, MapPin, History, Sparkles, Map, ChevronDown, ChevronUp, Eye, EyeOff, TreePine, CircleDot, Landmark, Ticket, Flag, Globe, Search, Waves, Mountain } from 'lucide-react';

const LayerControls = ({ 
  activeLayers, 
  toggleLayer, 
  neighborhoodList = [], 
  hiddenNeighborhoods = new Set(), 
  toggleNeighborhoodVisibility,
  toggleAllNeighborhoodsVisibility,
  searchQuery,
  setSearchQuery
}) => {
  const [isNeighborhoodsExpanded, setIsNeighborhoodsExpanded] = useState(false);
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
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <Layers size={24} className="text-gradient" />
          <span className="text-gradient">DC Layer Lab</span>
        </h2>
        <div style={{ position: 'relative' }}>
          <Search size={16} color="var(--text-secondary)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
          <input 
            type="text" 
            placeholder="Search active layers..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 12px 10px 36px',
              borderRadius: '8px',
              border: '1px solid var(--border-glass)',
              background: 'rgba(255, 255, 255, 0.8)',
              color: 'var(--text-primary)',
              fontSize: '14px',
              outline: 'none',
              boxSizing: 'border-box'
            }}
          />
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <button 
              className={`glass-button ${activeLayers.neighborhoods ? 'active-orange' : ''}`}
              onClick={() => toggleLayer('neighborhoods')}
              style={{ justifyContent: 'space-between', padding: '12px 16px', width: '100%' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Map size={18} color={activeLayers.neighborhoods ? "#ffffff" : "#f97316"} />
                Neighborhoods
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', margin: '-4px' }}>
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    if (toggleAllNeighborhoodsVisibility) toggleAllNeighborhoodsVisibility();
                  }}
                  style={{ display: 'flex', alignItems: 'center', padding: '4px' }}
                  title={hiddenNeighborhoods.size === neighborhoodList.length && neighborhoodList.length > 0 ? "Show all neighborhoods" : "Hide all neighborhoods"}
                >
                  {hiddenNeighborhoods.size === neighborhoodList.length && neighborhoodList.length > 0 ? <EyeOff size={18} /> : <Eye size={18} />}
                </div>
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsNeighborhoodsExpanded(!isNeighborhoodsExpanded);
                  }}
                  style={{ display: 'flex', alignItems: 'center', padding: '4px' }}
                  title="Expand Neighborhoods"
                >
                  {isNeighborhoodsExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </div>
              </div>
            </button>
          
          {isNeighborhoodsExpanded && (
            <div style={{ 
              maxHeight: '200px', 
              overflowY: 'auto', 
              background: 'rgba(255, 255, 255, 0.8)', 
              borderRadius: '8px',
              padding: '8px',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
              marginTop: '4px'
            }}>
              {neighborhoodList.length === 0 ? (
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', padding: '8px', textAlign: 'center' }}>
                  Loading neighborhoods...
                </div>
              ) : (
                neighborhoodList.map(name => {
                  const isHidden = hiddenNeighborhoods.has(name);
                  return (
                    <div 
                      key={name} 
                      style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center',
                        padding: '6px 8px',
                        borderRadius: '6px',
                        fontSize: '13px',
                        color: isHidden ? 'var(--text-secondary)' : 'var(--text-primary)',
                        background: 'transparent'
                      }}
                    >
                      <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                        {name}
                      </span>
                      <button
                        onClick={() => toggleNeighborhoodVisibility(name)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: isHidden ? 'var(--text-secondary)' : 'var(--text-primary)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          padding: '4px'
                        }}
                      >
                        {isHidden ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>

        <button 
          className={`glass-button ${activeLayers.museums ? 'active-purple' : ''}`}
          onClick={() => toggleLayer('museums')}
          style={{ justifyContent: 'flex-start', padding: '12px 16px' }}
        >
          <Landmark size={18} color={activeLayers.museums ? "#ffffff" : "#a78bfa"} />
          Museums
        </button>

        <button 
          className={`glass-button ${activeLayers.events ? 'active-pink' : ''}`}
          onClick={() => toggleLayer('events')}
          style={{ justifyContent: 'flex-start', padding: '12px 16px' }}
        >
          <Ticket size={18} color={activeLayers.events ? "#ffffff" : "#f472b6"} />
          Ticketed Events
        </button>

        <button 
          className={`glass-button ${activeLayers.monuments ? 'active-teal' : ''}`}
          onClick={() => toggleLayer('monuments')}
          style={{ justifyContent: 'flex-start', padding: '12px 16px' }}
        >
          <Flag size={18} color={activeLayers.monuments ? "#ffffff" : "#14b8a6"} />
          Statues & Memorials
        </button>

        <button 
          className={`glass-button ${activeLayers.embassies ? 'active-red' : ''}`}
          onClick={() => toggleLayer('embassies')}
          style={{ justifyContent: 'flex-start', padding: '12px 16px' }}
        >
          <Globe size={18} color={activeLayers.embassies ? "#ffffff" : "#ef4444"} />
          Embassies & Consulates
        </button>

        <button 
          className={`glass-button ${activeLayers.historical ? 'active-amber' : ''}`}
          onClick={() => toggleLayer('historical')}
          style={{ justifyContent: 'flex-start', padding: '12px 16px' }}
        >
          <History size={18} color={activeLayers.historical ? "#ffffff" : "#fbbf24"} />
          Historical Data
        </button>

        <button 
          className={`glass-button ${activeLayers.parks ? 'active-green' : ''}`}
          onClick={() => toggleLayer('parks')}
          style={{ justifyContent: 'flex-start', padding: '12px 16px' }}
        >
          <TreePine size={18} color={activeLayers.parks ? "#ffffff" : "#4ade80"} />
          Parks
        </button>

        <button 
          className={`glass-button ${activeLayers.squares ? 'active-skyblue' : ''}`}
          onClick={() => toggleLayer('squares')}
          style={{ justifyContent: 'flex-start', padding: '12px 16px' }}
        >
          <CircleDot size={18} color={activeLayers.squares ? "#ffffff" : "#38bdf8"} />
          Squares & Circles
        </button>

        <button 
          className={`glass-button ${activeLayers.floodZones ? 'active-blue' : ''}`}
          onClick={() => toggleLayer('floodZones')}
          style={{ justifyContent: 'flex-start', padding: '12px 16px' }}
        >
          <Waves size={18} color={activeLayers.floodZones ? "#ffffff" : "#3b82f6"} />
          Flood Zones
        </button>

        <button 
          className={`glass-button ${activeLayers.topography ? 'active-red' : ''}`}
          onClick={() => toggleLayer('topography')}
          style={{ justifyContent: 'flex-start', padding: '12px 16px' }}
        >
          <Mountain size={18} color={activeLayers.topography ? "#ffffff" : "#ef4444"} />
          Topography
        </button>
      </div>
    </div>
  );
};

export default LayerControls;
