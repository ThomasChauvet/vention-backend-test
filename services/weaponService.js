const { find } = require('../models/weapon');

const WeaponService = () => {
  const getWeapon = async (id) => find(id);

  const getWeaponMaxQuantity = async (id) =>
    find(id).then((weapon) => (weapon ? weapon.getPossibleQuantity() : 0));

  return {
    getWeapon,
    getWeaponMaxQuantity
  };
};

module.exports = WeaponService;
