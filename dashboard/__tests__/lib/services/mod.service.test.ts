import { describe, it, expect, vi, beforeEach } from 'vitest';

// ALL state must be hoisted since vi.mock factory runs before module initialization
const {
  mockEmitSessionExpired,
  mockAxiosIsAxiosError,
  handlers,
  createCallArgs,
} = vi.hoisted(() => {
  // Store interceptor handlers when registered during module init
  const handlers = {
    success: null as ((res: any) => any) | null,
    error: null as ((err: any) => any) | null,
  };

  // Store the args passed to axios.create() at module init
  const createCallArgs = { value: null as any };

  return {
    mockEmitSessionExpired: vi.fn(),
    mockAxiosIsAxiosError: vi.fn(),
    handlers,
    createCallArgs,
  };
});

vi.mock('@/lib/auth-events', () => ({
  emitSessionExpired: mockEmitSessionExpired,
}));

vi.mock('axios', () => {
  const interceptors = {
    response: {
      use: (onFulfilled: any, onRejected: any) => {
        handlers.success = onFulfilled;
        handlers.error = onRejected;
      },
    },
  };
  const instance = {
    get: vi.fn(),
    post: vi.fn(),
    interceptors,
  };

  return {
    default: {
      create: (config: any) => {
        createCallArgs.value = config;
        return instance;
      },
      isAxiosError: mockAxiosIsAxiosError,
    },
  };
});

// Import triggers module initialization (axios.create + interceptors.response.use)
import '@/lib/services/mod.service';

describe('mod.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates axios instance with correct base URL and credentials', () => {
    // createCallArgs was captured at module init time, not affected by clearAllMocks
    expect(createCallArgs.value).toBeDefined();
    expect(createCallArgs.value.baseURL).toContain('/api');
    expect(createCallArgs.value.withCredentials).toBe(true);
  });

  it('registers a response interceptor (error handler captured)', () => {
    expect(handlers.error).not.toBeNull();
    expect(typeof handlers.error).toBe('function');
  });

  it('401 response triggers sessionExpired event', async () => {
    const axiosError = { response: { status: 401 } };
    mockAxiosIsAxiosError.mockReturnValue(true);

    await expect(handlers.error!(axiosError)).rejects.toBe(axiosError);
    expect(mockEmitSessionExpired).toHaveBeenCalled();
  });

  it('non-401 errors do not emit sessionExpired', async () => {
    const axiosError = { response: { status: 500 } };
    mockAxiosIsAxiosError.mockReturnValue(true);

    await expect(handlers.error!(axiosError)).rejects.toBe(axiosError);
    expect(mockEmitSessionExpired).not.toHaveBeenCalled();
  });

  it('non-axios errors do not emit sessionExpired', async () => {
    const genericError = new Error('Network Error');
    mockAxiosIsAxiosError.mockReturnValue(false);

    await expect(handlers.error!(genericError)).rejects.toBe(genericError);
    expect(mockEmitSessionExpired).not.toHaveBeenCalled();
  });

  it('success handler passes responses through unchanged', () => {
    const response = { status: 200, data: { ok: true } };
    const result = handlers.success!(response);
    expect(result).toBe(response);
  });
});
