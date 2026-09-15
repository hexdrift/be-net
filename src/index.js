import React from 'react';
import { MotionGlobalConfig } from 'framer-motion';
import ReactDOM from 'react-dom/client';
import './index.css';
import './i18n/config'; // Initialize i18n BEFORE App
import App from './App';
import reportWebVitals from './reportWebVitals';

// Height/path animations also need to stop, beyond MotionConfig's transform policy.
const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
const syncMotionPreference = () => { MotionGlobalConfig.skipAnimations = motionPreference.matches; };
syncMotionPreference();
motionPreference.addEventListener('change', syncMotionPreference);
if (import.meta.hot) import.meta.hot.dispose(() => motionPreference.removeEventListener('change', syncMotionPreference));

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
