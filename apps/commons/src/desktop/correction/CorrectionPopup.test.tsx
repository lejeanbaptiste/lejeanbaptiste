import { render, screen } from '@testing-library/react';
import { CorrectionPopup } from './CorrectionPopup';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe('CorrectionPopup', () => {
  it('shrinks the add-attribute label when the chooser is empty', () => {
    const { container } = render(
      <CorrectionPopup
        addAttrName=""
        anchor={{ left: 24, top: 24 }}
        availableAttributes={[
          { invalid: false, name: 'type' },
          { invalid: false, name: 'key' },
        ]}
        cert=""
        corrText="then"
        errorMessage={null}
        extraAttributes={{}}
        mode="add"
        onAddAttribute={jest.fn()}
        onApply={jest.fn()}
        onClose={jest.fn()}
        onExtraAttributeChange={jest.fn()}
        onRemoveAttribute={jest.fn()}
        onRemoveMarkup={jest.fn()}
        onPopupKeyDown={jest.fn()}
        open
        setAddAttrName={jest.fn()}
        setCert={jest.fn()}
        setCorrText={jest.fn()}
        sicText="when"
        typeLabel="substitution"
      />,
    );

    const label = Array.from(container.querySelectorAll('label')).find(
      (node) => node.textContent === 'LWC.desktop.correction.add_attribute',
    );
    expect(label).toBeTruthy();
    expect(label?.textContent).toBe('LWC.desktop.correction.add_attribute');
    expect(label?.className).toContain('MuiInputLabel-shrink');
    expect(screen.getByText('LWC.desktop.correction.choose_attribute')).toBeTruthy();
  });
});
