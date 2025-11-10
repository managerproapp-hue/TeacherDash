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

// FIX: Added helper function to add images to PDF safely.
const addImageToPdf = (doc: jsPDF, imageData: string | null, x: number, y: number, w: number, h: number) => {
    if (imageData && imageData.startsWith('data:image')) {
        try {
            const imageType = imageData.substring(imageData.indexOf('/') + 1, imageData.indexOf(';'));
            doc.addImage(imageData, imageType.toUpperCase(), x, y, w, h);
        } catch (e) { console.error("Error adding image:", e); }
    }
};

// FIX: Defined generatePlanningPDF function to generate a planning document.
const generatePlanningPDF = (
    doc: jsPDF,
    viewModel: any,
    teacherData: TeacherData,
    instituteData: InstituteData
) => {
    const { service, serviceRoles, practiceGroups, participatingStudents } = viewModel;
    const pageMargin = 15;
    const pageWidth = doc.internal.pageSize.getWidth();
    let startY = 35;

    const didDrawPage = (data: any) => {
        // Header
        addImageToPdf(doc, instituteData.logo, pageMargin, 10, 15, 15);
        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text(instituteData.name || 'Nombre del Centro', pageMargin + 17, 15);
        
        addImageToPdf(doc, teacherData.logo, pageWidth - pageMargin - 15, 10, 15, 15);
        doc.text(teacherData.name || 'Nombre del Profesor', pageWidth - pageMargin - 17, 15, { align: 'right' });
        
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(40);
        doc.text(`Planning de Servicio: ${service.name}`, pageWidth / 2, 20, { align: 'center' });
        doc.setFontSize(12);
        doc.setFont('helvetica', 'normal');
        doc.text(`Fecha: ${new Date(service.date + 'T12:00:00Z').toLocaleDateString('es-ES')}`, pageWidth / 2, 26, { align: 'center' });

        doc.setDrawColor(180);
        doc.line(pageMargin, 30, pageWidth - pageMargin, 30);
    };

    didDrawPage({ pageNumber: 1 });

    // Puestos Jefe
    const leaderRoles = serviceRoles.filter((r: ServiceRole) => r.type === 'leader');
    const leaderAssignments = (service.studentRoles || [])
        .map((sr: any) => {
            const role = leaderRoles.find((r: ServiceRole) => r.id === sr.roleId);
            if (role) {
                const student = participatingStudents.find((s: Student) => s.id === sr.studentId);
                return { role, student };
            }
            return null;
        })
        .filter(Boolean);

    if (leaderAssignments.length > 0) {
        (doc as any).autoTable({
            startY: startY,
            head: [['Puesto de Liderazgo', 'Alumno Asignado']],
            body: leaderAssignments.map((a: any) => [a.role.name, a.student ? `${a.student.nombre} ${a.student.apellido1}` : 'Sin asignar']),
            theme: 'striped',
            headStyles: { fillColor: [41, 128, 185] },
        });
        startY = (doc as any).lastAutoTable.finalY + 10;
    }

    // Comedor y Takeaway
    ['comedor', 'takeaway'].forEach(area => {
        const assignedGroupIds = service.assignedGroups[area] || [];
        if (assignedGroupIds.length === 0) return;
        
        const areaTitle = area.charAt(0).toUpperCase() + area.slice(1);
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text(areaTitle, pageMargin, startY);
        startY += 6;

        const groups = practiceGroups.filter((g: PracticeGroup) => assignedGroupIds.includes(g.id));
        const groupNames = groups.map((g: PracticeGroup) => g.name).join(', ');
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text(`Grupos: ${groupNames}`, pageMargin, startY);
        startY += 8;

        const elaborations = service.elaborations[area] || [];
        if (elaborations.length > 0) {
            (doc as any).autoTable({
                startY: startY,
                head: [['Elaboración / Plato', 'Grupo Responsable']],
                body: elaborations.map((e: Elaboration) => {
                    const group = practiceGroups.find((g: PracticeGroup) => g.id === e.responsibleGroupId);
                    return [e.name, group ? group.name : 'N/A'];
                }),
                theme: 'grid',
            });
            startY = (doc as any).lastAutoTable.finalY + 10;
        } else {
             startY += 5;
        }
    });
};

// FIX: Defined generateTrackingSheetPDF function to generate a tracking sheet.
const generateTrackingSheetPDF = (
    doc: jsPDF,
    viewModel: any,
    teacherData: TeacherData,
    instituteData: InstituteData
) => {
    const { service, participatingGroups, allStudents } = viewModel;
    const pageMargin = 15;
    const pageWidth = doc.internal.pageSize.getWidth();

    const didDrawPageForGroup = (data: any, groupName: string) => {
        // Header
        addImageToPdf(doc, instituteData.logo, pageMargin, 10, 15, 15);
        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text(instituteData.name || 'Nombre del Centro', pageMargin + 17, 15);
        
        addImageToPdf(doc, teacherData.logo, pageWidth - pageMargin - 15, 10, 15, 15);
        doc.text(teacherData.name || 'Nombre del Profesor', pageWidth - pageMargin - 17, 15, { align: 'right' });
        
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(40);
        doc.text(`Ficha de Seguimiento: ${service.name}`, pageWidth / 2, 20, { align: 'center' });
        doc.setFontSize(12);
        doc.setFont('helvetica', 'normal');
        doc.text(`Grupo: ${groupName} | Fecha: ${new Date(service.date + 'T12:00:00Z').toLocaleDateString('es-ES')}`, pageWidth / 2, 26, { align: 'center' });
        
        doc.setDrawColor(180);
        doc.line(pageMargin, 30, pageWidth - pageMargin, 30);
    };

    participatingGroups.forEach((group: PracticeGroup, index: number) => {
        if (index > 0) doc.addPage();
        
        let startY = 35;
        const studentsInGroup = allStudents.filter((s: Student) => group.studentIds.includes(s.id));

        // Group Evaluation Table
        (doc as any).autoTable({
            startY: startY,
            head: [['Criterios de Evaluación Grupal', 'Puntuación']],
            body: GROUP_EVALUATION_ITEMS.map(item => [`${item.label} (max: ${item.maxScore.toFixed(2)})`, '']),
            theme: 'grid',
            headStyles: { fillColor: [41, 128, 185] },
            didDrawPage: (data: any) => didDrawPageForGroup(data, group.name)
        });
        startY = (doc as any).lastAutoTable.finalY + 5;
        (doc as any).autoTable({
            startY: startY,
            body: [['Observaciones Grupales', '']],
            theme: 'grid',
        });
        startY = (doc as any).lastAutoTable.finalY + 10;

        // Individual Evaluation Table
        const individualHead = [
            ['Criterios de Evaluación Individual', ...studentsInGroup.map((s: Student) => `${s.apellido1} ${s.nombre.charAt(0)}.`)]
        ];
        const individualBody = INDIVIDUAL_EVALUATION_ITEMS.map(item => [`${item.label} (max: ${item.maxScore.toFixed(2)})`, ...Array(studentsInGroup.length).fill('')]);
        
        (doc as any).autoTable({
            startY: startY,
            head: individualHead,
            body: individualBody,
            theme: 'grid',
            headStyles: { fillColor: [34, 139, 34] },
            didDrawPage: (data: any) => didDrawPageForGroup(data, group.name)
        });
        startY = (doc as any).lastAutoTable.finalY + 5;
         (doc as any).autoTable({
            startY: startY,
            body: [['Observaciones Individuales', ...Array(studentsInGroup.length).fill('')]],
            theme: 'grid',
        });
    });
};

// --- PDF Generation Logic (Moved and Adapted) ---
const generatePdfFromViewModel = (
    reportType: ReportType,
    viewModel: any,
    teacherData: TeacherData,
    instituteData: InstituteData
) => {
    const { service } = viewModel;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    
    // Example call
    if (reportType === 'planning') {
        generatePlanningPDF(doc, viewModel, teacherData, instituteData);
    } else if (reportType === 'tracking') {
        generateTrackingSheetPDF(doc, viewModel, teacherData, instituteData);
    } // ... etc for other reports

    const fileName = `${reportType}_${service.name.replace(/ /g, '_')}.pdf`;
    doc.save(fileName);
};


const ReportsCenterModal: React.FC<ReportsCenterModalProps> = ({ isOpen, onClose, ...props }) => {
    const [activeReport, setActiveReport] = useState<ReportType | null>(null);

    const viewModel = useMemo(() => {
        const { service, evaluation, allStudents, practiceGroups, serviceRoles } = props;

        // --- Data Normalization ---
        const normalizedService = {
            ...service,
            assignedGroups: service.assignedGroups ?? { comedor: [], takeaway: [] },
            elaborations: service.elaborations ?? { comedor: [], takeaway: [] },
            studentRoles: service.studentRoles ?? [],
        };
        normalizedService.assignedGroups.comedor = normalizedService.assignedGroups.comedor ?? [];
        normalizedService.assignedGroups.takeaway = normalizedService.assignedGroups.takeaway ?? [];
        normalizedService.elaborations.comedor = normalizedService.elaborations.comedor ?? [];
        normalizedService.elaborations.takeaway = normalizedService.elaborations.takeaway ?? [];

        const normalizedEvaluation = evaluation ? {
            ...evaluation,
            preService: evaluation.preService ?? {},
            serviceDay: evaluation.serviceDay ?? { groupScores: {}, individualScores: {} },
        } : null;

        const participatingGroupIds = new Set([...normalizedService.assignedGroups.comedor, ...normalizedService.assignedGroups.takeaway]);
        const participatingGroups = practiceGroups.filter(g => participatingGroupIds.has(g.id));
        const participatingStudentIds = new Set(participatingGroups.flatMap(g => g.studentIds));
        const participatingStudents = allStudents.filter(s => participatingStudentIds.has(s.id))
            .sort((a, b) => a.apellido1.localeCompare(b.apellido1) || a.nombre.localeCompare(b.nombre));

        return {
            service: normalizedService,
            evaluation: normalizedEvaluation,
            participatingGroups,
            participatingStudents,
            allStudents,
            practiceGroups,
            serviceRoles,
        };
    }, [props.service, props.evaluation, props.allStudents, props.practiceGroups, props.serviceRoles]);

    if (!isOpen) return null;

    const handleDownload = () => {
        if (activeReport) {
            generatePdfFromViewModel(activeReport, viewModel, props.teacherData, props.instituteData);
        }
    };

    const renderPreview = () => {
        if (!activeReport) {
            return (
                <div className="flex items-center justify-center h-full text-gray-500">
                    <p>Selecciona un informe del menú para ver una previsualización.</p>
                </div>
            );
        }

        const { service, evaluation, participatingGroups, allStudents, serviceRoles } = viewModel;
        
        // This is a simplified preview. A real one would be more detailed.
        switch (activeReport) {
            case 'planning':
                return <div><h3 className="font-bold text-lg mb-2">Previsualización del Planning</h3><p>Líderes: { (service.studentRoles || []).filter(sr => serviceRoles.find(r => r.id === sr.roleId)?.type === 'leader').length }</p><p>Grupos en Comedor: { (service.assignedGroups.comedor || []).length }</p><p>Platos en Comedor: { (service.elaborations.comedor || []).length }</p><p>Grupos en Takeaway: { (service.assignedGroups.takeaway || []).length }</p><p>Platos en Takeaway: { (service.elaborations.takeaway || []).length }</p></div>;
            case 'tracking':
                return <div><h3 className="font-bold text-lg mb-2">Previsualización de Ficha de Seguimiento</h3><p>Se generará una página por cada uno de los {participatingGroups.length} grupos participantes.</p></div>;
            case 'studentDetail':
                 return <div><h3 className="font-bold text-lg mb-2">Previsualización de Informe por Alumno</h3><p>Se generará un informe detallado para cada uno de los {viewModel.participatingStudents.length} alumnos participantes.</p></div>;
            case 'finalReport':
                return <div><h3 className="font-bold text-lg mb-2">Previsualización de Informe Final</h3><p>Se generará un informe consolidado con las evaluaciones grupales e individuales del servicio.</p></div>;
            default:
                return null;
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
                                    <button 
                                        onClick={() => setActiveReport(opt.id as ReportType)}
                                        className={`w-full flex items-center text-left p-3 rounded-lg text-sm font-medium transition-colors ${activeReport === opt.id ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-200'}`}
                                    >
                                        <opt.icon className="w-5 h-5 mr-3 flex-shrink-0" />
                                        {opt.label}
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </aside>
                    <main className="flex-1 p-6 flex flex-col overflow-hidden">
                        <div className="flex-1 bg-gray-100 rounded-lg p-6 border border-dashed overflow-y-auto">
                            {renderPreview()}
                        </div>
                        <footer className="pt-4 mt-4 border-t flex justify-end">
                            <button 
                                onClick={handleDownload}
                                disabled={!activeReport}
                                className="bg-green-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-green-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed"
                            >
                                Descargar PDF
                            </button>
                        </footer>
                    </main>
                </div>
            </div>
        </div>
    );
};

export default ReportsCenterModal;
