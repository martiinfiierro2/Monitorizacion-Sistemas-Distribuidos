
/**
 * Messages to print when detect error
 */
const msg = {
    error_port: `
    
    *****************************************
    Error, missing or incorrect PORT parameter
    *****************************************
    
    USE: node balancer.js PORT TYPE [URL_MAIN] 

    PORT: port on which the component listens, value > 0
    TYPE: main/subs, indicates whether the component is a main component or a substitute
    URL: OPTONAL, url of the main balancer
    -----------------------------------------
    `,
    error_type: `
    
    *****************************************
    Error, missing or incorrect TYPE parameter
    *****************************************
    
    USE: node balancer.js PORT TYPE [URL_MAIN] 

    PORT: port on which the component listens, value > 0
    TYPE: main/subs, indicates whether the component is a main component or a substitute
    URL: OPTONAL, url of the main balancer
    -----------------------------------------
    `,
    error_url: `
    
    *****************************************
    Error, missing or incorrect URL parameter
    *****************************************
    
    USE: node balancer.js PORT TYPE [URL_MAIN] 

    PORT: port on which the component listens, value > 0
    TYPE: main/subs, indicates whether the component is a main component or a substitute
    URL: OPTONAL, url of the main balancer
    -----------------------------------------
    `
}

// Tipos de proceso permitido
const typePermeted = ['main', 'subs']

/**
 * Receibe array or args and return object whith arguments validation or error
 */
const { setInternal } = require('./balancerData');

const parseArgs = (args) => {

    // Obtenemso el puerto de la entrada de comando
    const port = Number(args[2] || 0);

    if (!port || port <= 0) {
        console.error(msg.error_port);
        return -1;
    }

    // obtenemso el type, debe ser main o subs
    const type = String(args[3] || '');
    if (!typePermeted.includes(type.toLowerCase())) {
        console.error(msg.error_type);
        return -1;
    }

    const urlMain = args[4] || '';
    if (type == 'subs' && urlMain == '') {
        console.error(msg.error_url);
        return -1;
    }
    setInternal('port', port);
    setInternal('type', type);
    setInternal('urlMain', urlMain);
    return { port, type, urlMain }

}

const updateBalancerList = (balancerList, Data) => {
    balancerList.splice(0, balancerList.length);
    // añadimos los nuevos elementos a la lista
    Data.forEach(element => {
        balancerList.push({name:element.name, load:element.load, url: element.url});
    });
}



module.exports = { parseArgs, updateBalancerList };




