import {
  addDays,
  addHours,
  addMinutes,
  addMonths,
  addSeconds,
  addWeeks,
  addYears,
  endOfDay,
  endOfMonth,
  endOfWeek,
  endOfYear,
  format,
  getDate,
  getDaysInMonth,
  getHours,
  getMilliseconds,
  getMinutes,
  getMonth,
  getSeconds,
  getWeek,
  getYear,
  isAfter,
  isBefore,
  isEqual,
  isSameDay,
  isSameHour,
  isSameMonth,
  isSameYear,
  isValid,
  isWithinInterval,
  longFormatters,
  parse,
  setDate,
  setHours,
  setMilliseconds,
  setMinutes,
  setMonth,
  setSeconds,
  setYear,
  startOfDay,
  startOfMonth,
  startOfYear
} from "./chunk-4OPECD6D.js";
import {
  enUS,
  startOfWeek
} from "./chunk-5HRXGGY4.js";
import {
  _extends
} from "./chunk-HQ6ZTAWL.js";
import "./chunk-G3PMV62Z.js";

// node_modules/@mui/x-date-pickers/esm/AdapterDateFnsBase/AdapterDateFnsBase.js
var formatTokenMap = {
  // Year
  y: {
    sectionType: "year",
    contentType: "digit",
    maxLength: 4
  },
  yy: "year",
  yyy: {
    sectionType: "year",
    contentType: "digit",
    maxLength: 4
  },
  yyyy: "year",
  // Month
  M: {
    sectionType: "month",
    contentType: "digit",
    maxLength: 2
  },
  MM: "month",
  MMMM: {
    sectionType: "month",
    contentType: "letter"
  },
  MMM: {
    sectionType: "month",
    contentType: "letter"
  },
  L: {
    sectionType: "month",
    contentType: "digit",
    maxLength: 2
  },
  LL: "month",
  LLL: {
    sectionType: "month",
    contentType: "letter"
  },
  LLLL: {
    sectionType: "month",
    contentType: "letter"
  },
  // Day of the month
  d: {
    sectionType: "day",
    contentType: "digit",
    maxLength: 2
  },
  dd: "day",
  do: {
    sectionType: "day",
    contentType: "digit-with-letter"
  },
  // Day of the week
  E: {
    sectionType: "weekDay",
    contentType: "letter"
  },
  EE: {
    sectionType: "weekDay",
    contentType: "letter"
  },
  EEE: {
    sectionType: "weekDay",
    contentType: "letter"
  },
  EEEE: {
    sectionType: "weekDay",
    contentType: "letter"
  },
  EEEEE: {
    sectionType: "weekDay",
    contentType: "letter"
  },
  i: {
    sectionType: "weekDay",
    contentType: "digit",
    maxLength: 1
  },
  ii: "weekDay",
  iii: {
    sectionType: "weekDay",
    contentType: "letter"
  },
  iiii: {
    sectionType: "weekDay",
    contentType: "letter"
  },
  // eslint-disable-next-line id-denylist
  e: {
    sectionType: "weekDay",
    contentType: "digit",
    maxLength: 1
  },
  ee: "weekDay",
  eee: {
    sectionType: "weekDay",
    contentType: "letter"
  },
  eeee: {
    sectionType: "weekDay",
    contentType: "letter"
  },
  eeeee: {
    sectionType: "weekDay",
    contentType: "letter"
  },
  eeeeee: {
    sectionType: "weekDay",
    contentType: "letter"
  },
  c: {
    sectionType: "weekDay",
    contentType: "digit",
    maxLength: 1
  },
  cc: "weekDay",
  ccc: {
    sectionType: "weekDay",
    contentType: "letter"
  },
  cccc: {
    sectionType: "weekDay",
    contentType: "letter"
  },
  ccccc: {
    sectionType: "weekDay",
    contentType: "letter"
  },
  cccccc: {
    sectionType: "weekDay",
    contentType: "letter"
  },
  // Meridiem
  a: "meridiem",
  aa: "meridiem",
  aaa: "meridiem",
  // Hours
  H: {
    sectionType: "hours",
    contentType: "digit",
    maxLength: 2
  },
  HH: "hours",
  h: {
    sectionType: "hours",
    contentType: "digit",
    maxLength: 2
  },
  hh: "hours",
  // Minutes
  m: {
    sectionType: "minutes",
    contentType: "digit",
    maxLength: 2
  },
  mm: "minutes",
  // Seconds
  s: {
    sectionType: "seconds",
    contentType: "digit",
    maxLength: 2
  },
  ss: "seconds"
};
var defaultFormats = {
  year: "yyyy",
  month: "LLLL",
  monthShort: "MMM",
  dayOfMonth: "d",
  dayOfMonthFull: "do",
  weekday: "EEEE",
  weekdayShort: "EEEEEE",
  hours24h: "HH",
  hours12h: "hh",
  meridiem: "aa",
  minutes: "mm",
  seconds: "ss",
  fullDate: "PP",
  keyboardDate: "P",
  shortDate: "MMM d",
  normalDate: "d MMMM",
  normalDateWithWeekday: "EEE, MMM d",
  fullTime12h: "hh:mm aa",
  fullTime24h: "HH:mm",
  keyboardDateTime12h: "P hh:mm aa",
  keyboardDateTime24h: "P HH:mm"
};
var AdapterDateFnsBase = class {
  isMUIAdapter = true;
  isTimezoneCompatible = false;
  formatTokenMap = /* @__PURE__ */ (() => formatTokenMap)();
  escapedCharacters = {
    start: "'",
    end: "'"
  };
  constructor(props) {
    const {
      locale,
      formats,
      longFormatters: longFormatters2,
      lib
    } = props;
    this.locale = locale;
    this.formats = _extends({}, defaultFormats, formats);
    this.longFormatters = longFormatters2;
    this.lib = lib || "date-fns";
  }
  date = (value) => {
    if (typeof value === "undefined") {
      return /* @__PURE__ */ new Date();
    }
    if (value === null) {
      return null;
    }
    return new Date(value);
  };
  getInvalidDate = () => /* @__PURE__ */ new Date("Invalid Date");
  getTimezone = () => {
    return "default";
  };
  setTimezone = (value) => {
    return value;
  };
  toJsDate = (value) => {
    return value;
  };
  getCurrentLocaleCode = () => {
    return this.locale.code;
  };
  // Note: date-fns input types are more lenient than this adapter, so we need to expose our more
  // strict signature and delegate to the more lenient signature. Otherwise, we have downstream type errors upon usage.
  is12HourCycleInCurrentLocale = () => {
    return /a/.test(this.locale.formatLong.time({
      width: "short"
    }));
  };
  expandFormat = (format2) => {
    const longFormatRegexp = /P+p+|P+|p+|''|'(''|[^'])+('|$)|./g;
    return format2.match(longFormatRegexp).map((token) => {
      const firstCharacter = token[0];
      if (firstCharacter === "p" || firstCharacter === "P") {
        const longFormatter = this.longFormatters[firstCharacter];
        return longFormatter(token, this.locale.formatLong);
      }
      return token;
    }).join("");
  };
  formatNumber = (numberToFormat) => {
    return numberToFormat;
  };
  getDayOfWeek = (value) => {
    return value.getDay() + 1;
  };
};

// node_modules/@mui/x-date-pickers/esm/AdapterDateFns/AdapterDateFns.js
var AdapterDateFns = class extends AdapterDateFnsBase {
  constructor({
    locale,
    formats
  } = {}) {
    if (true) {
      if (typeof addDays !== "function") {
        throw new Error(["MUI: The `date-fns` package v2.x is not compatible with this adapter.", "Please, install v3.x or v4.x of the package or use the `AdapterDateFnsV2` instead."].join("\n"));
      }
      if (!longFormatters) {
        throw new Error("MUI: The minimum supported `date-fns` package version compatible with this adapter is `3.2.x`.");
      }
    }
    super({
      locale: locale ?? enUS,
      formats,
      longFormatters
    });
  }
  // TODO: explicit return types can be removed once there is only one date-fns version supported
  parse = (value, format2) => {
    if (value === "") {
      return null;
    }
    return parse(value, format2, /* @__PURE__ */ new Date(), {
      locale: this.locale
    });
  };
  isValid = (value) => {
    if (value == null) {
      return false;
    }
    return isValid(value);
  };
  format = (value, formatKey) => {
    return this.formatByString(value, this.formats[formatKey]);
  };
  formatByString = (value, formatString) => {
    return format(value, formatString, {
      locale: this.locale
    });
  };
  isEqual = (value, comparing) => {
    if (value === null && comparing === null) {
      return true;
    }
    if (value === null || comparing === null) {
      return false;
    }
    return isEqual(value, comparing);
  };
  isSameYear = (value, comparing) => {
    return isSameYear(value, comparing);
  };
  isSameMonth = (value, comparing) => {
    return isSameMonth(value, comparing);
  };
  isSameDay = (value, comparing) => {
    return isSameDay(value, comparing);
  };
  isSameHour = (value, comparing) => {
    return isSameHour(value, comparing);
  };
  isAfter = (value, comparing) => {
    return isAfter(value, comparing);
  };
  isAfterYear = (value, comparing) => {
    return isAfter(value, endOfYear(comparing));
  };
  isAfterDay = (value, comparing) => {
    return isAfter(value, endOfDay(comparing));
  };
  isBefore = (value, comparing) => {
    return isBefore(value, comparing);
  };
  isBeforeYear = (value, comparing) => {
    return isBefore(value, this.startOfYear(comparing));
  };
  isBeforeDay = (value, comparing) => {
    return isBefore(value, this.startOfDay(comparing));
  };
  isWithinRange = (value, [start, end]) => {
    return isWithinInterval(value, {
      start,
      end
    });
  };
  startOfYear = (value) => {
    return startOfYear(value);
  };
  startOfMonth = (value) => {
    return startOfMonth(value);
  };
  startOfWeek = (value) => {
    return startOfWeek(value, {
      locale: this.locale
    });
  };
  startOfDay = (value) => {
    return startOfDay(value);
  };
  endOfYear = (value) => {
    return endOfYear(value);
  };
  endOfMonth = (value) => {
    return endOfMonth(value);
  };
  endOfWeek = (value) => {
    return endOfWeek(value, {
      locale: this.locale
    });
  };
  endOfDay = (value) => {
    return endOfDay(value);
  };
  addYears = (value, amount) => {
    return addYears(value, amount);
  };
  addMonths = (value, amount) => {
    return addMonths(value, amount);
  };
  addWeeks = (value, amount) => {
    return addWeeks(value, amount);
  };
  addDays = (value, amount) => {
    return addDays(value, amount);
  };
  addHours = (value, amount) => {
    return addHours(value, amount);
  };
  addMinutes = (value, amount) => {
    return addMinutes(value, amount);
  };
  addSeconds = (value, amount) => {
    return addSeconds(value, amount);
  };
  getYear = (value) => {
    return getYear(value);
  };
  getMonth = (value) => {
    return getMonth(value);
  };
  getDate = (value) => {
    return getDate(value);
  };
  getHours = (value) => {
    return getHours(value);
  };
  getMinutes = (value) => {
    return getMinutes(value);
  };
  getSeconds = (value) => {
    return getSeconds(value);
  };
  getMilliseconds = (value) => {
    return getMilliseconds(value);
  };
  setYear = (value, year) => {
    return setYear(value, year);
  };
  setMonth = (value, month) => {
    return setMonth(value, month);
  };
  setDate = (value, date) => {
    return setDate(value, date);
  };
  setHours = (value, hours) => {
    return setHours(value, hours);
  };
  setMinutes = (value, minutes) => {
    return setMinutes(value, minutes);
  };
  setSeconds = (value, seconds) => {
    return setSeconds(value, seconds);
  };
  setMilliseconds = (value, milliseconds) => {
    return setMilliseconds(value, milliseconds);
  };
  getDaysInMonth = (value) => {
    return getDaysInMonth(value);
  };
  getWeekArray = (value) => {
    const start = this.startOfWeek(this.startOfMonth(value));
    const end = this.endOfWeek(this.endOfMonth(value));
    let count = 0;
    let current = start;
    const nestedWeeks = [];
    while (this.isBefore(current, end)) {
      const weekNumber = Math.floor(count / 7);
      nestedWeeks[weekNumber] = nestedWeeks[weekNumber] || [];
      nestedWeeks[weekNumber].push(current);
      current = this.addDays(current, 1);
      count += 1;
    }
    return nestedWeeks;
  };
  getWeekNumber = (value) => {
    return getWeek(value, {
      locale: this.locale
    });
  };
  getYearRange = ([start, end]) => {
    const startDate = this.startOfYear(start);
    const endDate = this.endOfYear(end);
    const years = [];
    let current = startDate;
    while (this.isBefore(current, endDate)) {
      years.push(current);
      current = this.addYears(current, 1);
    }
    return years;
  };
};
export {
  AdapterDateFns
};
//# sourceMappingURL=@mui_x-date-pickers_AdapterDateFns.js.map
