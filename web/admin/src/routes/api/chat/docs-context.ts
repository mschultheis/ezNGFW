/**
 * Comprehensive ezNGFW documentation context injected into the AI assistant's
 * system prompt.  Covers product architecture, all features, GUI navigation
 * paths, common configuration workflows, API reference, and troubleshooting.
 *
 * Keep this file up-to-date whenever features or navigation change.
 */

export const EZNGFW_DOCS_CONTEXT = `
# ezNGFW Documentation Context

## Product Overview
ezNGFW is an enterprise Next-Generation Firewall OS built in Rust on Linux with eBPF/XDP acceleration.
Every feature is configurable via the Admin GUI, REST API (300+ endpoints), and CLI (40+ subcommands).
The OS runs on x86_64/AMD64 and ARM64 hardware (including NanoPi R5S).

## Architecture
- **Data Plane (Fast Path)**: eBPF/XDP for line-rate L2-L4 packet processing, flow tracking, and basic ACLs.
- **Slow Path**: Userspace L7 DPI (nDPI/Suricata), IDS/IPS signature matching, TLS ClientHello inspection.
- **Control Plane**: Rust + Tokio async runtime, Axum REST API, configuration persistence.
- **Admin GUI**: SvelteKit 5 + Tailwind CSS + shadcn-svelte, mobile-responsive.
- **External Packages (via Alpine apk)**: Unbound DNS, ISC Kea DHCP 3.x, Suricata 8.x, FRRouting, Netdata.

## GUI Navigation Structure
The admin GUI sidebar is organized into these sections:

### Monitoring
- **Dashboard** (/dashboard) — Real-time overview: interfaces, flows, blocked packets, uptime (Xd Xh Xm format)
- **Traffic** (/traffic) — Per-interface throughput charts, protocol distribution
- **Firewall Log** (/firewall/log) — Real-time and historical firewall events
- **Firewall States** (/firewall/states) — Live connection state table

### Network
- **Interfaces** — Sub-menus: Assignments (/interfaces/assignments), Devices (/interfaces), Neighbors (/interfaces/neighbors), Virtual IPs (/interfaces/virtual-ips), VLANs (/vlans)
- **Bonds / LACP** — Sub-menus: WAN Bonds (/bonds/wan), LAN Bonds (/bonds/lan) — 802.3ad link aggregation for both WAN uplinks and LAN interfaces
- **Zones** (/zones) — Zone-based policy enforcement (LAN, WAN, DMZ, custom)
- **DHCP** — Sub-menus: Server Settings (/dhcp), Pools (/dhcp/pools), Reservations (/dhcp/reservations), Leases (/dhcp/leases), Custom Options (/dhcp/options), DHCPv6 (/dhcp/dhcpv6)
  - Backend selection: choose between Kea DHCP and dnsmasq
- **DNS** — Sub-menus: Resolver (/dns), Host Overrides (/dns/hosts), Domain Overrides (/dns/domains), Aliases (/dns/aliases)
  - Unbound-based recursive resolver with DNSSEC, DoH, DoT
- **Dynamic DNS** (/dyndns) — Cloudflare, Namecheap, DuckDNS, No-IP, custom providers

### Firewall
- **Rules** (/firewall/rules) — Ordered rules with src/dst IP, port, protocol, zone, schedule. Actions: Pass, Block, Reject. Filterable/sortable table with multi-select bulk operations.
- **NAT** — Sub-menus: Rules (/nat/rules), Translations (/nat/translations)
  - SNAT, DNAT, Masquerade, 1:1 NAT, NAT Reflection
- **SNI Filter** (/firewall/sni-filter) — Block applications via TLS ClientHello SNI inspection without TLS decryption or client certificates. Supports QUIC blocking and ECH/ESNI handling.

### Security
- **IDS/IPS** — Sub-menus: Settings (/ids), Rules (/ids/rules), Alerts (/ids/alerts), Profiles (/ids/profiles)
  - Suricata-based with inline and passive modes
- **DPI** (/dpi) — L7 protocol identification, per-app/category policies
- **TLS Inspection** (/tls-inspection) — SSL/TLS forward proxy, bypass rules, minimum TLS version
- **URL Filter** (/url-filter) — 80+ URL categories, custom whitelist/blacklist
- **Web Proxy** (/web-proxy) — Transparent/explicit HTTP/HTTPS proxy with caching
- **WAF** (/waf) — Web Application Firewall with OWASP CRS
- **Threat Intel** (/threat-intel) — STIX/TAXII feed ingestion
- **Antivirus** (/antivirus) — ClamAV-based scanning
- **Sandbox** (/sandbox) — File detonation with verdicts

### Routing & VPN
- **Static Routes** (/routing/static)
- **Policy Routing** (/routing/policy)
- **FRR** (/routing/frr) — BGP, OSPF, IS-IS, RIP via FRRouting
- **WireGuard** (/vpn/wireguard) — Peers, PSK generation, QR codes for mobile
- **OpenVPN** (/vpn/openvpn) — Client/server modes
- **IPsec** — Sub-menus: Tunnels (/ipsec/tunnels), Pools (/ipsec/pools)
- **Tailscale** (/vpn/tailscale) — Mesh VPN integration

### Traffic Shaping
- **Pipes** (/shaper/pipes) — Bandwidth limiters (Dummynet)
- **Queues** (/shaper/queues) — Weighted fair queuing
- **Rules** (/shaper/rules) — Match rules binding traffic to pipes/queues
- Algorithms: HFSC, CBQ, PRIQ, PIE (RFC 8033), CAKE, FQ-CoDel
- CAKE bandwidth with selectable units (Kbit/s, Mbit/s, Gbit/s)

### Platform
- **General** (/settings) — Hostname, domain, timezone, DNS servers
- **Users** (/users) — Local users with roles (admin, operator, viewer)
- **API Keys** (/api-keys) — Programmatic access tokens
- **AAA** (/aaa) — RADIUS, LDAP, TACACS+, 802.1X, SSO/OAuth2/OIDC
- **Certificates** — Sub-menus: Store (/certificates/store), ACME (/acme)
- **Backup** (/backup) — Config export/import, scheduled backups
- **Firmware** (/firmware) — Upload, install, rollback firmware with changelog, reboot-required flags
- **High Availability** (/ha) — Active/Passive and Active/Active HA, CARP VIPs, state sync
- **Monitoring** (/monitoring) — SNMP, NetFlow/sFlow/IPFIX, Netdata (embedded or standalone)
- **Plugins** (/plugins) — Install/manage add-on packages
- **Syslog** — Sub-menus: Settings (/syslog/settings), Targets (/syslog/targets)
- **NTP** (/ntp) — Built-in NTP server
- **Cron** (/cron) — Scheduled tasks
- **Diagnostics** (/diagnostics) — Ping, traceroute, DNS lookup, port test, ARP table, routing table
- **Hardware Offload** (/hw-offload) — eBPF/XDP, DPDK, Intel Flow Director
- **AI Assistant** (/ai-settings) — Configure AI provider, API key, model, MCP server URL
- **Captive Portal** (/captive-portal) — Portal zones, voucher system, session management

### ZTNA
- **Policies** (/ztna/policies) — Zero Trust Network Access per user/device/app
- **Device Posture** (/ztna/posture) — Compliance checks before granting access

## Common Configuration Workflows

### Setting Up a Firewall Rule
1. Navigate to Firewall → Rules (/firewall/rules)
2. Click "Add Rule" button in the ResourceTable toolbar
3. Fill in: Action (Pass/Block/Reject), Protocol, Source (IP/CIDR/Zone), Destination, Port, Description
4. Optionally set a schedule for time-based rules
5. Click Save — rule is staged
6. Click "Apply Changes" in the apply bar to activate
7. Confirm within 60 seconds (safe mode) or changes auto-revert

### Configuring DHCP Server
1. Navigate to Network → DHCP → Server Settings (/dhcp)
2. Select backend: Kea DHCP or dnsmasq
3. Enable DHCP for desired interface using the toggle switch
4. Set range start/end, default gateway, DNS servers, lease time
5. Add static reservations under DHCP → Reservations
6. Apply changes

### Setting Up WireGuard VPN
1. Navigate to Routing & VPN → WireGuard (/vpn/wireguard)
2. Click "Add Peer"
3. Fill in: Name, Public Key, Endpoint, Allowed IPs, Persistent Keepalive
4. Use "Generate PSK" button for preshared key
5. Save — QR code is automatically generated for mobile clients
6. Apply changes

### Configuring Multi-WAN Load Balancing
1. Navigate to Network → Bonds/LACP → WAN Bonds (/bonds/wan) for link aggregation, OR
2. Set up multiple WAN interfaces under Interfaces
3. Configure WAN health checks (ICMP/HTTP/DNS probes)
4. Choose load balancing mode: Failover, Round Robin, Weighted, Latency-Based, Spillover, or Bandwidth-Based
5. Set sticky sessions if needed for connection persistence

### Enabling IDS/IPS
1. Navigate to Security → IDS/IPS → Settings (/ids)
2. Enable Suricata in inline or passive mode
3. Select rulesets to enable
4. Configure alert thresholds
5. Monitor alerts under IDS/IPS → Alerts (/ids/alerts)

### Configuring SNI-Based Application Blocking
1. Navigate to Firewall → SNI Filter (/firewall/sni-filter)
2. Add domains/patterns to block (e.g., *.tiktok.com, *.facebook.com)
3. Enable QUIC blocking to prevent TLS-over-UDP bypass
4. Optionally configure ECH/ESNI handling
5. No TLS decryption or client certificates required

### Setting Up Dynamic Routing (BGP)
1. Navigate to Routing & VPN → FRR (/routing/frr)
2. Enable BGP and set local AS number
3. Add BGP neighbors with remote AS, IP, and authentication
4. Configure route redistribution (connected, static, OSPF)
5. Set up prefix lists and route maps for filtering

### Firmware Updates
1. Navigate to Platform → Firmware (/firmware)
2. Check for available updates (shows changelog and reboot-required flag)
3. Download and install update
4. Monitor progress bar
5. Reboot if required

## Safe Mode / Config Rollback
When you click "Apply Changes", a 60-second countdown starts. If you don't confirm within 60 seconds (e.g., you got locked out by a bad config change), the configuration automatically reverts to the previous state. This prevents permanent lockouts.

## API Reference
- Base URL: http://<firewall-ip>:8080/api
- Authentication: POST /api/auth/login with username/password → returns Bearer token
- All endpoints require Authorization: Bearer <token> header (except /api/auth/login and /api/metrics)
- Rate limit: 600 requests/minute per client IP
- Full OpenAPI 3.0 spec available at /docs/openapi.json

### Key API Endpoints
- GET /api/status — System status (uptime, flows, blocked packets)
- GET /api/rules — Firewall rules
- POST /api/rules — Create firewall rule
- GET /api/interfaces — Interface configuration
- GET /api/dhcp — DHCP settings
- GET /api/dns — DNS settings
- GET /api/vpn/wireguard — WireGuard config
- GET /api/nat — NAT rules
- GET /api/routing/table — Routing table
- GET /api/ids/alerts — IDS alerts
- GET /api/config/export — Export full config
- POST /api/config/import — Import config

## Troubleshooting

### Cannot Access Admin GUI
- Verify the firewall process is running
- Check that the anti-lockout rule is enabled (Platform → General → Anti-Lockout checkbox)
- Try accessing via the management interface IP on port 8080
- Check firewall rules aren't blocking management traffic

### DHCP Not Working
- Verify DHCP is enabled for the interface (toggle switch must be ON)
- Check that the interface has a static IP in the DHCP subnet
- Verify address pool range doesn't conflict with static reservations
- Check DHCP service status under DHCP → Service Status

### VPN Tunnel Not Connecting
- For WireGuard: verify peer public keys match on both sides, check allowed IPs, ensure UDP port is open
- For IPsec: verify Phase 1/2 proposals match, check pre-shared key, review IKE logs
- For OpenVPN: verify certificates are valid, check TLS version compatibility

### IDS Alerts but No Blocking
- IDS may be in passive mode — switch to inline mode for active blocking
- Check that the IDS profile is applied to the correct interface
- Verify rule actions are set to "drop" not just "alert"

### DNS Resolution Failing
- Check Unbound service status
- Verify upstream DNS servers are configured and reachable
- Check for DNS sinkhole rules that might be blocking legitimate domains
- Verify DNSSEC isn't rejecting responses from unsigned zones

## Default Credentials
- Username: admin
- Password: admin
- Management port: 8080
- IMPORTANT: Change password and enable MFA immediately after first login
`;
