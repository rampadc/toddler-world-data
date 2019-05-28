import {Log} from "./core/Log";

import {connect, Payload} from 'ts-nats';
import {Secrets} from "./core/Secrets";
import {NatsAdapter} from "./core/NatsAdapter";
import {MongoClient} from "mongodb";
import {DbAdapter} from "./core/DbAdapter";

import {WorldVillages} from "./WorldVillages";
import {WorldCharacters} from "./WorldCharacters";

/*******************************************************************************************************************
 * Check for credentials
 ******************************************************************************************************************/
const username = Secrets.get('TODDLER_USERNAME') || process.env.TODDLER_USERNAME as string || 'Simp1eUs3rname';
const password = Secrets.get('TODDLER_PASSWORD') || process.env.TODDLER_PASSWORD as string || 'Passw0rd';
const worldId = Secrets.get('TODDLER_WORLD_ID') || process.env.TODDLER_WORLD_ID as string || 'en45';
const mongoUri = process.env.TODDLER_MONGO_URI as string || "mongodb+srv://toddler:t0ddler@en45-simp1eus3rname-arahh.mongodb.net/test?retryWrites=true";

let villages = new WorldVillages(worldId);
let characters = new WorldCharacters();

process.on('SIGINT', function () {
  gracefullyExit();
});

/*******************************************************************************************************************
 * Initiates data service
 ******************************************************************************************************************/
Log.service().info('Initializing world data service...');

const client = new MongoClient(mongoUri, { useNewUrlParser: true });
client.connect(err => {
  const collection = client.db("test").collection("devices");
  // perform actions on the collection object
  client.close();
});

Promise.all([
  client.connect(),
  connect({
    payload: Payload.JSON
  })
]).then(values => {
  Log.service().info('Connected to NATS server');
  NatsAdapter.shared.client = values[1];

  Log.service().info('Connected to MongoDB server');
  DbAdapter.shared.db = client.db('en45');

  villages.updateInternalVariables();
  villages.get().then(() => {
    characters.get();
  });
}).catch(exitWithError);


/*******************************************************************************************************************
 * Utility
 ******************************************************************************************************************/
function gracefullyExit() {
  NatsAdapter.shared.client.close();
  process.exit(0);
}

function exitWithError(error: any) {
  Log.service().error(error);
  process.exit(1);
}
