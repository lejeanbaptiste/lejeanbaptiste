import https from 'https';
import kleur from 'kleur';
import { resolvePluginHttpsOptions } from './httpsCerts';
import server from './server';
const port = process.env.PORT ?? 3000;

server
  .listen(port, () => {
    console.info(kleur.bgGreen().black(`\n Server listening on port ${port}! \n`));
  })
  // Fatal — there is no app without this listener — but report it in one legible
  // line, because the desktop shell shows this stderr in its startup dialog.
  .on('error', (error: NodeJS.ErrnoException) => {
    console.error(
      error.code === 'EADDRINUSE'
        ? `Port ${port} is already in use — another copy of the app or a stale server is still running.`
        : `Could not listen on port ${port}: ${error.message}`,
    );
    process.exit(1);
  });

// When forked from the desktop app, exit if the parent dies (including crashes);
// an orphaned server would squat the port and serve a stale bundle to new launches.
if (process.send) {
  process.on('disconnect', () => process.exit(0));
}

// Separate HTTPS listener for the Word add-in's /api/plugins/* routes (see
// routes/plugins.ts) — its task pane runs over HTTPS and can't fetch a plain
// http:// origin without the browser treating it as mixed content.
const pluginHttpsPort = process.env.GROGNARD_PLUGIN_HTTPS_PORT ?? '3848';

void (async () => {
  try {
    const httpsOptions = await resolvePluginHttpsOptions();
    https
      .createServer(httpsOptions, server)
      .listen(pluginHttpsPort, () => {
        console.info(
          kleur.bgGreen().black(`\n Plugin HTTPS API listening on port ${pluginHttpsPort}! \n`),
        );
      })
      // Optional listener: the add-in API going without must not take the whole
      // app down. Left unhandled, an 'error' here (a dev server or a second
      // instance already on this port) is thrown and kills the process.
      .on('error', (error: NodeJS.ErrnoException) => {
        console.error(
          `[plugin-api] HTTPS listener for the Word add-in API is unavailable on port ${pluginHttpsPort}:`,
          error.code ?? error.message,
        );
      });
  } catch (error) {
    console.error(
      '[plugin-api] failed to start the HTTPS listener for the Word add-in API:',
      error,
    );
  }
})();
