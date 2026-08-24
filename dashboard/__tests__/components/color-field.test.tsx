import { useState } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ColorField } from '@/components/ui/color-field';

afterEach(cleanup);

function ControlledColorField({ onChange = vi.fn() }: { onChange?: (value: string) => void }) {
  const [value, setValue] = useState('#336699');

  return (
    <ColorField
      value={value}
      onValueChange={(next) => {
        setValue(next);
        onChange(next);
      }}
    />
  );
}

describe('ColorField', () => {
  it('uses a custom picker and applies preset colors', () => {
    const onChange = vi.fn();
    const { container } = render(<ControlledColorField onChange={onChange} />);

    expect(container.querySelector('input[type="color"]')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /choose color/i }));

    expect(screen.getByRole('button', { name: 'Saturation and brightness' })).toBeInTheDocument();
    expect(screen.getByRole('slider', { name: 'Hue' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Use color #EF4444' }));

    expect(onChange).toHaveBeenLastCalledWith('#EF4444');
    expect(screen.getByRole('textbox', { name: 'Hex color' })).toHaveValue('#EF4444');
  });

  it('supports keyboard changes on the saturation and brightness surface', () => {
    const onChange = vi.fn();
    render(<ControlledColorField onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: /choose color/i }));

    fireEvent.keyDown(screen.getByRole('button', { name: 'Saturation and brightness' }), {
      key: 'ArrowDown',
    });

    expect(onChange).toHaveBeenCalled();
    expect(onChange.mock.lastCall?.[0]).toMatch(/^#[0-9A-F]{6}$/);
  });

  it('marks incomplete hex values invalid and restores the controlled color on blur', () => {
    render(<ControlledColorField />);
    const input = screen.getByRole('textbox', { name: 'Hex color' });

    fireEvent.change(input, { target: { value: '#12' } });
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('Enter a six-digit hexadecimal color.')).toBeInTheDocument();

    fireEvent.blur(input);
    expect(input).toHaveValue('#336699');
    expect(input).toHaveAttribute('aria-invalid', 'false');
  });
});
