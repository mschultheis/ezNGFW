/**
 * Sidebar navigation tree definition.
 *
 * Declares every nav group (Monitoring, Network, Security, Routing & VPN,
 * Platform) and their menu items with Lucide icons and route paths.
 * Items may contain `children` for expandable sub-menus (e.g.
 * Interfaces → Assignments, Devices, Neighbors, Virtual IPs, VLANs).
 *
 * Also exports `getPageTitle()` used by the Header to display the current
 * page name, and `navItems` — a flat array for search/matching.
 */
import type { Component } from 'svelte';
import Activity from '@lucide/svelte/icons/activity';
import BarChart3 from '@lucide/svelte/icons/bar-chart-3';
import LayoutList from '@lucide/svelte/icons/layout-list';
import Cable from '@lucide/svelte/icons/cable';
import HardDrive from '@lucide/svelte/icons/hard-drive';
import UsersRound from '@lucide/svelte/icons/users-round';
import Layers from '@lucide/svelte/icons/layers';
import Waypoints from '@lucide/svelte/icons/waypoints';
import Router from '@lucide/svelte/icons/router';
import ShieldEllipsis from '@lucide/svelte/icons/shield-ellipsis';
import ShieldCheck from '@lucide/svelte/icons/shield-check';
import Map from '@lucide/svelte/icons/map';
import FolderLock from '@lucide/svelte/icons/folder-lock';
import Server from '@lucide/svelte/icons/server';
import Globe from '@lucide/svelte/icons/globe';
import Shield from '@lucide/svelte/icons/shield';
import ShieldAlert from '@lucide/svelte/icons/shield-alert';
import Radar from '@lucide/svelte/icons/radar';
import Lock from '@lucide/svelte/icons/lock';
import Gauge from '@lucide/svelte/icons/gauge';
import Wifi from '@lucide/svelte/icons/wifi';
import FileText from '@lucide/svelte/icons/file-text';
import Clock from '@lucide/svelte/icons/clock';
import KeyRound from '@lucide/svelte/icons/key-round';
import Route from '@lucide/svelte/icons/route';
import Users from '@lucide/svelte/icons/users';
import DatabaseBackup from '@lucide/svelte/icons/database-backup';
import BadgeCheck from '@lucide/svelte/icons/badge-check';
import Cpu from '@lucide/svelte/icons/cpu';
import Stethoscope from '@lucide/svelte/icons/stethoscope';
import Cog from '@lucide/svelte/icons/cog';
import Plug from '@lucide/svelte/icons/plug';
import ChartSpline from '@lucide/svelte/icons/chart-spline';
import Logs from '@lucide/svelte/icons/logs';
import GitBranch from '@lucide/svelte/icons/git-branch';
import RefreshCw from '@lucide/svelte/icons/refresh-cw';
import Bot from '@lucide/svelte/icons/bot';
import ArrowRightLeft from '@lucide/svelte/icons/arrow-right-left';
import Smartphone from '@lucide/svelte/icons/smartphone';

/**
 * Single navigation entry.
 *
 * Use `children` for nested sub-sections. Keep `path` unique across the
 * tree because route title/section lookups match by exact path.
 */
export type NavItem = {
  title: string;
  path: string;
  icon: Component;
  children?: NavItem[];
};

/**
 * Sidebar group container.
 *
 * The UI renders groups in array order, so place high-frequency sections
 * earlier in this list.
 */
export type NavGroup = {
  title: string;
  items: NavItem[];
};

/**
 * Complete sidebar navigation tree: groups -> items -> optional children.
 *
 * Extension pattern:
 * - add a new `NavGroup` for a new top-level category,
 * - or append an item/child to an existing group,
 * - then ensure the corresponding SvelteKit route exists.
 */
export const navGroups: NavGroup[] = [
  {
    title: 'MONITORING',
    items: [
      { title: 'Dashboard', path: '/', icon: Activity },
      { title: 'Monitoring', path: '/monitoring', icon: ChartSpline },
      { title: 'Audit Log', path: '/audit', icon: Logs },
      { title: 'Netdata', path: '/netdata', icon: BarChart3 }
    ]
  },
  {
    title: 'NETWORK',
    items: [
      {
        title: 'Interfaces',
        path: '/interfaces',
        icon: ShieldEllipsis,
        children: [
          { title: 'Overview', path: '/interfaces', icon: LayoutList },
          { title: 'Assignments', path: '/interfaces/assignments', icon: Cable },
          { title: 'Devices', path: '/interfaces/devices', icon: HardDrive },
          { title: 'Neighbors', path: '/interfaces/neighbors', icon: UsersRound },
          { title: 'Virtual IPs', path: '/interfaces/vips', icon: Layers },
          { title: 'VLANs', path: '/vlans', icon: Waypoints },
          { title: 'LAN Bonds', path: '/bonds/lan', icon: Cable }
        ]
      },
      {
        title: 'WAN / Uplink',
        path: '/wans',
        icon: Router,
        children: [
          { title: 'WAN Settings', path: '/wans', icon: Router },
          { title: 'SD-WAN', path: '/sdwan', icon: Route },
          { title: 'WAN Bonds', path: '/bonds', icon: Cable }
        ]
      },
      { title: 'Zones', path: '/zones', icon: ShieldEllipsis },
      {
        title: 'Firewall',
        path: '/firewall',
        icon: ShieldCheck,
        children: [
          { title: 'Rules', path: '/firewall/rules', icon: LayoutList },
          { title: 'App Control', path: '/firewall/app-control', icon: Radar },
          { title: 'SNI Filter', path: '/firewall/sni-filter', icon: Shield },
          { title: 'States', path: '/firewall/states', icon: Activity },
          { title: 'Log', path: '/firewall/log', icon: Logs },
          { title: 'Inter-Zone', path: '/firewall/interzone', icon: Waypoints }
        ]
      },
      {
        title: 'NAT',
        path: '/nat',
        icon: Map,
        children: [
          { title: 'Rules', path: '/nat/rules', icon: LayoutList },
          { title: 'Stats', path: '/nat/stats', icon: BarChart3 },
          { title: 'Translations', path: '/nat/translations', icon: Waypoints }
        ]
      },
      {
        title: 'Traffic Shaper',
        path: '/shaper',
        icon: Gauge,
        children: [
          { title: 'Pipes', path: '/shaper/pipes', icon: Gauge },
          { title: 'Queues', path: '/shaper/queues', icon: LayoutList },
          { title: 'HFSC', path: '/shaper/hfsc', icon: GitBranch },
          { title: 'CBQ', path: '/shaper/cbq', icon: Layers },
          { title: 'PRIQ', path: '/shaper/priq', icon: Route },
          { title: 'PIE (AQM)', path: '/shaper/pie', icon: ChartSpline },
          { title: 'CAKE', path: '/shaper/cake', icon: Layers },
          { title: 'App QoS', path: '/shaper/app-qos', icon: Radar },
          { title: 'Rules', path: '/shaper/rules', icon: Shield }
        ]
      },
      {
        title: 'DNS',
        path: '/dns',
        icon: FolderLock,
        children: [
          { title: 'Settings', path: '/dns/settings', icon: Cog },
          { title: 'Host Overrides', path: '/dns/hosts', icon: Server },
          { title: 'Domain Overrides', path: '/dns/domains', icon: Globe },
          { title: 'Aliases', path: '/dns/aliases', icon: Layers },
          { title: 'Statistics', path: '/dns/statistics', icon: BarChart3 },
          { title: 'Status', path: '/dns/status', icon: BadgeCheck }
        ]
      },
      {
        title: 'DHCP',
        path: '/dhcp',
        icon: Server,
        children: [
          { title: 'Settings', path: '/dhcp/settings', icon: Cog },
          { title: 'Pools', path: '/dhcp/pools', icon: Layers },
          { title: 'Reservations', path: '/dhcp/reservations', icon: UsersRound },
          { title: 'Custom Options', path: '/dhcp/options', icon: LayoutList },
          { title: 'Leases', path: '/dhcp/leases', icon: Activity },
          { title: 'DHCPv6', path: '/dhcp/dhcpv6', icon: Globe },
          { title: 'Status', path: '/dhcp/status', icon: BadgeCheck },
          { title: 'Relay', path: '/dhcp/relay', icon: ArrowRightLeft },
        ]
      },
      {
        title: 'Captive Portal',
        path: '/captive-portal',
        icon: Wifi,
        children: [
          { title: 'Zones', path: '/captive-portal/zones', icon: LayoutList },
          { title: 'Vouchers', path: '/captive-portal/vouchers', icon: BadgeCheck },
          { title: 'Sessions', path: '/captive-portal/sessions', icon: Activity }
        ]
      },
      { title: 'IPv6', path: '/ipv6', icon: Globe }
    ]
  },
  {
    title: 'SECURITY',
    items: [
      { title: 'Security Settings', path: '/security', icon: Shield },
      {
        title: 'IDS/IPS',
        path: '/ids',
        icon: ShieldAlert,
        children: [
          { title: 'Overview', path: '/ids/overview', icon: LayoutList },
          { title: 'Settings', path: '/ids/settings', icon: Cog },
          { title: 'Alerts', path: '/ids/alerts', icon: ShieldAlert },
          { title: 'Status', path: '/ids/status', icon: BadgeCheck }
        ]
      },
      { title: 'DPI', path: '/dpi', icon: Radar },
      { title: 'TLS Inspection', path: '/tls', icon: Lock },
      {
        title: 'Certificates',
        path: '/certificates',
        icon: KeyRound,
        children: [
          { title: 'Certificate Store', path: '/certificates/store', icon: KeyRound },
          { title: 'Internal CA', path: '/certificates/ca', icon: ShieldCheck }
        ]
      }
    ]
  },
  {
    title: 'SECURITY SERVICES',
    items: [
      { title: 'URL Filtering', path: '/url-filter', icon: FolderLock },
      { title: 'Web Proxy', path: '/web-proxy', icon: Server },
      { title: 'Threat Intelligence', path: '/threat-intel', icon: ShieldAlert },
      { title: 'Antivirus', path: '/antivirus', icon: ShieldCheck },
      { title: 'WAF', path: '/waf', icon: Shield },
      { title: 'Sandbox', path: '/sandbox', icon: Activity }
    ]
  },
  {
    title: 'SERVICES',
    items: [
      { title: 'NTP', path: '/ntp', icon: Clock },
      { title: 'Wake-on-LAN', path: '/wol', icon: Wifi },
      { title: 'UPnP / NAT-PMP', path: '/upnp', icon: Globe },
      {
        title: 'AAA / Authentication',
        path: '/aaa',
        icon: UsersRound,
        children: [
          { title: 'Overview', path: '/aaa', icon: LayoutList },
          { title: 'RADIUS', path: '/aaa/radius', icon: Server },
          { title: 'LDAP', path: '/aaa/ldap', icon: FolderLock },
          { title: 'TACACS+', path: '/aaa/tacacs', icon: KeyRound },
          { title: '802.1X', path: '/aaa/dot1x', icon: ShieldCheck }
        ]
      }
    ]
  },
  {
    title: 'AUTOMATION',
    items: [
      {
        title: 'Automation',
        path: '/automation',
        icon: Cog,
        children: [
          { title: 'Overview', path: '/automation', icon: LayoutList },
          { title: 'NETCONF', path: '/automation/netconf', icon: Server },
          { title: 'Terraform', path: '/automation/terraform', icon: GitBranch },
          { title: 'Ansible', path: '/automation/ansible', icon: Plug },
          { title: 'ZTP', path: '/automation/ztp', icon: BadgeCheck }
        ]
      }
    ]
  },
  {
    title: 'ZERO TRUST',
    items: [
      {
        title: 'ZTNA',
        path: '/ztna',
        icon: ShieldCheck,
        children: [
          { title: 'Overview', path: '/ztna', icon: LayoutList },
          { title: 'Policies', path: '/ztna/policies', icon: ShieldEllipsis },
          { title: 'Posture Checks', path: '/ztna/posture', icon: Activity },
          { title: 'Identity Providers', path: '/ztna/providers', icon: UsersRound }
        ]
      }
    ]
  },
  {
    title: 'ROUTING & VPN',
    items: [
      {
        title: 'Routing',
        path: '/routing',
        icon: Route,
        children: [
          { title: 'Static Routes', path: '/routing/static', icon: Route },
          { title: 'OSPF', path: '/routing/ospf', icon: Radar },
          { title: 'OSPFv3', path: '/routing/ospfv3', icon: Radar },
          { title: 'IS-IS', path: '/routing/isis', icon: GitBranch },
          { title: 'RIP', path: '/routing/rip', icon: Route },
          { title: 'BGP', path: '/routing/bgp', icon: GitBranch },
          { title: 'VRF', path: '/routing/vrf', icon: Layers },
          { title: 'Access Lists', path: '/routing/acl', icon: ShieldCheck },
          { title: 'VRRP', path: '/routing/vrrp', icon: BadgeCheck },
          { title: 'Policy Routes', path: '/routing/policy', icon: ShieldCheck },
          { title: 'Routing Table', path: '/routing/table', icon: LayoutList },
          { title: 'Status', path: '/routing/status', icon: BadgeCheck }
        ]
      },
      {
        title: 'VPN',
        path: '/vpn',
        icon: Shield,
        children: [
          { title: 'WireGuard', path: '/vpn/wireguard', icon: Shield },
          { title: 'OpenVPN', path: '/vpn/openvpn', icon: Lock },
          { title: 'Tailscale', path: '/vpn/tailscale', icon: Globe },
          { title: 'L2TP/IPsec', path: '/vpn/l2tp', icon: Lock },
          { title: 'SSTP', path: '/vpn/sstp', icon: Shield },
          { title: 'GRE', path: '/vpn/gre', icon: Route },
          { title: 'VXLAN', path: '/vpn/vxlan', icon: Layers },
          { title: 'DMVPN', path: '/vpn/dmvpn', icon: Waypoints },
          { title: 'VTI', path: '/vpn/vti', icon: GitBranch },
          { title: 'SSL Portal', path: '/vpn/ssl-portal', icon: Globe },
          { title: 'Provisioning', path: '/vpn/provisioning', icon: FileText }
        ]
      },
      {
        title: 'IPsec',
        path: '/ipsec',
        icon: Lock,
        children: [
          { title: 'Tunnels', path: '/ipsec/tunnels', icon: Lock },
          { title: 'Status', path: '/ipsec/status', icon: Activity },
          { title: 'Address Pools', path: '/ipsec/pools', icon: Layers },
          { title: 'Mobile Clients', path: '/ipsec/mobile', icon: Smartphone },
        ]
      }
    ]
  },
  {
    title: 'PLATFORM',
    items: [
      { title: 'High Availability', path: '/ha', icon: GitBranch },
      { title: 'Users', path: '/users', icon: Users },
      { title: 'Backup', path: '/backup', icon: DatabaseBackup },
      { title: 'ACME', path: '/acme', icon: BadgeCheck },
      { title: 'Dynamic DNS', path: '/dyndns', icon: Globe },
      { title: 'AI Assistant', path: '/system/ai', icon: Bot },
      { title: 'Firmware Updates', path: '/system/updates', icon: RefreshCw },
      {
        title: 'Plugins',
        path: '/plugins',
        icon: Plug,
        children: [
          { title: 'Installed', path: '/plugins/installed', icon: Plug },
          { title: 'Available', path: '/plugins/available', icon: LayoutList },
          { title: 'Settings', path: '/plugins/settings', icon: Cog }
        ]
      },
      { title: 'Hardware Offload', path: '/hw-offload', icon: Cpu },
      {
        title: 'Syslog',
        path: '/syslog',
        icon: FileText,
        children: [
          { title: 'Settings', path: '/syslog/settings', icon: Cog },
          { title: 'Remote Targets', path: '/syslog/targets', icon: Globe },
          { title: 'Log Viewer', path: '/syslog/viewer', icon: Activity }
        ]
      },
      { title: 'Scheduled Tasks', path: '/cron', icon: Clock },
      {
        title: 'Diagnostics',
        path: '/diagnostics',
        icon: Stethoscope,
        children: [
          { title: 'Ping', path: '/diagnostics/ping', icon: Activity },
          { title: 'Traceroute', path: '/diagnostics/traceroute', icon: Route },
          { title: 'DNS Lookup', path: '/diagnostics/dns', icon: FolderLock },
          { title: 'Port Test', path: '/diagnostics/port', icon: Plug },
          { title: 'ARP Table', path: '/diagnostics/arp', icon: UsersRound },
          { title: 'Routes', path: '/diagnostics/routes', icon: Map }
        ]
      },
      { title: 'System', path: '/system', icon: Cog }
    ]
  }
];

/** Recursively flatten a nested NavItem tree into a flat array for search. */
function flattenItems(items: NavItem[]): NavItem[] {
  return items.flatMap((item) => [item, ...(item.children ? flattenItems(item.children) : [])]);
}

/** Flat array of all navigation items (including children) for search/matching. */
export const navItems = flattenItems(navGroups.flatMap((group) => group.items));

/** Look up the display title for a given URL pathname, falling back to 'ezNGFW'. */
export function getPageTitle(pathname: string): string {
  const matched = navItems.find((item) => item.path === pathname);
  return matched?.title ?? 'ezNGFW';
}

/** Returns the parent section name for a given pathname (e.g. "Network", "Security"). */
export function getPageSection(pathname: string): string {
  for (const group of navGroups) {
    for (const item of group.items) {
      if (item.path === pathname) return group.title;
      if (item.children) {
        for (const child of item.children) {
          if (child.path === pathname) return group.title;
          if (child.children) {
            for (const gc of child.children) {
              if (gc.path === pathname) return group.title;
            }
          }
        }
      }
    }
  }
  return 'Enterprise Threat Management';
}
