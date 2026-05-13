import { useState, useEffect, useCallback } from "react";
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  type QueryConstraint,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/firebase/config";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Hook genérico para leer una colección de Firestore filtrada por companyId.
 * Traduce el patrón `Company.search([('status','=','active')])` del ERP Python.
 */
export function useFirestoreCollection<T extends { id: string }>(
  collectionPath: string,
  constraints: QueryConstraint[] = []
) {
  const { companyId } = useAuth();
  const [data, setData] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!companyId) {
      console.warn(`[useFirestoreCollection] companyId is null, skipping query for "${collectionPath}"`);
      setData([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    const baseConstraints = [where("companyId", "==", companyId), ...constraints];
    const q = query(collection(db, "companies", companyId, collectionPath), ...baseConstraints);

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const items = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as T[];
        setData(items);
        setIsLoading(false);
        setError(null);
      },
      (err) => {
        console.error(`Error en ${collectionPath}:`, err);
        setError(err);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [companyId, collectionPath, JSON.stringify(constraints)]);

  return { data, isLoading, error };
}

/**
 * Hook genérico para leer un documento específico de Firestore.
 */
export function useFirestoreDocument<T extends { id: string }>(
  collectionPath: string,
  docId: string | undefined
) {
  const { companyId } = useAuth();
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!companyId || !docId) {
      setData(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const docRef = doc(db, "companies", companyId, collectionPath, docId);

    const unsubscribe = onSnapshot(
      docRef,
      (snapshot) => {
        if (snapshot.exists()) {
          setData({ id: snapshot.id, ...snapshot.data() } as T);
        } else {
          setData(null);
        }
        setIsLoading(false);
        setError(null);
      },
      (err) => {
        console.error(`Error en ${collectionPath}/${docId}:`, err);
        setError(err);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [companyId, collectionPath, docId]);

  return { data, isLoading, error };
}

/**
 * Hook para operaciones CRUD en una colección.
 */
export function useFirestoreDoc<T extends { id?: string }>(collectionPath: string) {
  const { companyId } = useAuth();

  const create = useCallback(
    async (data: Omit<T, "id" | "companyId" | "createdAt">) => {
      if (!companyId) throw new Error("No companyId");

      const ref = collection(db, "companies", companyId, collectionPath);
      const docRef = await addDoc(ref, {
        ...data,
        companyId,
        createdAt: serverTimestamp(),
      });
      return docRef.id;
    },
    [companyId, collectionPath]
  );

  const update = useCallback(
    async (id: string, data: Partial<T>) => {
      if (!companyId) throw new Error("No companyId");
      const docRef = doc(db, "companies", companyId, collectionPath, id);
      await updateDoc(docRef, {
        ...data,
        updatedAt: serverTimestamp(),
      });
    },
    [companyId, collectionPath]
  );

  const remove = useCallback(
    async (id: string) => {
      if (!companyId) throw new Error("No companyId");
      const docRef = doc(db, "companies", companyId, collectionPath, id);
      await deleteDoc(docRef);
    },
    [companyId, collectionPath]
  );

  return { create, update, remove };
}
