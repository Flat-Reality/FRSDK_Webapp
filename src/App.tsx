import { useEffect, useMemo, useRef, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import type EditorJS from '@editorjs/editorjs'
import { ArrowLeft, ArrowRight, CalendarDays, ChevronDown, ChevronRight, Cloud, CreditCard, FileText, Image as ImageIcon, LayoutGrid, LogOut, MoreHorizontal, PanelLeftClose, Plus, Search, Settings2, Trash2, UserRound, X } from 'lucide-react'
import { demoMode, demoPosts, excerptFromBlocks, slugify, supabase, type Profile, type Transmission } from './lib'

type View = 'home' | 'editor' | 'account' | 'billing' | 'usage'
type Filter = 'all' | Transmission['status']
const DEMO_KEY = 'frsdk-anychannel-demo-v1'
const GB = 1024 * 1024 * 1024

function readDemo(): Transmission[] {
  try {
    const value = localStorage.getItem(DEMO_KEY)
    return value ? JSON.parse(value) as Transmission[] : demoPosts
  } catch { return demoPosts }
}

function formatDate(value: string | null) {
  if (!value) return 'No publication date'
  return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function localDateValue(value?: string | null) {
  const date = value ? new Date(value) : new Date()
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
}

function statusLabel(post: Transmission) {
  return post.status[0].toUpperCase() + post.status.slice(1)
}

async function uploadMedia(file: File, ownerId: string, bytesUsed: number): Promise<{ url: string; path: string }> {
  if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) throw new Error('Use JPG, PNG, WebP or GIF.')
  if (file.size > 6 * 1024 * 1024) throw new Error('Images must be 6 MB or smaller.')
  if (bytesUsed + file.size > GB) throw new Error('The 1 GB media allowance would be exceeded.')
  if (!supabase) {
    if (file.size > 1 * 1024 * 1024) throw new Error('Demo images must be under 1 MB to fit in local browser storage.')
    return { url: await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(file) }), path: '' }
  }
  const extension = file.type === 'image/jpeg' ? 'jpg' : file.type.split('/')[1]
  const path = `${ownerId}/${crypto.randomUUID()}.${extension}`
  const uploaded = await supabase.storage.from('anychannel-media').upload(path, file, { cacheControl: '31536000', upsert: false, contentType: file.type })
  if (uploaded.error) throw uploaded.error
  const record = await supabase.from('anychannel_media').insert({ owner_id: ownerId, object_path: path, size_bytes: file.size, mime_type: file.type })
  if (record.error) {
    await supabase.storage.from('anychannel-media').remove([path])
    throw record.error
  }
  return { url: supabase.storage.from('anychannel-media').getPublicUrl(path).data.publicUrl, path }
}

function StoryEditor({ content, onReady, onUpload }: { content: Transmission['content']; onReady: (editor: EditorJS | null) => void; onUpload: (file: File) => Promise<{ url: string }> }) {
  const holder = useRef<HTMLDivElement>(null)
  const editor = useRef<EditorJS | null>(null)
  useEffect(() => {
    let cancelled = false
    async function create() {
      const [{ default: Editor }, { default: Header }, { default: List }, { default: Image }, { default: Embed }, { default: Delimiter }, { default: Quote }, { default: Raw }] = await Promise.all([
        import('@editorjs/editorjs'), import('@editorjs/header'), import('@editorjs/list'), import('@editorjs/image'), import('@editorjs/embed'), import('@editorjs/delimiter'), import('@editorjs/quote'), import('@editorjs/raw')
      ])
      if (cancelled || !holder.current) return
      const instance = new Editor({
        holder: holder.current,
        placeholder: 'Tell the story…',
        data: content,
        inlineToolbar: ['bold', 'italic', 'link'],
        tools: {
          header: { class: Header, config: { levels: [2, 3, 4], defaultLevel: 2 } },
          list: { class: List, inlineToolbar: true },
          image: { class: Image, config: { types: 'image/jpeg,image/png,image/webp,image/gif', uploader: { uploadByFile: async (file: File) => ({ success: 1, file: await onUpload(file) }) } } },
          embed: { class: Embed, config: { services: { youtube: true, vimeo: true, twitch: true } } },
          delimiter: Delimiter,
          quote: { class: Quote, inlineToolbar: true },
          raw: Raw
        }
      })
      editor.current = instance
      await instance.isReady
      if (!cancelled) onReady(instance)
    }
    create().catch(error => console.error('Editor failed to start', error))
    return () => { cancelled = true; onReady(null); if (editor.current) { editor.current.isReady.then(() => editor.current?.destroy()).catch(() => {}); editor.current = null } }
  // This component is remounted with a post-specific key when switching transmissions.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return <div ref={holder} className="story-editor" />
}

function AuthScreen({ onAuthenticated }: { onAuthenticated: (session: Session) => void }) {
  const [mode, setMode] = useState<'login' | 'signup'>('signup')
  const [name, setName] = useState('')
  const [organization, setOrganization] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!supabase) return
    setBusy(true); setMessage('')
    try {
      if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { name: name.trim(), organization: organization.trim() }, emailRedirectTo: location.origin } })
        if (error) throw error
        if (data.session) onAuthenticated(data.session)
        else setMessage('Check your email to confirm the account, then sign in.')
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        if (data.session) onAuthenticated(data.session)
      }
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Authentication failed.') }
    finally { setBusy(false) }
  }
  return <div className="auth-shell"><div className="auth-brand"><div className="brand-icon">F<span>R</span></div><span>FLAT REALITY<br /><b>SDK</b></span></div><form className="auth-card" onSubmit={submit}><div className="eyebrow">ANYCHANNEL CLOUD</div><h1>{mode === 'signup' ? 'Create your workspace.' : 'Welcome back.'}</h1><p>One place to compose your transmissions.</p>{mode === 'signup' && <><label>Your name<input required maxLength={80} value={name} onChange={e => setName(e.target.value)} placeholder="Alex Morgan" /></label><label>Organization<input required maxLength={120} value={organization} onChange={e => setOrganization(e.target.value)} placeholder="Your studio" /></label></>}<label>Email<input required type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@studio.com" /></label><label>Password<input required minLength={8} type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 8 characters" /></label><button className="primary full" disabled={busy}>{busy ? 'Please wait…' : mode === 'signup' ? 'Create account' : 'Sign in'} <ArrowRight size={17} /></button>{message && <div className="notice">{message}</div>}<button className="text-button" type="button" onClick={() => { setMode(mode === 'signup' ? 'login' : 'signup'); setMessage('') }}>{mode === 'signup' ? 'Already have an account? Sign in' : 'New to AnyChannel? Create an account'}</button></form><span className="auth-foot">FLAT REALITY PARTNERS · BUILD YOUR WORLD</span></div>
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [authLoaded, setAuthLoaded] = useState(demoMode)
  const [profile, setProfile] = useState<Profile | null>(demoMode ? { owner_id: 'demo', name: 'Demo user', organization: 'Your studio', plan: 'cloud_trial', created_at: new Date().toISOString() } : null)
  const [posts, setPosts] = useState<Transmission[]>(demoMode ? readDemo() : [])
  const [view, setView] = useState<View>('home')
  const [editing, setEditing] = useState<Transmission | null>(null)
  const [filter, setFilter] = useState<Filter>('all')
  const [search, setSearch] = useState('')
  const [collapsed, setCollapsed] = useState(() => window.innerWidth <= 800)
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [mediaBytes, setMediaBytes] = useState(0)
  const ownerId = session?.user.id || 'demo'

  useEffect(() => {
    if (!supabase) return
    const client = supabase
    client.auth.getSession().then(({ data }) => { setSession(data.session); setAuthLoaded(true) })
    const { data: listener } = client.auth.onAuthStateChange((_event, next) => setSession(next))
    return () => listener.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!supabase || !session) return
    const client = supabase
    let cancelled = false
    async function load() {
      const id = session!.user.id
      const [{ data: current, error: profileError }, { data: items, error: postError }, { data: media }] = await Promise.all([
        client.from('anychannel_profiles').select('*').eq('owner_id', id).maybeSingle(),
        client.from('anychannel_transmissions').select('*').order('updated_at', { ascending: false }),
        client.from('anychannel_media').select('size_bytes')
      ])
      if (profileError || postError) { if (!cancelled) setNotice((profileError || postError)?.message || 'Unable to load workspace.'); return }
      let nextProfile = current as Profile | null
      if (!nextProfile) {
        const metadata = session!.user.user_metadata || {}
        const result = await client.from('anychannel_profiles').insert({ owner_id: id, name: String(metadata.name || '').slice(0, 80), organization: String(metadata.organization || '').slice(0, 120) }).select().single()
        if (result.error) { if (!cancelled) setNotice(result.error.message); return }
        nextProfile = result.data as Profile
      }
      if (!cancelled) { setProfile(nextProfile); setPosts((items || []) as Transmission[]); setMediaBytes((media || []).reduce((sum, item) => sum + (item.size_bytes || 0), 0)) }
    }
    load()
    return () => { cancelled = true }
  }, [session])

  useEffect(() => { if (demoMode) { try { localStorage.setItem(DEMO_KEY, JSON.stringify(posts)) } catch { setNotice('Browser storage is full. Remove large demo images or connect Supabase.') } } }, [posts])

  const visible = useMemo(() => posts.filter(post => {
    const matches = filter === 'all' || post.status === filter
    return matches && `${post.title} ${post.excerpt}`.toLowerCase().includes(search.toLowerCase())
  }), [posts, filter, search])

  function navigate(next: View) { setView(next); if (window.innerWidth <= 800) setCollapsed(true); setNotice('') }
  function edit(post: Transmission | null) { setEditing(post); navigate('editor') }

  async function saveTransmission(input: Partial<Transmission>, requestedStatus: 'draft' | 'published') {
    if (profile?.plan === 'expired') throw new Error('Your cloud workspace is read-only.')
    const date = input.published_at ? new Date(input.published_at) : new Date()
    const status = requestedStatus === 'draft' ? 'draft' : date.getTime() > Date.now() ? 'scheduled' : 'published'
    const timestamp = new Date().toISOString()
    const record = { title: input.title?.trim() || 'Untitled transmission', slug: slugify(input.slug || input.title || ''), excerpt: input.excerpt || 'Draft in progress.', content: input.content || { blocks: [] }, cover_url: input.cover_url || null, cover_path: input.cover_path || null, status, published_at: requestedStatus === 'draft' ? null : date.toISOString(), updated_at: timestamp }
    if (!record.slug) record.slug = `untitled-${Date.now()}`
    if (demoMode) {
      const item = { ...record, id: editing?.id || crypto.randomUUID(), owner_id: 'demo', created_at: editing?.created_at || timestamp } as Transmission
      setPosts(current => [item, ...current.filter(post => post.id !== item.id)])
      navigate('home'); return
    }
    if (!supabase || !session) throw new Error('Sign in to save this transmission.')
    const result = editing
      ? await supabase.from('anychannel_transmissions').update(record).eq('id', editing.id).select().single()
      : await supabase.from('anychannel_transmissions').insert({ ...record, owner_id: session.user.id }).select().single()
    if (result.error) throw result.error
    setPosts(current => [result.data as Transmission, ...current.filter(post => post.id !== result.data.id)])
    navigate('home')
  }

  async function removePost(post: Transmission) {
    if (!confirm(`Delete “${post.title}”? This cannot be undone.`)) return
    if (demoMode) setPosts(current => current.filter(item => item.id !== post.id))
    else if (supabase) {
      const result = await supabase.from('anychannel_transmissions').delete().eq('id', post.id)
      if (result.error) { setNotice(result.error.message); return }
      setPosts(current => current.filter(item => item.id !== post.id))
    }
  }

  async function handleUpload(file: File) {
    const result = await uploadMedia(file, ownerId, mediaBytes)
    setMediaBytes(current => current + file.size)
    return result
  }

  if (!authLoaded) return <div className="loading-screen">Opening Flat Reality SDK…</div>
  if (!demoMode && !session) return <AuthScreen onAuthenticated={setSession} />

  return <div className={`app-shell ${collapsed ? 'sidebar-collapsed' : ''}`}>
    {!collapsed && <button className="rail-scrim" aria-label="Collapse sidebar" onClick={() => setCollapsed(true)} />}
    <aside className="sidebar">
      <div className="sidebar-top"><button className="brand" aria-label={collapsed ? 'Expand Flat Reality SDK sidebar' : 'Flat Reality SDK home'} onClick={() => collapsed ? setCollapsed(false) : navigate('home')}><span className="brand-icon" aria-hidden="true">F<span>R</span></span>{!collapsed && <span className="brand-wordmark">Flat Reality <strong>SDK</strong></span>}</button>{!collapsed && <button className="sidebar-toggle" aria-label="Collapse sidebar" title="Collapse sidebar" onClick={() => setCollapsed(true)}><PanelLeftClose size={20} strokeWidth={1.8} /></button>}</div>
      <div className="workspace-switch"><span className="workspace-avatar">{(profile?.organization || 'Y')[0].toUpperCase()}</span>{!collapsed && <><span className="workspace-name"><strong>{profile?.organization || 'Your workspace'}</strong><small>Workspace</small></span><ChevronDown size={15} /></>}</div>
      <button className="sidebar-create" onClick={() => { edit(null); if (window.innerWidth <= 800) setCollapsed(true) }} title="Create transmission"><Plus size={19} /><span>Create transmission</span></button>
      <nav className="nav-group"><span className="nav-label">WORKSPACE</span><button className={view === 'home' || view === 'editor' ? 'active' : ''} onClick={() => navigate('home')} title="AnyChannel"><LayoutGrid size={18} /><span>AnyChannel</span></button></nav>
      <nav className="nav-group settings-nav"><span className="nav-label">SETTINGS</span><button className={view === 'account' ? 'active' : ''} onClick={() => navigate('account')} title="Account"><UserRound size={18} /><span>Account</span></button><button className={view === 'billing' ? 'active' : ''} onClick={() => navigate('billing')} title="Plan & billing"><CreditCard size={18} /><span>Plan & billing</span></button><button className={view === 'usage' ? 'active' : ''} onClick={() => navigate('usage')} title="Cloud usage"><Settings2 size={18} /><span>Cloud usage</span></button></nav>
      <div className="sidebar-bottom"><div className="sidebar-help"><span className="help-star">✦</span>{!collapsed && <><strong>Crafted for creators.</strong><small>Flat Reality SDK · Preview</small></>}</div><button className="profile-link" onClick={() => navigate('account')}><span className="user-avatar">{(profile?.name || 'D')[0].toUpperCase()}</span>{!collapsed && <><span><strong>{profile?.name || 'Demo user'}</strong><small>{demoMode ? 'Demo workspace' : session?.user.email}</small></span><MoreHorizontal size={17} /></>}</button></div>
    </aside>
    <main className="main"><header className="topbar"><div className="breadcrumbs"><span>Workspace</span><ChevronRight size={14} /><strong>{view === 'editor' ? 'New transmission' : view === 'home' ? 'AnyChannel' : view === 'account' ? 'Account' : view === 'billing' ? 'Plan & billing' : 'Cloud usage'}</strong></div><div className="topbar-right"><span className="preview-pill">{demoMode ? 'DEMO MODE' : 'CLOUD ALPHA'}</span><span className="top-avatar">{(profile?.name || 'D')[0].toUpperCase()}</span></div></header>
      {notice && <div className="global-notice"><span>{notice}</span><button aria-label="Dismiss" onClick={() => setNotice('')}><X size={17} /></button></div>}
      <div className="content">
        {view === 'home' && <><div className="page-intro"><div><div className="eyebrow purple">ANYCHANNEL / PUBLISHING</div><h1>Transmissions<span className="soft-dot">.</span></h1><p>Every great story starts with a transmission.</p></div><button className="primary" onClick={() => edit(null)}><Plus size={18} /> New transmission</button></div>
          <div className="section-row"><div><h2>AnyChannel</h2><p>Compose, schedule and manage your transmissions.</p></div><div className="usage-mini"><div className="usage-mini-head"><Cloud size={16} /><span>Cloud plan</span><b>{Math.min(Math.round(mediaBytes / GB * 100), 100)}%</b></div><div className="progress"><span style={{ width: `${Math.max(mediaBytes > 0 ? 1 : 0, Math.min(mediaBytes / GB * 100, 100))}%` }} /></div><small>{(mediaBytes / 1024 / 1024).toFixed(1)} MB of 1 GB media used this month</small></div></div>
          <div className="toolbar"><div className="tabs">{(['all', 'published', 'draft', 'scheduled'] as Filter[]).map(tab => <button key={tab} className={filter === tab ? 'selected' : ''} onClick={() => setFilter(tab)}>{tab[0].toUpperCase() + tab.slice(1)} <span>{tab === 'all' ? posts.length : posts.filter(post => post.status === tab).length}</span></button>)}</div><label className="search-box"><Search size={18} /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search transmissions" /></label></div>
          {visible.length ? <div className="post-grid">{visible.map(post => <article className="post-card" key={post.id}><button className="post-cover" onClick={() => edit(post)}>{post.cover_url ? <img src={post.cover_url} alt="" /> : <span className="cover-placeholder"><span>FR<span className="purple-dot">.</span></span><small>TRANSMISSION</small></span>}</button><div className="post-body"><div className="post-meta"><span className={`status ${post.status}`}>{statusLabel(post)}</span><span>{formatDate(post.published_at || post.created_at)}</span></div><button className="post-title" onClick={() => edit(post)}>{post.title}</button><p>{post.excerpt}</p><div className="post-actions"><button onClick={() => edit(post)}>Edit transmission <ArrowRight size={15} /></button><button className="icon-button danger" title="Delete transmission" aria-label={`Delete ${post.title}`} onClick={() => removePost(post)}><Trash2 size={16} /></button></div></div></article>)}</div> : <div className="empty"><FileText size={30} /><h3>No transmissions here yet.</h3><p>Create a new transmission to start telling your story.</p><button className="primary" onClick={() => edit(null)}><Plus size={18} /> New transmission</button></div>}</>}
        {view === 'editor' && <TransmissionForm key={editing?.id || 'new'} post={editing} busy={busy} onBack={() => navigate('home')} onSave={async (record, status) => { setBusy(true); try { await saveTransmission(record, status) } catch (error) { setNotice(error instanceof Error ? error.message : 'Save failed.'); window.scrollTo({ top: 0, behavior: 'smooth' }) } finally { setBusy(false) } }} onUpload={handleUpload} />}
        {view === 'account' && <div className="settings-page"><div className="eyebrow purple">SETTINGS / ACCOUNT</div><h1>Account</h1><p>Keep the essentials of your workspace up to date.</p><div className="settings-card"><div><h2>Profile information</h2><p>Your organization is the home for future AnyChannel services.</p></div><AccountForm profile={profile} email={session?.user.email || ''} demo={demoMode} onSaved={setProfile} /></div>{!demoMode && <button className="outline signout" onClick={async () => { await supabase?.auth.signOut(); setSession(null); setProfile(null); setPosts([]) }}><LogOut size={17} /> Sign out</button>}</div>}
        {view === 'billing' && <div className="settings-page"><div className="eyebrow purple">SETTINGS / BILLING</div><h1>Plan & billing</h1><p>A transparent home for your Cloud plan.</p><div className="settings-card billing-card"><div className="plan-icon"><Cloud size={23} /></div><div><span className="plan-caption">CURRENT PLAN</span><h2>{demoMode ? 'Preview workspace' : 'Cloud alpha'}</h2><p>Billing is not connected in this first MVP. No payment details are collected and no charges will be made.</p></div><span className="coming-soon">Coming later</span></div><div className="settings-card price-card"><div><h2>Planned Cloud pricing</h2><p>One account. Your future distribution channels won't be billed individually.</p></div><strong>€9 <small>/ month</small></strong></div></div>}
        {view === 'usage' && <div className="settings-page"><div className="eyebrow purple">SETTINGS / USAGE</div><h1>Cloud usage</h1><p>See how much media your workspace stores.</p><div className="settings-card usage-card"><div className="usage-stat"><span>Media storage</span><strong>{(mediaBytes / 1024 / 1024).toFixed(1)} MB <small>/ 1 GB</small></strong></div><div className="progress"><span style={{ width: `${Math.min(mediaBytes / GB * 100, 100)}%` }} /></div><p>For the free alpha, images are limited to 6 MB each. This meter counts uploads recorded by the dashboard; the provider’s project limits still apply.</p></div><div className="settings-card"><div><h2>Delivery channels</h2><p>Channel creation and game/widget connections are reserved for the next phase. No Flat Reality internal categories are applied to customer workspaces.</p></div><span className="coming-soon">Next phase</span></div></div>}
      </div>
    </main>
  </div>
}

function AccountForm({ profile, email, demo, onSaved }: { profile: Profile | null; email: string; demo: boolean; onSaved: (value: Profile) => void }) {
  const [name, setName] = useState(profile?.name || '')
  const [organization, setOrganization] = useState(profile?.organization || '')
  const [message, setMessage] = useState('')
  useEffect(() => { setName(profile?.name || ''); setOrganization(profile?.organization || '') }, [profile])
  async function save(event: React.FormEvent) {
    event.preventDefault()
    if (!profile) return
    const changed = { ...profile, name: name.trim(), organization: organization.trim() }
    if (!demo && supabase) {
      const result = await supabase.from('anychannel_profiles').update({ name: changed.name, organization: changed.organization }).eq('owner_id', profile.owner_id)
      if (result.error) { setMessage(result.error.message); return }
    }
    onSaved(changed); setMessage('Account updated.')
  }
  return <form className="account-form" onSubmit={save}><label>Your name<input required maxLength={80} value={name} onChange={e => setName(e.target.value)} /></label><label>Organization<input required maxLength={120} value={organization} onChange={e => setOrganization(e.target.value)} /></label><label>Email<input value={email || 'demo@flatreality.eu'} disabled /></label><button className="primary">Save changes</button>{message && <p className="success-message">{message}</p>}</form>
}

function TransmissionForm({ post, onBack, onSave, onUpload, busy }: { post: Transmission | null; onBack: () => void; onSave: (value: Partial<Transmission>, status: 'draft' | 'published') => Promise<void>; onUpload: (file: File) => Promise<{ url: string; path: string }>; busy: boolean }) {
  const [title, setTitle] = useState(post?.title || '')
  const [slug, setSlug] = useState(post?.slug || '')
  const [manualSlug, setManualSlug] = useState(!!post)
  const [publication, setPublication] = useState(localDateValue(post?.published_at))
  const [cover, setCover] = useState({ url: post?.cover_url || '', path: post?.cover_path || '' })
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const editor = useRef<EditorJS | null>(null)
  const scheduled = publication && new Date(publication) > new Date()
  async function submit(status: 'draft' | 'published') {
    setError('')
    if (status === 'published' && !title.trim()) { setError('Add a title before publishing.'); return }
    try {
      if (!editor.current) throw new Error('Story editor is still loading.')
      const content = await editor.current.save() as Transmission['content']
      const excerpt = excerptFromBlocks(content.blocks)
      if (status === 'published' && !excerpt) throw new Error('Write some story text before publishing.')
      const date = publication ? new Date(publication) : new Date()
      if (Number.isNaN(date.getTime())) throw new Error('Choose a valid transmission date.')
      await onSave({ title: title || 'Untitled transmission', slug: slug || slugify(title), content, excerpt, cover_url: cover.url, cover_path: cover.path, published_at: date.toISOString() }, status)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save transmission.') }
  }
  async function selectCover(file?: File) {
    if (!file) return
    setUploading(true); setError('')
    try { setCover(await onUpload(file)) } catch (cause) { setError(cause instanceof Error ? cause.message : 'Image upload failed.') }
    finally { setUploading(false) }
  }
  return <div className="editor-page"><button className="back-link" onClick={onBack}><ArrowLeft size={17} /> All transmissions</button><div className="editor-heading"><div><div className="eyebrow purple">FR CHANNEL</div><h1>{post ? 'Edit transmission' : 'Create a transmission'}</h1><p>Website publishing</p></div><div className="editor-actions"><button className="outline" disabled={busy || uploading} onClick={() => submit('draft')}>Save draft</button><button className="primary" disabled={busy || uploading} onClick={() => submit('published')}>{busy ? 'Saving…' : scheduled ? 'Schedule transmission' : 'Publish transmission'} <ArrowRight size={17} /></button></div></div>
    {error && <div className="form-error">{error}</div>}
    <div className="editor-layout"><div className="editor-main"><section className="editor-panel"><div className="panel-title"><span className="panel-number">01</span><div><h2>Transmission details</h2><p>Give your story a clear beginning.</p></div></div><div className="fields"><label>Title<input autoFocus maxLength={160} value={title} onChange={e => { setTitle(e.target.value); if (!manualSlug) setSlug(slugify(e.target.value)) }} placeholder="Give this transmission a title" /></label><label>Transmission date<div className="input-icon"><CalendarDays size={18} /><input type="datetime-local" value={publication} onChange={e => setPublication(e.target.value)} /></div><small>{scheduled ? 'Will be published automatically at the selected time.' : 'Publishes immediately.'}</small></label><label>Article URL<div className="slug-input"><span>flatreality.eu/channel/</span><input value={slug} onChange={e => { setManualSlug(true); setSlug(slugify(e.target.value)) }} placeholder="article-url" /><span>/</span></div><small>Website routing will be connected when delivery channels are implemented.</small></label></div></section>
      <section className="editor-panel"><div className="panel-title"><span className="panel-number">02</span><div><h2>Cover</h2><p>Lead with a strong image.</p></div></div><p className="panel-description">JPG, PNG, WebP or GIF. Uploaded automatically to your cloud media library.</p><label className="cover-upload">{cover.url ? <img src={cover.url} alt="Cover preview" /> : <div className="cover-empty"><ImageIcon size={28} /><span>Cover image</span></div>}<span className="cover-choose">{uploading ? 'Uploading…' : 'Choose cover'}</span><input type="file" accept="image/jpeg,image/png,image/webp,image/gif" disabled={uploading} onChange={e => selectCover(e.target.files?.[0])} /></label></section>
      <section className="editor-panel story-panel"><div className="panel-title"><span className="panel-number">03</span><div><h2>Story</h2><p>Compose the transmission.</p></div></div><p className="panel-description">Use the plus button for headings, lists, images, video embeds, separators, quotes and custom HTML.</p><StoryEditor content={post?.content || { blocks: [{ type: 'paragraph', data: { text: '' } }] }} onReady={value => { editor.current = value }} onUpload={async file => ({ url: (await onUpload(file)).url })} /><p className="editor-safety">Custom HTML is stored for compatibility with FR Channel; public rendering must sanitize it before use.</p></section></div>
      <aside className="editor-aside"><div className="tip-card"><div className="tip-icon">✦</div><strong>One story, many places.</strong><p>Compose now. Delivery channels and game/widget connections are coming in the next phase.</p></div><div className="side-summary"><h3>Transmission status</h3><div><span>Currently</span><strong>{post ? statusLabel(post) : 'Unsaved'}</strong></div><div><span>Publishing</span><strong>{scheduled ? 'Scheduled' : 'Immediately'}</strong></div></div></aside></div>
    <div className="mobile-editor-actions"><button className="outline" disabled={busy} onClick={() => submit('draft')}>Save draft</button><button className="primary" disabled={busy} onClick={() => submit('published')}>{scheduled ? 'Schedule' : 'Publish'}</button></div>
  </div>
}
