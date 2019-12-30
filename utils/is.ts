function isObject(val: any) {
    return val !== null && typeof val === "object";
};

function isFunction(val: any) {
    return toString.call(val) === '[object function]';
};

function isObjectORFunction(val: any) {
    return isObject(val) || isFunction(val);
};

export { isFunction, isObject, isObjectORFunction };