import * as functions from "firebase-functions";
import { getFirestore } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v1/https";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
    apiVersion: "2023-10-16",
});

export const createStripeCheckout = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new HttpsError("unauthenticated", "You must be logged in.");
    }

    const { priceId, successUrl, cancelUrl } = data;

    if (!priceId || !successUrl || !cancelUrl) {
        throw new HttpsError("invalid-argument", "Missing required parameters.");
    }

    const db = getFirestore();
    const userRef = db.collection("users").doc(context.auth.uid);
    const userSnap = await userRef.get();
    const userData = userSnap.data();

    let stripeCustomerId = userData?.stripeCustomerId;

    if (!stripeCustomerId) {
        const customer = await stripe.customers.create({
            email: context.auth.token.email,
            metadata: { uid: context.auth.uid },
        });
        stripeCustomerId = customer.id;
        await userRef.update({ stripeCustomerId });
    }

    const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        mode: "subscription",
        customer: stripeCustomerId,
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: successUrl,
        cancel_url: cancelUrl,
        subscription_data: {
            metadata: {
                uid: context.auth.uid,
            }
        }
    });

    return { sessionId: session.id };
});
