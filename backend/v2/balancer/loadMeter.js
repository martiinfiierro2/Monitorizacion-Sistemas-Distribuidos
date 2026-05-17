


// Vamos a guardar los últimos 60 segunods
const longMeter = 10;
// Unidad de medida, 1 seg. = 1000 ms
const unitMeter = 1000;

const toUnitMeter = (number) => {
    return Math.round(number / unitMeter)
}

// Lee la fecha en la que se inicia el objeto
var iniTime = toUnitMeter(new Date().getTime());

// Lista con las medidas tomadas cada unitMeter y longitud longMeter máximo
var metersArray = Array(longMeter).fill(0);
const totalMeters = () => {
    const res = metersArray.reduce((acc, current) => acc + current, 0);
    return res;
} 

/**
 * n funciona bien , mete arrays con empty y cosas
 */
// Vamos a sumar 1 a la cuenta
const addMessage = () => {
    // tomamos el tiempo actual y le restamos el inicial desde el que estamos midiendo
    // esto nos daría la posición en el array de matersArray donde tiene que suman
    const now = toUnitMeter(new Date().getTime());
    var seconds = now - iniTime + 1;
    //console.log('Seconds:', seconds);
    // Si la posición actual de meters es menor que la posición donde habría que añaidir
    // alargamos el metrs
    if (seconds > longMeter) {
        //console.log('Seconds > longMeter:', seconds);
        // Cuantas posiciones más hay que añadir, la posición menos la longitud
        var i = seconds - longMeter;
        // si hay que añadir más de longMeters, creamos un array nuevo todo de 0
        if (i > longMeter) {
            //console.log('i > longMeter  i=', i);
            metersArray = Array(longMeter).fill(0);
            //console.log('Creo array todo a 0: ', metersArray)
            // vamos a añadir en la última posición
        } else {
            //console.log('i <= longMeter  i=', i);
            // añades tantos elementos detrás como sea necesario
            const add = Array(i).fill(0);
            metersArray = metersArray.concat(add);
            //console.log('-Concateno i elementos ', add, ' a 0: ', metersArray)
            // eliminalos los mismos elementos del principio
            metersArray.splice(0, i)
            //console.log('Elimino del principio para dejar los longMeter: ', metersArray)

        }
        seconds = longMeter;
        iniTime = now - seconds;
    }
    //console.log('Añado 1 al elemento: ', seconds - 1, ' que vale ahora ', metersArray[seconds - 1])
    metersArray[seconds - 1]++;
    //console.log('Actualizo meters:', metersArray,' total:',totalMeters());

}


module.exports = { addMessage, totalMeters }