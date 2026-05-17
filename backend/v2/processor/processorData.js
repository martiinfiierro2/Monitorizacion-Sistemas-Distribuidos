const internalConfig = {

    name: '',
    port: 0,
    capacity: 0,
    preference: 0,
    urlCoordinatorMain: '',
    urlCoordinatorSubs: ''
}

const setInternal = (name, value) => {
    switch (name) {
        case 'name':
            internalConfig.name = value
            break;
        case 'port':
            internalConfig.port = value
            break;
        case 'capacity':
            internalConfig.capacity = value
            break;
        case 'preference':
            internalConfig.preference = value
            break;
        case 'urlCoordinatorMain':
            internalConfig.urlCoordinatorMain = value
            break;
        case 'urlCoordinatorSubs':
            internalConfig.urlCoordinatorSubs = value
            break;
        default:
            break;
    }
}

const getInternal = (name) => {
    switch (name) {
        case 'name':
            return internalConfig.port;
        case 'port':
            return internalConfig.port;
        case 'capacity':
            return internalConfig.capacity;
        case 'preference':
            return internalConfig.preference;
        case 'urlCoordinatorMain':
            return internalConfig.urlCoordinatorMain;
        case 'urlCoordinatorSubs':
            return internalConfig.urlCoordinatorSubs;

        default:
            break;
    }
    return undefined;
}

module.exports = { internalConfig, getInternal, setInternal }