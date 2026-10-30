import test from 'node:test'
import assert from 'node:assert/strict'
import { titleCase } from '../src/text-format.js'

test('title-cases stored labels for display', () => {
  assert.equal(titleCase('Guest services'), 'Guest Services')
  assert.equal(titleCase('Food & beverage'), 'Food & Beverage')
  assert.equal(titleCase('meeting & conference room for the team'), 'Meeting & Conference Room for the Team')
})

test('keeps acronyms, brand names, and missing values intact', () => {
  assert.equal(titleCase('HM laboratory office'), 'HM Laboratory Office')
  assert.equal(titleCase('about CeC'), 'About CeC')
  assert.equal(titleCase(undefined), '')
})
