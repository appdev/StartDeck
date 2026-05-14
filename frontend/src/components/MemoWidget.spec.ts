// @vitest-environment jsdom
import { mount, DOMWrapper, VueWrapper } from '@vue/test-utils';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import MemoWidget from './MemoWidget.vue';
import type { WidgetConfig } from '../types';
import { nextTick } from 'vue';

// Hoist mocks
const { mockPut, mockGet, mockDelete, mockGetAllFromIndex, mockFetch, mockStore } = vi.hoisted(() => {
  return {
    mockPut: vi.fn(),
    mockGet: vi.fn(),
    mockDelete: vi.fn(),
    mockGetAllFromIndex: vi.fn(),
    mockFetch: vi.fn(),
    mockStore: {
      isLogged: true,
      username: 'admin',
      isLanModeInited: true,
      effectiveIsLan: true,
      isConnected: false,
      appConfig: { deviceMode: 'desktop' },
      getHeaders: vi.fn(() => ({})),
      wsSend: vi.fn(),
      token: 'fake-token',
    },
  };
});

// Mock IDB
vi.mock('idb', () => ({
  openDB: vi.fn().mockResolvedValue({
    put: mockPut,
    get: mockGet,
    delete: mockDelete,
    getAllFromIndex: mockGetAllFromIndex,
    objectStoreNames: { contains: vi.fn().mockReturnValue(true) },
    createObjectStore: vi.fn(),
  })
}));

// Mock Sentry
vi.stubGlobal('Sentry', {
  captureException: vi.fn()
});

vi.stubGlobal('fetch', mockFetch);

// Mock Store
vi.mock('../stores/main', () => ({
  useMainStore: vi.fn(() => mockStore)
}));

describe('MemoWidget', () => {
  let wrapper: VueWrapper;
  const widgetProps: { widget: WidgetConfig } = {
    widget: {
      id: '123',
      type: 'memo',
      x: 0, y: 0, w: 1, h: 1,
      data: 'initial data',
      enable: true,
      isPublic: true
    }
  };

  beforeEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    mockStore.isLogged = true;
    mockStore.username = 'admin';
    mockStore.isLanModeInited = true;
    mockStore.effectiveIsLan = true;
    mockStore.isConnected = false;
    mockStore.token = 'fake-token';
    mockStore.appConfig = { deviceMode: 'desktop' };
    mockStore.getHeaders.mockReturnValue({});
    mockStore.wsSend.mockClear();
    mockGet.mockResolvedValue(null); // Default empty DB
    mockGetAllFromIndex.mockResolvedValue([]);
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({
        success: true,
        data: { content: "server-content", server_ts: 101, mode: "simple" },
      }),
    });

    // Default Put implementation: successfully stores and prepares Get to return it
    mockPut.mockImplementation(async (store: unknown, data: unknown) => {
      mockGet.mockResolvedValue(data);
      return 1;
    });
  });

  const createWrapper = () => {
    return mount(MemoWidget, {
      props: widgetProps,
      global: {
        // No plugins needed since we mocked the store module
      }
    });
  };

  afterEach(() => {
    wrapper?.unmount();
    vi.useRealTimers();
  });

  it('renders correctly', () => {
    wrapper = createWrapper();
    expect(wrapper.exists()).toBe(true);
    expect(wrapper.find('textarea').exists()).toBe(true); // Default simple mode
  });

  it('toggles mode', async () => {
    wrapper = createWrapper();
    // Use title selector since the button is now a div with title
    const toggleBtn = wrapper.find('[title="切换模式 (Switch Mode)"]');
    expect(toggleBtn.exists()).toBe(true);

    await toggleBtn.trigger('click');

    // Mode should be rich now
    expect(wrapper.findComponent({ name: 'MemoEditor' }).exists()).toBe(true);
    expect(wrapper.find('textarea').exists()).toBe(false);
  });

  it('handles save with feedback', async () => {
    wrapper = createWrapper();

    // Switch to rich mode first to see the button
    const toggleBtn = wrapper.find('[title="切换模式 (Switch Mode)"]');
    await toggleBtn.trigger('click');

    const saveBtn = wrapper.findAll('button').find((b: DOMWrapper<HTMLButtonElement>) => b.text().includes('保存'));

    if (!saveBtn) throw new Error('Save button not found');
    await saveBtn.trigger('click');

    // Check IDB called
    expect(mockPut).toHaveBeenCalled();

    // Wait for async operations
    await new Promise(resolve => setTimeout(resolve, 100));
    await nextTick();

    // Check Toast
    expect(wrapper.text()).toContain('已保存，刷新不丢失');
  });

  it('handles offline/error retry', async () => {
    // Reset mock to allow chaining
    mockPut.mockReset();

    mockPut.mockRejectedValueOnce(new Error('Network Error'))
      .mockRejectedValueOnce(new Error('Network Error'))
      .mockImplementation(async (store: unknown, data: unknown) => {
        mockGet.mockResolvedValue(data); // Ensure verification passes on 3rd try
        return 1;
      });

    wrapper = createWrapper();

    // Switch to rich mode first to see the button
    const toggleBtn = wrapper.find('[title="切换模式 (Switch Mode)"]');
    await toggleBtn.trigger('click');

    const saveBtn = wrapper.findAll('button').find((b: DOMWrapper<HTMLButtonElement>) => b.text().includes('保存'));

    if (!saveBtn) throw new Error('Save button not found');
    await saveBtn.trigger('click');

    // Wait for retries (exponential backoff: 500, 1000, 1500...)
    // Total wait > 1500ms
    await new Promise(resolve => setTimeout(resolve, 2000));

    expect(mockPut.mock.calls.length).toBeGreaterThanOrEqual(3);
  });

  it('keeps save working under 300ms tunnel forwarding latency', async () => {
    vi.useFakeTimers();
    mockFetch.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              ok: true,
              status: 200,
              headers: new Headers({ "content-type": "application/json" }),
              json: async () => ({
                success: true,
                data: { content: "baseline", server_ts: 101, mode: "simple" },
              }),
            });
          }, 300);
        }),
    );

    wrapper = createWrapper();
    await nextTick();

    const textarea = wrapper.find('textarea');
    await textarea.setValue('baseline');
    await textarea.trigger('blur');

    expect(mockFetch).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(300);
    await nextTick();

    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/api/memo/123');
    expect(init.method).toBe('PUT');
    vi.useRealTimers();
  });

  it('applies remote widget data updates from store sync', async () => {
    wrapper = createWrapper();
    await nextTick();

    const remoteWidget = {
      ...widgetProps.widget,
      data: { content: 'remote sync content', server_ts: 202, mode: 'simple' as const },
    };

    await wrapper.setProps({ widget: remoteWidget });
    await nextTick();

    const textarea = wrapper.find('textarea');
    expect((textarea.element as HTMLTextAreaElement).value).toBe('remote sync content');
  });

  it('does not write IndexedDB or save while logged out', async () => {
    mockStore.isLogged = false;
    wrapper = createWrapper();
    await nextTick();

    const textarea = wrapper.find('textarea');
    expect(textarea.attributes('readonly')).toBeDefined();
    expect((textarea.element as HTMLTextAreaElement).value).toBe('initial data');
    expect(textarea.attributes('placeholder')).toBe('暂无备忘');
    expect(wrapper.find('[title="切换模式 (Switch Mode)"]').exists()).toBe(false);

    await textarea.setValue('guest edit attempt');
    await textarea.trigger('blur');
    await new Promise(resolve => setTimeout(resolve, 50));

    expect(mockPut).not.toHaveBeenCalled();
    expect(mockFetch).not.toHaveBeenCalled();
    expect(mockStore.wsSend).not.toHaveBeenCalled();
  });

  it('does not expose private memo content while logged out', async () => {
    mockStore.isLogged = false;
    wrapper = mount(MemoWidget, {
      props: {
        widget: {
          ...widgetProps.widget,
          isPublic: false,
          data: 'private memo',
        },
      },
    });
    await nextTick();

    expect(wrapper.text()).toContain('登录后查看备忘');
    expect(wrapper.text()).not.toContain('private memo');
    expect(wrapper.find('textarea').exists()).toBe(false);
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
