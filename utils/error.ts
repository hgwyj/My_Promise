const resolveError = () => {
    return new TypeError("You must pass a resolver function as the  first argumnet to the promise function");
}
const constructorError = () => {
    return new TypeError("Failed to construct 'promise':Please use the 'new' operator, this object constructor cannot be called as a function");
}
const resolveSelfError = () => {
    return new TypeError('You cannot resolve a promise with itself');
};
const cannotReturnOwn = () => {
    return new TypeError('A promises callback cannot return that same promise.');
};
export { resolveError, constructorError, resolveSelfError, cannotReturnOwn };