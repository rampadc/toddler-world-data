import Bottleneck from 'bottleneck';
import {Client} from "ts-nats";
import {GameTypes} from "./Providers";
import {NatsAdapter} from "./NatsAdapter";

export interface Point {
  x: number;
  y: number
}

export class WorldVillages {
  coordinates: Point[] = [];
  limiter = new Bottleneck({
    minTime: 200,
    maxConcurrent: 5
  });
  worldId: string;
  n: NatsAdapter;
  separation = 50;

  constructor(worldId: string, n: NatsAdapter) {
    for (let x = 0; x < 1000; x += this.separation) {
      for (let y = 0; y < 1000; y += this.separation) {
        this.coordinates.push({
          x: x, y: y
        })
      }
    }

    this.worldId = worldId;
    this.n = n;
  }

  get() {
    for (let i = 0; i < this.coordinates.length; i++) {
      this.n.request({
        type: GameTypes.MAP_GETVILLAGES,
        data: {
          x: this.coordinates[i].x,
          y: this.coordinates[i].y,
          width: this.separation,
          height: this.separation
        }
      }).then(data => {
        console.log(data);
      });
      break;
    }
  }
}
