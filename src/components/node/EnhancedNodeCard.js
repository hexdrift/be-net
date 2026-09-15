import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import TransitionView from '../common/TransitionView';
import { X, ArrowRight, User, Edit, ArrowLeft, FileText } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { getLanguage, getFontClass } from '../../Utilities/languageUtils';
import CVTimelineSection from './card/CVTimelineSection';
import UpdatePersonalInfoSection from './card/UpdatePersonalInfoSection.js';
import NodeInformation from './card/NodeInformation.js';
import '../../styles/fonts.css';
import '../../styles/scrollbar.css';

const THEME = {
  primary: '#1F2937',
  primaryLight: '#374151',
  buttonColor: '#1F2937',
  buttonHover: '#111827',
  bgGray: '#F9FAFB',
  borderColor: '#E5E7EB'
};

const EnhancedNodeCard = ({
  node,
  onClose,
  tableId,
  folderId,
  folderStructure,
  onUpdateComplete,
  onOpenUpdateModal,
  onCloseUpdateModal,
  getParentNode
}) => {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'he';
  const [activeScreen, setActiveScreen] = useState('main');
  const roleLanguage = getLanguage(node?.role || '');
  const departmentLanguage = getLanguage(node?.department || '');
  const hasPersonId = Boolean(node?.person_id && node.person_id !== 'nan');
  
  const handleOpenUpdateScreen = () => {
    setActiveScreen('updateMenu');
    onOpenUpdateModal && onOpenUpdateModal();
  };

  const handleCloseUpdateScreen = () => {
    setActiveScreen('main');
    onCloseUpdateModal && onCloseUpdateModal();
  };

  return (
    <AnimatePresence mode="wait" propagate initial={false}>
    {activeScreen === 'updatePersonal' ? <UpdatePersonalInfoSection
      key="personal-update" node={node} onBack={() => setActiveScreen('updateMenu')}
      folderId={folderId} tableId={tableId} folderStructure={folderStructure}
      onUpdateComplete={onUpdateComplete} theme={THEME}
    /> : <motion.div key="node-card"
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
        className="bg-white rounded-lg shadow-xl max-w-md w-full overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
        style={{ maxHeight: "calc(100vh - 40px)" }}
      >
        
        {/* Header - Fixed height */}
        <div className="flex justify-between items-center p-4 border-b border-gray-100">
          <div className="flex-grow">
            {/* Add name if needed: <span className="font-medium">{node?.name}</span> */}
          </div>
          <button 
            onClick={onClose} 
            className="text-gray-500 hover:text-gray-700"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content - Dynamic with fixed constraints */}
        <div className="flex-grow overflow-y-auto custom-scrollbar">
          <div className="relative">
            <TransitionView stateKey={activeScreen}>
              {activeScreen === 'main' && (
                <div className="p-6 space-y-4">
                  {/* Role */}
                  <div className="bg-gray-50 rounded-md p-3">
                    <div className="text-sm text-gray-500 mb-1">{t('nodeCard.role')}</div>
                    <div
                      className={`text-gray-800 font-medium ${getFontClass(roleLanguage)}`}
                      dir={isRTL ? 'rtl' : 'ltr'}
                    >
                      {node?.role || t('nodeCard.notSpecified')}
                    </div>
                  </div>

                  {/* Department */}
                  <div className="bg-gray-50 rounded-md p-3">
                    <div className="text-sm text-gray-500 mb-1">{t('nodeCard.department')}</div>
                    <div
                      className={`text-gray-800 ${getFontClass(departmentLanguage)}`}
                      dir={isRTL ? 'rtl' : 'ltr'}
                    >
                      {node?.department || t('nodeCard.notSpecified')}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="space-y-3 pt-2">
                    <button
                      onClick={() => setActiveScreen('information')}
                      className="w-full flex justify-between items-center px-4 py-2.5 rounded-md text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200"
                    >
                      <span>{t('nodeCard.viewInformation')}</span>
                      <FileText size={18} />
                    </button>

                    <button
                      onClick={() => setActiveScreen('cv')}
                      className="w-full flex justify-between items-center px-4 py-2.5 rounded-md text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200"
                    >
                      <span>{t('nodeCard.viewCV')}</span>
                      {isRTL ? <ArrowLeft size={18} /> : <ArrowRight size={18} />}
                    </button>

                    {hasPersonId && (
                      <button
                        onClick={handleOpenUpdateScreen}
                        className="w-full flex justify-between items-center px-4 py-2.5 rounded-md text-white font-medium"
                        style={{ backgroundColor: THEME.buttonColor }}
                      >
                        <span>{t('nodeCard.updateInformation')}</span>
                        <Edit size={18} />
                      </button>
                    )}
                  </div>
                </div>
              )}
              
              {activeScreen === 'updateMenu' && (
                <div className="p-6 space-y-4">
                  <button
                    onClick={handleCloseUpdateScreen}
                    className="w-full flex items-center px-4 py-2.5 rounded-md text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200"
                  >
                    {isRTL ? <ArrowRight size={18} className="ml-2" /> : <ArrowLeft size={18} className="mr-2" />}
                    <span>{t('nodeCard.backToMainInfo')}</span>
                  </button>

                  <div className="pt-2 space-y-3">
                    <button
                      onClick={() => setActiveScreen('updatePersonal')}
                      className="w-full flex justify-between items-center px-4 py-2.5 rounded-md text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200"
                    >
                      <span>{t('nodeCard.updatePersonalInfo')}</span>
                      <User size={18} />
                    </button>
                  </div>
                </div>
              )}

              {activeScreen === 'information' && (
                <div>
                  <NodeInformation
                    node={node}
                    onBack={() => setActiveScreen('main')}
                    theme={THEME}
                  />
                </div>
              )}
              
              {activeScreen === 'cv' && (
                <div>
                  <CVTimelineSection
                    node={node}
                    folderId={folderId}
                    tableId={tableId}
                    onBack={() => setActiveScreen('main')}
                    theme={THEME}
                  />
                </div>
              )}
            </TransitionView>
          </div>
        </div>
      </motion.div>
    </motion.div>}
    </AnimatePresence>
  );
};

export default EnhancedNodeCard;
