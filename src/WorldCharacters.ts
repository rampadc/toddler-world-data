import {GameTypes} from "./core/Providers";
import {NatsAdapter} from "./core/NatsAdapter";
import {Collection} from "mongodb";
import {DbAdapter} from "./core/DbAdapter";
import {Log} from "./core/Log";

export class WorldCharacters {
  private collection: Collection;
  private progress = 0;

  constructor() {
  }

  update(characterIds: any[]): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      Promise.all(characterIds.map(c => {
        NatsAdapter.shared.request({
          type: GameTypes.CHAR_GET_PROFILE,
          data: {
            character_id: c
          }
        }).then((d: any) => {
          d['current'] = true;
          d['updated_at'] = new Date().toISOString();
          return this.collection.bulkWrite([
            {
              updateMany:
                {
                  filter: {character_id: d['character_id']},
                  update: {$set: {current: false}}
                }
            },
            {insertOne: {document: d}}
          ], {ordered: true, w: 1}).then(() => {
            console.log(this.progress++, '/', characterIds.length);
          })
        }).catch(error => {
          Log.service().error(error);
          reject(error);
        })
      })).then(() => {
        console.log('done');
        resolve();
      });
    });
  }

  get() {
    Log.service().info('Starting characters retrieval...');

    this.collection = DbAdapter.shared.collection('villages');
    let cursor = this.collection.find(
      {current: true, character_id: {$ne: null}}
    ).project({character_id: 1});

    cursor.map(c => c['character_id']).toArray().then(characterIds => {
      this.collection = DbAdapter.shared.collection('characters');

      this.collection.findOne({}, {
        sort: {updated_at: -1},
        limit: 1,
        projection: {updated_at: 1}
      }).then(result => {
        const d = new Date(result['updated_at']);
        if ((new Date().getTime() - 3600_000) > d.getTime()) {
          this.update(characterIds).then(() => {
            // resolve();
          });
        } else {
          Log.service().info('Last update was too recent.');
          // resolve();
        }
      }).catch(error => {
        // assumed to be empty collection
        this.update(characterIds).then(() => {
          // resolve();
        });
      });

    });
  };
}
