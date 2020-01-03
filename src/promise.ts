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
    private getThen(value: any) {
        try {
            return value.then;
        } catch (error) {
            TRY_CATCH_ERROR.error = error;
            return TRY_CATCH_ERROR;
        }
    }
    private mockResolve(value: any) {
        if (this === value) {
            this.mockReject(resolveSelfError);
            return;
        };
        if (!isObjectORFunction(value)) {
            this.fulfill(value);
            return;
        };
        this.handleLikeThenable(value, this.getThen(value));
    }
    private handleLikeThenable(value: any, then: any) {
        if (this.isThenable(value, then)) {
            this.handleOwnThenable(value);
            return;
        }
        // 获取 then 值失败且抛出异常，则以此异常为拒因 reject promise
        if (then === TRY_CATCH_ERROR) {
            this.mockReject(TRY_CATCH_ERROR.error);
            TRY_CATCH_ERROR.error = null;
            return;
        }
        // 如果 then 是函数，则检验 then 方法的合法性
        if (isFunction(then)) {
            this.handleForeignThenable(value, then);
            return;
        }
        this.fulfill(value);
    }
    private tryThen(then: any, thenable: any, resolvePromise: any, rejectPromise: any) {
        try {
            then.call(thenable, resolvePromise, rejectPromise);
        } catch (e) {
            return e;
        }
    }
    private handleForeignThenable(thenable: any, then: any) {
        this.asap(() => {
            // 如果 resolvePromise 和 rejectPromise 均被调用，
            // 或者被同一参数调用了多次，则优先采用首次调用并忽略剩下的调用
            // 此处 sealed (稳定否)，用于处理上诉逻辑
            // sealed 参数 ---> 营造一个promise 环境状态一经改变就不能在进行更改
            let sealed = false;
            const error = this.tryThen(
                then,
                thenable,
                (value: any) => {
                    if (sealed) {
                        return;
                    }
                    sealed = true;
                    if (thenable !== value) {
                        this.mockResolve(value);
                    } else {
                        this.fulfill(value);
                    }
                },
                (reason: any) => {
                    if (sealed) {
                        return;
                    }
                    sealed = true;
                    this.mockReject(reason);
                }
            );
            if (!sealed && error) {
                sealed = true;
                this.mockReject(error);
            }
        });
    }
    private handleOwnThenable(thenable: any) {
        // 处理 value 为 promise 对象的情况
        const state = thenable.status;
        const result = thenable.value;
        if (state === PROMISE_STATUS.fulfilled) {
            this.fulfill(result);
            return;
        }
        if (state === PROMISE_STATUS.rejected) {
            this.mockReject(result);
            return;
        }
        this.subscribe(
            thenable,
            undefined,
            (value: any) => this.mockResolve(value),
            (reason: any) => this.mockReject(reason)
        );
    }
    private isThenable(value: any, then: any) {
        const sameConstructor = value.constructor === this.constructor;
        const sameThen = then === this.then;
        const sameResolve = value.constructor.resolve === MyPromise.resolve;
        return sameConstructor && sameThen && sameResolve;;
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

    static resolve = (object: any) => {
        //传入的参数是promise
        if (object && typeof object === "object" && object.constructor === MyPromise) {
            return object;
        }
        let promise = new MyPromise(() => { });
        promise.mockResolve(object);
        return promise;
    }
    static reject = (reason: any) => {
        let promise = new MyPromise(() => { });
        promise.mockReject(reason);
        return promise;
    }
    static all = (entries: []) => {
        let result: any[] = [];
        let num = 0;
        if (!Array.isArray(entries)) {
            MyPromise.reject(new TypeError("You must pass an array to all."));
        } else {
            if (entries.length === 0) {
                return MyPromise.resolve([]);
            }
            return new MyPromise((res, rej) => {
                entries.forEach(e => {
                    MyPromise.resolve(e).then((data: any) => {
                        result.push(data);
                        num += 1;
                        if (num === entries.length) {
                            res(result);
                        }
                    }, rej);
                });
            });
        }
    }
    static race = (entries: []) => {
        return new MyPromise((res, rej) => {
            if (!Array.isArray(entries)) {
                rej(new TypeError("You must pass an array to race."))
            } else {
                for (let e of entries) {
                    MyPromise.resolve(e).then(res, rej);
                }
            }
        });
    }
};
export default MyPromise;