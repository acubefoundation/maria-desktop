// Ethiopian Calendar Conversion Utilities
//
// Ethiopian calendar:
// - 12 months of 30 days
// - Pagume (13th month) has 5 or 6 days
// - Ethiopian New Year begins on September 11 or September 12
//
// IMPORTANT:
// The September 11/12 rule depends on the Gregorian year that
// contains the Ethiopian New Year, not simply whether that
// Gregorian year itself is a leap year.

export const ETHIOPIAN_MONTHS = [
  'Meskerem',
  'Tikimt',
  'Hidar',
  'Tahsas',
  'Tir',
  'Yekatit',
  'Megabit',
  'Miazia',
  'Ginbot',
  'Sene',
  'Hamle',
  'Nehase',
  'Pagume'
];

export const ETHIOPIAN_MONTHS_SHORT = [
  'Mes',
  'Tik',
  'Hid',
  'Tah',
  'Tir',
  'Yek',
  'Meg',
  'Mia',
  'Gin',
  'Sen',
  'Ham',
  'Neh',
  'Pag'
];

export const ETHIOPIAN_MONTHS_AMHARIC = [
  'መስከረም',
  'ጥቅምት',
  'ህዳር',
  'ታህሳስ',
  'ጥር',
  'የካቲት',
  'መጋቢት',
  'ሚያዚያ',
  'ግንቦት',
  'ሰኔ',
  'ሐምሌ',
  'ነሐሴ',
  'ጳጉሜ'
];

export const ETHIOPIAN_MONTHS_AMHARIC_SHORT = [
  'መስ',
  'ጥቅ',
  'ህዳ',
  'ታህ',
  'ጥር',
  'የካ',
  'መጋ',
  'ሚያ',
  'ግን',
  'ሰኔ',
  'ሐም',
  'ነሐ',
  'ጳጉ'
];

const GREGORIAN_DAYS = [
  31, // January
  28, // February
  31, // March
  30, // April
  31, // May
  30, // June
  31, // July
  31, // August
  30, // September
  31, // October
  30, // November
  31  // December
];

/* ============================================================
   Gregorian utilities
   ============================================================ */

export function isGregorianLeapYear(year) {
  return (
    (year % 4 === 0 && year % 100 !== 0) ||
    year % 400 === 0
  );
}

export function getGregorianDaysInMonth(year, month) {
  if (month < 0 || month > 11) {
    return 0;
  }

  if (month === 1) {
    return isGregorianLeapYear(year) ? 29 : 28;
  }

  return GREGORIAN_DAYS[month];
}

/* ============================================================
   Ethiopian utilities
   ============================================================ */

export function isEthiopianLeapYear(year) {
  // Ethiopian leap year occurs when the year leaves remainder 3
  // when divided by 4.
  return year % 4 === 3;
}

export function getEthiopianDaysInMonth(year, month) {
  if (month < 0 || month > 12) {
    return 0;
  }

  // Pagume
  if (month === 12) {
    return isEthiopianLeapYear(year) ? 6 : 5;
  }

  // All other Ethiopian months have 30 days
  return 30;
}

/* ============================================================
   Ethiopian New Year
   ============================================================ */

/**
 * Returns the Gregorian date on which Ethiopian New Year
 * (Meskerem 1) begins for a given Gregorian year.
 *
 * Ethiopian New Year is:
 *
 * September 11 normally
 * September 12 when the following Gregorian year is leap
 *
 * Examples:
 * 2023 -> September 12
 * 2024 -> September 11
 * 2025 -> September 11
 * 2027 -> September 12
 */
function getEthiopianNewYearGregorianDate(gregorianYear) {
  const septemberDay = isGregorianLeapYear(gregorianYear + 1)
    ? 12
    : 11;

  return new Date(
    gregorianYear,
    8, // September
    septemberDay,
    0,
    0,
    0,
    0
  );
}

/**
 * Returns the number of whole calendar days between two local
 * dates.
 *
 * We normalize both dates to midnight before calculating.
 */
function differenceInCalendarDays(fromDate, toDate) {
  const from = new Date(
    fromDate.getFullYear(),
    fromDate.getMonth(),
    fromDate.getDate()
  );

  const to = new Date(
    toDate.getFullYear(),
    toDate.getMonth(),
    toDate.getDate()
  );

  const millisecondsPerDay = 24 * 60 * 60 * 1000;

  return Math.round(
    (to.getTime() - from.getTime()) / millisecondsPerDay
  );
}

/* ============================================================
   Gregorian -> Ethiopian
   ============================================================ */

export function gregorianToEthiopian(gregorianDate) {
  const date = new Date(gregorianDate);

  if (Number.isNaN(date.getTime())) {
    throw new Error('Invalid Gregorian date');
  }

  const gYear = date.getFullYear();

  // New Year for the Gregorian year containing this date
  const newYearThisGregorianYear =
    getEthiopianNewYearGregorianDate(gYear);

  let ethYear;
  let ethNewYear;

  if (date >= newYearThisGregorianYear) {
    // Ethiopian year starts during this Gregorian year.
    ethYear = gYear - 7;
    ethNewYear = newYearThisGregorianYear;
  } else {
    // Date belongs to the Ethiopian year that started
    // during the previous Gregorian year.
    ethYear = gYear - 8;

    ethNewYear =
      getEthiopianNewYearGregorianDate(gYear - 1);
  }

  // Number of days since Meskerem 1
  const daysSinceNewYear = differenceInCalendarDays(
    ethNewYear,
    date
  );

  // Each of the first 12 months has exactly 30 days.
  let ethMonth;
  let ethDay;

  if (daysSinceNewYear < 360) {
    ethMonth = Math.floor(daysSinceNewYear / 30);
    ethDay = (daysSinceNewYear % 30) + 1;
  } else {
    // Pagume
    ethMonth = 12;
    ethDay = daysSinceNewYear - 360 + 1;
  }

  return {
    year: ethYear,
    month: ethMonth,
    day: ethDay,

    monthName: ETHIOPIAN_MONTHS[ethMonth],
    monthNameShort: ETHIOPIAN_MONTHS_SHORT[ethMonth],

    monthNameAmharic:
      ETHIOPIAN_MONTHS_AMHARIC[ethMonth],

    monthNameAmharicShort:
      ETHIOPIAN_MONTHS_AMHARIC_SHORT[ethMonth]
  };
}

/* ============================================================
   Ethiopian -> Gregorian
   ============================================================ */

export function ethiopianToGregorian(
  ethYear,
  ethMonth,
  ethDay
) {
  if (!Number.isInteger(ethYear)) {
    throw new Error('Invalid Ethiopian year');
  }

  if (!Number.isInteger(ethMonth) || ethMonth < 0 || ethMonth > 12) {
    throw new Error('Invalid Ethiopian month');
  }

  const maxDay = getEthiopianDaysInMonth(
    ethYear,
    ethMonth
  );

  if (!Number.isInteger(ethDay) || ethDay < 1 || ethDay > maxDay) {
    throw new Error('Invalid Ethiopian day');
  }

  /*
   * Ethiopian year N normally begins in Gregorian year N + 7.
   */
  const gregorianYear = ethYear + 7;

  const ethNewYear = getEthiopianNewYearGregorianDate(
    gregorianYear
  );

  /*
   * Number of days after Meskerem 1.
   */
  const daysSinceNewYear =
    ethMonth < 12
      ? ethMonth * 30 + (ethDay - 1)
      : 360 + (ethDay - 1);

  /*
   * Clone the date so we don't mutate the New Year object.
   */
  const result = new Date(ethNewYear);

  result.setDate(
    result.getDate() + daysSinceNewYear
  );

  return result;
}

/* ============================================================
   Formatting
   ============================================================ */

export function formatEthiopian(date, options = {}) {
  const {
    amharic = false,
    short = false,
    includeTime = false
  } = options;

  const eth = gregorianToEthiopian(date);

  let monthName;

  if (amharic) {
    monthName = short
      ? eth.monthNameAmharicShort
      : eth.monthNameAmharic;
  } else {
    monthName = short
      ? eth.monthNameShort
      : eth.monthName;
  }

  let result = `${monthName} ${eth.day}, ${eth.year}`;

  if (includeTime) {
    const dateObject = new Date(date);

    const hours = dateObject
      .getHours()
      .toString()
      .padStart(2, '0');

    const minutes = dateObject
      .getMinutes()
      .toString()
      .padStart(2, '0');

    result += ` ${hours}:${minutes}`;
  }

  return result;
}

/* ============================================================
   Input format
   ============================================================ */

export function formatEthiopianForInput(date) {
  const eth = gregorianToEthiopian(date);

  return [
    String(eth.year),
    String(eth.month + 1).padStart(2, '0'),
    String(eth.day).padStart(2, '0')
  ].join('-');
}

/* ============================================================
   Parse Ethiopian date
   ============================================================ */

export function parseEthiopianDate(ethDateString) {
  if (
    typeof ethDateString !== 'string' ||
    !/^\d{4,}-\d{2}-\d{2}$/.test(ethDateString)
  ) {
    return null;
  }

  const [year, month, day] =
    ethDateString.split('-').map(Number);

  if (
    month < 1 ||
    month > 13
  ) {
    return null;
  }

  const ethMonth = month - 1;

  const maxDay = getEthiopianDaysInMonth(
    year,
    ethMonth
  );

  if (
    day < 1 ||
    day > maxDay
  ) {
    return null;
  }

  return ethiopianToGregorian(
    year,
    ethMonth,
    day
  );
}

/* ============================================================
   Current Ethiopian date
   ============================================================ */

export function getCurrentEthiopianDate() {
  return gregorianToEthiopian(new Date());
}

/* ============================================================
   Relative formatting
   ============================================================ */

export function formatEthiopianRelative(date) {
  const eth = gregorianToEthiopian(date);

  return `${eth.monthName} ${eth.day}, ${eth.year}`;
}