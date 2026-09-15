import React, { useState, useEffect } from 'react';
import { AnimatePresence, MotionConfig, motion } from 'framer-motion';
import './styles/data-tools.css';
import './styles/motion.css';
import { OrgChartProvider } from './components/context/OrgChartContext';
import OrgChart from './components/tree/OrgChart';
import LandingPage from './components/pages/LandingPage';
import { ToastContainer } from 'react-toastify';
import { useTranslation } from 'react-i18next';
import 'react-toastify/dist/ReactToastify.css';
import './App.css';
import './styles/fonts.css';
import './styles/rtl.css';

function App() {
  const { i18n } = useTranslation();
  const [dbSelected, setDbSelected] = useState(false);
  const [dbPath, setDbPath] = useState(null);
  const [initialTableId, setInitialTableId] = useState(null);
  const [initialFolderId, setInitialFolderId] = useState(null);

  // Set document direction based on language
  useEffect(() => {
    const direction = i18n.language === 'he' ? 'rtl' : 'ltr';
    document.documentElement.dir = direction;
    document.documentElement.lang = i18n.language;

    // Only set Hebrew font when in Hebrew mode, otherwise use default system fonts
    if (i18n.language === 'he') {
      document.body.style.fontFamily = 'var(--font-hebrew)';
    } else {
      document.body.style.fontFamily = ''; // Reset to default system fonts from index.css
    }
  }, [i18n.language]);

  const handleDatabaseReady = (path, tableId, folderId) => {
    setDbPath(path);
    setInitialTableId(tableId);
    setInitialFolderId(folderId);
    setDbSelected(true);
  };

  const handleReturnToLanding = () => {
    setDbSelected(false);
    setDbPath(null);
    setInitialTableId(null);
    setInitialFolderId(null);
  };

  return (
    <MotionConfig reducedMotion="user" transition={{ duration: .2, ease: [0.16, 1, 0.3, 1] }}><div className="App">
      <OrgChartProvider>
        <AnimatePresence mode="wait" initial={false}><motion.div key={dbSelected ? 'chart' : 'landing'} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
        {!dbSelected ? (
          <LandingPage onDatabaseReady={handleDatabaseReady} currentDbPath={dbPath} />
        ) : (
          <OrgChart 
            dbPath={dbPath}
            initialTableId={initialTableId}
            initialFolderId={initialFolderId}
            onReturnToLanding={handleReturnToLanding}
          />
        )}
        </motion.div></AnimatePresence>
      </OrgChartProvider>
      <ToastContainer
        position={i18n.language === 'he' ? 'bottom-left' : 'bottom-right'}
        rtl={i18n.language === 'he'}
      />
    </div></MotionConfig>
  );
}

export default App;