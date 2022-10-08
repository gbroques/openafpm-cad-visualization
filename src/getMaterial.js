import Material from './material';
import WindTurbinePart from './windTurbinePart';

export default function getMaterial(partName, defaultMaterial = Material.STEEL) {
  if (partName.includes('ResinCast')) {
    return Material.RESIN;
  } else if (partName === WindTurbinePart.Stator_Coils || partName === 'Stator_Coil') {
    return Material.COPPER;
  } else if (partName.includes('Magnets')) {
    return Material.MAGNET;
  } else if (partName === WindTurbinePart.Tail_Vane) {
    return Material.WOOD;
  } else {
    return defaultMaterial;
  }
}