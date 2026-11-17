// Unit tests for supabase/functions/agreement-api/onceOff.ts.
// Run: npm test   (node --test; needs Node 23.6+ / 24, which strip TypeScript types by default).
// All data is made up: made-up rates, no participant details.
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  lineBasis,
  isOnceOffItem,
  computeAgreementTotals,
} from '../supabase/functions/agreement-api/onceOff.ts'

const item = (code, name, rate, quantity, extra = {}) => ({ code, name, rate: String(rate), quantity: String(quantity), ...extra })

// The calculation this function used before once-off lines were split out.
function legacyTotals(supportItems, duration) {
  const weekly = Math.round(
    supportItems.reduce((sum, i) => sum + (parseFloat(i.rate) || 0) * (parseFloat(i.quantity) || 1), 0) * 100,
  ) / 100
  const total = Math.round(weekly * duration * 100) / 100
  return { weekly, total }
}

const WEEKS = 209
// Made-up weekly lines summing to 3,936.68 (2,809.20 + 790.64 + 336.84).
const WEEKLY = [
  item('01_011_0107_1_1', 'Assistance With Self-Care Activities - Standard - Weekday Daytime', 70.23, 40),
  item('01_013_0107_1_1', 'Assistance With Self-Care Activities - Standard - Saturday', 98.83, 8),
  item('01_014_0107_1_1', 'Assistance With Self-Care Activities - Standard - Sunday', 112.28, 3),
]
// Public holiday: 3 hours across the whole plan at a made-up rate = 490.38.
const PUBLIC_HOLIDAY = item('01_012_0107_1_1', 'Assistance With Self-Care Activities - Standard - Public Holiday', 163.46, 3)
const MDT = item('15_049_0128_1_3', 'Multidisciplinary Team', 100, 2)

describe("Gus's 209-week reference (made-up rates)", () => {
  const t = computeAgreementTotals([...WEEKLY, PUBLIC_HOLIDAY], WEEKS)

  test('public holiday line is once-off, the rest weekly', () => {
    assert.equal(t.weeklyItems.length, 3)
    assert.deepEqual(t.onceOffItems, [PUBLIC_HOLIDAY])
    assert.equal(t.hasOnceOff, true)
  })
  test('weeklyRecurringAmount = $3,936.68 (recurring lines only)', () => {
    assert.equal(t.weekly, 3936.68)
  })
  test('once-off total = $490.38', () => {
    assert.equal(t.onceOffTotal, 490.38)
  })
  test('totalAgreementValue = 3,936.68 x 209 + 490.38 = $823,256.50', () => {
    assert.equal(t.total, 823256.5)
  })
  test('the old calculation multiplied the public holiday by 209 weeks', () => {
    const old = legacyTotals([...WEEKLY, PUBLIC_HOLIDAY], WEEKS)
    assert.equal(old.weekly, 4427.06)
    assert.equal(old.total, 925255.54)
  })
  test('an establishment fee is once-off too, added once', () => {
    const fee = item('04_049_0125_1_1', 'Establishment Fee For Personal Care/Participation', 490.38, 1)
    const f = computeAgreementTotals([...WEEKLY, fee], WEEKS)
    assert.equal(f.weekly, 3936.68)
    assert.equal(f.onceOffTotal, 490.38)
    assert.equal(f.total, 823256.5)
  })
  test('public holiday + establishment fee both once-off', () => {
    const fee = item('01_049_0107_1_1', 'Some fee', 100, 1)
    const f = computeAgreementTotals([...WEEKLY, PUBLIC_HOLIDAY, fee], WEEKS)
    assert.equal(f.onceOffItems.length, 2)
    assert.equal(f.onceOffTotal, 590.38)
    assert.equal(f.total, 823356.5)
  })
})

describe('classification', () => {
  test('public holiday by name, any case/spacing', () => {
    assert.equal(lineBasis({ code: '01_999_0000_1_1', name: 'Something - PUBLIC HOLIDAY' }), 'once_off')
    assert.equal(lineBasis({ name: 'publicholiday rate' }), 'once_off')
  })
  test('establishment fee by name', () => {
    assert.equal(lineBasis({ code: '99_999_9999_1_1', name: 'Establishment  Fee' }), 'once_off')
  })
  test('establishment fee by 01/04 _049_ code', () => {
    for (const code of ['01_049_0104_1_1', '01_049_0107_1_1', '04_049_0104_1_1', '04_049_0125_1_1', '04_049_0133_5_1', '04_049_0136_1_1']) {
      assert.equal(lineBasis({ code, name: 'x' }), 'once_off', code)
    }
  })
  test('the three codes this function always treated as once-off still are', () => {
    for (const code of ['04_049_0104_1_1', '04_050_0104_1_1', '04_051_0104_1_1']) {
      assert.equal(isOnceOffItem({ code, name: 'x' }), true, code)
    }
  })
  test('ordinary weekly lines are weekly', () => {
    for (const i of WEEKLY) assert.equal(lineBasis(i), 'weekly')
    assert.equal(lineBasis({}), 'weekly')
    assert.equal(lineBasis(null), 'weekly')
  })
  test('accepts catalogue field names (supportItemNumber / supportItemName)', () => {
    assert.equal(lineBasis({ supportItemNumber: '04_049_0125_1_1', supportItemName: 'x' }), 'once_off')
    assert.equal(lineBasis({ supportItemNumber: '01_011_0107_1_1', supportItemName: 'Public Holiday' }), 'once_off')
  })
})

describe('Multidisciplinary Team (15_049_0128_1_3) stays weekly', () => {
  test('classified weekly although its code has _049_', () => {
    assert.equal(lineBasis(MDT), 'weekly')
  })
  test('multiplied by weeks in the totals', () => {
    const t = computeAgreementTotals([...WEEKLY, MDT, PUBLIC_HOLIDAY], WEEKS)
    assert.equal(t.weekly, 4136.68)
    assert.equal(t.onceOffTotal, 490.38)
    assert.equal(t.total, 865056.5) // 4,136.68 x 209 + 490.38
  })
})

describe('explicit basis wins over name/code', () => {
  test("basis 'weekly' keeps a public holiday line weekly", () => {
    const ph = { ...PUBLIC_HOLIDAY, basis: 'weekly' }
    assert.equal(lineBasis(ph), 'weekly')
    const t = computeAgreementTotals([...WEEKLY, ph], WEEKS)
    assert.equal(t.onceOffTotal, 0)
    assert.equal(t.weekly, 4427.06)
  })
  test("basis 'once_off' makes an ordinary line once-off", () => {
    const one = item('01_011_0107_1_1', 'Assistance With Self-Care Activities', 50, 2, { basis: 'once_off' })
    assert.equal(lineBasis(one), 'once_off')
    const t = computeAgreementTotals([...WEEKLY, one], 10)
    assert.equal(t.weekly, 3936.68)
    assert.equal(t.onceOffTotal, 100)
    assert.equal(t.total, 39466.8) // 3,936.68 x 10 + 100
  })
  test("basis 'weekly' keeps Multidisciplinary Team weekly; basis 'weekly' on an establishment fee code is honoured", () => {
    assert.equal(lineBasis({ ...MDT, basis: 'weekly' }), 'weekly')
    assert.equal(lineBasis({ code: '04_049_0125_1_1', name: 'Establishment Fee', basis: 'weekly' }), 'weekly')
  })
  test('an unknown basis value falls back to name/code classification', () => {
    assert.equal(lineBasis({ ...PUBLIC_HOLIDAY, basis: 'monthly' }), 'once_off')
    assert.equal(lineBasis({ ...WEEKLY[0], basis: '' }), 'weekly')
  })
})

describe('payloads with no once-off lines are unchanged', () => {
  const cases = [
    { items: WEEKLY, weeks: WEEKS },
    { items: [...WEEKLY, MDT], weeks: 52 },
    { items: [item('01_011_0107_1_1', 'Self-Care', 67.56, 12.5), item('04_104_0125_6_1', 'Community Access', 70.23, 7.25)], weeks: 37 },
    { items: [item('01_011_0107_1_1', 'Self-Care', '', '')], weeks: 10 },
    { items: [item('01_011_0107_1_1', 'Self-Care', 65.47, 0)], weeks: 3 },
    { items: [item('01_011_0107_1_1', 'Self-Care', 65.47, 4)], weeks: 0 },
  ]
  cases.forEach(({ items, weeks }, n) => {
    test(`case ${n + 1}: weekly and total identical to the old calculation`, () => {
      const t = computeAgreementTotals(items, weeks)
      const old = legacyTotals(items, weeks)
      assert.equal(t.hasOnceOff, false)
      assert.equal(t.onceOffTotal, 0)
      assert.equal(t.weekly, old.weekly)
      assert.equal(t.total, old.total)
    })
  })

  test('randomised: 500 made-up weekly-only payloads match the old calculation exactly', () => {
    let seed = 12345
    const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648)
    for (let k = 0; k < 500; k++) {
      const n = 1 + Math.floor(rnd() * 8)
      const items = Array.from({ length: n }, (_, j) =>
        item(`01_0${10 + j}_0107_1_1`, `Weekly support ${j}`, (rnd() * 200).toFixed(2), (Math.round(rnd() * 400) / 8).toString()),
      )
      const weeks = Math.floor(rnd() * 300)
      const t = computeAgreementTotals(items, weeks)
      const old = legacyTotals(items, weeks)
      assert.equal(t.weekly, old.weekly)
      assert.equal(t.total, old.total)
    }
  })
})

describe('fractional quantities', () => {
  test('fractional weekly and once-off quantities round to cents once', () => {
    const items = [
      item('01_011_0107_1_1', 'Self-Care weekday', 70.23, 12.75), // 895.4325
      item('01_012_0107_1_1', 'Self-Care - Public Holiday', 163.46, 7.5), // 1,225.95
      item('04_049_0125_1_1', 'Establishment Fee', 0.333, 3), // 0.999
    ]
    const t = computeAgreementTotals(items, 26)
    assert.equal(t.weekly, 895.43)
    assert.ok(Math.abs(t.weeklyRaw - 895.4325) < 1e-9)
    assert.equal(t.onceOffTotal, 1226.95)
    assert.equal(t.total, 24508.13) // 895.43 x 26 + 1,226.95 = 23,281.18 + 1,226.95
  })
  test('missing or zero quantity counts as 1, as before', () => {
    const t = computeAgreementTotals([item('04_049_0125_1_1', 'Establishment Fee', 490.38, '')], 209)
    assert.equal(t.onceOffTotal, 490.38)
    assert.equal(t.total, 490.38)
  })
})

describe('edge inputs', () => {
  test('non-array support items give zeros', () => {
    const t = computeAgreementTotals(undefined, 10)
    assert.equal(t.weekly, 0)
    assert.equal(t.total, 0)
  })
  test('zero duration: total is once-off only', () => {
    const t = computeAgreementTotals([...WEEKLY, PUBLIC_HOLIDAY], 0)
    assert.equal(t.total, 490.38)
  })
})
