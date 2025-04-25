import '../styles/globals.css';
import '../styles/game.css';

import Toolbar from '../components/Toolbar';
import SolarSystem from '../components/SolarSystem';

export default function GamePage() {
  return (
    <div className="bg-black text-green-300 min-h-screen">
      <Toolbar />
      <main className="p-8 relative top-16 z-50">
        <h1 className="text-2xl mb-4">Millennium 2.2 (Web Remake)</h1>
        <p>Game content goes here!</p>
        <SolarSystem />
      </main>
    </div>
  );
}
// This is the main game page for the Millennium 2.2 web remake. It includes a toolbar at the top and a main content area where game-related information will be displayed. The page is styled with Tailwind CSS classes for a modern look and feel, using a black background and green text to match the game's aesthetic.