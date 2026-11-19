// Form behaviour as data. First slice: Drilling Progress.
// Phase 2 of the dynamic-UI plan moves these objects into Supabase (exp_form_def) and caches them in Dexie;
// the shape stays the same, so app.js does not change when that happens.

export const progressRules = [
  // Core result belongs to coring holes. Stays visible when the hole is not in the collar list yet,
  // or when the record already holds a core length (so an old row is never hidden from its owner).
  { target: '#corebox', showIf: { any: [{ fn: 'holeUnknown' }, { fn: 'isCoring' }, { field: 'core_len_m', filled: true }] } },
  // A downtime hour count needs a reason. The dot on the label and aria-required follow the rule.
  { target: 'label:has([name=downtime_reason])', requiredIf: { field: 'downtime_hours', gt: 0 } },
];
