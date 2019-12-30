/**
 * myPromise class
 * @description the promise source code achieve
 * only create simple method 
 */
import { resolveError, constructorError, resolveSelfError, cannotReturnOwn } from '../utils/error';
import { PromiseState, PROMISE_STATUS, TRY_CATCH_ERROR } from './const';
import { isObjectORFunction, isFunction } from '../utils/is';
interface IResolver<R> {
    (resolve: IResolve<R>, reject: IReject): void;
}
interface Thenable<R> {
    then<U>(
        onFulfilled?: (value: R) => U | Thenable<U>,
        onRejected?: (error: any) => U | Thenable<U>
    ): Thenable<U>;
    then<U>(
        onFulfilled?: (value: R) => U | Thenable<U>,
        onRejected?: (error: any) => void
    ): Thenable<U>;
}
interface IResolve<R> {
    (value?: R | Thenable<R>): void;
}
interface IReject {
    (error?: any): void;
};
type PromiseStatus = 'pending' | 'fulfilled' | 'rejected';
class MyPromise<R> implements Thenable<R> {
    private status: PromiseStatus = PromiseState.PENDING;
    private value: any;
    private subscribes: any[] = [];
    constructor(resolver: IResolver<R>) {
        typeof resolver !== "function" && resolveError();
        this instanceof MyPromise ? this.init(resolver) : constructorError();
    };
    private mockReject(reason: any) {
        this.value = reason;
        this.status = PromiseState.REJECTED;
        this.asap(this.publish);
    }
    private asap(cb: TimerHandler) {
        setTimeout(cb, 0);
    }
    private mockResolve(value: any) {
        if (this === value) { this.mockReject(resolveSelfError); return; };
        if (!isObjectORFunction(value)) {
            this.fulfill(value);
            return;
        };
    }
    private fulfill(value: any) {
        this.status = PromiseState.FULFILLED;
        this.value = value;
        if (this.subscribes.length !== 0) {
            this.asap(this.publish);
        }
    }
    private init(resolver: IResolver<R>) {
        try {
            resolver(
                this.mockResolve,
                this.mockReject,
            );
        } catch (error) {
            this.mockReject(error);
        }
        return;
    }

    private trycatch(callback: Function, detail: any) {
        try {
            return callback(detail);
        } catch (e) {
            TRY_CATCH_ERROR.error = e;
            return TRY_CATCH_ERROR;
        }
    }

    private subscribe(parent: any, child: any, onFulfillment: any, onRejection: any) {
        let {
            subscribes,
            subscribes: { length }
        } = parent;
        subscribes[length] = child;
        subscribes[length + PROMISE_STATUS.fulfilled] = onFulfillment;
        subscribes[length + PROMISE_STATUS.rejected] = onRejection;
        if (length === 0 && PROMISE_STATUS[<PromiseStatus>parent.status]) {
            this.asap(this.publish);
        }
    }

    private publish() {
        const subscribes = this.subscribes;
        const state = this.status;
        const settled = PROMISE_STATUS[state];
        const result = this.value;
        if (subscribes.length === 0) {
            return;
        }
        for (let i = 0; i < subscribes.length; i += 3) {
            const item = subscribes[i];
            const callback = subscribes[i + settled];
            if (item) {
                this.invokeCallback(state, item, callback, result);
            } else {
                callback(result);
            }
        }
        this.subscribes.length = 0;
    }

    private invokeCallback(settled: string, child: any, callback: any, detail: any) {
        const hasCallback = isFunction(callback);
        let value, error, succeeded, failed;
        if (hasCallback) {
            value = this.trycatch(callback, detail);
            if (value === TRY_CATCH_ERROR) {
                failed = true;
                error = value.error;
                value.error = null;
            } else {
                succeeded = true;
            }
            if (child === value) {
                this.mockReject.call(child, cannotReturnOwn());
            }
        } else {
            value = detail;
            succeeded = true;
        }
        if (child.status !== PromiseState.PENDING) {
            return;
        }
        if (hasCallback && succeeded) {
            this.mockResolve.call(child, value);
            return;
        }

        if (failed) {
            this.mockReject.call(child, error);
            return;
        }

        if (settled === PromiseState.FULFILLED) {
            this.fulfill.call(child, value);
            return;
        }

        if (settled === PromiseState.REJECTED) {
            this.mockReject.call(child, value);
            return;
        }
    }

    then(onFulfilled?: any, onRejected?: any) {
        const parent: any = this;
        const child = new parent.constructor(() => { });
        const state = PROMISE_STATUS[this.status];
        if (state) {
            // 对于状态已经改变完成invoke对应的状态的function
            const callback = arguments[state - 1];
            this.asap(() => this.invokeCallback(
                this.status,
                child,
                callback,
                this.value,
            ));
        } else {
            //有异步操作进行状态的订阅
            this.subscribe(parent, child, onFulfilled, onRejected);
        }
        return child;
    }

    catch(onRejection: any) {
        return this.then(null, onRejection);
    }

    finally(callback: any) {
        return this.then(callback, callback);
    }
};
export default MyPromise;