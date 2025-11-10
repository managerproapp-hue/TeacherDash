import React, { useState, useEffect, useMemo, lazy, Suspense } from 'react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { Service, ServiceEvaluation, Elaboration, Student, PracticeGroup, ServiceRole, TeacherData, InstituteData } from '../types';
import { PlusIcon, TrashIcon, SaveIcon, ChefHatIcon, FileTextIcon, PrinterIcon, LockClosedIcon, LockOpenIcon } from '../components/icons';
import { PRE_SERVICE_BEHAVIOR_ITEMS, BEHAVIOR_RATING_MAP, GROUP_EVALUATION_ITEMS, INDIVIDUAL_EVALUATION_ITEMS } from '../data/constants';
import { useAppContext } from '../context/AppContext';

const ServiceEvaluationView = lazy(() => import('./ServiceEvaluationView'));

interface GestionPracticaViewProps {
    initialServiceId: string | null;
    initialServiceTab: 'planning' | 'evaluation' | null;
    clearInitialServiceContext: () => void;
}


// --- PDF Generation Logic ---
const generatePlanningPDF = (
    service: Service,
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
    let y = 0;
    let pageCount = 1;

    const addImageToPdf = (imageData: string | null, x: number, y: number, w: number, h: number) => {
        if (imageData && imageData.startsWith('data:image')) {
            try {
                const imageType = imageData.substring(imageData.indexOf('/') + 1, imageData.indexOf(';'));
                doc.addImage(imageData, imageType.toUpperCase(), x, y, w, h);
            } catch (e) { console.error("Error adding image:", e); }
        }
    };
    
    const addFooter = () => {
        doc.setFontSize(8);
        doc.setTextColor(120);
        doc.text(`${instituteData.name || 'IES La Flota'} - ${teacherData.name || 'Juan Codina Barranco'}`, pageMargin, pageHeight - 10);
        doc.text(`Página ${pageCount}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
        const dateStr = new Date(service.date).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
        doc.text(dateStr, pageWidth - pageMargin, pageHeight - 10, { align: 'right' });
    };

    const checkPageBreak = (neededHeight: number) => {
        if (y + neededHeight > pageHeight - pageMargin - 10) {
            addFooter();
            doc.addPage();
            pageCount++;
            y = pageMargin;
        }
    };
    
    // --- PAGE HEADER ---
    y = pageMargin;
    addImageToPdf(instituteData.logo, pageMargin, y, 15, 15);
    addImageToPdf(teacherData.logo, pageWidth - pageMargin - 15, y, 15, 15);
    y += 5;
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(`Planning: Servicio ${service.name}`, pageWidth / 2, y, { align: 'center' });
    y += 7;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    const serviceDate = new Date(service.date + 'T12:00:00Z').toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
    doc.text(`Comienzo curso (${serviceDate})`, pageWidth / 2, y, { align: 'center' });
    y += 15;

    // --- SERVICE LEADERS ---
    const leaderRoles = serviceRoles.filter(r => r.type === 'leader');
    const leaderAssignments = service.studentRoles
        .filter(sr => leaderRoles.some(lr => lr.id === sr.roleId))
        .map(sr => {
            const student = allStudents.find(s => s.id === sr.studentId);
            const role = leaderRoles.find(r => r.id === sr.roleId);
            return {
                role: role?.name || 'Líder',
                studentName: student ? `${student.apellido1} ${student.apellido2}, ${student.nombre}`.toUpperCase() : 'Desconocido'
            };
        });

    if (leaderAssignments.length > 0) {
        checkPageBreak(10 + leaderAssignments.length * 6);
        (doc as any).autoTable({
            startY: y,
            head: [['Líderes del Servicio', '']],
            body: leaderAssignments.map(l => [l.role, l.studentName]),
            theme: 'striped',
            headStyles: { fillColor: [243, 244, 246], textColor: [17, 24, 39], fontStyle: 'bold' },
            bodyStyles: { fillColor: [249, 250, 251] },
            alternateRowStyles: { fillColor: [255, 255, 255] }
        });
        y = (doc as any).lastAutoTable.finalY + 10;
    }
    
    // --- DYNAMIC SECTIONS (COMEDOR, TAKEAWAY) ---
    const drawSection = (title: string, groupIds: string[], elaborationsList: Elaboration[]) => {
        if (groupIds.length === 0) return;
        
        checkPageBreak(15);
        doc.setFillColor(236, 253, 245); // Light green
        doc.rect(pageMargin, y, pageWidth - (pageMargin * 2), 10, 'F');
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(21, 128, 61); // Dark green
        doc.text(title, pageWidth / 2, y + 7, { align: 'center' });
        y += 15;
        
        groupIds.forEach(groupId => {
            const group = practiceGroups.find(g => g.id === groupId);
            if (!group) return;
            
            const elaborations = elaborationsList.filter(e => e.responsibleGroupId === groupId);
            const studentsInGroup = allStudents.filter(s => group.studentIds.includes(s.id))
                .sort((a,b) => a.apellido1.localeCompare(b.apellido1));
                
            const studentTableBody = studentsInGroup.map(student => {
                const roleId = service.studentRoles.find(sr => sr.studentId === student.id)?.roleId;
                const roleName = serviceRoles.find(r => r.id === roleId)?.name || 'Sin Asignar';
                const studentName = `${student.apellido1} ${student.apellido2}, ${student.nombre}`.toUpperCase();
                return [studentName, roleName];
            });

            checkPageBreak(20 + elaborations.length * 5 + studentsInGroup.length * 6);
            
            doc.setFontSize(12);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(0, 0, 0);
            doc.text(group.name, pageMargin, y);
            y += 6;
            
            if (elaborations.length > 0) {
                doc.setFontSize(10);
                doc.setFont('helvetica', 'normal');
                doc.text('Elaboraciones:', pageMargin, y);
                y += 5;
                elaborations.forEach(elab => {
                    doc.text(`- ${elab.name}`, pageMargin + 2, y);
                    y += 5;
                });
            }
            y += 2;

            (doc as any).autoTable({
                startY: y,
                body: studentTableBody,
                theme: 'striped',
                styles: { fontSize: 10, cellPadding: 2, lineWidth: 0.1, lineColor: [229, 231, 235] },
                bodyStyles: { fillColor: [249, 250, 251] },
                alternateRowStyles: { fillColor: [255, 255, 255] },
                columnStyles: { 1: { halign: 'right' } }
            });
            y = (doc as any).lastAutoTable.finalY + 10;
        });
    };
    
    drawSection('SERVICIO DE COMEDOR', service.assignedGroups.comedor, service.elaborations.comedor);
    drawSection('SERVICIO DE TAKEAWAY', service.assignedGroups.takeaway, service.elaborations.takeaway);
    
    addFooter();
    doc.save(`Planning_${service.name.replace(/ /g, '_')}.pdf`);
};

const generateServiceReportPDF = (
    service: Service,
    evaluation: ServiceEvaluation,
    allStudents: Student[],
    practiceGroups: PracticeGroup[],
    serviceRoles: ServiceRole[],
    teacherData: TeacherData,
    instituteData: InstituteData
) => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    let pageCount = 1;
    const pageMargin = 15;
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    let y = 0;

    const addImageToPdf = (imageData: string | null, x: number, y: number, w: number, h: number) => {
        if (imageData && imageData.startsWith('data:image')) {
            try {
                const imageType = imageData.substring(imageData.indexOf('/') + 1, imageData.indexOf(';'));
                doc.addImage(imageData, imageType.toUpperCase(), x, y, w, h);
            } catch (e) { console.error("Error adding image:", e); }
        }
    };
    
    const addPageHeaderAndFooter = () => {
        doc.setFont('helvetica', 'normal');
        // HEADER
        addImageToPdf(instituteData.logo, pageMargin, 10, 15, 15);
        addImageToPdf(teacherData.logo, pageWidth - pageMargin - 15, 10, 15, 15);
        doc.setFontSize(12);
        doc.setTextColor(80);
        doc.text(`Informe de Servicio: ${service.name}`, pageWidth / 2, 15, { align: 'center' });
        doc.setFontSize(10);
        doc.text(new Date(service.date).toLocaleDateString('es-ES', {weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'}), pageWidth / 2, 20, { align: 'center' });
        doc.setDrawColor(200);
        doc.line(pageMargin, 25, pageWidth - pageMargin, 25);
        
        // FOOTER
        doc.line(pageMargin, pageHeight - 15, pageWidth - pageMargin, pageHeight - 15);
        doc.setFontSize(8);
        doc.text(`${instituteData.name || 'IES La Flota'} - ${teacherData.name || 'Juan Codina Barranco'}`, pageMargin, pageHeight - 10);
        doc.text(`Página ${pageCount}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
        doc.text(new Date().toLocaleDateString('es-ES'), pageWidth - pageMargin, pageHeight - 10, { align: 'right' });
    };

    const checkPageBreak = (neededHeight: number) => {
        if (y + neededHeight > pageHeight - 20) {
            addPageHeaderAndFooter();
            doc.addPage();
            pageCount++;
            y = 30;
            return true;
        }
        return false;
    };
    
    // FIX: The 'participatingGroups' variable was defined in a nested scope, causing reference errors. It has been moved to the function's top-level scope to be accessible throughout.
    const participatingGroups = practiceGroups.filter(g => new Set([...service.assignedGroups.comedor, ...service.assignedGroups.takeaway]).has(g.id));

    // --- START DOCUMENT ---
    addPageHeaderAndFooter();
    y = 30;

    // --- PRE-SERVICE ---
    Object.entries(evaluation.preService).forEach(([date, preServiceDay]) => {
        checkPageBreak(20);
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text(`Evaluación Pre-Servicio: ${preServiceDay.name || date}`, pageMargin, y);
        y+= 8;

        participatingGroups.forEach(group => {
            const studentsInGroup = allStudents.filter(s => group.studentIds.includes(s.id));
            const head = [['Alumno', 'Asist.', 'Fichas', 'Unif.', 'Mat.', ...PRE_SERVICE_BEHAVIOR_ITEMS.map(i => i.label), 'Observaciones']];
            const body = studentsInGroup.map(student => {
                const evalData = preServiceDay.individualEvaluations[student.id];
                return [
                    `${student.apellido1}, ${student.nombre}`,
                    evalData?.attendance ? 'Sí' : 'No',
                    evalData?.hasFichas ? 'Sí' : 'No',
                    evalData?.hasUniforme ? 'Sí' : 'No',
                    evalData?.hasMaterial ? 'Sí' : 'No',
                    ...PRE_SERVICE_BEHAVIOR_ITEMS.map(i => BEHAVIOR_RATING_MAP.find(r => r.value === evalData?.behaviorScores[i.id])?.symbol || '-'),
                    evalData?.observations || ''
                ];
            });

            checkPageBreak(15 + body.length * 8);
            doc.setFontSize(12);
            doc.setFont('helvetica', 'normal');
            doc.text(`Grupo: ${group.name}`, pageMargin, y);
            y+= 6;
            
            (doc as any).autoTable({ startY: y, head, body, theme: 'grid', headStyles: { fillColor: [22, 163, 74] }, styles: { fontSize: 8 } });
            y = (doc as any).lastAutoTable.finalY + 10;
        });
    });

    // --- SERVICE DAY ---
    if(checkPageBreak(30)) addPageHeaderAndFooter();
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Evaluación Día de Servicio', pageMargin, y);
    y+= 8;

    // Group Evaluation
    const groupHead = [['Criterio', ...participatingGroups.map(g => g.name)]];
    const groupBody = [
        ...GROUP_EVALUATION_ITEMS.map((item, index) => [item.label, ...participatingGroups.map(g => evaluation.serviceDay.groupScores[g.id]?.scores[index]?.toFixed(2) || '-')]),
        ['TOTAL', ...participatingGroups.map(g => (evaluation.serviceDay.groupScores[g.id]?.scores.reduce((a, b) => a + (b||0), 0) || 0).toFixed(2) )],
        ['Observaciones', ...participatingGroups.map(g => evaluation.serviceDay.groupScores[g.id]?.observations || '')]
    ];
    (doc as any).autoTable({ startY: y, head: groupHead, body: groupBody, theme: 'grid', headStyles: { fillColor: [37, 99, 235] } });
    y = (doc as any).lastAutoTable.finalY + 10;

    // Individual Evaluation
    participatingGroups.forEach(group => {
        const studentsInGroup = allStudents.filter(s => group.studentIds.includes(s.id));
        checkPageBreak(25 + studentsInGroup.length * 8);
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text(`Evaluación Individual - ${group.name}`, pageMargin, y);
        y += 8;
        
        const indHead = [['Alumno', ...INDIVIDUAL_EVALUATION_ITEMS.map(i => i.label), 'TOTAL', 'Observaciones']];
        const indBody = studentsInGroup.map(student => {
            const indEval = evaluation.serviceDay.individualScores[student.id];
            const total = (indEval?.scores.reduce((a, b) => a + (b||0), 0) || 0).toFixed(2);
            return [
                `${student.apellido1}, ${student.nombre}`,
                ...INDIVIDUAL_EVALUATION_ITEMS.map((item, index) => indEval?.scores[index]?.toFixed(2) || '-'),
                total,
                indEval?.observations || ''
            ];
        });
        (doc as any).autoTable({ startY: y, head: indHead, body: indBody, theme: 'grid', headStyles: { fillColor: [147, 51, 234] }, styles: { fontSize: 7, cellWidth: 'auto' } });
        y = (doc as any).lastAutoTable.finalY + 10;
    });

    doc.save(`Informe_Servicio_${service.name.replace(/ /g, '_')}.pdf`);
};

const GestionPracticaView: React.FC<GestionPracticaViewProps> = ({ 
    initialServiceId, initialServiceTab, clearInitialServiceContext 
}) => {
    const {
        students, practiceGroups, services, serviceEvaluations, serviceRoles, 
        entryExitRecords, handleCreateService: contextCreateService, 
        handleSaveServiceAndEvaluation, handleDeleteService,
        teacherData, instituteData, addToast
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
    
    const handleToggleLock = () => {
        if (editedService && editedEvaluation) {
            const action = editedService.isLocked ? 'abrir' : 'cerrar';
            const confirmationMessage = action === 'cerrar'
                ? '¿Estás seguro de que quieres cerrar este servicio? Una vez cerrado, no podrás realizar cambios hasta que lo vuelvas a abrir.'
                : '¿Estás seguro de que quieres abrir este servicio? Podrás volver a editar la planificación y las evaluaciones.';
            
            if (window.confirm(confirmationMessage)) {
                const toggledService = { ...editedService, isLocked: !editedService.isLocked };
                setEditedService(toggledService);
                handleSaveServiceAndEvaluation(toggledService, editedEvaluation);
            }
        }
    };
    
    const handleGeneratePlanningPdf = () => {
        if (!editedService) {
            addToast('No hay un servicio seleccionado para generar el planning.', 'error');
            return;
        }
        try {
            generatePlanningPDF(editedService, students, practiceGroups, serviceRoles, teacherData, instituteData);
        } catch (error) {
            console.error("Fallo al generar el PDF del planning:", error);
            addToast('Error al generar el planning. Revisa que todos los datos del servicio estén correctos.', 'error');
        }
    };
    
    const handleGenerateReport = () => {
        if (!editedService || !editedEvaluation) {
            addToast('No hay datos de servicio o evaluación para generar el informe.', 'error');
            return;
        }
        try {
            generateServiceReportPDF(editedService, editedEvaluation, students, practiceGroups, serviceRoles, teacherData, instituteData);
        } catch (error) {
            console.error("Fallo al generar el PDF del informe:", error);
            addToast('Error al generar el informe. Revisa que todos los datos de evaluación estén completos.', 'error');
        }
    };
    
    const handleServiceFieldChange = (field: keyof Service, value: any) => {
        setEditedService(prev => prev ? { ...prev, [field]: value } : null);
    };
    
    const toggleGroupAssignment = (area: 'comedor' | 'takeaway', groupId: string) => {
        if (!editedService || editedService.isLocked) return;
        const currentAssignments = editedService.assignedGroups[area];
        const newAssignments = currentAssignments.includes(groupId)
            ? currentAssignments.filter(id => id !== groupId)
            : [...currentAssignments, groupId];
        setEditedService({ ...editedService, assignedGroups: { ...editedService.assignedGroups, [area]: newAssignments } });
    };
    
    const handleAddElaboration = (area: 'comedor' | 'takeaway') => {
        if (editedService?.isLocked) return;
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
        if (editedService && !editedService.isLocked) {
            const updatedElaborations = { ...editedService.elaborations, [area]: editedService.elaborations[area].map(e => e.id === id ? { ...e, [field]: value } : e) };
            setEditedService({ ...editedService, elaborations: updatedElaborations });
        }
    };

    const handleDeleteElaboration = (area: 'comedor' | 'takeaway', id: string) => {
        if (editedService && !editedService.isLocked) {
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
        if (!editedService || editedService.isLocked) return;
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

        const isLocked = editedService.isLocked;

        return (
            <div>
                 <header className="flex flex-wrap justify-between items-center gap-4 mb-6 pb-4 border-b">
                    <div className="flex items-center gap-4">
                         <button onClick={handleToggleLock} title={isLocked ? "Abrir servicio" : "Cerrar servicio"}>
                            {isLocked ? <LockClosedIcon className="w-8 h-8 text-red-500 hover:text-red-700" /> : <LockOpenIcon className="w-8 h-8 text-green-500 hover:text-green-700"/>}
                        </button>
                        <div>
                            <input type="text" value={editedService.name} onChange={(e) => handleServiceFieldChange('name', e.target.value)} disabled={isLocked} className="text-3xl font-bold text-gray-800 bg-transparent focus:bg-white focus:ring-1 focus:ring-blue-500 rounded-md p-1 -ml-1 disabled:bg-gray-100"/>
                            <input type="date" value={editedService.date} onChange={(e) => handleServiceFieldChange('date', e.target.value)} disabled={isLocked} className="text-gray-500 mt-1 block bg-transparent focus:bg-white focus:ring-1 focus:ring-blue-500 rounded-md disabled:bg-gray-100"/>
                        </div>
                    </div>
                    <div className="flex items-center space-x-2 flex-wrap gap-2">
                        {isLocked && <button onClick={handleGenerateReport} className="flex items-center bg-purple-500 text-white px-4 py-2 rounded-lg font-semibold hover:bg-purple-600 transition"><FileTextIcon className="w-5 h-5 mr-1" /> Informe de Servicio</button>}
                        <button onClick={handleGeneratePlanningPdf} className="flex items-center bg-blue-500 text-white px-4 py-2 rounded-lg font-semibold hover:bg-blue-600 transition"><PrinterIcon className="w-5 h-5 mr-1" /> Planning</button>
                        {!isLocked && <button onClick={handleSave} className="flex items-center bg-green-500 text-white px-4 py-2 rounded-lg font-semibold hover:bg-green-600 transition"><SaveIcon className="w-5 h-5 mr-1" /> Guardar</button>}
                        {!isLocked && <button onClick={handleDelete} className="flex items-center bg-red-500 text-white px-4 py-2 rounded-lg font-semibold hover:bg-red-600 transition"><TrashIcon className="w-5 h-5" /></button>}
                    </div>
                </header>
                
                {isLocked && (
                    <div className="mb-6 p-4 bg-yellow-100 border-l-4 border-yellow-500 text-yellow-800 rounded-md">
                        <p className="font-bold">Este servicio está cerrado y no puede ser modificado.</p>
                        <p className="text-sm">Toda la información es de solo lectura. Puedes generar el informe final del servicio.</p>
                    </div>
                )}


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
                                        <div className="space-y-2">{practiceGroups.map(group => (<label key={group.id} className="flex items-center p-3 rounded-md hover:bg-gray-50 cursor-pointer"><input type="checkbox" checked={assignedGroupIds.includes(group.id)} onChange={() => toggleGroupAssignment(area, group.id)} disabled={isLocked} className={`h-4 w-4 rounded border-gray-300 text-${areaColor}-600 focus:ring-${areaColor}-500`}/> <span className="ml-3 text-sm font-medium text-gray-800">{group.name}</span></label>))}</div>
                                        <div className="mt-6 border-t pt-4">
                                            <h4 className={`text-lg font-bold mb-3 text-${areaColor}-600`}>Elaboraciones para {area}</h4>
                                            <div className="space-y-3 mb-4">{editedService.elaborations[area].map((elab, index) => (<div key={elab.id} className="flex items-center gap-2 text-sm"><span className="font-semibold text-gray-500">{index + 1}.</span><input type="text" value={elab.name} onChange={e => handleUpdateElaboration(area, elab.id, 'name', e.target.value)} disabled={isLocked} className="flex-grow p-1.5 border-gray-300 rounded-md shadow-sm disabled:bg-gray-100"/><select value={elab.responsibleGroupId || ''} onChange={e => handleUpdateElaboration(area, elab.id, 'responsibleGroupId', e.target.value)} disabled={isLocked} className="p-1.5 border-gray-300 rounded-md shadow-sm disabled:bg-gray-100"><option value="">Asignar...</option>{availableGroupsForElaboration.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}</select><button onClick={() => handleDeleteElaboration(area, elab.id)} disabled={isLocked} className="p-1 text-gray-400 hover:text-red-500 disabled:cursor-not-allowed"><TrashIcon className="w-4 h-4" /></button></div>))}</div>
                                            {!isLocked && (availableGroupsForElaboration.length > 0 ? (<div className="flex items-center gap-2 p-2 bg-gray-50 rounded-md"><input type="text" placeholder="Nombre del nuevo plato" value={newElaboration[area].name} onChange={e => setNewElaboration(p => ({...p, [area]: {...p[area], name: e.target.value}}))} className="flex-grow p-1.5 border-gray-300 rounded-md shadow-sm"/><select value={newElaboration[area].responsibleGroupId} onChange={e => setNewElaboration(p => ({...p, [area]: {...p[area], responsibleGroupId: e.target.value}}))} className="p-1.5 border-gray-300 rounded-md shadow-sm"><option value="">Seleccionar grupo...</option>{availableGroupsForElaboration.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}</select><button onClick={() => handleAddElaboration(area)} className={`bg-${areaColor}-500 text-white px-3 py-1.5 rounded-md font-semibold hover:bg-${areaColor}-600`}>Añadir</button></div>) : (<p className="text-sm text-gray-500 text-center p-2 bg-gray-50 rounded-md">Asigna al menos un grupo a esta área para poder añadir elaboraciones.</p>))}
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
                                                    {studentsInGroup.map(student => (<tr key={student.id} className={`border-b hover:bg-gray-50 border-l-4 ${group.color.split(' ')[1]}`}><td className="px-4 py-2 font-medium text-gray-800">{`${student.apellido1} ${student.apellido2}, ${student.nombre}`}</td><td className="px-4 py-2"><select value={editedService.studentRoles.find(sr => sr.studentId === student.id)?.roleId || ''} onChange={e => handleStudentRoleChange(student.id, e.target.value || null)} disabled={isLocked} className="w-full p-1.5 border-gray-300 rounded-md shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50 disabled:bg-gray-100"><option value="">Sin asignar</option>{serviceRoles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</select></td></tr>))}
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
                           isLocked={isLocked}
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
                    {sortedServices.map(service => (<li key={service.id}><a href="#" onClick={(e) => { e.preventDefault(); setSelectedServiceId(service.id); setMainTab('planning'); }} className={`block p-3 rounded-lg transition-colors ${selectedServiceId === service.id ? 'bg-blue-100' : 'hover:bg-gray-100'}`}><div className="flex justify-between items-center"><p className={`font-semibold ${selectedServiceId === service.id ? 'text-blue-800' : 'text-gray-800'}`}>{service.name}</p> {service.isLocked && <LockClosedIcon className="w-4 h-4 text-gray-500" />}</div><p className="text-sm text-gray-500">{new Date(service.date).toLocaleDateString('es-ES')}</p></a></li>))}
                </ul>
            </aside>
            <main className="flex-1 p-4 sm:p-6 bg-gray-50 overflow-y-auto">{renderWorkspace()}</main>
        </div>
    );
};

export default GestionPracticaView;