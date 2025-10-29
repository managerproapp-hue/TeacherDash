import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { Student, Service, PlanningAssignments, StudentGroupAssignments, Role, Elaboracion } from '../types';
import { GroupIcon, CogIcon, ServiceIcon, CalendarIcon, TrashIcon, PlusIcon, ViewGridIcon, CheckIcon, LockClosedIcon, DownloadIcon } from './icons';
import { downloadPlanningPdf, downloadPdfWithTables } from './printUtils';
import { PdfTableConfig } from './printUtils';

// --- HELPER FUNCTIONS ---
const safeJsonParse = <T,>(key: string, defaultValue: T): T => {
    try {
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : defaultValue;
    } catch (error) {
        console.error(`Error parsing JSON from localStorage key "${key}":`, error);
        return defaultValue;
    }
};

const getRandomHexColor = () => {
    // Generates a random pastel color for better readability
    return "hsl(" + 360 * Math.random() + ',' +
               (25 + 70 * Math.random()) + '%,' + 
               (85 + 10 * Math.random()) + '%)';
};

const isColorDark = (hexColor: string) => {
    if (!hexColor) return false;
    let color = hexColor.startsWith('#') ? hexColor.substring(1) : hexColor;
    if (color.length === 3) {
      color = color.split('').map(char => char + char).join('');
    }
    const r = parseInt(color.substring(0, 2), 16);
    const g = parseInt(color.substring(2, 4), 16);
    const b = parseInt(color.substring(4, 6), 16);
    const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    return luma < 128;
};


const uuidv4 = () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
  const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
  return v.toString(16);
});

type SubView = 'grupos' | 'configuracion' | 'servicios' | 'planning' | 'vision';
const GROUP_COLORS = ['#e0f2f1', '#e3f2fd', '#e8f5e9', '#fff8e1', '#fce4ec', '#f3e5f5', '#ede7f6'];

// --- SUB-COMPONENT: Distribución de Grupos ---
const DistribucionGruposView: React.FC<{
    students: Student[];
    practicaGroups: string[];
    setPracticaGroups: React.Dispatch<React.SetStateAction<string[]>>;
    studentAssignments: StudentGroupAssignments;
    setStudentAssignments: React.Dispatch<React.SetStateAction<StudentGroupAssignments>>;
}> = ({ students, practicaGroups, setPracticaGroups, studentAssignments, setStudentAssignments }) => {
    const [searchTerm, setSearchTerm] = useState('');

    const filteredStudents = useMemo(() => {
        return students
            .filter(s => `${s.nombre} ${s.apellido1} ${s.apellido2}`.toLowerCase().includes(searchTerm.toLowerCase()))
            .sort((a, b) => a.apellido1.localeCompare(b.apellido1));
    }, [students, searchTerm]);
    
    const handleAddGroup = () => {
        const newGroupName = `Grupo ${practicaGroups.length + 1}`;
        if (!practicaGroups.includes(newGroupName)) {
            setPracticaGroups(prev => [...prev, newGroupName]);
        }
    };

    const handleDeleteGroup = (groupName: string) => {
        if (window.confirm(`¿Seguro que quieres eliminar "${groupName}"? Los alumnos asignados quedarán libres.`)) {
            setPracticaGroups(prev => prev.filter(g => g !== groupName));
            setStudentAssignments(prev => {
                const newAssignments = { ...prev };
                Object.entries(newAssignments).forEach(([nre, group]) => {
                    if (group === groupName) {
                        delete newAssignments[nre];
                    }
                });
                return newAssignments;
            });
        }
    };

    const handleAssignStudent = (studentNre: string, groupName: string) => {
        setStudentAssignments(prev => ({ ...prev, [studentNre]: groupName }));
    };

    const handleUnassignStudent = (studentNre: string) => {
        setStudentAssignments(prev => {
            const newAssignments = { ...prev };
            delete newAssignments[studentNre];
            return newAssignments;
        });
    };
    
    const handleExportGroupsPdf = () => {
        const tablesForPdf: PdfTableConfig[] = practicaGroups.map(groupName => {
            const members = students.filter(s => studentAssignments[s.nre] === groupName);
            const body = members.length > 0
                ? members.map((member, index) => [
                    index + 1,
                    `${member.apellido1} ${member.apellido2}, ${member.nombre}`,
                    member.nre
                  ])
                : [[{ content: 'Este grupo no tiene alumnos asignados.', colSpan: 3, styles: { halign: 'center', fontStyle: 'italic' } }]];

            return {
                head: [[{ content: groupName, colSpan: 3, styles: { fontStyle: 'bold', fillColor: '#e0e7ff' } }], ['#', 'Nombre Completo', 'NRE']],
                body: body,
                columnStyles: { 0: { cellWidth: 10 }, 1: { cellWidth: 'auto' }, 2: { cellWidth: 30 } },
            };
        });
        
        if (practicaGroups.length === 0) {
            alert("No hay grupos definidos para exportar.");
            return;
        }

        downloadPdfWithTables(
            'Distribución de Grupos y Alumnos',
            'distribucion_grupos',
            tablesForPdf,
            { orientation: 'portrait' }
        );
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold">Distribución de Grupos y Alumnos</h2>
                <div className="flex gap-2">
                    <button onClick={handleAddGroup} className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-lg flex items-center">
                        <PlusIcon className="h-5 w-5 mr-2" /> Añadir Grupo
                    </button>
                    <button onClick={handleExportGroupsPdf} className="bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded-lg flex items-center">
                       <DownloadIcon className="h-5 w-5 mr-2" /> Exportar
                    </button>
                </div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left Column: Students */}
                <div className="bg-white p-4 rounded-lg border">
                    <h3 className="font-bold text-lg mb-3">Alumnos y Participación</h3>
                    <input
                        type="text"
                        placeholder="Buscar alumno..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full px-4 py-2 border rounded-lg mb-3"
                    />
                    <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-2">
                        {filteredStudents.map((student, index) => (
                            <div key={student.nre} className="flex items-center justify-between bg-gray-50 p-2 rounded-md">
                                <div className="flex items-center">
                                    <span className="font-semibold text-gray-500 w-8">{index + 1}.</span>
                                    <img src={student.photoUrl || `https://i.pravatar.cc/150?u=${student.nre}`} className="w-10 h-10 rounded-full mr-3" alt={student.nombre}/>
                                    <div>
                                        <p className="font-semibold text-sm">{student.apellido1} {student.apellido2}, {student.nombre}</p>
                                        <p className="text-xs text-gray-500">{student.grupo}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <select
                                        value={studentAssignments[student.nre] || "sin-grupo"}
                                        onChange={(e) => e.target.value === "sin-grupo" ? handleUnassignStudent(student.nre) : handleAssignStudent(student.nre, e.target.value)}
                                        className="text-sm p-1.5 rounded border bg-white"
                                    >
                                        <option value="sin-grupo">Sin grupo</option>
                                        {practicaGroups.map(g => <option key={g} value={g}>{g}</option>)}
                                    </select>
                                    <button onClick={() => handleUnassignStudent(student.nre)} className="text-gray-400 hover:text-red-600"><TrashIcon className="h-5 w-5"/></button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
                {/* Right Column: Groups */}
                <div className="p-4 rounded-lg">
                    <h3 className="font-bold text-lg mb-3">Vista de Grupos</h3>
                    <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-2">
                        {practicaGroups.map((group, index) => {
                            const members = students.filter(s => studentAssignments[s.nre] === group);
                            const borderColor = GROUP_COLORS[index % GROUP_COLORS.length];
                            return (
                                <div key={group} className="p-4 rounded-lg" style={{ backgroundColor: `${borderColor}40`, borderLeft: `5px solid ${borderColor}` }}>
                                    <div className="flex justify-between items-center mb-2">
                                        <h4 className="font-bold">{group} ({members.length} miembros)</h4>
                                        <button onClick={() => handleDeleteGroup(group)} className="text-gray-500 hover:text-red-600"><TrashIcon className="h-5 w-5"/></button>
                                    </div>
                                    {members.length > 0 ? (
                                        <ul className="text-sm space-y-1">
                                            {members.map(m => <li key={m.nre}>- {m.apellido1}, {m.nombre}</li>)}
                                        </ul>
                                    ) : (
                                        <p className="text-sm text-gray-500 italic">No hay alumnos en este grupo.</p>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
};


// --- SUB-COMPONENT: Configuración ---
const ConfiguracionView: React.FC<{
    leaderRoles: Role[];
    setLeaderRoles: React.Dispatch<React.SetStateAction<Role[]>>;
    secondaryRoles: Role[];
    setSecondaryRoles: React.Dispatch<React.SetStateAction<Role[]>>;
}> = ({ leaderRoles, setLeaderRoles, secondaryRoles, setSecondaryRoles }) => {
    
    const handleRoleChange = (name: string, type: 'leader' | 'secondary', newColor: string) => {
        const setter = type === 'leader' ? setLeaderRoles : setSecondaryRoles;
        setter(prev => prev.map(r => r.name === name ? { ...r, color: newColor } : r));
    };

    const handleAddRole = (type: 'leader' | 'secondary') => {
        const name = prompt(`Nombre del nuevo rol ${type === 'leader' ? 'de líder' : 'secundario'}:`);
        if (name) {
            const newRole: Role = { name, type, color: getRandomHexColor() };
            if (type === 'leader') {
                setLeaderRoles(prev => [...prev, newRole]);
            } else {
                setSecondaryRoles(prev => [...prev, newRole]);
            }
        }
    };

    const handleDeleteRole = (name: string, type: 'leader' | 'secondary') => {
        if (window.confirm(`¿Seguro que quieres eliminar el rol "${name}"?`)) {
            if (type === 'leader') {
                setLeaderRoles(prev => prev.filter(r => r.name !== name));
            } else {
                setSecondaryRoles(prev => prev.filter(r => r.name !== name));
            }
        }
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
                <div className="flex justify-between items-center mb-3">
                    <h3 className="font-bold text-lg">Líderes del Servicio</h3>
                    <button onClick={() => handleAddRole('leader')} className="text-sm bg-blue-100 text-blue-800 font-semibold px-3 py-1 rounded-md hover:bg-blue-200">Añadir</button>
                </div>
                <div className="space-y-2">
                    {leaderRoles.map(role => (
                        <div key={role.name} className="flex justify-between items-center bg-gray-100 p-2 rounded">
                             <div className="flex items-center gap-3">
                                <input 
                                    type="color" 
                                    value={role.color || '#FFFFFF'}
                                    onChange={e => handleRoleChange(role.name, 'leader', e.target.value)}
                                    className="w-8 h-8 p-0 border-none rounded cursor-pointer"
                                />
                                <span>{role.name}</span>
                            </div>
                            <button onClick={() => handleDeleteRole(role.name, 'leader')} className="text-red-500 hover:text-red-700"><TrashIcon className="h-4 w-4"/></button>
                        </div>
                    ))}
                </div>
            </div>
             <div>
                <div className="flex justify-between items-center mb-3">
                    <h3 className="font-bold text-lg">Roles Secundarios</h3>
                    <button onClick={() => handleAddRole('secondary')} className="text-sm bg-blue-100 text-blue-800 font-semibold px-3 py-1 rounded-md hover:bg-blue-200">Añadir</button>
                </div>
                <div className="space-y-2">
                     {secondaryRoles.map(role => (
                        <div key={role.name} className="flex justify-between items-center bg-gray-100 p-2 rounded">
                             <div className="flex items-center gap-3">
                                <input 
                                    type="color" 
                                    value={role.color || '#FFFFFF'}
                                    onChange={e => handleRoleChange(role.name, 'secondary', e.target.value)}
                                    className="w-8 h-8 p-0 border-none rounded cursor-pointer"
                                />
                                <span>{role.name}</span>
                            </div>
                            <button onClick={() => handleDeleteRole(role.name, 'secondary')} className="text-red-500 hover:text-red-700"><TrashIcon className="h-4 w-4"/></button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

interface ServiciosViewProps {
    services: Service[];
    setServices: React.Dispatch<React.SetStateAction<Service[]>>;
    practicaGroups: string[];
    students: Student[];
    planningAssignments: PlanningAssignments;
    studentGroupAssignments: StudentGroupAssignments;
    leaderRoles: Role[];
}

// --- SUB-COMPONENT: Servicios ---
const ServiciosView: React.FC<ServiciosViewProps> = ({ 
    services, 
    setServices, 
    practicaGroups, 
    students, 
    planningAssignments, 
    studentGroupAssignments, 
    leaderRoles 
}) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingService, setEditingService] = useState<Service | null>(null);

    const handleOpenModal = (service: Service | null = null) => {
        setEditingService(service);
        setIsModalOpen(true);
    };

    const handleSaveService = (serviceData: Service) => {
        if (editingService) {
            setServices(prev => prev.map(s => s.id === serviceData.id ? serviceData : s));
        } else {
            setServices(prev => [...prev, serviceData]);
        }
        setIsModalOpen(false);
    };
    
    const handleDeleteService = (service: Service) => {
        if (service.finalized) {
            alert("No se puede eliminar un servicio finalizado.");
            return;
        }
        if (window.confirm("¿Seguro que quieres eliminar este servicio? Se borrarán también todas las asignaciones de roles asociadas.")) {
            setServices(prev => prev.filter(s => s.id !== service.id));
        }
    };

    const handleToggleFinalized = (serviceId: string) => {
        setServices(prev => prev.map(s => s.id === serviceId ? {...s, finalized: !s.finalized} : s));
    }
    
    const sortedServices = useMemo(() => [...services].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()), [services]);

    return (
        <div>
            <div className="flex justify-end mb-4">
                <button onClick={() => handleOpenModal()} className="bg-teal-500 hover:bg-teal-600 text-white font-bold py-2 px-4 rounded-lg flex items-center">
                    <PlusIcon className="h-5 w-5 mr-2"/> Nuevo Servicio
                </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {sortedServices.map(s => (
                    <div key={s.id} className={`p-4 rounded-lg shadow-md border ${s.finalized ? 'bg-gray-100' : 'bg-white'}`}>
                        <div className="flex justify-between items-start">
                            <div>
                                <h3 className="font-bold text-lg flex items-center gap-2">{s.name} {s.finalized && <LockClosedIcon className="h-5 w-5 text-gray-500" />}</h3>
                                <p className="text-sm text-gray-500">{new Date(s.date).toLocaleDateString()}</p>
                            </div>
                            <div className="flex flex-col items-end gap-2">
                                <button onClick={() => handleToggleFinalized(s.id)} className={`text-sm font-semibold px-2 py-1 rounded ${s.finalized ? 'bg-yellow-500 text-white' : 'bg-gray-200'}`}>
                                    {s.finalized ? 'Reabrir' : 'Finalizar'}
                                </button>
                                <div>
                                    <button onClick={() => handleOpenModal(s)} disabled={s.finalized} className="text-blue-600 mr-2 disabled:text-gray-400 disabled:cursor-not-allowed">Editar</button>
                                    <button onClick={() => handleDeleteService(s)} disabled={s.finalized} className="text-red-600 disabled:text-gray-400 disabled:cursor-not-allowed">Borrar</button>
                                </div>
                            </div>
                        </div>
                        <div className="mt-3 text-sm">
                            <p><strong>Comedor:</strong> {s.groupAssignments.comedor.join(', ') || 'N/A'}</p>
                            <p><strong>Takeaway:</strong> {s.groupAssignments.takeaway.join(', ') || 'N/A'}</p>
                        </div>
                    </div>
                ))}
            </div>
            {isModalOpen && <ServiceModal 
                                service={editingService} 
                                allGroups={practicaGroups} 
                                onSave={handleSaveService} 
                                onClose={() => setIsModalOpen(false)}
                                students={students}
                                planningAssignments={planningAssignments}
                                studentGroupAssignments={studentGroupAssignments}
                                leaderRoles={leaderRoles}
                            />}
        </div>
    );
};

interface ServiceModalProps {
    service: Service | null;
    allGroups: string[];
    onSave: (service: Service) => void;
    onClose: () => void;
    students: Student[];
    planningAssignments: PlanningAssignments;
    studentGroupAssignments: StudentGroupAssignments;
    leaderRoles: Role[];
}


const ServiceModal: React.FC<ServiceModalProps> = ({ 
    service, 
    allGroups, 
    onSave, 
    onClose, 
    students,
    planningAssignments,
    studentGroupAssignments,
    leaderRoles
}) => {
    const [formData, setFormData] = useState<Omit<Service, 'id' | 'elaboraciones'> & { elaboraciones: { comedor: Elaboracion[], takeaway: Elaboracion[] } }>({
        name: service?.name || '',
        date: service?.date ? service.date.split('T')[0] : new Date().toISOString().split('T')[0],
        trimestre: service?.trimestre || 1,
        groupAssignments: service?.groupAssignments || { comedor: [], takeaway: [] },
        elaboraciones: service?.elaboraciones || { comedor: [], takeaway: [] },
        finalized: service?.finalized || false
    });

    const comedorElaboracionNameRef = useRef<HTMLInputElement>(null);
    const comedorElaboracionGroupRef = useRef<HTMLSelectElement>(null);
    const takeawayElaboracionNameRef = useRef<HTMLInputElement>(null);
    const takeawayElaboracionGroupRef = useRef<HTMLSelectElement>(null);


    const handleGroupToggle = (type: 'comedor' | 'takeaway', group: string) => {
        setFormData(prev => {
            const currentAssignments = prev.groupAssignments[type];
            const newAssignments = currentAssignments.includes(group)
                ? currentAssignments.filter(g => g !== group)
                : [...currentAssignments, group];
            return { ...prev, groupAssignments: { ...prev.groupAssignments, [type]: newAssignments } };
        });
    };

    const handleAddElaboracion = (type: 'comedor' | 'takeaway') => {
        const nameRef = type === 'comedor' ? comedorElaboracionNameRef : takeawayElaboracionNameRef;
        const groupRef = type === 'comedor' ? comedorElaboracionGroupRef : takeawayElaboracionGroupRef;

        const name = nameRef.current?.value.trim();
        const assignedGroupId = groupRef.current?.value;

        if (name && assignedGroupId) {
            const newElaboracion: Elaboracion = { id: uuidv4(), name, assignedGroupId };
            setFormData(prev => ({
                ...prev,
                elaboraciones: {
                    ...prev.elaboraciones,
                    [type]: [...(prev.elaboraciones?.[type] || []), newElaboracion]
                }
            }));
            nameRef.current.value = '';
            groupRef.current.value = '';
        } else {
            alert("Por favor, introduce un nombre para la elaboración y asigna un grupo.");
        }
    };

    const handleDeleteElaboracion = (type: 'comedor' | 'takeaway', elaboracionId: string) => {
         setFormData(prev => ({
            ...prev,
            elaboraciones: {
                ...prev.elaboraciones,
                [type]: (prev.elaboraciones?.[type] || []).filter(e => e.id !== elaboracionId)
            }
        }));
    };


    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave({ ...formData, id: service?.id || uuidv4() });
    };

    const handleDownload = () => {
        if (service) {
            downloadPlanningPdf(
                service,
                students,
                planningAssignments,
                studentGroupAssignments,
                leaderRoles
            );
        }
    };

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
        <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl transform transition-all flex flex-col max-h-[90vh]">
          <form onSubmit={handleSubmit} className="flex flex-col flex-1">
            <div className="p-6 flex-1 overflow-y-auto">
                <h2 className="text-2xl font-bold mb-4">{service ? 'Editar' : 'Nuevo'} Servicio</h2>
                <input type="text" placeholder="Nombre (ej. Servicio T1 #1 Comienzo curso)" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required className="w-full p-2 border rounded mb-2" />
                <div className="relative">
                  <input type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} required className="w-full p-2 border rounded mb-2 pr-10" />
                  <CalendarIcon className="absolute right-2 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" style={{top: '1rem'}}/>
                </div>
                 <select value={formData.trimestre} onChange={e => setFormData({...formData, trimestre: parseInt(e.target.value)})} className="w-full p-2 border rounded bg-white mb-4">
                    <option value={1}>1º Trimestre</option>
                    <option value={2}>2º Trimestre</option>
                </select>
                
                <div className="space-y-4">
                    <div>
                        <h4 className="font-semibold mb-1">Asignar Grupos a Comedor:</h4>
                         <div className="flex flex-wrap gap-x-4 gap-y-1">
                            {allGroups.map(g => <label key={g} className="inline-flex items-center"><input type="checkbox" checked={formData.groupAssignments.comedor.includes(g)} onChange={() => handleGroupToggle('comedor', g)} className="mr-1"/>{g}</label>)}
                        </div>
                    </div>
                    <div className="mt-4 pt-3 border-t">
                        <h4 className="font-semibold mb-2">Elaboraciones de Comedor:</h4>
                        <div className="space-y-1 mb-2 text-sm max-h-24 overflow-y-auto pr-2">
                            {(formData.elaboraciones?.comedor || []).map(e => (
                                <div key={e.id} className="flex justify-between items-center bg-gray-100 p-1.5 rounded">
                                    <span><strong>{e.name}</strong> ({e.assignedGroupId})</span>
                                    <button type="button" onClick={() => handleDeleteElaboracion('comedor', e.id)} className="text-red-500 hover:text-red-700 p-1"><TrashIcon className="h-4 w-4" /></button>
                                </div>
                            ))}
                        </div>
                        <div className="flex gap-2 items-center">
                            <input type="text" placeholder="Nombre del plato" ref={comedorElaboracionNameRef} className="flex-grow p-2 border rounded text-sm" />
                            <select ref={comedorElaboracionGroupRef} className="p-2 border rounded bg-white text-sm" defaultValue="">
                                <option value="" disabled>Asignar a...</option>
                                {formData.groupAssignments.comedor.map(g => <option key={g} value={g}>{g}</option>)}
                            </select>
                            <button type="button" onClick={() => handleAddElaboracion('comedor')} className="py-2 px-3 bg-blue-500 text-white rounded text-sm">Añadir</button>
                        </div>
                    </div>
                </div>
                 <div className="space-y-4 mt-6 pt-4 border-t">
                     <div>
                        <h4 className="font-semibold mb-1">Asignar Grupos a Takeaway:</h4>
                         <div className="flex flex-wrap gap-x-4 gap-y-1">
                            {allGroups.map(g => <label key={g} className="inline-flex items-center"><input type="checkbox" checked={formData.groupAssignments.takeaway.includes(g)} onChange={() => handleGroupToggle('takeaway', g)} className="mr-1"/>{g}</label>)}
                        </div>
                    </div>
                     <div className="mt-4 pt-3 border-t">
                        <h4 className="font-semibold mb-2">Elaboraciones de Takeaway:</h4>
                        <div className="space-y-1 mb-2 text-sm max-h-24 overflow-y-auto pr-2">
                             {(formData.elaboraciones?.takeaway || []).map(e => (
                                <div key={e.id} className="flex justify-between items-center bg-gray-100 p-1.5 rounded">
                                    <span><strong>{e.name}</strong> ({e.assignedGroupId})</span>
                                    <button type="button" onClick={() => handleDeleteElaboracion('takeaway', e.id)} className="text-red-500 hover:text-red-700 p-1"><TrashIcon className="h-4 w-4" /></button>
                                </div>
                            ))}
                        </div>
                        <div className="flex gap-2 items-center">
                            <input type="text" placeholder="Nombre del plato" ref={takeawayElaboracionNameRef} className="flex-grow p-2 border rounded text-sm" />
                            <select ref={takeawayElaboracionGroupRef} className="p-2 border rounded bg-white text-sm" defaultValue="">
                                <option value="" disabled>Asignar a...</option>
                                {formData.groupAssignments.takeaway.map(g => <option key={g} value={g}>{g}</option>)}
                            </select>
                            <button type="button" onClick={() => handleAddElaboracion('takeaway')} className="py-2 px-3 bg-blue-500 text-white rounded text-sm">Añadir</button>
                        </div>
                    </div>
                </div>
            </div>
            <div className="bg-gray-100 px-6 py-3 flex justify-between items-center">
                <div>
                    {service && (
                        <button
                            type="button"
                            onClick={handleDownload}
                            className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 flex items-center gap-2 text-sm font-semibold"
                        >
                            <DownloadIcon className="h-5 w-5" />
                            <span>Descargar Planning</span>
                        </button>
                    )}
                </div>
                <div className="flex gap-4">
                    <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400">Cancelar</button>
                    <button type="submit" className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700">Guardar</button>
                </div>
            </div>
          </form>
        </div>
      </div>
    );
};


// --- SUB-COMPONENT: Planning / Visión Total ---
const PlanningGrid: React.FC<{
    students: Student[];
    services: Service[];
    assignments: PlanningAssignments;
    onRoleChange: (serviceId: string, studentNre: string, newRole: string) => void;
    groupBy?: 'group' | 'none';
    studentGroupAssignments?: StudentGroupAssignments;
    leaderRoles: Role[];
    secondaryRoles: Role[];
}> = ({ students, services, assignments, onRoleChange, groupBy = 'none', studentGroupAssignments = {}, leaderRoles, secondaryRoles }) => {
    
    const studentsByGroup = useMemo(() => {
        if (groupBy !== 'group') return [['Todos', students]];
        
        const grouped: { [key: string]: Student[] } = {};
        students.forEach(s => {
            const groupName = studentGroupAssignments[s.nre] || 'Sin Grupo Asignado';
            if (!grouped[groupName]) grouped[groupName] = [];
            grouped[groupName].push(s);
        });
        
        return Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b));
    }, [students, groupBy, studentGroupAssignments]);

    const allRoles = useMemo(() => [...leaderRoles, ...secondaryRoles], [leaderRoles, secondaryRoles]);

    return (
        <div className="overflow-x-auto border border-gray-200 rounded-lg max-h-[75vh]">
            <table className="min-w-full divide-y divide-gray-200 text-sm border-separate" style={{ borderSpacing: 0 }}>
                <thead className="bg-gray-50 sticky top-0 z-20">
                    <tr>
                        <th className="sticky left-0 bg-gray-50 px-3 py-3 text-left font-semibold text-gray-600 z-30 border-b border-r">Alumno</th>
                        {services.map(service => {
                             const getGroupWithDishesText = (groupType: 'comedor' | 'takeaway'): string => {
                                const groups = service.groupAssignments[groupType];
                                if (!groups || groups.length === 0) return 'N/A';
                                return groups.map(groupName => {
                                    const dishes = (service.elaboraciones?.[groupType] || [])
                                        .filter(e => e.assignedGroupId === groupName)
                                        .map(e => e.name);
                                    if (dishes.length > 0) {
                                        return `${groupName} (${dishes.join(', ')})`;
                                    }
                                    return groupName;
                                }).join('; ');
                            };

                            return (
                                <th key={service.id} className="px-3 py-3 text-center font-semibold text-gray-600 whitespace-nowrap border-b border-r">
                                    {service.finalized && <LockClosedIcon className="h-4 w-4 inline-block mr-1 text-gray-400" />}
                                    {service.name} <br />
                                    <span className="font-normal text-xs">{new Date(service.date).toLocaleDateString()}</span>
                                    {groupBy === 'group' && (
                                         <div className="mt-1 flex flex-col items-center gap-1 text-xs">
                                            <div className="bg-teal-100 text-teal-800 px-2 py-0.5 rounded-full font-medium w-full max-w-[200px] truncate" title={`Comedor: ${getGroupWithDishesText('comedor')}`}>
                                                C: {getGroupWithDishesText('comedor')}
                                            </div>
                                            <div className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full font-medium w-full max-w-[200px] truncate" title={`Takeaway: ${getGroupWithDishesText('takeaway')}`}>
                                                T: {getGroupWithDishesText('takeaway')}
                                            </div>
                                        </div>
                                    )}
                                </th>
                            );
                        })}
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                    {studentsByGroup.map(([groupName, groupStudents]) => (
                        <React.Fragment key={groupName}>
                            {groupBy === 'group' && (
                                <tr>
                                    <td colSpan={services.length + 1} className="sticky left-0 px-4 py-2 bg-gray-100 text-sm font-bold text-gray-700 z-10">{groupName}</td>
                                </tr>
                            )}
                            {groupStudents.map(student => (
                                <tr key={student.nre} className="hover:bg-gray-50">
                                    <td className="sticky left-0 bg-white hover:bg-gray-50 px-3 py-2 font-medium text-gray-800 whitespace-nowrap z-10 border-b border-r">
                                        {student.apellido1} {student.apellido2}, {student.nombre}
                                    </td>
                                    {services.map(service => {
                                        const currentRole = assignments[service.id]?.[student.nre] || "Sin asignar";
                                        const roleObject = allRoles.find(r => r.name === currentRole);
                                        const roleColor = roleObject?.color || '';

                                        return (
                                            <td key={service.id} className="px-2 py-1 border-b border-r">
                                                <select
                                                    value={currentRole}
                                                    onChange={e => onRoleChange(service.id, student.nre, e.target.value)}
                                                    disabled={service.finalized}
                                                    className="w-full p-1.5 border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-teal-500 disabled:bg-gray-100"
                                                    style={{ 
                                                        backgroundColor: service.finalized ? '' : roleColor,
                                                        color: roleColor && isColorDark(roleColor) ? 'white' : 'black'
                                                    }}
                                                >
                                                    <option value="Sin asignar">Sin asignar</option>
                                                    <optgroup label="Líderes del Servicio">
                                                        {leaderRoles.map(role => <option key={role.name} value={role.name}>{role.name}</option>)}
                                                    </optgroup>
                                                    <optgroup label="Roles Secundarios">
                                                        {secondaryRoles.map(role => <option key={role.name} value={role.name}>{role.name}</option>)}
                                                    </optgroup>
                                                </select>
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </React.Fragment>
                    ))}
                </tbody>
            </table>
        </div>
    );
};


// --- MAIN VIEW COMPONENT ---
const GestionPracticaView: React.FC<{ students: Student[] }> = ({ students }) => {
    const [activeSubView, setActiveSubView] = useState<SubView>('grupos');
    
    // States for each module
    const [practicaGroups, setPracticaGroups] = useState<string[]>(() => safeJsonParse('practicaGroups', ['Grupo 1', 'Grupo 2', 'Grupo 3', 'Grupo 4']));
    const [studentGroupAssignments, setStudentGroupAssignments] = useState<StudentGroupAssignments>(() => safeJsonParse('studentGroupAssignments', {}));
    const [services, setServices] = useState<Service[]>(() => safeJsonParse('practicaServices', []));
    const [planningAssignments, setPlanningAssignments] = useState<PlanningAssignments>(() => safeJsonParse('planningAssignments', {}));
    const [leaderRoles, setLeaderRoles] = useState<Role[]>(() => safeJsonParse('practicaLeaderRoles', [{ name: "Jefe de Cocina", type: 'leader', color: '#FFADAD' }, { name: "2º Jefe de Cocina", type: 'leader', color: '#FFD6A5' }, { name: "2º Jefe de Takeaway", type: 'leader', color: '#FDFFB6' }]));
    const [secondaryRoles, setSecondaryRoles] = useState<Role[]>(() => safeJsonParse('practicaSecondaryRoles', [{ name: "Jefe de Partida", type: 'secondary', color: '#CAFFBF' }, { name: "Cocinero", type: 'secondary', color: '#9BF6FF' }, { name: "Ayudante", type: 'secondary', color: '#A0C4FF' }, { name: "Sin servicio 1", type: 'secondary', color: '#BDB2FF' }, { name: "Sin servicio 2", type: 'secondary', color: '#FFC6FF' }]));
    
    const [selectedServiceForPdf, setSelectedServiceForPdf] = useState<string>('');

    // Automatic saving effects
    useEffect(() => { localStorage.setItem('practicaGroups', JSON.stringify(practicaGroups)); }, [practicaGroups]);
    useEffect(() => { localStorage.setItem('studentGroupAssignments', JSON.stringify(studentGroupAssignments)); }, [studentGroupAssignments]);
    useEffect(() => { localStorage.setItem('practicaServices', JSON.stringify(services)); }, [services]);
    useEffect(() => { localStorage.setItem('planningAssignments', JSON.stringify(planningAssignments)); }, [planningAssignments]);
    useEffect(() => { localStorage.setItem('practicaLeaderRoles', JSON.stringify(leaderRoles)); }, [leaderRoles]);
    useEffect(() => { localStorage.setItem('practicaSecondaryRoles', JSON.stringify(secondaryRoles)); }, [secondaryRoles]);
    
    useEffect(() => {
        if (!selectedServiceForPdf && services.length > 0) {
            setSelectedServiceForPdf(services[0].id);
        }
    }, [services, selectedServiceForPdf]);


    const handleRoleChange = (serviceId: string, studentNre: string, newRole: string) => {
      setPlanningAssignments(prev => {
          const newAssignments = JSON.parse(JSON.stringify(prev)); // Deep copy
          const serviceAssignments = newAssignments[serviceId] || {};
          
          if (leaderRoles.some(r => r.name === newRole)) {
              Object.keys(serviceAssignments).forEach(nre => {
                  if (serviceAssignments[nre] === newRole) {
                      delete serviceAssignments[nre];
                  }
              });
          }
          
          if (newRole === "Sin asignar") {
              delete serviceAssignments[studentNre];
          } else {
              serviceAssignments[studentNre] = newRole;
          }
          
          newAssignments[serviceId] = serviceAssignments;
          return newAssignments;
      });
    };
    
    const sortedStudents = useMemo(() => [...students].sort((a, b) => 
        `${a.apellido1} ${a.apellido2} ${a.nombre}`.localeCompare(`${b.apellido1} ${b.apellido2} ${b.nombre}`)), 
    [students]);

    const sortedServices = useMemo(() => [...services].sort((a, b) => 
        new Date(a.date).getTime() - new Date(b.date).getTime()),
    [services]);

    const handleDownloadClick = () => {
        const service = services.find(s => s.id === selectedServiceForPdf);
        if (service) {
            downloadPlanningPdf(service, students, planningAssignments, studentGroupAssignments, leaderRoles);
        } else {
            alert("Por favor, selecciona un servicio válido para descargar.");
        }
    };

    const renderContent = () => {
        const planningViews = ['planning', 'vision'];
        const content = (() => {
            switch (activeSubView) {
                case 'grupos':
                    return <DistribucionGruposView students={sortedStudents} practicaGroups={practicaGroups} setPracticaGroups={setPracticaGroups} studentAssignments={studentGroupAssignments} setStudentAssignments={setStudentGroupAssignments} />;
                case 'servicios':
                    return <ServiciosView 
                                services={services} 
                                setServices={setServices} 
                                practicaGroups={practicaGroups}
                                students={sortedStudents}
                                planningAssignments={planningAssignments}
                                studentGroupAssignments={studentGroupAssignments}
                                leaderRoles={leaderRoles}
                            />;
                case 'planning':
                case 'vision':
                     return <PlanningGrid students={sortedStudents} services={sortedServices} assignments={planningAssignments} onRoleChange={handleRoleChange} leaderRoles={leaderRoles} secondaryRoles={secondaryRoles} groupBy={activeSubView === 'vision' ? 'group' : 'none'} studentGroupAssignments={studentGroupAssignments} />;
                case 'configuracion':
                    return <ConfiguracionView leaderRoles={leaderRoles} setLeaderRoles={setLeaderRoles} secondaryRoles={secondaryRoles} setSecondaryRoles={setSecondaryRoles} />;
                default:
                    return null;
            }
        })();
        
        return (
            <div className="bg-white p-6 rounded-lg shadow-md">
                 {planningViews.includes(activeSubView) && (
                    <div className="flex justify-end items-center gap-4 mb-4 pb-4 border-b">
                         <select value={selectedServiceForPdf} onChange={e => setSelectedServiceForPdf(e.target.value)} className="p-2 border rounded-md bg-white">
                            <option value="" disabled>Selecciona un servicio</option>
                            {sortedServices.map(s => <option key={s.id} value={s.id}>{s.name} - {new Date(s.date).toLocaleDateString()}</option>)}
                        </select>
                        <button onClick={handleDownloadClick} disabled={!selectedServiceForPdf} className="bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded-lg flex items-center disabled:bg-gray-400">
                            <DownloadIcon className="h-5 w-5 mr-2" /> Descargar Planning
                        </button>
                    </div>
                )}
                {content}
            </div>
        );
    };

    const tabs: { id: SubView, name: string, icon: React.ReactNode }[] = [
        { id: 'grupos', name: 'Distribución de Grupos', icon: <GroupIcon className="h-5 w-5 mr-2" /> },
        { id: 'servicios', name: 'Servicios', icon: <ServiceIcon className="h-5 w-5 mr-2" /> },
        { id: 'planning', name: 'Planning', icon: <CalendarIcon className="h-5 w-5 mr-2" /> },
        { id: 'vision', name: 'Visión Total', icon: <ViewGridIcon className="h-5 w-5 mr-2" /> },
        { id: 'configuracion', name: 'Configuración', icon: <CogIcon className="h-5 w-5 mr-2" /> },
    ];

    return (
        <div className="p-8">
            <header className="mb-6">
                <h1 className="text-3xl font-bold text-gray-800">Gestión Práctica</h1>
                <p className="mt-2 text-gray-600">Organiza los grupos, define los servicios y asigna roles a los alumnos.</p>
            </header>
            
            <div className="mb-6 border-b border-gray-200">
                <nav className="-mb-px flex space-x-6 overflow-x-auto" aria-label="Tabs">
                    {tabs.map(tab => (
                        <button key={tab.id} onClick={() => setActiveSubView(tab.id)}
                            className={`flex items-center whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${
                                activeSubView === tab.id ? 'border-teal-500 text-teal-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                            }`}
                        >
                            {tab.icon} {tab.name}
                        </button>
                    ))}
                </nav>
            </div>

            {renderContent()}
        </div>
    );
};

export default GestionPracticaView;