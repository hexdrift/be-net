"""Compare saved records using employee IDs only."""

from collections import Counter


FIELDS = (
    'person_id', 'name', 'birth_date', 'personal_information', 'role',
    'department', 'rank', 'organization_id', 'organization_name',
    'role_information', 'is_dead',
)


def employee_id(entry):
    """Return a usable employee ID without inferring identity from a path."""
    value = str(entry.person_id).strip() if entry.person_id is not None else ''
    return value if value and value.lower() != 'nan' else None


def record(entry):
    """Serialize dedicated be-net fields for a comparison result."""
    values = {field: getattr(entry, field) for field in FIELDS}
    values['person_id'] = employee_id(entry)
    values['birth_date'] = entry.birth_date.isoformat() if entry.birth_date else None
    values['hierarchical_structure'] = entry.hierarchical_structure
    return values


def compare_records(before, after):
    """Exclude ambiguous identities on both sides and report exact changes."""
    counts = [Counter(employee_id(entry) for entry in entries) for entries in (before, after)]
    # An ID duplicated on either side cannot safely appear as an addition/removal.
    duplicates = {key for count in counts for key, total in count.items() if key and total > 1}
    excluded = []
    indexes = []
    for side, entries in zip(('before', 'after'), (before, after)):
        index = {}
        for entry in entries:
            identity = employee_id(entry)
            if identity is None or identity in duplicates:
                excluded.append({
                    'side': side, 'record': record(entry),
                    'reason': 'missing_employee_id' if identity is None else 'duplicate_employee_id',
                })
            else:
                index[identity] = entry
        indexes.append(index)
    previous, current = indexes
    changes = {
        'added': [], 'removed': [], 'changed': [], 'moved': [], 'excluded': excluded,
        'department_changes': {}, 'role_changes': {}, 'rank_changes': {},
        'reporting_line_changes': {},
        'compared_counts': {'before': len(previous), 'after': len(current)},
    }
    for identity in sorted(current.keys() - previous.keys()):
        changes['added'].append(record(current[identity]))
    for identity in sorted(previous.keys() - current.keys()):
        changes['removed'].append(record(previous[identity]))
    for identity in sorted(previous.keys() & current.keys()):
        old, new = record(previous[identity]), record(current[identity])
        fields = {field: [old[field], new[field]] for field in FIELDS if old[field] != new[field]}
        if fields:
            changes['changed'].append({'person_id': identity, 'name': new['name'], 'changes': fields})
        for field in ('department', 'role', 'rank'):
            if field in fields:
                changes[f'{field}_changes'][identity] = {
                    'name': new['name'], 'old': old[field], 'new': new[field],
                }
        if old['hierarchical_structure'] != new['hierarchical_structure']:
            move = {'name': new['name'], 'old': old['hierarchical_structure'], 'new': new['hierarchical_structure']}
            changes['moved'].append({'person_id': identity, **move})
            changes['reporting_line_changes'][identity] = move
    distributions = {}
    for field in ('department', 'role', 'rank', 'organization_name'):
        totals = [Counter(getattr(entry, field) or '' for entry in index.values()) for index in indexes]
        if any(label for total in totals for label in total):
            labels = sorted(totals[0].keys() | totals[1].keys(),
                            key=lambda label: (-max(totals[0][label], totals[1][label]), label))
            distributions[field] = [{'label': label, 'before': totals[0][label], 'after': totals[1][label]}
                                    for label in labels]
    changes['distributions'] = distributions
    changes['unchanged_count'] = len(previous.keys() & current.keys() - {
        entry['person_id'] for category in ('changed', 'moved') for entry in changes[category]
    })
    return changes
