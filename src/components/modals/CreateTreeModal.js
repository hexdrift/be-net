import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Save, User, Briefcase } from 'react-feather';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { getLanguage, getFontClass } from '../../Utilities/languageUtils';

const THEME = {
  primary: '#1F2937',
  buttonColor: '#1F2937',
  buttonHover: '#111827',
};

const CreateTreeModal = ({ isOpen, onClose, onSave, dbPath }) => {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'he';

  const [formData, setFormData] = useState({
    treeName: '',
    folderName: '',
    rootName: '',
    rootRole: ''
  });

  const [errors, setErrors] = useState({});

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: null
      }));
    }
  };

  const validate = () => {
    const newErrors = {};

    if (!formData.treeName || !formData.treeName.trim()) {
      newErrors.treeName = t('createTree.treeNameRequired', 'Tree name is required');
    }

    if (!formData.folderName || !formData.folderName.trim()) {
      newErrors.folderName = t('createTree.folderNameRequired', 'Folder name is required');
    }

    if (!formData.rootName || !formData.rootName.trim()) {
      newErrors.rootName = t('createTree.rootNameRequired', 'Root node name is required');
    }

    if (!formData.rootRole || !formData.rootRole.trim()) {
      newErrors.rootRole = t('createTree.rootRoleRequired', 'Root node role is required');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (validate()) {
      try {
        await onSave(formData);
        // Reset form
        setFormData({
          treeName: '',
          folderName: '',
          rootName: '',
          rootRole: ''
        });
        onClose();
      } catch (error) {
        console.error('Error creating tree:', error);
        toast.error(t('createTree.createFailed', 'Failed to create tree. Please try again.'));
      }
    }
  };

  // No early return - let AnimatePresence from parent handle exit animations

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex justify-center items-center p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="bg-white rounded-lg shadow-xl w-full max-w-2xl overflow-hidden flex flex-col"
            style={{ maxHeight: "90vh" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex justify-between items-center p-4 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-800">
                {t('createTree.createNewTree', 'Create New Tree')}
              </h2>
              <button
                onClick={onClose}
                className="text-gray-500 hover:text-gray-700 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Content */}
            <div className="flex-grow overflow-y-auto custom-scrollbar p-6">
              <div className="space-y-4">
                {/* Tree Name */}
                <div>
                  <label htmlFor="treeName" className="block text-sm font-medium text-gray-700 mb-1">
                    {t('createTree.treeName', 'Tree Name')} *
                  </label>
                  <input
                    type="text"
                    id="treeName"
                    name="treeName"
                    value={formData.treeName}
                    onChange={handleInputChange}
                    autoComplete="off"
                    placeholder={t('createTree.treeNamePlaceholder', 'e.g., Company Org Chart')}
                    className={`w-full px-3 py-2 text-sm border ${errors.treeName ? 'border-red-500' : 'border-gray-300'} rounded shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 ${getFontClass(getLanguage(formData.treeName || ''))}`}
                    dir={isRTL ? 'rtl' : 'ltr'}
                  />
                  {errors.treeName && <p className="text-xs text-red-600 mt-1">{errors.treeName}</p>}
                </div>

                {/* Folder Name */}
                <div>
                  <label htmlFor="folderName" className="block text-sm font-medium text-gray-700 mb-1">
                    {t('createTree.folderName', 'Folder Name')} *
                  </label>
                  <input
                    type="text"
                    id="folderName"
                    name="folderName"
                    value={formData.folderName}
                    onChange={handleInputChange}
                    autoComplete="off"
                    placeholder={t('createTree.folderNamePlaceholder', 'e.g., 2024 Structure')}
                    className={`w-full px-3 py-2 text-sm border ${errors.folderName ? 'border-red-500' : 'border-gray-300'} rounded shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 ${getFontClass(getLanguage(formData.folderName || ''))}`}
                    dir={isRTL ? 'rtl' : 'ltr'}
                  />
                  {errors.folderName && <p className="text-xs text-red-600 mt-1">{errors.folderName}</p>}
                </div>

                {/* Root Node Details */}
                <div className="pt-4 border-t border-gray-200">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
                    <User size={16} className="mr-2" />
                    {t('createTree.rootNodeDetails', 'Root Node Details')}
                  </h3>

                  {/* Root Node Name */}
                  <div className="mb-4">
                    <label htmlFor="rootName" className="block text-sm font-medium text-gray-700 mb-1">
                      {t('createTree.rootName', 'Name')} *
                    </label>
                    <input
                      type="text"
                      id="rootName"
                      name="rootName"
                      value={formData.rootName}
                      onChange={handleInputChange}
                      autoComplete="off"
                      placeholder={t('createTree.rootNamePlaceholder', 'e.g., John Doe')}
                      className={`w-full px-3 py-2 text-sm border ${errors.rootName ? 'border-red-500' : 'border-gray-300'} rounded shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 ${getFontClass(getLanguage(formData.rootName || ''))}`}
                      dir={isRTL ? 'rtl' : 'ltr'}
                    />
                    {errors.rootName && <p className="text-xs text-red-600 mt-1">{errors.rootName}</p>}
                  </div>

                  {/* Root Node Role */}
                  <div>
                    <label htmlFor="rootRole" className="block text-sm font-medium text-gray-700 mb-1">
                      {t('createTree.rootRole', 'Role')} *
                    </label>
                    <input
                      type="text"
                      id="rootRole"
                      name="rootRole"
                      value={formData.rootRole}
                      onChange={handleInputChange}
                      autoComplete="off"
                      placeholder={t('createTree.rootRolePlaceholder', 'e.g., CEO')}
                      className={`w-full px-3 py-2 text-sm border ${errors.rootRole ? 'border-red-500' : 'border-gray-300'} rounded shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 ${getFontClass(getLanguage(formData.rootRole || ''))}`}
                      dir={isRTL ? 'rtl' : 'ltr'}
                    />
                    {errors.rootRole && <p className="text-xs text-red-600 mt-1">{errors.rootRole}</p>}
                  </div>
                </div>

                {/* Info Text */}
                <div className="bg-blue-50 border border-blue-200 rounded p-3 text-xs text-blue-800">
                  {t('createTree.infoText', 'After creating the tree, you can add more nodes by hovering over nodes and clicking the "•••" button.')}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="border-t border-gray-100 p-4">
              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  className="flex-1 px-4 py-2.5 rounded-md text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
                >
                  {t('common.cancel', 'Cancel')}
                </button>
                <button
                  onClick={handleSubmit}
                  className="flex-1 px-4 py-2.5 rounded-md text-sm font-medium text-white flex items-center justify-center gap-2 transition-colors"
                  style={{
                    backgroundColor: THEME.buttonColor,
                  }}
                  onMouseEnter={(e) => e.target.style.backgroundColor = THEME.buttonHover}
                  onMouseLeave={(e) => e.target.style.backgroundColor = THEME.buttonColor}
                >
                  <Save size={16} />
                  {t('createTree.createTree', 'Create Tree')}
                </button>
              </div>
            </div>
      </motion.div>
    </motion.div>
  );
};

export default CreateTreeModal;
