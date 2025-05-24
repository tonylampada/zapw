import { Router } from 'express';

const router = Router();

// Test webhook endpoint for development
router.post('/webhook-test', (req, res) => {
  console.log('===== Webhook Received =====');
  console.log('Headers:', req.headers);
  console.log('Body:', JSON.stringify(req.body, null, 2));
  console.log('===========================');
  
  res.json({ received: true, timestamp: Date.now() });
});

export default router;