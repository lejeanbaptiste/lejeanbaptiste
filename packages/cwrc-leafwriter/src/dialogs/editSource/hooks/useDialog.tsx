import { useActions } from '../../../overmind';
import { useAtom, useSetAtom } from 'jotai';
import {
  contentTypeAtom,
  currentContentAtom,
  originalContentAtom,
  xmlValidityAtom,
} from '../store';

export const useDialog = () => {
  const { setIsReload, loadDocumentXML: updateXMLContent, updateXMLHeader } = useActions().document;
  const [contentType, setContentType] = useAtom(contentTypeAtom);
  const [currentContent, setCurrentContent] = useAtom(currentContentAtom);
  const setOriginalContent = useSetAtom(originalContentAtom);
  const setXmlValidityAtom = useSetAtom(xmlValidityAtom);

  const updateContent = () => {
    setIsReload(true);
    if (contentType === 'header') updateXMLHeader(currentContent);
    if (contentType === 'content') updateXMLContent(currentContent);
  };

  const resetContext = () => {
    setContentType('content');
    setCurrentContent('');
    setOriginalContent('');
    setXmlValidityAtom({ valid: true });
  };

  return {
    resetContext,
    updateContent,
  };
};
