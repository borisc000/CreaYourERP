import {
  normalizeDates,
  startOfWeek
} from "./chunk-5HRXGGY4.js";

// node_modules/date-fns/isSameWeek.js
function isSameWeek(laterDate, earlierDate, options) {
  const [laterDate_, earlierDate_] = normalizeDates(
    options?.in,
    laterDate,
    earlierDate
  );
  return +startOfWeek(laterDate_, options) === +startOfWeek(earlierDate_, options);
}

export {
  isSameWeek
};
//# sourceMappingURL=chunk-DIOWUBW2.js.map
