/**
 * myPromise class
 * @description the promise source code achieve
 * only create simple method 
 */
class MyPromise {
    constructor(func: string) {
        if (func && typeof func === "function") {
            throw new Error("please input function as parameter");
        } else {
            func && func(this.resolve, this.reject);
        }
    }
    private resolve() {

    }
    private reject() {

    }
};
export default MyPromise;