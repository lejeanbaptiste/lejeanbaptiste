import { fireEvent, render, screen } from '@testing-library/react';
import { Header } from './Header';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe('SchemaHeader', () => {
  test('exposes refresh and add actions', () => {
    const onClickAdd = jest.fn();
    const onClickRefresh = jest.fn();

    render(
      <Header onClickAdd={onClickAdd} onClickRefresh={onClickRefresh} refreshDisabled={false} />,
    );

    fireEvent.click(screen.getByLabelText('LW.commons.refresh'));
    fireEvent.click(screen.getByLabelText('LW.commons.add'));

    expect(onClickRefresh).toHaveBeenCalledTimes(1);
    expect(onClickAdd).toHaveBeenCalledWith('add');
  });

  test('can disable refresh while keeping add available', () => {
    const onClickAdd = jest.fn();
    const onClickRefresh = jest.fn();

    render(
      <Header onClickAdd={onClickAdd} onClickRefresh={onClickRefresh} refreshDisabled={true} />,
    );

    expect((screen.getByLabelText('LW.commons.refresh') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByLabelText('LW.commons.add'));

    expect(onClickRefresh).not.toHaveBeenCalled();
    expect(onClickAdd).toHaveBeenCalledWith('add');
  });
});
