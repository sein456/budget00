import { describe, expect, it } from 'vitest'
import { createCategorySlices } from './categoryChart'
import { reorderCategories } from './reorderCategories'

describe('category distribution', () => {
  it('keeps all exact amounts and does not inflate tiny slices', () => {
    const slices = createCategorySlices([{category:'Market',amountMinor:99999,sharePercent:100},{category:'Ulaşım',amountMinor:1,sharePercent:0}])
    expect(slices.map(item=>item.amountMinor)).toEqual([99999,1])
  })
  it('groups only the long tail and reconciles with original total', () => {
    const rows = [900,500,400,300,200,100,1].map((amountMinor,index)=>({category:`C${index}`,amountMinor,sharePercent:0}))
    const slices = createCategorySlices(rows)
    expect(slices).toHaveLength(5)
    expect(slices[4].members).toEqual(['C4','C5','C6'])
    expect(slices[4].amountMinor).toBe(301)
    expect(slices.reduce((sum,row)=>sum+row.amountMinor,0)).toBe(rows.reduce((sum,row)=>sum+row.amountMinor,0))
  })
  it('does not invent data for an empty month',()=>expect(createCategorySlices([])).toEqual([]))
})

describe('category reorder',()=>{
  it('moves a newly appended item to the front without mutating input',()=>{
    const original=['Market','Ulaşım','Yeni']
    expect(reorderCategories(original,'Yeni','Market')).toEqual(['Yeni','Market','Ulaşım'])
    expect(original).toEqual(['Market','Ulaşım','Yeni'])
  })
  it('moves forward and ignores absent targets',()=>{
    expect(reorderCategories(['A','B','C'],'A','C')).toEqual(['B','C','A'])
    expect(reorderCategories(['A','B'],'A','X')).toEqual(['A','B'])
  })
})
