import * as functions from "firebase-functions";
import { getFirestore } from "firebase-admin/firestore";
import Stripe from "stripe";
import { getFunctions } from "firebase-admin/functions";

async function logError(message: string, data: any, source: string) {
    try {
        const logErrorCallable = getFunctions().task("logError");
        await logErrorCallable.enqueue({ message, data, source });
    } catch (e) {
        console.error("Failed to log error:", e);
        console.error("Original error:", message, data);
    }
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
    apiVersion: "2023-10-16",
});

const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET as string;

export const stripeWebhook = functions.https.onRequest(async (req, res) => {
    const sig = req.headers["stripe-signature"];

    let event: Stripe.Event;

    try {
        event = stripe.webhooks.constructEvent(req.rawBody, sig as string, endpointSecret);
    } catch (err: any) {
        await logError("Webhook signature verification failed.", { error: err.message }, "http.stripeWebhook");
        res.status(400).send(`Webhook Error: ${err.message}`);
        return;
    }

    const db = getFirestore();

    // Handle the event
    switch (event.type) {
        case 'customer.subscription.created':
        case 'customer.subscription.updated':
        case 'customer.subscription.deleted': {
            const subscription = event.data.object as Stripe.Subscription;
            const uid = subscription.metadata.uid;
            const userRef = db.collection("users").doc(uid);

            try {
                await userRef.update({
                    stripeSubscriptionId: subscription.id,
                    stripeSubscriptionStatus: subscription.status,
                });
            } catch (error) {
                await logError("Failed to update user subscription status", { error, uid }, "http.stripeWebhook");
            }
            break;
        }
        default:
            console.log(`Unhandled event type ${event.type}`);
    }

    res.json({ received: true });
});
