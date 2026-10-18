// Ventana móvil de diez segundos; capacidad y carga se expresan en mensajes/s.
const windowMs = 10000;
let samples = [];
function prune(now = Date.now()) { samples = samples.filter(time => now - time < windowMs); }
function addMessage() { const now = Date.now(); prune(now); samples.push(now); }
function totalMeters() { prune(); return samples.length; }
function messageRate() { return totalMeters() / (windowMs / 1000); }
module.exports = { addMessage, totalMeters, messageRate };
