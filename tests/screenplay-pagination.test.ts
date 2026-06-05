import { describe, expect, it } from 'vitest'
import { buildScreenplayPaginationPlan, normalizePaginationMeasurement } from '../src/editors/screenplay/plugins'

describe('screenplay pagination plan', () => {
  it('inserts a spacer before a block that would enter the page bottom margin', () => {
    const plan = buildScreenplayPaginationPlan(
      [
        { pos: 0, top: 180, bottom: 680 },
        { pos: 10, top: 700, bottom: 1080 },
        { pos: 20, top: 1108, bottom: 1188 }
      ],
      {
        pageHeight: 1160,
        firstPageTop: 180,
        pageTop: 82,
        pageBottom: 1100
      }
    )

    expect(plan).toEqual([
      { pos: 20, height: 1242 - 1108 }
    ])
  })

  it('keeps following blocks in the same page after a spacer when they fit', () => {
    const plan = buildScreenplayPaginationPlan(
      [
        { pos: 0, top: 180, bottom: 1040 },
        { pos: 10, top: 1060, bottom: 1120 },
        { pos: 20, top: 1140, bottom: 1200 }
      ],
      {
        pageHeight: 1160,
        firstPageTop: 180,
        pageTop: 82,
        pageBottom: 1100
      }
    )

    expect(plan).toHaveLength(1)
    expect(plan[0].pos).toBe(10)
  })

  it('normalizes zoomed DOM measurements back to page coordinates', () => {
    expect(normalizePaginationMeasurement(900, 0.9)).toBe(1000)
    expect(normalizePaginationMeasurement(125, 1.25)).toBe(100)
    expect(normalizePaginationMeasurement(240, 0)).toBe(240)
  })
})
