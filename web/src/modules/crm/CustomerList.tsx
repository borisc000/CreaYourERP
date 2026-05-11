import { orderBy } from "firebase/firestore";
import { useFirestoreCollection } from "@/hooks/useFirestore";
import type { Customer } from "@/types";
import { UsersIcon } from "@heroicons/react/24/outline";

export function CustomerList() {
  const { data: customers, isLoading } = useFirestoreCollection<Customer>("customers", [
    orderBy("name"),
  ]);

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Clientes</h1>
        <p className="text-gray-400 text-sm mt-1">Gestiona tus clientes y mandantes</p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
        </div>
      ) : customers.length === 0 ? (
        <div className="erp-card text-center py-12">
          <UsersIcon className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400">No hay clientes registrados</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {customers.map((customer) => (
            <div key={customer.id} className="erp-card">
              <h3 className="text-white font-medium">{customer.name}</h3>
              <p className="text-gray-500 text-sm mt-1">{customer.email}</p>
              <p className="text-gray-500 text-sm">{customer.phone}</p>
              <p className="text-gray-500 text-sm">{customer.city}</p>
              {customer.taxId && (
                <p className="text-gray-600 text-xs mt-2">RUT: {customer.taxId}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
