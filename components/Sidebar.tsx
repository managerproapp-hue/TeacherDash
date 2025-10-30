import React from 'react';
import { NavItemType } from '../types';
import { NAV_ITEMS } from '../constants';
import { 
    UsersIcon, 
    ClipboardIcon, 
    GradeIcon, 
    AcademicIcon, 
    AppIcon, 
    CodeBracketIcon, 
    DashboardIcon, 
    ExitIcon,
    ChevronDoubleLeftIcon,
    ChevronDoubleRightIcon
} from './icons';

interface SidebarProps {
  activeView: NavItemType;
  setActiveView: (view: NavItemType) => void;
  isSidebarCollapsed: boolean;
  setIsSidebarCollapsed: (collapsed: boolean) => void;
}

const ICONS: Record<NavItemType, React.FC<React.SVGProps<SVGSVGElement>>> = {
  'Dashboard': DashboardIcon,
  'Alumnos': UsersIcon,
  'Gestión Práctica': ClipboardIcon,
  'Gestión de Notas': GradeIcon,
  'Registro de Salidas': ExitIcon,
  'Exámenes Prácticos': ClipboardIcon,
  'Gestión Académica': AcademicIcon,
  'Gestión de la App': AppIcon,
};

export const Sidebar: React.FC<SidebarProps> = ({ activeView, setActiveView, isSidebarCollapsed, setIsSidebarCollapsed }) => {
  return (
    <div className={`bg-gray-800 text-white flex flex-col flex-shrink-0 transition-all duration-300 ease-in-out ${isSidebarCollapsed ? 'w-20' : 'w-64'}`}>
      <div className="p-4 border-b border-gray-700 h-[65px] flex items-center justify-center">
        {isSidebarCollapsed ? (
            <h1 className="text-2xl font-bold text-teal-400">TD</h1>
        ) : (
            <h1 className="text-2xl font-bold">
                <span className="text-teal-400">Teacher</span>Dash
            </h1>
        )}
      </div>
      <nav className="flex-1 p-2 space-y-1 overflow-y-auto overflow-x-hidden">
        {NAV_ITEMS.map((item) => {
            const IconComponent = ICONS[item];
            return (
              <button
                key={item}
                onClick={() => setActiveView(item)}
                title={item}
                className={`w-full flex items-center px-3 py-2 text-left text-sm font-medium rounded-md transition-colors ${
                  activeView === item
                    ? 'bg-gray-900 text-white'
                    : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                } ${isSidebarCollapsed ? 'justify-center' : ''}`}
              >
                <IconComponent className={`h-6 w-6 ${!isSidebarCollapsed ? 'mr-3' : ''}`} />
                {!isSidebarCollapsed && <span>{item}</span>}
              </button>
            );
        })}
      </nav>
      <div className="p-2 border-t border-gray-700">
         <a href="https://github.com/a-romero-for-study/teacher-dashboard" target="_blank" rel="noopener noreferrer" 
            className={`w-full flex items-center px-3 py-2 text-left text-sm font-medium rounded-md transition-colors text-gray-400 hover:bg-gray-700 hover:text-white ${isSidebarCollapsed ? 'justify-center' : ''}`}
            title="Ver código fuente en GitHub"
          >
            <CodeBracketIcon className={`h-6 w-6 ${!isSidebarCollapsed ? 'mr-3' : ''}`} />
            {!isSidebarCollapsed && <span>Ver código</span>}
        </a>
        <button
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className="w-full flex items-center justify-center p-2 text-gray-400 hover:bg-gray-700 hover:text-white rounded-md mt-1"
            title={isSidebarCollapsed ? "Expandir menú" : "Contraer menú"}
        >
            {isSidebarCollapsed ? <ChevronDoubleRightIcon className="h-5 w-5" /> : <ChevronDoubleLeftIcon className="h-5 w-5" />}
        </button>
      </div>
    </div>
  );
};