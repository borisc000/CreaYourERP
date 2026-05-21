/**
 * Chilean overtime calculator.
 * Based on Labor Code (Código del Trabajo) norms:
 * - Ordinary workday: typically 8-9 hours/day, 45 hrs/week (or 44h for some sectors)
 * - Overtime: first 2 hours at +50%, subsequent hours at +100%
 * - Weekly average max: 12 overtime hours
 * - Overtime hour value = baseSalary / 30 / dailyHours
 */

export interface OvertimeResult {
  overtimeHours: number;
  overtimeAmount: number;
  ordinaryHourValue: number;
  details: Array<{ date: string; hours: number; rate: number; amount: number }>;
}

export function calculateChileanOvertime(
  baseSalary: number,
  dailyHours: number,
  overtimeEvents: Array<{ date: string; hours: number }>
): OvertimeResult {
  const ordinaryHourValue = baseSalary / 30 / dailyHours;
  let totalOvertimeHours = 0;
  let totalOvertimeAmount = 0;
  const details: Array<{ date: string; hours: number; rate: number; amount: number }> = [];

  // Group by date
  const byDate: Record<string, number> = {};
  for (const ev of overtimeEvents) {
    byDate[ev.date] = (byDate[ev.date] || 0) + ev.hours;
  }

  for (const [date, hours] of Object.entries(byDate)) {
    let dayAmount = 0;
    let dayHours = 0;

    if (hours <= 2) {
      // First 2 hours at 50%
      dayAmount = hours * ordinaryHourValue * 1.5;
      dayHours = hours;
      details.push({ date, hours, rate: 1.5, amount: dayAmount });
    } else {
      // First 2 hours at 50%
      const firstTwo = 2 * ordinaryHourValue * 1.5;
      // Remaining at 100%
      const remaining = (hours - 2) * ordinaryHourValue * 2.0;
      dayAmount = firstTwo + remaining;
      dayHours = hours;
      details.push({ date, hours: 2, rate: 1.5, amount: firstTwo });
      details.push({ date, hours: hours - 2, rate: 2.0, amount: remaining });
    }

    totalOvertimeHours += dayHours;
    totalOvertimeAmount += dayAmount;
  }

  return {
    overtimeHours: Math.round(totalOvertimeHours * 100) / 100,
    overtimeAmount: Math.round(totalOvertimeAmount),
    ordinaryHourValue: Math.round(ordinaryHourValue * 100) / 100,
    details,
  };
}
