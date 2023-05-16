const { find, getUpdatableFields } = require('../models/material');

const MaterialService = () => {
  const getMaterial = async (id) => find(id);

  const getMaterialMaxQuantity = async (id) =>
    find(id).then((material) =>
      material ? material.getPossibleQuantity() : 0
    );

  const updateMaterial = async (id, payload) => {
    const material = await find(id);
    if (!material) throw new Error('Not found');

    // Update entity using whitelisted fields list
    getUpdatableFields().forEach((fieldName) => {
      if (Object.keys(payload || {}).includes(fieldName)) {
        material[fieldName] = payload[fieldName];
      }
    });

    // Persist changes
    await material.update();

    // Return a copy of the updated object
    return material;
  };

  return {
    getMaterial,
    getMaterialMaxQuantity,
    updateMaterial
  };
};

module.exports = MaterialService;
