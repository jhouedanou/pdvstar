import { supabase } from './supabase'

export async function fetchTags() {
    const { data, error } = await supabase
        .from('tags')
        .select('*')
        .order('sort_order', { ascending: true })
    if (error) {
        console.error(' fetchTags:', error.message)
        return []
    }
    return data
}

export async function createTag({ slug, label, emoji = null, color = null, sortOrder = 0 }) {
    const { data, error } = await supabase
        .from('tags')
        .insert({ slug, label, emoji, color, sort_order: sortOrder })
        .select()
        .single()
    if (error) {
        console.error(' createTag:', error.message)
        return null
    }
    return data
}

export async function deleteTag(id) {
    const { error } = await supabase.from('tags').delete().eq('id', id)
    if (error) {
        console.error(' deleteTag:', error.message)
        return false
    }
    return true
}

export async function updateTag(id, updates) {
    const mapped = {}
    if (updates.slug !== undefined) mapped.slug = updates.slug
    if (updates.label !== undefined) mapped.label = updates.label
    if (updates.emoji !== undefined) mapped.emoji = updates.emoji
    if (updates.color !== undefined) mapped.color = updates.color
    if (updates.sortOrder !== undefined) mapped.sort_order = updates.sortOrder
    const { data, error } = await supabase.from('tags').update(mapped).eq('id', id).select().single()
    if (error) {
        console.error(' updateTag:', error.message)
        return null
    }
    return data
}
