import kleur from 'kleur';
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
