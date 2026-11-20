# Phone test checklist

Test on at least: one Android phone (Chrome) and one iPhone (Safari). Use test Hole IDs starting with `TEST-`. Write the result in the table at the end.

## Install and login
- [ ] Open the address, install it (Android: menu > Install app; iPhone: Share > Add to Home Screen). The icon is the Explo logo.
- [ ] Open from the home screen: full screen, no browser bar.
- [ ] Log in with a geologist account. The site name and role show in the header.
- [ ] Log out and back in.

## Offline input (turn on airplane mode after the first login)
- [ ] The app still opens from the home screen.
- [ ] Add a Collar `TEST-01`: GPS button fills the position and accuracy, camera button opens the camera, gallery button opens the gallery.
- [ ] Add Drilling Progress for it, Distribution Hour, and a Sample.
- [ ] The sync chip shows the number pending.
- [ ] Use "Input tanpa login" (guest) once and add a record.
- [ ] Turn airplane mode off: pending goes to 0 within about a minute, or tap the sync button.
- [ ] Records and photos show in Data Records and in Supabase.

## Import and exports
- [ ] Download the Excel template, fill two rows, import. The preview shows ready, warning and rejected rows correctly.
- [ ] Import a lab RoA PDF (Nama lab filled). The preview looks right.
- [ ] Laporan: copy and share work.
- [ ] Data Records: Excel backup and photo backup download and open.

## Analysis (online)
- [ ] Dashboard: charts draw, Chart/Table toggle works, Excel and PDF download.
- [ ] Data QC: tabs open, Lab analysis (Excel) downloads and opens in Excel.
- [ ] Peta: map and collars show, a shapefile or GeoJSON layer uploads, PDF map exports.
- [ ] 3D Hole: scene appears. One finger rotates, two fingers pan, pinch zooms, Reset view returns. Tap a hole opens its interval table. Switching colour by Class / Ni / Fe / MgO repaints. Note how smooth it feels (smooth / slightly slow / too slow). If it starts in "Plan + section" on its own, the phone was judged low power; switch to 3D and note the result.

## Admin account (site admin or super admin)
- [ ] Pengaturan: change a rig name or a code, save, sync on a second device.
- [ ] Data QC > Lab Analysis > Parameter: edit a yellow cell, save, reload: the value stayed. Reset to defaults afterwards.
- [ ] Super admin: create a user, reset a password (Edge Function).

## Release behaviour
- [ ] After a new deploy, the app shows "A new version is ready". Close and reopen: new version runs, data and login are still there.

## Clean up
- [ ] Soft delete the `TEST-` records.

## Result table
| Device | OS and browser | All steps OK? | Problems (step, what happened) | 3D feel |
|---|---|---|---|---|
|  |  |  |  |  |
|  |  |  |  |  |
