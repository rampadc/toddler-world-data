import {Log} from "./core/Log";

import {connect, Payload} from 'ts-nats';
import {WorldVillages} from "./WorldVillages";
import {Secrets} from "./core/Secrets";
import {NatsAdapter} from "./core/NatsAdapter";
import {MongoClient} from "mongodb";
import {DbAdapter} from "./core/DbAdapter";

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


const uri = "mongodb+srv://toddler:t0ddler@en45-simp1eus3rname-arahh.mongodb.net/test?retryWrites=true";
const client = new MongoClient(uri, { useNewUrlParser: true });
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
