# be-net

<div align="center">

![be-net logo](public/be-net-icon.ico)

**Transform your organizational data into interactive, insightful visualizations**

[![React](https://img.shields.io/badge/React-18.3.1-61DAFB?style=flat-square&logo=react)](https://reactjs.org/)
[![Flask](https://img.shields.io/badge/Flask-3.1.0-000000?style=flat-square&logo=flask)](https://flask.palletsprojects.com/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4.5-38B2AC?style=flat-square&logo=tailwind-css)](https://tailwindcss.com/)
[![SQLAlchemy](https://img.shields.io/badge/SQLAlchemy-2.0.38-red?style=flat-square)](https://www.sqlalchemy.org/)

</div>

## 📋 Overview

be-net is a powerful full-stack application designed to help organizations of all sizes visualize, analyze, and manage their organizational structures. With an intuitive interface and powerful features, it transforms complex hierarchical data into clear, interactive visualizations that provide valuable insights into your organization.

## ✨ Key Features

- **📊 Interactive Org Charts**: Drag, zoom, and explore your organization's structure with fluid, responsive visualizations
- **🔍 Advanced Search & Filtering**: Quickly find specific employees or departments with powerful search capabilities
- **📈 Timeline Analysis**: Track changes in your organization's structure over time with historical comparisons
- **🌐 Multi-Language Support**: Full internationalization with English and Hebrew support
- **↔️ RTL Layout Support**: Native right-to-left layout for Hebrew and other RTL languages
- **📱 Responsive Design**: Enjoy a seamless experience across desktop and mobile devices
- **🔄 Real-time Updates**: Make changes to your org structure and see them reflected instantly
- **📥 Easy Data Import/Export**: Import data from Excel/CSV files or create trees manually, export visualizations as images or Excel spreadsheets
- **✏️ Visual Tree Editor**: Create and edit organizational trees directly in the interface with drag-and-drop functionality
- **🔧 Node Management**: Add, edit, delete, and reorganize nodes with an intuitive context menu
- **📊 Comparative Analysis**: Compare organizational structures across different time periods
- **🔔 Smart Notifications**: Language-aware toast notifications with RTL-aware positioning
- **⚙️ Customizable Settings**: Tailor the application to your preferences with configurable settings and keyboard shortcuts

## 🌍 Internationalization

The application supports multiple languages with full RTL (Right-to-Left) layout support:

- **Supported Languages**: English, Hebrew (עברית)
- **RTL Layout**: Automatic layout adjustment for RTL languages
- **Font Support**: Custom Hebrew font (Rubik) for optimal readability
- **Smart Positioning**: UI elements automatically adjust position based on text direction
- **Translated UI**: 40+ translation keys covering all user-facing text

For detailed information about the internationalization setup, see [LANGUAGE_SETUP.md](LANGUAGE_SETUP.md).

## 🚀 Getting Started

### Prerequisites

- **Python 3.8+** with pip
- **Node.js 14+** and npm
- **Git** (for cloning the repository)

### Development Setup

```bash
git clone https://github.com/hexdrift/be-net.git
cd be-net

pip install -r requirements.txt
npm install
npm run build
python main.py
```

The app opens automatically at **http://localhost:5001**. If it doesn't, navigate there manually.

> Make sure port 5001 isn't already in use. On Windows, use `python` / `pip`; on macOS/Linux you may need `python3` / `pip3`.

### Automated Build (Windows)

```cmd
build.bat
```

Installs dependencies and builds the standalone executable in one step.

### Running as a Standalone Application

For end users, the application can be run as a standalone executable:

1. Download the latest release from the releases page
2. Extract the zip file to a location of your choice
3. **Windows:** Double-click `be-net.exe`
4. **macOS:** Double-click `be-net.app` (or drag to Applications folder)

## 🛠️ Building Standalone Executables

Build platform-specific executables for Windows and macOS with all internationalization features included.

### Prerequisites for Building

- Python 3.8+ with pip
- Node.js 14+ with npm
- PyInstaller: `pip install pyinstaller`

**Important**: PyInstaller creates platform-specific executables. Build on Windows for `.exe` and on macOS for Mac executables.

### Quick Build (Automated)

Use the automated build script that handles everything:

**Windows (Command Prompt or PowerShell):**
```cmd
build.bat
```

Or double-click `build.bat` in Windows Explorer.

**macOS/Linux:**
```bash
chmod +x build.sh
./build.sh
```

The script will automatically:
1. Install all Python dependencies (including PyInstaller)
2. Install all Node.js dependencies
3. Build the React frontend with all translations
4. Create the standalone executable
5. (macOS only) Create .app bundle for easy distribution

### Manual Build Steps

If you prefer to build manually:

1. **Install Dependencies**

   **Windows:**
   ```cmd
   pip install -r requirements.txt
   npm install
   ```

   **macOS/Linux:**
   ```bash
   pip install -r requirements.txt
   npm install
   ```

2. **Build React Frontend** (CRITICAL - includes all translations)

   **Windows:**
   ```cmd
   npm run build
   ```

   **macOS/Linux:**
   ```bash
   npm run build
   ```

3. **Build the Executable**

   **Windows:**
   ```cmd
   pyinstaller app.spec
   ```

   **macOS/Linux:**
   ```bash
   pyinstaller app.spec
   ```

4. **Create macOS App Bundle (macOS only)**
   ```bash
   python3 create_app_bundle.py
   ```

5. **Locate the Executable**

   **Windows:**
   ```
   dist\be-net.exe
   ```
   Double-click the `.exe` file to run, or run from command line:
   ```cmd
   dist\be-net.exe
   ```

   **macOS:**
   ```
   dist/be-net.app
   ```
   Double-click the `.app` bundle to run, or use:
   ```bash
   open dist/be-net.app
   ```

   **Linux:**
   ```
   dist/be-net
   ```
   Run with:
   ```bash
   ./dist/be-net
   ```

### What's Included

The standalone executable includes:
- ✅ Complete React frontend with all components
- ✅ Flask backend with all routes
- ✅ English & Hebrew translations (40+ keys)
- ✅ Full RTL layout support
- ✅ Language-aware UI (toast positioning, arrow directions)
- ✅ Automatic browser launch
- ✅ All dependencies (no installation required to run)

### Distribution

**Windows:**
- Distribute the single `be-net.exe` file
- Users can run it directly - no installation needed
- File size: ~150-200 MB

**macOS:**
- Distribute the `be-net.app` bundle
- Users can drag it to Applications folder
- File size: ~100-150 MB

**Windows (PowerShell):**
```powershell
cd dist
Compress-Archive -Path be-net.exe -DestinationPath be-net-v1.0-windows.zip
```

**Windows (Command Prompt with 7-Zip or WinRAR):**
```cmd
cd dist
"C:\Program Files\7-Zip\7z.exe" a be-net-v1.0-windows.zip be-net.exe
```

**macOS/Linux:**
```bash
cd dist
zip -r be-net-v1.0-macos.zip be-net.app
```

**Note**: The executable is self-contained with all dependencies included. No Python or Node.js installation required on the target machine.

### Troubleshooting

**Build fails with missing build/ directory**
- Solution: Run `npm run build` first before building the executable

**Executable won't start (Windows)**
- Solution: Check that all dependencies in `requirements.txt` are installed
- Try running from Command Prompt to see error messages
- Ensure Windows Defender or antivirus isn't blocking the executable

**Executable won't start (macOS)**
- Solution: Right-click the `.app` and select "Open" if you get a security warning
- Go to System Preferences → Security & Privacy → Allow the app

**Port 5001 already in use**
- Solution: Close any other applications using port 5001, or modify `main.py` to use a different port

**Browser doesn't open automatically**
- Solution: Manually navigate to `http://localhost:5001` in your browser

**Hebrew text not displaying**
- Solution: Rubik font loads from Google Fonts - check internet connection
- Fonts are also bundled in the executable, so this should work offline

**Database errors**
- Solution: Ensure you have write permissions in the directory where you're creating/accessing the database
- On Windows, try running as Administrator if permission issues persist

## 📖 Usage Guide

### First-time Users

1. **Launch the application**
   - Run the executable or start the development server
   - The application will automatically open in your browser at `http://localhost:5001`

2. **Set up your database**
   - **Option A: Create a new database**
     - Click "Create New Database"
     - Choose a location to save your database file
     - Enter a database name (e.g., `orgchart.db`)
   - **Option B: Use an existing database**
     - Click "Select Existing Database"
     - Browse and select your existing database file

3. **Create or import organizational data**
   - **Option 1: Import from Excel/CSV**
     - Click the upload button (📤) or use `Ctrl+U` (Windows) / `Cmd+U` (macOS)
     - Select your Excel file (.xlsx) or CSV file
     - Choose a folder name and upload date
     - The app will automatically parse and structure your data
   - **Option 2: Create tree manually**
     - Click "Create New Tree" button
     - Enter tree name, folder name, and root node details
     - After creation, add more nodes by clicking the "•••" menu on any node

4. **Explore your organization**
   - Drag to pan around the org chart
   - Scroll to zoom in/out
   - Click on nodes to view detailed information
   - Use the search bar (`Ctrl+F` / `Cmd+F`) to find specific people

5. **Customize your experience**
   - Click the settings icon (⚙️) or press `Ctrl+,` / `Cmd+,`
   - Switch between English and Hebrew
   - Adjust other preferences as needed

### Returning Users

- **View Existing Charts**: Select your database and browse through folders and tables
- **Upload New Data**: Import updated Excel files to track changes over time
- **Create New Trees**: Build organizational structures from scratch using the visual editor
- **Edit Nodes**: Click on any node to edit personal information, roles, or hierarchical structure
- **Add/Remove Nodes**: Use the context menu (•••) on nodes to add children or delete branches
- **Search & Filter**: Use advanced search with boolean operators (AND, OR, NOT) across multiple fields
- **Compare Data**: Analyze changes between different time periods using the comparison feature
- **Timeline Analysis**: View career progression and organizational changes over time
- **Export Data**: Download your charts as images or export data to Excel format
- **Apply Settings**: Customize language, keyboard shortcuts, and other preferences

### Keyboard Shortcuts

- **Cmd/Ctrl + F**: Open search bar
- **Cmd/Ctrl + H**: Toggle help modal
- **Cmd/Ctrl + T**: Open table selection
- **Cmd/Ctrl + U**: Open file upload modal
- **Cmd/Ctrl + ,**: Open settings
- And many more! (See settings for full list)

## 🔧 Advanced Features

### Timeline Analysis

Track changes in your organization over time:
- View historical data points
- Analyze employee movement and promotions
- Identify structural changes

### Comparative Reports

Generate comprehensive reports comparing organizational structures:
- Department size changes
- Reporting structure modifications
- Role distribution analysis

### Search and Filtering

Find specific information quickly:
- Search by name, role, department, or any custom field
- Filter by various attributes
- Highlight specific nodes or branches
- Navigate search results with prev/next buttons

### Language & RTL Support

Seamlessly switch between languages:
- Full UI translation
- Automatic layout mirroring for RTL languages
- Language-specific fonts and styling
- Smart toast notification positioning

## 💻 Technology Stack

### Frontend
- **React.js** - UI framework
- **i18next / react-i18next** - Internationalization
- **Framer Motion** - Animations and transitions
- **Tailwind CSS** - Styling and responsive design with RTL support
- **D3.js** - Data visualization
- **React-Toastify** - Toast notifications
- **Axios** - API requests
- **Lucide React & React Feather** - Icon libraries

### Backend
- **Flask** - Web server
- **SQLAlchemy** - Database ORM
- **Pandas** - Data processing
- **ReportLab** - PDF report generation

### Packaging
- **PyInstaller** - Creating standalone executables

## 🎨 Design Features

- **Custom Hebrew Font**: Rubik font for optimal Hebrew text rendering
- **RTL-Aware Layout**: All margins, paddings, and positioning automatically flip for RTL languages
- **Arrow Reversal**: Navigation arrows (←/→) reverse direction in RTL mode
- **Smart Toast Positioning**: Bottom-left for Hebrew, bottom-right for English
- **Responsive Icons**: Icon positioning adapts to text direction

## 🤝 Contributing

We welcome contributions to be-net! Please feel free to submit issues, feature requests, or pull requests.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Adding New Languages

To add support for a new language:

1. Create a new translation file in `src/i18n/locales/[language-code].json`
2. Add the language to `src/i18n/config.js`
3. If the language is RTL, add RTL support in relevant components
4. Update the language selector in `SettingsModal.js`

See [LANGUAGE_SETUP.md](LANGUAGE_SETUP.md) for detailed instructions.

## 📄 License

Released under the MIT License.

</div>

## Column roles and table differences

When importing CSV or XLSX data, assign columns to be-net fields and choose a hierarchy format:

- **ID and parent ID:** each row has a unique node ID and refers to its parent's node ID. The single root has an empty parent. The node ID can differ from the employee ID.
- **Separate level columns:** select organizational levels from root to leaf. be-net creates the shared units. With an Employee ID column assigned, employees appear under the deepest unit; otherwise each row represents a unit. Trailing empty levels are allowed, but gaps are not.
- **Existing hierarchy path:** select the column containing the existing slash paths.

Preview the hierarchy before importing. be-net saves the column declarations and relevant source values with the table; unmapped columns are discarded. Reopening the database needs no source file. **This database format does not support older be-net databases:** create a new database and import their source data.

Under **Manage Data → Column roles**, inspect a table's saved declarations. Under **Manage Data → Compare tables**, select before/after tables, including tables in different folders. Comparison uses Employee ID only and reports added/removed records, changed fields, and hierarchy moves. Missing IDs are excluded; an ID duplicated in either table is excluded on both sides to avoid false additions/removals. Exclusions are listed with their reasons.
