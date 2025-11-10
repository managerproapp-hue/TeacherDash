import React, { useState, useEffect, useMemo, lazy, Suspense } from 'react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { Service, ServiceEvaluation, Elaboration, Student, PracticeGroup, ServiceRole, TeacherData, InstituteData } from '../types';
import { PlusIcon, TrashIcon, SaveIcon, ChefHatIcon, FileTextIcon } from '../components/icons';
import { useAppContext } from '../context/AppContext';

const ServiceEvaluationView = lazy(() => import('./ServiceEvaluationView'));

interface GestionPracticaViewProps {
    initialServiceId: string | null;
    initialServiceTab: 'planning' | 'evaluation' | null;
    clearInitialServiceContext: () => void;
}


// --- PDF Generation Logic ---
const generateWeeklyFollowUpPDF = (
    service: Service,
    evaluation: ServiceEvaluation,
    allStudents: Student[],
    practiceGroups: PracticeGroup[],
    serviceRoles: ServiceRole[],
    teacherData: TeacherData,
    instituteData: InstituteData
) => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageMargin = 15;
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const contentWidth = pageWidth - (pageMargin * 2);
    const contentHeight = pageHeight - (pageMargin * 2);

    const addImageToPdf = (imageData: string | null, x: number, y: number, w: number, h: number) => {
        if (imageData && imageData.startsWith('data:image')) {
            try {
                const imageType = imageData.substring(imageData.indexOf('/') + 1, imageData.indexOf(';'));
                doc.addImage(imageData, imageType.toUpperCase(), x, y, w, h);
            } catch (e) { console.error("Error adding image:", e); }
        }
    };

    const addPageHeaderAndFooter = (pageNumber: number, totalPages: number) => {
        doc.setFont('helvetica', 'normal');
        // HEADER
        addImageToPdf(instituteData.logo, pageMargin, 10, 15, 15);
        addImageToPdf(teacherData.logo, pageWidth - pageMargin - 15, 10, 15, 15);
        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text("Ficha de Seguimiento: " + service.name, pageWidth / 2, 15, { align: 'center' });
        doc.text(new Date(service.date).toLocaleDateString('es-ES'), pageWidth / 2, 20, { align: 'center' });
        
        // FOOTER
        doc.setFontSize(8);
        doc.text(`${instituteData.name || 'IES La Flota'} - ${teacherData.name || 'Juan Codina Barranco'}`, pageMargin, pageHeight - 10);
        doc.text(`Página ${pageNumber}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
        doc.text(new Date().toLocaleDateString('es-ES'), pageWidth - pageMargin, pageHeight - 10, { align: 'right' });
    };

    const participatingGroupIds = new Set([...service.assignedGroups.comedor, ...service.assignedGroups.takeaway]);
    const participatingGroups = practiceGroups.filter(g => participatingGroupIds.has(g.id));

    let currentPage = 1;
    let y = 30;

    addPageHeaderAndFooter(currentPage, 0); // Initial header

    participatingGroups.forEach((group, groupIndex) => {
        const studentsInGroup = allStudents.filter(s => group.studentIds.includes(s.id)).sort((a,b) => a.apellido1.localeCompare(b.apellido1));
        const serviceArea = service.assignedGroups.comedor.includes(group.id) ? "COMEDOR" : "TAKEAWAY";

        // Group Header
        if (y + 20 > pageHeight - pageMargin) {
            doc.addPage();
            currentPage++;
            y = 30;
            addPageHeaderAndFooter(currentPage, 0);
        }

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        doc.text(`${group.name} - ${serviceArea}`, pageMargin, y);
        y += 8;

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.text("Observaciones Generales del Grupo:", pageMargin, y);
        y += 5;
        const groupObs = evaluation.serviceDay.groupScores[group.id]?.observations || '';
        doc.rect(pageMargin, y, contentWidth, 20);
        doc.text(groupObs, pageMargin + 2, y + 5, { maxWidth: contentWidth - 4 });
        y += 25;

        studentsInGroup.forEach((student, studentIndex) => {
            const studentBlockHeight = 75;
             if (y + studentBlockHeight > pageHeight - pageMargin) {
                doc.addPage();
                currentPage++;
                y = 30;
                addPageHeaderAndFooter(currentPage, 0);
                 doc.setFont('helvetica', 'bold');
                 doc.setFontSize(14);
                 doc.text(`${group.name} - ${serviceArea} (cont.)`, pageMargin, y);
                 y += 10;
            }
            
            doc.setDrawColor(150);
            doc.line(pageMargin, y - 5, pageWidth - pageMargin, y - 5);

            // Student Name and Role
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(12);
            doc.text(`${student.apellido1} ${student.apellido2}, ${student.nombre}`, pageMargin, y);
            const roleId = service.studentRoles.find(sr => sr.studentId === student.id)?.roleId;
            const roleName = serviceRoles.find(r => r.id === roleId)?.name || 'Sin asignar';
            doc.text(roleName, pageWidth - pageMargin, y, { align: 'right' });
            y += 8;

            const col1X = pageMargin;
            const col2X = pageWidth / 2;
            const colWidth = (pageWidth / 2) - pageMargin - 2;
            let currentY = y;

            // --- Día Previo ---
            const latestPreServiceDate = Object.keys(evaluation.preService).sort().pop();
            const preServiceEval = latestPreServiceDate ? evaluation.preService[latestPreServiceDate]?.individualEvaluations[student.id] : null;
            
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(10);
            doc.text("DÍA PREVIO", col1X, currentY);
            currentY += 5;
            doc.setFont('helvetica', 'normal');
            doc.text(`Asistencia: Sí [${preServiceEval?.attendance ? 'X' : ' '}] No [${preServiceEval?.attendance ? ' ' : 'X'}]`, col1X, currentY); currentY += 5;
            doc.text(`Uniforme completo: [${preServiceEval?.hasUniforme ? 'X' : ' '}]`, col1X, currentY); currentY += 5;
            doc.text(`Fichas técnicas: [${preServiceEval?.hasFichas ? 'X' : ' '}]`, col1X, currentY); currentY += 5;
            doc.text(`Material requerido: [${preServiceEval?.hasMaterial ? 'X' : ' '}]`, col1X, currentY); currentY += 8;
            doc.rect(col1X, currentY, colWidth, 25);
            doc.text(preServiceEval?.observations || '', col1X + 2, currentY + 5, { maxWidth: colWidth - 4 });

            // --- Día de Servicio ---
            const serviceDayEval = evaluation.serviceDay.individualScores[student.id];
            currentY = y; // Reset Y for the second column
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(10);
            doc.text("DÍA DE SERVICIO", col2X, currentY);
            currentY += 5;
            doc.setFont('helvetica', 'normal');
            doc.text(`Asistencia: Sí [${serviceDayEval?.attendance ? 'X' : ' '}] No [${serviceDayEval?.attendance ? ' ' : 'X'}]`, col2X, currentY); currentY += 5;
            // NOTE: This data is not collected in the app, so checkboxes are left empty as per the template.
            doc.text(`Uniforme completo: [ ]`, col2X, currentY); currentY += 5;
            doc.text(`Fichas técnicas: [ ]`, col2X, currentY); currentY += 5;
            doc.text(`Material requerido: [ ]`, col2X, currentY); currentY += 8;
            doc.rect(col2X, currentY, colWidth, 25);
            doc.text(serviceDayEval?.observations || '', col2X + 2, currentY + 5, { maxWidth: colWidth - 4 });
            
            y += studentBlockHeight;
        });
    });

    // Final pass to update total pages in footer
    const totalPages = doc.internal.pages.length;
    for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        addPageHeaderAndFooter(i, totalPages);
    }
    
    doc.save(`Ficha_Seguimiento_${service.name.replace(/ /g, '_')}.pdf`);
};

const GestionPracticaView: React.FC<GestionPracticaViewProps> = ({ 
    initialServiceId, initialServiceTab, clearInitialServiceContext 
}) => {
    const {
        students, practiceGroups, services, serviceEvaluations, serviceRoles, 
        entryExitRecords, handleCreateService: contextCreateService, 
        handleSaveServiceAndEvaluation, handleDeleteService,
        teacherData, instituteData
    } = useAppContext();

    const [selectedServiceId, setSelectedServiceId] = useState<string | null>(initialServiceId);
    const [editedService, setEditedService] = useState<Service | null>(null);
    const [editedEvaluation, setEditedEvaluation] = useState<ServiceEvaluation | null>(null);
    const [mainTab, setMainTab] = useState<'planning' | 'evaluation'>('planning');
    const [planningSubTab, setPlanningSubTab] = useState('distribucion');
    const [newElaboration, setNewElaboration] = useState({
        comedor: { name: '', responsibleGroupId: '' },
        takeaway: { name: '', responsibleGroupId: '' }
    });

    useEffect(() => {
        if (initialServiceId) {
            setSelectedServiceId(initialServiceId);
            if (initialServiceTab) setMainTab(initialServiceTab);
            clearInitialServiceContext();
        }
    }, [initialServiceId, initialServiceTab, clearInitialServiceContext]);

    useEffect(() => {
        if (selectedServiceId) {
            const service = services.find(s => s.id === selectedServiceId);
            const evaluation = serviceEvaluations.find(e => e.serviceId === selectedServiceId);
            setEditedService(service ? JSON.parse(JSON.stringify(service)) : null);
            setEditedEvaluation(evaluation ? JSON.parse(JSON.stringify(evaluation)) : null);
            if (!initialServiceId) setMainTab('planning');
            setPlanningSubTab('distribucion');
        } else {
            setEditedService(null);
            setEditedEvaluation(null);
        }
    }, [selectedServiceId, services, serviceEvaluations, initialServiceId]);
    
    const handleCreateService = () => {
        const newServiceId = contextCreateService();
        setSelectedServiceId(newServiceId);
        setMainTab('planning');
    };

    const handleDelete = () => {
        if (editedService) {
           if (window.confirm(`¿Estás seguro de que quieres eliminar "${editedService.name}"?`)) {
                handleDeleteService(editedService.id);
                setSelectedServiceId(null);
           }
        }
    };
    
    const handleSave = () => {
        if (editedService && editedEvaluation) {
            handleSaveServiceAndEvaluation(editedService, editedEvaluation);
        }
    };
    
    const handleGeneratePdf = () => {
        if (editedService && editedEvaluation) {
            generateWeeklyFollowUpPDF(editedService, editedEvaluation, students, practiceGroups, serviceRoles, teacherData, instituteData);
        }
    };
    
    const handleServiceFieldChange = (field: keyof Service, value: any) => {
        setEditedService(prev => prev ? { ...prev, [field]: value } : null);
    };
    
    const toggleGroupAssignment = (area: 'comedor' | 'takeaway', groupId: string) => {
        if (!editedService) return;
        const currentAssignments = editedService.assignedGroups[area];
        const newAssignments = currentAssignments.includes(groupId)
            ? currentAssignments.filter(id => id !== groupId)
            : [...currentAssignments, groupId];
        setEditedService({ ...editedService, assignedGroups: { ...editedService.assignedGroups, [area]: newAssignments } });
    };
    
    const handleAddElaboration = (area: 'comedor' | 'takeaway') => {
        const { name, responsibleGroupId } = newElaboration[area];
        if (!name.trim() || !responsibleGroupId) {
            alert('Introduce un nombre para el plato y selecciona un grupo responsable.');
            return;
        }
        const newElab: Elaboration = { id: `elab-${Date.now()}`, name, responsibleGroupId };
        if (editedService) {
            const updatedElaborations = { ...editedService.elaborations, [area]: [...editedService.elaborations[area], newElab] };
            setEditedService({ ...editedService, elaborations: updatedElaborations });
            setNewElaboration(prev => ({ ...prev, [area]: { name: '', responsibleGroupId: '' } }));
        }
    };

    const handleUpdateElaboration = (area: 'comedor' | 'takeaway', id: string, field: keyof Elaboration, value: string) => {
        if (editedService) {
            const updatedElaborations = { ...editedService.elaborations, [area]: editedService.elaborations[area].map(e => e.id === id ? { ...e, [field]: value } : e) };
            setEditedService({ ...editedService, elaborations: updatedElaborations });
        }
    };

    const handleDeleteElaboration = (area: 'comedor' | 'takeaway', id: string) => {
        if (editedService) {
            const updatedElaborations = { ...editedService.elaborations, [area]: editedService.elaborations[area].filter(e => e.id !== id) };
            setEditedService({ ...editedService, elaborations: updatedElaborations });
        }
    };

    const groupedStudentsInService = useMemo(() => {
        if (!editedService) return [];
        const assignedGroupIds = [...editedService.assignedGroups.comedor, ...editedService.assignedGroups.takeaway];
        const assignedGroups = practiceGroups.filter(g => assignedGroupIds.includes(g.id)).sort((a, b) => b.name.localeCompare(a.name));
        return assignedGroups.map(group => ({
            group,
            students: students.filter(s => group.studentIds.includes(s.id)).sort((a, b) => a.apellido1.localeCompare(b.apellido1) || a.nombre.localeCompare(b.nombre))
        }));
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

    const sortedServices = useMemo(() =>
        [...services].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
        [services]
    );

    if (practiceGroups.length === 0) {
        return (
            <div className="text-center p-8 bg-white rounded-lg shadow">
                <h2 className="text-2xl font-bold text-gray-700">Primero define los grupos de práctica</h2>
                <p className="text-gray-500 mt-2">No puedes gestionar servicios sin haber creado grupos de alumnos primero.</p>
            </div>
        );
    }
    
    const renderWorkspace = () => {
        if (!editedService || !editedEvaluation) {
             return (
                <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                        <ChefHatIcon className="mx-auto h-16 w-16 text-gray-300" />
                        <h2 className="mt-4 text-xl font-semibold text-gray-700">Selecciona un servicio o crea uno nuevo</h2>
                        <p className="mt-1 text-gray-500">Aquí podrás planificar, asignar puestos y evaluar.</p>
                    </div>
                </div>
            );
        }

        return (
            <div>
                 <header className="flex flex-wrap justify-between items-center gap-4 mb-6 pb-4 border-b">
                    <div>
                        <input type="text" value={editedService.name} onChange={(e) => handleServiceFieldChange('name', e.target.value)} className="text-3xl font-bold text-gray-800 bg-transparent focus:bg-white focus:ring-1 focus:ring-blue-500 rounded-md p-1 -ml-1"/>
                         <input type="date" value={editedService.date} onChange={(e) => handleServiceFieldChange('date', e.target.value)} className="text-gray-500 mt-1 block bg-transparent focus:bg-white focus:ring-1 focus:ring-blue-500 rounded-md"/>
                    </div>
                    <div className="flex items-center space-x-2">
                        <button onClick={handleGeneratePdf} className="flex items-center bg-purple-500 text-white px-4 py-2 rounded-lg font-semibold hover:bg-purple-600 transition"><FileTextIcon className="w-5 h-5 mr-1" /> Generar Ficha Semanal</button>
                        <button onClick={handleSave} className="flex items-center bg-green-500 text-white px-4 py-2 rounded-lg font-semibold hover:bg-green-600 transition"><SaveIcon className="w-5 h-5 mr-1" /> Guardar</button>
                        <button onClick={handleDelete} className="flex items-center bg-red-500 text-white px-4 py-2 rounded-lg font-semibold hover:bg-red-600 transition"><TrashIcon className="w-5 h-5" /></button>
                    </div>
                </header>

                <div className="border-b border-gray-200 mb-6">
                    <nav className="flex space-x-2">
                         <button onClick={() => setMainTab('planning')} className={`px-4 py-2 font-medium text-sm rounded-md transition-colors ${mainTab === 'planning' ? 'bg-blue-100 text-blue-600' : 'text-gray-500 hover:bg-gray-100'}`}>Planificación</button>
                         <button onClick={() => setMainTab('evaluation')} className={`px-4 py-2 font-medium text-sm rounded-md transition-colors ${mainTab === 'evaluation' ? 'bg-blue-100 text-blue-600' : 'text-gray-500 hover:bg-gray-100'}`}>Evaluación</button>
                    </nav>
                </div>

                {mainTab === 'planning' && (
                    <div>
                        <div className="border-b border-gray-200 mb-6">
                            <nav className="flex space-x-2">
                                <button onClick={() => setPlanningSubTab('distribucion')} className={`px-3 py-1.5 text-xs font-medium rounded-md ${planningSubTab === 'distribucion' ? 'bg-gray-200 text-gray-800' : 'text-gray-500 hover:bg-gray-100'}`}>Distribución y Platos</button>
                                <button onClick={() => setPlanningSubTab('puestos')} className={`px-3 py-1.5 text-xs font-medium rounded-md ${planningSubTab === 'puestos' ? 'bg-gray-200 text-gray-800' : 'text-gray-500 hover:bg-gray-100'}`}>Asignar Puestos</button>
                            </nav>
                        </div>
                        {planningSubTab === 'distribucion' && (
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                {(['comedor', 'takeaway'] as const).map(area => {
                                    const areaColor = area === 'comedor' ? 'green' : 'blue';
                                    const assignedGroupIds = editedService.assignedGroups[area];
                                    const availableGroupsForElaboration = practiceGroups.filter(g => assignedGroupIds.includes(g.id));
                                
                                    return (
                                    <div key={area} className={`bg-white p-4 rounded-lg shadow-sm border-t-4 border-${areaColor}-500`}>
                                        <h3 className={`text-xl font-bold mb-3 capitalize text-${areaColor}-600`}>Grupos en {area}</h3>
                                        <div className="space-y-2">{practiceGroups.map(group => (<label key={group.id} className="flex items-center p-3 rounded-md hover:bg-gray-50 cursor-pointer"><input type="checkbox" checked={assignedGroupIds.includes(group.id)} onChange={() => toggleGroupAssignment(area, group.id)} className={`h-4 w-4 rounded border-gray-300 text-${areaColor}-600 focus:ring-${areaColor}-500`}/> <span className="ml-3 text-sm font-medium text-gray-800">{group.name}</span></label>))}</div>
                                        <div className="mt-6 border-t pt-4">
                                            <h4 className={`text-lg font-bold mb-3 text-${areaColor}-600`}>Elaboraciones para {area}</h4>
                                            <div className="space-y-3 mb-4">{editedService.elaborations[area].map((elab, index) => (<div key={elab.id} className="flex items-center gap-2 text-sm"><span className="font-semibold text-gray-500">{index + 1}.</span><input type="text" value={elab.name} onChange={e => handleUpdateElaboration(area, elab.id, 'name', e.target.value)} className="flex-grow p-1.5 border-gray-300 rounded-md shadow-sm"/><select value={elab.responsibleGroupId || ''} onChange={e => handleUpdateElaboration(area, elab.id, 'responsibleGroupId', e.target.value)} className="p-1.5 border-gray-300 rounded-md shadow-sm"><option value="">Asignar...</option>{availableGroupsForElaboration.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}</select><button onClick={() => handleDeleteElaboration(area, elab.id)} className="p-1 text-gray-400 hover:text-red-500"><TrashIcon className="w-4 h-4" /></button></div>))}</div>
                                            {availableGroupsForElaboration.length > 0 ? (<div className="flex items-center gap-2 p-2 bg-gray-50 rounded-md"><input type="text" placeholder="Nombre del nuevo plato" value={newElaboration[area].name} onChange={e => setNewElaboration(p => ({...p, [area]: {...p[area], name: e.target.value}}))} className="flex-grow p-1.5 border-gray-300 rounded-md shadow-sm"/><select value={newElaboration[area].responsibleGroupId} onChange={e => setNewElaboration(p => ({...p, [area]: {...p[area], responsibleGroupId: e.target.value}}))} className="p-1.5 border-gray-300 rounded-md shadow-sm"><option value="">Seleccionar grupo...</option>{availableGroupsForElaboration.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}</select><button onClick={() => handleAddElaboration(area)} className={`bg-${areaColor}-500 text-white px-3 py-1.5 rounded-md font-semibold hover:bg-${areaColor}-600`}>Añadir</button></div>) : (<p className="text-sm text-gray-500 text-center p-2 bg-gray-50 rounded-md">Asigna al menos un grupo a esta área para poder añadir elaboraciones.</p>)}
                                        </div>
                                    </div>
                                )})}
                            </div>
                        )}
                        {planningSubTab === 'puestos' && (
                            <div className="bg-white p-4 rounded-lg shadow-sm">
                                <h3 className="text-lg font-bold mb-3 text-gray-700">Puestos de Alumnos en Servicio</h3>
                                <div className="overflow-x-auto">
                                    <table className="min-w-full text-sm">
                                        <thead className="bg-gray-50"><tr><th className="px-4 py-2 text-left font-semibold text-gray-600">Alumno</th><th className="px-4 py-2 text-left font-semibold text-gray-600">Puesto</th></tr></thead>
                                        <tbody>
                                            {groupedStudentsInService.map(({ group, students: studentsInGroup }) => (
                                                <React.Fragment key={group.id}>
                                                    <tr><td colSpan={2} className={`px-4 py-2 font-bold text-gray-800 border-b-2 ${group.color.split(' ')[0]} ${group.color.split(' ')[1]}`}>{group.name}</td></tr>
                                                    {studentsInGroup.map(student => (<tr key={student.id} className={`border-b hover:bg-gray-50 border-l-4 ${group.color.split(' ')[1]}`}><td className="px-4 py-2 font-medium text-gray-800">{`${student.apellido1} ${student.apellido2}, ${student.nombre}`}</td><td className="px-4 py-2"><select value={editedService.studentRoles.find(sr => sr.studentId === student.id)?.roleId || ''} onChange={e => handleStudentRoleChange(student.id, e.target.value || null)} className="w-full p-1.5 border-gray-300 rounded-md shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"><option value="">Sin asignar</option>{serviceRoles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</select></td></tr>))}
                                                </React.Fragment>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>
                )}
                 {mainTab === 'evaluation' && (
                    <Suspense fallback={<div className="text-center p-8">Cargando módulo de evaluación...</div>}>
                        <ServiceEvaluationView 
                           service={editedService}
                           evaluation={editedEvaluation}
                           onEvaluationChange={setEditedEvaluation}
                           students={students}
                           practiceGroups={practiceGroups}
                           entryExitRecords={entryExitRecords}
                        />
                    </Suspense>
                )}
            </div>
        );
    };

    return (
        <div className="flex h-[calc(100vh-64px)]">
            <aside className="w-full md:w-1/3 lg:w-1/4 flex-shrink-0 bg-white p-4 border-r overflow-y-auto">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold text-gray-800">Servicios</h2>
                    <button onClick={handleCreateService} className="p-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-transform transform hover:scale-110"><PlusIcon className="w-5 h-5" /></button>
                </div>
                <ul className="space-y-2">
                    {sortedServices.map(service => (<li key={service.id}><a href="#" onClick={(e) => { e.preventDefault(); setSelectedServiceId(service.id); setMainTab('planning'); }} className={`block p-3 rounded-lg transition-colors ${selectedServiceId === service.id ? 'bg-blue-100' : 'hover:bg-gray-100'}`}><p className={`font-semibold ${selectedServiceId === service.id ? 'text-blue-800' : 'text-gray-800'}`}>{service.name}</p><p className="text-sm text-gray-500">{new Date(service.date).toLocaleDateString('es-ES')}</p></a></li>))}
                </ul>
            </aside>
            <main className="flex-1 p-4 sm:p-6 bg-gray-50 overflow-y-auto">{renderWorkspace()}</main>
        </div>
    );
};

export default GestionPracticaView;