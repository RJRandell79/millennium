'use client';

import { useState, useEffect } from 'react';
import { Tooltip } from 'react-tooltip';

import { FaCogs, FaForward, FaPlay, FaRegLightbulb } from 'react-icons/fa';
import { IoIosHelpCircle, IoIosRocket, IoIosPlanet, IoLogoIonic } from 'react-icons/io';
import { IoHome } from "react-icons/io5";
import { GiSave, GiLoad } from "react-icons/gi";
import { CiMemoPad } from "react-icons/ci";

const IconButton = ({ tooltipId, tooltipContent, icon: Icon, size }: { tooltipId: string; tooltipContent: string; icon: React.ElementType; size: number }) => (
    <button className="hover:text-white" data-tooltip-id={tooltipId} data-tooltip-content={tooltipContent} aria-label={tooltipContent}>
      <Icon size={size} />
    </button>
);

const Toolbar = () => {
    const [dateTime, setDateTime] = useState<string>('');

    const updateDateTime = () => {
        const now = new Date();
        const formattedTime = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const formattedDate = now.toLocaleDateString();
        setDateTime(`${formattedDate} ${formattedTime}`);
    };
    
    useEffect(() => {
        updateDateTime();
        const interval = setInterval(updateDateTime, 1000);

        return () => clearInterval(interval);
    }, []);

    return (
        <div className="bg-gray-800 text-green-300 p-4 flex items-center justify-between fixed top-0 left-0 right-0 z-50">
            <div className="space-x-6 flex items-center">
                <IconButton tooltipId="moon-tooltip" tooltipContent="Moon Colony" icon={IoHome} size={24} />
                <IconButton tooltipId="other-tooltip" tooltipContent="Other Colonies" icon={IoIosPlanet} size={36} />
                <IconButton tooltipId="ship-tooltip" tooltipContent="Ship Roster" icon={IoIosRocket} size={24} />
                <IconButton tooltipId="solar-tooltip" tooltipContent="Solar System Roster" icon={IoLogoIonic} size={32} />
                <IconButton tooltipId="research-tooltip" tooltipContent="Research" icon={FaRegLightbulb} size={24} />
                <IconButton tooltipId="event-tooltip" tooltipContent="Event Log" icon={CiMemoPad} size={28} />
            </div>
            <div className="space-x-6 flex items-center">
                <IconButton tooltipId="save-tooltip" tooltipContent="Save Game" icon={GiSave} size={24} />
                <IconButton tooltipId="load-tooltip" tooltipContent="Load Game" icon={GiLoad} size={24} />
                <IconButton tooltipId="hour-tooltip" tooltipContent="Advance Hour" icon={FaPlay} size={22} />
                <IconButton tooltipId="day-tooltip" tooltipContent="Advance Day" icon={FaForward} size={28} />
                <IconButton tooltipId="settings-tooltip" tooltipContent="Settings" icon={FaCogs} size={24} />
                <IconButton tooltipId="help-tooltip" tooltipContent="Help" icon={IoIosHelpCircle} size={24} />
                <div className="text-green-300 ml-6">{dateTime}</div>
            </div>

            <Tooltip id="moon-tooltip" place="right" style={{ backgroundColor: "oklch(87.1% 0.15 154.449)", color: "#000" }} />
            <Tooltip id="other-tooltip" place="bottom" style={{ backgroundColor: "oklch(87.1% 0.15 154.449)", color: "#000" }} />
            <Tooltip id="ship-tooltip" place="bottom" style={{ backgroundColor: "oklch(87.1% 0.15 154.449)", color: "#000" }} />
            <Tooltip id="solar-tooltip" place="bottom" style={{ backgroundColor: "oklch(87.1% 0.15 154.449)", color: "#000" }} />
            <Tooltip id="research-tooltip" place="bottom" style={{ backgroundColor: "oklch(87.1% 0.15 154.449)", color: "#000" }} />
            <Tooltip id="event-tooltip" place="bottom" style={{ backgroundColor: "oklch(87.1% 0.15 154.449)", color: "#000" }} />
            <Tooltip id="save-tooltip" place="bottom" style={{ backgroundColor: "oklch(87.1% 0.15 154.449)", color: "#000" }} />
            <Tooltip id="load-tooltip" place="bottom" style={{ backgroundColor: "oklch(87.1% 0.15 154.449)", color: "#000" }} />
            <Tooltip id="hour-tooltip" place="bottom" style={{ backgroundColor: "oklch(87.1% 0.15 154.449)", color: "#000" }} />
            <Tooltip id="day-tooltip" place="bottom" style={{ backgroundColor: "oklch(87.1% 0.15 154.449)", color: "#000" }} />
            <Tooltip id="settings-tooltip" place="bottom" style={{ backgroundColor: "oklch(87.1% 0.15 154.449)", color: "#000" }} />
            <Tooltip id="help-tooltip" place="bottom" style={{ backgroundColor: "oklch(87.1% 0.15 154.449)", color: "#000" }} />
        </div>
    );
};

export default Toolbar;

// This component is a toolbar for the Millennium 2.2 web remake. It includes buttons for various game functions, each with a tooltip for additional context. The toolbar is styled with Tailwind CSS and uses react-icons for the icons. The tooltips are provided by the react-tooltip library, which enhances user experience by providing quick information on hover.