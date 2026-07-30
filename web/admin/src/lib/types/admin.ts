/**
 * Shared TypeScript types used across admin GUI components.
 *
 * Defines the form field descriptor (`FormField`), select option shape
 * (`SelectOption`), field type enum (`FieldType`), and table column
 * descriptor (`TableColumn`) consumed by `ConfigFormCard`,
 * `ResourceTable`, and `ReadOnlyTable`.
 */
/** Supported input types for dynamic form generation. */
export type FieldType = 'text' | 'number' | 'password' | 'textarea' | 'boolean' | 'select' | 'multiselect';

/** Label/value pair for <select> dropdown options. */
export type SelectOption = {
  label: string;
  value: string;
};

/** Descriptor for a single form field rendered by ConfigFormCard or ResourceTable. */
export type FormField = {
  key: string;
  label: string;
  type?: FieldType;
  placeholder?: string;
  required?: boolean;
  options?: SelectOption[];
  hint?: string;
  pattern?: string;
  min?: number;
  max?: number;
  step?: number;
  showWhen?: (model: Record<string, unknown>) => boolean;
};

/** Descriptor for a single column in ReadOnlyTable or ResourceTable. */
export type TableColumn = {
  key: string;
  label: string;
  mono?: boolean;
};
