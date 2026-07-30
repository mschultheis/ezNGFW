<!-- Route view for `/wizard` in the ezNGFW admin GUI. -->

<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { base } from '$app/paths';
  import { api } from '$lib/api/client';
  import FieldLabel from '$lib/components/admin/FieldLabel.svelte';
  import { toasts } from '$lib/stores/toast';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { Switch } from '$lib/components/ui/switch';
  import * as Select from '$lib/components/ui/select';
  import * as Collapsible from '$lib/components/ui/collapsible';
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '$lib/components/ui/card';
  import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
  import RefreshCwIcon from '@lucide/svelte/icons/refresh-cw';
  import { _ } from '$lib/i18n';

  type WizardStep =
    | 'welcome'
    | 'admin'
    | 'network'
    | 'dns'
    | 'security'
    | 'services'
    | 'review'
    | 'apply';

  type SelectOption = {
    label: string;
    value: string;
  };

  const steps: WizardStep[] = ['welcome', 'admin', 'network', 'dns', 'security', 'services', 'review', 'apply'];

  const stepMeta: Record<WizardStep, { title: string; description: string }> = {
    welcome: {
      title: 'Welcome',
      description: 'Review setup goals and deployment assumptions before changing any runtime values.'
    },
    admin: {
      title: 'Administrator',
      description: 'Create initial administrator credentials and baseline management identity details.'
    },
    network: {
      title: 'Network Topology',
      description: 'Bind WAN/LAN interfaces and define initial local addressing defaults.'
    },
    dns: {
      title: 'DNS and Time',
      description: 'Configure name resolution and timezone settings for consistent policy behavior.'
    },
    security: {
      title: 'Security Defaults',
      description: 'Enable baseline hardening controls and management guardrails for first boot.'
    },
    services: {
      title: 'Core Services',
      description: 'Set defaults for update cadence, telemetry, and management visibility features.'
    },
    review: {
      title: 'Review Plan',
      description: 'Confirm all values before applying irreversible initialization settings.'
    },
    apply: {
      title: 'Apply Setup',
      description: 'Submit setup payload and transition appliance into initialized mode.'
    }
  };

  const timezoneOptions: SelectOption[] = [
    { label: 'UTC', value: 'UTC' },
    { label: 'America/New_York', value: 'America/New_York' },
    { label: 'America/Chicago', value: 'America/Chicago' },
    { label: 'America/Denver', value: 'America/Denver' },
    { label: 'America/Los_Angeles', value: 'America/Los_Angeles' },
    { label: 'Europe/London', value: 'Europe/London' },
    { label: 'Europe/Berlin', value: 'Europe/Berlin' },
    { label: 'Europe/Paris', value: 'Europe/Paris' },
    { label: 'Asia/Tokyo', value: 'Asia/Tokyo' },
    { label: 'Asia/Singapore', value: 'Asia/Singapore' },
    { label: 'Australia/Sydney', value: 'Australia/Sydney' }
  ];

  const updateChannelOptions: SelectOption[] = [
    { label: 'Stable', value: 'stable' },
    { label: 'Security', value: 'security' },
    { label: 'Beta', value: 'beta' }
  ];

  const managementAccessOptions: SelectOption[] = [
    { label: 'LAN only', value: 'lan_only' },
    { label: 'LAN + VPN', value: 'lan_vpn' },
    { label: 'All Interfaces (temporary)', value: 'all_temp' }
  ];

  const notes = [
    'Treat this wizard as your baseline contract for day-two operations. Strong defaults reduce firefighting later and shorten hardening windows.',
    'Use deterministic hostnames and clear descriptions because these values propagate to logs, monitoring, and support runbooks.',
    'Keep WAN and LAN interface assignments explicit and validated against physical topology. Incorrect interface binding is one of the highest impact setup errors.',
    'Prefer least-privilege management exposure from day one. Expanding access later is safer than trying to close overly open defaults under pressure.',
    'Set update channels that match operational maturity. Stable for production, security for faster patch response, beta only for controlled labs.',
    'Enable NTP and trustworthy DNS early to avoid certificate and policy timing anomalies. Clock drift causes subtle, high-cost failures.',
    'Use multi-factor and brute-force protections where possible. Initial setup is the best moment to enforce security posture.',
    'Document emergency fallback values in descriptions and review notes so responders can recover quickly during outages.',
    'Before applying, validate all high-impact fields in Review and ensure there is a rollback communication plan in place.',
    'After apply completes, confirm login, DNS resolution, interface reachability, and update feed status before handing over.'
  ];

  let currentStep = $state<WizardStep>('welcome');
  let showNotes = $state(false);
  let showAdvancedSecurity = $state(false);
  let showAdvancedServices = $state(false);

  let loadingInterfaces = $state(false);
  let interfaces = $state<SelectOption[]>([
    { label: 'eth0', value: 'eth0' },
    { label: 'eth1', value: 'eth1' }
  ]);

  let submitting = $state(false);
  let applyResult = $state('');

  let hostname = $state('ezngfw');
  let domain = $state('lan.local');
  let adminUser = $state('admin');
  let adminPassword = $state('');
  let adminPasswordConfirm = $state('');
  let adminEmail = $state('admin@example.com');

  let wanInterface = $state('eth0');
  let lanInterface = $state('eth1');
  let lanSubnet = $state('192.168.1.0/24');
  let lanGateway = $state('192.168.1.1');
  let mtu = $state(1500);
  let enableDhcpServer = $state(true);
  let dhcpStart = $state('192.168.1.100');
  let dhcpEnd = $state('192.168.1.199');

  let dnsServers = $state('1.1.1.1,9.9.9.9');
  let fallbackDnsServers = $state('8.8.8.8,1.0.0.1');
  let timezone = $state('UTC');
  let ntpServers = $state('time.cloudflare.com,time.google.com');
  let dnsOverTls = $state(false);

  let blockPrivateWan = $state(true);
  let blockBogonWan = $state(true);
  let sshEnabled = $state(false);
  let sshPort = $state(22);
  let forceMfa = $state(false);
  let lockoutThreshold = $state(10);
  let managementAccess = $state('lan_only');

  let updateChannel = $state('stable');
  let autoUpdates = $state(true);
  let telemetryEnabled = $state(false);
  let crashReports = $state(false);
  let enableWireGuard = $state(false);
  let enableCaptivePortal = $state(false);
  let enableSuricata = $state(false);
  let setupDescription = $state('Initial deployment through guided wizard');

  const stepIndex = $derived(steps.indexOf(currentStep));
  const progressPercent = $derived(Math.round(((stepIndex + 1) / steps.length) * 100));

  function stepLabel(step: WizardStep): string {
    return stepMeta[step].title;
  }

  function isCurrent(step: WizardStep): boolean {
    return currentStep === step;
  }

  function splitComma(value: string): string[] {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }

  function jump(index: number) {
    const bounded = Math.max(0, Math.min(index, steps.length - 1));
    currentStep = steps[bounded];
  }

  function nextStep() {
    jump(stepIndex + 1);
  }

  function previousStep() {
    jump(stepIndex - 1);
  }

  function validateHostname(value: string): boolean {
    return /^[a-zA-Z0-9][a-zA-Z0-9-]*$/.test(value);
  }

  function validateCidr(value: string): boolean {
    return /^\d{1,3}(\.\d{1,3}){3}\/\d{1,2}$/.test(value);
  }

  function validateIp(value: string): boolean {
    return /^\d{1,3}(\.\d{1,3}){3}$/.test(value);
  }

  function validateCurrentStep(): string {
    if (currentStep === 'admin') {
      if (!adminUser.trim()) return 'Administrator username is required.';
      if (!validateHostname(hostname)) return 'Hostname may only contain letters, numbers, and dash, and must start alphanumeric.';
      if (!adminEmail.includes('@')) return 'Administrator email must contain @ and a valid domain part.';
      if (adminPassword.length < 12) return 'Administrator password must be at least 12 characters for baseline security posture.';
      if (adminPassword !== adminPasswordConfirm) return 'Password confirmation does not match administrator password.';
    }

    if (currentStep === 'network') {
      if (!wanInterface || !lanInterface) return 'Select both WAN and LAN interfaces before continuing.';
      if (wanInterface === lanInterface) return 'WAN and LAN interfaces must be different physical or logical interfaces.';
      if (!validateCidr(lanSubnet)) return 'LAN subnet must be valid CIDR format. Example: 192.168.1.0/24.';
      if (!validateIp(lanGateway)) return 'LAN gateway must be valid IPv4 format. Example: 192.168.1.1.';
      if (mtu < 576 || mtu > 9200) return 'MTU must be between 576 and 9200 bytes.';
      if (enableDhcpServer && (!validateIp(dhcpStart) || !validateIp(dhcpEnd))) {
        return 'DHCP start and end addresses must be valid IPv4 values when DHCP server is enabled.';
      }
    }

    if (currentStep === 'dns') {
      if (splitComma(dnsServers).length === 0) return 'At least one primary DNS server is required.';
      if (!timezone.trim()) return 'Timezone selection is required for logs and scheduled tasks.';
      if (splitComma(ntpServers).length === 0) return 'At least one NTP server is required to prevent time drift.';
    }

    if (currentStep === 'security') {
      if (sshEnabled && (sshPort < 1 || sshPort > 65535)) return 'SSH port must be between 1 and 65535 when SSH access is enabled.';
      if (lockoutThreshold < 3 || lockoutThreshold > 50) return 'Lockout threshold must be between 3 and 50 failed attempts.';
    }

    return '';
  }

  async function loadInterfaces() {
    loadingInterfaces = true;
    try {
      const payload = await api.get('/interfaces');
      const list = Array.isArray(payload) ? payload : [];
      const mapped = list
        .map((entry) => {
          if (typeof entry === 'string') return { label: entry, value: entry };
          const src = (entry as Record<string, unknown>) ?? {};
          const value = String(src.name ?? src.id ?? src.interface ?? src.device ?? '').trim();
          if (!value) return null;
          const label = String(src.description ?? src.label ?? value).trim() || value;
          return { label, value };
        })
        .filter((entry): entry is SelectOption => entry !== null);

      if (mapped.length > 0) {
        interfaces = mapped;
        if (!interfaces.some((item) => item.value === wanInterface)) wanInterface = interfaces[0].value;
        if (!interfaces.some((item) => item.value === lanInterface)) lanInterface = interfaces[1]?.value ?? interfaces[0].value;
      }
    } catch {
      interfaces = [
        { label: 'eth0', value: 'eth0' },
        { label: 'eth1', value: 'eth1' }
      ];
    } finally {
      loadingInterfaces = false;
    }
  }

  async function applySetup() {
    const validation = validateCurrentStep();
    if (validation) {
      toasts.error(validation);
      return;
    }

    submitting = true;
    applyResult = '';

    try {
      const payload = {
        hostname,
        domain,
        adminUser,
        adminPassword,
        adminEmail,
        wanInterface,
        lanInterface,
        lanSubnet,
        lanGateway,
        mtu,
        enableDhcpServer,
        dhcpRange: {
          start: dhcpStart,
          end: dhcpEnd
        },
        dnsServers: splitComma(dnsServers),
        fallbackDnsServers: splitComma(fallbackDnsServers),
        timezone,
        ntpServers: splitComma(ntpServers),
        dnsOverTls,
        blockPrivateWan,
        blockBogonWan,
        sshEnabled,
        sshPort,
        forceMfa,
        lockoutThreshold,
        managementAccess,
        updateChannel,
        autoUpdates,
        telemetryEnabled,
        crashReports,
        enableWireGuard,
        enableCaptivePortal,
        enableSuricata,
        setupDescription
      };

      await api.post('/system/setup', payload);
      applyResult = 'Setup completed successfully. Redirecting to login...';
      toasts.success($_('wizard.toastinitial_deployment_setup_complete'));
      setTimeout(() => {
        void goto(base + '/login');
      }, 1200);
    } catch (error) {
      applyResult = error instanceof Error ? error.message : 'Setup failed due to an unexpected error.';
      toasts.error(applyResult);
    } finally {
      submitting = false;
    }
  }

  onMount(() => {
    void loadInterfaces();
  });
</script>

<div class="min-h-screen bg-slate-950 p-4 text-slate-100 md:p-8">
  <div class="mx-auto max-w-6xl space-y-6">
    <Card class="border-slate-700 bg-slate-900/95">
      <CardHeader class="space-y-4">
        <CardTitle class="text-2xl text-cyan-400">{$_('wizard.initial_deployment_wizard')}</CardTitle>
        <CardDescription class="text-slate-300">{$_('wizard.guided_firstboot_setup_with_deep_configuration_opt')}</CardDescription>

        <div class="space-y-2 rounded-md border border-slate-700 bg-slate-950/70 p-3">
          <div class="flex items-center justify-between text-xs text-slate-400">
            <span>{$_('wizard.progress')}</span>
            <span>{progressPercent}%</span>
          </div>
          <div class="h-2 w-full rounded-full bg-slate-800">
            <div class="h-2 rounded-full bg-cyan-500 transition-all" style={`width: ${progressPercent}%`}></div>
          </div>
        </div>

        <div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
          {#each steps as step, index}
            <button
              type="button"
              class={`rounded-md border px-2 py-2 text-xs font-semibold uppercase tracking-wide transition-colors ${isCurrent(step)
                ? 'border-cyan-400 bg-cyan-500/20 text-cyan-200'
                : index < stepIndex
                  ? 'border-cyan-700 bg-cyan-900/30 text-cyan-300'
                  : 'border-slate-700 bg-slate-950 text-slate-400 hover:bg-slate-900'}`}
              onclick={() => jump(index)}
              disabled={submitting}
            >
              {stepLabel(step)}
            </button>
          {/each}
        </div>

        <div class="flex flex-wrap gap-2">
          <Button variant="outline" class="border-slate-700 text-slate-200 hover:bg-slate-800" onclick={() => void loadInterfaces()}>
            <RefreshCwIcon class="mr-2 h-4 w-4" />Refresh Interfaces
          </Button>
        </div>
      </CardHeader>
    </Card>

    <Card class="border-slate-700 bg-slate-900/95">
      <CardHeader>
        <CardTitle class="text-cyan-400">{stepMeta[currentStep].title}</CardTitle>
        <CardDescription class="text-slate-300">{stepMeta[currentStep].description}</CardDescription>
      </CardHeader>
      <CardContent class="space-y-5">
        {#if currentStep === 'welcome'}
          <section class="space-y-4 rounded-md border border-slate-700 bg-slate-950/70 p-4">
            <p class="text-sm text-slate-300">
              This wizard initializes your appliance with secure defaults for identity, networking, management access, and core services.
              You can still fine-tune details later, but selecting strong baseline values now dramatically reduces follow-up rework.
            </p>
            <p class="text-sm text-slate-300">
              Review runbook notes below before proceeding. They reflect common first-boot pitfalls seen in production deployments.
            </p>

            <Collapsible.Root bind:open={showNotes} class="rounded-md border border-slate-700 bg-slate-900/70 p-4">
              <Collapsible.Trigger class="flex w-full items-center justify-between text-left text-sm font-medium text-slate-200">
                Open deployment notes
                <ChevronDownIcon class={`h-4 w-4 text-cyan-400 transition-transform ${showNotes ? 'rotate-180' : ''}`} />
              </Collapsible.Trigger>
              <Collapsible.Content class="pt-3">
                <ul class="space-y-2 text-sm text-slate-300">
                  {#each notes as note}
                    <li class="rounded-md border border-slate-700 bg-slate-950/60 px-3 py-2">{note}</li>
                  {/each}
                </ul>
              </Collapsible.Content>
            </Collapsible.Root>
          </section>
        {/if}

        {#if currentStep === 'admin'}
          <section class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <div class="space-y-2">
              <FieldLabel label="Hostname" hint="System hostname used across logs, certificates, and monitoring labels. Use a short deterministic value like edge-fw-01 so support teams can identify this node quickly. Avoid spaces and special characters." />
              <Input class="border-slate-700 bg-slate-950" value={hostname} oninput={(event) => (hostname = (event.currentTarget as HTMLInputElement).value)} />
            </div>

            <div class="space-y-2">
              <FieldLabel label="Domain" hint="Domain suffix joined with hostname for FQDN generation and service announcements. Use internal DNS suffixes like corp.local or branch.example.net as appropriate. Keep this aligned with resolver search domains." />
              <Input class="border-slate-700 bg-slate-950" value={domain} oninput={(event) => (domain = (event.currentTarget as HTMLInputElement).value)} />
            </div>

            <div class="space-y-2">
              <FieldLabel label="Administrator Username" hint="Primary admin account used for first login and break-glass operations. Keep it simple but controlled, and avoid generic names in shared environments. The default admin is fine when combined with strong password and MFA." />
              <Input class="border-slate-700 bg-slate-950" value={adminUser} oninput={(event) => (adminUser = (event.currentTarget as HTMLInputElement).value)} />
            </div>

            <div class="space-y-2">
              <FieldLabel label="Administrator Email" hint="Contact address used for alerts, certificate notices, and operational notifications. Use a team mailbox rather than personal inbox when possible. This prevents missed alerts during staff turnover." />
              <Input class="border-slate-700 bg-slate-950" value={adminEmail} oninput={(event) => (adminEmail = (event.currentTarget as HTMLInputElement).value)} />
            </div>

            <div class="space-y-2">
              <FieldLabel label="Administrator Password" hint="Strong password for initial account and emergency console operations. Use at least 12 characters with mixed symbols and avoid reused credentials. Rotate according to your organization policy after onboarding." />
              <Input class="border-slate-700 bg-slate-950" type="password" value={adminPassword} oninput={(event) => (adminPassword = (event.currentTarget as HTMLInputElement).value)} />
            </div>

            <div class="space-y-2">
              <FieldLabel label="Confirm Password" hint="Confirmation check to avoid accidental lockout from typo during first setup. This must exactly match the administrator password entered above. Always verify before moving to the next step." />
              <Input class="border-slate-700 bg-slate-950" type="password" value={adminPasswordConfirm} oninput={(event) => (adminPasswordConfirm = (event.currentTarget as HTMLInputElement).value)} />
            </div>
          </section>
        {/if}

        {#if currentStep === 'network'}
          <section class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <div class="space-y-2">
              <FieldLabel label="WAN Interface" hint="External-facing interface used for internet or upstream provider traffic. Select the physical port connected to upstream edge equipment. Wrong WAN assignment can isolate management access." />
              <Select.Root type="single" value={wanInterface} onValueChange={(value) => { if (value) wanInterface = value; }}>
                <Select.Trigger class="w-full border-slate-700 bg-slate-950 text-slate-100"><span>{interfaces.find((item) => item.value === wanInterface)?.label ?? wanInterface}</span></Select.Trigger>
                <Select.Content class="border-slate-700 bg-slate-950">
                  {#each interfaces as option}
                    <Select.Item value={option.value} label={option.label} class="text-slate-200 hover:bg-slate-800" />
                  {/each}
                </Select.Content>
              </Select.Root>
            </div>

            <div class="space-y-2">
              <FieldLabel label="LAN Interface" hint="Internal interface serving trusted users and management access by default. Choose the port connected to your primary internal switch or virtual segment. Keep LAN and WAN interfaces distinct at all times." />
              <Select.Root type="single" value={lanInterface} onValueChange={(value) => { if (value) lanInterface = value; }}>
                <Select.Trigger class="w-full border-slate-700 bg-slate-950 text-slate-100"><span>{interfaces.find((item) => item.value === lanInterface)?.label ?? lanInterface}</span></Select.Trigger>
                <Select.Content class="border-slate-700 bg-slate-950">
                  {#each interfaces as option}
                    <Select.Item value={option.value} label={option.label} class="text-slate-200 hover:bg-slate-800" />
                  {/each}
                </Select.Content>
              </Select.Root>
            </div>

            <div class="space-y-2 rounded-md border border-slate-700 bg-slate-950/70 p-3 text-xs text-slate-300">
              {loadingInterfaces ? 'Discovering interfaces from backend...' : `${interfaces.length} interface option(s) available`}
            </div>

            <div class="space-y-2">
              <FieldLabel label="LAN Subnet" hint="Local network CIDR assigned to the LAN interface. Example values include 192.168.1.0/24 or 10.20.0.0/24 based on your addressing plan. Ensure no overlap with VPN or branch routes." />
              <Input class="border-slate-700 bg-slate-950" value={lanSubnet} oninput={(event) => (lanSubnet = (event.currentTarget as HTMLInputElement).value)} />
            </div>

            <div class="space-y-2">
              <FieldLabel label="LAN Gateway Address" hint="Local gateway IP served by the firewall on LAN for client default route. This should be within the selected LAN subnet and usually uses .1. Keep consistent with DHCP options and documentation." />
              <Input class="border-slate-700 bg-slate-950" value={lanGateway} oninput={(event) => (lanGateway = (event.currentTarget as HTMLInputElement).value)} />
            </div>

            <div class="space-y-2">
              <FieldLabel label="MTU" hint="Maximum frame size on interface paths. Standard Ethernet uses 1500 while tunnels or provider overlays may require lower values. Validate with PMTU-aware tests when adjusting from default." />
              <Input class="border-slate-700 bg-slate-950" type="number" value={mtu} oninput={(event) => (mtu = Number((event.currentTarget as HTMLInputElement).value || 0))} />
            </div>

            <div class="space-y-2">
              <FieldLabel label="Enable DHCP Server" hint="Automatically serves DHCP leases to LAN clients using configured address pool. Enable for standard branch and office deployments where clients need automatic addressing. Disable when external DHCP already exists." />
              <div class="flex h-10 items-center gap-3 rounded-md border border-slate-700 bg-slate-950 px-3">
                <Switch checked={enableDhcpServer} onCheckedChange={(value) => (enableDhcpServer = value)} />
                <span class="text-xs text-slate-300">{enableDhcpServer ? 'Enabled' : 'Disabled'}</span>
              </div>
            </div>

            <div class="space-y-2">
              <FieldLabel label="DHCP Range Start" hint="First dynamic address in DHCP pool for LAN clients. Keep lower addresses reserved for infrastructure and static assignments. Example: 192.168.1.100 for typical office networks." />
              <Input class="border-slate-700 bg-slate-950" value={dhcpStart} oninput={(event) => (dhcpStart = (event.currentTarget as HTMLInputElement).value)} disabled={!enableDhcpServer} />
            </div>

            <div class="space-y-2">
              <FieldLabel label="DHCP Range End" hint="Last dynamic address in DHCP lease pool. Ensure end is within subnet and greater than start to avoid invalid pool definitions. Example: 192.168.1.199 for a 100-address pool." />
              <Input class="border-slate-700 bg-slate-950" value={dhcpEnd} oninput={(event) => (dhcpEnd = (event.currentTarget as HTMLInputElement).value)} disabled={!enableDhcpServer} />
            </div>
          </section>
        {/if}

        {#if currentStep === 'dns'}
          <section class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <div class="space-y-2 md:col-span-2">
              <FieldLabel label="Primary DNS Servers" hint="Comma-separated resolver list used for outbound lookups and client defaults where appropriate. Prefer reliable resolvers reachable from WAN and internal overlays. Example: 1.1.1.1,9.9.9.9." />
              <Input class="border-slate-700 bg-slate-950" value={dnsServers} oninput={(event) => (dnsServers = (event.currentTarget as HTMLInputElement).value)} />
            </div>

            <div class="space-y-2 md:col-span-2">
              <FieldLabel label="Fallback DNS Servers" hint="Secondary resolver list used when primary resolvers fail health checks. Keep independent providers where possible to avoid shared outages. Example: 8.8.8.8,1.0.0.1." />
              <Input class="border-slate-700 bg-slate-950" value={fallbackDnsServers} oninput={(event) => (fallbackDnsServers = (event.currentTarget as HTMLInputElement).value)} />
            </div>

            <div class="space-y-2">
              <FieldLabel label="Timezone" hint="System timezone for logs, schedules, and compliance timestamp interpretation. Choose the primary operations region to reduce analyst confusion. UTC remains a strong option for globally distributed teams." />
              <Select.Root type="single" value={timezone} onValueChange={(value) => { if (value) timezone = value; }}>
                <Select.Trigger class="w-full border-slate-700 bg-slate-950 text-slate-100"><span>{timezone}</span></Select.Trigger>
                <Select.Content class="border-slate-700 bg-slate-950">
                  {#each timezoneOptions as option}
                    <Select.Item value={option.value} label={option.label} class="text-slate-200 hover:bg-slate-800" />
                  {/each}
                </Select.Content>
              </Select.Root>
            </div>

            <div class="space-y-2 md:col-span-2">
              <FieldLabel label="NTP Servers" hint="Comma-separated time sources used to keep appliance clock synchronized. Accurate time is critical for certificates, logs, and security policy enforcement. Example: time.cloudflare.com,time.google.com." />
              <Input class="border-slate-700 bg-slate-950" value={ntpServers} oninput={(event) => (ntpServers = (event.currentTarget as HTMLInputElement).value)} />
            </div>

            <div class="space-y-2">
              <FieldLabel label="Enable DNS-over-TLS" hint="Enables encrypted DNS forwarding to upstream resolvers that support TLS. Improves privacy and integrity on untrusted paths but requires compatible resolver endpoints. Validate bootstrap and certificate trust behavior." />
              <div class="flex h-10 items-center gap-3 rounded-md border border-slate-700 bg-slate-950 px-3">
                <Switch checked={dnsOverTls} onCheckedChange={(value) => (dnsOverTls = value)} />
                <span class="text-xs text-slate-300">{dnsOverTls ? 'Enabled' : 'Disabled'}</span>
              </div>
            </div>
          </section>
        {/if}

        {#if currentStep === 'security'}
          <section class="space-y-4">
            <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <div class="space-y-2">
                <FieldLabel label="Block Private Networks on WAN" hint="Drops RFC1918 source networks on WAN unless intentionally expected. This reduces spoofed traffic exposure for public-facing interfaces. Keep enabled for standard internet-connected deployments." />
                <div class="flex h-10 items-center gap-3 rounded-md border border-slate-700 bg-slate-950 px-3">
                  <Switch checked={blockPrivateWan} onCheckedChange={(value) => (blockPrivateWan = value)} />
                  <span class="text-xs text-slate-300">{blockPrivateWan ? 'Enabled' : 'Disabled'}</span>
                </div>
              </div>

              <div class="space-y-2">
                <FieldLabel label="Block Bogon Networks on WAN" hint="Filters unallocated or reserved source networks commonly seen in malicious scans. Keep enabled on WAN for better baseline hygiene and reduced noise. Disable only when provider design requires exceptions." />
                <div class="flex h-10 items-center gap-3 rounded-md border border-slate-700 bg-slate-950 px-3">
                  <Switch checked={blockBogonWan} onCheckedChange={(value) => (blockBogonWan = value)} />
                  <span class="text-xs text-slate-300">{blockBogonWan ? 'Enabled' : 'Disabled'}</span>
                </div>
              </div>

              <div class="space-y-2">
                <FieldLabel label="Enable SSH Management" hint="Enables SSH access for advanced troubleshooting and automation. Keep disabled unless operationally required and always pair with strict ACL controls. Prefer key-based authentication post-setup." />
                <div class="flex h-10 items-center gap-3 rounded-md border border-slate-700 bg-slate-950 px-3">
                  <Switch checked={sshEnabled} onCheckedChange={(value) => (sshEnabled = value)} />
                  <span class="text-xs text-slate-300">{sshEnabled ? 'Enabled' : 'Disabled'}</span>
                </div>
              </div>

              <div class="space-y-2">
                <FieldLabel label="SSH Port" hint="TCP port for SSH daemon when enabled. Non-default ports reduce random scanning noise but do not replace proper authentication controls. Keep within valid 1-65535 range." />
                <Input class="border-slate-700 bg-slate-950" type="number" value={sshPort} oninput={(event) => (sshPort = Number((event.currentTarget as HTMLInputElement).value || 0))} disabled={!sshEnabled} />
              </div>

              <div class="space-y-2">
                <FieldLabel label="Force MFA for GUI" hint="Requires multi-factor authentication for web administration sessions where supported. Strongly recommended for internet-adjacent environments and privileged operator accounts. Keep enabled once identity integration is prepared." />
                <div class="flex h-10 items-center gap-3 rounded-md border border-slate-700 bg-slate-950 px-3">
                  <Switch checked={forceMfa} onCheckedChange={(value) => (forceMfa = value)} />
                  <span class="text-xs text-slate-300">{forceMfa ? 'Enabled' : 'Disabled'}</span>
                </div>
              </div>

              <div class="space-y-2">
                <FieldLabel label="Lockout Threshold" hint="Number of failed login attempts before temporary lockout policy activates. Lower values improve brute-force resistance but can impact users during password reset periods. Typical value is between 5 and 10." />
                <Input class="border-slate-700 bg-slate-950" type="number" value={lockoutThreshold} oninput={(event) => (lockoutThreshold = Number((event.currentTarget as HTMLInputElement).value || 0))} />
              </div>
            </div>

            <Collapsible.Root bind:open={showAdvancedSecurity} class="rounded-md border border-slate-700 bg-slate-950/70 p-4">
              <Collapsible.Trigger class="flex w-full items-center justify-between text-left text-sm font-medium text-slate-200">
                Advanced Settings
                <ChevronDownIcon class={`h-4 w-4 text-cyan-400 transition-transform ${showAdvancedSecurity ? 'rotate-180' : ''}`} />
              </Collapsible.Trigger>
              <Collapsible.Content class="pt-4">
                <div class="grid gap-4 md:grid-cols-2">
                  <div class="space-y-2">
                    <FieldLabel label="Management Access Scope" hint="Defines from where management interfaces are reachable after setup. Start with LAN-only when possible, then intentionally expand via VPN if needed. All-interfaces mode should remain temporary." />
                    <Select.Root type="single" value={managementAccess} onValueChange={(value) => { if (value) managementAccess = value; }}>
                      <Select.Trigger class="w-full border-slate-700 bg-slate-950 text-slate-100"><span>{managementAccessOptions.find((option) => option.value === managementAccess)?.label ?? managementAccess}</span></Select.Trigger>
                      <Select.Content class="border-slate-700 bg-slate-950">
                        {#each managementAccessOptions as option}
                          <Select.Item value={option.value} label={option.label} class="text-slate-200 hover:bg-slate-800" />
                        {/each}
                      </Select.Content>
                    </Select.Root>
                  </div>
                </div>
              </Collapsible.Content>
            </Collapsible.Root>
          </section>
        {/if}

        {#if currentStep === 'services'}
          <section class="space-y-4">
            <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <div class="space-y-2">
                <FieldLabel label="Update Channel" hint="Defines which software release stream this appliance follows. Stable is recommended for production, security for faster patch cadence, and beta for controlled evaluation only. Keep channel aligned with change policy." />
                <Select.Root type="single" value={updateChannel} onValueChange={(value) => { if (value) updateChannel = value; }}>
                  <Select.Trigger class="w-full border-slate-700 bg-slate-950 text-slate-100"><span>{updateChannelOptions.find((option) => option.value === updateChannel)?.label ?? updateChannel}</span></Select.Trigger>
                  <Select.Content class="border-slate-700 bg-slate-950">
                    {#each updateChannelOptions as option}
                      <Select.Item value={option.value} label={option.label} class="text-slate-200 hover:bg-slate-800" />
                    {/each}
                  </Select.Content>
                </Select.Root>
              </div>

              <div class="space-y-2">
                <FieldLabel label="Enable Auto Updates" hint="Automatically applies package updates according to platform policy and selected channel. Use with caution in strict change-control environments and ensure maintenance windows are defined. Disable when manual approval is required." />
                <div class="flex h-10 items-center gap-3 rounded-md border border-slate-700 bg-slate-950 px-3">
                  <Switch checked={autoUpdates} onCheckedChange={(value) => (autoUpdates = value)} />
                  <span class="text-xs text-slate-300">{autoUpdates ? 'Enabled' : 'Disabled'}</span>
                </div>
              </div>

              <div class="space-y-2">
                <FieldLabel label="Enable Telemetry" hint="Sends anonymized usage and health metrics depending on platform policy. Useful for proactive support and trend insight if governance allows it. Disable in strict privacy or regulatory environments." />
                <div class="flex h-10 items-center gap-3 rounded-md border border-slate-700 bg-slate-950 px-3">
                  <Switch checked={telemetryEnabled} onCheckedChange={(value) => (telemetryEnabled = value)} />
                  <span class="text-xs text-slate-300">{telemetryEnabled ? 'Enabled' : 'Disabled'}</span>
                </div>
              </div>

              <div class="space-y-2">
                <FieldLabel label="Enable Crash Reports" hint="Uploads sanitized crash artifacts for faster root-cause analysis and support turnaround. Enable if your support policy benefits from rapid diagnostics. Ensure internal privacy review before activating." />
                <div class="flex h-10 items-center gap-3 rounded-md border border-slate-700 bg-slate-950 px-3">
                  <Switch checked={crashReports} onCheckedChange={(value) => (crashReports = value)} />
                  <span class="text-xs text-slate-300">{crashReports ? 'Enabled' : 'Disabled'}</span>
                </div>
              </div>

              <div class="space-y-2">
                <FieldLabel label="Enable WireGuard" hint="Prepares WireGuard module defaults and enables initial service wiring for remote access or site-to-site links. Disable if VPN rollout is planned later under separate change controls. Enable when immediate remote access is required." />
                <div class="flex h-10 items-center gap-3 rounded-md border border-slate-700 bg-slate-950 px-3">
                  <Switch checked={enableWireGuard} onCheckedChange={(value) => (enableWireGuard = value)} />
                  <span class="text-xs text-slate-300">{enableWireGuard ? 'Enabled' : 'Disabled'}</span>
                </div>
              </div>

              <div class="space-y-2">
                <FieldLabel label="Enable Captive Portal" hint="Turns on captive portal framework for guest onboarding policies. Useful for hospitality and guest networks where terms acceptance or vouchers are required. Disable if not part of initial deployment scope." />
                <div class="flex h-10 items-center gap-3 rounded-md border border-slate-700 bg-slate-950 px-3">
                  <Switch checked={enableCaptivePortal} onCheckedChange={(value) => (enableCaptivePortal = value)} />
                  <span class="text-xs text-slate-300">{enableCaptivePortal ? 'Enabled' : 'Disabled'}</span>
                </div>
              </div>

              <div class="space-y-2">
                <FieldLabel label="Enable Suricata" hint="Activates IDS/IPS framework baseline packages and initial service wiring. Enable if threat detection is part of immediate rollout and hardware sizing is validated. Otherwise stage it post-deployment." />
                <div class="flex h-10 items-center gap-3 rounded-md border border-slate-700 bg-slate-950 px-3">
                  <Switch checked={enableSuricata} onCheckedChange={(value) => (enableSuricata = value)} />
                  <span class="text-xs text-slate-300">{enableSuricata ? 'Enabled' : 'Disabled'}</span>
                </div>
              </div>
            </div>

            <Collapsible.Root bind:open={showAdvancedServices} class="rounded-md border border-slate-700 bg-slate-950/70 p-4">
              <Collapsible.Trigger class="flex w-full items-center justify-between text-left text-sm font-medium text-slate-200">
                Advanced Settings
                <ChevronDownIcon class={`h-4 w-4 text-cyan-400 transition-transform ${showAdvancedServices ? 'rotate-180' : ''}`} />
              </Collapsible.Trigger>
              <Collapsible.Content class="pt-4">
                <div class="space-y-2">
                  <FieldLabel label="Setup Description" hint="Narrative note stored with initialization payload to capture deployment intent and handoff details. Include owner team and ticket references for audit traceability. This note becomes valuable for day-two support." />
                  <Input class="border-slate-700 bg-slate-950" value={setupDescription} oninput={(event) => (setupDescription = (event.currentTarget as HTMLInputElement).value)} />
                </div>
              </Collapsible.Content>
            </Collapsible.Root>
          </section>
        {/if}

        {#if currentStep === 'review'}
          <section class="space-y-4 rounded-md border border-slate-700 bg-slate-950/70 p-4 text-sm text-slate-200">
            <div class="grid gap-2 md:grid-cols-2">
              <div class="rounded-md border border-slate-700 bg-slate-900/70 px-3 py-2"><span class="text-slate-400">{$_('wizard.hostname')}</span> {hostname}</div>
              <div class="rounded-md border border-slate-700 bg-slate-900/70 px-3 py-2"><span class="text-slate-400">{$_('wizard.domain')}</span> {domain}</div>
              <div class="rounded-md border border-slate-700 bg-slate-900/70 px-3 py-2"><span class="text-slate-400">{$_('wizard.admin_user')}</span> {adminUser}</div>
              <div class="rounded-md border border-slate-700 bg-slate-900/70 px-3 py-2"><span class="text-slate-400">{$_('wizard.admin_email')}</span> {adminEmail}</div>
              <div class="rounded-md border border-slate-700 bg-slate-900/70 px-3 py-2"><span class="text-slate-400">{$_('wizard.wan_interface')}</span> {wanInterface}</div>
              <div class="rounded-md border border-slate-700 bg-slate-900/70 px-3 py-2"><span class="text-slate-400">{$_('wizard.lan_interface')}</span> {lanInterface}</div>
              <div class="rounded-md border border-slate-700 bg-slate-900/70 px-3 py-2"><span class="text-slate-400">{$_('wizard.lan_subnet')}</span> {lanSubnet}</div>
              <div class="rounded-md border border-slate-700 bg-slate-900/70 px-3 py-2"><span class="text-slate-400">{$_('wizard.lan_gateway')}</span> {lanGateway}</div>
              <div class="rounded-md border border-slate-700 bg-slate-900/70 px-3 py-2"><span class="text-slate-400">{$_('wizard.dns_servers')}</span> {splitComma(dnsServers).join(', ')}</div>
              <div class="rounded-md border border-slate-700 bg-slate-900/70 px-3 py-2"><span class="text-slate-400">{$_('wizard.fallback_dns')}</span> {splitComma(fallbackDnsServers).join(', ')}</div>
              <div class="rounded-md border border-slate-700 bg-slate-900/70 px-3 py-2"><span class="text-slate-400">{$_('wizard.timezone')}</span> {timezone}</div>
              <div class="rounded-md border border-slate-700 bg-slate-900/70 px-3 py-2"><span class="text-slate-400">{$_('wizard.ntp_servers')}</span> {splitComma(ntpServers).join(', ')}</div>
              <div class="rounded-md border border-slate-700 bg-slate-900/70 px-3 py-2"><span class="text-slate-400">{$_('wizard.block_private_wan')}</span> {blockPrivateWan ? 'Yes' : 'No'}</div>
              <div class="rounded-md border border-slate-700 bg-slate-900/70 px-3 py-2"><span class="text-slate-400">{$_('wizard.block_bogon_wan')}</span> {blockBogonWan ? 'Yes' : 'No'}</div>
              <div class="rounded-md border border-slate-700 bg-slate-900/70 px-3 py-2"><span class="text-slate-400">{$_('wizard.ssh_enabled')}</span> {sshEnabled ? `Yes (port ${sshPort})` : 'No'}</div>
              <div class="rounded-md border border-slate-700 bg-slate-900/70 px-3 py-2"><span class="text-slate-400">{$_('wizard.mfa_required')}</span> {forceMfa ? 'Yes' : 'No'}</div>
              <div class="rounded-md border border-slate-700 bg-slate-900/70 px-3 py-2"><span class="text-slate-400">{$_('wizard.update_channel')}</span> {updateChannel}</div>
              <div class="rounded-md border border-slate-700 bg-slate-900/70 px-3 py-2"><span class="text-slate-400">{$_('wizard.auto_updates')}</span> {autoUpdates ? 'Enabled' : 'Disabled'}</div>
              <div class="rounded-md border border-slate-700 bg-slate-900/70 px-3 py-2"><span class="text-slate-400">{$_('wizard.wireguard')}</span> {enableWireGuard ? 'Enabled' : 'Disabled'}</div>
              <div class="rounded-md border border-slate-700 bg-slate-900/70 px-3 py-2"><span class="text-slate-400">{$_('wizard.captive_portal')}</span> {enableCaptivePortal ? 'Enabled' : 'Disabled'}</div>
            </div>

            <div class="rounded-md border border-cyan-700 bg-cyan-900/20 p-3 text-cyan-100">
              Verify these values with your deployment worksheet before applying. Initialization modifies core runtime assumptions and should be treated as a controlled change.
            </div>
          </section>
        {/if}

        {#if currentStep === 'apply'}
          <section class="space-y-4 rounded-md border border-slate-700 bg-slate-950/70 p-4">
            <p class="text-sm text-slate-300">
              Apply submits all wizard selections to `/system/setup` and marks this appliance initialized.
              After success, you will be redirected to login for normal operation.
            </p>

            {#if applyResult}
              <div class={`rounded-md border p-3 text-sm ${applyResult.toLowerCase().includes('complete')
                ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-200'
                : 'border-red-500/50 bg-red-500/10 text-red-200'}`}>
                {applyResult}
              </div>
            {/if}

            <Button class="bg-cyan-600 text-white hover:bg-cyan-500" onclick={() => void applySetup()} disabled={submitting}>
              {submitting ? 'Applying Setup...' : 'Apply Setup'}
            </Button>
          </section>
        {/if}

        <div class="flex items-center justify-between border-t border-slate-700 pt-4">
          <Button variant="outline" class="border-slate-700 text-slate-200 hover:bg-slate-800" onclick={previousStep} disabled={stepIndex === 0 || submitting}>
            Back
          </Button>

          {#if stepIndex < steps.length - 1}
            <Button
              class="bg-cyan-600 text-white hover:bg-cyan-500"
              onclick={() => {
                const validation = validateCurrentStep();
                if (validation) {
                  toasts.error(validation);
                  return;
                }
                nextStep();
              }}
              disabled={submitting}
            >
              Continue
            </Button>
          {/if}
        </div>
      </CardContent>
    </Card>
  </div>
</div>
