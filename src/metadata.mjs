// Tag formats may provide a year, a year/month, or a complete ISO-style date.
export function parseReleaseDate(date, fallbackYear = 0) {
  const m = /^(\d{4})(?:[-/.](\d{1,2}))?(?:[-/.](\d{1,2}))?/.exec(String(date || '').trim());
  const year = m ? +m[1] : (+fallbackYear || 0);
  const month = m?.[2] ? +m[2] : 0;
  const day = m?.[3] ? +m[3] : 0;
  if (month > 12 || (day && (!month || day > new Date(Date.UTC(year, month, 0)).getUTCDate())))
    return { year: +fallbackYear || year, month: 0, day: 0 };
  return { year, month, day };
}

