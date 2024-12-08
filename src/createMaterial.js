import MaterialFactory from './materialFactory';
import WindTurbinePart from './windTurbinePart';

const FASTENER_PATTERNS = [
  'Bolts',
  'Nut',
  'Screws',
  'Washer',
  'Rods',
];

const WOODEN_PARTS = [
  WindTurbinePart.Blade_Assembly_BackDisk,
  WindTurbinePart.Blade_Assembly_FrontTriangle,
  WindTurbinePart.Tail_Vane
];

export default function createMaterial(partName, defaultMaterialFactoryFunction = MaterialFactory.createSteel) {
  if (partName.includes('ResinCast')) {
    return MaterialFactory.createResin();
  } else if (
    partName.startsWith(WindTurbinePart.Stator_Coils)
  ) {
    return MaterialFactory.createCopper();
  } else if (partName.includes('Magnets')) {
    return MaterialFactory.createMagnet();
  } else if (WOODEN_PARTS.includes(partName)) {
    return MaterialFactory.createWood();
  } else if (
    partName === WindTurbinePart.Rotor_Disk_Back
    || FASTENER_PATTERNS.some((pattern) => partName.includes(pattern))
  ) {
    return MaterialFactory.createSteel();
  } else {
    return defaultMaterialFactoryFunction();
  }
}
