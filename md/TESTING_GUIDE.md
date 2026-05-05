# Testing Guide

Complete guide for running tests in the Tawveeri project.

## 🧪 Available Test Commands

### Run All Tests
```bash
npm test
```

### Run Tests in Watch Mode
```bash
npm run test:watch
```
Perfect for development - automatically reruns tests when files change.

### Run Tests with Coverage Report
```bash
npm run test:coverage
```
Generates a coverage report showing which code is tested.

### Run Database Tests Only
```bash
npm run test:db
```
Runs only the database connection and query tests.

### Run Specific Test File
```bash
npm test tests/utils.test.ts
```

### Run Tests Matching Pattern
```bash
npm test -- --testNamePattern="Price"
```
Runs only tests with "Price" in their name.

## 📁 Test File Structure

```
tests/
├── database/
│   ├── connection.test.ts    # Database connectivity tests
│   └── queries.test.ts        # Query operation tests
└── utils.test.ts              # Utility function tests
```

## 🎯 Test Categories

### 1. Unit Tests
Test individual functions and components in isolation.

**Example:** `tests/utils.test.ts`
```typescript
import { formatPrice } from '@/lib/utils';

describe('formatPrice', () => {
  it('should format price in Arabic', () => {
    expect(formatPrice(3299, 'ar')).toBe('3,299 ر.س');
  });
});
```

### 2. Database Tests
Test database connections, queries, and RLS policies.

**Example:** `tests/database/connection.test.ts`
```typescript
import { supabase } from '@/lib/database';

describe('Database Connection', () => {
  it('should connect to Supabase', async () => {
    const { error } = await supabase.from('users').select('count').limit(1);
    expect(error).toBeNull();
  });
});
```

### 3. Integration Tests
Test multiple components working together.

**Location:** `tests/integration/` (to be created)

### 4. E2E Tests
Test complete user flows.

**Location:** `tests/e2e/` (to be created with Playwright or Cypress)

## 📝 Writing Tests

### Test File Naming Convention

- **Unit tests:** `*.test.ts` or `*.spec.ts`
- **Component tests:** `*.test.tsx` or `*.spec.tsx`
- **Database tests:** `tests/database/*.test.ts`

### Basic Test Structure

```typescript
describe('Feature or Component Name', () => {
  // Setup
  beforeAll(() => {
    // Runs once before all tests
  });

  beforeEach(() => {
    // Runs before each test
  });

  // Test cases
  it('should do something specific', () => {
    // Arrange
    const input = 'test';

    // Act
    const result = someFunction(input);

    // Assert
    expect(result).toBe('expected');
  });

  // Cleanup
  afterEach(() => {
    // Runs after each test
  });

  afterAll(() => {
    // Runs once after all tests
  });
});
```

### Testing React Components

```typescript
import { render, screen } from '@testing-library/react';
import { Button } from '@/components/ui/button';

describe('Button Component', () => {
  it('should render button text', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByText('Click me')).toBeInTheDocument();
  });

  it('should call onClick handler', () => {
    const handleClick = jest.fn();
    render(<Button onClick={handleClick}>Click</Button>);

    const button = screen.getByText('Click');
    button.click();

    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});
```

### Testing Async Functions

```typescript
it('should fetch data from API', async () => {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .limit(1);

  expect(error).toBeNull();
  expect(data).toBeDefined();
  expect(Array.isArray(data)).toBe(true);
});
```

## 🎨 Best Practices

### 1. Test Naming
Use descriptive test names that explain what is being tested:

```typescript
// ✅ Good
it('should return 0 when original price is 0', () => {});

// ❌ Bad
it('test price', () => {});
```

### 2. Arrange-Act-Assert Pattern
```typescript
it('should calculate savings correctly', () => {
  // Arrange - Setup test data
  const original = 3799;
  const current = 3299;

  // Act - Execute the function
  const savings = calculateSavings(original, current);

  // Assert - Verify the result
  expect(savings).toBe(500);
});
```

### 3. Test One Thing at a Time
```typescript
// ✅ Good - Tests one specific behavior
it('should format price in Arabic', () => {
  expect(formatPrice(3299, 'ar')).toBe('3,299 ر.س');
});

it('should format price in English', () => {
  expect(formatPrice(3299, 'en')).toBe('SAR 3,299');
});

// ❌ Bad - Tests multiple things
it('should format prices', () => {
  expect(formatPrice(3299, 'ar')).toBe('3,299 ر.س');
  expect(formatPrice(3299, 'en')).toBe('SAR 3,299');
  expect(formatPrice(0, 'ar')).toBe('0 ر.س');
});
```

### 4. Use Test Data Factories
```typescript
// Create reusable test data
const createMockProduct = (overrides = {}) => ({
  id: 'test-id',
  name_ar: 'منتج تجريبي',
  name_en: 'Test Product',
  price: 1000,
  ...overrides,
});

it('should display product name', () => {
  const product = createMockProduct({ name_en: 'iPhone' });
  // Test with product
});
```

### 5. Mock External Dependencies
```typescript
// Mock Supabase client
jest.mock('@/lib/database', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn(() => Promise.resolve({ data: [], error: null })),
    })),
  },
}));
```

## 📊 Coverage Goals

The project aims for:
- **70%** statement coverage
- **70%** branch coverage
- **70%** function coverage
- **70%** line coverage

Check coverage with:
```bash
npm run test:coverage
```

Coverage report is generated in `coverage/` directory.

## 🔧 Configuration

### Jest Configuration (`jest.config.js`)
- Uses Next.js Jest configuration
- Supports TypeScript
- Includes path aliases (`@/`)
- Uses jsdom environment for React testing

### Test Setup (`jest.setup.js`)
- Loads environment variables
- Configures testing-library/jest-dom

## 🐛 Debugging Tests

### Run Single Test File
```bash
npm test tests/utils.test.ts
```

### Run Tests with Verbose Output
```bash
npm test -- --verbose
```

### Debug in VS Code
Add to `.vscode/launch.json`:
```json
{
  "type": "node",
  "request": "launch",
  "name": "Jest Debug",
  "program": "${workspaceFolder}/node_modules/.bin/jest",
  "args": ["--runInBand"],
  "console": "integratedTerminal",
  "internalConsoleOptions": "neverOpen"
}
```

### Use `console.log` in Tests
```typescript
it('should debug values', () => {
  const result = someFunction();
  console.log('Result:', result);
  expect(result).toBe(expected);
});
```

## 📦 Testing Database

### Prerequisites
- `.env.local` must be configured
- Database must be set up (`npm run db:setup`)
- Supabase connection must be working

### Run Database Tests
```bash
npm run test:db
```

### Database Test Example
```typescript
import { supabase } from '@/lib/database';

describe('Product Queries', () => {
  it('should fetch products by category', async () => {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('category', 'smartphone');

    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
  });
});
```

## 🚀 CI/CD Integration

Add to GitHub Actions (`.github/workflows/test.yml`):
```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm test
      - run: npm run test:coverage
```

## 📚 Additional Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
- [Jest Best Practices](https://github.com/goldbergyoni/javascript-testing-best-practices)

## 🎯 Common Test Scenarios

### Testing Forms
```typescript
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

it('should submit form data', async () => {
  const handleSubmit = jest.fn();
  render(<MyForm onSubmit={handleSubmit} />);

  await userEvent.type(screen.getByLabelText('Email'), 'test@example.com');
  await userEvent.click(screen.getByRole('button', { name: 'Submit' }));

  expect(handleSubmit).toHaveBeenCalledWith({ email: 'test@example.com' });
});
```

### Testing API Calls
```typescript
it('should handle API errors', async () => {
  // Mock failed API call
  jest.spyOn(global, 'fetch').mockRejectedValueOnce(new Error('API Error'));

  const { error } = await fetchProducts();

  expect(error).toBeDefined();
  expect(error.message).toBe('API Error');
});
```

### Testing Localization
```typescript
import { useLocale } from '@/app/providers/locale-provider';

it('should display text in Arabic', () => {
  const { result } = renderHook(() => useLocale(), {
    wrapper: LocaleProvider,
  });

  expect(result.current.t('app.name')).toBe('توفيري');
});
```

## ✅ Testing Checklist

Before committing code:

- [ ] All tests pass (`npm test`)
- [ ] Coverage meets thresholds (`npm run test:coverage`)
- [ ] New features have tests
- [ ] Bug fixes have regression tests
- [ ] Database tests pass (`npm run test:db`)
- [ ] No console errors or warnings

## 🆘 Troubleshooting

### Tests Won't Run
```bash
# Clear Jest cache
npx jest --clearCache

# Reinstall dependencies
rm -rf node_modules
npm install
```

### Database Tests Fail
1. Check `.env.local` has correct credentials
2. Verify database is set up: `npm run db:setup`
3. Check Supabase project is active
4. Test connection manually with `psql`

### Coverage Too Low
1. Identify untested files: `npm run test:coverage`
2. Add tests for critical paths
3. Focus on business logic first
4. Mock external dependencies

---

**Happy Testing! 🧪**
