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
    const { amount, product_name } = req.body;
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Number(amount),
      currency: 'usd',
      automatic_payment_methods: { enabled: true },
      metadata: { product_name: product_name }
    });
    //changes message
    console.log('Payment intent created successfully:', paymentIntent.id);
    res.json({ clientSecret: paymentIntent.client_secret });
  } catch (err) {
    console.error('Error creating payment intent:', err);
    res.status(500).json({ error: err.message });
  }
});

// Create GHL Contact
app.post('/create-update-ghl-contact', async (req, res) => {
  console.log('POST request received to /create-update-ghl-contact');

  try {
    const { customerData, payment_intent_client_secret } = req.body;

    if (!customerData || !customerData.email) {
      return res.status(400).json({ error: 'Missing required customer data (email).' });
    }

    const searchQuery = customerData.email
      ? `email=${encodeURIComponent(customerData.email)}`
      : customerData.phone
      ? `phone=${encodeURIComponent(customerData.phone)}`
      : null;

    if (!searchQuery) {
      return res.status(400).json({ error: 'Missing email or phone to search contact' });
    }

    const token = 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJsb2NhdGlvbl9pZCI6IkZmb2tkeldEZ2oyQ085WUFudWJVIiwidmVyc2lvbiI6MSwiaWF0IjoxNzQ2MjA0NjgxOTg1LCJzdWIiOiJITFBTSGdPakxRdkJBbGxzeExlbCJ9.GMDwcdawPX0x2tE58jXbUtZftM7vKqMrAbKJGYa72X8';

    const searchResponse = await fetch(`https://rest.gohighlevel.com/v1/contacts/lookup?${searchQuery}`, {
      method: 'GET',
      headers: {
        Authorization: token,
      },
    });

    const searchData = await searchResponse.json();
    const existingContact = searchData.contacts?.[0];

    const contactPayload = {
      email: customerData.email,
      name: customerData.name,
      phone: customerData.phone,
      address1: customerData.address?.line1,
      city: customerData.address?.city,
      state: customerData.address?.state,
      postalCode: customerData.address?.postal_code,
      country: customerData.address?.country,
      customField: {
        symptoms_reported: customerData?.symptoms?.symptoms_reported,
        symptoms: customerData?.symptoms?.custom_symptom_input,
        payment_intent_client_secret: payment_intent_client_secret
      }
    };

    if (existingContact) {
      const contactId = existingContact.id;

      // ✅ Update contact
      await fetch(`https://rest.gohighlevel.com/v1/contacts/${contactId}`, {
        method: 'PUT',
        headers: {
          Authorization: token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(contactPayload),
      });

      return res.json({ success: true, message: 'Contact already exists', contactId });
    } else {
      // ✅ Create contact
      await fetch(`https://rest.gohighlevel.com/v1/contacts/`, {
        method: 'POST',
        headers: {
          Authorization: token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(contactPayload),
      });

      return res.json({ success: true, message: 'Contact created successfully' });
    }
  } catch (err) {
    console.error('Error creating GHL contact:', err);
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
      console.log('event',event.data)
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
