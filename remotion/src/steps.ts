// The chapters of the Open guide (src/content/learn/steps/open-strategy), in the guide's order, and the
// block each one adds to the strategy. The bar along the bottom of every video shows this list, lit up to the step.

export type StepInfo = { id: string; slug: string; number: string; title: string; block: string; group: 'base' | 'strategy' | 'car' };

export const STEPS: StepInfo[] = [
  { id: 'Paso0', slug: 'paso-0-instalar-y-preparar', number: '0', title: 'Instalar y preparar', block: 'Entorno y paquete', group: 'base' },
  { id: 'Paso1', slug: 'paso-1-el-coche', number: '1', title: 'El coche (modelo de bicicleta)', block: 'Modelo de bicicleta', group: 'strategy' },
  { id: 'Paso2', slug: 'paso-2-el-rumbo', number: '2', title: 'El rumbo (giroscopio)', block: 'Rumbo (giroscopio)', group: 'strategy' },
  { id: 'Paso3', slug: 'paso-3-ver-el-campo', number: '3', title: 'Ver el campo (LiDAR)', block: 'LiDAR: 5 números', group: 'strategy' },
  { id: 'Paso4', slug: 'paso-4-seguir-la-isla', number: '4', title: 'Seguir la isla', block: 'Carril a 25 cm', group: 'strategy' },
  { id: 'Paso5', slug: 'paso-5-la-esquina', number: '5', title: 'La esquina', block: 'Esquina a tope', group: 'strategy' },
  { id: 'Paso6', slug: 'paso-6-cuando-girar', number: '6', title: 'Cuándo girar', block: 'Puerta de giro', group: 'strategy' },
  { id: 'Paso7', slug: 'paso-7-la-mision', number: '7', title: 'La misión', block: 'Misión: 3 estados', group: 'strategy' },
  { id: 'Paso8', slug: 'paso-8-la-direccion', number: '8', title: 'La dirección (cámara)', block: 'Sentido por cámara', group: 'strategy' },
  { id: 'Paso9', slug: 'paso-9-puntuar-y-medir', number: '9', title: 'Puntuar y medir', block: 'Puntos y tiempo', group: 'strategy' },
  { id: 'Armar', slug: 'armar-y-conectar-el-coche', number: '9.5', title: 'Armar y conectar el coche', block: 'Coche armado', group: 'car' },
  { id: 'Paso10', slug: 'paso-10-el-coche-real', number: '10', title: 'El coche real', block: 'Sensores probados', group: 'car' },
  { id: 'CocheV5', slug: 'coche-del-equipo-v5', number: '10.5', title: 'El coche del equipo: IMU y v5', block: 'IMU, servo y motor', group: 'car' },
  { id: 'Paso11', slug: 'paso-11-solucion-de-problemas', number: '11', title: 'Solución de problemas', block: 'Diagnóstico', group: 'car' },
  { id: 'Paso12', slug: 'paso-12-afinar', number: '12', title: 'Afinar', block: 'Afinar', group: 'car' },
];

export const stepIndex = (id: string) => STEPS.findIndex((s) => s.id === id);
