"""Translate declared source-column roles into be-net's stored hierarchy."""

import pandas as pd

try:
    from backend.comparison import FIELDS
    from backend.utils import insert_data_entries, normalize_optional_text
except ModuleNotFoundError:
    from comparison import FIELDS
    from utils import insert_data_entries, normalize_optional_text


ROLE_FIELDS = (*FIELDS, 'hierarchical_structure')


class RoleError(ValueError):
    """Carry a translatable validation message and its source context."""

    def __init__(self, code, message, **params):
        super().__init__(message)
        self.code = code
        self.params = params


def suggested_roles(columns):
    """Recognize existing dedicated field names without guessing relationships."""
    return {
        'fields': {field: column for column in columns for field in FIELDS if column.lower() == field},
        'hierarchy': {'mode': 'path', 'column': next((c for c in columns if c.lower() == 'hierarchical_structure'), '')},
    }


def segment(value):
    """Escape separators so source identifiers remain distinct path components."""
    return value.replace('%', '%25').replace('/', '%2F').replace('\\', '%5C').replace(':', '%3A')


def apply_roles(source, config):
    """Validate explicit roles and derive paths without storing custom columns."""
    if not isinstance(config, dict):
        raise RoleError('choose_roles', 'Choose column roles before importing.')
    fields = config.get('fields', {})
    hierarchy = config.get('hierarchy', {})
    if not isinstance(fields, dict) or not isinstance(hierarchy, dict):
        raise RoleError('invalid_roles', 'Invalid column roles.')
    if set(fields) - set(ROLE_FIELDS):
        raise RoleError('dedicated_only', 'Only dedicated be-net fields can be mapped.')
    selected = [column for column in fields.values() if column]
    if len(selected) != len(set(selected)):
        raise RoleError('duplicate_field', 'A source column cannot represent two be-net fields.')
    mode = hierarchy.get('mode')
    if mode == 'path':
        required = [hierarchy.get('column')]
    elif mode == 'parent':
        required = [hierarchy.get('id_column'), hierarchy.get('parent_column')]
        if required[0] == required[1]:
            raise RoleError('same_columns', 'Choose different ID and parent ID columns.')
    elif mode == 'levels':
        required = hierarchy.get('columns', [])
        if not isinstance(required, list) or not required or len(set(required)) != len(required):
            raise RoleError('distinct_levels', 'Choose distinct hierarchy levels in order.')
    else:
        raise RoleError('choose_format', 'Choose a hierarchy format.')
    if any(not isinstance(c, str) or c not in source.columns for c in selected + required):
        raise RoleError('missing_column', 'Select an existing source column for each required role.')
    used = list(dict.fromkeys(selected + required))
    saved_source = source[used].apply(lambda column: column.map(normalize_optional_text))
    frame = pd.DataFrame({field: saved_source[column] for field, column in fields.items() if column}, index=source.index)
    generated = []
    if mode == 'path':
        frame['hierarchical_structure'] = saved_source[required[0]]
    elif mode == 'parent':
        ids = saved_source[required[0]].tolist()
        parents = saved_source[required[1]].tolist()
        if any(value is None for value in ids):
            raise RoleError('missing_node_id', 'Every row needs a hierarchy ID.')
        if len(set(ids)) != len(ids):
            raise RoleError('duplicate_node_id', 'Hierarchy IDs must be unique. Employee IDs and hierarchy IDs can use different columns.')
        parent_by_id = dict(zip(ids, parents))
        roots = [identity for identity, parent in parent_by_id.items() if parent is None]
        if len(roots) != 1:
            raise RoleError('single_root', 'The hierarchy must have exactly one root with an empty parent ID.')
        paths = {}
        for identity in ids:
            chain, visiting = [], set()
            cursor = identity
            while cursor is not None and cursor not in paths:
                if cursor in visiting:
                    raise RoleError('cycle', f'Hierarchy cycle involving ID {cursor}.', id=cursor)
                if cursor not in parent_by_id:
                    raise RoleError('missing_parent', f'Parent ID {cursor} does not exist in the selected ID column.', id=cursor)
                visiting.add(cursor)
                chain.append(cursor)
                cursor = parent_by_id[cursor]
            path = paths.get(cursor, '')
            for item in reversed(chain):
                path += '/' + segment(item)
                paths[item] = path
        frame['hierarchical_structure'] = [paths[identity] for identity in ids]
    else:
        paths, ancestors, roots = [], {}, set()
        for index, row in saved_source.iterrows():
            values = [row[column] for column in required]
            populated = [value for value in values if value is not None]
            if not populated or values[:len(populated)] != populated:
                raise RoleError('level_gap', f'Row {index + 2}: hierarchy levels must start at the root with no gaps.', row=index + 2)
            roots.add(populated[0])
            path = ''
            for value in populated:
                path += '/' + segment(value)
                ancestors[path] = value
            # Employee rows attach to the deepest selected organizational level.
            identity = frame.at[index, 'person_id'] if 'person_id' in frame else None
            if 'person_id' in frame:
                path += '/employee:' + segment(identity) if identity else f'/vacancy:{index + 2}'
            paths.append(path)
        if len(roots) != 1:
            raise RoleError('shared_root', 'All rows must share the same top-level parent.')
        if len(set(paths)) != len(paths):
            raise RoleError('duplicate_position', 'Multiple rows describe the same hierarchy position. Map employee IDs to distinguish employees in the same unit.')
        frame['hierarchical_structure'] = paths
        actual_paths = set(paths)
        generated = [{'hierarchical_structure': path, 'organization_name': label, 'name': label}
                     for path, label in ancestors.items() if path not in actual_paths]
        frame = pd.concat([frame, pd.DataFrame(generated)], ignore_index=True)
    return frame, {
        'columns': used,
        'rows': saved_source.where(pd.notna(saved_source), None).to_dict(orient='records'),
        'generated_count': len(generated),
    }


class PreviewSession:
    """Collect normalized entries without writing a database."""

    def __init__(self):
        self.entries = []

    def add(self, entry):
        self.entries.append(entry)


def preview_roles(source, config):
    """Run the same normalization and validation used by the real import."""
    frame, saved = apply_roles(source, config)
    session = PreviewSession()
    result = insert_data_entries(session, 1, frame)
    # Ancestors precede descendants so a bounded preview remains a connected tree.
    ordered = sorted(session.entries, key=lambda entry: (entry.hierarchical_structure.count('/'), entry.hierarchical_structure))
    return {
        'preview_total': len(ordered),
        'source_count': len(source),
        'generated_count': saved['generated_count'],
        'inserted_count': result['inserted_count'],
        'skipped_count': result['skipped_count'],
        'log': result['log'],
        'rows': [{'name': entry.name, 'person_id': entry.person_id, 'hierarchical_structure': entry.hierarchical_structure}
                 for entry in ordered[:80]],
    }
