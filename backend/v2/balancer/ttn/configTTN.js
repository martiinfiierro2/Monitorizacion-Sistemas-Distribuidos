
// Topic Y
mqttQue='mqtt://eu1.cloud.thethings.network:1883'

// Aplicación ua-sensors
appID='ua-sensor@ttn'
accessKey='NNSXS.VHCKXEROUIBVRURMLCECRVTHRF77EGFRV2G3RNI.GCFZXXJF4VZCBH5V7YHHNT3OWKLCTPDVLRU74XVWFAPQ7IMI2S2A'

// suscribe es un array de colas a las que se suscribe el usuario
suscribe=['v3/'+appID+'/devices/+/up']

module.exports = {
    appID,
    accessKey,
    suscribe, 
    mqttQue
}