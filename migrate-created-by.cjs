const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
    'https://zbowizpdsekljkudfjgx.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpib3dpenBkc2VrbGprdWRmamd4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyMzQ2NTksImV4cCI6MjA4NjgxMDY1OX0.YaJDKg6arHwbkVCr1qZc9aDK2jrxxFv3SiRpqxGFKLY'
)

async function migrate() {
    console.log('🚀 Migration: ajout created_by aux events et ads...\n')

    // 1. Ajouter created_by à events
    try {
        const { error } = await supabase.rpc('exec_sql', {
            sql: `ALTER TABLE events ADD COLUMN IF NOT EXISTS created_by INTEGER DEFAULT NULL;`
        })
        if (error) {
            // Fallback: essayer direct
            console.log('  RPC non dispo, tentative directe...')
        }
    } catch (e) {}

    // Test: essayer d'insérer et lire created_by
    const { data: testEvent } = await supabase
        .from('events')
        .select('id, created_by')
        .limit(1)
    
    if (testEvent && testEvent.length > 0 && testEvent[0].hasOwnProperty('created_by')) {
        console.log('✅ events.created_by existe déjà')
    } else {
        console.log('⚠️  events.created_by n\'existe pas encore.')
        console.log('   → Exécutez dans le SQL Editor de Supabase:')
        console.log('   ALTER TABLE events ADD COLUMN created_by INTEGER DEFAULT NULL;')
    }

    // 2. Ajouter created_by à ads
    const { data: testAd } = await supabase
        .from('ads')
        .select('id, created_by')
        .limit(1)
    
    if (testAd && testAd.length > 0 && testAd[0].hasOwnProperty('created_by')) {
        console.log('✅ ads.created_by existe déjà')
    } else {
        console.log('⚠️  ads.created_by n\'existe pas encore.')
        console.log('   → Exécutez dans le SQL Editor de Supabase:')
        console.log('   ALTER TABLE ads ADD COLUMN created_by INTEGER DEFAULT NULL;')
    }

    console.log('\n--- SQL à exécuter dans Supabase SQL Editor ---')
    console.log(`
ALTER TABLE events ADD COLUMN IF NOT EXISTS created_by INTEGER DEFAULT NULL;
ALTER TABLE ads ADD COLUMN IF NOT EXISTS created_by INTEGER DEFAULT NULL;
    `)
    console.log('--- Fin SQL ---')
}

migrate()
