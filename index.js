const express = require('express');
const cors = require('cors');
const stripe = require('stripe')('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');

const app = express();

// Middleware setup (ORDER MATTERS)
app.use(express.json());
app.use(cors({
  origin: [
    'https://checkmatewellness.com',
    'https://app.gohighlevel.com'
  ],
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type']
}));

// Request logger
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

// Create PaymentIntent
app.post('/create-payment-intent', express.json(), async (req, res) => {
  console.log('POST request received to /create-payment-intent');
  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: 7500,
      currency: 'usd',
      automatic_payment_methods: { enabled: true },
      metadata: { product: 'Custom Herb Package' }
    });
    console.log('Payment intent created:', paymentIntent.id);
    res.json({ clientSecret: paymentIntent.client_secret });
  } catch (err) {
    console.error('Error creating payment intent:', err);
    res.status(500).json({ error: err.message });
  }
});

// Webhook to handle successful payments (optional but recommended)
app.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  let event;

  try {
    const signature = req.headers['stripe-signature'];
    // You would need to set STRIPE_WEBHOOK_SECRET as an environment variable
    event = stripe.webhooks.constructEvent(
      req.body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.log(`⚠️ Webhook signature verification failed.`, err.message);
    return res.sendStatus(400);
  }

  // Handle the event
  switch (event.type) {
    case 'payment_intent.succeeded':
      const paymentIntent = event.data.object;
      console.log(`PaymentIntent ${paymentIntent.id} succeeded`);
      // Here you can fulfill the order
      break;
    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  res.sendStatus(200);
});

// Health check endpoint
app.get('/', (req, res) => {
  res.send('Checkmate Wellness Stripe server is running on port 4242');
});

// Diagnostic endpoint
app.get('/routes', (req, res) => {
  const routes = [];
  app._router.stack.forEach(middleware => {
    if (middleware.route) {
      routes.push({
        path: middleware.route.path,
        methods: Object.keys(middleware.route.methods)
      });
    }
  });
  res.json(routes);
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Global error handler caught:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Force port 4242 explicitly
const PORT = 4242;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});