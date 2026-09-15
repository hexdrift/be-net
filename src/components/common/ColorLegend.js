import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { List, ChevronUp, Edit2, X, Check, Layers, GitBranch, User, Trash2 } from 'react-feather';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import '../../styles/scrollbar.css';

// Theme matching the app
const THEME = {
  primary: '#1F2937',
  buttonColor: '#1F2937',
  bgGray: '#F9FAFB',
  borderColor: '#E5E7EB'
};

const ColorLegend = ({ entries = [], isRTL = false, onUpdateLabel }) => {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef(null);

  // Focus input when editing starts
  useEffect(() => {
    if (editingId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingId]);

  // Filter to only show entries with labels
  const labeledEntries = entries.filter(entry => entry.label?.trim());

  // Group entries by color AND deduplicate labels within each color
  // Also track count and all entries for each label (for bulk updates)
  const groupedByColor = labeledEntries.reduce((acc, entry) => {
    const colorKey = entry.color?.toLowerCase() || '';
    const labelKey = entry.label?.trim().toLowerCase() || '';

    if (!acc[colorKey]) {
      acc[colorKey] = {
        color: entry.color,
        labelGroups: {}  // { labelKey: { displayEntry, allEntries, count } }
      };
    }

    // Track all entries with this label for bulk updates
    if (!acc[colorKey].labelGroups[labelKey]) {
      acc[colorKey].labelGroups[labelKey] = {
        displayEntry: entry,  // First entry for display
        allEntries: [entry],  // All entries with this label
        count: 1
      };
    } else {
      acc[colorKey].labelGroups[labelKey].allEntries.push(entry);
      acc[colorKey].labelGroups[labelKey].count++;
    }

    return acc;
  }, {});

  // Convert to array format for rendering
  const colorGroups = Object.values(groupedByColor).map(group => {
    const entriesArray = Object.values(group.labelGroups).map(lg => ({
      ...lg.displayEntry,
      allEntries: lg.allEntries,
      nodeCount: lg.count
    }));
    return {
      color: group.color,
      entries: entriesArray
    };
  });

  // Calculate total unique labels across all colors (for collapsed view)
  const totalLabels = colorGroups.reduce((sum, g) => sum + g.entries.length, 0);

  // Start editing an entry
  const handleStartEdit = (entry) => {
    setEditingId(entry.id);
    setEditValue(entry.label || '');
  };

  // Save the edited label - update ALL entries with this label
  const handleSave = (entry) => {
    const trimmedValue = editValue.trim();
    if (onUpdateLabel && entry.allEntries) {
      // Update all entries that share this label
      entry.allEntries.forEach(e => {
        onUpdateLabel(e.type, e.key, trimmedValue);
      });
    } else if (onUpdateLabel) {
      // Fallback for single entry
      onUpdateLabel(entry.type, entry.key, trimmedValue);
    }
    setEditingId(null);
    setEditValue('');
    if (trimmedValue) {
      toast.success(t('colorLegend.labelUpdated', 'Label updated'));
    }
  };

  // Cancel editing
  const handleCancel = () => {
    setEditingId(null);
    setEditValue('');
  };

  // Remove label - clear ALL entries with this label
  const handleRemove = (entry) => {
    if (onUpdateLabel && entry.allEntries) {
      entry.allEntries.forEach(e => {
        onUpdateLabel(e.type, e.key, '');
      });
    } else if (onUpdateLabel) {
      onUpdateLabel(entry.type, entry.key, '');
    }
    toast.info(t('colorLegend.labelRemoved', 'Label removed'));
  };

  // Handle key press in input
  const handleKeyDown = (e, entry) => {
    if (e.key === 'Enter') {
      handleSave(entry);
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  // Don't render if no labeled entries and not editing
  const visible = labeledEntries.length > 0 || Boolean(editingId);

  return (
    <AnimatePresence propagate>{visible && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className={`
        fixed bottom-4 z-40 export-hide
        ${isRTL ? 'left-4' : 'right-4'}
      `}
    >
      <AnimatePresence mode="wait" propagate>
        {isExpanded ? (
          // Expanded legend
          <motion.div
            key="expanded"
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{
              type: "spring",
              stiffness: 400,
              damping: 25,
              mass: 0.8
            }}
            className="bg-white rounded-xl shadow-xl border overflow-hidden"
            style={{ borderColor: THEME.borderColor, maxHeight: '380px', minWidth: '260px', maxWidth: '340px' }}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between px-4 py-3 border-b"
              style={{ borderColor: THEME.borderColor, backgroundColor: THEME.bgGray }}
            >
              <div className="flex items-center gap-2">
                <List size={16} className="text-gray-600" />
                <span className="text-sm font-medium text-gray-700">
                  {t('colorLegend.legend', 'Legend')}
                </span>
                <span className="text-xs text-gray-400">
                  ({totalLabels})
                </span>
              </div>
              <button
                onClick={() => setIsExpanded(false)}
                className="text-gray-400 hover:text-gray-600 p-1.5 hover:bg-gray-200 rounded-lg transition-colors"
                title={t('colorLegend.close', 'Close')}
              >
                <X size={16} />
              </button>
            </div>

            {/* Entries list */}
            <div className="overflow-y-auto custom-scrollbar" style={{ maxHeight: '320px' }}>
              {colorGroups.length === 0 ? (
                <div className="px-4 py-8 text-sm text-gray-400 text-center">
                  <List size={32} className="mx-auto mb-2 text-gray-300" />
                  {t('colorLegend.noLabels', 'No labeled colors yet')}
                </div>
              ) : (
                <div className="p-3 space-y-3">
                  {colorGroups.map((group, groupIdx) => (
                    <motion.div
                      key={groupIdx}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: groupIdx * 0.05 }}
                      className="rounded-lg border overflow-hidden"
                      style={{ borderColor: THEME.borderColor }}
                    >
                      {/* Color swatch header */}
                      <div className="flex items-center gap-3 px-3 py-2 bg-gray-50">
                        <div
                          className="w-6 h-6 rounded-md border flex-shrink-0"
                          style={{
                            backgroundColor: group.color,
                            borderColor: THEME.borderColor
                          }}
                        />
                      </div>
                      {/* Labels list */}
                      <div className="divide-y divide-gray-100 bg-white">
                        {group.entries.map((entry, entryIdx) => {
                          // Get scope icon based on entry type
                          const ScopeIcon = entry.type === 'level' ? Layers
                            : entry.type === 'branch' ? GitBranch
                            : User;
                          const scopeLabel = entry.type === 'level'
                            ? t('colorLegend.scopeLevel', 'Level')
                            : entry.type === 'branch'
                            ? t('colorLegend.scopeBranch', 'Branch')
                            : t('colorLegend.scopeNode', 'Node');

                          return (
                            <motion.div
                              key={entry.id}
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              transition={{ delay: groupIdx * 0.05 + entryIdx * 0.03 }}
                              className={`
                                flex items-center gap-2 px-3 py-2.5 transition-colors group
                                ${editingId === entry.id ? 'bg-gray-100' : 'hover:bg-gray-50'}
                              `}
                            >
                              {editingId === entry.id ? (
                                // Edit mode
                                <div className="flex-1 flex items-center gap-2">
                                  <input
                                    ref={inputRef}
                                    type="text"
                                    dir="auto"
                                    value={editValue}
                                    onChange={(e) => setEditValue(e.target.value)}
                                    onKeyDown={(e) => handleKeyDown(e, entry)}
                                    className="flex-1 px-2 py-1 text-sm border rounded-md focus:ring-1 focus:ring-gray-400 focus:border-gray-400 outline-none min-w-0"
                                    style={{ borderColor: THEME.borderColor }}
                                    maxLength={50}
                                    placeholder={t('colorLegend.enterLabel', 'Enter label...')}
                                  />
                                  <button
                                    onMouseDown={(e) => {
                                      e.preventDefault();
                                      handleSave(entry);
                                    }}
                                    className="p-1 text-gray-600 hover:text-gray-800 hover:bg-gray-200 rounded transition-colors"
                                  >
                                    <Check size={14} />
                                  </button>
                                  <button
                                    onMouseDown={(e) => {
                                      e.preventDefault();
                                      handleCancel();
                                    }}
                                    className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded transition-colors"
                                  >
                                    <X size={14} />
                                  </button>
                                </div>
                              ) : (
                                // Display mode
                                <>
                                  <ScopeIcon size={12} className="text-gray-400 flex-shrink-0" title={scopeLabel} />
                                  <span
                                    dir="auto"
                                    className="text-sm text-gray-700 truncate flex-1 cursor-pointer hover:text-gray-900"
                                    onClick={() => handleStartEdit(entry)}
                                    title={t('colorLegend.clickToEdit', 'Click to edit')}
                                  >
                                    {entry.label}
                                  </span>
                                  {entry.nodeCount > 0 && (
                                    <span className="text-xs text-gray-400 flex-shrink-0 px-1.5 py-0.5 bg-gray-100 rounded">
                                      {entry.nodeCount}
                                    </span>
                                  )}
                                  <button
                                    onClick={() => handleStartEdit(entry)}
                                    className="p-1 text-gray-300 hover:text-gray-600 hover:bg-gray-100 rounded opacity-0 group-hover:opacity-100 transition-all"
                                    title={t('colorLegend.editLabel', 'Edit label')}
                                  >
                                    <Edit2 size={12} />
                                  </button>
                                  <button
                                    onClick={() => handleRemove(entry)}
                                    className="p-1 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded opacity-0 group-hover:opacity-100 transition-all"
                                    title={t('colorLegend.removeLabel', 'Remove label')}
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                </>
                              )}
                            </motion.div>
                          );
                        })}
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        ) : (
          // Collapsed button
          <motion.button
            key="collapsed"
            initial={{ opacity: 0, scale: 0.9, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 10 }}
            transition={{
              type: "spring",
              stiffness: 400,
              damping: 25,
              mass: 0.8
            }}
            onClick={() => setIsExpanded(true)}
            className="bg-white rounded-xl shadow-lg border p-3 hover:shadow-xl transition-all hover:scale-105"
            style={{ borderColor: THEME.borderColor }}
            title={t('colorLegend.showLegend', 'Show color legend')}
          >
            <div className="flex items-center gap-3">
              {/* Color dots preview - show unique colors */}
              <div className="flex -space-x-1.5">
                {colorGroups.slice(0, 3).map((group, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: idx * 0.05, type: "spring", stiffness: 500 }}
                    className="w-5 h-5 rounded-md border-2 border-white"
                    style={{
                      backgroundColor: group.color,
                      zIndex: 3 - idx,
                      boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
                    }}
                  />
                ))}
                {colorGroups.length > 3 && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.15, type: "spring", stiffness: 500 }}
                    className="w-5 h-5 rounded-md border-2 border-white flex items-center justify-center text-[9px] font-medium text-gray-600"
                    style={{ backgroundColor: THEME.bgGray }}
                  >
                    +{colorGroups.length - 3}
                  </motion.div>
                )}
              </div>

              {/* Text */}
              <div className="text-start">
                <div className="text-xs font-medium text-gray-700">
                  {t('colorLegend.legend', 'Legend')}
                </div>
                <div className="text-[10px] text-gray-500">
                  {totalLabels} {totalLabels === 1
                    ? t('colorLegend.label', 'label')
                    : t('colorLegend.labels', 'labels')}
                </div>
              </div>

              <ChevronUp size={14} className="text-gray-400" />
            </div>
          </motion.button>
        )}
      </AnimatePresence>
    </motion.div>}</AnimatePresence>
  );
};

export default ColorLegend;
