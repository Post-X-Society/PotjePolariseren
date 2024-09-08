const User = require('./user');
const Room = require('./room');
const Video = require('./video');

module.exports = (sequelize) => {
  const models = {
    User: User(sequelize),
    Room: Room(sequelize),
    Video: Video(sequelize)
  };

  // Set up associations
  Object.values(models).forEach(model => {
    if (model.associate) {
      model.associate(models);
    }
  });

  return models;
};