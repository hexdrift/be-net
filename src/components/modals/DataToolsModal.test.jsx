import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import axios from 'axios';
import DataToolsModal from './DataToolsModal';

vi.mock('axios', () => ({ default: { get: vi.fn() } }));
vi.mock('react-i18next', () => {
  const t = key => key;
  return { useTranslation: () => ({ t }) };
});
beforeEach(() => {
  axios.get.mockReset();
  HTMLDialogElement.prototype.showModal = function () { this.open = true; };
});
const folders = [{ id: 1, name: 'First', tables: [{ id: 1, name: 'January' }] }, { id: 2, name: 'Second', tables: [{ id: 2, name: 'February' }] }];
const props = { mode: 'compare', tableId: 1, dbPath: '/tmp/example.db', folders, onClose: () => {} };

describe('DataToolsModal', () => {
  it('compares across folders with no configurable identity and shows all categories', async () => {
    axios.get.mockResolvedValue({ data: { changes: {
      added: [{ person_id: '001', name: 'Added employee' }], removed: [{ person_id: '002', name: 'Removed employee' }],
      changed: [{ person_id: '003', name: 'Changed employee', changes: { role: ['Analyst','Lead'] } }],
      moved: [{ person_id: '004', name: 'Moved employee', old: '/root/a', new: '/root/b/a' }],
      excluded: [{ side: 'before', reason: 'duplicate_employee_id', record: { person_id: '005', name: 'Excluded employee' } }],
      compared_counts: { before: 3, after: 3 },
      distributions: { role: [{ label: 'Engineer', before: 2, after: 1 }, { label: 'Lead', before: 0, after: 2 }] },
    } } });
    render(<DataToolsModal {...props} />);
    expect(screen.getAllByRole('combobox')).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'tableDiff.compare' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('tableDiff.after'), { target: { value: '2' } });
    fireEvent.click(screen.getByRole('button', { name: 'tableDiff.compare' }));
    await screen.findByText('Added employee');
    for (const text of ['Removed employee', 'Changed employee', 'Moved employee', 'Excluded employee']) expect(screen.getByText(text)).toBeInTheDocument();
    expect(screen.getByLabelText('Engineer: tableDiff.before 2')).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: /tableDiff.moved/ })[0]);
    expect(screen.queryByText('Added employee')).not.toBeInTheDocument();
    expect(screen.getByText('Moved employee')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'dataVisual.details' }));
    expect(axios.get).toHaveBeenCalledWith('http://localhost:5001/compare_tables', { params: { table1_id: '1', table2_id: '2', db_path: '/tmp/example.db' } });
    fireEvent.change(screen.getByLabelText('tableDiff.after'), { target: { value: '1' } });
    await waitFor(() => expect(screen.queryByText('Added employee')).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'tableDiff.compare' })).toBeDisabled();
  });

  it('restores saved roles without a file picker', async () => {
    axios.get.mockResolvedValue({ data: { roles: { fields: { person_id:'Employee' }, hierarchy: { mode:'parent', id_column:'Employee', parent_column:'Parent' } }, columns:['Employee','Parent'], rows:[{Employee:'001',Parent:''}] } });
    const { container } = render(<DataToolsModal {...props} mode="roles" />);
    await screen.findByText('columnRoles.parentHelp');
    expect(container.querySelector('input[type="file"]')).toBeNull();
    expect(screen.getAllByRole('combobox').every(select => select.disabled)).toBe(true);
  });

  it('displays a retryable comparison error', async () => {
    axios.get.mockRejectedValue({ response: { data: { error:'Database unavailable' } } });
    render(<DataToolsModal {...props} />);
    fireEvent.change(screen.getByLabelText('tableDiff.after'), { target: { value:'2' } });
    fireEvent.click(screen.getByRole('button', { name:'tableDiff.compare' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Database unavailable'));
    expect(screen.getByRole('button', { name:'tableDiff.compare' })).toBeEnabled();
  });
});
