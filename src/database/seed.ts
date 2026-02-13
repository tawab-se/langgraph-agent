import { getWeaviateClient, closeWeaviateClient } from './weaviate.client.js';
import { createSchema } from './schema.js';
import { COLLECTION_NAME } from '../config/weaviate.config.js';
import { WeaviateDocument } from '../agents/types.js';

const sampleData: WeaviateDocument[] = [
  {
    fileId: 'file-001',
    question: 'What is the company remote work policy?',
    answer: 'Acme Corp allows employees to work remotely up to 3 days per week. Employees must be available during core hours (10 AM - 4 PM) and attend mandatory in-person meetings on Tuesdays and Thursdays.',
    pageNumber: ['5', '6'],
  },
  {
    fileId: 'file-001',
    question: 'What are the vacation and PTO policies?',
    answer: 'Employees receive 20 days of paid time off (PTO) per year, plus 10 company holidays. PTO requests must be submitted at least 2 weeks in advance through the HR portal. Unused PTO can be carried over up to 5 days.',
    pageNumber: ['12', '13'],
  },
  {
    fileId: 'file-001',
    question: 'What is the expense reimbursement process?',
    answer: 'Submit expense reports within 30 days of purchase through ExpenseTracker. Include receipts for all expenses over $25. Manager approval required for expenses over $500. Reimbursement processed within 10 business days.',
    pageNumber: ['18'],
  },

  {
    fileId: 'file-002',
    question: 'What are the main features of ProductX?',
    answer: 'ProductX is our flagship SaaS platform featuring: real-time collaboration, AI-powered analytics, customizable dashboards, role-based access control, and integration with 50+ third-party tools including Slack, Salesforce, and Jira.',
    pageNumber: ['3', '4', '5'],
  },
  {
    fileId: 'file-002',
    question: 'What are the ProductX pricing tiers?',
    answer: 'ProductX offers three pricing tiers: Starter ($29/user/month) with basic features, Professional ($79/user/month) with advanced analytics and integrations, and Enterprise (custom pricing) with dedicated support, SSO, and custom SLAs.',
    pageNumber: ['22', '23'],
  },
  {
    fileId: 'file-002',
    question: 'What is the ProductX system requirements?',
    answer: 'ProductX requires: Chrome 90+, Firefox 88+, or Safari 14+. Minimum 4GB RAM recommended. Stable internet connection (10 Mbps+). Mobile apps available for iOS 14+ and Android 10+.',
    pageNumber: ['8'],
  },

  {
    fileId: 'file-003',
    question: 'How to configure the API authentication?',
    answer: 'API authentication uses OAuth 2.0 with JWT tokens. Generate API keys from Settings > Developer > API Keys. Include the key in the Authorization header as "Bearer <token>". Tokens expire after 24 hours and must be refreshed using the refresh_token endpoint.',
    pageNumber: ['15', '16', '17'],
  },
  {
    fileId: 'file-003',
    question: 'What are the API rate limits?',
    answer: 'API rate limits: Starter tier - 100 requests/minute, Professional - 1000 requests/minute, Enterprise - 10000 requests/minute. Rate limit headers (X-RateLimit-Remaining, X-RateLimit-Reset) included in all responses. Exceeding limits returns HTTP 429.',
    pageNumber: ['20'],
  },
  {
    fileId: 'file-003',
    question: 'How to handle webhook events?',
    answer: 'Configure webhooks in Settings > Integrations > Webhooks. Supported events: user.created, order.completed, payment.processed. Webhook payloads are signed with HMAC-SHA256. Verify signature using your webhook secret. Retry policy: 3 attempts with exponential backoff.',
    pageNumber: ['25', '26'],
  },

  {
    fileId: 'file-004',
    question: 'What were the Q4 2024 sales figures?',
    answer: 'Q4 2024 sales by region: North America $2.5M, Europe $1.8M, Asia Pacific $1.2M, Latin America $0.5M. Total Q4 revenue: $6M, representing 25% year-over-year growth. Top performing product: ProductX Enterprise tier.',
    pageNumber: ['3', '4'],
  },
  {
    fileId: 'file-004',
    question: 'What is the monthly revenue breakdown?',
    answer: 'Monthly revenue 2024: January $1.2M, February $1.1M, March $1.4M, April $1.3M, May $1.5M, June $1.6M, July $1.4M, August $1.5M, September $1.7M, October $1.8M, November $2.0M, December $2.2M. Annual total: $18.7M.',
    pageNumber: ['8', '9', '10'],
  },
];

export async function seedDatabase(): Promise<void> {
  console.log('🌱 Starting database seeding...\n');

  try {
    await createSchema();

    const client = await getWeaviateClient();
    const collection = client.collections.get(COLLECTION_NAME);

    const tenantName = 'default_tenant';
    await collection.tenants.create([{ name: tenantName }]);
    console.log(`✅ Created tenant: ${tenantName}`);

    const tenantCollection = collection.withTenant(tenantName);

    console.log(`\n📝 Inserting ${sampleData.length} documents...\n`);
    
    for (const doc of sampleData) {
      await tenantCollection.data.insert({
        properties: {
          fileId: doc.fileId,
          question: doc.question,
          answer: doc.answer,
          pageNumber: doc.pageNumber,
        },
      });
      console.log(`   ✓ Added: "${doc.question.substring(0, 50)}..."`);
    }

    console.log(`\n✅ Successfully inserted ${sampleData.length} documents`);
    console.log('\n📊 Seed Data Summary:');
    console.log('   ┌─────────────┬─────────────────────────────────┬─────────┐');
    console.log('   │ File ID     │ Topic                           │ Entries │');
    console.log('   ├─────────────┼─────────────────────────────────┼─────────┤');
    console.log('   │ file-001    │ Company Policies                │    3    │');
    console.log('   │ file-002    │ Product Documentation           │    3    │');
    console.log('   │ file-003    │ Technical/API Documentation     │    3    │');
    console.log('   │ file-004    │ Sales Data (for charts)         │    2    │');
    console.log('   └─────────────┴─────────────────────────────────┴─────────┘');
    
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    throw error;
  } finally {
    await closeWeaviateClient();
  }
}

seedDatabase()
  .then(() => {
    console.log('\n✅ Database seeding completed!\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Database seeding failed:', error);
    process.exit(1);
  });
