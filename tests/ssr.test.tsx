import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  IconPicker,
  IconPickerButton,
  IconRenderer,
  parseIconValue,
} from '../src';

describe('server rendering', () => {
  it('imports the root API and renders components without browser globals', () => {
    const picker = renderToString(
      <IconPicker value={null} onChange={() => undefined} />,
    );
    const button = renderToString(
      <IconPickerButton value="🚀" onChange={() => undefined} />,
    );
    const renderer = renderToString(<IconRenderer value="lucide:rocket" />);

    expect(picker).toContain('role="region"');
    expect(button).toContain('aria-haspopup="dialog"');
    expect(renderer).toContain('api.iconify.design/lucide/rocket.svg');
    expect(parseIconValue('rocket')).toEqual({
      source: 'lucide',
      name: 'rocket',
    });
  });
});
