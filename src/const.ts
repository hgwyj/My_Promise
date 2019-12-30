const enum PromiseState {
    PENDING = 'pending',
    FULFILLED = 'fulfilled',
    REJECTED = 'rejected',
};
const PROMISE_STATUS = {
    pending: 0,
    fulfilled: 1,
    rejected: 2
};
const TRY_CATCH_ERROR = { error: null };

export { PromiseState, PROMISE_STATUS, TRY_CATCH_ERROR };