import React, { useEffect, useRef } from 'react';
import { ChevronUp, ChevronDown, X, Search } from 'react-feather';
import { AnimatePresence, motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';

const SearchBar = ({ onSearch, totalResults, currentResult, onNavigate, onClose, searchTerm, setSearchTerm, autoFocus }) => {
  const { t } = useTranslation();
  const inputRef = useRef(null);

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  const handleInputChange = (e) => {
    const newTerm = e.target.value;
    setSearchTerm(newTerm);
    onSearch(newTerm);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onNavigate('next');
    }
  };

  const SearchNavButton = ({ onClick, icon: Icon, label, variant = 'default' }) => {
    const getVariantClasses = () => {
      return variant === 'danger' 
        ? 'bg-red-50 text-red-600 hover:bg-red-100' 
        : 'bg-transparent hover:bg-gray-100 text-gray-700';
    };

    return (
      <motion.button
        onClick={onClick}
        className={`px-2 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center ${getVariantClasses()}`}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        aria-label={label}
      >
        <Icon size={16} />
      </motion.button>
    );
  };

  return (
    <div className="flex items-center bg-white bg-opacity-95 border border-gray-200 rounded-md shadow-sm overflow-hidden">
      <div className="flex items-center pl-2 text-gray-400">
        <Search size={16} />
      </div>
      <input
        ref={inputRef}
        id="tree-search-input"
        type="text"
        value={searchTerm}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        placeholder={t('searchBar.placeholder')}
        className="py-1.5 px-2 bg-transparent focus:outline-none text-sm text-gray-700 placeholder-gray-400 flex-grow w-40"
        autoComplete="off"
      />
      <AnimatePresence initial={false}>{searchTerm.trim() !== '' && <motion.div key={totalResults > 0 ? 'matches' : 'empty'} initial={{ opacity: 0, width: 0 }} animate={{ opacity: 1, width: 'auto' }} exit={{ opacity: 0, width: 0 }} transition={{ duration: .16 }} className="overflow-hidden whitespace-nowrap">{(
        totalResults > 0 ? (
        <div className="flex items-center">
          <span className="text-xs text-gray-500 mr-1 rtl:mr-0 rtl:ml-1 font-medium">
            {currentResult}/{totalResults}
          </span>
          <div className="flex">
            <SearchNavButton onClick={() => onNavigate('prev')} icon={ChevronUp} label={t('searchBar.previousResult')} />
            <SearchNavButton onClick={() => onNavigate('next')} icon={ChevronDown} label={t('searchBar.nextResult')} />
          </div>
        </div>
        ) : (
          <span className="text-xs text-gray-500 mx-2 font-medium">
            {t('searchBar.noResults')}
          </span>
        )
      )}</motion.div>}</AnimatePresence>
      <SearchNavButton onClick={onClose} icon={X} label={t('searchBar.closeSearch')} variant="danger" />
    </div>
  );
};

export default SearchBar;