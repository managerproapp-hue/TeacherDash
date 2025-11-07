import React, { useState, useRef, useMemo } from 'react';
import { Student, EntryExitRecord, StudentCalculatedGrades } from '../types';
import { 
    PencilIcon,
    CameraIcon
} from '../components/icons';

interface FichaAlumnoProps {
  student: Student;
  onBack: () => void;
  entryExitRecords: EntryExitRecord[];
  calculatedGrades: StudentCalculatedGrades;
  onUpdatePhoto: (studentId: string, photoUrl: string) => void;
}

const InfoRow: React.FC<{ label: string; value: React.ReactNode; }> = ({ label, value }) => (
    <div className="grid grid-cols-3 gap-4 px-4 py-3 hover:bg-gray-50">
        <dt className="text-sm font-medium text-gray-500">{label}</dt>
        <dd className="mt-1 text-sm text-gray-900 sm:mt-0 col-span-2">{value || '-'}</dd>
    </div>
);

const Tab: React.FC<{ label: string; isActive: boolean; onClick: () => void; }> = ({ label, isActive, onClick }) => (
    <button
        onClick={onClick}
        className={`px-4 py-2 font-medium text-sm rounded-md transition-colors
            ${isActive
                ? 'bg-blue-100 text-blue-600'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
            }`}
    >
        {label}
    </button>
);


const FichaAlumno: React.FC<FichaAlumnoProps> = ({ student, onBack, entryExitRecords, calculatedGrades, onUpdatePhoto }) => {
  const [activeTab, setActiveTab] = useState('general');
  const fullName = `${student.apellido1} ${student.apellido2}, ${student.nombre}`.trim();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePhotoClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (loadEvent) => {
        const result = loadEvent.target?.result;
        if (typeof result === 'string') {
          onUpdatePhoto(student.id, result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const sortedEntryExitRecords = useMemo(() => {
    const parseDate = (dateStr: string) => {
        const [day, month, year] = dateStr.split('/');
        return new Date(`${year}-${month}-${day}`);
    };
    return [...entryExitRecords].sort((a, b) => parseDate(b.date).getTime() - parseDate(a.date).getTime());
  }, [entryExitRecords]);


  const renderGrade = (grade: number | null) => {
      if (grade === null || isNaN(grade)) return <span className="text-gray-500">-</span>;
      const color = grade >= 5 ? 'text-green-600' : 'text-red-600';
      return <span className={`font-bold ${color}`}>{grade.toFixed(2)}</span>
  };

  return (
    <div>
        <header className="flex flex-wrap justify-between items-center gap-4 mb-6">
            <div>
                <div className="flex items-center">
                    <div className="relative group cursor-pointer" onClick={handlePhotoClick}>
                        <img className="h-16 w-16 rounded-full object-cover mr-4" src={student.fotoUrl} alt={`Foto de ${fullName}`} />
                        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 rounded-full flex items-center justify-center transition-opacity duration-300">
                            <CameraIcon className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                    </div>
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        className="hidden"
                        accept="image/*"
                    />
                    <div>
                        <h1 className="text-3xl font-bold text-gray-800">{fullName}</h1>
                        <p className="text-gray-500">{student.grupo} | {student.emailOficial}</p>
                    </div>
                </div>
            </div>
            <div className="flex items-center space-x-2">
                <button className="flex items-center bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-blue-700 transition">
                    <PencilIcon className="w-4 h-4 mr-2" />
                    Editar Ficha
                </button>
                <button onClick={onBack} className="text-gray-600 hover:text-gray-800 font-medium text-2xl leading-none p-1 w-8 h-8 rounded-full flex items-center justify-center hover:bg-gray-100">
                    &times;
                </button>
            </div>
        </header>
        
        <div className="border-b border-gray-200 mb-6">
            <nav className="flex space-x-2">
                <Tab label="Información General" isActive={activeTab === 'general'} onClick={() => setActiveTab('general')} />
                <Tab label="Resumen de Evaluaciones" isActive={activeTab === 'evaluaciones'} onClick={() => setActiveTab('evaluaciones')} />
            </nav>
        </div>

        {activeTab === 'general' && (
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
               <div className="xl:col-span-2 bg-white shadow-md rounded-lg overflow-hidden">
                   <div className="p-4 border-b">
                       <h3 className="text-lg font-bold text-gray-800">Datos Personales</h3>
                   </div>
                   <dl className="divide-y divide-gray-200">
                       <InfoRow label="NRE" value={student.nre} />
                       <InfoRow label="Nº Expediente" value={student.expediente} />
                       <InfoRow label="Fecha de Nacimiento" value={student.fechaNacimiento} />
                       <InfoRow label="Teléfono" value={student.telefono} />
                       <InfoRow label="Email Personal" value={student.emailPersonal} />
                   </dl>
               </div>
               <div className="space-y-6">
                   <div className="bg-white shadow-md rounded-lg p-4">
                       <h3 className="text-md font-bold text-gray-800 mb-2 text-orange-600">Registro de Salidas y Entradas</h3>
                       {sortedEntryExitRecords.length > 0 ? (
                            <div className="max-h-48 overflow-y-auto pr-2 space-y-2 text-sm">
                               {sortedEntryExitRecords.map(record => (
                                   <div key={record.id} className="p-2 bg-gray-50 rounded-md">
                                       <p className="font-semibold">{record.date} - <span className={record.type === 'Salida Anticipada' ? 'text-red-600' : 'text-blue-600'}>{record.type}</span></p>
                                       <p className="text-gray-600 break-words">{record.reason}</p>
                                   </div>
                               ))}
                           </div>
                       ) : (
                           <p className="text-sm text-gray-500">No hay registros.</p>
                       )}
                   </div>
               </div>
            </div>
        )}

        {activeTab === 'evaluaciones' && (
            <div className="bg-white shadow-md rounded-lg overflow-hidden">
                <div className="p-4 border-b">
                    <h3 className="text-lg font-bold text-gray-800">Rendimiento en el Módulo</h3>
                </div>
                 <dl className="divide-y divide-gray-200">
                    <InfoRow label="Media de Servicios Prácticos" value={renderGrade(calculatedGrades?.serviceAverage)} />
                    <InfoRow label="Examen Práctico T1" value={renderGrade(calculatedGrades?.practicalExams.t1)} />
                    <InfoRow label="Examen Práctico T2" value={renderGrade(calculatedGrades?.practicalExams.t2)} />
                    <InfoRow label="Examen Práctico REC" value={renderGrade(calculatedGrades?.practicalExams.rec)} />
                </dl>
            </div>
        )}
    </div>
  );
};

export default FichaAlumno;
