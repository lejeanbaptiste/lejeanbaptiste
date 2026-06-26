import { Box, Tab, Tabs } from '@mui/material';
import { useState } from 'react';
import { SidebarExplorerTab } from './sidebar/SidebarExplorerTab';
import { SidebarFindTab } from './sidebar/SidebarFindTab';
import { SidebarXPathTab } from './sidebar/SidebarXPathTab';

type SidebarTab = 'explorer' | 'find' | 'xpath';

export const ProjectSidebar = () => {
  const [activeTab, setActiveTab] = useState<SidebarTab>('explorer');

  return (
    <Box
      sx={{
        width: 260,
        minWidth: 260,
        borderRight: 1,
        borderColor: 'divider',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        bgcolor: 'background.paper',
      }}
    >
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs
          value={activeTab}
          onChange={(_event, value) => setActiveTab(value as SidebarTab)}
          variant="fullWidth"
          sx={{ minHeight: 36 }}
        >
          <Tab label="Explorer" value="explorer" sx={{ minHeight: 36, py: 0.5, fontSize: '0.75rem', textTransform: 'none' }} />
          <Tab label="Find" value="find" sx={{ minHeight: 36, py: 0.5, fontSize: '0.75rem', textTransform: 'none' }} />
          <Tab label="XPath" value="xpath" sx={{ minHeight: 36, py: 0.5, fontSize: '0.75rem', textTransform: 'none' }} />
        </Tabs>
      </Box>
      <Box sx={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {activeTab === 'explorer' && <SidebarExplorerTab />}
        {activeTab === 'find' && <SidebarFindTab />}
        {activeTab === 'xpath' && <SidebarXPathTab />}
      </Box>
    </Box>
  );
};
