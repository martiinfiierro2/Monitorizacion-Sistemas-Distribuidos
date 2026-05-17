/**
 * Messages to print when detect error
 */

const msg_common = `

    USE: node processor.js NAME PORT CAPACITY PREFERENCE URLCOORDINATORMAIN URLCOORDINATORSUBS 

    ----------------------------------------------------------------------------------------------
    NAME: name that identifies the proceesor
    PORT: port on which the component listens, value > 0
    CAPACITY: capacity of process, num of messages per second
    PREFERENCE: preference to be select, value 0-1
    URLCOORDINATORMAIN: URL to comunicate with Main Coordinator
    URLCOORDINATORSUBS: URL to comunicate with Subs Coordinator
    ----------------------------------------------------------------------------------------------

    `;

const msg = {
    error_missing:`
    
    *****************************************
    Error, missing parameters
    *****************************************
    ${msg_common}`,
    error_name: `
    
    *****************************************
    Error, missing or incorrect NAME parameter
    *****************************************
    ${msg_common}`,
    error_port: `
    
    *****************************************
    Error, missing or incorrect PORT parameter
    *****************************************
    ${msg_common}`,
    error_capacity: `
    
    *****************************************
    Error, missing or incorrect CAPACITY parameter
    *****************************************
    ${msg_common}`,
    error_preference: `
    
    *****************************************
    Error, missing or incorrect PREFERENCE parameter
    *****************************************
    ${msg_common}`,
    error_urlCoordinatorMain: `
    
    *****************************************
    Error, missing or incorrect URLCOORDINATORMAIN parameter
    *****************************************
    ${msg_common}`,
    error_urlCoordinatorSubs: `
    
    *****************************************
    Error, missing or incorrect URLCOORDINATORSUBS parameter
    *****************************************
    ${msg_common}`
}


const internal = require('stream');
const { setInternal, internalConfig } = require('./processorData');

/**
 * Receibe array or args and return object whith arguments validation or error
 */
const parseArgs = (args) => {
    //    node processor.js NAME PORT CAPACITY PREFERENCE URLCOORDINATORMAIN URLCOORDINATORSUBS  

    if (args.length<8) {
        console.error(msg.error_missing);
        return -1;
    }

    const name = args[2] || '';
    if (name.length<=0) {
        console.error(msg.error_name);
        return -1;
    }

    const port = Number(args[3] || 0);
    if (!port || port <= 0) {
        console.error(msg.error_port);
        return -1;
    }

    const capacity = Number(args[4] || 0);
    if (!capacity || capacity <= 0) {
        console.error(msg.error_capacity);
        return -1;
    }

    const preference = Number(args[5] || 0);
    if (!preference || preference < 0 || preference>1) {
        console.error(msg.error_preference);
        return -1;
    }

    const urlCoordinatorMain = String(args[6] || '');
    if (urlCoordinatorMain.length<=0) {
        console.error(msg.error_urlCoordinatorMain);
        return -1;
    }

    const urlCoordinatorSubs = String(args[7] || '');
    if (urlCoordinatorSubs.length<=0) {
        console.error(msg.error_urlCoordinatorSubs);
        return -1;
    }

    setInternal('name',name);
    setInternal('port',port);
    setInternal('capacity',capacity);
    setInternal('preference',preference);
    setInternal('urlCoordinatorMain',urlCoordinatorMain);
    setInternal('urlCoordinatorSubs',urlCoordinatorSubs);

    return { name, port, capacity, preference, urlCoordinatorMain, urlCoordinatorSubs }

}




module.exports = {parseArgs}