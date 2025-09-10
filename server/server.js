import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { nanoid } from 'nanoid';

const app = express();
app.use(cors());
app.use(express.json());

const sns = new SNSClient({ region: process.env.AWS_REGION });

app.post('/api/orders', async (req, res) => {
  try {
    const { customerEmail } = req.body;
    const orderId = `ORD-${nanoid(8)}`;

    const message = {
      orderId,
      customerEmail: customerEmail || process.env.SES_TO_EMAIL, // fallback for demo
      status: 'placed',
      placedAt: new Date().toISOString()
    };

    await sns.send(new PublishCommand({
      TopicArn: process.env.SNS_TOPIC_ARN,
      Subject: 'OrderPlaced',
      Message: JSON.stringify(message)
    }));

    res.json({ ok: true, orderId, publishedTo: process.env.SNS_TOPIC_ARN });
  } catch (err) {
    console.error('Publish error:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

const port = process.env.PORT || 5001;
app.listen(port, () => console.log(`API listening on http://localhost:${port}`));
