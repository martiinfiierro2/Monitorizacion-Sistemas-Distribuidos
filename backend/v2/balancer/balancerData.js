const internalConfig = {
    port: 0,
    type: '',
    urlMain: '',
}

const setInternal = (name, value) => {
    switch (name) {
        case 'port':
            internalConfig.port = value
            break;
        case 'type':
            internalConfig.type = value
            break;
        case 'urlMain':
            internalConfig.urlMain = value
            break;
        default:
            break;
    }
}

const getInternal = (name) => {
    switch (name) {
        case 'port':
            return internalConfig.port;
        case 'type':
            return internalConfig.type;
        case 'urlMain':
            return internalConfig.urlMain;
        default:
            break;
    }
    return undefined;
}

module.exports = { internalConfig, getInternal, setInternal }