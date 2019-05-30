import {GameTypes} from "./core/Providers";
import {NatsAdapter} from "./core/NatsAdapter";
import {Collection} from "mongodb";
import {DbAdapter} from "./core/DbAdapter";
import {Log} from "./core/Log";

export class WorldTribes {
  private collection: Collection;
  private progress = 0;

  update(ids: any[]): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      ids.map(id => {
        NatsAdapter.shared.request({
          type: GameTypes.TRIBE_GET_PROFILE,
          data: {
            tribe_id: id
          }
        }).then((d: any) => {
          d['current'] = true;
          d['updated_at'] = new Date().toISOString();
          return this.collection.bulkWrite([
            {
              updateMany:
                {
                  filter: {tribe_id: d['tribe_id']},
                  update: {$set: {current: false}}
                }
            },
            {insertOne: {document: d}}
          ], {ordered: true, w: 1}).then(() => {
            this.progress += 1;

            Log.service().debug(`Tribe ${d['tag']} committed. Progress: ${this.progress}/${ids.length}`);
            NatsAdapter.shared.client.publish('world-date.progress.tribes', {
              progress: this.progress / ids.length,
              total: ids.length
            });
            if (this.progress >= ids.length) {
              Log.service().info('Completed tribes retrieval.');
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

  get(): Promise<void> {
    Log.service().info('Starting tribes retrieval...');
    return new Promise<void>((resolve, reject) => {
      this.collection = DbAdapter.shared.collection('villages');
      let cursor = this.collection.find(
        {current: true, tribe_id: {$ne: null}}
      ).project({tribe_id: 1});

      cursor.map(c => c['tribe_id']).toArray().then(ids => {
        this.collection = DbAdapter.shared.collection('tribes');

        this.collection.findOne({}, {
          sort: {updated_at: -1},
          limit: 1,
          projection: {updated_at: 1}
        }).then(result => {
          ids = Array.from(new Set(ids));
          ids.sort();

          const d = new Date(result['updated_at']);
          if ((new Date().getTime() - 3600_000) > d.getTime()) {
            this.update(ids).then(() => {
              resolve();
            });
          } else {
            Log.service().info('Tribes: last update was too recent.');
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
  };
}
