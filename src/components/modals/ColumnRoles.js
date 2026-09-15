import React from 'react';
import { GitBranch, Link, Layers, Columns, Plus, X, ArrowDown, Check } from 'react-feather';
import { AnimatePresence, motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';

export const columnRoleError = (error, t) => error.response?.data?.error_key
  ? t(`columnRoles.errors.${error.response.data.error_key}`, error.response.data.error_params || {})
  : error.response?.data?.error || t('fileUpload.failedToUpload');

export const roleFields = ['person_id', 'name', 'birth_date', 'personal_information', 'role', 'department', 'rank', 'organization_id', 'organization_name', 'role_information', 'is_dead'];
const selectClass = 'w-full min-w-0 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-700 disabled:bg-gray-50 disabled:text-gray-700';

export default function ColumnRoles({ columns, rows = [], value, onChange, readOnly = false, showTitle = true }) {
  const { t } = useTranslation();
  const hierarchy = value.hierarchy;
  const changeHierarchy = patch => onChange({ ...value, hierarchy: { ...hierarchy, ...patch } });
  const selector = (label, selected, change, choices = columns) => (
    <label className="block min-w-0 text-sm text-gray-700">
      <span className="mb-1 block font-medium">{label}</span>
      <select className={selectClass} value={selected || ''} onChange={e => change(e.target.value)} disabled={readOnly}>
        <option value="">{t('columnRoles.chooseColumn')}</option>
        {choices.map(column => <option key={column} value={column}>{column}</option>)}
      </select>
    </label>
  );
  return <section className="space-y-5 text-start">
    {showTitle && <div>
      <h2 className="text-lg font-semibold text-gray-900">{t('columnRoles.title')}</h2>
      <p className="mt-1 text-sm text-gray-600">{t('columnRoles.description')}</p>
    </div>}
    <div className="hierarchy-modes" role="group" aria-label={t('columnRoles.hierarchy')}>
      {[['path', Link], ['parent', GitBranch], ['levels', Layers]].map(([mode, Icon]) => <button type="button" key={mode} disabled={readOnly} aria-pressed={hierarchy.mode === mode} onClick={() => onChange({ ...value, hierarchy: { mode, columns: [] } })} className={`hierarchy-mode ${hierarchy.mode === mode ? 'is-active' : ''}`}>
        <Icon size={23} strokeWidth={1.6} /><span>{t(`columnRoles.${mode}`)}</span>{hierarchy.mode === mode && <Check size={14} className="mode-check" />}
      </button>)}
    </div>
    <AnimatePresence mode="wait" initial={false}><motion.div key={hierarchy.mode} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: .15 }} className="hierarchy-wiring">
    {hierarchy.mode === 'path' && selector(t('columnRoles.pathColumn'), hierarchy.column, column => changeHierarchy({ column }))}
    {hierarchy.mode === 'parent' && <div className="grid grid-cols-1 gap-3">
      {selector(t('columnRoles.parentColumn'), hierarchy.parent_column, parent_column => changeHierarchy({ parent_column }))}
      <div className="flex items-center justify-center gap-2 text-xs text-gray-500"><ArrowDown size={18} />{t('dataVisual.parentRelation')}</div>
      {selector(t('columnRoles.idColumn'), hierarchy.id_column, id_column => changeHierarchy({ id_column }))}
      <p className="text-xs text-gray-600">{t('columnRoles.parentHelp')}</p>
    </div>}
    {hierarchy.mode === 'levels' && <div className="space-y-3">
      <p className="text-sm text-gray-600">{t('columnRoles.levelsHelp')}</p>
      {(hierarchy.columns || []).map((column, index) => <div key={index} className="flex items-end gap-2">
        <div className="flex-1 min-w-0">{selector(t('columnRoles.level', { number: index + 1 }), column, next => changeHierarchy({ columns: hierarchy.columns.map((old, i) => i === index ? next : old) }), columns.filter(c => c === column || !hierarchy.columns.includes(c)))}</div>
        {!readOnly && <button type="button" aria-label={t('common.remove')} className="p-2 text-gray-500 hover:bg-gray-200 rounded-md" onClick={() => changeHierarchy({ columns: hierarchy.columns.filter((_, i) => i !== index) })}><X size={17} /></button>}
      </div>)}
      {!readOnly && <button type="button" className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm hover:bg-gray-50" onClick={() => changeHierarchy({ columns: [...(hierarchy.columns || []), ''] })}><Plus size={16} />{t('columnRoles.addLevel')}</button>}
    </div>}
    </motion.div></AnimatePresence>
    <div className="overflow-x-auto">
      <h3 className="chart-heading"><Columns size={17} />{t('columnRoles.role')}</h3>
      <table className="w-full text-sm text-start">
        <thead><tr className="border-b border-gray-200 text-gray-600"><th className="py-2 text-start">{t('columnRoles.sourceColumn')}</th><th className="hidden sm:table-cell py-2 px-3 text-start">{t('columnRoles.example')}</th><th className="py-2 text-start">{t('columnRoles.role')}</th></tr></thead>
        <tbody>{columns.map(column => {
          const role = Object.entries(value.fields).find(([field, source]) => field !== 'hierarchical_structure' && source === column)?.[0] || '';
          return <tr key={column} className="border-b border-gray-100">
            <td className="py-3 max-w-40 break-words font-medium">{column}</td>
            <td className="hidden sm:table-cell px-3 py-3 max-w-40 break-words text-gray-600">{String(rows.find(row => row[column])?.[column] || '—')}</td>
            <td className="py-2 min-w-40"><select aria-label={t('columnRoles.roleFor', { column })} className={selectClass} value={role} disabled={readOnly} onChange={e => {
              const fields = Object.fromEntries(Object.entries(value.fields).filter(([field, source]) => source !== column && field !== e.target.value));
              if (e.target.value) fields[e.target.value] = column;
              onChange({ ...value, fields });
            }}>
              <option value="">{t('columnRoles.unmapped')}</option>
              {roleFields.map(field => <option key={field} value={field}>{t(`columnRoles.fields.${field}`)}</option>)}
            </select></td>
          </tr>;
        })}</tbody>
      </table>
    </div>
    <p className="text-sm text-gray-600">{t('columnRoles.savedHelp')}</p>
  </section>;
}
