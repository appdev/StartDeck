// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount, VueWrapper } from '@vue/test-utils';
import GridPanel from '../GridPanel.vue';
import { createTestingPinia } from '@pinia/testing';
import { useMainStore } from '../../stores/main';

// Mock dependencies
vi.mock('vue-draggable-plus', () => ({
  VueDraggable: {
    template: '<div><slot /></div>',
    props: ['modelValue', 'group', 'disabled', 'sort', 'handle', 'move', 'animation', 'forceFallback', 'ghostClass']
  }
}));

vi.mock('grid-layout-plus', () => ({
  GridLayout: {
    template: '<div><slot /></div>',
    props: ['layout', 'col-num', 'row-height', 'is-draggable', 'is-resizable', 'vertical-compact', 'use-css-transforms', 'margin']
  },
  GridItem: {
    template: '<div class="grid-item"><slot /></div>',
    props: ['x', 'y', 'w', 'h', 'i', 'drag-allow-from', 'drag-ignore-from']
  }
}));

// Mock composables
vi.mock('../composables/useWallpaperRotation', () => ({ useWallpaperRotation: () => { } }));
vi.mock('../composables/useDevice', () => ({
  useDevice: () => ({ deviceKey: { value: 'desktop' }, isMobile: { value: false } })
}));

// Mock utils
vi.mock('../utils/gridLayout', () => ({
  generateLayout: (widgets: Record<string, unknown>[]) => widgets.map((w: Record<string, unknown>) => ({ ...w, i: w.id, x: 0, y: 0, w: 1, h: 1 })),
  compactVertical: (layout: unknown[]) => layout
}));
vi.mock('@/utils/network', () => ({
  isInternalNetwork: () => false,
  getNetworkConfig: () => ({
    internalDomains: '',
    networkRules: '',
    forceNetworkMode: 'auto',
    latencyThresholdMs: 200
  }),
  computeEffectiveNetworkMode: () => ({ isLan: false, reason: 'test', measuredLatencyMs: 0 })
}));

describe('GridPanel Context Menu', () => {
  let wrapper: VueWrapper;
  let store: ReturnType<typeof useMainStore>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.startsWith('/api/ip')) {
          return new Response(
            JSON.stringify({
              success: true,
              ip: '127.0.0.1',
              clientIp: '127.0.0.1',
              clientIpSource: 'test',
              location: 'test'
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }
        if (url.startsWith('/api/ping')) {
          return new Response(JSON.stringify({ success: true, latency: 1 }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      })
    );
    document.body.innerHTML = '';

    wrapper = mount(GridPanel, {
      global: {
        plugins: [
          createTestingPinia({
            createSpy: () => vi.fn().mockResolvedValue(undefined),
            initialState: {
              auth: {
                token: 'test-token'
              },
              widgets: {
                widgets: [
                  {
                    id: 'div-card-1',
                    type: 'div-card',
                    data: { title: 'Test Div Card' },
                    x: 0, y: 0, w: 1, h: 1, i: 'div-card-1',
                    enable: true,
                    isPublic: true
                  },
                  {
                    id: 'clock-1',
                    type: 'clock',
                    x: 1, y: 0, w: 1, h: 1, i: 'clock-1',
                    enable: true,
                    isPublic: true
                  }
                ]
              },
              groups: {
                groups: []
              },
              config: {
                appConfig: {}
              }
            }
          })
        ],
        stubs: {
          ClockWidget: true,
          SimpleWeatherWidget: true,
          CalendarWidget: true,
          MemoWidget: true,
          TodoWidget: true,
          MusicWidget: true,
          CalculatorWidget: true,
          CountdownWidget: true,
          CountUpWidget: true,
          IframeWidget: true,
          BookmarkWidget: true,
          HotWidget: true,
          ClockWeatherWidget: true,
          AmapWeatherWidget: true,
          RssWidget: true,
          DockerWidget: true,
          SystemStatusWidget: true,
          CustomCssWidget: true,
          FileTransferWidget: true,
          IconShape: true,
          MiniPlayer: true,
          AppSidebar: true,
          EditModal: true,
          SettingsModal: true,
          GroupSettingsModal: true,
          LoginModal: true,
          SizeSelector: true,
          transition: false
        }
      }
    });
    store = useMainStore();
  });

  afterEach(() => {
    wrapper.unmount();
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
  });

  it('renders div-card widget correctly', () => {
    const divCard = wrapper.find('.div-card-click-target');
    expect(divCard.exists()).toBe(true);
    expect(divCard.text()).toContain('Test Div Card');
  });

  it('opens context menu on right click on div-card', async () => {
    const divCard = wrapper.find('.div-card-click-target');
    await divCard.trigger('contextmenu', { clientX: 12, clientY: 16 });
    await wrapper.vm.$nextTick();

    const menu = document.body.querySelector('[data-grid-context-menu]');
    expect(menu).not.toBeNull();

    // Check menu items
    expect(menu?.textContent).toContain('编辑卡片');
    expect(menu?.textContent).toContain('删除卡片');

    // Check SVGs are present (w-4 h-4 class)
    const svgs = menu?.querySelectorAll('svg.w-4.h-4') ?? [];
    expect(svgs.length).toBeGreaterThan(0);
  });

  it('clicking delete calls confirm delete logic', async () => {
    const divCard = wrapper.find('.div-card-click-target');
    await divCard.trigger('contextmenu', { clientX: 12, clientY: 16 });
    await wrapper.vm.$nextTick();

    const menu = document.body.querySelector('[data-grid-context-menu]');
    expect(menu).not.toBeNull();
    // Find delete button (last item usually)
    const items = Array.from(menu!.querySelectorAll('[role="menuitem"]'));
    const deleteBtn = items[items.length - 1];

    if (!deleteBtn) throw new Error('Delete button not found');
    expect(deleteBtn.textContent).toContain('删除卡片');
    deleteBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await wrapper.vm.$nextTick();

    // Check if delete confirm modal is shown
    expect(document.body.textContent).toContain('删除确认');
  });

  it('disables ordinary widgets from edit mode close button', async () => {
    const editButton = wrapper.findAll('button').find((button) => button.text().trim() === '编辑');
    if (!editButton) throw new Error('Edit button not found');

    await editButton.trigger('click');
    const disableButton = wrapper.find('[aria-label="禁用组件"]');

    expect(disableButton.exists()).toBe(true);
    await disableButton.trigger('click');

    expect(store.widgets.find((w) => w.id === 'clock-1')?.enable).toBe(false);
  });
});
