import { ThemeProvider } from '@mui/material';
import { createRoot, type Root } from 'react-dom/client';
import theme from '../theme';
import { EastAsianDateFields } from './EastAsianDateFields';
import { useDateAuthority } from './useDateAuthority';
import type { EastAsianDateValues } from './types';
import { readEastAsianDateValues } from './values';

type MountListener = (values: EastAsianDateValues) => void;

let root: Root | null = null;
let currentValues: EastAsianDateValues = readEastAsianDateValues({});
let currentDisabled = false;
let listeners: MountListener[] = [];

const MountBridge = ({
  disabled,
  onChange,
  values,
}: {
  disabled: boolean;
  onChange: (values: EastAsianDateValues) => void;
  values: EastAsianDateValues;
}) => {
  const { authority, loading, error } = useDateAuthority(true);
  return (
    <EastAsianDateFields
      authority={authority}
      disabled={disabled}
      error={error}
      loading={loading}
      onChange={onChange}
      values={values}
    />
  );
};

const rerender = () => {
  if (!root) return;
  root.render(
    <ThemeProvider theme={theme}>
      <MountBridge
        disabled={currentDisabled}
        onChange={(next) => {
          currentValues = next;
          for (const listener of listeners) listener(next);
        }}
        values={currentValues}
      />
    </ThemeProvider>,
  );
};

export function mountEastAsianDateFields(
  container: HTMLElement,
  options: {
    initialValues?: EastAsianDateValues;
    disabled?: boolean;
    onChange?: MountListener;
  } = {},
): void {
  currentValues = options.initialValues ?? readEastAsianDateValues({});
  currentDisabled = options.disabled ?? false;
  listeners = options.onChange ? [options.onChange] : [];

  if (!root) {
    root = createRoot(container);
  }
  rerender();
}

export function setEastAsianDateFieldValues(values: EastAsianDateValues): void {
  currentValues = values;
  rerender();
}

export function setEastAsianDateFieldsDisabled(disabled: boolean): void {
  currentDisabled = disabled;
  rerender();
}

export function getEastAsianDateFieldValues(): EastAsianDateValues {
  return { ...currentValues };
}

export function unmountEastAsianDateFields(): void {
  listeners = [];
  if (root) {
    root.unmount();
    root = null;
  }
}
