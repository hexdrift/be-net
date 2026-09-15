"""Exercise employee matching, exclusions, and complete field differences."""

import unittest
from datetime import date

from backend.comparison import compare_records
from backend.app import generate_aggregated_report
from backend.models import DataEntry


class ComparisonTests(unittest.TestCase):
    """Check differences without conflating ambiguous or missing identities."""

    def test_reports_all_categories_and_only_changed_fields(self):
        before = [
            DataEntry(person_id='001', name='Old', organization_id='D1', birth_date=date(1990, 1, 1), hierarchical_structure='/a/b'),
            DataEntry(person_id='002', hierarchical_structure='/a/c'),
        ]
        after = [
            DataEntry(person_id='001', name='New', organization_id='D2', birth_date=date(1991, 1, 1), hierarchical_structure='/a/d/b'),
            DataEntry(person_id='003', hierarchical_structure='/a/e'),
        ]
        changes = compare_records(before, after)
        self.assertEqual([item['person_id'] for item in changes['added']], ['003'])
        self.assertEqual([item['person_id'] for item in changes['removed']], ['002'])
        self.assertEqual(changes['changed'][0]['changes'], {
            'name': ['Old', 'New'], 'organization_id': ['D1', 'D2'],
            'birth_date': ['1990-01-01', '1991-01-01'],
        })
        self.assertEqual(changes['moved'][0]['person_id'], '001')

    def test_duplicate_on_one_side_excludes_identity_on_both_sides(self):
        before = [DataEntry(person_id='7'), DataEntry(person_id='7'), DataEntry(person_id=None)]
        after = [DataEntry(person_id='7'), DataEntry(person_id='8')]
        changes = compare_records(before, after)
        self.assertEqual([entry['person_id'] for entry in changes['added']], ['8'])
        self.assertEqual(changes['removed'], [])
        self.assertEqual(len(changes['excluded']), 4)
        self.assertEqual(changes['compared_counts'], {'before': 0, 'after': 1})

    def test_charts_use_only_unique_ids_and_keep_blank_categories(self):
        changes = compare_records(
            [DataEntry(person_id='1', role='Engineer'), DataEntry(person_id='2', role=None),
             DataEntry(person_id='9', role='Excluded')],
            [DataEntry(person_id='1', role='Lead'), DataEntry(person_id='2', role=None),
             DataEntry(person_id='9', role='Excluded'), DataEntry(person_id='9', role='Excluded')],
        )
        rows = {row['label']: row for row in changes['distributions']['role']}
        self.assertNotIn('Excluded', rows)
        self.assertEqual(rows[''], {'label': '', 'before': 1, 'after': 1})
        self.assertEqual(sum(row['before'] for row in rows.values()), 2)
        self.assertEqual(sum(row['after'] for row in rows.values()), 2)
        self.assertEqual(changes['unchanged_count'], 1)

    def test_aggregate_endpoint_also_excludes_ambiguous_records(self):
        entries = [DataEntry(person_id='1', hierarchical_structure='/root'),
                   DataEntry(person_id='2', hierarchical_structure='/root/a'),
                   DataEntry(person_id='2', hierarchical_structure='/root/b')]
        report = generate_aggregated_report(compare_records(entries, entries), entries, entries)
        self.assertEqual(report['total_employees'], {'before': 1, 'after': 1, 'difference': 0})

    def test_reordering_does_not_change_results(self):
        entries = [DataEntry(person_id='1', hierarchical_structure='/root'), DataEntry(person_id='2', hierarchical_structure='/root/child')]
        changes = compare_records(entries, list(reversed(entries)))
        for category in ('added', 'removed', 'changed', 'moved', 'excluded'):
            self.assertEqual(changes[category], [])

    def test_move_without_field_changes_is_separate(self):
        changes = compare_records(
            [DataEntry(person_id='1', hierarchical_structure='/a/b')],
            [DataEntry(person_id='1', hierarchical_structure='/a/c/b')],
        )
        self.assertEqual(changes['changed'], [])
        self.assertEqual(len(changes['moved']), 1)


if __name__ == '__main__':
    unittest.main()
