import { describe, it, expect, vi, beforeEach } from 'vitest';

// ALL state must be hoisted since vi.mock factory runs before module initialization
const {
  mockEmitSessionExpired,
  mockAxiosIsAxiosError,
  handlers,
} = vi.hoisted(() => {
  const handlers = {
    error: null as ((err: any) => any) | null,
  };

  return {
    mockEmitSessionExpired: vi.fn(),
    mockAxiosIsAxiosError: vi.fn(),
    handlers,
  };
});

vi.mock('@/lib/auth-events', () => ({
  emitSessionExpired: mockEmitSessionExpired,
}));

vi.mock('axios', () => {
  const interceptors = {
    response: {
      use: (_onFulfilled: any, onRejected: any) => {
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
      create: () => instance,
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
});
