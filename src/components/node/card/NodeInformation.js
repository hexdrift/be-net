import { motion } from 'framer-motion';
import TransitionView from '../../common/TransitionView';
import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, ArrowRight, User, BookOpen, Briefcase, Heart, Calendar, BadgeInfo, Award, Building } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { getLanguage, getFontClass } from '../../../Utilities/languageUtils';
import DOMPurify from 'dompurify';
import '../../../styles/fonts.css';
import '../../../styles/scrollbar.css';

// Default theme to match other components
const DEFAULT_THEME = {
  primary: '#1F2937',
  primaryLight: '#374151',
  buttonColor: '#1F2937',
  buttonHover: '#111827',
  bgGray: '#F9FAFB',
  borderColor: '#E5E7EB'
};

const NodeInformation = ({ node, onBack, theme = DEFAULT_THEME }) => {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'he';
  const [activeTab, setActiveTab] = useState('personal'); // 'personal', 'role', or 'personal_info'
  const [formattedPersonalInfo, setFormattedPersonalInfo] = useState('');
  const [formattedRoleInfo, setFormattedRoleInfo] = useState('');
  const contentRef = useRef(null);

  const personalInfoLanguage = getLanguage(node.personal_information || '');
  const roleInfoLanguage = getLanguage(node.role_information || '');

  // Calculate age from birth date
  const calculateAge = (birthDate) => {
    if (!birthDate) return null;
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  };

  const age = calculateAge(node.birth_date);

  // Format information text with enhanced styling
  const formatInformationText = (text) => {
    if (!text) return '';
    
    // Convert URLs to clickable links
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const textWithLinks = text.replace(
      urlRegex,
      '<a href="$1" target="_blank" rel="noopener noreferrer" class="text-gray-600 hover:text-gray-800 hover:underline inline-flex items-center"><span>$1</span><svg class="w-3 h-3 ml-1 rtl:ml-0 rtl:mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg></a>'
    );
    
    // Enhanced formatting for key information
    let enhancedText = textWithLinks;
    
    // Highlight years (e.g., 2015, 2020-2022)
    enhancedText = enhancedText.replace(/\b(19|20)\d{2}(-\d{2,4})?\b/g, '<span class="font-medium text-gray-700">$&</span>');
    
    // Highlight education and credentials
    const credentialPatterns = [
      /\b(MBA|PhD|BS|BA|MS|MD|JD|CPA|CFA|SHRM|CompTIA)\b/g,
      /\b([A-Z][a-z]+ University|University of [A-Z][a-z]+|College of [A-Z][a-z]+|School of [A-Z][a-z]+)\b/g
    ];
    
    credentialPatterns.forEach(pattern => {
      enhancedText = enhancedText.replace(pattern, '<span class="font-medium text-gray-700">$&</span>');
    });
    
    // Highlight job titles
    enhancedText = enhancedText.replace(/\b(CEO|CFO|CTO|COO|VP|Director|Manager|Lead|Head|Principal|Senior)\b/g, 
      '<span class="font-medium text-gray-700">$&</span>');
    
    // Handle paragraphs (double line breaks)
    enhancedText = enhancedText.replace(/\n\n+/g, '</p><p class="mt-4">');
    
    // Handle single line breaks
    enhancedText = enhancedText.replace(/\n/g, '<br />');
    
    // Wrap in paragraph tags
    const wrappedText = `<p>${enhancedText}</p>`;
    
    // Return the sanitized and formatted text
    return DOMPurify.sanitize(wrappedText);
  };

  // Format information texts when node data changes
  useEffect(() => {
    setFormattedPersonalInfo(formatInformationText(node.personal_information));
    setFormattedRoleInfo(formatInformationText(node.role_information));
  }, [node.personal_information, node.role_information]);

  // Display raw status string from is_dead field
  const getStatusDisplay = () => {
    return {
      text: node.is_dead || 'N/A',
      className: 'bg-gray-200 text-gray-700'
    };
  };

  const statusDisplay = getStatusDisplay();

  // Personal details in a structured format
  const personalDetails = [
    {
      icon: <Calendar className="text-gray-600" size={16} />,
      label: t('nodeInfo.birthDate'),
      value: node.birth_date ? `${new Date(node.birth_date).toLocaleDateString()} (${t('nodeInfo.age')}: ${age})` : t('nodeInfo.notAvailable')
    },
    {
      icon: <BadgeInfo className="text-gray-600" size={16} />,
      label: t('nodeInfo.personId'),
      value: node.person_id && node.person_id !== 'nan'
        ? node.person_id
        : t('nodeInfo.notSpecified')
    },
    {
      icon: <Award className="text-gray-600" size={16} />,
      label: t('nodeInfo.rank'),
      value: node.rank || t('nodeInfo.notSpecified')
    },
    {
      icon: <Building className="text-gray-600" size={16} />,
      label: t('nodeInfo.organizationId'),
      value: node.organization_id || t('nodeInfo.notSpecified')
    },
    {
      icon: <Heart className="text-gray-600" size={16} />,
      label: t('nodeInfo.status'),
      value: (
        <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusDisplay.className}`}>
          {statusDisplay.text}
        </span>
      )
    }
  ];

  // Tab configuration
  const tabs = [
    {
      id: 'personal',
      label: t('nodeInfo.personalDetails'),
      icon: <User size={16} className="mr-1 rtl:mr-0 rtl:ml-1" />
    },
    {
      id: 'role',
      label: t('nodeInfo.roleInformation'),
      icon: <Briefcase size={16} className="mr-1 rtl:mr-0 rtl:ml-1" />
    },
    {
      id: 'personal_info',
      label: t('nodeInfo.personalInformation'),
      icon: <BookOpen size={16} className="mr-1 rtl:mr-0 rtl:ml-1" />
    }
  ];

  return (
    <div className="bg-white rounded-lg overflow-hidden">
      {/* Back button with updated styling */}
      <div className="p-4 border-b border-gray-100">
        <button
          onClick={onBack}
          className="w-full flex items-center px-4 py-2.5 rounded-md text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200"
        >
          {isRTL ? <ArrowRight size={18} className="ml-2" /> : <ArrowLeft size={18} className="mr-2" />}
          <span>{t('nodeInfo.backToMainInfo')}</span>
        </button>
      </div>

      {/* Profile header - simplified */}
      <div className="px-4 py-3 border-b border-gray-100">
        <h2 className="text-base font-medium text-gray-900 flex items-center">
          <span>{node.name || t('nodeInfo.unknownName')}</span>
          {node.is_dead && (
            <span className="ml-2 rtl:ml-0 rtl:mr-2 text-gray-400 text-xs">
              ({t('nodeInfo.status')}: {node.is_dead})
            </span>
          )}
        </h2>
        <div className="flex items-center mt-1 text-gray-500 text-sm">
          <Briefcase size={14} className="mr-1 rtl:mr-0 rtl:ml-1" />
          <span>{node.role || t('nodeInfo.roleNotSpecified')}</span>
          {node.department && (
            <>
              <span className="mx-2 text-gray-300">•</span>
              <span>{node.department}</span>
            </>
          )}
        </div>
      </div>

      {/* Tab navigation - updated styling */}
      <div className="flex border-b border-gray-100">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 py-2 px-1 flex items-center justify-center relative text-xs ${
              activeTab === tab.id
                ? `text-${theme.primary} bg-white font-medium`
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
            style={{
              color: activeTab === tab.id ? theme.primary : undefined
            }}
          >
            {tab.icon}
            <span className={activeTab === tab.id ? 'font-medium' : ''}>{tab.label}</span>
            {activeTab === tab.id && (
              <motion.div layoutId="node-info-tab" className="absolute bottom-0 left-0 right-0 h-0.5"
                style={{ backgroundColor: theme.primary }} />
            )}
          </button>
        ))}
      </div>

      {/* Tab content - updated styling */}
      <TransitionView stateKey={activeTab} className="p-4 min-h-[250px]">
        {activeTab === 'personal' && (
          <div
            key="personal-tab"
            className="bg-white rounded-md overflow-hidden"
          >
            <div className="space-y-2">
              {personalDetails.map((item, index) => (
                <div 
                  key={index} 
                  className="p-3 bg-gray-50 rounded-md flex items-center gap-3"
                >
                  <div className="flex-shrink-0">
                    {item.icon}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xs font-medium text-gray-500">{item.label}</h3>
                    <div className="text-gray-800 text-sm">{item.value}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {activeTab === 'role' && (
          <div
            key="role-tab"
            className="space-y-3"
          >
            {/* Role information header */}
            <div className="p-3 bg-gray-50 rounded-md">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium text-sm text-gray-800">{node.role || t('nodeInfo.roleNotSpecified')}</h3>
                  <p className="text-gray-500 text-xs">{node.department || t('nodeInfo.departmentNotSpecified')}</p>
                </div>
                {node.rank && (
                  <div className="px-2 py-1 bg-gray-200 text-gray-700 rounded-full text-xs font-medium">
                    {t('nodeInfo.rank')}: {node.rank}
                  </div>
                )}
              </div>
            </div>

            {/* Organization information - new section */}
            <div className="p-3 bg-gray-50 rounded-md">
              <h3 className="text-xs font-medium text-gray-500 mb-1">{t('nodeInfo.organization')}</h3>
              <div className="flex flex-col gap-2">
                <div className="flex justify-between items-center">
                  <div className="flex items-center">
                    <Building className="text-gray-600 mr-2 rtl:mr-0 rtl:ml-2" size={14} />
                    <span className="text-sm text-gray-700">{t('nodeInfo.organizationName')}:</span>
                  </div>
                  <span className="text-sm font-medium text-gray-800">{node.organization_name || t('nodeInfo.notSpecified')}</span>
                </div>
                <div className="flex justify-between items-center">
                  <div className="flex items-center">
                    <BadgeInfo className="text-gray-600 mr-2 rtl:mr-0 rtl:ml-2" size={14} />
                    <span className="text-sm text-gray-700">{t('nodeInfo.organizationId')}:</span>
                  </div>
                  <span className="text-sm font-medium text-gray-800">{node.organization_id || t('nodeInfo.notSpecified')}</span>
                </div>
              </div>
            </div>

            {/* Hierarchical structure */}
            <div className="p-3 bg-gray-50 rounded-md">
              <h3 className="text-xs font-medium text-gray-500 mb-1">{t('nodeInfo.hierarchicalStructure')}</h3>
              <div className="p-2 bg-white rounded border border-gray-100 text-gray-700 font-mono text-xs break-all overflow-y-auto max-h-24 custom-scrollbar">
                {node.hierarchical_structure || t('nodeInfo.notAvailable')}
              </div>
            </div>
            
            {/* Role information content with scrolling */}
            {formattedRoleInfo ? (
              <div className="p-3 bg-gray-50 rounded-md">
                <h3 className="text-xs font-medium text-gray-500 mb-2 flex items-center">
                  <Briefcase size={14} className="mr-1 rtl:mr-0 rtl:ml-1" />
                  {t('nodeInfo.roleInformationUpper')}
                </h3>
                <div
                  className={`${getFontClass(roleInfoLanguage)} overflow-y-auto max-h-60 rounded-md bg-white p-3 border border-gray-100 custom-scrollbar`}
                  dir={isRTL ? 'rtl' : 'ltr'}
                  ref={contentRef}
                >
                  <div
                    dangerouslySetInnerHTML={{ __html: formattedRoleInfo }}
                    className="prose max-w-none text-gray-700 text-sm leading-relaxed"
                  />
                </div>
              </div>
            ) : (
              <div className="text-center py-8 px-4 text-gray-500 bg-gray-50 rounded-md">
                <Briefcase size={24} className="mx-auto mb-2 text-gray-300" />
                <p className="text-sm">{t('nodeInfo.noRoleInformation')}</p>
              </div>
            )}
          </div>
        )}
        
        {activeTab === 'personal_info' && (
          <div
            key="personal-info-tab"
            className="bg-gray-50 rounded-md p-3"
          >
            {/* Personal Information Content with improved scrolling */}
            {formattedPersonalInfo ? (
              <div>
                <h3 className="text-xs font-medium text-gray-500 mb-2 flex items-center">
                  <User size={14} className="mr-1 rtl:mr-0 rtl:ml-1" />
                  {t('nodeInfo.personalInformationUpper')}
                </h3>
                <div
                  className={`${getFontClass(personalInfoLanguage)} overflow-y-auto max-h-60 rounded-md bg-white p-3 border border-gray-100 custom-scrollbar`}
                  dir={isRTL ? 'rtl' : 'ltr'}
                >
                  <div
                    dangerouslySetInnerHTML={{ __html: formattedPersonalInfo }}
                    className="prose max-w-none text-gray-700 text-sm leading-relaxed"
                  />
                </div>
              </div>
            ) : (
              <div className="text-center py-6 text-gray-500">
                <User size={24} className="mx-auto mb-2 text-gray-300" />
                <p className="text-sm">{t('nodeInfo.noPersonalInformation')}</p>
              </div>
            )}
          </div>
        )}
      </TransitionView>
    </div>
  );
};

export default NodeInformation;
