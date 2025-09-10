import 'dotenv/config';
import { SQSClient, ReceiveMessageCommand, DeleteMessageCommand } from '@aws-sdk/client-sqs';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';

const sqs = new SQSClient({ region: process.env.AWS_REGION });
const ses = new SESClient({ region: process.env.AWS_REGION });
const QUEUE_URL = process.env.SHIPPING_QUEUE_URL;

async function processMessage(msg) {
  const body = JSON.parse(msg.Body);
  // If message came via SNS→SQS, actual payload is in body.Message
  const payload = body?.Message ? JSON.parse(body.Message) : body;

  const { orderId, customerEmail } = payload;
  console.log('Processing shipment for', orderId);

  // simulate shipping work
  await new Promise(r => setTimeout(r, 1000));

  // send email via SES
  const to = customerEmail || process.env.SES_TO_EMAIL;
  const subject = `Your Order ${orderId} Has Shipped!`;
    const placedAt = new Date().toLocaleString(); // or use payload.placedAt if you pass it
    const trackingId = `TRK-${orderId.slice(-6).toUpperCase()}`; // simple fake tracking for demo

    const html = `
    <div style="font-family: system-ui, -apple-system, Segoe UI, Roboto, Inter, sans-serif; color:#111; max-width:600px; margin:auto;">
        <h2 style="margin:0 0 8px; color:#16a34a;">✅ Your Order Has Been Shipped!</h2>
        <p style="margin:0 0 16px;">Hi there,</p>

        <p style="margin:0 0 12px;">
        We're happy to let you know that your order <strong>#${orderId}</strong> has been processed and is now on its way to you! 🚚
        </p>

        <table style="width:100%; border-collapse:collapse; margin:16px 0; font-size:14px;">
        <tr style="background:#f3f4f6;">
            <td style="padding:10px 12px; width:36%;"><strong>Order ID</strong></td>
            <td style="padding:10px 12px;">${orderId}</td>
        </tr>
        <tr>
            <td style="padding:10px 12px;"><strong>Status</strong></td>
            <td style="padding:10px 12px;">Shipped</td>
        </tr>
        <tr style="background:#f3f4f6;">
            <td style="padding:10px 12px;"><strong>Placed At</strong></td>
            <td style="padding:10px 12px;">${placedAt}</td>
        </tr>
        <tr>
            <td style="padding:10px 12px;"><strong>Tracking</strong></td>
            <td style="padding:10px 12px;">
            <a href="#" style="color:#111827; text-decoration:none; border-bottom:1px solid #d1d5db;">${trackingId}</a>
            <span style="color:#6b7280;">(demo link)</span>
            </td>
        </tr>
        </table>

        <p style="margin:0 0 16px;">You can expect your order to arrive soon. We'll notify you again once it has been delivered.</p>

        <hr style="border:none; border-top:1px solid #e5e7eb; margin:24px 0;" />

        <p style="margin:0; font-size:13px; color:#6b7280;">
        This is a demo email sent using <strong>AWS SES</strong> as part of an SNS → SQS → SES integration.
        </p>
        <p style="margin:6px 0 0; font-size:12px; color:#9ca3af;">
        Do not reply to this message. This inbox is not monitored.
        </p>
    </div>
    `;

  await ses.send(new SendEmailCommand({
    Destination: { ToAddresses: [to] },
    Message: {
      Body: { Html: { Charset: 'UTF-8', Data: html } },
      Subject: { Charset: 'UTF-8', Data: subject }
    },
    Source: process.env.SES_FROM_EMAIL
  }));

  console.log('Email sent to', to);
}

async function poll() {
  while (true) {
    try {
      const resp = await sqs.send(new ReceiveMessageCommand({
        QueueUrl: QUEUE_URL,
        MaxNumberOfMessages: 5,
        WaitTimeSeconds: 20,     // long polling
        VisibilityTimeout: 30
      }));

      const messages = resp.Messages || [];
      for (const msg of messages) {
        try {
          await processMessage(msg);
          await sqs.send(new DeleteMessageCommand({
            QueueUrl: QUEUE_URL,
            ReceiptHandle: msg.ReceiptHandle
          }));
        } catch (e) {
          console.error('Process failed, will become visible again:', e.message);
        }
      }
    } catch (e) {
      console.error('Poll error:', e.message);
      await new Promise(r => setTimeout(r, 3000));
    }
  }
}

poll();
