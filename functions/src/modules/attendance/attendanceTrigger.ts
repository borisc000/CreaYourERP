/**
 * Firestore triggers for Attendance module.
 * - onAttendanceEventCreated: recalculates the daily record and emits notifications.
 */

import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { db } from "../../config";
import { recalculateAttendanceRecord } from "./attendanceHelpers";

export const onAttendanceEventCreated = onDocumentCreated(
  {
    document: "companies/{companyId}/attendanceEvents/{eventId}",
    region: "southamerica-west1",
  },
  async (event) => {
    const { companyId, eventId } = event.params;
    const data = event.data?.data();
    if (!data) return;

    const employeeId = data.employeeId as string;
    const date = data.date as string;
    if (!employeeId || !date) return;

    try {
      const { flags } = await recalculateAttendanceRecord(companyId, employeeId, date);

      // Emit notification if there are compliance flags
      if (flags.length > 0) {
        const employeeName = (data.employeeName as string) || employeeId;
        const eventType = (data.eventType as string) || "unknown";

        await db.collection("companies").doc(companyId).collection("notifications").add({
          companyId,
          type: "attendance_compliance",
          title: `Alerta de asistencia: ${employeeName}`,
          message: `Marcación ${eventType} generó flags: ${flags.join(", ")}`,
          severity: flags.includes("late_arrival") || flags.includes("missing_exit") ? "warning" : "info",
          relatedModule: "attendance",
          relatedRecordId: eventId,
          read: false,
          createdAt: new Date().toISOString(),
        });
      }
    } catch (error) {
      console.error("[onAttendanceEventCreated] Error:", error);
    }
  }
);
