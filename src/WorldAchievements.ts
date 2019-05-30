import {GameTypes} from "./core/Providers";
import {NatsAdapter} from "./core/NatsAdapter";
import {Collection} from "mongodb";
import {DbAdapter} from "./core/DbAdapter";
import {Log} from "./core/Log";

export class WorldAchievements {
  private collection: Collection;
  private progress = 0;

  update(ids: any[]): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      ids.map(id => {
        NatsAdapter.shared.request({
          type: GameTypes.ACHIEVEMENT_GET_CHAR_ACHIEVEMENTS,
          data: {
            character_id: id
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
            this.progress += 1;

            Log.service().debug(`Achievements for character ${d['character_id']} committed. Progress: ${this.progress}/${ids.length}`);
            NatsAdapter.shared.client.publish('world-date.progress.achievements', {
              progress: this.progress / ids.length,
              total: ids.length
            });
            if (this.progress >= ids.length) {
              Log.service().info('Completed achievements retrieval.');
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
    Log.service().info('Starting achievements retrieval...');
    return new Promise<void>((resolve, reject) => {
      this.collection = DbAdapter.shared.collection('villages');
      let cursor = this.collection.find(
        {current: true, character_id: {$ne: null}}
      ).project({character_id: 1});

      cursor.map(c => c['character_id']).toArray().then(ids => {
        this.collection = DbAdapter.shared.collection('achievements');

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
            Log.service().info('Achievements: last update was too recent.');
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
