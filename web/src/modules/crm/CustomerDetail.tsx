import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { doc, getDoc, collection, query, where, onSnapshot, addDoc, deleteDoc, orderBy } from "firebase/firestore";
import { db } from "@/firebase/config";
import { useAuth } from "@/contexts/AuthContext";
import type { Customer, Mandante } from "@/types";
import {
  ArrowLeftIcon,
  PencilIcon,
  TrashIcon,
  BuildingOfficeIcon,
  UserPlusIcon,
  PhoneIcon,
  EnvelopeIcon,
  MapPinIcon,
  GlobeAltIcon,
} from "@heroicons/react/24/outline";

export function CustomerDetail() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { companyId } = useAuth();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [mandantes, setMandantes] = useState<Mandante[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddContact, setShowAddContact] = useState(false);
  const [contactForm, setContactForm] = useState({
    name: "",
    email: "",
    phone: "",
    position: "",
    department: "",
    isPrimary: false,
  });

  useEffect(() => {
    if (!id || !companyId) return;
    setLoading(true);

    const unsubCustomer = onSnapshot(
      doc(db, "companies", companyId, "customers", id),
      (snap) => {
        if (snap.exists()) {
          setCustomer({ id: snap.id, ...snap.data() } as Customer);
        }
        setLoading(false);
      }
    );

    const q = query(
      collection(db, "companies", companyId, "mandantes"),
      where("customerId", "==", id),
      orderBy("name")
    );
    const unsubMandantes = onSnapshot(q, (snap) => {
      setMandantes(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Mandante)));
    });

    return () => {
      unsubCustomer();
      unsubMandantes();
    };
  }, [id, companyId]);

  const handleAddContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId || !id || !contactForm.name.trim()) return;

    await addDoc(collection(db, "companies", companyId, "mandantes"), {
      companyId,
      customerId: id,
      ...contactForm,
      active: true,
      createdAt: new Date().toISOString(),
    });

    setContactForm({ name: "", email: "", phone: "", position: "", department: "", isPrimary: false });
    setShowAddContact(false);
  };

  const handleDeleteContact = async (contactId: string) => {
    if (!companyId) return;
    if (!confirm("¿Eliminar este contacto?")) return;
    await deleteDoc(doc(db, "companies", companyId, "mandantes", contactId));
  };

  const handleDeleteCustomer = async () => {
    if (!companyId || !id) return;
    if (!confirm("¿Eliminar este cliente? Esta acción no se puede deshacer.")) return;
    await deleteDoc(doc(db, "companies", companyId, "customers", id));
    navigate("/crm/customers");
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-400">Cliente no encontrado</p>
        <button
          onClick={() => navigate("/crm/customers")}
          className="mt-4 text-blue-400 hover:text-blue-300 text-sm"
        >
          Volver a clientes
        </button>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/crm/customers")}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
          >
            <ArrowLeftIcon className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-white">{customer.name}</h1>
            <p className="text-gray-400 text-sm">
              {customer.legalName || customer.taxId || "Sin información adicional"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate(`/crm/customers/${id}/edit`)}
            className="inline-flex items-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium rounded-lg transition-colors"
          >
            <PencilIcon className="w-4 h-4" />
            Editar
          </button>
          <button
            onClick={handleDeleteCustomer}
            className="inline-flex items-center gap-2 px-3 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-sm font-medium rounded-lg transition-colors"
          >
            <TrashIcon className="w-4 h-4" />
            Eliminar
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Info Card */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4">
              Información de Contacto
            </h2>
            <div className="space-y-3">
              {customer.email && (
                <div className="flex items-center gap-3 text-sm">
                  <EnvelopeIcon className="w-4 h-4 text-gray-500 shrink-0" />
                  <a href={`mailto:${customer.email}`} className="text-blue-400 hover:text-blue-300 truncate">
                    {customer.email}
                  </a>
                </div>
              )}
              {customer.phone && (
                <div className="flex items-center gap-3 text-sm">
                  <PhoneIcon className="w-4 h-4 text-gray-500 shrink-0" />
                  <span className="text-gray-300">{customer.phone}</span>
                </div>
              )}
              {(customer.address || customer.city) && (
                <div className="flex items-center gap-3 text-sm">
                  <MapPinIcon className="w-4 h-4 text-gray-500 shrink-0" />
                  <span className="text-gray-300">
                    {[customer.address, customer.city].filter(Boolean).join(", ")}
                  </span>
                </div>
              )}
              {customer.website && (
                <div className="flex items-center gap-3 text-sm">
                  <GlobeAltIcon className="w-4 h-4 text-gray-500 shrink-0" />
                  <a href={customer.website} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 truncate">
                    {customer.website}
                  </a>
                </div>
              )}
            </div>

            <div className="mt-4 pt-4 border-t border-gray-800 space-y-2 text-sm">
              {customer.taxId && (
                <div className="flex justify-between">
                  <span className="text-gray-500">RUT</span>
                  <span className="text-gray-300">{customer.taxId}</span>
                </div>
              )}
              {customer.contactName && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Contacto</span>
                  <span className="text-gray-300">{customer.contactName}</span>
                </div>
              )}
              {customer.paymentTerms && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Pago</span>
                  <span className="text-gray-300">{customer.paymentTerms}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-500">País</span>
                <span className="text-gray-300">{customer.country || "Chile"}</span>
              </div>
            </div>
          </div>

          {customer.notes && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
              <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-2">
                Notas
              </h2>
              <p className="text-gray-400 text-sm whitespace-pre-wrap">{customer.notes}</p>
            </div>
          )}
        </div>

        {/* Mandantes */}
        <div className="lg:col-span-2">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">
                Contactos / Mandantes ({mandantes.length})
              </h2>
              <button
                onClick={() => setShowAddContact(!showAddContact)}
                className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-600/10 text-blue-400 hover:bg-blue-600/20 text-sm font-medium rounded-lg transition-colors"
              >
                <UserPlusIcon className="w-4 h-4" />
                {showAddContact ? "Cancelar" : "Agregar"}
              </button>
            </div>

            {showAddContact && (
              <form onSubmit={handleAddContact} className="mb-4 p-4 bg-gray-800/50 rounded-lg space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    type="text"
                    required
                    placeholder="Nombre *"
                    value={contactForm.name}
                    onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                    className="px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                  />
                  <input
                    type="text"
                    placeholder="Cargo"
                    value={contactForm.position}
                    onChange={(e) => setContactForm({ ...contactForm, position: e.target.value })}
                    className="px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                  />
                  <input
                    type="email"
                    placeholder="Email"
                    value={contactForm.email}
                    onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                    className="px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                  />
                  <input
                    type="text"
                    placeholder="Teléfono"
                    value={contactForm.phone}
                    onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })}
                    className="px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                  />
                  <input
                    type="text"
                    placeholder="Departamento"
                    value={contactForm.department}
                    onChange={(e) => setContactForm({ ...contactForm, department: e.target.value })}
                    className="px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                  />
                  <label className="flex items-center gap-2 text-sm text-gray-300">
                    <input
                      type="checkbox"
                      checked={contactForm.isPrimary}
                      onChange={(e) => setContactForm({ ...contactForm, isPrimary: e.target.checked })}
                      className="rounded border-gray-700 bg-gray-900 text-blue-600"
                    />
                    Contacto principal
                  </label>
                </div>
                <div className="flex justify-end">
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    Guardar Contacto
                  </button>
                </div>
              </form>
            )}

            {mandantes.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p>No hay contactos registrados</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-800">
                {mandantes.map((m) => (
                  <div key={m.id} className="flex items-center justify-between py-3 group">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-white font-medium text-sm">{m.name}</span>
                        {m.isPrimary && (
                          <span className="px-1.5 py-0.5 bg-blue-500/10 text-blue-400 text-xs rounded">
                            Principal
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500">
                        {m.position && <span>{m.position}</span>}
                        {m.department && <span>{m.department}</span>}
                        {m.email && <span>{m.email}</span>}
                        {m.phone && <span>{m.phone}</span>}
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteContact(m.id)}
                      className="p-1.5 text-gray-600 hover:text-red-400 hover:bg-red-400/10 rounded transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
