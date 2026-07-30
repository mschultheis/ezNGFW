<!-- Route view for `/routing/acl` in the ezNGFW admin GUI. -->

<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '$lib/api/client';
  import { toasts } from '$lib/stores/toast';
  import FieldLabel from '$lib/components/admin/FieldLabel.svelte';
  import { Button } from '$lib/components/ui/button';
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '$lib/components/ui/card';
  import { Input } from '$lib/components/ui/input';
  import { _ } from '$lib/i18n';

  type Entry = { sequence: number; action: string; source: string; destination: string; protocol: string; port?: string | null; description: string };
  type Acl = { id?: string; name: string; description: string; entries: Entry[] };

  let loading = $state(true);
  let saving = $state(false);
  let lists = $state<Acl[]>([]);
  let form = $state<Acl>({ name: '', description: '', entries: [] });
  let entry = $state<Entry>({ sequence: 10, action: 'permit', source: '0.0.0.0/0', destination: '0.0.0.0/0', protocol: 'ip', port: '', description: '' });
  const PROTOCOL_OPTIONS = ['ip', 'tcp', 'udp', 'icmp', 'gre', 'esp', 'ah'];

  async function load() {
    loading = true;
    try {
      const data = await api.get('/routing/access-lists');
      lists = Array.isArray(data) ? (data as Acl[]) : [];
    } catch (e) {
      toasts.error(e instanceof Error ? e.message : 'Failed to load access lists');
    } finally {
      loading = false;
    }
  }

  function addEntry() {
    form.entries = [...form.entries, { ...entry }];
    entry = { sequence: entry.sequence + 10, action: 'permit', source: '0.0.0.0/0', destination: '0.0.0.0/0', protocol: 'ip', port: '', description: '' };
  }

  async function createList() {
    saving = true;
    try {
      await api.post('/routing/access-lists', form);
      form = { name: '', description: '', entries: [] };
      await load();
      toasts.success($_('routing_acl.toastaccess_list_created'));
    } catch (e) {
      toasts.error(e instanceof Error ? e.message : 'Failed to create access list');
    } finally {
      saving = false;
    }
  }

  async function saveList(item: Acl, idx: number) {
    saving = true;
    try {
      await api.put(`/routing/access-lists/${item.id ?? String(idx)}`, item);
      toasts.success($_('routing_acl.toastaccess_list_updated'));
    } catch (e) {
      toasts.error(e instanceof Error ? e.message : 'Failed to update access list');
    } finally {
      saving = false;
    }
  }

  async function removeList(item: Acl, idx: number) {
    saving = true;
    try {
      await api.del(`/routing/access-lists/${item.id ?? String(idx)}`);
      lists = lists.filter((_, i) => i !== idx);
      toasts.success($_('routing_acl.toastaccess_list_removed'));
    } catch (e) {
      toasts.error(e instanceof Error ? e.message : 'Failed to delete access list');
    } finally {
      saving = false;
    }
  }

  onMount(() => void load());
</script>

<Card class="border-slate-800 bg-slate-900">
  <CardHeader>
    <CardTitle class="text-slate-100">{$_('routing_acl.access_lists')}</CardTitle>
    <CardDescription class="text-slate-400">{$_('routing_acl.create_and_maintain_permitdeny_acl_entries_by_sour')}</CardDescription>
  </CardHeader>
  <CardContent class="space-y-4">
    {#if loading}
      <p class="text-sm text-slate-400">{$_('routing_acl.loading_acl_data')}</p>
    {:else}
      <div class="rounded border border-slate-800 p-4">
        <h3 class="mb-3 text-sm font-semibold text-slate-100">{$_('routing_acl.create_access_list')}</h3>
        <div class="grid gap-3 md:grid-cols-2">
          <div><FieldLabel label="ACL Name" hint="Set a stable ACL identifier referenced by routing policy, protocol filters, or route-maps. Use a consistent naming scheme to avoid operational ambiguity. Example: ACL-BGP-INTERNET-IN." /><Input class="mt-2 border-slate-700 bg-slate-950" bind:value={form.name} /></div>
          <div><FieldLabel label="Description" hint="Document ACL intent and ownership to simplify troubleshooting, audits, and handoff workflows. Include service context and traffic direction where possible. Example: Permit DNS from branch users to resolver farm." /><Input class="mt-2 border-slate-700 bg-slate-950" bind:value={form.description} /></div>
          <div><FieldLabel label="Sequence" hint="Set ACL entry order so matches are evaluated deterministically from lowest sequence upward. Leave spacing between values for future insertions under change control. Example: 10, 20, 30." /><Input type="number" class="mt-2 border-slate-700 bg-slate-950" bind:value={entry.sequence} /></div>
          <div><FieldLabel label="Action" hint="Choose permit or deny to allow or block matched packets according to policy intent. Explicit deny rules should be paired with clear descriptions for operations context. Example: deny to block RFC1918 egress leaks." /><select class="mt-2 h-9 w-full rounded-md border border-slate-700 bg-slate-950 px-3" bind:value={entry.action}><option value="permit">permit</option><option value="deny">deny</option></select></div>
          <div><FieldLabel label="Source CIDR" hint="Define source subnet or host used by ACL match evaluation for ingress/egress traffic control. Keep prefix specificity tight to reduce accidental overmatching. Example: 10.20.30.0/24." /><Input class="mt-2 border-slate-700 bg-slate-950" bind:value={entry.source} /></div>
          <div><FieldLabel label="Destination CIDR" hint="Define destination subnet or host this ACL entry targets for permit/deny logic. Use explicit service destination prefixes where possible for safer policy. Example: 192.0.2.0/24." /><Input class="mt-2 border-slate-700 bg-slate-950" bind:value={entry.destination} /></div>
          <div><FieldLabel label="Protocol" hint="Set layer-4 protocol selector for ACL matching to constrain policy to relevant flows. Use ip for protocol-agnostic matching when needed. Example: tcp for application service control." /><select class="mt-2 h-9 w-full rounded-md border border-slate-700 bg-slate-950 px-3" bind:value={entry.protocol}>{#each PROTOCOL_OPTIONS as option}<option value={option}>{option}</option>{/each}</select></div>
          <div><FieldLabel label="Port" hint="Optionally match destination or service port depending on ACL application context in routing policy. Leave blank for protocol-wide match when port is not required. Example: 443 for HTTPS traffic." /><Input class="mt-2 border-slate-700 bg-slate-950" bind:value={entry.port} /></div>
          <div class="md:col-span-2"><FieldLabel label="Entry Description" hint="Add a short explanation for why this ACL entry exists and expected outcomes for operators. This improves incident response speed and change safety reviews. Example: Permit branch POS terminals to payment gateway." /><Input class="mt-2 border-slate-700 bg-slate-950" bind:value={entry.description} /></div>
        </div>
        <Button variant="outline" class="mt-3 border-slate-700" onclick={addEntry}>Add Entry</Button>
        <div class="mt-2 text-sm text-slate-300">Pending entries: {form.entries.length}</div>
        <Button class="mt-3 bg-cyan-600 text-white hover:bg-cyan-500" onclick={createList} disabled={saving}>Create ACL</Button>
      </div>

      <div class="space-y-3">
        {#each lists as item, idx}
          <div class="rounded border border-slate-800 bg-slate-950 p-3">
            <div class="text-sm font-medium text-slate-100">{item.name} ({item.entries.length} entries)</div>
            <div class="text-sm text-slate-300">{item.description}</div>
            <div class="mt-2 flex gap-2"><Button variant="outline" class="border-slate-700" onclick={() => saveList(item, idx)}>Save</Button><Button variant="outline" class="border-red-700 text-red-300" onclick={() => removeList(item, idx)}>Delete</Button></div>
          </div>
        {/each}
      </div>
    {/if}
  </CardContent>
</Card>
