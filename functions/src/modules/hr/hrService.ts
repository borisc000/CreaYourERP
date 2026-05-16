/**
 * Servicio compartido de validaciones y utilidades para el módulo HR.
 */

import { db } from "../../config";

export const cors = [
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:5000",
  "https://your-erp.web.app",
  "https://your-erp-staging.web.app",
  "https://your-erp-staging.firebaseapp.com",
];

export function cleanString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function companyRef(companyId: string) {
  return db.collection("companies").doc(companyId);
}

export function serializeDoc(snapshot: FirebaseFirestore.DocumentSnapshot): Record<string, unknown> | null {
  if (!snapshot.exists) return null;
  return { id: snapshot.id, ...snapshot.data() };
}

export function isValidChileanRut(rut: string): boolean {
  if (!rut || rut.length < 3) return false;
  const clean = rut.replace(/\./g, "").replace(/-/g, "").toUpperCase();
  if (!/^\d+[0-9K]$/.test(clean)) return false;
  const body = clean.slice(0, -1);
  const dv = clean.slice(-1);
  let sum = 0;
  let mult = 2;
  for (let i = body.length - 1; i >= 0; i--) {
    sum += parseInt(body[i], 10) * mult;
    mult = mult === 7 ? 2 : mult + 1;
  }
  const expectedDv = 11 - (sum % 11);
  const expectedChar = expectedDv === 11 ? "0" : expectedDv === 10 ? "K" : String(expectedDv);
  return dv === expectedChar;
}

export async function generateEmployeeCode(companyId: string): Promise<string> {
  const countSnap = await companyRef(companyId).collection("employees").count().get();
  const seq = countSnap.data().count + 1;
  return `EMP-${String(seq).padStart(3, "0")}`;
}

export function validateEmployeeInput(data: Record<string, unknown>): string | null {
  const firstName = cleanString(data.firstName);
  if (!firstName) return "El nombre es obligatorio";

  const lastName = cleanString(data.lastName);
  if (!lastName) return "El apellido es obligatorio";

  const email = cleanString(data.email);
  if (!email) return "El email es obligatorio";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "El email no es válido";

  const cedula = cleanString(data.cedula);
  if (cedula && !isValidChileanRut(cedula)) return "El RUT no es válido";

  return null;
}

export async function getEmployee(companyId: string, employeeId: string) {
  const snap = await companyRef(companyId).collection("employees").doc(employeeId).get();
  return serializeDoc(snap);
}
