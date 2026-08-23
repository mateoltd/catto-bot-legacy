import 'reflect-metadata';
import './setup.js';
import { BotClient } from '#structures/BotClient.js';
import { CONFIG } from '#config.js';

const client = new BotClient();

const main = async () => {
  try {
    client.logger.info('Logging in to Discord...');
    await client.login(CONFIG.DISCORD_TOKEN);
    client.logger.info('Successfully logged in!');
  } catch (error) {
    client.logger.fatal(error);
    await client.destroy();
    process.exit(1);
  }
};

main();
