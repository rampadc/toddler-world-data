import {Log} from "./core/Log";

import {connect, Payload} from 'ts-nats';
import {Secrets} from "./core/Secrets";
import {NatsAdapter} from "./core/NatsAdapter";
import {MongoClient, MongoClientOptions} from "mongodb";
import {DbAdapter} from "./core/DbAdapter";

import {WorldVillages} from "./WorldVillages";
import {WorldCharacters} from "./WorldCharacters";
import {WorldTribes} from "./WorldTribes";
import {WorldAchievements} from "./WorldAchievements";

import fs from 'fs';

/*******************************************************************************************************************
 * Check for credentials
 ******************************************************************************************************************/
const username = Secrets.get('TODDLER_USERNAME') || process.env.TODDLER_USERNAME as string || '';
const password = Secrets.get('TODDLER_PASSWORD') || process.env.TODDLER_PASSWORD as string || '';
const worldId = Secrets.get('TODDLER_WORLD_ID') || process.env.TODDLER_WORLD_ID as string || '';
const mongoUri = process.env.TODDLER_MONGO_URI as string || '';
const natsUri = process.env.TODDLER_NATS_URI as string || '';

if (worldId.trim().length == 0 || mongoUri.trim().length == 0 || natsUri.trim().length == 0) {
  Log.service().error('Missing credentials');
  process.exit(1);
}

const ca = fs.readFileSync(__dirname + '/ssl/ca.pem');

let villages = new WorldVillages(worldId);
let characters = new WorldCharacters();
let tribes = new WorldTribes();
let achievements = new WorldAchievements();

process.on('SIGINT', function () {
  gracefullyExit();
});

/*******************************************************************************************************************
 * Initiates data service
 ******************************************************************************************************************/
Log.service().info('Initializing world data service...');

let options: MongoClientOptions = {
  useNewUrlParser: true
};
if (ca != null) {
  options.sslValidate = false;
  options.sslCA = [ca];
  options.ssl = true;
}
const client = new MongoClient(mongoUri, options);

Promise.all([
  client.connect(),
  connect({
    servers: [natsUri],
    payload: Payload.JSON,
    reconnect: true
  })
]).then(values => {
  Log.service().info('Connected to NATS server');
  NatsAdapter.shared.client = values[1];

  Log.service().info('Connected to MongoDB server');
  DbAdapter.shared.db = client.db('en45');

  villages.get().then(() => {
    characters.get().then(() => {
      tribes.get().then(() => {
        achievements.get().then(() => {
          gracefullyExit();
        });
      });
    });
  });
}).catch(exitWithError);


/*******************************************************************************************************************
 * Utility
 ******************************************************************************************************************/
function gracefullyExit() {
  NatsAdapter.shared.client.close();
  client.close().then(() =>  {
    Log.service().info('Exiting world-data service...');
    process.exit(0);
  }).catch(error => {
    Log.service().error(error);
    process.exit(1);
  });
}

function exitWithError(error: any) {
  console.log(error);
  process.exit(1);
}
