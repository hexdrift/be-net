import useReducedMotionPreference from '../../Utilities/useReducedMotionPreference';
import React, { useMemo, useState } from 'react';
import { hierarchy, tree } from 'd3';
import { motion } from 'framer-motion';
import { GitBranch, Plus, Minus, Maximize2 } from 'react-feather';
import { useTranslation } from 'react-i18next';

function Branch({ node }) {
  return <li><span className={node.depth === 0 ? 'preview-root' : ''}>{node.data.label}</span>{node.children?.length > 0 && <ul>{node.children.map(child => <Branch key={child.data.id} node={child} />)}</ul>}</li>;
}

export default function HierarchyPreview({ rows, total }) {
  const { t } = useTranslation();
  const reduceMotion = useReducedMotionPreference();
  const [zoom, setZoom] = useState(1);
  const graph = useMemo(() => {
    const nodes = new Map();
    for (const row of rows) {
      const parts = row.hierarchical_structure.split('/').filter(Boolean);
      parts.forEach((part, index) => {
        const id = '/' + parts.slice(0, index + 1).join('/');
        if (!nodes.has(id)) nodes.set(id, { id, label: part, children: [] });
        if (index === parts.length - 1) nodes.get(id).label = row.name || row.person_id || part;
      });
    }
    let root;
    for (const node of nodes.values()) {
      const parent = nodes.get(node.id.slice(0, node.id.lastIndexOf('/')));
      if (parent) parent.children.push(node); else root = node;
    }
    if (!root) return null;
    const layout = tree().nodeSize([154, 92])(hierarchy(root));
    const items = layout.descendants();
    const min = Math.min(...items.map(node => node.x));
    const max = Math.max(...items.map(node => node.x));
    return { items, links: layout.links(), min, width: Math.max(530, max - min + 170), height: layout.height * 92 + 84 };
  }, [rows]);
  if (!graph) return null;
  return <figure className="hierarchy-preview">
    <figcaption className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-xs text-gray-600 border-b border-gray-200"><span className="flex items-center gap-2"><GitBranch size={16} />{t('dataVisual.treePreview', { shown: rows.length, total: total ?? rows.length })}</span><span className="hidden sm:flex gap-1"><button type="button" className="p-2 rounded hover:bg-gray-200" aria-label={t('dataVisual.zoomOut')} disabled={zoom === 1} onClick={() => setZoom(Math.max(1, zoom - .5))}><Minus size={15} /></button><button type="button" className="p-2 rounded hover:bg-gray-200" aria-label={t('dataVisual.fit')} onClick={() => setZoom(1)}><Maximize2 size={15} /></button><button type="button" className="p-2 rounded hover:bg-gray-200" aria-label={t('dataVisual.zoomIn')} disabled={zoom === 4} onClick={() => setZoom(Math.min(4, zoom + .5))}><Plus size={15} /></button></span></figcaption>
    <div dir="ltr" className="hidden sm:block overflow-auto max-h-80" tabIndex={0} aria-label={t('columnRoles.preview')}>
      <svg viewBox={`0 0 ${graph.width} ${graph.height}`} style={{ width: `${zoom * 100}%`, height: 'auto', transition: reduceMotion ? 'none' : 'width 180ms ease-out' }} aria-hidden="true" className="mx-auto" dir="ltr">
        <g transform={`translate(${85 - graph.min},38)`}>
          {graph.links.map(({ source, target }) => <motion.path key={target.data.id} initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: reduceMotion ? 0 : .3 }} d={`M${source.x},${source.y + 18} V${target.y - 45} H${target.x} V${target.y - 18}`} fill="none" stroke="#9ca3af" strokeWidth="1.5" />)}
          {graph.items.map(node => <g key={node.data.id} transform={`translate(${node.x},${node.y})`}>
            <title>{node.data.label} · {node.data.id}</title>
            <rect x="-69" y="-18" width="138" height="36" rx="5" fill={node.depth === 0 ? '#1f2937' : 'white'} stroke={node.depth === 0 ? '#1f2937' : '#d1d5db'} />
            <text textAnchor="middle" dominantBaseline="central" fill={node.depth === 0 ? 'white' : '#374151'} fontSize="12" direction="auto">{node.data.label.length > 18 ? node.data.label.slice(0, 17) + '…' : node.data.label}</text>
          </g>)}
        </g>
      </svg>
    </div>
    <ul className="preview-branches sm:sr-only" aria-label={t('columnRoles.preview')}><Branch node={graph.items[0]} /></ul>
  </figure>;
}
