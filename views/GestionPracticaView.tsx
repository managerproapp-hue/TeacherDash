
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Service, ServiceEvaluation, Student } from '../types';
import { PlusIcon, TrashIcon, SaveIcon, ChefHatIcon, LockClosedIcon, LockOpenIcon } from '../components/icons';
import { useAppContext } from '../context/AppContext';
import ServiceEvaluationView from './ServiceEvaluationView';

// --- Reusable Sub-Components ---
const TabButton: React.FC<{ label: string; isActive: boolean; onClick: () => void; }> = ({ label, isActive, onClick }) => (
    <button onClick={onClick} className={`px-4 py-2 font-medium text-sm rounded-md transition-colors ${isActive ? 'bg-blue-100 text-blue-600' : 'text-gray-500 hover:bg-gray-100'}`}>
        {label}
    </button>
);

// --- Planning View Component (adapted from pages/DistribucionGrupos) ---
const ServicePlanningView: React.FC<{
    editedService: Service;
    setEditedService: React.Dispatch<React.SetStateAction<Service | null>>;
}> = ({ editedService, setEditedService }) => {
    
    const { students, practiceGroups, serviceRoles } = useAppContext();
    const [activeSubTab, setActiveSubTab] = useState('distribucion');

    const handleServiceFieldChange = (field: keyof Service, value: any) => {
        setEditedService(prev => prev ? { ...prev, [field]: value } : null);
    };
    
    const toggleGroupAssignment = (area: 'comedor' | 'takeaway', groupId: string) => {
        if (!editedService) return;
        
        const currentAssignments = editedService.assignedGroups[area];
        const newAssignments = currentAssignments.includes(groupId)
            ? currentAssignments.filter(id => id !== groupId)
            : [...currentAssignments, groupId];
            
        setEditedService({
            ...editedService,
            assignedGroups: {
                ...editedService.assignedGroups,
                [area]: newAssignments,
            }
        });
    };

    const studentsInService = useMemo(() => {
        if (!editedService) return [];
        const assignedGroupIds = [
            ...editedService.assignedGroups.comedor,
            ...editedService.assignedGroups.takeaway,
        ];
        const assignedGroups = practiceGroups.filter(g => assignedGroupIds.includes(g.id));
        const studentIdsInService = new Set(assignedGroups.flatMap(g => g.studentIds));
        return students.filter(s => studentIdsInService.has(s.id))
                       .sort((a,b) => a.apellido1.localeCompare(b.apellido1));
    }, [editedService, practiceGroups, students]);
    
    const handleStudentRoleChange = (studentId: string, roleId: string | null) => {
        if (!editedService) return;
        const existingAssignmentIndex = editedService.studentRoles.findIndex(sr => sr.studentId === studentId);
        const newStudentRoles = [...editedService.studentRoles];

        if (roleId === null || roleId === '') {
            if (existingAssignmentIndex > -1) newStudentRoles.splice(existingAssignmentIndex, 1);
        } else {
             if (existingAssignmentIndex > -1) newStudentRoles[existingAssignmentIndex] = { studentId, roleId };
             else newStudentRoles.push({ studentId, roleId });
        }
        handleServiceFieldChange('studentRoles', newStudentRoles);
    };

    return (
        <div>
            <div className="border-b border-gray-200 mb-6">
                <nav className="flex space-x-2">
                    <TabButton label="Distribución de Grupos" isActive={activeSubTab === 'distribucion'} onClick={() => setActiveSubTab('distribucion')} />
                    <TabButton label="Asignar Puestos" isActive={activeSubTab === 'puestos'} onClick={() => setActiveSubTab('puestos')} />
                </nav>
            </div>
            {activeSubTab === 'distribucion' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {(['comedor', 'takeaway'] as const).map(area => (
                        <div key={area} className="bg-white p-4 rounded-lg shadow-sm">
                            <h3 className="text-lg font-bold mb-3 capitalize text-gray-700">{area}</h3>
                            <div className="space-y-2">
                                {practiceGroups.map(group => (
                                    <label key={group.id} className="flex items-center p-3 rounded-md hover:bg-gray-50 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={editedService.assignedGroups[area].includes(group.id)}
                                            onChange={() => toggleGroupAssignment(area, group.id)}
                                            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                            disabled={editedService.isLocked}
                                        />
                                        <span className="ml-3 text-sm font-medium text-gray-800">{group.name}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}
            {activeSubTab === 'puestos' && (
                 <div className="bg-white p-4 rounded-lg shadow-sm">
                     <h3 className="text-lg font-bold mb-3 text-gray-700">Puestos de Alumnos en Servicio</h3>
                     <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-4 py-2 text-left font-semibold text-gray-600">Alumno</th>
                                    <th className="px-4 py-2 text-left font-semibold text-gray-600">Puesto</th>
                                </tr>
                            </thead>
                            <tbody>
                                {studentsInService.map(student => {
                                    const assignment = editedService.studentRoles.find(sr => sr.studentId === student.id);
                                    return (
                                        <tr key={student.id} className="border-b hover:bg-gray-50">
                                            <td className="px-4 py-2 font-medium text-gray-800">{`${student.apellido1} ${student.apellido2}, ${student.nombre}`}</td>
                                            <td className="px-4 py-2">
                                                <select
                                                    value={assignment?.roleId || ''}
                                                    onChange={e => handleStudentRoleChange(student.id, e.target.value || null)}
                                                    className="w-full p-1.5 border-gray-300 rounded-md shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                                                    disabled={editedService.isLocked}
                                                >
                                                    <option value="">Sin asignar</option>
                                                    {serviceRoles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                                                </select>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                     </div>
                </div>
            )}
        </div>
    );
};


// --- Main View Component ---
interface GestionPracticaViewProps {
    initialServiceId: string | null;
    initialServiceTab: 'planning' | 'evaluation' | null;
    clearInitialServiceContext: () => void;
}

const GestionPracticaView: React.FC<GestionPracticaViewProps> = ({ initialServiceId, initialServiceTab, clearInitialServiceContext }) => {
    const { 
        students, practiceGroups, services, serviceEvaluations, entryExitRecords,
        handleSaveServiceAndEvaluation, handleDeleteService, handleCreateService,
    } = useAppContext();

    const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
    const [editedService, setEditedService] = useState<Service | null>(null);
    const [editedEvaluation, setEditedEvaluation] = useState<ServiceEvaluation | null>(null);
    const [activeTab, setActiveTab] = useState<'planning' | 'evaluation'>('planning');

    useEffect(() => {
        if (initialServiceId) {
            setSelectedServiceId(initialServiceId);
            setActiveTab(initialServiceTab || 'planning');
            clearInitialServiceContext();
        }
    }, [initialServiceId, initialServiceTab, clearInitialServiceContext]);

    useEffect(() => {
        if (selectedServiceId) {
            const service = services.find(s => s.id === selectedServiceId);
            const evaluation = serviceEvaluations.find(e => e.serviceId === selectedServiceId);
            setEditedService(service ? JSON.parse(JSON.stringify(service)) : null);
            setEditedEvaluation(evaluation ? JSON.parse(JSON.stringify(evaluation)) : null);
        } else {
            setEditedService(null);
            setEditedEvaluation(null);
        }
    }, [selectedServiceId, services, serviceEvaluations]);
    
    const handleCreateServiceClick = () => {
        const newServiceId = handleCreateService();
        setSelectedServiceId(newServiceId);
        setActiveTab('planning');
    };

    const handleDeleteServiceClick = () => {
        if (editedService && window.confirm(`¿Estás seguro de que quieres eliminar el servicio "${editedService.name}" y todas sus evaluaciones? Esta acción no se puede deshacer.`)) {
            handleDeleteService(editedService.id);
            setSelectedServiceId(null);
        }
    };
    
    const handleSave = () => {
        if (editedService && editedEvaluation) {
            handleSaveServiceAndEvaluation(editedService, editedEvaluation);
        }
    };

    const handleToggleLock = () => {
        if (editedService) {
            const updatedService = { ...editedService, isLocked: !editedService.isLocked };
            setEditedService(updatedService);
        }
    }
    
    const sortedServices = useMemo(() =>
        [...services].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
        [services]
    );
    
    const renderWorkspace = () => {
        if (!editedService || !editedEvaluation) {
             return (
                <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                        <ChefHatIcon className="mx-auto h-16 w-16 text-gray-300" />
                        <h2 className="mt-4 text-xl font-semibold text-gray-700">Selecciona un servicio o crea uno nuevo</h2>
                        <p className="mt-1 text-gray-500">Aquí podrás distribuir grupos, asignar puestos y evaluar.</p>
                    </div>
                </div>
            );
        }

        return (
            <div>
                 <header className="flex flex-wrap justify-between items-center gap-4 mb-6 pb-4 border-b">
                    <div>
                        <input
                            type="text"
                            value={editedService.name}
                            onChange={(e) => setEditedService(prev => prev ? { ...prev, name: e.target.value } : null)}
                            className="text-3xl font-bold text-gray-800 bg-transparent focus:bg-white focus:ring-1 focus:ring-blue-500 rounded-md p-1 -ml-1"
                            disabled={editedService.isLocked}
                        />
                         <input
                            type="date"
                            value={editedService.date}
                            onChange={(e) => setEditedService(prev => prev ? { ...prev, date: e.target.value } : null)}
                            className="text-gray-500 mt-1 block bg-transparent focus:bg-white focus:ring-1 focus:ring-blue-500 rounded-md"
                            disabled={editedService.isLocked}
                        />
                    </div>
                    <div className="flex items-center space-x-2">
                         <button onClick={handleToggleLock} className={`flex items-center px-4 py-2 rounded-lg font-semibold transition ${editedService.isLocked ? 'bg-yellow-500 text-white' : 'bg-gray-200'}`}>
                            {editedService.isLocked ? <LockClosedIcon className="w-5 h-5 mr-1" /> : <LockOpenIcon className="w-5 h-5 mr-1" />} {editedService.isLocked ? 'Bloqueado' : 'Abierto'}
                        </button>
                        <button onClick={handleSave} className="flex items-center bg-green-500 text-white px-4 py-2 rounded-lg font-semibold hover:bg-green-600 transition">
                            <SaveIcon className="w-5 h-5 mr-1" /> Guardar
                        </button>
                         <button onClick={handleDeleteServiceClick} className="flex items-center bg-red-500 text-white px-4 py-2 rounded-lg font-semibold hover:bg-red-600 transition">
                            <TrashIcon className="w-5 h-5" />
                        </button>
                    </div>
                </header>

                <div className="bg-white p-2 rounded-lg shadow-sm mb-6">
                    <nav className="flex space-x-1">
                        <button onClick={() => setActiveTab('planning')} className={`flex-1 px-4 py-2 font-semibold text-sm rounded-md transition-colors ${activeTab === 'planning' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>Planificación</button>
                        <button onClick={() => setActiveTab('evaluation')} className={`flex-1 px-4 py-2 font-semibold text-sm rounded-md transition-colors ${activeTab === 'evaluation' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>Evaluación</button>
                    </nav>
                </div>
                
                {activeTab === 'planning' ? (
                    <ServicePlanningView editedService={editedService} setEditedService={setEditedService} />
                ) : (
                    <ServiceEvaluationView
                        service={editedService}
                        evaluation={editedEvaluation}
                        onEvaluationChange={setEditedEvaluation}
                        students={students}
                        practiceGroups={practiceGroups}
                        entryExitRecords={entryExitRecords}
                        isLocked={editedService.isLocked}
                    />
                )}
            </div>
        );
    };

    if (practiceGroups.length === 0 && students.length > 0) {
        return (
            <div className="text-center p-8 bg-white rounded-lg shadow">
                <h2 className="text-2xl font-bold text-gray-700">Primero define los grupos de práctica</h2>
                <p className="text-gray-500 mt-2">No puedes gestionar servicios sin haber creado grupos de alumnos primero.</p>
            </div>
        );
    }
    
    return (
        <div className="flex h-[calc(100vh-140px)]">
            <aside className="w-full md:w-1/3 lg:w-1/4 flex-shrink-0 bg-white p-4 border-r overflow-y-auto">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold text-gray-800">Servicios</h2>
                    <button onClick={handleCreateServiceClick} className="p-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-transform transform hover:scale-110">
                        <PlusIcon className="w-5 h-5" />
                    </button>
                </div>
                <ul className="space-y-2">
                    {sortedServices.map(service => (
                        <li key={service.id}>
                            <a
                                href="#"
                                onClick={(e) => { e.preventDefault(); setSelectedServiceId(service.id); }}
                                className={`block p-3 rounded-lg transition-colors ${selectedServiceId === service.id ? 'bg-blue-100' : 'hover:bg-gray-100'}`}
                            >
                                <p className={`font-semibold ${selectedServiceId === service.id ? 'text-blue-800' : 'text-gray-800'}`}>{service.name}</p>
                                <p className="text-sm text-gray-500">{new Date(service.date + 'T12:00:00Z').toLocaleDateString('es-ES')}</p>
                            </a>
                        </li>
                    ))}
                </ul>
            </aside>
            <main className="flex-1 p-4 sm:p-6 bg-gray-50 overflow-y-auto">
                {renderWorkspace()}
            </main>
        </div>
    );
};

export default GestionPracticaView;
