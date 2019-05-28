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
  separation = 50;

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

  updateInternalVariables() {
    this.collection = DbAdapter.shared.collection('villages');
  }

  updateCollection(villages: any[]): Promise<any[]> {
    return Promise.all(villages.map((v: any) => {
      v['current'] = true;
      v['updated_at'] = new Date().toISOString();
      return this.collection.bulkWrite([
        { updateMany: { filter: {id: v['id']}, update: {$set: {current: false}} } },
        { insertOne: { document: v } }
      ], {ordered:true, w: 1});
    }));
  }

  get() {
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
          console.log(this.progress);
        }).catch(error => {
        console.log(error);
      })
    })
    .catch(error => {
      Log.service().error(error);
    });
    }
  }
}
