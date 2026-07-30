/** Browser-local mock API for the ezNGFW static demo build. */
import { browser } from '$app/environment';

const STATE_KEY = 'ezngfw_demo_state';

interface DemoState {
	firewallRules: Record<string, unknown>[];
	natRules: Record<string, unknown>[];
	natTranslations: Record<string, unknown>[];
	fwNextId: number;
	natNextId: number;
}

export function isDemoMode(): boolean {
	if (!browser) return false;
	if (localStorage.getItem('ezngfw_demo_mode') === '1') return true;
	return new URLSearchParams(window.location.search).has('demo');
}

export function enableDemoMode(): void {
	if (browser) localStorage.setItem('ezngfw_demo_mode', '1');
}

export function disableDemoMode(): void {
	if (!browser) return;
	localStorage.removeItem('ezngfw_demo_mode');
	localStorage.removeItem('ezngfw_token');
}

function defaultState(): DemoState {
	return {
		firewallRules: [
			{ id: 'fw-1', sequence: 100, action: 'pass', interface: 'lan', direction: 'in', ipprotocol: 'ipv4', protocol: 'tcp', source: '10.0.0.0/8', destination: 'any', dest_port: '443', quick: true, log: false, description: 'Allow HTTPS from internal' },
			{ id: 'fw-2', sequence: 200, action: 'pass', interface: 'lan', direction: 'in', ipprotocol: 'ipv4', protocol: 'udp', source: '10.0.0.0/8', destination: 'any', dest_port: '53', quick: true, log: false, description: 'Allow DNS from internal' },
			{ id: 'fw-3', sequence: 300, action: 'block', interface: 'wan', direction: 'in', ipprotocol: 'ipv4', protocol: 'tcp', source: 'any', destination: 'any', dest_port: '22', quick: false, log: true, description: 'Block SSH from WAN' }
		],
		natRules: [
			{ id: 'nat-1', position: 10, nat_type: 'snat', protocol: 'any', in_interface: 'lan0', out_interface: 'wan0', src_cidr: '10.0.0.0/24', dst_cidr: '0.0.0.0/0', translated_ip: '203.0.113.2', description: 'SNAT LAN to WAN', enabled: true },
			{ id: 'nat-2', position: 20, nat_type: 'dnat', protocol: 'tcp', in_interface: 'wan0', out_interface: 'lan0', src_cidr: 'any', dst_cidr: '203.0.113.2/32', dst_port: '443', translated_ip: '192.168.1.10', translated_port: '443', description: 'DNAT HTTPS to server', enabled: true },
			{ id: 'nat-3', position: 30, nat_type: 'one-to-one', protocol: 'any', in_interface: 'lan0', out_interface: 'wan0', src_cidr: '10.0.1.50/32', dst_cidr: '0.0.0.0/0', translated_ip: '203.0.113.50', description: '1:1 NAT internal host to public IPv4', enabled: false },
			{ id: 'nat-4', position: 40, nat_type: 'nptv6', protocol: 'any', in_interface: 'lan0', out_interface: 'wan0', ipv6_src_prefix: 'fd00:100::/48', ipv6_dst_prefix: '2001:db8:100::/48', description: 'NPTv6 site prefix translation', enabled: true },
			{ id: 'nat-5', position: 50, nat_type: 'nat64', protocol: 'any', in_interface: 'lan0', out_interface: 'wan0', src_cidr: 'fd00:64::/64', dst_cidr: '64:ff9b::/96', translated_ip: '198.51.100.10', description: 'NAT64 IPv6 clients to IPv4 upstream', enabled: true }
		],
		natTranslations: [
			{ protocol: 'tcp', origSrc: '10.0.0.15:48000', origDst: '8.8.8.8:443', transSrc: '203.0.113.2:58000', transDst: '8.8.8.8:443', state: 'ESTABLISHED', age: '142s' }
		],
		fwNextId: 4,
		natNextId: 6
	};
}

function loadState(): DemoState {
	if (!browser) return defaultState();
	try {
		const raw = localStorage.getItem(STATE_KEY);
		if (raw) return JSON.parse(raw) as DemoState;
	} catch {
		// reset corrupt demo state
	}
	const state = defaultState();
	localStorage.setItem(STATE_KEY, JSON.stringify(state));
	return state;
}

function saveState(state: DemoState): void {
	if (browser) localStorage.setItem(STATE_KEY, JSON.stringify(state));
}

function body(opts?: RequestInit): Record<string, unknown> {
	if (!opts?.body) return {};
	try { return JSON.parse(opts.body as string); } catch { return {}; }
}

export async function demoRequest<T>(path: string, opts?: RequestInit): Promise<T> {
	const method = opts?.method ?? 'GET';
	const state = loadState();

	if (path === '/system/initialized') return { initialized: true } as T;
	if (path === '/version') return { version: '2.1.0-demo' } as T;
	if (path === '/auth/me') return { username: 'demo', role: 'admin', permissions: ['admin'] } as T;
	if (path === '/auth/sso') return {} as T;
	if (path === '/auth/login' && method === 'POST') {
		const b = body(opts);
		if (b.username === 'demo' && b.password === 'demo') return { token: 'demo-auth-token', role: 'admin' } as T;
		throw new Error('Invalid credentials');
	}

	if (path === '/status') return { interfacesUp: 2, activeFlows: 1420, blockedPackets: 37, uptime: 86400, haStatus: 'primary', cpu: 23, memory: 47 } as T;
	if (path === '/interfaces') return [
		{ name: 'lan0', identifier: 'LAN', description: 'Primary LAN', enabled: true, ipv4_address: '192.168.1.1', ipv4_subnet: 24, mtu: 1500 },
		{ name: 'wan0', identifier: 'WAN', description: 'Primary WAN', enabled: true, ipv4_address: '203.0.113.2', ipv4_subnet: 30, mtu: 1500 }
	] as T;

	if (path === '/firewall/rules' && method === 'GET') return [...state.firewallRules] as T;
	if (path === '/firewall/rules' && method === 'POST') {
		const rule = { id: `fw-${state.fwNextId++}`, ...body(opts) };
		state.firewallRules.push(rule); saveState(state); return rule as T;
	}
	const fw = path.match(/^\/firewall\/rules\/(.+)$/);
	if (fw) {
		const id = decodeURIComponent(fw[1]);
		if (method === 'DELETE') state.firewallRules = state.firewallRules.filter((r) => String(r.id) !== id);
		else state.firewallRules = state.firewallRules.map((r) => String(r.id) === id ? { ...r, ...body(opts) } : r);
		saveState(state); return { ok: true } as T;
	}

	if (path === '/nat' && method === 'GET') return [...state.natRules] as T;
	if (path === '/nat' && method === 'POST') {
		const rule = { id: `nat-${state.natNextId++}`, ...body(opts) };
		state.natRules.push(rule); saveState(state); return rule as T;
	}
	const nat = path.match(/^\/nat\/(.+)$/);
	if (nat && nat[1] !== 'stats' && nat[1] !== 'translations') {
		const id = decodeURIComponent(nat[1]);
		if (method === 'DELETE') state.natRules = state.natRules.filter((r) => String(r.id) !== id);
		else state.natRules = state.natRules.map((r) => String(r.id) === id ? { ...r, ...body(opts) } : r);
		saveState(state); return { ok: true } as T;
	}
	if (path === '/nat/stats') return { snat: 1, dnat: 1, one_to_one: 1, nptv6: 1, nat64: 1, total_rules: state.natRules.length } as T;
	if (path === '/nat/translations') return [...state.natTranslations] as T;

	if (path === '/ids/alerts') return [
		{ id: 'alert-1', timestamp: '2026-07-30T10:23:15Z', severity: 'high', signature: 'ET SQL Injection Attempt', source: '185.220.101.42', destination: '192.168.1.10', protocol: 'TCP', port: 80, action: 'blocked', acknowledged: false }
	] as T;
	if (path === '/ids/stats') return { enabled: true, mode: 'ips', rules_loaded: 4120, alerts_total: 1 } as T;
	if (path === '/vpn') return { wireguard_enabled: true, ipsec_enabled: false, tunnel_count: 1 } as T;
	if (path === '/ha/status') return { role: 'primary', peer: { address: '192.168.1.2', sync_state: 'in-sync' } } as T;
	if (path === '/tls/stats') return { enabled: false } as T;
	if (path === '/zones/stats') return { zone_names: ['LAN', 'WAN'], count: 2 } as T;
	if (path === '/dpi/stats') return { enabled: true, protocols: [{ protocol: 'HTTPS', value: 72 }, { protocol: 'DNS', value: 28 }] } as T;
	if (path === '/system/config') return { hostname: 'ezngfw-demo', domain: 'demo.local', timezone: 'UTC', language: 'en' } as T;
	if (path === '/system/validation') return { schema: 'ok', runtime: 'ok', pending: 0, errors: 0 } as T;
	if (path === '/system/firmware') return { currentVersion: '2.1.0-demo', buildDate: '2026-07-30' } as T;

	if (method === 'GET') return {} as T;
	return { ok: true } as T;
}
