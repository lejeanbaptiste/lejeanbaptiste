import { useEffect, useState } from 'react';
import { ItemProps, ItemType } from './';

type UseItemProps = {
  active?: boolean;
  children?: ItemProps[];
  getChildren?: () => Promise<ItemProps[]>;
  type: ItemType;
};

export const useItem = ({ active, children, getChildren, type }: UseItemProps) => {
  const [nestedList, setNestedList] = useState<ItemProps[]>(children ?? []);
  const [showNestedMenu, setShowNestedMenu] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const [isEmpty, setIsEmpty] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (type === 'collection') handleActiveChange();
  }, [active]);

  const handleActiveChange = () => {
    if (active) {
      setShowNestedMenu(true);
      loadChildren();
    } else {
      setAnchorEl(null);
      setShowNestedMenu(false);
    }
  };

  const loadChildren = async () => {
    if (nestedList?.length !== 0) return;

    if (!getChildren) return;

    setIsLoading(true);
    const children = await getChildren();
    setIsLoading(false);

    if (children.length === 0) setIsEmpty(true);
    setNestedList(children);
  };

  return {
    anchorEl,
    handleActiveChange,
    isEmpty,
    isLoading,
    loadChildren,
    nestedList,
    showNestedMenu,
    setAnchorEl,
  };
};
