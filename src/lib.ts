import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
export const supabase: SupabaseClient | null = url && key ? createClient(url, key) : null
export const demoMode = !supabase

export type Transmission = {
  id: string
  owner_id: string
  title: string
  slug: string
  excerpt: string
  content: { blocks: Array<{ type: string; data: Record<string, unknown> }> }
  cover_url: string | null
  cover_path: string | null
  status: 'draft' | 'scheduled' | 'published'
  published_at: string | null
  created_at: string
  updated_at: string
}

export type Profile = { owner_id: string; name: string; organization: string; plan: 'cloud_trial' | 'cloud' | 'expired'; created_at: string }

export const slugify = (text: string) => text.toLowerCase().normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '').slice(0, 96)

export function excerptFromBlocks(blocks: Transmission['content']['blocks']) {
  const html = blocks.map(block => {
    if (block.type === 'list') {
      const items = block.data.items as Array<string | { content?: string }> | undefined
      return (items || []).map(item => typeof item === 'string' ? item : item.content || '').join(' ')
    }
    if (block.type === 'image' || block.type === 'delimiter' || block.type === 'raw') return ''
    return String(block.data.text || block.data.caption || '')
  }).join(' ').replace(/<[^>]*>/g, ' ')
  const decoder = document.createElement('textarea')
  decoder.innerHTML = html
  return decoder.value.replace(/\s+/g, ' ').trim().slice(0, 320)
}

const now = new Date().toISOString()
export const demoPosts: Transmission[] = [
  { id: 'demo-1', owner_id: 'demo', title: 'Welcome to AnyChannel', slug: 'welcome-to-anychannel', excerpt: 'A new space for updates, stories and everything that matters across your worlds.', content: { blocks: [{ type: 'paragraph', data: { text: 'A new space for updates, stories and everything that matters across your worlds.' } }] }, cover_url: null, cover_path: null, status: 'published', published_at: now, created_at: now, updated_at: now },
  { id: 'demo-2', owner_id: 'demo', title: 'Your next transmission', slug: 'your-next-transmission', excerpt: 'Draft your story here, then decide when to publish it.', content: { blocks: [{ type: 'paragraph', data: { text: 'Draft your story here, then decide when to publish it.' } }] }, cover_url: null, cover_path: null, status: 'draft', published_at: null, created_at: now, updated_at: now }
]
