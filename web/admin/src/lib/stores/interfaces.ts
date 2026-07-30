import { writable } from 'svelte/store';
import { api } from '$lib/api/client';

export interface SidebarInterface {
  name: string;
  device: string;
  status: 'up' | 'down' | 'unknown';
  ipv4?: string;
  role?: string;
}

const POLL_INTERVAL = 10_000;

function createInterfaceStore() {
  const { subscribe, set } = writable<SidebarInterface[]>([]);
  let timer: ReturnType<typeof setInterval> | null = null;

  async function refresh() {
    try {
      const [configs, devices] = await Promise.all([
        api.get<any[]>('/interfaces'),
        api.get<any[]>('/interfaces/devices').catch(() => [] as any[]),
      ]);
      if (!Array.isArray(configs)) return;

      // Build device lookup by name for live link status
      const devMap = new Map<string, any>();
      if (Array.isArray(devices)) {
        for (const d of devices) {
          if (d.name) devMap.set(d.name, d);
        }
      }

      const interfaces: SidebarInterface[] = configs
        .map((iface: any): SidebarInterface => {
          const name = String(iface.name ?? iface.identifier ?? '');
          const deviceName = String(iface.device ?? iface.name ?? '');
          const dev = devMap.get(deviceName) ?? devMap.get(name);

          let status: SidebarInterface['status'] = 'unknown';
          if (dev) {
            // /interfaces/devices returns link_detected (bool) and status ("up"/"down")
            if (dev.link_detected === true || dev.status === 'up') status = 'up';
            else if (dev.link_detected === false || dev.status === 'down') status = 'down';
          }

          return {
            name,
            device: deviceName,
            status,
            ipv4: iface.ipv4?.address ?? iface.ip ?? dev?.ipv4_addresses?.[0] ?? undefined,
            role: iface.role ?? undefined,
          };
        })
        .filter((i) => i.name);
      set(interfaces);
    } catch {}
  }

  function start() {
    refresh();
    if (!timer) timer = setInterval(refresh, POLL_INTERVAL);
  }

  function stop() {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }

  return { subscribe, start, stop, refresh };
}

export const interfaceStore = createInterfaceStore();
