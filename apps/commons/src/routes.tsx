import { BasicLayout } from './layouts';
import { EditPage, HomePage, LinkAccountsPage, NotFoundPage, ProjectEditPage } from './pages';
import { NativeSettingsPage } from './pages/project/NativeSettingsPage';
import { NativeSchemaPickerPage } from './pages/project/NativeSchemaPickerPage';
import { NativeSchemaSetupPage } from './pages/project/NativeSchemaSetupPage';
import { NativeProjectMetadataPage } from './pages/project/NativeProjectMetadataPage';

export const routes = [
  { path: '/project/native/settings', element: <NativeSettingsPage /> },
  { path: '/project/native/schema-picker', element: <NativeSchemaPickerPage /> },
  { path: '/project/native/schema-setup', element: <NativeSchemaSetupPage /> },
  { path: '/project/native/project-metadata', element: <NativeProjectMetadataPage /> },
  {
    path: '/',
    element: <BasicLayout />,
    children: [
      { path: '404', element: <NotFoundPage /> },
      { path: '/link-accounts', element: <LinkAccountsPage /> },
      { path: '/edit', element: <EditPage /> },
      { path: '/view', element: <EditPage /> },
      { path: '/project', element: <ProjectEditPage /> },
      { index: true, element: <HomePage /> },
    ],
  },
];
