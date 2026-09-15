import React, { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { BarChart2, Users, UserPlus, UserMinus, Edit3, GitBranch, Briefcase, Layers, Grid, AlertCircle } from 'react-feather';
import { useTranslation } from 'react-i18next';

export const changeKinds = [
  { key: 'added', Icon: UserPlus, color: '#28776b' },
  { key: 'removed', Icon: UserMinus, color: '#ad554c' },
  { key: 'changed', Icon: Edit3, color: '#997331' },
  { key: 'moved', Icon: GitBranch, color: '#526ca1' },
];
const dimensions = { department: Grid, role: Briefcase, rank: Layers, organization_name: GitBranch };

export default function ComparisonCharts({ changes, active, onSelect }) {
  const { t } = useTranslation();
  const reduceMotion = useReducedMotion();
  const fields = Object.keys(changes.distributions || {});
  const [dimension, setDimension] = useState(fields[0]);
  const [all, setAll] = useState(false);
  const counts = changes.compared_counts;
  const delta = counts.after - counts.before;
  const distribution = changes.distributions?.[dimension] || [];
  const data = all ? distribution : distribution.slice(0, 8);
  const max = Math.max(1, ...distribution.flatMap(row => [row.before, row.after]));
  const changeMax = Math.max(1, ...changeKinds.map(({ key }) => changes[key].length));
  return <div className="comparison-charts">
    <div className="headcount-strip">
      <div className="flex items-center gap-3"><Users size={22} className="text-gray-500" /><div><p className="text-xs text-gray-500">{t('dataVisual.employees')}</p><div className="flex items-baseline gap-3" dir="ltr"><span className="text-2xl text-gray-500 tabular-nums">{counts.before}</span><span className="text-gray-400">→</span><strong className="text-3xl tabular-nums font-semibold">{counts.after}</strong><span className="text-sm text-gray-600">({delta > 0 ? '+' : ''}{delta})</span></div></div></div>
      <p className="text-xs text-gray-500 max-w-64">{t('dataVisual.validOnly')}</p>
    </div>
    <div className="grid gap-7 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] py-6">
      <figure>
        <figcaption className="chart-heading"><BarChart2 size={17} />{t('dataVisual.changes')}</figcaption>
        <p className="text-xs text-gray-500 mb-4">{t('dataVisual.overlap')}</p>
        <div className="space-y-2" aria-label={t('dataVisual.changes')}>
          {changeKinds.map(({ key, Icon, color }) => <button key={key} onClick={() => onSelect(key)} aria-pressed={active === key} className={`change-bar-row ${active === key ? 'is-active' : ''}`}>
            <Icon size={17} style={{ color }} /><span className="text-sm">{t(`tableDiff.${key}`)}</span>
            <span className="bar-track"><motion.span initial={{ scaleX: 0 }} animate={{ scaleX: changes[key].length / changeMax }} transition={{ duration: reduceMotion ? 0 : .35 }} style={{ background: color }} /></span>
            <strong className="tabular-nums text-sm">{changes[key].length}</strong>
          </button>)}
        </div>
        <button onClick={() => onSelect('excluded')} aria-pressed={active === 'excluded'} className="mt-4 flex items-center gap-2 text-xs text-gray-600 underline underline-offset-4"><AlertCircle size={14} />{t('tableDiff.excluded')} · {changes.excluded.length}</button>
      </figure>
      <figure className="min-w-0 lg:border-s lg:ps-7 border-gray-200">
        <figcaption className="chart-heading"><Users size={17} />{t('dataVisual.distribution')}</figcaption>
        {fields.length ? <>
          <div className="flex flex-wrap gap-1 mb-4" aria-label={t('dataVisual.distribution')}>{fields.map(field => { const Icon = dimensions[field]; return <button key={field} aria-pressed={dimension === field} onClick={() => { setDimension(field); setAll(false); }} className={`dimension-button ${dimension === field ? 'is-active' : ''}`}><Icon size={14} />{t(`columnRoles.fields.${field}`)}</button>; })}</div>
          <div className="flex gap-4 text-xs text-gray-600 mb-3"><span className="flex gap-1.5 items-center"><i className="legend-before" />{t('tableDiff.before')}</span><span className="flex gap-1.5 items-center"><i className="legend-after" />{t('tableDiff.after')}</span></div>
          <div className="distribution-bars" key={dimension}>
            {data.map(row => <div key={row.label} className="distribution-row">
              <span className="text-xs break-words" title={row.label}>{row.label || t('dataVisual.unspecified')}</span>
              <div className="space-y-1">{['before', 'after'].map(side => <div key={side} className="flex items-center gap-2" aria-label={`${row.label || t('dataVisual.unspecified')}: ${t(`tableDiff.${side}`)} ${row[side]}`}><div className="flex-1 h-2.5"><motion.div className={`h-full distribution-${side}`} initial={{ width: 0 }} animate={{ width: `${row[side] / max * 100}%` }} transition={{ duration: reduceMotion ? 0 : .35 }} /></div><span className="text-xs tabular-nums w-6 text-end">{row[side]}</span></div>)}</div>
            </div>)}
          </div>
          {distribution.length > 8 && <button className="mt-3 text-xs underline" onClick={() => setAll(!all)}>{t(all ? 'dataVisual.showLess' : 'tableDiff.showMore')}</button>}
        </> : <p className="py-8 text-sm text-gray-500">{t('dataVisual.noDimensions')}</p>}
      </figure>
    </div>
  </div>;
}
