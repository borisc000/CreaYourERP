import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { doc, getDoc, collection, query, orderBy, onSnapshot, addDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/firebase/config";
import { useAuth } from "@/contexts/AuthContext";
import type { Employee, Department, JobProfile } from "@/types";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";

export function EmployeeForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { companyId, user } = useAuth();
  const isEdit = Boolean(id);

  const [departments, setDepartments] = useState<Department[]>([]);
  const [jobProfiles, setJobProfiles] = useState<JobProfile[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [form, setForm] = useState<Partial<Employee>>({
    firstName: "",
    lastName: "",
    email: "",
    workEmail: "",
    personalEmail: "",
    phone: "",
    alternatePhone: "",
    cedula: "",
    birthDate: "",
    gender: "",
    maritalStatus: "",
    nationality: "",
    address: "",
    commune: "",
    city: "",
    region: "",
    emergencyContactName: "",
    emergencyContactPhone: "",
    healthSystem: undefined,
    afpCode: "",
    drivingLicense: "",
    criminalRecordStatus: "not_provided",
    backgroundNotes: "",
    departmentId: "",
    jobProfileId: "",
    hireDate: "",
    baseSalary: 0,
    status: "draft",
    isActive: true,
    notes: "",
  });

  useEffect(() => {
    if (!companyId) return;
    const unsubDepts = onSnapshot(
      query(collection(db, "companies", companyId, "departments"), orderBy("name")),
      (snap) => setDepartments(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Department)))
    );
    const unsubProfiles = onSnapshot(
      query(collection(db, "companies", companyId, "jobProfiles"), orderBy("name")),
      (snap) => setJobProfiles(snap.docs.map((d) => ({ id: d.id, ...d.data() } as JobProfile)))
    );
    return () => {
      unsubDepts();
      unsubProfiles();
    };
  }, [companyId]);

  useEffect(() => {
    if (!id || !companyId) return;
    getDoc(doc(db, "companies", companyId, "employees", id)).then((snap) => {
      if (snap.exists()) {
        const data = snap.data() as Employee;
        setForm({
          firstName: data.firstName,
          lastName: data.lastName,
          email: data.email,
          workEmail: data.workEmail,
          personalEmail: data.personalEmail,
          phone: data.phone,
          alternatePhone: data.alternatePhone,
          cedula: data.cedula,
          birthDate: data.birthDate,
          gender: data.gender,
          maritalStatus: data.maritalStatus,
          nationality: data.nationality,
          address: data.address,
          commune: data.commune,
          city: data.city,
          region: data.region,
          emergencyContactName: data.emergencyContactName,
          emergencyContactPhone: data.emergencyContactPhone,
          healthSystem: data.healthSystem,
          afpCode: data.afpCode,
          drivingLicense: data.drivingLicense,
          criminalRecordStatus: data.criminalRecordStatus,
          backgroundNotes: data.backgroundNotes,
          departmentId: data.departmentId,
          jobProfileId: data.jobProfileId,
          hireDate: data.hireDate,
          baseSalary: data.baseSalary,
          status: data.status,
          isActive: data.isActive,
          notes: data.notes,
        });
      }
    });
  }, [id, companyId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.firstName?.trim() || !form.lastName?.trim() || !form.email?.trim() || !companyId || !user) {
      alert("Completa los campos obligatorios");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        ...form,
        fullName: `${form.firstName} ${form.lastName}`,
        companyId,
        updatedAt: serverTimestamp(),
      };

      if (isEdit && id) {
        await updateDoc(doc(db, "companies", companyId, "employees", id), payload);
      } else {
        await addDoc(collection(db, "companies", companyId, "employees"), {
          ...payload,
          createdBy: user.uid,
          createdAt: serverTimestamp(),
        });
      }
      navigate("/hr");
    } catch (err) {
      console.error("Error guardando colaborador:", err);
      alert("Error al guardar el colaborador");
    } finally {
      setIsSubmitting(false);
    }
  };

  const fieldClass =
    "w-full px-3 py-2 bg-gray-900 border border-gray-800 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500";

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate("/hr")}
          className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
        >
          <ArrowLeftIcon className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-white">
            {isEdit ? "Editar Colaborador" : "Nuevo Colaborador"}
          </h1>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Personal Info */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4">
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Información Personal</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Nombres *</label>
              <input required value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} className={fieldClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Apellidos *</label>
              <input required value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} className={fieldClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">RUT / Cédula</label>
              <input value={form.cedula || ""} onChange={(e) => setForm({ ...form, cedula: e.target.value })} className={fieldClass} placeholder="12.345.678-9" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Fecha de nacimiento</label>
              <input type="date" value={form.birthDate || ""} onChange={(e) => setForm({ ...form, birthDate: e.target.value })} className={fieldClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Género</label>
              <select value={form.gender || ""} onChange={(e) => setForm({ ...form, gender: e.target.value })} className={fieldClass}>
                <option value="">Seleccionar...</option>
                <option value="male">Masculino</option>
                <option value="female">Femenino</option>
                <option value="other">Otro</option>
                <option value="prefer_not_to_say">Prefiero no decir</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Estado civil</label>
              <select value={form.maritalStatus || ""} onChange={(e) => setForm({ ...form, maritalStatus: e.target.value })} className={fieldClass}>
                <option value="">Seleccionar...</option>
                <option value="single">Soltero/a</option>
                <option value="married">Casado/a</option>
                <option value="divorced">Divorciado/a</option>
                <option value="widowed">Viudo/a</option>
                <option value="cohabiting">Conviviente</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Nacionalidad</label>
              <input value={form.nationality || ""} onChange={(e) => setForm({ ...form, nationality: e.target.value })} className={fieldClass} placeholder="Chilena" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Licencia de conducir</label>
              <input value={form.drivingLicense || ""} onChange={(e) => setForm({ ...form, drivingLicense: e.target.value })} className={fieldClass} placeholder="Clase B" />
            </div>
          </div>
        </div>

        {/* Contact */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4">
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Contacto</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Email principal *</label>
              <input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={fieldClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Email laboral</label>
              <input type="email" value={form.workEmail || ""} onChange={(e) => setForm({ ...form, workEmail: e.target.value })} className={fieldClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Email personal</label>
              <input type="email" value={form.personalEmail || ""} onChange={(e) => setForm({ ...form, personalEmail: e.target.value })} className={fieldClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Teléfono</label>
              <input value={form.phone || ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={fieldClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Teléfono alternativo</label>
              <input value={form.alternatePhone || ""} onChange={(e) => setForm({ ...form, alternatePhone: e.target.value })} className={fieldClass} />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-300 mb-1">Dirección</label>
              <input value={form.address || ""} onChange={(e) => setForm({ ...form, address: e.target.value })} className={fieldClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Comuna</label>
              <input value={form.commune || ""} onChange={(e) => setForm({ ...form, commune: e.target.value })} className={fieldClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Ciudad</label>
              <input value={form.city || ""} onChange={(e) => setForm({ ...form, city: e.target.value })} className={fieldClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Región</label>
              <input value={form.region || ""} onChange={(e) => setForm({ ...form, region: e.target.value })} className={fieldClass} />
            </div>
          </div>
        </div>

        {/* Emergency Contact */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4">
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Contacto de Emergencia</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Nombre</label>
              <input value={form.emergencyContactName || ""} onChange={(e) => setForm({ ...form, emergencyContactName: e.target.value })} className={fieldClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Teléfono</label>
              <input value={form.emergencyContactPhone || ""} onChange={(e) => setForm({ ...form, emergencyContactPhone: e.target.value })} className={fieldClass} />
            </div>
          </div>
        </div>

        {/* Employment */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4">
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Datos Laborales</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Departamento</label>
              <select value={form.departmentId || ""} onChange={(e) => setForm({ ...form, departmentId: e.target.value || undefined })} className={fieldClass}>
                <option value="">Seleccionar...</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Perfil de Cargo</label>
              <select value={form.jobProfileId || ""} onChange={(e) => setForm({ ...form, jobProfileId: e.target.value || undefined })} className={fieldClass}>
                <option value="">Seleccionar...</option>
                {jobProfiles.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Fecha de contratación</label>
              <input type="date" value={form.hireDate || ""} onChange={(e) => setForm({ ...form, hireDate: e.target.value })} className={fieldClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Sueldo base</label>
              <input type="number" value={form.baseSalary || 0} onChange={(e) => setForm({ ...form, baseSalary: Number(e.target.value) })} className={fieldClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Sistema de salud</label>
              <select value={form.healthSystem || ""} onChange={(e) => setForm({ ...form, healthSystem: e.target.value as any })} className={fieldClass}>
                <option value="">Seleccionar...</option>
                <option value="fonasa">FONASA</option>
                <option value="isapre">ISAPRE</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">AFP</label>
              <input value={form.afpCode || ""} onChange={(e) => setForm({ ...form, afpCode: e.target.value })} className={fieldClass} placeholder="Ej: CAPITAL" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Estado</label>
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as any })} className={fieldClass}>
                <option value="draft">Borrador</option>
                <option value="onboarding">En inducción</option>
                <option value="active">Activo</option>
                <option value="on_leave">De licencia</option>
                <option value="inactive">Inactivo</option>
              </select>
            </div>
          </div>
        </div>

        {/* Notes */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-2">Notas</h2>
          <textarea rows={3} value={form.notes || ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} className={fieldClass} />
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3">
          <button type="button" onClick={() => navigate("/hr")} className="px-4 py-2 text-sm font-medium text-gray-300 hover:text-white hover:bg-gray-800 rounded-lg transition-colors">
            Cancelar
          </button>
          <button type="submit" disabled={isSubmitting} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors">
            {isSubmitting ? "Guardando..." : isEdit ? "Guardar Cambios" : "Crear Colaborador"}
          </button>
        </div>
      </form>
    </div>
  );
}
