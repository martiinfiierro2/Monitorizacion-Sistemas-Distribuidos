const internalConfig = {
    port: 0,
    type: '',
    urlBalancerMain: '',
    urlBalancerSubs: '',
    urlCoordinatorlMain: '',
    typeRol:''
}

const setInternal = (name, value) => {
    switch (name) {
        case 'port':
            internalConfig.port = value
            break;
        case 'type':
            internalConfig.type = value
            break;
        case 'urlBalancerMain':
            internalConfig.urlBalancerMain = value
            break;
        case 'urlBalancerSubs':
            internalConfig.urlBalancerSubs = value
            break;
        case 'urlCoordinatorlMain':
            internalConfig.urlCoordinatorlMain = value
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
        case 'urlBalancerMain':
            return internalConfig.urlBalancerMain;
        case 'urlBalancerSubs':
            return internalConfig.urlBalancerSubs;
        case 'urlCoordinatorlMain':
            return internalConfig.urlCoordinatorlMain;
        
        default:
            break;
    }
    return undefined;
}

module.exports = { internalConfig, getInternal, setInternal }
