const appID = process.env.TTN_APP_ID || '';
module.exports = { appID, accessKey: process.env.TTN_ACCESS_KEY || '', mqttQue: process.env.MQTT_URL || 'mqtts://eu1.cloud.thethings.network:8883', suscribe: (process.env.MQTT_TOPICS || ('v3/' + appID + '/devices/+/up')).split(',') };
