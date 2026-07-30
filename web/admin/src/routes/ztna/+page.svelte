<!-- Route view for `/ztna` in the ezNGFW admin GUI. -->

<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '$lib/api/client';
  import { toasts } from '$lib/stores/toast';
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '$lib/components/ui/card';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { Switch } from '$lib/components/ui/switch';
  import FieldLabel from '$lib/components/admin/FieldLabel.svelte';
  import { _ } from '$lib/i18n';

  type ZtnaProvider = 'BuiltIn' | 'OpenZiti' | 'WireGuardMesh';
  type PostureCheckType = 'os_version' | 'antivirus' | 'disk_encryption' | 'mfa' | 'geo_location';

  type ZtnaPolicy = {
    id: string;
    name: string;
    enabled: boolean;
    identity_groups: string[];
    allowed_services: string[];
    posture_requirements: string[];
    action: string;
    schedule: string;
  };

  type ZtnaIdentity = {
    id: string;
    name: string;
    email: string;
    groups: string[];
    device_posture: string[];
    certificates: string[];
    mfa_status: string;
    last_authenticated: string;
  };

  type ZtnaService = {
    id: string;
    name: string;
    protocol: string;
    host: string;
    port: number;
    description: string;
    intercept_config: unknown;
  };

  type PostureCheck = {
    id: string;
    name: string;
    check_type: PostureCheckType;
    parameters: unknown;
    pass_action: string;
    fail_action: string;
  };

  type ZtnaConfig = {
    enabled: boolean;
    provider: ZtnaProvider;
    controller_url: string;
    enrollment_token: string;
    policies: ZtnaPolicy[];
    identities: ZtnaIdentity[];
    services: ZtnaService[];
    posture_checks: PostureCheck[];
    overlay_network_cidr: string;
  };

  const defaults: ZtnaConfig = {
    enabled: false,
    provider: 'BuiltIn',
    controller_url: '',
    enrollment_token: '',
    policies: [],
    identities: [],
    services: [],
    posture_checks: [],
    overlay_network_cidr: '10.240.0.0/16'
  };

  const defaultIdentity: ZtnaIdentity = {
    id: '',
    name: '',
    email: '',
    groups: [],
    device_posture: [],
    certificates: [],
    mfa_status: 'required',
    last_authenticated: ''
  };

  const defaultService: ZtnaService = {
    id: '',
    name: '',
    protocol: 'tcp',
    host: '',
    port: 443,
    description: '',
    intercept_config: {}
  };

  const defaultPolicy: ZtnaPolicy = {
    id: '',
    name: '',
    enabled: true,
    identity_groups: [],
    allowed_services: [],
    posture_requirements: [],
    action: 'allow',
    schedule: 'always'
  };

  const defaultPosture: PostureCheck = {
    id: '',
    name: '',
    check_type: 'os_version',
    parameters: {},
    pass_action: 'allow',
    fail_action: 'deny'
  };

  let cfg = $state<ZtnaConfig>({ ...defaults });
  let identities = $state<ZtnaIdentity[]>([]);
  let services = $state<ZtnaService[]>([]);
  let policies = $state<ZtnaPolicy[]>([]);
  let postureChecks = $state<PostureCheck[]>([]);

  let identityDraft = $state<ZtnaIdentity>({ ...defaultIdentity });
  let serviceDraft = $state<ZtnaService>({ ...defaultService });
  let policyDraft = $state<ZtnaPolicy>({ ...defaultPolicy });
  let postureDraft = $state<PostureCheck>({ ...defaultPosture });

  let serviceInterceptDraft = $state('{}');
  let postureParamsDraft = $state('{}');
  let loading = $state(true);
  let savingConfig = $state(false);

  const activeIdentities = $derived(identities.filter((item) => item.last_authenticated.trim().length > 0).length);
  const policyViolations = $derived(
    policies.filter((policy) => policy.enabled).reduce((count, policy) => {
      const missingPosture = policy.posture_requirements.some((id) => !postureChecks.some((check) => check.id === id));
      const missingService = policy.allowed_services.some((id) => !services.some((svc) => svc.id === id));
      return count + (missingPosture || missingService ? 1 : 0);
    }, 0)
  );
  const healthyServices = $derived(services.filter((item) => item.host.trim().length > 0 && item.port > 0).length);

  function splitCsv(value: string): string[] {
    return value
      .split(',')
      .map((part) => part.trim())
      .filter((part) => part.length > 0);
  }

  function joinCsv(values: string[]): string {
    return values.join(', ');
  }

  async function load() {
    loading = true;
    try {
      const [rawConfig, rawIdentities, rawServices, rawPolicies, rawPosture] = await Promise.all([
        api.get('/ztna'),
        api.get('/ztna/identities'),
        api.get('/ztna/services'),
        api.get('/ztna/policies'),
        api.get('/ztna/posture-checks')
      ]);

      cfg = { ...defaults, ...(rawConfig as ZtnaConfig) };
      identities = rawIdentities as ZtnaIdentity[];
      services = rawServices as ZtnaService[];
      policies = rawPolicies as ZtnaPolicy[];
      postureChecks = rawPosture as PostureCheck[];
    } catch (e) {
      toasts.error(e instanceof Error ? e.message : 'Failed to load ZTNA data');
    } finally {
      loading = false;
    }
  }

  async function saveConfig() {
    savingConfig = true;
    try {
      cfg = await api.patch('/ztna', { ...cfg, identities, services, policies, posture_checks: postureChecks }) as ZtnaConfig;
      toasts.success($_('ztna.toastztna_base_configuration_saved'));
    } catch (e) {
      toasts.error(e instanceof Error ? e.message : 'Failed to save ZTNA base configuration');
    } finally {
      savingConfig = false;
    }
  }

  async function createIdentity() {
    if (!identityDraft.id.trim()) {
      toasts.error($_('ztna.toastidentity_id_is_required'));
      return;
    }
    try {
      const created = await api.post('/ztna/identities', identityDraft) as ZtnaIdentity;
      identities = [...identities, created];
      identityDraft = { ...defaultIdentity };
      toasts.success($_('ztna.toastidentity_created'));
    } catch (e) {
      toasts.error(e instanceof Error ? e.message : 'Failed to create identity');
    }
  }

  async function saveIdentity(item: ZtnaIdentity) {
    try {
      await api.put(`/ztna/identities/${encodeURIComponent(item.id)}`, item);
      toasts.success(`Identity ${item.id} saved`);
    } catch (e) {
      toasts.error(e instanceof Error ? e.message : 'Failed to save identity');
    }
  }

  async function removeIdentity(item: ZtnaIdentity) {
    try {
      await api.del(`/ztna/identities/${encodeURIComponent(item.id)}`);
      identities = identities.filter((entry) => entry.id !== item.id);
      toasts.success(`Identity ${item.id} removed`);
    } catch (e) {
      toasts.error(e instanceof Error ? e.message : 'Failed to remove identity');
    }
  }

  async function createService() {
    if (!serviceDraft.id.trim()) {
      toasts.error($_('ztna.toastservice_id_is_required'));
      return;
    }
    try {
      const parsed = JSON.parse(serviceInterceptDraft) as unknown;
      const payload = { ...serviceDraft, intercept_config: parsed };
      const created = await api.post('/ztna/services', payload) as ZtnaService;
      services = [...services, created];
      serviceDraft = { ...defaultService };
      serviceInterceptDraft = '{}';
      toasts.success($_('ztna.toastservice_created'));
    } catch (e) {
      toasts.error(e instanceof Error ? e.message : 'Failed to create service');
    }
  }

  async function saveService(item: ZtnaService) {
    try {
      await api.put(`/ztna/services/${encodeURIComponent(item.id)}`, item);
      toasts.success(`Service ${item.id} saved`);
    } catch (e) {
      toasts.error(e instanceof Error ? e.message : 'Failed to save service');
    }
  }

  async function removeService(item: ZtnaService) {
    try {
      await api.del(`/ztna/services/${encodeURIComponent(item.id)}`);
      services = services.filter((entry) => entry.id !== item.id);
      toasts.success(`Service ${item.id} removed`);
    } catch (e) {
      toasts.error(e instanceof Error ? e.message : 'Failed to remove service');
    }
  }

  async function createPolicy() {
    if (!policyDraft.id.trim()) {
      toasts.error($_('ztna.toastpolicy_id_is_required'));
      return;
    }
    try {
      const created = await api.post('/ztna/policies', policyDraft) as ZtnaPolicy;
      policies = [...policies, created];
      policyDraft = { ...defaultPolicy };
      toasts.success($_('ztna.toastpolicy_created'));
    } catch (e) {
      toasts.error(e instanceof Error ? e.message : 'Failed to create policy');
    }
  }

  async function savePolicy(item: ZtnaPolicy) {
    try {
      await api.put(`/ztna/policies/${encodeURIComponent(item.id)}`, item);
      toasts.success(`Policy ${item.id} saved`);
    } catch (e) {
      toasts.error(e instanceof Error ? e.message : 'Failed to save policy');
    }
  }

  async function removePolicy(item: ZtnaPolicy) {
    try {
      await api.del(`/ztna/policies/${encodeURIComponent(item.id)}`);
      policies = policies.filter((entry) => entry.id !== item.id);
      toasts.success(`Policy ${item.id} removed`);
    } catch (e) {
      toasts.error(e instanceof Error ? e.message : 'Failed to remove policy');
    }
  }

  async function createPosture() {
    if (!postureDraft.id.trim()) {
      toasts.error($_('ztna.toastposture_check_id_is_required'));
      return;
    }
    try {
      const payload = { ...postureDraft, parameters: JSON.parse(postureParamsDraft) as unknown };
      const created = await api.post('/ztna/posture-checks', payload) as PostureCheck;
      postureChecks = [...postureChecks, created];
      postureDraft = { ...defaultPosture };
      postureParamsDraft = '{}';
      toasts.success($_('ztna.toastposture_check_created'));
    } catch (e) {
      toasts.error(e instanceof Error ? e.message : 'Failed to create posture check');
    }
  }

  async function savePosture(item: PostureCheck) {
    try {
      await api.put(`/ztna/posture-checks/${encodeURIComponent(item.id)}`, item);
      toasts.success(`Posture check ${item.id} saved`);
    } catch (e) {
      toasts.error(e instanceof Error ? e.message : 'Failed to save posture check');
    }
  }

  async function removePosture(item: PostureCheck) {
    try {
      await api.del(`/ztna/posture-checks/${encodeURIComponent(item.id)}`);
      postureChecks = postureChecks.filter((entry) => entry.id !== item.id);
      toasts.success(`Posture check ${item.id} removed`);
    } catch (e) {
      toasts.error(e instanceof Error ? e.message : 'Failed to remove posture check');
    }
  }

  onMount(() => {
    void load();
  });
</script>

<div class="space-y-6 bg-gradient-to-b from-slate-950 to-slate-900 p-1">
  <Card class="border-cyan-900/70 bg-slate-900/90">
    <CardHeader>
      <CardTitle class="text-slate-100">{$_('ztna.enterprise_ztna_control_plane')}</CardTitle>
      <CardDescription class="text-slate-400">{$_('ztna.identityfirst_policy_orchestration_microsegmentati')}</CardDescription>
    </CardHeader>
    <CardContent class="space-y-4">
      {#if loading}
        <p class="text-sm text-slate-400">{$_('ztna.loading_ztna_datasets')}</p>
      {:else}
        <div class="grid gap-3 md:grid-cols-3">
          <div class="rounded border border-cyan-900/50 bg-slate-950 p-3"><p class="text-xs uppercase tracking-wide text-slate-400">{$_('ztna.active_identities')}</p><p class="mt-1 text-2xl font-semibold text-cyan-300">{activeIdentities}</p></div>
          <div class="rounded border border-cyan-900/50 bg-slate-950 p-3"><p class="text-xs uppercase tracking-wide text-slate-400">{$_('ztna.policy_violations')}</p><p class="mt-1 text-2xl font-semibold text-amber-300">{policyViolations}</p></div>
          <div class="rounded border border-cyan-900/50 bg-slate-950 p-3"><p class="text-xs uppercase tracking-wide text-slate-400">{$_('ztna.service_health')}</p><p class="mt-1 text-2xl font-semibold text-cyan-300">{healthyServices}/{services.length}</p></div>
        </div>

        <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label class="space-y-1 text-sm"><FieldLabel label="ZTNA enabled" hint="Activate Zero Trust Network Access to enforce identity-based micro-segmentation." /><div class="flex h-9 items-center rounded border border-slate-700 bg-slate-950 px-3"><Switch checked={cfg.enabled} onCheckedChange={(v) => (cfg.enabled = v)} /></div></label>
          <label class="space-y-1 text-sm"><FieldLabel label="Provider" hint="Select the underlying ZTNA technology provider for the secure overlay network." /><select class="h-9 w-full rounded-md border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100" bind:value={cfg.provider}><option value="BuiltIn">{$_('ztna.builtin')}</option><option value="OpenZiti">{$_('ztna.openziti')}</option><option value="WireGuardMesh">{$_('ztna.wireguard_mesh')}</option></select></label>
          <label class="space-y-1 text-sm"><FieldLabel label="Controller URL" hint="HTTPS endpoint of the ZTNA control plane that manages enrollment and policy distribution." /><Input class="border-slate-700 bg-slate-950" bind:value={cfg.controller_url} placeholder="https://ztna-controller.example" /></label>
          <label class="space-y-1 text-sm"><FieldLabel label="Overlay CIDR" hint="Private IP range assigned to the encrypted mesh overlay network." /><Input class="border-slate-700 bg-slate-950" bind:value={cfg.overlay_network_cidr} placeholder="10.240.0.0/16" /></label>
          <label class="space-y-1 text-sm md:col-span-2 xl:col-span-4"><FieldLabel label="Enrollment token" hint="One-time bootstrap token used to register this node with the ZTNA controller." /><Input class="border-slate-700 bg-slate-950" bind:value={cfg.enrollment_token} placeholder={$_('ztna.placeholderbootstrap_enrollment_token')} /></label>
        </div>

        <Button class="bg-cyan-700 text-slate-50 hover:bg-cyan-600" onclick={() => void saveConfig()} disabled={savingConfig}>{savingConfig ? 'Saving...' : 'Save base configuration'}</Button>
      {/if}
    </CardContent>
  </Card>

  <Card class="border-slate-800 bg-slate-900/90">
    <CardHeader><CardTitle class="text-slate-100">{$_('ztna.identity_management')}</CardTitle></CardHeader>
    <CardContent class="space-y-3">
      <div class="grid gap-2 rounded border border-slate-800 bg-slate-950 p-3 md:grid-cols-3">
        <Input class="border-slate-700 bg-slate-900" placeholder="id" bind:value={identityDraft.id} />
        <Input class="border-slate-700 bg-slate-900" placeholder="display name" bind:value={identityDraft.name} />
        <Input class="border-slate-700 bg-slate-900" placeholder="email" bind:value={identityDraft.email} />
        <Input class="border-slate-700 bg-slate-900" placeholder="groups (csv)" value={joinCsv(identityDraft.groups)} oninput={(e) => (identityDraft.groups = splitCsv((e.currentTarget as HTMLInputElement).value))} />
        <Input class="border-slate-700 bg-slate-900" placeholder="device posture tags (csv)" value={joinCsv(identityDraft.device_posture)} oninput={(e) => (identityDraft.device_posture = splitCsv((e.currentTarget as HTMLInputElement).value))} />
        <Input class="border-slate-700 bg-slate-900" placeholder="certificates (csv)" value={joinCsv(identityDraft.certificates)} oninput={(e) => (identityDraft.certificates = splitCsv((e.currentTarget as HTMLInputElement).value))} />
        <select
              bind:value={identityDraft.mfa_status}
              class="h-10 w-full rounded-md border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100"
            >
              <option value="enabled">enabled</option>
              <option value="disabled">disabled</option>
              <option value="enforced">enforced</option>
            </select>
        <Input class="border-slate-700 bg-slate-900" placeholder="last authenticated (ISO-8601)" bind:value={identityDraft.last_authenticated} />
        <div><Button type="button" variant="outline" class="border-cyan-700 text-cyan-300" onclick={() => void createIdentity()}>Add identity</Button></div>
      </div>

      {#each identities as item, i (item.id)}
        <div class="grid gap-2 rounded border border-slate-800 bg-slate-950 p-3 md:grid-cols-3">
          <Input class="border-slate-700 bg-slate-900" value={item.id} readonly />
          <Input class="border-slate-700 bg-slate-900" value={item.name} oninput={(e) => (identities[i].name = (e.currentTarget as HTMLInputElement).value)} />
          <Input class="border-slate-700 bg-slate-900" value={item.email} oninput={(e) => (identities[i].email = (e.currentTarget as HTMLInputElement).value)} />
          <Input class="border-slate-700 bg-slate-900" value={joinCsv(item.groups)} oninput={(e) => (identities[i].groups = splitCsv((e.currentTarget as HTMLInputElement).value))} />
          <Input class="border-slate-700 bg-slate-900" value={joinCsv(item.device_posture)} oninput={(e) => (identities[i].device_posture = splitCsv((e.currentTarget as HTMLInputElement).value))} />
          <Input class="border-slate-700 bg-slate-900" value={joinCsv(item.certificates)} oninput={(e) => (identities[i].certificates = splitCsv((e.currentTarget as HTMLInputElement).value))} />
          <Input class="border-slate-700 bg-slate-900" value={item.mfa_status} oninput={(e) => (identities[i].mfa_status = (e.currentTarget as HTMLInputElement).value)} />
          <Input class="border-slate-700 bg-slate-900" value={item.last_authenticated} oninput={(e) => (identities[i].last_authenticated = (e.currentTarget as HTMLInputElement).value)} />
          <div class="flex gap-2"><Button type="button" variant="outline" class="border-slate-700" onclick={() => void saveIdentity(item)}>Save</Button><Button type="button" variant="outline" class="border-red-700 text-red-300" onclick={() => void removeIdentity(item)}>Remove</Button></div>
        </div>
      {/each}
    </CardContent>
  </Card>

  <Card class="border-slate-800 bg-slate-900/90">
    <CardHeader><CardTitle class="text-slate-100">{$_('ztna.service_catalog')}</CardTitle></CardHeader>
    <CardContent class="space-y-3">
      <div class="grid gap-2 rounded border border-slate-800 bg-slate-950 p-3 md:grid-cols-3">
        <Input class="border-slate-700 bg-slate-900" placeholder="id" bind:value={serviceDraft.id} />
        <Input class="border-slate-700 bg-slate-900" placeholder="service name" bind:value={serviceDraft.name} />
        <select
              bind:value={serviceDraft.protocol}
              class="h-10 w-full rounded-md border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100"
            >
              <option value="tcp">tcp</option>
              <option value="udp">udp</option>
              <option value="http">http</option>
              <option value="https">https</option>
              <option value="ssh">ssh</option>
              <option value="rdp">rdp</option>
              <option value="any">any</option>
            </select>
        <Input class="border-slate-700 bg-slate-900" placeholder="host" bind:value={serviceDraft.host} />
        <Input class="border-slate-700 bg-slate-900" type="number" placeholder="port" bind:value={serviceDraft.port} />
        <Input class="border-slate-700 bg-slate-900" placeholder="description" bind:value={serviceDraft.description} />
        <label class="space-y-1 text-sm md:col-span-3"><FieldLabel label="Intercept configuration (JSON)" hint="Advanced JSON configuration for defining which traffic patterns should be intercepted by the ZTNA client." /><textarea class="min-h-20 w-full rounded-md border border-slate-700 bg-slate-900 p-2 font-mono text-xs text-slate-100" bind:value={serviceInterceptDraft}></textarea></label>
        <div class="md:col-span-3"><Button type="button" variant="outline" class="border-cyan-700 text-cyan-300" onclick={() => void createService()}>Add service</Button></div>
      </div>

      {#each services as item, i (item.id)}
        <div class="grid gap-2 rounded border border-slate-800 bg-slate-950 p-3 md:grid-cols-3">
          <Input class="border-slate-700 bg-slate-900" value={item.id} readonly />
          <Input class="border-slate-700 bg-slate-900" value={item.name} oninput={(e) => (services[i].name = (e.currentTarget as HTMLInputElement).value)} />
          <Input class="border-slate-700 bg-slate-900" value={item.protocol} oninput={(e) => (services[i].protocol = (e.currentTarget as HTMLInputElement).value)} />
          <Input class="border-slate-700 bg-slate-900" value={item.host} oninput={(e) => (services[i].host = (e.currentTarget as HTMLInputElement).value)} />
          <Input class="border-slate-700 bg-slate-900" type="number" value={String(item.port)} oninput={(e) => (services[i].port = Number((e.currentTarget as HTMLInputElement).value || 0))} />
          <Input class="border-slate-700 bg-slate-900" value={item.description} oninput={(e) => (services[i].description = (e.currentTarget as HTMLInputElement).value)} />
          <label class="space-y-1 text-sm md:col-span-3"><FieldLabel label="Intercept configuration (JSON)" hint="Advanced JSON configuration for defining which traffic patterns should be intercepted by the ZTNA client." /><textarea class="min-h-20 w-full rounded-md border border-slate-700 bg-slate-900 p-2 font-mono text-xs text-slate-100" value={JSON.stringify(item.intercept_config ?? {}, null, 2)} oninput={(e) => { try { services[i].intercept_config = JSON.parse((e.currentTarget as HTMLTextAreaElement).value) as unknown; } catch { } }}></textarea></label>
          <div class="md:col-span-3 flex gap-2"><Button type="button" variant="outline" class="border-slate-700" onclick={() => void saveService(item)}>Save</Button><Button type="button" variant="outline" class="border-red-700 text-red-300" onclick={() => void removeService(item)}>Remove</Button></div>
        </div>
      {/each}
    </CardContent>
  </Card>

  <Card class="border-slate-800 bg-slate-900/90">
    <CardHeader><CardTitle class="text-slate-100">{$_('ztna.policy_editor')}</CardTitle></CardHeader>
    <CardContent class="space-y-3">
      <div class="grid gap-2 rounded border border-slate-800 bg-slate-950 p-3 md:grid-cols-3">
        <Input class="border-slate-700 bg-slate-900" placeholder="id" bind:value={policyDraft.id} />
        <Input class="border-slate-700 bg-slate-900" placeholder="name" bind:value={policyDraft.name} />
        <select
              bind:value={policyDraft.action}
              class="h-10 w-full rounded-md border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100"
            >
              <option value="allow">allow</option>
              <option value="deny">deny</option>
              <option value="mfa-required">mfa-required</option>
              <option value="conditional">conditional</option>
            </select>
        <Input class="border-slate-700 bg-slate-900" placeholder="identity groups (csv)" value={joinCsv(policyDraft.identity_groups)} oninput={(e) => (policyDraft.identity_groups = splitCsv((e.currentTarget as HTMLInputElement).value))} />
        <Input class="border-slate-700 bg-slate-900" placeholder="allowed services (csv)" value={joinCsv(policyDraft.allowed_services)} oninput={(e) => (policyDraft.allowed_services = splitCsv((e.currentTarget as HTMLInputElement).value))} />
        <Input class="border-slate-700 bg-slate-900" placeholder="posture checks (csv)" value={joinCsv(policyDraft.posture_requirements)} oninput={(e) => (policyDraft.posture_requirements = splitCsv((e.currentTarget as HTMLInputElement).value))} />
        <select
              bind:value={policyDraft.schedule}
              class="h-10 w-full rounded-md border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100"
            >
              <option value="always">always</option>
              <option value="business-hours">business-hours</option>
              <option value="after-hours">after-hours</option>
              <option value="weekends">weekends</option>
              <option value="custom">custom</option>
            </select>
        <div class="flex items-center justify-between rounded border border-slate-700 bg-slate-900 px-3"><span class="text-xs text-slate-300">{$_('ztna.enabled')}</span><Switch checked={policyDraft.enabled} onCheckedChange={(v) => (policyDraft.enabled = v)} /></div>
        <div><Button type="button" variant="outline" class="border-cyan-700 text-cyan-300" onclick={() => void createPolicy()}>Add policy</Button></div>
      </div>

      {#each policies as item, i (item.id)}
        <div class="grid gap-2 rounded border border-slate-800 bg-slate-950 p-3 md:grid-cols-3">
          <Input class="border-slate-700 bg-slate-900" value={item.id} readonly />
          <Input class="border-slate-700 bg-slate-900" value={item.name} oninput={(e) => (policies[i].name = (e.currentTarget as HTMLInputElement).value)} />
          <Input class="border-slate-700 bg-slate-900" value={item.action} oninput={(e) => (policies[i].action = (e.currentTarget as HTMLInputElement).value)} />
          <Input class="border-slate-700 bg-slate-900" value={joinCsv(item.identity_groups)} oninput={(e) => (policies[i].identity_groups = splitCsv((e.currentTarget as HTMLInputElement).value))} />
          <Input class="border-slate-700 bg-slate-900" value={joinCsv(item.allowed_services)} oninput={(e) => (policies[i].allowed_services = splitCsv((e.currentTarget as HTMLInputElement).value))} />
          <Input class="border-slate-700 bg-slate-900" value={joinCsv(item.posture_requirements)} oninput={(e) => (policies[i].posture_requirements = splitCsv((e.currentTarget as HTMLInputElement).value))} />
          <Input class="border-slate-700 bg-slate-900" value={item.schedule} oninput={(e) => (policies[i].schedule = (e.currentTarget as HTMLInputElement).value)} />
          <div class="flex items-center justify-between rounded border border-slate-700 bg-slate-900 px-3"><span class="text-xs text-slate-300">{$_('ztna.enabled_1')}</span><Switch checked={item.enabled} onCheckedChange={(v) => (policies[i].enabled = v)} /></div>
          <div class="flex gap-2"><Button type="button" variant="outline" class="border-slate-700" onclick={() => void savePolicy(item)}>Save</Button><Button type="button" variant="outline" class="border-red-700 text-red-300" onclick={() => void removePolicy(item)}>Remove</Button></div>
        </div>
      {/each}
    </CardContent>
  </Card>

  <Card class="border-slate-800 bg-slate-900/90">
    <CardHeader><CardTitle class="text-slate-100">{$_('ztna.posture_checks')}</CardTitle></CardHeader>
    <CardContent class="space-y-3">
      <div class="grid gap-2 rounded border border-slate-800 bg-slate-950 p-3 md:grid-cols-3">
        <Input class="border-slate-700 bg-slate-900" placeholder="id" bind:value={postureDraft.id} />
        <Input class="border-slate-700 bg-slate-900" placeholder="name" bind:value={postureDraft.name} />
        <select class="h-9 rounded-md border border-slate-700 bg-slate-900 px-3 text-sm text-slate-100" bind:value={postureDraft.check_type}><option value="os_version">os_version</option><option value="antivirus">antivirus</option><option value="disk_encryption">disk_encryption</option><option value="mfa">mfa</option><option value="geo_location">geo_location</option></select>
        <select
              bind:value={postureDraft.pass_action}
              class="h-10 w-full rounded-md border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100"
            >
              <option value="allow">allow</option>
              <option value="allow-with-warning">allow-with-warning</option>
              <option value="quarantine">quarantine</option>
            </select>
        <select
              bind:value={postureDraft.fail_action}
              class="h-10 w-full rounded-md border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100"
            >
              <option value="deny">deny</option>
              <option value="quarantine">quarantine</option>
              <option value="allow-limited">allow-limited</option>
              <option value="redirect">redirect</option>
            </select>
        <div><Button type="button" variant="outline" class="border-cyan-700 text-cyan-300" onclick={() => void createPosture()}>Add posture check</Button></div>
        <label class="space-y-1 text-sm md:col-span-3"><FieldLabel label="Parameters (JSON)" hint="Specific configuration parameters for the selected posture check type in JSON format." /><textarea class="min-h-20 w-full rounded-md border border-slate-700 bg-slate-900 p-2 font-mono text-xs text-slate-100" bind:value={postureParamsDraft}></textarea></label>
      </div>

      {#each postureChecks as item, i (item.id)}
        <div class="grid gap-2 rounded border border-slate-800 bg-slate-950 p-3 md:grid-cols-3">
          <Input class="border-slate-700 bg-slate-900" value={item.id} readonly />
          <Input class="border-slate-700 bg-slate-900" value={item.name} oninput={(e) => (postureChecks[i].name = (e.currentTarget as HTMLInputElement).value)} />
          <select class="h-9 rounded-md border border-slate-700 bg-slate-900 px-3 text-sm text-slate-100" value={item.check_type} onchange={(e) => (postureChecks[i].check_type = (e.currentTarget as HTMLSelectElement).value as PostureCheckType)}><option value="os_version">os_version</option><option value="antivirus">antivirus</option><option value="disk_encryption">disk_encryption</option><option value="mfa">mfa</option><option value="geo_location">geo_location</option></select>
          <Input class="border-slate-700 bg-slate-900" value={item.pass_action} oninput={(e) => (postureChecks[i].pass_action = (e.currentTarget as HTMLInputElement).value)} />
          <Input class="border-slate-700 bg-slate-900" value={item.fail_action} oninput={(e) => (postureChecks[i].fail_action = (e.currentTarget as HTMLInputElement).value)} />
          <div class="flex gap-2"><Button type="button" variant="outline" class="border-slate-700" onclick={() => void savePosture(item)}>Save</Button><Button type="button" variant="outline" class="border-red-700 text-red-300" onclick={() => void removePosture(item)}>Remove</Button></div>
          <label class="space-y-1 text-sm md:col-span-3"><FieldLabel label="Parameters (JSON)" hint="Specific configuration parameters for the selected posture check type in JSON format." /><textarea class="min-h-20 w-full rounded-md border border-slate-700 bg-slate-900 p-2 font-mono text-xs text-slate-100" value={JSON.stringify(item.parameters ?? {}, null, 2)} oninput={(e) => { try { postureChecks[i].parameters = JSON.parse((e.currentTarget as HTMLTextAreaElement).value) as unknown; } catch { } }}></textarea></label>
        </div>
      {/each}
    </CardContent>
  </Card>
</div>
