// The adjustable parameters of the Lab Analysis workbook / Data QC, grouped like the workbook's Parameter sheet.
// Stored as one JSON object in exp_setting 'qaqc_thresholds' (see qc/calc.js thresholds()). Item: [key, label, unit, min, max, step, scale]
// scale 100 = stored as a fraction, edited as a percentage. 'dup_ard_ni_max.PD' addresses the nested duplicate limits.
export const PARAM_SECTIONS = [
  { title: 'A. Geochemical classification (in order: BRK, RSAP, SAP, CEK, LIM)', items: [
    ['brk_ni', 'BRK: Ni below', '%', 0, 10, 0.05], ['brk_mgo', 'BRK: MgO at least', '%', 0, 60, 0.5], ['brk_fe', 'BRK: Fe below', '%', 0, 60, 0.5],
    ['rsap_mgo', 'RSAP: MgO at least', '%', 0, 60, 0.5], ['rsap_fe', 'RSAP: Fe below', '%', 0, 60, 0.5],
    ['sap_fe', 'SAP: Fe below', '%', 0, 60, 0.5], ['sap_mgo', 'SAP: MgO at least', '%', 0, 60, 0.5], ['sap_mgo_min', 'SAP via low Fe: MgO minimum (below = CEK)', '%', 0, 60, 0.5]] },
  { title: 'B. Laterite indication (Al2O3 and Cr2O3)', items: [
    ['al_hi', 'Al2O3 high (at least)', '%', 0, 100, 0.5], ['al_mid', 'Al2O3 medium (at least)', '%', 0, 100, 0.5], ['al_vhi', 'Al2O3 very high flag (at least)', '%', 0, 100, 0.5],
    ['cr_hi', 'Cr2O3 high (at least)', '%', 0, 100, 0.1], ['cr_mid', 'Cr2O3 medium (at least)', '%', 0, 100, 0.1], ['cr_vhi', 'Cr2O3 very high flag, possible chromite (at least)', '%', 0, 100, 0.1]] },
  { title: 'C. Data consistency', items: [
    ['fe2o3_tol_pct', 'Fe2O3 vs Fe x 1.4297 tolerance', '%', 0, 100, 0.5], ['mc_max', 'Moisture high (at least)', '%', 0, 100, 1]] },
  { title: 'D. QAQC limits', items: [
    ['blank_ni_max', 'Blank: Ni maximum', '%', 0, 5, 0.01], ['dup_ard_ni_max.PD', 'Pulp duplicate (PD): Ni ARD maximum', '%', 0, 100, 1, 100],
    ['dup_ard_ni_max.CD', 'Coarse duplicate (CD): Ni ARD maximum', '%', 0, 100, 1, 100], ['dup_ard_ni_max.RD', 'Reject duplicate (RD): Ni ARD maximum', '%', 0, 100, 1, 100],
    ['crm_z_warn', 'CRM warning |Z|', 'SD', 0, 10, 0.5], ['crm_z_fail', 'CRM fail |Z|', 'SD', 0, 10, 0.5], ['lab_resolution', 'Lab reporting resolution (Z skipped when CRM SD is below)', '%', 0, 1, 0.001]] },
  { title: 'E. Sample flow and survey checks', items: [
    ['sent_warn_days', 'Sample sent, no result: warning after', 'days', 0, 365, 1], ['sent_fail_days', 'Sample sent, no result: critical after', 'days', 0, 365, 1],
    ['dip_dev_warn', 'Dip deviation, collar vs survey', 'deg', 0, 90, 1], ['gps_warn_m', 'GPS accuracy worse than', 'm', 0, 1000, 1]] },
  { title: 'F. Ore composite and IDW maps', items: [
    ['cutoff_ni', 'Ni cut-off (at least)', '%', 0, 10, 0.05], ['idw_p', 'IDW distance power', '', 0.5, 6, 0.5], ['idw_r', 'IDW search radius', 'm', 10, 5000, 10],
    ['idw_min', 'IDW minimum points', 'points', 1, 50, 1], ['idw_buf', 'IDW grid buffer', 'm', 0, 2000, 10]] },
];
export const getParam = (T, key) => key.split('.').reduce((o, k) => o?.[k], T);
export function setParam(obj, key, v) { const ks = key.split('.'); let o = obj; for (const k of ks.slice(0, -1)) o = (o[k] = o[k] || {}); o[ks.at(-1)] = v; }
