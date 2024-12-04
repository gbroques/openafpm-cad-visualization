import Material from './material';
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

export default function getMaterial(partName, defaultMaterial = Material.STEEL) {
  if (partName.includes('ResinCast')) {
    return Material.RESIN;
  } else if (
    partName.startsWith(WindTurbinePart.Stator_Coils)
  ) {
    return Material.COPPER;
  } else if (partName.includes('Magnets')) {
    return Material.MAGNET;
  } else if (WOODEN_PARTS.includes(partName)) {
    return Material.WOOD;
  } else if (
    partName === WindTurbinePart.Rotor_Disk_Back
    || FASTENER_PATTERNS.some((pattern) => partName.includes(pattern))
  ) {
    return Material.STEEL;
  } else {
    return defaultMaterial;
  }
}
