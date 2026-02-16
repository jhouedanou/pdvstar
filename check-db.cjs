const { Client } = require('pg')

async function main() {
    const client = new Client({
        connectionString: 'postgres://postgres:mGsX-h!-dG_3KFi@db.zbowizpdsekljkudfjgx.supabase.co:5432/postgres',
        ssl: { rejectUnauthorized: false }
    })

    try {
        await client.connect()
        
        // Check events table columns and types
        const cols = await client.query(`
            SELECT column_name, data_type, udt_name
            FROM information_schema.columns 
            WHERE table_schema = 'public' AND table_name = 'events'
            ORDER BY ordinal_position;
        `)
        console.log('📋 Events table columns:')
        cols.rows.forEach(row => {
            console.log(`   ${row.column_name}: ${row.data_type} (${row.udt_name})`)
        })

        // Check recent event data
        const events = await client.query(`
            SELECT id, title, features, background_music, music_title, is_premium, price
            FROM public.events
            ORDER BY created_at DESC
            LIMIT 3;
        `)
        console.log('\n📦 Recent events:')
        events.rows.forEach(row => {
            console.log(`   ${row.title}:`)
            console.log(`     features: ${JSON.stringify(row.features)}`)
            console.log(`     background_music: ${row.background_music}`)
            console.log(`     music_title: ${row.music_title}`)
            console.log(`     is_premium: ${row.is_premium}, price: ${row.price}`)
        })

        // Check ads table existence
        const tables = await client.query(`
            SELECT table_name FROM information_schema.tables 
            WHERE table_schema = 'public'
            ORDER BY table_name;
        `)
        console.log('\n📋 Public tables:')
        tables.rows.forEach(row => console.log(`   - ${row.table_name}`))

    } catch (err) {
        console.error('❌ Error:', err.message)
    } finally {
        await client.end()
    }
}
main()
