// ─── Schedule of Supports: weekly vs once-off lines ──────────────────────────
// Pure helpers (no Deno or network imports) so they can be unit-tested with
// plain Node: see website-deploy/tests/agreement-api-onceOff.test.mjs.
//
// Two kinds of NDIS support item are not charged every week:
//
//   - Public holiday items (name matches /public\s*holiday/i). The quantity is
//     the TOTAL hours across the whole plan, not hours per week.
//   - Establishment fees (name matches /establishment\s*fee/i, or an item code
//     in segment 049 of categories 01 or 04, e.g. 04_049_0104_1_1). Charged once.
//
// Both are counted once (rate x quantity) and never multiplied by plan weeks.
// 15_049_0128_1_3 (Multidisciplinary Team) shares the 049 segment but is a
// weekly support, which is why the code test is limited to categories 01 and 04.
//
// Same rule as titus-crm-v5 src/lib/supportLineBasis.js. An explicit `basis`
// ('weekly' | 'once_off') on an incoming item wins; with no basis the item is
// classified by name and code as above.

export const LINE_BASIS = Object.freeze({
  WEEKLY: 'weekly',
  ONCE_OFF: 'once_off',
} as const)

export type LineBasis = 'weekly' | 'once_off'

const PUBLIC_HOLIDAY_RE = /public\s*holiday/i
const ESTABLISHMENT_FEE_RE = /establishment\s*fee/i
const ESTABLISHMENT_CODE_RE = /^0[14]_049_/
// Codes this function has always treated as once-off fees.
const LEGACY_ONCE_OFF_CODES = ['04_049_0104_1_1', '04_050_0104_1_1', '04_051_0104_1_1']

function nameOf(item: any): string {
  return String(item?.name ?? item?.supportItemName ?? '')
}

function codeOf(item: any): string {
  return String(item?.code ?? item?.supportItemNumber ?? '').trim()
}

/** Which basis an incoming support item is counted on. */
export function lineBasis(item: any): LineBasis {
  if (item?.basis === LINE_BASIS.ONCE_OFF) return LINE_BASIS.ONCE_OFF
  if (item?.basis === LINE_BASIS.WEEKLY) return LINE_BASIS.WEEKLY
  const name = nameOf(item)
  const code = codeOf(item)
  if (PUBLIC_HOLIDAY_RE.test(name)) return LINE_BASIS.ONCE_OFF
  if (ESTABLISHMENT_FEE_RE.test(name)) return LINE_BASIS.ONCE_OFF
  if (ESTABLISHMENT_CODE_RE.test(code)) return LINE_BASIS.ONCE_OFF
  if (LEGACY_ONCE_OFF_CODES.includes(code)) return LINE_BASIS.ONCE_OFF
  return LINE_BASIS.WEEKLY
}

export function isOnceOffItem(item: any): boolean {
  return lineBasis(item) === LINE_BASIS.ONCE_OFF
}

/** rate x quantity, parsed exactly as this function always has (missing/zero quantity counts as 1). */
export function lineAmount(item: any): number {
  return (parseFloat(item?.rate) || 0) * (parseFloat(item?.quantity) || 1)
}

export function roundCents(n: number): number {
  return Math.round(n * 100) / 100
}

/**
 * Agreement totals.
 *
 *   weekly        recurring lines only, rounded to cents (weeklyRecurringAmount)
 *   weeklyRaw     the same sum unrounded (the PDF's "Total Weekly" row)
 *   onceOffTotal  once-off lines counted once, rounded to cents
 *   total         weekly x duration + onceOffTotal, rounded to cents (totalAgreementValue)
 *
 * With no once-off lines, weekly and total are exactly what this function
 * returned before once-off lines were split out.
 */
export function computeAgreementTotals(supportItems: any[], duration: number) {
  const items = Array.isArray(supportItems) ? supportItems : []
  const weeklyItems = items.filter((i) => !isOnceOffItem(i))
  const onceOffItems = items.filter((i) => isOnceOffItem(i))
  const weeklyRaw = weeklyItems.reduce((s: number, i: any) => s + lineAmount(i), 0)
  const onceOffRaw = onceOffItems.reduce((s: number, i: any) => s + lineAmount(i), 0)
  const weekly = roundCents(weeklyRaw)
  const onceOffTotal = roundCents(onceOffRaw)
  const weeks = Number(duration) || 0
  const total = roundCents(weekly * weeks + onceOffTotal)
  return {
    weeklyItems,
    onceOffItems,
    hasOnceOff: onceOffItems.length > 0,
    weeklyRaw,
    weekly,
    onceOffTotal,
    duration: weeks,
    total,
  }
}
