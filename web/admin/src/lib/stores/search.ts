/**
 * State store utilities for search within the ezNGFW admin frontend.
 */

import type { Component } from 'svelte';
import { writable } from 'svelte/store';
import { navGroups } from '$lib/config/navigation';

/** Reactive query text for the global header search input. */
export const globalSearch = writable('');

/**
 * Flattened navigation entry used by fuzzy matching in the sidebar search
 * and command palette. Extend this type when search results need more UI
 * metadata (for example, badges or access-control hints).
 */
export type NavSearchItem = {
  title: string;
  path: string;
  icon: Component;
  breadcrumb: string;
  keywords: string[];
  haystack: string;
};

/**
 * Optional keyword expansion map for navigation titles.
 *
 * This improves discoverability when operators search by domain language
 * that does not appear verbatim in the menu title. Add synonyms here when
 * introducing a new page or when users commonly search with alternate terms.
 */
const searchKeywordsByTitle: Record<string, string[]> = {
  Dashboard: ['overview', 'status', 'widgets', 'health', 'summary'],
  Monitoring: ['metrics', 'telemetry', 'graphs', 'performance', 'usage'],
  'Audit Log': ['events', 'history', 'compliance', 'tracking', 'logs'],
  Netdata: ['charts', 'realtime', 'system stats', 'telemetry', 'agent'],

  Interfaces: ['ethernet', 'nic', 'network card', 'adapter', 'ports'],
  Overview: ['summary', 'status', 'inventory', 'links', 'interfaces'],
  Assignments: ['mapping', 'zone binding', 'port roles', 'uplink', 'lan'],
  Devices: ['hardware', 'ports', 'link state', 'mtu', 'drivers'],
  Neighbors: ['arp', 'ndp', 'lldp', 'adjacency', 'discovery'],
  'Virtual IPs': ['vip', 'alias', 'failover ip', 'secondary ip', 'floating ip'],
  VLANs: ['vlan', '802.1q', 'tagging', 'trunk', 'subinterface'],
  'WAN / Uplink': ['internet', 'uplink', 'isp', 'gateway', 'egress'],
  Zones: ['segmentation', 'trust zones', 'lan', 'wan', 'policy domains'],
  Firewall: ['rules', 'filter', 'iptables', 'nftables', 'block'],
  NAT: ['port forwarding', 'masquerade', 'snat', 'dnat', 'translation'],
  DNS: ['resolver', 'unbound', 'nameserver', 'domain', 'records'],
  DHCP: ['lease', 'pool', 'reservation', 'kea', 'scope'],
  DHCPv6: ['ipv6 lease', 'prefix delegation', 'stateful', 'slaac', 'kea'],
  IPv6: ['dual stack', 'ra', 'ndp', 'prefix', 'addressing'],

  'Security Settings': ['hardening', 'policy', 'threat protection', 'baseline', 'security'],
  'IDS/IPS': ['suricata', 'snort', 'intrusion', 'detection', 'prevention'],
  DPI: ['deep packet inspection', 'application control', 'l7', 'traffic classification', 'visibility'],
  'TLS Inspection': ['ssl', 'https', 'certificate interception', 'decrypt', 'mitm'],
  Certificates: ['pki', 'x509', 'ca', 'csr', 'tls certs'],

  Routing: ['ospf', 'bgp', 'static route', 'gateway', 'next hop'],
  VPN: ['wireguard', 'openvpn', 'tunnel', 'tailscale', 'remote access'],

  'High Availability': ['ha', 'failover', 'cluster', 'sync', 'redundancy'],
  Users: ['accounts', 'rbac', 'roles', 'authentication', 'admins'],
  Backup: ['restore', 'snapshot', 'export', 'disaster recovery', 'config backup'],
  ACME: ['lets encrypt', 'certbot', 'automatic certs', 'challenge', 'renewal'],
  'Dynamic DNS': ['ddns', 'hostname', 'dns update', 'provider', 'ip sync'],
  Plugins: ['extensions', 'packages', 'modules', 'addons', 'integrations'],
  'Hardware Offload': ['offload', 'acceleration', 'npu', 'flowtable', 'performance'],
  Diagnostics: ['troubleshooting', 'tests', 'logs', 'ping', 'trace'],
  System: ['settings', 'hostname', 'time', 'updates', 'services']
};

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function buildHaystack(
  title: string,
  path: string,
  breadcrumb: string,
  keywords: string[]
): string {
  return [title, path, breadcrumb, ...keywords].map(normalize).join(' ');
}

function prettyGroupTitle(groupTitle: string): string {
  return groupTitle
    .toLowerCase()
    .split('&')
    .map((part) =>
      part
        .trim()
        .split(/\s+/)
        .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
        .join(' ')
    )
    .join(' & ');
}

function buildIndex(): NavSearchItem[] {
  const results: NavSearchItem[] = [];

  for (const group of navGroups) {
    const groupLabel = prettyGroupTitle(group.title);

    const visit = (item: { title: string; path: string; icon: Component; children?: typeof group.items }, trail: string[]) => {
      // Store a preformatted breadcrumb string so matching and rendering can
      // reuse the same value without rebuilding it on each keystroke.
      const breadcrumb = [groupLabel, ...trail, item.title].join(' > ');
      const keywords = searchKeywordsByTitle[item.title] ?? [];
      results.push({
        title: item.title,
        path: item.path,
        icon: item.icon,
        breadcrumb,
        keywords,
        haystack: buildHaystack(item.title, item.path, breadcrumb, keywords)
      });

      if (item.children) {
        for (const child of item.children) {
          visit(child, [...trail, item.title]);
        }
      }
    };

    for (const item of group.items) {
      visit(item, []);
    }
  }

  return results;
}

/**
 * Precomputed searchable navigation index derived from static nav groups.
 *
 * This is built once at module load to keep search calls cheap while typing.
 */
export const navSearchIndex = buildIndex();

/**
 * Search navigation entries using fuzzy, term-based ranking.
 *
 * How it works:
 * - Normalizes the query and splits it into terms.
 * - Requires every term to exist somewhere in the prebuilt `haystack`.
 * - Scores matches with weighted boosts for title, path, breadcrumb, and
 *   augmented keywords.
 * - Returns top-ranked items up to `limit` for dropdown/palette rendering.
 *
 * To tune relevance, adjust the score weights in this function or expand
 * `searchKeywordsByTitle` for new terminology.
 */
export function searchNavigation(query: string, limit = 8): NavSearchItem[] {
  const normalizedQuery = normalize(query);
  if (!normalizedQuery) return [];

  const terms = normalizedQuery.split(/\s+/).filter(Boolean);

  return navSearchIndex
    .filter((item) => terms.every((term) => item.haystack.includes(term)))
    .map((item) => {
      let score = 0;
      const title = normalize(item.title);
      const breadcrumb = normalize(item.breadcrumb);
      const path = normalize(item.path);
      const keywords = item.keywords.map(normalize);

      if (title.startsWith(normalizedQuery)) score += 60;
      if (title.includes(normalizedQuery)) score += 30;
      if (path.includes(normalizedQuery)) score += 20;
      if (breadcrumb.includes(normalizedQuery)) score += 10;

      for (const term of terms) {
        if (title.includes(term)) score += 15;
        if (path.includes(term)) score += 8;
        if (breadcrumb.includes(term)) score += 5;
        if (keywords.some((keyword) => keyword.includes(term))) score += 10;
      }

      return { item, score };
    })
    .sort((a, b) => b.score - a.score || a.item.title.localeCompare(b.item.title))
    .slice(0, limit)
    .map(({ item }) => item);
}
