import TransitionView from '../common/TransitionView';
import React, { useState, useEffect, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import {
  Trash2,
  Check,
  Eye,
  X,
} from "react-feather";
import axios from "axios";
import { toast } from "react-toastify";
import { useTranslation } from 'react-i18next';
import ResultCard from "../search/ResultCard";
import '../../styles/scrollbar.css';

// Theme to match other modals
const THEME = {
  primary: '#1F2937',
  primaryLight: '#374151',
  buttonColor: '#1F2937',
  buttonHover: '#111827',
  bgGray: '#F9FAFB',
  borderColor: '#E5E7EB'
};

// Button component to match the new theme
const Button = ({ children, onClick, icon: Icon, variant = "primary", disabled = false, className = "" }) => {
  const getButtonStyle = () => {
    switch (variant) {
      case "primary":
        return {
          bg: THEME.buttonColor,
          hoverBg: THEME.buttonHover,
          text: "text-white"
        };
      case "secondary":
        return {
          bg: "bg-gray-100",
          hoverBg: "hover:bg-gray-200",
          text: "text-gray-700"
        };
      case "danger":
        return {
          bg: "bg-gray-100",
          hoverBg: "hover:bg-gray-200",
          text: "text-gray-700"
        };
      case "active":
        return {
          bg: THEME.primaryLight,
          hoverBg: THEME.buttonHover,
          text: "text-white"
        };
      default:
        return {
          bg: "bg-gray-100",
          hoverBg: "hover:bg-gray-200",
          text: "text-gray-600"
        };
    }
  };

  const style = getButtonStyle();
  
  return (
    <motion.button
      whileHover={!disabled ? { scale: 1.02 } : {}}
      whileTap={!disabled ? { scale: 0.98 } : {}}
      className={`px-4 py-2.5 rounded-md text-sm font-medium flex items-center justify-center gap-2 ${style.text} ${
        variant === "primary" || variant === "active" ? "" : style.bg + " " + style.hoverBg
      } ${disabled ? "opacity-50 cursor-not-allowed" : ""} ${className}`}
      style={{
        backgroundColor: (variant === "primary" || variant === "active") ? 
          (variant === "active" ? THEME.primaryLight : THEME.buttonColor) : 
          undefined
      }}
      onClick={onClick}
      disabled={disabled}
    >
      {Icon && <Icon size={18} className="mr-2 rtl:mr-0 rtl:ml-2" />}
      <span>{children}</span>
    </motion.button>
  );
};

const EnhancedFilterModal = ({
  isOpen,
  onClose,
  onSearch,
  folderId,
  tableId,
  resetTrigger,
}) => {
  const { t } = useTranslation();
  const [searchInput, setSearchInput] = useState("");
  const [results, setResults] = useState([]);
  const [selectedResults, setSelectedResults] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchResults = useCallback(
    async (query = "") => {
      setIsLoading(true);
      try {
        console.log(`Fetching results for folder: ${folderId}, table: ${tableId}`);
        console.log(`Search query: "${query}"`);
        
        const response = await axios.get(
          `http://localhost:5001/search/${folderId}/${tableId}`,
          {
            params: {
              query: query,
            },
          }
        );
        
        console.log(`Search response:`, response.data);
        if (response.data && Array.isArray(response.data.results)) {
          setResults(response.data.results);
        } else {
          console.error("Invalid response format:", response.data);
          setResults([]);
        }
      } catch (error) {
        console.error("Error fetching results:", error);
        toast.error(t('filterModal.failedToFetch'));
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    },
    [folderId, tableId, t]
  );

  // Keep a ref to avoid dependency loop while still respecting the ESLint warning
  const initialFetchRef = useRef(false);
  
  useEffect(() => {
    if (isOpen && !initialFetchRef.current) {
      fetchResults(searchInput);
      initialFetchRef.current = true;
    } else if (!isOpen) {
      initialFetchRef.current = false;
    }
  }, [isOpen, fetchResults, searchInput]);

  useEffect(() => {
    const resetModal = () => {
      setSearchInput("");
      setResults([]);
      setSelectedResults([]);
      setIsLoading(false);
    };

    if (resetTrigger) {
      resetModal();
    }
  }, [resetTrigger]);

  const handleClearAll = () => {
    setSelectedResults([]);
  };

  const handleSelectAll = () => {
    setSelectedResults(results.map((result) => result.hierarchical_structure));
  };

  const toggleResultSelection = (hierarchicalStructure) => {
    setSelectedResults((prev) =>
      prev.includes(hierarchicalStructure)
        ? prev.filter((id) => id !== hierarchicalStructure)
        : [...prev, hierarchicalStructure]
    );
  };

  const handleViewResults = () => {
    if (selectedResults.length === 0) {
      toast.warn(t('filterModal.selectResultsFirst'), { autoClose: 2000 });
      return;
    }
    const selectedResultsData = results.filter((result) =>
      selectedResults.includes(result.hierarchical_structure)
    );
    onSearch(selectedResultsData);
    onClose();
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter") {
      fetchResults(searchInput);
    }
  };

  // Sort function to sort results by number of matched terms
  const sortByMatchedTerms = (resultsToSort) => {
    return [...resultsToSort].sort((a, b) => {
      const aTerms = a.matched_terms?.length || 0;
      const bTerms = b.matched_terms?.length || 0;
      return bTerms - aTerms; // Sort in descending order
    });
  };

  const renderResults = () => {
    if (isLoading) {
      return (
        <div className="p-6 text-center">
          <div className="animate-pulse flex flex-col items-center">
            <div className="w-12 h-12 bg-gray-200 rounded-full mb-4"></div>
            <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
            <div className="h-3 bg-gray-200 rounded w-1/2"></div>
          </div>
          <p className="text-sm text-gray-500 mt-4">{t('filterModal.loadingResults')}</p>
        </div>
      );
    }

    if (results.length === 0) {
      return (
        <div className="text-center py-8">
          <p className="text-gray-500">{t('filterModal.noResultsFound')}</p>
          <p className="text-sm text-gray-400 mt-2">{t('filterModal.tryAdjusting')}</p>
        </div>
      );
    }

    // Sort results by number of matched terms before rendering
    const sortedResults = sortByMatchedTerms(results);

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sortedResults.map((result) => (
          <ResultCard
            key={result.hierarchical_structure}
            result={result}
            isSelected={selectedResults.includes(result.hierarchical_structure)}
            onSelect={toggleResultSelection}
            theme={THEME}
          />
        ))}
      </div>
    );
  };

  // No early return - let AnimatePresence from parent handle exit animations

  console.log("Rendering EnhancedFilterModal with:", {
    isOpen,
    searchInput,
    resultsCount: results.length,
    selectedResultsCount: selectedResults.length
  });

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
        className="bg-white rounded-lg shadow-xl w-full max-w-5xl overflow-hidden flex flex-col"
        style={{ maxHeight: "85vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-end items-center p-4 border-b border-gray-100">
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Search Controls */}
        <div className="p-6 border-b border-gray-100">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-grow">
              <input
                type="text"
                placeholder={t('filterModal.searchPlaceholder')}
                className="w-full p-2.5 pl-10 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-gray-500"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyPress={handleKeyPress}
              />
              <div className="absolute inset-y-0 left-0 flex items-center pl-3">
              </div>
            </div>
          </div>
        </div>

        {/* Results Summary */}
        {!isLoading && results.length > 0 && (
          <div className="px-6 py-3 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">
                {t('filterModal.sortedByRelevance')}
              </span>
              <span className="bg-gray-200 text-gray-800 rounded-full px-3 py-1 text-sm font-medium">
                {results.length} {results.length === 1 ? t('filterModal.result') : t('filterModal.results')}
              </span>
            </div>
          </div>
        )}

        {/* Results Area */}
        <div className="flex-grow overflow-y-auto custom-scrollbar">
          <div className="p-6">
            <div className="bg-white rounded-md border border-gray-100 overflow-hidden">
              <TransitionView stateKey={isLoading ? 'loading' : results.length ? 'results' : 'empty'} className="p-4">
                {renderResults()}
              </TransitionView>
            </div>
          </div>
        </div>

        {/* Action Buttons - Footer */}
        <div className="p-4 border-t border-gray-100">
          <div className="flex justify-between items-center">
            <div className="flex gap-2">
              <Button
                onClick={handleClearAll}
                icon={Trash2}
                variant="secondary"
                disabled={selectedResults.length === 0}
              >
                {t('filterModal.clearSelection')}
              </Button>
              <Button
                onClick={handleSelectAll}
                icon={Check}
                variant="secondary"
                disabled={results.length === 0}
              >
                {t('filterModal.selectAll')}
              </Button>
            </div>

            <Button
              onClick={handleViewResults}
              icon={Eye}
              variant="primary"
              disabled={selectedResults.length === 0}
            >
              {t('filterModal.viewSelected')} ({selectedResults.length})
            </Button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default EnhancedFilterModal;