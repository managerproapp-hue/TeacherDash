import React, { useState, useMemo } from 'react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { Service, ServiceEvaluation, Elaboration, Student, PracticeGroup, ServiceRole, TeacherData, InstituteData } from '../types';
import { PRE_SERVICE_BEHAVIOR_ITEMS, BEHAVIOR_RATING_MAP, GROUP_EVALUATION_ITEMS, INDIVIDUAL_EVALUATION_ITEMS } from '../data/constants';
import { XIcon, FileTextIcon, PrinterIcon, UsersIcon } from './icons';

interface ReportsCenterModalProps {
    isOpen: boolean;
    onClose: () => void;
    service: Service;
    evaluation: ServiceEvaluation;
    allStudents: Student[];
    practiceGroups: PracticeGroup[];
    serviceRoles: ServiceRole[];
    teacherData: TeacherData;
    instituteData: InstituteData;
}

type ReportType = 'tracking' | 'planning' | 'studentDetail' | 'finalReport';

// --- PDF Generation Helpers ---

const addImageToPdf = (doc: jsPDF, imageData: string | null, x: number, y: number, w: number, h: number) => {
    if (imageData && imageData.startsWith('data:image')) {
        try {
            const imageType = imageData.substring(imageData.indexOf('/') + 1, imageData.indexOf(';'));
            doc.addImage(imageData, imageType.toUpperCase(), x, y, w, h);
        } catch (e) { console.error("Error adding image:", e); }
    }
};

const addHeaderAndFooter = (
    doc: jsPDF,
    title: string,
    teacherData: TeacherData,
    instituteData: InstituteData
) => {
    const pageCount = doc.internal.pages.length > 1 ? doc.internal.pages.length - 1 : 1;
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        const pageMargin = 15;
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();

        // HEADER
        addImageToPdf(doc, instituteData.logo, pageMargin, 10, 15, 15);
        addImageToPdf(doc, teacherData.logo, pageWidth - pageMargin - 15, 10, 15, 15);
        
        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text(instituteData.name || 'Instituto', pageMargin + 17, 15);
        doc.text(teacherData.name || 'Profesor', pageWidth - pageMargin - 17, 15, { align: 'right' });

        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(40);
        doc.text(title, pageWidth / 2, 20, { align: 'center' });
        
        doc.setDrawColor(180);
        doc.line(pageMargin, 28, pageWidth - pageMargin, 28);

        // FOOTER
        doc.setFontSize(8);
        doc.setTextColor(120);
        doc.line(pageMargin, pageHeight - 15, pageWidth - pageMargin, pageHeight - 15);
        doc.text(`Página ${i} de ${pageCount}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
        const dateStr = new Date().toLocaleDateString('es-ES');
        doc.text(dateStr, pageWidth - pageMargin, pageHeight - 10, { align: 'right' });
    }
};

const didDrawPageCallback = (doc: jsPDF, title: string, teacherData: TeacherData, instituteData: InstituteData) => (data: any) => {
    const pageMargin = 15;
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    // HEADER
    addImageToPdf(doc, instituteData.logo, pageMargin, 10, 15, 15);
    addImageToPdf(doc, teacherData.logo, pageWidth - pageMargin - 15, 10, 15, 15);
    doc.setFontSize(10); doc.setTextColor(100);
    doc.text(instituteData.name || 'Instituto', pageMargin + 17, 15);
    doc.text(teacherData.name || 'Profesor', pageWidth - pageMargin - 17, 15, { align: 'right' });
    doc.setFontSize(16); doc.setFont('helvetica', 'bold'); doc.setTextColor(40);
    doc.text(title, pageWidth / 2, 20, { align: 'center' });
    doc.setDrawColor(180); doc.line(pageMargin, 28, pageWidth - pageMargin, 28);
    // FOOTER
    const pageNum = doc.internal.pages.length > 1 ? doc.internal.getCurrentPageInfo().pageNumber : 1;
    doc.setFontSize(8); doc.setTextColor(120);
    doc.line(pageMargin, pageHeight - 15, pageWidth - pageMargin, pageHeight - 15);
    doc.text(`Página ${pageNum}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
    const dateStr = new Date().toLocaleDateString('es-ES');
    doc.text(dateStr, pageWidth - pageMargin, pageHeight - 10, { align: 'right' });
};


// --- PDF Generation Functions ---

const generateTrackingSheetPDF = (doc: jsPDF, viewModel: any, teacherData: TeacherData, instituteData: InstituteData) => {
    const { service, participatingGroups, allStudents } = viewModel;

    participatingGroups.forEach((group: PracticeGroup, index: number) => {
        if (index > 0) doc.addPage();
        const studentsInGroup = allStudents.filter((s: Student) => group.studentIds.includes(s.id));
        const didDrawPage = didDrawPageCallback(doc, `Ficha Seguimiento: ${service.name} - ${group.name}`, teacherData, instituteData);

        (doc as any).autoTable({
            startY: 35,
            head: [['Alumnos del Grupo', 'Puesto']],
            body: studentsInGroup.map((s: Student) => {
                const role = service.studentRoles.find((sr: any) => sr.studentId === s.id);
                const roleName = role ? viewModel.serviceRoles.find((r: ServiceRole) => r.id === role.roleId)?.name : 'Sin asignar';
                return [`${s.apellido1} ${s.apellido2}, ${s.nombre}`, roleName];
            }),
            theme: 'striped', headStyles: { fillColor: [41, 128, 185] }, didDrawPage
        });
        let lastY = (doc as any).lastAutoTable.finalY;
        
        (doc as any).autoTable({ startY: lastY + 5, head: [['Observaciones Grupales', '']], body: [['', '']], theme: 'grid', tableHeight: 'auto', styles: { minCellHeight: 40 }, didDrawPage });
        lastY = (doc as any).lastAutoTable.finalY;
        
        (doc as any).autoTable({ startY: lastY + 5, head: [['Observaciones Individuales', '']], body: studentsInGroup.map((s: Student) => [`${s.apellido1} ${s.nombre.charAt(0)}.`,'']), theme: 'grid', styles: { minCellHeight: 20 }, didDrawPage });
    });
};

const generatePlanningPDF = (doc: jsPDF, viewModel: any, teacherData: TeacherData, instituteData: InstituteData) => {
    const { service, serviceRoles, practiceGroups, allStudents } = viewModel;
    const pageMargin = 15;
    const didDrawPage = didDrawPageCallback(doc, `Planning: ${service.name}`, teacherData, instituteData);
    let startY = 35;

    const leaderRoles = serviceRoles.filter((r: ServiceRole) => r.type === 'leader');
    const leaderAssignments = (service.studentRoles || []).map((sr: any) => {
        const role = leaderRoles.find((r: ServiceRole) => r.id === sr.roleId);
        if (role) {
            const student = allStudents.find((s: Student) => s.id === sr.studentId);
            return { role, student };
        }
        return null;
    }).filter(Boolean);

    (doc as any).autoTable({ startY, head: [['Líderes del Servicio', 'Alumno']], body: leaderAssignments.map((a: any) => [a.role.name, a.student ? `${a.student.nombre} ${a.student.apellido1}` : 'Sin asignar']), theme: 'striped', headStyles: { fillColor: [41, 128, 185] }, didDrawPage });
    startY = (doc as any).lastAutoTable.finalY + 10;

    ['comedor', 'takeaway'].forEach(area => {
        const assignedGroupIds = service.assignedGroups[area] || [];
        if (assignedGroupIds.length === 0) return;
        const areaTitle = `SERVICIO DE ${area.toUpperCase()}`;
        (doc as any).autoTable({ startY, head: [[{content: areaTitle, styles: {fillColor: '#4CAF50', textColor: '#ffffff', halign: 'center'}}]], theme: 'plain', didDrawPage });
        startY = (doc as any).lastAutoTable.finalY + 2;

        const groupsInArea = practiceGroups.filter((g: PracticeGroup) => assignedGroupIds.includes(g.id));
        const elaborations = service.elaborations[area] || [];

        (doc as any).autoTable({ startY, head: [['Elaboraciones', 'Grupo Responsable']], body: elaborations.map((e: Elaboration) => [e.name, practiceGroups.find((g: PracticeGroup) => g.id === e.responsibleGroupId)?.name || 'N/A']), theme: 'grid', didDrawPage });
        startY = (doc as any).lastAutoTable.finalY + 8;
        
        groupsInArea.forEach((group: PracticeGroup) => {
            const studentsInGroup = allStudents.filter((s: Student) => group.studentIds.includes(s.id)).sort((a: Student, b: Student) => a.apellido1.localeCompare(b.apellido1));
            const studentBody = studentsInGroup.map((student: Student) => {
                const assignment = (service.studentRoles || []).find((sr: any) => sr.studentId === student.id);
                const role = assignment ? serviceRoles.find((r: ServiceRole) => r.id === assignment.roleId) : null;
                return [`${student.apellido1} ${student.apellido2}, ${student.nombre}`, role ? role.name : 'Sin asignar'];
            });
            (doc as any).autoTable({ startY, head: [[{content: group.name, styles: {fontStyle: 'bold'}}], ['Alumno', 'Puesto']], body: studentBody, theme: 'striped', didDrawPage });
            startY = (doc as any).lastAutoTable.finalY + 8;
        });
    });
};

const generateDetailedStudentReportsPDF = (doc: jsPDF, viewModel: any, teacherData: TeacherData, instituteData: InstituteData) => {
    const { service, evaluation, participatingStudents, practiceGroups, serviceRoles } = viewModel;

    participatingStudents.forEach((student: Student, index: number) => {
        if (index > 0) doc.addPage();
        const didDrawPage = didDrawPageCallback(doc, `Informe Alumno: ${service.name}`, teacherData, instituteData);
        let startY = 35;
        const studentGroup = practiceGroups.find((g: PracticeGroup) => g.studentIds.includes(student.id));
        const studentRole = serviceRoles.find((r: ServiceRole) => r.id === service.studentRoles.find((sr: any) => sr.studentId === student.id)?.roleId);

        (doc as any).autoTable({ startY, head: [['Alumno', 'Grupo', 'Puesto']], body: [[`${student.apellido1} ${student.apellido2}, ${student.nombre}`, studentGroup?.name || 'N/A', studentRole?.name || 'N/A']], theme: 'grid', headStyles: { fillColor: [41, 128, 185] }, didDrawPage });
        startY = (doc as any).lastAutoTable.finalY + 8;

        Object.entries(evaluation.preService).forEach(([date, preServiceDay]: [string, any]) => {
            const indEval = preServiceDay.individualEvaluations[student.id];
            if (!indEval) return;
            const body = [
                ['Asistencia', indEval.attendance ? 'Sí' : 'No'],
                ['Fichas', indEval.hasFichas ? 'Sí' : 'No'],
                ['Uniforme', indEval.hasUniforme ? 'Sí' : 'No'],
                ['Material', indEval.hasMaterial ? 'Sí' : 'No'],
                ...PRE_SERVICE_BEHAVIOR_ITEMS.map(item => [item.label, BEHAVIOR_RATING_MAP.find(r => r.value === indEval.behaviorScores[item.id])?.symbol || '-']),
                ['Observaciones', indEval.observations || 'Sin observaciones']
            ];
            (doc as any).autoTable({ startY, head: [[`Evaluación Pre-Servicio (${new Date(date + 'T12:00:00Z').toLocaleDateString('es-ES')})`, '']], body, theme: 'grid', headStyles: { fillColor: [34, 139, 34] }, didDrawPage });
            startY = (doc as any).lastAutoTable.finalY + 8;
        });

        const serviceDayIndEval = evaluation.serviceDay.individualScores[student.id];
        if (serviceDayIndEval) {
            const totalScore = (serviceDayIndEval.scores || []).reduce((sum: number, s: number | null) => sum + (s || 0), 0);
            const body = INDIVIDUAL_EVALUATION_ITEMS.map((item, i) => [item.label, serviceDayIndEval.scores[i]?.toFixed(2) ?? '-']);
            body.push([{content: 'TOTAL', styles: {fontStyle: 'bold'}}, {content: totalScore.toFixed(2), styles: {fontStyle: 'bold'}}]);
            body.push(['Observaciones', serviceDayIndEval.observations || 'Sin observaciones']);
            (doc as any).autoTable({ startY, head: [['Evaluación Individual (Día Servicio)', 'Puntuación']], body, theme: 'grid', headStyles: { fillColor: [218, 165, 32] }, didDrawPage });
            startY = (doc as any).lastAutoTable.finalY + 8;
        }
    });
};

const generateServiceReportPDF = (doc: jsPDF, viewModel: any, teacherData: TeacherData, instituteData: InstituteData) => {
    const { service, evaluation, participatingGroups } = viewModel;
    const didDrawPage = didDrawPageCallback(doc, `Informe Final: ${service.name}`, teacherData, instituteData);
    let startY = 35;

    (doc as any).autoTable({ startY, head: [[`Resumen del Servicio: ${service.name}`]], theme: 'plain', didDrawPage });
    startY = (doc as any).lastAutoTable.finalY + 8;
    
    (doc as any).autoTable({ startY, head: [['Evaluación Grupal']], theme: 'plain', headStyles: {fontStyle: 'bold'}, didDrawPage });
    startY = (doc as any).lastAutoTable.finalY;
    
    participatingGroups.forEach((group: PracticeGroup) => {
        const groupEval = evaluation.serviceDay.groupScores[group.id];
        if(!groupEval) return;
        const totalScore = (groupEval.scores || []).reduce((sum: number, s: number | null) => sum + (s || 0), 0);
        const body = GROUP_EVALUATION_ITEMS.map((item, i) => [item.label, groupEval.scores[i]?.toFixed(2) ?? '-']);
        body.push([{content: 'TOTAL', styles: {fontStyle: 'bold'}}, {content: totalScore.toFixed(2), styles: {fontStyle: 'bold'}}]);
        body.push(['Observaciones', groupEval.observations || 'Sin observaciones']);
        (doc as any).autoTable({ startY, head: [[group.name, 'Puntuación']], body, theme: 'grid', headStyles: { fillColor: [41, 128, 185] }, didDrawPage });
        startY = (doc as any).lastAutoTable.finalY + 8;
    });
};


const generatePdfFromViewModel = (reportType: ReportType, viewModel: any, teacherData: TeacherData, instituteData: InstituteData) => {
    const { service } = viewModel;
    const orientation = (reportType === 'planning') ? 'landscape' : 'portrait';
    const doc = new jsPDF({ orientation, unit: 'mm', format: 'a4' });
    
    if (reportType === 'planning') generatePlanningPDF(doc, viewModel, teacherData, instituteData);
    else if (reportType === 'tracking') generateTrackingSheetPDF(doc, viewModel, teacherData, instituteData);
    else if (reportType === 'studentDetail') generateDetailedStudentReportsPDF(doc, viewModel, teacherData, instituteData);
    else if (reportType === 'finalReport') generateServiceReportPDF(doc, viewModel, teacherData, instituteData);

    const fileName = `${reportType}_${service.name.replace(/ /g, '_')}.pdf`;
    doc.save(fileName);
};

// --- Component ---

const ReportsCenterModal: React.FC<ReportsCenterModalProps> = ({ isOpen, onClose, ...props }) => {
    const [activeReport, setActiveReport] = useState<ReportType | null>(null);

    const viewModel = useMemo(() => {
        const { service, evaluation, allStudents, practiceGroups, serviceRoles } = props;
        const normalizedService = { ...service, assignedGroups: service.assignedGroups ?? { comedor: [], takeaway: [] }, elaborations: service.elaborations ?? { comedor: [], takeaway: [] }, studentRoles: service.studentRoles ?? [] };
        normalizedService.assignedGroups.comedor = normalizedService.assignedGroups.comedor ?? [];
        normalizedService.assignedGroups.takeaway = normalizedService.assignedGroups.takeaway ?? [];
        normalizedService.elaborations.comedor = normalizedService.elaborations.comedor ?? [];
        normalizedService.elaborations.takeaway = normalizedService.elaborations.takeaway ?? [];
        const participatingGroupIds = new Set([...normalizedService.assignedGroups.comedor, ...normalizedService.assignedGroups.takeaway]);
        const participatingGroups = practiceGroups.filter(g => participatingGroupIds.has(g.id));
        const participatingStudentIds = new Set(participatingGroups.flatMap(g => g.studentIds));
        const participatingStudents = allStudents.filter(s => participatingStudentIds.has(s.id)).sort((a, b) => a.apellido1.localeCompare(b.apellido1) || a.nombre.localeCompare(b.nombre));
        return { service: normalizedService, evaluation: evaluation!, participatingGroups, participatingStudents, allStudents, practiceGroups, serviceRoles };
    }, [props.service, props.evaluation, props.allStudents, props.practiceGroups, props.serviceRoles]);

    if (!isOpen) return null;

    const handleDownload = () => {
        if (activeReport) generatePdfFromViewModel(activeReport, viewModel, props.teacherData, props.instituteData);
    };

    const renderPreview = () => {
        if (!activeReport) return <div className="flex items-center justify-center h-full text-gray-500"><p>Selecciona un informe del menú para ver una previsualización.</p></div>;
        switch (activeReport) {
            case 'planning': return <div><h3 className="font-bold text-lg mb-2">Previsualización del Planning</h3><p>Este informe detalla los líderes del servicio, los grupos asignados a comedor y takeaway, los platos que elabora cada grupo y la lista de alumnos con sus puestos. Ideal para la organización del día.</p></div>;
            case 'tracking': return <div><h3 className="font-bold text-lg mb-2">Previsualización de Ficha de Seguimiento</h3><p>Genera un documento para imprimir, con una página por cada grupo. Incluye espacios para tomar notas sobre la evaluación grupal e individual durante el servicio.</p></div>;
            case 'studentDetail': return <div><h3 className="font-bold text-lg mb-2">Previsualización de Informe por Alumno</h3><p>Crea un PDF exhaustivo con una sección para cada alumno participante, detallando sus evaluaciones de pre-servicio, del día de servicio y la de su grupo.</p></div>;
            case 'finalReport': return <div><h3 className="font-bold text-lg mb-2">Previsualización de Informe Final</h3><p>Genera un informe consolidado con las evaluaciones grupales e individuales de todo el servicio. Perfecto como resumen final.</p></div>;
            default: return null;
        }
    };

    const reportOptions = [
        { id: 'tracking', label: 'Ficha de Seguimiento', icon: FileTextIcon },
        { id: 'planning', label: 'Planning del Servicio', icon: PrinterIcon },
        { id: 'studentDetail', label: 'Informe por Alumno', icon: UsersIcon },
        ...(viewModel.service.isLocked ? [{ id: 'finalReport', label: 'Informe Final de Servicio', icon: FileTextIcon }] : []),
    ];

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <header className="flex justify-between items-center p-4 border-b">
                    <h2 className="text-xl font-bold text-gray-800">Centro de Informes: {viewModel.service.name}</h2>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-200"><XIcon className="w-6 h-6" /></button>
                </header>
                <div className="flex flex-1 overflow-hidden">
                    <aside className="w-1/4 bg-gray-50 border-r p-4 overflow-y-auto">
                        <h3 className="text-sm font-semibold text-gray-500 mb-3">Informes Disponibles</h3>
                        <ul className="space-y-2">
                            {reportOptions.map(opt => (
                                <li key={opt.id}>
                                    <button onClick={() => setActiveReport(opt.id as ReportType)} className={`w-full flex items-center text-left p-3 rounded-lg text-sm font-medium transition-colors ${activeReport === opt.id ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-200'}`}><opt.icon className="w-5 h-5 mr-3 flex-shrink-0" />{opt.label}</button>
                                </li>
                            ))}
                        </ul>
                    </aside>
                    <main className="flex-1 p-6 flex flex-col overflow-hidden">
                        <div className="flex-1 bg-gray-100 rounded-lg p-6 border border-dashed overflow-y-auto">{renderPreview()}</div>
                        <footer className="pt-4 mt-4 border-t flex justify-end">
                            <button onClick={handleDownload} disabled={!activeReport} className="bg-green-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-green-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed">Descargar PDF</button>
                        </footer>
                    </main>
                </div>
            </div>
        </div>
    );
};

export default ReportsCenterModal;
