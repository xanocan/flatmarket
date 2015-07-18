var _ = require('lodash')
var BPromise = require('bluebird')
var constants = require('./constants')
var Flatmarket = require('flatmarket-client')

var TYPES = constants.types
var STRIPE_CHECKOUT_FIELDS = [
    'allowRememberMe',
    'billingAddress',
    'bitcoin',
    'currency',
    'image',
    'name',
    'panelLabel',
    'shippingAddress',
    'zipCode',
]
var PRODUCT_CHECKOUT_FIELDS = [
    'amount',
    'description',
    'name',
]

exports.checkout = checkout
exports.checkoutCancel = checkoutCancel
exports.createCharge = createCharge
exports.reset = reset
exports.updateStatus = updateStatus

function checkout(sku) {
    return function (dispatch, getState) {
        if (getState().get('error')) return BPromise.resolve()
        dispatch(checkoutBegin(sku))
        return BPromise.resolve()
            .then(function () {
                if (getState().get('error')) return BPromise.resolve()
                return new BPromise(function (resolve) {
                    var state = getState()
                    var stripe = state
                        .getIn([
                            'schema',
                            'stripe',
                        ])
                        .toJS()
                    var product = state
                        .getIn([
                            'schema',
                            'products',
                            sku,
                        ])
                        .toJS()
                    var options = _.chain({})
                        .extend(_.pick.apply(_, [stripe].concat(STRIPE_CHECKOUT_FIELDS)))
                        .extend(_.pick.apply(_, [product].concat(PRODUCT_CHECKOUT_FIELDS)))
                        .extend({
                            closed: resolve,
                            token: resolve,
                        })
                        .value()
                    state.get('stripeCheckout').open(options)
                })
            })
            .then(function (token) {
                if (!token) {
                    dispatch(checkoutCancel())
                } else {
                    dispatch(createCharge(token))
                }
            })
    }
}

function checkoutBegin(sku) {
    return {
        type: TYPES.checkoutBegin.id,
        payload: sku,
    }
}

function checkoutCancel() {
    return {
        type: TYPES.checkoutCancel.id,
    }
}

function createCharge(token) {
    return function (dispatch, getState) {
        if (getState().get('error')) return BPromise.resolve()
        dispatch(createChargeBegin(token))
        return BPromise.resolve()
            .then(function () {
                var state = getState()
                return Flatmarket.create({
                    host: state.getIn([
                        'schema',
                        'server',
                        'host',
                    ]),
                    pathname: state.getIn([
                        'schema',
                        'server',
                        'pathname',
                    ]),
                }).createCharge(state.get('charge').toJS())
            })
            .then(function () {
                dispatch(createChargeSuccess())
            }, function (err) {
                dispatch(createChargeFailure(err))
            })
    }
}

function createChargeBegin(token) {
    return {
        type: TYPES.createChargeBegin.id,
        payload: token,
    }
}

function createChargeFailure() {
    return {
        type: TYPES.createChargeFailure.id,
    }
}

function createChargeSuccess() {
    return {
        type: TYPES.createChargeSuccess.id,
    }
}

function reset(schema) {
    return {
        type: TYPES.reset.id,
        payload: schema,
    }
}

function updateStatus() {
    return function (dispatch, getState) {
        if (getState().get('error')) return BPromise.resolve()
        dispatch(updateStatusBegin())
        return BPromise.resolve()
            .then(function () {
                var state = getState()
                return Flatmarket.create({
                    host: state.getIn([
                        'schema',
                        'server',
                        'host',
                    ]),
                    pathname: state.getIn([
                        'schema',
                        'server',
                        'pathname',
                    ]),
                }).getStatus()
            })
            .then(function () {
                dispatch(updateStatusSuccess())
            }, function () {
                dispatch(updateStatusFailure())
            })
    }
}

function updateStatusBegin() {
    return {
        type: TYPES.updateStatusBegin.id,
    }
}

function updateStatusFailure() {
    return {
        type: TYPES.updateStatusFailure.id,
    }
}

function updateStatusSuccess() {
    return {
        type: TYPES.updateStatusSuccess.id,
    }
}