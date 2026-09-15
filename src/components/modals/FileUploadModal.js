import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Upload,
  Download,
  File,
  FileText,
  Edit3,
  GitBranch,
} from "react-feather";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import axios from "axios";
import { useTranslation } from "react-i18next";
import HierarchyPreview from "../data/HierarchyPreview";
import ColumnRoles, { columnRoleError } from "./ColumnRoles";
import DatePickerWrapper from "../common/DatePickerWrapper";
import "../../styles/datepicker.css";
import '../../styles/scrollbar.css';

const API_BASE_URL = "http://localhost:5001";

// Theme to match SettingsModal
const THEME = {
  primary: '#1F2937',
  primaryLight: '#374151',
  buttonColor: '#1F2937',
  buttonHover: '#111827',
  bgGray: '#F9FAFB',
  borderColor: '#E5E7EB'
};

// Logo removed as requested

const convertToUTCDate = (date) =>
  new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
const formatDateForAPI = (date) => date.toISOString().split("T")[0];
const downloadAsset = (href, filename) => {
  const link = document.createElement("a");
  link.href = href;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
const downloadParsingLog = (log, tableId) => {
  const blob = new Blob([JSON.stringify(log, null, 2)], { type: "application/json" });
  const href = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = href;
  link.download = tableId
    ? `parsing_log_table_${tableId}.json`
    : "parsing_log_upload.json";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(href);
};

const FileUploadModal = ({ isOpen, onClose, onUpload, dbPath, preselectedFolderId, folderStructure = [] }) => {
  const { t } = useTranslation();
  const [creationMethod, setCreationMethod] = useState("upload"); // "upload" or "build"
  const [selectedFile, setSelectedFile] = useState(null);
  const [tableName, setTableName] = useState(""); // Changed from folderName to tableName
  const [uploadDate, setUploadDate] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [treeName, setTreeName] = useState("");
  const [folderName, setFolderName] = useState(""); // Store folder name for create-tree
  const [isDownloadMenuOpen, setIsDownloadMenuOpen] = useState(false);
  const [source, setSource] = useState(null);
  const [roles, setRoles] = useState(null);
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [importError, setImportError] = useState('');
  const fileInputRef = useRef(null);
  const downloadMenuRef = useRef(null);
  const previewRequest = useRef(0);

  useEffect(() => {
    previewRequest.current += 1;
    setSource(null);
    setRoles(null);
    setPreview(null);
    setImportError('');
    if (!selectedFile) return;
    let active = true;
    setBusy(true);
    const data = new FormData();
    data.append('file', selectedFile);
    axios.post(`${API_BASE_URL}/upload/preview`, data).then(response => {
      if (active) {
        setSource(response.data);
        setRoles(response.data.suggested_roles);
      }
    }).catch(error => {
      if (active) setImportError(columnRoleError(error, t));
    }).finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [selectedFile, t]);

  const updateRoles = next => {
    previewRequest.current += 1;
    setRoles(next);
    setPreview(null);
    setImportError('');
  };

  const handlePreview = async () => {
    const currentRequest = ++previewRequest.current;
    setBusy(true);
    setImportError('');
    const data = new FormData();
    data.append('file', selectedFile);
    data.append('column_roles', JSON.stringify(roles));
    try {
      const response = await axios.post(`${API_BASE_URL}/upload/preview`, data);
      if (currentRequest === previewRequest.current) setPreview(response.data);
    } catch (error) {
      if (currentRequest === previewRequest.current) setImportError(columnRoleError(error, t));
    } finally { if (currentRequest === previewRequest.current) setBusy(false); }
  };

  useEffect(() => {
    if (isOpen && dbPath) {
      // Always default to upload method when modal opens
      setCreationMethod("upload");

      setSelectedFile(null);
      setTableName("");
      setUploadDate(null);
      setTreeName("");
      setFolderName("");
      setIsDownloadMenuOpen(false);

      // Look up folder name from folder ID
      if (preselectedFolderId && folderStructure.length > 0) {
        const folder = folderStructure.find(f => f.id === preselectedFolderId);
        if (folder) {
          setFolderName(folder.name);
        }
      }
    }
  }, [isOpen, dbPath, preselectedFolderId, folderStructure]);

  useEffect(() => {
    if (!isDownloadMenuOpen) {
      return undefined;
    }

    const closeMenu = (event) => {
      if (
        event.type === "keydown" &&
        event.key !== "Escape"
      ) {
        return;
      }

      if (
        event.type === "mousedown" &&
        downloadMenuRef.current?.contains(event.target)
      ) {
        return;
      }

      setIsDownloadMenuOpen(false);
    };

    document.addEventListener("mousedown", closeMenu);
    document.addEventListener("keydown", closeMenu);

    return () => {
      document.removeEventListener("mousedown", closeMenu);
      document.removeEventListener("keydown", closeMenu);
    };
  }, [isDownloadMenuOpen]);

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (busy) return;
    const file = e.dataTransfer.files[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleAreaClick = () => {
    fileInputRef.current.click();
  };

  const handleTableNameChange = (event) => setTableName(event.target.value);
  const handleUploadDateChange = (date) => setUploadDate(date);
  const selectedFolder = Array.isArray(folderStructure)
    ? folderStructure.find(folder => folder.id === preselectedFolderId)
    : null;

  const handleUpload = async () => {
    if (selectedFile && selectedFolder && uploadDate && preview?.inserted_count && !busy) {
      setBusy(true);
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("column_roles", JSON.stringify(roles));
      formData.append("folder_id", selectedFolder.id);
      formData.append("folder_name", selectedFolder.name);
      formData.append("is_new_folder", "false");
      if (tableName) {
        formData.append("table_name", tableName);
      }
      formData.append(
        "upload_date",
        formatDateForAPI(convertToUTCDate(uploadDate))
      );
      formData.append("db_path", dbPath);

      try {
        const response = await axios.post(`${API_BASE_URL}/upload`, formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });

        if (response.data.log) {
          downloadParsingLog(response.data.log, response.data.table_id);
        }
        onUpload(response.data);
        onClose();
        if (response.data.log) {
          toast.warning(t('chartOperations.parsingIssuesDownloaded'));
        } else {
          toast.success(t('fileUpload.uploadSuccess'));
        }
      } catch (error) {
        console.error("Failed to upload file:", error);
        if (error.response?.data?.log) {
          downloadParsingLog(error.response.data.log);
        }
        toast.error(
          columnRoleError(error, t)
        );
      } finally { setBusy(false); }
    }
  };

  const handleBuildTree = async () => {
    if (treeName && folderName && uploadDate) {
      // Create empty tree structure with just the root node
      const nodes = {
        root: { id: 'root', children: [] }
      };

      try {
        const response = await axios.post(`${API_BASE_URL}/create-tree`, {
          treeName: treeName,
          nodes: nodes,
          folderName: folderName,
          uploadDate: formatDateForAPI(convertToUTCDate(uploadDate)),
        }, {
          params: { db_path: dbPath }
        });

        onUpload(response.data);
        onClose();
        toast.success(t('fileUpload.treeCreatedSuccess'));
      } catch (error) {
        console.error("Failed to create tree:", error);
        toast.error(
          error.response?.data?.error || t('fileUpload.failedToCreateTree')
        );
      }
    }
  };

  const handleDownloadGuide = () => {
    setIsDownloadMenuOpen(false);
    downloadAsset(
      "/מדריך מפורט להעלאת נתונים.pdf",
      "be-net-file-upload-guide.pdf"
    );
  };

  const handleDownloadReference = () => {
    setIsDownloadMenuOpen(false);
    downloadAsset(
      "/be-net-reference-upload.xlsx",
      "be-net-reference-upload.xlsx"
    );
  };

  const isUploadDisabled = !selectedFile || (preview && !uploadDate) || !selectedFolder || busy || !source || (preview && !preview.inserted_count);
  const isBuildDisabled = !treeName || !uploadDate || !folderName;

  // No early return or internal AnimatePresence - parent handles exit animations

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex justify-center items-center p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.2, delay: 0.05 }}
        className="bg-white rounded-lg shadow-xl w-full max-w-3xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
              {/* Header */}
              <div className="flex justify-between items-center p-4 border-b border-gray-100">
                <div className="flex-grow"></div>
                <button onClick={onClose} aria-label={t('common.close')} className="text-gray-500 hover:text-gray-700 transition-colors">
                  <X size={20} />
                </button>
              </div>

              {/* Content */}
              <div className="p-6 space-y-5 max-h-[calc(100vh-200px)] overflow-y-auto custom-scrollbar">
                {/* Method Selection Tabs */}
                <div className="flex gap-2">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setCreationMethod("upload")}
                    className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors duration-200 flex items-center justify-center gap-2 ${
                      creationMethod === "upload"
                        ? "bg-gray-900 text-white"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                    style={{
                      backgroundColor: creationMethod === "upload" ? THEME.primary : undefined
                    }}
                  >
                    <Upload size={16} />
                    {t('fileUpload.uploadFile')}
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setCreationMethod("build")}
                    className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors duration-200 flex items-center justify-center gap-2 ${
                      creationMethod === "build"
                        ? "bg-gray-900 text-white"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                    style={{
                      backgroundColor: creationMethod === "build" ? THEME.primary : undefined
                    }}
                  >
                    <Edit3 size={16} />
                    {t('fileUpload.buildTree')}
                  </motion.button>
                </div>

                <motion.div key={creationMethod} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: .18 }} className="space-y-5">
                {/* File Upload Area - Only show if method is "upload" */}
                {creationMethod === "upload" && (
                  <motion.div
                  className={`bg-gray-50 rounded-lg p-3 flex flex-col items-center justify-center space-y-3 border border-dashed ${
                    isDragging
                      ? "border-gray-500"
                      : selectedFile
                      ? "border-gray-400"
                      : "border-gray-300"
                  } cursor-pointer`}
                  whileHover={{
                    boxShadow: "0 0 0 2px rgba(31, 41, 55, 0.1)",
                    backgroundColor: "#F3F4F6"
                  }}
                  onDragEnter={handleDragEnter}
                  onDragLeave={handleDragLeave}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  onClick={handleAreaClick}
                >
                  {selectedFile ? (
                    <motion.div 
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="flex items-center gap-3"
                    >
                      <FileText size={22} className="text-gray-600" />
                      <p className="text-sm font-medium text-gray-700">{selectedFile.name}</p>
                      <p className="text-xs text-gray-500">{(selectedFile.size / 1024).toFixed(1)} KB</p>
                    </motion.div>
                  ) : (
                    <>
                      <File size={36} className="text-gray-400" />
                      <div className="text-center">
                        <p className="text-sm font-medium text-gray-700">
                          {t('fileUpload.dragAndDrop')}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {t('fileUpload.clickToBrowse')}
                        </p>
                      </div>
                    </>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,.xlsx"
                    disabled={busy}
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </motion.div>
                )}

                {creationMethod === "upload" && busy && <p role="status" className="text-sm text-gray-600">{t('columnRoles.loading')}</p>}
                {creationMethod === "upload" && importError && <p role="alert" className="text-sm text-red-700">{importError}</p>}
                <AnimatePresence mode="wait" initial={false}>
                {creationMethod === "upload" && source && roles && !preview && <motion.div key="roles" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><ColumnRoles columns={source.columns} rows={source.rows} value={roles} onChange={updateRoles} readOnly={busy} /></motion.div>}
                {creationMethod === "upload" && preview && <motion.section key="preview" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-2 border-t border-gray-200 pt-4 text-start" aria-label={t('columnRoles.preview')}>
                  <div className="flex items-center justify-between gap-3"><h3 className="font-semibold">{t('columnRoles.preview')}</h3><button type="button" disabled={busy} onClick={() => setPreview(null)} className="text-sm underline">{t('columnRoles.back')}</button></div>
                  <p className="text-sm">{t('columnRoles.previewSummary', { count: preview.inserted_count, generated: preview.generated_count, skipped: preview.skipped_count })}</p>
                  {preview.log && <details className="text-sm text-red-700"><summary className="cursor-pointer">{t('columnRoles.issues')}</summary><ul className="mt-2 space-y-1">{preview.log.rejected_rows?.map(row => <li key={row.row}>{t('columnRoles.row', { number: row.row })}: {row.message}</li>)}</ul></details>}
                  <HierarchyPreview rows={preview.rows} total={preview.preview_total || preview.inserted_count} />
                </motion.section>}
                </AnimatePresence>

                {/* Build Tree Form - Only show if method is "build" */}
                {creationMethod === "build" && (
                  <>
                    {/* Tree Name */}
                    <div>
                      <motion.div
                        className="flex items-center px-3 py-2 border border-gray-300 rounded-md shadow-sm"
                        whileHover={{
                          borderColor: "#9CA3AF"
                        }}
                      >
                        <FileText size={18} className="text-gray-500 mr-2 rtl:mr-0 rtl:ml-2" />
                        <input
                          type="text"
                          value={treeName}
                          onChange={(e) => setTreeName(e.target.value)}
                          placeholder={t('createTree.treeNamePlaceholder')}
                          className="bg-transparent w-full outline-none text-sm"
                        />
                      </motion.div>
                    </div>

                    {/* Info Message */}
                    <div className="bg-white border border-gray-300 rounded-md p-3">
                      <p className="text-sm text-gray-900">
                        {t('createTree.emptyCanvasInfo')}
                      </p>
                    </div>
                  </>
                )}

                {/* Table Name (optional) - Only show for upload method */}
                {creationMethod === "upload" && (
                  <div>
                    <motion.div
                      className="flex items-center px-3 py-2 border border-gray-300 rounded-md shadow-sm"
                      whileHover={{
                        borderColor: "#9CA3AF"
                      }}
                    >
                      <FileText size={18} className="text-gray-500 mr-2 rtl:mr-0 rtl:ml-2" />
                      <input
                        type="text"
                        value={tableName}
                        onChange={handleTableNameChange}
                        placeholder={t('fileUpload.tableNameOptional')}
                        className="bg-transparent w-full outline-none text-sm"
                      />
                    </motion.div>
                  </div>
                )}

                {/* Date Selection */}
                <div>
                  <DatePickerWrapper
                    date={uploadDate}
                    handleDateChange={handleUploadDateChange}
                    placeholderText={t('fileUpload.selectUploadDate')}
                    wrapperColor="bg-white"
                    wrapperOpacity=""
                    containerClassName="border border-gray-300 rounded-md shadow-sm hover:border-gray-400 transition-colors"
                  />
                </div>

                </motion.div>
                {/* Action Buttons */}
                <div className="flex items-end gap-3 pt-2">
                  {creationMethod === "upload" ? (
                    <>
                      <motion.button
                        whileHover={!isUploadDisabled ? { scale: 1.02 } : {}}
                        whileTap={!isUploadDisabled ? { scale: 0.98 } : {}}
                        onClick={preview ? handleUpload : handlePreview}
                        className={`flex-grow px-4 py-2.5 rounded-md text-white font-medium text-sm flex items-center justify-center gap-2 ${
                          isUploadDisabled
                            ? "opacity-50 cursor-not-allowed"
                            : "hover:bg-gray-800"
                        }`}
                        style={{ backgroundColor: THEME.buttonColor }}
                        disabled={isUploadDisabled}
                      >
                        {preview ? <Upload size={18} /> : <GitBranch size={18} />}
                        <span>{busy ? t('columnRoles.loading') : preview ? t('fileUpload.uploadFile') : t('columnRoles.preview')}</span>
                      </motion.button>
                      <div ref={downloadMenuRef} className="relative shrink-0">
                        <button
                          onClick={() => setIsDownloadMenuOpen((isOpen) => !isOpen)}
                          className={`flex items-center gap-1.5 px-3 py-2.5 rounded-md transition-colors hover:bg-gray-100 border ${
                            isDownloadMenuOpen
                              ? "bg-blue-50 text-blue-600 border-blue-200"
                              : "text-gray-600 border-transparent"
                          }`}
                          aria-haspopup="menu"
                          aria-expanded={isDownloadMenuOpen}
                          aria-label={t('fileUpload.downloadFiles')}
                        >
                          <Download size={18} />
                          <span className="text-sm font-medium">
                            {t('fileUpload.downloadFiles')}
                          </span>
                        </button>

                        <AnimatePresence>
                          {isDownloadMenuOpen && (
                            <motion.div
                              initial={{ opacity: 0, y: 5 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: 5 }}
                              transition={{ duration: 0.15 }}
                              className="absolute bottom-full mb-2 right-0 rtl:right-auto rtl:left-0 bg-white rounded-md shadow-lg py-1 min-w-[240px] z-50 border border-gray-200"
                              role="menu"
                            >
                              <ul className="py-1">
                                <li>
                                  <button
                                    type="button"
                                    role="menuitem"
                                    onClick={handleDownloadGuide}
                                    className="w-full text-left rtl:text-right px-4 py-2 text-sm flex items-center gap-2 hover:bg-gray-50 transition-colors text-gray-700"
                                  >
                                    <span className="text-gray-500">
                                      <FileText size={16} />
                                    </span>
                                    {t('fileUpload.downloadGuide')}
                                  </button>
                                </li>
                                <li>
                                  <button
                                    type="button"
                                    role="menuitem"
                                    onClick={handleDownloadReference}
                                    className="w-full text-left rtl:text-right px-4 py-2 text-sm flex items-center gap-2 hover:bg-gray-50 transition-colors text-gray-700"
                                  >
                                    <span className="text-gray-500">
                                      <File size={16} />
                                    </span>
                                    {t('fileUpload.downloadReference')}
                                  </button>
                                </li>
                              </ul>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </>
                  ) : (
                    <motion.button
                      whileHover={!isBuildDisabled ? { scale: 1.02 } : {}}
                      whileTap={!isBuildDisabled ? { scale: 0.98 } : {}}
                      onClick={handleBuildTree}
                      className={`flex-grow px-4 py-2.5 rounded-md text-white font-medium text-sm flex items-center justify-center gap-2 ${
                        isBuildDisabled
                          ? "opacity-50 cursor-not-allowed"
                          : "hover:bg-gray-800"
                      }`}
                      style={{ backgroundColor: THEME.buttonColor }}
                      disabled={isBuildDisabled}
                    >
                      <Edit3 size={18} />
                      <span>{t('createTree.createTree')}</span>
                    </motion.button>
                  )}
                </div>
              </div>
      </motion.div>
    </motion.div>
  );
};

export default FileUploadModal;
