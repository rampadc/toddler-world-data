import {GameTypes} from "./core/Providers";
import {NatsAdapter} from "./core/NatsAdapter";
import {Collection} from "mongodb";
import {DbAdapter} from "./core/DbAdapter";
import {Log} from "./core/Log";

export class WorldCharacters {
  private collection: Collection;
  private progress = 0;

  update(ids: any[]): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      ids.map(id => {
        NatsAdapter.shared.request({
          type: GameTypes.CHAR_GET_PROFILE,
          data: {
            character_id: id
          }
        }).then((d: any) => {
          /* v: new doc, uncommitted */
          d['current'] = true;
          d['updating'] = true;
          d['updated_at'] = new Date().toISOString();

          return this.collection.bulkWrite([
            {updateMany: {filter: {id: d['character_id'], updating: false, current: true}, update: {$set: {updating: true, current: false}}}},
            {updateMany: {filter: {id: d['character_id']}, update: {$set: {current: false}}}}, // if collection is brand new, the above operation will not occur
            {insertOne: {document: d}}
          ], {ordered: true, w: 1}).then(() => {
            this.progress += 1;

            Log.service().debug(`Character ${d['character_id']} committed. Progress: ${this.progress}/${ids.length}`);
            NatsAdapter.shared.client.publish('world-date.progress.characters', {
              progress: this.progress / ids.length,
              total: ids.length
            });
            if (this.progress >= ids.length) {
              resolve();
            }
          })
        }).catch(error => {
          Log.service().error(error);
          reject(error);
        });
      });
    });
  }

  finaliseUpdate(): Promise<void> {
    Log.service().debug('Finalising update...');
    return new Promise<void>(resolve => {
      this.collection.updateMany({updating: true}, {$set: {updating: false}}).then(() => {
        Log.service().info('Completed villages retrieval.');
        resolve();
      });
    });
  }

  rollback(): Promise<void> {
    Log.service().debug('Timed out. Rolling back...');
    return new Promise<void>(resolve => {
      this.collection.deleteMany({current: true}).then(() => {
        this.collection.bulkWrite([
          {updateMany: {filter: {updating: true}, update: {$set: {current: true, updating: false}}}},
        ], {ordered: true, w: 1}).then(() => {resolve();});
      });
    });
  }

  get(timeout_minutes: number = 15): Promise<void> {
    Log.service().info('Starting characters retrieval...');
    return new Promise<void>((resolve, reject) => {
      this.collection = DbAdapter.shared.collection('villages');

      let timeout = new Promise<void>((resolve, reject) => {
        let wait = setTimeout(() => {
          clearTimeout(wait);
          reject();
        }, timeout_minutes * 60_000);
      });

      let fetch = new Promise<void>(resolve => {
        let cursor = this.collection.find(
          {current: true, character_id: {$ne: null}}
        ).project({character_id: 1});

        cursor.map(c => c['character_id']).toArray().then(ids => {
          this.collection = DbAdapter.shared.collection('characters');

          this.collection.findOne({}, {
            sort: {updated_at: -1},
            limit: 1,
            projection: {updated_at: 1}
          }).then(result => {
            ids = Array.from(new Set(ids));
            ids.sort();

            const d = new Date(result['updated_at']);
            if ((new Date().getTime() - 3600_000) > d.getTime()) {
              this.update(Array.from(ids)).then(() => {
                resolve();
              });
            } else {
              Log.service().info('Characters: last update was too recent.');
              resolve();
            }
          }).catch(error => {
            // assumed to be empty collection
            this.update(ids).then(() => {
              resolve();
            });
          });
        });
      });

      Promise.race([timeout, fetch]).then(() => {
        this.finaliseUpdate().then(() => {
          NatsAdapter.shared.client.publish('world-data.completed.characters');
          resolve();});
      }).catch(() => {
        this.rollback().then(() => {
          NatsAdapter.shared.client.publish('world-data.completed.characters');
          resolve();
        })
      });
    });
  };
}
