import Bottleneck from 'bottleneck';
import {GameTypes} from "./core/Providers";
import {NatsAdapter} from "./core/NatsAdapter";

export interface Point {
  x: number;
  y: number
}

export class WorldVillages {
  coordinates: Point[] = [];
  worldId: string;
  separation = 50;

  constructor(worldId: string) {
    for (let x = 0; x < 1000; x += this.separation) {
      for (let y = 0; y < 1000; y += this.separation) {
        this.coordinates.push({
          x: x, y: y
        })
      }
    }

    this.worldId = worldId;
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
        console.log(data);
      }).catch(error => {
        console.log(error);
      });
    }
  }
}
