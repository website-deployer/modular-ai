import { createClient } from '@supabase/supabase-js';

const getSupabase = () => {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_KEY;
    if (!url || !key) throw new Error('Missing Supabase credentials');
    return createClient(url, key);
};

export default async function handler(req: any, res: any) {
    try {
        const supabase = getSupabase();

        // GET: Fetch all notes
        if (req.method === 'GET') {
            const { data, error } = await supabase
                .from('notes')
                .select('*')
                .order('last_accessed', { ascending: false });
            
            if (error) throw error;
            return res.status(200).json(data || []);
        }

        // POST: Create or Update a note
        if (req.method === 'POST') {
            const note = req.body;
            
            // Map camelCase (frontend) to snake_case (Supabase) if necessary, 
            // but we'll try to keep them compatible or use a mapping.
            // Based on our SQL: is_bookmarked, source_data
            const dbNote = {
                ...note,
                is_bookmarked: note.isBookmarked,
                last_accessed: note.lastAccessed,
                source_data: note.sourceData,
                updated_at: new Date().toISOString()
            };
            
            // Remove the camelCase versions to keep DB clean
            delete dbNote.isBookmarked;
            delete dbNote.lastAccessed;
            delete dbNote.sourceData;

            const { data, error } = await supabase
                .from('notes')
                .upsert(dbNote)
                .select()
                .single();
            
            if (error) throw error;
            return res.status(200).json(data);
        }

        // DELETE: Remove a note
        if (req.method === 'DELETE') {
            const { id } = req.body;
            const { error } = await supabase
                .from('notes')
                .delete()
                .eq('id', id);
            
            if (error) throw error;
            return res.status(200).json({ success: true });
        }

        return res.status(405).json({ error: 'Method not allowed' });
    } catch (error: any) {
        console.error('Notes API Error:', error);
        return res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
}
