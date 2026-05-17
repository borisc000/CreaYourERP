import { onCall, HttpsError } from "firebase-functions/v2/https";
import { assertAction } from "../../shared/rbac";
import { db } from "../../config";

const cors = ["http://localhost:5173", "http://localhost:5000", "https://your-erp.web.app", "https://your-erp-staging.web.app", "https://your-erp-staging.firebaseapp.com"];
function nowIso() { return new Date().toISOString(); }
function companyRef(companyId: string) { return db.collection("companies").doc(companyId); }

const DEFAULT_PARAMS = [
  { code: "IMM", name: "Sueldo Mínimo Mensual", category: "salary", valueNumeric: 539000, sourceLabel: "Ministerio del Trabajo" },
  { code: "UTM", name: "Unidad Tributaria Mensual", category: "tax", valueNumeric: 69889, sourceLabel: "SII" },
  { code: "UF", name: "Unidad de Fomento", category: "tax", valueNumeric: 39790, sourceLabel: "SII" },
  { code: "TOPE_AFP", name: "Tope imponible AFP", category: "pension", valueNumeric: 90, sourceLabel: "Superintendencia de Pensiones" },
  { code: "TOPE_SALUD", name: "Tope imponible Salud", category: "health", valueNumeric: 90, sourceLabel: "FONASA/Isapre" },
  { code: "TOPE_AFC", name: "Tope imponible AFC", category: "pension", valueNumeric: 135.2, sourceLabel: "SII" },
  { code: "TASA_SIS", name: "Tasa SIS", category: "health", valueNumeric: 1.54, sourceLabel: "Ley 18.933" },
  { code: "ACCIDENT_RATE", name: "Tasa accidentes Ley 16.744", category: "insurance", valueNumeric: 0.93, sourceLabel: "ACHS" },
  { code: "GRATIFICATION_PCT", name: "Gratificación legal %", category: "benefits", valueNumeric: 25, sourceLabel: "Art. 50 Código del Trabajo" },
  { code: "PENSION_REFORM_PCT", name: "Reforma previsional empleador %", category: "pension", valueNumeric: 1.0, sourceLabel: "Ley 21.431" },
];

const AFP_RATES: Record<string, { pension: number; commission: number }> = {
  capital: { pension: 10.44, commission: 1.44 },
  cuprum: { pension: 10.48, commission: 1.48 },
  habitat: { pension: 10.34, commission: 1.34 },
  modelo: { pension: 10.42, commission: 0.77 },
  planvital: { pension: 10.41, commission: 1.41 },
  provida: { pension: 10.69, commission: 1.69 },
  uno: { pension: 10.49, commission: 0.49 },
};

export const seedPayrollParameters = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    }
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "payroll.create", { companyId });
    const existing = await companyRef(companyId).collection("payrollLegalParameters").limit(1).get();
    if (!existing.empty) return { alreadySeeded: true };
    for (const p of DEFAULT_PARAMS) {
      await companyRef(companyId).collection("payrollLegalParameters").add({
        companyId, ...p, effectiveFrom: "2024-01-01", createdAt: nowIso(), updatedAt: nowIso(),
      });
    }
    // Default tax brackets (simplified 2024 Chile)
    const brackets = [
      { lowerUtm: 0, upperUtm: 13.5, factor: 0, rebateUtm: 0 },
      { lowerUtm: 13.5, upperUtm: 30, factor: 0.04, rebateUtm: 0.54 },
      { lowerUtm: 30, upperUtm: 50, factor: 0.08, rebateUtm: 1.74 },
      { lowerUtm: 50, upperUtm: 70, factor: 0.135, rebateUtm: 4.49 },
      { lowerUtm: 70, upperUtm: 90, factor: 0.23, rebateUtm: 11.14 },
      { lowerUtm: 90, upperUtm: 120, factor: 0.304, rebateUtm: 17.8 },
      { lowerUtm: 120, upperUtm: 310, factor: 0.355, rebateUtm: 23.92 },
      { lowerUtm: 310, upperUtm: null as any, factor: 0.4, rebateUtm: 37.87 },
    ];
    for (let i = 0; i < brackets.length; i++) {
      await companyRef(companyId).collection("payrollTaxBrackets").add({
        companyId, orderIndex: i, effectiveFrom: "2024-01-01", ...brackets[i], createdAt: nowIso(), updatedAt: nowIso(),
      });
    }
    return { seeded: true };
  }
);

export const getPayrollDashboard = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    }
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "payroll.view", { companyId });
    const [periods, profiles, settlements] = await Promise.all([
      companyRef(companyId).collection("payrollPeriods").limit(200).get(),
      companyRef(companyId).collection("payrollProfiles").limit(200).get(),
      companyRef(companyId).collection("payrollSettlements").limit(500).get(),
    ]);
    const activePeriods = periods.docs.filter((d) => d.data().status === "calculated" || d.data().status === "approved").length;
    const totalNetPay = settlements.docs.reduce((sum, d) => sum + (d.data().netPay || 0), 0);
    return {
      totalPeriods: periods.size, activePeriods, closedPeriods: periods.size - activePeriods,
      totalProfiles: profiles.size, enabledProfiles: profiles.docs.filter((d) => d.data().payrollEnabled).length,
      totalSettlements: settlements.size, totalNetPay: Math.round(totalNetPay),
    };
  }
);

export const createPayrollPeriod = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    }
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "payroll.create", { companyId });
    const { name, year, month, startDate, endDate, paymentDate } = request.data;
    if (!name || !year || !month) throw new HttpsError("invalid-argument", "Datos incompletos");
    const ref = await companyRef(companyId).collection("payrollPeriods").add({
      companyId, name, year, month, startDate: startDate || "", endDate: endDate || "",
      paymentDate: paymentDate || "", status: "draft", notes: "", createdAt: nowIso(), updatedAt: nowIso(),
    });
    return { id: ref.id };
  }
);

export const calculatePeriod = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    }
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "payroll.edit", { companyId });
    const { periodId } = request.data;
    if (!periodId) throw new HttpsError("invalid-argument", "Datos incompletos");

    const period = await companyRef(companyId).collection("payrollPeriods").doc(periodId).get();
    if (!period.exists) throw new HttpsError("not-found", "Período no encontrado");

    // Get legal params
    const paramsSnap = await companyRef(companyId).collection("payrollLegalParameters").get();
    const params: Record<string, number> = {};
    paramsSnap.docs.forEach((d) => { params[d.data().code] = d.data().valueNumeric || 0; });

    // Get tax brackets
    const bracketsSnap = await companyRef(companyId).collection("payrollTaxBrackets").orderBy("orderIndex").get();
    const brackets = bracketsSnap.docs.map((d) => d.data());

    // Get all enabled profiles with employee data
    const profilesSnap = await companyRef(companyId).collection("payrollProfiles").where("payrollEnabled", "==", true).get();

    // Get employees for names
    const employeesSnap = await companyRef(companyId).collection("employees").get();
    const employeeMap: Record<string, any> = {};
    employeesSnap.docs.forEach((d) => { employeeMap[d.id] = d.data(); });

    const settlements: any[] = [];

    for (const profDoc of profilesSnap.docs) {
      const prof = profDoc.data();
      const emp = employeeMap[prof.employeeId] || {};
      const baseSalary = emp.baseSalary || params.IMM || 539000;
      const workedDays = 30; // simplified
      const taxableIncome = Math.round(baseSalary * (workedDays / 30));

      // AFP
      const afpRate = AFP_RATES[prof.afpCode || "habitat"] || { pension: 10.34, commission: 1.34 };
      const topeAfpUf = params.TOPE_AFP || 90;
      const topeAfp = topeAfpUf * (params.UF || 39790);
      const afpBase = Math.min(taxableIncome, topeAfp);
      const pensionAmount = Math.round(afpBase * (afpRate.pension / 100));
      const afpCommissionAmount = Math.round(afpBase * (afpRate.commission / 100));

      // Health
      const topeHealth = (params.TOPE_SALUD || 90) * (params.UF || 39790);
      const healthBase = Math.min(taxableIncome, topeHealth);
      const healthAmount = prof.healthSystem === "isapre"
        ? Math.round(prof.healthPlanClp || healthBase * 0.07)
        : Math.round(healthBase * 0.07);

      // Gratification
      let legalGratificationAmount = 0;
      if (prof.legalGratificationMode === "article_50_monthly") {
        const maxGrat = Math.round(((params.IMM || 539000) * 4.75 / 12) * (workedDays / 30));
        legalGratificationAmount = Math.min(Math.round(taxableIncome * ((params.GRATIFICATION_PCT || 25) / 100)), maxGrat);
      } else if (prof.legalGratificationMode === "manual") {
        legalGratificationAmount = prof.manualGratificationAmount || 0;
      }

      // Taxable total
      const taxableTotal = taxableIncome + legalGratificationAmount + (prof.recurringTaxableBonus || 0);

      // Tax (impuesto única 2da categoría)
      const utm = params.UTM || 69889;
      const taxableUtm = taxableTotal / utm;
      let taxAmount = 0;
      for (const b of brackets) {
        if (taxableUtm > b.lowerUtm && (!b.upperUtm || taxableUtm <= b.upperUtm)) {
          taxAmount = Math.round((taxableUtm * b.factor - b.rebateUtm) * utm);
          break;
        }
      }
      taxAmount = Math.max(0, taxAmount);

      // AFC employee
      let afcEmployeeAmount = 0;
      const topeAfc = (params.TOPE_AFC || 135.2) * (params.UF || 39790);
      const afcBase = Math.min(taxableIncome, topeAfc);
      if (emp.contractType === "indefinite") afcEmployeeAmount = Math.round(afcBase * 0.006);

      // Family allowance
      let familyAllowanceAmount = 0;
      if (prof.familyAllowanceCharges > 0 && prof.familyAllowanceSection !== "none") {
        const amounts: Record<string, number> = { A: 18523, B: 11339, C: 3581 };
        familyAllowanceAmount = (amounts[prof.familyAllowanceSection] || 0) * prof.familyAllowanceCharges;
      }

      // Deductions
      const otherDeductions = (prof.recurringOtherDeduction || 0) + (prof.loanDeduction || 0) + (prof.advanceDeduction || 0);
      const totalDeductions = pensionAmount + afpCommissionAmount + healthAmount + taxAmount + afcEmployeeAmount + otherDeductions;

      // Employer costs
      const employerAfc = emp.contractType === "indefinite" ? Math.round(afcBase * 0.024) : Math.round(afcBase * 0.03);
      const employerSis = Math.round(healthBase * ((params.TASA_SIS || 1.54) / 100));
      const employerAccident = Math.round(taxableIncome * ((params.ACCIDENT_RATE || 0.93) / 100));
      const employerPensionReform = Math.round(taxableIncome * ((params.PENSION_REFORM_PCT || 1) / 100));
      const employerTotal = employerAfc + employerSis + employerAccident + employerPensionReform;
      const employerCost = taxableIncome + employerTotal;

      // Net pay
      const nonTaxableIncome = (prof.recurringNonTaxableAllowance || 0) + familyAllowanceAmount;
      const totalEarnings = taxableTotal + nonTaxableIncome;
      const netPay = totalEarnings - totalDeductions;

      const lineItems = [
        { type: "earning", concept: "Sueldo base", amount: taxableIncome },
        { type: "earning", concept: "Gratificación legal", amount: legalGratificationAmount },
        { type: "earning", concept: "Asignación familiar", amount: familyAllowanceAmount },
        { type: "deduction", concept: "AFP pension", amount: pensionAmount },
        { type: "deduction", concept: "AFP comisión", amount: afpCommissionAmount },
        { type: "deduction", concept: "Salud", amount: healthAmount },
        { type: "deduction", concept: "Impuesto único", amount: taxAmount },
        { type: "deduction", concept: "AFC trabajador", amount: afcEmployeeAmount },
      ];

      const warnings: string[] = [];
      if (taxableIncome < (params.IMM || 539000)) warnings.push("Sueldo base inferior al mínimo legal");
      if (netPay < 0) warnings.push("Líquido a pagar negativo");

      const settleRef = await companyRef(companyId).collection("payrollSettlements").add({
        companyId, periodId, employeeId: prof.employeeId, employeeName: emp.fullName || "",
        payrollProfileId: profDoc.id, status: "calculated", workedDays, overtimeHours: 0,
        baseSalary, taxableIncome, nonTaxableIncome, totalEarnings, totalDeductions, netPay,
        taxBase: taxableTotal, taxAmount, legalGratificationAmount, familyAllowanceAmount,
        pensionAmount, afpCommissionAmount, healthAmount, afcEmployeeAmount,
        employerAfcAmount: employerAfc, employerSisAmount: employerSis,
        employerAccidentAmount: employerAccident, employerPensionReformAmount: employerPensionReform,
        employerTotal, employerCost, lineItems, warnings, notes: "", createdAt: nowIso(), updatedAt: nowIso(),
      });
      settlements.push({ id: settleRef.id, employeeName: emp.fullName, netPay });
    }

    await companyRef(companyId).collection("payrollPeriods").doc(periodId).update({ status: "calculated", updatedAt: nowIso() });
    return { calculated: true, settlementsCount: settlements.length, settlements };
  }
);

export const approvePeriod = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    }
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "payroll.edit", { companyId });
    const { periodId } = request.data;
    if (!periodId) throw new HttpsError("invalid-argument", "Datos incompletos");
    const settlements = await companyRef(companyId).collection("payrollSettlements").where("periodId", "==", periodId).get();
    for (const d of settlements.docs) {
      await d.ref.update({ status: "approved", approvedBy: request.auth?.uid || "", approvedAt: nowIso(), updatedAt: nowIso() });
    }
    await companyRef(companyId).collection("payrollPeriods").doc(periodId).update({ status: "approved", updatedAt: nowIso() });
    return { approved: true };
  }
);

export const closePeriod = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    }
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "payroll.edit", { companyId });
    const { periodId } = request.data;
    if (!periodId) throw new HttpsError("invalid-argument", "Datos incompletos");
    const settlements = await companyRef(companyId).collection("payrollSettlements").where("periodId", "==", periodId).get();
    for (const d of settlements.docs) {
      await d.ref.update({ status: "closed", closedAt: nowIso(), updatedAt: nowIso() });
    }
    await companyRef(companyId).collection("payrollPeriods").doc(periodId).update({ status: "closed", updatedAt: nowIso() });
    return { closed: true };
  }
);

export const savePayrollProfile = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    }
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "payroll.edit", { companyId });
    const { id, ...data } = request.data;
    if (!data.employeeId) throw new HttpsError("invalid-argument", "Datos incompletos");
    if (id) {
      await companyRef(companyId).collection("payrollProfiles").doc(id).update({ ...data, updatedAt: nowIso() });
      return { id, updated: true };
    } else {
      const ref = await companyRef(companyId).collection("payrollProfiles").add({
        ...data, companyId, payrollEnabled: true, requireSignature: false, createdAt: nowIso(), updatedAt: nowIso(),
      });
      return { id: ref.id };
    }
  }
);
