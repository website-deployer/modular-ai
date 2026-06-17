import { getUsage, getUserId } from './_usage';

// Returns the caller's current daily usage so the client can render the
// remaining-free-uses badge and the upgrade prompt.
export default async function handler(req: any, res: any) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    try {
        const usage = await getUsage(getUserId(req));
        return res.status(200).json(usage);
    } catch (error: any) {
        console.error('Usage API Error:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
}
