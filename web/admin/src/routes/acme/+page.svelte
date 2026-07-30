<!-- Route view for `/acme` in the ezNGFW admin GUI. -->

<script lang="ts">
  import { onMount } from "svelte";
  import { api } from "$lib/api/client";
  import { toasts } from "$lib/stores/toast";
  import FieldLabel from "$lib/components/admin/FieldLabel.svelte";
  import { Badge } from "$lib/components/ui/badge";
  import { Button } from "$lib/components/ui/button";
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "$lib/components/ui/card";
  import { Input } from "$lib/components/ui/input";
  import { Switch } from "$lib/components/ui/switch";
  import * as Select from "$lib/components/ui/select";
  import ResourceTable from "$lib/components/admin/ResourceTable.svelte";
  import type { FormField, TableColumn } from "$lib/types/admin";
  import SaveIcon from "@lucide/svelte/icons/save";
  import RefreshCwIcon from "@lucide/svelte/icons/refresh-cw";
  import ChevronDownIcon from "@lucide/svelte/icons/chevron-down";
  import ChevronRightIcon from "@lucide/svelte/icons/chevron-right";
  import ShieldCheckIcon from "@lucide/svelte/icons/shield-check";
  import { _ } from "$lib/i18n";

  type AcmeSettings = {
    enabled: boolean;
    provider: string;
    email: string;
    renewDays: number;
    challengeType: string;
    dnsProvider: string;
    apiToken: string;
    apiSecret: string;
    keyType: string;
    ocspStapling: boolean;
    mustStaple: boolean;
    preferredChain: string;
    accountUri: string;
    eabKeyId: string;
    eabHmacKey: string;
    httpPort: number;
    tlsPort: number;
  };

  const defaults: AcmeSettings = {
    enabled: false, provider: "letsencrypt", email: "", renewDays: 30, challengeType: "http-01",
    dnsProvider: "cloudflare", apiToken: "", apiSecret: "", keyType: "ec256", ocspStapling: true,
    mustStaple: false, preferredChain: "", accountUri: "", eabKeyId: "", eabHmacKey: "",
    httpPort: 80, tlsPort: 443
  };

  const providerOptions = [
    { label: "Let\"s Encrypt", value: "letsencrypt" },
    { label: "Let\"s Encrypt (Staging)", value: "letsencrypt-staging" },
    { label: "ZeroSSL", value: "zerossl" },
    { label: "BuyPass", value: "buypass" },
    { label: "Google Trust Services", value: "google" },
    { label: "Custom ACME CA", value: "custom" }
  ];

  const challengeOptions = [
    { label: "HTTP-01 (port 80)", value: "http-01" },
    { label: "DNS-01 (DNS API)", value: "dns-01" },
    { label: "TLS-ALPN-01 (port 443)", value: "tls-alpn-01" }
  ];

  const dnsProviderOptions = [
    { label: "Cloudflare", value: "cloudflare" },
    { label: "AWS Route 53", value: "route53" },
    { label: "DigitalOcean", value: "digitalocean" },
    { label: "GoDaddy", value: "godaddy" },
    { label: "Hetzner", value: "hetzner" },
    { label: "Namecheap", value: "namecheap" },
    { label: "Google Cloud DNS", value: "gcloud" },
    { label: "Azure DNS", value: "azure" },
    { label: "Custom (RFC2136)", value: "custom" }
  ];

  const keyTypeOptions = [
    { label: "EC-256 (Recommended)", value: "ec256" },
    { label: "EC-384", value: "ec384" },
    { label: "RSA-2048", value: "rsa2048" },
    { label: "RSA-4096", value: "rsa4096" }
  ];

  const columns: TableColumn[] = [
    { key: "domain", label: "Domain" },
    { key: "status", label: "Status" },
    { key: "issuer", label: "Issuer" },
    { key: "expires", label: "Expires" },
    { key: "lastRenewed", label: "Last Renewed" }
  ];

  const fields: FormField[] = [
    { key: "domain", label: "Domain", type: "text", required: true, hint: "Primary domain name for the certificate." },
    { key: "altNames", label: "Subject Alt Names", type: "text", hint: "Additional domain names to include (comma-separated)." },
    { key: "challengeType", label: "Challenge Override", type: "select", options: [{ label: "Inherit global setting", value: "" }, ...challengeOptions], hint: "Override the global challenge type for this specific certificate." },
    { key: "keyType", label: "Key Type Override", type: "select", options: [{ label: "Inherit global setting", value: "" }, ...keyTypeOptions], hint: "Override the global key type for this certificate." },
    { key: "autoRenew", label: "Auto-Renew", type: "boolean", hint: "Automatically renew this certificate before it expires." },
    { key: "webhookUrl", label: "Webhook URL", type: "text", hint: "HTTP(S) URL that will receive a POST notification after renewal." }
  ];

  let settings = $state<AcmeSettings>({ ...defaults });
  let loading = $state(true);
  let saving = $state(false);
  let renewing = $state(false);
  let showAdvanced = $state(false);
  let showEab = $state(false);

  async function loadSettings() {
    loading = true;
    try {
      const payload = await api.get("/acme");
      settings = { ...defaults, ...(payload as Record<string, any>) };
    } catch (e) {
      toasts.error(e instanceof Error ? e.message : "Failed to load ACME settings");
    } finally {
      loading = false;
    }
  }

  async function saveSettings() {
    saving = true;
    try {
      await api.patch("/acme", settings);
      toasts.success($_('acme.toastacme_settings_saved'));
    } catch (e) {
      toasts.error(e instanceof Error ? e.message : "Failed to save ACME settings");
    } finally {
      saving = false;
    }
  }

  async function renewAll() {
    renewing = true;
    try {
      await api.post("/acme/renew-all");
      toasts.success($_('acme.toastrenewal_triggered_for_all_certificates'));
    } catch (e) {
      toasts.error(e instanceof Error ? e.message : "Renewal failed");
    } finally {
      renewing = false;
    }
  }

  onMount(() => { void loadSettings(); });
</script>

<div class="space-y-6">
  <Card class="border-slate-800 bg-slate-900">
    <CardHeader>
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <CardTitle class="flex items-center gap-2 text-slate-100">
            <ShieldCheckIcon class="size-5" /> ACME Settings
          </CardTitle>
          <CardDescription class="text-slate-400">
            Automate TLS certificate issuance and renewals using the ACME protocol.
          </CardDescription>
        </div>
        <div class="flex items-center gap-2">
          <Badge class="border-slate-700 bg-slate-800 text-slate-200">
            {challengeOptions.find((o) => o.value === settings.challengeType)?.label ?? settings.challengeType}
          </Badge>
          <Button variant="outline" class="cursor-pointer border-slate-700 text-slate-100" onclick={renewAll} disabled={renewing}>
            <RefreshCwIcon class="mr-2 size-4" />
            {renewing ? "Renewing..." : "Renew All"}
          </Button>
        </div>
      </div>
    </CardHeader>
    <CardContent>
      {#if !loading}
        <form class="space-y-5" onsubmit={(e) => { e.preventDefault(); void saveSettings(); }}>
          <div class="grid gap-4 md:grid-cols-2">
            <label class="space-y-1 text-sm md:col-span-2">
              <FieldLabel label="Enabled" hint="Enable automatic ACME certificate management." />
              <div class="flex h-9 items-center gap-3">
                <Switch checked={settings.enabled} onCheckedChange={(v) => (settings.enabled = v)} />
                <span class="text-xs" class:text-emerald-400={settings.enabled} class:text-slate-500={!settings.enabled}>
                  {settings.enabled ? "Active" : "Disabled"}
                </span>
              </div>
            </label>

            <label class="space-y-1 text-sm">
              <FieldLabel label="CA Provider" hint="Select the Certificate Authority that will issue your certificates." />
              <Select.Root type="single" value={settings.provider} onValueChange={(v) => { if (v) settings.provider = v; }}>
                <Select.Trigger class="mt-1 w-full cursor-pointer border-slate-700 bg-slate-900 text-slate-100">
                  <span>{providerOptions.find((o) => o.value === settings.provider)?.label ?? "Select..."}</span>
                </Select.Trigger>
                <Select.Content class="border-slate-700 bg-slate-900">
                  {#each providerOptions as opt}
                    <Select.Item value={opt.value} label={opt.label} class="cursor-pointer text-slate-200 hover:bg-slate-800" />
                  {/each}
                </Select.Content>
              </Select.Root>
            </label>

            <label class="space-y-1 text-sm">
              <FieldLabel label="Account Email" hint="Email address registered with the ACME CA." />
              <Input class="border-slate-700 bg-slate-950" type="email" value={settings.email} oninput={(e) => (settings.email = (e.currentTarget as HTMLInputElement).value)} />
            </label>

            <label class="space-y-1 text-sm">
              <FieldLabel label="Renew Before (Days)" hint="Start certificate renewal this many days before expiry." />
              <Input class="border-slate-700 bg-slate-950" type="number" value={String(settings.renewDays)} oninput={(e) => (settings.renewDays = Number((e.currentTarget as HTMLInputElement).value) || 30)} />
            </label>

            <label class="space-y-1 text-sm">
              <FieldLabel label="Challenge Type" hint="ACME challenge method used to prove domain ownership." />
              <Select.Root type="single" value={settings.challengeType} onValueChange={(v) => { if (v) settings.challengeType = v; }}>
                <Select.Trigger class="mt-1 w-full cursor-pointer border-slate-700 bg-slate-900 text-slate-100">
                  <span>{challengeOptions.find((o) => o.value === settings.challengeType)?.label ?? "Select..."}</span>
                </Select.Trigger>
                <Select.Content class="border-slate-700 bg-slate-900">
                  {#each challengeOptions as opt}
                    <Select.Item value={opt.value} label={opt.label} class="cursor-pointer text-slate-200 hover:bg-slate-800" />
                  {/each}
                </Select.Content>
              </Select.Root>
            </label>

            <label class="space-y-1 text-sm">
              <FieldLabel label="Key Type" hint="Cryptographic key algorithm for generated certificates." />
              <Select.Root type="single" value={settings.keyType} onValueChange={(v) => { if (v) settings.keyType = v; }}>
                <Select.Trigger class="mt-1 w-full cursor-pointer border-slate-700 bg-slate-900 text-slate-100">
                  <span>{keyTypeOptions.find((o) => o.value === settings.keyType)?.label ?? "Select..."}</span>
                </Select.Trigger>
                <Select.Content class="border-slate-700 bg-slate-900">
                  {#each keyTypeOptions as opt}
                    <Select.Item value={opt.value} label={opt.label} class="cursor-pointer text-slate-200 hover:bg-slate-800" />
                  {/each}
                </Select.Content>
              </Select.Root>
            </label>

            {#if settings.challengeType === "dns-01"}
              <label class="space-y-1 text-sm">
                <FieldLabel label="DNS Provider" hint="DNS hosting provider whose API will be used." />
                <Select.Root type="single" value={settings.dnsProvider} onValueChange={(v) => { if (v) settings.dnsProvider = v; }}>
                  <Select.Trigger class="mt-1 w-full cursor-pointer border-slate-700 bg-slate-900 text-slate-100">
                    <span>{dnsProviderOptions.find((o) => o.value === settings.dnsProvider)?.label ?? "Select..."}</span>
                  </Select.Trigger>
                  <Select.Content class="border-slate-700 bg-slate-900">
                    {#each dnsProviderOptions as opt}
                      <Select.Item value={opt.value} label={opt.label} class="cursor-pointer text-slate-200 hover:bg-slate-800" />
                    {/each}
                  </Select.Content>
                </Select.Root>
              </label>

              <label class="space-y-1 text-sm">
                <FieldLabel label="API Token" hint="API token or key with permission to manage DNS records." />
                <Input class="border-slate-700 bg-slate-950" type="password" value={settings.apiToken} oninput={(e) => (settings.apiToken = (e.currentTarget as HTMLInputElement).value)} />
              </label>

              <label class="space-y-1 text-sm md:col-span-2">
                <FieldLabel label="API Secret" hint="Secondary secret paired with the API token." />
                <Input class="border-slate-700 bg-slate-950" type="password" value={settings.apiSecret} oninput={(e) => (settings.apiSecret = (e.currentTarget as HTMLInputElement).value)} />
              </label>
            {/if}

            {#if settings.challengeType === "http-01"}
              <label class="space-y-1 text-sm">
                <FieldLabel label="HTTP Challenge Port" hint="Port the ACME client listens on for HTTP-01 challenges." />
                <Input class="border-slate-700 bg-slate-950" type="number" value={String(settings.httpPort)} oninput={(e) => (settings.httpPort = Number((e.currentTarget as HTMLInputElement).value) || 80)} />
              </label>
            {/if}

            {#if settings.challengeType === "tls-alpn-01"}
              <label class="space-y-1 text-sm">
                <FieldLabel label="TLS Challenge Port" hint="Port the ACME client uses for TLS-ALPN-01 challenges." />
                <Input class="border-slate-700 bg-slate-950" type="number" value={String(settings.tlsPort)} oninput={(e) => (settings.tlsPort = Number((e.currentTarget as HTMLInputElement).value) || 443)} />
              </label>
            {/if}
          </div>

          <button type="button" class="flex cursor-pointer items-center gap-1 text-sm font-medium text-cyan-400 hover:text-cyan-300" onclick={() => (showAdvanced = !showAdvanced)}>
            {#if showAdvanced}<ChevronDownIcon class="size-4" />{:else}<ChevronRightIcon class="size-4" />{/if}
            Advanced Options
          </button>

          {#if showAdvanced}
            <div class="grid gap-4 rounded-md border border-slate-800 bg-slate-950/50 p-4 md:grid-cols-2">
              <label class="space-y-1 text-sm">
                <FieldLabel label="OCSP Stapling" hint="Enable OCSP stapling to include the CA status response." />
                <div class="flex h-9 items-center gap-3">
                  <Switch checked={settings.ocspStapling} onCheckedChange={(v) => (settings.ocspStapling = v)} />
                  <span class="text-xs" class:text-emerald-400={settings.ocspStapling} class:text-slate-500={!settings.ocspStapling}>
                    {settings.ocspStapling ? "Stapling enabled" : "Stapling disabled"}
                  </span>
                </div>
              </label>

              <label class="space-y-1 text-sm">
                <FieldLabel label="OCSP Must-Staple" hint="Request the CA to include the OCSP Must-Staple extension." />
                <div class="flex h-9 items-center gap-3">
                  <Switch checked={settings.mustStaple} onCheckedChange={(v) => (settings.mustStaple = v)} />
                  <span class="text-xs" class:text-amber-400={settings.mustStaple} class:text-slate-500={!settings.mustStaple}>
                    {settings.mustStaple ? "Must-Staple flag set" : "Not set"}
                  </span>
                </div>
              </label>

              <label class="space-y-1 text-sm">
                <FieldLabel label="Preferred Chain" hint="Select which certificate chain the CA should return." />
                <Input class="border-slate-700 bg-slate-950" value={settings.preferredChain} oninput={(e) => (settings.preferredChain = (e.currentTarget as HTMLInputElement).value)} />
              </label>

              <label class="space-y-1 text-sm">
                <FieldLabel label="Account URI" hint="ACME account URL from a previous registration." />
                <Input class="border-slate-700 bg-slate-950 font-mono text-xs" value={settings.accountUri} oninput={(e) => (settings.accountUri = (e.currentTarget as HTMLInputElement).value)} />
              </label>
            </div>

            <button type="button" class="ml-4 flex cursor-pointer items-center gap-1 text-sm font-medium text-slate-400 hover:text-slate-300" onclick={() => (showEab = !showEab)}>
              {#if showEab}<ChevronDownIcon class="size-4" />{:else}<ChevronRightIcon class="size-4" />{/if}
              External Account Binding (EAB)
            </button>

            {#if showEab}
              <div class="ml-4 grid gap-4 rounded-md border border-slate-800 bg-slate-950/30 p-4 md:grid-cols-2">
                <label class="space-y-1 text-sm">
                  <FieldLabel label="EAB Key ID" hint="External Account Binding key identifier." />
                  <Input class="border-slate-700 bg-slate-950 font-mono text-xs" value={settings.eabKeyId} oninput={(e) => (settings.eabKeyId = (e.currentTarget as HTMLInputElement).value)} />
                </label>

                <label class="space-y-1 text-sm">
                  <FieldLabel label="EAB HMAC Key" hint="Base64-encoded HMAC key paired with the EAB Key ID." />
                  <Input class="border-slate-700 bg-slate-950 font-mono text-xs" type="password" value={settings.eabHmacKey} oninput={(e) => (settings.eabHmacKey = (e.currentTarget as HTMLInputElement).value)} />
                </label>
              </div>
            {/if}
          {/if}

          <div class="flex items-center gap-3 pt-2">
            <Button type="submit" class="cursor-pointer bg-cyan-600 text-white hover:bg-cyan-700" disabled={saving}>
              <SaveIcon class="mr-2 size-4" />
              {saving ? "Saving..." : "Save ACME Settings"}
            </Button>
          </div>
        </form>
      {/if}
    </CardContent>
  </Card>

  <ResourceTable
    title={$_('acme.titlemanaged_certificates')}
    description={$_('acme.descriptioncertificates_automatically_issued_and_r')}
    endpoint="/acme/certificates"
    columns={columns}
    fields={fields}
    idKey="domain"
    addLabel={$_('acme.addlabeladd_certificate')}
  />
</div>