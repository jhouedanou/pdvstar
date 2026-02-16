const { Client } = require('pg')

async function main() {
    const client = new Client({
        connectionString: 'postgres://postgres:mGsX-h!-dG_3KFi@db.zbowizpdsekljkudfjgx.supabase.co:5432/postgres',
        ssl: { rejectUnauthorized: false }
    })

    try {
        await client.connect()
        console.log('✅ Connecté à Supabase PostgreSQL')

        // 1. Add promo_text column to events
        await client.query(`
            ALTER TABLE public.events ADD COLUMN IF NOT EXISTS promo_text TEXT DEFAULT NULL;
        `)
        console.log('✅ Colonne promo_text ajoutée à events')

        // 2. Create ads table
        await client.query(`
            CREATE TABLE IF NOT EXISTS public.ads (
                id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
                title TEXT NOT NULL,
                description TEXT,
                image TEXT,
                link TEXT DEFAULT '#',
                sponsor TEXT NOT NULL,
                sponsor_logo TEXT,
                cta_text TEXT DEFAULT 'En savoir plus',
                is_active BOOLEAN DEFAULT true,
                start_date TIMESTAMPTZ,
                end_date TIMESTAMPTZ,
                click_count INTEGER DEFAULT 0,
                view_count INTEGER DEFAULT 0,
                position INTEGER DEFAULT 0,
                created_at TIMESTAMPTZ DEFAULT now()
            );
        `)
        console.log('✅ Table ads créée')

        // 3. Enable RLS and allow anon access for ads
        await client.query(`
            ALTER TABLE public.ads ENABLE ROW LEVEL SECURITY;
        `)
        // Drop policy if exists, then create
        await client.query(`
            DO $$ BEGIN
                DROP POLICY IF EXISTS "Allow anon read ads" ON public.ads;
                CREATE POLICY "Allow anon read ads" ON public.ads FOR SELECT USING (true);
            EXCEPTION WHEN OTHERS THEN NULL;
            END $$;
        `)
        await client.query(`
            DO $$ BEGIN
                DROP POLICY IF EXISTS "Allow anon insert ads" ON public.ads;
                CREATE POLICY "Allow anon insert ads" ON public.ads FOR INSERT WITH CHECK (true);
            EXCEPTION WHEN OTHERS THEN NULL;
            END $$;
        `)
        await client.query(`
            DO $$ BEGIN
                DROP POLICY IF EXISTS "Allow anon update ads" ON public.ads;
                CREATE POLICY "Allow anon update ads" ON public.ads FOR UPDATE USING (true);
            EXCEPTION WHEN OTHERS THEN NULL;
            END $$;
        `)
        await client.query(`
            DO $$ BEGIN
                DROP POLICY IF EXISTS "Allow anon delete ads" ON public.ads;
                CREATE POLICY "Allow anon delete ads" ON public.ads FOR DELETE USING (true);
            EXCEPTION WHEN OTHERS THEN NULL;
            END $$;
        `)
        console.log('✅ RLS + policies configurées pour ads')

        // 4. Seed some default ads
        const existingAds = await client.query(`SELECT COUNT(*) FROM public.ads`)
        if (parseInt(existingAds.rows[0].count) === 0) {
            await client.query(`
                INSERT INTO public.ads (title, description, image, link, sponsor, cta_text, is_active, position) VALUES
                ('Orange Money', 'Paiements instantanés pour vos events !', 'https://images.unsplash.com/photo-1563013544-824ae1b704d3?q=80&w=800', 'https://www.orangemoney.ci', 'Orange CI', 'En savoir plus', true, 1),
                ('Heineken', 'La bière officielle des nuits Abidjan', 'https://images.unsplash.com/photo-1608270586620-248524c67de9?q=80&w=800', 'https://www.heineken.com', 'Heineken', 'Découvrir', true, 2),
                ('Uber Eats', 'Livraison 24/7 après la fête', 'https://images.unsplash.com/photo-1585238342024-78d387f4a707?q=80&w=800', 'https://www.ubereats.com', 'Uber Eats', 'Commander', true, 3);
            `)
            console.log('✅ 3 publicités par défaut insérées')
        } else {
            console.log('ℹ️ Publicités déjà existantes, pas de seed')
        }

        // Verify
        const adsCols = await client.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_schema = 'public' AND table_name = 'ads'
            ORDER BY ordinal_position;
        `)
        console.log('\n📋 Colonnes de la table ads:')
        adsCols.rows.forEach(r => console.log(`   - ${r.column_name} (${r.data_type})`))

    } catch (err) {
        console.error('❌ Erreur:', err.message)
    } finally {
        await client.end()
    }
}

main()
