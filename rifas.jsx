import { useState, useEffect } from "react";

const stor = {
  async get(k) { try { const r = await window.storage.get(k, true); return r ? JSON.parse(r.value) : null; } catch { return null; } },
  async set(k, v) { try { await window.storage.set(k, JSON.stringify(v), true); } catch(e) { console.error(e); } }
};
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
const brl = v => (+v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const BLANK = { name: '', prize: '', description: '', totalNumbers: '100', pricePerNumber: '', drawDate: '' };

export default function App() {
  const [view, setView] = useState('list');
  const [rifas, setRifas] = useState([]);
  const [rifa, setRifa] = useState(null);
  const [nums, setNums] = useState({});
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [mForm, setMForm] = useState({ name: '', phone: '', paid: false });
  const [form, setForm] = useState({ ...BLANK });
  const [isEdit, setIsEdit] = useState(false);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [showDraw, setShowDraw] = useState(false);
  const [drawAnim, setDrawAnim] = useState(false);
  const [tab, setTab] = useState('grid');
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2500);
  };

  useEffect(() => {
    stor.get('rifas_data').then(d => { if (d) setRifas(d); setLoading(false); });
  }, []);

  const saveRifas = async (d) => { setRifas(d); await stor.set('rifas_data', d); };
  const saveNums = async (id, d) => { setNums(d); await stor.set('nums_' + id, d); };

  const openRifa = async (r) => {
    setRifa(r); setView('detail');
    const d = await stor.get('nums_' + r.id);
    setNums(d || {});
    setFilter('all'); setSearch(''); setTab('grid');
  };

  const startCreate = () => { setIsEdit(false); setForm({ ...BLANK }); setView('form'); };
  const startEdit = (r) => {
    setIsEdit(true); setRifa(r);
    setForm({ name: r.name, prize: r.prize, description: r.description || '', totalNumbers: String(r.totalNumbers), pricePerNumber: String(r.pricePerNumber || ''), drawDate: r.drawDate || '' });
    setView('form');
  };

  const submitForm = async () => {
    if (!form.name.trim() || !form.prize.trim() || !form.totalNumbers) return showToast('Preencha nome, prêmio e total de números.', 'error');
    if (+form.totalNumbers < 1 || +form.totalNumbers > 10000) return showToast('Total deve ser entre 1 e 10.000.', 'error');
    if (isEdit) {
      const upd = rifas.map(r => r.id === rifa.id ? { ...r, ...form, totalNumbers: +form.totalNumbers, pricePerNumber: +form.pricePerNumber || 0 } : r);
      await saveRifas(upd);
      const r2 = upd.find(r => r.id === rifa.id);
      setRifa(r2);
      setView('detail');
      showToast('Rifa atualizada!');
    } else {
      const r = { id: uid(), ...form, totalNumbers: +form.totalNumbers, pricePerNumber: +form.pricePerNumber || 0, status: 'active', createdAt: new Date().toISOString(), winner: null };
      await saveRifas([...rifas, r]);
      setView('list');
      showToast('Rifa criada com sucesso!');
    }
  };

  const execDelete = async (id) => {
    await saveRifas(rifas.filter(r => r.id !== id));
    setConfirmDelete(null);
    if (view === 'detail') { setView('list'); }
    showToast('Rifa excluída.');
  };

  const openModal = (n) => {
    const d = nums[n];
    setMForm(d ? { name: d.name, phone: d.phone || '', paid: d.paid } : { name: '', phone: '', paid: false });
    setModal(n);
  };

  const saveModal = async () => {
    if (!mForm.name.trim()) return showToast('Informe o nome.', 'error');
    const d = { ...nums, [modal]: { name: mForm.name.trim(), phone: mForm.phone, paid: mForm.paid, at: nums[modal]?.at || new Date().toISOString() } };
    await saveNums(rifa.id, d);
    setModal(null);
    showToast(nums[modal] ? 'Número atualizado!' : 'Número reservado!');
  };

  const clearModal = async () => {
    const d = { ...nums }; delete d[modal];
    await saveNums(rifa.id, d);
    setModal(null);
    showToast('Número liberado.');
  };

  const togglePaid = async (n) => {
    if (!nums[n]) return;
    const upd = { ...nums, [n]: { ...nums[n], paid: !nums[n].paid } };
    await saveNums(rifa.id, upd);
    showToast(upd[n].paid ? 'Marcado como pago!' : 'Marcado como pendente.');
  };

  const doDraw = async () => {
    const paid = Object.keys(nums).filter(k => nums[k].paid);
    if (!paid.length) return showToast('Nenhum número pago para sortear!', 'error');
    setDrawAnim(true);
    await new Promise(r => setTimeout(r, 2200));
    const winner = paid[Math.floor(Math.random() * paid.length)];
    const upd = rifas.map(r => r.id === rifa.id ? { ...r, winner: { number: +winner, name: nums[winner].name, phone: nums[winner].phone || '' }, status: 'drawn' } : r);
    await saveRifas(upd);
    const r2 = upd.find(r => r.id === rifa.id);
    setRifa(r2);
    setDrawAnim(false);
    showToast(`🎉 Ganhador: #${winner} — ${nums[winner].name}`);
  };

  const markAllPaid = async () => {
    const upd = {};
    for (const [k, v] of Object.entries(nums)) upd[k] = { ...v, paid: true };
    await saveNums(rifa.id, upd);
    showToast('Todos marcados como pagos!');
  };

  const exportWhatsApp = () => {
    if (!rifa || !Object.keys(nums).length) return;
    const lines = [`🎟️ *${rifa.name}*`, `🏆 Prêmio: ${rifa.prize}`, ``, `Participantes:`];
    Object.entries(nums).sort(([a],[b]) => +a - +b).forEach(([n, d]) => {
      lines.push(`#${n} — ${d.name}${d.phone ? ` (${d.phone})` : ''} — ${d.paid ? '✅ Pago' : '⏳ Pendente'}`);
    });
    lines.push(``, `📊 Total reservados: ${Object.keys(nums).length}/${rifa.totalNumbers}`);
    navigator.clipboard.writeText(lines.join('\n')).then(() => showToast('Copiado para área de transferência!')).catch(() => showToast('Não foi possível copiar.', 'error'));
  };

  const stats = rifa ? (() => {
    const total = rifa.totalNumbers;
    const reserved = Object.keys(nums).length;
    const paid = Object.values(nums).filter(v => v.paid).length;
    return { total, reserved, paid, available: total - reserved, revenue: paid * rifa.pricePerNumber, expected: reserved * rifa.pricePerNumber };
  })() : null;

  const allNums = rifa ? Array.from({ length: rifa.totalNumbers }, (_, i) => i + 1) : [];
  const filtered = allNums.filter(n => {
    const d = nums[n];
    if (filter === 'available' && d) return false;
    if (filter === 'reserved' && (!d || d.paid)) return false;
    if (filter === 'paid' && (!d || !d.paid)) return false;
    if (search.trim()) {
      const s = search.toLowerCase();
      if (!d) return String(n).includes(s);
      return d.name.toLowerCase().includes(s) || (d.phone && d.phone.includes(s)) || String(n).includes(s);
    }
    return true;
  });

  const btnSize = rifa?.totalNumbers > 500 ? 'w-8 h-8 text-xs' : rifa?.totalNumbers > 200 ? 'w-10 h-10 text-xs' : 'w-12 h-12 text-sm';

  const numCls = (n) => {
    const d = nums[n];
    const winner = rifa?.winner?.number === n;
    if (winner) return `${btnSize} rounded-lg font-bold transition-all ring-2 ring-purple-400 bg-purple-800 text-purple-100 cursor-pointer`;
    if (!d) return `${btnSize} rounded-lg font-medium transition-all bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white cursor-pointer`;
    if (d.paid) return `${btnSize} rounded-lg font-bold transition-all bg-emerald-900 text-emerald-300 hover:bg-emerald-800 border border-emerald-700 cursor-pointer`;
    return `${btnSize} rounded-lg font-bold transition-all bg-amber-900 text-amber-300 hover:bg-amber-800 border border-amber-700 cursor-pointer`;
  };

  if (loading) return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-3">
      <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
      <p className="text-slate-500 text-sm">Carregando...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl text-sm font-medium shadow-lg ${toast.type === 'error' ? 'bg-red-900 text-red-200 border border-red-700' : 'bg-emerald-900 text-emerald-200 border border-emerald-700'}`}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <header className="bg-slate-900 border-b border-slate-800 px-6 py-4 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            {view !== 'list' && (
              <button onClick={() => setView(view === 'detail' ? 'list' : (isEdit ? 'detail' : 'list'))} className="text-slate-400 hover:text-white mr-1">
                ←
              </button>
            )}
            <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center font-black text-slate-900 text-sm">R</div>
            <div>
              <span className="font-bold text-white">RifaManager</span>
              {view === 'detail' && rifa && <span className="text-slate-500 text-sm ml-2">/ {rifa.name}</span>}
              {view === 'form' && <span className="text-slate-500 text-sm ml-2">/ {isEdit ? 'Editar' : 'Nova Rifa'}</span>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {view === 'list' && <button onClick={startCreate} className="bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">+ Nova Rifa</button>}
            {view === 'detail' && rifa && (
              <div className="flex gap-2">
                <button onClick={exportWhatsApp} className="text-sm border border-slate-700 text-slate-400 hover:text-white px-3 py-1.5 rounded-lg hover:bg-slate-800 transition-colors">📋 Copiar Lista</button>
                <button onClick={() => startEdit(rifa)} className="text-sm border border-slate-700 text-slate-300 px-3 py-1.5 rounded-lg hover:bg-slate-800 transition-colors">✏️ Editar</button>
                <button onClick={() => setConfirmDelete(rifa.id)} className="text-sm border border-red-900 text-red-400 px-3 py-1.5 rounded-lg hover:bg-red-950 transition-colors">🗑️</button>
                <button onClick={() => setShowDraw(true)} className="text-sm bg-purple-700 hover:bg-purple-600 text-white px-4 py-1.5 rounded-lg font-medium transition-colors">🎲 Sortear</button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">

        {/* ── LIST ── */}
        {view === 'list' && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold">Minhas Rifas</h2>
                <p className="text-slate-500 text-sm mt-0.5">{rifas.length} rifa{rifas.length !== 1 ? 's' : ''} cadastrada{rifas.length !== 1 ? 's' : ''}</p>
              </div>
            </div>

            {rifas.length === 0 ? (
              <div className="text-center py-24 text-slate-500">
                <div className="text-6xl mb-4">🎟️</div>
                <p className="text-xl font-semibold text-slate-400 mb-1">Nenhuma rifa ainda</p>
                <p className="text-sm mb-6">Crie sua primeira rifa e comece a vender números!</p>
                <button onClick={startCreate} className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2.5 rounded-xl font-medium transition-colors">Criar primeira rifa</button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {rifas.map(r => (
                  <div key={r.id} className="bg-slate-900 border border-slate-800 hover:border-slate-600 rounded-2xl p-5 transition-colors group">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1 min-w-0 mr-2">
                        <h3 className="font-bold text-white text-lg leading-tight truncate">{r.name}</h3>
                        <p className="text-sm text-slate-400 mt-0.5 truncate">🏆 {r.prize}</p>
                      </div>
                      <span className={`shrink-0 text-xs px-2.5 py-1 rounded-full font-medium ${r.status === 'drawn' ? 'bg-purple-900 text-purple-300' : 'bg-emerald-900 text-emerald-400'}`}>
                        {r.status === 'drawn' ? 'Sorteada' : 'Ativa'}
                      </span>
                    </div>
                    <div className="flex gap-4 text-sm text-slate-500 mb-3">
                      <span>{r.totalNumbers} números</span>
                      {r.pricePerNumber > 0 && <span>{brl(r.pricePerNumber)} / nº</span>}
                      {r.drawDate && <span>📅 {new Date(r.drawDate + 'T12:00:00').toLocaleDateString('pt-BR')}</span>}
                    </div>
                    {r.winner && (
                      <div className="flex items-center gap-2 text-xs text-purple-300 bg-purple-950 rounded-lg px-2.5 py-1.5 mb-3">
                        <span>🎉</span><span>Ganhador: #{r.winner.number} — {r.winner.name}</span>
                      </div>
                    )}
                    <div className="flex gap-2 mt-4">
                      <button onClick={() => openRifa(r)} className="flex-1 bg-slate-800 hover:bg-slate-700 text-white text-sm py-2 rounded-xl transition-colors font-medium">Abrir</button>
                      <button onClick={() => startEdit(r)} className="border border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800 px-3 py-2 rounded-xl text-sm transition-colors">✏️</button>
                      <button onClick={() => setConfirmDelete(r.id)} className="border border-red-900 text-red-500 hover:text-red-400 hover:bg-red-950 px-3 py-2 rounded-xl text-sm transition-colors">🗑️</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── FORM ── */}
        {view === 'form' && (
          <div className="max-w-lg mx-auto">
            <h2 className="text-2xl font-bold mb-8">{isEdit ? 'Editar Rifa' : 'Nova Rifa'}</h2>
            <div className="bg-slate-900 rounded-2xl p-6 space-y-5 border border-slate-800">
              <Fld label="Nome da Rifa *" value={form.name} onChange={v => setForm({...form, name: v})} placeholder="Ex: Rifa do Churrasco" />
              <Fld label="Prêmio *" value={form.prize} onChange={v => setForm({...form, prize: v})} placeholder="Ex: Moto Honda CG 160" />
              <Fld label="Descrição" value={form.description} onChange={v => setForm({...form, description: v})} placeholder="Detalhes, regras, informações..." textarea />
              <div className="grid grid-cols-2 gap-4">
                <Fld label="Total de Números *" value={form.totalNumbers} onChange={v => setForm({...form, totalNumbers: v})} type="number" placeholder="100" />
                <Fld label="Preço por Número (R$)" value={form.pricePerNumber} onChange={v => setForm({...form, pricePerNumber: v})} type="number" placeholder="10,00" />
              </div>
              <Fld label="Data do Sorteio" value={form.drawDate} onChange={v => setForm({...form, drawDate: v})} type="date" />
              <div className="flex gap-3 pt-2">
                <button onClick={() => setView(isEdit ? 'detail' : 'list')} className="flex-1 border border-slate-700 text-slate-300 py-2.5 rounded-xl hover:bg-slate-800 transition-colors">Cancelar</button>
                <button onClick={submitForm} className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-2.5 rounded-xl font-semibold transition-colors">{isEdit ? 'Salvar Alterações' : 'Criar Rifa'}</button>
              </div>
            </div>
          </div>
        )}

        {/* ── DETAIL ── */}
        {view === 'detail' && rifa && stats && (
          <div>
            {/* Info banner */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 mb-6">
              <div className="flex flex-wrap items-start gap-4 justify-between">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-xl font-bold">{rifa.name}</h2>
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${rifa.status === 'drawn' ? 'bg-purple-900 text-purple-300' : 'bg-emerald-900 text-emerald-400'}`}>
                      {rifa.status === 'drawn' ? '✓ Sorteada' : '● Ativa'}
                    </span>
                  </div>
                  <p className="text-slate-400 mt-1">🏆 {rifa.prize}</p>
                  {rifa.description && <p className="text-slate-500 text-sm mt-1">{rifa.description}</p>}
                  <div className="flex gap-4 text-sm text-slate-500 mt-2 flex-wrap">
                    {rifa.pricePerNumber > 0 && <span>{brl(rifa.pricePerNumber)} por número</span>}
                    {rifa.drawDate && <span>📅 Sorteio: {new Date(rifa.drawDate + 'T12:00:00').toLocaleDateString('pt-BR')}</span>}
                  </div>
                </div>
                {/* Progress */}
                <div className="min-w-48">
                  <div className="flex justify-between text-xs text-slate-500 mb-1.5">
                    <span>{stats.reserved} reservados</span>
                    <span>{Math.round(stats.reserved / stats.total * 100)}%</span>
                  </div>
                  <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-600 rounded-full transition-all" style={{ width: `${stats.reserved / stats.total * 100}%` }}></div>
                  </div>
                  <div className="flex justify-between text-xs text-slate-600 mt-1">
                    <span>0</span><span>{stats.total}</span>
                  </div>
                </div>
              </div>
              {rifa.winner && (
                <div className="mt-4 flex items-center gap-3 bg-purple-950 border border-purple-800 rounded-xl px-4 py-3">
                  <span className="text-2xl">🎉</span>
                  <div>
                    <p className="text-xs text-purple-400 font-medium">GANHADOR DO SORTEIO</p>
                    <p className="text-lg font-bold text-white">#{rifa.winner.number} — {rifa.winner.name}</p>
                    {rifa.winner.phone && <p className="text-sm text-purple-300">{rifa.winner.phone}</p>}
                  </div>
                </div>
              )}
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mb-6">
              <StCard label="Total" val={stats.total} bg="bg-slate-800" fg="text-slate-200" />
              <StCard label="Disponíveis" val={stats.available} bg="bg-slate-800" fg="text-slate-400" />
              <StCard label="Reservados" val={stats.reserved} bg="bg-amber-950" fg="text-amber-300" />
              <StCard label="Pagos" val={stats.paid} bg="bg-emerald-950" fg="text-emerald-400" />
              {rifa.pricePerNumber > 0 && <StCard label="Arrecadado" val={brl(stats.revenue)} bg="bg-emerald-950" fg="text-emerald-300" />}
              {rifa.pricePerNumber > 0 && <StCard label="Pendente" val={brl(stats.expected - stats.revenue)} bg="bg-amber-950" fg="text-amber-300" />}
            </div>

            {/* Tabs */}
            <div className="flex gap-1 mb-4">
              {['grid', 'list'].map(t => (
                <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === t ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-white hover:bg-slate-800'}`}>
                  {t === 'grid' ? '⊞ Grade de Números' : '☰ Lista de Participantes'}
                </button>
              ))}
            </div>

            {tab === 'grid' && (
              <>
                {/* Filters */}
                <div className="flex flex-wrap items-center gap-2 mb-4">
                  {[['all','Todos'],['available','Disponíveis'],['reserved','Reservados'],['paid','Pagos']].map(([f, label]) => (
                    <button key={f} onClick={() => setFilter(f)} className={`text-sm px-3 py-1.5 rounded-lg transition-colors ${filter === f ? 'bg-emerald-700 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'}`}>{label}</button>
                  ))}
                  <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar número, nome ou telefone..." className="flex-1 min-w-48 bg-slate-800 border border-slate-700 text-white text-sm px-3 py-1.5 rounded-lg placeholder-slate-600 outline-none focus:border-emerald-600 transition-colors" />
                  <span className="text-slate-600 text-xs whitespace-nowrap">{filtered.length} números</span>
                </div>

                {/* Legend */}
                <div className="flex gap-5 text-xs text-slate-500 mb-4">
                  <span className="flex items-center gap-1.5"><span className="w-3 h-3 bg-slate-800 rounded inline-block"></span>Disponível</span>
                  <span className="flex items-center gap-1.5"><span className="w-3 h-3 bg-amber-900 border border-amber-700 rounded inline-block"></span>Reservado</span>
                  <span className="flex items-center gap-1.5"><span className="w-3 h-3 bg-emerald-900 border border-emerald-700 rounded inline-block"></span>Pago</span>
                  {rifa.winner && <span className="flex items-center gap-1.5"><span className="w-3 h-3 bg-purple-800 ring-1 ring-purple-400 rounded inline-block"></span>Ganhador</span>}
                </div>

                {/* Grid */}
                <div className="flex flex-wrap gap-1.5">
                  {filtered.map(n => (
                    <button key={n} onClick={() => openModal(n)} title={nums[n] ? `${nums[n].name}${nums[n].phone ? ` — ${nums[n].phone}` : ''} — ${nums[n].paid ? 'Pago' : 'Pendente'}` : `Número ${n} — disponível`} className={numCls(n)}>
                      {n}
                    </button>
                  ))}
                </div>
                {filtered.length === 0 && <p className="text-slate-600 py-10 text-center">Nenhum número encontrado.</p>}
              </>
            )}

            {tab === 'list' && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar nome, número ou telefone..." className="bg-slate-800 border border-slate-700 text-white text-sm px-3 py-1.5 rounded-lg placeholder-slate-600 outline-none focus:border-emerald-600 w-64 transition-colors" />
                    <span className="text-slate-600 text-sm">{Object.keys(nums).length} participante{Object.keys(nums).length !== 1 ? 's' : ''}</span>
                  </div>
                  {Object.keys(nums).length > 0 && (
                    <button onClick={markAllPaid} className="text-xs border border-emerald-800 text-emerald-500 px-3 py-1.5 rounded-lg hover:bg-emerald-950 transition-colors">✓ Marcar todos como pagos</button>
                  )}
                </div>
                {Object.keys(nums).length === 0 ? (
                  <p className="text-slate-600 py-10 text-center">Nenhum número reservado ainda.</p>
                ) : (
                  <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-800 bg-slate-950">
                          <th className="text-left px-4 py-3 text-slate-500 font-medium text-xs uppercase tracking-wider">Nº</th>
                          <th className="text-left px-4 py-3 text-slate-500 font-medium text-xs uppercase tracking-wider">Nome</th>
                          <th className="text-left px-4 py-3 text-slate-500 font-medium text-xs uppercase tracking-wider">Telefone</th>
                          <th className="text-left px-4 py-3 text-slate-500 font-medium text-xs uppercase tracking-wider">Status</th>
                          <th className="text-right px-4 py-3 text-slate-500 font-medium text-xs uppercase tracking-wider">Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(nums)
                          .filter(([n, d]) => !search.trim() || d.name.toLowerCase().includes(search.toLowerCase()) || String(n).includes(search) || (d.phone && d.phone.includes(search)))
                          .sort(([a],[b]) => +a - +b)
                          .map(([n, d]) => (
                            <tr key={n} className={`border-b border-slate-800 last:border-0 hover:bg-slate-800 transition-colors ${rifa.winner?.number === +n ? 'bg-purple-950' : ''}`}>
                              <td className="px-4 py-3 font-mono font-bold text-slate-300">#{n}</td>
                              <td className="px-4 py-3 font-medium">{d.name}</td>
                              <td className="px-4 py-3 text-slate-400">{d.phone || '—'}</td>
                              <td className="px-4 py-3">
                                <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${d.paid ? 'bg-emerald-900 text-emerald-300' : 'bg-amber-900 text-amber-300'}`}>
                                  {d.paid ? '✓ Pago' : '⏳ Pendente'}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-right">
                                <div className="flex gap-1.5 justify-end">
                                  <button onClick={() => togglePaid(+n)} className="text-xs border border-slate-700 px-2 py-1 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white transition-colors">
                                    {d.paid ? 'Desmarcar' : 'Pago ✓'}
                                  </button>
                                  <button onClick={() => openModal(+n)} className="text-xs border border-slate-700 px-2 py-1 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white transition-colors">✏️</button>
                                </div>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>

      {/* ── Number Modal ── */}
      {modal !== null && (
        <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-4" onClick={e => e.target === e.currentTarget && setModal(null)}>
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold">Número <span className="text-emerald-400">#{modal}</span></h3>
              {nums[modal] && (
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${nums[modal].paid ? 'bg-emerald-900 text-emerald-300' : 'bg-amber-900 text-amber-300'}`}>
                  {nums[modal].paid ? '✓ Pago' : '⏳ Pendente'}
                </span>
              )}
            </div>
            <div className="space-y-4">
              <Fld label="Nome do Participante *" value={mForm.name} onChange={v => setMForm({...mForm, name: v})} placeholder="Nome completo" />
              <Fld label="Telefone / WhatsApp" value={mForm.phone} onChange={v => setMForm({...mForm, phone: v})} placeholder="(00) 00000-0000" />
              <label className="flex items-center gap-3 cursor-pointer bg-slate-800 px-4 py-3 rounded-xl hover:bg-slate-700 transition-colors">
                <input type="checkbox" checked={mForm.paid} onChange={e => setMForm({...mForm, paid: e.target.checked})} className="w-4 h-4 accent-emerald-500" />
                <span className="text-sm font-medium">Pagamento confirmado ✓</span>
              </label>
            </div>
            <div className="flex gap-3 mt-6">
              {nums[modal] && <button onClick={clearModal} className="text-sm border border-red-900 text-red-400 px-3 py-2.5 rounded-xl hover:bg-red-950 transition-colors">Liberar número</button>}
              <button onClick={() => setModal(null)} className="flex-1 border border-slate-700 text-slate-300 py-2.5 rounded-xl hover:bg-slate-800 transition-colors">Cancelar</button>
              <button onClick={saveModal} className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-2.5 rounded-xl font-semibold transition-colors">Salvar</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Draw Modal ── */}
      {showDraw && (
        <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-8 w-full max-w-sm text-center shadow-2xl">
            <h3 className="text-xl font-bold mb-1">🎲 Realizar Sorteio</h3>
            <p className="text-slate-400 text-sm mb-6">{Object.values(nums).filter(v => v.paid).length} número{Object.values(nums).filter(v => v.paid).length !== 1 ? 's' : ''} pago{Object.values(nums).filter(v => v.paid).length !== 1 ? 's' : ''} participando</p>
            {rifa.winner && !drawAnim && (
              <div className="bg-purple-950 border border-purple-700 rounded-xl p-5 mb-6 text-left">
                <p className="text-purple-400 text-xs font-semibold mb-1 uppercase tracking-wider">Último Ganhador</p>
                <p className="text-3xl font-black text-white">#{rifa.winner.number}</p>
                <p className="text-purple-200 font-semibold">{rifa.winner.name}</p>
                {rifa.winner.phone && <p className="text-purple-400 text-sm">{rifa.winner.phone}</p>}
              </div>
            )}
            {drawAnim && (
              <div className="py-8 mb-6 flex flex-col items-center gap-3">
                <div className="text-5xl animate-bounce">🎰</div>
                <div className="flex gap-1">
                  {[0,1,2].map(i => <div key={i} className="w-2 h-2 bg-purple-400 rounded-full animate-pulse" style={{ animationDelay: `${i * 0.2}s` }}></div>)}
                </div>
                <p className="text-slate-400 text-sm">Sorteando...</p>
              </div>
            )}
            <div className="flex gap-3">
              <button onClick={() => setShowDraw(false)} className="flex-1 border border-slate-700 text-slate-300 py-2.5 rounded-xl hover:bg-slate-800 transition-colors">Fechar</button>
              <button onClick={doDraw} disabled={drawAnim} className="flex-1 bg-purple-700 hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed text-white py-2.5 rounded-xl font-bold transition-colors">
                {drawAnim ? 'Sorteando...' : rifa.winner ? '🔄 Novo Sorteio' : '🎲 Sortear!'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Confirm Delete ── */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-4" onClick={e => e.target === e.currentTarget && setConfirmDelete(null)}>
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-sm text-center shadow-2xl">
            <div className="text-4xl mb-3">🗑️</div>
            <h3 className="text-lg font-bold mb-2">Excluir rifa?</h3>
            <p className="text-slate-400 text-sm mb-6">Todos os dados e números serão removidos permanentemente.</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDelete(null)} className="flex-1 border border-slate-700 text-slate-300 py-2.5 rounded-xl hover:bg-slate-800 transition-colors">Cancelar</button>
              <button onClick={() => execDelete(confirmDelete)} className="flex-1 bg-red-700 hover:bg-red-600 text-white py-2.5 rounded-xl font-semibold transition-colors">Excluir</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StCard({ label, val, bg, fg }) {
  return (
    <div className={`${bg} rounded-xl p-3 text-center border border-slate-800`}>
      <p className="text-xs text-slate-500 mb-1 leading-tight">{label}</p>
      <p className={`font-bold text-base ${fg} leading-tight`}>{val}</p>
    </div>
  );
}

function Fld({ label, value, onChange, placeholder, type = 'text', textarea }) {
  const cls = "w-full bg-slate-800 border border-slate-700 text-white text-sm px-3 py-2.5 rounded-xl placeholder-slate-600 outline-none focus:border-emerald-500 transition-colors";
  return (
    <div>
      <label className="block text-sm text-slate-400 mb-1.5 font-medium">{label}</label>
      {textarea
        ? <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={3} className={cls} />
        : <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className={cls} />
      }
    </div>
  );
}
