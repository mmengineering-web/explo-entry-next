// Hands a record from one tab to the form that edits it (Data Records, record lists -> the form tab).
// The form picks it up once, when it mounts.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const pending: Record<string, any> = {};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const setEditing = (tbl: string, rec: any) => { pending[tbl] = rec; };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const takeEditing = (tbl: string): any => { const r = pending[tbl] ?? null; delete pending[tbl]; return r; };

export const FORM_OF: Record<string, string> = { progress: "progress", collars: "collar", disthours: "hours", samples: "sample" };
export const TAB_OF: Record<string, string> = { progress: "progress", collars: "collars", disthours: "hours", samples: "samples" };
