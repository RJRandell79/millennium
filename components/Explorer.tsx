import React, { useState } from 'react';
import SolarSystem from './SolarSystem';
import PlanetView from './PlanetView';
import { PlanetData } from '@/data/planets';

const Explorer: React.FC = () => {
  const [currentView, setCurrentView] = useState<'solar-system' | 'planet'>('solar-system');
  const [selectedPlanet, setSelectedPlanet] = useState<PlanetData | null>(null);

  const handlePlanetClick = (planetData: PlanetData) => {
    setSelectedPlanet(planetData);
    setCurrentView('planet');
  };

  const handleBackToSolarSystem = () => {
    setCurrentView('solar-system');
    setSelectedPlanet(null);
  };

  return (
    <div style={{ position: 'absolute', top: '0', right: '0', bottom: '0', left: '0', width: '100vw', height: 'calc(100vh - 64px)' }}>
      {currentView === 'solar-system' && (
        <SolarSystem onPlanetClick={handlePlanetClick} />
      )}
      {currentView === 'planet' && selectedPlanet && (
        <PlanetView 
          planetData={selectedPlanet} 
          onBack={handleBackToSolarSystem}
        />
      )}
    </div>
  );
};

export default Explorer;