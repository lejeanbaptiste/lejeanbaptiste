import https from 'https';
import kleur from 'kleur';
import { resolvePluginHttpsOptions } from './httpsCerts';
import server from './server';
const port = process.env.PORT ?? 3000;

server.listen(port, () => {
  console.info(kleur.bgGreen().black(`\n Server listening on port ${port}! \n`));
});

// When forked from the desktop app, exit if the parent dies (including crashes);
// an orphaned server would squat the port and serve a stale bundle to new launches.
if (process.send) {
  process.on('disconnect', () => process.exit(0));
}

// Separate HTTPS listener for the Word add-in's /api/plugins/* routes (see
// routes/plugins.ts) — its task pane runs over HTTPS and can't fetch a plain
// http:// origin without the browser treating it as mixed content.
const pluginHttpsPort = process.env.LJB_PLUGIN_HTTPS_PORT ?? '3848';

void (async () => {
  try {
    const httpsOptions = await resolvePluginHttpsOptions();
    https.createServer(httpsOptions, server).listen(pluginHttpsPort, () => {
      console.info(
        kleur.bgGreen().black(`\n Plugin HTTPS API listening on port ${pluginHttpsPort}! \n`),
      );
    });
  } catch (error) {
    console.error(
      '[plugin-api] failed to start the HTTPS listener for the Word add-in API:',
      error,
    );
  }
})();
