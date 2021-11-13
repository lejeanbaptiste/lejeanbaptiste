import chalk from 'chalk';
import app from './server';
const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log(chalk.bgGreen.black(`\n Server listening on port ${port}! \n`));
});
