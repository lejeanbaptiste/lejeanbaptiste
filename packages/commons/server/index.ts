import kleur from 'kleur';
import server from './server';
const port = process.env.PORT || 3000;

server.listen(port, () => {
  console.log(kleur.bgGreen().black(`\n Server listening on port ${port}! \n`));
});
