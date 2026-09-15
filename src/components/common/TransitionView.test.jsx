import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import TransitionView from './TransitionView';

describe('TransitionView', () => {
  it('makes departing controls inert and resolves rapid navigation to the latest screen', async () => {
    const { rerender } = render(<TransitionView stateKey="a"><button>First</button></TransitionView>);
    rerender(<TransitionView stateKey="b"><button>Second</button></TransitionView>);
    expect(screen.getByText('First').closest('[inert]')).not.toBeNull();
    rerender(<TransitionView stateKey="c"><button>Third</button></TransitionView>);
    await screen.findByText('Third');
    await waitFor(() => expect(screen.queryByText('First')).not.toBeInTheDocument());
    expect(screen.queryByText('Second')).not.toBeInTheDocument();
    expect(screen.getByText('Third').closest('[inert]')).toBeNull();
  });
});
