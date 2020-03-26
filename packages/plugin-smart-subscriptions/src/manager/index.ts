/* eslint-disable no-await-in-loop */
import { MaybePromise } from '@giraphql/core';
import { MergedAsyncIterator, FieldSubscriptionManager, TypeSubscriptionManager } from '..';

export type RefetchFunction<T, ParentShape> = (val: T) => ParentShape;
export type IteratorFilterFunction<T = unknown> = (val: T) => boolean;
export type IteratorCallback<T = unknown> = (val: T) => MaybePromise<void>;
export type IteratorCacheInvalidator<T = unknown> = (val: T) => void;

export interface RegisterOptions<T = unknown> {
  filter?: IteratorFilterFunction<T>;
  onValue?: IteratorCallback<T>;
}

export default class SubscriptionManager {
  iterator: MergedAsyncIterator<unknown>;

  activeSubscriptions = new Map<string, AsyncIterator<unknown>>();

  nextSubscriptions = new Map<string, AsyncIterator<unknown>>();

  activeOptions = new Map<string, RegisterOptions[]>();

  nextOptions = new Map<string, RegisterOptions[]>();

  subscribeToName: <T>(name: string) => AsyncIterator<T>;

  value: unknown;

  constructor(value: unknown, subscribe: (name: string) => AsyncIterator<unknown>) {
    this.subscribeToName = subscribe as <T>(name: string) => AsyncIterator<T>;

    this.value = value;

    this.iterator = new MergedAsyncIterator<unknown>([], {
      closeWhenExhausted: false,
      unref: true,
      debounce: 10,
      debounceFirst: true,
    });

    // Trigger initial fetch
    this.iterator.pushValue(null);
  }

  forField(refetch: () => MaybePromise<void>) {
    return new FieldSubscriptionManager(this, refetch);
  }

  forType(
    replace: (promise: MaybePromise<unknown>) => void,
    refetchParent: () => MaybePromise<void>,
  ) {
    return new TypeSubscriptionManager(this, replace, refetchParent);
  }

  addOptions(name: string, options: RegisterOptions) {
    if (this.nextOptions.has(name)) {
      this.nextOptions.set(name, []);
    }

    this.nextOptions.get(name)!.push(options);
  }

  async filterValue(name: string, value: unknown) {
    const optionsList = this.activeOptions.get(name);

    if (!optionsList) {
      return true;
    }

    let allowed = false;

    const promises: Promise<void>[] = [];

    for (const options of optionsList) {
      const currentAllowed = !options.filter || options.filter(value);

      allowed = allowed || currentAllowed;

      if (currentAllowed && options.onValue) {
        const promise = options.onValue(value);

        if (promise) {
          promises.push(promise);
        }
      }
    }

    await Promise.all(promises);

    return allowed;
  }

  register<T>(name: string, options: RegisterOptions<T>) {
    if (this.nextSubscriptions.has(name)) {
      return;
    }

    if (this.activeSubscriptions.has(name)) {
      this.nextSubscriptions.set(name, this.activeSubscriptions.get(name)!);

      return;
    }

    this.addOptions(name, options as RegisterOptions);

    const iterator = this.subscribeToName(name);

    const pullValue = async () => {
      let nextVal = await iterator.next();

      while (!(await this.filterValue(name, nextVal))) {
        nextVal = await iterator.next();
      }

      return nextVal;
    };

    const firstResult = pullValue();

    let first = true;

    const primed = {
      throw: iterator.throw?.bind(iterator),
      return: iterator.return?.bind(iterator),
      next: () => {
        if (first) {
          first = false;

          return firstResult;
        }

        return pullValue();
      },
    };

    this.nextSubscriptions.set(name, primed);
    this.iterator.add(primed);
  }

  [Symbol.asyncIterator](): AsyncIterator<unknown> {
    return {
      return: this.iterator.return,
      throw: this.iterator.throw,
      next: () => {
        [...this.activeSubscriptions.keys()].forEach(name => {
          if (!this.nextSubscriptions.has(name)) {
            // eslint-disable-next-line no-unused-expressions
            this.activeSubscriptions.get(name)?.return?.(null);
          }
        });

        this.activeSubscriptions = this.nextSubscriptions;
        this.nextSubscriptions = new Map();
        this.activeOptions = this.nextOptions;
        this.nextOptions = new Map();

        return this.iterator.next().then(({ done }) => ({ done, value: this.value }));
      },
    };
  }
}
