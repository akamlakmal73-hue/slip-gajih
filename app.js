/* ===== Data master per cabang ===== */
const JATAH_LIBUR = 2;
const DO = [["uangDO","Uang DO"]];
const CABANG = {
  pwk_kiloan: { nama:"Purwokerto Kiloan", manual:[["bonusOrang","Bonus Per Orang"],["bonusCabang","Bonus Per Cabang"]],
    gp:[700000,800000], um:[10000,15000], tr:10000, lembur:5000, ganti:40000 },
  pwk_self:   { nama:"Purwokerto Self Service", manual:DO,
    gp:[900000,900000], um:[10000,10000], tr:10000, lembur:5000, ganti:50000 },
  cil_self:   { nama:"Cileungsi Self Service", manual:DO,
    gp:[1000000,1100000], um:[15000,15000], tr:15000, lembur:5000, ganti:70000 }
};
const TARIF = ["gp","um","tr","lembur","ganti"];
const TEKS  = ["periode","tanggal","nama","jabatan","telp","jenis","masa"];
const ANGKA = ["hk","libur","jam"];

/* ===== Util ===== */
const $ = id => document.getElementById(id);
const num = v => Math.max(0, parseFloat(v) || 0);
const rp = n => (n<0?"-":"") + "Rp " + Math.round(Math.abs(n)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
const n0 = n => rp(n).replace("Rp ","");
const esc = s => String(s).replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const hariIni = () => new Date(Date.now() - new Date().getTimezoneOffset()*60000).toISOString().slice(0,10);
const fmtTgl = s => s ? s.split("-").reverse().join("/") : "";
function toast(m){ const t=$("toast"); t.textContent=m; t.className="on"; clearTimeout(toast.x); toast.x=setTimeout(()=>t.className="",2200); }
function ke(id){ if(id==="home") $("sub").textContent="Slip Gaji Bunayya"; ["home","form","prev"].forEach(s=>$(s).classList.toggle("hide",s!==id)); window.scrollTo(0,0); }

function terbilang(n){
  n = Math.floor(Math.abs(n));
  const s = ["","satu","dua","tiga","empat","lima","enam","tujuh","delapan","sembilan","sepuluh","sebelas"];
  const f = n => {
    if (n<12) return s[n];
    if (n<20) return f(n-10)+" belas";
    if (n<100) return f(Math.floor(n/10))+" puluh"+(n%10?" "+f(n%10):"");
    if (n<200) return "seratus"+(n%100?" "+f(n%100):"");
    if (n<1000) return f(Math.floor(n/100))+" ratus"+(n%100?" "+f(n%100):"");
    if (n<2000) return "seribu"+(n%1000?" "+f(n%1000):"");
    if (n<1e6) return f(Math.floor(n/1000))+" ribu"+(n%1000?" "+f(n%1000):"");
    if (n<1e9) return f(Math.floor(n/1e6))+" juta"+(n%1e6?" "+f(n%1e6):"");
    return f(Math.floor(n/1e9))+" miliar"+(n%1e9?" "+f(n%1e9):"");
  };
  const t = n===0 ? "nol" : f(n);
  return "(" + t.charAt(0).toUpperCase() + t.slice(1) + " rupiah)";
}

/* ===== State ===== */
const formAwal = () => ({periode:"",tanggal:hariIni(),hk:26,nama:"",jabatan:"",telp:"",jenis:"15",masa:"kurang3",libur:0,jam:0});
let S = { cabang:null, form:formAwal(), tarif:{}, manual:{}, potongan:[] };

/* ===== Penyimpanan lokal ===== */
const KEY = "bunayya_slip_v1";
let DB = { karyawan:{}, riwayat:{}, alamat:{} };
try { const d = JSON.parse(localStorage.getItem(KEY)); if (d && d.karyawan && d.riwayat) DB = d; } catch(e) {}
DB.alamat = DB.alamat || {};
function simpanDB(){ try { localStorage.setItem(KEY, JSON.stringify(DB)); return true; } catch(e){ toast("Penyimpanan tidak tersedia di browser ini"); return false; } }

/* ===== Tarif otomatis ===== */
function tarifOtomatis(){
  const c = CABANG[S.cabang], m = S.form.masa;
  return { gp: c.gp[m==="lebih12"?1:0], um: c.um[m==="kurang3"?0:1], tr:c.tr, lembur:c.lembur, ganti:c.ganti };
}
function isiTarif(){ S.tarif = tarifOtomatis(); for (const k in S.tarif) $("t_"+k).value = S.tarif[k]; }

/* ===== Navigasi ===== */
function pilihCabang(k){
  S.cabang = k; S.manual = {}; S.potongan = []; S.form = formAwal();
  $("sub").textContent = CABANG[k].nama;
  $("hManual").textContent = CABANG[k].manual.map(x=>x[1]).join(" / ") + " (isi manual)";
  $("manual").innerHTML = CABANG[k].manual.map(([id,l]) =>
    `<label>${l} (Rp)</label><input id="m_${id}" type="number" inputmode="numeric" min="0">`).join("");
  $("alamatCabang").value = DB.alamat[k] || "";
  isiForm(S.form);
  isiTarif(); renderPilih(); renderPot(); renderRiwayat(); baca(); ke("form");
}
function ubahMasa(){ S.form.masa = $("masa").value; isiTarif(); }
function isiForm(f){ f.tanggal = f.tanggal || hariIni(); [...TEKS,...ANGKA].forEach(k=>$(k).value=f[k]); }
/* satu pendengar untuk semua kolom di form (tidak perlu oninput di tiap kolom) */
["input","change"].forEach(e=>$("form").addEventListener(e,baca));

/* ===== Baca form -> state -> hitung ===== */
function baca(){
  const f = S.form;
  TEKS.forEach(k=>f[k]=$(k).value.trim());
  ANGKA.forEach(k=>f[k]=num($(k).value));
  TARIF.forEach(k=>S.tarif[k]=num($("t_"+k).value));
  CABANG[S.cabang].manual.forEach(([id])=>S.manual[id]=num($("m_"+id).value));
  const ac = $("alamatCabang").value.trim();
  if ((DB.alamat[S.cabang]||"") !== ac) { DB.alamat[S.cabang] = ac; simpanDB(); }
  $("bersih").textContent = rp(hitung().bersih);
  const rk = rkey(); if (rk !== baca.k) { baca.k = rk; renderRiwayat(); }
}

/* ===== Perhitungan gaji ===== */
function hitung(){
  const f=S.form, t=S.tarif, P=[], D=[];
  const lebih = Math.max(0, f.libur - JATAH_LIBUR), sisa = Math.max(0, JATAH_LIBUR - f.libur);
  P.push({l:"Gaji Pokok", v:t.gp});
  if (f.jenis === "30") {
    if (lebih) D.push({l:`Potongan GP libur lebih ${lebih} hari`, v:t.gp/30*lebih});
  } else {
    P.push({l:`Uang Makan (${f.hk} hari)`, v:t.um*f.hk});
    P.push({l:`Uang Transport (${f.hk} hari)`, v:t.tr*f.hk});
    P.push({l:`Lembur (${f.jam} jam)`, v:t.lembur*f.jam});
    if (sisa) P.push({l:`Libur tidak diambil (${sisa} hari)`, v:t.ganti*sisa});
    CABANG[S.cabang].manual.forEach(([id,l]) => P.push({l, v:S.manual[id]||0}));
    if (lebih) D.push({l:`Potongan UM+Transport libur lebih ${lebih} hari`, v:(t.um+t.tr)*lebih});
  }
  S.potongan.forEach(p => { if (p.nominal>0 || p.nama) D.push({l:p.nama||"Potongan", v:p.nominal}); });
  const tp = P.reduce((a,x)=>a+x.v,0), td = D.reduce((a,x)=>a+x.v,0);
  return { P, D, total:tp, potong:td, bersih:tp-td };
}

/* ===== Potongan tambahan ===== */
function tambahPot(){ S.potongan.push({nama:"",nominal:0}); renderPot(); }
function renderPot(){
  $("potList").innerHTML = S.potongan.map((p,i)=>
    `<div class="pot"><input placeholder="Nama potongan" value="${esc(p.nama)}" oninput="S.potongan[${i}].nama=this.value">
     <input type="number" inputmode="numeric" placeholder="Rp" value="${p.nominal||""}" oninput="S.potongan[${i}].nominal=num(this.value)">
     <button onclick="S.potongan.splice(${i},1);renderPot();baca()" aria-label="Hapus">✕</button></div>`).join("");
}

/* ===== Data karyawan & riwayat ===== */
function daftar(){ return DB.karyawan[S.cabang] || []; }
function renderPilih(){
  $("pilih").innerHTML = '<option value="">- Pilih karyawan -</option>' + daftar().map((k,i)=>`<option value="${i}">${esc(k.nama)} (${esc(k.jabatan)})</option>`).join("");
}
function pakaiKaryawan(i){
  if (i==="") return; const k = daftar()[i]; if(!k) return;
  $("nama").value=k.nama; $("jabatan").value=k.jabatan; $("telp").value=k.telp||""; $("masa").value=k.masa;
  S.form.masa=k.masa; isiTarif(); baca();
}
function simpanKaryawan(){
  baca(); const f=S.form; if(!f.nama){ toast("Isi nama dulu"); return; }
  const arr = DB.karyawan[S.cabang] = daftar(); const i = arr.findIndex(k=>k.nama.toLowerCase()===f.nama.toLowerCase());
  const d = {nama:f.nama, jabatan:f.jabatan, telp:f.telp, masa:f.masa};
  if (i>=0) arr[i]=d; else arr.push(d);
  if (simpanDB()) { renderPilih(); toast("Karyawan tersimpan"); }
}
function hapusKaryawan(){
  const i=$("pilih").value; if(i===""){ toast("Pilih karyawan dulu"); return; }
  konfirm("Hapus "+daftar()[i].nama+"?", ()=>{
    daftar().splice(i,1); simpanDB(); renderPilih();
    ["nama","jabatan","telp"].forEach(id=>$(id).value="");
    $("masa").value="kurang3"; S.form.masa="kurang3"; isiTarif(); baca();
    toast("Karyawan dihapus");
  });
}
/* Konfirmasi 2x tekan (confirm() bawaan sering diblokir di preview) */
let _k = null;
function konfirm(msg, fn){
  if (_k === msg) { clearTimeout(konfirm.x); _k = null; fn(); return; }
  _k = msg; toast(msg + " Tekan lagi untuk yakin");
  clearTimeout(konfirm.x); konfirm.x = setTimeout(()=>{ _k = null; }, 3500);
}
const rkey = () => S.cabang+"|"+S.form.nama.toLowerCase();
function simpanSlip(){
  baca(); if(!S.form.nama){ toast("Isi nama dulu"); return; }
  const h = hitung(), arr = DB.riwayat[rkey()] = DB.riwayat[rkey()] || [];
  arr.unshift({ tgl:hariIni(), form:{...S.form}, tarif:{...S.tarif}, manual:{...S.manual}, potongan:S.potongan.map(p=>({...p})), bersih:h.bersih });
  if (simpanDB()) { renderRiwayat(); toast("Slip masuk riwayat"); }
}
function renderRiwayat(){
  const arr = S.form.nama ? (DB.riwayat[rkey()]||[]) : [];
  $("riwayat").innerHTML = arr.length ? arr.map((r,i)=>
    `<div class="rw"><span onclick="muatRiwayat(${i})">${esc(r.form.periode||r.tgl)} - Tgl ${r.form.jenis}<br><b>${rp(r.bersih)}</b></span>
     <button class="s x" onclick="hapusRiwayat(${i})">✕</button></div>`).join("")
    : '<span class="kosong">Belum ada riwayat.</span>';
}
function muatRiwayat(i){
  const r = DB.riwayat[rkey()][i];
  S.form={...formAwal(),...r.form}; S.tarif={...r.tarif}; S.manual={...r.manual}; S.potongan=r.potongan.map(p=>({...p}));
  isiForm(S.form);
  for (const k in S.tarif) $("t_"+k).value=S.tarif[k];
  CABANG[S.cabang].manual.forEach(([id])=>$("m_"+id).value=S.manual[id]||"");
  renderPot(); baca(); toast("Riwayat dimuat");
}
function hapusRiwayat(i){ konfirm("Hapus riwayat ini?", ()=>{ DB.riwayat[rkey()].splice(i,1); simpanDB(); renderRiwayat(); }); }

/* ===== Preview slip (gaya baru) ===== */
function judul(){ return "BUNAYYA " + CABANG[S.cabang].nama.toUpperCase(); }
function lihat(){
  baca(); const f=S.form, h=hitung(), ac=DB.alamat[S.cabang]||"";
  const row = (l,v)=>`<div class="tr"><span>${esc(l)}</span><span>${v}</span></div>`;
  $("paper").innerHTML = `<div class="paper">
    <div class="pt">SLIP GAJI KARYAWAN</div>
    <div class="pco"><div><b>${esc(judul())}</b>${ac?`<small>${esc(ac)}</small>`:""}</div>
      <div class="tg">Tanggal &nbsp;: ${esc(fmtTgl(f.tanggal))}</div></div>
    <div class="hr"></div>
    <div class="pin">
      <div><span class="k">Nama</span>: ${esc(f.nama)}<br><span class="k">Jabatan</span>: ${esc(f.jabatan)}</div>
      <div><span class="k">Telp.</span>: ${esc(f.telp)}</div>
    </div>
    <div class="hr"></div>
    <div class="tb"><span>Keterangan</span><span>Jumlah</span></div>
    ${h.P.map(x=>row(x.l,n0(x.v))).join("")}
    <div class="tr tot"><span>(+)</span><span>${n0(h.total)}</span></div>
    ${h.D.length ? `<div style="height:12px"></div>${h.D.map(x=>row(x.l,n0(x.v))).join("")}
    <div class="tr tot"><span>(-)</span><span>-${n0(h.potong)}</span></div>` : ""}
    <div class="tx"><i>${esc(terbilang(h.bersih))}</i>
      <div class="r"><span>Total Diterima:</span><span>Rp ${n0(h.bersih)}</span></div></div>
    <div class="sg">Mengetahui<div class="sp"></div>Pemilik Toko<br>Bunayya</div>
  </div>`;
  ke("prev");
}

/* ===== Download PDF (jsPDF, A5) ===== */
function buatPDF(){
  if (!(window.jspdf && window.jspdf.jsPDF)) { toast("jsPDF belum termuat, cek koneksi"); return null; }
  baca();
  // Perkecil otomatis sampai muat 1 halaman
  let r=gambarPDF(1,true);
  let k=Math.min(1,(210-14)/r.yEnd);
  r=gambarPDF(k);
  while (r.d.getNumberOfPages()>1 && k>0.3){ k=Math.round((k-0.04)*100)/100; r=gambarPDF(k); }
  return r;
}
function gambarPDF(k,ukur){
  const f=S.form, h=hitung(), ac=DB.alamat[S.cabang]||"";
  const d=new window.jspdf.jsPDF({unit:"mm",format:"a5"});
  const W=148, H=210, mx=10, R=W-mx, BIRU=[207,220,247];
  const s=n=>n*k; let y=s(16);
  const cek = n=>{ if (!ukur && y+n>H-8){ d.addPage(); y=s(16); } };
  const garis = yy=>{ d.setDrawColor(150,150,150); d.setLineWidth(0.3); d.line(mx,yy,R,yy); };

  // Judul + garis bawah
  d.setFont("helvetica","bold"); d.setFontSize(s(13)); d.setTextColor(0,0,0);
  const jt="SLIP GAJI KARYAWAN", tw=d.getTextWidth(jt);
  d.text(jt,W/2,y,{align:"center"}); d.setDrawColor(0,0,0); d.setLineWidth(0.4); d.line(W/2-tw/2,y+1.3,W/2+tw/2,y+1.3);
  y+=s(12);

  // Perusahaan + tanggal
  d.setFontSize(s(11)); d.text(judul(),mx,y);
  d.setFont("helvetica","normal"); d.setFontSize(s(9)); d.text("Tanggal",92,y); d.text(": "+fmtTgl(f.tanggal),108,y);
  d.setFontSize(s(8)); const al=ac?d.splitTextToSize(ac,76):[];
  al.forEach((t,i)=>d.text(t,mx,y+s(5)+i*s(4)));
  y+=Math.max(s(6), s(5)+al.length*s(4))+s(3); garis(y); y+=s(6);

  // Info karyawan
  d.setFontSize(s(10));
  d.text("Nama",mx,y); d.text(": "+(f.nama||""),mx+16,y);
  d.text("Jabatan",mx,y+s(5.5)); d.text(": "+(f.jabatan||""),mx+16,y+s(5.5));
  d.text("Telp.",78,y); d.text(": "+(f.telp||""),92,y);
  y+=s(12); garis(y); y+=s(5);

  // Header tabel
  d.setFillColor(...BIRU); d.rect(mx,y,R-mx,s(7.5),"F");
  d.setFont("helvetica","bold"); d.setFontSize(s(10));
  d.text("Keterangan",mx+45,y+s(5.2),{align:"center"}); d.text("Jumlah",R-2,y+s(5.2),{align:"right"});
  y+=s(12);

  const baris = (l,v,bold)=>{
    d.setFont("helvetica",bold?"bold":"normal"); d.setFontSize(s(10));
    const ls=d.splitTextToSize(l,88); cek(ls.length*s(5)+3);
    ls.forEach((t,i)=>d.text(t,mx+2,y+i*s(5)));
    d.text(v,R-2,y+(ls.length-1)*s(5),{align:"right"});
    y+=ls.length*s(5)+s(2.5);
  };
  h.P.forEach(x=>baris(x.l,n0(x.v)));
  y+=s(2); baris("(+)",n0(h.total),true);
  if (h.D.length){ y+=s(4); h.D.forEach(x=>baris(x.l,n0(x.v))); y+=s(2); baris("(-)","-"+n0(h.potong),true); }

  // Kotak total diterima
  d.setFont("helvetica","bolditalic"); d.setFontSize(s(9));
  const tb=d.splitTextToSize(terbilang(h.bersih),R-mx-6);
  const bh=tb.length*s(4.5)+s(13); cek(bh+s(40)); y+=s(4);
  d.setFillColor(...BIRU); d.rect(mx,y,R-mx,bh,"F");
  tb.forEach((t,i)=>d.text(t,mx+3,y+s(5.5)+i*s(4.5)));
  const by=y+tb.length*s(4.5)+s(8);
  d.setFont("helvetica","bold"); d.setFontSize(s(10));
  d.text("Total Diterima:",mx+3,by); d.text("Rp "+n0(h.bersih),R-3,by,{align:"right"});
  y+=bh+s(8);

  // Tanda tangan
  d.setFont("helvetica","normal"); d.setFontSize(s(10));
  d.text("Mengetahui",mx+3,y); y+=s(20);
  d.text("Pemilik Toko",mx+3,y); d.text("Bunayya",mx+3,y+s(5));

  const nama = "Slip-"+(f.nama||"karyawan").replace(/[^\w-]+/g,"_")+"-"+(f.periode||"").replace(/[^\w-]+/g,"_")+".pdf";
  return {d, nama, yEnd:y+s(5)};
}
async function unduhPDF(){
  const r=buatPDF(); if(!r) return; const {d,nama}=r;
  try {
    const dl = window.claude && claude.use ? await claude.use("downloads") : null;
    if (dl) { await dl.save({filename:nama, data:d.output("arraybuffer")}); return; }
  } catch(e){ if (e && e.code==="declined") return; }
  d.save(nama);
}

/* ===== Kirim WhatsApp (PDF lewat menu share HP) ===== */
async function kirimWA(){
  const r=buatPDF(); if(!r) return; const {d,nama}=r;
  const f=S.form, h=hitung();
  const blob=d.output("blob");
  const file=new File([blob],nama,{type:"application/pdf"});
  const judulPesan="Slip Gaji "+(f.periode||"");
  // Cadangan: HP/browser tidak mendukung share file -> unduh PDF, lalu buka WhatsApp
  const t = [`*${judul()} - SLIP GAJI*`,`Periode: ${f.periode||"-"}`,`Nama: ${f.nama||"-"}`,`Jabatan: ${f.jabatan||"-"}`,``,
    ...h.P.map(x=>`${x.l}: ${rp(x.v)}`), ...(h.D.length?[``,`Potongan:`,...h.D.map(x=>`${x.l}: -${rp(x.v)}`)]:[]),
    ``,`*GAJI BERSIH: ${rp(h.bersih)}*`].join("\n");
  let no=(f.telp||"").replace(/\D/g,"");
  if (no.startsWith("0")) no="62"+no.slice(1); else if (no.startsWith("8")) no="62"+no;
  // buka WhatsApp dulu (harus langsung dari tap), baru unduh PDF
  window.open("https://wa.me/"+no+"?text="+encodeURIComponent(t),"_blank");
  toast("PDF diunduh. Lampirkan di WhatsApp (📎 → Dokumen)");
  await unduhPDF();
}
