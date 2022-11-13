import Material from './material';
import WindTurbinePart from './windTurbinePart';

const FASTENER_SUFFIXES = [
  'Bolts',
  'Nuts',
  'Screws',
  'Washers',
];

export default function getMaterial(partName, defaultMaterial = Material.STEEL) {
  if (partName.includes('ResinCast')) {
    return Material.RESIN;
  } else if (
    partName === WindTurbinePart.Stator_Coils || partName === WindTurbinePart.Stator_Coil
  ) {
    return Material.COPPER;
  } else if (partName.includes('Magnets')) {
    return Material.MAGNET;
  } else if (partName === WindTurbinePart.Tail_Vane) {
    return Material.WOOD;
  } else if (
    partName === WindTurbinePart.Rotor_Disk_Back
    || FASTENER_SUFFIXES.some((suffix) => partName.endsWith(suffix))
  ) {
    return Material.STEEL;
  } else {
    return defaultMaterial;
  }
}
