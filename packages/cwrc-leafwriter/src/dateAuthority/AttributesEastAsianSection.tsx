import { EastAsianDateFields } from './EastAsianDateFields';
import { useDateAuthority } from './useDateAuthority';
import type { EastAsianDateValues } from './types';

export interface AttributesEastAsianSectionProps {
  disabled?: boolean;
  values: EastAsianDateValues;
  onChange: (values: EastAsianDateValues) => void;
}

/** East Asian calendar fields for the desktop attributes panel (lazy-loaded with cjk-dates). */
export function AttributesEastAsianSection({
  disabled,
  values,
  onChange,
}: AttributesEastAsianSectionProps) {
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
}
