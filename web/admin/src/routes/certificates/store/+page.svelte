<!-- Route view for `/certificates/store` in the ezNGFW admin GUI. -->

<script lang="ts">
  import ResourceTable from '$lib/components/admin/ResourceTable.svelte';
  import type { FormField, TableColumn } from '$lib/types/admin';
  import { _ } from '$lib/i18n';

  const endpoint = '/certificates';

  const columns: TableColumn[] = [
    { key: 'id', label: 'ID', mono: true },
    { key: 'name', label: 'Name' },
    { key: 'type', label: 'Type' },
    { key: 'issuer', label: 'Issuer' },
    { key: 'validTo', label: 'Expires', mono: true },
    { key: 'enabled', label: 'Enabled' }
  ];

  const fields: FormField[] = [
    { key: 'id', label: 'Certificate ID', type: 'text', required: true, hint: 'Internal certificate identifier.' },
    { key: 'name', label: 'Certificate Name', type: 'text', required: true, hint: 'Friendly name for the certificate.' },
    { key: 'enabled', label: 'Enabled', type: 'boolean', hint: 'Enable this record for assignment.' },
    { key: 'type', label: 'Type', type: 'select', required: true, options: [
      { value: 'server', label: 'Server' },
      { value: 'client', label: 'Client' },
      { value: 'ca', label: 'Certificate Authority' }
    ], hint: 'Record type determines validation use-cases.' },
    { key: 'issuer', label: 'Issuer', type: 'text', required: true, hint: 'Issuing authority for chain verification.' },
    { key: 'subject', label: 'Subject', type: 'text', required: true, hint: 'Subject distinguished name.' },
    { key: 'san', label: 'SAN', type: 'text', hint: 'Subject Alternative Names.' },
    { key: 'validFrom', label: 'Valid From', type: 'text', required: true, hint: 'Start date for validity.' },
    { key: 'validTo', label: 'Valid To', type: 'text', required: true, hint: 'Expiration date.' },
    { key: 'keyAlgorithm', label: 'Algorithm', type: 'select', required: true, options: [
      { value: 'rsa', label: 'RSA' },
      { value: 'ecdsa', label: 'ECDSA' }
    ], hint: 'Private key algorithm.' },
    { key: 'keySize', label: 'Key Size', type: 'select', required: true, options: [
      { value: '2048', label: '2048-bit' },
      { value: '3072', label: '3072-bit' },
      { value: '4096', label: '4096-bit' }
    ], hint: 'Key size for cryptographic strength.' },
    { key: 'imported', label: 'Imported', type: 'boolean', hint: 'Indicates if record was imported.' },
    { key: 'autoRenew', label: 'Auto Renew', type: 'boolean', hint: 'Enable auto-renew workflow.' },
    { key: 'renewBeforeDays', label: 'Renew Before Days', type: 'number', hint: 'Lead time before expiration for renewal.' },
    { key: 'chainValidation', label: 'Chain Validation', type: 'select', options: [
      { value: 'strict', label: 'Strict' },
      { value: 'compat', label: 'Compatibility' }
    ], hint: 'Validation mode for chain continuity.' },
    { key: 'notes', label: 'Notes', type: 'textarea', hint: 'Operational notes and ownership.' }
  ];
</script>

<div class="space-y-6 bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900 p-4 text-slate-100 md:p-6">
  <ResourceTable
    title={$_('certificates_store.titlecertificate_store')}
    description={$_('certificates_store.descriptionmanage_certificates_cas_and_trust_ancho')}
    endpoint={endpoint}
    columns={columns}
    fields={fields}
    addLabel={$_('certificates_store.addlabeladd_certificate')}
  />
</div>
