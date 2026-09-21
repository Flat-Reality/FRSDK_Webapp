import { describe, expect, it } from 'vitest'
import { slugify } from './lib'

describe('transmission slugs', () => {
  it('normalizes ASCII slugs', () => expect(slugify('Hello, World!')).toBe('hello-world'))
  it('keeps FR-style hyphenated identifiers', () => expect(slugify('RAIN HEART – Update')).toBe('rain-heart-update'))
  it('removes accents and unsafe URL characters', () => expect(slugify('Café / Season #2')).toBe('cafe-season-2'))
})
