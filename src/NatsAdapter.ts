import {ISocketMessage} from "./ISocketMessage";
import {Client} from 'ts-nats';

export class NatsAdapter {
  private static _instance: NatsAdapter;
  private _client: Client;

  private constructor() {
  }

  set client(client: Client) {
    this._client = client;

  }

  public static get shared(): NatsAdapter {
    return this._instance || (this._instance = new this());
  }

  request(gameMsg: ISocketMessage): Promise<ISocketMessage> {
    return new Promise<ISocketMessage>((resolve, reject) => {
      this._client.request(
        gameMsg.type.replace('/', '.').toLowerCase(), 3000, gameMsg)
        .then(msg => {
          resolve(msg.data);
        })
        .catch(error => {
          reject(error);
        })
    });
  }

  fire(gameMsg: ISocketMessage) {
    this._client.publish('authenticator.to.game', gameMsg);
  }
}
