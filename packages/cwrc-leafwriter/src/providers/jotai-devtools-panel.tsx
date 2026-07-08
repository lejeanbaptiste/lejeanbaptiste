import { DevTools } from 'jotai-devtools';
import 'jotai-devtools/styles.css';

export default function JotaiDevToolsPanel() {
  return <DevTools position="bottom-right" theme="dark" />;
}
