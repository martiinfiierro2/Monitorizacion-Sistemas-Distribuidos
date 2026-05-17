export const CY_STYLE: any[] = [
  {
    selector: 'node',
    style: {
      'label': 'data(name)',
      'text-valign': 'bottom',
      'text-margin-y': 8,
      'width': 'data(size)',
      'height': 'data(size)',
      'background-image': 'data(image)',
      
      // CAMBIOS CLAVE AQUÍ:
      'background-fit': 'contain',    // Asegura que la imagen quepa dentro del ancho/alto
      'background-clip': 'none',      // EVITA QUE SE CORTE la imagen fuera del área del nodo
      'bounds-expansion': 0,          // Espacio extra alrededor del nodo si fuera necesario
      'shape': 'rectangle',           // Cambiar a rectángulo ayuda si tus PNGs son cuadrados
      
      'background-opacity': 0,
      'font-size': '12px',
      'color': '#333',
      'text-wrap': 'ellipsis',
      'text-max-width': '80px'
    }
  },
  {
  selector: 'edge',
  style: {
    'width': 2,
    'line-color': '#90caf9',
    'curve-style': 'bezier',    // Crucial: curva las líneas para que no se solapen
    'control-point-step-size': 40, // Cuanto más alto, más se curvan
    'target-arrow-shape': 'triangle',
    'opacity': 0.7
  }
}
];