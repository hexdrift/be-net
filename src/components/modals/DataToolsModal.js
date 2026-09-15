import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { X, ArrowRight, BarChart2, Columns, List, Loader, GitBranch } from 'react-feather';
import { AnimatePresence, motion } from 'framer-motion';
import ComparisonCharts, { changeKinds } from '../data/ComparisonCharts';
import { useTranslation } from 'react-i18next';
import HierarchyPath from '../common/HierarchyPath';
import ColumnRoles from './ColumnRoles';

const API = 'http://localhost:5001';
const fieldClass = 'mt-1 w-full rounded-md border border-gray-300 bg-white p-2 text-gray-900 focus:ring-2 focus:ring-gray-700';

function ResultGroup({ title, entries, children }) {
  const [limit, setLimit] = useState(50);
  const { t } = useTranslation();
  return <details open className="border-t border-gray-200 py-4">
    <summary className="cursor-pointer text-base font-semibold">{title} ({entries.length})</summary>
    {entries.length === 0 ? <p className="mt-2 text-sm text-gray-600">{t('tableDiff.none')}</p> : <>
      <ul className="mt-2 divide-y divide-gray-100">{entries.slice(0, limit).map((entry, index) => <li key={index} className="py-3 text-sm break-words">{children(entry)}</li>)}</ul>
      {limit < entries.length && <button className="mt-2 underline text-sm" onClick={() => setLimit(limit + 50)}>{t('tableDiff.showMore')}</button>}
    </>}
  </details>;
}

export default function DataToolsModal({ mode, tableId, dbPath, folders, onClose }) {
  const { t } = useTranslation();
  const dialog = useRef(null);
  const requestId = useRef(0);
  const [before, setBefore] = useState(String(tableId));
  const [after, setAfter] = useState('');
  const [result, setResult] = useState(null);
  const [saved, setSaved] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [active, setActive] = useState('all');
  const [closing, setClosing] = useState(false);
  const close = () => setClosing(true);
  useEffect(() => {
    dialog.current.showModal();
    return () => { requestId.current += 1; };
  }, []);
  useEffect(() => {
    if (mode !== 'roles') return;
    let active = true;
    setBusy(true);
    axios.get(`${API}/table/${tableId}/column_roles`, { params: { db_path: dbPath } }).then(response => {
      if (active) setSaved(response.data);
    }).catch(err => {
      if (active) setError(err.response?.data?.error || t('tableDiff.failed'));
    }).finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [mode, tableId, dbPath, t]);
  const compare = async () => {
    const currentRequest = ++requestId.current;
    setBusy(true);
    setError('');
    setResult(null);
    try {
      const response = await axios.get(`${API}/compare_tables`, { params: { table1_id: before, table2_id: after, db_path: dbPath } });
      if (currentRequest === requestId.current) { setResult(response.data); setActive('all'); }
    } catch (err) {
      if (currentRequest === requestId.current) setError(err.response?.data?.error || t('tableDiff.failed'));
    } finally { if (currentRequest === requestId.current) setBusy(false); }
  };
  const choose = (setter, value) => { setter(value); setResult(null); setError(''); requestId.current += 1; setBusy(false); };
  const options = folders.map(folder => <optgroup key={folder.id} label={folder.name}>{folder.tables.map(table => <option key={table.id} value={table.id}>{table.name} · {table.upload_date}</option>)}</optgroup>);
  const identity = entry => <span className="font-medium">{entry.name || '—'} <bdi className="font-normal text-gray-600">({entry.person_id || '—'})</bdi></span>;
  return <dialog aria-label={t(mode === 'roles' ? 'columnRoles.title' : 'tableDiff.title')} ref={dialog} onCancel={event => { event.preventDefault(); close(); }} onClick={event => { if (event.target === dialog.current) close(); }} className="diff-dialog m-auto rounded-lg p-0 text-start text-gray-900 backdrop:bg-black/40" dir={document.documentElement.dir || 'ltr'}>
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: closing ? 0 : 1 }} transition={{ duration: .18 }} onAnimationComplete={() => { if (closing) onClose(); }} className="p-5 sm:p-6" onClick={e => e.stopPropagation()}>
      <header className="flex items-center justify-between gap-4 mb-5">
        <h2 className="text-xl font-semibold flex items-center gap-2">{mode === 'roles' ? <Columns size={21} /> : <BarChart2 size={21} />}{t(mode === 'roles' ? 'columnRoles.title' : 'tableDiff.title')}</h2>
        <button onClick={close} aria-label={t('common.close')} className="rounded-md p-2 hover:bg-gray-100"><X size={20} /></button>
      </header>
      {mode === 'roles' ? <>
        {saved?.roles ? <ColumnRoles columns={saved.columns} rows={saved.rows} value={saved.roles} readOnly showTitle={false} /> : !busy && !error && <p className="text-sm text-gray-600">{t('columnRoles.manualTree')}</p>}
      </> : <>
        <p className="mb-4 text-sm text-gray-600">{t('tableDiff.description')}</p>
        <div className="diff-selector-strip">
          <label className="text-sm font-medium">{t('tableDiff.before')}<select className={fieldClass} value={before} onChange={e => choose(setBefore, e.target.value)}><option value="">{t('tableDiff.choose')}</option>{options}</select></label>
          <ArrowRight size={18} className="text-gray-400 rtl:rotate-180" />
          <label className="text-sm font-medium">{t('tableDiff.after')}<select className={fieldClass} value={after} onChange={e => choose(setAfter, e.target.value)}><option value="">{t('tableDiff.choose')}</option>{options}</select></label>
        <button disabled={!before || !after || before === after || busy} onClick={compare} className="flex items-center justify-center gap-2 rounded-md bg-gray-800 px-4 py-2 text-white hover:bg-gray-900 disabled:opacity-50 focus:ring-2 focus:ring-gray-700">{busy ? <Loader size={17} className="motion-loading" /> : <BarChart2 size={17} />}{t('tableDiff.compare')}</button>
        </div>
        {before === after && <p className="text-sm text-gray-600">{t('tableDiff.distinct')}</p>}
        <AnimatePresence mode="wait">{result && <motion.section initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} aria-live="polite" key={`${before}-${after}`} >
          <ComparisonCharts changes={result.changes} active={active} onSelect={setActive} />
          <div className="flex flex-wrap gap-1 border-t border-gray-200 pt-4 mb-2" aria-label={t('dataVisual.details')}>
            <button className={`dimension-button ${active === 'all' ? 'is-active' : ''}`} aria-pressed={active === 'all'} onClick={() => setActive('all')}><List size={15} />{t('dataVisual.details')}</button>
            {changeKinds.map(({ key, Icon }) => <button key={key} aria-pressed={active === key} className={`dimension-button ${active === key ? 'is-active' : ''}`} onClick={() => setActive(key)}><Icon size={14} />{t(`tableDiff.${key}`)}</button>)}
          </div>
          <motion.div key={active} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <p className="mb-3 text-sm text-gray-600">{t('tableDiff.counts', result.changes.compared_counts)}</p>
          {result.changes.compared_counts.before === 0 && result.changes.compared_counts.after === 0 && <p className="mb-3 text-sm">{t('tableDiff.noValid')}</p>}
          {(active === 'all' || active === 'added') && <ResultGroup title={t('tableDiff.added')} entries={result.changes.added}>{identity}</ResultGroup>}
          {(active === 'all' || active === 'removed') && <ResultGroup title={t('tableDiff.removed')} entries={result.changes.removed}>{identity}</ResultGroup>}
          {(active === 'all' || active === 'changed') && <ResultGroup title={t('tableDiff.changed')} entries={result.changes.changed}>{entry => <>{identity(entry)}<dl className="mt-2 space-y-1">{Object.entries(entry.changes).map(([field, values]) => <div key={field} className="grid grid-cols-1 sm:grid-cols-[10rem_1fr] gap-1"><dt className="text-gray-600">{t(`columnRoles.fields.${field}`)}</dt><dd className="space-y-1"><div>{t('tableDiff.before')}: <bdi>{values[0] ?? '—'}</bdi></div><div>{t('tableDiff.after')}: <bdi>{values[1] ?? '—'}</bdi></div></dd></div>)}</dl></>}</ResultGroup>}
          {(active === 'all' || active === 'moved') && <ResultGroup title={t('tableDiff.moved')} entries={result.changes.moved}>{entry => <>{identity(entry)}<div className="mt-3 grid sm:grid-cols-[1fr_auto_1fr] items-center gap-3"><div className="border border-gray-200 bg-gray-50 rounded-md p-3"><span className="block text-xs text-gray-500 mb-2">{t('tableDiff.before')}</span><GitBranch size={15} className="inline me-2" /><HierarchyPath path={entry.old} /></div><ArrowRight size={18} className="text-gray-400 rotate-90 sm:rotate-0 rtl:sm:rotate-180" /><div className="border border-gray-400 rounded-md p-3"><span className="block text-xs text-gray-500 mb-2">{t('tableDiff.after')}</span><GitBranch size={15} className="inline me-2" /><HierarchyPath path={entry.new} /></div></div></>}</ResultGroup>}
          {(active === 'all' || active === 'excluded') && <ResultGroup title={t('tableDiff.excluded')} entries={result.changes.excluded}>{entry => <>{identity(entry.record)}<p className="mt-1 text-gray-600">{t(`tableDiff.${entry.side}`)} · {t(`tableDiff.${entry.reason}`)}</p></>}</ResultGroup>}
          </motion.div>
        </motion.section>}</AnimatePresence>
      </>}
      {busy && <p role="status" className="text-sm text-gray-600">{t('columnRoles.loading')}</p>}
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    </motion.div>
  </dialog>;
}
