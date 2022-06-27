import { type FC } from 'react';
import Writer from './js/Writer';
import type { ILeafWriterOptions } from './types';
declare global {
    interface Window {
        writer: Writer | null;
    }
}
declare const App: FC<ILeafWriterOptions>;
export default App;
//# sourceMappingURL=App.d.ts.map