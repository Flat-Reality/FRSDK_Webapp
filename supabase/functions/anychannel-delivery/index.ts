import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type, if-none-match',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
  'Content-Type': 'application/json; charset=utf-8',
}

const response = (body: unknown, status = 200, extra: Record<string, string> = {}) =>
  new Response(status === 304 ? null : JSON.stringify(body), { status, headers: { ...cors, ...extra } })

const textFromContent = (content: unknown) => {
  const blocks = (content as { blocks?: Array<{ type?: string; data?: Record<string, unknown> }> })?.blocks ?? []
  const clean = (value: unknown) => String(value ?? '').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim()
  return blocks.map(({ type, data = {} }) => {
    if (type === 'list' && Array.isArray(data.items)) return data.items.map(item => `• ${clean(item)}`).join('\n')
    if (type === 'delimiter') return '—'
    return clean(data.text ?? data.caption)
  }).filter(Boolean).join('\n\n')
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })
  if (req.method !== 'GET') return response({ error: 'method_not_allowed' }, 405)

  const match = new URL(req.url).pathname.match(/\/v1\/apps\/(app_[a-f0-9]{32})\/manifest\.json$/)
  if (!match) return response({ error: 'not_found' }, 404)

  const url = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !serviceKey) return response({ error: 'service_unavailable' }, 503)
  const supabase = createClient(url, serviceKey, { auth: { persistSession: false } })

  const { data: app, error: appError } = await supabase
    .from('anychannel_apps').select('id, app_id, name, app_type, icon_url, updated_at').eq('app_id', match[1]).maybeSingle()
  if (appError) return response({ error: 'service_unavailable' }, 503)
  if (!app) return response({ error: 'app_not_found' }, 404)

  const { data: links, error: linkError } = await supabase
    .from('anychannel_transmission_apps').select('transmission_id').eq('app_id', app.id)
  if (linkError) return response({ error: 'service_unavailable' }, 503)

  const ids = (links ?? []).map(link => link.transmission_id)
  let transmissions: Array<Record<string, unknown>> = []
  if (ids.length) {
    const result = await supabase.from('anychannel_transmissions')
      .select('id, slug, title, content, cover_url, published_at, updated_at, status')
      .in('id', ids).in('status', ['published', 'scheduled']).lte('published_at', new Date().toISOString())
      .order('published_at', { ascending: false })
    if (result.error) return response({ error: 'service_unavailable' }, 503)
    transmissions = result.data ?? []
  }

  const latest = transmissions.reduce((value, item) => String(item.updated_at) > value ? String(item.updated_at) : value, String(app.updated_at))
  const revision = `${Date.parse(latest) || 0}-${transmissions.length}`
  const etag = `W/\"${app.app_id}-${revision}\"`
  if (req.headers.get('if-none-match') === etag) return response(null, 304, { ETag: etag })

  return response({
    schema_version: '1.0', revision, app_id: app.app_id, name: app.name, app_type: app.app_type,
    icon_url: app.icon_url, subscription_expires_at: null, generated_at: new Date().toISOString(),
    transmissions: transmissions.map(item => ({
      api_key: item.slug, title: item.title, story_text: textFromContent(item.content),
      cover_url: item.cover_url, published_at: item.published_at,
    })),
  }, 200, { ETag: etag })
})
