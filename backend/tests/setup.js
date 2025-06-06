// Test setup file
require('dotenv').config({ path: '.env.test' });

// Mock OpenAI for tests
jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: jest.fn().mockResolvedValue({
          choices: [{
            message: {
              content: JSON.stringify({
                document_type: 'mortgage',
                borrower_name: 'Test Borrower',
                property_address: '123 Test St',
                loan_amount: 100000
              })
            }
          }]
        })
      }
    }
  }));
});

// Setup test database
beforeAll(async () => {
  // Database setup for tests would go here
});

afterAll(async () => {
  // Cleanup after tests
});