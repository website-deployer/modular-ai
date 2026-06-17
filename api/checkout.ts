import Stripe from 'stripe';
import { getUserId, setPro } from './_usage';

// Stripe Checkout for the Pro plan.
//   POST  -> creates a Checkout Session and returns its URL.
//   GET ?session_id=...  -> confirms a completed session and marks the user Pro.
//
// This webhook-free flow is fine for the demo/test mode. For production, add a
// Stripe webhook (checkout.session.completed) so Pro is granted server-to-server.

const getStripe = () => {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) return null;
    return new Stripe(key);
};

const PRICE_CENTS = parseInt(process.env.PRO_PRICE_CENTS || '800', 10);

export default async function handler(req: any, res: any) {
    const stripe = getStripe();
    if (!stripe) {
        return res.status(503).json({ error: 'Billing is not configured (missing STRIPE_SECRET_KEY).' });
    }

    try {
        if (req.method === 'GET') {
            const sessionId = req.query?.session_id;
            if (!sessionId) return res.status(400).json({ error: 'Missing session_id' });

            const session = await stripe.checkout.sessions.retrieve(sessionId);
            const paid = session.payment_status === 'paid' || session.status === 'complete';
            if (paid) {
                const userId = (session.metadata?.userId as string) || session.client_reference_id || getUserId(req);
                await setPro(userId, typeof session.customer === 'string' ? session.customer : null);
                return res.status(200).json({ success: true });
            }
            return res.status(200).json({ success: false });
        }

        if (req.method === 'POST') {
            const userId = getUserId(req);
            const origin = req.headers?.origin || process.env.APP_URL || 'http://localhost:3000';

            const session = await stripe.checkout.sessions.create({
                mode: 'subscription',
                line_items: [{
                    price_data: {
                        currency: 'usd',
                        recurring: { interval: 'month' },
                        product_data: { name: 'Modular AI Pro', description: 'Unlimited AI notes, analysis & transcription' },
                        unit_amount: PRICE_CENTS,
                    },
                    quantity: 1,
                }],
                success_url: `${origin}/?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
                cancel_url: `${origin}/?checkout=cancel`,
                metadata: { userId },
                client_reference_id: userId,
            });

            return res.status(200).json({ url: session.url });
        }

        return res.status(405).json({ error: 'Method not allowed' });
    } catch (error: any) {
        console.error('Checkout API Error:', error);
        return res.status(500).json({ error: error?.message || 'Checkout failed' });
    }
}
