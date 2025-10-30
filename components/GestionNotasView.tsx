import React, { useState, useMemo, useCallback } from 'react';
import { Student, EvaluationsState, Service, StudentGroupAssignments, GroupEvaluation, IndividualEvaluation, EvaluationItemScore, PreServiceGroupEvaluation, PreServiceIndividualEvaluation, BehaviorScore, PlanningAssignments } from '../types';
import { GROUP_EVALUATION_ITEMS, INDIVIDUAL_EVALUATION_ITEMS, PRE_SERVICE_BEHAVIOR_ITEMS, BEHAVIOR_SCORE_LEVELS } from '../constants';
import { BackIcon, CloseIcon, DownloadIcon } from './icons';
import { exportToExcel, downloadPdfWithTables } from './printUtils';

interface GestionNotasViewProps {
  students: Student[];
  setStudents: React.Dispatch<React.SetStateAction<Student[]>>;
  evaluations: EvaluationsState;
  setEvaluations: React.Dispatch<React.SetStateAction<EvaluationsState>>;
}

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

const calculateScore = (scores: EvaluationItemScore[]): number => {
  if (!scores) return 0;
  return scores.reduce((sum, item) => sum + (item.score || 0), 0);
};

// --- SUB-COMPONENTS ---

const ObservationModal: React.FC<{
    student: Student;
    initialObservation: string;
    onClose: () => void;
    onSave: (studentNre: string, observation: string) => void;
}> = ({ student, initialObservation, onClose, onSave }) => {
    const [observation, setObservation] = useState(initialObservation);
    
    const handleSave = () => {
        onSave(student.nre, observation);
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-lg transform transition-all flex flex-col">
                <div className="p-4 border-b flex justify-between items-center bg-gray-50 rounded-t-lg">
                    <h3 className="text-lg font-bold text-gray-800">Observación para {student.nombre} {student.apellido1}</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <CloseIcon className="h-6 w-6"/>
                    </button>
                </div>
                <div className="p-4">
                    <textarea 
                        value={observation}
                        onChange={e => setObservation(e.target.value)}
                        rows={8}
                        className="w-full p-2 border rounded-md focus:ring-teal-500 focus:border-teal-500"
                        placeholder="Escribe tus anotaciones aquí..."
                        autoFocus
                    />
                </div>
                <div className="p-4 bg-gray-50 flex justify-end gap-3 rounded-b-lg">
                    <button onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300">Cancelar</button>
                    <button onClick={handleSave} className="px-4 py-2 bg-teal-500 text-white font-bold rounded-md hover:bg-teal-600">Guardar</button>
                </div>
            </div>
        </div>
    );
};

interface EvaluationFormProps {
    service: Service;
    students: Student[];
    studentGroupAssignments: StudentGroupAssignments;
    evaluations: EvaluationsState;
    setEvaluations: React.Dispatch<React.SetStateAction<EvaluationsState>>;
    onBack: () => void;
    planningAssignments: PlanningAssignments;
}

const EvaluationForm: React.FC<EvaluationFormProps> = ({ service, students, studentGroupAssignments, evaluations, setEvaluations, onBack, planningAssignments }) => {

    const [activeEvalTab, setActiveEvalTab] = useState<'service' | 'pre-service'>('service');
    const [observationModal, setObservationModal] = useState<{isOpen: boolean; student: Student | null}>({isOpen: false, student: null});
    const [preServiceObservationModal, setPreServiceObservationModal] = useState<{isOpen: boolean; student: Student | null}>({isOpen: false, student: null});


    const assignedGroups = useMemo(() => {
        return [...new Set([...service.groupAssignments.comedor, ...service.groupAssignments.takeaway])]
            .sort((a, b) => a.localeCompare(b));
    }, [service]);
    
    // --- SERVICE DAY HANDLERS ---
    const handleGroupScoreChange = (groupId: string, itemId: string, score: number) => {
        setEvaluations(prev => {
            const newEvals = { ...prev };
            const existingEvalIndex = newEvals.group.findIndex(e => e.serviceId === service.id && e.groupId === groupId);
            
            let targetEval: GroupEvaluation;
            if (existingEvalIndex > -1) {
                targetEval = { ...newEvals.group[existingEvalIndex] };
                newEvals.group[existingEvalIndex] = targetEval;
            } else {
                targetEval = { serviceId: service.id, groupId, scores: [], observation: '' };
                newEvals.group.push(targetEval);
            }

            const scoreIndex = targetEval.scores.findIndex(s => s.itemId === itemId);
            if (scoreIndex > -1) {
                targetEval.scores[scoreIndex] = { itemId, score: isNaN(score) ? 0 : score };
            } else {
                targetEval.scores.push({ itemId, score: isNaN(score) ? 0 : score });
            }
            return newEvals;
        });
    };

    const handleGroupObservationChange = (groupId: string, observation: string) => {
        setEvaluations(prev => {
            const newEvals = { ...prev };
            const existingEvalIndex = newEvals.group.findIndex(e => e.serviceId === service.id && e.groupId === groupId);
             if (existingEvalIndex > -1) {
                newEvals.group[existingEvalIndex] = { ...newEvals.group[existingEvalIndex], observation };
            } else {
                newEvals.group.push({ serviceId: service.id, groupId, scores: [], observation });
            }
            return newEvals;
        });
    };
    
    const handleIndividualAttendanceChange = (studentNre: string, attendance: 'present' | 'absent') => {
        setEvaluations(prev => {
            const newEvals = { ...prev };
            const existingEvalIndex = newEvals.individual.findIndex(e => e.serviceId === service.id && e.studentNre === studentNre);
            if (existingEvalIndex > -1) {
                const updatedEval = { ...newEvals.individual[existingEvalIndex], attendance };
                if (attendance === 'absent') {
                    updatedEval.broughtMaterials = false;
                }
                newEvals.individual[existingEvalIndex] = updatedEval;
            } else {
                newEvals.individual.push({ serviceId: service.id, studentNre, attendance, scores: [], observation: '', broughtMaterials: attendance === 'present' });
            }
            return newEvals;
        });
    };
    
    const handleIndividualScoreChange = (studentNre: string, itemId: string, score: number) => {
         setEvaluations(prev => {
            const newEvals = { ...prev };
            const existingEvalIndex = newEvals.individual.findIndex(e => e.serviceId === service.id && e.studentNre === studentNre);
            
            let targetEval: IndividualEvaluation;
            if (existingEvalIndex > -1) {
                targetEval = { ...newEvals.individual[existingEvalIndex] };
                newEvals.individual[existingEvalIndex] = targetEval;
            } else {
                targetEval = { serviceId: service.id, studentNre, attendance: 'present', scores: [], observation: '', broughtMaterials: true };
                newEvals.individual.push(targetEval);
            }
            
            const scoreIndex = targetEval.scores.findIndex(s => s.itemId === itemId);
            if (scoreIndex > -1) {
                targetEval.scores[scoreIndex] = { itemId, score: isNaN(score) ? 0 : score };
            } else {
                targetEval.scores.push({ itemId, score: isNaN(score) ? 0 : score });
            }
            return newEvals;
        });
    };
    
    const handleSaveObservation = (studentNre: string, observation: string) => {
        setEvaluations(prev => {
            const newEvals = { ...prev };
            const existingEvalIndex = newEvals.individual.findIndex(e => e.serviceId === service.id && e.studentNre === studentNre);
            if (existingEvalIndex > -1) {
                newEvals.individual[existingEvalIndex] = { ...newEvals.individual[existingEvalIndex], observation };
            } else {
                newEvals.individual.push({ serviceId: service.id, studentNre, attendance: 'present', scores: [], observation, broughtMaterials: true });
            }
            return newEvals;
        });
        setObservationModal({ isOpen: false, student: null });
    };


    // --- PRE-SERVICE DAY HANDLERS ---
    const handlePreServiceGroupObservationChange = (groupId: string, observation: string) => {
        setEvaluations(prev => {
            const newEvals = { ...prev };
            const index = newEvals.preServiceGroup.findIndex(e => e.serviceId === service.id && e.groupId === groupId);
            if (index > -1) {
                newEvals.preServiceGroup[index] = { ...newEvals.preServiceGroup[index], observation };
            } else {
                newEvals.preServiceGroup.push({ serviceId: service.id, groupId, observation });
            }
            return newEvals;
        });
    };
    
    const handlePreServiceIndividualAttendanceChange = (studentNre: string, attendance: 'present' | 'absent') => {
        setEvaluations(prev => {
            const newEvals = { ...prev };
            const index = newEvals.preServiceIndividual.findIndex(e => e.serviceId === service.id && e.studentNre === studentNre);
            if (index > -1) {
                const updatedEval = { ...newEvals.preServiceIndividual[index], attendance };
                if (attendance === 'absent') {
                    delete updatedEval.behaviorScores;
                }
                newEvals.preServiceIndividual[index] = updatedEval;
            } else {
                newEvals.preServiceIndividual.push({ serviceId: service.id, studentNre, attendance, observation: '' });
            }
            return newEvals;
        });
    };

    const handlePreServiceBehaviorChange = (studentNre: string, itemId: string, score: BehaviorScore) => {
        setEvaluations(prev => {
            const newEvals = { ...prev };
            const index = newEvals.preServiceIndividual.findIndex(e => e.serviceId === service.id && e.studentNre === studentNre);
            
            let targetEval: PreServiceIndividualEvaluation;
            if (index > -1) {
                targetEval = { ...newEvals.preServiceIndividual[index] };
                newEvals.preServiceIndividual[index] = targetEval;
            } else {
                targetEval = { serviceId: service.id, studentNre, attendance: 'present', observation: '' };
                newEvals.preServiceIndividual.push(targetEval);
            }
    
            if (targetEval.attendance === 'present') {
                const currentScores = targetEval.behaviorScores ? { ...targetEval.behaviorScores } : {};
                
                // Toggle functionality: if same score is clicked, deselect it.
                if (currentScores[itemId] === score) {
                    delete currentScores[itemId];
                } else {
                    currentScores[itemId] = score;
                }
                
                targetEval.behaviorScores = currentScores;
            }
    
            return newEvals;
        });
    };

    const handleSavePreServiceObservation = (studentNre: string, observation: string) => {
        setEvaluations(prev => {
            const newEvals = { ...prev };
            const index = newEvals.preServiceIndividual.findIndex(e => e.serviceId === service.id && e.studentNre === studentNre);
            if (index > -1) {
                newEvals.preServiceIndividual[index] = { ...newEvals.preServiceIndividual[index], observation };
            } else {
                newEvals.preServiceIndividual.push({ serviceId: service.id, studentNre, attendance: 'present', observation });
            }
            return newEvals;
        });
        setPreServiceObservationModal({isOpen: false, student: null});
    };

    const behaviorScoreLevels: { label: string, value: BehaviorScore, className: string, selectedClassName: string }[] = [
        { label: '++', value: 3, className: 'bg-green-500 hover:bg-green-600 text-white', selectedClassName: 'ring-2 ring-offset-1 ring-green-500' },
        { label: '+', value: 2, className: 'bg-green-200 hover:bg-green-300 text-green-800', selectedClassName: 'ring-2 ring-offset-1 ring-green-400' },
        { label: '-', value: 1, className: 'bg-red-500 hover:bg-red-600 text-white', selectedClassName: 'ring-2 ring-offset-1 ring-red-500' }
    ];

    return (
        <div className="bg-white p-6 rounded-lg shadow-md">
            <div className="flex justify-between items-center mb-4">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800">Evaluando: {service.name}</h2>
                    <p className="text-gray-500">{new Date(service.date).toLocaleDateString()}</p>
                </div>
                <button onClick={onBack} className="flex items-center text-teal-600 hover:text-teal-800 font-semibold">
                    <BackIcon className="h-5 w-5 mr-2" />
                    Volver al resumen
                </button>
            </div>
            
             <div className="mb-6 border-b border-gray-200">
                <nav className="-mb-px flex space-x-6" aria-label="Tabs">
                    <button onClick={() => setActiveEvalTab('pre-service')}
                        className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${
                            activeEvalTab === 'pre-service' ? 'border-orange-500 text-orange-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                        }`}
                    >Día Previo al Servicio</button>
                    <button onClick={() => setActiveEvalTab('service')}
                        className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${
                            activeEvalTab === 'service' ? 'border-teal-500 text-teal-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                        }`}
                    >Día de Servicio</button>
                </nav>
            </div>
            
            {activeEvalTab === 'service' && (
                <div className="space-y-12">
                    {/* NEW: Group Evaluation Grid */}
                    <div className="mb-8">
                        <h3 className="text-xl font-bold text-gray-800 mb-4">Evaluación Grupal (Día de Servicio)</h3>
                        <div className="overflow-x-auto border border-gray-200 rounded-lg bg-white">
                            <div className="grid" style={{ gridTemplateColumns: `minmax(300px, 2fr) repeat(${assignedGroups.length}, minmax(180px, 1fr))` }}>
                                {/* Header Row */}
                                <div className="p-3 font-semibold bg-gray-100 border-b border-r text-sm sticky left-0 z-10">Criterio de Evaluación</div>
                                {assignedGroups.map(groupId => {
                                    const isComedor = service.groupAssignments.comedor.includes(groupId);
                                    const isTakeaway = service.groupAssignments.takeaway.includes(groupId);
                                    const bgColor = isComedor ? 'bg-green-50' : isTakeaway ? 'bg-blue-50' : 'bg-gray-100';
                                    const borderColor = isComedor ? 'border-green-200' : isTakeaway ? 'border-blue-200' : 'border-gray-200';
                                    const textColor = isComedor ? 'text-green-800' : isTakeaway ? 'text-blue-800' : 'text-gray-800';
                                    const elaboraciones = [
                                        ...(service.elaboraciones?.comedor?.filter(e => e.assignedGroupId === groupId) || []),
                                        ...(service.elaboraciones?.takeaway?.filter(e => e.assignedGroupId === groupId) || [])
                                    ];
                                    return (
                                        <div key={groupId} className={`p-3 font-semibold text-center border-b border-r ${bgColor} ${borderColor}`}>
                                            <p className={`font-bold text-lg ${textColor}`}>{groupId}</p>
                                            <p className="text-xs font-semibold text-gray-600 mt-1">
                                                {isComedor && 'COMEDOR'}
                                                {isComedor && isTakeaway && ' & '}
                                                {isTakeaway && 'TAKEAWAY'}
                                            </p>
                                            {elaboraciones.length > 0 && (
                                                <ul className="text-xs font-normal text-gray-700 mt-2 list-disc list-inside text-left mx-auto max-w-max">
                                                    {elaboraciones.map(e => <li key={e.id}>{e.name}</li>)}
                                                </ul>
                                            )}
                                        </div>
                                    );
                                })}

                                {/* Rubric Rows */}
                                {GROUP_EVALUATION_ITEMS.map(item => (
                                    <React.Fragment key={item.id}>
                                        <div className="p-3 border-b border-r text-sm flex items-center bg-gray-50 sticky left-0 z-10">{item.text}</div>
                                        {assignedGroups.map(groupId => {
                                            const groupEval = evaluations.group.find(e => e.serviceId === service.id && e.groupId === groupId);
                                            const currentScore = groupEval?.scores.find(s => s.itemId === item.id)?.score ?? '';
                                            return (
                                                <div key={groupId} className="p-3 border-b border-r flex items-center justify-center">
                                                    <input
                                                        type="number"
                                                        value={currentScore}
                                                        onChange={e => handleGroupScoreChange(groupId, item.id, parseFloat(e.target.value))}
                                                        min="0" max={item.points} step="0.01"
                                                        placeholder={`${item.points} pts`}
                                                        className="p-2 border rounded-md w-24 text-center focus:ring-teal-500 focus:border-teal-500"
                                                    />
                                                </div>
                                            )
                                        })}
                                    </React.Fragment>
                                ))}

                                {/* Observation Row */}
                                <div className="p-3 border-r font-semibold text-sm bg-gray-50 sticky left-0 z-10">Observación Grupal</div>
                                {assignedGroups.map(groupId => {
                                    const groupEval = evaluations.group.find(e => e.serviceId === service.id && e.groupId === groupId);
                                    return (
                                        <div key={groupId} className="p-2 border-r">
                                            <textarea 
                                                value={groupEval?.observation || ''}
                                                onChange={e => handleGroupObservationChange(groupId, e.target.value)}
                                                rows={4} className="w-full text-sm mt-1 p-2 border rounded-md focus:ring-teal-500 focus:border-teal-500"></textarea>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    </div>

                    {/* NEW: Individual Evaluation Grids */}
                     <div>
                        <h3 className="text-xl font-bold text-gray-800 mb-4">Evaluaciones Individuales (Día de Servicio)</h3>
                        <div className="space-y-8">
                        {assignedGroups.map(groupId => {
                            const studentsInGroup = students
                                .filter(s => studentGroupAssignments[s.nre] === groupId)
                                .sort((a, b) => `${a.apellido1} ${a.apellido2} ${a.nombre}`.localeCompare(`${b.apellido1} ${b.apellido2} ${b.nombre}`));
                            
                            if (studentsInGroup.length === 0) return null;

                            return (
                            <div key={groupId}>
                                <h4 className="font-semibold text-lg text-gray-700 mb-3 bg-gray-100 p-2 rounded-md">{groupId}</h4>
                                <div className="overflow-x-auto border border-gray-200 rounded-lg bg-white">
                                    <div className="grid" style={{ gridTemplateColumns: `minmax(300px, 2fr) repeat(${studentsInGroup.length}, minmax(150px, 1fr))` }}>
                                        {/* Header Row */}
                                        <div className="p-3 font-semibold bg-gray-100 border-b border-r text-sm sticky left-0 z-10">Criterio Individual</div>
                                        {studentsInGroup.map(student => {
                                            const individualEval = evaluations.individual.find(e => e.serviceId === service.id && e.studentNre === student.nre);
                                            const isPresent = individualEval?.attendance !== 'absent';
                                            const studentRole = planningAssignments[service.id]?.[student.nre];
                                            return (
                                                <div key={student.nre} className="p-2 font-semibold text-center border-b border-r bg-gray-100 flex flex-col items-center justify-between gap-1">
                                                    <img src={student.photoUrl || `https://i.pravatar.cc/150?u=${student.nre}`} className="w-12 h-12 rounded-full border-2 border-white" alt={student.nombre} />
                                                    <p className="text-sm font-bold">{student.apellido1}, {student.nombre.toUpperCase()}</p>
                                                    {studentRole && <span className="text-xs font-bold bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full">{studentRole}</span>}
                                                    <div className="mt-1">
                                                        <label className={`text-xs font-bold px-2 py-1 rounded-full cursor-pointer ${isPresent ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                                            <input type="checkbox" checked={isPresent} onChange={e => handleIndividualAttendanceChange(student.nre, e.target.checked ? 'present' : 'absent')} className="mr-1 h-3 w-3"/>
                                                            {isPresent ? 'Presente' : 'Ausente'}
                                                        </label>
                                                    </div>
                                                </div>
                                            )
                                        })}
                                        
                                        {/* Rubric Rows */}
                                        {INDIVIDUAL_EVALUATION_ITEMS.map(item => (
                                            <React.Fragment key={item.id}>
                                                <div className="p-3 border-b border-r text-sm flex items-center bg-gray-50 sticky left-0 z-10">{item.text}</div>
                                                {studentsInGroup.map(student => {
                                                    const individualEval = evaluations.individual.find(e => e.serviceId === service.id && e.studentNre === student.nre);
                                                    const isPresent = individualEval?.attendance !== 'absent';
                                                    const currentScore = individualEval?.scores.find(s => s.itemId === item.id)?.score ?? '';
                                                    return (
                                                        <div key={student.nre} className="p-3 border-b border-r flex items-center justify-center">
                                                            {isPresent ? (
                                                                <input
                                                                    type="number" value={currentScore}
                                                                    onChange={e => handleIndividualScoreChange(student.nre, item.id, parseFloat(e.target.value))}
                                                                    min="0" max={item.points} step="0.01" placeholder={`${item.points} pts`}
                                                                    className="p-2 border rounded-md w-24 text-center focus:ring-teal-500 focus:border-teal-500"
                                                                />
                                                            ) : (
                                                                <span className="text-xs font-semibold text-red-600">-</span>
                                                            )}
                                                        </div>
                                                    )
                                                })}
                                            </React.Fragment>
                                        ))}

                                        {/* Observation Row */}
                                        <div className="p-3 border-r font-semibold text-sm bg-gray-50 sticky left-0 z-10">Observación Individual</div>
                                        {studentsInGroup.map(student => {
                                             const individualEval = evaluations.individual.find(e => e.serviceId === service.id && e.studentNre === student.nre);
                                             const isPresent = individualEval?.attendance !== 'absent';
                                            return (
                                                <div key={student.nre} className="p-2 border-r flex items-center justify-center">
                                                    {isPresent ? (
                                                        <button 
                                                            onClick={() => setObservationModal({isOpen: true, student})} 
                                                            className="text-sm text-blue-600 hover:text-blue-800 font-semibold bg-blue-50 hover:bg-blue-100 px-3 py-1 rounded-md">
                                                            Añadir/Ver
                                                        </button>
                                                    ) : null}
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>
                            </div>
                            )
                        })}
                        </div>
                    </div>
                </div>
            )}

            {activeEvalTab === 'pre-service' && (
                 <div className="space-y-12">
                     <div className="mb-8">
                         <h3 className="text-xl font-bold text-gray-800 mb-4">Observación Grupal (Día Previo)</h3>
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {assignedGroups.map(groupId => {
                                const preServiceGroupEval = evaluations.preServiceGroup.find(e => e.serviceId === service.id && e.groupId === groupId);
                                return (
                                    <div key={groupId} className="bg-gray-50 p-3 rounded-lg">
                                        <label className="block font-semibold text-gray-700">{groupId}</label>
                                        <textarea 
                                            value={preServiceGroupEval?.observation || ''}
                                            onChange={e => handlePreServiceGroupObservationChange(groupId, e.target.value)}
                                            placeholder="Anotaciones sobre la preparación..."
                                            rows={4} className="w-full mt-1 p-2 border rounded-md"></textarea>
                                    </div>
                                )
                            })}
                         </div>
                     </div>

                    <div>
                        <h3 className="text-xl font-bold text-gray-800 mb-4">Evaluaciones Individuales de Conducta (Día Previo)</h3>
                         <div className="space-y-8">
                            {assignedGroups.map(groupId => {
                                const studentsInGroup = students
                                    .filter(s => studentGroupAssignments[s.nre] === groupId)
                                    .sort((a, b) => `${a.apellido1} ${a.apellido2} ${a.nombre}`.localeCompare(`${b.apellido1} ${b.apellido2} ${b.nombre}`));
                                
                                if (studentsInGroup.length === 0) return null;

                                return (
                                <div key={groupId}>
                                    <h4 className="font-semibold text-lg text-gray-700 mb-3 bg-gray-100 p-2 rounded-md">{groupId}</h4>
                                    <div className="overflow-x-auto border border-gray-200 rounded-lg bg-white">
                                        <div className="grid" style={{ gridTemplateColumns: `minmax(300px, 2fr) repeat(${studentsInGroup.length}, minmax(130px, 1fr))` }}>
                                            {/* Header Row */}
                                            <div className="p-3 font-semibold bg-gray-100 border-b border-r text-sm sticky left-0 z-10">Criterio de Conducta</div>
                                            {studentsInGroup.map(student => {
                                                const preServiceIndEval = evaluations.preServiceIndividual.find(e => e.serviceId === service.id && e.studentNre === student.nre);
                                                const isPresent = preServiceIndEval?.attendance !== 'absent';
                                                const studentRole = planningAssignments[service.id]?.[student.nre];
                                                return (
                                                    <div key={student.nre} className="p-2 font-semibold text-center border-b border-r bg-gray-100 flex flex-col items-center justify-between gap-1">
                                                        <img src={student.photoUrl || `https://i.pravatar.cc/150?u=${student.nre}`} className="w-12 h-12 rounded-full border-2 border-white" alt={student.nombre} />
                                                        <p className="text-sm font-bold">{student.apellido1}, {student.nombre.toUpperCase()}</p>
                                                        {studentRole && <span className="text-xs font-bold bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full">{studentRole}</span>}
                                                        <div className="mt-1">
                                                            <label className={`text-xs font-bold px-2 py-1 rounded-full cursor-pointer ${isPresent ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                                                <input type="checkbox" checked={isPresent} onChange={e => handlePreServiceIndividualAttendanceChange(student.nre, e.target.checked ? 'present' : 'absent')} className="mr-1 h-3 w-3"/>
                                                                {isPresent ? 'Presente' : 'Ausente'}
                                                            </label>
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                            
                                            {/* Rubric Rows */}
                                            {PRE_SERVICE_BEHAVIOR_ITEMS.map(item => (
                                                <React.Fragment key={item.id}>
                                                    <div className="p-3 border-b border-r text-sm flex items-center bg-gray-50 sticky left-0 z-10">{item.text}</div>
                                                    {studentsInGroup.map(student => {
                                                        const preServiceIndEval = evaluations.preServiceIndividual.find(e => e.serviceId === service.id && e.studentNre === student.nre);
                                                        const isPresent = preServiceIndEval?.attendance !== 'absent';
                                                        const currentScore = preServiceIndEval?.behaviorScores?.[item.id];
                                                        return (
                                                            <div key={student.nre} className="p-2 border-b border-r flex items-center justify-center">
                                                                {isPresent ? (
                                                                    <div className="flex items-center justify-center gap-1.5">
                                                                        {behaviorScoreLevels.map(level => (
                                                                            <button
                                                                                key={level.value}
                                                                                onClick={() => handlePreServiceBehaviorChange(student.nre, item.id, level.value)}
                                                                                className={`w-9 h-9 flex items-center justify-center rounded-full font-bold text-sm transition-all ${level.className} ${currentScore === level.value ? level.selectedClassName : 'opacity-70 hover:opacity-100'}`}
                                                                                title={BEHAVIOR_SCORE_LEVELS.find(l => l.value === level.value)?.label}
                                                                            >
                                                                                {level.label}
                                                                            </button>
                                                                        ))}
                                                                    </div>
                                                                ) : <span className="text-xs font-semibold text-red-600">-</span>}
                                                            </div>
                                                        )
                                                    })}
                                                </React.Fragment>
                                            ))}

                                            {/* Observation Row */}
                                            <div className="p-3 border-r font-semibold text-sm bg-gray-50 sticky left-0 z-10">Observación Individual</div>
                                            {studentsInGroup.map(student => {
                                                const preServiceIndEval = evaluations.preServiceIndividual.find(e => e.serviceId === service.id && e.studentNre === student.nre);
                                                const isPresent = preServiceIndEval?.attendance !== 'absent';
                                                return (
                                                    <div key={student.nre} className="p-2 border-r flex items-center justify-center">
                                                        {isPresent ? (
                                                            <button 
                                                                onClick={() => setPreServiceObservationModal({isOpen: true, student})} 
                                                                className="text-sm text-blue-600 hover:text-blue-800 font-semibold bg-blue-50 hover:bg-blue-100 px-3 py-1 rounded-md">
                                                                Añadir/Ver
                                                            </button>
                                                        ) : null}
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </div>
                                </div>
                                )
                            })}
                        </div>
                    </div>
                </div>
            )}
            
            {observationModal.isOpen && observationModal.student && (
                <ObservationModal
                    student={observationModal.student}
                    initialObservation={evaluations.individual.find(e => e.serviceId === service.id && e.studentNre === observationModal.student!.nre)?.observation || ''}
                    onClose={() => setObservationModal({isOpen: false, student: null})}
                    onSave={handleSaveObservation}
                />
            )}

            {preServiceObservationModal.isOpen && preServiceObservationModal.student && (
                <ObservationModal
                    student={preServiceObservationModal.student}
                    initialObservation={evaluations.preServiceIndividual.find(e => e.serviceId === service.id && e.studentNre === preServiceObservationModal.student!.nre)?.observation || ''}
                    onClose={() => setPreServiceObservationModal({isOpen: false, student: null})}
                    onSave={handleSavePreServiceObservation}
                />
            )}
        </div>
    );
};

interface NotasSummaryViewProps {
    students: Student[];
    evaluations: EvaluationsState;
    services: Service[];
    studentGroupAssignments: StudentGroupAssignments;
    onEvaluateService: (serviceId: string) => void;
    studentsByGroup: [string, Student[]][];
    getScoresForStudent: (student: Student) => { serviceScores: Record<string, { group: number | null, individual: number | null }>, average: number };
}

const NotasSummaryView: React.FC<NotasSummaryViewProps> = ({ services, onEvaluateService, studentsByGroup, getScoresForStudent }) => {
    
    if (services.length === 0) {
         return (
            <div className="bg-white p-8 rounded-lg shadow-md text-center">
                <h2 className="text-2xl font-bold text-gray-800">No hay servicios configurados</h2>
                <p className="mt-4 text-gray-600">Por favor, ve a "Gestión Práctica" {'>'} "Configuración" para añadir servicios antes de poder evaluarlos.</p>
          </div>
        )
    }

    return (
        <div className="bg-white p-4 sm:p-6 rounded-lg shadow-md">
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 border">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="sticky left-0 bg-gray-50 px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider z-10">Alumno</th>
                            {services.map(service => (
                                <th key={service.id} className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                                    <button onClick={() => onEvaluateService(service.id)} className="hover:text-teal-600">
                                        {service.name} <br/> <span className="font-normal">{new Date(service.date).toLocaleDateString()}</span>
                                    </button>
                                </th>
                            ))}
                             <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Media Final</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {studentsByGroup.map(([groupName, groupStudents]) => (
                            <React.Fragment key={groupName}>
                                <tr>
                                    <td colSpan={services.length + 2} className="px-4 py-2 bg-gray-100 text-sm font-bold text-gray-700 sticky left-0 z-10">{groupName}</td>
                                </tr>
                                {groupStudents.map((student, index) => {
                                    const { serviceScores, average } = getScoresForStudent(student);
                                    return (
                                        <tr key={student.nre} className="hover:bg-gray-50">
                                            <td className="sticky left-0 bg-white hover:bg-gray-50 px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-900 z-10 border-r">
                                                <div className="flex items-center">
                                                    <span className="text-gray-500 font-normal w-6 text-right mr-2">{index + 1}.</span>
                                                    <span>{student.apellido1} {student.apellido2}, {student.nombre}</span>
                                                </div>
                                            </td>
                                            {services.map(service => (
                                                <td key={service.id} className="px-3 py-2 text-center text-sm">
                                                    {serviceScores[service.id].group !== null ? (
                                                        <div className="flex justify-center items-center gap-2">
                                                            <div className="flex flex-col items-center">
                                                                <span className="text-xs text-blue-600">G</span>
                                                                <span className="font-semibold text-blue-800">{serviceScores[service.id].group?.toFixed(2)}</span>
                                                            </div>
                                                             <div className="flex flex-col items-center">
                                                                <span className="text-xs text-green-600">I</span>
                                                                <span className="font-semibold text-green-800">{serviceScores[service.id].individual?.toFixed(2)}</span>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <span className="text-xs font-semibold text-red-600 bg-red-100 px-2 py-0.5 rounded-full">AUSENTE</span>
                                                    )}
                                                </td>
                                            ))}
                                            <td className="px-4 py-2 text-center text-sm font-bold text-gray-800 bg-gray-50">{average.toFixed(2)} / 20.00</td>
                                        </tr>
                                    );
                                })}
                            </React.Fragment>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

// --- MAIN COMPONENT ---
const GestionNotasView: React.FC<GestionNotasViewProps> = ({ students, setStudents, evaluations, setEvaluations }) => {
    const [view, setView] = useState<'summary' | 'evaluate'>('summary');
    const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);

    const services = useMemo(() => safeJsonParse<Service[]>('practicaServices', []).sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime()), []);
    const studentGroupAssignments = useMemo(() => safeJsonParse<StudentGroupAssignments>('studentGroupAssignments', {}), []);
    const planningAssignments = useMemo(() => safeJsonParse<PlanningAssignments>('planningAssignments', {}), []);

    const studentsByGroup = useMemo(() => {
        const grouped: { [key: string]: Student[] } = {};
        students.forEach(s => {
            const groupName = s.grupo || 'Sin Grupo';
            if (!grouped[groupName]) grouped[groupName] = [];
            grouped[groupName].push(s);
        });

        for (const groupName in grouped) {
            grouped[groupName].sort((a, b) => {
                const nameA = `${a.apellido1} ${a.apellido2} ${a.nombre}`.toLowerCase();
                const nameB = `${b.apellido1} ${b.apellido2} ${b.nombre}`.toLowerCase();
                return nameA.localeCompare(nameB);
            });
        }
        
        return Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b));
    }, [students]);

    const getScoresForStudent = useCallback((student: Student) => {
        const serviceScores: { [serviceId: string]: { group: number | null, individual: number | null } } = {};
        let totalScore = 0;
        let servicesCounted = 0;

        services.forEach(service => {
            const indEval = evaluations.individual.find(e => e.serviceId === service.id && e.studentNre === student.nre);
            
            if (indEval && indEval.attendance === 'present') {
                const practiceGroup = studentGroupAssignments[student.nre];
                const groupEval = evaluations.group.find(e => e.serviceId === service.id && e.groupId === practiceGroup);

                const individualScore = calculateScore(indEval.scores);
                const groupScore = groupEval ? calculateScore(groupEval.scores) : 0;
                
                serviceScores[service.id] = { group: groupScore, individual: individualScore };
                totalScore += individualScore + groupScore;
                servicesCounted++;
            } else {
                serviceScores[service.id] = { group: null, individual: null }; // null indicates absence or not graded
            }
        });
        
        const average = servicesCounted > 0 ? totalScore / servicesCounted : 0;

        return { serviceScores, average };

    }, [evaluations, services, studentGroupAssignments]);
    
    const handleExportPdf = () => {
        const head = [
            [
                { content: 'Alumno', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
                ...services.map(s => ({ content: s.name, colSpan: 3, styles: { halign: 'center' } })),
                { content: 'Media Final', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } }
            ],
            services.flatMap(() => [{ content: 'G', styles: { halign: 'center' } }, { content: 'I', styles: { halign: 'center' } }, { content: 'Total', styles: { halign: 'center', fontStyle: 'bold' } }])
        ];
    
        const body: any[][] = [];
    
        studentsByGroup.forEach(([groupName, groupStudents]) => {
            body.push([{ content: groupName, colSpan: services.length * 3 + 2, styles: { fontStyle: 'bold', fillColor: '#f3f4f6' } }]);
            
            groupStudents.forEach(student => {
                const { serviceScores, average } = getScoresForStudent(student);
                const rowData: any[] = [
                    `${student.apellido1} ${student.apellido2}, ${student.nombre}`
                ];
                services.forEach(service => {
                    const scores = serviceScores[service.id];
                    if (scores.group !== null) {
                        const total = (scores.group || 0) + (scores.individual || 0);
                        rowData.push(scores.group?.toFixed(2) ?? 'N/A');
                        rowData.push(scores.individual?.toFixed(2) ?? 'N/A');
                        rowData.push({ content: total.toFixed(2), styles: { fontStyle: 'bold' } });
                    } else {
                        rowData.push({ content: 'AUSENTE', colSpan: 3, styles: { halign: 'center', textColor: [220, 38, 38] } });
                    }
                });
                rowData.push({ content: average.toFixed(2), styles: { fontStyle: 'bold' } });
                body.push(rowData);
            });
        });
    
        downloadPdfWithTables(
            'Resumen de Notas de Servicios',
            'notas_servicios',
            [{ head, body }],
            { orientation: 'landscape' }
        );
    };

    const handleExportXlsx = () => {
        const dataToExport: any[] = [];
        studentsByGroup.forEach(([groupName, groupStudents]) => {
            groupStudents.forEach(student => {
                const { serviceScores, average } = getScoresForStudent(student);
                const row: any = {
                    'Grupo Académico': student.grupo,
                    'Alumno': `${student.apellido1} ${student.apellido2}, ${student.nombre}`,
                };
    
                services.forEach(service => {
                    const scores = serviceScores[service.id];
                    const serviceName = service.name.replace(/\s/g, '_');
                    if (scores.group !== null) {
                        row[`${serviceName}_Grupo`] = scores.group?.toFixed(2);
                        row[`${serviceName}_Individual`] = scores.individual?.toFixed(2);
                        row[`${serviceName}_Total`] = ((scores.group || 0) + (scores.individual || 0)).toFixed(2);
                    } else {
                        row[`${serviceName}_Total`] = 'AUSENTE';
                    }
                });
    
                row['Media_Final_Servicios'] = average.toFixed(2);
                dataToExport.push(row);
            });
        });
    
        exportToExcel(dataToExport, 'notas_servicios', 'Notas Servicios');
    };

    const handleSelectService = (serviceId: string) => {
        setSelectedServiceId(serviceId);
        setView('evaluate');
    };

    const handleBackToSummary = () => {
        setSelectedServiceId(null);
        setView('summary');
    };

    const selectedService = useMemo(() => {
        return services.find(s => s.id === selectedServiceId) || null;
    }, [services, selectedServiceId]);

    return (
        <div className="p-8">
            <header className="mb-6">
                <h1 className="text-3xl font-bold text-gray-800">Gestión de Notas</h1>
                <p className="mt-2 text-gray-600">Visualiza y registra las calificaciones de las prácticas de servicio.</p>
            </header>

            {view === 'summary' && (
                <div className="flex justify-end gap-2 mb-4">
                    <button onClick={handleExportXlsx} className="bg-green-700 hover:bg-green-800 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-1">
                        <DownloadIcon className="h-5 w-5"/> XLSX
                    </button>
                    <button onClick={handleExportPdf} className="bg-red-700 hover:bg-red-800 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-1">
                        <DownloadIcon className="h-5 w-5"/> PDF
                    </button>
                </div>
            )}

            {view === 'summary' && (
                <NotasSummaryView 
                    students={students}
                    evaluations={evaluations}
                    services={services}
                    studentGroupAssignments={studentGroupAssignments}
                    onEvaluateService={handleSelectService}
                    studentsByGroup={studentsByGroup}
                    getScoresForStudent={getScoresForStudent}
                />
            )}

            {view === 'evaluate' && selectedService && (
                <EvaluationForm
                    service={selectedService}
                    students={students}
                    studentGroupAssignments={studentGroupAssignments}
                    evaluations={evaluations}
                    setEvaluations={setEvaluations}
                    onBack={handleBackToSummary}
                    planningAssignments={planningAssignments}
                />
            )}
        </div>
    );
};

export default GestionNotasView;