import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { Logo } from './Logo';
import { Modal } from './Modal';
import { SelectionBar } from '@/features/pins/SelectionBar';
import { FaqList } from './marketing';

describe('Logo', () => {
  it('renders the wordmark with the by-line', () => {
    render(<Logo />);
    expect(screen.getByText('PinDeleter')).toBeInTheDocument();
    expect(screen.getByText('by Kriosity')).toBeInTheDocument();
  });
  it('renders an accessible mark', () => {
    render(<Logo variant="mark" />);
    expect(screen.getByRole('img', { name: 'PinDeleter' })).toBeInTheDocument();
  });
});

describe('Modal', () => {
  it('closes on Escape and labels the dialog', async () => {
    const onClose = vi.fn();
    render(
      <Modal open onClose={onClose} title="Delete?">
        <button type="button">Confirm</button>
      </Modal>,
    );
    expect(screen.getByRole('dialog', { name: 'Delete?' })).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalled();
  });
});

describe('SelectionBar', () => {
  it('shows the count and clears', async () => {
    const onClear = vi.fn();
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <SelectionBar count={1234} onClear={onClear} />
      </MemoryRouter>,
    );
    expect(screen.getByText('1,234 selected')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /review/i })).toHaveAttribute('href', '/app/review');
    await userEvent.click(screen.getByRole('button', { name: /clear/i }));
    expect(onClear).toHaveBeenCalled();
  });
});

describe('FaqList', () => {
  it('toggles answers with aria-expanded', async () => {
    render(
      <FaqList
        items={[
          { q: 'Q1', a: 'A1', category: 'general' },
          { q: 'Q2', a: 'A2', category: 'general' },
        ]}
      />,
    );
    const q2 = screen.getByRole('button', { name: 'Q2' });
    expect(q2).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(q2);
    expect(q2).toHaveAttribute('aria-expanded', 'true');
    expect(await screen.findByText('A2')).toBeInTheDocument();
  });
});
