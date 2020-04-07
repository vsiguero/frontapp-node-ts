import * as request from 'superagent';
import { Analytics } from './analytics';
import { Contacts } from './contacts';
import { Channels } from './channels';
import { IMessage, IFile } from './interfaces/message.interface';

export interface FrontPagination {
  next: string;
}

export interface FrontErrorInterface {
  message: string;
  title: string;
  details: string[];
  status: number;
}

export class FrontAppError extends Error {
  constructor(
    message: string,
    title: string,
    details: string[],
    status: number,
  ) {
    super(message);
    this.name = 'FrontAppError';
    this.message = message;
    this.status = status;
    this.title = title;
    this.details = details;
  }

  public message: string;
  public status: number;
  public details: string[];
  public title: string;
}

export default class FrontAppClient {
  constructor(token?: string, apiUrl?: string) {
    // constructor(...args) {
    // if (args.length === 2) {
    //   this.usernamePart = args[0];
    //   this.passwordPart = args[1];
    // } else if (args.length === 1) {
    //   if (args[0].token) {
    //     this.usernamePart = args[0].token;
    //     this.passwordPart = '';
    //   } else {
    //     this.usernamePart = args[0].appId;
    //     this.passwordPart = args[0].appApiKey;
    //   }
    // }
    // if (!this.usernamePart || this.passwordPart === undefined) {
    //   throw new Error('Could not construct a client with those parameters');
    // }
    this.token = token;

    if (!this.token || this.token === undefined) {
      throw new Error('Could not construct a client with those parameters');
    }

    this.API_URL = apiUrl || 'https://api2.frontapp.com';

    // Set initial request headers
    this._request = request
      .agent()
      .set('Authorization', 'Bearer ' + this.token)
      .set('Accept', 'application/json')
      .set('User-Agent', 'frontapp/1.0.0');

    this.analytics = new Analytics(this);
    this.channels = new Channels(this);
    this.contacts = new Contacts(this);

    // Promises are default
    this.promises = true;
  }

  useCallbacks() {
    this.promises = false;
    return this;
  }

  API_URL: string;
  token: string;
  promises: boolean;

  public analytics: Analytics;
  public channels: Channels;
  public contacts: Contacts;

  private _request: request.SuperAgentStatic;

  async promiseProxy(f: any, req: request.SuperAgentRequest) {
    if (this.promises || !f) {
      try {
        const res = await req;
        // console.log(res.body);
        const frontError: FrontErrorInterface = res.body._error;
        const hasErrors = frontError && frontError.status !== 200;
        if (hasErrors) {
          throw new FrontAppError(
            frontError.message,
            frontError.title,
            frontError.details,
            frontError.status,
          );
        }
        return res.body;
      } catch (err) {
        // console.log(err);
        throw err;
      }
    } else {
      req.end((err, res) => {
        console.log('callback res', res.body);
        if (res.error && res.body && res.body._error) {
          const frontError: FrontErrorInterface = res.body._error;
          f(
            new FrontAppError(
              frontError.message || frontError.title,
              frontError.title,
              frontError.details,
              frontError.status,
            ),
            null,
          );
        } else {
          f(null, res.body);
        }
      });
    }
  }

  async put(endpoint: string, data: object, f: any) {
    return await this.promiseProxy(
      f,
      this._request
        .put(`${this.API_URL}${endpoint}`)
        //.auth(this.usernamePart, this.passwordPart)
        .send(data),
    );
  }

  async post(endpoint: string, data: object, f: any) {
    return await this.promiseProxy(
      f,
      this._request
        .post(`${this.API_URL}${endpoint}`)
        //.auth(this.usernamePart, this.passwordPart)
        .send(data),
    );
  }

  async postMessage(endpoint: string, data: IMessage, file: IFile, f: any) {
    return await this.promiseProxy(
      f,
      this._request
        .post(`${this.API_URL}${endpoint}`)
        //.auth(this.usernamePart, this.passwordPart)
        .set('Content-Type', 'multipart/form-data')
        .field('sender[contact_id]', data.contact_id.toString())
        .field('sender[handle]', data.handle.toString())
        .field('body', data.body.toString())
        .field('to[0]', data.to.toString())
        .attach('attachments', file.buffer, {
          filename: file.name.toString(),
          contentType: file.mimetype.toString(),
        }),
    );
  }

  async get(endpoint: string, data: object, f: any) {
    return await this.promiseProxy(
      f,
      this._request
        .get(`${this.API_URL}${endpoint}`)
        //.auth(this.usernamePart, this.passwordPart)
        .query(data),
    );
  }

  async nextPage(paginationObject: FrontPagination, f: any) {
    return await this.promiseProxy(
      f,
      this._request.get(paginationObject.next),
      //.auth(this.usernamePart, this.passwordPart)
    );
  }

  async delete(endpoint: string, data: object, f: any) {
    return await this.promiseProxy(
      f,
      this._request
        .delete(`${this.API_URL}${endpoint}`)
        //.auth(this.usernamePart, this.passwordPart)
        .query(data),
    );
  }

  callback(f: any, res: any) {
    if (!f) {
      return;
    }
    if (f.length >= 2) {
      const frontError: FrontErrorInterface = res.body._error;
      const hasErrors = frontError && frontError.status !== 200;
      if (hasErrors) {
        f(
          new FrontAppError(
            frontError.message,
            frontError.title,
            frontError.details,
            frontError.status,
          ),
          null,
        );
      } else {
        f(null, res);
      }
    } else {
      f(res);
    }
  }
}
