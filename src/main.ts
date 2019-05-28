import {Log} from "./Log";

import {Client, connect, Payload} from 'ts-nats';
import {WorldVillages} from "./WorldVillages";
import {Secrets} from "./Secrets";
import {NatsAdapter} from "./NatsAdapter";
import {GameTypes} from "./Providers";

/*******************************************************************************************************************
 * Check for credentials
 ******************************************************************************************************************/
const username = Secrets.get('TODDLER_USERNAME') || process.env.TODDLER_USERNAME as string || 'Simp1eUs3rname';
const password = Secrets.get('TODDLER_PASSWORD') || process.env.TODDLER_PASSWORD as string || 'Passw0rd';
const worldId = Secrets.get('TODDLER_WORLD_ID') || process.env.TODDLER_WORLD_ID as string || 'en45';

let n = NatsAdapter.shared;
let villages: WorldVillages;

process.on('SIGINT', function () {
  gracefullyExit();
});

/*******************************************************************************************************************
 * Initiates data service
 ******************************************************************************************************************/
Log.service().info('Initializing world data service...');

let nc: Client;
connect({
  payload: Payload.JSON
}).then(client => {
  Log.service().info('Connected to NATS server');
  client.publish('world-data.ready');

  NatsAdapter.shared.client = client;
  NatsAdapter.shared.request({
    type: GameTypes.MAP_GETVILLAGES,
    data: {
      x: 500,
      y: 500,
      width: 5,
      height: 5
    }
  }).then(result => {
    console.log('main');
    console.log(result);
  }).catch(error => {
    console.log(error);
  });
});


/*******************************************************************************************************************
 * Utility
 ******************************************************************************************************************/
function gracefullyExit() {
  n.client.close();
  process.exit(0);
}
