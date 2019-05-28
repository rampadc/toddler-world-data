import {Log} from "./core/Log";

import {connect, Payload} from 'ts-nats';
import {WorldVillages} from "./WorldVillages";
import {Secrets} from "./core/Secrets";
import {NatsAdapter} from "./core/NatsAdapter";
import {GameTypes} from "./core/Providers";

/*******************************************************************************************************************
 * Check for credentials
 ******************************************************************************************************************/
const username = Secrets.get('TODDLER_USERNAME') || process.env.TODDLER_USERNAME as string || 'Simp1eUs3rname';
const password = Secrets.get('TODDLER_PASSWORD') || process.env.TODDLER_PASSWORD as string || 'Passw0rd';
const worldId = Secrets.get('TODDLER_WORLD_ID') || process.env.TODDLER_WORLD_ID as string || 'en45';

let villages = new WorldVillages(worldId);

process.on('SIGINT', function () {
  gracefullyExit();
});

/*******************************************************************************************************************
 * Initiates data service
 ******************************************************************************************************************/
Log.service().info('Initializing world data service...');

connect({
  payload: Payload.JSON
}).then(client => {
  Log.service().info('Connected to NATS server');
  NatsAdapter.shared.client = client;
  villages.get();
}).catch(error => {
  console.log(error);
  process.exit(1);
});


/*******************************************************************************************************************
 * Utility
 ******************************************************************************************************************/
function gracefullyExit() {
  NatsAdapter.shared.client.close();
  process.exit(0);
}
