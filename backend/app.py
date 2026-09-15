import json
import logging
import os
import sys
import time
import webbrowser
import subprocess
import re
import functools
from contextlib import contextmanager
from datetime import datetime
from typing import Dict, List, Optional, Any, Tuple

import pandas as pd
from flask import Flask, request, jsonify, send_file, send_from_directory
from flask_cors import CORS
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy import func, inspect, or_, and_

try:
    # Try absolute import first (for when running from project root)
    from backend.column_roles import apply_roles, preview_roles, suggested_roles
    from backend.comparison import compare_records, employee_id
    from backend.models import (
        Folder,
        Table,
        DataEntry,
        get_session,
        get_db_path,
        dispose_db,
        create_new_db,
        init_db,
        set_db_path,
        check_db_schema,
        is_valid_sqlite_db,
    )
    from backend.utils import (
        process_excel_data,
        insert_data_entries,
        get_org_chart,
        get_department_structure,
        get_age_distribution,
        export_excel_data,
        generate_hierarchical_structure,
    )
except ModuleNotFoundError:
    # Fallback to relative imports (for when running from backend directory)
    from column_roles import apply_roles, preview_roles, suggested_roles
    from comparison import compare_records, employee_id
    from models import (
        Folder,
        Table,
        DataEntry,
        get_session,
        get_db_path,
        dispose_db,
        create_new_db,
        init_db,
        set_db_path,
        check_db_schema,
        is_valid_sqlite_db,
    )
    from utils import (
        process_excel_data,
        insert_data_entries,
        get_org_chart,
        get_department_structure,
        get_age_distribution,
        export_excel_data,
        generate_hierarchical_structure,
    )

def resource_path(relative_path: str) -> str:
    """
    Get the absolute path for a resource relative to the application.

    Parameters:
        relative_path (str): The relative path to the resource.

    Returns:
        str: The absolute path to the resource.
    """
    try:
        base_path = sys._MEIPASS
    except Exception:
        base_path = os.path.abspath(".")
    return os.path.join(base_path, relative_path)

def open_browser() -> None:
    """
    Open the web browser to the application URL after a short delay.
    """
    time.sleep(1)
    webbrowser.open_new('http://localhost:5001/')

logging.basicConfig(
    level=logging.DEBUG,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[logging.StreamHandler()]
)

logger = logging.getLogger(__name__)

def get_build_folder():
    """
    Get the correct path to the build folder.
    Works both in development and when frozen by PyInstaller.
    """
    if getattr(sys, 'frozen', False):
        # Running in PyInstaller bundle
        base_path = sys._MEIPASS
        build_path = os.path.join(base_path, 'build')
        logger.info(f"Running as frozen app. Build folder: {build_path}")
    else:
        # Running in development
        # Go up one directory from backend/ to reach project root
        backend_dir = os.path.dirname(os.path.abspath(__file__))
        project_root = os.path.dirname(backend_dir)
        build_path = os.path.join(project_root, 'build')
        logger.info(f"Running in development. Build folder: {build_path}")

    if not os.path.exists(build_path):
        logger.error(f"Build folder not found at: {build_path}")
    else:
        logger.info(f"Build folder exists with {len(os.listdir(build_path))} items")

    return build_path

app = Flask(__name__, static_folder=get_build_folder(), static_url_path='')
CORS(app)

@app.errorhandler(Exception)
def handle_exception(e: Exception) -> Any:
    """
    Handle unhandled exceptions globally.

    Parameters:
        e (Exception): The exception that was raised.

    Returns:
        JSON response with error message and status code 500.
    """
    logger.error(f"Unhandled exception: {str(e)}", exc_info=True)
    return jsonify({"error": "An unexpected error occurred"}), 500

def validate_input(**expected_args: Dict[str, type]) -> Any:
    """
    Decorator to validate input parameters for Flask routes.

    Parameters:
        expected_args (Dict[str, type]): A dictionary of expected argument names and their types.

    Returns:
        Function decorator that validates input parameters.
    """
    def decorator(f: Any) -> Any:
        @functools.wraps(f)
        def wrapper(*args: Any, **kwargs: Any) -> Any:
            for arg, arg_type in expected_args.items():
                if request.method == 'GET':
                    value = request.args.get(arg)
                else:
                    # Try JSON first, then fall back to form data
                    if request.is_json:
                        value = request.json.get(arg) if request.json else None
                    else:
                        value = request.form.get(arg)

                if value is None:
                    return jsonify({"error": f"{arg} is required"}), 400
                try:
                    if arg_type == int:
                        value = int(value)
                    elif arg_type == datetime:
                        value = datetime.strptime(value, "%Y-%m-%d").date()
                    kwargs[arg] = value
                except ValueError:
                    return jsonify({"error": f"Invalid {arg}"}), 400
            return f(*args, **kwargs)
        return wrapper
    return decorator

@contextmanager
def session_scope() -> Any:
    """
    Provide a transactional scope around a series of operations.

    Yields:
        Session: A database session.
    """
    session = get_session()
    if session is None:
        raise RuntimeError("No database session available. Please select a database first.")
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()

def check_if_db_has_data() -> bool:
    """
    Check if the database has any data in the specified tables.

    Returns:
        bool: True if any data exists, False otherwise.
    """
    with session_scope() as session:
        for table in [Folder, Table, DataEntry]:
            if session.query(table).first():
                return True
    return False


def activate_database_path(database_path: Optional[str]) -> Optional[Tuple[Any, int]]:
    """Activate the database explicitly supplied by a request."""
    if not database_path:
        return None
    if not os.path.exists(database_path):
        return jsonify({"error": "Database file does not exist"}), 404
    if not is_valid_sqlite_db(database_path):
        return jsonify({"error": "Invalid SQLite database file"}), 400
    current_database_path = get_db_path()
    if current_database_path and os.path.abspath(current_database_path) == os.path.abspath(database_path):
        return None

    valid, message = check_db_schema(database_path)
    if not valid:
        return jsonify({"error": "This database uses an unsupported format. Create a new be-net database and import your data.", "detail": message, "error_key": "database_format"}), 400
    dispose_db()
    set_db_path(database_path)
    return None


@app.route("/open_file_explorer", methods=["GET"])
def open_file_explorer() -> Any:
    """
    Open the file explorer in the user's home directory.

    Returns:
        JSON response indicating success or failure.
    """
    try:
        subprocess.Popen(['explorer', os.path.expanduser('~')])
        return jsonify({"message": "File explorer opened successfully"}), 200
    except Exception as e:
        return jsonify({"error": f"Failed to open file explorer: {str(e)}"}), 500

@app.route("/check_existing_db", methods=["POST"])
def check_existing_db() -> Any:
    """
    Check if the specified database exists and is valid.

    Returns:
        JSON response with database status and path.
    """
    data = request.json
    db_path = data.get('db_path')
    if not db_path:
        return jsonify({"error": "No database path provided"}), 400

    if not os.path.exists(db_path):
        return jsonify({"error": "Database file does not exist"}), 404

    if not is_valid_sqlite_db(db_path):
        return jsonify({"error": "Invalid SQLite database file"}), 400

    schema_valid, schema_message = check_db_schema(db_path)
    if not schema_valid:
        return jsonify({"error": "This database uses an unsupported format. Create a new be-net database and import your data.", "detail": schema_message, "error_key": "database_format"}), 400

    dispose_db()
    set_db_path(db_path)

    has_data = check_if_db_has_data()

    return jsonify({
        "exists": True,
        "path": db_path,
        "hasData": has_data
    }), 200

@app.route("/create_new_db", methods=["POST"])
def create_new_db_route() -> Any:
    """
    Create a new database in the specified folder.

    Returns:
        JSON response with the status of the database creation.
    """
    data = request.json
    folder_path = data.get('db_path')
    db_name = data.get('db_name', 'orgchart.db')
    
    if not folder_path:
        return jsonify({"error": "Folder path is required"}), 400
    
    if not os.path.exists(folder_path):
        return jsonify({"error": "The specified directory does not exist"}), 404
    
    if not os.access(folder_path, os.W_OK):
        return jsonify({"error": "The specified directory is not writable"}), 403
    
    db_path = os.path.join(folder_path, db_name)
    logger.info(f"Attempting to create new database at: {db_path}")
    
    dispose_db()

    if os.path.exists(db_path):
        try:
            os.remove(db_path)
            logger.info(f"Existing database {db_path} removed successfully")
        except PermissionError:
            return jsonify({"error": "Unable to remove existing database. It may be in use."}), 500
        except Exception as e:
            return jsonify({"error": f"Error removing existing database: {str(e)}"}), 500

    try:
        create_new_db(db_path)
        logger.info(f"New database created successfully at {db_path}")
        init_db()
        logger.info("Database initialized successfully")
    except Exception as e:
        return jsonify({"error": f"Failed to create or initialize database: {str(e)}"}), 500

    if not is_valid_sqlite_db(db_path):
        return jsonify({"error": "Failed to create a valid database"}), 500

    has_data = check_if_db_has_data()
    first_table_id = None

    if has_data:
        with session_scope() as session:
            first_table = session.query(Table).first()
            if first_table:
                first_table_id = first_table.id

    logger.info(f"New database created and initialized successfully at {db_path}")
    return jsonify({
        "message": "New database created and initialized successfully",
        "db_path": db_path,
        "hasData": has_data,
        "tableId": first_table_id
    }), 200

@app.route("/upload/preview", methods=["POST"])
def preview_upload() -> Any:
    """Inspect source columns or preview their declared hierarchy without writes."""
    file = request.files.get("file")
    if not file or not file.filename:
        return jsonify({"error": "Select an Excel or CSV file."}), 400
    extension = file.filename.rsplit(".", 1)[-1].lower()
    if extension not in ("csv", "xlsx"):
        return jsonify({"error": "Select an Excel (.xlsx) or CSV file."}), 400
    try:
        frame = process_excel_data(file.read(), extension)
        frame.columns = frame.columns.map(str)
        if not len(frame) or not len(frame.columns):
            raise ValueError("The file has no data rows.")
        roles_json = request.form.get("column_roles")
        if roles_json:
            return jsonify(preview_roles(frame, json.loads(roles_json)))
        return jsonify({
            "columns": list(frame.columns),
            "rows": frame.head(5).fillna("").to_dict(orient="records"),
            "row_count": len(frame),
            "suggested_roles": suggested_roles(list(frame.columns)),
        })
    except (ValueError, TypeError, KeyError) as error:
        return jsonify({"error": str(error), "error_key": getattr(error, "code", None), "error_params": getattr(error, "params", {})}), 400


@app.route("/table/<int:table_id>/column_roles", methods=["GET"])
def get_column_roles(table_id: int) -> Any:
    """Restore the saved column declarations without requiring the source file."""
    database_error = activate_database_path(request.args.get("db_path"))
    if database_error:
        return database_error
    with session_scope() as session:
        table = session.get(Table, table_id)
        if table is None:
            return jsonify({"error": "Table not found"}), 404
        saved = json.loads(table.source_data) if table.source_data else {}
        return jsonify({
            "roles": json.loads(table.column_roles) if table.column_roles else None,
            "columns": saved.get("columns", []),
            "rows": saved.get("rows", [])[:5],
            "row_count": len(saved.get("rows", [])),
        })


@app.route("/upload", methods=["POST"])
@validate_input(upload_date=datetime)
def upload_file(upload_date: datetime) -> Any:
    """
    Upload a file and process its contents.

    The target folder is identified by ``folder_id`` (what the upload modal
    sends) or, for older clients, by ``folder_name`` (created if missing).
    An optional ``table_name`` overrides the uploaded file's name.

    Parameters:
        upload_date (datetime): The date the file is being uploaded.

    Returns:
        JSON response with the status of the upload.
    """
    database_error = activate_database_path(request.form.get("db_path"))
    if database_error:
        return database_error

    folder_id = request.form.get("folder_id")
    folder_name = request.form.get("folder_name")
    table_name = (request.form.get("table_name") or "").strip()
    if not folder_id and not folder_name:
        return jsonify({"error": "folder_id or folder_name is required"}), 400
    if folder_id:
        try:
            folder_id = int(folder_id)
        except ValueError:
            return jsonify({"error": "Invalid folder_id"}), 400

    logger.info(f"Starting upload process for folder: id={folder_id} name={folder_name}")
    if "file" not in request.files:
        return jsonify({"error": "No file part"}), 400
    file = request.files["file"]

    if file.filename == "":
        return jsonify({"error": "No selected file"}), 400

    file_extension = file.filename.rsplit(".", 1)[-1].lower()
    if file_extension not in ["csv", "xlsx"]:
        return jsonify({"error": "Unsupported file type. Please upload CSV or XLSX files."}), 400

    new_folder_created = False
    new_folder_id = None
    with session_scope() as session:
        try:
            if folder_id:
                folder = session.get(Folder, folder_id)
                if not folder:
                    return jsonify({"error": f"Folder with id {folder_id} not found"}), 404
            else:
                logger.info(f"Checking for existing folder: {folder_name}")
                folder = session.query(Folder).filter_by(name=folder_name).first()
                if not folder:
                    logger.info(f"Folder {folder_name} not found. Creating new folder.")
                    folder = Folder(name=folder_name)
                    session.add(folder)
                    session.flush()  # Flush to get the folder ID
                    new_folder_created = True
                    new_folder_id = folder.id
            folder_name = folder.name
            logger.info(f"Using folder: {folder.name} (ID: {folder.id}), new folder created: {new_folder_created}")

            file_content = file.read()
            logger.info(f"File content read, size: {len(file_content)} bytes")

            table = Table(name=table_name or file.filename, folder_id=folder.id, upload_date=upload_date)
            session.add(table)
            session.flush()  # Flush to get the table ID
            logger.info(f"Table created: {table.name} (ID: {table.id})")

            df = process_excel_data(file_content, file_extension)
            roles = json.loads(request.form.get("column_roles", "null")) or suggested_roles(list(df.columns))
            df, saved = apply_roles(df, roles)
            table.column_roles = json.dumps(roles, ensure_ascii=False)
            import_result = insert_data_entries(session, table.id, df)

            if import_result["inserted_count"] == 0:
                session.rollback()
                return jsonify({
                    "error": "No valid rows were found. Review the downloaded parsing log.",
                    "log": import_result["log"],
                }), 400
            
            session.flush()
            accepted_paths = {entry.hierarchical_structure for entry in session.query(DataEntry).filter_by(table_id=table.id)}
            rejected_rows = {row['row'] for row in (import_result['log'] or {}).get('rejected_rows', [])}
            saved['rows'] = [row for index, row in enumerate(saved['rows'])
                             if index + 2 not in rejected_rows and df.iloc[index]['hierarchical_structure'] in accepted_paths]
            table.source_data = json.dumps(saved, ensure_ascii=False)
            logger.info(f"File processed and data inserted successfully for table ID: {table.id}")
            session.commit()
            logger.info(f"Upload completed successfully for folder: {folder_name}, table ID: {table.id}")
            
            response = {
                "message": "File uploaded and processed successfully",
                "table_id": table.id,
                "folder_id": folder.id,
                "import_summary": {
                    "inserted_count": import_result["inserted_count"],
                    "skipped_count": import_result["skipped_count"],
                },
            }
            if import_result["log"]:
                response["log"] = import_result["log"]
            return jsonify(response), 200

        except Exception as e:
            logger.error(f"Error during file upload: {str(e)}")
            session.rollback()
            
            if new_folder_created and new_folder_id:
                try:
                    with session_scope() as new_session:
                        folder_to_delete = new_session.query(Folder).get(new_folder_id)
                        if folder_to_delete:
                            new_session.delete(folder_to_delete)
                            new_session.commit()
                            logger.info(f"Newly created folder removed: {folder_name} (ID: {new_folder_id})")
                        else:
                            logger.warning(f"Folder not found for deletion: {folder_name} (ID: {new_folder_id})")
                except Exception as delete_error:
                    logger.error(f"Error while attempting to delete folder: {str(delete_error)}")
            
            status_code = 400 if isinstance(e, ValueError) else 500
            return jsonify({"error": str(e), "error_key": getattr(e, "code", None), "error_params": getattr(e, "params", {})}), status_code

@app.route("/folder_structure", methods=["GET"])
def fetch_folder_structure() -> Any:
    """
    Fetch the structure of folders and their associated tables.

    Returns:
        JSON response with the folder structure.
    """
    database_error = activate_database_path(request.args.get("db_path"))
    if database_error:
        return database_error

    with session_scope() as session:
        folders = session.query(Folder).all()
        folder_structure = []

        for folder in folders:
            tables = [
                {
                    "id": table.id,
                    "name": table.name,
                    "upload_date": (table.upload_date.isoformat() if table.upload_date else None),
                }
                for table in folder.tables
            ]
            folder_structure.append({
                "id": folder.id,
                "name": folder.name,
                "tables": tables,
            })

        return jsonify(folder_structure), 200

@app.route("/folder/<int:folder_id>", methods=["PUT"], endpoint='update_folder')
@validate_input(name=str)
def update_folder(folder_id: int, name: str) -> Any:
    """
    Update a folder's name.

    Parameters:
        folder_id (int): The ID of the folder to update.
        name (str): The new name for the folder.

    Returns:
        JSON response with the status of the update.
    """
    db_path = request.args.get('db_path')
    if not db_path:
        return jsonify({"error": "No database path provided"}), 400

    if not os.path.exists(db_path):
        return jsonify({"error": "Database file does not exist"}), 404

    if not is_valid_sqlite_db(db_path):
        return jsonify({"error": "Invalid SQLite database file"}), 400

    dispose_db()
    set_db_path(db_path)
    init_db()

    logger.info(f"Updating folder {folder_id} with new name: {name}")
    with session_scope() as session:
        try:
            folder = session.query(Folder).get(folder_id)
            if not folder:
                logger.warning(f"Folder {folder_id} not found")
                return jsonify({"error": "Folder not found"}), 404

            folder.name = name
            session.commit()
            logger.info(f"Folder {folder_id} updated successfully")
            return jsonify({"message": "Folder updated successfully", "folder_id": folder_id}), 200
        except Exception as e:
            logger.error(f"Error updating folder {folder_id}: {str(e)}")
            session.rollback()
            return jsonify({"error": str(e)}), 500

@app.route("/folder/<int:folder_id>", methods=["DELETE"], endpoint='delete_folder')
def delete_folder(folder_id: int) -> Any:
    """
    Delete a folder and all its associated tables and data entries.

    Parameters:
        folder_id (int): The ID of the folder to delete.

    Returns:
        JSON response with the status of the deletion.
    """
    db_path = request.args.get('db_path')
    if not db_path:
        return jsonify({"error": "No database path provided"}), 400

    if not os.path.exists(db_path):
        return jsonify({"error": "Database file does not exist"}), 404

    if not is_valid_sqlite_db(db_path):
        return jsonify({"error": "Invalid SQLite database file"}), 400

    dispose_db()
    set_db_path(db_path)
    init_db()

    logger.info(f"Deleting folder {folder_id}")
    with session_scope() as session:
        try:
            folder = session.query(Folder).get(folder_id)
            if not folder:
                logger.warning(f"Folder {folder_id} not found")
                return jsonify({"error": "Folder not found"}), 404

            # Delete all tables and their data entries (cascade should handle this)
            session.delete(folder)
            session.commit()
            logger.info(f"Folder {folder_id} deleted successfully")
            return jsonify({"message": "Folder deleted successfully", "folder_id": folder_id}), 200
        except Exception as e:
            logger.error(f"Error deleting folder {folder_id}: {str(e)}")
            session.rollback()
            return jsonify({"error": str(e)}), 500

@app.route("/folder", methods=["POST"], endpoint='create_folder')
@validate_input(name=str)
def create_folder(name: str) -> Any:
    """
    Create a new folder.

    Parameters:
        name (str): The name of the folder to create.

    Returns:
        JSON response with the created folder information.
    """
    db_path = request.args.get('db_path')
    if not db_path:
        return jsonify({"error": "No database path provided"}), 400

    if not os.path.exists(db_path):
        return jsonify({"error": "Database file does not exist"}), 404

    if not is_valid_sqlite_db(db_path):
        return jsonify({"error": "Invalid SQLite database file"}), 400

    dispose_db()
    set_db_path(db_path)
    init_db()

    logger.info(f"Creating new folder with name: {name}")
    with session_scope() as session:
        try:
            folder = Folder(name=name)
            session.add(folder)
            session.commit()
            logger.info(f"Folder created successfully with ID: {folder.id}")
            return jsonify({"message": "Folder created successfully", "folder_id": folder.id, "folder_name": folder.name}), 201
        except Exception as e:
            logger.error(f"Error creating folder: {str(e)}")
            session.rollback()
            return jsonify({"error": str(e)}), 500

@app.route("/table/<int:table_id>", methods=["PUT"], endpoint='update_table')
@validate_input(name=str, upload_date=str)
def update_table(table_id: int, name: str, upload_date: str) -> Any:
    """
    Update a table's name and upload date.

    Parameters:
        table_id (int): The ID of the table to update.
        name (str): The new name for the table.
        upload_date (str): The new upload date (YYYY-MM-DD format).

    Returns:
        JSON response with the status of the update.
    """
    logger.info(f"Updating table {table_id} with new name: {name}, upload_date: {upload_date}")
    with session_scope() as session:
        try:
            table = session.query(Table).get(table_id)
            if not table:
                logger.warning(f"Table {table_id} not found")
                return jsonify({"error": "Table not found"}), 404

            table.name = name
            if upload_date:
                table.upload_date = datetime.strptime(upload_date, '%Y-%m-%d').date()

            # Update all data entries with the new upload_date
            if upload_date:
                session.query(DataEntry).filter_by(table_id=table_id).update(
                    {"upload_date": datetime.strptime(upload_date, '%Y-%m-%d').date()}
                )

            session.commit()
            logger.info(f"Table {table_id} updated successfully")
            return jsonify({"message": "Table updated successfully", "table_id": table_id}), 200
        except Exception as e:
            logger.error(f"Error updating table {table_id}: {str(e)}")
            session.rollback()
            return jsonify({"error": str(e)}), 500

@app.route("/table/<int:table_id>", methods=["DELETE"], endpoint='delete_table')
def delete_table(table_id: int) -> Any:
    """
    Delete a table and all its associated data entries.

    Parameters:
        table_id (int): The ID of the table to delete.

    Returns:
        JSON response with the status of the deletion.
    """
    logger.info(f"Deleting table {table_id}")
    with session_scope() as session:
        try:
            table = session.query(Table).get(table_id)
            if not table:
                logger.warning(f"Table {table_id} not found")
                return jsonify({"error": "Table not found"}), 404

            # Delete all data entries (cascade should handle this)
            session.delete(table)
            session.commit()
            logger.info(f"Table {table_id} deleted successfully")
            return jsonify({"message": "Table deleted successfully", "table_id": table_id}), 200
        except Exception as e:
            logger.error(f"Error deleting table {table_id}: {str(e)}")
            session.rollback()
            return jsonify({"error": str(e)}), 500

@app.route("/table/<int:table_id>/colors", methods=["GET"])
def get_table_colors(table_id: int) -> Any:
    """
    Get the colors and labels configuration for a table.

    Parameters:
        table_id (int): The ID of the table.

    Returns:
        JSON response with the colors configuration.
    """
    logger.info(f"Getting colors for table {table_id}")
    try:
        with session_scope() as session:
            table = session.query(Table).get(table_id)
            if not table:
                logger.warning(f"Table {table_id} not found")
                return jsonify({"error": "Table not found"}), 404

            if table.colors_config:
                import json
                colors = json.loads(table.colors_config)
            else:
                colors = None

            return jsonify({"colors": colors}), 200
    except RuntimeError as e:
        logger.warning(f"Database not available: {str(e)}")
        return jsonify({"colors": None}), 200
    except Exception as e:
        logger.error(f"Error getting colors for table {table_id}: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route("/table/<int:table_id>/colors", methods=["PUT"])
def save_table_colors(table_id: int) -> Any:
    """
    Save the colors and labels configuration for a table.

    Parameters:
        table_id (int): The ID of the table.

    Request Body:
        colors: The colors configuration object.

    Returns:
        JSON response with the status of the save.
    """
    logger.info(f"Saving colors for table {table_id}")
    try:
        with session_scope() as session:
            table = session.query(Table).get(table_id)
            if not table:
                logger.warning(f"Table {table_id} not found")
                return jsonify({"error": "Table not found"}), 404

            data = request.json
            colors = data.get('colors')

            if colors:
                import json
                table.colors_config = json.dumps(colors)
            else:
                table.colors_config = None

            session.commit()
            logger.info(f"Colors saved successfully for table {table_id}")
            return jsonify({"message": "Colors saved successfully"}), 200
    except RuntimeError as e:
        logger.warning(f"Database not available: {str(e)}")
        return jsonify({"error": "Database not available"}), 503
    except Exception as e:
        logger.error(f"Error saving colors for table {table_id}: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route("/view_tables", methods=["GET"])
def view_tables() -> Any:
    """
    View all tables in the database.

    Returns:
        JSON response with a list of tables.
    """
    with session_scope() as session:
        tables = session.query(Table).all()
        return jsonify([{"id": t.id, "name": t.name} for t in tables]), 200

@app.route("/org_data", methods=["GET"], endpoint='get_org_data')
@validate_input(table_id=int)
def get_org_data(table_id: int) -> Any:
    """
    Retrieve organizational data for a specific table.

    Parameters:
        table_id (int): The ID of the table to retrieve data from.

    Returns:
        JSON response with the organizational chart and log.
    """
    org_chart, log = get_org_chart(table_id)
    response = {"org_chart": org_chart}
    if log:
        response["log"] = log
    return jsonify(response), 200

@app.route("/department_structure", methods=["GET"], endpoint='fetch_department_structure')
@validate_input(table_id=int, department=str)
def fetch_department_structure(table_id: int, department: str) -> Any:
    """
    Fetch the department structure for a specific table.

    Parameters:
        table_id (int): The ID of the table to retrieve data from.
        department (str): The department to fetch the structure for.

    Returns:
        JSON response with the department structure.
    """
    structure = get_department_structure(table_id, department)
    return jsonify(structure), 200

@app.route("/age_distribution/<int:table_id>", methods=["GET"])
def fetch_age_distribution(table_id: int) -> Any:
    """
    Fetch the age distribution for a specific table.

    Parameters:
        table_id (int): The ID of the table to retrieve data from.

    Returns:
        JSON response with the age distribution.
    """
    distribution = get_age_distribution(table_id)
    return jsonify(distribution), 200

def find_person_in_tree_for_timeline(node: dict, target_person_id: str) -> Optional[dict]:
    """
    Recursively search for a person in the organization tree.

    Parameters:
        node (dict): The current node in the org tree.
        target_person_id (str): The ID of the person to find.

    Returns:
        Optional[dict]: The node containing the person, or None if not found.
    """
    if str(node.get('person_id')) == str(target_person_id):
        return node
    
    for child in node.get('children', []):
        result = find_person_in_tree_for_timeline(child, target_person_id)
        if result:
            return result
    
    return None

def find_nodes_by_structure_for_timeline(node: dict, target_structure: str) -> List[dict]:
    """
    Recursively search for nodes in the organization tree that match the given hierarchical structure.

    Parameters:
        node (dict): The current node in the org tree.
        target_structure (str): The hierarchical structure to match (e.g., "/1/1/2").

    Returns:
        List[dict]: A list of nodes that match the given structure, or an empty list if none found.
    """
    matching_nodes = []
    
    if node.get('hierarchical_structure') == target_structure:
        matching_nodes.append(node)
    
    for child in node.get('children', []):
        matching_nodes.extend(find_nodes_by_structure_for_timeline(child, target_structure))
    
    return matching_nodes

@app.route("/timeline/<int:folder_id>", methods=["GET"])
def get_timeline(folder_id: int) -> Any:
    """
    Generate a timeline and CV based on organizational data, either for a person or a hierarchical structure.

    Parameters:
        folder_id (int): The ID of the folder containing the data tables.

    Query Parameters:
        person_id (str): The ID of the person to generate the timeline/CV for.
        hierarchical_structure (str): The hierarchical structure to retrieve data for (e.g., "Engineering/Frontend").
        table_id (str): Optional. If provided, only process up to this table ID.

    Returns:
        JSON: A dictionary containing the timeline and CV data.
    """
    person_id = request.args.get('person_id')
    hierarchical_structure = request.args.get('hierarchical_structure')
    table_id = request.args.get('table_id')
    
    if not person_id and not hierarchical_structure:
        return jsonify({"error": "Either person_id or hierarchical_structure must be provided"}), 400
    
    try:
        with session_scope() as session:
            tables = (
                session.query(Table)
                .filter_by(folder_id=folder_id)
                .order_by(Table.upload_date)
                .all()
            )
            
            if not tables:
                return jsonify({"error": f"No tables found in folder {folder_id}"}), 404
            
            if table_id:
                table_id = int(table_id)
                if table_id not in [table.id for table in tables]:
                    return jsonify({"error": f"Table with id {table_id} not found in folder {folder_id}"}), 404
            
            logger.info(f"Processing {len(tables)} tables for folder {folder_id}")
            
            timeline = []
            cv = []
            current_structure = None
            last_entry = None
            
            for table in tables:
                org_tree, _ = get_org_chart(table.id)
                
                if hierarchical_structure:
                    matching_nodes = find_nodes_by_structure_for_timeline(org_tree, hierarchical_structure)
                else:
                    matching_nodes = [find_person_in_tree_for_timeline(org_tree, person_id)]
                
                matching_nodes = [node for node in matching_nodes if node]  # Remove None values
                
                if matching_nodes:
                    nodes_info = [
                        {
                            "name": node.get('name'),
                            "role": node.get('role'),
                            "department": node.get('department'),
                            "rank": node.get('rank')
                        } for node in matching_nodes
                    ]
                    
                    if current_structure is None or current_structure != nodes_info:
                        timeline_entry = {
                            "table_id": table.id,
                            "name": table.name,
                            "upload_date": table.upload_date.isoformat(),
                            "nodes_info": nodes_info
                        }
                        
                        if last_entry and last_entry["nodes_info"] == nodes_info:
                            last_entry["end_date"] = table.upload_date.isoformat()
                        else:
                            if last_entry:
                                last_entry["end_date"] = table.upload_date.isoformat()
                                timeline.append(last_entry)
                                
                                cv.append({
                                    "roles": [
                                        {
                                            "role": node['role'],
                                            "department": node['department'],
                                            "startDate": last_entry["upload_date"],
                                            "endDate": table.upload_date.isoformat()
                                        } for node in last_entry["nodes_info"]
                                    ]
                                })
                            
                            timeline_entry["start_date"] = table.upload_date.isoformat()
                            last_entry = timeline_entry
                        
                        current_structure = nodes_info
                
                if table_id and table.id == table_id:
                    break
            
            if last_entry:
                last_entry["end_date"] = None
                timeline.append(last_entry)
                
                cv.append({
                    "roles": [
                        {
                            "role": node['role'],
                            "department": node['department'],
                            "startDate": last_entry["start_date"],
                            "endDate": None
                        } for node in last_entry["nodes_info"]
                    ]
                })
            
            result = {
                "timeline": timeline,
                "cv": cv
            }
            
            return jsonify(result), 200
    
    except Exception as e:
        logger.error(f"Error processing timeline for folder {folder_id}: {str(e)}")
        return jsonify({"error": "An unexpected error occurred while processing the timeline"}), 500

@app.route("/folders", methods=["GET"])
def get_folders_list() -> Any:
    """
    Retrieve a list of folders in the database.

    Returns:
        JSON response with the list of folders.
    """
    db_path = request.args.get('db_path')
    if not db_path:
        return jsonify({"error": "No database path provided"}), 400

    if not os.path.exists(db_path):
        return jsonify({"error": "Database file does not exist"}), 404

    if not is_valid_sqlite_db(db_path):
        return jsonify({"error": "Invalid SQLite database file"}), 400

    dispose_db()
    set_db_path(db_path)
    init_db()

    session = get_session()
    try:
        folders = session.query(Folder).all()
        folders_list = [{"id": folder.id, "name": folder.name} for folder in folders]
        return jsonify(folders_list), 200
    except SQLAlchemyError as e:
        logger.error(f"Database error in get_folders_list: {str(e)}")
        return jsonify({"error": f"Database error: {str(e)}"}), 500
    except Exception as e:
        logger.error(f"Unexpected error in get_folders_list: {str(e)}")
        return jsonify({"error": f"Unexpected error: {str(e)}"}), 500
    finally:
        session.close()

@app.route("/compare_tables/<int:folder_id>", methods=["GET"], endpoint='compare_tables')
@validate_input(table1_id=int, table2_id=int)
def compare_tables(folder_id: int, table1_id: int, table2_id: int) -> Any:
    """
    Compare two tables in the specified folder and return the differences.

    Parameters:
        folder_id (int): The ID of the folder containing the tables.
        table1_id (int): The ID of the first table to compare.
        table2_id (int): The ID of the second table to compare.

    Returns:
        JSON response with the comparison report.
    """
    with session_scope() as session:
        table1 = session.query(Table).filter_by(id=table1_id, folder_id=folder_id).first()
        table2 = session.query(Table).filter_by(id=table2_id, folder_id=folder_id).first()
        
        if not table1 or not table2:
            return jsonify({"error": "One or both tables not found in the specified folder"}), 404
        
        data1 = session.query(DataEntry).filter_by(table_id=table1.id).all()
        data2 = session.query(DataEntry).filter_by(table_id=table2.id).all()
        
        changes = compare_org_data(data1, data2)
        aggregated_report = generate_aggregated_report(changes, data1, data2)
        
        report = {
            "table1": {
                "id": table1.id,
                "name": table1.name,
                "upload_date": table1.upload_date.isoformat()
            },
            "table2": {
                "id": table2.id,
                "name": table2.name,
                "upload_date": table2.upload_date.isoformat()
            },
            "changes": changes,
            "aggregated_report": aggregated_report
        }
        
        return jsonify(report), 200

def compare_org_data(data1: List[DataEntry], data2: List[DataEntry]) -> Dict[str, Any]:
    """Compare only records with unambiguous employee IDs."""
    return compare_records(data1, data2)


@app.route("/compare_tables", methods=["GET"])
@validate_input(table1_id=int, table2_id=int)
def compare_database_tables(table1_id: int, table2_id: int) -> Any:
    """Compare two tables anywhere in the active be-net database."""
    database_error = activate_database_path(request.args.get("db_path"))
    if database_error:
        return database_error
    if table1_id == table2_id:
        return jsonify({"error": "Select two different tables"}), 400
    with session_scope() as session:
        tables = [session.get(Table, table_id) for table_id in (table1_id, table2_id)]
        if any(table is None for table in tables):
            return jsonify({"error": "One or both tables were not found"}), 404
        entries = [session.query(DataEntry).filter_by(table_id=table.id).all() for table in tables]
        return jsonify({
            "table1": {"id": tables[0].id, "name": tables[0].name},
            "table2": {"id": tables[1].id, "name": tables[1].name},
            "changes": compare_org_data(*entries),
        })


def generate_aggregated_report(changes: Dict[str, Any], data1: List[DataEntry], data2: List[DataEntry]) -> Dict[str, Any]:
    """
    Generate an aggregated report based on the changes between two datasets.

    Parameters:
        changes (Dict[str, Any]): The changes identified between the two datasets.
        data1 (List[DataEntry]): The first set of data entries.
        data2 (List[DataEntry]): The second set of data entries.

    Returns:
        Dict[str, Any]: A dictionary containing the aggregated report.
    """
    excluded_ids = {item['record']['person_id'] for item in changes['excluded']}
    data1 = [entry for entry in data1 if employee_id(entry) and employee_id(entry) not in excluded_ids]
    data2 = [entry for entry in data2 if employee_id(entry) and employee_id(entry) not in excluded_ids]
    return {
        "total_employees": {
            "before": len(data1),
            "after": len(data2),
            "difference": len(data2) - len(data1)
        },
        "department_changes": summarize_changes(changes["department_changes"]),
        "role_changes": summarize_changes(changes["role_changes"]),
        "rank_changes": summarize_changes(changes["rank_changes"]),
        "reporting_line_changes": summarize_changes(changes["reporting_line_changes"]),
        "structural_changes": len(changes["changed"]),
        "new_employees": len(changes["added"]),
        "departed_employees": len(changes["removed"]),
        "age_distribution_change": compare_age_distributions(data1, data2),
        "rank_distribution_change": compare_rank_distributions(data1, data2),
        "department_size_changes": compare_department_sizes(data1, data2),
        "role_diversity": compare_role_diversity(data1, data2),
        "org_depth_analysis": compare_org_depths(data1, data2),
        "span_of_control_changes": compare_span_of_control(data1, data2),
        "turnover_rate": calculate_turnover_rate(changes, data1),
        "promotion_rate": calculate_promotion_rate(changes, data1)
    }

def summarize_changes(changes: Dict[str, Any]) -> Dict[str, Any]:
    """
    Summarize the changes in a structured format.

    Parameters:
        changes (Dict[str, Any]): The changes to summarize.

    Returns:
        Dict[str, Any]: A summary of the changes.
    """
    return {
        "total": len(changes),
        "details": changes
    }

def compare_age_distributions(data1: List[DataEntry], data2: List[DataEntry]) -> Dict[str, Any]:
    """
    Compare the age distributions of two datasets.

    Parameters:
        data1 (List[DataEntry]): The first set of data entries.
        data2 (List[DataEntry]): The second set of data entries.

    Returns:
        Dict[str, Any]: A dictionary containing the age distribution comparison.
    """
    def get_age_distribution(data: List[DataEntry]) -> Dict[str, float]:
        current_year = datetime.now().year
        ages = []
        for entry in data:
            if isinstance(entry.birth_date, str):
                try:
                    birth_year = datetime.strptime(entry.birth_date, "%Y-%m-%d").year
                except ValueError:
                    continue
            elif isinstance(entry.birth_date, datetime):
                birth_year = entry.birth_date.year
            else:
                continue
            ages.append(current_year - birth_year)
        
        if not ages:
            return {"average": 0, "min": 0, "max": 0, "median": 0}
        
        return {
            "average": sum(ages) / len(ages),
            "min": min(ages),
            "max": max(ages),
            "median": sorted(ages)[len(ages) // 2]
        }
    
    dist1 = get_age_distribution(data1)
    dist2 = get_age_distribution(data2)
    
    return {
        "before": dist1,
        "after": dist2,
        "average_change": dist2["average"] - dist1["average"],
        "median_change": dist2["median"] - dist1["median"]
    }

def compare_rank_distributions(data1: List[DataEntry], data2: List[DataEntry]) -> Dict[str, Any]:
    """
    Compare the rank distributions of two datasets.

    Parameters:
        data1 (List[DataEntry]): The first set of data entries.
        data2 (List[DataEntry]): The second set of data entries.

    Returns:
        Dict[str, Any]: A dictionary containing the rank distribution comparison.
    """
    def get_rank_distribution(data: List[DataEntry]) -> Dict[str, int]:
        ranks = [entry.rank for entry in data]
        return {rank: ranks.count(rank) for rank in set(ranks)}
    
    dist1 = get_rank_distribution(data1)
    dist2 = get_rank_distribution(data2)
    
    all_ranks = set(list(dist1.keys()) + list(dist2.keys()))
    
    changes = {}
    for rank in all_ranks:
        before = dist1.get(rank, 0)
        after = dist2.get(rank, 0)
        if before != after:
            changes[rank] = after - before
    
    return changes

def compare_department_sizes(data1: List[DataEntry], data2: List[DataEntry]) -> Dict[str, Any]:
    """
    Compare the sizes of departments in two datasets.

    Parameters:
        data1 (List[DataEntry]): The first set of data entries.
        data2 (List[DataEntry]): The second set of data entries.

    Returns:
        Dict[str, Any]: A dictionary containing the department size comparison.
    """
    def get_department_sizes(data: List[DataEntry]) -> Dict[str, int]:
        departments = [entry.department for entry in data]
        return {dept: departments.count(dept) for dept in set(departments)}
    
    sizes1 = get_department_sizes(data1)
    sizes2 = get_department_sizes(data2)
    
    all_departments = set(list(sizes1.keys()) + list(sizes2.keys()))
    
    changes = {}
    for dept in all_departments:
        before = sizes1.get(dept, 0)
        after = sizes2.get(dept, 0)
        if before != after:
            percent_change = ((after - before) / before * 100) if before > 0 else None
            changes[dept] = {
                "before": before,
                "after": after,
                "change": after - before,
                "percent_change": percent_change
            }
    
    return changes

def compare_role_diversity(data1: List[DataEntry], data2: List[DataEntry]) -> Dict[str, Any]:
    """
    Compare the role diversity in two datasets.

    Parameters:
        data1 (List[DataEntry]): The first set of data entries.
        data2 (List[DataEntry]): The second set of data entries.

    Returns:
        Dict[str, Any]: A dictionary containing the role diversity comparison.
    """
    def get_role_diversity(data: List[DataEntry]) -> Dict[str, Any]:
        roles = [entry.role for entry in data]
        unique_roles = len(set(roles))
        return {
            "unique_roles": unique_roles,
            "role_to_employee_ratio": unique_roles / len(data) if data else 0
        }
    
    div1 = get_role_diversity(data1)
    div2 = get_role_diversity(data2)
    
    return {
        "before": div1,
        "after": div2,
        "unique_roles_change": div2["unique_roles"] - div1["unique_roles"],
        "ratio_change": div2["role_to_employee_ratio"] - div1["role_to_employee_ratio"]
    }

def compare_org_depths(data1: List[DataEntry], data2: List[DataEntry]) -> Dict[str, Any]:
    """
    Compare the organizational depth in two datasets.

    Parameters:
        data1 (List[DataEntry]): The first set of data entries.
        data2 (List[DataEntry]): The second set of data entries.

    Returns:
        Dict[str, Any]: A dictionary containing the organizational depth comparison.
    """
    def get_max_depth(data: List[DataEntry]) -> int:
        return max(len(entry.hierarchical_structure.split('/')) for entry in data)
    
    depth1 = get_max_depth(data1)
    depth2 = get_max_depth(data2)
    
    return {
        "before": depth1,
        "after": depth2,
        "change": depth2 - depth1
    }

def compare_span_of_control(data1: List[DataEntry], data2: List[DataEntry]) -> Dict[str, Any]:
    """
    Compare the span of control in two datasets.

    Parameters:
        data1 (List[DataEntry]): The first set of data entries.
        data2 (List[DataEntry]): The second set of data entries.

    Returns:
        Dict[str, Any]: A dictionary containing the span of control comparison.
    """
    def get_avg_span(data: List[DataEntry]) -> float:
        manager_counts = {}
        for entry in data:
            manager = '/'.join(entry.hierarchical_structure.split('/')[:-1])
            if manager:
                manager_counts[manager] = manager_counts.get(manager, 0) + 1
        return sum(manager_counts.values()) / len(manager_counts) if manager_counts else 0

    span1 = get_avg_span(data1)
    span2 = get_avg_span(data2)

    return {
        "before": span1,
        "after": span2,
        "change": span2 - span1
    }

def get_hierarchical_path(nodes, node_id):
    """
    Generate hierarchical path for a node based on parent-child relationships.

    Args:
        nodes: Dictionary of node objects
        node_id: ID of the node to generate path for

    Returns:
        str: Hierarchical path (e.g., '/CEO/Manager/Employee')
    """
    if node_id not in nodes:
        raise ValueError(f"Node ID '{node_id}' not found in nodes dictionary")

    path_components = []
    curr_id = node_id
    visited = set()  # Prevent infinite loops

    while curr_id and curr_id not in visited:
        visited.add(curr_id)

        # Check if the current node is the root and if its name is 'Root'
        if curr_id == 'root' and nodes.get(curr_id, {}).get('name') == 'Root':
            break  # Stop if it's the placeholder root

        if curr_id not in nodes:
            break  # Node not found, stop traversal

        path_components.insert(0, nodes[curr_id].get('name', str(curr_id)))

        parent_found = False
        for p_id, p_data in nodes.items():
            if curr_id in p_data.get('children', []):
                curr_id = p_id
                parent_found = True
                break
        if not parent_found:
            curr_id = None

    return '/' + '/'.join(path_components)

@app.route("/create-tree", methods=["POST"])
def create_tree():
    """
    Create a new tree from data sent from the frontend.
    """
    data = request.json
    tree_name = data.get("treeName")
    nodes = data.get("nodes")
    folder_name = data.get("folderName")
    upload_date_str = data.get("uploadDate")
    db_path = request.args.get("db_path")

    if not all([tree_name, nodes, folder_name, db_path]):
        return jsonify({"error": "Missing required parameters"}), 400

    # Parse upload date or default to now
    if upload_date_str:
        try:
            upload_date = datetime.strptime(upload_date_str, "%Y-%m-%d").date()
        except ValueError:
            upload_date = datetime.now().date()
    else:
        upload_date = datetime.now().date()

    set_db_path(db_path)
    init_db()

    with session_scope() as session:
        try:
            folder = session.query(Folder).filter_by(name=folder_name).first()
            if not folder:
                folder = Folder(name=folder_name)
                session.add(folder)
                session.flush()

            table = Table(name=tree_name, folder_id=folder.id, upload_date=upload_date)
            session.add(table)
            session.flush()

            for node_id, node_data in nodes.items():
                if node_id == 'root':  # Skip the root placeholder
                    continue

                hierarchical_structure = get_hierarchical_path(nodes, node_id)

                entry = DataEntry(
                    table_id=table.id,
                    name=node_data["name"],
                    hierarchical_structure=hierarchical_structure,
                    role=node_data.get("role", ""),
                    department=node_data.get("department", ""),
                    rank=node_data.get("rank", ""),
                    person_id=node_data.get("person_id", node_id), # Use node_id as a fallback
                    organization_id=node_data.get("organization_id", ""),
                    personal_information=node_data.get("personal_information", ""),
                    role_information=node_data.get("role_information", ""),
                    is_dead=node_data.get("is_dead", False),
                    organization_name=node_data.get("organization_name", "")
                )
                session.add(entry)
            
            session.commit()
            return jsonify({"message": "Tree created successfully", "table_id": table.id, "folder_id": folder.id}), 200

        except Exception as e:
            session.rollback()
            logger.error(f"Error creating tree: {str(e)}")
            return jsonify({"error": str(e)}), 500

def calculate_turnover_rate(changes: Dict[str, Any], data1: List[DataEntry]) -> float:
    """
    Calculate the turnover rate based on changes and the initial dataset.

    Parameters:
        changes (Dict[str, Any]): The changes identified between the two datasets.
        data1 (List[DataEntry]): The first set of data entries.

    Returns:
        float: The turnover rate as a percentage.
    """
    departed = len(changes["removed"])
    total_before = len(data1)
    return (departed / total_before) * 100 if total_before > 0 else 0

def calculate_promotion_rate(changes: Dict[str, Any], data1: List[DataEntry]) -> float:
    """
    Calculate the promotion rate based on changes and the initial dataset.

    Parameters:
        changes (Dict[str, Any]): The changes identified between the two datasets.
        data1 (List[DataEntry]): The first set of data entries.

    Returns:
        float: The promotion rate as a percentage.
    """
    promotions = sum(1 for change in changes["rank_changes"].values() if change["old"] < change["new"])
    total_before = len(data1)
    return (promotions / total_before) * 100 if total_before > 0 else 0

def entry_to_dict(entry: DataEntry) -> Dict[str, Any]:
    """
    Convert a DataEntry object to a dictionary.

    Parameters:
        entry (DataEntry): The data entry to convert.

    Returns:
        Dict[str, Any]: A dictionary representation of the data entry.
    """
    return {
        "person_id": entry.person_id,
        "name": entry.name,
        "role": entry.role,
        "department": entry.department,
        "rank": entry.rank,
        "hierarchical_structure": entry.hierarchical_structure,
        "personal_information": entry.personal_information,
        "role_information": entry.role_information,
        "is_dead": entry.is_dead,
        "organization_name": entry.organization_name
    }

@app.route("/highlight_nodes", methods=["GET"], endpoint='highlight_nodes')
@validate_input(hierarchical_structure=str, table_id=int)
def highlight_nodes(hierarchical_structure: str, table_id: int) -> Any:
    """
    Highlight nodes in the organizational chart based on the hierarchical structure.

    Parameters:
        hierarchical_structure (str): The hierarchical structure to highlight.
        table_id (int): The ID of the table to retrieve data from.

    Returns:
        JSON response with the highlighted nodes.
    """
    org_chart = get_org_chart(table_id)[0]
    highlighted_nodes = find_node_path(org_chart, hierarchical_structure)
    
    if highlighted_nodes is None:
        return jsonify({"error": f"Node with hierarchical structure '{hierarchical_structure}' not found in the organization chart"}), 404

    return jsonify({"highlighted_nodes": highlighted_nodes}), 200

def find_node_path(node: dict, target_structure: str) -> Optional[List[str]]:
    """
    Find the path to a node in the organization tree based on its hierarchical structure.

    Parameters:
        node (dict): The current node in the org tree.
        target_structure (str): The hierarchical structure to match.

    Returns:
        Optional[List[str]]: The path to the node if found, otherwise None.
    """
    def dfs(current_node: dict, path: List[str]) -> Optional[List[str]]:
        if current_node['hierarchical_structure'] == target_structure:
            return path + [current_node['hierarchical_structure']]
        
        for child in current_node.get('children', []):
            result = dfs(child, path + [current_node['hierarchical_structure']])
            if result:
                return result
        
        return None

    return dfs(node, [])

@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve(path: str) -> Any:
    """
    Serve static files or the main application page.

    Parameters:
        path (str): The path to the requested resource.

    Returns:
        Response: The requested file or the main application page.
    """
    if path != "" and os.path.exists(app.static_folder + '/' + path):
        return send_from_directory(app.static_folder, path)
    else:
        return send_from_directory(app.static_folder, 'index.html')

@app.route("/columns/<int:folder_id>/<int:table_id>", methods=["GET"])
def get_available_columns(folder_id: int, table_id: int) -> Any:
    """
    Fetch the available columns for a specific table in a folder.

    Parameters:
        folder_id (int): The ID of the folder containing the table.
        table_id (int): The ID of the table to retrieve columns from.

    Returns:
        JSON response with the available columns.
    """
    logger.info(f"Fetching available columns for folder_id: {folder_id}, table_id: {table_id}")
    
    try:
        with session_scope() as session:
            table = (
                session.query(Table)
                .filter_by(id=table_id, folder_id=folder_id)
                .first()
            )
            
            if not table:
                logger.error(f"Table with id {table_id} not found in folder {folder_id}")
                return jsonify({"error": f"Table with id {table_id} not found in folder {folder_id}"}), 404
            
            columns = [column.key for column in inspect(DataEntry).columns if column.key not in ['id', 'table_id']]
            
            logger.info(f"Available columns: {columns}")
            
            return jsonify({
                "columns": columns,
                "folder_id": folder_id,
                "table_id": table_id
            }), 200
    
    except Exception as e:
        logger.exception(f"Error fetching columns for folder {folder_id}, table {table_id}: {str(e)}")
        return jsonify({"error": "An unexpected error occurred while fetching columns"}), 500

@app.route("/search/<int:folder_id>/<int:table_id>", methods=["GET"])
def search_nodes(folder_id: int, table_id: int) -> Any:
    """
    Search for nodes in a specific table based on a query.

    Parameters:
        folder_id (int): The ID of the folder containing the table.
        table_id (int): The ID of the table to search in.

    Returns:
        JSON response with the search results.
    """
    query = request.args.get('query', '')
    columns = request.args.get('columns', '').split(',')
    logger.info(f"Search request received for folder_id: {folder_id}, table_id: {table_id}, query: '{query}', columns: {columns}")
    try:
        with session_scope() as session:
            table = session.query(Table).filter_by(id=table_id, folder_id=folder_id).first()
            if not table:
                logger.error(f"Table with id {table_id} not found in folder {folder_id}")
                return jsonify({"error": f"Table with id {table_id} not found in folder {folder_id}"}), 404
            logger.info(f"Searching table {table_id} in folder {folder_id} across specified columns: {columns}")
            if query:
                results = search_table_specified_columns(session, table_id, query, columns)
            else:
                results = get_all_results(session, table_id)
            logger.info(f"Search completed. Total results: {len(results)}")
            return jsonify({
                "results": results,
                "total_results": len(results),
                "query": query,
                "columns": columns,
                "folder_id": folder_id,
                "table_id": table_id
            }), 200
    except Exception as e:
        logger.exception(f"Error searching in folder {folder_id}, table {table_id}: {str(e)}")
        return jsonify({"error": "An unexpected error occurred while searching"}), 500

def get_all_results(session: Any, table_id: int) -> List[Dict[str, Any]]:
    """
    Fetch all results for a specific table.

    Parameters:
        session (Any): The database session.
        table_id (int): The ID of the table to retrieve results from.

    Returns:
        List[Dict[str, Any]]: A list of dictionaries representing the results.
    """
    logger.info(f"Fetching all results for table with ID: {table_id}")
    results = session.query(DataEntry).filter(DataEntry.table_id == table_id).all()
    logger.info(f"Query executed. Number of results found: {len(results)}")
    search_results = []
    for entry in results:
        result = {
            'person_id': entry.person_id,
            'name': entry.name,
            'role': entry.role,
            'department': entry.department,
            'rank': entry.rank,
            'organization_id': entry.organization_id,
            'matched_terms': [],
            'hierarchical_structure': entry.hierarchical_structure,
            'organization_name': entry.organization_name
        }
        search_results.append(result)
        logger.debug(f"Result added for person_id: {entry.person_id}")
    logger.info("All results fetched and prepared.")
    return search_results

def search_table_specified_columns(session: Any, table_id: int, query: str, columns: List[str]) -> List[Dict[str, Any]]:
    """
    Search for entries in a specific table based on a query and specified columns.

    Parameters:
        session (Any): The database session.
        table_id (int): The ID of the table to search in.
        query (str): The search query.
        columns (List[str]): The columns to search across.

    Returns:
        List[Dict[str, Any]]: A list of dictionaries representing the search results.
    """
    logger.info(f"Starting search in table with ID: {table_id} for query: '{query}' across columns: {columns}")
    parsed_query = parse_complex_query(query)
    logger.info(f"Parsed query: {parsed_query}")
    base_query = session.query(DataEntry).filter(DataEntry.table_id == table_id)
    logger.info(f"Base query created for table_id: {table_id}")
    all_columns = [column.key for column in DataEntry.__table__.columns if column.key not in ['id', 'table_id']]
    valid_columns = [col for col in columns if col in all_columns]
    if not valid_columns:
        valid_columns = all_columns
    main_condition = build_sqlalchemy_condition(parsed_query, valid_columns)
    query_sql = str(base_query.filter(main_condition).statement.compile(compile_kwargs={"literal_binds": True}))
    logger.info(f"SQL query: {query_sql}")
    results = base_query.filter(main_condition).all()
    logger.info(f"Query executed. Number of results found: {len(results)}")
    search_results = []
    for entry in results:
        matched_terms = []
        matched_columns = []
        for column in valid_columns:
            column_value = str(getattr(entry, column))
            column_matches = get_matched_terms(column_value, parsed_query)
            if column_matches:
                matched_terms.extend(column_matches)
                matched_columns.append(column)
        result = {
            'person_id': entry.person_id,
            'name': entry.name,
            'role': entry.role,
            'department': entry.department,
            'rank': entry.rank,
            'organization_id': entry.organization_id,
            'matched_terms': list(set(matched_terms)),
            'hierarchical_structure': entry.hierarchical_structure,
            'matched_columns': matched_columns
        }
        search_results.append(result)
        logger.debug(f"Result added: {result}")
    logger.info(f"Search completed and results prepared. Total results: {len(search_results)}")
    return search_results

def parse_complex_query(query: str) -> List[Any]:
    """
    Parse a complex search query into a structured format.

    Parameters:
        query (str): The search query to parse.

    Returns:
        List[Any]: A structured representation of the parsed query.
    """
    logger.info(f"Parsing complex query: '{query}'")
    def tokenize(s: str) -> List[str]:
        tokens = re.findall(r'([()]|\w+|"[^"]*")', s)
        tokens = [t.upper() if t.lower() in {"and", "or", "not"} and not (t.startswith('"') and t.endswith('"')) else t for t in tokens]
        logger.debug(f"Tokenized query: {tokens}")
        return tokens
    def parse_expression(tokens: List[str]) -> Tuple[List[Any], List[str]]:
        result = []
        while tokens:
            token = tokens.pop(0)
            if token == '(':
                subexpr, tokens = parse_expression(tokens)
                if result and result[-1] == 'NOT':
                    result[-1] = ['NOT', subexpr]
                else:
                    result.append(subexpr)
            elif token == ')':
                return result, tokens
            elif token == 'NOT':
                if tokens and tokens[0] == '(':
                    subexpr, tokens = parse_expression(tokens[1:])
                    result.append(['NOT', subexpr])
                else:
                    next_token = tokens.pop(0) if tokens else None
                    result.append(['NOT', next_token])
            else:
                result.append(token)
        return result, []
    try:
        tokens = tokenize(query)
        parsed_query, _ = parse_expression(tokens)
        while len(parsed_query) == 1 and isinstance(parsed_query[0], list):
            parsed_query = parsed_query[0]
        logger.info(f"Parsed complex query result: {parsed_query}")
        return parsed_query
    except Exception as e:
        logger.error(f"Error parsing query '{query}': {str(e)}")
        raise ValueError(f"Invalid query format: {str(e)}")

def build_sqlalchemy_condition(parsed_query: List[Any], columns: List[str]) -> Any:
    """
    Build a SQLAlchemy condition from a parsed query.

    Parameters:
        parsed_query (List[Any]): The parsed query to convert into a condition.
        columns (List[str]): The columns to include in the condition.

    Returns:
        Any: The SQLAlchemy condition.
    """
    logger.info(f"Building SQLAlchemy condition for parsed query: {parsed_query}")
    def build_condition(expr: Any) -> Any:
        logger.debug(f"Building condition for expression: {expr}")
        if isinstance(expr, list):
            if len(expr) == 1:
                return build_condition(expr[0])
            elif expr[0] == 'NOT':
                return not_(or_(*[build_condition([expr[1]]) for column in columns]))
            elif 'OR' in expr:
                return or_(*[build_condition(e) for e in expr if e != 'OR'])
            elif 'AND' in expr:
                return and_(*[build_condition(e) for e in expr if e != 'AND'])
            else:
                return and_(*[build_condition(e) for e in expr])
        else:
            column_conditions = []
            for column in columns:
                if expr.startswith('"') and expr.endswith('"'):
                    column_conditions.append(func.lower(getattr(DataEntry, column)) == func.lower(expr.strip('"')))
                else:
                    column_conditions.append(func.lower(getattr(DataEntry, column)).like(f"%{expr.lower()}%"))
            return or_(*column_conditions)
    try:
        condition = build_condition(parsed_query)
        logger.info(f"Built SQLAlchemy condition: {condition}")
        return condition
    except Exception as e:
        logger.error(f"Error building SQLAlchemy condition: {str(e)}")
        raise ValueError(f"Error building search condition: {str(e)}")

def get_matched_terms(text: str, parsed_query: List[Any]) -> List[str]:
    """
    Get the terms that match the parsed query in the given text.

    Parameters:
        text (str): The text to search for matches.
        parsed_query (List[Any]): The parsed query to evaluate.

    Returns:
        List[str]: A list of matched terms.
    """
    def evaluate(expr: Any) -> Tuple[bool, set]:
        if isinstance(expr, list):
            if len(expr) > 0 and expr[0] == 'NOT':
                sub_bool, sub_matches = evaluate(expr[1])
                return (not sub_bool, set())
            elif 'AND' in expr:
                all_matches = set()
                for sub in expr:
                    if sub == 'AND':
                        continue
                    sub_bool, sub_matches = evaluate(sub)
                    if not sub_bool:
                        return (False, set())
                    all_matches.update(sub_matches)
                return (True, all_matches)
            elif 'OR' in expr:
                any_matches = set()
                result = False
                for sub in expr:
                    if sub == 'OR':
                        continue
                    sub_bool, sub_matches = evaluate(sub)
                    if sub_bool:
                        result = True
                        any_matches.update(sub_matches)
                return (result, any_matches)
            else:
                all_matches = set()
                for sub in expr:
                    sub_bool, sub_matches = evaluate(sub)
                    if not sub_bool:
                        return (False, set())
                    all_matches.update(sub_matches)
                return (True, all_matches)
        else:
            if expr.startswith('"') and expr.endswith('"'):
                term = expr.strip('"')
                if term.lower() == text.lower():
                    return (True, {term})
                else:
                    return (False, set())
            else:
                if expr.lower() in text.lower():
                    return (True, {expr})
                else:
                    return (False, set())
    overall_bool, matches = evaluate(parsed_query)
    return list(matches) if overall_bool else []
    
@app.route("/export_excel/<int:table_id>", methods=["GET"])
def export_excel(table_id: int) -> Any:
    """
    Export the data from a specific table to an Excel file.

    Parameters:
        table_id (int): The ID of the table to export.

    Returns:
        Response: The Excel file as an attachment.
    """
    try:
        with session_scope() as session:
            table = session.query(Table).filter_by(id=table_id).first()
            if not table:
                return jsonify({"error": f"Table with id {table_id} not found"}), 404
            
            excel_data = export_excel_data(session, table_id)
            
            return send_file(
                excel_data,
                mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                as_attachment=True,
                download_name=f"org_data_table_{table_id}.xlsx"
            )
    
    except Exception as e:
        logger.error(f"Error exporting Excel for table {table_id}: {str(e)}")
        return jsonify({"error": "An unexpected error occurred while exporting the Excel file"}), 500

@app.route("/get_relevant_tables/<int:folder_id>", methods=["GET"])
def fetch_relevant_tables_by_field(folder_id: int) -> Any:
    """
    Fetch relevant tables based on specified field criteria.

    Parameters:
        folder_id (int): The ID of the folder containing the tables.

    Returns:
        JSON response with the relevant tables.
    """
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')
    field_type = request.args.get('field_type')
    field_value = request.args.get('field_value')

    if not all([start_date, end_date, field_type, field_value]):
        return jsonify({"error": "Missing required parameters"}), 400

    try:
        start_date = datetime.strptime(start_date, '%Y-%m-%d').date()
        end_date = datetime.strptime(end_date, '%Y-%m-%d').date()
    except ValueError:
        return jsonify({"error": "Invalid date format. Use YYYY-MM-DD"}), 400

    try:
        with session_scope() as session:
            query = session.query(Table).filter(
                Table.folder_id == folder_id,
                Table.upload_date.between(start_date, end_date)
            )

            if field_type == 'hierarchical_structure':
                query = query.filter(Table.id.in_(
                    session.query(DataEntry.table_id).filter(DataEntry.hierarchical_structure == field_value)
                ))
            elif field_type == 'person_id':
                query = query.filter(Table.id.in_(
                    session.query(DataEntry.table_id).filter(DataEntry.person_id == field_value)
                ))
            else:
                return jsonify({"error": "Invalid field_type. Use 'hierarchical_structure' or 'person_id'"}), 400

            relevant_tables = query.all()

            if not relevant_tables:
                return jsonify({"message": f"No relevant tables found for the given {field_type} and date range",
                                "tables": relevant_tables}), 200

            return jsonify({
                "message": "Relevant tables fetched successfully",
                "tables": [{"id": table.id, "name": table.name, "upload_date": table.upload_date.isoformat()} for table in relevant_tables]
            }), 200
    except Exception as e:
        return jsonify({"error": f"An unexpected error occurred: {str(e)}"}), 500

@app.route("/update_node_by_person/<int:folder_id>/<string:person_id>", methods=["POST"])
def update_node_data_by_person(folder_id: int, person_id: str) -> Any:
    """
    Update a person's data in the specified folder.

    Parameters:
        folder_id (int): The ID of the folder containing the tables.
        person_id (str): The ID of the person to update.

    Returns:
        JSON response with the status of the update operation.
    """
    data = request.json
    start_date = data.get('start_date')
    end_date = data.get('end_date')
    updates = data.get('updates')
    relevant_tables = data.get("tables")

    if not all([start_date, end_date, updates]):
        return jsonify({"error": "Missing required parameters"}), 400

    try:
        start_date = datetime.strptime(start_date, '%Y-%m-%d').date()
        end_date = datetime.strptime(end_date, '%Y-%m-%d').date()
    except ValueError:
        return jsonify({"error": "Invalid date format. Use YYYY-MM-DD"}), 400

    try:
        update_results = []

        with session_scope() as session:
            for table in relevant_tables:
                updated_data = update_person_data(session, table["id"], person_id, updates)

                if 'error' in updated_data:
                    update_results.append({
                        "table_id": table["id"],
                        "upload_date": table["upload_date"],
                        "status": "error",
                        "message": updated_data['error']
                    })
                else:
                    update_results.append({
                        "table_id": table["id"],
                        "upload_date": table["upload_date"],
                        "status": "success",
                        "updated_data": updated_data
                    })

        return jsonify({
            "message": "Update operation completed",
            "results": update_results
        }), 200

    except Exception as e:
        return jsonify({"error": f"An unexpected error occurred while updating the nodes: {str(e)}"}), 500

def update_person_data(session: Any, table_id: int, person_id: str, updates: Dict[str, Any]) -> Dict[str, Any]:
    """
    Update a person's data in a specific table.

    Parameters:
        session (Any): The database session.
        table_id (int): The ID of the table containing the person's data.
        person_id (str): The ID of the person to update.
        updates (Dict[str, Any]): A dictionary containing the fields to update and their new values.

    Returns:
        Dict[str, Any]: The updated person data or an error dictionary if the person was not found.
    """
    try:
        data_entry = session.query(DataEntry).filter_by(
            table_id=table_id,
            person_id=person_id
        ).first()

        if not data_entry:
            error_msg = f"Person with ID {person_id} not found in table {table_id}"
            logger.warning(error_msg)
            return {"error": error_msg}

        for key, value in updates.items():
            if hasattr(data_entry, key):
                if key == 'birth_date' and value:
                    try:
                        value = datetime.strptime(value, '%Y-%m-%d').date()
                    except ValueError:
                        return {"error": f"Invalid date format for birth_date. Use YYYY-MM-DD"}
                setattr(data_entry, key, value)
            else:
                return {"error": f"Invalid field: {key}"}

        session.commit()
        session.refresh(data_entry)

        updated_data = {
            "person_id": data_entry.person_id,
            "name": data_entry.name,
            "role": data_entry.role,
            "department": data_entry.department,
            "rank": data_entry.rank,
            "birth_date": data_entry.birth_date.isoformat() if data_entry.birth_date else None,
            "organization_id": data_entry.organization_id,
            "personal_information": data_entry.personal_information,
            "role_information": data_entry.role_information,
            "is_dead": data_entry.is_dead,
            "organization_name": data_entry.organization_name
        }

        logger.info(f"Successfully updated data for person with ID {person_id} in table {table_id}")
        return updated_data

    except Exception as e:
        error_msg = f"Error updating data for person with ID {person_id} in table {table_id}: {str(e)}"
        logger.error(error_msg)
        session.rollback()
        return {"error": error_msg}

@app.route("/update_hierarchical_structure/<int:folder_id>", methods=["POST"])
def update_hierarchical_structure(folder_id: int) -> Any:
    """
    Update the hierarchical structure of nodes in the specified folder.

    Parameters:
        folder_id (int): The ID of the folder containing the tables.

    Returns:
        JSON response with the status of the update operation.
    """
    data = request.json
    hierarchical_structure = data.get('hierarchical_structure')
    update_type = data.get('update_type')
    target_hierarchical_structure = data.get('target_hierarchical_structure')
    new_role = data.get('new_role')
    start_date = data.get('start_date')
    end_date = data.get('end_date')
    relevant_tables = data.get('tables')

    if not all([hierarchical_structure, update_type, target_hierarchical_structure, start_date, end_date]):
        return jsonify({"error": "Missing required parameters"}), 400

    if update_type not in ['create_new', 'override']:
        return jsonify({"error": "Invalid update type. Must be 'create_new' or 'override'"}), 400

    if update_type == 'create_new' and not new_role:
        return jsonify({"error": "New role must be provided for create_new operation"}), 400

    try:
        start_date = datetime.strptime(start_date, '%Y-%m-%d').date()
        end_date = datetime.strptime(end_date, '%Y-%m-%d').date()
    except ValueError:
        return jsonify({"error": "Invalid date format. Use YYYY-MM-DD"}), 400
    
    if not relevant_tables:
        return jsonify({"error": "Hierarchical structure not found in any tables within the date range"}), 404

    results = []
    with session_scope() as session:
        for table in relevant_tables:
            result = change_hierarchical_location(
                session,
                table["id"],
                hierarchical_structure,
                update_type,
                target_hierarchical_structure,
                new_role
            )
            results.append({
                "table_id": table["id"],
                "upload_date": table["upload_date"],
                "result": result
            })

    return jsonify({
        "message": "Hierarchical location updated across relevant tables",
        "results": results
    }), 200

def change_hierarchical_location(session: Any, table_id: int, hierarchical_structure: str, update_type: str, target_hierarchical_structure: str, new_role: Optional[str] = None) -> Dict[str, Any]:
    """
    Change the hierarchical location of a node in the specified table.

    Parameters:
        session (Any): The database session.
        table_id (int): The ID of the table containing the node.
        hierarchical_structure (str): The current hierarchical structure of the node.
        update_type (str): The type of update ('create_new' or 'override').
        target_hierarchical_structure (str): The target hierarchical structure for the update.
        new_role (Optional[str]): The new role for the node if creating a new entry.

    Returns:
        Dict[str, Any]: A message indicating the result of the operation.
    """
    hierarchical_update_params = {
        'type': update_type,
        'new_parent_structure' if update_type == 'create_new' else 'override_structure': target_hierarchical_structure
    }

    if update_type == 'create_new':
        if not new_role:
            return {"error": "New role must be provided for create_new operation"}
        hierarchical_update_params['new_role'] = new_role

    changes = compute_hierarchical_changes(session, table_id, hierarchical_structure, hierarchical_update_params)

    if 'error' in changes:
        return changes

    try:
        original_entry = session.query(DataEntry).filter_by(table_id=table_id, hierarchical_structure=hierarchical_structure).first()
        if not original_entry:
            return {"error": f"No entry found with hierarchical_structure: {hierarchical_structure}"}

        if update_type == 'create_new':
            new_entry = DataEntry(**changes['new_node'])
            session.add(new_entry)

        elif update_type == 'override':
            target_entry = session.query(DataEntry).filter_by(table_id=table_id, hierarchical_structure=target_hierarchical_structure).first()
            if not target_entry:
                return {"error": f"No entry found with hierarchical_structure: {target_hierarchical_structure}"}

            for key, value in changes['update_node'].items():
                setattr(target_entry, key, value)

        for key, value in changes['null_node'].items():
            setattr(original_entry, key, value)

        session.commit()
        return {"message": "Hierarchical location updated successfully", "changes": changes}
    except Exception as e:
        session.rollback()
        return {"error": f"An error occurred while updating the hierarchical location: {str(e)}"}

def compute_hierarchical_changes(session: Any, table_id: int, hierarchical_structure: str, hierarchical_update_params: Dict[str, Any]) -> Dict[str, Any]:
    """
    Compute the changes needed to update the hierarchical structure of a node.

    Parameters:
        session (Any): The database session.
        table_id (int): The ID of the table containing the node.
        hierarchical_structure (str): The current hierarchical structure of the node.
        hierarchical_update_params (Dict[str, Any]): The parameters for the update.

    Returns:
        Dict[str, Any]: A dictionary containing the changes to be made.
    """
    current_entry = session.query(DataEntry).filter_by(table_id=table_id, hierarchical_structure=hierarchical_structure).first()
    if not current_entry:
        return {"error": f"Node with hierarchical structure {hierarchical_structure} not found in table {table_id}"}

    changes = {}

    if hierarchical_update_params.get('type') == 'create_new':
        new_parent_structure = hierarchical_update_params['new_parent_structure']
        new_role = hierarchical_update_params.get('new_role')
        
        if not new_role:
            return {"error": "New role must be provided for create_new operation"}

        new_parent = session.query(DataEntry).filter_by(table_id=table_id, hierarchical_structure=new_parent_structure).first()
        if not new_parent:
            return {"error": f"New parent node with hierarchical structure {new_parent_structure} not found"}

        try:
            new_hierarchy = generate_hierarchical_structure(session, table_id, new_parent.hierarchical_structure)
        except ValueError as e:
            return {"error": str(e)}

        changes['new_node'] = {
            "table_id": table_id,
            "person_id": current_entry.person_id,
            "upload_date": current_entry.upload_date,
            "hierarchical_structure": new_hierarchy,
            "name": current_entry.name,
            "role": new_role,
            "department": new_parent.department,
            "birth_date": current_entry.birth_date,
            "rank": current_entry.rank,
            "organization_id": current_entry.organization_id,
            "personal_information": current_entry.personal_information,
            "role_information": current_entry.role_information,
            "is_dead": current_entry.is_dead
        }

    elif hierarchical_update_params.get('type') == 'override':
        override_structure = hierarchical_update_params['override_structure']
        override_entry = session.query(DataEntry).filter_by(table_id=table_id, hierarchical_structure=override_structure).first()
        if not override_entry:
            return {"error": f"Node to override with hierarchical structure {override_structure} not found in table {table_id}"}

        changes['update_node'] = {
            "person_id": current_entry.person_id,
            "upload_date": current_entry.upload_date,
            "hierarchical_structure": override_entry.hierarchical_structure,
            "name": current_entry.name,
            "role": override_entry.role,
            "department": override_entry.department,
            "birth_date": current_entry.birth_date,
            "rank": current_entry.rank,
            "organization_id": current_entry.organization_id,
            "information": current_entry.information
        }

    changes['null_node'] = {
        "name": "nan",
        "department": "nan",
        "birth_date": None,
        "rank": "nan",
        "organization_id": "nan",
        "person_id": "nan",
        "information": "nan"
    }

    return changes

@app.route("/org_structure_data/<int:table_id>", methods=["GET"])
def get_org_structure_data(table_id: int) -> jsonify:
    """
    Retrieves organization structure data for a specific table.

    Parameters:
        table_id (int): The ID of the table to retrieve data from.

    Returns:
        jsonify: A JSON response containing organization data, total members, table ID, and hierarchy information.
    """
    try:
        with session_scope() as session:
            entries = session.query(DataEntry).filter_by(table_id=table_id).all()
            data = [{
                'person_id': entry.person_id,
                'name': entry.name,
                'role': entry.role,
                'department': entry.department,
                'hierarchical_structure': entry.hierarchical_structure,
                'organization_name': entry.organization_name
            } for entry in entries]
            
            df = pd.DataFrame(data)
            
            member_counts = df.groupby('organization_name')['person_id'].nunique().reset_index()
            member_counts.columns = ['organization_name', 'member_count']
            
            dept_by_org = df.groupby('organization_name')['department'].unique().reset_index()
            dept_by_org['departments'] = dept_by_org['department'].apply(lambda x: [d for d in x if d and d != 'nan'])
            
            result = pd.merge(member_counts, dept_by_org[['organization_name', 'departments']], on='organization_name')
            
            result['level'] = None
            result['parent'] = None
            result['path'] = None
            
            path_to_org = {row['hierarchical_structure']: row['organization_name'] 
                            for _, row in df.iterrows() 
                            if not pd.isna(row['organization_name']) and row['organization_name'] != 'nan'}
            
            org_hierarchy_info = {}
            for _, row in df.iterrows():
                if pd.isna(row['organization_name']) or row['organization_name'] == 'nan':
                    continue
                
                current_path = row['hierarchical_structure']
                current_org = row['organization_name']
                
                if current_org in org_hierarchy_info:
                    continue
                
                if '/' in current_path[1:]:
                    parent_path = '/'.join(current_path.split('/')[:-1])
                    parent_org = path_to_org.get(parent_path)
                    level = len(current_path.strip('/').split('/'))
                    
                    org_hierarchy_info[current_org] = {
                        'level': level,
                        'parent': parent_org,
                        'path': current_path
                    }
                else:
                    org_hierarchy_info[current_org] = {
                        'level': 1,
                        'parent': None,
                        'path': current_path
                    }
            
            for i, row in result.iterrows():
                org_name = row['organization_name']
                if org_name in org_hierarchy_info:
                    result.at[i, 'level'] = org_hierarchy_info[org_name]['level']
                    result.at[i, 'parent'] = org_hierarchy_info[org_name]['parent']
                    result.at[i, 'path'] = org_hierarchy_info[org_name]['path']
                else:
                    result.at[i, 'level'] = 1
                    result.at[i, 'parent'] = None
                    result.at[i, 'path'] = f"/{org_name}"
            
            org_data = result.to_dict(orient='records')
            
            return jsonify({
                "organization_data": org_data,
                "total_members": df['person_id'].nunique(),
                "table_id": table_id,
                "hierarchy_info": org_hierarchy_info
            }), 200
    
    except Exception as e:
        logger.error(f"Error generating organization structure data: {str(e)}")
        return jsonify({"error": f"Failed to generate organization structure data: {str(e)}"}), 500


@app.route('/')
def backend_status():
    """Simple backend status endpoint"""
    return {
        "status": "running",
        "message": "be-net backend is running",
        "version": "1.0.0",
        "endpoints": {
            "status": "/",
            "health": "/health",
            "api": "/api/*"
        }
    }

@app.route('/health')
def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "timestamp": time.time()}

@app.route("/add_node/<int:table_id>", methods=["POST"])
def add_node(table_id: int) -> Any:
    """
    Add a new node to the organizational tree.

    Parameters:
        table_id (int): The ID of the table to add the node to.

    Returns:
        JSON response with the created node data.
    """
    try:
        data = request.json
        parent_structure = data.get('parent_structure')
        node_data = data.get('node_data')

        if not node_data:
            return jsonify({"error": "Node data is required"}), 400

        with session_scope() as session:
            # Verify table exists
            table = session.query(Table).filter_by(id=table_id).first()
            if not table:
                return jsonify({"error": f"Table with id {table_id} not found"}), 404

            # Generate hierarchical structure for the new node
            if parent_structure:
                new_hierarchy = generate_hierarchical_structure(session, table_id, parent_structure)
            else:
                # If no parent, this is a root node
                new_hierarchy = "/1"

            # Get person_id (provided or auto-generated)
            person_id = node_data.get("person_id", f"auto-{datetime.now().timestamp()}")
            inherited_from_person_id = None

            # Check if there's an existing node with this person_id in the same table
            existing_node = None
            if person_id and not person_id.startswith("auto-"):
                existing_node = session.query(DataEntry).filter(
                    DataEntry.table_id == table_id,
                    DataEntry.person_id == person_id
                ).first()

            # Create the new data entry
            entry = DataEntry(
                table_id=table_id,
                hierarchical_structure=new_hierarchy,
                name=node_data.get("name", ""),
                role=node_data.get("role", ""),
                department=node_data.get("department", ""),
                rank=node_data.get("rank", ""),
                person_id=person_id,
                birth_date=datetime.strptime(node_data["birth_date"], '%Y-%m-%d').date() if node_data.get("birth_date") else None,
                organization_id=node_data.get("organization_id", ""),
                organization_name=node_data.get("organization_name", ""),
                personal_information=node_data.get("personal_information", ""),
                role_information=node_data.get("role_information", ""),
                is_dead=node_data.get("is_dead", False),
                upload_date=datetime.now().date()
            )

            # If existing node found with same person_id, inherit personal info
            if existing_node:
                entry.name = existing_node.name
                entry.birth_date = existing_node.birth_date
                entry.personal_information = existing_node.personal_information
                entry.is_dead = existing_node.is_dead
                inherited_from_person_id = person_id
                logger.info(f"New node inheriting personal info from existing node with person_id: {person_id}")

            session.add(entry)
            session.commit()
            session.refresh(entry)

            logger.info(f"Node added successfully with structure: {new_hierarchy}")

            return jsonify({
                "message": "Node added successfully",
                "inherited_from_person_id": inherited_from_person_id,
                "node": {
                    "hierarchical_structure": entry.hierarchical_structure,
                    "name": entry.name,
                    "role": entry.role,
                    "department": entry.department,
                    "rank": entry.rank,
                    "person_id": entry.person_id,
                    "birth_date": entry.birth_date.isoformat() if entry.birth_date else None,
                    "organization_id": entry.organization_id,
                    "organization_name": entry.organization_name,
                    "personal_information": entry.personal_information,
                    "role_information": entry.role_information,
                    "is_dead": entry.is_dead
                }
            }), 200

    except Exception as e:
        logger.error(f"Error adding node: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route("/update_node/<int:table_id>", methods=["PUT"])
def update_node(table_id: int) -> Any:
    """
    Update an existing node in the organizational tree.

    Parameters:
        table_id (int): The ID of the table containing the node.

    Returns:
        JSON response with the updated node data.
    """
    try:
        data = request.json
        hierarchical_structure = data.get('hierarchical_structure')
        node_data = data.get('node_data')

        if not hierarchical_structure or not node_data:
            return jsonify({"error": "Hierarchical structure and node data are required"}), 400

        with session_scope() as session:
            # Find the node to update
            entry = session.query(DataEntry).filter_by(
                table_id=table_id,
                hierarchical_structure=hierarchical_structure
            ).first()

            if not entry:
                return jsonify({"error": f"Node with structure {hierarchical_structure} not found"}), 404

            # Update the fields
            entry.name = node_data.get("name", entry.name)
            entry.role = node_data.get("role", entry.role)
            entry.department = node_data.get("department", entry.department)
            entry.rank = node_data.get("rank", entry.rank)
            entry.person_id = node_data.get("person_id", entry.person_id)
            entry.organization_id = node_data.get("organization_id", entry.organization_id)
            entry.organization_name = node_data.get("organization_name", entry.organization_name)
            entry.personal_information = node_data.get("personal_information", entry.personal_information)
            entry.role_information = node_data.get("role_information", entry.role_information)
            entry.is_dead = node_data.get("is_dead", entry.is_dead)

            if node_data.get("birth_date"):
                entry.birth_date = datetime.strptime(node_data["birth_date"], '%Y-%m-%d').date()

            # Sync personal info fields to other nodes with the same person_id in the same table
            synced_nodes = []
            if entry.person_id:
                # Find other nodes with the same person_id in this table
                other_entries = session.query(DataEntry).filter(
                    DataEntry.table_id == table_id,
                    DataEntry.person_id == entry.person_id,
                    DataEntry.hierarchical_structure != hierarchical_structure
                ).all()

                # Sync personal info fields (not role-specific fields)
                for other_entry in other_entries:
                    other_entry.name = entry.name
                    other_entry.birth_date = entry.birth_date
                    other_entry.personal_information = entry.personal_information
                    other_entry.is_dead = entry.is_dead
                    synced_nodes.append(other_entry.hierarchical_structure)

                if synced_nodes:
                    logger.info(f"Synced personal info to {len(synced_nodes)} other node(s) with person_id: {entry.person_id}: {synced_nodes}")

            session.commit()
            session.refresh(entry)

            logger.info(f"Node updated successfully: {hierarchical_structure}")

            return jsonify({
                "message": "Node updated successfully",
                "synced_count": len(synced_nodes),
                "synced_person_id": entry.person_id if synced_nodes else None,
                "node": {
                    "hierarchical_structure": entry.hierarchical_structure,
                    "name": entry.name,
                    "role": entry.role,
                    "department": entry.department,
                    "rank": entry.rank,
                    "person_id": entry.person_id,
                    "birth_date": entry.birth_date.isoformat() if entry.birth_date else None,
                    "organization_id": entry.organization_id,
                    "organization_name": entry.organization_name,
                    "personal_information": entry.personal_information,
                    "role_information": entry.role_information,
                    "is_dead": entry.is_dead
                }
            }), 200

    except Exception as e:
        logger.error(f"Error updating node: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route("/delete_node/<int:table_id>", methods=["DELETE"])
def delete_node(table_id: int) -> Any:
    """
    Delete a node and all its descendants from the organizational tree.

    Parameters:
        table_id (int): The ID of the table containing the node.

    Returns:
        JSON response indicating success or failure.
    """
    try:
        hierarchical_structure = request.args.get('hierarchical_structure')

        if not hierarchical_structure:
            return jsonify({"error": "Hierarchical structure is required"}), 400

        with session_scope() as session:
            # Find the node and all its descendants
            # Descendants have hierarchical_structure that starts with the parent's structure
            entries_to_delete = session.query(DataEntry).filter(
                DataEntry.table_id == table_id,
                or_(
                    DataEntry.hierarchical_structure == hierarchical_structure,
                    DataEntry.hierarchical_structure.like(f"{hierarchical_structure}/%")
                )
            ).all()

            if not entries_to_delete:
                return jsonify({"error": f"Node with structure {hierarchical_structure} not found"}), 404

            deleted_count = len(entries_to_delete)

            for entry in entries_to_delete:
                session.delete(entry)

            session.commit()

            logger.info(f"Deleted {deleted_count} node(s) starting from: {hierarchical_structure}")

            return jsonify({
                "message": f"Successfully deleted {deleted_count} node(s)",
                "deleted_count": deleted_count
            }), 200

    except Exception as e:
        logger.error(f"Error deleting node: {str(e)}")
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    # Start the Flask server when running app.py directly
    app.run(host='0.0.0.0', port=5001, debug=True, threaded=True)
