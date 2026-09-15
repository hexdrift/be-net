import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronRight,
  ChevronLeft,
  List,
  Database,
  FolderPlus,
  Clock,
  ArrowLeft,
  ArrowRight,
  Layers,
  Grid,
  FileText,
  Layout,
  Activity,
  Globe
} from "react-feather";
import axios from "axios";
import { useTranslation } from 'react-i18next';
import FileUploadModal from "../modals/FileUploadModal";
import TableSelectionModal from "../modals/TableSelectionModal";
import {
  ExistingDatabaseSection,
  NewDatabaseSection,
} from "../database";
import { getFontClass } from '../../Utilities/languageUtils';

const API_BASE_URL = "http://localhost:5001";

// Theme to match other components
const THEME = {
  primary: '#1F2937',
  primaryLight: '#374151',
  buttonColor: '#1F2937',
  buttonHover: '#111827',
  bgGray: '#F9FAFB',
  borderColor: '#E5E7EB'
};

// Database status indicator
const StatusIndicator = ({ status, t }) => (
  <div className="flex items-center gap-2">
    <div className={`h-3 w-3 ${status ? 'bg-green-500' : 'bg-red-500'}`}>
      {status && (
        <span className="absolute inline-flex h-3 w-3 bg-green-500 opacity-75 animate-ping"></span>
      )}
    </div>
    <span className={`text-sm font-medium ${status ? 'text-green-600' : 'text-red-600'}`}>
      {status ? t('landingPage.connected') : t('landingPage.disconnected')}
    </span>
  </div>
);

// Feature card component with squared corners
const FeatureCard = ({ icon: Icon, title, description }) => (
  <motion.div 
    whileHover={{ y: -2 }}
    className="bg-white p-4 shadow-sm border border-gray-200 flex flex-col items-center text-center"
  >
    <div className="p-2 bg-gray-100 mb-2">
      <Icon size={20} className="text-gray-700" />
    </div>
    <h3 className="text-sm font-medium text-gray-800 mb-1">{title}</h3>
    <p className="text-gray-600 text-xs">{description}</p>
  </motion.div>
);

const LandingPage = ({ onDatabaseReady, currentDbPath }) => {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'he';
  const [step, setStep] = useState("initial");
  const [dbError, setDbError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [dbPath, setDbPath] = useState(currentDbPath);
  const [recentDbPath, setRecentDbPath] = useState(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isTableSelectionOpen, setIsTableSelectionOpen] = useState(false);
  const [tableSelectionMode, setTableSelectionMode] = useState('view'); // 'view' or 'upload'
  const [selectedFolderForUpload, setSelectedFolderForUpload] = useState(null);
  const [dbInfo, setDbInfo] = useState(null);
  const [folderStructure, setFolderStructure] = useState([]);

  useEffect(() => {
    const storedRecentDbPath = localStorage.getItem("recentDbPath");
    if (storedRecentDbPath) {
      setRecentDbPath(storedRecentDbPath);
    }
  }, []);

  const fetchFolderStructure = useCallback(async (path) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/folder_structure`, {
        params: { db_path: path },
      });
      console.log("Folder structure response:", response.data);
      setFolderStructure(response.data);
    } catch (error) {
      console.error("Error fetching folder structure:", error);
      setFolderStructure([]);
    }
  }, []);

  const fetchDbInfo = useCallback(async (path) => {
    if (!path) return;

    try {
      setIsLoading(true);
      setDbError('');
      setDbInfo(null);
      setFolderStructure([]);
      setSelectedFolderForUpload(null);
      setIsUploadModalOpen(false);
      setIsTableSelectionOpen(false);
      const response = await axios.post(`${API_BASE_URL}/check_existing_db`, {
        db_path: path,
      });
      console.log("Database check response:", response.data);
      if (response.data.exists) {
        setDbPath(response.data.path);
        setDbInfo({
          path: response.data.path,
          exists: true,
          hasData: response.data.hasData,
        });
        if (response.data.hasData) {
          await fetchFolderStructure(response.data.path);
          setStep("ready");
        } else {
          setStep("upload");
        }
        localStorage.setItem("recentDbPath", response.data.path);
        setRecentDbPath(response.data.path);
      } else {
        setDbInfo(null);
        setFolderStructure([]);
      }
    } catch (error) {
      console.error("Error fetching database info:", error);
      setDbError(error.response?.data?.error_key === 'database_format' ? t('columnRoles.errors.database_format') : error.response?.data?.error || t('tableDiff.failed'));
      setDbInfo(null);
      setFolderStructure([]);
    } finally {
      setIsLoading(false);
    }
  }, [fetchFolderStructure, t]);

  useEffect(() => {
    if (currentDbPath) {
      fetchDbInfo(currentDbPath);
    }
  }, [currentDbPath, fetchDbInfo]);

  const handleUseExistingDB = async (existingDbPath) => {
    try {
      await fetchDbInfo(existingDbPath);
    } catch (error) {
      console.error("Error checking existing DB:", error);
      alert("Error checking existing DB. Please try again.");
    }
  };

  const handleCreateNewDB = async (folderPath) => {
    try {
      setIsLoading(true);
      const response = await axios.post(`${API_BASE_URL}/create_new_db`, {
        db_path: folderPath,
      });
      console.log("Create new DB response:", response.data);
      if (response.data.error) {
        alert(response.data.error);
      } else {
        await fetchDbInfo(response.data.db_path);
      }
    } catch (error) {
      console.error("Error creating new DB:", error);
      alert("Error creating new DB. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleUploadFile = async (uploadedData) => {
    try {
      console.log("File uploaded:", uploadedData);
      await fetchDbInfo(dbPath);
      onDatabaseReady(dbPath, uploadedData.table_id, uploadedData.folder_id);
    } catch (error) {
      console.error("Error after file upload:", error);
      alert("Error processing uploaded file. Please try again.");
    }
  };

  const handleTableSelection = async (tableId, folderId) => {
    try {
      console.log("Table selected:", { tableId, folderId });
      onDatabaseReady(dbPath, tableId, folderId);
    } catch (error) {
      console.error("Error after table selection:", error);
      alert("Error processing table selection. Please try again.");
    }
  };

  const handleOpenTableSelection = async () => {
    console.log("Opening table selection modal with folder structure:", folderStructure);
    await fetchFolderStructure(dbPath);
    setTableSelectionMode('view');
    setIsTableSelectionOpen(true);
  };

  const handleFolderSelectedForUpload = (folderId) => {
    console.log("Folder selected for upload:", folderId);
    setSelectedFolderForUpload(folderId);
    setIsTableSelectionOpen(false);
    setIsUploadModalOpen(true);
  };

  const handleUseRecentDB = async () => {
    if (recentDbPath) {
      await handleUseExistingDB(recentDbPath);
    }
  };


  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="p-8 text-center relative"
        >
          <div className="animate-spin mb-6 mx-auto">
            <svg className="w-16 h-16 text-gray-700" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
          <motion.h3 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-2xl font-bold text-gray-800"
          >
            {t('landingPage.loadingWorkspace')}
          </motion.h3>
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-gray-500 mt-2"
          >
            {t('landingPage.preparingData')}
          </motion.p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-gray-50 to-gray-100 flex flex-col w-full h-full">
      {/* Header */}
      <div className="w-full py-4 px-8 bg-white shadow-sm border-b border-gray-200 flex items-center justify-between">
        <div className="flex items-center">
          <div className="bg-gray-800 h-10 w-10 flex items-center justify-center mr-3 rtl:mr-0 rtl:ml-3">
            <Layers size={20} className="text-white" />
          </div>
          <h1 className="text-xl font-bold text-gray-800">{t('landingPage.title')}</h1>
        </div>

        <div className="flex items-center gap-3">
          {/* Display connection status if we have a DB */}
          {dbPath && dbInfo && (
            <>
              <p className="text-sm text-gray-500 hidden md:block">
                {dbInfo.path}
              </p>
              <StatusIndicator status={dbInfo.exists} t={t} />
            </>
          )}

          {/* Language Toggle Button */}
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => {
              const newLanguage = i18n.language === 'he' ? 'en' : 'he';
              i18n.changeLanguage(newLanguage);
            }}
            className="flex items-center justify-center hover:opacity-70 transition-opacity"
            title={i18n.language === 'he' ? 'Switch to English' : 'עבור לעברית'}
          >
            <Globe size={24} className="text-gray-700" />
          </motion.button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-grow grid grid-cols-12 gap-0">
        {/* Left section - visual headline and features */}
        <div className="col-span-5 bg-white border-r border-gray-200 flex flex-col h-full">
        <div className="p-6 border-b border-gray-200">
      {/* Headline */}
      <div className="flex mb-3">
  <div className="bg-gray-800 w-2 self-stretch mr-3 rtl:mr-0 rtl:ml-3"></div>
  <div>
    <motion.h2
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="text-4xl font-bold text-gray-800"
    >
      {t('landingPage.visualize')}
    </motion.h2>
    <motion.h2
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
      className="text-3xl font-bold text-gray-600"
    >
      {t('landingPage.yourOrganization')}
    </motion.h2>
  </div>
</div>
<div className="bg-white border border-gray-200 p-6 mb-4 max-w-4xl mx-auto shadow-sm transition-all duration-300">
  <div className="flex flex-col items-center">
    {/* CEO Node */}
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      title={t('landingPage.ceoTitle')}
      className="shadow-sm p-4 w-48 bg-gray-50 border border-gray-200 flex items-center justify-center z-10"
      style={{ backgroundColor: "#F9FAFB" }}
    >
      <span className={`text-lg font-bold text-gray-800 ${getFontClass('default')}`}>CEO</span>
    </motion.div>
    
    {/* Vertical Connector from CEO - reduced height */}
    <motion.div
      initial={{ height: 0 }}
      animate={{ height: '20px' }}
      transition={{ duration: 0.3, delay: 0.2, ease: 'easeOut' }}
      className="w-1.5 bg-gray-300 -mt-0.5"
    />
    
    {/* Executives Grid with Horizontal Connector */}
    <div className="relative w-full">
      {/* Horizontal Connector - now with max-width and centering */}
      <div className="relative flex justify-center">
        <motion.div
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 0.3, delay: 0.4, ease: 'easeOut' }}
          className="absolute top-0 h-1.5 bg-gray-300 origin-center"
          style={{ width: '70%' }}
        />
      </div>
      
      {/* Executive Nodes */}
      <div className="grid grid-cols-3 gap-4 sm:gap-8 mt-6">
        {['CTO', 'CFO', 'COO'].map((exec, index) => (
          <div key={index} className="flex flex-col items-center">
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: '20px' }}
              transition={{ duration: 0.3, delay: 0.6, ease: 'easeOut' }}
              className="w-1.5 bg-gray-300 -mt-6"
            />
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4, delay: 0.8 + index * 0.2 }}
              title={t(`landingPage.${exec.toLowerCase()}Title`)}
              className="shadow-sm p-4 w-40 bg-gray-50 border border-gray-200 flex items-center justify-center z-10"
              style={{ backgroundColor: "#F9FAFB" }}
            >
              <span className={`text-base font-bold text-gray-800 ${getFontClass('default')}`}>
                {exec}
              </span>
            </motion.div>
          </div>
        ))}
      </div>
    </div>
  </div>
</div>
<motion.div
  initial={{ opacity: 0, x: -10 }}
  animate={{ opacity: 1, x: 0 }}
  transition={{ duration: 0.5, delay: 1.1 }}
  className="border-l-2 border-gray-800 pl-4 rtl:border-l-0 rtl:border-r-2 rtl:pl-0 rtl:pr-4"
>
  <p className="text-sm text-gray-600">
    {t('landingPage.tagline')}
  </p>
</motion.div>
    </div>
          
          {/* Features */}
          <div className="grid grid-cols-2 gap-3 p-4 mt-2">
            <FeatureCard
              icon={Grid}
              title={t('landingPage.interactiveCharts')}
              description={t('landingPage.interactiveChartsDesc')}
            />
            <FeatureCard
              icon={FileText}
              title={t('landingPage.importData')}
              description={t('landingPage.importDataDesc')}
            />
            <FeatureCard
              icon={Layout}
              title={t('landingPage.customViews')}
              description={t('landingPage.customViewsDesc')}
            />
            <FeatureCard
              icon={Activity}
              title={t('landingPage.realTimeUpdates')}
              description={t('landingPage.realTimeUpdatesDesc')}
            />
          </div>
          
          {/* Database status for mobile */}
          {dbPath && dbInfo && (
            <div className="md:hidden p-4 border-t border-gray-200 mt-auto">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">{t('landingPage.databaseStatus')}:</span>
                <StatusIndicator status={dbInfo.exists} t={t} />
              </div>
            </div>
          )}
        </div>
        
        {/* Right section - action area */}
        <div className="col-span-7 flex flex-col items-center justify-center p-8">
          {dbError && <p role="alert" className="mb-4 text-sm text-red-700">{dbError}</p>}
          <AnimatePresence mode="wait">
            {step === "initial" && (
              <motion.div
                key="initial"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="bg-white shadow-md border border-gray-200 p-6 w-full max-w-lg"
              >
                
                <div className="space-y-3">
                  {recentDbPath && (
                    <motion.button
                      whileHover={{ x: 5 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={handleUseRecentDB}
                      className="w-full flex items-center justify-between p-3 bg-gray-50 text-gray-800 hover:bg-gray-100 transition-colors border border-gray-200"
                    >
                      <span className="flex items-center">
                        <div className="bg-gray-200 p-2 mr-3 rtl:mr-0 rtl:ml-3">
                          <Clock size={20} className="text-gray-700" />
                        </div>
                        <div className="text-left">
                          <span className="font-medium block text-sm">{t('landingPage.useRecentDatabase')}</span>
                          <span className="text-xs text-gray-500 truncate block max-w-[200px]">{recentDbPath}</span>
                        </div>
                      </span>
                      {isRTL ? <ChevronLeft size={16} className="text-gray-500" /> : <ChevronRight size={16} className="text-gray-500" />}
                    </motion.button>
                  )}

                  <motion.button
                    whileHover={{ x: 5 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setStep("existing")}
                    className="w-full flex items-center justify-between p-3 bg-gray-50 text-gray-800 hover:bg-gray-100 transition-colors border border-gray-200"
                  >
                    <span className="flex items-center">
                      <div className="bg-gray-200 p-2 mr-3 rtl:mr-0 rtl:ml-3">
                        <Database size={20} className="text-gray-700" />
                      </div>
                      <div className="text-left">
                        <span className="font-medium block text-sm">{t('landingPage.useExistingDatabase')}</span>
                        <span className="text-xs text-gray-500">{t('landingPage.connectToDatabase')}</span>
                      </div>
                    </span>
                    {isRTL ? <ChevronLeft size={16} className="text-gray-500" /> : <ChevronRight size={16} className="text-gray-500" />}
                  </motion.button>

                  <motion.button
                    whileHover={{ x: 5 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setStep("new")}
                    className="w-full flex items-center justify-between p-3 bg-gray-50 text-gray-800 hover:bg-gray-100 transition-colors border border-gray-200"
                  >
                    <span className="flex items-center">
                      <div className="bg-gray-200 p-2 mr-3 rtl:mr-0 rtl:ml-3">
                        <FolderPlus size={20} className="text-gray-700" />
                      </div>
                      <div className="text-left">
                        <span className="font-medium block text-sm">{t('landingPage.createNewDatabase')}</span>
                        <span className="text-xs text-gray-500">{t('landingPage.startFreshDatabase')}</span>
                      </div>
                    </span>
                    {isRTL ? <ChevronLeft size={16} className="text-gray-500" /> : <ChevronRight size={16} className="text-gray-500" />}
                  </motion.button>
                </div>
              </motion.div>
            )}

            {step === "existing" && (
              <motion.div
                key="existing"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="bg-white shadow-md border border-gray-200 p-6 w-full max-w-lg"
              >
                <div className="flex items-center mb-4">
                  <div className="bg-gray-800 p-2 mr-3 rtl:mr-0 rtl:ml-3">
                    <Database size={18} className="text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-800">{t('landingPage.useExistingDatabase')}</h3>
                </div>
                
                <ExistingDatabaseSection
                  onUseExistingDB={handleUseExistingDB}
                />
                
                <motion.button
                  whileHover={{ x: -5 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setStep("initial")}
                  className="mt-4 w-full p-2.5 bg-gray-100 text-gray-800 hover:bg-gray-200 transition-colors flex items-center justify-center border border-gray-200"
                >
                  {isRTL ? <ArrowRight size={16} className="ml-2" /> : <ArrowLeft size={16} className="mr-2" />}
                  <span className="font-medium">{t('landingPage.backToOptions')}</span>
                </motion.button>
              </motion.div>
            )}

            {step === "new" && (
              <motion.div
                key="new"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="bg-white shadow-md border border-gray-200 p-6 w-full max-w-lg"
              >
                <div className="flex items-center mb-4">
                  <div className="bg-gray-800 p-2 mr-3 rtl:mr-0 rtl:ml-3">
                    <FolderPlus size={18} className="text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-800">{t('landingPage.createNewDatabase')}</h3>
                </div>
                
                <NewDatabaseSection onCreateNewDB={handleCreateNewDB} />
                
                <motion.button
                  whileHover={{ x: -5 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setStep("initial")}
                  className="mt-4 w-full p-2.5 bg-gray-100 text-gray-800 hover:bg-gray-200 transition-colors flex items-center justify-center border border-gray-200"
                >
                  {isRTL ? <ArrowRight size={16} className="ml-2" /> : <ArrowLeft size={16} className="mr-2" />}
                  <span className="font-medium">{t('landingPage.backToOptions')}</span>
                </motion.button>
              </motion.div>
            )}

            {step === "upload" && (
              <motion.div
                key="upload"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="bg-white shadow-md border border-gray-200 p-6 w-full max-w-lg"
              >
                <div className="flex items-center mb-4">
                  <div className="bg-gray-800 p-2 mr-3 rtl:mr-0 rtl:ml-3">
                    <Database size={18} className="text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-800">{t('landingPage.dbReady')}</h3>
                </div>

                <div className="bg-green-50 border border-green-200 p-3 mb-4">
                  <p className="text-green-800 text-sm">
                    <span className="font-bold">{t('common.success')}!</span> {t('landingPage.dbCreatedSuccess')}
                  </p>
                </div>

                <motion.button
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleOpenTableSelection}
                  className="w-full flex items-center justify-between p-3 bg-gray-800 text-white hover:bg-gray-700 transition-colors"
                  style={{ backgroundColor: THEME.buttonColor }}
                >
                  <span className="flex items-center">
                    <List size={18} className="mr-2 rtl:mr-0 rtl:ml-2" />
                    <span className="font-medium">{t('landingPage.openFolderView')}</span>
                  </span>
                  {isRTL ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
                </motion.button>

                <motion.button
                  whileHover={{ x: -5 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setStep("initial")}
                  className="mt-4 w-full p-2.5 bg-gray-100 text-gray-800 hover:bg-gray-200 transition-colors flex items-center justify-center border border-gray-200"
                >
                  {isRTL ? <ArrowRight size={16} className="ml-2" /> : <ArrowLeft size={16} className="mr-2" />}
                  <span className="font-medium">{t('landingPage.backToOptions')}</span>
                </motion.button>
              </motion.div>
            )}

            {step === "ready" && (
              <motion.div
                key="ready"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="bg-white shadow-md border border-gray-200 p-6 w-full max-w-lg"
              >
                <div className="flex items-center mb-4">
                  <div className="bg-gray-800 p-2 mr-3 rtl:mr-0 rtl:ml-3">
                    <Database size={18} className="text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-800">{t('landingPage.dbReady')}</h3>
                </div>
                
                <div className="bg-gray-50 border border-gray-200 p-4 mb-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-medium text-gray-700 text-sm">{t('landingPage.databasePath')}</span>
                    <span className="text-xs text-gray-500 truncate max-w-[250px]">{dbInfo?.path}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-gray-700 text-sm">{t('landingPage.status')}</span>
                    <StatusIndicator status={dbInfo?.exists} t={t} />
                  </div>
                </div>
                
                <div className="space-y-3">
                  <motion.button
                    whileHover={{ y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleOpenTableSelection}
                    className="w-full flex items-center justify-between p-3 bg-gray-800 text-white hover:bg-gray-700 transition-colors"
                    style={{ backgroundColor: THEME.buttonColor }}
                  >
                    <span className="flex items-center">
                      <List size={18} className="mr-2 rtl:mr-0 rtl:ml-2" />
                      <span className="font-medium">{t('landingPage.openFolderView')}</span>
                    </span>
                    {isRTL ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
                  </motion.button>

                  <motion.button
                    whileHover={{ x: -5 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setStep("initial")}
                    className="w-full p-2.5 bg-gray-100 text-gray-800 hover:bg-gray-200 transition-colors flex items-center justify-center border border-gray-200"
                  >
                    {isRTL ? <ArrowRight size={16} className="ml-2" /> : <ArrowLeft size={16} className="mr-2" />}
                    <span className="font-medium">{t('landingPage.backToOptions')}</span>
                  </motion.button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {isUploadModalOpen && (
          <FileUploadModal
            isOpen={isUploadModalOpen}
            onClose={() => {
              setIsUploadModalOpen(false);
              setSelectedFolderForUpload(null);
            }}
            onUpload={handleUploadFile}
            dbPath={dbPath}
            preselectedFolderId={selectedFolderForUpload}
            folderStructure={folderStructure}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {isTableSelectionOpen && (
          <TableSelectionModal
            isOpen={isTableSelectionOpen}
            onClose={() => {
              setIsTableSelectionOpen(false);
              setTableSelectionMode('view');
              setSelectedFolderForUpload(null);
            }}
            onSelectTable={tableSelectionMode === 'view' ? handleTableSelection : undefined}
            onSelectFolder={tableSelectionMode === 'upload' ? handleFolderSelectedForUpload : undefined}
            onCreateTable={(folderId) => {
              setSelectedFolderForUpload(folderId);
              setIsTableSelectionOpen(false);
              setIsUploadModalOpen(true);
            }}
            mode={tableSelectionMode}
            folderStructure={folderStructure}
            dbPath={dbPath}
            onRefresh={() => fetchFolderStructure(dbPath)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default LandingPage;
