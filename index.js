const express = require('express');
const cors = require('cors');
const stripe = require('stripe')('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');

const app = express();

// Middleware
app.use(express.json());
app.use(cors({
  origin: 'https://checkmatewellness.com', // Only allow your domain
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type']
}));

// Create PaymentIntent
app.post('/create-payment-intent', async (req, res) => {
  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: 7500, // $75.00 in cents
      currency: 'usd',
      automatic_payment_methods: { enabled: true },
      metadata: { product: 'Custom Herb Package' }
    });

    res.json({ clientSecret: paymentIntent.client_secret });
  } catch (err) {
    console.error('Error creating payment intent:', err);
    res.status(500).json({ error: err.message });
  }
});

// Webhook to handle successful payments (optional)
app.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  let event;

  try {
    const signature = req.headers['stripe-signature'];
    event = stripe.webhooks.constructEvent(
      req.body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.log(`⚠️ Webhook signature verification failed.`, err.message);
    return res.sendStatus(400);
  }

  switch (event.type) {
    case 'payment_intent.succeeded':
      const paymentIntent = event.data.object;
      console.log(`PaymentIntent ${paymentIntent.id} succeeded`);
      break;
    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  res.sendStatus(200);
});

// Start server
const PORT = process.env.PORT || 4242;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});