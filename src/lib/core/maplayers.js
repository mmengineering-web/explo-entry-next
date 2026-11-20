// Layer peta: uploaded and kept ON THIS DEVICE ONLY (IndexedDB). Nothing is sent to the server; every user adds their own layers.
export async function viewMapLayers(box, toast, ask, info, onChange) {
  const D = await import('./db.js');
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const TYPE = { polygon: 'Poligon', line: 'Garis', point: 'Titik', mixed: 'Campuran' };
  const rows = (await D.db.maplayers.toArray()).sort((a, b) => (b.sort_order ?? 0) - (a.sort_order ?? 0));
  const reload = () => { viewMapLayers(box, toast, ask, info, onChange); onChange?.(); };
  box.innerHTML = `<div class="card"><h3>Layer peta (hanya di perangkat ini)</h3>
    <div class="helpbox">Unggah <b>shapefile</b> (satu file <b>.zip</b> berisi .shp .dbf .prj, atau pilih .shp + .dbf + .prj sekaligus) atau <b>GeoJSON</b>. Koordinat dikonversi otomatis ke lat/lon (CRS dibaca dari .prj; tanpa .prj dianggap UTM sesuai zona di Pengaturan). <b>File tidak dikirim ke server</b>: hanya tersimpan di perangkat ini dan tidak ikut ke perangkat lain.</div>
    <div class="newuser"><div class="row"><label>Nama layer<input id="ml-name" placeholder="mis. IUP WKM, Jalan hauling, Geologi"></label><label>File<input id="ml-file" type="file" multiple accept=".zip,.shp,.dbf,.prj,.cpg,.geojson,.json"></label></div>
      <div id="ml-msg"></div><button class="btn primary" id="ml-go">Tampilkan di peta</button></div>
    ${rows.length ? `<div class="gridwrap"><table class="grid"><thead><tr><th>Nama</th><th>Jenis</th><th>Objek</th><th>Sumber</th><th></th></tr></thead><tbody>
      ${rows.map(r => `<tr><td class="c-pk">${esc(r.name)}</td><td>${esc(TYPE[r.geom_type] || r.geom_type || '')}</td><td class="c-num">${r.feature_count ?? ''}</td><td>${esc(r.source_file || '')}${r.source_crs ? ` <span class="muted small">(${esc(r.source_crs)})</span>` : ''}</td>
        <td><button class="btn small" data-ren="${esc(r.id)}">Ganti nama</button> <button class="btn small danger" data-del="${esc(r.id)}">Hapus</button></td></tr>`).join('')}
      </tbody></table></div>` : '<p class="muted">Belum ada layer.</p>'}</div>`;
  box.querySelector('#ml-go').onclick = async ev => {
    const msg = box.querySelector('#ml-msg'), btn = ev.target; msg.innerHTML = ''; btn.disabled = true;
    try {
      const files = box.querySelector('#ml-file').files;
      if (!files.length) throw new Error('Pilih file shapefile (.zip) atau GeoJSON.');
      const { setting } = await import('./cfg.js');
      const zn = setting('utm_zone');
      msg.innerHTML = '<div class="msg ok">Membaca file…</div>';
      const { readFiles } = await import('./shp.js');
      const r = await readFiles(files, { utm: zn ? { zone: Number(zn), hemisphere: setting('utm_hemisphere') || 'S' } : null });
      const name = box.querySelector('#ml-name').value.trim() || r.source.replace(/\.[^.]+$/, '');
      const top = rows.length ? Math.max(...rows.map(x => x.sort_order ?? 0)) : 0;
      await D.db.maplayers.put({ id: crypto.randomUUID(), name, geom_type: r.geom_type, feature_count: r.feature_count, geojson: r.geojson, style: {}, sort_order: top + 10, source_file: r.source, source_crs: r.crs, updated_at: new Date().toISOString() });
      toast(`Layer "${name}" ditambahkan (${r.feature_count} objek)`); reload();
    } catch (e) { msg.innerHTML = `<div class="msg err">${esc(e.message || e)}</div>`; btn.disabled = false; }
  };
  box.querySelectorAll('[data-ren]').forEach(b => b.onclick = async () => {
    const r = rows.find(x => x.id === b.dataset.ren); const n = prompt('Nama baru layer:', r.name); if (!n || !n.trim()) return;
    await D.db.maplayers.update(r.id, { name: n.trim(), updated_at: new Date().toISOString() }); toast('Nama diubah'); reload();
  });
  box.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => {
    const r = rows.find(x => x.id === b.dataset.del);
    if (!await ask(`Hapus layer "${r.name}" dari perangkat ini? (file asli tetap ada di komputer Anda)`, { title: 'Hapus layer?', ok: 'Hapus', danger: true })) return;
    await D.db.maplayers.delete(r.id); toast('Dihapus'); reload();
  });
}
