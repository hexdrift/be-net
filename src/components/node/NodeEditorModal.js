import TransitionView from '../common/TransitionView';
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, Save, User, Briefcase, Heart } from 'react-feather';
import { useTranslation } from 'react-i18next';
import { getLanguage, getFontClass } from '../../Utilities/languageUtils';
import '../../styles/radio.css';
import '../../styles/scrollbar.css';

const THEME = {
  primary: '#1F2937',
  primaryLight: '#374151',
  buttonColor: '#1F2937',
  buttonHover: '#111827',
  bgGray: '#F9FAFB',
  borderColor: '#E5E7EB'
};

const NodeEditorModal = ({
  isOpen,
  onClose,
  onSave,
  nodeData = null,
  mode = 'add',
  parentNode = null
}) => {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'he';

  const [formData, setFormData] = useState({
    name: '',
    role: '',
    department: '',
    rank: '',
    person_id: '',
    birth_date: '',
    personal_information: '',
    organization_id: '',
    organization_name: '',
    role_information: '',
    is_dead: 'alive'
  });

  const [errors, setErrors] = useState({});
  const [currentTab, setCurrentTab] = useState('personal'); // 'personal', 'role', 'status'

  useEffect(() => {
    if (mode === 'edit' && nodeData) {
      setFormData({
        name: nodeData.name || '',
        role: nodeData.role || '',
        department: nodeData.department || '',
        rank: nodeData.rank || '',
        person_id: nodeData.person_id === 'nan' ? '' : nodeData.person_id || '',
        birth_date: nodeData.birth_date || '',
        personal_information: nodeData.personal_information || '',
        organization_id: nodeData.organization_id || '',
        organization_name: nodeData.organization_name || '',
        role_information: nodeData.role_information || '',
        is_dead: nodeData.is_dead || 'alive'
      });
    } else if (mode === 'add' && parentNode) {
      setFormData(prev => ({
        ...prev,
        department: parentNode.department || '',
        organization_id: parentNode.organization_id || '',
        organization_name: parentNode.organization_name || ''
      }));
    }
  }, [mode, nodeData, parentNode]);

  const handleChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: null
      }));
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    handleChange(name, value);
  };

  const validate = () => {
    // No required fields - all fields are optional per backend specification
    // Backend auto-generates required fields (table_id, hierarchical_structure, upload_date)
    return true;
  };

  const handleSubmit = async () => {
    if (validate()) {
      try {
        await onSave(formData);
        onClose();
      } catch (error) {
        console.error('Error saving node:', error);
      }
    }
  };

  // No early return - let AnimatePresence from parent handle exit animations

  const tabs = [
    {
      id: 'personal',
      label: t('updatePersonalInfo.personalDetails'),
      icon: <User size={16} className="mr-1 rtl:mr-0 rtl:ml-1" />
    },
    {
      id: 'role',
      label: t('updatePersonalInfo.roleInformation'),
      icon: <Briefcase size={16} className="mr-1 rtl:mr-0 rtl:ml-1" />
    },
    {
      id: 'status',
      label: t('updatePersonalInfo.status'),
      icon: <Heart size={16} className="mr-1 rtl:mr-0 rtl:ml-1" />
    }
  ];

  // Render form fields for personal information
  const renderPersonalInfoFields = () => (
    <div className="space-y-3">
      <div className="p-3 bg-gray-50 rounded-md">
        <h3 className="text-xs font-medium text-gray-500 mb-2 flex items-center">
          <User size={14} className="mr-1 rtl:mr-0 rtl:ml-1" />
          {t('updatePersonalInfo.personalDetailsUpper')}
        </h3>
        <div className="space-y-3">
          {/* Name field */}
          <div className="bg-white rounded-md p-3 border border-gray-200 hover:border-gray-300">
            <label htmlFor="name" className="block text-xs font-medium text-gray-500 mb-1">
              {t('updatePersonalInfo.fullName')}
            </label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name || ''}
              onChange={handleInputChange}
              autoComplete="off"
              className={`w-full px-2 py-1.5 text-sm border border-gray-300 rounded shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 ${getFontClass(getLanguage(formData.name || ''))}`}
              dir={isRTL ? 'rtl' : 'ltr'}
            />
            {errors.name && <p className="text-xs text-red-600 mt-1">{errors.name}</p>}
          </div>

          {/* Person ID field */}
          <div className="bg-white rounded-md p-3 border border-gray-200 hover:border-gray-300">
            <label htmlFor="person_id" className="block text-xs font-medium text-gray-500 mb-1">
              {t('updatePersonalInfo.personId')}
            </label>
            <input
              type="text"
              id="person_id"
              name="person_id"
              value={formData.person_id || ''}
              onChange={handleInputChange}
              autoComplete="off"
              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Birth date field */}
          <div className="bg-white rounded-md p-3 border border-gray-200 hover:border-gray-300">
            <label htmlFor="birth_date" className="block text-xs font-medium text-gray-500 mb-1">
              {t('updatePersonalInfo.birthDate')}
            </label>
            <input
              type="date"
              id="birth_date"
              name="birth_date"
              value={formData.birth_date || ''}
              onChange={handleInputChange}
              autoComplete="off"
              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Personal information */}
          <div className="bg-white rounded-md p-3 border border-gray-200 hover:border-gray-300">
            <label htmlFor="personal_information" className="block text-xs font-medium text-gray-500 mb-1">
              {t('updatePersonalInfo.additionalPersonalInfo')}
            </label>
            <textarea
              id="personal_information"
              name="personal_information"
              value={formData.personal_information || ''}
              onChange={handleInputChange}
              autoComplete="off"
              rows={4}
              className={`w-full px-2 py-1.5 text-sm border border-gray-300 rounded shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 ${getFontClass(getLanguage(formData.personal_information || ''))}`}
              dir={isRTL ? 'rtl' : 'ltr'}
            ></textarea>
          </div>
        </div>
      </div>
    </div>
  );

  // Render form fields for role information
  const renderRoleInfoFields = () => (
    <div className="space-y-3">
      <div className="p-3 bg-gray-50 rounded-md">
        <h3 className="text-xs font-medium text-gray-500 mb-2 flex items-center">
          <Briefcase size={14} className="mr-1 rtl:mr-0 rtl:ml-1" />
          {t('updatePersonalInfo.roleAndPosition')}
        </h3>
        <div className="space-y-3">
          {/* Role field */}
          <div className="bg-white rounded-md p-3 border border-gray-200 hover:border-gray-300">
            <label htmlFor="role" className="block text-xs font-medium text-gray-500 mb-1">
              {t('updatePersonalInfo.positionRole')}
            </label>
            <input
              type="text"
              id="role"
              name="role"
              value={formData.role || ''}
              onChange={handleInputChange}
              autoComplete="off"
              className={`w-full px-2 py-1.5 text-sm border border-gray-300 rounded shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 ${getFontClass(getLanguage(formData.role || ''))}`}
              dir={isRTL ? 'rtl' : 'ltr'}
            />
            {errors.role && <p className="text-xs text-red-600 mt-1">{errors.role}</p>}
          </div>

          {/* Department field */}
          <div className="bg-white rounded-md p-3 border border-gray-200 hover:border-gray-300">
            <label htmlFor="department" className="block text-xs font-medium text-gray-500 mb-1">
              {t('updatePersonalInfo.department')}
            </label>
            <input
              type="text"
              id="department"
              name="department"
              value={formData.department || ''}
              onChange={handleInputChange}
              autoComplete="off"
              className={`w-full px-2 py-1.5 text-sm border border-gray-300 rounded shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 ${getFontClass(getLanguage(formData.department || ''))}`}
              dir={isRTL ? 'rtl' : 'ltr'}
            />
          </div>

          {/* Rank field */}
          <div className="bg-white rounded-md p-3 border border-gray-200 hover:border-gray-300">
            <label htmlFor="rank" className="block text-xs font-medium text-gray-500 mb-1">
              {t('updatePersonalInfo.rank')}
            </label>
            <input
              type="text"
              id="rank"
              name="rank"
              value={formData.rank || ''}
              onChange={handleInputChange}
              autoComplete="off"
              className={`w-full px-2 py-1.5 text-sm border border-gray-300 rounded shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 ${getFontClass(getLanguage(formData.rank || ''))}`}
              dir={isRTL ? 'rtl' : 'ltr'}
            />
          </div>

          {/* Organization ID field */}
          <div className="bg-white rounded-md p-3 border border-gray-200 hover:border-gray-300">
            <label htmlFor="organization_id" className="block text-xs font-medium text-gray-500 mb-1">
              {t('updatePersonalInfo.organizationId')}
            </label>
            <input
              type="text"
              id="organization_id"
              name="organization_id"
              value={formData.organization_id || ''}
              onChange={handleInputChange}
              autoComplete="off"
              className={`w-full px-2 py-1.5 text-sm border border-gray-300 rounded shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 ${getFontClass(getLanguage(formData.organization_id || ''))}`}
              dir={isRTL ? 'rtl' : 'ltr'}
            />
          </div>

          {/* Organization Name field */}
          <div className="bg-white rounded-md p-3 border border-gray-200 hover:border-gray-300">
            <label htmlFor="organization_name" className="block text-xs font-medium text-gray-500 mb-1">
              {t('updatePersonalInfo.organizationName')}
            </label>
            <input
              type="text"
              id="organization_name"
              name="organization_name"
              value={formData.organization_name || ''}
              onChange={handleInputChange}
              autoComplete="off"
              className={`w-full px-2 py-1.5 text-sm border border-gray-300 rounded shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 ${getFontClass(getLanguage(formData.organization_name || ''))}`}
              dir={isRTL ? 'rtl' : 'ltr'}
            />
          </div>

          {/* Role information */}
          <div className="bg-white rounded-md p-3 border border-gray-200 hover:border-gray-300">
            <label htmlFor="role_information" className="block text-xs font-medium text-gray-500 mb-1">
              {t('updatePersonalInfo.additionalRoleInfo')}
            </label>
            <textarea
              id="role_information"
              name="role_information"
              value={formData.role_information || ''}
              onChange={handleInputChange}
              autoComplete="off"
              rows={4}
              className={`w-full px-2 py-1.5 text-sm border border-gray-300 rounded shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 ${getFontClass(getLanguage(formData.role_information || ''))}`}
              dir={isRTL ? 'rtl' : 'ltr'}
            ></textarea>
          </div>
        </div>
      </div>
    </div>
  );

  // Render status fields
  const renderStatusFields = () => (
    <div className="space-y-3">
      <div className="p-3 bg-gray-50 rounded-md">
        <h3 className="text-xs font-medium text-gray-500 mb-2 flex items-center">
          <Heart size={14} className="mr-1 rtl:mr-0 rtl:ml-1" />
          {t('updatePersonalInfo.statusInformation')}
        </h3>
        <div className="space-y-3">
          {/* Status field - Radio buttons */}
          <div className="bg-white rounded-md p-3 border border-gray-200 hover:border-gray-300">
            <label className="block text-xs font-medium text-gray-500 mb-2">
              {t('updatePersonalInfo.currentStatus')}
            </label>
            <div className="flex gap-4">
              <label className="flex items-center cursor-pointer">
                <input
                  type="radio"
                  name="is_dead"
                  value="alive"
                  checked={formData.is_dead === 'alive'}
                  onChange={handleInputChange}
                  className="mr-2 rtl:mr-0 rtl:ml-2"
                />
                <span className="text-sm text-gray-700">
                  {t('updatePersonalInfo.alive', 'Alive')}
                </span>
              </label>
              <label className="flex items-center cursor-pointer">
                <input
                  type="radio"
                  name="is_dead"
                  value="dead"
                  checked={formData.is_dead === 'dead'}
                  onChange={handleInputChange}
                  className="mr-2 rtl:mr-0 rtl:ml-2"
                />
                <span className="text-sm text-gray-700">
                  {t('updatePersonalInfo.deceased', 'Deceased')}
                </span>
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderFormContent = () => {
    switch (currentTab) {
      case 'personal':
        return renderPersonalInfoFields();
      case 'role':
        return renderRoleInfoFields();
      case 'status':
        return renderStatusFields();
      default:
        return renderPersonalInfoFields();
    }
  };

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
        className="bg-white rounded-lg shadow-xl w-full max-w-4xl overflow-hidden flex flex-col"
        style={{ maxHeight: "90vh" }}
        onClick={(e) => e.stopPropagation()}
      >
            {/* Header - Close Button */}
            <div className="flex justify-end items-center p-4 border-b border-gray-100">
              <button
                onClick={onClose}
                className="text-gray-500 hover:text-gray-700 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Content Area */}
            <div className="flex-grow overflow-y-auto custom-scrollbar">
              <div className="p-4">
                {/* Tab navigation */}
                <div className="flex border-b border-gray-100 mb-4">
                  {tabs.map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setCurrentTab(tab.id)}
                      className={`flex-1 py-2 px-1 flex items-center justify-center relative text-xs ${
                        currentTab === tab.id
                          ? 'text-gray-900 bg-white font-medium'
                          : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                      }`}
                      style={{
                        color: currentTab === tab.id ? THEME.primary : undefined
                      }}
                    >
                      {tab.icon}
                      <span className={currentTab === tab.id ? 'font-medium' : ''}>{tab.label}</span>
                      {currentTab === tab.id && (
                        <motion.div layoutId="node-editor-tab" className="absolute bottom-0 left-0 right-0 h-0.5"
                          style={{ backgroundColor: THEME.primary }} />
                      )}
                    </button>
                  ))}
                </div>

                {/* Tab content */}
                <TransitionView stateKey={currentTab}>
                  {renderFormContent()}
                </TransitionView>
              </div>
            </div>

            {/* Footer - Action Buttons */}
            <div className="border-t border-gray-100 p-4">
              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  className="flex-1 px-4 py-2.5 rounded-md text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
                >
                  {t('updatePersonalInfo.cancel', 'Cancel')}
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
                  {t('updatePersonalInfo.save', 'Save')}
                </button>
              </div>
            </div>
      </motion.div>
    </motion.div>
  );
};

export default NodeEditorModal;
