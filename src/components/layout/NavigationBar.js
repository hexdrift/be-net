import { motion, AnimatePresence } from 'framer-motion';
import {
  Home, Target, Filter, Users, Layers, ChevronDown, ChevronUp,
  Settings, X,
  Table, Eye, Download, Minus, Globe, Camera
} from 'react-feather';
import { useTranslation } from 'react-i18next';

const NavigationBar = ({
  onHome,
  onCenter,
  onFilter,
  onHierarchyMode,
  onOrganizationMode,
  onToggleVacancies,
  onManageData,
  onColumnRoles,
  onCompareTables,
  onExpandAll,
  onCollapseAll,
  onOpenSettings,
  onOpenHelp,
  onSearch,
  onClearFilter,
  onExportExcel,
  onExportImage,
  isHierarchyMode,
  isOrganizationMode,
  hideVacancies,
  hasActiveFilters,
  activeMenuId,
  setActiveMenuId,
  selectedTableId
}) => {
  const { t, i18n } = useTranslation();

  const menus = [
    {
      id: 'data', label: t('navigation.manageData'), icon: Layers,
      items: [
        { id: 'tables', label: t('navigation.manageData'), icon: Table, onClick: onManageData },
        { id: 'roles', label: t('columnRoles.title'), icon: Layers, onClick: onColumnRoles },
        { id: 'compare', label: t('tableDiff.title'), icon: Users, onClick: onCompareTables }
      ]
    },
    {
      id: 'view',
      label: t('navigation.view'),
      icon: Eye,
      items: [
        { id: 'expandAll', label: t('navigation.expandAll'), icon: ChevronDown, onClick: onExpandAll },
        { id: 'collapseAll', label: t('navigation.collapseAll'), icon: ChevronUp, onClick: onCollapseAll }
      ]
    },
    {
      id: 'display',
      label: t('navigation.display'),
      icon: Users,
      items: [
        {
          id: 'hierarchyMode',
          label: t('navigation.hierarchyMode'),
          icon: Users,
          onClick: onHierarchyMode,
          active: isHierarchyMode
        },
        {
          id: 'organizationMode',
          label: t('navigation.orgMode'),
          icon: Home,
          onClick: onOrganizationMode,
          active: isOrganizationMode
        },
        {
          id: 'hideVacancies',
          label: t('navigation.hideVacancies'),
          icon: Minus,
          onClick: onToggleVacancies,
          active: hideVacancies
        }
      ]
    },
    {
      id: 'export',
      label: t('navigation.export'),
      icon: Download,
      items: [
        { id: 'exportExcel', label: t('navigation.excel'), icon: Table, onClick: onExportExcel },
        { id: 'exportImage', label: t('navigation.image'), icon: Camera, onClick: onExportImage }
      ]
    }
  ];

  const toggleMenu = (menuId) => {
    setActiveMenuId(activeMenuId === menuId ? null : menuId);
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200 shadow-sm w-full">
      <nav className="h-14 px-6 flex items-center justify-start w-full">
        <div className="flex items-center gap-3">
          {/* Home */}
          <button onClick={onHome} className="text-gray-600 p-2 rounded-md hover:bg-gray-100 transition-colors" title={t('navigation.home')}>
            <Home size={18} />
          </button>

          {/* Dropdown Menus (View, Display, Export) */}
          {menus.map((menu) => (
            <div key={menu.id} className="relative">
              <button
                onClick={() => toggleMenu(menu.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors hover:bg-gray-100 ${
                  activeMenuId === menu.id
                    ? 'bg-blue-50 text-blue-600 border border-blue-200'
                    : 'text-gray-600 border border-transparent'
                }`}
                title={menu.label}
              >
                <menu.icon size={17} />
                <span className="text-sm font-medium">{menu.label}</span>
              </button>
              <AnimatePresence>
                {activeMenuId === menu.id && (
                  <motion.div
                    className="absolute top-full mt-1 left-0 rtl:left-auto rtl:right-0 bg-white rounded-md shadow-lg py-1 min-w-[180px] z-50 border border-gray-200"
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    transition={{ duration: 0.15 }}
                  >
                    <ul className="py-1">
                      {menu.items.map((item) => (
                        <li key={item.id}>
                          <button
                            className={`w-full text-left rtl:text-right px-4 py-2 text-sm flex items-center gap-2 hover:bg-gray-50 transition-colors ${
                              item.disabled
                                ? 'text-gray-300 cursor-not-allowed'
                                : item.active
                                  ? 'text-blue-600 bg-gray-50'
                                  : 'text-gray-700'
                            }`}
                            onClick={() => {
                              if (!item.disabled) {
                                item.onClick();
                                setActiveMenuId(null);
                              }
                            }}
                            disabled={item.disabled}
                          >
                            <span className={`${item.disabled ? 'text-gray-300' : item.active ? 'text-blue-600' : 'text-gray-500'}`}>
                              {item.icon && <item.icon size={16} />}
                            </span>
                            {item.label}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}

          {/* Search */}
          <button
            onClick={onSearch}
            className="text-gray-600 p-2 rounded-md hover:bg-gray-100 transition-colors"
            title={t('navigation.search')}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
          </button>

          {/* Filter */}
          <button
            onClick={onFilter}
            className={`p-2 rounded-md hover:bg-gray-100 transition-colors ${hasActiveFilters ? 'text-blue-600' : 'text-gray-600'}`}
            title={t('navigation.filter')}
          >
            <Filter size={18} />
          </button>

          {hasActiveFilters && (
            <button onClick={onClearFilter} className="text-red-500 p-2 rounded-md hover:bg-red-50 transition-colors" title={t('navigation.clearFilters')}>
              <X size={18} />
            </button>
          )}

          {/* Center View */}
          <button onClick={onCenter} className="text-gray-600 p-2 rounded-md hover:bg-gray-100 transition-colors" title={t('navigation.centerView')}>
            <Target size={18} />
          </button>

          {/* Settings */}
          <button
            onClick={onOpenSettings}
            className="text-gray-600 p-2 rounded-md hover:bg-gray-100 transition-colors"
            title={t('settings.title')}
          >
            <Settings size={18} />
          </button>

          {/* Language Toggle */}
          <button
            onClick={() => {
              const newLanguage = i18n.language === 'he' ? 'en' : 'he';
              i18n.changeLanguage(newLanguage);
            }}
            className="text-gray-600 p-2 rounded-md hover:bg-gray-100 transition-colors"
            title={i18n.language === 'he' ? 'Switch to English' : 'עבור לעברית'}
          >
            <Globe size={18} />
          </button>
        </div>
      </nav>
    </header>
  );
};

export default NavigationBar;