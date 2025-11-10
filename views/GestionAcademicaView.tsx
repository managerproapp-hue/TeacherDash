import React, { useState, useMemo, useEffect } from 'react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { Student, CourseModuleGrades, GradeValue, StudentCalculatedGrades } from '../types';
import { ACADEMIC_EVALUATION_STRUCTURE, COURSE_MODULES } from '../data/constants';
import { ClipboardListIcon, SaveIcon, ExportIcon } from '../components/icons';
import { useAppContext } from '../context/AppContext';

const generateAcademicReportPDF = (
    students: Student[],
    finalGradesAndAverages: any,
    localCourseGrades: any,
    calculatedStudentGrades: Record<string, StudentCalculatedGrades>,
    localAcademicGrades: any,
    teacherData: any,
    instituteData: any
) => {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const pageMargin = 10;
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    const addImageToPdf = (imageData: string | null, x: number, y: number, w: number, h: number) => {
        if (imageData && imageData.startsWith('data:image')) {
            try {
                const imageType = imageData.substring(imageData.indexOf('/') + 1, imageData.indexOf(';'));
                doc.addImage(imageData, imageType.toUpperCase(), x, y, w, h);
            } catch (e) { console.error("Error adding image:", e); }
        }
    };

    const addPageHeaderAndFooter = (data: any, title: string) => {
        doc.setFont('helvetica', 'normal');
        addImageToPdf(instituteData.logo, pageMargin, 5, 15, 15);
        addImageToPdf(teacherData.logo, pageWidth - pageMargin - 15, 5, 15, 15);
        doc.setFontSize(14);
        doc.setTextColor(80);
        doc.text(title, pageWidth / 2, 15, { align: 'center' });
        doc.setDrawColor(200);
        doc.line(pageMargin, 22, pageWidth - pageMargin, 22);
        
        doc.line(pageMargin, pageHeight - 15, pageWidth - pageMargin, pageHeight - 15);
        doc.setFontSize(8);
        doc.setTextColor(120);
        doc.text(`Página ${data.pageNumber}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
    };

    // --- Table 1: Módulo Principal ---
    const principalHeadRow1: any = [
        { content: 'Alumno', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
        ...ACADEMIC_EVALUATION_STRUCTURE.periods.map(p => ({ content: p.name, colSpan: p.instruments.length + 1, styles: { halign: 'center' } })),
    ];
    const principalHeadRow2: any = ACADEMIC_EVALUATION_STRUCTURE.periods.flatMap(p => [
        ...p.instruments.map(i => `${i.name}\n(${i.weight * 100}%)`),
        { content: 'MEDIA', styles: { fontStyle: 'bold' } }
    ]);
    
    const principalBody = Object.values(finalGradesAndAverages.studentGroups).flat().map((student: any) => {
        const studentRow: (string | number | null)[] = [`${student.apellido1} ${student.apellido2}, ${student.nombre}`];
        ACADEMIC_EVALUATION_STRUCTURE.periods.forEach(period => {
            period.instruments.forEach(instrument => {
                let grade: number | null = null;
                if (instrument.type === 'manual') {
                    const manualGrade = localAcademicGrades[student.id]?.[period.key]?.manualGrades?.[instrument.key];
                    grade = (manualGrade === null || manualGrade === undefined) ? null : parseFloat(String(manualGrade));
                } else {
                    if (instrument.key === 'servicios') grade = calculatedStudentGrades[student.id]?.serviceAverage ?? null;
                    else {
                        const examKey = { 'exPracticoT1': 't1', 'exPracticoT2': 't2', 'exPracticoRec': 'rec' }[instrument.key] as 't1' | 't2' | 'rec';
                        if (examKey) grade = calculatedStudentGrades[student.id]?.practicalExams[examKey] ?? null;
                    }
                }
                studentRow.push(grade !== null ? grade.toFixed(2) : '-');
            });
            const avg = finalGradesAndAverages.studentGrades[student.id].averages[period.key];
            studentRow.push(avg !== null ? avg.toFixed(2) : '-');
        });
        return studentRow;
    });

    (doc as any).autoTable({
        head: [principalHeadRow1, principalHeadRow2],
        body: principalBody,
        startY: 25,
        theme: 'grid',
        styles: { fontSize: 7, cellPadding: 1, overflow: 'linebreak' },
        headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: 'bold', halign: 'center', fontSize: 6 },
        didDrawPage: (data: any) => addPageHeaderAndFooter(data, "Informe Académico - Módulo Principal"),
    });

    // --- Table 2: Otros Módulos ---
    doc.addPage('landscape');

    const otrosHeadRow1 = [
        { content: 'Alumno', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
        ...COURSE_MODULES.map(module => ({ content: module, colSpan: 5, styles: { halign: 'center' } }))
    ];
    const otrosHeadRow2 = COURSE_MODULES.flatMap(() => ['T1', 'T2', 'T3', 'REC', { content: 'FINAL', styles: { fontStyle: 'bold' } }]);
    
    const otrosBody = Object.values(finalGradesAndAverages.studentGroups).flat().map((student: any) => {
        const studentRow: (string | number | null)[] = [`${student.apellido1} ${student.apellido2}, ${student.nombre}`];
        COURSE_MODULES.forEach(module => {
            const grades: Partial<CourseModuleGrades> = localCourseGrades[student.id]?.[module] || {};
            const validGrades = (Object.values(grades) as (GradeValue | undefined)[]).map(g => parseFloat(String(g))).filter(g => !isNaN(g));
            const finalAvg = validGrades.length > 0 ? (validGrades.reduce((a, b) => a + b, 0) / validGrades.length) : null;
            studentRow.push(grades.t1 ?? '-');
            studentRow.push(grades.t2 ?? '-');
            studentRow.push(grades.t3 ?? '-');
            studentRow.push(grades.rec ?? '-');
            studentRow.push(finalAvg !== null ? finalAvg.toFixed(2) : '-');
        });
        return studentRow;
    });

    (doc as any).autoTable({
        head: [otrosHeadRow1, otrosHeadRow2],
        body: otrosBody,
        startY: 25,
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 1.5, halign: 'center' },
        headStyles: { fillColor: [22, 163, 74], textColor: 255, fontStyle: 'bold', halign: 'center', fontSize: 8 },
        didDrawPage: (data: any) => addPageHeaderAndFooter(data, "Informe Académico - Otros Módulos"),
    });

    doc.save(`Informe_Academico_Completo_${new Date().toISOString().split('T')[0]}.pdf`);
};

const GestionAcademicaView: React.FC = () => {
    const { students, academicGrades, setAcademicGrades, courseGrades, setCourseGrades, calculatedStudentGrades, teacherData, instituteData, addToast } = useAppContext();
    
    const [activeTab, setActiveTab] = useState('principal');
    const [localAcademicGrades, setLocalAcademicGrades] = useState(academicGrades);
    const [localCourseGrades, setLocalCourseGrades] = useState(courseGrades);
    const [isDirty, setIsDirty] = useState(false);
    
    useEffect(() => {
        setLocalAcademicGrades(JSON.parse(JSON.stringify(academicGrades)));
        setLocalCourseGrades(JSON.parse(JSON.stringify(courseGrades)));
        setIsDirty(false);
    }, [academicGrades, courseGrades]);

    const finalGradesAndAverages = useMemo(() => {
        const results: Record<string, any> = { averages: {} };
        const studentGroups = students.reduce((acc, student) => {
            (acc[student.grupo] = acc[student.grupo] || []).push(student);
            return acc;
        }, {} as Record<string, Student[]>);

        Object.keys(studentGroups).forEach(groupName => {
            studentGroups[groupName].sort((a,b) => a.apellido1.localeCompare(b.apellido1));
        });

        students.forEach(student => {
            results[student.id] = { averages: {} };
            ACADEMIC_EVALUATION_STRUCTURE.periods.forEach(period => {
                let totalWeight = 0;
                let weightedSum = 0;
                period.instruments.forEach(instrument => {
                    let grade: number | null = null;
                    if (instrument.type === 'manual') {
                        const manualGrade = localAcademicGrades[student.id]?.[period.key]?.manualGrades?.[instrument.key];
                        grade = (manualGrade === null || manualGrade === undefined) ? null : parseFloat(String(manualGrade));
                    } else { // calculated
                        if (instrument.key === 'servicios') {
                            grade = calculatedStudentGrades[student.id]?.serviceAverage ?? null;
                        } else {
                            const examKeyMap: Record<string, keyof StudentCalculatedGrades['practicalExams']> = {
                                'exPracticoT1': 't1',
                                'exPracticoT2': 't2',
                                'exPracticoRec': 'rec',
                            };
                            const examKey = examKeyMap[instrument.key];
                            if (examKey) {
                                grade = calculatedStudentGrades[student.id]?.practicalExams[examKey] ?? null;
                            }
                        }
                    }
                    
                    if (grade !== null && !isNaN(grade)) {
                        weightedSum += grade * instrument.weight;
                        totalWeight += instrument.weight;
                    }
                });
                results[student.id].averages[period.key] = totalWeight > 0 ? parseFloat((weightedSum / totalWeight).toFixed(2)) : null;
            });
        });
        return { studentGroups, studentGrades: results };
    }, [students, localAcademicGrades, calculatedStudentGrades]);

    const handleManualGradeChange = (studentId: string, periodKey: string, instrumentKey: string, value: string) => {
        const numericValue = value === '' ? null : parseFloat(value);
        if (value !== '' && (isNaN(numericValue) || numericValue < 0 || numericValue > 10)) return;

        setLocalAcademicGrades(prev => {
            const newGrades = JSON.parse(JSON.stringify(prev));
            if (!newGrades[studentId]) newGrades[studentId] = {};
            if (!newGrades[studentId][periodKey]) newGrades[studentId][periodKey] = { manualGrades: {} };
            newGrades[studentId][periodKey].manualGrades[instrumentKey] = numericValue;
            return newGrades;
        });
        setIsDirty(true);
    };

    const handleCourseGradeChange = (studentId: string, module: string, period: keyof CourseModuleGrades, value: string) => {
        const numericValue = value === '' ? null : parseFloat(value);
         if (value !== '' && (isNaN(numericValue) || numericValue < 0 || numericValue > 10)) return;
        
        setLocalCourseGrades(prev => {
            const newGrades = JSON.parse(JSON.stringify(prev));
            if (!newGrades[studentId]) newGrades[studentId] = {};
            if (!newGrades[studentId][module]) newGrades[studentId][module] = {};
            newGrades[studentId][module][period] = numericValue;
            return newGrades;
        });
        setIsDirty(true);
    };

    const handleSaveChanges = () => {
        setAcademicGrades(localAcademicGrades);
        setCourseGrades(localCourseGrades);
        setIsDirty(false);
        addToast('Calificaciones guardadas con éxito.', 'success');
    };

    const handleExport = () => {
        try {
            generateAcademicReportPDF(students, finalGradesAndAverages, localCourseGrades, calculatedStudentGrades, localAcademicGrades, teacherData, instituteData);
        } catch (error) {
            console.error("Error generating academic PDF:", error);
            addToast("No se pudo generar el informe. Revisa los datos.", "error");
        }
    };
    
    return (
    <div>
        <header className="flex flex-wrap justify-between items-center gap-4 mb-6">
            <div>
                <h1 className="text-3xl font-bold text-gray-800 flex items-center">
                    <ClipboardListIcon className="w-8 h-8 mr-3 text-purple-500" />
                    Gestión Académica
                </h1>
                <p className="text-gray-500 mt-1">Introduce y visualiza todas las calificaciones del curso.</p>
            </div>
            <div className="flex items-center space-x-2">
                 <button onClick={handleExport} className="flex items-center bg-gray-500 text-white px-4 py-2 rounded-lg font-semibold hover:bg-gray-600 transition">
                    <ExportIcon className="w-5 h-5 mr-1" /> Exportar a PDF
                </button>
                 <button onClick={handleSaveChanges} disabled={!isDirty} className={`flex items-center px-4 py-2 rounded-lg font-semibold transition ${!isDirty ? 'bg-green-200 text-green-500 cursor-not-allowed' : 'bg-green-500 text-white hover:bg-green-600'}`}>
                    <SaveIcon className="w-5 h-5 mr-1" /> Guardar Cambios
                </button>
            </div>
        </header>

        <div className="border-b border-gray-200 mb-6">
            <nav className="flex space-x-2">
                 <button onClick={() => setActiveTab('principal')} className={`px-4 py-2 font-medium text-sm rounded-md ${activeTab === 'principal' ? 'bg-blue-100 text-blue-600' : 'text-gray-500 hover:bg-gray-100'}`}>Módulo Principal</button>
                 <button onClick={() => setActiveTab('otros')} className={`px-4 py-2 font-medium text-sm rounded-md ${activeTab === 'otros' ? 'bg-blue-100 text-blue-600' : 'text-gray-500 hover:bg-gray-100'}`}>Otros Módulos</button>
            </nav>
        </div>

        <div className="bg-white shadow-md rounded-lg overflow-hidden">
        {activeTab === 'principal' ? (
            <div className="overflow-x-auto">
                <table className="min-w-full text-xs text-center border-collapse">
                    <thead className="bg-gray-100 sticky top-0 z-10">
                        <tr>
                            <th className="p-2 border font-semibold text-gray-600 w-48 text-left sticky left-0 bg-gray-100" rowSpan={2}>Alumno</th>
                            {ACADEMIC_EVALUATION_STRUCTURE.periods.map(period => (<th key={period.key} className="p-2 border font-semibold text-gray-600" colSpan={period.instruments.length + 1}>{period.name}</th>))}
                        </tr>
                        <tr>
                            {ACADEMIC_EVALUATION_STRUCTURE.periods.flatMap(period => [
                                ...period.instruments.map(instrument => (<th key={`${period.key}-${instrument.key}`} className={`p-2 border font-semibold text-gray-500 text-[10px] ${instrument.type === 'calculated' ? 'bg-blue-50' : ''}`}>{instrument.name} ({instrument.weight * 100}%)</th>)),
                                <th key={`${period.key}-avg`} className="p-2 border font-bold text-gray-700 bg-gray-200">MEDIA</th>
                            ])}
                        </tr>
                    </thead>
                    <tbody>
                        {Object.entries(finalGradesAndAverages.studentGroups).map(([groupName, studentsInGroup]: [string, Student[]]) => (
                            <React.Fragment key={groupName}>
                                <tr><td colSpan={100} className="bg-gray-200 font-bold p-1 text-left pl-4">{groupName}</td></tr>
                                {studentsInGroup.map(student => (
                                    <tr key={student.id} className="hover:bg-gray-50 group">
                                        <td className="p-1 border text-left font-semibold text-gray-800 w-48 sticky left-0 bg-white group-hover:bg-gray-50">{`${student.apellido1} ${student.apellido2}, ${student.nombre}`}</td>
                                        {ACADEMIC_EVALUATION_STRUCTURE.periods.flatMap(period => {
                                            const studentAverage = finalGradesAndAverages.studentGrades[student.id].averages[period.key];
                                            return [
                                                ...period.instruments.map(instrument => {
                                                    let calculatedGrade: number | null = null;
                                                    if (instrument.type === 'calculated') {
                                                        if (instrument.key === 'servicios') {
                                                            calculatedGrade = calculatedStudentGrades[student.id]?.serviceAverage ?? null;
                                                        } else {
                                                            const examKeyMap: Record<string, keyof StudentCalculatedGrades['practicalExams']> = {
                                                                'exPracticoT1': 't1', 'exPracticoT2': 't2', 'exPracticoRec': 'rec',
                                                            };
                                                            const examKey = examKeyMap[instrument.key];
                                                            if (examKey) {
                                                                calculatedGrade = calculatedStudentGrades[student.id]?.practicalExams[examKey] ?? null;
                                                            }
                                                        }
                                                    }
                                                    return (
                                                    <td key={`${period.key}-${instrument.key}`} className={`border ${instrument.type === 'calculated' ? 'bg-blue-50' : ''}`}>
                                                    {instrument.type === 'manual' ? (
                                                        <input type="number" step="0.1" min="0" max="10" value={localAcademicGrades[student.id]?.[period.key]?.manualGrades?.[instrument.key] ?? ''} onChange={e => handleManualGradeChange(student.id, period.key, instrument.key, e.target.value)} className="w-16 p-1.5 text-center bg-transparent focus:bg-yellow-100 outline-none"/>
                                                    ) : (<span className="p-1.5 block">{calculatedGrade !== null ? calculatedGrade.toFixed(2) : '-'}</span>)}
                                                    </td>
                                                )}),
                                                <td key={`${period.key}-avg`} className={`p-1.5 border font-bold ${studentAverage !== null && studentAverage < 5 ? 'text-red-600' : 'text-black'} bg-gray-200`}>{studentAverage?.toFixed(2) ?? '-'}</td>
                                            ]
                                        })}
                                    </tr>
                                ))}
                            </React.Fragment>
                        ))}
                    </tbody>
                </table>
            </div>
        ) : (
             <div className="overflow-x-auto">
                <table className="min-w-full text-sm text-center">
                     <thead className="bg-gray-100">
                        <tr>
                            <th className="p-2 border font-semibold text-gray-600 text-left">Alumno</th>
                            {COURSE_MODULES.flatMap(module => [<th key={module} colSpan={5} className="p-2 border font-semibold text-gray-600">{module}</th>])}
                        </tr>
                         <tr>
                            <th className="p-2 border font-semibold text-gray-600 text-left"></th>
                            {COURSE_MODULES.flatMap(module => [<th key={`${module}-t1`} className="p-2 border font-semibold text-gray-500 text-[10px]">T1</th>,<th key={`${module}-t2`} className="p-2 border font-semibold text-gray-500 text-[10px]">T2</th>,<th key={`${module}-t3`} className="p-2 border font-semibold text-gray-500 text-[10px]">T3</th>,<th key={`${module}-rec`} className="p-2 border font-semibold text-gray-500 text-[10px]">REC</th>,<th key={`${module}-final`} className="p-2 border font-bold text-gray-700 bg-gray-200">FINAL</th>])}
                        </tr>
                    </thead>
                    <tbody>
                         {students.map(student => {
                             const studentGrades = localCourseGrades[student.id] || {};
                             return (
                                <tr key={student.id} className="hover:bg-gray-50 group">
                                    <td className="p-1 border text-left font-semibold text-gray-800">{`${student.apellido1} ${student.apellido2}, ${student.nombre}`}</td>
                                    {COURSE_MODULES.flatMap(module => {
                                        const grades: Partial<CourseModuleGrades> = studentGrades[module] || {};
                                        const validGrades = (Object.values(grades) as (GradeValue | undefined)[]).map(g => parseFloat(String(g))).filter(g => !isNaN(g));
                                        const finalAvg = validGrades.length > 0 ? (validGrades.reduce((a, b) => a + b, 0) / validGrades.length) : null;
                                        return [
                                            <td key={`${module}-t1-cell`} className="border"><input type="number" step="0.1" min="0" max="10" value={grades.t1 ?? ''} onChange={e => handleCourseGradeChange(student.id, module, 't1', e.target.value)} className="w-16 p-1.5 text-center bg-transparent focus:bg-yellow-100 outline-none" /></td>,
                                            <td key={`${module}-t2-cell`} className="border"><input type="number" step="0.1" min="0" max="10" value={grades.t2 ?? ''} onChange={e => handleCourseGradeChange(student.id, module, 't2', e.target.value)} className="w-16 p-1.5 text-center bg-transparent focus:bg-yellow-100 outline-none" /></td>,
                                            <td key={`${module}-t3-cell`} className="border"><input type="number" step="0.1" min="0" max="10" value={grades.t3 ?? ''} onChange={e => handleCourseGradeChange(student.id, module, 't3', e.target.value)} className="w-16 p-1.5 text-center bg-transparent focus:bg-yellow-100 outline-none" /></td>,
                                            <td key={`${module}-rec-cell`} className="border"><input type="number" step="0.1" min="0" max="10" value={grades.rec ?? ''} onChange={e => handleCourseGradeChange(student.id, module, 'rec', e.target.value)} className="w-16 p-1.5 text-center bg-transparent focus:bg-yellow-100 outline-none" /></td>,
                                            <td key={`${module}-final-cell`} className={`p-1.5 border font-bold ${finalAvg !== null && finalAvg < 5 ? 'text-red-600' : 'text-black'} bg-gray-200`}>{finalAvg?.toFixed(2) ?? '-'}</td>,
                                        ]
                                    })}
                                </tr>
                             );
                         })}
                    </tbody>
                </table>
             </div>
        )}
        </div>
    </div>
  );
};

export default GestionAcademicaView;