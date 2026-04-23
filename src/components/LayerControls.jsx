import React, { useState } from 'react';
import { Layers, MapPin, History, Sparkles, Map, ChevronDown, ChevronUp, Eye, EyeOff, TreePine, CircleDot, Landmark, Ticket, Flag, Globe, Search, Waves, Mountain, DollarSign, ShieldAlert, Bike, ArrowLeftRight, GripVertical, Pencil, Check, X, TrainFront } from 'lucide-react';

const initialFilters = [
  { id: 'museums', label: 'Museums', icon: Landmark, color: '#a78bfa', activeClass: 'active-purple' },
  { id: 'events', label: 'Ticketed Events', icon: Ticket, color: '#f472b6', activeClass: 'active-pink' },
  { id: 'monuments', label: 'Statues & Memorials', icon: Flag, color: '#14b8a6', activeClass: 'active-teal' },
  { id: 'embassies', label: 'Embassies & Consulates', icon: Globe, color: '#ef4444', activeClass: 'active-red' },
  { id: 'historical', label: 'Historical Data', icon: History, color: '#fbbf24', activeClass: 'active-amber' },
  { id: 'parks', label: 'Parks', icon: TreePine, color: '#4ade80', activeClass: 'active-green' },
  { id: 'squares', label: 'Squares & Circles', icon: CircleDot, color: '#38bdf8', activeClass: 'active-skyblue' },
  { id: 'floodZones', label: 'Flood Zones', icon: Waves, color: '#3b82f6', activeClass: 'active-blue' },
  { id: 'topography', label: 'Topography', icon: Mountain, color: '#ef4444', activeClass: 'active-red' },
  { id: 'propertyValues', label: 'Average Property Values', icon: DollarSign, color: '#10b981', activeClass: 'active-emerald' },
  { id: 'crime', label: 'Crime Index', icon: ShieldAlert, color: '#e11d48', activeClass: 'active-rose' },
  { id: 'bikeLanes', label: 'Bike Lanes', icon: Bike, color: '#10b981', activeClass: 'active-emerald' },
  { id: 'metro', label: 'Metro', icon: TrainFront, color: '#f87171', activeClass: 'active-red' }
];

const LayerControls = ({ 
  activeLayers, 
  toggleLayer, 
  neighborhoodList = [], 
  hiddenNeighborhoods = new Set(), 
  toggleNeighborhoodVisibility,
  toggleAllNeighborhoodsVisibility,
  searchQuery,
  setSearchQuery,
  isLeftAligned,
  setIsLeftAligned
}) => {
  const [isNeighborhoodsExpanded, setIsNeighborhoodsExpanded] = useState(false);
  const [isPanelCollapsed, setIsPanelCollapsed] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [filtersOrder, setFiltersOrder] = useState(initialFilters);
  const [draggedItemIndex, setDraggedItemIndex] = useState(null);
  const [dragOverItemIndex, setDragOverItemIndex] = useState(null);

  const handleDragStart = (e, index) => {
    if (!isEditMode) return;
    setDraggedItemIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    setTimeout(() => {
      e.target.style.opacity = '0.5';
    }, 0);
  };

  const handleDragEnter = (e, index) => {
    if (!isEditMode) return;
    setDragOverItemIndex(index);
  };

  const handleDragEnd = (e) => {
    if (!isEditMode) return;
    e.target.style.opacity = '1';
    
    if (draggedItemIndex !== null && dragOverItemIndex !== null && draggedItemIndex !== dragOverItemIndex) {
      const newFilters = [...filtersOrder];
      const draggedItem = newFilters[draggedItemIndex];
      newFilters.splice(draggedItemIndex, 1);
      newFilters.splice(dragOverItemIndex, 0, draggedItem);
      setFiltersOrder(newFilters);
    }
    
    setDraggedItemIndex(null);
    setDragOverItemIndex(null);
  };
  return (
    <div 
      className="glass-panel"
      style={{
        position: 'absolute',
        top: '24px',
        right: isLeftAligned ? 'auto' : '24px',
        left: isLeftAligned ? '24px' : 'auto',
        width: '320px',
        padding: '24px',
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
        transition: 'all 0.3s ease'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: isPanelCollapsed ? '0' : '16px' }}>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
          <Layers size={24} className="text-gradient" />
          <span className="text-gradient">DC Layer Lab</span>
        </h2>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button 
            onClick={() => setIsPanelCollapsed(!isPanelCollapsed)}
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '8px',
              padding: '6px',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            title={isPanelCollapsed ? 'Expand panel' : 'Collapse panel'}
          >
            {isPanelCollapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
          </button>
          <button 
              onClick={() => setIsEditMode(!isEditMode)}
              style={{
                background: isEditMode ? 'rgba(34, 197, 94, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                border: isEditMode ? '1px solid rgba(34, 197, 94, 0.5)' : '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '8px',
                padding: '6px',
                color: isEditMode ? '#4ade80' : 'var(--text-secondary)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              title={isEditMode ? 'Save order' : 'Edit filter order'}
            >
              {isEditMode ? <Check size={16} /> : <Pencil size={16} />}
            </button>
            <button 
              onClick={() => setIsLeftAligned(!isLeftAligned)}
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '8px',
                padding: '6px',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              title={`Move panel to ${isLeftAligned ? 'right' : 'left'}`}
            >
              <ArrowLeftRight size={16} />
            </button>
          </div>
        </div>

        {!isPanelCollapsed && (
          <>
            <div style={{ position: 'relative' }}>
          <Search size={16} color="var(--text-secondary)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
          <input 
            type="text" 
            placeholder="Search active layers..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 36px 10px 36px',
              borderRadius: '8px',
              border: '1px solid var(--border-glass)',
              background: 'rgba(255, 255, 255, 0.8)',
              color: 'var(--text-primary)',
              fontSize: '14px',
              outline: 'none',
              boxSizing: 'border-box'
            }}
          />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery('')}
              style={{ 
                position: 'absolute', 
                right: '12px', 
                top: '50%', 
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                padding: 0,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-secondary)'
              }}
              title="Clear search"
            >
              <X size={16} />
            </button>
          )}
        </div>
            
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '20px' }}>
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

        {filtersOrder.map((filter, index) => {
          const isActive = activeLayers[filter.id];
          const isDraggingOver = dragOverItemIndex === index;
          const Icon = filter.icon;
          
          return (
            <div
              key={filter.id}
              draggable={isEditMode}
              onDragStart={(e) => handleDragStart(e, index)}
              onDragEnter={(e) => handleDragEnter(e, index)}
              onDragEnd={handleDragEnd}
              onDragOver={(e) => e.preventDefault()}
              style={{
                position: 'relative',
                transform: isDraggingOver && isEditMode && draggedItemIndex !== index ? (draggedItemIndex > index ? 'translateY(-4px)' : 'translateY(4px)') : 'translateY(0)',
                transition: 'transform 0.2s cubic-bezier(0.2, 0.8, 0.2, 1)',
                zIndex: isDraggingOver ? 10 : 1
              }}
            >
              <button 
                className={`glass-button ${isActive ? filter.activeClass : ''}`}
                onClick={() => !isEditMode && toggleLayer(filter.id)}
                style={{ 
                  justifyContent: 'flex-start', 
                  padding: '12px 16px',
                  width: '100%',
                  cursor: isEditMode ? 'grab' : 'pointer',
                  border: isEditMode && isDraggingOver && draggedItemIndex !== index ? '1px dashed var(--accent-primary)' : ''
                }}
              >
                {isEditMode && (
                  <GripVertical size={16} color="var(--text-secondary)" style={{ marginRight: '4px', cursor: 'grab' }} />
                )}
                <Icon size={18} color={isActive ? "#ffffff" : filter.color} />
                {filter.label}
              </button>
            </div>
          );
        })}
            </div>
          </>
        )}
    </div>
  );
};

export default LayerControls;
