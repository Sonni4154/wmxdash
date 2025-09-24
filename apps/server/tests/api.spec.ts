// apps/server/tests/api.spec.ts
import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';

// --- Mocks (declare BEFORE importing the app) ---

// Mock pg so /api/qbo/status doesn't need a real DB
vi.mock('pg', () => {
  class MockPool {
    async query(sql: string) {
      if (sql.includes("to_regclass('public.integrations')")) {
        return { rows: [{ has_integrations: false, has_tokens: false }] as any };
      }
      if (sql.toLowerCase().includes('select token, updated_at from qbo_tokens where id = 1')) {
        return { rows: [] as any };
      }
      return { rows: [] as any };
    }
  }
  return { Pool: MockPool as any };
});

// Mock the qbo layer entirely so we never import node-quickbooks in tests
vi.mock('../src/qbo', () => {
  return {
    getQbo: vi.fn(async () => ({ qbo: {}, realmId: 'test' })),
    fetchAllCustomers: vi.fn(async () => [{ Id: '1', DisplayName: 'Test Customer' }]),
    fetchAllItems: vi.fn(async () => [{ Id: '10', Name: 'Test Item' }]),
    fetchAllInvoices: vi.fn(async () => [{ Id: '100', TotalAmt: 123.45 }]),
    upsertCustomers: vi.fn(async (_rows: any[]) => ({ inserted: 1, updated: 0 })),
    upsertItems: vi.fn(async (_rows: any[]) => ({ upserted: 1 })),
    upsertInvoices: vi.fn(async (_rows: any[]) => ({ upserted: 1 })),
  };
});

// Mock qboClient used by qboRoutes
vi.mock('../src/qboClient', () => {
  return {
    qboQuery: vi.fn(async (entity: string) => {
      switch (entity.toLowerCase()) {
        case 'customers': return [{ Id: '1', DisplayName: 'Mock Cust' }];
        case 'items':     return [{ Id: '10', Name: 'Mock Item' }];
        default:          return [];
      }
    }),
    qboCDC: vi.fn(async (_entities: string[], _since: string) => {
      return { Customer: [{ Id: '1', DisplayName: 'Mock CDC Cust' }] };
    }),
  };
});

// Import the app AFTER mocks
import app from '../src/index';

describe('API smoke tests', () => {
  it('GET / should be alive', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.text).toMatch(/API is running/i);
  });

  it('GET /api/qbo/status returns 404 or minimal when no tokens', async () => {
    const res = await request(app).get('/api/qbo/status');
    expect([200, 404]).toContain(res.status);
    if (res.status === 404) {
      expect(res.body).toHaveProperty('hasToken', false);
    }
  });

  it('GET /api/qbo/cdc returns mocked CDC data', async () => {
    const res = await request(app).get('/api/qbo/cdc?entities=Customer&since=2025-01-01T00:00:00Z');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('Customer');
    expect(Array.isArray(res.body.Customer)).toBe(true);
  });

  it('GET /api/qbo/customers returns mocked list', async () => {
    const res = await request(app).get('/api/qbo/customers?limit=1');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

