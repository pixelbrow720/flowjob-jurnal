import React, { useState, useEffect, useRef } from 'react';
import './Education.css';

const LOCK_PASSWORD = '140700';

const DEFAULT_WEEKS = {
  1: {
    title: 'Foundation — Auction Logic & Market Structure',
    phase: 'Intensive Learning',
    locked: false,
    slides: [
      {
        id: 's1-0',
        type: 'intro',
        title: 'Minggu 1: Fondasi Orderflow',
        body: `Selamat datang di Minggu 1 Bootcamp Orderflow!\n\nMinggu ini kita akan membangun fondasi paling penting: memahami pasar bukan dari price action biasa, tapi dari perspektif **Auction Theory** — cara institusi dan smart money benar-benar bekerja di market.\n\n**Yang akan kamu pelajari:**\n• Auction Logic & Supply-Demand Dynamics\n• Auction Completion vs Continuation\n• High Volume Node (HVN) vs Low Volume Node (LVN)\n• Market Structure: BOS, SHoCH, Liquidity Grab\n• Order Block Validation\n• Liquidity Mapping & POC\n\n**Tugas Minggu Ini:**\nIdentifikasi HVN/LVN pada chart dan dokumentasikan 10 contoh auction completion.`,
        image: null,
        imagePlaceholder: null,
      },
      {
        id: 's1-1',
        type: 'concept',
        title: 'Apa itu Auction Theory?',
        body: `**Auction Theory** adalah cara pasar menemukan harga yang "fair" melalui proses tawar-menawar antara buyer dan seller.\n\nMarket selalu bergerak antara dua kondisi:\n\n**1. Balancing (Ranging)**\nSaat buyer & seller setara — pasar bergerak sideways, volume terdistribusi merata. Market sedang "mencari nilai."\n\n**2. Trending (Imbalance)**\nSaat satu pihak dominan — harga bergerak kuat ke satu arah. Market telah menemukan consensus dan mendorong ke area baru.\n\n**Key Insight:**\nTrader orderflow tidak bertanya "kemana harga akan pergi?" tapi "siapa yang kontrol saat ini — buyer atau seller? Dan apakah mereka committed?"`,
        image: null,
        imagePlaceholder: '[PLACEHOLDER: Diagram Auction — tampilkan balancing zone (sideways) vs trending move, dengan label "Value Area" di tengah dan arrows menunjukkan imbalance breakout ke atas dan bawah]',
      },
      {
        id: 's1-2',
        type: 'concept',
        title: 'Supply & Demand Dynamics',
        body: `**Supply** = area di mana seller bersedia menjual agresif (penawaran tinggi)\n**Demand** = area di mana buyer bersedia membeli agresif (permintaan tinggi)\n\n**Bagaimana Supply-Demand Terbentuk:**\n• Institutional orders yang belum terisi penuh\n• Area di mana harga sebelumnya bergerak cepat (FVG/imbalance)\n• Reversal point yang meninggalkan "ekor" panjang pada candle\n\n**Cara Membacanya Secara Orderflow:**\nSupply-demand bukan hanya "zone di chart" — kamu harus memvalidasi dengan:\n• Apakah ada absorbed volume di area tersebut?\n• Apakah delta berubah arah di area ini?\n• Apakah ada liquidity yang di-sweep sebelum reversal?\n\n**Catatan:** Jangan trade supply-demand blind — tanpa konfirmasi orderflow, banyak zona yang akan "fail."`,
        image: null,
        imagePlaceholder: '[PLACEHOLDER: Chart supply-demand zones — tunjukkan zona demand di bawah (hijau/transparan) dan supply di atas (merah/transparan). Contoh nyata pada chart futures/forex dengan reaction yang jelas di setiap zona]',
      },
      {
        id: 's1-3',
        type: 'concept',
        title: 'Auction Completion vs Continuation',
        body: `Salah satu skill paling krusial: membedakan kapan auction **selesai** vs kapan ia **berlanjut**.\n\n**Auction Completion (Selesai):**\n• Harga mencapai area yang "unfair" (terlalu jauh dari value)\n• Volume mulai menurun saat harga melanjutkan move\n• Delta exhaustion — seller/buyer mulai habis\n• Biasanya diikuti reversal kembali ke value area\n\n**Auction Continuation (Berlanjut):**\n• Setiap pullback di-support oleh fresh orders\n• Volume pada impuls lebih besar dari pullback\n• Delta tetap searah dengan trend\n• Breakout dari value area lama ke value area baru\n\n**Cara Praktis:**\nSetelah breakout, perhatikan retest. Kalau retest di-absorb kuat → continuation. Kalau retest langsung reversal dengan delta flip → completion/failed auction.`,
        image: null,
        imagePlaceholder: '[PLACEHOLDER: Dua chart side-by-side. Kiri: Auction Completion — harga naik, delta turun (divergence), reversal. Kanan: Auction Continuation — breakout, retest, absorbed, lanjut naik. Tambahkan delta histogram di bawah chart]',
      },
      {
        id: 's1-4',
        type: 'concept',
        title: 'HVN vs LVN — Volume Profile',
        body: `**Volume Profile** adalah distribusi volume berdasarkan harga (bukan waktu). Ini tools paling penting dalam orderflow.\n\n**HVN — High Volume Node:**\n• Area harga di mana BANYAK transaksi terjadi\n• Market spent a lot of time here = "fair value"\n• Harga cenderung lambat ketika melewati HVN (rotasi/chop)\n• Berfungsi sebagai support/resistance magnet\n\n**LVN — Low Volume Node:**\n• Area harga di mana SEDIKIT transaksi terjadi\n• Market moved quickly through this area = "unfair price"\n• Harga cenderung bergerak CEPAT melewati LVN (gap-like behavior)\n• Berfungsi sebagai "void" yang menarik harga untuk diisi\n\n**POC (Point of Control):**\n→ Level harga dengan volume TERTINGGI dalam range tertentu\n→ Sering menjadi magnet price setelah divergence\n\n**Trading Application:**\n• Entry saat harga di LVN? Awas — harga bisa slip!\n• Target di HVN? Kurangi size atau partial exit\n• HVN yang di-break → retest yang kuat kemungkinan lebih tinggi`,
        image: null,
        imagePlaceholder: '[PLACEHOLDER: Volume Profile pada chart dengan label jelas: HVN (bar panjang = merah), LVN (bar pendek = kuning), POC (garis horizontal putus-putus di harga tertinggi volume). Tunjukkan bagaimana harga berinteraksi berbeda di HVN vs LVN]',
      },
      {
        id: 's1-5',
        type: 'concept',
        title: 'Market Structure — Break of Structure (BOS)',
        body: `**Market Structure** adalah kerangka membaca arah dan konteks pasar sebelum mencari entry.\n\n**Break of Structure (BOS):**\nTerjadi saat harga menembus swing high/low yang signifikan, mengkonfirmasi perubahan arah structural.\n\n**Bullish BOS:**\n• Harga breaks above previous significant swing HIGH\n• Konfirmasi: close di atas level, bukan hanya wick\n• Artinya: struktur pasar berganti bullish\n\n**Bearish BOS:**\n• Harga breaks below previous significant swing LOW\n• Konfirmasi: close di bawah level\n• Artinya: struktur pasar berganti bearish\n\n**Cara Membacanya dengan Orderflow:**\nBOS yang valid biasanya disertai:\n+ Volume spike saat break\n+ Delta positif (untuk bullish BOS)\n+ Tidak ada immediate rejection/reversal\n\n**Catatan:** BOS tanpa volume spike → suspek. Kemungkinan false break atau liquidity hunt.`,
        image: null,
        imagePlaceholder: '[PLACEHOLDER: Chart yang menunjukkan sequence: Lower Lows & Lower Highs (bearish structure) → BOS ke atas (break swing high) → Higher Highs & Higher Lows mulai terbentuk. Beri label jelas di setiap swing point dan garis horizontal di level BOS]',
      },
      {
        id: 's1-6',
        type: 'concept',
        title: 'Shift of Character (SHoCH / CHoCH)',
        body: `**Change of Character (CHoCH)** adalah tanda AWAL perubahan struktur — lebih dini dari BOS.\n\n**Perbedaan CHoCH vs BOS:**\n• **CHoCH** = harga gagal melanjutkan trend (lower high di uptrend, higher low di downtrend)\n• **BOS** = konfirmasi perubahan struktur (break swing yang signifikan)\n→ CHoCH → Entry Early (higher risk, higher reward)\n→ BOS → Entry Confirmation (lower risk, lower reward)\n\n**Bullish CHoCH:**\nDalam downtrend yang terbentuk lower highs & lower lows — tiba-tiba harga membuat HIGHER LOW. Ini adalah pertama kali structure terputus.\n\n**Bearish CHoCH:**\nDalam uptrend — tiba-tiba harga membuat LOWER HIGH. Pertanda buyer mulai habis.\n\n**Filter dengan Orderflow:**\nCHoCH paling valid kalau disertai:\n• Delta divergence (price bikin lower low, delta tidak bikin lower low baru)\n• Absorption di area reversal\n• Failed auction dari sisi yang sedang kehilangan kontrol\n\nGunakan CHoCH untuk antisipasi, BOS untuk konfirmasi entry.`,
        image: null,
        imagePlaceholder: '[PLACEHOLDER: Chart downtrend dengan sequence: LL → LH → LL → LH → CHoCH (higher low terbentuk) → BOS ke atas. Beri warna berbeda: downtrend structure = merah, CHoCH point = kuning, BOS = hijau. Tambahkan delta histogram yang menunjukkan divergence di titik CHoCH]',
      },
      {
        id: 's1-7',
        type: 'concept',
        title: 'Liquidity Grab (Stop Hunt)',
        body: `**Liquidity Grab** adalah salah satu setup paling powerful dalam orderflow trading.\n\n**Mengapa Liquidity Grab Terjadi?**\nInstitutional orders membutuhkan counterparty. Untuk membeli dalam jumlah besar, mereka perlu penjual. Penjual terbanyak? → Stop loss dari yang sedang long.\nJadi institusi mendorong harga ke bawah swing low (di mana stop loss terkumpul), trigger stop mereka, lalu beli dari stop yang tereksekusi tersebut.\n\n**Tanda-tanda Liquidity Grab:**\n• Harga menembus swing high/low secara singkat (wick/spike)\n• Langsung reversal kembali — tidak ada close di luar level\n• Volume tinggi pada candle yang break (likuiditas di-absorb)\n• Delta flip: seller aktif saat break, langsung berbalik ke buyer\n\n**Yang Harus Kamu Cari:**\n→ Identifikasi di mana stop loss berkumpul (equal highs/lows, obvious swing points)\n→ Tunggu price mendekati area tersebut\n→ Perhatikan apakah ada sweep + immediate rejection\n→ Konfirmasi dengan delta flip dan absorption\n\n*"Don't be the stop. Be the one who hunts the stop."*`,
        image: null,
        imagePlaceholder: '[PLACEHOLDER: Chart yang menunjukkan liquidity grab — equal lows yang jelas (horizontal line), kemudian spike ke bawah yang menembus equal lows, langsung reversal naik kuat. Beri anotasi: "Stop Loss Cluster Here" di equal lows, "Sweep & Reject" di titik spike, "Smart Money Buying" setelah reversal. Tambahkan delta yang flip dari negatif ke positif saat reversal]',
      },
      {
        id: 's1-8',
        type: 'concept',
        title: 'Order Block Validation',
        body: `**Order Block (OB)** adalah zona harga di mana institutional orders besar ditempatkan, meninggalkan jejak yang terlihat di chart.\n\n**Cara Identifikasi Order Block:**\n• Cari candle terakhir berlawanan arah sebelum impuls besar\n• Contoh Bullish OB: candle merah terakhir sebelum strong bullish move\n• Contoh Bearish OB: candle hijau terakhir sebelum strong bearish move\n\n**Valid OB:**\n• OB berasal dari area HVN atau demand/supply yang jelas\n• Imbalance/FVG setelah OB (menunjukkan urgensi move)\n• Belum pernah di-retest sebelumnya (pristine OB)\n• Delta searah dengan direction OB saat impuls terbentuk\n\n**Invalid / Low Quality OB:**\n• OB sudah beberapa kali di-retest\n• OB berada di area LVN (bisa di-skip dengan cepat)\n• Tidak ada imbalance setelah OB\n• Volume impuls rendah\n\n**Entry pada OB:**\nTunggu harga kembali (mitigation) ke OB, cari konfirmasi absorption atau delta divergence di OB, baru entry.`,
        image: null,
        imagePlaceholder: '[PLACEHOLDER: Chart dengan dua contoh Order Block: (1) Bullish OB — highlight candle merah terakhir sebelum impuls naik, kotak di area OB, tunjukkan harga return ke OB dan reversal. (2) Bearish OB — sama tapi sebaliknya. Label: "Institutional Order Block", "Unmitigated", "Mitigation + Entry Zone"]',
      },
      {
        id: 's1-9',
        type: 'concept',
        title: 'Liquidity Mapping — Pool, Swept Levels & POC',
        body: `**Liquidity Mapping** adalah proses memetakan di mana "amunisi" (likuiditas) berada di chart SEBELUM kamu entry.\n\n**3 Jenis Liquidity yang Harus Dipetakan:**\n\n**1. Liquidity Pool (Stop Cluster)**\n→ Equal highs / equal lows (horizontal)\n→ Obvious swing points yang banyak dilihat trader\n→ Round numbers (1.2000, 45000, dll)\n→ PDH/PDL (Previous Day High/Low)\n\n**2. Swept Levels**\n→ Level yang sudah di-sweep = "sudah bersih"\n→ Setelah sweep, area tersebut lebih kecil kemungkinan jadi resistance/support kuat\n→ Gunakan sebagai filter: jangan expect reversal di area yang sudah di-sweep\n\n**3. Unfinished Auction**\n→ Area di mana harga bergerak sangat cepat (LVN zone)\n→ Pasar "belum selesai" melakukan transaksi di area tersebut\n→ Harga memiliki tendensi untuk kembali mengisi area ini\n\n**Workflow Liquidity Mapping:**\n→ Buka chart higher timeframe (H4/Daily)\n→ Tandai semua equal highs/lows, PDH/PDL\n→ Identifikasi mana yang sudah di-sweep vs belum\n→ Cari LVN zones (unfinished auction)\n→ Baru masuk ke lower TF untuk entry`,
        image: null,
        imagePlaceholder: '[PLACEHOLDER: Chart H4 atau Daily dengan anotasi lengkap liquidity mapping: (1) Equal Highs + label "Buy-Side Liquidity", (2) Equal Lows + label "Sell-Side Liquidity", (3) PDH dan PDL dengan label, (4) Satu area yang sudah di-swept diberi tanda "Swept", (5) LVN zone di-highlight. Gunakan warna berbeda untuk setiap tipe]',
      },
      {
        id: 's1-10',
        type: 'homework',
        title: 'Tugas Minggu 1 & Review',
        body: `**Ringkasan Minggu 1:**\n+ Auction Theory — pasar adalah proses tawar-menawar yang mencari fair value\n+ Supply-Demand Dynamics — validasi dengan orderflow, bukan hanya zone\n+ HVN/LVN — distribusi volume menentukan kecepatan pergerakan harga\n+ Market Structure — BOS & CHoCH sebagai framework arah\n+ Liquidity Grab — stop hunt adalah setup, bukan risiko\n+ Order Block — institutional footprint yang bisa di-trade\n+ Liquidity Mapping — petakan amunisi sebelum entry\n\n---\n\n**TUGAS WAJIB:**\n\n**Tugas 1 — Identifikasi HVN/LVN:**\nBuka 5 chart instrument yang biasa kamu trade. Pasang Volume Profile (Fixed Range atau Session). Tandai semua HVN dan LVN yang terlihat. Screenshot dan simpan.\n\n**Tugas 2 — 10 Contoh Auction Completion:**\nCari 10 contoh di mana harga menunjukkan tanda auction completion (delta exhaustion, volume drop, reversal ke value area). Screenshot setiap contoh beserta penjelasan singkat mengapa kamu mengidentifikasinya sebagai completion.\n\n**Deadline:** Sebelum sesi Week 2 dimulai\n\n---\n\n**Mindset Check:**\n*"Kamu tidak sedang belajar trading. Kamu sedang belajar bahasa yang digunakan market. Setelah fluent, entry dan exit akan terasa natural — bukan gambling."*`,
        image: null,
        imagePlaceholder: null,
      },
    ],
  },
  2:  { title: 'Liquidity Mapping & Level Building',         phase: 'Intensive Learning',      locked: false, slides: [] },
  3:  { title: 'Footprint Reading & Delta Divergence',       phase: 'Intensive Learning',      locked: false, slides: [] },
  4:  { title: 'Imbalance & Fair Value Gap (FVG)',           phase: 'Intensive Learning',      locked: false, slides: [] },
  5:  { title: 'Pattern Library & Context Filtering',        phase: 'Intensive Learning',      locked: false, slides: [] },
  6:  { title: 'Finalisasi 3 Setup Kandidat',                phase: 'Intensive Learning',      locked: false, slides: [] },
  7:  { title: 'Backtest Setup A & B',                       phase: 'Backtest & Validation',   locked: false, slides: [] },
  8:  { title: 'Backtest Setup C & Evaluasi',                phase: 'Backtest & Validation',   locked: false, slides: [] },
  9:  { title: 'Forward Test Setup Terpilih',                phase: 'Forward Test',            locked: false, slides: [] },
  10: { title: 'Lanjutan Forward Test & Evaluasi Data',      phase: 'Forward Test',            locked: false, slides: [] },
  11: { title: 'Forward Test dengan Parameter Adjustment',   phase: 'Refinement & Adjustment', locked: false, slides: [] },
  12: { title: 'Finalisasi Sistem & Dry Run',                phase: 'Refinement & Adjustment', locked: false, slides: [] },
};

const PHASE_COLORS = {
  'Intensive Learning':      '#8670ff',
  'Backtest & Validation':   '#ffaa00',
  'Forward Test':            '#00d4ff',
  'Refinement & Adjustment': '#ff0095',
};

const SLIDE_TYPE_LABELS = {
  intro:    'Intro',
  concept:  'Concept',
  homework: 'Task',
};

export default function Education() {
  const [weeks, setWeeks] = useState(() => {
    try {
      const saved = localStorage.getItem('fj_education_weeks');
      return saved ? JSON.parse(saved) : DEFAULT_WEEKS;
    } catch { return DEFAULT_WEEKS; }
  });

  const [selectedWeek, setSelectedWeek]       = useState(1);
  const [currentSlide, setCurrentSlide]       = useState(0);
  const [passwordModal, setPasswordModal]     = useState({ open: false, action: null, weekNum: null });
  const [passwordInput, setPasswordInput]     = useState('');
  const [passwordError, setPasswordError]     = useState('');
  const [editingSlide, setEditingSlide]       = useState(null);
  const [editContent, setEditContent]         = useState({});
  const [addSlideModal, setAddSlideModal]     = useState(false);
  const [newSlide, setNewSlide]               = useState({ title: '', body: '', type: 'concept', imagePlaceholder: '' });
  const [confirmDeleteModal, setConfirmDeleteModal] = useState(null);
  const slideRef = useRef(null);

  useEffect(() => {
    localStorage.setItem('fj_education_weeks', JSON.stringify(weeks));
  }, [weeks]);

  useEffect(() => {
    setCurrentSlide(0);
    setEditingSlide(null);
  }, [selectedWeek]);

  const week       = weeks[selectedWeek];
  const slides     = week?.slides || [];
  const isLocked   = week?.locked || false;
  const phaseColor = PHASE_COLORS[week?.phase] || '#8670ff';

  const goToSlide = (idx) => {
    if (idx >= 0 && idx < slides.length) setCurrentSlide(idx);
  };

  const openLockModal = (action, weekNum) => {
    setPasswordModal({ open: true, action, weekNum });
    setPasswordInput('');
    setPasswordError('');
  };
  const closeLockModal = () => setPasswordModal({ open: false, action: null, weekNum: null });

  const confirmPassword = () => {
    if (passwordInput === LOCK_PASSWORD) {
      const { action, weekNum } = passwordModal;
      setWeeks(prev => ({ ...prev, [weekNum]: { ...prev[weekNum], locked: action === 'lock' } }));
      closeLockModal();
    } else {
      setPasswordError('Password salah. Coba lagi.');
      setPasswordInput('');
    }
  };

  const startEdit = (slideIndex) => {
    if (isLocked) return;
    setEditingSlide({ weekNum: selectedWeek, slideIndex });
    setEditContent({ ...slides[slideIndex] });
  };

  const saveEdit = () => {
    if (!editingSlide) return;
    setWeeks(prev => {
      const updated = [...prev[editingSlide.weekNum].slides];
      updated[editingSlide.slideIndex] = { ...editContent };
      return { ...prev, [editingSlide.weekNum]: { ...prev[editingSlide.weekNum], slides: updated } };
    });
    setEditingSlide(null);
  };

  const addSlide = () => {
    if (isLocked) return;
    const slide = {
      id: `s${selectedWeek}-${Date.now()}`,
      type: newSlide.type,
      title: newSlide.title || 'Slide Baru',
      body: newSlide.body || '',
      image: null,
      imagePlaceholder: newSlide.imagePlaceholder || null,
    };
    setWeeks(prev => ({
      ...prev,
      [selectedWeek]: { ...prev[selectedWeek], slides: [...prev[selectedWeek].slides, slide] },
    }));
    setCurrentSlide(weeks[selectedWeek].slides.length);
    setAddSlideModal(false);
    setNewSlide({ title: '', body: '', type: 'concept', imagePlaceholder: '' });
  };

  const deleteSlide = (slideIndex) => {
    setWeeks(prev => {
      const updated = prev[selectedWeek].slides.filter((_, i) => i !== slideIndex);
      return { ...prev, [selectedWeek]: { ...prev[selectedWeek], slides: updated } };
    });
    setCurrentSlide(prev => Math.max(0, prev - 1));
    setConfirmDeleteModal(null);
  };

  const renderBody = (text) => {
    if (!text) return null;
    return text.split('\n').map((line, i) => {
      if (line.startsWith('**') && line.endsWith('**')) {
        return <p key={i} className="edu-body-heading">{line.replace(/\*\*/g, '')}</p>;
      }
      if (line.startsWith('• ') || line.startsWith('→ ') || line.startsWith('+ ')) {
        const fmt = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        return <li key={i} className="edu-body-li" dangerouslySetInnerHTML={{ __html: fmt }} />;
      }
      if (/^\d+\. /.test(line)) {
        const fmt = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        return <li key={i} className="edu-body-li edu-body-li-num" dangerouslySetInnerHTML={{ __html: fmt }} />;
      }
      if (line.startsWith('---')) return <hr key={i} className="edu-body-divider" />;
      if (line === '') return <br key={i} />;
      const fmt = line
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>');
      return <p key={i} className="edu-body-p" dangerouslySetInnerHTML={{ __html: fmt }} />;
    });
  };

  const currentSlideData = slides[currentSlide];

  return (
    <div className="edu-wrap fade-in">
      <div className="page-header">
        <h1 className="page-title">Education Center</h1>
        <p className="page-subtitle">Materi Bootcamp Orderflow — Kurikulum 3 Bulan</p>
      </div>

      <div className="edu-layout">

        {/* ── Week Selector Sidebar ── */}
        <div className="edu-sidebar">
          <div className="edu-sidebar-label">Minggu</div>
          {Object.entries(weeks).map(([num, data]) => {
            const pc         = PHASE_COLORS[data.phase] || '#8670ff';
            const isSelected = parseInt(num) === selectedWeek;
            return (
              <button
                key={num}
                className={`edu-week-btn ${isSelected ? 'active' : ''}`}
                onClick={() => setSelectedWeek(parseInt(num))}
                style={{
                  borderColor: isSelected ? `${pc}44` : undefined,
                  background:  isSelected ? `${pc}11` : undefined,
                  color:       isSelected ? pc        : undefined,
                }}
              >
                <span className="edu-week-num">W{num}</span>
                <span className="edu-week-title">{data.title}</span>
                <span className="edu-week-badge" style={{ background: pc }}>
                  {data.slides?.length || 0}
                </span>
                {data.locked && (
                  <span className="edu-week-lock-dot" style={{ background: '#ffaa00' }} />
                )}
              </button>
            );
          })}
        </div>

        {/* ── Main Content ── */}
        <div className="edu-main">

          {/* Week Header */}
          <div className="edu-week-header" style={{ borderColor: `${phaseColor}44` }}>
            <div className="edu-week-header-left">
              <div className="edu-phase-badge" style={{ background: `${phaseColor}22`, color: phaseColor, borderColor: `${phaseColor}44` }}>
                {week?.phase}
              </div>
              <h2 className="edu-week-heading">
                Minggu {selectedWeek}: {week?.title}
              </h2>
            </div>
            <div className="edu-week-header-right">
              <div className="edu-slide-count">
                {slides.length} slide{slides.length !== 1 ? 's' : ''}
              </div>
              <button
                className="edu-lock-btn"
                onClick={() => openLockModal(isLocked ? 'unlock' : 'lock', selectedWeek)}
                style={{ color: isLocked ? '#ffaa00' : 'var(--text-muted)' }}
              >
                {isLocked ? 'Locked' : 'Unlocked'}
              </button>
            </div>
          </div>

          {/* Empty State */}
          {slides.length === 0 ? (
            <div className="edu-empty">
              <div className="edu-empty-line" />
              <div className="edu-empty-title">Belum ada konten untuk minggu ini</div>
              <div className="edu-empty-sub">
                {isLocked
                  ? 'Unlock terlebih dahulu untuk menambahkan materi.'
                  : 'Tambahkan slide pertama untuk mulai mengisi materi minggu ini.'}
              </div>
              {!isLocked && (
                <button className="btn btn-primary" onClick={() => setAddSlideModal(true)} style={{ marginTop: 16 }}>
                  + Tambah Slide
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Slide Dots */}
              <div className="edu-slide-dots">
                {slides.map((s, i) => (
                  <button
                    key={s.id}
                    className={`edu-dot ${i === currentSlide ? 'active' : ''}`}
                    onClick={() => goToSlide(i)}
                    title={s.title}
                    style={{ background: i === currentSlide ? phaseColor : undefined }}
                  />
                ))}
              </div>

              {/* Slide */}
              {currentSlideData && (
                <div className="edu-slide" ref={slideRef}>

                  {/* Edit Mode */}
                  {editingSlide?.slideIndex === currentSlide ? (
                    <div className="edu-edit-form">
                      <div className="edu-edit-row">
                        <label>Tipe Slide</label>
                        <select value={editContent.type} onChange={e => setEditContent(p => ({ ...p, type: e.target.value }))}>
                          <option value="intro">Intro</option>
                          <option value="concept">Concept</option>
                          <option value="homework">Task</option>
                        </select>
                      </div>
                      <div className="edu-edit-row">
                        <label>Judul</label>
                        <input
                          type="text"
                          value={editContent.title || ''}
                          onChange={e => setEditContent(p => ({ ...p, title: e.target.value }))}
                        />
                      </div>
                      <div className="edu-edit-row">
                        <label>Konten (gunakan **bold**, • bullet, → arrow)</label>
                        <textarea
                          value={editContent.body || ''}
                          onChange={e => setEditContent(p => ({ ...p, body: e.target.value }))}
                          rows={16}
                        />
                      </div>
                      <div className="edu-edit-row">
                        <label>Image Placeholder (deskripsi gambar yang akan diinsert)</label>
                        <input
                          type="text"
                          value={editContent.imagePlaceholder || ''}
                          onChange={e => setEditContent(p => ({ ...p, imagePlaceholder: e.target.value }))}
                          placeholder="[PLACEHOLDER: deskripsi gambar...]"
                        />
                      </div>
                      <div className="edu-edit-actions">
                        <button className="btn btn-secondary" onClick={() => setEditingSlide(null)}>Batal</button>
                        <button className="btn btn-primary" onClick={saveEdit}>Simpan</button>
                      </div>
                    </div>

                  ) : (
                    /* View Mode */
                    <>
                      <div className="edu-slide-header">
                        <div
                          className="edu-slide-type-badge"
                          style={{ color: phaseColor, borderColor: `${phaseColor}44`, background: `${phaseColor}11` }}
                        >
                          {SLIDE_TYPE_LABELS[currentSlideData.type]}
                        </div>
                        <div className="edu-slide-num">{currentSlide + 1} / {slides.length}</div>
                        {!isLocked && (
                          <div className="edu-slide-actions">
                            <button className="edu-action-btn" onClick={() => startEdit(currentSlide)}>
                              Edit
                            </button>
                            <button className="edu-action-btn edu-action-delete" onClick={() => setConfirmDeleteModal(currentSlide)}>
                              Remove
                            </button>
                          </div>
                        )}
                      </div>

                      <h2 className="edu-slide-title" style={{ color: phaseColor }}>
                        {currentSlideData.title}
                      </h2>

                      <div className="edu-slide-body">
                        {renderBody(currentSlideData.body)}
                      </div>

                      {currentSlideData.imagePlaceholder && (
                        <div className="edu-image-placeholder">
                          <div className="edu-img-label">Image Placeholder</div>
                          <div className="edu-img-desc">{currentSlideData.imagePlaceholder}</div>
                        </div>
                      )}

                      {currentSlideData.image && (
                        <div className="edu-image-container">
                          <img src={currentSlideData.image} alt={currentSlideData.title} className="edu-image" />
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* Navigation */}
              <div className="edu-nav">
                <button className="edu-nav-btn" onClick={() => goToSlide(currentSlide - 1)} disabled={currentSlide === 0}>
                  Prev
                </button>
                <div className="edu-nav-progress">
                  {slides.map((_, i) => (
                    <div
                      key={i}
                      className={`edu-nav-pip ${i <= currentSlide ? 'filled' : ''}`}
                      style={{ background: i <= currentSlide ? phaseColor : undefined }}
                      onClick={() => goToSlide(i)}
                    />
                  ))}
                </div>
                <button className="edu-nav-btn" onClick={() => goToSlide(currentSlide + 1)} disabled={currentSlide === slides.length - 1}>
                  Next
                </button>
              </div>

              {!isLocked && (
                <div style={{ textAlign: 'center', marginTop: 16 }}>
                  <button className="btn btn-secondary" onClick={() => setAddSlideModal(true)} style={{ fontSize: 13 }}>
                    + Tambah Slide Baru
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Password Modal ── */}
      {passwordModal.open && (
        <div className="edu-modal-overlay" onClick={closeLockModal}>
          <div className="edu-modal" onClick={e => e.stopPropagation()}>
            <div className="edu-modal-title">
              {passwordModal.action === 'lock' ? 'Lock Konten' : 'Unlock Konten'}
            </div>
            <div className="edu-modal-sub">
              {passwordModal.action === 'lock'
                ? 'Masukkan password untuk mengunci konten minggu ini dari editing.'
                : 'Masukkan password untuk membuka kunci dan mengizinkan editing.'}
            </div>
            <input
              type="password"
              value={passwordInput}
              onChange={e => { setPasswordInput(e.target.value); setPasswordError(''); }}
              onKeyDown={e => e.key === 'Enter' && confirmPassword()}
              placeholder="Password..."
              className="edu-modal-input"
              autoFocus
            />
            {passwordError && <div className="edu-modal-error">{passwordError}</div>}
            <div className="edu-modal-actions">
              <button className="btn btn-secondary" onClick={closeLockModal}>Batal</button>
              <button className="btn btn-primary" onClick={confirmPassword}>Konfirmasi</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add Slide Modal ── */}
      {addSlideModal && (
        <div className="edu-modal-overlay" onClick={() => setAddSlideModal(false)}>
          <div className="edu-modal edu-modal-large" onClick={e => e.stopPropagation()}>
            <div className="edu-modal-title">Tambah Slide Baru</div>
            <div className="edu-edit-row">
              <label>Tipe</label>
              <select value={newSlide.type} onChange={e => setNewSlide(p => ({ ...p, type: e.target.value }))}>
                <option value="intro">Intro</option>
                <option value="concept">Concept</option>
                <option value="homework">Task</option>
              </select>
            </div>
            <div className="edu-edit-row">
              <label>Judul Slide</label>
              <input
                type="text"
                value={newSlide.title}
                onChange={e => setNewSlide(p => ({ ...p, title: e.target.value }))}
                placeholder="Contoh: Apa itu Delta Divergence?"
              />
            </div>
            <div className="edu-edit-row">
              <label>Konten</label>
              <textarea
                value={newSlide.body}
                onChange={e => setNewSlide(p => ({ ...p, body: e.target.value }))}
                placeholder="Tulis materi di sini... Gunakan **teks** untuk bold, • untuk bullet"
                rows={10}
              />
            </div>
            <div className="edu-edit-row">
              <label>Image Placeholder (opsional)</label>
              <input
                type="text"
                value={newSlide.imagePlaceholder}
                onChange={e => setNewSlide(p => ({ ...p, imagePlaceholder: e.target.value }))}
                placeholder="[PLACEHOLDER: deskripsi gambar yang akan kamu insert]"
              />
            </div>
            <div className="edu-modal-actions">
              <button className="btn btn-secondary" onClick={() => setAddSlideModal(false)}>Batal</button>
              <button className="btn btn-primary" onClick={addSlide}>+ Tambah</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Confirm Delete Modal ── */}
      {confirmDeleteModal !== null && (
        <div className="edu-modal-overlay" onClick={() => setConfirmDeleteModal(null)}>
          <div className="edu-modal" onClick={e => e.stopPropagation()}>
            <div className="edu-modal-title">Hapus Slide?</div>
            <div className="edu-modal-sub">
              Slide "{slides[confirmDeleteModal]?.title}" akan dihapus permanen. Lanjutkan?
            </div>
            <div className="edu-modal-actions">
              <button className="btn btn-secondary" onClick={() => setConfirmDeleteModal(null)}>Batal</button>
              <button
                className="btn btn-primary"
                style={{ background: '#ff0095', border: 'none' }}
                onClick={() => deleteSlide(confirmDeleteModal)}
              >
                Hapus
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}