import {Collection, Db} from "mongodb";

export class DbAdapter {
  private static _instance: DbAdapter;
  private _db: Db;

  private constructor() {
  }

  public static get shared(): DbAdapter {
    return this._instance || (this._instance = new this());
  }

  set db(db: Db) {
    this._db = db;
  }

  collection(collection: string): Collection {
    return this._db.collection(collection);
  }
}
