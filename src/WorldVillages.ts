import {GameTypes} from "./core/Providers";
import {NatsAdapter} from "./core/NatsAdapter";
import {Collection} from "mongodb";
import {DbAdapter} from "./core/DbAdapter";
import {Log} from "./core/Log";

export interface Point {
  x: number;
  y: number
}

export class WorldVillages {
  coordinates: Point[] = [];
  worldId: string;
  separation = 20;

  progress = 0;
  private collection: Collection;

  constructor(worldId: string) {
    for (let x = 0; x < 1000; x += this.separation) {
      for (let y = 0; y < 1000; y += this.separation) {
        this.coordinates.push({
          x: x, y: y
        });
      }
    }

    this.worldId = worldId;
  }

  updateCollection(villages: any[]): Promise<any[]> {
    if (villages.length == 0) {
      return new Promise<any[]>(resolve => {
        resolve();
      });
    } else {
      return Promise.all(villages.map((v: any) => {
        /* v: new doc, uncommitted */
        v['current'] = true;
        v['updating'] = true;
        v['updated_at'] = new Date().toISOString();

        /* Updating, set all current docs to have current=false, existing current=true doc with same ID set to current=false, updating=true */
        return this.collection.bulkWrite([
          {updateMany: {filter: {id: v['id'], updating: false, current: true}, update: {$set: {updating: true, current: false}}}},
          {updateMany: {filter: {id: v['id']}, update: {$set: {current: false}}}}, // if collection is brand new, the above operation will not occur
          {insertOne: {document: v}}
        ], {ordered: true, w: 1});
      }));
    }
  }

  update(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      for (let i = 0; i < this.coordinates.length; i++) {
        NatsAdapter.shared.request({
          type: GameTypes.MAP_GETVILLAGES,
          data: {
            x: this.coordinates[i].x,
            y: this.coordinates[i].y,
            width: this.separation,
            height: this.separation
          }
        }).then(data => {
          this.updateCollection(data['villages'])
            .then(() => {
              this.progress += 1;

              Log.service().debug(`Villages for (${data['x']}, ${data['y']}) committed. Progress: ${this.progress}/${this.coordinates.length}`);
              NatsAdapter.shared.client.publish('world-data.progress.villages', {
                progress: this.progress / this.coordinates.length,
                total: this.coordinates.length
              });
              if (this.progress >= this.coordinates.length) {
                resolve();
              }
            }).catch(error => {
              Log.service().error(error);
              reject(error);
          })
        }).catch(error => {
          Log.service().error(error);
          reject(error);
        });
      }
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
    Log.service().info('Starting villages retrieval...');

    return new Promise<void>((resolve) => {
      this.collection = DbAdapter.shared.collection('villages');

      let timeout = new Promise<void>((resolve, reject) => {
        let wait = setTimeout(() => {
          clearTimeout(wait);
          reject();
        }, timeout_minutes * 60_000);
      });

      let fetch = new Promise<void>((resolve, reject) => {
        // get latest updated_at date
        this.collection.findOne({}, {
          sort: {updated_at: -1},
          limit: 1,
          projection: {updated_at: 1}
        }).then(result => {
          const d = new Date(result['updated_at']);
          if ((new Date().getTime() - 3600_000) > d.getTime()) {
            this.update().then(() => {
              resolve();
            });
          } else {
            Log.service().info('Last update was too recent.');
            resolve();
          }
        }).catch(error => {
          // assumed to be empty collection
          this.update().then(() => {
            resolve();
          });
        });
      });

      Promise.race([timeout, fetch]).then(() => {
        this.finaliseUpdate().then(() => {
          NatsAdapter.shared.client.publish('world-data.completed.villages');
          resolve();
        });
      }).catch(() => {
        this.rollback().then(() => {
          NatsAdapter.shared.client.publish('world-data.completed.villages');
          resolve();
        });
      });
    });
  }
}
