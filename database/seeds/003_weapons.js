const { weapons } = require('../tables');

/**
 * @param {import('knex').Knex} knex
 */
exports.seed = function (knex) {
  // Deletes ALL existing entries
  return knex(weapons)
    .del()
    .then(function () {
      // Inserts seed entries
      return knex(weapons).insert([
        {
          id: 1,
          name: 'Excalibur',
          power_level: null,
          qty: 0,
          deleted_at: null
        },
        {
          id: 2,
          name: 'Magic Staff',
          power_level: null,
          qty: 0,
          deleted_at: null
        }
      ]);
    });
};
