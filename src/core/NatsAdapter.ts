import {ISocketMessage} from "./ISocketMessage";
import {Client} from 'ts-nats';
import Bottleneck from "bottleneck";

export class NatsAdapter {
  private static _instance: NatsAdapter;
  private _client: Client;
  private _limiter = new Bottleneck({
    minTime: 250,
    maxConcurrent: 5
  });

  request = this._limiter.wrap(this._request);
  fire = this._limiter.wrap(this._fire);

  private constructor() {
  }

  set client(client: Client) {
    this._client = client;
  }

  get client(): Client {
    return this._client;
  }

  public static get shared(): NatsAdapter {
    return this._instance || (this._instance = new this());
  }

  private _request(gameMsg: ISocketMessage): Promise<ISocketMessage> {
    return new Promise<ISocketMessage>((resolve, reject) => {
      this._client.request(
        gameMsg.type.replace('/', '.').toLowerCase(), 30000, gameMsg)
        .then(msg => {
          resolve(msg.data);
        })
        .catch(error => {
          reject(error);
        })
    });
  }

  private _fire(gameMsg: ISocketMessage): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this._client.publish('authenticator.to.game', gameMsg);
      resolve();
    });
  }
}
