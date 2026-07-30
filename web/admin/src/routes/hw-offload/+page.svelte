<!-- Route view for `/hw-offload` in the ezNGFW admin GUI. -->

<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '$lib/api/client';
  import { toasts } from '$lib/stores/toast';
  import { asList, asObject } from '$lib/utils/api-data';
  import FieldLabel from '$lib/components/admin/FieldLabel.svelte';
  import { Button } from '$lib/components/ui/button';
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '$lib/components/ui/card';
  import { Input } from '$lib/components/ui/input';
  import { Switch } from '$lib/components/ui/switch';
  import * as Select from '$lib/components/ui/select';
  import Info from '@lucide/svelte/icons/info';
  import Save from '@lucide/svelte/icons/save';
  import RefreshCw from '@lucide/svelte/icons/refresh-cw';
  import ChevronDown from '@lucide/svelte/icons/chevron-down';
  import ChevronRight from '@lucide/svelte/icons/chevron-right';
  import Plus from '@lucide/svelte/icons/plus';
  import Trash2 from '@lucide/svelte/icons/trash-2';
  import Gauge from '@lucide/svelte/icons/gauge';
  import { _ } from '$lib/i18n';

  type HwOffloadInterface = {
    interface: string;
    rx_checksum: boolean;
    tx_checksum: boolean;
    tso: boolean;
    gso: boolean;
    gro: boolean;
    lro: boolean;
    ntuple_filters: boolean;
    flow_director: boolean;
    rx_ring_size: number | null;
    tx_ring_size: number | null;
    rx_queue_count: number | null;
    tx_queue_count: number | null;
    adaptive_coalescing: boolean;
    rx_coalesce_usecs: number | null;
    tx_coalesce_usecs: number | null;
    numa_node: number | null;
  };

  type XdpConfig = {
    enabled: boolean;
    mode: string;
    interfaces: string[];
    ebpf_conntrack: boolean;
    ebpf_traffic_class: boolean;
  };

  type DpdkConfig = {
    enabled: boolean;
    hugepage_mb: number;
    pci_devices: string[];
    memory_channels: number;
    lcores: number;
  };

  type FlowOffloadConfig = {
    software: boolean;
    hardware: boolean;
    interfaces: string[];
  };

  type AfXdpConfig = {
    enabled: boolean;
    interface: string;
    queue_id: number;
    frame_size: number;
    num_frames: number;
    zero_copy: boolean;
    batch_size: number;
    use_need_wakeup: boolean;
  };

  type HwOffloadConfig = {
    enabled: boolean;
    interfaces: HwOffloadInterface[];
    xdp: XdpConfig;
    dpdk: DpdkConfig;
    flow_offload: FlowOffloadConfig;
    af_xdp: AfXdpConfig;
    cpu_affinity: string;
  };

  const defaultInterface: HwOffloadInterface = {
    interface: '',
    rx_checksum: true,
    tx_checksum: true,
    tso: true,
    gso: true,
    gro: true,
    lro: false,
    ntuple_filters: false,
    flow_director: false,
    rx_ring_size: null,
    tx_ring_size: null,
    rx_queue_count: null,
    tx_queue_count: null,
    adaptive_coalescing: true,
    rx_coalesce_usecs: null,
    tx_coalesce_usecs: null,
    numa_node: null
  };

  const defaults: HwOffloadConfig = {
    enabled: false,
    interfaces: [],
    xdp: {
      enabled: false,
      mode: 'native',
      interfaces: [],
      ebpf_conntrack: false,
      ebpf_traffic_class: false
    },
    dpdk: {
      enabled: false,
      hugepage_mb: 1024,
      pci_devices: [],
      memory_channels: 4,
      lcores: 2
    },
    flow_offload: {
      software: false,
      hardware: false,
      interfaces: []
    },
    af_xdp: {
      enabled: false,
      interface: '',
      queue_id: 0,
      frame_size: 4096,
      num_frames: 4096,
      zero_copy: false,
      batch_size: 64,
      use_need_wakeup: true
    },
    cpu_affinity: '0xff'
  };

  let settings = $state<HwOffloadConfig>({ ...defaults, interfaces: [], xdp: { ...defaults.xdp }, dpdk: { ...defaults.dpdk }, flow_offload: { ...defaults.flow_offload }, af_xdp: { ...defaults.af_xdp } });
  let loading = $state(true);
  let saving = $state(false);
  let showPerInterface = $state(true);
  let showXdp = $state(true);
  let showAfXdp = $state(false);
  let showDpdk = $state(false);
  let showAdvanced = $state(false);
  let newFlowInterface = $state('');
  let newXdpInterface = $state('');
  let newPciDevice = $state('');
  let interfaceOptions = $state<{label: string; value: string}[]>([]);

  let newIface = $state<HwOffloadInterface>({ ...defaultInterface });
  let status = $state<Record<string, unknown>>({ global_enabled: false, interfaces: [] });

  const xdpModes = [
    { value: 'native', label: 'native (driver mode)' },
    { value: 'offload', label: 'offload (NIC hardware)' },
    { value: 'generic', label: 'generic (skb fallback)' }
  ];

  const numaOptions = [
    { value: '-1', label: 'Auto (-1)' },
    { value: '0', label: 'NUMA node 0' },
    { value: '1', label: 'NUMA node 1' },
    { value: '2', label: 'NUMA node 2' }
  ];

  const hints = {
    enabled:
      'Global hardware offload toggle enables fast-path acceleration features across configured interfaces and subsystems. Disable it to force software forwarding during troubleshooting, validation, or compatibility testing. Example: enabled on production 10G firewalls, and disable during packet inspection regression analysis.',
    cpu_affinity:
      'CPU affinity mask controls which CPU cores process packet handling and offload worker threads. Use it to isolate dataplane activity from control-plane services and reduce jitter during peak throughput. Example: 0xff to use cores 0-7, and adjust after changing core reservations for IDS or VPN workloads.',
    flow_software:
      'Software flow offload enables kernel flowtable acceleration before packets hit slower rule evaluation paths. Keep it enabled for high connection counts when hardware offload is unavailable or partially supported. Example: enabled on virtualized appliances, and disable when debugging stateful rule behavior anomalies.',
    flow_hardware:
      'Hardware flow offload pushes eligible flows to NIC-assisted datapaths for maximum packet throughput. Enable only on validated drivers and firmware combinations to avoid silent forwarding inconsistencies. Example: enabled on supported Intel or Mellanox cards, and disable after driver updates until validated.',
    flow_interfaces:
      'Flow offload interfaces define which network links participate in accelerated connection handling. Restrict this list to trusted transit interfaces rather than management-only links for safer operations. Example: wan0 and lan0, and change when topology adds dedicated transit VLAN interfaces.',
    xdp_enabled:
      'XDP enables eBPF packet programs at the earliest receive path for ultra-low-latency filtering and telemetry. Use it when you need high PPS protection or custom fast-path logic before normal kernel networking. Example: enabled for DDoS prefiltering, and disable on adapters lacking stable XDP support.',
    xdp_mode:
      'XDP mode selects execution path: native for best performance, offload for NIC execution, generic for widest compatibility. Start with native and switch only when hardware capabilities or driver behavior require it. Example: native on ixgbe/i40e, and generic during compatibility fallback testing.',
    xdp_interfaces:
      'XDP interfaces list where eBPF programs should be attached and actively enforced. Keep this scope tight to avoid affecting low-risk links that do not need line-rate filtering. Example: wan0 only for edge drop policies, and expand during east-west threat monitoring projects.',
    ebpf_conntrack:
      'eBPF conntrack acceleration uses map-based lookups to reduce state handling overhead on busy flows. Enable it for high-connection environments after confirming map sizing and kernel support in your platform baseline. Example: enabled on branch hubs handling many short-lived sessions, and disable when troubleshooting map pressure.',
    ebpf_traffic_class:
      'eBPF traffic classification applies lightweight policy tagging before deeper firewall logic executes. Use it to pre-mark classes for QoS, telemetry, or selective fast-path routing decisions. Example: enabled for latency-sensitive VoIP tagging, and disable when class maps are under redesign.',
    af_xdp_enabled:
      'AF_XDP enables zero-copy packet delivery from XDP to userspace for flows requiring deep packet inspection, bypassing the kernel networking stack entirely. Enable it when the DPI engine needs wire-speed inspection of suspicious flows without kernel copy overhead. Example: enabled on 10G+ firewall appliances, and disable during driver compatibility testing.',
    af_xdp_interface:
      'AF_XDP interface selects which NIC port the XDP socket will bind to for zero-copy packet delivery. Use the primary inspection interface where DPI-eligible traffic arrives. Example: wan0 for edge inspection, and change when migrating inspection to a dedicated SPAN port.',
    af_xdp_queue_id:
      'Queue ID selects which NIC hardware queue the AF_XDP socket binds to for receive processing. Match it to the RSS queue steering DPI-eligible traffic for optimal locality. Example: 0 for single-queue setups, and adjust when using multi-queue steering rules.',
    af_xdp_frame_size:
      'UMEM frame size sets the per-packet buffer size in the shared memory region between kernel and userspace. Use 4096 for standard MTU traffic and 2048 only when memory is constrained and jumbo frames are not in use. Example: 4096 for general use, and 2048 for memory-constrained embedded deployments.',
    af_xdp_num_frames:
      'Number of frames in the UMEM region controls how many packets can be in-flight between kernel and userspace simultaneously. Increase for high PPS workloads and decrease on memory-limited platforms. Example: 4096 for typical throughput, and 16384 for high-speed DPI inspection.',
    af_xdp_zero_copy:
      'Zero-copy mode eliminates kernel-to-user memory copies by sharing UMEM directly with the NIC driver. Requires NIC driver support (i40e, ice, mlx5). Disable to fall back to copy mode on unsupported drivers. Example: enabled on Intel/Mellanox NICs, and disable on virtio or unsupported hardware.',
    af_xdp_batch_size:
      'Batch size controls how many packets are processed per ring operation in the AF_XDP socket. Larger batches improve throughput efficiency but increase per-batch latency. Example: 64 for balanced throughput, and 32 for latency-sensitive inspection workloads.',
    af_xdp_use_need_wakeup:
      'Need wakeup flag allows the AF_XDP socket to sleep when idle instead of busy-polling, reducing CPU usage during low traffic periods. Disable only for absolute minimum latency requirements. Example: enabled for power-efficient operation, and disable for dedicated busy-poll packet loops.',
    dpdk_enabled:
      'DPDK mode bypasses parts of the kernel network stack for user-space packet IO with very high throughput potential. Enable only when your deployment and NIC drivers are explicitly prepared for DPDK ownership changes. Example: enabled in dedicated high-throughput appliances, and disable in mixed-purpose systems.',
    hugepage_mb:
      'Hugepage allocation reserves contiguous memory for DPDK packet buffers and ring structures. Size it according to expected queue depth and traffic profile to avoid allocation failures under load. Example: 1024 MB for moderate traffic, and increase for multi-10G ingestion profiles.',
    pci_devices:
      'PCI device list identifies which NIC ports should bind to DPDK drivers instead of kernel drivers. Keep this list accurate because incorrect bindings can remove interfaces from regular networking unexpectedly. Example: 0000:3b:00.0, and update when NIC slots or firmware mappings change.',
    memory_channels:
      'Memory channels should match platform NUMA and memory controller topology for best packet memory bandwidth. Start with hardware-recommended values and benchmark before reducing channels. Example: 4 on dual-channel memory systems, and adjust after hardware refreshes.',
    lcores:
      'DPDK lcore count allocates worker cores dedicated to user-space packet loops and queue servicing. Increasing lcores can improve throughput, but may starve control-plane services if over-allocated. Example: 4 lcores on 16-core systems, and rebalance when adding IDS or VPN workloads.',
    interface_name:
      'Interface name selects the exact NIC port whose offload profile you are editing inline. Use stable interface naming from your inventory to avoid applying tuning to the wrong link after reboots. Example: igc0 or ens3f0, and update whenever hardware mapping changes.',
    rx_checksum:
      'RX checksum offload delegates inbound checksum verification to hardware for reduced CPU overhead. Disable it temporarily when validating packet captures that appear to show checksum anomalies. Example: enabled in production, and disable during low-level protocol troubleshooting.',
    tx_checksum:
      'TX checksum offload lets the NIC generate outbound checksums at transmit time, improving forwarding efficiency. Keep enabled unless specific encapsulation or debugging workflows require software checksumming. Example: enabled on most links, and disable when reproducing malformed packet reports.',
    tso:
      'TCP Segmentation Offload allows large TCP buffers to be segmented by NIC hardware rather than CPU. Use it for throughput-heavy traffic, but disable if you see MTU fragmentation or tunnel edge issues. Example: enabled on WAN uplinks, and disable on problematic encapsulated paths.',
    gso:
      'Generic Segmentation Offload performs software-side segmentation batching before handoff to NIC, reducing per-packet overhead. It can improve CPU efficiency but may obscure packet-level behavior during diagnostics. Example: enabled for baseline performance, and disable while capturing exact packet sequences.',
    gro:
      'Generic Receive Offload coalesces inbound packets to lower CPU interrupt pressure and processing overhead. Keep enabled for throughput scenarios and disable for precise IDS or forensic packet inspection flows. Example: enabled on bulk transfer links, and disable for packet-level debugging sessions.',
    lro:
      'Large Receive Offload merges receive packets aggressively in hardware or driver paths and can boost throughput. Many routing/firewall scenarios avoid LRO due to potential side effects on forwarding semantics. Example: disabled on firewalls by default, and enable only after controlled compatibility testing.',
    ntuple_filters:
      'Ntuple filters enable hardware flow steering rules for finer RSS and queue assignment control. Enable when tuning queue locality for multi-core receive processing under heavy traffic. Example: enabled in high PPS environments, and disable when troubleshooting queue imbalance.',
    flow_director:
      'Intel Flow Director steers packets into specific RX queues based on learned or programmed flow patterns. Use it to improve cache locality and reduce contention across worker cores. Example: enabled on supported Intel adapters, and disable if firmware bugs impact stability.',
    rx_ring_size:
      'RX ring size sets descriptor depth for inbound packets, trading memory usage for burst absorption capacity. Increase for bursty ingress paths and reduce for low-latency tuning where queueing delay matters. Example: 4096 descriptors on busy WAN links, and lower for latency-sensitive workloads.',
    tx_ring_size:
      'TX ring size controls outbound descriptor queue depth and affects batching efficiency under high egress load. Larger values can smooth bursts but may increase memory use and queuing delay. Example: 2048 descriptors for heavy outbound traffic, and tune down when minimizing latency.',
    rx_queue_count:
      'RX queue count defines Receive Side Scaling fan-out and should align with dedicated processing cores. Increase queues for multi-core parallelism and reduce on small CPUs to avoid overhead. Example: 8 queues on 8-core data planes, and lower when CPU allocation shrinks.',
    tx_queue_count:
      'TX queue count configures multi-queue transmit concurrency across CPU workers and traffic classes. Match TX queues to active egress workers for balanced throughput and reduced lock contention. Example: 8 queues for multi-core egress, and reduce for simpler single-core paths.',
    adaptive_coalescing:
      'Adaptive interrupt coalescing dynamically adjusts interrupt timers based on observed traffic conditions. Enable for mixed workloads where latency and throughput tradeoffs shift throughout the day. Example: enabled on internet edges, and disable for fixed-latency packet processing requirements.',
    rx_coalesce_usecs:
      'RX coalescing microseconds sets static delay before raising receive interrupts when adaptive mode is off. Higher values reduce CPU interrupts at the cost of additional per-packet latency. Example: 25 usec on throughput-focused links, and lower to 5 usec for latency-sensitive services.',
    tx_coalesce_usecs:
      'TX coalescing microseconds controls transmit interrupt pacing under fixed coalescing configuration. Tune it alongside RX values to balance throughput, interrupt rate, and control-plane responsiveness. Example: 50 usec for bulk traffic, and decrease when low-latency egress confirmation is required.',
    numa_node:
      'NUMA pinning binds interface processing to a specific memory locality domain for better cache and memory access patterns. Use auto for general deployments or explicit pinning in high-throughput tuned systems. Example: node 0 for first CPU socket NICs, and change after PCI slot or CPU topology updates.',
    status:
      'Performance status summarizes active offload state and runtime interface reporting from the backend status endpoint. Use these counters and flags to confirm that intended acceleration settings are actually active. Example: global_enabled true with active interfaces, and review after every driver or kernel upgrade.'
  };

  const enabledFeatures = $derived.by(() => {
    let count = Number(settings.flow_offload.software) + Number(settings.flow_offload.hardware);
    count += Number(settings.xdp.enabled) + Number(settings.dpdk.enabled);
    count += Number(settings.af_xdp?.enabled);
    return count;
  });

  const interfaceCount = $derived.by(() => settings.interfaces.length);

  function parseNullable(value: string): number | null {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const num = Number(trimmed);
    return Number.isFinite(num) ? num : null;
  }

  function normalizeInterface(input: Record<string, unknown>): HwOffloadInterface {
    const obj = asObject(input);
    return {
      interface: String(obj.interface ?? ''),
      rx_checksum: Boolean(obj.rx_checksum),
      tx_checksum: Boolean(obj.tx_checksum),
      tso: Boolean(obj.tso),
      gso: Boolean(obj.gso),
      gro: Boolean(obj.gro),
      lro: Boolean(obj.lro),
      ntuple_filters: Boolean(obj.ntuple_filters),
      flow_director: Boolean(obj.flow_director),
      rx_ring_size: obj.rx_ring_size === null || obj.rx_ring_size === undefined ? null : Number(obj.rx_ring_size),
      tx_ring_size: obj.tx_ring_size === null || obj.tx_ring_size === undefined ? null : Number(obj.tx_ring_size),
      rx_queue_count: obj.rx_queue_count === null || obj.rx_queue_count === undefined ? null : Number(obj.rx_queue_count),
      tx_queue_count: obj.tx_queue_count === null || obj.tx_queue_count === undefined ? null : Number(obj.tx_queue_count),
      adaptive_coalescing: Boolean(obj.adaptive_coalescing),
      rx_coalesce_usecs: obj.rx_coalesce_usecs === null || obj.rx_coalesce_usecs === undefined ? null : Number(obj.rx_coalesce_usecs),
      tx_coalesce_usecs: obj.tx_coalesce_usecs === null || obj.tx_coalesce_usecs === undefined ? null : Number(obj.tx_coalesce_usecs),
      numa_node: obj.numa_node === null || obj.numa_node === undefined ? null : Number(obj.numa_node)
    };
  }

  function normalizeConfig(input: Record<string, unknown>): HwOffloadConfig {
    const xdp = asObject(input.xdp ?? {});
    const dpdk = asObject(input.dpdk ?? {});
    const flow = asObject(input.flow_offload ?? {});
    const afxdp = asObject(input.af_xdp ?? {});

    return {
      enabled: Boolean(input.enabled),
      interfaces: asList(input.interfaces).map((item) => normalizeInterface(asObject(item))),
      xdp: {
        enabled: Boolean(xdp.enabled),
        mode: String(xdp.mode ?? 'native'),
        interfaces: asList(xdp.interfaces).map((item) => String(item)).filter(Boolean),
        ebpf_conntrack: Boolean(xdp.ebpf_conntrack),
        ebpf_traffic_class: Boolean(xdp.ebpf_traffic_class)
      },
      dpdk: {
        enabled: Boolean(dpdk.enabled),
        hugepage_mb: Number(dpdk.hugepage_mb ?? 1024),
        pci_devices: asList(dpdk.pci_devices).map((item) => String(item)).filter(Boolean),
        memory_channels: Number(dpdk.memory_channels ?? 4),
        lcores: Number(dpdk.lcores ?? 2)
      },
      flow_offload: {
        software: Boolean(flow.software),
        hardware: Boolean(flow.hardware),
        interfaces: asList(flow.interfaces).map((item) => String(item)).filter(Boolean)
      },
      af_xdp: {
        enabled: Boolean(afxdp.enabled),
        interface: String(afxdp.interface ?? ''),
        queue_id: Number(afxdp.queue_id ?? 0),
        frame_size: Number(afxdp.frame_size ?? 4096),
        num_frames: Number(afxdp.num_frames ?? 4096),
        zero_copy: Boolean(afxdp.zero_copy),
        batch_size: Number(afxdp.batch_size ?? 64),
        use_need_wakeup: Boolean(afxdp.use_need_wakeup ?? true)
      },
      cpu_affinity: String(input.cpu_affinity ?? '0xff')
    };
  }

  async function loadSettings() {
    loading = true;
    try {
      const payload = asObject(await api.get('/hw-offload'));
      settings = normalizeConfig(payload);
      showPerInterface = true;
      showXdp = true;
      showAfXdp = settings.af_xdp.enabled;
      showDpdk = settings.dpdk.enabled;
      showAdvanced = !settings.enabled || settings.cpu_affinity !== '0xff';
    } catch (e) {
      settings = { ...defaults, interfaces: [], xdp: { ...defaults.xdp }, dpdk: { ...defaults.dpdk }, flow_offload: { ...defaults.flow_offload }, af_xdp: { ...defaults.af_xdp } };
      toasts.error(e instanceof Error ? e.message : 'Unable to load hardware offload settings');
    } finally {
      loading = false;
    }
  }

  async function loadStatus() {
    try {
      status = asObject(await api.get('/hw-offload/status'));
    } catch {
      status = { global_enabled: false, interfaces: [] };
    }
  }

  async function saveSettings() {
    saving = true;
    try {
      await api.patch('/hw-offload', settings);
      toasts.success($_('hw_offload.toasthardware_offload_settings_saved'));
      await loadStatus();
    } catch (e) {
      toasts.error(e instanceof Error ? e.message : 'Failed to save hardware offload settings');
    } finally {
      saving = false;
    }
  }

  function addInterface() {
    if (!newIface.interface.trim()) return;
    settings.interfaces = [...settings.interfaces, { ...newIface, interface: newIface.interface.trim() }];
    newIface = { ...defaultInterface };
  }

  function removeInterface(index: number) {
    settings.interfaces = settings.interfaces.filter((_, idx) => idx !== index);
  }

  function addFlowInterface() {
    const candidate = newFlowInterface.trim();
    if (!candidate) return;
    settings.flow_offload.interfaces = [...settings.flow_offload.interfaces, candidate];
    newFlowInterface = '';
  }

  function removeFlowInterface(index: number) {
    settings.flow_offload.interfaces = settings.flow_offload.interfaces.filter((_, idx) => idx !== index);
  }

  function addXdpInterface() {
    const candidate = newXdpInterface.trim();
    if (!candidate) return;
    settings.xdp.interfaces = [...settings.xdp.interfaces, candidate];
    newXdpInterface = '';
  }

  function removeXdpInterface(index: number) {
    settings.xdp.interfaces = settings.xdp.interfaces.filter((_, idx) => idx !== index);
  }

  function addPciDevice() {
    const candidate = newPciDevice.trim();
    if (!candidate) return;
    settings.dpdk.pci_devices = [...settings.dpdk.pci_devices, candidate];
    newPciDevice = '';
  }

  function removePciDevice(index: number) {
    settings.dpdk.pci_devices = settings.dpdk.pci_devices.filter((_, idx) => idx !== index);
  }

  async function loadInterfaces() {
    try {
      const data = await api.get<Record<string, any>>('/interfaces');
      const entries = Array.isArray(data) ? data : Object.entries(data).map(([k, v]: [string, any]) => ({ name: k, ...v }));
      interfaceOptions = entries.map((iface: any) => ({ label: iface.name || iface.description || String(iface), value: iface.name || String(iface) }));
    } catch { interfaceOptions = []; }
  }

  onMount(() => {
    loadSettings();
    loadStatus();
    void loadInterfaces();
  });
</script>

<div class="space-y-6">
  <Card class="border-slate-700 bg-slate-950/70">
    <CardHeader>
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <CardTitle class="text-slate-100">{$_('hw_offload.hardware_offload_control_plane')}</CardTitle>
          <CardDescription class="text-slate-400">
            Deep control over NIC offload flags, flow acceleration, XDP/eBPF, DPDK, queueing, and interrupt behavior.
          </CardDescription>
        </div>
        <div class="flex items-center gap-2">
          <Button variant="outline" class="border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800" onclick={loadSettings} disabled={loading}>
            <RefreshCw class="mr-1.5 h-3.5 w-3.5" />
            Reload
          </Button>
          <Button class="bg-cyan-600 text-white hover:bg-cyan-700" onclick={saveSettings} disabled={saving || loading}>
            <Save class="mr-1.5 h-3.5 w-3.5" />
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </div>
    </CardHeader>
    <CardContent class="space-y-6">
      <div class="grid gap-3 md:grid-cols-5">
        <div class="rounded-md border border-slate-700 bg-slate-900/60 p-3">
          <p class="text-xs uppercase tracking-wide text-slate-400">{$_('hw_offload.global_state')}</p>
          <p class="mt-1 text-sm font-medium" class:text-emerald-400={settings.enabled} class:text-amber-300={!settings.enabled}>
            {settings.enabled ? 'Enabled' : 'Disabled'}
          </p>
        </div>
        <div class="rounded-md border border-slate-700 bg-slate-900/60 p-3">
          <p class="text-xs uppercase tracking-wide text-slate-400">{$_('hw_offload.enabled_feature_families')}</p>
          <p class="mt-1 text-sm font-medium text-cyan-300">{enabledFeatures}</p>
        </div>
        <div class="rounded-md border border-slate-700 bg-slate-900/60 p-3">
          <p class="text-xs uppercase tracking-wide text-slate-400">{$_('hw_offload.configured_interfaces')}</p>
          <p class="mt-1 text-sm font-medium text-slate-200">{interfaceCount}</p>
        </div>
        <div class="rounded-md border border-slate-700 bg-slate-900/60 p-3">
          <p class="text-xs uppercase tracking-wide text-slate-400">{$_('hw_offload.xdp_mode')}</p>
          <p class="mt-1 text-sm font-medium text-cyan-300">{settings.xdp?.enabled ? (settings.xdp.mode || 'native') : 'Off'}</p>
        </div>
        <div class="rounded-md border border-slate-700 bg-slate-900/60 p-3">
          <p class="text-xs uppercase tracking-wide text-slate-400">{$_('hw_offload.afxdp')}</p>
          <p class="mt-1 text-sm font-medium" class:text-emerald-400={settings.af_xdp?.enabled} class:text-slate-500={!settings.af_xdp?.enabled}>
            {settings.af_xdp?.enabled ? 'Active' : 'Off'}
          </p>
        </div>
      </div>

      <div class="rounded-lg border border-slate-700 bg-slate-900/40 p-4">
        <div class="flex items-center justify-between gap-3">
          <div class="space-y-1">
            <FieldLabel label="Enable hardware offload" hint={hints.enabled} />
            <p class="text-xs text-slate-400">{$_('hw_offload.master_acceleration_switch_for_dataplane_fastpath')}</p>
          </div>
          <Switch checked={settings.enabled} onCheckedChange={(value) => (settings.enabled = value)} />
        </div>
      </div>

      <div class="grid gap-4 md:grid-cols-2">
        <div>
          <FieldLabel label="CPU affinity mask" hint={hints.cpu_affinity} />
          <Input class="mt-1 border-slate-700 bg-slate-950 text-slate-200" bind:value={settings.cpu_affinity} placeholder="0xff" />
        </div>
        <div class="rounded-md border border-slate-700 bg-slate-900/40 p-3">
          <div class="flex items-center justify-between">
            <FieldLabel label="Software flow offload" hint={hints.flow_software} />
            <Switch checked={settings.flow_offload.software} onCheckedChange={(value) => (settings.flow_offload.software = value)} />
          </div>
        </div>
        <div class="rounded-md border border-slate-700 bg-slate-900/40 p-3">
          <div class="flex items-center justify-between">
            <FieldLabel label="Hardware flow offload" hint={hints.flow_hardware} />
            <Switch checked={settings.flow_offload.hardware} onCheckedChange={(value) => (settings.flow_offload.hardware = value)} />
          </div>
        </div>
        <div class="space-y-2 rounded-md border border-slate-700 bg-slate-900/40 p-3">
          <div class="flex items-center gap-2 text-cyan-300">
            <Info class="h-4 w-4" />
            <FieldLabel label="Flow offload interfaces" hint={hints.flow_interfaces} />
          </div>
          <div class="grid gap-2 md:grid-cols-[1fr_auto]">
            <select class="cursor-pointer h-10 w-full rounded-md border border-slate-700 bg-slate-900 px-3 text-sm text-slate-100" bind:value={newFlowInterface}>
              <option value="">— Select Interface —</option>
              {#each interfaceOptions as opt}
                <option value={opt.value}>{opt.label}</option>
              {/each}
            </select>
            <Button variant="outline" class="border-cyan-700 text-cyan-300 hover:bg-slate-800" onclick={addFlowInterface}>
              <Plus class="mr-1.5 h-3.5 w-3.5" />
              Add
            </Button>
          </div>
          <div class="space-y-2">
            {#if settings.flow_offload.interfaces.length === 0}
              <p class="text-xs text-slate-500">{$_('hw_offload.no_flow_offload_interfaces_selected')}</p>
            {:else}
              {#each settings.flow_offload.interfaces as iface, index (iface + index)}
                <div class="flex items-center justify-between rounded border border-slate-700 px-2 py-1 text-sm text-slate-200">
                  <span>{iface}</span>
                  <Button variant="outline" class="h-7 border-red-700 px-2 text-red-300 hover:bg-slate-800" onclick={() => removeFlowInterface(index)}>
                    <Trash2 class="h-3.5 w-3.5" />
                  </Button>
                </div>
              {/each}
            {/if}
          </div>
        </div>
      </div>

      <div class="rounded-lg border border-slate-700">
        <button type="button" class="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-slate-200 hover:bg-slate-800/30" onclick={() => (showXdp = !showXdp)}>
          <span>{$_('hw_offload.xdp_and_ebpf_acceleration')}</span>
          {#if showXdp}
            <ChevronDown class="h-4 w-4 text-slate-500" />
          {:else}
            <ChevronRight class="h-4 w-4 text-slate-500" />
          {/if}
        </button>
        {#if showXdp}
          <div class="space-y-4 border-t border-slate-700 p-4">
            <div class="rounded-md border border-slate-700 bg-slate-900/40 p-3">
              <div class="flex items-center justify-between">
                <FieldLabel label="Enable XDP" hint={hints.xdp_enabled} />
                <Switch checked={settings.xdp.enabled} onCheckedChange={(value) => (settings.xdp.enabled = value)} />
              </div>
            </div>
            <div class="grid gap-4 md:grid-cols-2">
              <div>
                <FieldLabel label="XDP mode" hint={hints.xdp_mode} />
                <Select.Root type="single" value={settings.xdp.mode} onValueChange={(value) => value && (settings.xdp.mode = value)}>
                <Select.Trigger class="mt-1 w-full border-slate-700 bg-slate-950 text-slate-200">
                  <span>{xdpModes.find(o => o.value === settings.xdp.mode)?.label ?? settings.xdp.mode}</span>
                </Select.Trigger>
                  <Select.Content class="border-slate-700 bg-slate-900 text-slate-100">
                    {#each xdpModes as mode}
                      <Select.Item value={mode.value} label={mode.label} class="text-slate-200 hover:bg-slate-800" />
                    {/each}
                  </Select.Content>
                </Select.Root>
              </div>
              <div class="space-y-2 rounded-md border border-slate-700 bg-slate-900/40 p-3">
                <div class="flex items-center gap-2 text-cyan-300">
                  <Info class="h-4 w-4" />
                  <FieldLabel label="XDP interfaces" hint={hints.xdp_interfaces} />
                </div>
                <div class="grid gap-2 md:grid-cols-[1fr_auto]">
                  <select class="cursor-pointer h-10 w-full rounded-md border border-slate-700 bg-slate-900 px-3 text-sm text-slate-100" bind:value={newXdpInterface}>
                    <option value="">— Select Interface —</option>
                    {#each interfaceOptions as opt}
                      <option value={opt.value}>{opt.label}</option>
                    {/each}
                  </select>
                  <Button variant="outline" class="border-cyan-700 text-cyan-300 hover:bg-slate-800" onclick={addXdpInterface}>
                    <Plus class="mr-1.5 h-3.5 w-3.5" />
                    Add
                  </Button>
                </div>
                <div class="space-y-2">
                  {#if settings.xdp.interfaces.length === 0}
                    <p class="text-xs text-slate-500">{$_('hw_offload.no_xdp_interfaces_configured')}</p>
                  {:else}
                    {#each settings.xdp.interfaces as iface, index (iface + index)}
                      <div class="flex items-center justify-between rounded border border-slate-700 px-2 py-1 text-sm text-slate-200">
                        <span>{iface}</span>
                        <Button variant="outline" class="h-7 border-red-700 px-2 text-red-300 hover:bg-slate-800" onclick={() => removeXdpInterface(index)}>
                          <Trash2 class="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    {/each}
                  {/if}
                </div>
              </div>
              <div class="rounded-md border border-slate-700 bg-slate-900/40 p-3">
                <div class="flex items-center justify-between">
                  <FieldLabel label="eBPF conntrack acceleration" hint={hints.ebpf_conntrack} />
                  <Switch checked={settings.xdp.ebpf_conntrack} onCheckedChange={(value) => (settings.xdp.ebpf_conntrack = value)} />
                </div>
              </div>
              <div class="rounded-md border border-slate-700 bg-slate-900/40 p-3">
                <div class="flex items-center justify-between">
                  <FieldLabel label="eBPF traffic classification" hint={hints.ebpf_traffic_class} />
                  <Switch checked={settings.xdp.ebpf_traffic_class} onCheckedChange={(value) => (settings.xdp.ebpf_traffic_class = value)} />
                </div>
              </div>
            </div>
          </div>
        {/if}
      </div>

      <div class="rounded-lg border border-slate-700">
        <button type="button" class="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-slate-200 hover:bg-slate-800/30" onclick={() => (showAfXdp = !showAfXdp)}>
          <span>{$_('hw_offload.afxdp_zerocopy_acceleration_dpi_engine')}</span>
          {#if showAfXdp}
            <ChevronDown class="h-4 w-4 text-slate-500" />
          {:else}
            <ChevronRight class="h-4 w-4 text-slate-500" />
          {/if}
        </button>
        {#if showAfXdp}
          <div class="space-y-4 border-t border-slate-700 p-4">
            <div class="rounded-md border border-slate-700 bg-slate-900/40 p-3">
              <div class="flex items-center justify-between">
                <FieldLabel label="Enable AF_XDP zero-copy" hint={hints.af_xdp_enabled} />
                <Switch checked={settings.af_xdp.enabled} onCheckedChange={(value) => (settings.af_xdp.enabled = value)} />
              </div>
            </div>
            <div class="grid gap-4 md:grid-cols-2">
              <div>
                <FieldLabel label="AF_XDP interface" hint={hints.af_xdp_interface} />
                <select class="cursor-pointer mt-1 h-10 w-full rounded-md border border-slate-700 bg-slate-950 px-3 text-sm text-slate-200" bind:value={settings.af_xdp.interface}>
                  <option value="">— Select Interface —</option>
                  {#each interfaceOptions as opt}
                    <option value={opt.value}>{opt.label}</option>
                  {/each}
                </select>
              </div>
              <div>
                <FieldLabel label="Queue ID" hint={hints.af_xdp_queue_id} />
                <Input class="mt-1 border-slate-700 bg-slate-950 text-slate-200" type="number" min="0" bind:value={settings.af_xdp.queue_id} />
              </div>
              <div>
                <FieldLabel label="UMEM frame size (bytes)" hint={hints.af_xdp_frame_size} />
                <Select.Root type="single" value={String(settings.af_xdp.frame_size)} onValueChange={(value) => value && (settings.af_xdp.frame_size = Number(value))}>
                  <Select.Trigger class="mt-1 w-full border-slate-700 bg-slate-950 text-slate-200">
                    <span>{settings.af_xdp.frame_size} bytes</span>
                  </Select.Trigger>
                  <Select.Content class="border-slate-700 bg-slate-900 text-slate-100">
                    <Select.Item value="2048" label="2048 bytes" class="text-slate-200 hover:bg-slate-800" />
                    <Select.Item value="4096" label="4096 bytes (recommended)" class="text-slate-200 hover:bg-slate-800" />
                  </Select.Content>
                </Select.Root>
              </div>
              <div>
                <FieldLabel label="Number of frames" hint={hints.af_xdp_num_frames} />
                <Input class="mt-1 border-slate-700 bg-slate-950 text-slate-200" type="number" min="256" bind:value={settings.af_xdp.num_frames} />
              </div>
              <div>
                <FieldLabel label="Batch size" hint={hints.af_xdp_batch_size} />
                <Input class="mt-1 border-slate-700 bg-slate-950 text-slate-200" type="number" min="1" max="256" bind:value={settings.af_xdp.batch_size} />
              </div>
            </div>
            <div class="grid gap-4 md:grid-cols-2">
              <div class="rounded-md border border-slate-700 bg-slate-900/40 p-3">
                <div class="flex items-center justify-between">
                  <FieldLabel label="Zero-copy mode" hint={hints.af_xdp_zero_copy} />
                  <Switch checked={settings.af_xdp.zero_copy} onCheckedChange={(value) => (settings.af_xdp.zero_copy = value)} />
                </div>
              </div>
              <div class="rounded-md border border-slate-700 bg-slate-900/40 p-3">
                <div class="flex items-center justify-between">
                  <FieldLabel label="Use need wakeup" hint={hints.af_xdp_use_need_wakeup} />
                  <Switch checked={settings.af_xdp.use_need_wakeup} onCheckedChange={(value) => (settings.af_xdp.use_need_wakeup = value)} />
                </div>
              </div>
            </div>
          </div>
        {/if}
      </div>

      <div class="rounded-lg border border-slate-700">
        <button type="button" class="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-slate-200 hover:bg-slate-800/30" onclick={() => (showDpdk = !showDpdk)}>
          <span>{$_('hw_offload.intel_dpdk_and_packet_engine_tuning')}</span>
          {#if showDpdk}
            <ChevronDown class="h-4 w-4 text-slate-500" />
          {:else}
            <ChevronRight class="h-4 w-4 text-slate-500" />
          {/if}
        </button>
        {#if showDpdk}
          <div class="space-y-4 border-t border-slate-700 p-4">
            <div class="rounded-md border border-slate-700 bg-slate-900/40 p-3">
              <div class="flex items-center justify-between">
                <FieldLabel label="Enable Intel DPDK" hint={hints.dpdk_enabled} />
                <Switch checked={settings.dpdk.enabled} onCheckedChange={(value) => (settings.dpdk.enabled = value)} />
              </div>
            </div>
            <div class="grid gap-4 md:grid-cols-3">
              <div>
                <FieldLabel label="Hugepage memory (MB)" hint={hints.hugepage_mb} />
                <Input class="mt-1 border-slate-700 bg-slate-950 text-slate-200" type="number" min="0" bind:value={settings.dpdk.hugepage_mb} />
              </div>
              <div>
                <FieldLabel label="Memory channels" hint={hints.memory_channels} />
                <Input class="mt-1 border-slate-700 bg-slate-950 text-slate-200" type="number" min="1" bind:value={settings.dpdk.memory_channels} />
              </div>
              <div>
                <FieldLabel label="DPDK lcores" hint={hints.lcores} />
                <Input class="mt-1 border-slate-700 bg-slate-950 text-slate-200" type="number" min="1" bind:value={settings.dpdk.lcores} />
              </div>
            </div>
            <div class="space-y-2 rounded-md border border-slate-700 bg-slate-900/40 p-3">
              <div class="flex items-center gap-2 text-cyan-300">
                <Info class="h-4 w-4" />
                <FieldLabel label="DPDK PCI devices" hint={hints.pci_devices} />
              </div>
              <div class="grid gap-2 md:grid-cols-[1fr_auto]">
                <Input class="border-slate-700 bg-slate-950 text-slate-200" bind:value={newPciDevice} placeholder="0000:3b:00.0" />
                <Button variant="outline" class="border-cyan-700 text-cyan-300 hover:bg-slate-800" onclick={addPciDevice}>
                  <Plus class="mr-1.5 h-3.5 w-3.5" />
                  Add
                </Button>
              </div>
              <div class="space-y-2">
                {#if settings.dpdk.pci_devices.length === 0}
                  <p class="text-xs text-slate-500">{$_('hw_offload.no_pci_devices_selected')}</p>
                {:else}
                  {#each settings.dpdk.pci_devices as device, index (device + index)}
                    <div class="flex items-center justify-between rounded border border-slate-700 px-2 py-1 text-sm text-slate-200">
                      <span>{device}</span>
                      <Button variant="outline" class="h-7 border-red-700 px-2 text-red-300 hover:bg-slate-800" onclick={() => removePciDevice(index)}>
                        <Trash2 class="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  {/each}
                {/if}
              </div>
            </div>
          </div>
        {/if}
      </div>

      <div class="rounded-lg border border-slate-700">
        <button type="button" class="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-slate-200 hover:bg-slate-800/30" onclick={() => (showPerInterface = !showPerInterface)}>
          <span>{$_('hw_offload.perinterface_offload_profiles_inline_crud')}</span>
          {#if showPerInterface}
            <ChevronDown class="h-4 w-4 text-slate-500" />
          {:else}
            <ChevronRight class="h-4 w-4 text-slate-500" />
          {/if}
        </button>
        {#if showPerInterface}
          <div class="space-y-4 border-t border-slate-700 p-4">
            <div class="space-y-3 rounded-md border border-slate-700 bg-slate-900/40 p-3">
              <p class="text-sm font-medium text-slate-200">{$_('hw_offload.add_interface_profile')}</p>
              <div class="grid gap-3 md:grid-cols-4">
                <div>
                  <FieldLabel label="Interface" hint={hints.interface_name} />
                  <select class="cursor-pointer h-10 w-full rounded-md border border-slate-700 bg-slate-950 px-3 text-sm text-slate-200" bind:value={newIface.interface}><option value="">— Select interface —</option>{#each interfaceOptions as opt}<option value={opt.value}>{opt.label}</option>{/each}</select>
                </div>
                <div>
                  <FieldLabel label="RX queues" hint={hints.rx_queue_count} />
                  <Input class="mt-1 border-slate-700 bg-slate-950 text-slate-200" value={newIface.rx_queue_count ?? ''} oninput={(event) => (newIface.rx_queue_count = parseNullable((event.currentTarget as HTMLInputElement).value))} />
                </div>
                <div>
                  <FieldLabel label="TX queues" hint={hints.tx_queue_count} />
                  <Input class="mt-1 border-slate-700 bg-slate-950 text-slate-200" value={newIface.tx_queue_count ?? ''} oninput={(event) => (newIface.tx_queue_count = parseNullable((event.currentTarget as HTMLInputElement).value))} />
                </div>
                <div class="flex items-end">
                  <Button variant="outline" class="w-full border-cyan-700 text-cyan-300 hover:bg-slate-800" onclick={addInterface}>
                    <Plus class="mr-1.5 h-3.5 w-3.5" />
                    Add interface
                  </Button>
                </div>
              </div>
            </div>

            {#if settings.interfaces.length === 0}
              <p class="rounded-md border border-dashed border-slate-700 px-3 py-4 text-sm text-slate-500">{$_('hw_offload.no_perinterface_profiles_configured')}</p>
            {:else}
              {#each settings.interfaces as iface, index (iface.interface + index)}
                <div class="space-y-3 rounded-md border border-slate-700 bg-slate-900/40 p-3">
                  <div class="flex flex-wrap items-center justify-between gap-3">
                    <p class="text-sm font-medium text-slate-200">{iface.interface || `Interface ${index + 1}`}</p>
                    <Button variant="outline" class="border-red-700 text-red-300 hover:bg-slate-800" onclick={() => removeInterface(index)}>
                      <Trash2 class="mr-1.5 h-3.5 w-3.5" />
                      Remove
                    </Button>
                  </div>

                  <div class="grid gap-3 md:grid-cols-4">
                    <div class="rounded-md border border-slate-700 bg-slate-900/50 p-3"><div class="flex items-center justify-between"><FieldLabel label="RX checksum" hint={hints.rx_checksum} /><Switch checked={iface.rx_checksum} onCheckedChange={(value) => (settings.interfaces[index].rx_checksum = value)} /></div></div>
                    <div class="rounded-md border border-slate-700 bg-slate-900/50 p-3"><div class="flex items-center justify-between"><FieldLabel label="TX checksum" hint={hints.tx_checksum} /><Switch checked={iface.tx_checksum} onCheckedChange={(value) => (settings.interfaces[index].tx_checksum = value)} /></div></div>
                    <div class="rounded-md border border-slate-700 bg-slate-900/50 p-3"><div class="flex items-center justify-between"><FieldLabel label="TSO" hint={hints.tso} /><Switch checked={iface.tso} onCheckedChange={(value) => (settings.interfaces[index].tso = value)} /></div></div>
                    <div class="rounded-md border border-slate-700 bg-slate-900/50 p-3"><div class="flex items-center justify-between"><FieldLabel label="GSO" hint={hints.gso} /><Switch checked={iface.gso} onCheckedChange={(value) => (settings.interfaces[index].gso = value)} /></div></div>
                    <div class="rounded-md border border-slate-700 bg-slate-900/50 p-3"><div class="flex items-center justify-between"><FieldLabel label="GRO" hint={hints.gro} /><Switch checked={iface.gro} onCheckedChange={(value) => (settings.interfaces[index].gro = value)} /></div></div>
                    <div class="rounded-md border border-slate-700 bg-slate-900/50 p-3"><div class="flex items-center justify-between"><FieldLabel label="LRO" hint={hints.lro} /><Switch checked={iface.lro} onCheckedChange={(value) => (settings.interfaces[index].lro = value)} /></div></div>
                    <div class="rounded-md border border-slate-700 bg-slate-900/50 p-3"><div class="flex items-center justify-between"><FieldLabel label="Ntuple filters" hint={hints.ntuple_filters} /><Switch checked={iface.ntuple_filters} onCheckedChange={(value) => (settings.interfaces[index].ntuple_filters = value)} /></div></div>
                    <div class="rounded-md border border-slate-700 bg-slate-900/50 p-3"><div class="flex items-center justify-between"><FieldLabel label="Flow director" hint={hints.flow_director} /><Switch checked={iface.flow_director} onCheckedChange={(value) => (settings.interfaces[index].flow_director = value)} /></div></div>
                    <div class="rounded-md border border-slate-700 bg-slate-900/50 p-3"><div class="flex items-center justify-between"><FieldLabel label="Adaptive coalescing" hint={hints.adaptive_coalescing} /><Switch checked={iface.adaptive_coalescing} onCheckedChange={(value) => (settings.interfaces[index].adaptive_coalescing = value)} /></div></div>
                  </div>

                  <div class="grid gap-3 md:grid-cols-4">
                    <div>
                      <FieldLabel label="RX ring size" hint={hints.rx_ring_size} />
                      <Input class="mt-1 border-slate-700 bg-slate-950 text-slate-200" value={iface.rx_ring_size ?? ''} oninput={(event) => (settings.interfaces[index].rx_ring_size = parseNullable((event.currentTarget as HTMLInputElement).value))} />
                    </div>
                    <div>
                      <FieldLabel label="TX ring size" hint={hints.tx_ring_size} />
                      <Input class="mt-1 border-slate-700 bg-slate-950 text-slate-200" value={iface.tx_ring_size ?? ''} oninput={(event) => (settings.interfaces[index].tx_ring_size = parseNullable((event.currentTarget as HTMLInputElement).value))} />
                    </div>
                    <div>
                      <FieldLabel label="RX coalesce usec" hint={hints.rx_coalesce_usecs} />
                      <Input class="mt-1 border-slate-700 bg-slate-950 text-slate-200" value={iface.rx_coalesce_usecs ?? ''} oninput={(event) => (settings.interfaces[index].rx_coalesce_usecs = parseNullable((event.currentTarget as HTMLInputElement).value))} />
                    </div>
                    <div>
                      <FieldLabel label="TX coalesce usec" hint={hints.tx_coalesce_usecs} />
                      <Input class="mt-1 border-slate-700 bg-slate-950 text-slate-200" value={iface.tx_coalesce_usecs ?? ''} oninput={(event) => (settings.interfaces[index].tx_coalesce_usecs = parseNullable((event.currentTarget as HTMLInputElement).value))} />
                    </div>
                    <div>
                      <FieldLabel label="RX queue count" hint={hints.rx_queue_count} />
                      <Input class="mt-1 border-slate-700 bg-slate-950 text-slate-200" value={iface.rx_queue_count ?? ''} oninput={(event) => (settings.interfaces[index].rx_queue_count = parseNullable((event.currentTarget as HTMLInputElement).value))} />
                    </div>
                    <div>
                      <FieldLabel label="TX queue count" hint={hints.tx_queue_count} />
                      <Input class="mt-1 border-slate-700 bg-slate-950 text-slate-200" value={iface.tx_queue_count ?? ''} oninput={(event) => (settings.interfaces[index].tx_queue_count = parseNullable((event.currentTarget as HTMLInputElement).value))} />
                    </div>
                    <div>
                      <FieldLabel label="NUMA pinning" hint={hints.numa_node} />
                      <Select.Root type="single" value={String(iface.numa_node ?? -1)} onValueChange={(value) => {
                        if (!value) return;
                        settings.interfaces[index].numa_node = Number(value) === -1 ? -1 : Number(value);
                      }}>
                        <Select.Trigger class="mt-1 w-full border-slate-700 bg-slate-950 text-slate-200">
                          <span>{numaOptions.find(o => o.value === String(iface.numa_node ?? -1))?.label ?? String(iface.numa_node ?? -1)}</span>
                        </Select.Trigger>
                        <Select.Content class="border-slate-700 bg-slate-900 text-slate-100">
                          {#each numaOptions as option}
                            <Select.Item value={option.value} label={option.label} class="text-slate-200 hover:bg-slate-800" />
                          {/each}
                        </Select.Content>
                      </Select.Root>
                    </div>
                  </div>
                </div>
              {/each}
            {/if}
          </div>
        {/if}
      </div>

      <div class="rounded-lg border border-slate-700">
        <button type="button" class="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-slate-200 hover:bg-slate-800/30" onclick={() => (showAdvanced = !showAdvanced)}>
          <span>{$_('hw_offload.performance_status')}</span>
          {#if showAdvanced}
            <ChevronDown class="h-4 w-4 text-slate-500" />
          {:else}
            <ChevronRight class="h-4 w-4 text-slate-500" />
          {/if}
        </button>
        {#if showAdvanced}
          <div class="space-y-3 border-t border-slate-700 p-4">
            <div class="flex items-center gap-2 text-cyan-300">
              <Gauge class="h-4 w-4" />
              <FieldLabel label="Runtime performance snapshot" hint={hints.status} />
            </div>
            <div class="rounded-md border border-slate-700 bg-slate-900/50 p-3">
              <p class="text-sm text-slate-200">Global enabled: {String(status.global_enabled ?? false)}</p>
              <p class="mt-1 text-xs text-slate-400">XDP mode: {String(status.xdp_mode ?? '-')} | eBPF offload available: {String(status.ebpf_offload_available ?? '-')}</p>
            </div>
            <div class="space-y-2">
              {#each asList(status.interfaces ?? []) as row, idx (idx)}
                {@const item = asObject(row)}
                <div class="rounded-md border border-slate-700 bg-slate-900/40 p-3 text-sm text-slate-200">
                  <p>{String(item.interface ?? `iface-${idx}`)} - status: {String(item.status ?? '-')}</p>
                  <p class="mt-1 text-xs text-slate-400">RX: {String(item.rx_offload ?? '-')} | TX: {String(item.tx_offload ?? '-')} | TSO: {String(item.tso ?? '-')} | GRO: {String(item.gro ?? '-')} | LRO: {String(item.lro ?? '-')}</p>
                </div>
              {/each}
            </div>
          </div>
        {/if}
      </div>

      <div class="flex justify-end">
        <Button class="bg-cyan-600 text-white hover:bg-cyan-700" onclick={saveSettings} disabled={saving || loading}>
          <Save class="mr-1.5 h-3.5 w-3.5" />
          {saving ? 'Saving...' : 'Save Hardware Offload'}
        </Button>
      </div>
    </CardContent>
  </Card>
</div>
