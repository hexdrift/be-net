"""Verify hierarchy declarations and durable, restricted source storage."""

from contextlib import closing
import io
import json
import os
import sqlite3
import tempfile
import unittest

import pandas as pd

from backend.app import app
from backend.column_roles import apply_roles, preview_roles
from backend.models import dispose_db


class ColumnRoleTests(unittest.TestCase):
    """Validate both relationship formats with real source values."""

    def test_parent_order_and_source_ids_are_preserved(self):
        source = pd.DataFrame({'ID': ['002', '001'], 'Parent': ['001', ''], 'Full name': ['Child', 'Root'], 'Private': ['secret', 'secret']})
        config = {'fields': {'person_id': 'ID', 'name': 'Full name'}, 'hierarchy': {'mode': 'parent', 'id_column': 'ID', 'parent_column': 'Parent'}}
        frame, saved = apply_roles(source, config)
        self.assertEqual(frame.hierarchical_structure.tolist(), ['/001/002', '/001'])
        self.assertNotIn('Private', saved['columns'])
        self.assertNotIn('secret', json.dumps(saved))
        self.assertEqual(preview_roles(source, config)['inserted_count'], 2)

    def test_parent_cycles_missing_parents_and_duplicate_ids_are_rejected(self):
        config = {'fields': {}, 'hierarchy': {'mode': 'parent', 'id_column': 'id', 'parent_column': 'parent'}}
        for ids, parents, message in [
            (['r','a','b'], ['','b','a'], 'cycle'),
            (['r','a'], ['','missing'], 'does not exist'),
            (['r','a','a'], ['','r','r'], 'unique'),
            (['r','a'], ['',''], 'exactly one root'),
        ]:
            with self.subTest(message=message), self.assertRaisesRegex(ValueError, message):
                apply_roles(pd.DataFrame({'id': ids, 'parent': parents}), config)

    def test_levels_generate_shared_units_and_distinct_employee_leaves(self):
        source = pd.DataFrame({'Company': ['Acme','Acme'], 'Team': ['Research','Research'], 'Employee': ['001','002']})
        config = {'fields': {'person_id': 'Employee'}, 'hierarchy': {'mode': 'levels', 'columns': ['Company','Team']}}
        frame, saved = apply_roles(source, config)
        self.assertEqual(saved['generated_count'], 2)
        self.assertEqual(set(frame.hierarchical_structure), {'/Acme', '/Acme/Research', '/Acme/Research/employee:001', '/Acme/Research/employee:002'})
        self.assertEqual(preview_roles(source, config)['inserted_count'], 4)

    def test_hebrew_levels_keep_source_text_and_blank_employee_ids_as_vacancies(self):
        source = pd.DataFrame({'יחידה':['מטה','מטה'], 'צוות':['מחקר','מחקר'], 'עובד':['001','']})
        config = {'fields': {'person_id':'עובד'}, 'hierarchy': {'mode':'levels','columns':['יחידה','צוות']}}
        frame, _ = apply_roles(source, config)
        self.assertIn('/מטה/מחקר/employee:001', set(frame.hierarchical_structure))
        self.assertIn('/מטה/מחקר/vacancy:3', set(frame.hierarchical_structure))
        self.assertEqual(preview_roles(source, config)['inserted_count'], 4)

    def test_levels_without_employees_import_unit_rows(self):
        source = pd.DataFrame({'L1': ['Root','Root'], 'L2': ['A','B']})
        frame, _ = apply_roles(source, {'fields': {}, 'hierarchy': {'mode': 'levels', 'columns': ['L1','L2']}})
        self.assertEqual(set(frame.hierarchical_structure), {'/Root', '/Root/A', '/Root/B'})

    def test_level_gaps_and_multiple_roots_are_rejected(self):
        config = {'fields': {}, 'hierarchy': {'mode': 'levels', 'columns': ['a','b','c']}}
        with self.assertRaisesRegex(ValueError, 'no gaps'):
            apply_roles(pd.DataFrame({'a':['Root'], 'b':[''], 'c':['Team']}), config)
        with self.assertRaisesRegex(ValueError, 'same top-level'):
            apply_roles(pd.DataFrame({'a':['Root','Other'], 'b':['A','B'], 'c':['','']}), config)

    def test_slashes_in_identifiers_do_not_create_extra_levels(self):
        source = pd.DataFrame({'id':['a/b','a%2Fb'], 'parent':['','a/b']})
        frame, _ = apply_roles(source, {'fields': {}, 'hierarchy': {'mode': 'parent','id_column':'id','parent_column':'parent'}})
        self.assertEqual(frame.hierarchical_structure.tolist(), ['/a%2Fb','/a%2Fb/a%252Fb'])

    def test_unknown_fields_and_missing_columns_are_rejected(self):
        frame = pd.DataFrame({'path':['/Root']})
        for config in [
            {'fields': {'custom':'path'}, 'hierarchy': {'mode':'path','column':'path'}},
            {'fields': {}, 'hierarchy': {'mode':'path','column':'absent'}},
        ]:
            with self.assertRaises(ValueError):
                apply_roles(frame, config)


class StoredRoleTests(unittest.TestCase):
    """Exercise preview, import, reopening, and comparison through HTTP routes."""

    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.path = os.path.join(self.temp.name, 'roles.db')
        self.client = app.test_client()
        response = self.client.post('/create_new_db', json={'db_path': self.temp.name, 'db_name': 'roles.db'})
        self.assertEqual(response.status_code, 200, response.get_json())
        self.config = {'fields': {'person_id':'Employee', 'name':'Name'}, 'hierarchy': {'mode':'parent','id_column':'Employee','parent_column':'Parent'}}

    def tearDown(self):
        dispose_db()
        self.temp.cleanup()

    def upload(self, name, content):
        return self.client.post('/upload', data={
            'file': (io.BytesIO(content), name + '.csv'), 'db_path': self.path,
            'folder_name': name, 'upload_date':'2026-09-14', 'column_roles': json.dumps(self.config),
        }, content_type='multipart/form-data')

    def test_preview_is_read_only_and_preserves_zero_prefixed_ids(self):
        response = self.client.post('/upload/preview', data={'file': (io.BytesIO(b'Employee,Parent,Name\n001,,Root\n002,001,Child\n'), 'test.csv')})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json['rows'][0]['Employee'], '001')
        with closing(sqlite3.connect(self.path)) as connection:
            self.assertEqual(connection.execute('select count(*) from tables').fetchone()[0], 0)

    def test_reopen_restores_only_declared_source_columns(self):
        response = self.upload('One', b'Employee,Parent,Name,Unmapped\n001,,Root,secret\n002,001,Child,secret\n')
        self.assertEqual(response.status_code, 200, response.json)
        table_id = response.json['table_id']
        dispose_db()
        self.assertEqual(self.client.post('/check_existing_db', json={'db_path':self.path}).status_code, 200)
        saved = self.client.get(f'/table/{table_id}/column_roles', query_string={'db_path':self.path}).json
        self.assertEqual(saved['roles'], self.config)
        self.assertEqual(saved['row_count'], 2)
        self.assertNotIn('Unmapped', saved['columns'])
        with closing(sqlite3.connect(self.path)) as connection:
            source = connection.execute('select source_data from tables').fetchone()[0]
            self.assertNotIn('secret', source)
            self.assertEqual(connection.execute('select person_id from data_entries order by person_id').fetchall(), [('001',),('002',)])

    def test_comparison_can_cross_folders_and_rejects_same_table(self):
        one = self.upload('One', b'Employee,Parent,Name\n001,,Root\n002,001,Child\n').json['table_id']
        two = self.upload('Two', b'Employee,Parent,Name\n001,,Root\n003,001,New\n').json['table_id']
        response = self.client.get('/compare_tables', query_string={'db_path':self.path,'table1_id':one,'table2_id':two})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json['changes']['added'][0]['person_id'], '003')
        self.assertEqual(response.json['changes']['removed'][0]['person_id'], '002')
        self.assertEqual(self.client.get('/compare_tables', query_string={'table1_id':one,'table2_id':one}).status_code, 400)

    def test_rejected_source_rows_are_not_saved(self):
        response = self.client.post('/upload', data={
            'file': (io.BytesIO(b'hierarchical_structure,name\n/root,Good\nbad,Rejected\n'), 'paths.csv'),
            'db_path':self.path, 'folder_name':'Paths', 'upload_date':'2026-09-14',
        })
        self.assertEqual(response.status_code, 200, response.json)
        with closing(sqlite3.connect(self.path)) as connection:
            saved = json.loads(connection.execute('select source_data from tables').fetchone()[0])
        self.assertEqual(saved['rows'], [{'hierarchical_structure':'/root','name':'Good'}])

    def test_unsupported_old_database_is_not_migrated(self):
        dispose_db()
        with closing(sqlite3.connect(self.path)) as connection:
            connection.execute('alter table tables drop column source_data')
            connection.commit()
        response = self.client.post('/check_existing_db', json={'db_path':self.path})
        self.assertEqual(response.status_code, 400)
        with closing(sqlite3.connect(self.path)) as connection:
            self.assertNotIn('source_data', [row[1] for row in connection.execute('pragma table_info(tables)')])


if __name__ == '__main__':
    unittest.main()
