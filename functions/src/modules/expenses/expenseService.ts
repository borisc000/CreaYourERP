/**
 * Cloud Functions para el módulo de Gastos (Expenses)
 * - getExpenseDashboard: Stats, categorías, scopes, alertas, backups
 * - createExpenseRecord: Crea gasto con auto-numeración GTO-YYYYMM-NNNN
 * - updateExpenseRecord: Actualiza campos editables de un gasto
 * - deleteExpenseRecord: Elimina un gasto
 * - createExpenseBackup: Snapshot SHA1 de todos los gastos
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { db } from "../../config";
import * as crypto from "crypto";

const cors = [
  "https://your-erp.web.app",
  "http://localhost:5173",
];

function companyRef(companyId: string) {
  return db.collection("companies").doc(companyId);
}

function nowIso() {
  return new Date().toISOString();
}

const EXPENSE_CATEGORIES = [
  "Materiales e insumos",
  "Combustible y peajes",
  "Arriendos y equipos",
  "Subcontratos",
  "Viaticos y traslados",
  "EPP y seguridad",
  "Mantenimiento",
  "Administracion",
  "Gastos generales",
  "Otros",
];

const PAYMENT_METHODS = [
  "Transferencia",
  "Tarjeta empresa",
  "Caja chica",
  "Efectivo",
  "Cheque",
  "Credito proveedor",
  "Otro",
];

function validateCategory(category: string): string {
  const found = EXPENSE_CATEGORIES.find(
    (c) => c.toLowerCase() === category.trim().toLowerCase()
  );
  return found || category.trim();
}

function validatePaymentMethod(method?: string): string | undefined {
  if (!method) return undefined;
  const found = PAYMENT_METHODS.find(
    (m) => m.toLowerCase() === method.trim().toLowerCase()
  );
  return found || method.trim();
}

// ==========================================
// getExpenseDashboard
// ==========================================

export const getExpenseDashboard = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    }

    const companyId = request.auth.token.companyId;
    if (!companyId) {
      throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    }

    try {
      const cref = companyRef(companyId);

      const [expensesSnap, backupsSnap, leadsSnap] = await Promise.all([
        cref.collection("expenses").limit(500).get(),
        cref.collection("expenseBackups").orderBy("createdAt", "desc").limit(5).get(),
        cref.collection("leads").where("status", "==", "open").limit(20).get(),
      ]);

      const expenses = expensesSnap.docs.map((d) => ({ id: d.id, ...d.data() } as any));
      const totalExpenses = expenses.length;
      const totalAmount = expenses.reduce((sum: number, e: any) => sum + (e.totalAmount || 0), 0);
      const avgAmount = totalExpenses > 0 ? totalAmount / totalExpenses : 0;

      const supportedCount = expenses.filter(
        (e: any) => e.status === "supported" || e.status === "reconciled"
      ).length;
      const supportRatio = totalExpenses > 0 ? Math.round((supportedCount / totalExpenses) * 100) : 0;

      const byCategory = EXPENSE_CATEGORIES.map((cat) => {
        const items = expenses.filter((e: any) => e.category === cat);
        return {
          name: cat,
          count: items.length,
          amount: items.reduce((sum: number, e: any) => sum + (e.totalAmount || 0), 0),
        };
      }).filter((c) => c.count > 0);

      const scopes = ["project", "general", "administrative", "field", "other"];
      const byScope = scopes.map((scope) => {
        const items = expenses.filter((e: any) => e.scope === scope);
        return {
          name: scope,
          count: items.length,
          amount: items.reduce((sum: number, e: any) => sum + (e.totalAmount || 0), 0),
        };
      }).filter((s) => s.count > 0);

      const alerts = expenses
        .filter((e: any) => e.status === "pending_support" || e.status === "observed")
        .sort((a: any, b: any) => (b.createdAt || "").localeCompare(a.createdAt || ""))
        .slice(0, 10)
        .map((e: any) => ({
          id: e.id,
          expenseNumber: e.expenseNumber,
          category: e.category,
          status: e.status,
          totalAmount: e.totalAmount || 0,
          description: e.description || "",
          createdAt: e.createdAt,
        }));

      const recentExpenses = expenses
        .sort((a: any, b: any) => (b.createdAt || "").localeCompare(a.createdAt || ""))
        .slice(0, 10)
        .map((e: any) => ({
          id: e.id,
          expenseNumber: e.expenseNumber,
          scope: e.scope,
          category: e.category,
          totalAmount: e.totalAmount || 0,
          status: e.status,
          expenseDate: e.expenseDate,
          vendorName: e.vendorName || "",
          leadId: e.leadId || "",
          createdAt: e.createdAt,
        }));

      const recentBackups = backupsSnap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          backupName: data.backupName,
          backupType: data.backupType,
          expensesCount: data.expensesCount,
          checksum: data.checksum,
          createdByName: data.createdByName || "",
          createdAt: data.createdAt,
        };
      });

      // Opportunity bridge: active leads with expense count
      const leads = leadsSnap.docs.map((d) => ({ id: d.id, title: d.data().title || "" } as any));
      const leadExpenseCounts: Record<string, number> = {};
      expenses.forEach((e: any) => {
        if (e.leadId) {
          leadExpenseCounts[e.leadId] = (leadExpenseCounts[e.leadId] || 0) + 1;
        }
      });

      const opportunityBridge = leads.map((l: any) => ({
        id: l.id,
        title: l.title,
        expenseCount: leadExpenseCounts[l.id] || 0,
      }));

      return {
        stats: {
          totalExpenses,
          totalAmount: Math.round(totalAmount * 100) / 100,
          avgAmount: Math.round(avgAmount * 100) / 100,
          supportRatio,
          pendingSupportCount: expenses.filter((e: any) => e.status === "pending_support").length,
          observedCount: expenses.filter((e: any) => e.status === "observed").length,
          reconciledCount: expenses.filter((e: any) => e.status === "reconciled").length,
        },
        byCategory,
        byScope,
        alerts,
        recentExpenses,
        recentBackups,
        opportunityBridge,
      };
    } catch (error: any) {
      console.error("[getExpenseDashboard] Error:", error);
      throw new HttpsError("internal", error.message || "Error al obtener dashboard");
    }
  }
);

// ==========================================
// createExpenseRecord
// ==========================================

interface CreateExpensePayload {
  scope: "project" | "general" | "administrative" | "field" | "other";
  category: string;
  leadId?: string;
  assetRecordId?: string;
  assetRecordCode?: string;
  assetRecordName?: string;
  expenseDate?: string;
  vendorName?: string;
  spenderName?: string;
  paymentMethod?: string;
  documentType: string;
  documentNumber?: string;
  netAmount: number;
  taxAmount: number;
  totalAmount: number;
  description?: string;
  notes?: string;
  supportFileName?: string;
  supportMimeType?: string;
  supportData?: string;
}

async function generateExpenseNumber(companyId: string): Promise<string> {
  const now = new Date();
  const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
  const prefix = `GTO-${yearMonth}-`;

  const snap = await db
    .collection("companies")
    .doc(companyId)
    .collection("expenses")
    .where("expenseNumber", ">=", prefix)
    .where("expenseNumber", "<", prefix + "\uf8ff")
    .orderBy("expenseNumber", "desc")
    .limit(1)
    .get();

  let seq = 1;
  if (!snap.empty) {
    const lastNumber = snap.docs[0].data().expenseNumber as string;
    const match = lastNumber.match(/-(\d+)$/);
    if (match) {
      seq = parseInt(match[1], 10) + 1;
    }
  }

  return `${prefix}${String(seq).padStart(4, "0")}`;
}

export const createExpenseRecord = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    }

    const companyId = request.auth.token.companyId;
    if (!companyId) {
      throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    }

    const payload = request.data as CreateExpensePayload;

    if (!payload.scope || !payload.category || !payload.documentType) {
      throw new HttpsError("invalid-argument", "scope, categoría y tipo de documento son requeridos");
    }

    if (payload.scope === "project" && !payload.leadId) {
      throw new HttpsError("invalid-argument", "El scope 'project' requiere leadId");
    }

    const netAmount = Math.max(0, Number(payload.netAmount) || 0);
    const taxAmount = Math.max(0, Number(payload.taxAmount) || 0);
    const totalAmount = Math.max(0, Number(payload.totalAmount) || 0);

    if (Math.abs(netAmount + taxAmount - totalAmount) > 0.01) {
      throw new HttpsError("invalid-argument", "Los montos no son coherentes: netAmount + taxAmount debe ser igual a totalAmount");
    }

    try {
      const cref = companyRef(companyId);
      const expenseNumber = await generateExpenseNumber(companyId);
      const now = nowIso();

      const expenseData = {
        id: "", // set after doc creation
        companyId,
        expenseNumber,
        scope: payload.scope,
        category: validateCategory(payload.category),
        leadId: payload.leadId || "",
        assetRecordId: payload.assetRecordId || "",
        assetRecordCode: payload.assetRecordCode || "",
        assetRecordName: payload.assetRecordName || "",
        expenseDate: payload.expenseDate || now.split("T")[0],
        vendorName: payload.vendorName?.trim() || "",
        spenderName: payload.spenderName?.trim() || "",
        paymentMethod: validatePaymentMethod(payload.paymentMethod) || "",
        documentType: payload.documentType.trim(),
        documentNumber: payload.documentNumber?.trim() || "",
        netAmount,
        taxAmount,
        totalAmount,
        status: "pending_support" as const,
        description: payload.description?.trim() || "",
        notes: payload.notes?.trim() || "",
        supportFileName: payload.supportFileName?.trim() || "",
        supportMimeType: payload.supportMimeType?.trim() || "",
        supportData: payload.supportData?.trim() || "",
        recordedByUserId: request.auth.uid,
        reviewedByUserId: "",
        reviewedAt: "",
        createdAt: now,
        updatedAt: now,
      };

      const ref = await cref.collection("expenses").add(expenseData);
      await ref.update({ id: ref.id });

      return { success: true, expenseId: ref.id, expenseNumber };
    } catch (error: any) {
      console.error("[createExpenseRecord] Error:", error);
      if (error instanceof HttpsError) throw error;
      throw new HttpsError("internal", error.message || "Error al crear gasto");
    }
  }
);

// ==========================================
// updateExpenseRecord
// ==========================================

interface UpdateExpensePayload {
  expenseId: string;
  scope?: "project" | "general" | "administrative" | "field" | "other";
  category?: string;
  leadId?: string;
  assetRecordId?: string;
  assetRecordCode?: string;
  assetRecordName?: string;
  expenseDate?: string;
  vendorName?: string;
  spenderName?: string;
  paymentMethod?: string;
  documentType?: string;
  documentNumber?: string;
  netAmount?: number;
  taxAmount?: number;
  totalAmount?: number;
  status?: "pending_support" | "supported" | "reconciled" | "observed";
  description?: string;
  notes?: string;
  supportFileName?: string;
  supportMimeType?: string;
  supportData?: string;
  reviewedByUserId?: string;
}

export const updateExpenseRecord = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    }

    const companyId = request.auth.token.companyId;
    if (!companyId) {
      throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    }

    const payload = request.data as UpdateExpensePayload;
    if (!payload.expenseId) {
      throw new HttpsError("invalid-argument", "expenseId es requerido");
    }

    try {
      const cref = companyRef(companyId);
      const docRef = cref.collection("expenses").doc(payload.expenseId);
      const snap = await docRef.get();
      if (!snap.exists) {
        throw new HttpsError("not-found", "Gasto no encontrado");
      }

      const current = snap.data() as any;
      const now = nowIso();
      const updateData: Record<string, any> = { updatedAt: now };

      if (payload.scope !== undefined) {
        updateData.scope = payload.scope;
        if (payload.scope === "project" && !payload.leadId && !current.leadId) {
          throw new HttpsError("invalid-argument", "El scope 'project' requiere leadId");
        }
      }
      if (payload.category !== undefined) updateData.category = validateCategory(payload.category);
      if (payload.leadId !== undefined) updateData.leadId = payload.leadId;
      if (payload.assetRecordId !== undefined) updateData.assetRecordId = payload.assetRecordId || "";
      if (payload.assetRecordCode !== undefined) updateData.assetRecordCode = payload.assetRecordCode || "";
      if (payload.assetRecordName !== undefined) updateData.assetRecordName = payload.assetRecordName || "";
      if (payload.expenseDate !== undefined) updateData.expenseDate = payload.expenseDate;
      if (payload.vendorName !== undefined) updateData.vendorName = payload.vendorName.trim();
      if (payload.spenderName !== undefined) updateData.spenderName = payload.spenderName.trim();
      if (payload.paymentMethod !== undefined) updateData.paymentMethod = validatePaymentMethod(payload.paymentMethod) || "";
      if (payload.documentType !== undefined) updateData.documentType = payload.documentType.trim();
      if (payload.documentNumber !== undefined) updateData.documentNumber = payload.documentNumber.trim();
      if (payload.description !== undefined) updateData.description = payload.description.trim();
      if (payload.notes !== undefined) updateData.notes = payload.notes.trim();
      if (payload.supportFileName !== undefined) updateData.supportFileName = payload.supportFileName.trim();
      if (payload.supportMimeType !== undefined) updateData.supportMimeType = payload.supportMimeType.trim();
      if (payload.supportData !== undefined) updateData.supportData = payload.supportData.trim();
      if (payload.status !== undefined) updateData.status = payload.status;
      if (payload.reviewedByUserId !== undefined) {
        updateData.reviewedByUserId = payload.reviewedByUserId;
        updateData.reviewedAt = now;
      }

      // Amount coherence check
      const newNet = payload.netAmount !== undefined ? Math.max(0, Number(payload.netAmount) || 0) : current.netAmount;
      const newTax = payload.taxAmount !== undefined ? Math.max(0, Number(payload.taxAmount) || 0) : current.taxAmount;
      const newTotal = payload.totalAmount !== undefined ? Math.max(0, Number(payload.totalAmount) || 0) : current.totalAmount;

      if (payload.netAmount !== undefined || payload.taxAmount !== undefined || payload.totalAmount !== undefined) {
        if (Math.abs(newNet + newTax - newTotal) > 0.01) {
          throw new HttpsError("invalid-argument", "Los montos no son coherentes: netAmount + taxAmount debe ser igual a totalAmount");
        }
        updateData.netAmount = newNet;
        updateData.taxAmount = newTax;
        updateData.totalAmount = newTotal;
      }

      // Auto-update status if support is attached
      if (payload.supportData && payload.supportData.trim() && current.status === "pending_support") {
        updateData.status = "supported";
      }

      await docRef.update(updateData);
      return { success: true, expenseId: payload.expenseId };
    } catch (error: any) {
      console.error("[updateExpenseRecord] Error:", error);
      if (error instanceof HttpsError) throw error;
      throw new HttpsError("internal", error.message || "Error al actualizar gasto");
    }
  }
);

// ==========================================
// deleteExpenseRecord
// ==========================================

interface DeleteExpensePayload {
  expenseId: string;
}

export const deleteExpenseRecord = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    }

    const companyId = request.auth.token.companyId;
    if (!companyId) {
      throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    }

    const { expenseId } = request.data as DeleteExpensePayload;
    if (!expenseId) {
      throw new HttpsError("invalid-argument", "expenseId es requerido");
    }

    try {
      const cref = companyRef(companyId);
      const docRef = cref.collection("expenses").doc(expenseId);
      const snap = await docRef.get();
      if (!snap.exists) {
        throw new HttpsError("not-found", "Gasto no encontrado");
      }

      await docRef.delete();
      return { success: true };
    } catch (error: any) {
      console.error("[deleteExpenseRecord] Error:", error);
      if (error instanceof HttpsError) throw error;
      throw new HttpsError("internal", error.message || "Error al eliminar gasto");
    }
  }
);

// ==========================================
// createExpenseBackup
// ==========================================

interface CreateExpenseBackupPayload {
  backupName: string;
  backupType?: "manual" | "automatic";
  notes?: string;
}

export const createExpenseBackup = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    }

    const companyId = request.auth.token.companyId;
    if (!companyId) {
      throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    }

    const payload = request.data as CreateExpenseBackupPayload;
    if (!payload.backupName?.trim()) {
      throw new HttpsError("invalid-argument", "backupName es requerido");
    }

    try {
      const cref = companyRef(companyId);
      const expensesSnap = await cref.collection("expenses").get();
      const expenses = expensesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

      const snapshot = { expenses, exportedAt: nowIso() };
      const snapshotJson = JSON.stringify(snapshot);
      const checksum = crypto.createHash("sha1").update(snapshotJson).digest("hex");

      const now = nowIso();
      const backupRef = cref.collection("expenseBackups").doc();
      await backupRef.set({
        id: backupRef.id,
        companyId,
        backupName: payload.backupName.trim(),
        backupType: payload.backupType || "manual",
        notes: payload.notes?.trim() || "",
        expensesCount: expenses.length,
        checksum,
        snapshot,
        snapshotSize: snapshotJson.length,
        createdByUserId: request.auth.uid,
        createdByName: request.auth.token.name || "",
        createdAt: now,
      });

      return {
        success: true,
        backupId: backupRef.id,
        expensesCount: expenses.length,
        checksum,
      };
    } catch (error: any) {
      console.error("[createExpenseBackup] Error:", error);
      throw new HttpsError("internal", error.message || "Error al crear backup");
    }
  }
);
