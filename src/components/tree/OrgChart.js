import React, { useState, useEffect, useMemo, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { List, AlertCircle, RefreshCw, Home, Folder } from "react-feather";
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useTranslation } from 'react-i18next';
import html2canvas from 'html2canvas';
import { useOrgChartContext } from "../context/OrgChartContext";
import FilterModal from "../modals/FilterModal";
import TreeNode from "../node/TreeNode";
import EnhancedNodeCard from "../node/EnhancedNodeCard";
import Button from "../common/Button";
import DataToolsModal from "../modals/DataToolsModal";
import FileUploadModal from "../modals/FileUploadModal";
import TableSelectionModal from "../modals/TableSelectionModal";
import SettingsModal from "../settings/SettingsModal.js";
import SearchBar from '../common/SearchBar.js';
import NavigationBar from "../layout/NavigationBar.js";
import OrgNode from '../node/OrgNode';
import NodeEditorModal from '../node/NodeEditorModal';
import NodeContextMenu from '../node/NodeContextMenu';
import ColorModal from '../modals/ColorModal';
import ColorLegend from '../common/ColorLegend';
import { addNode, updateNode, deleteNode } from '../../Utilities/api';
import { hasColorApplied } from '../../Utilities/colorUtils';

import {
  useDataFetching,
  useDataProcessing,
  useTransformHandlers,
  useModeHandlers,
  useSearchAndFilter,
  useNodeInteractions,
  useUIState
} from './hooks';

const OrgChart = ({ dbPath, initialTableId, initialFolderId, onReturnToLanding }) => {
  const { t, i18n } = useTranslation();
  const [orgData, setOrgData] = useState(null);
  const [filteredOrgData, setFilteredOrgData] = useState(null);
  const [dataTool, setDataTool] = useState(null);
  const [selectedTableId, setSelectedTableId] = useState(initialTableId);
  const [selectedFolderId, setSelectedFolderId] = useState(initialFolderId);
  const [folderStructure, setFolderStructure] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);

  // Node editor state
  const [isNodeEditorOpen, setIsNodeEditorOpen] = useState(false);
  const [nodeEditorMode, setNodeEditorMode] = useState('add'); // 'add' or 'edit'
  const [selectedNodeForEdit, setSelectedNodeForEdit] = useState(null);
  const [parentNodeForAdd, setParentNodeForAdd] = useState(null);

  // Context menu state
  const [contextMenuOpen, setContextMenuOpen] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState(null);
  const [contextMenuNode, setContextMenuNode] = useState(null);
  const contextMenuNodeRef = useRef(null);

  const {
    expandAll,
    setExpandAll,
    nodeColors,
    applyNodeColor,
    applyLevelColor,
    applyBranchColor,
    removeNodeColor,
    removeBranchColors,
    removeLevelColors,
    resetAllColors,
    saveLabelForColor,
    getSavedLabelsForColor,
    getLegendEntries,
    updateLabel,
    loadColorsFromAPI
  } = useOrgChartContext();

  // Color modal state
  const [isColorModalOpen, setIsColorModalOpen] = useState(false);
  const [colorModalNode, setColorModalNode] = useState(null);

  const {
    transform,
    setTransform,
    initialRootPosition,
    regularModePosition,
    setRegularModePosition,
    orgModePosition,
    setOrgModePosition,
    isDragging,
    dragRef,
    chartRef,
    storeInitialRootPosition,
    centerOnRoot,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleWheel
  } = useTransformHandlers();

  const {
    fetchData,
    fetchOrgStructureData,
    handleExportExcel,
    handleHighlight: highlightHandler,
    fetchFolderStructure,
    API_BASE_URL
  } = useDataFetching(
    dbPath,
    selectedTableId,
    selectedFolderId,
    setIsLoading,
    setError,
    setFolderStructure,
    setOrgData,
    setFilteredOrgData,
    setRegularModePosition,
    setOrgModePosition
  );

  const {
    filterOrgData,
    removeVacantPositions,
    processOrganizationData,
    findNodesInTree,
    getParentNode: getParentNodeFn
  } = useDataProcessing();

  const {
    isHierarchyMode,
    isOrganizationMode,
    setIsOrganizationMode,
    hideVacancies,
    setHideVacancies,
    hierarchyModeData,
    organizationModeData,
    handleOrganizationMode,
    handleHierarchyMode,
    handleToggleVacancies
  } = useModeHandlers(
    fetchOrgStructureData,
    processOrganizationData,
    selectedTableId,
    setExpandAll,
    filteredOrgData
  );

  const {
    activeFilters,
    searchResults,
    searchTerm,
    setSearchTerm,
    directSearchResults,
    filteredSearchResults,
    filterModalResetTrigger,
    isSearchBarVisible,
    treeSearchResults,
    currentTreeSearchIndex,
    preFilterOrgData,
    setPreFilterOrgData,
    handleSearch,
    handleTreeSearch,
    handleTreeSearchNavigation,
    handleFilterChange,
    handleClearFilter,
    handleClearSearch,
    handleFilterByOrg,
    toggleSearchBar
  } = useSearchAndFilter(
    API_BASE_URL,
    selectedFolderId,
    selectedTableId,
    orgData,
    setFilteredOrgData,
    setExpandAll,
    setIsOrganizationMode
  );

  const {
    selectedNode,
    setSelectedNode,
    highlightedNodes,
    setHighlightedNodes,
    renderedNodes,
    selectedSwapNode,
    swapKey,
    nodeOrder,
    handleNodeClick,
    handleNodeRendered,
    handleNodeUnrendered,
    handleSelectForSwap,
    handleCancelSwap,
    handleSwapNodesWithRerender,
    handleReorderNodes,
    handleBackgroundClick
  } = useNodeInteractions(
    selectedFolderId,
    selectedTableId
  );

  const {
    isFilterOpen,
    setIsFilterOpen,
    isUploadOpen,
    setIsUploadOpen,
    isTableSelectionOpen,
    setIsTableSelectionOpen,
    isSettingsOpen,
    setIsSettingsOpen,
    activeMenuId,
    setActiveMenuId,
    collapseAll,
    settings,
    setSettings,
    toggleFilterModal,
    handleCloseTableSelection,
    handleExpandAll,
    handleCollapseAll,
    handleKeyDown
  } = useUIState(
    setExpandAll,
    () => centerOnRoot(isOrganizationMode, isHierarchyMode, organizationModeData, hierarchyModeData, filteredOrgData)
  );

  // Folder-first upload workflow state
  const [tableSelectionMode, setTableSelectionMode] = useState('view'); // 'view' or 'upload'
  const [selectedFolderForUpload, setSelectedFolderForUpload] = useState(null);

  const handleHighlight = (hierarchicalNodeStructure) => {
    highlightHandler(hierarchicalNodeStructure, highlightedNodes, setHighlightedNodes);
  };

  const handleNodeClickWrapper = (node, isOrgFilter = false) => {
    const updatedData = handleNodeClick(node, isOrgFilter, filteredOrgData, organizationModeData);
    if (updatedData) {
      setFilteredOrgData(updatedData);
    }
  };

  const handleTreeSearchWrapper = (term) => {
    // Include both regular nodes and organization nodes in the search
    const allNodes = [...renderedNodes];
    
    // Add organization nodes if they exist
    if (isOrganizationMode && organizationModeData) {
      const collectOrgNodes = (node, nodes = []) => {
        if (node) {
          nodes.push(node);
          if (node.children && Array.isArray(node.children)) {
            node.children.forEach(child => collectOrgNodes(child, nodes));
          }
        }
        return nodes;
      };
      
      const orgNodes = collectOrgNodes(organizationModeData);
      allNodes.push(...orgNodes);
    }
    
    handleTreeSearch(term, allNodes);
  };

  const handleTreeSearchNavigationWrapper = (direction) => {
    const newTransform = handleTreeSearchNavigation(direction, chartRef, transform, settings);
    if (newTransform) {
      setTransform(newTransform);
      chartRef.current.style.transition = 'transform 0.3s ease-out';
      setTimeout(() => {
        chartRef.current.style.transition = '';
      }, 300);
    }
  };

  const handleCenter = () => {
    centerOnRoot(isOrganizationMode, isHierarchyMode, organizationModeData, hierarchyModeData, filteredOrgData);
  };

  const handleHome = () => {
    setSelectedNode(null);
    onReturnToLanding();
  };

  const getParentNode = (hierarchicalStructure) => {
    return getParentNodeFn(hierarchicalStructure, filteredOrgData);
  };

  // Node CRUD handlers
  const handleContextMenu = (e, node) => {
    // Check if clicking the same node that's currently open (using ref only)
    const isSameNode = contextMenuNodeRef.current &&
                       node &&
                       contextMenuNodeRef.current.hierarchical_structure === node.hierarchical_structure;

    console.log('handleContextMenu called:', {
      isSameNode,
      contextMenuOpen,
      currentNodeRef: contextMenuNodeRef.current?.hierarchical_structure,
      clickedNode: node?.hierarchical_structure
    });

    if (isSameNode) {
      console.log('Closing context menu (same node clicked)');
      setContextMenuOpen(false);
      setContextMenuPosition(null);
      setContextMenuNode(null);
      contextMenuNodeRef.current = null;
    } else {
      console.log('Opening context menu (new node or reopening)');
      setContextMenuPosition({ x: e.clientX, y: e.clientY });
      setContextMenuNode(node);
      contextMenuNodeRef.current = node;
      setContextMenuOpen(true);
    }
  };

  const handleCloseContextMenu = () => {
    setContextMenuOpen(false);
    setContextMenuPosition(null);
    setContextMenuNode(null);
    contextMenuNodeRef.current = null;
  };

  const handleAddChild = () => {
    setNodeEditorMode('add');
    setParentNodeForAdd(contextMenuNode);
    setSelectedNodeForEdit(null);
    setIsNodeEditorOpen(true);
    handleCloseContextMenu();
  };

  const handleAddSibling = () => {
    // Find parent of current node by parsing hierarchical structure
    const parentStructure = contextMenuNode.hierarchical_structure.split('/').slice(0, -1).join('/') || '/';
    const parentNode = parentStructure === '/' ? null : findNodeByStructure(filteredOrgData, parentStructure);

    setNodeEditorMode('add');
    setParentNodeForAdd(parentNode || contextMenuNode);
    setSelectedNodeForEdit(null);
    setIsNodeEditorOpen(true);
    handleCloseContextMenu();
  };

  const handleDeleteNode = async () => {
    if (!contextMenuNode) return;

    // Show confirmation dialog
    if (window.confirm(t('nodeOperations.confirmDelete') + '\n' + t('nodeOperations.deleteWarning'))) {
      try {
        await deleteNode(selectedTableId, contextMenuNode.hierarchical_structure);
        toast.success(t('nodeOperations.nodeDeletedSuccess'));
        await fetchData(); // Refresh the tree
        handleCloseContextMenu();
      } catch (error) {
        console.error('Error deleting node:', error);
        toast.error(t('nodeOperations.nodeDeletedError'));
      }
    } else {
      handleCloseContextMenu();
    }
  };

  // Color modal handlers
  const handleSetColor = () => {
    setColorModalNode(contextMenuNode);
    setIsColorModalOpen(true);
    handleCloseContextMenu();
  };

  const handleCloseColorModal = () => {
    setIsColorModalOpen(false);
    setColorModalNode(null);
  };

  const handleResetColors = () => {
    if (window.confirm(t('colorModal.confirmReset', 'Reset all node colors? This cannot be undone.'))) {
      resetAllColors();
      toast.success(t('colorModal.colorsReset', 'All colors have been reset'));
    }
  };

  // Handle export image - direct export without modal
  const handleExportImage = async () => {
    const treeContainer = document.getElementById('tree-container');

    if (!treeContainer) {
      toast.error(t('exportImage.error', 'Could not capture tree'));
      return;
    }

    // Show loading toast
    const loadingToast = toast.loading(t('exportImage.exporting', 'Exporting...'));

    try {
      // Hide UI elements before capture
      const elementsToHide = document.querySelectorAll('.export-hide');
      elementsToHide.forEach(el => {
        el.style.visibility = 'hidden';
      });

      // Small delay to ensure DOM updates
      await new Promise(resolve => setTimeout(resolve, 100));

      // Capture options
      const canvas = await html2canvas(treeContainer, {
        backgroundColor: '#f9fafb',
        scale: 2,
        useCORS: true,
        logging: false,
        allowTaint: true,
      });

      // Restore hidden elements
      elementsToHide.forEach(el => {
        el.style.visibility = '';
      });

      // Build descriptive filename
      // Get table name from folder structure
      const currentFolder = folderStructure.find(f => f.id === selectedFolderId);
      const currentTable = currentFolder?.tables?.find(t => t.id === selectedTableId);
      const tableName = currentTable?.name || 'tree';

      // Get org/root name from data
      const rootNode = filteredOrgData || orgData;
      const orgName = rootNode?.name || rootNode?.organization_name || '';

      // Create filename: tableName_orgName_timestamp
      const timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '').replace('T', '_');
      const sanitize = (str) => str.replace(/[^a-zA-Z0-9\u0590-\u05FF]/g, '_').slice(0, 30);

      let filename = sanitize(tableName);
      if (orgName) {
        filename += '_' + sanitize(orgName);
      }
      filename += '_' + timestamp + '.png';

      // Create download link
      const link = document.createElement('a');
      link.download = filename;
      link.href = canvas.toDataURL('image/png');
      link.click();

      toast.dismiss(loadingToast);
      toast.success(t('exportImage.success', 'Image exported successfully'));
    } catch (error) {
      console.error('Export failed:', error);
      // Restore elements on error
      document.querySelectorAll('.export-hide').forEach(el => {
        el.style.visibility = '';
      });
      toast.dismiss(loadingToast);
      toast.error(t('exportImage.error', 'Export failed'));
    }
  };

  // Wrapper for handleSelectForSwap to block colored nodes
  const handleSelectForSwapWrapper = (nodeInfo) => {
    if (hasColorApplied(nodeInfo.hierarchical_structure, nodeColors)) {
      toast.warning(t('colorModal.cannotMoveColored', 'Colored nodes cannot be moved. Remove the color first.'));
      return;
    }
    handleSelectForSwap(nodeInfo);
  };

  const handleSaveNode = async (nodeData) => {
    try {
      if (nodeEditorMode === 'add') {
        // Adding a new node
        const parentStructure = parentNodeForAdd?.hierarchical_structure || null;
        const response = await addNode(selectedTableId, parentStructure, nodeData);
        const inheritedFromPersonId = response.data?.inherited_from_person_id;
        if (inheritedFromPersonId) {
          toast.success(t('nodeOperations.nodeAddedWithInherit', { personId: inheritedFromPersonId }));
        } else {
          toast.success(t('nodeOperations.nodeAddedSuccess'));
        }
      } else {
        // Editing existing node
        const response = await updateNode(selectedTableId, selectedNodeForEdit.hierarchical_structure, nodeData);
        const syncedCount = response.data?.synced_count || 0;
        const syncedPersonId = response.data?.synced_person_id;
        if (syncedCount > 0 && syncedPersonId) {
          toast.success(t('nodeOperations.nodeUpdatedWithSync', { count: syncedCount, personId: syncedPersonId }));
        } else {
          toast.success(t('nodeOperations.nodeUpdatedSuccess'));
        }
      }

      // Refresh the tree data
      await fetchData();
      setIsNodeEditorOpen(false);
      setSelectedNodeForEdit(null);
      setParentNodeForAdd(null);
    } catch (error) {
      console.error('Error saving node:', error);
      if (nodeEditorMode === 'add') {
        toast.error(t('nodeOperations.nodeAddedError'));
      } else {
        toast.error(t('nodeOperations.nodeUpdatedError'));
      }
    }
  };

  const handleCloseNodeEditor = () => {
    setIsNodeEditorOpen(false);
    setSelectedNodeForEdit(null);
    setParentNodeForAdd(null);
  };

  // Helper function to find node by hierarchical structure
  const findNodeByStructure = (node, structure) => {
    if (!node) return null;
    if (node.hierarchical_structure === structure) return node;

    if (node.children && Array.isArray(node.children)) {
      for (const child of node.children) {
        const found = findNodeByStructure(child, structure);
        if (found) return found;
      }
    }

    return null;
  };

  // Calculate duplicate person IDs
  const duplicatePersonIds = useMemo(() => {
    const personIdCounts = {};
    const countPersonIds = (node) => {
      if (!node) return;
      if (node.person_id && node.person_id !== 'nan') {
        personIdCounts[node.person_id] = (personIdCounts[node.person_id] || 0) + 1;
      }
      if (node.children && Array.isArray(node.children)) {
        node.children.forEach(countPersonIds);
      }
    };
    countPersonIds(filteredOrgData);
    return Object.fromEntries(
      Object.entries(personIdCounts).filter(([_, count]) => count > 1)
    );
  }, [filteredOrgData]);

  // Handle file upload
  const handleFileUpload = async (uploadedData) => {
    setSelectedTableId(uploadedData.table_id);
    setSelectedFolderId(uploadedData.folder_id);
    // Reset mode-specific positions on new file upload
    setRegularModePosition(null);
    setOrgModePosition(null);
    await fetchData();
    setIsUploadOpen(false);
    setSelectedFolderForUpload(null);
    // No automatic centering - only user invoked
  };

  const handleTableSelection = async (tableId, folderId) => {
    setSelectedTableId(tableId);
    setSelectedFolderId(folderId);
    // Reset mode-specific positions on table change
    setRegularModePosition(null);
    setOrgModePosition(null);
    await fetchData();
    setIsTableSelectionOpen(false);
    // No automatic centering - only user invoked
  };

  const handleFolderSelectedForUpload = (folderId) => {
    setSelectedFolderForUpload(folderId);
    setIsTableSelectionOpen(false);
    setIsUploadOpen(true);
  };

  useEffect(() => {
    const loadInitialData = async () => {
      await fetchData();
    };

    loadInitialData();
  }, [fetchData]);

  // Load colors from API when table changes
  useEffect(() => {
    if (selectedTableId) {
      loadColorsFromAPI(selectedTableId);
    }
  }, [selectedTableId, loadColorsFromAPI]);

  // No automatic centering effect - centering will only be user-invoked

  useEffect(() => {
    if (orgData) {
      try {
        let processedData = orgData;
        
        if (hideVacancies) {
          processedData = removeVacantPositions(processedData);
          if (!processedData) {
            toast.warning(t('orgChart.noDataAfterHidingVacancies'));
            processedData = orgData;
            setHideVacancies(false);
          }
        }
        
        if (searchResults && searchResults.length > 0) {
          const searchedData = findNodesInTree(processedData, searchResults);
          setFilteredOrgData(searchedData || processedData);
          setExpandAll(!!searchedData);
        } else if (activeFilters.length > 0) {
          const filtered = filterOrgData(processedData, activeFilters);
          setFilteredOrgData(filtered || processedData);
          setExpandAll(!!filtered);
        } else {
          setFilteredOrgData(processedData);
          setExpandAll(false);
        }
      } catch (error) {
        console.error("Error processing org data:", error);
        toast.error(t('orgChart.errorProcessingData'));
        setFilteredOrgData(orgData);
        setExpandAll(false);
      }
    }
  }, [orgData, activeFilters, searchResults, hideVacancies, filterOrgData, setExpandAll, findNodesInTree, removeVacantPositions, setHideVacancies, t]);

  useEffect(() => {
    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    } else {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    }
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  // Add keyboard event listener
  useEffect(() => {
    const handleKeyDownEvent = (e) => {
      handleKeyDown(
        e, 
        isUpdateModalOpen, 
        isFilterOpen, 
        selectedSwapNode, 
        handleCancelSwap, 
        toggleFilterModal, 
        () => setIsSettingsOpen(prev => !prev), // Toggle settings modal
        () => centerOnRoot(isOrganizationMode, isHierarchyMode, organizationModeData, hierarchyModeData, filteredOrgData), 
        handleExpandAll, 
        handleCollapseAll, 
        handleClearFilter, 
        handleHierarchyMode, 
        handleOrganizationMode, 
        handleToggleVacancies, 
        toggleSearchBar, 
        setIsTableSelectionOpen, 
        setIsUploadOpen, 
        setTransform
      );
    };
    
    document.addEventListener("keydown", handleKeyDownEvent);
    return () => {
      document.removeEventListener("keydown", handleKeyDownEvent);
    };
  }, [
    handleKeyDown,
    isUpdateModalOpen,
    isFilterOpen,
    selectedSwapNode,
    handleCancelSwap,
    toggleFilterModal,
    centerOnRoot,
    isOrganizationMode,
    isHierarchyMode,
    organizationModeData,
    hierarchyModeData,
    filteredOrgData,
    handleExpandAll,
    handleCollapseAll,
    handleClearFilter,
    handleHierarchyMode,
    handleOrganizationMode,
    handleToggleVacancies,
    toggleSearchBar,
    setIsTableSelectionOpen,
    setIsUploadOpen,
    setTransform,
    setIsSettingsOpen
  ]);

  useEffect(() => {
    const handleDocumentClick = (e) => {
      if (selectedSwapNode && !e.target.closest('[id^="node-"]')) {
        handleCancelSwap();
      }
    };

    if (selectedSwapNode) {
      document.addEventListener('click', handleDocumentClick);
    }

    return () => {
      document.removeEventListener('click', handleDocumentClick);
    };
  }, [selectedSwapNode, handleCancelSwap]);

  useEffect(() => {
    if (!isOrganizationMode) {
      if (preFilterOrgData && activeFilters.length === 0) {
        setFilteredOrgData(preFilterOrgData);
        setPreFilterOrgData(null);
      }
    }
  }, [isOrganizationMode, preFilterOrgData, activeFilters, setPreFilterOrgData]);

  useEffect(() => {
    if (orgData && searchResults && searchResults.length > 0) {
      const searchedData = findNodesInTree(orgData, searchResults);
      
      if (searchedData) {
        setFilteredOrgData(searchedData);
        setExpandAll(true);
      } else {
        if (preFilterOrgData) {
          setFilteredOrgData(preFilterOrgData);
          setPreFilterOrgData(null);
        } else {
          setFilteredOrgData(orgData);
        }
        toast.warning(t('orgChart.noMatchingData'));
      }
    }
  }, [
    searchResults,
    orgData,
    findNodesInTree,
    preFilterOrgData,
    setFilteredOrgData,
    setExpandAll,
    setPreFilterOrgData,
    t
  ]);

  // Modified effect to store initial position once tree is loaded and rendered
  useEffect(() => {
    if (!isLoading && 
        (filteredOrgData || organizationModeData || hierarchyModeData)) {
      
      // Check if we already have a position for this mode
      const hasPositionForCurrentMode = 
        (isOrganizationMode && orgModePosition) ||
        (!isOrganizationMode && regularModePosition);
      
      if (!hasPositionForCurrentMode) {
        // Wait for DOM to be fully rendered, then calculate (but don't apply) position
        const timer = setTimeout(() => {
          storeInitialRootPosition(
            isOrganizationMode,
            isHierarchyMode,
            organizationModeData,
            hierarchyModeData,
            filteredOrgData
          );
          
          // Store this position in the appropriate mode-specific state
          if (initialRootPosition) {
            if (isOrganizationMode) {
              setOrgModePosition(initialRootPosition);
            } else {
              setRegularModePosition(initialRootPosition);
            }
          }
        }, 500);
        
        return () => clearTimeout(timer);
      }
    }
  }, [
    isLoading,
    filteredOrgData, 
    organizationModeData, 
    hierarchyModeData,
    isOrganizationMode,
    isHierarchyMode,
    regularModePosition,
    orgModePosition,
    storeInitialRootPosition,
    initialRootPosition,
    setOrgModePosition,
    setRegularModePosition
  ]);

  // Render loading state
  if (isLoading) {
    return (
      <motion.div 
        initial={{ opacity: 0 }} 
        animate={{ opacity: 1 }} 
        exit={{ opacity: 0 }} 
        className="flex justify-center items-center h-screen text-2xl text-gray-600"
      >
        Loading...
      </motion.div>
    );
  }

  // Render error state
  if (error) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="flex flex-col justify-center items-center h-screen bg-gray-50"
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="bg-white p-8 shadow-lg border border-gray-200 max-w-md w-full mx-4 text-center"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
            className="inline-flex items-center justify-center w-16 h-16 bg-red-50 mb-4"
          >
            <AlertCircle size={32} className="text-red-500" />
          </motion.div>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">{t('orgChart.errorTitle', 'Unable to Load Data')}</h2>
          <p className="text-gray-600 text-sm mb-6">{error}</p>
          <div className="flex gap-3 justify-center">
            <Button onClick={fetchData} icon={RefreshCw}>{t('orgChart.retry', 'Retry')}</Button>
            <Button onClick={onReturnToLanding} icon={Home} variant="secondary">{t('orgChart.goHome', 'Go Home')}</Button>
          </div>
        </motion.div>
      </motion.div>
    );
  }

  // Render empty state
  if (!dbPath || !selectedTableId || !filteredOrgData) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="flex flex-col justify-center items-center h-screen bg-gray-50"
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="bg-white p-8 shadow-lg border border-gray-200 max-w-md w-full mx-4 text-center"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
            className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 mb-4"
          >
            <Folder size={32} className="text-gray-500" />
          </motion.div>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">{t('orgChart.noDataTitle', 'No Data Available')}</h2>
          <p className="text-gray-600 text-sm mb-6">{t('orgChart.noDataDescription', 'Please select a table or upload data to get started.')}</p>
          <div className="flex gap-3 justify-center">
            <Button onClick={() => {
              setTableSelectionMode('view');
              setIsTableSelectionOpen(true);
            }} icon={List}>{t('orgChart.manageData', 'Manage Data')}</Button>
            <Button onClick={onReturnToLanding} icon={Home} variant="secondary">{t('orgChart.goHome', 'Go Home')}</Button>
          </div>
        </motion.div>
      </motion.div>
    );
  }

  // Check if tree is empty (root with no children)
  const isEmptyTree = filteredOrgData &&
                      filteredOrgData.id === 'root' &&
                      (!filteredOrgData.children || filteredOrgData.children.length === 0);

  // Render empty tree state with instructions
  if (isEmptyTree) {
    return (
      <>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="flex flex-col justify-center items-center h-screen bg-gradient-to-br from-gray-50 to-gray-100"
        >
          <div className="max-w-2xl w-full mx-4">
            {/* Main Card - matching landing page style */}
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="bg-white shadow-md border border-gray-200 overflow-hidden"
            >
              {/* Header Section */}
              <div className="bg-gray-800 p-6 border-b border-gray-700">
                <div>
                  <h2 className="text-2xl font-bold text-white">{t('chartOperations.emptyTreeTitle')}</h2>
                  <p className="text-gray-300 text-sm mt-1">{t('chartOperations.emptyTreeMessage')}</p>
                </div>
              </div>

              {/* Content Section */}
              <div className="p-6">
                {/* Steps Guide */}
                <div className="mb-6 space-y-4">
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 w-8 h-8 bg-gray-800 text-white flex items-center justify-center font-bold text-sm">
                      1
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-800 mb-1">{t('chartOperations.step1Title', 'Add Your First Node')}</h3>
                      <p className="text-gray-600 text-sm">{t('chartOperations.step1Desc', 'Start by creating the root node of your organization tree')}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 w-8 h-8 bg-gray-700 text-white flex items-center justify-center font-bold text-sm">
                      2
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-800 mb-1">{t('chartOperations.step2Title', 'Build Your Structure')}</h3>
                      <p className="text-gray-600 text-sm">{t('chartOperations.step2Desc', 'Add children and siblings to create your organizational hierarchy')}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 w-8 h-8 bg-gray-600 text-white flex items-center justify-center font-bold text-sm">
                      3
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-800 mb-1">{t('chartOperations.step3Title', 'Visualize & Manage')}</h3>
                      <p className="text-gray-600 text-sm">{t('chartOperations.step3Desc', 'View your tree, edit nodes, and export your data anytime')}</p>
                    </div>
                  </div>
                </div>

                {/* Action Button */}
                <div className="flex justify-center pt-4 border-t border-gray-200">
                  <motion.button
                    whileHover={{ y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      console.log('Add First Node clicked!');
                      setNodeEditorMode('add');
                      setParentNodeForAdd(null); // Root level
                      setSelectedNodeForEdit(null);
                      setIsNodeEditorOpen(true);
                      console.log('Modal should open, isNodeEditorOpen set to true');
                    }}
                    className="px-8 py-3 bg-gray-800 text-white hover:bg-gray-700 transition-colors flex items-center gap-3 font-medium"
                  >
                    <span className="text-xl">+</span>
                    <span>{t('chartOperations.addFirstNode')}</span>
                  </motion.button>
                </div>

                {/* Helper Text */}
                <p className="text-center text-gray-500 text-xs mt-4">
                  {t('chartOperations.tipText', 'Tip: Right-click any node later to add children or siblings')}
                </p>
              </div>
            </motion.div>

            {/* Feature Cards - matching landing page feature card style */}
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="grid grid-cols-3 gap-3 mt-4"
            >
              <div className="bg-white p-4 shadow-sm border border-gray-200 flex flex-col items-center text-center">
                <div className="p-2 bg-gray-100 mb-2">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
                  </svg>
                </div>
                <p className="text-xs font-medium text-gray-700">{t('chartOperations.feature1', 'Easy to Use')}</p>
              </div>
              <div className="bg-white p-4 shadow-sm border border-gray-200 flex flex-col items-center text-center">
                <div className="p-2 bg-gray-100 mb-2">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
                  </svg>
                </div>
                <p className="text-xs font-medium text-gray-700">{t('chartOperations.feature2', 'Fast & Responsive')}</p>
              </div>
              <div className="bg-white p-4 shadow-sm border border-gray-200 flex flex-col items-center text-center">
                <div className="p-2 bg-gray-100 mb-2">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="23 4 23 10 17 10"></polyline>
                    <polyline points="1 20 1 14 7 14"></polyline>
                    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
                  </svg>
                </div>
                <p className="text-xs font-medium text-gray-700">{t('chartOperations.feature3', 'Real-time Updates')}</p>
              </div>
            </motion.div>
          </div>
        </motion.div>

        <NodeEditorModal
          isOpen={isNodeEditorOpen}
          onClose={handleCloseNodeEditor}
          onSave={handleSaveNode}
          nodeData={selectedNodeForEdit}
          mode={nodeEditorMode}
          parentNode={parentNodeForAdd}
        />
      </>
    );
  }

  return (
    <>
      <motion.div 
        initial={{ opacity: 0 }} 
        animate={{ opacity: 1 }} 
        exit={{ opacity: 0 }} 
        className="h-screen w-screen overflow-hidden bg-gradient-to-br from-gray-50 to-gray-100 pt-20"
      >
        <NavigationBar
          onColumnRoles={() => setDataTool("roles")}
          onCompareTables={() => setDataTool("compare")}
          onHome={handleHome}
          onCenter={handleCenter}
          onFilter={toggleFilterModal}
          onHierarchyMode={handleHierarchyMode}
          onOrganizationMode={handleOrganizationMode}
          onToggleVacancies={handleToggleVacancies}
          onManageData={() => {
            setTableSelectionMode('view');
            setIsTableSelectionOpen(true);
          }}
          onExpandAll={handleExpandAll}
          onCollapseAll={handleCollapseAll}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onOpenHelp={() => {}}
          onSearch={toggleSearchBar}
          onClearFilter={handleClearFilter}
          onExportExcel={handleExportExcel}
          onExportImage={handleExportImage}
          onResetColors={!isOrganizationMode ? handleResetColors : undefined}
          isHierarchyMode={isHierarchyMode}
          isOrganizationMode={isOrganizationMode}
          hideVacancies={hideVacancies}
          hasActiveFilters={activeFilters.length > 0 || searchResults}
          activeMenuId={activeMenuId}
          setActiveMenuId={setActiveMenuId}
          selectedTableId={selectedTableId}
        />
  
        <div className="absolute top-18 right-4 rtl:right-auto rtl:left-4 z-10 flex items-center">
          <AnimatePresence>
            {isSearchBarVisible && (
              <motion.div
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: "auto" }}
                exit={{ opacity: 0, width: 0 }}
                transition={{ duration: 0.3 }}
                className="mr-2 rtl:mr-0 rtl:ml-2"
              >
                <SearchBar
                  onSearch={handleTreeSearchWrapper}
                  totalResults={treeSearchResults.length}
                  currentResult={currentTreeSearchIndex + 1}
                  onNavigate={handleTreeSearchNavigationWrapper}
                  onClose={toggleSearchBar}
                  searchTerm={searchTerm}
                  setSearchTerm={setSearchTerm}
                  autoFocus={true}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
  
        <AnimatePresence>{selectedSwapNode && !isOrganizationMode && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed top-20 inset-x-0 flex justify-center z-40">
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.2 }}
              className="bg-gray-50 border border-gray-200 text-gray-700 px-4 py-2.5 rounded-md shadow-md"
            >
              <span className="font-medium text-sm">
                Node selected for swapping.
              </span>
              <span className="text-sm ml-1">
                Click another node at the same level to swap positions, or click elsewhere to cancel.
              </span>
            </motion.div>
          </motion.div>
        )}</AnimatePresence>
  
        <div
          ref={dragRef}
          id="tree-container"
          className="w-full h-full cursor-move"
          onMouseDown={handleMouseDown}
          onWheel={handleWheel}
          onClick={handleBackgroundClick}
          style={{ overflow: "hidden" }}
        >
          <div
            ref={chartRef}
            style={{
              transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
              transition: isDragging ? "none" : "transform 0.3s ease-out",
              transformOrigin: "0 0"
            }}
          >
            <AnimatePresence mode="wait" initial={false}><motion.div key={`${selectedTableId}-${isOrganizationMode}-${isHierarchyMode}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: .15 }} className="p-8 pt-20">
              {isOrganizationMode ? (
                <OrgNode
                  key={`org-tree-${swapKey}`}
                  node={organizationModeData || filteredOrgData}
                  onNodeClick={handleNodeClickWrapper}
                  onFilterByOrg={handleFilterByOrg}
                  expandAll={expandAll}
                  collapseAll={collapseAll}
                  folderId={selectedFolderId}
                  tableId={selectedTableId}
                  searchTerm={searchTerm}
                  onNodePosition={(id, x, y) => {
                    const element = document.getElementById(`orgnode-${id}`);
                    if (element) {
                      element.dataset.x = x;
                      element.dataset.y = y;
                    }
                  }}
                  onNodeRendered={handleNodeRendered}
                  onNodeUnrendered={handleNodeUnrendered}
                  settings={settings}
                  onContextMenu={handleContextMenu}
                />
              ) : (
                <TreeNode
                  key={`tree-${swapKey}`}
                  node={isHierarchyMode ?
                        (hierarchyModeData || filteredOrgData) :
                        filteredOrgData}
                  onNodeClick={handleNodeClickWrapper}
                  expandAll={expandAll}
                  collapseAll={collapseAll}
                  folderId={selectedFolderId}
                  tableId={selectedTableId}
                  highlightedNodes={highlightedNodes}
                  onHighlight={handleHighlight}
                  isHierarchyMode={isHierarchyMode}
                  isOrganizationMode={false}
                  searchTerm={searchTerm}
                  searchResults={treeSearchResults}
                  currentSearchIndex={currentTreeSearchIndex}
                  onNodePosition={(id, x, y) => {
                    const element = document.getElementById(`node-${id}`);
                    if (element) {
                      element.dataset.x = x;
                      element.dataset.y = y;
                    }
                  }}
                  onNodeRendered={handleNodeRendered}
                  onNodeUnrendered={handleNodeUnrendered}
                  filteredSearchResults={filteredSearchResults}
                  directSearchResults={directSearchResults}
                  duplicatePersonIds={duplicatePersonIds}
                  settings={settings}
                  onReorder={handleReorderNodes}
                  nodeOrder={nodeOrder}
                  nodeColors={nodeColors}
                  parentNodeId={null}
                  selectedSwapNode={selectedSwapNode}
                  onSelectForSwap={handleSelectForSwapWrapper}
                  onSwapNodes={handleSwapNodesWithRerender}
                  onCancelSwap={handleCancelSwap}
                  swapKey={swapKey}
                  onContextMenu={handleContextMenu}
                />
              )}
            </motion.div></AnimatePresence>
          </div>
        </div>
  
        {dataTool && <DataToolsModal mode={dataTool} tableId={selectedTableId} dbPath={dbPath} folders={folderStructure} onClose={() => setDataTool(null)} />}
        <AnimatePresence>
          {isSettingsOpen && (
            <SettingsModal
              isOpen={isSettingsOpen}
              onClose={() => setIsSettingsOpen(false)}
              settings={settings}
              onSettingsChange={setSettings}
            />
          )}
        </AnimatePresence>

        <AnimatePresence>
          {selectedNode && (
            <EnhancedNodeCard
              node={selectedNode}
              onClose={() => {
                setSelectedNode(null);
                setIsUpdateModalOpen(false);
              }}
              folderId={selectedFolderId}
              tableId={selectedTableId}
              folderStructure={folderStructure}
              onUpdateComplete={fetchData}
              onOpenUpdateModal={() => setIsUpdateModalOpen(true)}
              onCloseUpdateModal={() => setIsUpdateModalOpen(false)}
              getParentNode={getParentNode}
            />
          )}
        </AnimatePresence>
  
        <AnimatePresence>
          {isFilterOpen && (
            <FilterModal
              isOpen={isFilterOpen}
              onClose={() => setIsFilterOpen(false)}
              onApplyFilters={handleFilterChange}
              onSearch={handleSearch}
              onClearSearch={handleClearSearch}
              activeFilters={activeFilters}
              orgData={orgData}
              folderId={selectedFolderId}
              tableId={selectedTableId}
              resetTrigger={filterModalResetTrigger}
            />
          )}
        </AnimatePresence>

        <AnimatePresence>
          {isTableSelectionOpen && (
            <TableSelectionModal
              isOpen={isTableSelectionOpen}
              onClose={() => {
                handleCloseTableSelection();
                setTableSelectionMode('view');
                setSelectedFolderForUpload(null);
              }}
              onSelectTable={tableSelectionMode === 'view' ? handleTableSelection : undefined}
              onSelectFolder={tableSelectionMode === 'upload' ? handleFolderSelectedForUpload : undefined}
              onCreateTable={(folderId) => {
                setSelectedFolderForUpload(folderId);
                setIsTableSelectionOpen(false);
                setIsUploadOpen(true);
              }}
              onCurrentItemDeleted={(type, name) => {
                setIsTableSelectionOpen(false);
                toast.info(t('chartOperations.currentItemDeleted', {type: type === 'folder' ? t('common.folder') : t('common.table'), name: name}));
                onReturnToLanding();
              }}
              mode={tableSelectionMode}
              folderStructure={folderStructure}
              currentFolderId={selectedFolderId}
              currentTableId={selectedTableId}
              dbPath={dbPath}
              onRefresh={fetchFolderStructure}
            />
          )}
        </AnimatePresence>

        <AnimatePresence>
          {isUploadOpen && (
            <FileUploadModal
              isOpen={isUploadOpen}
              onClose={() => {
                setIsUploadOpen(false);
                setSelectedFolderForUpload(null);
              }}
              onUpload={handleFileUpload}
              dbPath={dbPath}
              preselectedFolderId={selectedFolderForUpload}
              folderStructure={folderStructure}
            />
          )}
        </AnimatePresence>

        <AnimatePresence>
          {isNodeEditorOpen && (
            <NodeEditorModal
              isOpen={isNodeEditorOpen}
              onClose={handleCloseNodeEditor}
              onSave={handleSaveNode}
              nodeData={selectedNodeForEdit}
              mode={nodeEditorMode}
              parentNode={parentNodeForAdd}
            />
          )}
        </AnimatePresence>

        <AnimatePresence>
          {contextMenuOpen && (
            <NodeContextMenu
              isOpen={contextMenuOpen}
              position={contextMenuPosition}
              onClose={handleCloseContextMenu}
              onAddChild={handleAddChild}
              onAddSibling={handleAddSibling}
              onDelete={handleDeleteNode}
              onSetColor={!isOrganizationMode ? handleSetColor : undefined}
              node={contextMenuNode}
              canDelete={contextMenuNode?.hierarchical_structure !== '/1'}
            />
          )}
        </AnimatePresence>

        <AnimatePresence>
          {isColorModalOpen && (
            <ColorModal
              isOpen={isColorModalOpen}
              onClose={handleCloseColorModal}
              node={colorModalNode}
              rootNode={hierarchyModeData || filteredOrgData}
              nodeColors={nodeColors}
              onApplyNodeColor={applyNodeColor}
              onApplyLevelColor={applyLevelColor}
              onApplyBranchColor={applyBranchColor}
              onRemoveColor={removeNodeColor}
              onRemoveBranchColors={removeBranchColors}
              onRemoveLevelColors={removeLevelColors}
              getSavedLabelsForColor={getSavedLabelsForColor}
              onSaveLabel={saveLabelForColor}
              onUpdateLabel={updateLabel}
            />
          )}
        </AnimatePresence>

        {/* Color Legend - only show in hierarchy mode when colors are applied */}
        <AnimatePresence>{!isOrganizationMode && (
          <ColorLegend
            entries={getLegendEntries()}
            isRTL={i18n.language === 'he'}
            onUpdateLabel={updateLabel}
          />
        )}</AnimatePresence>

      </motion.div>
    </>
  );
};

export default OrgChart;
