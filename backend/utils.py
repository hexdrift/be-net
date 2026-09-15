import pandas as pd
try:
    from backend.models import Table, DataEntry, get_session
except ModuleNotFoundError:
    from models import Table, DataEntry, get_session
import io
import logging
from datetime import datetime
from sqlalchemy import func

logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

def parse_org_data(df):
    df = df.sort_values('hierarchical_structure', na_position='last')
    nodes = {}
    roots = []
    log = {
        "metadata": {
            "total_rows_processed": len(df),
            "timestamp": datetime.now().isoformat(),
            "data_source": "organization_chart_parser"
        },
        "errors": {
            "invalid_structure": [],
            "missing_structure": [],
            "invalid_date": [],
            "disconnected_nodes": [],
            "excluded_nodes": [],
            "disconnected_and_excluded": [],
            "missing_root": [],
            "duplicated_nodes": []
        },
        "info": {
            "root_selection": None,
            "multiple_roots": []
        },
        "summary": {
            "total_errors": 0,
            "error_types": [],
            "total_nodes_created": 0,
            "total_roots_found": 0,
            "max_tree_depth": 0
        },
        "error_descriptions": {
            "invalid_structure": "Hierarchical structure format is invalid (must start with '/')",
            "missing_structure": "Hierarchical structure field is missing or empty",
            "invalid_date": "Birth date or upload date is in an invalid format",
            "disconnected_nodes": "Node's parent does not exist in the tree",
            "excluded_nodes": "Node belongs to a different root tree and was excluded",
            "disconnected_and_excluded": "Node is both disconnected from its parent and excluded from the main tree",
            "missing_root": "No root node (level 1) was found in the data",
            "duplicated_nodes": "Multiple nodes share the same hierarchical structure path"
        }
    }
    disconnected_nodes = {}
    excluded_nodes = set()

    def add_error(error_type, message):
        log["errors"][error_type].append(message)
        log["summary"]["total_errors"] += 1
        if error_type not in log["summary"]["error_types"]:
            log["summary"]["error_types"].append(error_type)

    def add_info(info_type, message):
        if info_type == "root_selection":
            log["info"]["root_selection"] = message
        elif info_type == "multiple_roots":
            log["info"]["multiple_roots"].append(message)

    def is_rtl(text):
        return any('\u0590' <= c <= '\u05FF' or '\u0600' <= c <= '\u06FF' for c in text)

    def split_structure(structure):
        if '\\' in structure:
            return [part for part in structure.split('\\') if part]
        elif '/' in structure:
            return [part for part in structure.split('/') if part]
        else:
            return [part for part in structure.split('/') if part]

    def count_descendants(node):
        return len(node['children']) + sum(count_descendants(child) for child in node['children'])

    def spreadsheet_row_number(index):
        return int(index) + 2

    def process_node(row):
        structure = row['hierarchical_structure']
        name = row.get('name', '')
        if not structure:
            add_error('missing_structure', {
                "name": name,
                "row": spreadsheet_row_number(row.name),
                "structure": None,
                "message": "Missing hierarchical structure"
            })
            return None

        if structure in nodes:
            add_error('duplicated_nodes', {
                "row": spreadsheet_row_number(row.name),
                "structure": structure,
                "existing_node": {
                    "name": nodes[structure]['name'],
                    "row": nodes[structure]['row']
                },
                "duplicate_node": {
                    "name": name,
                    "row": spreadsheet_row_number(row.name)
                },
                "message": f"Duplicate hierarchical structure: '{structure}'. This node duplicates the existing node '{nodes[structure]['name']}' at row {nodes[structure]['row']}."
            })
            return nodes[structure]

        new_node = {
            "name": name,
            "role": row.get('role', ''),
            "person_id": row.get('person_id', None),
            "department": row.get('department', ''),
            "birth_date": row.get('birth_date', None),
            "rank": row.get('rank', ''),
            "organization_id": row.get('organization_id', ''),
            "personal_information": row.get('personal_information', ''),
            "role_information": row.get('role_information', ''),
            "is_dead": row.get('is_dead', 'unknown'),
            "upload_date": datetime.now().date().isoformat(),
            "children": [],
            "row": spreadsheet_row_number(row.name),
            "hierarchical_structure": row.hierarchical_structure,
            "organization_name": row.get('organization_name', '')
        }

        birth_date_value = new_node['birth_date']
        if pd.notna(birth_date_value) and str(birth_date_value).strip():
            birth_date = pd.to_datetime(birth_date_value, errors='coerce')
            if pd.notna(birth_date):
                upload_date = pd.to_datetime(new_node['upload_date']).date()
                birth_date = birth_date.date()
                new_node['age'] = (upload_date - birth_date).days // 365
            else:
                add_error('invalid_date', {
                    "name": name,
                    "row": spreadsheet_row_number(row.name),
                    "structure": structure,
                    "message": f"Invalid birth date: {birth_date_value}"
                })
                new_node['age'] = None

        nodes[structure] = new_node

        parts = split_structure(structure)
        if len(parts) == 1:
            roots.append(structure)
        else:
            parent_structure = '/' + '/'.join(parts[:-1])
            if parent_structure in nodes:
                nodes[parent_structure]['children'].append(new_node)
            else:
                disconnected_nodes[structure] = parent_structure

        return new_node

    # Process all nodes
    for _, row in df.iterrows():
        structure = row['hierarchical_structure']
        name = row.get('name', '')
        if pd.isna(structure) or not str(structure).strip():
            add_error('missing_structure', {
                "name": name,
                "row": spreadsheet_row_number(_),
                "structure": None,
                "message": "Missing hierarchical structure"
            })
            continue
        if not isinstance(structure, str) or not structure.startswith('/'):
            add_error('invalid_structure', {
                "name": name,
                "row": spreadsheet_row_number(_),
                "structure": str(structure),
                "message": "Structure must start with a slash"
            })
            continue
        process_node(row)

    # Select main root based on the number of descendants
    if roots:
        root_info = [(root, count_descendants(nodes[root])) for root in roots]
        main_root, main_descendants = max(root_info, key=lambda x: x[1])
        excluded_roots = [root for root in roots if root != main_root]
        
        add_info('root_selection', {"main_root": main_root, "descendants": main_descendants})
        if len(roots) > 1:
            excluded_root_info = [{"root": root, "descendants": count_descendants(nodes[root])} for root in excluded_roots]
            add_info('multiple_roots', excluded_root_info)

        # Identify excluded nodes
        for structure in nodes.keys():
            if structure != main_root and not structure.startswith(f"{main_root}/"):
                excluded_nodes.add(structure)
    else:
        add_error('missing_root', {"message": "No root nodes found"})
        main_root = None

    # Categorize nodes
    only_disconnected = set(disconnected_nodes.keys()) - excluded_nodes
    only_excluded = excluded_nodes - set(disconnected_nodes.keys())
    disconnected_and_excluded = set(disconnected_nodes.keys()).intersection(excluded_nodes)

    # Report on categorized nodes
    if only_disconnected:
        for node in sorted(only_disconnected):
            add_error('disconnected_nodes', {
                "name": nodes[node]['name'],
                "row": nodes[node]['row'],
                "node": node,
                "expected_parent": disconnected_nodes[node]
            })

    if only_excluded:
        for node in sorted(only_excluded):
            add_error('excluded_nodes', {
                "name": nodes[node]['name'],
                "row": nodes[node]['row'],
                "node": node,
                "main_root": main_root
            })

    if disconnected_and_excluded:
        for node in sorted(disconnected_and_excluded):
            add_error('disconnected_and_excluded', {
                "name": nodes[node]['name'],
                "row": nodes[node]['row'],
                "node": node,
                "expected_parent": disconnected_nodes[node]
            })

    # Prepare the result
    result = nodes[main_root] if main_root else None

    # Calculate tree statistics
    def calculate_max_depth(node, current_depth=1):
        if not node or 'children' not in node:
            return current_depth
        if not node['children']:
            return current_depth
        return max(calculate_max_depth(child, current_depth + 1) for child in node['children'])

    def collect_tree_rows(node):
        if not node:
            return set()
        rows = {node['row']}
        for child in node.get('children', []):
            rows.update(collect_tree_rows(child))
        return rows

    imported_rows = collect_tree_rows(result)
    total_rows = log["metadata"]["total_rows_processed"]

    # Update summary statistics
    log["summary"]["total_nodes_created"] = len(imported_rows)
    log["summary"]["total_roots_found"] = len(roots)
    log["summary"]["total_rows_imported"] = len(imported_rows)
    log["summary"]["total_rows_skipped"] = total_rows - len(imported_rows)
    if result:
        log["summary"]["max_tree_depth"] = calculate_max_depth(result)

    # Remove empty error categories
    log["errors"] = {k: v for k, v in log["errors"].items() if v}

    rejection_types = [
        "missing_structure",
        "invalid_structure",
        "duplicated_nodes",
        "disconnected_nodes",
        "excluded_nodes",
        "disconnected_and_excluded",
    ]
    rejected_rows = []
    rejected_row_numbers = set()
    for error_type in rejection_types:
        for error in log["errors"].get(error_type, []):
            row_number = error.get("row")
            if row_number is None or row_number in imported_rows or row_number in rejected_row_numbers:
                continue
            rejected_row_numbers.add(row_number)
            rejected_rows.append({
                "row": row_number,
                "error_type": error_type,
                "hierarchical_structure": error.get("structure", error.get("node")),
                "message": error.get("message", log["error_descriptions"][error_type]),
            })
    log["rejected_rows"] = sorted(rejected_rows, key=lambda item: item["row"])

    # Add quick stats for better visibility
    if log["summary"]["total_errors"] > 0:
        success_rate = (len(imported_rows) / total_rows * 100) if total_rows else 0
        log["quick_stats"] = {
            "success_rate": f"{success_rate:.2f}%",
            "nodes_with_errors": log["summary"]["total_errors"],
            "nodes_successfully_processed": len(imported_rows),
            "rows_skipped": log["summary"]["total_rows_skipped"],
        }

    # Return the parsing log only if there were errors
    if log["summary"]["total_errors"] > 0:
        return result, log
    else:
        return result, None

def compare_structure_column(previous_df, new_df):
    def get_structure_set(df):
        structure_set = set(df["hierarchical_structure"].tolist())
        return structure_set

    set1 = get_structure_set(previous_df)
    set2 = get_structure_set(new_df)
    
    shared_structures = set1.intersection(set2)
    total_structures = set1.union(set2)
    
    if not total_structures:
        return 0
    
    similarity_percentage = (len(shared_structures) / len(total_structures)) * 100
    logger.info(f"Found similarity percentage: {similarity_percentage}")
    return similarity_percentage
def is_valid_continuation(previous_df, new_df):
    similarity = compare_structure_column(previous_df=previous_df, new_df=new_df)
    return similarity >= 50

def process_excel_data(file_content, file_extension):
    if file_extension == 'csv':
        df = pd.read_csv(io.BytesIO(file_content), dtype=str, keep_default_na=False)
    else:  # xlsx
        df = pd.read_excel(io.BytesIO(file_content), dtype=str, keep_default_na=False)
    df.columns = df.columns.map(str)
    return df


def parse_optional_date(value):
    parsed_date = pd.to_datetime(value, errors='coerce')
    return parsed_date.date() if pd.notna(parsed_date) else None


def normalize_optional_text(value):
    if pd.isna(value):
        return None

    normalized_value = str(value).strip()
    return normalized_value or None


def insert_data_entries(session, table_id, df):
    if table_id is None:
        raise ValueError("table_id cannot be None")

    upload_date = datetime.now().date()

    # Convert all column names to lowercase for case-insensitive matching
    df.columns = df.columns.str.lower()

    # Ensure required columns are present (case-insensitive)
    required_columns = ['hierarchical_structure']
    missing_columns = [col for col in required_columns if col not in df.columns]
    if missing_columns:
        raise ValueError(f"Required column(s) {', '.join(missing_columns)} are missing from the DataFrame")

    df = df.reset_index(drop=True).copy()

    # Normalize values before structural validation so type mismatches can be logged per row.
    for col in df.columns:
        if col != 'birth_date':
            df[col] = df[col].map(normalize_optional_text)

    parsed_tree, parsing_log = parse_org_data(df)

    def collect_import_indices(node):
        if not node:
            return set()
        indices = {node['row'] - 2}
        for child in node.get('children', []):
            indices.update(collect_import_indices(child))
        return indices

    import_indices = collect_import_indices(parsed_tree)
    df = df[df.index.isin(import_indices)].copy()

    if 'birth_date' in df.columns:
        df['birth_date'] = df['birth_date'].map(parse_optional_date)
    else:
        df['birth_date'] = None

    # Define a mapping of expected column names to DataEntry attribute names
    column_mapping = {
        'person_id': 'person_id',
        'name': 'name',
        'role': 'role',
        'hierarchical_structure': 'hierarchical_structure',
        'department': 'department',
        'birth_date': 'birth_date',
        'rank': 'rank',
        'organization_id': 'organization_id',
        'personal_information': 'personal_information',
        'role_information': 'role_information',
        'is_dead': 'is_dead',
        'organization_name': 'organization_name'
    }

    # Track first occurrence of each person_id for syncing personal info
    person_id_first_occurrence = {}  # {person_id: {name, birth_date, personal_information, is_dead}}

    for _, row in df.iterrows():
        # Prepare a dictionary with all fields
        data_entry_dict = {
            'table_id': table_id,
            'upload_date': upload_date
        }

        # Populate the dictionary using the column mapping
        for df_col, entry_attr in column_mapping.items():
            if df_col in df.columns:
                value = row[df_col]
                data_entry_dict[entry_attr] = value if pd.notna(value) else None

        # Sync personal info for duplicate person_ids (first occurrence is source of truth)
        person_id = data_entry_dict.get('person_id')
        if person_id:
            if person_id not in person_id_first_occurrence:
                # Store first occurrence's personal info
                person_id_first_occurrence[person_id] = {
                    'name': data_entry_dict.get('name'),
                    'birth_date': data_entry_dict.get('birth_date'),
                    'personal_information': data_entry_dict.get('personal_information'),
                    'is_dead': data_entry_dict.get('is_dead')
                }
            else:
                # Sync to first occurrence's personal info
                first = person_id_first_occurrence[person_id]
                data_entry_dict['name'] = first['name']
                data_entry_dict['birth_date'] = first['birth_date']
                data_entry_dict['personal_information'] = first['personal_information']
                data_entry_dict['is_dead'] = first['is_dead']
                logger.info(f"Synced personal info for duplicate person_id: {person_id}")

        # Create the DataEntry object with the prepared dictionary
        data_entry = DataEntry(**data_entry_dict)
        session.add(data_entry)

    total_rows = parsing_log["metadata"]["total_rows_processed"] if parsing_log else len(df)
    return {
        "inserted_count": len(df),
        "skipped_count": total_rows - len(df),
        "log": parsing_log,
    }

def get_org_chart(table_id):
    session = get_session()
    try:
        data_entries = session.query(DataEntry).filter_by(table_id=table_id).all()

        # Handle empty table (no data entries yet)
        if not data_entries:
            logger.info(f"Empty tree for table ID {table_id}, returning empty structure")
            empty_tree = {
                "id": "root",
                "children": []
            }
            return empty_tree, None

        df = pd.DataFrame([entry.__dict__ for entry in data_entries])
        df = df.drop('_sa_instance_state', axis=1, errors='ignore')

        org_chart, log = parse_org_data(df)
        if log:
            logger.info(f"Org chart generated for table ID {table_id} with logs: {log}")
        else:
            logger.info(f"Org chart generated successfully for table ID {table_id}")
        return org_chart, log
    finally:
        session.close()

def get_department_structure(table_id, department):
    session = get_session()
    try:
        entries = session.query(DataEntry).filter_by(table_id=table_id, department=department).all()
        df = pd.DataFrame([entry.__dict__ for entry in entries])
        df = df.drop('_sa_instance_state', axis=1, errors='ignore')
        
        return parse_org_data(df)
    finally:
        session.close()

def get_age_distribution(table_id):
    session = get_session()
    try:
        entries = session.query(DataEntry).filter_by(table_id=table_id).all()
        ages = [entry.age for entry in entries if entry.age is not None]
        return {
            'average': sum(ages) / len(ages) if ages else None,
            'min': min(ages) if ages else None,
            'max': max(ages) if ages else None,
            'distribution': pd.Series(ages).value_counts().sort_index().to_dict()
        }
    finally:
        session.close()
        
def export_excel_data(session, table_id):
    data_entries = session.query(DataEntry).filter_by(table_id=table_id).all()
    
    df = pd.DataFrame([
        {
            "Person ID": entry.person_id,
            "Name": entry.name,
            "Role": entry.role,
            "Department": entry.department,
            "Birth Date": entry.birth_date,
            "Rank": entry.rank,
            "Organization ID": entry.organization_id,
            "Hierarchical Structure": entry.hierarchical_structure,
            "Personal Information": entry.personal_information,
            "Role Information": entry.role_information,
            "is_dead": entry.is_dead,
            "Organization Name": entry.organization_name
        }
        for entry in data_entries
    ])
    
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        df.to_excel(writer, sheet_name='Org Data', index=False)
    
    output.seek(0)
    return output

def generate_hierarchical_structure(session, table_id, parent_structure):
    """
    Generate a new hierarchical structure based on the parent's structure and its existing children.
    Handles both numerical and non-numerical hierarchies.

    Args:
    session (Session): The database session.
    table_id (int): The ID of the table containing the hierarchical data.
    parent_structure (str): The hierarchical structure of the parent node.

    Returns:
    str: The new hierarchical structure.

    Raises:
    ValueError: If the parent_structure is invalid.
    """
    if not parent_structure:
        raise ValueError("Parent structure cannot be empty")

    # Find all direct children of the parent
    children = session.query(DataEntry).filter(
        DataEntry.table_id == table_id,
        DataEntry.hierarchical_structure.like(f"{parent_structure}/%"),
        ~DataEntry.hierarchical_structure.like(f"{parent_structure}/%/%")  # Exclude grandchildren
    ).all()

    if not children:
        # If no children, add first child
        return f"{parent_structure}/1"

    # Extract the last part from each child's structure
    child_suffixes = [child.hierarchical_structure.split('/')[-1] for child in children]

    # Check if all suffixes are numeric
    if all(suffix.isdigit() for suffix in child_suffixes):
        # If all numeric, increment the highest number
        next_number = max(int(suffix) for suffix in child_suffixes) + 1
        return f"{parent_structure}/{next_number}"
    else:
        # If non-numeric suffixes exist, use alphabetical ordering
        alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
        existing_letters = [suffix for suffix in child_suffixes if suffix in alphabet]
        
        if existing_letters:
            # Find the next available letter
            last_letter = max(existing_letters)
            if last_letter != 'Z':
                next_letter = alphabet[alphabet.index(last_letter) + 1]
                return f"{parent_structure}/{next_letter}"
            else:
                # If we've reached 'Z', start with 'AA', 'AB', etc.
                double_letters = [suffix for suffix in child_suffixes if len(suffix) == 2 and suffix.isalpha()]
                if double_letters:
                    last_double = max(double_letters)
                    if last_double != 'ZZ':
                        next_double = last_double[0] + alphabet[alphabet.index(last_double[1]) + 1]
                        return f"{parent_structure}/{next_double}"
                    else:
                        return f"{parent_structure}/AAA"  # Start triple letters if 'ZZ' is reached
                else:
                    return f"{parent_structure}/AA"  # Start double letters if 'Z' is reached
        else:
            # If no alphabetical suffixes exist, start with 'A'
            return f"{parent_structure}/A"
