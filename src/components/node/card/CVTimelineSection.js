import TransitionView from '../../common/TransitionView';
import React, { useState, useRef } from 'react';
import { ArrowLeft, ArrowRight, User, GitBranch } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { getLanguage, getFontClass } from '../../../Utilities/languageUtils';
import axios from 'axios';
import '../../../styles/scrollbar.css';
import '../../../styles/fonts.css';

const API_BASE_URL = "http://localhost:5001";
const MAX_HEIGHT = 250; // Increased max height for better viewing

// Default theme to match other components
const DEFAULT_THEME = {
  primary: '#1F2937',
  primaryLight: '#374151',
  buttonColor: '#1F2937',
  buttonHover: '#111827',
  bgGray: '#F9FAFB',
  borderColor: '#E5E7EB'
};

// Calculate duration between two dates
const calculateDuration = (startDate, endDate, t) => {
  const start = new Date(startDate);
  const end = endDate ? new Date(endDate) : new Date();

  let years = end.getFullYear() - start.getFullYear();
  let months = end.getMonth() - start.getMonth();

  if (months < 0) {
    years--;
    months += 12;
  }

  if (years === 0 && months === 0) {
    return t('cvTimeline.lessThanMonth', '< 1 month');
  } else if (years === 0) {
    return months === 1
      ? `${months} ${t('cvTimeline.month', 'month')}`
      : `${months} ${t('cvTimeline.months', 'months')}`;
  } else if (months === 0) {
    return years === 1
      ? `${years} ${t('cvTimeline.year', 'year')}`
      : `${years} ${t('cvTimeline.years', 'years')}`;
  }

  const yearText = years === 1
    ? `${years} ${t('cvTimeline.year', 'year')}`
    : `${years} ${t('cvTimeline.years', 'years')}`;
  const monthText = months === 1
    ? `${months} ${t('cvTimeline.month', 'month')}`
    : `${months} ${t('cvTimeline.months', 'months')}`;

  return `${yearText} ${monthText}`;
};

const CVTimelineSection = ({ node, folderId, tableId, onBack, theme = DEFAULT_THEME }) => {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'he';
  const [activeScreen, setActiveScreen] = useState('main'); // 'main' or 'data'
  const [queryType, setQueryType] = useState(null); // 'person_id' or 'hierarchical'
  const [cv, setCV] = useState([]);
  const [error, setError] = useState(null);
  const [dataStatus, setDataStatus] = useState('idle');
  const hasPersonId = Boolean(node.person_id && node.person_id !== 'nan');

  const contentRef = useRef(null);

  const fetchCV = async (type) => {
    setDataStatus('loading');
    setError(null);
    setQueryType(type);

    const queryParam = type === 'person_id'
      ? `person_id=${encodeURIComponent(node.person_id)}`
      : `hierarchical_structure=${encodeURIComponent(node.hierarchical_structure)}`;

    try {
      const response = await axios.get(`${API_BASE_URL}/timeline/${folderId}?${queryParam}&table_id=${tableId}`);
      setCV(response.data.cv);

      if (response.data.cv.length === 0) {
        setDataStatus('no_data');
      } else {
        setDataStatus('success');
      }
      setActiveScreen('data');
    } catch (err) {
      setError(t('cvTimeline.errorFetching'));
      console.error("Error fetching CV data:", err);
      setDataStatus('error');
      setActiveScreen('data');
    }
  };

  const renderNavigationButton = () => (
    <button
      onClick={
        activeScreen === 'main'
          ? onBack
          : () => {
              setActiveScreen('main');
              setDataStatus('idle');
              setQueryType(null);
            }
      }
      className="w-full flex items-center px-4 py-2.5 rounded-md text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200"
    >
      {isRTL ? <ArrowRight size={18} className="ml-2" /> : <ArrowLeft size={18} className="mr-2" />}
      <span>{activeScreen === 'main' ? t('cvTimeline.backToMainInfo') : t('cvTimeline.backToQuerySelection')}</span>
    </button>
  );

  const renderQueryTypeSelection = () => (
    <div className="space-y-3 pt-2">
      {hasPersonId && (
        <button
          onClick={() => fetchCV('person_id')}
          className="w-full flex justify-between items-center px-4 py-2.5 rounded-md text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200"
        >
          <span className="flex items-center gap-2">
            <User size={18} />
            {t('cvTimeline.queryPersonalInfo')}
          </span>
        </button>
      )}

      <button
        onClick={() => fetchCV('hierarchical')}
        className="w-full flex justify-between items-center px-4 py-2.5 rounded-md text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200"
      >
        <span className="flex items-center gap-2">
          <GitBranch size={18} />
          {t('cvTimeline.queryHierarchicalInfo')}
        </span>
      </button>
    </div>
  );

  // Flatten all roles from all records for timeline display
  const getAllRoles = () => {
    const allRoles = [];
    cv.forEach(record => {
      record.roles.forEach(role => {
        allRoles.push({
          ...role,
          department: role.department || record.department
        });
      });
    });
    // Sort by start date descending (most recent first)
    return allRoles.sort((a, b) => new Date(b.startDate) - new Date(a.startDate));
  };

  const renderContent = () => {
    if (dataStatus === 'loading') {
      return (
        <div className="text-center py-6 px-4 bg-gray-50 rounded-md">
          <div className="animate-pulse flex flex-col items-center">
            <div className="w-12 h-12 bg-gray-200 rounded-full mb-4"></div>
            <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
            <div className="h-3 bg-gray-200 rounded w-1/2"></div>
          </div>
          <p className="text-sm text-gray-500 mt-4">{t('cvTimeline.loadingData')}</p>
        </div>
      );
    }

    if (dataStatus === 'error') {
      return (
        <div className="p-4 rounded-md bg-gray-50 border-l-4 border-gray-300 text-gray-700">
          <p className="font-medium mb-1">{t('cvTimeline.error')}</p>
          <p className="text-sm">{error}</p>
        </div>
      );
    }

    if (dataStatus === 'no_data') {
      return (
        <div className="p-4 rounded-md bg-gray-50 border-l-4 border-gray-300 text-gray-700">
          <p className="font-medium mb-1">{t('cvTimeline.noHistoricalData')}</p>
          <p className="text-sm">{t('cvTimeline.noDataAvailable')}</p>
        </div>
      );
    }

    const allRoles = getAllRoles();

    return (
      <div>
        {/* Header */}
        <div className="flex items-center gap-2 mb-3 px-1">
          {queryType === 'person_id' ? (
            <User size={18} className="text-gray-600" />
          ) : (
            <GitBranch size={18} className="text-gray-600" />
          )}
          <span className="text-sm font-medium text-gray-700">
            {t('cvTimeline.roleHistory')}
          </span>
          <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">
            {allRoles.length}
          </span>
        </div>

        {/* Timeline */}
        <div
          ref={contentRef}
          style={{ maxHeight: `${MAX_HEIGHT}px` }}
          className="overflow-y-auto custom-scrollbar rounded-md bg-gray-50 p-3"
        >
          <div className={`relative ${isRTL ? 'pr-4' : 'pl-4'}`}>
            {/* Vertical timeline line */}
            <div
              className={`absolute top-2 bottom-2 w-0.5 bg-gray-300 ${isRTL ? 'right-[7px]' : 'left-[7px]'}`}
            />

            {allRoles.map((role, index) => {
              const roleLanguage = getLanguage(role.role);
              const isCurrentRole = !role.endDate;
              const duration = calculateDuration(role.startDate, role.endDate, t);

              return (
                <div
                  key={index}
                  className={`relative mb-4 last:mb-0 ${isRTL ? 'mr-4' : 'ml-4'}`}
                >
                  {/* Timeline dot */}
                  <div
                    className={`absolute top-1.5 w-3 h-3 rounded-full border-2 ${
                      isCurrentRole
                        ? 'bg-gray-700 border-gray-700'
                        : 'bg-white border-gray-400'
                    } ${isRTL ? '-right-[22px]' : '-left-[22px]'}`}
                  />

                  {/* Role card */}
                  <div
                    className={`bg-white p-3 rounded-md border ${
                      isCurrentRole ? 'border-gray-300 shadow-sm' : 'border-gray-100'
                    }`}
                  >
                    {/* Current role badge */}
                    {isCurrentRole && (
                      <span className="inline-block text-xs bg-gray-700 text-white px-2 py-0.5 rounded mb-2">
                        {t('cvTimeline.current', 'Current')}
                      </span>
                    )}

                    {/* Role title */}
                    <div
                      className={`${getFontClass(roleLanguage)}`}
                      dir={isRTL ? 'rtl' : 'ltr'}
                    >
                      <span className="font-medium text-gray-800">{role.role}</span>
                    </div>

                    {/* Department if available */}
                    {role.department && (
                      <div className="text-xs text-gray-600 mt-1">
                        {role.department}
                      </div>
                    )}

                    {/* Date and duration */}
                    <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
                      <span>
                        {new Date(role.startDate).toLocaleDateString(isRTL ? 'he-IL' : 'en-US')}
                        {' - '}
                        {role.endDate
                          ? new Date(role.endDate).toLocaleDateString(isRTL ? 'he-IL' : 'en-US')
                          : t('cvTimeline.present', 'Present')}
                      </span>
                      <span className="bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">
                        {duration}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="p-4">
      <div className="mb-4">
        {renderNavigationButton()}
      </div>

      <TransitionView stateKey={`${activeScreen}-${dataStatus}-${error || ''}`}>
      {activeScreen === 'main' && renderQueryTypeSelection()}
      {activeScreen === 'data' && renderContent()}
      </TransitionView>
    </div>
  );
};

export default CVTimelineSection;
