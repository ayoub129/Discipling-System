import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiError, databaseError } from '@/lib/api'
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const form = await request.formData()
    const file = form.get('file')
    if (!(file instanceof File) || file.size === 0 || file.size > 2*1024*1024) return NextResponse.json({ error: 'Choose an image smaller than 2 MB.' }, { status: 400 })
    const bytes = new Uint8Array(await file.arrayBuffer())
    const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
    const png = bytes.slice(0,8).join(',') === '137,80,78,71,13,10,26,10'
    const webp = new TextDecoder().decode(bytes.slice(0,4)) === 'RIFF' && new TextDecoder().decode(bytes.slice(8,12)) === 'WEBP'
    if (!jpeg && !png && !webp) return NextResponse.json({ error: 'Choose a JPEG, PNG, or WebP image.' }, { status: 400 })
    const { data: previous } = await supabase.from('profiles').select('avatar_url').eq('id', user.id).single()
    const path = `${user.id}/${crypto.randomUUID()}.${png ? 'png' : jpeg ? 'jpg' : 'webp'}`
    const upload = await supabase.storage.from('discipline-avatars').upload(path, bytes, { contentType: png ? 'image/png' : jpeg ? 'image/jpeg' : 'image/webp' })
    if (upload.error) return NextResponse.json({ error: 'Could not upload your avatar. Please retry.' }, { status: 500 })
    const { error } = await supabase.from('profiles').update({ avatar_url: `storage:${path}`, updated_at: new Date().toISOString() }).eq('id', user.id)
    if (error) { await supabase.storage.from('discipline-avatars').remove([path]); return databaseError(error) }
    if (previous?.avatar_url?.startsWith(`storage:${user.id}/`)) await supabase.storage.from('discipline-avatars').remove([previous.avatar_url.slice(8)])
    const signed = await supabase.storage.from('discipline-avatars').createSignedUrl(path, 3600)
    return NextResponse.json({ url: signed.data?.signedUrl || null })
  } catch (error) { return apiError(error) }
}
